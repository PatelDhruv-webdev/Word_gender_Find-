#!/usr/bin/env python3
"""Generate placeholder PNG icons (gradient + 'G') without external deps.

Pure-stdlib PNG writer + a tiny pixel renderer. Sizes: 16/32/48/128.
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
SIZES = [16, 32, 48, 128]

# gradient stops (r,g,b at t=0, 0.5, 1)
G0 = (124, 58, 237)   # #7c3aed
G1 = (236, 72, 153)   # #ec4899
G2 = (6, 182, 212)    # #06b6d4


def lerp(a, b, t):
    return a + (b - a) * t


def grad(t):
    if t < 0.5:
        u = t / 0.5
        return tuple(int(lerp(G0[i], G1[i], u)) for i in range(3))
    u = (t - 0.5) / 0.5
    return tuple(int(lerp(G1[i], G2[i], u)) for i in range(3))


# 5x7 pixel font for 'G'
G_GLYPH = [
    " XXXX",
    "X    ",
    "X    ",
    "X  XX",
    "X   X",
    "X   X",
    " XXX ",
]


def render(size):
    radius = int(size * 0.22)
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            # rounded rect alpha
            inside = True
            cx, cy = x, y
            if cx < radius and cy < radius:
                inside = (radius - cx) ** 2 + (radius - cy) ** 2 <= radius ** 2
            elif cx >= size - radius and cy < radius:
                inside = (cx - (size - radius - 1)) ** 2 + (radius - cy) ** 2 <= radius ** 2
            elif cx < radius and cy >= size - radius:
                inside = (radius - cx) ** 2 + (cy - (size - radius - 1)) ** 2 <= radius ** 2
            elif cx >= size - radius and cy >= size - radius:
                inside = (cx - (size - radius - 1)) ** 2 + (cy - (size - radius - 1)) ** 2 <= radius ** 2
            if not inside:
                row.append((0, 0, 0, 0))
                continue
            t = (x + y) / (2 * (size - 1)) if size > 1 else 0
            r, g, b = grad(t)
            row.append((r, g, b, 255))
        rows.append(row)

    # overlay 'G'
    glyph_w, glyph_h = 5, 7
    scale = max(1, int(size * 0.62 / glyph_h))
    px_w = glyph_w * scale
    px_h = glyph_h * scale
    ox = (size - px_w) // 2
    oy = (size - px_h) // 2 + max(0, scale // 2)
    for gy, line in enumerate(G_GLYPH):
        for gx, ch in enumerate(line):
            if ch != "X":
                continue
            for sy in range(scale):
                for sx in range(scale):
                    px = ox + gx * scale + sx
                    py = oy + gy * scale + sy
                    if 0 <= px < size and 0 <= py < size:
                        r, g, b, a = rows[py][px]
                        if a:
                            rows[py][px] = (255, 255, 255, 255)
    return rows


def png(rows):
    size = len(rows)
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter
        for r, g, b, a in row:
            raw.extend((r, g, b, a))

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for s in SIZES:
        path = OUT / f"icon-{s}.png"
        path.write_bytes(png(render(s)))
        print("wrote", path)


if __name__ == "__main__":
    main()
