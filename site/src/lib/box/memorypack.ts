// Minimal reader for MemoryPack version-tolerant objects, as used by the game's local snapshot files.
// TypeScript port of datamine/scripts/memorypack.py; see datamine/samples/README.md for the format.
//
// Version-tolerant object: [member count: u8] [member byte lengths: count x VarInt] [member bytes ...]
// VarInt: a signed byte; 0..127 = that value, otherwise a type code followed by the value.
// Collections: int32 count then elements (-1 = null). Values are little-endian.

export class Reader {
  private view: DataView;

  constructor(
    private bytes: Uint8Array,
    public pos = 0,
  ) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private need(n: number): void {
    if (this.pos + n > this.bytes.length) throw new RangeError('Unexpected end of file');
  }

  u8(): number {
    this.need(1);
    return this.bytes[this.pos++];
  }

  take(n: number): Uint8Array {
    this.need(n);
    const v = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return v;
  }

  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  varint(): number {
    this.need(1);
    const code = this.view.getInt8(this.pos++);
    if (code >= 0) return code;
    const v = this.view;
    const p = this.pos;
    let size: number;
    let value: number;
    switch (code) {
      case -121: size = 1; this.need(size); value = v.getUint8(p); break;
      case -122: size = 1; this.need(size); value = v.getInt8(p); break;
      case -123: size = 2; this.need(size); value = v.getUint16(p, true); break;
      case -124: size = 2; this.need(size); value = v.getInt16(p, true); break;
      case -125: size = 4; this.need(size); value = v.getUint32(p, true); break;
      case -126: size = 4; this.need(size); value = v.getInt32(p, true); break;
      case -127: size = 8; this.need(size); value = Number(v.getBigUint64(p, true)); break;
      case -128: size = 8; this.need(size); value = Number(v.getBigInt64(p, true)); break;
      default: throw new RangeError(`Unknown VarInt code ${code}`);
    }
    this.pos += size;
    return value;
  }

  /** Member byte slices of a version-tolerant object, or null for a null object (count 255). */
  object(): Uint8Array[] | null {
    const count = this.u8();
    if (count === 255) return null;
    const lengths = Array.from({ length: count }, () => this.varint());
    return lengths.map((n) => this.take(n));
  }

  /** Reads a non-null object; a null where one is required means the file isn't what we expect. */
  requiredObject(): Uint8Array[] {
    const o = this.object();
    if (!o) throw new RangeError('Unexpected null object');
    return o;
  }
}

function view(b: Uint8Array, size: number): DataView {
  if (b.length < size) throw new RangeError('Member too short');
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

export const i32 = (b: Uint8Array): number => view(b, 4).getInt32(0, true);
export const i64 = (b: Uint8Array): bigint => view(b, 8).getBigInt64(0, true);
/** The game's F64 fixed point (Q32.32): raw int64 / 2^32. */
export const f64 = (b: Uint8Array): number => Number(i64(b)) / 2 ** 32;
export const bool = (b: Uint8Array): boolean => b.length > 0 && b[0] !== 0;
/** int? is [has value: u8][3 padding][int32]. */
export const nullableI32 = (b: Uint8Array): number | null => (b.length >= 8 && b[0] ? view(b, 8).getInt32(4, true) : null);
/** Little-endian unsigned integer of whatever width the member has (e.g. 16-bit enums). */
export const uint = (b: Uint8Array): number => b.reduceRight((acc, byte) => acc * 256 + byte, 0);
