# -*- coding: utf-8 -*-
"""印度过运(Gochara) + Sade Sati 引擎。

纯函数模块：输入为本命月/lagna 星座、过运行星星座 dict、八分点 BAV/SAV 数据，
不耦合排盘引擎内部状态(不改 jyotish_engine.py)，便于单测与按需接线。

覆盖：
  - **从月/从命过运**：每过运行星相对本命月(并附从命 lagna)的宫位 → 吉/凶。
    用标准「吉宫/凶宫」过运宫表；罗睺过运按土星表、计都按火星表。
  - **Vedha(遮蔽)**：过运吉位被另一过运曜落在其 vedha 宫时抵消(父子对例外)。
  - **AV 过境**：过运行星落宫的 BAV bindu ≥5 吉 / ≤3 凶；SAV >30 吉 / <25 凶。
  - **Tara Bala**：过境曜所在宿距本命月宿(mod9)→ 九态(生/财/危/安/阻/成/死/友/挚友)。
  - **特殊宿**：从本命月宿起算的固定偏移宿(业/族/亡/国/权/元/毁/心 等)。
  - **宿相位**：各曜从其所在宿正向所照的宿。
  - **Latta(宿踢)**：过境曜被踢到的宿若落本命月宿/lagna 宿 → 该曜本命意象受损。
  - **Murthi**：曜入 rasi 瞬间过境月相对本命月的宫位 → 金/银/铜/铁形(宫位→形原语)。
  - **Sade Sati / Kantaka(Ardhashtama)/ Ashtama Sani**：土星过运本命月的
    12/1/2 宫(Sade Sati 七年半)、4/8(Kantaka)、8 宫(Ashtama)。
    ⚠️ 此三项为通行用法、非主书技法，输出统一带 source='community_standard'
    及免责字段(disclaimer/sourceLabel)。

坐标系：rasi 用 const.LIST_SIGNS 名(0-based Aries..Pisces)，与 jyotish_engine 一致。
吉凶判定为标准过运口径；书 Example/Table 的精确逐曜结论未给者标 `# 待书值`。
"""

from flatlib import const


# ── 行星集合 ──────────────────────────────────────────────────────────────
# 过运只取 7 实体曜 + 罗睺/计都(外行星不入古典过运)。
SUN = const.SUN
MOON = const.MOON
MARS = const.MARS
MERCURY = const.MERCURY
JUPITER = const.JUPITER
VENUS = const.VENUS
SATURN = const.SATURN
RAHU = const.NORTH_NODE
KETU = const.SOUTH_NODE

GOCHARA_PLANETS = [SUN, MOON, MARS, MERCURY, JUPITER, VENUS, SATURN, RAHU, KETU]

# 节点过运代理：罗睺似土星、计都似火星(标准口径)。
NODE_PROXY = {RAHU: SATURN, KETU: MARS}

PLANET_CN = {
    SUN: '太阳', MOON: '月亮', MARS: '火星', MERCURY: '水星', JUPITER: '木星',
    VENUS: '金星', SATURN: '土星', RAHU: '罗睺', KETU: '计都',
}

SIGN_CN = {
    const.ARIES: '白羊', const.TAURUS: '金牛', const.GEMINI: '双子', const.CANCER: '巨蟹',
    const.LEO: '狮子', const.VIRGO: '处女', const.LIBRA: '天秤', const.SCORPIO: '天蝎',
    const.SAGITTARIUS: '射手', const.CAPRICORN: '摩羯', const.AQUARIUS: '水瓶',
    const.PISCES: '双鱼',
}


# ── 标准过运「吉宫」表（相对本命月；从命用同表，参照换 lagna）──────────────
# 标准 Gochara 口径下各曜的有利过运宫(从月起算，1=月本宫)。
# 罗睺取土星表、计都取火星表(NODE_PROXY 解析后查表)。
# 注：Moon/Mercury/Jupiter/Venus 一行与既有八分点贡献宫各曜 'Moon' 行同源，可交叉印证。
GOCHARA_GOOD_HOUSES = {
    SUN: [3, 6, 10, 11],
    MOON: [1, 3, 6, 7, 10, 11],
    MARS: [3, 6, 11],
    MERCURY: [2, 4, 6, 8, 10, 11],
    JUPITER: [2, 5, 7, 9, 11],
    VENUS: [1, 2, 3, 4, 5, 8, 9, 11, 12],
    SATURN: [3, 6, 11],
    # 罗睺/计都不直接列表，经 NODE_PROXY 代理为 Saturn/Mars。
}


