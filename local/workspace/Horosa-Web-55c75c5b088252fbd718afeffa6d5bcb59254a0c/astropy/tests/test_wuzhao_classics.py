# -*- coding: utf-8 -*-
"""五兆古法层金标测试。

每一断言都锚在敦煌写本 P.2859《五兆要诀略》原文或其今传操作法的具体例证上，
注释里写明所本之条，改动算法而金标不动即为回归。
"""

import os
import random
import re
import sys

import pytest

_HERE = os.path.dirname(os.path.abspath(__file__))
_ASTROPY = os.path.abspath(os.path.join(_HERE, ".."))
if _ASTROPY not in sys.path:
    sys.path.insert(0, _ASTROPY)

from websrv import wuzhao_classics as C  # noqa: E402
from websrv import wuzhao_duanci as D  # noqa: E402
from websrv import wuzhao_leizhan as L  # noqa: E402


# ---------------------------------------------------------------------------
# 一、断辞库完备性
# ---------------------------------------------------------------------------

def test_duanci25_completeness():
    """廿五式：五兆 × 五乡 × 五支 = 125 条，无空文。"""
    total = 0
    for zhao, xiangs in D.DUANCI_25.items():
        assert len(xiangs) == 5, zhao
        for xiang, zhis in xiangs.items():
            assert len(zhis) == 5, (zhao, xiang)
            for zhi, (text, luck) in zhis.items():
                assert text.strip(), (zhao, xiang, zhi)
                assert luck in ("daji", "ji", "xiaoji", "ping", "xiong", "daxiong")
                total += 1
    assert total == 125


def test_duanci_text_self_consistency():
    """转录自洽交叉校验：条文里点名的六亲／兆支须与索引键一致。

    这是「录错一行、机器测不出」的唯一机械防线：断辞是人工转录，若把某条抄错位置，
    条文里的「某是某兆之官鬼」「某兆某支」就会与它所在的格子对不上。
    """
    # 一、「支是兆之X」句式：X 必等于该支相对本兆的六亲
    bad = []
    for zhao, xiangs in D.DUANCI_25.items():
        for xiang, zhis in xiangs.items():
            for zhi, (text, _luck) in zhis.items():
                want = C.liuqin_of(zhao, zhi)
                for m in re.finditer(r"(%s)是(%s)之(兄弟|子孙|妻财|官鬼|父母)" % (zhi, zhao), text):
                    if m.group(3) != want:
                        bad.append((zhao, xiang, zhi, m.group(0), want))
    assert bad == []

    # 二、兆支总断的正文首句须自称「某兆某支」
    for zhao, m in D.DUANCI_ZHAOZHI.items():
        for zhi, (text, _luck) in m.items():
            assert "%s兆%s支" % (zhao, zhi) in text, (zhao, zhi)

    # 三、候四时正文所称之支须与键一致；不一致者必须已登记为存疑
    for (zhao, zhi), text in D.DUANCI_SISHI.items():
        stripped = text.lstrip("[")
        ok = ("%s兆%s支" % (zhao, zhi) in text
              or "得%s支" % zhi in text
              or stripped.startswith("%s支" % zhi))
        assert ok or (zhao, zhi) in D.DUANCI_SISHI_SUSPECT, (zhao, zhi, text[:20])


def test_xiang13_group_matches_wuxing_relation():
    """十三名词的「大类」标注须与其六亲对所隐含的五行关系自洽。"""
    role2elem = {C.liuqin_of("木", e): e for e in C.ELEMS}
    for (xiang_role, zhi_role), (name, group, _luck, _text) in C.XIANG13.items():
        xe, ze = role2elem[xiang_role], role2elem[zhi_role]
        if xe == ze:
            real = "支同乡"
        elif C.SHENG[xe] == ze:
            real = "乡生支"
        elif C.KE[xe] == ze:
            real = "乡克支"
        elif C.KE[ze] == xe:
            real = "支克乡"
        else:
            real = "支生乡"
        assert group.startswith(real), (xiang_role, zhi_role, name, group, real)


