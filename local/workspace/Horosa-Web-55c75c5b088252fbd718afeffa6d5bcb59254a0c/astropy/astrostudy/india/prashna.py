# -*- coding: utf-8 -*-
"""Praśna 问事全家族纯函数层(权威 §12.7 / §25.1 / §25.2)。

本模块**零星历、零盘构建**:上升反解求根接受注入的 `asc_fn(jd)`(由服务层用
`kernel.chart._siderealContext()` + `fswe.sweHousesLon` 供给,岁差口径与本命 KP CSL
同一调用,绝不手工加减 ayanamsa);其余全为「给定经度/宫始/主星 → 判决」的确定性
函数。服务层(webindiasrv._compute_prashna)只做装配。

要点与歧义处置(逐条对台账):
  · A2:问数「段对应经度」取**中点** —— 段首会让 Asc 恰落 sub 边界,浮点下
    kp_subdivide 可能翻到前一 sub,破坏最强不变量 CSL(house1).subLord==问数子主。
  · KP 框架强制(§12.8-1):KP Ayanamsa + Placidus,与页面岁差选择解耦,回显供 UI 提示。
  · 宫归属:cusp 是宫**起点**非中点,自算 house_of_lon;宫主按 **cusp 落座**定
    (ownHousesBasis='cusp',KP 标准;本命 kp() 的整宫偏移口径保持不动)。
  · A3:节点代理「合相」= **同座**(权威未给容许度,不臆造)。
  · A4:多宫宫组的主判宫头默认 财11/事业10/外出9,UI 可手改。
  · A6:应期不做 RP∩/∪ 二值判定(权威未定义),改逐级打分排序取 top-K。
  · 婚组独有 negation 1/6/10(§12.5 例文);其余组**不臆造 negation**。
"""
from __future__ import annotations

from datetime import datetime, timedelta

from astrostudy.india.kp_system import (
    kp_249_table, kp_subdivide, kp_levels, cuspal_sublords, significators,
    DASHA_ORDER, DASHA_YEARS, DASHA_TOTAL, SIGN_LORDS)

# ── 键名统一:chart 对象用 'North Node'/'South Node',KP 表用 'Rahu'/'Ketu' ──
NODE_KEY_MAP = {'North Node': 'Rahu', 'South Node': 'Ketu'}
NODE_KEY_MAP_REV = {v: k for k, v in NODE_KEY_MAP.items()}
NINE_KEYS = tuple(DASHA_ORDER)     # KP 九曜字符串键(含 Rahu/Ketu)


def to_kp_key(planet_id):
    return NODE_KEY_MAP.get(planet_id, planet_id)


# ── 问数 → 上升目标经度 ──────────────────────────────────────────────────
_KP_TABLE_CACHE = None


def _table():
    global _KP_TABLE_CACHE
    if _KP_TABLE_CACHE is None:
        _KP_TABLE_CACHE = kp_249_table()
    return _KP_TABLE_CACHE


def horary_segment(number):
    """问数 1..249 → 249 段表行(非法问数返回 None,不抛)。"""
    try:
        n = int(number)
    except (TypeError, ValueError):
        return None
    if not 1 <= n <= 249:
        return None
    return _table()[n - 1]


def horary_target_lon(number):
    """问数 → 上升目标经度 = 段**中点**(A2:保 CSL(1)==问数子主不变量 + 浮点安全)。"""
    seg = horary_segment(number)
    if seg is None:
        return None
    return (float(seg['startLon']) + float(seg['endLon'])) / 2.0


# ── 上升反解(注入式求根,纯函数可测)────────────────────────────────────
SIDEREAL_DAY = 0.9972695663               # 恒星日(日);Asc 对 jd 的周期


def _wrap180(x):
    return (float(x) + 180.0) % 360.0 - 180.0


