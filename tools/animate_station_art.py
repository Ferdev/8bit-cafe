#!/usr/bin/env python3
"""Create looping GIFs for the three generated station backgrounds.

The original generated PNGs live in ``tools/art_sources``.  Animation is
drawn in small, scene-specific regions so the artwork stays crisp and the GIF
compressor can encode most frames as compact deltas.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "tools" / "art_sources"
OUTPUT = ROOT / "assets"
FRAMES = 16
DURATION = 120


def overlay(base: Image.Image) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    return layer, ImageDraw.Draw(layer)


def composite(base: Image.Image, layer: Image.Image) -> Image.Image:
    return Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")


def save(frames: list[Image.Image], name: str) -> None:
    # One shared palette prevents color-table churn between frames and keeps
    # the mostly-static animations small.
    palette = frames[0].quantize(
        colors=256,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.NONE,
    )
    paletted = [
        frame.quantize(palette=palette, dither=Image.Dither.NONE)
        for frame in frames
    ]
    destination = OUTPUT / f"{name}.gif"
    paletted[0].save(
        destination,
        save_all=True,
        append_images=paletted[1:],
        duration=DURATION,
        loop=0,
        disposal=1,
        optimize=True,
    )
    print(f"wrote {destination.relative_to(ROOT)} ({len(frames)} frames)")


def keygen_vault() -> None:
    base = Image.open(SOURCE / "keygen-vault.png").convert("RGB")
    frames = []
    led_points = [(65, 63), (80, 67), (97, 59), (118, 76), (137, 63)]

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # A cyan scan line rolls down the terminal without moving the scene.
        scan_y = 48 + (frame * 5) % 66
        draw.line((39, scan_y, 145, scan_y), fill=(0, 255, 245, 150), width=1)
        draw.line((39, scan_y + 1, 145, scan_y + 1), fill=(0, 110, 255, 60), width=1)

        # The vault mechanism and ceiling strip breathe in alternating colors.
        pulse = int(45 + 35 * (1 + math.sin(frame * math.tau / FRAMES)) / 2)
        draw.ellipse((187, 40, 262, 116), outline=(36, 92, 255, pulse), width=2)
        draw.line((218, 13, 265, 13), fill=(238, 38, 255, pulse + 50), width=2)

        for index, (x, y) in enumerate(led_points):
            if (frame + index * 3) % 8 < 3:
                draw.rectangle((x, y, x + 2, y + 1), fill=(52, 255, 207, 220))

        frames.append(composite(base, layer))

    save(frames, "keygen-vault")


def sid_studio() -> None:
    base = Image.open(SOURCE / "sid-studio.png").convert("RGB")
    frames = []

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # Animate the CRT spectrum with deterministic tracker-style bars.
        for index in range(18):
            x = 187 + index * 4
            height = 3 + int(
                9
                * (
                    1
                    + math.sin(frame * 0.8 + index * 1.7)
                    + 0.35 * math.sin(frame * 1.4 - index)
                )
                / 2.35
            )
            height = max(2, min(13, height))
            color = (36, 255, 235, 210) if index % 3 else (185, 80, 255, 210)
            draw.rectangle((x, 124 - height, x + 1, 124), fill=color)

        # Console LEDs chase slowly while the skyline twinkles outside.
        for index in range(9):
            if (frame + index * 2) % 10 < 4:
                x = 82 + index * 8
                draw.rectangle((x, 66, x + 2, 67), fill=(255, 143, 41, 210))
        for index, (x, y) in enumerate(((364, 45), (388, 58), (412, 39), (430, 66))):
            if (frame + index * 4) % 16 < 5:
                draw.point((x, y), fill=(251, 111, 218, 240))

        # A soft pulse makes the lava lamp feel alive.
        lamp_alpha = int(30 + 30 * (1 + math.sin(frame * math.tau / FRAMES)) / 2)
        draw.ellipse((35, 17, 52, 53), fill=(255, 72, 207, lamp_alpha))

        frames.append(composite(base, layer))

    save(frames, "sid-studio")


def rpg_overworld() -> None:
    base = Image.open(SOURCE / "rpg-overworld.png").convert("RGB")
    frames = []
    stars = [(76, 31), (106, 18), (134, 27), (240, 19), (284, 30)]

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # Shift narrow highlights down both waterfalls.
        for y in range(126 + frame % 4, 181, 6):
            draw.line((18, y, 27, y + 3), fill=(98, 218, 255, 105), width=1)
        for y in range(69 + frame % 4, 119, 6):
            draw.line((333, y, 337, y + 3), fill=(80, 199, 255, 115), width=1)

        pulse = int(35 + 40 * (1 + math.sin(frame * math.tau / FRAMES)) / 2)
        draw.ellipse((331, 156, 386, 211), fill=(54, 106, 255, pulse))
        draw.ellipse((422, 181, 443, 224), fill=(255, 101, 211, pulse // 2))

        # Stars and path magic sparkle on alternating phases.
        for index, (x, y) in enumerate(stars):
            if (frame + index * 3) % 8 < 3:
                draw.line((x - 2, y, x + 2, y), fill=(220, 232, 255, 190))
                draw.line((x, y - 2, x, y + 2), fill=(220, 232, 255, 190))
        for index, (x, y) in enumerate(((205, 111), (231, 132), (256, 157), (292, 179))):
            if (frame + index * 4) % 12 < 5:
                draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(255, 226, 94, 150))

        frames.append(composite(base, layer))

    save(frames, "rpg-overworld")


if __name__ == "__main__":
    OUTPUT.mkdir(exist_ok=True)
    keygen_vault()
    sid_studio()
    rpg_overworld()