def test_shensha_tables_cover_full_domain():
    """三合类神煞须覆盖十二支；逐月表须 1–12 齐全（缺一即某月该煞恒不出）。"""
    all_branches = set("子丑寅卯辰巳午未申酉戌亥")
    for table in (C.XIAO_SHA_BY_SANHE, C.JIE_SHA_BY_SANHE,
                  C.YUE_JIE_SHA_BY_SANHE, C.YI_MA_BY_SANHE):
        covered = set()
        for grp in table:
            covered |= set(grp)
        assert covered == all_branches
    for table in (C.DA_SHA, C.SHA_YIN, C.QIU_MU_MONTHLY):
        assert set(range(1, 13)) <= set(table.keys())


def test_zhaozhi_and_sishi_counts():
    """兆支总断 25 条；候四时准则 24 条（原卷土兆木支未载）。"""
    assert sum(len(v) for v in D.DUANCI_ZHAOZHI.values()) == 25
    assert len(D.DUANCI_SISHI) == 24
    assert ("土", "木") in D.DUANCI_SISHI_MISSING
    assert ("土", "木") not in D.DUANCI_SISHI


def test_xiang_role_matches_wuxing():
    """各兆局首句所列五乡六亲，须与五行生克自洽（零错位）。"""
    for zhao, mapping in D.XIANG_ROLE.items():
        assert len(mapping) == 5
        for xiang, role in mapping.items():
            assert C.liuqin_of(zhao, xiang) == role, (zhao, xiang, role)


def test_xiang13_covers_all_pairs():
    """乡支十三名词：五乡六亲 × 五支六亲 = 25 格全覆盖，名目恰十三。"""
    assert len(C.XIANG13) == 25
    names = {v[0] for v in C.XIANG13.values()}
    assert names == {
        "相刑", "在家", "动财", "扶乡", "纳财", "化财", "克鬼", "自刑",
        "进鬼", "化鬼", "制鬼", "反制", "抑乡",
    }
    assert len(names) == 13


# ---------------------------------------------------------------------------
# 二、纳甲与空亡（《五兆纳甲》甲寅旬例、《要诀略》六旬空亡）
# ---------------------------------------------------------------------------

def test_najia_jiayin_xun():
    """今传纳甲例：甲寅旬，木纳甲寅乙卯、火纳丙辰丁巳、土纳戊午己未、
    金纳庚申辛酉、水纳壬戌癸亥。"""
    assert C.xun_of("癸亥") == "甲寅旬"
    expect = {
        "木": ["甲寅", "乙卯"], "火": ["丙辰", "丁巳"], "土": ["戊午", "己未"],
        "金": ["庚申", "辛酉"], "水": ["壬戌", "癸亥"],
    }
    for elem, gz in expect.items():
        assert [item["gz"] for item in C.najia(elem, "甲寅旬")] == gz


def test_kongwang_six_xun():
    """《要诀略》：甲子旬中无戌亥……甲寅旬中无子丑。"""
    expect = {
        "甲子旬": ("戌", "亥"), "甲戌旬": ("申", "酉"), "甲申旬": ("午", "未"),
        "甲午旬": ("辰", "巳"), "甲辰旬": ("寅", "卯"), "甲寅旬": ("子", "丑"),
    }
    for xun, branches in expect.items():
        assert set(C.XUN_KONGWANG[xun]) == set(branches), xun


def test_kongwang_jiaxu_left_blank():
    """占空亡：甲戌旬（全金空亡）下逐兆断辞原卷阙，须留白并标存疑。"""
    assert C.KONGWANG_ZHAO_SUSPECT.get("甲戌旬")
    assert all(not v for v in C.KONGWANG_ZHAO["甲戌旬"].values())


# ---------------------------------------------------------------------------
# 三、六神游宫与行神
# ---------------------------------------------------------------------------

