#!/usr/bin/env python3
"""Generate looping 16-bit style animated GIF backgrounds for chip.cafe rooms.

Each scene is rendered at 192x108 and meant to be upscaled with
`image-rendering: pixelated` in CSS.
"""
import math
import random

from PIL import Image, ImageDraw

W, H = 192, 108
FRAMES = 16
OUT = "assets"


def save(frames, name, duration=110):
    frames[0].save(
        f"{OUT}/{name}.gif",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        optimize=True,
    )
    print(f"wrote {OUT}/{name}.gif ({len(frames)} frames)")


# ---------------------------------------------------------------- starfield
def starfield():
    rng = random.Random(1337)
    layers = [
        # (speed px/frame, brightness palette, count)
        (1, [(60, 60, 90), (70, 70, 100)], 60),
        (2, [(110, 110, 150), (120, 120, 165)], 40),
        (4, [(200, 200, 235), (235, 235, 255)], 25),
    ]
    stars = [
        [(rng.randrange(W), rng.randrange(H), rng.choice(cols), rng.randrange(4)) for _ in range(n)]
        for _, cols, n in layers
    ]
    twinkle = [(rng.randrange(W), rng.randrange(H), rng.randrange(FRAMES)) for _ in range(14)]

    # Banded planet, lower right
    px, py, pr = 150, 78, 26
    bands = [(38, 20, 66), (58, 30, 96), (86, 44, 128), (122, 62, 160), (86, 44, 128), (58, 30, 96)]
    band_h = max(2, (2 * pr) // len(bands))

    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (8, 6, 20))
        d = ImageDraw.Draw(img)
        for (speed, _cols, _), layer in zip(layers, stars):
            for x0, y0, col, _ in layer:
                x = (x0 - speed * f) % W
                d.point((x, y0), fill=col)
        for tx, ty, phase in twinkle:
            if (f + phase) % FRAMES < 4:
                c = 160 + (f + phase) % 4 * 20
                d.point((tx, ty), fill=(c, c, 255))
        for i, col in enumerate(bands):
            y1 = py - pr + i * band_h
            y2 = min(py + pr, y1 + band_h)
            d.rectangle([px - pr, y1, px + pr, y2], fill=col)
        # circular mask: clear corners outside the planet disc
        mask = Image.new("L", (W, H), 0)
        md = ImageDraw.Draw(mask)
        md.ellipse([px - pr, py - pr, px + pr, py + pr], fill=255)
        bg = Image.new("RGB", (W, H), (8, 6, 20))
        # redraw stars behind planet region
        bd = ImageDraw.Draw(bg)
        for (speed, _cols, _), layer in zip(layers, stars):
            for x0, y0, col, _ in layer:
                x = (x0 - speed * f) % W
                bd.point((x, y0), fill=col)
        img = Image.composite(img, bg, mask)
        # planet rim highlight
        d = ImageDraw.Draw(img)
        d.arc([px - pr, py - pr, px + pr, py + pr], 200, 340, fill=(150, 90, 200))
        frames.append(img)
    save(frames, "starfield")


