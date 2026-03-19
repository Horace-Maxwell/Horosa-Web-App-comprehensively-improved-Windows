from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
BADGE_PATH = ASSETS / "horosa_setup_badge.png"
ICO_PATH = ASSETS / "horosa_setup.ico"
HEADER_PATH = ASSETS / "installerHeader.bmp"
SIDEBAR_PATH = ASSETS / "installerSidebar.bmp"
UNINSTALL_SIDEBAR_PATH = ASSETS / "uninstallerSidebar.bmp"

ICON_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
SIDEBAR_SIZE = (164, 314)
HEADER_SIZE = (150, 57)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if bold:
        candidates.extend(
            [
                Path(r"C:\Windows\Fonts\msyhbd.ttc"),
                Path(r"C:\Windows\Fonts\msyhbd.ttf"),
                Path(r"C:\Windows\Fonts\seguiemj.ttf"),
                Path(r"C:\Windows\Fonts\arialbd.ttf"),
            ]
        )
    candidates.extend(
        [
            Path(r"C:\Windows\Fonts\msyh.ttc"),
            Path(r"C:\Windows\Fonts\segoeui.ttf"),
            Path(r"C:\Windows\Fonts\arial.ttf"),
        ]
    )
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


def save_icon() -> None:
    base = Image.open(BADGE_PATH).convert("RGBA")
    base.save(ICO_PATH, sizes=[(size, size) for size in ICON_SIZES])


def build_header() -> None:
    width, height = HEADER_SIZE
    img = Image.new("RGB", HEADER_SIZE, "#FFFFFF")
    draw = ImageDraw.Draw(img)
    badge = fit_badge(36)
    img.paste(badge.convert("RGB"), (10, 10))

    title_font = load_font(18, bold=True)
    subtitle_font = load_font(10, bold=False)
    draw.text((56, 9), "星阙", fill="#111111", font=title_font)
    draw.text((56, 31), "Windows 离线安装", fill="#5A6470", font=subtitle_font)
    draw.line((0, height - 1, width, height - 1), fill="#D9E0EA", width=1)
    img.save(HEADER_PATH)


def build_sidebar(title: str, subtitle: str, output: Path) -> None:
    img = Image.new("RGB", SIDEBAR_SIZE, "#F6F8FC")
    draw = ImageDraw.Draw(img)

    for y in range(SIDEBAR_SIZE[1]):
        blend = y / max(SIDEBAR_SIZE[1] - 1, 1)
        color = (
            int(246 + (255 - 246) * blend),
            int(248 + (255 - 248) * blend),
            int(252 + (255 - 252) * blend),
        )
        draw.line((0, y, SIDEBAR_SIZE[0], y), fill=color)

    badge = fit_badge(92)
    img.paste(badge.convert("RGB"), (36, 26))

    title_font = load_font(22, bold=True)
    subtitle_font = load_font(12, bold=False)
    hint_font = load_font(10, bold=False)

    draw.text((24, 138), title, fill="#111111", font=title_font)
    draw.text((24, 170), subtitle, fill="#566070", font=subtitle_font)
    draw.text((24, 234), "完整离线安装", fill="#0F172A", font=hint_font)
    draw.text((24, 252), "内置 Electron / Java / Python", fill="#0F172A", font=hint_font)
    draw.text((24, 270), "安装后可离线运行本地功能", fill="#0F172A", font=hint_font)
    output.parent.mkdir(parents=True, exist_ok=True)
    img.save(output)


def main() -> None:
    save_icon()
    build_header()
    build_sidebar("星阙", "Horosa Setup", SIDEBAR_PATH)
    build_sidebar("星阙", "Horosa Uninstall", UNINSTALL_SIDEBAR_PATH)


if __name__ == "__main__":
    main()
