"""Decode the game's localization package (StreamingAssets/i18n/<lang>.bin.br) into JSON.

Format ("LOC1", game 0.61.x), little-endian:
  0   char[4]  "LOC1"
  4   u32      format version (4)
  8   u32      1
  12  u32      build number (e.g. 66 for Prod_0.61.0_66)
  16  u32 x2   hashes
  24  u32      ?
  28  u32      entry count (42,666 for en_US 0.61.0)
  32  u32      index offset (104)
  40  u32      string blob offset (index offset + 16 * count)
  ... version string and package id ("0.61.0", "Prod_0.61.0_66")
  index: count x { u64 key hash, u32 offset into blob, u32 byte length }, sorted by hash
  blob:  UTF-8 strings, no terminators; offset 0xFFFFFFFF = no string

Keys are hashed with FNV-1a 64 over the UTF-8 key (e.g. "ui-vip-chest-ruby"). Key names are not stored, so this
script resolves the keys it can find as string literals in global-metadata.dat. Names built at runtime (items,
sets, stats: the Localized.md_* helpers) need the running game; see ../README.md.

Usage: python decode_localization.py [game_dir] [out_dir] [lang]
"""
import json
import os
import struct
import sys
from pathlib import Path

import brotli  # pip install brotli

DEFAULT_GAME = Path(os.environ.get("APPDATA", "")) / "zone.hitzone.invokers.launcher" / "game"


def fnv1a64(text: str) -> int:
    h = 0xCBF29CE484222325
    for byte in text.encode("utf-8"):
        h = ((h ^ byte) * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return h


def read_package(path: Path):
    raw = brotli.decompress(path.read_bytes())
    if raw[:4] != b"LOC1":
        raise ValueError(f"{path.name}: not a LOC1 package")
    count, index_off = struct.unpack_from("<II", raw, 28)
    blob_off = index_off + 16 * count
    version = package = None
    try:
        # version and package id are short length-prefixed strings in the header
        pos = raw.index(b"\x06\x00", 40, index_off)
        n = struct.unpack_from("<H", raw, pos)[0]
        version = raw[pos + 2:pos + 2 + n].decode()
        pos += 2 + n
        n = struct.unpack_from("<H", raw, pos)[0]
        package = raw[pos + 2:pos + 2 + n].decode()
    except ValueError:
        pass
    strings = {}
    for i in range(count):
        key_hash, off, length = struct.unpack_from("<QII", raw, index_off + 16 * i)
        if off != 0xFFFFFFFF:
            strings[key_hash] = raw[blob_off + off:blob_off + off + length].decode("utf-8", "replace")
    return version, package, strings


def metadata_literals(game: Path):
    """String literals from global-metadata.dat (il2cpp metadata v39: header of (offset, size, count) triples)."""
    meta = (game / "Invokers_Data" / "il2cpp_data" / "Metadata" / "global-metadata.dat").read_bytes()
    sanity, version = struct.unpack_from("<Ii", meta, 0)
    if sanity != 0xFAB11BAF:
        raise ValueError("not an il2cpp metadata file")
    lit_off, _lit_size, lit_count, data_off, data_size, _ = struct.unpack_from("<6I", meta, 8)
    offs = struct.unpack_from(f"<{lit_count}I", meta, lit_off)
    data = meta[data_off:data_off + data_size]
    return [data[offs[i]:offs[i + 1]].decode("utf-8", "replace") for i in range(lit_count - 1)]


def main():
    game = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "out"
    lang = sys.argv[3] if len(sys.argv) > 3 else "en_US"
    out.mkdir(parents=True, exist_ok=True)

    version, package, strings = read_package(game / "Invokers_Data" / "StreamingAssets" / "i18n" / f"{lang}.bin.br")
    literals = metadata_literals(game)
    resolved = {}
    for lit in literals:
        h = fnv1a64(lit)
        if h in strings:
            resolved[lit] = strings[h]

    # every string by hash (raw, for later key matching) and the keys we could name
    (out / f"strings-{lang}-by-hash.json").write_text(
        json.dumps({f"{h:016x}": s for h, s in strings.items()}, ensure_ascii=False), encoding="utf-8")
    (out / f"strings-{lang}-named.json").write_text(
        json.dumps(dict(sorted(resolved.items())), ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{lang} {version} ({package}): {len(strings)} strings, {len(resolved)} keys named from code literals -> {out}")


if __name__ == "__main__":
    main()