def test_liushen_yougong_five_groups():
    """《要诀略·六神游宫》五组：甲乙青龙在兆……壬癸玄武在兆，顺布五乡。"""
    expect = {
        "甲": ["青龍", "朱雀", "螣蛇", "勾陳", "白虎", "玄武"],
        "乙": ["青龍", "朱雀", "螣蛇", "勾陳", "白虎", "玄武"],
        "丙": ["朱雀", "螣蛇", "勾陳", "白虎", "玄武", "青龍"],
        "戊": ["勾陳", "白虎", "玄武", "青龍", "朱雀", "螣蛇"],
        "庚": ["白虎", "玄武", "青龍", "朱雀", "螣蛇", "勾陳"],
        "壬": ["玄武", "青龍", "朱雀", "螣蛇", "勾陳", "白虎"],
    }
    for gan, seq in expect.items():
        assert C.liushen_yougong(gan) == seq, gan


def test_xingshen_first_month_and_left_walk():
    """《要诀略·推行六神法》：正月青龙在寅、朱雀在午、螣蛇在巳、白虎在申、
    玄武在亥，各左行十二月；勾陈原卷缺，据六壬十二神将补正月在辰。"""
    first = C.xingshen(1)
    assert first["青龍"] == "寅"
    assert first["朱雀"] == "午"
    assert first["螣蛇"] == "巳"
    assert first["白虎"] == "申"
    assert first["玄武"] == "亥"
    assert first["勾陳"] == "辰"
    assert D.XINGSHEN_START_SUSPECT.get("勾陳")
    second = C.xingshen(2)
    for beast, branch in first.items():
        idx = (C.BRANCHES.index(branch) + 1) % 12
        assert second[beast] == C.BRANCHES[idx], beast


def test_liushen_si_hai():
    """《要诀略·六神死害法》：青龙死未、朱雀螣蛇死戌害寅卯、勾陈死辰、
    白虎死丑害巳午、玄武死辰害四季。"""
    assert C.xingshen_flags("青龍", "未") == ["死"]
    assert C.xingshen_flags("青龍", "申") == ["害"]
    assert C.xingshen_flags("朱雀", "戌") == ["死"]
    assert C.xingshen_flags("螣蛇", "卯") == ["害"]
    assert C.xingshen_flags("勾陳", "辰") == ["死"]
    assert C.xingshen_flags("白虎", "丑") == ["死"]
    assert C.xingshen_flags("白虎", "午") == ["害"]
    assert C.xingshen_flags("玄武", "辰") == ["死", "害"]


# ---------------------------------------------------------------------------
# 四、神煞
# ---------------------------------------------------------------------------

def test_shensha_month_starts():
    """《要诀略·神煞举要》：正月大煞在戌、丧门在未、煞阴在寅、天医在卯；
    春关在丑、籥在巳。"""
    ss = C.shensha(month_num=1, year_gz="甲子", month_gz="丙寅",
                   day_gz="甲申", hour_gz="甲子", season="春")
    assert ss["月大煞"]["branch"] == "戌"
    assert ss["丧门"]["branch"] == "未"
    assert ss["煞阴"]["branch"] == "寅"
    assert ss["天医(左行)"]["branch"] == "卯"
    assert ss["关"]["branch"] == "丑"
    assert ss["籥"]["branch"] == "巳"


def test_shensha_sanhe_families():
    """劫煞（岁）：申子辰在巳；驿马：太岁申子辰在寅。"""
    ss = C.shensha(month_num=1, year_gz="甲子", month_gz="丙寅",
                   day_gz="甲申", hour_gz="甲子", season="春")
    assert ss["劫煞"]["branch"] == "巳"
    assert ss["驿马"]["branches"]["年"] == "寅"


def test_dasha_full_year():
    """月大煞逐月：正戌 二巳 三午 四未 五寅 六卯 七辰 八亥 九子 十丑 十一申 十二酉。"""
    assert [C.DA_SHA[m] for m in range(1, 13)] == list("戌巳午未寅卯辰亥子丑申酉")


