#!/usr/bin/env python3
"""Generate extension icons (pure stdlib, no image libraries required)."""

import os
import struct
import zlib

SIZES = [16, 32, 48, 128]
WORK = 512
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

BG = (59, 130, 246, 255)      # blue
BG_DARK = (37, 99, 235, 255)  # deeper blue for subtle gradient
FG = (255, 255, 255, 255)


def write_png(path, width, height, rgba):
    raw = b"".join(
        b"\x00" + bytes(rgba[y * width * 4:(y + 1) * width * 4])
        for y in range(height)
    )

    def chunk(tag, data):
        block = tag + data
        return struct.pack(">I", len(data)) + block + struct.pack(">I", zlib.crc32(block) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(chunk(b"IHDR", header))
        fh.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        fh.write(chunk(b"IEND", b""))


def rounded_rect_mask(size, radius):
    mask = bytearray(size * size)
    r = radius
    for y in range(size):
        for x in range(size):
            dx = dy = 0.0
            if x < r:
                dx = r - x
            elif x > size - 1 - r:
                dx = x - (size - 1 - r)
            if y < r:
                dy = r - y
            elif y > size - 1 - r:
                dy = y - (size - 1 - r)
            inside = not (dx > 0 and dy > 0 and dx * dx + dy * dy > r * r)
            mask[y * size + x] = 255 if inside else 0
    return mask


def stamp_circle(buf, size, cx, cy, radius, color):
    r2 = radius * radius
    y0 = max(0, int(cy - radius) - 1)
    y1 = min(size - 1, int(cy + radius) + 1)
    x0 = max(0, int(cx - radius) - 1)
    x1 = min(size - 1, int(cx + radius) + 1)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                i = (y * size + x) * 4
                buf[i:i + 4] = bytes(color)


def draw_line(buf, size, x0, y0, x1, y1, width, color):
    dx, dy = x1 - x0, y1 - y0
    length = max((dx * dx + dy * dy) ** 0.5, 1e-6)
    steps = int(length * 2) + 2
    for s in range(steps + 1):
        t = s / steps
        stamp_circle(buf, size, x0 + dx * t, y0 + dy * t, width / 2.0, color)


def build():
    size = WORK
    buf = bytearray(size * size * 4)
    mask = rounded_rect_mask(size, int(size * 0.22))

    # background with a soft vertical gradient
    for y in range(size):
        t = y / (size - 1)
        color = tuple(int(BG[c] * (1 - t) + BG_DARK[c] * t) for c in range(3)) + (255,)
        for x in range(size):
            if mask[y * size + x]:
                i = (y * size + x) * 4
                buf[i:i + 4] = bytes(color)

    # letter "M"
    stroke = size * 0.115
    left, right = size * 0.27, size * 0.73
    top, bottom = size * 0.30, size * 0.72
    mid = size * 0.52
    draw_line(buf, size, left, bottom, left, top, stroke, FG)
    draw_line(buf, size, left, top, mid, top + (bottom - top) * 0.58, stroke, FG)
    draw_line(buf, size, mid, top + (bottom - top) * 0.58, right, top, stroke, FG)
    draw_line(buf, size, right, top, right, bottom, stroke, FG)

    os.makedirs(OUT_DIR, exist_ok=True)
    for out_size in SIZES:
        scaled = bytearray(out_size * out_size * 4)
        factor = size / out_size
        for y in range(out_size):
            ys, ye = int(y * factor), max(int(y * factor) + 1, int((y + 1) * factor))
            for x in range(out_size):
                xs, xe = int(x * factor), max(int(x * factor) + 1, int((x + 1) * factor))
                r = g = b = a = count = 0
                for sy in range(ys, min(size, ye)):
                    for sx in range(xs, min(size, xe)):
                        i = (sy * size + sx) * 4
                        r += buf[i]
                        g += buf[i + 1]
                        b += buf[i + 2]
                        a += buf[i + 3]
                        count += 1
                i = (y * out_size + x) * 4
                scaled[i] = r // count
                scaled[i + 1] = g // count
                scaled[i + 2] = b // count
                scaled[i + 3] = a // count
        path = os.path.join(OUT_DIR, f"icon{out_size}.png")
        write_png(path, out_size, out_size, scaled)
        print("wrote", path)


if __name__ == "__main__":
    build()