def good_houses_for(planet):
    """该过运曜的吉宫列表(罗睺→土星表、计都→火星表)。未知曜返回空表。"""
    proxy = NODE_PROXY.get(planet, planet)
    return GOCHARA_GOOD_HOUSES.get(proxy, [])


# ── Vedha(遮蔽)宫对：吉位被另一曜落在对应 vedha 宫时抵消 ─────────────────
# 标准 Vedha 表：键=过运曜在「从月吉宫」中的宫位，值=遮蔽该吉位的 vedha 宫(均从月起算)。
# 即当某曜过运落于其吉宫 H、而另一曜(日月互不为 Vedha，标准例外)同时落于 VEDHA[planet][H]，
# 该吉位被抵消。各曜 vedha 宫对为标准转录值；个别曜的精确 vedha 宫书表未逐一给出者标 `# 待书值`。
VEDHA_PAIRS = {
    SUN: {3: 9, 6: 12, 10: 4, 11: 5},
    MOON: {1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8},
    MARS: {3: 12, 6: 9, 11: 5},
    MERCURY: {2: 5, 4: 3, 6: 9, 8: 1, 10: 8, 11: 12},
    JUPITER: {2: 12, 5: 4, 7: 3, 9: 10, 11: 8},
    # 金星 11/12 两对曾录入颠倒(11→6,12→3);权威表作 11→3、12→6,已勘正并由锁值断言看守。
    VENUS: {1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 3, 12: 6},
    SATURN: {3: 12, 6: 9, 11: 5},
}
# Vedha 例外对(父子对，互不遮蔽)：日↔土、月↔水。
_VEDHA_EXEMPT_PAIRS = (frozenset({SUN, SATURN}), frozenset({MOON, MERCURY}))


def vedha_house_for(planet, good_house):
    """该过运曜在某吉宫 good_house 时，能遮蔽它的 vedha 宫(从月起算)。无则 None。"""
    proxy = NODE_PROXY.get(planet, planet)
    return VEDHA_PAIRS.get(proxy, {}).get(int(good_house))


# ── 基础 rasi 几何 ─────────────────────────────────────────────────────────
def _sign_index(sign):
    """rasi 名 → 0-based 序(Aries=0..Pisces=11)。未知返回 None。"""
    try:
        return const.LIST_SIGNS.index(sign)
    except (ValueError, AttributeError):
        return None


def house_from(reference_sign, target_sign):
    """target_sign 在 reference_sign 起算的第几宫(1-12，本宫=1)。任一未知 → None。"""
    a = _sign_index(reference_sign)
    b = _sign_index(target_sign)
    if a is None or b is None:
        return None
    return ((b - a) % 12) + 1


def sign_at_house(reference_sign, house):
    """reference_sign 起第 house 宫(1-based)的 rasi 名。reference 未知 → None。"""
    a = _sign_index(reference_sign)
    if a is None:
        return None
    return const.LIST_SIGNS[(a + (int(house) - 1)) % 12]


# ── AV 过境吉凶阈值 ────────────────────────────────────────────────────────
# 标准口径：过运行星落宫的该曜 BAV bindu ≥5 吉 / ≤3 凶；该宫 SAV >30 吉 / <25 凶。
BAV_GOOD_MIN = 5
BAV_BAD_MAX = 3
SAV_GOOD_MIN = 30   # 严格大于
SAV_BAD_MAX = 25    # 严格小于


def av_transit_verdict(bav_bindu, sav_bindu):
    """AV 过境吉凶。

    bav_bindu: 该过运曜在其落宫的 BAV 点数(Bhinnashtakavarga)，None 表无数据。
    sav_bindu: 该落宫的 SAV 点数(Sarvashtakavarga)，None 表无数据。
    返回 {'bav': 'good'|'bad'|'neutral'|None, 'sav': 同, 'bavBindu', 'savBindu'}。
    """
    bav_verdict = None
    if bav_bindu is not None:
        if bav_bindu >= BAV_GOOD_MIN:
            bav_verdict = 'good'
        elif bav_bindu <= BAV_BAD_MAX:
            bav_verdict = 'bad'
        else:
            bav_verdict = 'neutral'
    sav_verdict = None
    if sav_bindu is not None:
        if sav_bindu > SAV_GOOD_MIN:
            sav_verdict = 'good'
        elif sav_bindu < SAV_BAD_MAX:
            sav_verdict = 'bad'
        else:
            sav_verdict = 'neutral'
    return {
        'bav': bav_verdict,
        'sav': sav_verdict,
        'bavBindu': bav_bindu,
        'savBindu': sav_bindu,
    }


