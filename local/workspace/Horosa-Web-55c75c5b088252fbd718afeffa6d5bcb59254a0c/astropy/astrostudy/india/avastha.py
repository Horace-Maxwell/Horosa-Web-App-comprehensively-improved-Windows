"""行星状态(Avasthas) + 固定/自然卡拉卡(Sthira / Naisargika karaka)。

纯函数：输入为已算好的简单标量(dignity 字符串 / 友敌关系 / 宫号 / 度数)，
不耦合排盘引擎内部状态，便于单测；判定序逐条落到附录 T12(Avasthas)/T4(卡拉卡)。

复用 primitives.baladi_avastha(奇宫顺/偶宫逆，每 6° 一态)，本模块只补其余各态。

约定 —— dignity 字符串沿用 jyotish_engine.dignity() 口径：
    deep_exaltation / exaltation / moolatrikona / own_sign / neutral / debilitation
relation(本曜对其所在星座主星的复合关系，或自然关系)沿用 primitives 口径：
    friend / neutral / enemy（友/中/敌）；own 时本曜即主星，归 own。

坐标系：rasi Ar=1..Pi=12；nakshatra Ashwini=1..Revati=27。
"""

from flatlib import const


# 旺(含深旺/MT) —— 视同「在自宫之上」一档，多处 avastha 与 own 同级或更高。
_EXALTED = {'deep_exaltation', 'exaltation'}
_OWN_LIKE = {'moolatrikona', 'own_sign'}     # MT 视同 own 一档
_DEBIL = {'debilitation'}


# ── Jagradadi avastha（警觉，3 态）— 附录 T12 ────────────────────────────
# 旺/own = Jagrita(警觉，全力)；中/友 = Swapna(梦，中力)；落/敌 = Sushupta(睡，微力)。
_JAGRADADI = {
    'jagrita':  {'key': 'Jagrita',  'label': '警觉', 'power': 'full',  'index': 1},
    'swapna':   {'key': 'Swapna',   'label': '梦',   'power': 'mid',   'index': 2},
    'sushupta': {'key': 'Sushupta', 'label': '睡',   'power': 'weak',  'index': 3},
}


def jagradadi_avastha(dignity, relation=None):
    """Jagradadi avastha(警觉态)。

    判定序(附录 T12)：
      旺/own  → Jagrita(警觉，全力)
      落/敌    → Sushupta(睡，微力)
      中/友    → Swapna(梦，中力)  ← 兜底

    参数：
      dignity  : jyotish_engine.dignity() 字符串(deep_exaltation/.../debilitation)。
      relation : 本曜对其星座主星的友敌关系(friend/neutral/enemy)，可选；
                 own/旺 时主星即本曜，dignity 已足够，relation 可省。

    返回 {key,label,power,index}，与 primitives.baladi_avastha 同形(便于前端统一渲染)。
    """
    if dignity in _EXALTED or dignity in _OWN_LIKE:
        return dict(_JAGRADADI['jagrita'])
    if dignity in _DEBIL or relation == 'enemy':
        return dict(_JAGRADADI['sushupta'])
    if relation == 'friend' or relation == 'neutral' or relation is None:
        return dict(_JAGRADADI['swapna'])
    # 兜底(不可达，留稳健)
    return dict(_JAGRADADI['swapna'])


# ── Deeptadi avastha（情绪，9 核心态）— 附录 T12 ─────────────────────────
# 旺 Deepta / own Swastha / 良友(adhimitra) Mudita / 友(mitra) Saanta /
# 中 Deena / 敌 Duhkhita / 合 malefic Vikala / 在 malefic 宫(被恶曜照?) Khala /
# 近合日(燃烧) Kopita。(+6 扩态 Lajjita/Garvita/… 需合照上下文，默认 P2 不做。)
_DEEPTADI = {
    'deepta':   {'key': 'Deepta',   'label': '明耀', 'index': 1},   # 旺
    'swastha':  {'key': 'Swastha',  'label': '安住', 'index': 2},   # own
    'mudita':   {'key': 'Mudita',   'label': '欢喜', 'index': 3},   # 良友(adhimitra)
    'saanta':   {'key': 'Saanta',   'label': '安详', 'index': 4},   # 友(mitra)
    'deena':    {'key': 'Deena',    'label': '困弱', 'index': 5},   # 中/落?
    'duhkhita': {'key': 'Duhkhita', 'label': '苦恼', 'index': 6},   # 敌
    'vikala':   {'key': 'Vikala',   'label': '残损', 'index': 7},   # 与恶曜合
    'khala':    {'key': 'Khala',    'label': '凶恶', 'index': 8},   # 在恶曜之宫(恶曜星座)
    'kopita':   {'key': 'Kopita',   'label': '愤激', 'index': 9},   # 近合日(燃烧)
}