# ---------------------------------------------------------------------------
# 五、入墓三式（《要诀略·纳甲大要》与今传操作法逐例）
# ---------------------------------------------------------------------------

def _rumu_names(zhao, zhis, month_branch, xun, dasha=""):
    return [x["name"] for x in C.rumu_three(
        zhao_elem=zhao, zhi_elems=zhis, month_branch=month_branch,
        xun=xun, dasha_branch=dasha)]


@pytest.mark.parametrize("month_branch,xun,zhao", [
    ("辰", "甲申旬", "水"),   # 三月甲申旬水兆，壬水属辰，辰是水墓
    ("未", "甲午旬", "木"),   # 六月甲午旬木兆，乙木属未，未是木墓
    ("戌", "甲申旬", "火"),   # 九月甲申旬火兆，丙火属戌，戌是火墓
    ("丑", "甲午旬", "金"),   # 十二月甲午旬金兆，辛金属丑，丑是金墓
])
def test_shen_ru_mu(month_branch, xun, zhao):
    assert "身入墓" in _rumu_names(zhao, [zhao] * 6, month_branch, xun)


@pytest.mark.parametrize("month_branch,zhao,zhi", [
    ("未", "土", "木"),   # 六月土兆木支，木是土鬼，木墓在未
    ("戌", "金", "火"),   # 九月金兆火支，火是金鬼，火墓在戌
    ("丑", "木", "金"),   # 十二月木兆金支，金是木鬼，金墓十二月
    ("辰", "水", "土"),   # 三月水兆土支，土是水鬼，土墓在辰
])
def test_gui_xing_ru_mu(month_branch, zhao, zhi):
    zhis = [zhao, zhi, "", "", "", ""]
    assert "鬼行入墓" in _rumu_names(zhao, zhis, month_branch, "甲子旬")


def test_dai_sha_ru_mu_january():
    """带煞入墓不以四墓月为限：正月甲申旬火兆，丙火属戌，正月大煞在戌，戌是火墓。"""
    assert "带煞入墓" in _rumu_names("火", ["火"] * 6, "寅", "甲申旬", dasha="戌")


# ---------------------------------------------------------------------------
# 六、干转支转
# ---------------------------------------------------------------------------

def test_gan_zhuan_yang_de_zi_chu():
    """干转：木兆并有木支，日在甲寅旬，甲木属寅，寅边有甲，即名阳德自处。"""
    hit = C.gan_zhuan("木", ["木", "木", "", "", "", ""], "甲寅旬")
    assert hit and hit["stem"] == "甲" and hit["branch"] == "寅"


def test_zhi_zhuan_jian_chou():
    """支转：火兆并有火支，日在甲子旬，丙火能生戊土，甲子旬戊土属辰，
    辰中有木克土，见仇，故曰支转。"""
    hit = C.zhi_zhuan("火", ["火", "", "火", "", "", ""], "甲子旬")
    assert hit and hit["stem"] == "戊" and hit["branch"] == "辰"
    assert hit["xianchou"] is True
    assert "乙" in hit["chouStems"]


# ---------------------------------------------------------------------------
# 七、君子小人、剥落、身命
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("gan,zhao", [
    ("甲", "金"), ("丙", "水"), ("戊", "木"), ("庚", "火"), ("壬", "土"),
])
def test_shen_ke_ming(gan, zhao):
    """身克命五组：甲乙日金兆、丙丁日水兆、戊己日木兆、庚辛日火兆、壬癸日土兆。"""
    assert C.shen_ming(zhao, gan)["verdict"] == "身克命"