def _bav_bindu(ashtakavarga, planet, sign):
    """从 jyotish ashtakavarga 结构取 planet 在 sign 的 BAV 点数(无则 None)。"""
    if not ashtakavarga or not ashtakavarga.get('available'):
        return None
    table = (ashtakavarga.get('bhinna') or {}).get(planet)
    if not table:
        return None
    return table.get(sign)


def _sav_bindu(ashtakavarga, sign):
    """从 jyotish ashtakavarga 结构取 sign 的 SAV 点数(无则 None)。"""
    if not ashtakavarga or not ashtakavarga.get('available'):
        return None
    sarva = ashtakavarga.get('sarva') or {}
    return sarva.get(sign)


# ── 从月/从命过运(逐曜) ────────────────────────────────────────────────────
def transit_from_reference(reference_sign, transit_signs, label):
    """每过运曜相对 reference_sign(本命月或 lagna)的宫位与吉宫判定(未叠 Vedha/AV)。

    reference_sign: 本命月(或 lagna)的 rasi 名。
    transit_signs: {planet_id: 过运 rasi 名}。
    label: 'fromMoon' | 'fromLagna'(仅作标识)。
    返回 [{'planet','planetLabel','sign','signLabel','house','good': bool,
           'goodHouses': [...], 'verdict': 'good'|'bad'}]。
    """
    rows = []
    for planet in GOCHARA_PLANETS:
        sign = transit_signs.get(planet)
        if sign is None:
            continue
        house = house_from(reference_sign, sign)
        goods = good_houses_for(planet)
        is_good = house in goods if house is not None else None
        rows.append({
            'planet': planet,
            'planetLabel': PLANET_CN.get(planet, planet),
            'sign': sign,
            'signLabel': SIGN_CN.get(sign, sign),
            'house': house,
            'good': is_good,
            'goodHouses': list(goods),
            'verdict': ('good' if is_good else 'bad') if is_good is not None else None,
            'reference': label,
        })
    return rows


def apply_vedha(rows, reference_sign, transit_signs, *, blocker_filter=None):
    """对「从月」逐曜结果叠加 Vedha：某曜吉位若被另一曜落于其 vedha 宫则抵消。

    rows: transit_from_reference(...) 的结果(就地补充 vedha 字段，并返回 rows)。
    例外对(父子，互不遮蔽)：日↔土、月↔水。仅 7 实体曜+节点参与遮蔽。
    每行新增：'vedhaHouse'(吉位对应 vedha 宫)、'vedhaBy'(实施遮蔽的曜或 None)、
              'effective'(叠 Vedha 后是否仍为有效吉位)。

    blocker_filter(keyword-only,默认 None=现状逐字不变):可选谓词
    `f(planet_id)->bool`,决定某曜可否**作为遮蔽者**参与 Vedha。用于「罗计是否作
    Vedha 制造者」流派开关(各家不一,默认计入 = 既有口径零回归)。
    """
    # 各曜过运所在「从月宫位」索引：house -> [planet,...]
    house_occupants = {}
    for planet in GOCHARA_PLANETS:
        sign = transit_signs.get(planet)
        if sign is None:
            continue
        if blocker_filter is not None and not blocker_filter(planet):
            continue
        h = house_from(reference_sign, sign)
        if h is not None:
            house_occupants.setdefault(h, []).append(planet)

    for row in rows:
        row['vedhaHouse'] = None
        row['vedhaBy'] = None
        row['effective'] = row.get('good')
        if not row.get('good'):
            continue
        planet = row['planet']
        vh = vedha_house_for(planet, row['house'])
        row['vedhaHouse'] = vh
        if vh is None:
            continue
        blockers = [
            other for other in house_occupants.get(vh, [])
            if other != planet
            and frozenset({planet, other}) not in _VEDHA_EXEMPT_PAIRS  # 父子对互不遮蔽
        ]
        if blockers:
            row['vedhaBy'] = blockers[0]
            row['effective'] = False
    return rows