DEEPTADI_KHALA_RULES = ('malefic_sign', 'debilitation')


def deeptadi_avastha(dignity, relation=None, *, combust=False,
                     conjunct_malefic=False, in_malefic_sign=False,
                     compound=None, khala_rule='malefic_sign'):
    """Deeptadi avastha(情绪态，9 核心)。

    判定序(附录 T12，按优先级从高到低；首条命中即返回)：
      1 旺(exalt/深旺/MT)           → Deepta(明耀)
      2 own                         → Swastha(安住)
      3 良友宫(复合 adhimitra)       → Mudita(欢喜)
      4 友宫(复合 mitra / 自然 friend)→ Saanta(安详)
      5 近合日(燃烧)                 → Kopita(愤激)
      6 与恶曜同宫(合)               → Vikala(残损)
      7 在恶曜之星座(敌方恶曜宫)       → Khala(凶恶)
      8 敌宫(enemy / satru / adhisatru)→ Duhkhita(苦恼)
      9 其余(中/落)                  → Deena(困弱)  ← 兜底

    注：燃烧(Kopita)/合恶(Vikala)/恶宫(Khala) 为情境态，需引擎传上下文布尔；
        不传则按 dignity/relation 退化到 1-4/8-9。MT 归 own(一档)。

    khala_rule(两种通行口径,流派开关 deeptadiKhala):
      'malefic_sign'(缺省,上表):落恶曜之座 → Khala,落陷 / 中性 → Deena(兜底)。
      'debilitation'(BPHS 通行):落陷 → Khala(尊贵档,紧随 own 判),中性座 → Deena;
                     「落恶曜之座」不另成态(按友敌落到其余各态)。

    参数：
      dignity          : dignity 字符串。
      relation         : 自然友敌(friend/neutral/enemy)，可选。
      compound         : 复合关系(adhimitra/mitra/sama/satru/adhisatru)，可选；
                         有则优先用之区分「良友 Mudita / 友 Saanta」「敌 Duhkhita」。
      combust          : 是否燃烧(近合日)。
      conjunct_malefic : 是否与恶曜同宫。
      in_malefic_sign  : 是否落在恶曜所主星座。

    返回 {key,label,index}。
    """
    if dignity in _EXALTED:
        return dict(_DEEPTADI['deepta'])
    if dignity in _OWN_LIKE:
        return dict(_DEEPTADI['swastha'])
    bphs_khala = (khala_rule == 'debilitation')
    if bphs_khala and dignity in _DEBIL:
        return dict(_DEEPTADI['khala'])
    # 友(良友/普友) —— 优先复合关系，退化用自然关系。
    if compound == 'adhimitra':
        return dict(_DEEPTADI['mudita'])
    if compound == 'mitra' or (compound is None and relation == 'friend'):
        return dict(_DEEPTADI['saanta'])
    # 情境态(需上下文)：燃烧 → 合恶 → 恶宫。
    if combust:
        return dict(_DEEPTADI['kopita'])
    if conjunct_malefic:
        return dict(_DEEPTADI['vikala'])
    if in_malefic_sign and not bphs_khala:
        return dict(_DEEPTADI['khala'])
    # 敌。
    if compound in ('satru', 'adhisatru') or (compound is None and relation == 'enemy'):
        return dict(_DEEPTADI['duhkhita'])
    # 兜底：中/落 → Deena。
    return dict(_DEEPTADI['deena'])


# ── Sthira karaka（固定卡拉卡，7 行星语义）— 附录 T4 ─────────────────────
# 父=日/金(强者)；母=月/火(强者)；火=弟妹/连襟妯娌；水=母系亲；
# 木=夫/子/父系；金=妻/岳家/母系祖父母；土=兄姐。(死亡择时用，配 Shoola 亲属变体。)
# 「父/母」由两曜中较强者代表 —— 强弱由调用方(jaimini_strength)判定后传入。
_STHIRA = [
    {'key': 'pitri',    'label': '父',         'candidates': [const.SUN, const.VENUS]},
    {'key': 'matri',    'label': '母',         'candidates': [const.MOON, const.MARS]},
    {'key': 'sahaja',   'label': '弟妹/连襟妯娌', 'planet': const.MARS},
    {'key': 'matrula',  'label': '母系亲',      'planet': const.MERCURY},
    {'key': 'putra',    'label': '夫/子/父系',   'planet': const.JUPITER},
    {'key': 'kalatra',  'label': '妻/岳家/母系祖', 'planet': const.VENUS},
    {'key': 'jyeshtha', 'label': '兄姐',        'planet': const.SATURN},
]