# ---------------------------------------------------------------- night city
def city():
    rng = random.Random(2024)
    horizon = 74
    # Pre-generate buildings: (x, w, top)
    buildings = []
    x = -4
    while x < W:
        bw = rng.randrange(12, 26)
        top = rng.randrange(28, horizon - 8)
        buildings.append((x, bw, top))
        x += bw + rng.randrange(0, 5)
    windows = []
    for bx, bw, top in buildings:
        for wx in range(bx + 2, bx + bw - 2, 4):
            for wy in range(top + 3, horizon - 3, 5):
                if rng.random() < 0.55:
                    windows.append((wx, wy, rng.random() < 0.5))
    # Only a handful of windows ever flicker, and slowly
    flickers = set(rng.sample(range(len(windows)), k=max(2, len(windows) // 40)))
    sky_stars = [(rng.randrange(W), rng.randrange(horizon - 24)) for _ in range(40)]

    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (10, 8, 28))
        d = ImageDraw.Draw(img)
        # gradient night sky (banded, 16-bit style)
        bands = [(16, 12, 44), (24, 16, 58), (34, 22, 74), (48, 30, 92)]
        bh = horizon // len(bands)
        for i, col in enumerate(bands):
            d.rectangle([0, i * bh, W, (i + 1) * bh], fill=col)
        # moon
        d.ellipse([160, 8, 176, 24], fill=(235, 230, 200))
        d.ellipse([158, 7, 172, 22], fill=(34, 22, 74))
        for sx, sy in sky_stars:
            if (sx + sy + f) % 6 < 4:
                d.point((sx, sy), fill=(170, 170, 210))
        # buildings
        for bx, bw, top in buildings:
            shade = 14 + (bx * 7 % 10)
            d.rectangle([bx, top, bx + bw, horizon], fill=(shade, shade, shade + 12))
            d.line([bx, top, bx + bw, top], fill=(40, 36, 70))
        # windows: steady, rare slow flicker
        for i, (wx, wy, on) in enumerate(windows):
            lit = on
            if i in flickers and (f // 4 + i) % 4 == 0:
                lit = not on
            col = (255, 200, 90) if lit else (26, 24, 46)
            d.rectangle([wx, wy, wx + 1, wy + 2], fill=col)
        # street
        d.rectangle([0, horizon, W, H], fill=(6, 5, 16))
        for lx in range(0, W, 24):
            d.line([lx, horizon + 14, lx + 8, horizon + 14], fill=(200, 160, 60))
        frames.append(img)
    save(frames, "city", duration=140)


# ------------------------------------------------------------------- forest
def forest():
    rng = random.Random(777)
    horizon = 78
    layers = [
        (1, (10, 34, 30), 10),   # far, slow
        (3, (6, 22, 20), 8),     # near, faster
    ]
    trees = []
    for speed, col, n in layers:
        layer = []
        for _ in range(n):
            tx = rng.randrange(W * 2)
            th = rng.randrange(26, 50)
            tw = rng.randrange(8, 16)
            layer.append((tx, th, tw))
        trees.append(layer)
    fireflies = [
        (rng.randrange(W), rng.randrange(30, H - 8), rng.randrange(FRAMES), rng.random())
        for _ in range(16)
    ]
    sky_stars = [(rng.randrange(W), rng.randrange(30)) for _ in range(30)]

    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (4, 10, 12))
        d = ImageDraw.Draw(img)
        # night-teal sky bands
        for i, col in enumerate([(8, 20, 24), (6, 16, 20), (4, 12, 16)]):
            d.rectangle([0, i * 20, W, (i + 1) * 20], fill=col)
        for sx, sy in sky_stars:
            if (sx + f) % 5 < 3:
                d.point((sx, sy), fill=(140, 170, 160))
        # moon glow behind trees
        d.ellipse([30, 10, 44, 24], fill=(200, 220, 190))
        # tree layers, scrolling left at different speeds
        for (speed, col, _), layer in zip(layers, trees):
            for tx, th, tw in layer:
                x = (tx - speed * f) % (W * 2) - W // 2
                top = horizon - th
                d.rectangle([x + tw // 2 - 1, top + th // 2, x + tw // 2 + 1, horizon], fill=col)
                d.polygon(
                    [(x, top + th // 3), (x + tw, top + th // 3), (x + tw // 2, top)],
                    fill=col,
                )
                d.polygon(
                    [(x - 2, top + 2 * th // 3), (x + tw + 2, top + 2 * th // 3),
                     (x + tw // 2, top + th // 4)],
                    fill=col,
                )
        # ground
        d.rectangle([0, horizon, W, H], fill=(5, 14, 12))
        # fireflies, gently bobbing and blinking
        for fx, fy, phase, drift in fireflies:
            if (f + phase) % FRAMES < 9:
                x = (fx + f * (1 if drift > 0.5 else -1)) % W
                y = fy + int(2 * math.sin((f + phase) * 0.6))
                d.point((x, y), fill=(190, 255, 140))
                d.point((x + 1, y), fill=(120, 190, 90))
        frames.append(img)
    save(frames, "forest", duration=130)


# ------------------------------------------------------------------- castle
def castle():
    rng = random.Random(4096)
    horizon = 82
    sky_stars = [(rng.randrange(W), rng.randrange(50)) for _ in range(45)]
    bats = [(rng.randrange(W), rng.randrange(12, 44), rng.randrange(FRAMES)) for _ in range(4)]

    def draw_castle(d, img):
        stone = (24, 18, 40)
        roof = (60, 24, 70)
        # main keep
        d.rectangle([70, 40, 122, horizon], fill=stone)
        d.polygon([(66, 40), (126, 40), (96, 22)], fill=roof)
        # towers
        for tx in (52, 130):
            d.rectangle([tx, 52, tx + 14, horizon], fill=stone)
            d.polygon([(tx - 2, 52), (tx + 16, 52), (tx + 7, 34)], fill=roof)
        # battlements
        for bx in range(70, 118, 8):
            d.rectangle([bx, 36, bx + 4, 42], fill=stone)
        # gate
        d.rectangle([90, 66, 102, horizon], fill=(8, 6, 16))
        d.arc([88, 58, 104, 74], 180, 360, fill=(8, 6, 16))
        # windows (torch-lit)
        for wx, wy in [(80, 50), (108, 50), (94, 44), (57, 60), (135, 60)]:
            d.rectangle([wx, wy, wx + 3, wy + 5], fill=(255, 170, 60))
        # flag
        d.line([96, 22, 96, 12], fill=(140, 130, 160))

    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (8, 6, 22))
        d = ImageDraw.Draw(img)
        for i, col in enumerate([(14, 10, 36), (20, 14, 48), (28, 18, 60)]):
            d.rectangle([0, i * 22, W, (i + 1) * 22], fill=col)
        # big moon
        d.ellipse([140, 10, 168, 38], fill=(220, 215, 235))
        d.ellipse([148, 16, 156, 24], fill=(190, 185, 210))
        d.ellipse([158, 26, 164, 32], fill=(190, 185, 210))
        for sx, sy in sky_stars:
            if (sx * sy + f) % 6 < 4:
                d.point((sx, sy), fill=(180, 180, 215))
        draw_castle(d, img)
        # waving flag (2 frames)
        if f % 4 < 2:
            d.polygon([(96, 12), (106, 14), (96, 17)], fill=(200, 50, 60))
        else:
            d.polygon([(96, 12), (104, 15), (96, 17)], fill=(200, 50, 60))
        # ground + mist band
        d.rectangle([0, horizon, W, H], fill=(6, 4, 14))
        mist_y = horizon + 6 + (f % 8 < 4)
        for mx in range(0, W, 14):
            d.line([mx + (f % 14), mist_y, mx + 8 + (f % 14), mist_y], fill=(40, 34, 66))
        # bats flapping across the sky
        for bx, by, phase in bats:
            x = (bx + f * 3 + phase * 20) % (W + 20) - 10
            y = by + int(2 * math.sin((f + phase) * 0.8))
            if (f + phase) % 4 < 2:
                d.line([x - 3, y - 2, x, y], fill=(10, 8, 18))
                d.line([x, y, x + 3, y - 2], fill=(10, 8, 18))
            else:
                d.line([x - 3, y + 1, x, y], fill=(10, 8, 18))
                d.line([x, y, x + 3, y + 1], fill=(10, 8, 18))
        frames.append(img)
    save(frames, "castle", duration=130)


# ------------------------------------------------------------------ gameboy
def gameboy():
    """DMG Game Boy palette side-scroller."""
    darkest = (15, 56, 15)
    dark = (48, 98, 48)
    light = (139, 172, 15)
    lightest = (155, 188, 15)
    rng = random.Random(11)
    horizon = 84
    clouds = [(rng.randrange(W * 2), rng.randrange(8, 40)) for _ in range(6)]
    hills = [(rng.randrange(W * 2), rng.randrange(10, 30)) for _ in range(8)]
    blocks = [(40, 46), (120, 40), (160, 52)]

    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), lightest)
        d = ImageDraw.Draw(img)
        # clouds, slow
        for cx, cy in clouds:
            x = (cx - f) % (W * 2) - W // 2
            d.rectangle([x, cy, x + 16, cy + 5], fill=light)
            d.rectangle([x + 4, cy - 3, x + 12, cy], fill=light)
        # hills, medium
        for hx, hh in hills:
            x = (hx - f * 2) % (W * 2) - W // 2
            d.polygon([(x, horizon), (x + hh, horizon - hh), (x + 2 * hh, horizon)],
                      fill=light)
            d.polygon([(x + hh - 3, horizon - hh + 4), (x + hh, horizon - hh),
                       (x + hh + 3, horizon - hh + 4)], fill=dark)
        # floating blocks, gentle bob
        for bx, by in blocks:
            y = by + (1 if (f + bx) % 8 < 4 else 0)
            d.rectangle([bx, y, bx + 8, y + 8], fill=dark)
            d.rectangle([bx + 1, y + 1, bx + 7, y + 7], fill=light)
            d.point((bx + 2, y + 2), fill=darkest)
            d.point((bx + 6, y + 2), fill=darkest)
            d.point((bx + 2, y + 6), fill=darkest)
            d.point((bx + 6, y + 6), fill=darkest)
        # ground
        d.rectangle([0, horizon, W, H], fill=dark)
        d.rectangle([0, horizon, W, horizon + 2], fill=darkest)
        for gx in range(0, W, 8):
            off = (f * 3) % 8
            x = (gx - off) % W
            d.rectangle([x, horizon + 4, x + 3, horizon + 5], fill=darkest)
        frames.append(img)
    save(frames, "gameboy", duration=120)


# ---------------------------------------------------------------- ocean sunset
def ocean():
    horizon = 58
    sky_bands = [
        (26, 10, 48), (48, 14, 66), (78, 20, 78), (116, 30, 82),
        (158, 48, 78), (198, 78, 66), (228, 116, 56), (244, 158, 66),
    ]
    water_bands = [
        (244, 158, 66), (198, 96, 58), (158, 62, 62), (116, 40, 68),
        (78, 26, 66), (48, 16, 54), (30, 10, 42),
    ]
    sx, sy, sr = 96, horizon - 6, 20

    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (0, 0, 0))
        d = ImageDraw.Draw(img)
        bh = horizon // len(sky_bands)
        for i, col in enumerate(sky_bands):
            d.rectangle([0, i * bh, W, (i + 1) * bh + 1], fill=col)
        # sun with retro slits
        for y in range(sy - sr, sy + sr):
            dy = y - sy
            half = int(math.sqrt(max(0, sr * sr - dy * dy)))
            # horizontal slits grow toward the bottom of the sun
            if dy > 0 and (dy // 3 + f // 8) % 2 == 0 and dy > sr // 3:
                continue
            shade = min(255, 244 - abs(dy) * 2)
            d.line([sx - half, y, sx + half, y], fill=(255, shade, 80))
        wbh = (H - horizon) // len(water_bands)
        for i, col in enumerate(water_bands):
            d.rectangle([0, horizon + i * wbh, W, horizon + (i + 1) * wbh + 1], fill=col)
        # sun reflection column wobbling
        for y in range(horizon, H, 2):
            wobble = int(3 * math.sin((y + f * 2) * 0.35))
            spread = 4 + (y - horizon) // 3
            d.line([sx - spread + wobble, y, sx + spread + wobble, y],
                   fill=(255, 190, 90))
        # scattered wave sparkles drifting
        rng = random.Random(99)
        for _ in range(60):
            wx = rng.randrange(W)
            wy = horizon + rng.randrange(H - horizon)
            if (wx + f * (1 + wy % 3)) % 7 < 2:
                x = (wx + f * 2) % W
                d.point((x, wy), fill=(255, 220, 150))
        frames.append(img)
    save(frames, "ocean")


if __name__ == "__main__":
    import os
    os.makedirs(OUT, exist_ok=True)
    starfield()
    city()
    ocean()
    forest()
    castle()
    gameboy()