# ── Sade Sati / Kantaka / Ashtama Sani(社区标准、非主书)─────────────────────
# 决策：加入但标 source='community_standard' + 免责字段。
COMMUNITY_SOURCE = 'community_standard'
COMMUNITY_SOURCE_LABEL = '通行用法·非本书'
COMMUNITY_DISCLAIMER = (
    'Sade Sati / Kantaka / Ashtama Sani 为印度占星通行用法，'
    '非本计划主书所载技法，仅供参考。'
)

# 土星过运本命月的宫位 → 阶段名(Sade Sati 三阶段 12/1/2、Kantaka 4/8、Ashtama 8)。
SADE_SATI_HOUSES = (12, 1, 2)
SADE_SATI_PHASE = {
    12: {'key': 'rising', 'label': '上升期(月前一宫)'},
    1: {'key': 'peak', 'label': '顶峰期(月本宫)'},
    2: {'key': 'setting', 'label': '收尾期(月后一宫)'},
}
KANTAKA_HOUSES = (4, 8)        # Kantaka / Ardhashtama Sani
ASHTAMA_HOUSE = 8             # Ashtama Sani(月第 8 宫)


def saturn_moon_afflictions(natal_moon_sign, saturn_transit_sign):
    """土星过运对本命月的社区标准困难期判定(Sade Sati / Kantaka / Ashtama)。

    natal_moon_sign: 本命月 rasi 名。
    saturn_transit_sign: 过运土星 rasi 名。
    返回带 source/disclaimer 的 dict；任一星座未知 → available=False。
    """
    base = {
        'source': COMMUNITY_SOURCE,
        'sourceLabel': COMMUNITY_SOURCE_LABEL,
        'disclaimer': COMMUNITY_DISCLAIMER,
    }
    house = house_from(natal_moon_sign, saturn_transit_sign)
    if house is None:
        out = dict(base)
        out.update({'available': False, 'reason': 'missing_sign'})
        return out

    sade_sati_active = house in SADE_SATI_HOUSES
    phase = SADE_SATI_PHASE.get(house) if sade_sati_active else None
    out = dict(base)
    out.update({
        'available': True,
        'natalMoonSign': natal_moon_sign,
        'natalMoonSignLabel': SIGN_CN.get(natal_moon_sign, natal_moon_sign),
        'saturnSign': saturn_transit_sign,
        'saturnSignLabel': SIGN_CN.get(saturn_transit_sign, saturn_transit_sign),
        'saturnHouseFromMoon': house,
        'sadeSati': {
            'active': sade_sati_active,
            'phase': (phase or {}).get('key'),
            'phaseLabel': (phase or {}).get('label'),
            'houses': list(SADE_SATI_HOUSES),
            'note': 'seven_and_half_years_total_across_three_signs',
        },
        'kantaka': {
            'active': house in KANTAKA_HOUSES,
            'houses': list(KANTAKA_HOUSES),
            'alias': 'Ardhashtama Sani',
        },
        'ashtamaSani': {
            'active': house == ASHTAMA_HOUSE,
            'house': ASHTAMA_HOUSE,
        },
    })
    return out


# ── 宿基几何(27 宿，Ashwini=1 .. Revati=27) ────────────────────────────────
NAK_COUNT = 27


def _nak_index(value):
    """归一 nakshatra 序到 1-27；None/越界 → None。"""
    if value is None:
        return None
    try:
        i = int(value)
    except (TypeError, ValueError):
        return None
    if i < 1 or i > NAK_COUNT:
        return None
    return i


def nak_count_from(reference_nak, target_nak):
    """target_nak 从 reference_nak 起算的第几宿(1-27，含参照本宿=1)。任一未知→None。"""
    a = _nak_index(reference_nak)
    b = _nak_index(target_nak)
    if a is None or b is None:
        return None
    return ((b - a) % NAK_COUNT) + 1


def nak_at_count(reference_nak, count, forward=True):
    """reference_nak 起、正/逆方向第 count 宿(含参照本宿=第1宿)的宿序(1-27)。"""
    a = _nak_index(reference_nak)
    if a is None:
        return None
    step = (int(count) - 1)
    if not forward:
        step = -step
    return ((a - 1 + step) % NAK_COUNT) + 1


