# -*- coding: utf-8 -*-
"""出生须臾(Birth-Muhurta)——一日 30 须臾对照表。

印度时学：昼(日出→日没)均分 15 须臾(day muhurtas)，夜(日没→次日出)均分 15 须臾
(night muhurtas)，合 30。每须臾 = 昼长(或夜长)的 1/15(春分前后约 48 分)。每须臾各有
梵名、所主神祇/星主、吉/凶/平之性。第 8 昼须臾为 Abhijit(至吉)。

数据来源说明：所用 30 须臾名/性/主为印度时学权威三十须臾对照表的通行定本(梵名 + 字面义
中文注，不臆造专名)。性(nature)取传统通说;个别须臾在不同传承间吉凶判语略有出入,以 note
标注，使用方可据权威时学原典再核(本表为通行定本,非任一单一文本独家)。

所有函数为纯函数，不做任何 I/O。JD 一律为儒略日(UT)。
"""

# ── 性别常量 ────────────────────────────────────────────────────────────
AUSPICIOUS = 'auspicious'      # 吉
INAUSPICIOUS = 'inauspicious'  # 凶
MIXED = 'mixed'                # 平 / 吉凶相参

# ── 15 昼须臾(权威三十须臾对照表·昼) ────────────────────────────────────
# (序, 梵名, 字面义/星主中文注, 主, 性)
# 第 8 昼须臾 Abhijit(至吉)——本表唯一显式标记 isAbhijit。
_DAY_MUHURTAS = [
    (1,  'Rudra',        '楼陀罗(暴烈神)',   'Rudra',        INAUSPICIOUS),
    (2,  'Ahi',          '阿希(蛇)',         'Ahi',          INAUSPICIOUS),
    (3,  'Mitra',        '密多罗(友神)',     'Mitra',        AUSPICIOUS),
    (4,  'Pitri',        '毕利(祖先)',       'Pitri',        INAUSPICIOUS),
    (5,  'Vasu',         '婆薮(八方善神)',   'Vasu',         AUSPICIOUS),
    (6,  'Vara',         '婆罗/众善神',      'Vishvedeva',   AUSPICIOUS),
    (7,  'Vishwavasu',   '众生善神',         'Vishwavasu',   AUSPICIOUS),
    (8,  'Abhijit',      '阿毗耆(必胜·至吉)', 'Brahma',       AUSPICIOUS),
    (9,  'Rakshasa',     '罗刹(凶神)',       'Rakshasa',     INAUSPICIOUS),
    (10, 'Acharya',      '阿阇梨(师尊)',     'Acharya',      AUSPICIOUS),
    (11, 'Vijaya',       '毗阇耶(胜利)',     'Vijaya',       AUSPICIOUS),
    (12, 'Naktanchara',  '夜行(罗刹)',       'Naktanchara',  INAUSPICIOUS),
    (13, 'Varuna',       '伐楼那(水神)',     'Varuna',       AUSPICIOUS),
    (14, 'Aryaman',      '阿利耶门(太阳神)', 'Aryaman',      AUSPICIOUS),
    (15, 'Bhaga',        '婆伽(分配神)',     'Bhaga',        MIXED),
]

# ── 15 夜须臾(权威三十须臾对照表·夜) ────────────────────────────────────
_NIGHT_MUHURTAS = [
    (1,  'Girisha',      '吉利舍(山主·湿婆)', 'Girisha',     AUSPICIOUS),
    (2,  'Ajapada',      '阿阇波陀(独足天)',  'Ajapada',     INAUSPICIOUS),
    (3,  'Ahirbudhnya',  '深渊之蛇',          'Ahirbudhnya', AUSPICIOUS),
    (4,  'Pushya',       '富沙(养育)',        'Pushan',      AUSPICIOUS),
    (5,  'Ashwini',      '阿湿毗你(双马童)',  'Ashwins',     AUSPICIOUS),
    (6,  'Yama',         '阎摩(死主)',        'Yama',        INAUSPICIOUS),
    (7,  'Agni',         '阿耆尼(火神)',      'Agni',        AUSPICIOUS),
    (8,  'Vidhatri',     '毗陀多(造化主)',    'Vidhatri',    AUSPICIOUS),
    (9,  'Kanda',        '健陀(战神部)',      'Kanda',       AUSPICIOUS),
    (10, 'Aditi',        '阿提缔(无缚母)',    'Aditi',       AUSPICIOUS),
    (11, 'Jiva',         '耆婆(命/木曜)',     'Jiva',        AUSPICIOUS),
    (12, 'Vishnu',       '毗湿奴(护持神)',    'Vishnu',      AUSPICIOUS),
    (13, 'Yumigadyuti',  '阳光余照',          'Yumigadyuti', AUSPICIOUS),
    (14, 'Brahma',       '梵天(造物主)',      'Brahma',      AUSPICIOUS),
    (15, 'Samudram',     '娑牟陀罗(海)',      'Samudra',     AUSPICIOUS),
]


