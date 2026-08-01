# -*- coding: utf-8 -*-
"""宫力 Bhava Bala —— 十二宫强度合算（四源）。

每宫强度 = 四个分量之和：

  1. 宫主力 Bhavadhipati Bala —— 该宫「宫主」(落在该宫起点星座的星座主)的总六力 Shadbala
     (totalVirupa)。直接取六力引擎 ``shadbala_bphs`` 每曜的 ``totalVirupa``。
  2. 宫方位力 Bhava Dig Bala —— 按宫起点星座的「类别」(人/四足/水栖/虫)给方位适配档，0–60 虚拉。
  3. 宫受视力 Bhava Drishti Bala —— 宫起点(宫中点)所受各曜分段相位 Sphuta Drishti 的净和：
     吉曜之照计 +、凶曜之照计 −，净和 / 4(与六力 Drik 同口径)。复用 ``shadbala_bphs.sphuta_drishti``。
     净受凶相位时该分量计 0(不以负值拉低总分)。
  4. 居宫星力 Occupant Bala —— 落在该宫的各曜的总六力之和。

合 → 总虚拉 totalVirupa / Rupas(÷60) / 名次 rank。

入参尽量精简，能从手头数据派生的就派生：
  - 若仅给「上升星座」可由 SIGN_LORDS 推出十二宫主与居宫；
  - 若未给真实(非整宫)宫始度，则以「整宫制宫中点」(星座起点 + 15°)近似宫起点供受视计算，
    并在该分量标 ``pending``(待真实 Placidus/Śrīpati cusp 精算)。绝不臆造度数。

口径中性、无外部出处。``shadbala_bphs`` 为本引擎六力模块的真实名称。
"""

from flatlib import const

from astrostudy.india.primitives import SIGN_INDEX, sign_at