# ── Tara Bala(过境宿距本命月宿的九态循环) ─────────────────────────────────
# 过境曜所在宿距本命月宿的序(mod9 后落 1..9)→ 九态。吉/凶/混按通行口径。
TARA_NAMES = {
    1: {'key': 'janma', 'name': 'Janma', 'label': '生宿', 'quality': 'mixed'},
    2: {'key': 'sampat', 'name': 'Sampat', 'label': '财宿', 'quality': 'good'},
    3: {'key': 'vipat', 'name': 'Vipat', 'label': '危宿', 'quality': 'bad'},
    4: {'key': 'kshema', 'name': 'Kshema', 'label': '安宿', 'quality': 'good'},
    5: {'key': 'pratyak', 'name': 'Pratyak', 'label': '阻宿', 'quality': 'bad'},
    6: {'key': 'sadhana', 'name': 'Sadhana', 'label': '成宿', 'quality': 'good'},
    7: {'key': 'naidhana', 'name': 'Naidhana', 'label': '死宿', 'quality': 'bad'},
    8: {'key': 'mitra', 'name': 'Mitra', 'label': '友宿', 'quality': 'good'},
    9: {'key': 'paramaMitra', 'name': 'Parama Mitra', 'label': '挚友宿', 'quality': 'good'},
}


def tara_bala(natal_moon_nak_index, transit_planet_nak_index):
    """过境曜所在宿相对本命月宿的 Tara(九态循环)。

    natal_moon_nak_index / transit_planet_nak_index: 1-27 宿序。
    返回 {'count'(1-27 原始距), 'taraNumber'(1-9), 'key','name','label','quality'}；
    任一未知 → None。
    """
    count = nak_count_from(natal_moon_nak_index, transit_planet_nak_index)
    if count is None:
        return None
    tara_number = ((count - 1) % 9) + 1
    info = TARA_NAMES[tara_number]
    return {
        'count': count,
        'taraNumber': tara_number,
        'key': info['key'],
        'name': info['name'],
        'label': info['label'],
        'quality': info['quality'],
    }


# ── 特殊宿(从本命月宿/janma 起算的固定偏移) ───────────────────────────────
# 每项 = 从本命月宿起算的第 N 宿(含本宿=第1宿)。意象逐条转录。
SPECIAL_NAKSHATRA_DEFS = [
    {'key': 'janma', 'count': 1, 'name': 'Janma', 'label': '生宿', 'meaning': '总体安康'},
    {'key': 'karma', 'count': 10, 'name': 'Karma', 'label': '业宿', 'meaning': '事业与工作场所'},
    {'key': 'saamudaayika', 'count': 18, 'name': 'Saamudaayika', 'label': '群宿', 'meaning': '群体活动'},
    {'key': 'sanghatika', 'count': 16, 'name': 'Sanghatika', 'label': '社宿', 'meaning': '社群/社会活动'},
    {'key': 'jaati', 'count': 4, 'name': 'Jaati', 'label': '族宿', 'meaning': '同类社群'},
    {'key': 'naidhana', 'count': 7, 'name': 'Naidhana', 'label': '亡宿', 'meaning': '死亡与苦难'},
    {'key': 'desa', 'count': 12, 'name': 'Desa', 'label': '国宿', 'meaning': '所属国家'},
    {'key': 'abhisheka', 'count': 13, 'name': 'Abhisheka', 'label': '权宿',
     'meaning': '权力与威权(亦称 Rajya 王宿)', 'alias': 'Rajya'},
    {'key': 'aadhana', 'count': 19, 'name': 'Aadhana', 'label': '元宿', 'meaning': '家庭安康'},
    {'key': 'vainasika', 'count': 22, 'name': 'Vainasika', 'label': '毁宿',
     'meaning': '毁灭/损毁', 'alias': 'Vinasana'},
    {'key': 'manasa', 'count': 25, 'name': 'Manasa', 'label': '心宿', 'meaning': '心智状态'},
]