# ── Lajjitādi avastha（羞/傲/饥/渴/喜/扰，6 态可并存）── 附录 T12 ─────────────
_WATER_SIGNS = {const.CANCER, const.SCORPIO, const.PISCES}
_LAJJITA_CONJ = {const.SUN, const.SATURN, const.MARS, const.NORTH_NODE, const.SOUTH_NODE}
_BENEFIC_CONJ = {const.JUPITER, const.VENUS}


def lajjitadi_avastha(house, dignity, sign, conjuncts, malefic_aspect, combust):
    """Lajjitādi 6 态(可并存):
      羞 Lajjita = 居第 5 宫且与 日/土/火/罗/计 同宫;
      傲 Garvita = 旺/MT(深旺/旺/本三角);
      饥 Kshudita = 入弱(敌座/困,以 debilitation 口径);
      渴 Trishita = 水座(蟹/蝎/鱼)被凶照;
      喜 Mudita = 入庙(自宫) 或 与 木/金(吉)同宫;
      扰 Kshobhita = 燃烧(合日)且被凶照。
    conjuncts = 同宫曜 id 集;malefic_aspect = 是否被自然凶曜(日火土罗计)相照。返回态列表(可空)。"""
    out = []
    conj = set(conjuncts or [])
    if house == 5 and (conj & _LAJJITA_CONJ):
        out.append({'key': 'lajjita', 'label': '羞', 'en': 'Lajjita', 'nature': 'bad'})
    if dignity in _EXALTED or dignity == 'moolatrikona':
        out.append({'key': 'garvita', 'label': '傲', 'en': 'Garvita', 'nature': 'good'})
    if dignity in _DEBIL:
        out.append({'key': 'kshudita', 'label': '饥', 'en': 'Kshudita', 'nature': 'bad'})
    if sign in _WATER_SIGNS and malefic_aspect:
        out.append({'key': 'trishita', 'label': '渴', 'en': 'Trishita', 'nature': 'bad'})
    if dignity == 'own_sign' or (conj & _BENEFIC_CONJ):
        out.append({'key': 'mudita', 'label': '喜', 'en': 'Mudita', 'nature': 'good'})
    if combust and malefic_aspect:
        out.append({'key': 'kshobhita', 'label': '扰', 'en': 'Kshobhita', 'nature': 'bad'})
    return out


def sthira_karaka(stronger_of=None):
    """固定卡拉卡(Sthira karaka，附录 T4)：返回语义角色 → 行星 的列表。

    多数角色固定到单一行星；「父」「母」由两候选中较强者代表：
      父 = 日 / 金 中较强者；母 = 月 / 火 中较强者。

    参数：
      stronger_of : 可选回调 f(planet_a, planet_b) -> 较强 planet(由 jaimini_strength 提供)；
                    不传则「父」「母」保留双候选(candidates 字段)，由调用方再定。

    返回 list[dict]：固定项含 {key,label,planet}；
                    父/母含 {key,label,candidates,[planet]}（有 stronger_of 时填 planet）。
    """
    out = []
    for item in _STHIRA:
        row = dict(item)
        cands = row.get('candidates')
        if cands and callable(stronger_of):
            row['planet'] = stronger_of(cands[0], cands[1])
        out.append(row)
    return out


# ── Naisargika karaka（自然卡拉卡，house→planet）— 附录 T4 ───────────────
# 1日/2木/3火/4月/5木/6火/7金/8土/9木/10水/11木/12土。(general phalita。)
_NAISARGIKA = {
    1: const.SUN, 2: const.JUPITER, 3: const.MARS, 4: const.MOON,
    5: const.JUPITER, 6: const.MARS, 7: const.VENUS, 8: const.SATURN,
    9: const.JUPITER, 10: const.MERCURY, 11: const.JUPITER, 12: const.SATURN,
}


def naisargika_karaka(house):
    """自然卡拉卡(Naisargika karaka，附录 T4)：宫号(1-12) → 行星。

    超出 1-12 抛 ValueError(宫号无意义)。
    """
    h = int(house)
    if h < 1 or h > 12:
        raise ValueError('house must be 1-12, got %r' % (house,))
    return _NAISARGIKA[h]