def solve_asc_jd(asc_fn, target_lon, jd_center, window_days=None, coarse_n=96, iters=60):
    """在 jd_center ±½ 恒星日窗口内解 asc_fn(jd) == target_lon。

    asc_fn: jd → 恒星上升经度(或 None=该刻求值失败,如极区)。
    粗扫找 f(jd)=wrap180(asc−target) 变号区间 → 二分。非极区 Asc 关于 jd 单调
    (周期 ≈0.99727 日),窗口内必有且仅有一根。返回 (jd, err_deg) 或 (None, None)。
    """
    if target_lon is None:
        return None, None
    half = (window_days if window_days is not None else SIDEREAL_DAY / 2.0)
    lo, hi = jd_center - half, jd_center + half

    def f(jd):
        a = asc_fn(jd)
        return None if a is None else _wrap180(a - target_lon)

    prev_jd, prev_v = None, None
    bracket = None
    for i in range(coarse_n + 1):
        jd = lo + (hi - lo) * i / coarse_n
        v = f(jd)
        if v is None:
            prev_jd, prev_v = None, None
            continue
        if abs(v) < 1e-9:
            return jd, 0.0
        if prev_v is not None and (prev_v < 0) != (v < 0) and abs(v - prev_v) < 180.0:
            bracket = (prev_jd, jd, prev_v, v)
            break
        prev_jd, prev_v = jd, v
    if bracket is None:
        return None, None
    a, b, fa, fb = bracket
    for _ in range(iters):
        m = (a + b) / 2.0
        fm = f(m)
        if fm is None:
            return None, None
        if abs(fm) < 1e-7:
            return m, abs(fm)
        if (fa < 0) != (fm < 0):
            b, fb = m, fm
        else:
            a, fa = m, fm
    m = (a + b) / 2.0
    fm = f(m)
    return (m, abs(fm)) if fm is not None else (None, None)


# ── 宫几何(KP cusp 是宫起点)────────────────────────────────────────────
def house_of_lon(lon, cusps):
    """经度 → 宫号 1..12。cusps = 12 个宫**起点**经度(宫 1..12 序)。
    第 i 宫区间 = [cusp_i, cusp_{i+1})(顺黄道,模 360)。"""
    if lon is None or not cusps or len(cusps) < 12:
        return None
    v = float(lon) % 360.0
    for i in range(12):
        a = float(cusps[i]) % 360.0
        b = float(cusps[(i + 1) % 12]) % 360.0
        if a <= b:
            if a <= v < b:
                return i + 1
        else:                                  # 跨 0°
            if v >= a or v < b:
                return i + 1
    return None