def special_nakshatras(natal_moon_nak_index):
    """各特殊宿落在哪一宿(从本命月宿起算)。

    natal_moon_nak_index: 1-27 宿序(=janma)。未知 → None。
    返回 {key: {'count','nakIndex','name','label','meaning'[,'alias']}}。
    """
    base = _nak_index(natal_moon_nak_index)
    if base is None:
        return None
    out = {}
    for spec in SPECIAL_NAKSHATRA_DEFS:
        nak_idx = nak_at_count(base, spec['count'], forward=True)
        entry = {
            'count': spec['count'],
            'nakIndex': nak_idx,
            'name': spec['name'],
            'label': spec['label'],
            'meaning': spec['meaning'],
        }
        if 'alias' in spec:
            entry['alias'] = spec['alias']
        out[spec['key']] = entry
    return out


# ── 宿相位(过境曜从其所在宿正向所照的宿) ───────────────────────────────────
# 各曜所照的「第 N 宿(从其所在宿起算，含本宿=1)」。
NAKSHATRA_ASPECTS = {
    SUN: [14, 15],
    MOON: [14, 15],
    MARS: [1, 3, 7, 8, 15],
    MERCURY: [1, 15],
    JUPITER: [10, 15, 19],
    VENUS: [1, 15],
    SATURN: [3, 5, 15, 19],
    # 罗睺/计都无宿相位定义(书未给)。
}


def nakshatra_aspects_from(planet, transit_nak_index):
    """过境曜从其所在宿所照的宿序列(1-27)。罗计无定义→[]。"""
    counts = NAKSHATRA_ASPECTS.get(planet)
    if not counts:
        return []
    base = _nak_index(transit_nak_index)
    if base is None:
        return []
    return [nak_at_count(base, c, forward=True) for c in counts]


# ── Latta(过境曜的「宿踢」) ───────────────────────────────────────────────
# (踢量 count, 方向 forward)；正踢(Purolatta)向后数=forward；逆踢(Prishtha)=backward。
# 落本命月宿(janma)或本命 lagna 宿→该曜本命意象受损。罗睺计都并列(古典口径同为第9宿逆踢)。
LATTA_RULES = {
    SUN: (12, True),       # 正踢 第12宿
    MARS: (3, True),       # 正踢 第3宿
    JUPITER: (6, True),    # 正踢 第6宿
    SATURN: (8, True),     # 正踢 第8宿
    MOON: (22, False),     # 逆踢 第22宿
    MERCURY: (7, False),   # 逆踢 第7宿
    VENUS: (5, False),     # 逆踢 第5宿
    RAHU: (9, False),      # 逆踢 第9宿
    KETU: (9, False),      # 逆踢 第9宿(与罗睺并列)
}


def latta_nakshatra(planet, transit_nak_index):
    """过境曜从其所在宿出发被「踢」到的宿序(1-27)。无规则/未知→None。"""
    rule = LATTA_RULES.get(planet)
    if rule is None:
        return None
    count, forward = rule
    return nak_at_count(transit_nak_index, count, forward=forward)


def latta_afflicts(planet, transit_nak_index, natal_moon_nak_index,
                   natal_lagna_nak_index=None):
    """该过境曜是否对本命月宿(janma)或本命 lagna 宿形成 Latta 冲。

    返回 {'lattaNak'(被踢到的宿), 'hitsMoon': bool, 'hitsLagna': bool|None,
          'afflicts': bool, 'count', 'direction'}；
    曜无 latta 规则或宿未知 → None。
    """
    rule = LATTA_RULES.get(planet)
    if rule is None:
        return None
    latta_nak = latta_nakshatra(planet, transit_nak_index)
    if latta_nak is None:
        return None
    moon_idx = _nak_index(natal_moon_nak_index)
    lagna_idx = _nak_index(natal_lagna_nak_index)
    hits_moon = (moon_idx is not None and latta_nak == moon_idx)
    hits_lagna = None if lagna_idx is None else (latta_nak == lagna_idx)
    count, forward = rule
    return {
        'lattaNak': latta_nak,
        'count': count,
        'direction': 'forward' if forward else 'backward',
        'hitsMoon': hits_moon,
        'hitsLagna': hits_lagna,
        'afflicts': bool(hits_moon or hits_lagna),
    }


