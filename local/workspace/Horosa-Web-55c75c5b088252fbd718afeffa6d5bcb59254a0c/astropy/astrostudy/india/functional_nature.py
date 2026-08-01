# -*- coding: utf-8 -*-
"""
吠陀占星 — 按命宫(lagna)判星曜功能吉凶(functional nature by lagna)。

思路：行星的「自然吉凶」(natural benefic/malefic)是固定的，但落到某一具体
命盘时，真正起作用的是它「主管哪几宫」——同一行星对甲命宫是大吉(瑜伽卡拉卡)，
对乙命宫却可能是凶星。本模块只做「按命宫推功能吉凶」这一件纯函数计算：

  输入：命宫星座 + (可选)各行星落座
  输出：9 曜各自的 自然吉凶 / 主管宫位 / 功能吉凶 / 是否瑜伽卡拉卡 / 是否马拉卡 / 是否障碍星(badhaka) / 判据说明

不依赖星历，不读盘，便于 jyotish_engine 直接以 self.d1_asc.sign 调用。

宫位类别(以命宫为第 1 宫)：
  角宫 kendra    = {1,4,7,10}
  三角宫 trikona = {1,5,9}
  成长宫 upachaya= {3,6,10,11}(其中第 10 宫另有角宫身份，故第 10 宫不按纯成长宫定凶)
  凶舍 dusthana  = {6,8,12}
  马拉卡 maraka  = {2,7}
"""

from flatlib import const

# ════════════════════════════════════════════════════════════════════════
# 0. 星座主星 / 中文标签
# ════════════════════════════════════════════════════════════════════════

# 星座→主星。与 jyotish_engine.OWN_SIGNS 反推一致(此处直列，避免循环依赖)。
SIGN_RULER = {
    const.ARIES: const.MARS,
    const.TAURUS: const.VENUS,
    const.GEMINI: const.MERCURY,
    const.CANCER: const.MOON,
    const.LEO: const.SUN,
    const.VIRGO: const.MERCURY,
    const.LIBRA: const.VENUS,
    const.SCORPIO: const.MARS,
    const.SAGITTARIUS: const.JUPITER,
    const.CAPRICORN: const.SATURN,
    const.AQUARIUS: const.SATURN,
    const.PISCES: const.JUPITER,
}

SIGN_ORDER = [
    const.ARIES, const.TAURUS, const.GEMINI, const.CANCER,
    const.LEO, const.VIRGO, const.LIBRA, const.SCORPIO,
    const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES,
]

# 9 曜固定顺序(与 jyotish_engine.JYOTISH_PLANETS 对齐)。
GRAHAS = [
    const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
    const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE,
]

# 节点(罗睺/计都)不持星座单主。
NODES = (const.NORTH_NODE, const.SOUTH_NODE)

PLANET_CN = {
    const.SUN: '太阳', const.MOON: '月亮', const.MARS: '火星',
    const.MERCURY: '水星', const.JUPITER: '木星', const.VENUS: '金星',
    const.SATURN: '土星', const.NORTH_NODE: '罗睺', const.SOUTH_NODE: '计都',
}

# 自然吉凶(默认；水星按吉、月亮按吉，详见 _natural_nature)。
_NATURAL_BENEFIC = (const.JUPITER, const.VENUS, const.MERCURY, const.MOON)
_NATURAL_MALEFIC = (const.SATURN, const.MARS, const.SUN)

# ════════════════════════════════════════════════════════════════════════
# 1. 宫位类别
# ════════════════════════════════════════════════════════════════════════

KENDRA = frozenset({1, 4, 7, 10})       # 角宫
TRIKONA = frozenset({1, 5, 9})          # 三角宫
# 纯角宫(角而非三角)：第 1 宫既角又三角，按命主处理，故不入「纯角宫致中性」集。
KENDRA_ONLY = frozenset({4, 7, 10})
UPACHAYA = frozenset({3, 6, 10, 11})    # 成长宫
# 第 10 宫虽列成长宫，但其角宫身份优先，定功能吉凶时不按纯成长宫致凶。
UPACHAYA_MALEFIC = frozenset({3, 6, 11})
DUSTHANA = frozenset({6, 8, 12})        # 凶舍
MARAKA = frozenset({2, 7})              # 马拉卡(夺命)宫


def _natural_nature(planet):
    """行星自然吉凶。节点按凶处理(罗睺/计都被视作隐性凶曜)。"""
    if planet in NODES:
        return 'malefic'
    if planet in _NATURAL_BENEFIC:
        return 'benefic'
    return 'malefic'


# ════════════════════════════════════════════════════════════════════════
# 2. 主管宫位
# ════════════════════════════════════════════════════════════════════════

