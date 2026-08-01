"""印度副星(Upagraha) + 特殊上升(Special Lagnas)。

- 日基 5 副星：由太阳经度按固定偏移链推出(Dhuma=日+133°20'…Upaketu)。纯确定式。
- 特殊上升 BL/HL/GL：日出太阳经度 + 历时按 ghati 推进 rasi；SL：lagna + 月在本宿进度×360°。
- 时基 6 副星(Gulika/Maandi 等)需昼夜分段 + 段时升 lagna，另由引擎接线(本模块给段算法)。

所有经度均为 sidereal 黄经(0-360)。日基链/特殊上升公式已与权威例核对(日 249°36′→Dhuma 22.93°Ar)。
"""

# ── 日基 5 副星偏移链 ──────────────────────────────────────────────────────
_DHUMA_OFFSET = 133.0 + 20.0 / 60.0       # 133°20'
_UPAKETU_OFFSET = 16.0 + 40.0 / 60.0      # 16°40'

# (key, 梵名直义试探注)——书无定中文译名，用梵文 + 字面义(不臆造专名)。
SUN_BASED_DEFS = [
    ('Dhuma', '烟'),         # smoke
    ('Vyatipata', '灾厄'),    # calamity
    ('Parivesha', '日月晕'),  # halo
    ('Indrachapa', '虹'),    # Indra's bow / rainbow
    ('Upaketu', '彗'),       # comet
]


def sun_based_upagrahas(sun_lon):
    """日基 5 副星黄经：Dhuma→Vyatipata→Parivesha→Indrachapa→Upaketu(链式)。"""
    s = float(sun_lon) % 360.0
    dhuma = (s + _DHUMA_OFFSET) % 360.0
    vyatipata = (360.0 - dhuma) % 360.0
    parivesha = (vyatipata + 180.0) % 360.0
    indrachapa = (360.0 - parivesha) % 360.0
    upaketu = (indrachapa + _UPAKETU_OFFSET) % 360.0
    lons = [dhuma, vyatipata, parivesha, indrachapa, upaketu]
    return [
        {'key': key, 'note': note, 'lon': lon}
        for (key, note), lon in zip(SUN_BASED_DEFS, lons)
    ]


# ── 特殊上升 BL/HL/GL/SL ──────────────────────────────────────────────────
_GHATI_MIN = 24.0                          # 1 ghati = 24 分
_NAK = 360.0 / 27.0                        # 13°20'


