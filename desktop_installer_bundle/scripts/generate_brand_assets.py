"""Generate the Windows installer brand assets (icon + NSIS header/sidebar
bitmaps) from the single source logo `assets/horosa_setup_badge.png`.

Run after updating the logo:  python scripts/generate_brand_assets.py

All artwork is derived from the one badge so the icon, the installer header and
the welcome/uninstall sidebars always stay in sync with the latest logo.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
BADGE_PATH = ASSETS / "horosa_setup_badge.png"
ICO_PATH = ASSETS / "horosa_setup.ico"
HEADER_PATH = ASSETS / "installerHeader.bmp"
SIDEBAR_PATH = ASSETS / "installerSidebar.bmp"
UNINSTALL_SIDEBAR_PATH = ASSETS / "uninstallerSidebar.bmp"

ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
SIDEBAR_SIZE = (164, 314)   # NSIS MUI welcome/finish bitmap
HEADER_SIZE = (150, 57)     # NSIS MUI inner-page header bitmap

# Brand palette (matches the desktop loading screen for a cohesive identity).
INK = (15, 23, 42)
INK_SOFT = (90, 100, 116)
INK_DIM = (130, 140, 156)
ACCENT = (56, 189, 248)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates += [
            Path(r"C:\Windows\Fonts\msyhbd.ttc"),
            Path(r"C:\Windows\Fonts\msyhbd.ttf"),
            Path(r"C:\Windows\Fonts\seguisb.ttf"),
            Path(r"C:\Windows\Fonts\arialbd.ttf"),
        ]
    candidates += [
        Path(r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
        Path(r"C:\Windows\Fonts\arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            try:
                return ImageFont.truetype(str(candidate), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def fit_badge(size: int) -> Image.Image:
    badge = Image.open(BADGE_PATH).convert("RGBA")
    return badge.resize((size, size), Image.Resampling.LANCZOS)


def paste_logo_with_shadow(canvas: Image.Image, badge: Image.Image, x: int, y: int,
                           blur: int = 9, dy: int = 7, strength: int = 110) -> None:
    """Composite a badge onto an RGBA canvas with a soft drop shadow, preserving
    the badge's rounded-corner transparency (a plain RGB paste would turn the
    transparent corners black)."""
    alpha = badge.split()[3].point(lambda v: int(v * strength / 255))
    shadow_src = Image.new("RGBA", badge.size, (8, 12, 22, 255))
    shadow_src.putalpha(alpha)
    shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_layer.alpha_composite(shadow_src, (x, y + dy))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow_layer)
    canvas.alpha_composite(badge, (x, y))


def draw_centered(draw: ImageDraw.ImageDraw, cx: int, y: int, text: str,
                  font, fill) -> None:
    width = draw.textlength(text, font=font)
    draw.text((cx - width / 2, y), text, font=font, fill=fill)


def vertical_gradient(size, top, bottom) -> Image.Image:
    width, height = size
    base = Image.new("RGBA", size, (*top, 255))
    draw = ImageDraw.Draw(base)
    for y in range(height):
        blend = y / max(height - 1, 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * blend) for i in range(3))
        draw.line((0, y, width, y), fill=(*color, 255))
    return base


def save_icon() -> None:
    base = fit_badge(256)
    base.save(ICO_PATH, sizes=[(s, s) for s in ICON_SIZES])


def build_header() -> None:
    width, height = HEADER_SIZE
    canvas = Image.new("RGBA", HEADER_SIZE, (255, 255, 255, 255))
    badge_size = 40
    paste_logo_with_shadow(canvas, fit_badge(badge_size), 10, (height - badge_size) // 2,
                           blur=5, dy=3, strength=90)

    draw = ImageDraw.Draw(canvas)
    title_font = load_font(19, bold=True)
    sub_font = load_font(10, bold=False)
    draw.text((60, 11), "星阙", fill=INK, font=title_font)
    draw.text((61, 35), "Horosa 安装程序", fill=INK_SOFT, font=sub_font)
    draw.line((0, height - 1, width, height - 1), fill=(217, 224, 234, 255), width=1)
    canvas.convert("RGB").save(HEADER_PATH)


def build_sidebar(subtitle: str, output: Path) -> None:
    width, height = SIDEBAR_SIZE
    canvas = vertical_gradient(SIDEBAR_SIZE, (244, 247, 252), (255, 255, 255))

    # Soft brand glow behind the logo.
    glow = Image.new("RGBA", SIDEBAR_SIZE, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((22, 26, 142, 146), fill=(*ACCENT, 60))
    glow = glow.filter(ImageFilter.GaussianBlur(22))
    canvas.alpha_composite(glow)

    badge_size = 96
    paste_logo_with_shadow(canvas, fit_badge(badge_size), (width - badge_size) // 2, 30,
                           blur=11, dy=8, strength=120)

    draw = ImageDraw.Draw(canvas)
    cx = width // 2
    draw_centered(draw, cx, 150, "星阙", load_font(26, bold=True), INK)
    draw_centered(draw, cx, 184, subtitle, load_font(12, bold=False), INK_SOFT)

    # Accent divider.
    draw.line((cx - 24, 212, cx + 24, 212), fill=(*ACCENT, 255), width=2)

    hints = [
        "完整离线安装包",
        "内置 Electron · Java · Python",
        "安装后即可离线使用",
    ]
    hint_font = load_font(10, bold=False)
    y = 236
    for line in hints:
        draw_centered(draw, cx, y, line, hint_font, INK_DIM)
        y += 20

    canvas.convert("RGB").save(output)


def main() -> None:
    if not BADGE_PATH.exists():
        raise SystemExit(f"Source logo not found: {BADGE_PATH}")
    save_icon()
    build_header()
    build_sidebar("Horosa Setup", SIDEBAR_PATH)
    build_sidebar("Horosa Uninstall", UNINSTALL_SIDEBAR_PATH)
    print("Generated:", ICO_PATH.name, HEADER_PATH.name, SIDEBAR_PATH.name, UNINSTALL_SIDEBAR_PATH.name)


if __name__ == "__main__":
    main()
