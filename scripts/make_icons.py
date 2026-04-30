#!/usr/bin/env python3
"""
LaLe icon generator — dark rounded square with pixel-art "la" (rose)
top-left and "le" (amber/gold) bottom-right. Pure stdlib, no pip deps.
Sizes: 16 / 32 / 48 / 128 px.
"""
import struct
import zlib
from pathlib import Path

OUT   = Path(__file__).resolve().parent.parent / "icons"
SIZES = [16, 32, 48, 128]

# ── Brand colours ──────────────────────────────────────────────────────────
BG   = (9,   9,  14, 255)   # #09090e — near-black
ROSE = (224, 80, 122, 255)  # #e0507a — feminine / la
GOLD = (212, 146,  10, 255) # #d4920a — masculine / le
SEP  = (40,  40,  80, 255)  # separator line tint

# ── 5×7 pixel-art glyphs (MSB = leftmost pixel) ───────────────────────────
GLYPHS = {
    "l": [
        0b01000,
        0b01000,
        0b01000,
        0b01000,
        0b01000,
        0b01000,
        0b01110,
    ],
    "a": [
        0b00000,
        0b01110,
        0b00001,
        0b01111,
        0b10001,
        0b10011,
        0b01101,
    ],
    "e": [
        0b00000,
        0b01110,
        0b10001,
        0b11111,
        0b10000,
        0b10001,
        0b01110,
    ],
}
GW = 5   # glyph width
GH = 7   # glyph height


def draw_glyph(px, size, ch, ox, oy, scale, color):
    for gy, row in enumerate(GLYPHS.get(ch, [])):
        for gx in range(GW):
            if row & (1 << (GW - 1 - gx)):
                for sy in range(scale):
                    for sx in range(scale):
                        x = ox + gx * scale + sx
                        y = oy + gy * scale + sy
                        if 0 <= x < size and 0 <= y < size:
                            px[y][x] = color


def in_rrect(x, y, size, r):
    """True if (x,y) is inside a rounded-corner square of given corner radius."""
    if x < r and y < r:
        return (r - x) ** 2 + (r - y) ** 2 <= r * r
    if x >= size - r and y < r:
        return (x - (size - r - 1)) ** 2 + (r - y) ** 2 <= r * r
    if x < r and y >= size - r:
        return (r - x) ** 2 + (y - (size - r - 1)) ** 2 <= r * r
    if x >= size - r and y >= size - r:
        return (x - (size - r - 1)) ** 2 + (y - (size - r - 1)) ** 2 <= r * r
    return True


def render(size):
    r = max(3, int(size * 0.22))
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]

    # Background
    for y in range(size):
        for x in range(size):
            if in_rrect(x, y, size, r):
                px[y][x] = BG

    # Diagonal separator (anti-aliased: one-pixel-wide tinted line)
    for i in range(size):
        x, y = i, size - 1 - i
        if 0 <= x < size and 0 <= y < size and px[y][x][3]:
            bg = px[y][x]
            px[y][x] = tuple(min(255, bg[k] + SEP[k] // 3) for k in range(4))

    # Glyph scale and positioning
    scale    = max(1, size // 22)
    glyph_w  = GW * scale
    gap      = max(1, scale)
    word_w   = glyph_w * 2 + gap   # l + gap + a (or e)
    word_h   = GH * scale

    margin_x = max(2, int(size * 0.10))
    margin_y = max(2, int(size * 0.12))

    # "la" — rose, upper-left
    lx = margin_x
    ly = margin_y
    draw_glyph(px, size, "l", lx,              ly, scale, ROSE)
    draw_glyph(px, size, "a", lx + glyph_w + gap, ly, scale, ROSE)

    # "le" — gold, lower-right (mirrored from lower-right corner)
    lx2 = size - margin_x - word_w
    ly2 = size - margin_y - word_h
    draw_glyph(px, size, "l", lx2,               ly2, scale, GOLD)
    draw_glyph(px, size, "e", lx2 + glyph_w + gap, ly2, scale, GOLD)

    return px


def to_png(pixels):
    size = len(pixels)
    raw = bytearray()
    for row in pixels:
        raw.append(0)           # PNG filter byte (None)
        for r, g, b, a in row:
            raw.extend((r, g, b, a))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig  = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for s in SIZES:
        path = OUT / f"icon-{s}.png"
        path.write_bytes(to_png(render(s)))
        print(f"wrote {path}  ({s}×{s})")


if __name__ == "__main__":
    main()
