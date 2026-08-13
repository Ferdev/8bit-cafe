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

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # The terminal raster scans down the actual CRT display.
        scan_y = 34 + frame % 22
        draw.line((68, scan_y, 107, scan_y), fill=(32, 194, 214, 160))

        # Tracker rows advance inside the screen instead of over the room.
        for row in range(6):
            y = 35 + ((row * 4 - frame) % 21)
            width = 5 + ((row * 7 + frame // 4) % 16)
            draw.line((72, y, 72 + width, y), fill=(61, 121, 190, 185))

        # The disk drive activity LED blinks only while rows advance.
        if frame % 6 < 2:
            draw.point((166, 68), fill=(242, 61, 183, 230))

        frames.append(composite(base, layer))

    save(frames, "keygen-vault")


def sid_studio() -> None:
    base = Image.open(SOURCE / "sid-studio.png").convert("RGB")
    frames = []
    stars = ((121, 14), (132, 19), (149, 13), (158, 27))

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # A short SID waveform travels across the computer's CRT.
        points = []
        for x in range(76, 108):
            y = 54 + int(3 * math.sin((x + frame * 2) * 0.55))
            points.append((x, y))
        draw.line(points, fill=(112, 158, 77, 210))

        # A synth status lamp and the stars change slowly and independently.
        if frame % 8 < 3:
            draw.point((126, 69), fill=(244, 171, 69, 230))
        for index, (x, y) in enumerate(stars):
            if (frame + index * 3) % 12 < 3:
                draw.point((x, y), fill=(238, 223, 188, 220))

        frames.append(composite(base, layer))

    save(frames, "sid-studio")


def rpg_overworld() -> None:
    base = Image.open(SOURCE / "rpg-overworld.png").convert("RGB")
    frames = []
    stars = ((31, 12), (63, 15), (91, 9), (119, 17), (151, 12))
    castle_windows = ((128, 50), (132, 49), (137, 50))

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # Narrow moonlit ripples drift along the river.
        for index, y in enumerate((66, 69, 72, 75)):
            x = 45 + ((frame * 3 + index * 19) % 66)
            draw.line((x, y, min(114, x + 5 + index), y), fill=(82, 91, 170, 155))

        # Stars twinkle and castle windows flicker like the original castle room.
        for index, (x, y) in enumerate(stars):
            if (frame + index * 3) % 10 < 3:
                draw.point((x, y), fill=(204, 201, 226, 210))
        for index, (x, y) in enumerate(castle_windows):
            if (frame // 4 + index) % 4 != 0:
                draw.point((x, y), fill=(246, 178, 57, 220))

        frames.append(composite(base, layer))

    save(frames, "rpg-overworld")


def radiosega_circuit() -> None:
    base = Image.open(SOURCE / "radiosega-circuit.png").convert("RGB")
    frames = []
    windows = ((57, 53), (62, 51), (67, 55), (73, 52), (78, 54))

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # Moonlight breaks naturally across the water in short moving ripples.
        for index, y in enumerate(range(52, 64, 3)):
            shift = int(2 * math.sin(frame * 0.55 + index))
            half_width = 2 + index
            draw.line(
                (21 - half_width + shift, y, 21 + half_width + shift, y),
                fill=(232, 216, 151, 170),
            )

        # A tiny pair of headlights follows the road toward the foreground.
        progress = frame / (FRAMES - 1)
        car_x = int(169 - 94 * progress)
        car_y = int(58 + 39 * progress)
        separation = 1 + int(progress * 3)
        draw.point((car_x - separation, car_y), fill=(255, 204, 84, 230))
        draw.point((car_x + separation, car_y), fill=(255, 204, 84, 230))

        # Only a few distant windows flicker, as in the original city room.
        for index, (x, y) in enumerate(windows):
            if (frame // 4 + index) % 5 == 0:
                draw.point((x, y), fill=(255, 196, 70, 220))

        frames.append(composite(base, layer))

    save(frames, "radiosega-circuit")


def gtt_arena() -> None:
    base = Image.open(SOURCE / "gtt-arena.png").convert("RGB")
    frames = []
    cabinet_screens = (
        (8, 43, 20, 52),
        (25, 43, 37, 52),
        (43, 43, 55, 52),
        (138, 43, 150, 52),
        (155, 43, 167, 52),
        (172, 43, 184, 52),
    )
    board_x = (69, 80, 91, 102, 113)
    board_y = (29, 39, 49, 59)

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # The quiz board advances one highlighted answer every four frames.
        selection = frame // 4
        column = (selection * 2 + 1) % len(board_x)
        row = selection % len(board_y)
        x = board_x[column]
        y = board_y[row]
        draw.rectangle((x, y, x + 9, y + 8), outline=(242, 236, 202, 235))

        # Cabinet attract modes scan down their own screens at different phases.
        colors = ((63, 218, 255, 190), (255, 68, 186, 190), (255, 176, 57, 190))
        for index, (left, top, right, bottom) in enumerate(cabinet_screens):
            scan_y = top + (frame + index * 3) % (bottom - top)
            draw.line((left, scan_y, right, scan_y), fill=colors[index % 3])

        frames.append(composite(base, layer))

    save(frames, "gtt-arena")


def ericade_demoparty() -> None:
    base = Image.open(SOURCE / "ericade-demoparty.png").convert("RGB")
    frames = []
    screens = (
        (17, 56, 29, 66),
        (62, 56, 74, 66),
        (107, 56, 119, 66),
        (152, 56, 164, 66),
    )
    drive_leds = ((38, 73), (83, 73), (128, 73), (173, 73))
    stars = ((67, 16), (78, 23), (103, 14), (126, 19))

    for frame in range(FRAMES):
        layer, draw = overlay(base)

        # Tracker rows scroll upward inside each CRT, clipped to the screen.
        for index, (left, top, right, bottom) in enumerate(screens):
            draw.rectangle((left, top, right, bottom), fill=(4, 18, 10, 235))
            offset = (frame + index) % 3
            for row in range(5):
                y = top + 1 + ((row * 3 - offset) % 10)
                width = 5 + ((row * 3 + index * 2) % 7)
                draw.line((left + 1, y, min(right - 1, left + width), y), fill=(76, 181, 52, 230))

        # Disk-drive activity lights blink independently while stars twinkle.
        for index, (x, y) in enumerate(drive_leds):
            if (frame + index * 3) % 9 < 3:
                draw.point((x, y), fill=(132, 225, 75, 230))
        for index, (x, y) in enumerate(stars):
            if (frame + index * 4) % 12 < 3:
                draw.point((x, y), fill=(220, 218, 238, 210))

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
