# -*- coding: utf-8 -*-
"""繁→简显示出口的两个保留字:卦名 / 宫位 / 方位的「乾」与五音的「徵」。

转换库按「乾燥」读法把词表外的「乾」写成「干」、把「徵」一律写成「征」,落到盘面就是
「干宫」「戌干亥」「宫商角征羽」这类错字。这里钉死:术数义照旧写「乾」「徵」,干燥 / 天干 / 征兆义照转,
并且两处显示出口(通用适配层与 kentang 适配层)同源同结果。
"""
import ast
import os

import pytest

from websrv import horosa_engine_common as H
from websrv.kentang import kinastro_common as K

pytestmark = pytest.mark.skipif(not H.zh_convert, reason="转换库未装,显示出口原样返回")

KEEP = [
    ("乾", "乾"),
    ("乾宮", "乾宫"),
    ("乾宫", "乾宫"),
    ("乾六", "乾六"),
    ("戌乾亥", "戌乾亥"),
    ("先天乾", "先天乾"),
    ("乾三連", "乾三连"),
    ("乾山巽向", "乾山巽向"),
    ("落乾宮", "落乾宫"),
    ("乾金", "乾金"),
    ("天乾地坤", "天乾地坤"),
    ("乾坎艮震巽離坤兌", "乾坎艮震巽离坤兑"),
    ("符口乾坎艮", "符口乾坎艮"),
    ("乾為天", "乾为天"),
    ("宮商角徵羽", "宫商角徵羽"),
    ("角、徵、羽", "角、徵、羽"),
    ("徵", "徵"),
    ("徵音", "徵音"),
    ("少徵", "少徵"),
    ("太徵", "太徵"),
    ("風從徵來", "风从徵来"),
    ("時加徵為重徵", "时加徵为重徵"),
    ("因徵姓人", "因徵姓人"),
]

CONVERT = [
    ("乾燥", "干燥"),
    ("皮膚乾燥", "皮肤干燥"),
    ("餅乾", "饼干"),
    ("口乾舌燥", "口干舌燥"),
    ("尚未乾", "尚未干"),
    ("天乾地支", "天干地支"),
    ("天乾甲", "天干甲"),
    ("天乾物燥", "天干物燥"),
    ("乾支", "干支"),
    ("象徵", "象征"),
    ("特徵", "特征"),
    ("徵兆", "征兆"),
    ("徵象星", "征象星"),
    ("可變徵象星", "可变征象星"),
    ("宮徵兆星", "宫征兆星"),
    ("加徵賦稅", "加征赋税"),
    ("協商徵求", "协商征求"),
    ("徵調苛暴", "征调苛暴"),
    ("帝欲徵日本", "帝欲征日本"),
]

MIXED = [
    ("落乾宮，天乾甲木，主乾燥", "落乾宫，天干甲木，主干燥"),
    ("乾宮見徵音，象徵文書", "乾宫见徵音，象征文书"),
]


@pytest.mark.parametrize("src,want", KEEP + CONVERT + MIXED)
def test_simplify_text_keeps_gua_and_tone(src, want):
    assert H.simplify_text(src) == want


@pytest.mark.parametrize("src,want", KEEP + CONVERT + MIXED)
def test_both_display_exits_agree(src, want):
    assert H.display_text(src) == want
    assert K.display_text(src) == want


def test_placeholders_never_leak():
    for src, _ in KEEP + CONVERT + MIXED:
        out = H.simplify_text(src)
        assert H._KEEP_QIAN not in out and H._KEEP_ZHI not in out


def test_text_without_either_char_goes_straight_through():
    for src in ("紫微天機太陽武曲", "甲子乙丑丙寅", "穀雨 鬼谷子 皇后 咸池", "abc 123"):
        assert H.simplify_text(src) == H.zh_convert(src, "zh-cn")


def test_none_still_shown_as_wu():
    assert H.display_text(None) in ("", "无")
    assert H.display_text("None") == "无"
    assert K.display_text("None") == "无"


def test_no_direct_simplify_call_outside_single_exit():
    """繁→简的显示出口只许走 simplify_text:别处再直接调转换库的 zh-cn / zh-hans,保留字就又漏了。

    例外只有检索词的写法补全(多一个写法只多一路匹配,不进显示)。
    """
    allowed = {
        ("horosa_engine_common.py", "simplify_text"),
        ("textquery.py", "_converters"),
    }
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    offenders = []
    for base in ("websrv", "astrostudy"):
        for dirpath, _dirs, files in os.walk(os.path.join(root, base)):
            for name in files:
                if not name.endswith(".py"):
                    continue
                path = os.path.join(dirpath, name)
                with open(path, encoding="utf-8") as fh:
                    tree = ast.parse(fh.read(), filename=path)
                for node in ast.walk(tree):
                    if not isinstance(node, ast.FunctionDef):
                        continue
                    for call in ast.walk(node):
                        if not isinstance(call, ast.Call) or len(call.args) < 2:
                            continue
                        target = call.args[1]
                        if isinstance(target, ast.Constant) and str(target.value).lower() in ("zh-cn", "zh-hans", "zh-sg", "zh-my"):
                            if (name, node.name) not in allowed:
                                offenders.append("%s:%s:%s" % (os.path.relpath(path, root), node.name, call.lineno))
    assert offenders == []