def pranapada(sun_lon, elapsed_minutes):
    """Praṇapada PP(BPHS Ch.3,devatā Garuḍa):X=(历时分×5°)mod360(=ishta_vighati/15 rāśi);
    按太阳所在座型偏移 动象+0°/变动象+120°/固定象+240°;PP=(Sun+X+offset)mod360。
    Sun 取「日出太阳」(BPHS/Jātaka Pārijāta)或「出生太阳」(现代变体)——见 special_lagnas 双变体。"""
    x = (float(elapsed_minutes) * 5.0) % 360.0
    sidx = int((float(sun_lon) % 360.0) // 30.0) % 12
    if sidx in (0, 3, 6, 9):        # 动象 movable(白羊/巨蟹/天秤/摩羯)
        off = 0.0
    elif sidx in (1, 4, 7, 10):     # 固定 fixed(金牛/狮子/天蝎/水瓶)
        off = 240.0
    else:                           # 变动 dual(双子/处女/射手/双鱼)
        off = 120.0
    return (float(sun_lon) + x + off) % 360.0


def special_lagnas(sun_lon_at_sunrise, elapsed_minutes, lagna_lon, moon_lon, sun_lon_at_birth=None):
    """BL/HL/GL = 日出太阳经度 + 历时换算 rasi 推进；SL = lagna + 月宿进度×360°；
    PP(Praṇapada)= 双变体(日出太阳 BPHS / 出生太阳 现代变体)。
    BL 每 5 ghati(120 分)进 1 rasi；HL 每 2.5 ghati(60 分)；GL 每 1 ghati(24 分)。"""
    s = float(sun_lon_at_sunrise) % 360.0
    ghatis = float(elapsed_minutes) / _GHATI_MIN
    bl = (s + (ghatis / 5.0) * 30.0) % 360.0
    hl = (s + (ghatis / 2.5) * 30.0) % 360.0
    gl = (s + ghatis * 30.0) % 360.0
    moon = float(moon_lon) % 360.0
    nak_progress = (moon % _NAK) / _NAK
    sl = (float(lagna_lon) + nak_progress * 360.0) % 360.0
    out = {
        'bhavaLagna': {'key': 'BL', 'label': 'Bhava Lagna', 'lon': bl},
        'horaLagna': {'key': 'HL', 'label': 'Hora Lagna', 'lon': hl},
        'ghatikaLagna': {'key': 'GL', 'label': 'Ghatika Lagna', 'lon': gl},
        'sreeLagna': {'key': 'SL', 'label': 'Sree Lagna', 'lon': sl},
    }
    pp_sunrise = pranapada(s, elapsed_minutes)
    pp = {
        'key': 'PP', 'label': 'Praṇapada',
        'lon': pp_sunrise,                       # 默认 = BPHS 日出太阳
        'variantSunrise': pp_sunrise,
        'note': 'BPHS/Jātaka Pārijāta 用日出太阳;现代变体用出生太阳(差<1°,近座界可跳座)。',
    }
    if sun_lon_at_birth is not None:
        pp['variantBirth'] = pranapada(float(sun_lon_at_birth), elapsed_minutes)
    out['pranapada'] = pp
    return out


# ── 时基副星分段 ──────────────────────────────────────────────────────────
# 昼(日出→日没)/夜(日没→次日出)各等分 8 段。每段归属一曜，第 8 段恒「无主」。
# 段主序:昼首段=当日星期主,按 日→月→火→水→木→金→土 顺推排满 1–7 段,第 8 段恒空;
# 夜首段=该昼序的第 5 曜起、同序续排(第 8 段亦恒空)。下表为各星期昼/夜 8 段段主的逐行显式表
# (公式近似会在空段前后系统性偏移，故改为显式查表)。None=空段(无主)。
# 星期索引：0=日 1=月 2=火 3=水 4=木 5=金 6=土。
_SUN, _MOON, _MARS, _MERC, _JUP, _VEN, _SAT = (
    'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn')

# 昼 8 段段主表(行=星期 0..6，列=段 0..7；末段恒 None)。
# 🔴 通行口径:首段主=当日 vara 主,其后按 日→月→火→水→木→金→土 顺推 7 段,
# **第 8 段恒无主**。曾按「土之后插空段」排 → 空段位置随星期游走,土后诸曜整体
# 后移一格(Kala/Mrityu/Artha/Yama 偏一段 ≈ 昼长/8,足以跨座);Gulika/Maandi(土)
# 恰不受影响故未被金标抓到。
_DAY_SEGMENT_LORDS = {
    0: [_SUN, _MOON, _MARS, _MERC, _JUP, _VEN, _SAT, None],    # 日
    1: [_MOON, _MARS, _MERC, _JUP, _VEN, _SAT, _SUN, None],    # 月
    2: [_MARS, _MERC, _JUP, _VEN, _SAT, _SUN, _MOON, None],    # 火
    3: [_MERC, _JUP, _VEN, _SAT, _SUN, _MOON, _MARS, None],    # 水
    4: [_JUP, _VEN, _SAT, _SUN, _MOON, _MARS, _MERC, None],    # 木
    5: [_VEN, _SAT, _SUN, _MOON, _MARS, _MERC, _JUP, None],    # 金
    6: [_SAT, _SUN, _MOON, _MARS, _MERC, _JUP, _VEN, None],    # 土
}

# 夜 8 段段主表(行=星期 0..6，列=段 0..7；末段恒 None)。
_NIGHT_SEGMENT_LORDS = {
    0: [_JUP, _VEN, _SAT, _SUN, _MOON, _MARS, _MERC, None],    # 日(夜首=昼序第5曜)
    1: [_VEN, _SAT, _SUN, _MOON, _MARS, _MERC, _JUP, None],    # 月
    2: [_SAT, _SUN, _MOON, _MARS, _MERC, _JUP, _VEN, None],    # 火
    3: [_SUN, _MOON, _MARS, _MERC, _JUP, _VEN, _SAT, None],    # 水
    4: [_MOON, _MARS, _MERC, _JUP, _VEN, _SAT, _SUN, None],    # 木
    5: [_MARS, _MERC, _JUP, _VEN, _SAT, _SUN, _MOON, None],    # 金
    6: [_MERC, _JUP, _VEN, _SAT, _SUN, _MOON, _MARS, None],    # 土
}


def _segment_index_of_planet(weekday, planet, night=False):
    """按显式昼/夜段主表查 planet 所在段序(0-7)。无则 None。"""
    table = _NIGHT_SEGMENT_LORDS if night else _DAY_SEGMENT_LORDS
    lords = table.get(int(weekday) % 7)
    if lords is None or planet not in lords:
        return None
    return lords.index(planet)


# 时基副星 → 所属曜段 + 取点。中点升起的 lagna(默认派)/Maandi 取段起点。
TIME_BASED_DEFS = [
    ('Kala', 'Sun', '日子'),
    ('Mrityu', 'Mars', '火子'),
    ('ArthaPrahara', 'Mercury', '水子'),
    ('YamaGhantaka', 'Jupiter', '木子'),
    ('Gulika', 'Saturn', '土子(段中点)'),
    ('Maandi', 'Saturn', '土子(段起点)'),
]


def time_based_segment(name, weekday, night=False):
    """该时基副星所属段在昼/夜 8 段中的序(0-7)与取点。

    返回 ``{'segment': int(0-7), 'point': 'mid'|'start', 'planet': str}`` 或 None。
    取点语义(引擎据此换升 lagna 的时刻)：
      - ``'mid'``  → 该段中点时刻升起的 lagna(Kala/Mrityu/Artha/Yama/Gulika)；
      - ``'start'``→ 该段起点时刻升起的 lagna(Maandi，土段起点)。
    段→时刻：设昼/夜跨度 span(8 段)，段 i 起点 = origin + i/8·span，
             中点 = origin + (i+0.5)/8·span(origin=昼用日出 JD、夜用日没 JD)。
    """
    planet = next((p for n, p, _ in TIME_BASED_DEFS if n == name), None)
    if planet is None:
        return None
    seg = _segment_index_of_planet(weekday, planet, night)
    if seg is None:
        return None
    point = 'start' if name == 'Maandi' else 'mid'
    return {'segment': seg, 'point': point, 'planet': planet}