def naisargika_karaka_table():
    """整张映射拷贝(1-12 宫 → 行星)，便于一次性挂载/校验。"""
    return dict(_NAISARGIKA)


# ── Sayanadi avastha（活动，12 态）— 权威表/对照算例 ──────────────────────
# 行星「起居活动」12 态。index = ((C×P×A)+M+G+L) mod12（结果 0 取 12）：
#   C 本曜所在 nakshatra 序(Ashwini=1..Revati=27)
#   P 行星序 日1 月2 火3 水4 木5 金6 土7 罗8 计9
#   A 本曜在所在星座内的 navamsa 序(1-9，每 navamsa=3°20′)
#   M 月亮 nakshatra 序(1-27)
#   G 日出后的 ghati 序(1 ghati=24 分；日出起第 G 个 24 分段)
#   L 上升星座序(白羊=1..双鱼=12)
# 12 态(index→名)：1 Sayana(卧) 2 Upavesana(坐) 3 Netrapaani(揉眼) 4 Prakaasana(发光)
#   5 Gamana(行进) 6 Aagamana(归来) 7 Sabhaa(在会) 8 Aagama(到来) 9 Bhojana(进食)
#   10 Nriyalipsaa(欲舞) 11 Kautuka(热切) 12 Nidraa(眠)。
_SAYANADI_STATES = [
    {'key': 'Sayana',      'label': '卧',   'index': 1},
    {'key': 'Upavesana',   'label': '坐',   'index': 2},
    {'key': 'Netrapaani',  'label': '揉眼', 'index': 3},
    {'key': 'Prakaasana',  'label': '发光', 'index': 4},
    {'key': 'Gamana',      'label': '行进', 'index': 5},
    {'key': 'Aagamana',    'label': '归来', 'index': 6},
    {'key': 'Sabhaa',      'label': '在会', 'index': 7},
    {'key': 'Aagama',      'label': '到来', 'index': 8},
    {'key': 'Bhojana',     'label': '进食', 'index': 9},
    {'key': 'Nriyalipsaa', 'label': '欲舞', 'index': 10},
    {'key': 'Kautuka',     'label': '热切', 'index': 11},
    {'key': 'Nidraa',      'label': '眠',   'index': 12},
]

# 行星序 P：日1 月2 火3 水4 木5 金6 土7 罗8 计9（接受 flatlib const id 或缩写 key）。
_SAYANADI_PLANET_ORDINAL = {
    const.SUN: 1, const.MOON: 2, const.MARS: 3, const.MERCURY: 4,
    const.JUPITER: 5, const.VENUS: 6, const.SATURN: 7,
    const.NORTH_NODE: 8, const.SOUTH_NODE: 9,
    'Sun': 1, 'Moon': 2, 'Mars': 3, 'Mercury': 4, 'Jupiter': 5,
    'Venus': 6, 'Saturn': 7, 'Rahu': 8, 'Ketu': 9,
}

# 活动质量(Cheshta/Drishti/Vicheshta)的行星调整量 planet_adjust：
#   日,木 = 5；月,火 = 2；水,金,土 = 3；罗,计 = 4。
_SAYANADI_PLANET_ADJUST = {
    const.SUN: 5, const.JUPITER: 5,
    const.MOON: 2, const.MARS: 2,
    const.MERCURY: 3, const.VENUS: 3, const.SATURN: 3,
    const.NORTH_NODE: 4, const.SOUTH_NODE: 4,
    'Sun': 5, 'Jupiter': 5, 'Moon': 2, 'Mars': 2,
    'Mercury': 3, 'Venus': 3, 'Saturn': 3, 'Rahu': 4, 'Ketu': 4,
}