@pytest.mark.parametrize("gan,zhao", [
    ("甲", "土"), ("丙", "金"), ("戊", "水"), ("庚", "木"), ("壬", "火"),
])
def test_ming_ke_shen(gan, zhao):
    """命克身五组：甲乙日土兆、丙丁日金兆、戊己日水兆、庚辛日木兆、壬癸日火兆。"""
    assert C.shen_ming(zhao, gan)["verdict"] == "命克身"


def test_boluo_equals_shen_ke_ming():
    """剥落五组与身克命五组同：戊己日木兆、庚辛日火兆、壬癸日土兆、
    甲乙日金兆、丙丁日水兆。"""
    pairs = {(k[0], v) for k, v in D.SHEN_KE_MING.items()}
    boluo = {(k[0][0], k[1]) for k in D.BOLUO_PAIRS}
    assert {(p[0], p[1]) for p in pairs} == boluo


def test_boluo_yin_yang_day():
    """阳日卜得剥落为君子，阴日为小人；寅申辰戌子午阳，丑未卯酉巳亥阴。"""
    yang = C.junzi_xiaoren("木", "午", "戊")["boluo"]
    assert yang["hit"] and yang["dayYinYang"] == "阳" and "君子" in yang["verdict"]
    yin = C.junzi_xiaoren("木", "巳", "戊")["boluo"]
    assert yin["hit"] and yin["dayYinYang"] == "阴" and "小人" in yin["verdict"]


def test_junzi_xiaoren_by_day_branch():
    """凡克我者为君子、我克者为小人（我为本兆，彼为日支）。"""
    assert C.junzi_xiaoren("木", "申", "甲")["role"] == "君子"   # 申金克木
    assert C.junzi_xiaoren("木", "辰", "甲")["role"] == "小人"   # 木克辰土
    assert C.junzi_xiaoren("木", "午", "甲")["role"] == ""       # 木生午火，不成


# ---------------------------------------------------------------------------
# 八、四时休王
# ---------------------------------------------------------------------------

def test_season_wangshuai_table():
    """《五兆杂言》：春木王火相水休废土死金囚……季夏六月土兆王。"""
    assert C.SEASON_WANGSHUAI["春"] == {"木": "王", "火": "相", "水": "休废",
                                        "土": "死", "金": "囚"}
    assert C.SEASON_WANGSHUAI["季夏"]["土"] == "王"
    assert C.season_of("立秋", 6) == "季夏"     # 农历六月用季夏
    assert C.season_of("立秋", 7) == "秋"
    # 秋三月一节原卷「水」重出而缺火，校补作火囚并标存疑
    assert C.SEASON_WANGSHUAI["秋"]["火"] == "囚"
    assert C.SEASON_WANGSHUAI_SUSPECT.get("秋")


def test_qi_you_wu():
    """王相胎没为有气，休废囚死为无气。"""
    assert C.qi_of("王") == "有气"
    assert C.qi_of("相") == "有气"
    assert C.qi_of("胎") == "有气"
    assert C.qi_of("休废") == "无气"
    assert C.qi_of("囚") == "无气"
    assert C.qi_of("死") == "无气"


# ---------------------------------------------------------------------------
# 九、细分六亲两法
# ---------------------------------------------------------------------------

def test_liuqin_ganhe_all_five():
    """干合生克法：我甲、妻己、母癸、父戊、子庚女辛；五兆皆须「我克父」自洽。"""
    mu = C.liuqin_ganhe("木")
    assert (mu["me"], mu["wife"], mu["mother"], mu["father"],
            mu["son"], mu["daughter"]) == ("甲", "己", "癸", "戊", "庚", "辛")
    for elem in C.ELEMS:
        g = C.liuqin_ganhe(elem)
        assert C.KE[C.STEM_ELEM[g["me"]]] == C.STEM_ELEM[g["father"]], elem