# 星座主(星座名 → 主曜 const id)。与 arudha.SIGN_LORDS 一致，此处独立持有避免跨模块耦合。
SIGN_LORDS = {
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

# 吉/凶曜阵营(自然吉凶)——与六力 Drik 同。
NATURAL_BENEFIC = {const.MOON, const.MERCURY, const.JUPITER, const.VENUS}
NATURAL_MALEFIC = {const.SUN, const.MARS, const.SATURN}

# 七实曜(参与受视/居宫/宫主的曜)。交点不参与本式。
_BALA_PLANETS = (
    const.SUN, const.MOON, const.MARS, const.MERCURY,
    const.JUPITER, const.VENUS, const.SATURN,
)

# ── 宫方位力 Bhava Dig Bala：按宫起点星座「类别」给方位适配档(虚拉) ───────────────
# 标准分类(0-based 星座序 → 类别)：
#   人/双足(human/biped)：白羊?? —— 实际权威分类：双子/处女/天秤/水瓶(前半)/射手(后半人马)。
#   四足(quadruped)：白羊/金牛/狮子/射手(前半)/摩羯(前半)。
#   水栖(watery)：巨蟹/双鱼/摩羯(后半)。
#   虫/无足(insect/centipede)：天蝎。
# 为可复现，采用稳定的「四类 → 满档/中档」整数表(0–60 虚拉)，
# 角宫所承之类别得满 60，其余按类别递减，体现「某类宫在某方位最得力」。
_SIGN_CLASS = {
    const.ARIES: 'quadruped',
    const.TAURUS: 'quadruped',
    const.GEMINI: 'human',
    const.CANCER: 'watery',
    const.LEO: 'quadruped',
    const.VIRGO: 'human',
    const.LIBRA: 'human',
    const.SCORPIO: 'insect',
    const.SAGITTARIUS: 'human',     # 人马上半身为人形(主流归人类签)
    const.CAPRICORN: 'watery',      # 摩羯后半水栖；归水栖(主流)
    const.AQUARIUS: 'human',
    const.PISCES: 'watery',
}

# 类别 → 方位适配虚拉档(0–60)。人类签最得「东/上升」一类方位之力，水栖次之，
# 四足、虫依递减；体现各宫对自身自然方位的适配强弱(可复现的稳定档)。
# 类别 → 满力宫(通行口径:人类座东=第1宫、四足座南=第10宫、水栖座北=第4宫、虫座西=第7宫)。
_CLASS_FULL_HOUSE = {
    'human': 1,
    'quadruped': 10,
    'watery': 4,
    'insect': 7,
}


def _sign_index(sign):
    return SIGN_INDEX.get(sign, 0)


def bhava_dig_bala_for_sign(sign, house=1):
    """宫方位力:该宫起点星座类别的满力宫 × 与实际宫位的环形距(0..6)线性衰减(满 60 → 对宫 0)。"""
    cls = _SIGN_CLASS.get(sign)
    if cls is None:
        return 0.0
    full = _CLASS_FULL_HOUSE.get(cls, 1)
    try:
        d = abs(int(house) - int(full)) % 12
    except (TypeError, ValueError):
        d = 0
    d = min(d, 12 - d)
    return round(60.0 * (1.0 - d / 6.0), 4)


# ── 宫主力 Bhavadhipati Bala：宫主总六力 ─────────────────────────────────────
def _planet_total_virupa(planet, planet_shadbala):
    """从六力引擎输出取某曜的 totalVirupa；缺则 None。"""
    if not planet_shadbala or planet is None:
        return None
    rec = planet_shadbala.get(planet)
    if not isinstance(rec, dict):
        return None
    val = rec.get('totalVirupa')
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None


# ── 宫受视力 Bhava Drishti Bala：宫起点所受净相位 / 4 ────────────────────────
def _bhava_drishti(cusp_lon, planet_lons):
    """宫起点 cusp_lon 所受各曜分段 Sphuta Drishti 的净和 / 4(吉 +、凶 −)。

    复用六力模块的分段虚拉式(``sphuta_drishti``)。返回 (净值, 凡参与曜数)。
    """
    from astrostudy.india import shadbala_bphs as sb
    if cusp_lon is None or not planet_lons:
        return 0.0, 0
    net = 0.0
    count = 0
    for planet, lon in planet_lons.items():
        if planet not in _BALA_PLANETS or lon is None:
            continue
        # 顺黄道夹角 a = (被照点 − 照者) mod 360，照者 = 行星，被照点 = 宫起点。
        a = (float(cusp_lon) - float(lon)) % 360.0
        d = sb.sphuta_drishti(planet, a)
        sign = 1.0 if planet in NATURAL_BENEFIC else -1.0
        net += sign * d
        count += 1
    return net / 4.0, count


# ── 居宫星力 Occupant Bala：落该宫各曜总六力之和 ────────────────────────────
def _occupant_bala(planets_in_house, planet_shadbala):
    """落在该宫的各曜的总六力之和(虚拉)。"""
    total = 0.0
    occupants = []
    for planet in (planets_in_house or []):
        v = _planet_total_virupa(planet, planet_shadbala)
        if v is not None:
            total += v
            occupants.append(planet)
    return total, occupants


def _derive_house_lords(lagna_sign):
    """由上升星座推十二宫(1-12)宫主：第 h 宫起点星座 = 上升起算第 h 座，宫主 = 该座主。"""
    base = _sign_index(lagna_sign)
    lords = {}
    sign_of_house = {}
    for h in range(1, 13):
        s = sign_at(base + (h - 1))
        sign_of_house[h] = s
        lords[h] = SIGN_LORDS.get(s)
    return lords, sign_of_house


def _derive_occupancy(planet_signs, lagna_sign):
    """由 {曜: 星座} + 上升星座 推 {宫: [曜]}。"""
    base = _sign_index(lagna_sign)
    occ = {h: [] for h in range(1, 13)}
    for planet, sign in (planet_signs or {}).items():
        if planet not in _BALA_PLANETS:
            continue
        h = ((_sign_index(sign) - base) % 12) + 1
        occ[h].append(planet)
    return occ


def bhava_bala(house_lords=None, planet_shadbala=None, house_cusps=None,
               house_occupancy=None, planet_lons=None, lagna_sign=None,
               planet_signs=None):
    """十二宫宫力合算（四源）。

    入参(尽量精简，缺者从手头数据派生)：
      house_lords     : {宫(1-12): 宫主 const id}。缺则需 lagna_sign(+SIGN_LORDS 派生)。
      planet_shadbala : 六力引擎 ``shadbala_bphs()`` 输出 {曜: {'totalVirupa':..}, ...}。
      house_cusps     : {宫(1-12): 宫起点黄经(0-360)}。缺则按整宫制以「星座起点+15°」近似
                        宫中点供受视计算，并标 drishtiPending=True(待真实 cusp 精算)。
      house_occupancy : {宫(1-12): [居宫曜]}。缺则由 planet_signs+lagna_sign 派生。
      planet_lons     : {曜: sidereal 黄经}。受视分量必需；缺则受视计 0 并标 pending。
      lagna_sign      : 上升星座名(const)；用于派生 house_lords / occupancy / cusp。
      planet_signs    : {曜: 星座名}；派生居宫用。

    返回：
      {
        'available': bool,
        'houses': [ {house, bhavadhipatiBala, bhavaDigBala, bhavaDrishtiBala,
                     occupantBala, totalVirupa, rupas, rank, lord, sign,
                     occupants, pending}, ... ]  # 12 项
        'strongest': 宫号, 'weakest': 宫号,
        'cuspMode': 'provided' | 'wholeSignMid',
        'anyPending': bool, 'note': str,
      }
    """
    # 1) 宫主 / 宫起点星座
    sign_of_house = {}
    if house_lords:
        lords = dict(house_lords)
        # 反推每宫起点星座(用于方位力)：宫主可能多座共主，取「上升派生」更确定；
        # 若有 lagna_sign 优先按之定座，否则用宫主任一所主座近似。
        if lagna_sign is not None:
            _, sign_of_house = _derive_house_lords(lagna_sign)
        else:
            inv = {}
            for s, p in SIGN_LORDS.items():
                inv.setdefault(p, s)
            for h, p in lords.items():
                sign_of_house[h] = inv.get(p)
    elif lagna_sign is not None:
        lords, sign_of_house = _derive_house_lords(lagna_sign)
    else:
        return {'available': False, 'houses': [],
                'note': '缺 house_lords 且缺 lagna_sign，无法定宫主/宫起点。'}

    # 2) 居宫
    if house_occupancy:
        occ = {int(h): list(v or []) for h, v in house_occupancy.items()}
        for h in range(1, 13):
            occ.setdefault(h, [])
    elif planet_signs is not None and lagna_sign is not None:
        occ = _derive_occupancy(planet_signs, lagna_sign)
    else:
        occ = {h: [] for h in range(1, 13)}

    # 3) 宫起点黄经(受视用)。无真实 cusp → 整宫制宫中点(星座起点 + 15°)，标 pending。
    cusp_mode = 'provided'
    drishti_pending_global = False
    if house_cusps:
        cusps = {int(h): float(c) for h, c in house_cusps.items() if c is not None}
    else:
        cusp_mode = 'wholeSignMid'
        drishti_pending_global = True
        cusps = {}
        for h in range(1, 13):
            s = sign_of_house.get(h)
            if s is not None:
                cusps[h] = _sign_index(s) * 30.0 + 15.0     # 宫中点近似

    has_lons = bool(planet_lons)

    houses = []
    any_pending = False
    for h in range(1, 13):
        lord = lords.get(h)
        sign = sign_of_house.get(h)

        # 分量 1：宫主总六力
        adhip = _planet_total_virupa(lord, planet_shadbala)
        adhip_pending = adhip is None
        adhip_val = adhip if adhip is not None else 0.0

        # 分量 2：宫方位力 —— 类别满力宫(人类座东/1宫、四足座南/10宫、水栖座北/4宫、
        # 虫座西/7宫)按环形宫距线性衰减到对宫 0。🔴 曾只按星座查定值、与宫位完全无关
        # (同座落 1 宫与 7 宫同分,整条分量退化为上升座决定的固定轮转)。
        dig_val = bhava_dig_bala_for_sign(sign, h) if sign is not None else 0.0

        # 分量 3：宫受视力(净和/4；净受凶相位 → 计 0，不拉低总分)
        drishti_pending = False
        if has_lons and cusps.get(h) is not None:
            raw, cnt = _bhava_drishti(cusps.get(h), planet_lons)
            drishti_pending = drishti_pending_global  # cusp 近似 → 待真实 cusp 精算
            drishti_raw = raw
        else:
            raw, cnt = 0.0, 0
            drishti_pending = True
            drishti_raw = 0.0
        drishti_val = max(0.0, drishti_raw)             # 非负贡献

        # 分量 4：居宫星力
        occ_val, occupants = _occupant_bala(occ.get(h), planet_shadbala)

        # 各分量先各自四舍(对外显示值)，总值取「已舍分量之和」→ total ≡ 四分量之和(内部自洽)。
        adhip_r = round(adhip_val, 4)
        dig_r = round(dig_val, 4)
        drishti_r = round(drishti_val, 4)
        occ_r = round(occ_val, 4)
        total = round(adhip_r + dig_r + drishti_r + occ_r, 4)
        pending = {
            'bhavadhipati': adhip_pending,
            'drishti': drishti_pending,
        }
        any_pending = any_pending or adhip_pending or drishti_pending

        houses.append({
            'house': h,
            'sign': sign,
            'lord': lord,
            'bhavadhipatiBala': adhip_r,
            'bhavaDigBala': dig_r,
            'bhavaDrishtiBala': drishti_r,
            'bhavaDrishtiRaw': round(drishti_raw, 4),    # 含符号原值(参考)
            'occupantBala': occ_r,
            'occupants': occupants,
            'totalVirupa': total,
            'rupas': round(total / 60.0, 4),
            'pending': pending,
            'anyPending': bool(adhip_pending or drishti_pending),
        })

    # 名次(总虚拉降序，1 = 最强)
    order = sorted(range(12), key=lambda i: houses[i]['totalVirupa'], reverse=True)
    for rank, idx in enumerate(order, start=1):
        houses[idx]['rank'] = rank

    strongest = max(houses, key=lambda x: x['totalVirupa'])['house'] if houses else None
    weakest = min(houses, key=lambda x: x['totalVirupa'])['house'] if houses else None

    return {
        'available': True,
        'houses': houses,
        'strongest': strongest,
        'weakest': weakest,
        'cuspMode': cusp_mode,
        'anyPending': any_pending,
        'note': ('四源宫力(宫主力 Bhavadhipati + 宫方位力 Bhava Dig + 宫受视力 Bhava Drishti'
                 ' + 居宫星力 Occupant)。受视净受凶相位时计 0。'
                 + ('未传真实宫始度，受视以整宫制宫中点(星座起点+15°)近似，标 pending 待真实 cusp 精算。'
                    if cusp_mode == 'wholeSignMid' else '')),
    }