def _build(rows, period):
    out = []
    for index, name, name_cn, lord, nature in rows:
        out.append({
            'index': index,
            'name': name_cn,        # 中文(字面义)展示名
            'nameEn': name,         # 梵文罗马转写
            'lord': lord,           # 所主神祇/星主
            'nature': nature,       # auspicious / inauspicious / mixed
            'isAbhijit': (period == 'day' and index == 8),
        })
    return out


def day_muhurtas():
    """15 昼须臾参照表(日出→日没等分)。第 8 个为 Abhijit(至吉)。"""
    return _build(_DAY_MUHURTAS, 'day')


def night_muhurtas():
    """15 夜须臾参照表(日没→次日出等分)。"""
    return _build(_NIGHT_MUHURTAS, 'night')


def all_muhurtas():
    """30 须臾参照表(昼 15 + 夜 15)，便于挂载/导出整表。"""
    return {'day': day_muhurtas(), 'night': night_muhurtas()}


def birth_muhurta(birth_jd, sunrise_jd, sunset_jd, next_sunrise_jd, vedic_weekday=None):
    """出生落在第几须臾。

    入参均为儒略日(UT)：
      - birth_jd        出生时刻
      - sunrise_jd      当日日出(出生所属印度日的起始日出)
      - sunset_jd       当日日没
      - next_sunrise_jd 次日日出

    昼生(sunrise ≤ jd < sunset)：取昼须臾 floor((jd-sunrise)/(昼长/15)) + 1。
    否则夜生：以 jd ≥ sunset 落入夜段((jd-sunset)/(夜长/15))。

    vedic_weekday(可选,0=周日,日界 = 日出):给出时 nature 为「当天实际档」——Abhijit 周三不取吉
    (primitives.muhurta_effective_nature 单源),并回 abhijitAuspicious;缺省按表(旧行为)。
    返回 {period, index(1-15), name, nameEn, lord, nature, isAbhijit, startJd, endJd}。
    日出/日没不定(极地等，传入 None 或区间非法)→ 返回 None(优雅降级)。
    """
    # ── 极地/缺值优雅降级 ──
    if birth_jd is None or sunrise_jd is None:
        return None
    if sunset_jd is None or next_sunrise_jd is None:
        return None
    try:
        birth_jd = float(birth_jd)
        sunrise_jd = float(sunrise_jd)
        sunset_jd = float(sunset_jd)
        next_sunrise_jd = float(next_sunrise_jd)
    except (TypeError, ValueError):
        return None

    day_len = sunset_jd - sunrise_jd
    night_len = next_sunrise_jd - sunset_jd
    if day_len <= 0 or night_len <= 0:
        return None  # 极地无昼/无夜等非法区间

    if sunrise_jd <= birth_jd < sunset_jd:
        # ── 昼生 ──
        slot = day_len / 15.0
        idx = int((birth_jd - sunrise_jd) / slot)      # 0..14  segment-ok: 时间片序(下方夹紧)
        if idx > 14:
            idx = 14                                   # 边界(jd→sunset)夹紧
        ref = day_muhurtas()[idx]
        start_jd = sunrise_jd + idx * slot
        end_jd = start_jd + slot
        period = 'day'
    else:
        # ── 夜生(含 jd ≥ sunset 或 jd < sunrise 的午夜后)──
        slot = night_len / 15.0
        if birth_jd < sunrise_jd:
            # 同一历日午夜后、次日出前——理论上属「前一夜」，此处按本日夜段不外推，
            # 仅当 jd ≥ sunset 时给确定段;jd < sunrise 视为不在本日昼夜窗内。
            return None
        idx = int((birth_jd - sunset_jd) / slot)       # 0..14  segment-ok: 时间片序(下方夹紧)
        if idx > 14:
            idx = 14                                   # 边界(jd→次日出)夹紧
        if idx < 0:
            idx = 0
        ref = night_muhurtas()[idx]
        start_jd = sunset_jd + idx * slot
        end_jd = start_jd + slot
        period = 'night'

    return {
        'period': period,
        'index': ref['index'],
        'name': ref['name'],
        'nameEn': ref['nameEn'],
        'lord': ref['lord'],
        'nature': _effective_nature(ref, vedic_weekday),
        'isAbhijit': ref['isAbhijit'],
        'abhijitAuspicious': (_abhijit_ok(vedic_weekday) if ref['isAbhijit'] else None),
        'startJd': start_jd,
        'endJd': end_jd,
    }


def _effective_nature(ref, vedic_weekday):
    from astrostudy.india.primitives import muhurta_effective_nature
    return muhurta_effective_nature(ref, vedic_weekday) if vedic_weekday is not None else ref['nature']


def _abhijit_ok(vedic_weekday):
    from astrostudy.india.primitives import abhijit_auspicious
    return None if vedic_weekday is None else abhijit_auspicious(vedic_weekday)
