#!/usr/bin/env python3
"""Create looping GIFs for the generated station backgrounds.

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


def radiosega_circuit() -> None:
    base = Image.open(SOURCE / "radiosega-circuit.png").convert("RGB")
    frames = []

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # Light trails race along the circuit while the gateway pulses.
        offset = frame * 11
        for index in range(5):
            x = (offset + index * 93) % 470 - 12
            y = 194 - x // 12
            if 0 <= y < 245:
                draw.line(
                    (x, y, x + 15, y - 2),
                    fill=(40, 231, 255, 190),
                    width=2,
                )

        pulse = int(55 + 50 * (1 + math.sin(frame * math.tau / FRAMES)) / 2)
        draw.ellipse((302, 17, 341, 62), outline=(255, 194, 45, pulse), width=2)
        draw.ellipse((306, 21, 337, 58), outline=(255, 93, 35, pulse), width=1)

        # The distant skyline and pit-lane cabinets blink independently.
        for index, (x, y) in enumerate(((76, 80), (91, 75), (102, 79), (118, 72))):
            if (frame + index * 3) % 9 < 3:
                draw.point((x, y), fill=(255, 215, 83, 230))
        for index, x in enumerate((391, 402, 413, 424, 435)):
            if (frame + index * 2) % 8 < 3:
                draw.rectangle((x, 152, x + 2, 153), fill=(48, 230, 255, 220))

        frames.append(composite(base, layer))

    save(frames, "radiosega-circuit")


def gtt_arena() -> None:
    base = Image.open(SOURCE / "gtt-arena.png").convert("RGB")
    frames = []

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # The monitor wall and stage equalizer react in alternating colors.
        colors = (
            (53, 232, 255, 205),
            (255, 60, 204, 205),
            (255, 171, 52, 205),
            (119, 255, 112, 205),
        )
        for index in range(13):
            x = 159 + index * 10
            height = 2 + int(
                7
                * (
                    1
                    + math.sin(frame * 0.9 + index * 1.4)
                    + 0.25 * math.sin(frame * 1.7 - index)
                )
                / 2.25
            )
            height = max(2, min(10, height))
            draw.rectangle(
                (x, 181 - height, x + 3, 181),
                fill=colors[index % len(colors)],
            )

        for index, (x, y) in enumerate(((172, 67), (198, 67), (224, 67), (250, 67), (276, 67))):
            glow = 70 if (frame + index * 3) % 10 < 5 else 20
            draw.rectangle((x, y, x + 14, y + 6), fill=(50, 230, 255, glow))

        # Spotlights sweep softly without obscuring the room artwork.
        sweep_x = 122 + (frame * 13) % 210
        draw.polygon(
            ((sweep_x, 13), (sweep_x + 8, 13), (sweep_x + 33, 147), (sweep_x - 12, 147)),
            fill=(255, 65, 218, 18),
        )

        frames.append(composite(base, layer))

    save(frames, "gtt-arena")


def ericade_demoparty() -> None:
    base = Image.open(SOURCE / "ericade-demoparty.png").convert("RGB")
    frames = []

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # Copper bars and plasma waves roll across the big projection screen.
        for index in range(4):
            y = 43 + index * 8 + int(3 * math.sin(frame * 0.7 + index))
            color = (50, 235, 255, 100) if index % 2 else (247, 87, 255, 100)
            points = []
            for x in range(157, 291, 5):
                wave_y = y + int(3 * math.sin(x * 0.11 + frame * 0.6))
                points.append((x, wave_y))
            draw.line(points, fill=color, width=1)

        bar_y = 24 + (frame * 4) % 52
        draw.rectangle((156, bar_y, 292, bar_y + 1), fill=(255, 155, 45, 80))

        # CRTs and modem LEDs flicker asynchronously around the hall.
        screens = ((46, 111), (93, 103), (130, 112), (311, 109), (356, 103), (400, 112))
        for index, (x, y) in enumerate(screens):
            if (frame + index * 3) % 11 < 5:
                draw.rectangle((x, y, x + 5, y + 3), fill=(57, 255, 190, 90))
        for index, (x, y) in enumerate(((69, 141), (117, 130), (328, 135), (384, 132))):
            if (frame + index * 2) % 7 < 2:
                draw.point((x, y), fill=(255, 189, 53, 240))

        frames.append(composite(base, layer))

    save(frames, "ericade-demoparty")


if __name__ == "__main__":
    OUTPUT.mkdir(exist_ok=True)
    keygen_vault()
    sid_studio()
    rpg_overworld()
    radiosega_circuit()
    gtt_arena()
    ericade_demoparty()