def _house_of_sign(lagna_sign, sign):
    """该星座相对命宫是第几宫(命宫=第 1 宫)。"""
    i_lag = SIGN_ORDER.index(lagna_sign)
    i_sig = SIGN_ORDER.index(sign)
    return ((i_sig - i_lag) % 12) + 1


def _houses_ruled(lagna_sign, planet):
    """该行星(以星座主星身份)主管哪几宫。节点返回 []。日/月各 1 宫，五星各 2 宫。"""
    if planet in NODES:
        return []
    houses = []
    for sign, ruler in SIGN_RULER.items():
        if ruler == planet:
            houses.append(_house_of_sign(lagna_sign, sign))
    return sorted(houses)


# ════════════════════════════════════════════════════════════════════════
# 3. 单宫定性 + 优先级合成
# ════════════════════════════════════════════════════════════════════════
#
# 优先级(数字越小越优先)——用于五星「双宫主」一吉一凶时取舍，也用于挑选
# 整体功能吉凶的代表类别：
#   0 yogakaraka       (同时主角宫 4/7/10 与三角宫 1/5/9 —— 最强吉)
#   1 lagna-lord       (命主第 1 宫 —— 恒吉，凌驾自然凶性)
#   2 trikona-benefic  (主三角宫 5/9 —— 吉)
#   3 dusthana-malefic (主凶舍 6/8/12 —— 凶)
#   4 upachaya-malefic (主成长宫 3/6/11 —— 凶，连自然吉星亦然)
#   5 kendra-neutral   (自然吉星主纯角宫 4/7/10 —— 角宫主缺陷致中性)
#   6 maraka/2-8-12-neutral (仅主 2/8/12 —— 中性)
#
# 注：同一宫可同时落入多类(如第 6 宫既凶舍又成长宫)，按上表优先级取最优先者作
# 该宫的「类别标签」；五星两宫各得一标签后，再按优先级合成最终功能吉凶。

_PRECEDENCE = {
    'yogakaraka': 0,
    'lagna-lord-benefic': 1,
    'trikona-benefic': 2,
    'dusthana-malefic': 3,
    'upachaya-malefic': 4,
    'kendra-neutral': 5,
    'maraka-neutral': 6,
    'neutral': 6,
}

# 类别→功能吉凶基色。
_CLASS_TO_NATURE = {
    'yogakaraka': 'yogakaraka',
    'lagna-lord-benefic': 'benefic',
    'trikona-benefic': 'benefic',
    'dusthana-malefic': 'malefic',
    'upachaya-malefic': 'malefic',
    'kendra-neutral': 'neutral',
    'maraka-neutral': 'neutral',
    'neutral': 'neutral',
}

_CLASS_CN = {
    'yogakaraka': '瑜伽卡拉卡(角宫+三角宫双主，最强吉)',
    'lagna-lord-benefic': '命主(第1宫主)，恒吉',
    'trikona-benefic': '三角宫主，吉',
    'dusthana-malefic': '凶舍主，凶',
    'upachaya-malefic': '成长宫主，凶',
    'kendra-neutral': '角宫主缺陷(自然吉星主纯角宫)，中性',
    'maraka-neutral': '仅主2/8/12，中性',
    'neutral': '中性',
}


def _classify_house(house, natural):
    """单个被主管宫位的类别标签。house: 宫号；natural: 该行星自然吉凶。"""
    is_kendra_only = house in KENDRA_ONLY
    is_trikona = house in TRIKONA

    # 命主(第 1 宫)——恒吉。
    if house == 1:
        return 'lagna-lord-benefic'
    # 三角宫(5/9)——吉。
    if is_trikona:
        return 'trikona-benefic'
    # 凶舍(6/8/12)——凶。
    if house in DUSTHANA:
        return 'dusthana-malefic'
    # 成长宫(3/6/11，第 10 宫除外)——凶，连自然吉星亦然。
    if house in UPACHAYA_MALEFIC:
        return 'upachaya-malefic'
    # 纯角宫(4/7/10)：自然吉星→角宫主缺陷致中性；自然凶星→失凶性亦中性。
    if is_kendra_only:
        return 'kendra-neutral'
    # 仅余 2/8/12 中的 2 与 8 之外的角色，及第 2 宫：归中性。
    return 'maraka-neutral'


def _combine(labels):
    """多宫类别标签按优先级取最优先者作代表(并保留是否「混合」信息由调用方判断)。"""
    if not labels:
        return 'neutral'
    return min(labels, key=lambda lb: _PRECEDENCE.get(lb, 99))


