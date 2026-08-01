# -*- coding: utf-8 -*-
"""KP（Krishnamurti Paddhati）六级细分体系 —— 深化版。

把 Vimshottari 的「九主年数比例」从时间搬到空间：每个星宿(13°20′=800′)按九曜年数比例
层层细分为 Sub→Prati→Sook→Praana→Deha，得到极细的「子主星」链。

六级链：星宿(Nak) ⊃ 子(Sub) ⊃ 子子(Prati) ⊃ Sookshma ⊃ Praana ⊃ Deha。
每一级内的子段：
  - 子主星序列 = 从「本级主星」起，按 Vimshottari 顺序循环
    (Ketu·Venus·Sun·Moon·Mars·Rahu·Jupiter·Saturn·Mercury)；
  - 各子段宽度 = 本级总宽 × (子主年数 / 120)。
全黄道按「星宿 × Sub」共切出 249 个子段(星宿与星座边界不重合，各星座含 Sub 段数不等)。

本模块为纯函数(仅依赖恒星黄道经度 + 调用方传入的真实宫始度数)，零排盘引擎依赖，
取代旧的两级 kp_sublord。集成契约见模块末尾 docstring 与 README 注记。
"""

from astrostudy.nakshatra import nakshatra_from_lon, NAKSHATRAS

# 九曜年数与顺序(Vimshottari)；总和 120。子主星序列即此顺序循环。
DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury']
DASHA_YEARS = {
    'Ketu': 7, 'Venus': 20, 'Sun': 6, 'Moon': 10, 'Mars': 7,
    'Rahu': 18, 'Jupiter': 16, 'Saturn': 19, 'Mercury': 17,
}
DASHA_TOTAL = 120

# 星座主星(svami)：用于 Ruling Planets 的「星座主」与 Significators 的「所主之宫」。
# 天蝎/水瓶取传统单主(Mars/Saturn)；如需双主可在调用层叠加 co-lord。
SIGN_LORDS = [
    'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
    'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
]

# 六级名(由粗到细)。
LEVEL_NAMES = ['Nak', 'Sub', 'Prati', 'Sook', 'Praana', 'Deha']
LEVEL_LABELS = {
    'Nak': '星宿主', 'Sub': '子主(Sub)', 'Prati': '子子(Prati)',
    'Sook': 'Sookshma', 'Praana': 'Praana', 'Deha': 'Deha',
}

NAK_SPAN = 360.0 / 27.0  # 13°20′ = 13.3333…°


def _norm(lon):
    return float(lon) % 360.0


def _nak_start(lon):
    """目标点所在星宿的起始恒星经度(度)。"""
    value = _norm(lon)
    idx = min(26, int(value / NAK_SPAN))
    return idx * NAK_SPAN


def _subdivide_one(offset, width, level_lord):
    """在 [0, width) 区间内、自 level_lord 起按九曜顺序细分，返回 offset 落入的
    (子主星, 子段起点 offset, 子段宽度)。子段宽度 = width × (子主年数 / 120)。"""
    start_idx = DASHA_ORDER.index(level_lord)
    cursor = 0.0
    for k in range(9):
        candidate = DASHA_ORDER[(start_idx + k) % 9]
        seg_width = width * DASHA_YEARS[candidate] / DASHA_TOTAL
        # 用 < 上界判定，落到末段时数值边界归入最后一段(下面兜底)。
        if offset < cursor + seg_width or k == 8:
            return candidate, cursor, seg_width
        cursor += seg_width
    # 理论不可达。
    return level_lord, 0.0, width


def kp_subdivide(lon, depth=6):
    """KP 六级细分。返回 depth(≤6) 级链：每级 {level, lord}。

    第 0 级 = 星宿主(Nak)。其后每级从上一级主星起、按九曜顺序、以「父宽 × 子年/120」
    切分，定位目标点落入的子段，递归到 depth 级。

    例(上升 119°05′=119.0833°)：在柳宿(Ashlesha，主 Mercury)。
      宿内偏移 12.4167°=745′。
      Sub  : 自 Me 起细分 800′ → 745′ 落 Saturn → Sub=Saturn。
      Prati: 自 Sa 起细分 126.67′ → 偏移 71.67′ 落 Sun → Prati=Sun。
    """
    if depth < 1:
        depth = 1
    if depth > 6:
        depth = 6
    nak = nakshatra_from_lon(lon)
    chain = [{'level': 'Nak', 'lord': nak['lord']}]

    # 进入更细级：在当前级区间内层层定位。
    offset = _norm(lon) - _nak_start(lon)   # 宿内偏移(度)
    width = NAK_SPAN                         # 当前级宽(度)
    level_lord = nak['lord']
    for level in range(1, depth):
        sub_lord, seg_start, seg_width = _subdivide_one(offset, width, level_lord)
        chain.append({'level': LEVEL_NAMES[level], 'lord': sub_lord})
        # 下钻：偏移变为「在该子段内的相对偏移」，宽变为子段宽，级主星变为子主星。
        offset = offset - seg_start
        width = seg_width
        level_lord = sub_lord
    return chain


