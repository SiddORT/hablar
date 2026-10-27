"""Derive transparent brand assets from the original white-matted JPEG.

Requires ImageMagick; uses only Python's standard library. White-matte
unpremultiplication keeps antialiased edges from carrying a white halo.
"""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "artifacts/hablar-coming-soon/public"
SOURCE = PUBLIC / "brand/hablar-logo-reference.jpeg"
WIDTH, HEIGHT = 960, 1280


def main():
    rgb = subprocess.check_output(["magick", str(SOURCE), "-depth", "8", "rgb:-"])
    assert len(rgb) == WIDTH * HEIGHT * 3, "Unexpected source image dimensions"
    rgba = bytearray()
    for offset in range(0, len(rgb), 3):
        pixel = rgb[offset:offset + 3]
        alpha = 255 - min(pixel)
        # Discard near-white JPEG noise, not the artwork's colored edges.
        if alpha < 12:
            rgba.extend((0, 0, 0, 0))
        else:
            rgba.extend(round((channel - (255 - alpha)) * 255 / alpha) for channel in pixel)
            rgba.append(alpha)

    footer = PUBLIC / "brand/hablar-logo-transparent.png"
    subprocess.run(
        ["magick", "-size", f"{WIDTH}x{HEIGHT}", "-depth", "8", "rgba:-", str(footer)],
        input=rgba, check=True,
    )
    # Only the smiling H symbol: exclude the wordmark and tagline.
    subprocess.run(
        ["magick", str(footer), "-crop", "770x600+110+140", "+repage",
         "-resize", "248x248", "-gravity", "center", "-background", "none",
         "-extent", "256x256", str(PUBLIC / "favicon.png")],
        check=True,
    )


if __name__ == "__main__":
    main()