# ════════════════════════════════════════════════════════════════════════
# 4. badhaka(障碍星)
# ════════════════════════════════════════════════════════════════════════
#
# 活动宫(movable，cardinal)命宫：白羊/巨蟹/天秤/摩羯 → 障碍宫=第 11 宫
# 固定宫(fixed)命宫：     金牛/狮子/天蝎/水瓶 → 障碍宫=第 9 宫
# 变动宫(dual/mutable)命宫：双子/处女/射手/双鱼 → 障碍宫=第 7 宫
# 障碍宫之主星即 badhaka(障碍星)。

_MOVABLE = frozenset({const.ARIES, const.CANCER, const.LIBRA, const.CAPRICORN})
_FIXED = frozenset({const.TAURUS, const.LEO, const.SCORPIO, const.AQUARIUS})
_DUAL = frozenset({const.GEMINI, const.VIRGO, const.SAGITTARIUS, const.PISCES})


def _badhaka_house(lagna_sign):
    if lagna_sign in _MOVABLE:
        return 11
    if lagna_sign in _FIXED:
        return 9
    return 7  # dual


def _sign_at_house(lagna_sign, house):
    i_lag = SIGN_ORDER.index(lagna_sign)
    return SIGN_ORDER[(i_lag + house - 1) % 12]


def _badhaka_lord(lagna_sign):
    """障碍星 = 障碍宫所在星座之主星。"""
    bh = _badhaka_house(lagna_sign)
    bsign = _sign_at_house(lagna_sign, bh)
    return SIGN_RULER[bsign], bh


# ════════════════════════════════════════════════════════════════════════
# 5. 节点(罗睺/计都)功能吉凶
# ════════════════════════════════════════════════════════════════════════
#
# 节点不持星座单主，故无 housesRuled。其功能吉凶常依「落宫」与「合主之宫主」论；
# 在不传 planet_signs 时无从判落宫，统一返回 'neutral'(并在 reason 注明)。
# 传入 planet_signs 时，按所落宫的类别给出倾向(吉舍→吉、凶舍→凶、余中性)，
# 作为参考(节点本质随合相/会主而变，此处只给落宫提示)。

def _node_nature(lagna_sign, planet, planet_signs):
    if not planet_signs or planet not in planet_signs:
        return 'neutral', '节点无星座主管；未提供落座，按中性论(实际随落宫与会主之宫主而变)'
    sign = planet_signs.get(planet)
    if sign not in SIGN_ORDER:
        return 'neutral', '节点无星座主管；落座未知，按中性论'
    house = _house_of_sign(lagna_sign, sign)
    cn = PLANET_CN.get(planet, planet)
    if house in TRIKONA:
        return 'benefic', '%s落第%d宫(三角宫)，偏吉(参考；节点功能随会主而变)' % (cn, house)
    if house in DUSTHANA:
        return 'malefic', '%s落第%d宫(凶舍)，偏凶(参考；节点功能随会主而变)' % (cn, house)
    return 'neutral', '%s落第%d宫，按中性论(参考；节点功能随会主而变)' % (cn, house)


# ════════════════════════════════════════════════════════════════════════
# 6. 主入口
# ════════════════════════════════════════════════════════════════════════