def kp_levels(lon, depth=6):
    """kp_subdivide 的便捷视图：返回 {Nak, Sub, Prati, Sook, Praana, Deha} 主星字典
    (仅含 depth 个键)，便于调用方直接取某级主星。"""
    chain = kp_subdivide(lon, depth=depth)
    return {item['level']: item['lord'] for item in chain}


def kp_249_table():
    """枚举全黄道「星宿 × Sub」并按星座(30°)边界切分后的 249 个子段(每段
    {index, signNo, nakIndex, nakName, starLord, subLord, startLon, endLon, widthDeg})。

    遍历 27 宿，每宿自宿主起按九曜顺序切 9 个 Sub 段(共 243)；因星宿(13°20′)与 Sub
    边界跟星座(30°)边界不重合，凡跨星座边界的 Sub 段再按边界拆开 —— 标准 KP 即由此
    得到 **249** 段(243 + 6 个跨界拆分)。返回顺序沿黄道升序。
    """
    segments = []
    for nak_index in range(27):
        nak_start = nak_index * NAK_SPAN
        _, _, star_lord = NAKSHATRAS[nak_index]
        start_idx = DASHA_ORDER.index(star_lord)
        cursor = 0.0
        for k in range(9):
            sub_lord = DASHA_ORDER[(start_idx + k) % 9]
            seg_width = NAK_SPAN * DASHA_YEARS[sub_lord] / DASHA_TOTAL
            seg_start = nak_start + cursor
            seg_end = seg_start + seg_width
            cursor += seg_width
            # 在 [seg_start, seg_end) 内按星座 30° 边界切片，跨界则拆成多段。
            piece_start = seg_start
            while piece_start < seg_end - 1e-9:
                sign_no = int(piece_start // 30) + 1
                next_boundary = sign_no * 30.0
                piece_end = min(seg_end, next_boundary)
                segments.append({
                    'index': len(segments) + 1,
                    'signNo': sign_no,
                    'nakIndex': nak_index + 1,
                    'nakName': NAKSHATRAS[nak_index][0],
                    'starLord': star_lord,
                    'subLord': sub_lord,
                    'startLon': piece_start,
                    'endLon': piece_end,
                    'widthDeg': piece_end - piece_start,
                })
                piece_start = piece_end
    return segments


def cuspal_sublords(cusp_lons):
    """宫始子主星(CSL)。cusp_lons = 12 个宫始恒星经度(度，宫 1..12 顺序，调用方按
    Placidus/不等宫给真实度数)。每宫返回其 Sub 主星(kp_subdivide 的第 2 级)。

    返回 [{house, cuspLon, nakIndex, starLord, subLord, chain}...]，house 从 1 计。
    """
    result = []
    for i, lon in enumerate(cusp_lons):
        if lon is None:
            result.append({'house': i + 1, 'cuspLon': None, 'nakIndex': None,
                           'starLord': None, 'subLord': None, 'chain': None})
            continue
        nak = nakshatra_from_lon(lon)
        chain = kp_subdivide(lon, depth=2)
        result.append({
            'house': i + 1,
            'cuspLon': _norm(lon),
            'nakIndex': nak['index'],
            'starLord': nak['lord'],
            'subLord': chain[1]['lord'],
            'chain': chain,
        })
    return result


def significators(planet_data, house_occupancy=None):
    """四重意义者法(four-fold significators)。

    一颗行星「signifies」某宫的强度依次：
      A(最强) 它所在星宿主(star-lord)所占 / 所主之宫；
      B        行星本身所占之宫；
      C        行星所主之宫(其拥有的星座对应的宫)；
      D        受其影响者(占据/合于该行星星宿的行星，再取那些行星所占/所主之宫)。
    星宿主优先于行星本身是 KP 精髓。

    入参 planet_data: { planetKey: {
        'sign': 1..12,            # 所在星座(用于推「所主之宫」)
        'house': 1..12,          # 所占之宫(B)
        'starLord': 'Mercury',   # 该行星所在星宿的宿主(用于 A)
        'ownHouses': [..],       # 该行星所主之宫(C)；调用方按其拥有的星座 → 宫给出
    } }
    house_occupancy: { planetKey: house }，全盘行星→所占之宫，供 A/D 用其它行星反查。
        若省略，则从 planet_data 内的 'house' 自动构造。

    返回 { planetKey: {
        'A': [...], 'B': [...], 'C': [...], 'D': [...],   # 各级宫号(去重、升序)
        'ranked': [...],                                  # 合并按强度去重(A>B>C>D)
    } }。
    """
    if house_occupancy is None:
        house_occupancy = {p: d.get('house') for p, d in planet_data.items()
                           if d.get('house') is not None}

    # planet → 它所主之宫(C)；用于 A(star-lord 所主)与 D 反查。
    own_houses_of = {p: list(d.get('ownHouses', []) or []) for p, d in planet_data.items()}
    # planet → 它所占之宫。
    house_of = {p: d.get('house') for p, d in planet_data.items()}
    # star-lord → 哪些行星落在它主宰的星宿里(供 D：受影响者)。
    influenced_by = {}
    for p, d in planet_data.items():
        sl = d.get('starLord')
        if sl:
            influenced_by.setdefault(sl, []).append(p)

    def _uniq_sorted(values):
        return sorted({v for v in values if v is not None})

    result = {}
    for p, d in planet_data.items():
        star_lord = d.get('starLord')

        # A：star-lord 所占之宫 + star-lord 所主之宫(最强)。
        a = []
        if star_lord is not None:
            if house_of.get(star_lord) is not None:
                a.append(house_of[star_lord])
            elif house_occupancy.get(star_lord) is not None:
                a.append(house_occupancy[star_lord])
            a.extend(own_houses_of.get(star_lord, []))

        # B：行星本身所占之宫。
        b = [d.get('house')] if d.get('house') is not None else []

        # C：行星所主之宫。
        c = list(d.get('ownHouses', []) or [])

        # D：受其影响者(落在 p 主宰星宿里的行星)所占 / 所主之宫。
        dd = []
        for q in influenced_by.get(p, []):
            if q == p:
                continue
            if house_of.get(q) is not None:
                dd.append(house_of[q])
            dd.extend(own_houses_of.get(q, []))

        a_s, b_s, c_s, d_s = _uniq_sorted(a), _uniq_sorted(b), _uniq_sorted(c), _uniq_sorted(dd)
        ranked = []
        for tier in (a_s, b_s, c_s, d_s):
            for h in tier:
                if h not in ranked:
                    ranked.append(h)
        result[p] = {'A': a_s, 'B': b_s, 'C': c_s, 'D': d_s, 'ranked': ranked}
    return result


# 星期序(0=周一…6=周日)→ 星期主(vara lord)。
# ⚠️ 与 flatlib dayofweek()(0=周日)不同域:调用方必须先 (dayofweek()-1)%7 换算
# (jyotish_engine.kp / webindiasrv 均已如此);shadbala_bphs.WEEKDAY_LORDS 是另一张
# 0=周日 表,同名不同域,勿互换。
WEEKDAY_LORDS = ['Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Sun']


def sign_lord(sign_no):
    """星座号(1..12)→ 星座主星。"""
    return SIGN_LORDS[(int(sign_no) - 1) % 12]


def ruling_planets(lagna_sign, lagna_nak_lord, moon_sign, moon_nak_lord, weekday):
    """Ruling Planets(RP)：提问 / 事发时刻的五要素——
      ① 上升星座主  ② 上升星宿主  ③ 月亮星座主  ④ 月亮星宿主  ⑤ 星期主。

    入参：lagna_sign / moon_sign = 星座号(1..12)；lagna_nak_lord / moon_nak_lord = 宿主
    行星名(字符串，如 'Mercury')；weekday = 0..6(0=周一；dayofweek() 为 0=周日，须先 (x-1)%7 换算)。

    返回 { 'lagnaSignLord', 'lagnaNakLord', 'moonSignLord', 'moonNakLord', 'weekdayLord',
           'set': [...去重保序...] }。
    """
    weekday_lord = WEEKDAY_LORDS[int(weekday) % 7]
    components = {
        'lagnaSignLord': sign_lord(lagna_sign),
        'lagnaNakLord': lagna_nak_lord,
        'moonSignLord': sign_lord(moon_sign),
        'moonNakLord': moon_nak_lord,
        'weekdayLord': weekday_lord,
    }
    seen = []
    for key in ('lagnaSignLord', 'lagnaNakLord', 'moonSignLord', 'moonNakLord', 'weekdayLord'):
        v = components[key]
        if v is not None and v not in seen:
            seen.append(v)
    components['set'] = seen
    return components


def ruling_planets_extended(lagna_sign, lagna_nak_lord, moon_sign, moon_nak_lord, weekday,
                            lagna_sub_lord=None, moon_sub_lord=None):
    """RP 七项版(权威 §17.3-4:五要素「+ Lagna/Moon 子主」)。纯新增 ——
    ruling_planets() 一字不改,既有五项口径零回归(回归断言看守)。

    lagna_sub_lord / moon_sub_lord:该点 KP Sub 主(调用方用 kp_levels(lon)['Sub'] 取;
    缺省 None 即退化为五项,'set' 与 ruling_planets 完全一致)。
    """
    base = ruling_planets(lagna_sign, lagna_nak_lord, moon_sign, moon_nak_lord, weekday)
    out = dict(base)
    out['lagnaSubLord'] = lagna_sub_lord
    out['moonSubLord'] = moon_sub_lord
    seen = list(base['set'])
    for v in (lagna_sub_lord, moon_sub_lord):
        if v is not None and v not in seen:
            seen.append(v)
    out['set'] = seen
    out['components7'] = ['lagnaSignLord', 'lagnaNakLord', 'moonSignLord', 'moonNakLord',
                          'weekdayLord', 'lagnaSubLord', 'moonSubLord']
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 集成契约（供 jyotish_engine.kp() 替换旧两级 kp_sublord）
# ─────────────────────────────────────────────────────────────────────────────
"""
旧 jyotish_engine.kp_sublord(lon) 只到两级(starLord/subLord)。本模块以六级细分取代。

引擎侧改法(不在本文件内改 jyotish_engine)：

    from astrostudy.india.kp_system import (
        kp_subdivide, cuspal_sublords, significators, ruling_planets, kp_levels,
    )

  1) 行星 / 上升六级链：对每颗 JYOTISH_PLANETS 与 self.asc，
       chain = kp_subdivide(obj.lon, depth=6)
       levels = kp_levels(obj.lon)   # {Nak, Sub, Prati, Sook, Praana, Deha}
     星座号 = int(obj.lon // 30) + 1；恒星经度直接用 obj.lon(已是 sidereal)。

  2) CSL(宫始子主)：取 12 宫真实宫始度数 cusp_lons —— 用不等宫(Placidus / bhava_chalit)
     的 cusp，而非整宫 0°。本仓已有 bhava_chalit / Placidus 宫始(self.d1_asc 起算)；
     把 12 个 sidereal cusp 度数按宫 1..12 顺序传入：
       csl = cuspal_sublords(cusp_lons)
     若暂无不等宫 cusp，可退化用整宫(每宫 = 星座 0°)，但 KP 标准要求不等宫。

  3) 四重意义者：构造 planet_data —— 对每颗行星给
       sign(1..12)、house(占宫，整宫制 ((sign-ascSign)%12)+1 或 bhava 宫均可)、
       starLord(= nakshatra_from_lon(obj.lon)['lord'])、
       ownHouses(行星拥有的星座 → 宫号；可用 arudha.SIGN_LORDS 反查：找出该行星主宰的
                 星座，再 ((thatSign - ascSign)%12)+1)。
     调用：significators(planet_data)。

  4) Ruling Planets：
       lagna_sign = const.LIST_SIGNS.index(self.d1_asc.sign)+1
       lagna_nak_lord = nakshatra_from_lon(self.d1_asc.lon)['lord']
       moon_sign  = const.LIST_SIGNS.index(self.d1_moon.sign)+1
       moon_nak_lord  = nakshatra_from_lon(self.d1_moon.lon)['lord']
       weekday = (self.perchart.dateTime.date.dayofweek() - 1) % 7   # dayofweek 0=周日 → 本表 0=周一
       rp = ruling_planets(lagna_sign, lagna_nak_lord, moon_sign, moon_nak_lord, weekday)

  kp() 返回体可扩展为：
    {
      'ayanamsa': ..., 'ayanamsaKey': ...,
      'sublords': { obj_id: {'nakshatra':..., 'chain':[6级], 'levels':{...},
                             'starLord':..., 'subLord': chain[1].lord} },
      'cuspalSubLords': csl,         # CSL 列表
      'significators': sig,           # 四重意义者
      'rulingPlanets': rp,            # RP 五要素
    }
"""