def test_liuqin_yinyang_fire():
    """五行阴阳法（原文丙火例）：我丙、弟丁、长子戊、次女己、父甲、母乙、
    正妻庚、偏财辛、长辈男壬、女癸。"""
    y = C.liuqin_yinyang("火")
    assert y["me"] == "丙" and y["brother"] == "丁"
    assert y["son"] == "戊" and y["daughter"] == "己"
    assert y["father"] == "甲" and y["mother"] == "乙"
    assert y["wife"] == "庚" and y["concubine"] == "辛"
    assert y["elderMale"] == "壬" and y["elderFemale"] == "癸"


# ---------------------------------------------------------------------------
# 十、整盘金标：今传兆局图案例
# ---------------------------------------------------------------------------

def test_full_board_case_yi_day_jin_zhao():
    """今传兆局图例：乙日卜得金兆，木乡木支 / 火乡火支 / 土乡火支 /
    金乡火支 / 水乡水支。图上六亲与六神逐格可校。"""
    elements = ["金", "木", "火", "火", "火", "水"]
    r = C.enrich(elements=elements, ganzhi=["甲子", "丙寅", "乙丑", "丙子", "丁丑"],
                 jieqi="立春", lunar_month=1)
    assert r["zhaoElem"] == "金"
    assert r["zhiElem"] == "火"          # 身宫（金乡）入火支 → 金兆火支
    # 图上六亲：木妻财 / 火官鬼 / 土父母 / 金兄弟 / 水子孙
    roles = {p["xiangElem"]: p["xiangRole"] for p in r["positions"][1:]}
    assert roles == {"木": "妻财", "火": "官鬼", "土": "父母",
                     "金": "兄弟", "水": "子孙"}
    # 图上六神：本兆青龙、木乡朱雀、火乡螣蛇、土乡勾陈、金乡白虎、水乡玄武
    assert [p["beast"] for p in r["positions"]] == [
        "青龍", "朱雀", "螣蛇", "勾陳", "白虎", "玄武"]
    # 十三名词：土乡（父母）入官鬼支为抑乡；金乡（兄弟）入官鬼支为进鬼
    named = {p["xiangElem"]: (p.get("xiang13") or {}).get("name")
             for p in r["positions"][1:]}
    assert named["土"] == "抑乡"
    assert named["金"] == "进鬼"
    assert named["木"] == "在家"
    assert named["水"] == "在家"
    assert named["火"] == "在家"
    # 廿五式本盘所见恰五条
    assert len(r["duanci25"]) == 5


def test_xiang_and_zhi_have_separate_najia():
    """乡与支各自纳甲：今传兆局图中土乡书「戊己」而其入支为火（丙丁），
    二者不可混用（曾把支的纳甲错标在乡侧）。"""
    r = C.enrich(elements=["金", "木", "火", "火", "火", "水"],
                 ganzhi=["甲子", "丙寅", "乙丑", "丙子", "丁丑"],
                 jieqi="立春", lunar_month=1)
    tu = r["positions"][3]                       # 土乡（入火支）
    assert tu["xiangElem"] == "土" and tu["elem"] == "火"
    assert [i["stem"] for i in tu["xiangNajia"]] == ["戊", "己"]
    assert [i["stem"] for i in tu["najia"]] == ["丙", "丁"]
    # 支同乡者两路纳甲相同
    mu = r["positions"][1]
    assert [i["gz"] for i in mu["xiangNajia"]] == [i["gz"] for i in mu["najia"]]
    # 神煞命中须标明所自出（乡／支）
    for hit in tu.get("shensha") or []:
        assert hit["from"] in ("乡", "支", "乡／支")


