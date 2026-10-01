"""Minimal reader for MemoryPack version-tolerant objects, as used by the game's local snapshot files.

Version-tolerant object layout: [member count: 1 byte] [member byte lengths: count x VarInt] [member bytes ...]
VarInt: a signed byte; 0..127 = that value, otherwise a type code followed by the value
(-121 byte, -122 sbyte, -123 uint16, -124 int16, -125 uint32, -126 int32, -127 uint64, -128 int64).
Collections: int32 count then elements (-1 = null). Unmanaged values are raw little-endian bytes.
"""
import struct


class Reader:
    def __init__(self, data: bytes, pos: int = 0):
        self.b, self.pos = data, pos

    def u8(self):
        v = self.b[self.pos]; self.pos += 1; return v

    def take(self, n):
        v = self.b[self.pos:self.pos + n]; self.pos += n; return v

    def i32(self):
        v = struct.unpack_from('<i', self.b, self.pos)[0]; self.pos += 4; return v

    def i64(self):
        v = struct.unpack_from('<q', self.b, self.pos)[0]; self.pos += 8; return v

    def varint(self):
        code = struct.unpack_from('<b', self.b, self.pos)[0]; self.pos += 1
        if code >= 0:
            return code
        fmt = {-121: '<B', -122: '<b', -123: '<H', -124: '<h', -125: '<I', -126: '<i', -127: '<Q', -128: '<q'}[code]
        v = struct.unpack_from(fmt, self.b, self.pos)[0]; self.pos += struct.calcsize(fmt); return v

    def object(self):
        """Returns the member byte slices of a version-tolerant object, or None for a null object (255)."""
        count = self.u8()
        if count == 255:
            return None
        lengths = [self.varint() for _ in range(count)]
        return [self.take(n) for n in lengths]


def i32(b): return struct.unpack('<i', b[:4])[0]
def i64(b): return struct.unpack('<q', b[:8])[0]
def f64(b): return struct.unpack('<q', b[:8])[0] / 2 ** 32   # the game's F64 fixed point (Q32.32)
def nullable_i32(b): return i32(b[4:8]) if b and b[0] else None