def own_houses_by_cusp(cusps):
    """KP 标准宫主:按**宫始落座**之主定其所主之宫 → {planet_key: [houses]}。
    (本命 kp() 用整宫偏移口径,保持不动;问时侧显式标 ownHousesBasis='cusp'。)"""
    out = {k: [] for k in NINE_KEYS}
    if not cusps or len(cusps) < 12:
        return out
    for i in range(12):
        sign_no = int((float(cusps[i]) % 360.0) // 30.0) + 1          # 1..12
        lord = SIGN_LORDS[sign_no - 1]
        out.setdefault(lord, []).append(i + 1)
    return out


def node_proxy_houses(node_key, same_sign_planets, node_sign_lord, node_star_lord,
                      houses_by_planet):
    """节点代理(§12.8-4):合相星(=同座,A3)> 座主 > 宿主,取**第一个非空**之所司。
    houses_by_planet: {planet: set(houses)}(该星所占+所主)。返回 (来源标记, 宫集)。"""
    for src, cands in (('conjunct', same_sign_planets),
                       ('signLord', [node_sign_lord] if node_sign_lord else []),
                       ('starLord', [node_star_lord] if node_star_lord else [])):
        got = set()
        for c in cands:
            got |= set(houses_by_planet.get(c) or ())
        if got:
            return src, sorted(got)
    return None, []


# ── 事项宫组(§12.5 逐字;A4 主判宫头默认;婚组独有 negation)──────────────
PRASHNA_HOUSE_GROUPS = {
    'marriage': {'label': '婚姻', 'houses': (2, 7, 11), 'primary': 7,
                 'negation': (1, 6, 10)},          # §12.5 例文:指示 1/6/10 则不利结合
    'wealth': {'label': '财务', 'houses': (2, 6, 10, 11), 'primary': 11, 'negation': ()},
    'children': {'label': '子女', 'houses': (2, 5, 11), 'primary': 5, 'negation': ()},
    'career': {'label': '事业', 'houses': (2, 6, 10, 11), 'primary': 10, 'negation': ()},
    'illness': {'label': '疾病', 'houses': (6, 8, 12), 'primary': 6, 'negation': ()},
    'travel': {'label': '外出', 'houses': (3, 9, 12), 'primary': 9, 'negation': ()},
    'general': {'label': '通用(不裁决)', 'houses': (), 'primary': 1, 'negation': ()},
}


def judge_matter(matter, primary_csl_houses, primary_house=None):
    """CSL 裁决(§12.5):主判宫 CSL 所指示之宫 ∩ 事项宫组。

    primary_csl_houses: 主判宫 CSL(作为 Significator)指示的宫集。
    返回 verdict ∈ favorable/mixed/unfavorable/undetermined + chain 人话证据。
    """
    grp = PRASHNA_HOUSE_GROUPS.get(matter)
    if grp is None:
        return {'available': False, 'reason': 'unknown_matter'}
    if matter == 'general' or not grp['houses']:
        return {'available': True, 'matter': matter, 'label': grp['label'],
                'verdict': 'undetermined', 'chain': ['通用问事不设宫组,不作成否裁决'],
                'primaryHouse': primary_house or grp['primary']}
    houses = set(grp['houses'])
    neg = set(grp['negation'])
    sig = set(primary_csl_houses or ())
    hit = sorted(houses & sig)
    neg_hit = sorted(neg & sig)
    chain = []
    ph = primary_house or grp['primary']
    chain.append('主判宫 = 第 %d 宫(%s;可手改)' % (ph, grp['label']))
    chain.append('该宫 CSL 指示宫 = %s' % (sorted(sig) if sig else '无'))
    chain.append('事项宫组 %s → 命中 %s' % (sorted(houses), hit if hit else '无'))
    if neg:
        chain.append('阻碍宫组 %s → 命中 %s' % (sorted(neg), neg_hit if neg_hit else '无'))
    if hit and not neg_hit:
        verdict = 'favorable'
        chain.append('结论:成(命中事项宫组且无阻碍)')
    elif hit and neg_hit:
        verdict = 'mixed'
        chain.append('结论:成中有碍(事项与阻碍宫组同时命中)')
    elif neg_hit:
        verdict = 'unfavorable'
        chain.append('结论:不成(仅命中阻碍宫组)')
    else:
        verdict = 'unfavorable'
        chain.append('结论:不成(未命中事项宫组)')
    return {'available': True, 'matter': matter, 'label': grp['label'],
            'houses': sorted(houses), 'negation': sorted(neg), 'primaryHouse': ph,
            'hit': hit, 'negationHit': neg_hit, 'verdict': verdict, 'chain': chain}


# ── 应期:问时 Vimshottari 单支下钻(不建全树)────────────────────────────
def horary_vimshottari_path(moon_lon, question_dt, year_days=365.25, depth=5):
    """自问事时刻月宿起运,只沿**含问事时刻的分支**逐级下钻 depth 级;
    每级给全部 9 兄弟窗口(45 节点封顶,9^5 全树 59049 不建)。"""
    from astrostudy.nakshatra import nakshatra_from_lon
    if moon_lon is None or question_dt is None:
        return {'available': False, 'reason': 'missing_moon_or_time'}
    nak = nakshatra_from_lon(moon_lon)
    lord = nak['lord']
    remaining = float(nak['remainingRatio'])
    lord_years = DASHA_YEARS[lord]
    # 当前 Maha:自问事时刻回推已耗部分
    elapsed_years = lord_years * (1.0 - remaining)
    level_start = question_dt - timedelta(days=elapsed_years * year_days)
    level_days = lord_years * year_days
    levels = []
    cur_lord = lord
    cur_start = level_start
    cur_days = level_days
    for level_no in range(1, int(depth) + 1):
        idx = DASHA_ORDER.index(cur_lord)
        sibs = []
        # 该级从 cur_lord 起绕一整轮(级窗口按上级期长比例切)
        t = cur_start
        active = None
        for k in range(9):
            sub = DASHA_ORDER[(idx + k) % 9]
            sub_days = cur_days * DASHA_YEARS[sub] / DASHA_TOTAL if level_no > 1 else (
                DASHA_YEARS[sub] * year_days)
            end = t + timedelta(days=sub_days)
            row = {'lord': sub, 'start': t.strftime('%Y-%m-%d %H:%M'),
                   'end': end.strftime('%Y-%m-%d %H:%M'),
                   'startIso': t.isoformat(), 'endIso': end.isoformat()}
            if t <= question_dt < end:
                row['active'] = True
                active = (sub, t, sub_days)
            sibs.append(row)
            t = end
        levels.append({'level': level_no,
                       'levelName': ['Maha', 'Antar', 'Pratyantar', 'Sookshma', 'Prana'][level_no - 1],
                       'periods': sibs})
        if active is None:
            break
        cur_lord, cur_start, cur_days = active
    return {'available': True, 'seedLord': lord, 'moonNakshatra': nak,
            'yearLengthDays': float(year_days), 'levels': levels}


def timing_windows(levels, rp_set, matter_houses, houses_by_planet, top_k=8):
    """应期评分(A6:不二值判定,逐窗打分排序):
    RP 命中 +2 / 窗主指示宫 ∩ 事项宫组每宫 +1;级越深窗越准 +level×0.1 微加权。"""
    rp = set(rp_set or ())
    mh = set(matter_houses or ())
    scored = []
    for lv in (levels or []):
        for p in lv.get('periods') or []:
            lord = p['lord']
            s = 0.0
            why = []
            if lord in rp:
                s += 2.0
                why.append('窗主 %s ∈ RP' % lord)
            overlap = sorted(mh & set(houses_by_planet.get(lord) or ()))
            if overlap:
                s += float(len(overlap))
                why.append('窗主指示宫命中 %s' % overlap)
            s += lv['level'] * 0.1
            if s > 0:
                scored.append({'level': lv['level'], 'levelName': lv['levelName'],
                               'lord': lord, 'start': p['start'], 'end': p['end'],
                               'active': p.get('active', False),
                               'score': round(s, 2), 'reasons': why})
    scored.sort(key=lambda x: -x['score'])
    return scored[:int(top_k)]


# ── KP 问时盘组装(输入全为已抽好的普通 dict,零 kernel 依赖)──────────────
KP_FRAME = {'indiaAyanamsa': 'krishnamurti', 'indiaHsys': 3}
CUSP_MODES = ('asc_driven_placidus', 'time_placidus', 'equal_from_asc')


def assemble_kp_horary(number, matter, cusps, cusp_mode, planet_lons, question_dt,
                       rp, vara, primary_house=None, year_days=365.25,
                       cusp_asc_mismatch=None, notes=None):
    """KP 问时盘总装(纯函数)。

    cusps       : 12 宫始(已按 cusp_mode 求好;asc_driven 下 cusps[0]≈问数段中点)。
    planet_lons : {kp_key: lon}(问事时刻九曜,KP 框架恒星经度)。
    rp          : ruling_planets_extended(...) 结果(七项版)。
    vara        : {'civil': lord, 'sunrise': lord}(§17.4 日界=日出;两口径并出,不同须明示)。
    """
    seg = horary_segment(number)
    if seg is None or not cusps:
        return {'available': False, 'reason': 'invalid_number_or_cusps'}
    csl = cuspal_sublords(cusps)
    own = own_houses_by_cusp(cusps)
    # 逐曜:占宫 + 宿主 + 所主宫 → significators
    planet_data = {}
    houses_by_planet = {}
    same_sign = {}
    for key, lon in planet_lons.items():
        if lon is None:
            continue
        h = house_of_lon(lon, cusps)
        levels = kp_levels(lon, depth=2)
        sign_no = int((float(lon) % 360.0) // 30.0) + 1
        planet_data[key] = {'sign': sign_no, 'house': h,
                            'starLord': levels.get('Nak'), 'ownHouses': own.get(key) or []}
        houses_by_planet[key] = set([h] if h else []) | set(own.get(key) or [])
        same_sign.setdefault(sign_no, []).append(key)
    sig = significators(planet_data)
    # 节点代理(A3 同座为合)
    node_proxy = {}
    for nk in ('Rahu', 'Ketu'):
        pd = planet_data.get(nk)
        if not pd:
            continue
        conj = [p for p in same_sign.get(pd['sign'], []) if p != nk]
        src, houses = node_proxy_houses(
            nk, conj, SIGN_LORDS[pd['sign'] - 1], pd.get('starLord'), houses_by_planet)
        node_proxy[nk] = {'basis': src, 'houses': houses}
        if houses:
            houses_by_planet[nk] = houses_by_planet.get(nk, set()) | set(houses)
    # 主判宫 CSL → 其指示宫(CSL 星按其占/主/宿主宫集 —— 用 significators 行)
    grp = PRASHNA_HOUSE_GROUPS.get(matter) or PRASHNA_HOUSE_GROUPS['general']
    ph = int(primary_house) if primary_house else grp['primary']
    ph = ph if 1 <= ph <= 12 else grp['primary']
    csl_row = csl[ph - 1] if len(csl) >= ph else None
    csl_lord = csl_row and csl_row.get('subLord')
    # 🔴 significators() 每曜出参是 {'A','B','C','D','ranked'} —— 没有 'houses' 键。
    # 曾误取 'houses' → 恒得 []，judge_matter 必落末支「未命中事项宫组」→ 除 general 外
    # 一切事项恒判 unfavorable，CSL 裁决整条形同死码(直调 judge_matter 的单测喂手工宫表,
    # 测不到装配链,故长期未被发现)。取 'ranked'(A>B>C>D 合并去重)=「该曜所指示之宫全集」。
    csl_row_sig = (sig.get(csl_lord) or {}) if csl_lord else {}
    csl_sig_houses = sorted(set(csl_row_sig.get('ranked') or ()))
    judgement = judge_matter(matter, csl_sig_houses, primary_house=ph)
    if judgement.get('available') and csl_lord:
        judgement['chain'].insert(1, '第 %d 宫 CSL = %s' % (ph, csl_lord))
        # 四重强度分层随判决出参:A(宿主)最强 → D(受影响者)最弱。命中落在哪一级由此可查,
        # 不把「D 层算不算意义」这种学理取舍写死在裁决里(判决用全集,强度交给阅读者)。
        tiers = {t: list(csl_row_sig.get(t) or ()) for t in ('A', 'B', 'C', 'D')}
        judgement['cslSigTiers'] = tiers
        hit_set = set(judgement.get('hit') or ())
        if hit_set:
            by_tier = {t: sorted(hit_set & set(v)) for t, v in tiers.items() if hit_set & set(v)}
            if by_tier:
                judgement['hitByTier'] = by_tier
                judgement['chain'].append('命中来源(强度 A>B>C>D):%s' % (
                    '、'.join('%s=%s' % (t, by_tier[t]) for t in ('A', 'B', 'C', 'D') if t in by_tier)))
    # 应期
    path = horary_vimshottari_path(planet_lons.get('Moon'), question_dt, year_days)
    windows = timing_windows(path.get('levels'), (rp or {}).get('set'),
                             grp['houses'], houses_by_planet)
    # 核心不变量:asc_driven 下 CSL(1).subLord == 问数子主
    invariant_ok = None
    if cusp_mode == 'asc_driven_placidus' and csl:
        invariant_ok = (csl[0].get('subLord') == seg.get('subLord'))
    return {
        'available': True,
        'number': int(number), 'segment': seg,
        'matter': matter, 'primaryHouse': ph,
        'kpFrame': dict(KP_FRAME),
        'cuspMode': cusp_mode,
        'cuspAscMismatchDeg': cusp_asc_mismatch,
        'cusps': [round(float(c), 6) for c in cusps],
        'ownHousesBasis': 'cusp',
        'cuspalSubLords': csl,
        'significators': sig,
        'nodeProxy': node_proxy,
        'rulingPlanets': rp,
        'vara': vara,
        'judgement': judgement,
        'dashaPath': path,
        'timingWindows': windows,
        'invariantCslMatchesSegment': invariant_ok,
        'notes': notes or [],
    }