def test_full_board_case_xingshen_ren_chen():
    """今传行神案例（更正后）：正月甲申旬壬辰日卜得木兆水支——
    木纳甲申而白虎在申、水纳壬辰而勾陈在辰。"""
    r = C.enrich(elements=["木", "水", "火", "土", "金", "水"],
                 ganzhi=["乙丑", "戊寅", "壬辰", "庚子", "辛丑"],
                 jieqi="立春", lunar_month=1)
    assert r["xun"] == "甲申旬"
    assert r["positions"][0]["beast"] == "玄武"           # 壬日玄武在兆
    assert [i["gz"] for i in r["positions"][0]["najia"]] == ["甲申", "乙酉"]
    assert [i["gz"] for i in r["positions"][1]["najia"]] == ["壬辰", "癸巳"]
    beasts = {h["beast"]: h["branch"] for h in r["positions"][0]["xingshen"]}
    assert beasts.get("白虎") == "申"
    beasts = {h["beast"]: h["branch"] for h in r["positions"][1]["xingshen"]}
    assert beasts.get("勾陳") == "辰"
    # 勾陈死在辰，本例正落死地
    hit = [h for h in r["positions"][1]["xingshen"] if h["beast"] == "勾陳"][0]
    assert "死" in hit["flags"]


# ---------------------------------------------------------------------------
# 十一、存疑标记必在
# ---------------------------------------------------------------------------

def test_weijie_all_marked_suspect():
    """未解之谜章全部标存疑，且不参与自动断。"""
    assert len(D.WEIJIE) >= 2
    assert all(item.get("suspect") for item in D.WEIJIE)


def test_yougong_and_shuizhi_suspects_present():
    """原卷重出、错讹处须留有存疑说明：六神游宫戊己日末句、水兆火乡末条。"""
    assert C.YOUGONG_SUSPECT
    assert ("水", "火", "水") in D.DUANCI_25_SUSPECT


# ---------------------------------------------------------------------------
# 十二、类占九门
# ---------------------------------------------------------------------------

def _leizhan_for(elements, ganzhi, jieqi="立春", lunar_month=1):
    r = C.enrich(elements=elements, ganzhi=ganzhi, jieqi=jieqi, lunar_month=lunar_month)
    ss = {i["name"]: i for i in r["shensha"]["items"]}
    return r, L.leizhan(
        zhao=r["zhaoElem"], zhi=r["zhiElem"], elements=elements, ganzhi=ganzhi,
        season=r["season"], beasts=[p["beast"] for p in r["positions"]],
        shensha_map=ss, wangshuai_map=r["qi"]["map"], xun=r["xun"],
        kongwang=r["najia"]["kongwang"]["branches"],
        options={"zhaoNajiaBranches": [i["branch"] for i in r["positions"][0]["najia"]]})


def test_leizhan_nine_men_present():
    """九门俱全，每门皆有通则条文。"""
    _, lz = _leizhan_for(["金", "木", "火", "火", "火", "水"],
                         ["甲子", "丙寅", "乙丑", "丙子", "丁丑"])
    assert list(L.MEN_ORDER) == ["卜病", "卜官事", "卜财", "卜行人", "卜六亲",
                                 "卜宅田丘墓", "卜数射覆", "卜怪异", "杂卜"]
    for men in L.MEN_ORDER:
        assert men in lz
        assert lz[men]["texts"], men


def test_leizhan_bing_wei_by_day_gan():
    """卜病在何处：甲乙日卜得木兆患头颈咽喉。"""
    _, lz = _leizhan_for(["木", "木", "火", "土", "金", "水"],
                         ["甲子", "丙寅", "甲子", "丙子", "丁丑"])
    hits = {r["title"]: r["text"] for r in lz["卜病"]["rules"]}
    assert "头颈" in hits.get("病在何处", "")


def test_leizhan_qiucai_and_sanxiang():
    """求财法：金兆木支为金财；三某之数须依本盘六位实计。"""
    _, lz = _leizhan_for(["金", "木", "火", "火", "火", "水"],
                         ["甲子", "丙寅", "乙丑", "丙子", "丁丑"])
    cai = {r["title"]: r for r in lz["卜财"]["rules"]}
    assert cai["求财法"]["hit"] is False      # 身宫入火支，非金财之木支
    zhai = [r["title"] for r in lz["卜宅田丘墓"]["rules"]]
    assert "三火" in zhai                      # 火乡火支、土乡火支、金乡火支