def functional_nature(lagna_sign, planet_signs=None):
    """
    按命宫推 9 曜功能吉凶。

    Args:
        lagna_sign:   命宫星座名(flatlib const，'Aries'..'Pisces')。
        planet_signs: 可选，{planet_id: sign_name}；仅用于节点(罗睺/计都)落宫提示。
                      其余行星的功能吉凶仅由命宫决定，不需要落座。

    Returns:
        list[dict]，9 曜各一项，字段：
          planet            行星 id(const)
          planetLabel       中文名
          naturalNature     'benefic'|'malefic'|'neutral'
          housesRuled       [int...]  主管宫位(日/月 1 宫；五星 2 宫；节点 [])
          functionalNature  'benefic'|'malefic'|'neutral'|'yogakaraka'|'maraka'
          isYogakaraka      bool
          isMaraka          bool
          isBadhaka         bool
          reason            中文判据说明
    """
    if lagna_sign not in SIGN_ORDER:
        raise ValueError('unknown lagna sign: %r' % (lagna_sign,))

    badhaka_planet, badhaka_house = _badhaka_lord(lagna_sign)

    out = []
    for planet in GRAHAS:
        cn = PLANET_CN.get(planet, planet)
        natural = _natural_nature(planet)
        houses = _houses_ruled(lagna_sign, planet)

        # ── 节点：无主管宫，单独处理 ──────────────────────────────
        if planet in NODES:
            fn, reason = _node_nature(lagna_sign, planet, planet_signs)
            # 节点亦可因主管障碍宫而为 badhaka(Aq 命主之一为罗睺等)，
            # 但其无星座单主，故 badhaka 仅落在持单主之星上；此处节点 isBadhaka=False。
            out.append({
                'planet': planet,
                'planetLabel': cn,
                'naturalNature': natural,
                'housesRuled': [],
                'functionalNature': fn,
                'isYogakaraka': False,
                'isMaraka': False,
                'isBadhaka': False,
                'reason': reason,
            })
            continue

        # ── 日/月/五星：由主管宫位定功能吉凶 ───────────────────────
        labels = [_classify_house(h, natural) for h in houses]
        rep = _combine(labels)

        is_lagna_lord = (1 in houses)
        rules_kendra_only = any(h in KENDRA_ONLY for h in houses)
        # 瑜伽卡拉卡判据的三角侧剔除第 1 宫(第 1 宫既角又三角,不剔则「主 1 宫 +
        # 主纯角宫」的四个变动命宫命主被误判;通行口径仅 6 命宫有 Yogakaraka,
        # 与 yoga_engine 同判据收敛)。
        rules_trikona = any(h in (5, 9) for h in houses)
        is_yogakaraka = rules_kendra_only and rules_trikona

        # 马拉卡 = 主第 2 或第 7 宫，且非命主。
        is_maraka = (2 in houses or 7 in houses) and not is_lagna_lord

        is_badhaka = (planet == badhaka_planet)

        # 功能吉凶基色。
        if is_yogakaraka:
            functional = 'yogakaraka'
        else:
            functional = _CLASS_TO_NATURE.get(rep, 'neutral')

        # ── reason 组装 ────────────────────────────────────────────
        house_strs = []
        for h in houses:
            lbl = _classify_house(h, natural)
            house_strs.append('第%d宫(%s)' % (h, _short_class_cn(lbl)))
        natural_cn = {'benefic': '自然吉星', 'malefic': '自然凶星', 'neutral': '自然中性'}[natural]

        parts = ['%s：%s' % (cn, natural_cn)]
        if houses:
            parts.append('主管 ' + '、'.join(house_strs))
        else:
            parts.append('不主管任何宫')

        if is_yogakaraka:
            parts.append('→ 同主角宫与三角宫 ⇒ 瑜伽卡拉卡(最强吉)')
        elif is_lagna_lord:
            parts.append('→ 命主(第1宫) ⇒ 恒吉')
        elif len(labels) == 2 and len(set(_CLASS_TO_NATURE.get(l) for l in labels)) > 1:
            # 双宫一吉一凶 → 按优先级取代表，标注为混合。
            parts.append('→ 双宫吉凶相杂，按优先级取「%s」⇒ %s'
                         % (_short_class_cn(rep), _nature_cn(functional)))
        else:
            parts.append('→ %s' % _nature_cn(functional))

        extras = []
        if is_maraka:
            extras.append('马拉卡(主2/7夺命宫)')
        if is_badhaka:
            extras.append('障碍星(第%d宫主)' % badhaka_house)
        if extras:
            parts.append('；亦为 ' + '、'.join(extras))

        out.append({
            'planet': planet,
            'planetLabel': cn,
            'naturalNature': natural,
            'housesRuled': houses,
            'functionalNature': functional,
            'isYogakaraka': is_yogakaraka,
            'isMaraka': is_maraka,
            'isBadhaka': is_badhaka,
            'reason': ' '.join(parts),
        })

    return out


def _short_class_cn(label):
    m = {
        'yogakaraka': '角+三角',
        'lagna-lord-benefic': '命主吉',
        'trikona-benefic': '三角吉',
        'dusthana-malefic': '凶舍凶',
        'upachaya-malefic': '成长凶',
        'kendra-neutral': '角宫中性',
        'maraka-neutral': '中性',
        'neutral': '中性',
    }
    return m.get(label, '中性')


def _nature_cn(nature):
    return {'benefic': '吉', 'malefic': '凶', 'neutral': '中性',
            'yogakaraka': '瑜伽卡拉卡', 'maraka': '马拉卡'}.get(nature, nature)


# ════════════════════════════════════════════════════════════════════════
# 7. 便捷：瑜伽卡拉卡查询(用于校验十二命宫表)
# ════════════════════════════════════════════════════════════════════════

def yogakaraka_for(lagna_sign):
    """返回该命宫的瑜伽卡拉卡行星 id；无单一瑜伽卡拉卡(白羊/天蝎)返回 None。"""
    for row in functional_nature(lagna_sign):
        if row['isYogakaraka']:
            return row['planet']
    return None