# name_value：本曜 nakshatra 名首音节 → 1-5（按音节分组表导出，27 宿全表）。
# 分组(首音节→值)：
#   1 = a, ka, chh, ḍ, dh, bh, v
#   2 = i, kha, ja, ḍh, n, m, ś/ṣ
#   3 = u, ga, jha, ṭa, pa, ya, sh
#   4 = e, gha, ṭha, tha, pha, ra, sa
#   5 = o, cha, ṭha, da, ba, la, ha
# 逐宿取首音节定值；Ashwini(a)→1 为对照算例硬约束。说明见各行尾注(含取近组的备注)。
_SAYANADI_NAME_VALUE = {
    1:  1,   # Ashwini          a   → 1（对照算例锚点）
    2:  1,   # Bharani          bh  → 1
    3:  1,   # Krittika         ka  → 1
    4:  4,   # Rohini           ra  → 4
    5:  2,   # Mrigashira       m(ri)→ 2
    6:  1,   # Ardra            a   → 1
    7:  3,   # Punarvasu        pa(pu)→ 3
    8:  3,   # Pushya           pa(pu)→ 3
    9:  1,   # Ashlesha         a   → 1
    10: 2,   # Magha            m   → 2
    11: 3,   # Purva Phalguni   pa(pu)→ 3
    12: 3,   # Uttara Phalguni  u   → 3
    13: 5,   # Hasta            ha  → 5
    14: 5,   # Chitra           cha → 5
    15: 4,   # Swati            sa  → 4
    16: 1,   # Vishakha         v   → 1
    17: 1,   # Anuradha         a   → 1
    18: 2,   # Jyeshtha         ja  → 2
    19: 2,   # Mula             m   → 2
    20: 3,   # Purva Ashadha    pa(pu)→ 3
    21: 3,   # Uttara Ashadha   u   → 3
    22: 3,   # Shravana         sh(ra)→ 3
    23: 1,   # Dhanishta        dh  → 1
    24: 3,   # Shatabhisha      sh  → 3
    25: 3,   # Purva Bhadrapada pa(pu)→ 3
    26: 3,   # Uttara Bhadra…   u   → 3
    27: 4,   # Revati           ra(re)→ 4
}

_SAYANADI_ACTIVITY = {
    2: {'key': 'cheshta',   'label': '活跃(全效)'},   # s==2 全力
    1: {'key': 'drishti',   'label': '中等(半效)'},   # s==1 中力
    0: {'key': 'vicheshta', 'label': '微弱(微效)'},   # s==0/3 微力
}


def sayanadi_avastha(nak_index, planet_key, navamsa_index,
                     moon_nak_index, ghati, lagna_sign_index):
    """Sayanadi avastha(活动态，12 态) + 活动质量(Cheshta/Drishti/Vicheshta)。

    index = ((C×P×A)+M+G+L) mod12（0 取 12），见模块顶注 C/P/A/M/G/L 定义。
    活动质量：t = (index² + name_value) mod12；s = (t + planet_adjust) mod3；
      s==2 → Cheshta(全效)；s==1 → Drishti(半效)；s∈{0,3} → Vicheshta(微效)。
    name_value 取本曜 nakshatra 名首音节 1-5（_SAYANADI_NAME_VALUE 全表）。

    参数：
      nak_index        : C，本曜 nakshatra 序 1-27。
      planet_key       : 行星(flatlib const id 或缩写 key，映射到 P 1-9)。
      navamsa_index    : A，本曜在所在星座内 navamsa 序 1-9。
      moon_nak_index   : M，月亮 nakshatra 序 1-27。
      ghati            : G，日出后 ghati 序(>=1)。
      lagna_sign_index : L，上升星座序 1-12。
    任一入参缺失(None) → 返回 None(优雅降级，如极地日出不定时 G=None)。

    返回 {key:'sayanadi', label, index(1-12), stateKey, stateLabel,
          activity, activityLabel} 或 None。
    """
    P = _SAYANADI_PLANET_ORDINAL.get(planet_key)
    if (nak_index is None or P is None or navamsa_index is None
            or moon_nak_index is None or ghati is None
            or lagna_sign_index is None):
        return None
    try:
        C = int(nak_index)
        A = int(navamsa_index)
        M = int(moon_nak_index)
        G = int(ghati)
        L = int(lagna_sign_index)
    except (TypeError, ValueError):
        return None

    raw = (C * P * A) + M + G + L
    index = raw % 12
    if index == 0:
        index = 12
    state = _SAYANADI_STATES[index - 1]

    name_value = _SAYANADI_NAME_VALUE.get(C)
    if name_value is None:
        return None
    t = (index * index + name_value) % 12
    s = (t + _SAYANADI_PLANET_ADJUST[planet_key]) % 3
    activity = _SAYANADI_ACTIVITY[s if s in (1, 2) else 0]  # s∈{0,3}→Vicheshta

    return {
        'key': 'sayanadi',
        'label': '活动态',
        'index': index,
        'stateKey': state['key'],
        'stateLabel': state['label'],
        'activity': activity['key'],
        'activityLabel': activity['label'],
    }
