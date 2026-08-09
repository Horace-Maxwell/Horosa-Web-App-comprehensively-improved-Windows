#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""[E11] 生成矢量 PDF 用的中文 **Bold** 子集字体 public/fonts/HorosaCJK-Bold-subset.ttf。

为什么要它:aiExportPdfVector 只内嵌了一份 Regular,粗体段一直靠 Tr2(FillAndOutline)描边
合成 —— 小字号下糊笔画、观感与真 Bold 差距明显。本脚本产出与 Regular **同源同覆盖** 的 Bold。

铁律(与 Regular 完全一致,踩过的坑不再踩):
  ① 必须 TrueType(glyf)。CFF/OTF 经 pdf-lib 内嵌产出的字体文件结构非法 → macOS Preview /
     poppler 拒渲 → 整份中文乱码。故 Noto 的 CFF 轮廓要做 cubic→quadratic 转换。
  ② 运行时必须 subset:false 整嵌(@pdf-lib/fontkit 的 subset 会静默丢字形)。所以子集化
     只在**本脚本**做,运行时不再二次 subset。
  ③ 码位集合必须与 Regular **完全相同**:不同则粗体段会出现 .notdef 空白方块。
     脚本末尾硬校验,不等就直接失败,绝不产出半成品。

用法:
    python3 scripts/build_cjk_bold_subset.py [--src <NotoSansCJKsc-Bold.otf>]
不给 --src 时从 Noto 官方仓库下载(OFL-1.1,允许再分发与嵌入;见 THIRD_PARTY_NOTICES.md)。
"""

import argparse
import os
import sys
import urllib.request

from fontTools.ttLib import TTFont, newTable
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

HERE = os.path.dirname(os.path.abspath(__file__))
UI_ROOT = os.path.dirname(HERE)
REGULAR = os.path.join(UI_ROOT, "public", "fonts", "HorosaCJK-subset.ttf")
OUT = os.path.join(UI_ROOT, "public", "fonts", "HorosaCJK-Bold-subset.ttf")
SRC_URL = ("https://raw.githubusercontent.com/notofonts/noto-cjk/main/"
           "Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf")

MAX_ERR = 1.0          # cu2qu 允许误差(units per em 的绝对值);1.0/1000em 肉眼不可辨


def regular_codepoints():
    f = TTFont(REGULAR, lazy=True)
    cps = set(f.getBestCmap().keys())
    f.close()
    return cps


def glyphs_to_quadratic(glyph_set, max_err):
    quad = {}
    for name in glyph_set.keys():
        pen = TTGlyphPen(glyph_set)
        glyph_set[name].draw(Cu2QuPen(pen, max_err, reverse_direction=True))
        quad[name] = pen.glyph()
    return quad


def otf_to_ttf(font, max_err=MAX_ERR):
    """CFF(cubic) → glyf(quadratic)。标准转换流程,逐表重建 glyf/loca/maxp/post。"""
    if "glyf" in font:
        return font                       # 源已是 TrueType,无需转换
    assert "CFF " in font, "源字体既非 glyf 也非 CFF,无法处理"
    glyph_order = font.getGlyphOrder()

    font["loca"] = newTable("loca")
    font["glyf"] = glyf = newTable("glyf")
    glyf.glyphOrder = glyph_order
    glyf.glyphs = glyphs_to_quadratic(font.getGlyphSet(), max_err)
    del font["CFF "]
    glyf.compile(font)

    # hmtx 的 lsb 要按新轮廓的实际包围盒重算,否则字距会整体偏移
    hmtx = font["hmtx"]
    for name in glyph_order:
        g = glyf[name]
        adv = hmtx[name][0]
        hmtx[name] = (adv, g.xMin if hasattr(g, "xMin") else 0)

    font["maxp"] = maxp = newTable("maxp")
    maxp.tableVersion = 0x00010000
    maxp.maxZones = 1
    maxp.maxTwilightPoints = 0
    maxp.maxStorage = 0
    maxp.maxFunctionDefs = 0
    maxp.maxInstructionDefs = 0
    maxp.maxStackElements = 0
    maxp.maxSizeOfInstructions = 0
    maxp.maxComponentElements = max(
        (len(getattr(g, "components", [])) for g in glyf.glyphs.values()), default=0)
    maxp.compile(font)

    post = font["post"]
    post.formatType = 2.0
    post.extraNames = []
    post.mapping = {}
    post.glyphOrder = glyph_order
    try:
        post.compile(font)
    except Exception:
        post.formatType = 3.0             # 名称表压不下就退 3.0(丢字形名,PDF 不依赖)

    font.sfntVersion = "\000\001\000\000"
    return font


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="")
    args = ap.parse_args()

    if not os.path.exists(REGULAR):
        sys.exit("找不到 Regular 子集 %s —— 码位表以它为准,不能缺" % REGULAR)
    want = regular_codepoints()
    print("Regular 码位数 = %d" % len(want))

    src = args.src
    if not src:
        src = os.path.join(os.path.dirname(OUT), "_NotoSansCJKsc-Bold.src.otf")
        if not os.path.exists(src):
            print("下载 Bold 源字体 …")
            urllib.request.urlretrieve(SRC_URL, src)
    print("源字体 = %s (%.1f MB)" % (src, os.path.getsize(src) / 1048576.0))

    # ① 子集化:严格按 Regular 的码位集合
    from fontTools import subset
    font = TTFont(src, lazy=False)
    opts = subset.Options()
    opts.glyph_names = True
    opts.legacy_kern = False
    opts.layout_features = []             # PDF 不做 OpenType 排版,布局表全丢以缩体积
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables += ["BASE", "JSTF", "DSIG", "EBDT", "EBLC", "GDEF", "GPOS", "GSUB", "vhea", "vmtx", "VORG"]
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(unicodes=want)
    subsetter.subset(font)

    # ② CFF → glyf
    otf_to_ttf(font)

    # ③ 落盘 + 硬校验
    font.save(OUT)
    font.close()

    chk = TTFont(OUT, lazy=True)
    got = set(chk.getBestCmap().keys())
    has_glyf = "glyf" in chk
    has_cff = "CFF " in chk
    upem = chk["head"].unitsPerEm
    chk.close()

    missing = want - got
    extra = got - want
    print("产物 = %s (%.1f MB) glyf=%s CFF=%s upem=%d 码位=%d" % (
        OUT, os.path.getsize(OUT) / 1048576.0, has_glyf, has_cff, upem, len(got)))
    if not has_glyf or has_cff:
        sys.exit("❌ 产物不是纯 TrueType(glyf) —— pdf-lib 内嵌会乱码,拒绝交付")
    if missing:
        sys.exit("❌ 缺 %d 个码位(粗体段会出 .notdef 空白):%s …" % (
            len(missing), "".join(chr(c) for c in sorted(missing)[:20])))
    if extra:
        print("⚠️ 多出 %d 个码位(无害,体积略大)" % len(extra))
    print("✅ 码位与 Regular 完全一致,校验通过")


if __name__ == "__main__":
    main()