# ── Murthi(过境曜入某 rasi 时，本命月起算的过境月宫位 → 金/银/铜/铁形) ──────
# 需「该曜入 rasi 瞬间过境月相对本命月的宫位」(星历依赖，非纯宿/座可定)，故此处仅给
# 宫位→形的分类原语；调用方提供该宫位。
MURTHI_BY_HOUSE = {
    1: {'key': 'swarna', 'name': 'Swarna', 'label': '金形', 'quality': 'highly_favorable'},
    6: {'key': 'swarna', 'name': 'Swarna', 'label': '金形', 'quality': 'highly_favorable'},
    11: {'key': 'swarna', 'name': 'Swarna', 'label': '金形', 'quality': 'highly_favorable'},
    2: {'key': 'rajata', 'name': 'Rajata', 'label': '银形', 'quality': 'favorable'},
    5: {'key': 'rajata', 'name': 'Rajata', 'label': '银形', 'quality': 'favorable'},
    9: {'key': 'rajata', 'name': 'Rajata', 'label': '银形', 'quality': 'favorable'},
    3: {'key': 'taamra', 'name': 'Taamra', 'label': '铜形', 'quality': 'unfavorable'},
    7: {'key': 'taamra', 'name': 'Taamra', 'label': '铜形', 'quality': 'unfavorable'},
    10: {'key': 'taamra', 'name': 'Taamra', 'label': '铜形', 'quality': 'unfavorable'},
    4: {'key': 'loha', 'name': 'Loha', 'label': '铁形', 'quality': 'highly_unfavorable'},
    8: {'key': 'loha', 'name': 'Loha', 'label': '铁形', 'quality': 'highly_unfavorable'},
    12: {'key': 'loha', 'name': 'Loha', 'label': '铁形', 'quality': 'highly_unfavorable'},
}


def murthi_for_house(transit_moon_house_from_natal_moon):
    """过境月(曜入 rasi 瞬间)相对本命月的宫位 → Murthi 形。未知/越界→None。"""
    if transit_moon_house_from_natal_moon is None:
        return None
    try:
        h = int(transit_moon_house_from_natal_moon)
    except (TypeError, ValueError):
        return None
    return MURTHI_BY_HOUSE.get(h)


# ── 宿基逐曜过境(Tara + Latta + 宿相位) ────────────────────────────────────
def transit_nakshatra_rows(natal_moon_nak_index, transit_naks,
                           natal_lagna_nak_index=None):
    """每过境曜的宿基过境信息(Tara / Latta / 宿相位)。

    natal_moon_nak_index: 本命月宿序 1-27。
    transit_naks: {planet_id: 过境宿序 1-27}。
    natal_lagna_nak_index: 本命 lagna 宿序(可 None)。
    返回 [{'planet','planetLabel','transitNak','tara','latta','aspects'}]。
    """
    rows = []
    for planet in GOCHARA_PLANETS:
        nak = transit_naks.get(planet)
        if nak is None:
            continue
        rows.append({
            'planet': planet,
            'planetLabel': PLANET_CN.get(planet, planet),
            'transitNak': _nak_index(nak),
            'tara': tara_bala(natal_moon_nak_index, nak),
            'latta': latta_afflicts(planet, nak, natal_moon_nak_index,
                                    natal_lagna_nak_index),
            'aspects': nakshatra_aspects_from(planet, nak),
        })
    return rows


# ── 顶层组装 ──────────────────────────────────────────────────────────────
def compute_gochara(natal_moon_sign, natal_lagna_sign, transit_signs,
                    ashtakavarga=None, transit_date=None,
                    natal_moon_nak_index=None, natal_lagna_nak_index=None,
                    transit_naks=None, natal_sun_sign=None,
                    vedha_blockers='all'):
    """过运分析顶层入口。

    natal_moon_sign: 本命月 rasi 名(从月过运参照)。
    natal_lagna_sign: 本命 lagna rasi 名(从命过运参照；可 None)。
    transit_signs: {planet_id: 过运 rasi 名}(7 实体曜 + 罗睺/计都；外行星不入)。
    ashtakavarga: jyotish['ashtakavarga'] 结构(BAV/SAV)；None 则跳过 AV 过境。
    transit_date: 过运日期标识(字符串，仅回显)。
    natal_moon_nak_index: 本命月宿序 1-27(供 Tara/Latta/特殊宿；None 则跳过宿基块)。
    natal_lagna_nak_index: 本命 lagna 宿序 1-27(供 Latta 对 lagna 宿；可 None)。
    transit_naks: {planet_id: 过境宿序 1-27}(供逐曜 Tara/Latta/宿相位；None 则跳过)。

    返回结构：
      {
        'available', 'source': 'gochara_standard', 'transitDate',
        'reference': {'moonSign','lagnaSign','moonNak','lagnaNak', ...labels},
        'fromMoon': [逐曜(含 Vedha + AV 过境)],
        'fromLagna': [逐曜],
        'saturnAfflictions': {Sade Sati/Kantaka/Ashtama, source='community_standard'},
        'taraBala': [逐曜宿基(Tara/Latta/宿相位)]  # 仅当宿序齐备
        'specialNakshatras': {Karma/Naidhana/... 落宿}  # 仅当本命月宿在
      }
    """
    if natal_moon_sign is None or not transit_signs:
        return {
            'available': False,
            'reason': 'missing_natal_moon_or_transit',
            'source': 'gochara_standard',
            'transitDate': transit_date,
        }

    # 流派开关 vedhaBlockers:'all'(默认,罗计计入遮蔽者=既有口径) / 'exclude_nodes'(罗计不作遮蔽者)。
    _vbf = None if vedha_blockers != 'exclude_nodes' else (lambda p: p not in (RAHU, KETU))
    from_moon = transit_from_reference(natal_moon_sign, transit_signs, 'fromMoon')
    apply_vedha(from_moon, natal_moon_sign, transit_signs, blocker_filter=_vbf)
    # 叠加 AV 过境(BAV/SAV)到每行(从月行)。
    for row in from_moon:
        av = av_transit_verdict(
            _bav_bindu(ashtakavarga, row['planet'], row['sign']),
            _sav_bindu(ashtakavarga, row['sign']),
        )
        row['av'] = av

    from_lagna = []
    if natal_lagna_sign is not None:
        from_lagna = transit_from_reference(natal_lagna_sign, transit_signs, 'fromLagna')
        for row in from_lagna:
            av = av_transit_verdict(
                _bav_bindu(ashtakavarga, row['planet'], row['sign']),
                _sav_bindu(ashtakavarga, row['sign']),
            )
            row['av'] = av

    # 第三基准「从日」(与从月/从命并列;吉位/Vedha/AV 同判)。
    from_sun = []
    if natal_sun_sign is not None:
        from_sun = transit_from_reference(natal_sun_sign, transit_signs, 'fromSun')
        apply_vedha(from_sun, natal_sun_sign, transit_signs, blocker_filter=_vbf)
        for row in from_sun:
            row['av'] = av_transit_verdict(
                _bav_bindu(ashtakavarga, row['planet'], row['sign']),
                _sav_bindu(ashtakavarga, row['sign']),
            )

    saturn_sign = transit_signs.get(SATURN)
    saturn_afflictions = saturn_moon_afflictions(natal_moon_sign, saturn_sign)

    # ── 宿基块(Tara Bala / Latta / 宿相位 / 特殊宿)：仅当宿序齐备时计算 ──
    moon_nak = _nak_index(natal_moon_nak_index)
    lagna_nak = _nak_index(natal_lagna_nak_index)
    tara_rows = []
    special_naks = None
    if moon_nak is not None:
        special_naks = special_nakshatras(moon_nak)
        if transit_naks:
            tara_rows = transit_nakshatra_rows(moon_nak, transit_naks, lagna_nak)

    return {
        'available': True,
        'source': 'gochara_standard',
        'transitDate': transit_date,
        'reference': {
            'moonSign': natal_moon_sign,
            'moonSignLabel': SIGN_CN.get(natal_moon_sign, natal_moon_sign),
            'sunSign': natal_sun_sign,
            'sunSignLabel': SIGN_CN.get(natal_sun_sign, natal_sun_sign) if natal_sun_sign else None,
            'lagnaSign': natal_lagna_sign,
            'lagnaSignLabel': SIGN_CN.get(natal_lagna_sign, natal_lagna_sign) if natal_lagna_sign else None,
            'moonNak': moon_nak,
            'lagnaNak': lagna_nak,
        },
        'fromMoon': from_moon,
        'fromLagna': from_lagna,
        'fromSun': from_sun,
        'saturnAfflictions': saturn_afflictions,
        'taraBala': tara_rows,
        'specialNakshatras': special_naks,
    }
