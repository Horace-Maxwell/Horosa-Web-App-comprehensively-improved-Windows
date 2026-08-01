# -*- coding: utf-8 -*-
"""扩展大运（Dasha）—— 条件型宿系 8 式 + Chara 宫系（Jaimini）。

纯函数引擎，输入为简单数据(月经度 / 月宿序 / lagna 星座 / 行星星座 dict / 昼夜 / 星期 /
分盘星座…)，不耦合排盘引擎内部状态，便于单测。与 jyotish_engine(Vimshottari 周期机)
和 rasi_dasha(Jaimini 强弱/期长) 同口径，复用其原语，**不改这两个文件**。

═══ 涵盖 ═══
A. 条件型宿系 8 式（复用 Vimshottari 周期机的「主序 + 月宿余比」骨架）：
   Shodashottari(116) Dvadashottari(112) Panchottari(105) Shatabdika(100)
   Chaturashiti-sama(84) Dwisaptati-sama(72) Shashtihayani(60) Shattrimsha-sama(36)
   —— 每式 = 一个 NakshatraDashaSpec 实例 + 同一个 builder(QW10 框架抽象)。
B. Chara 大运（Jaimini，权威口径变体）：12 连续星座；lagna 奇宫顺/偶宫逆；
   期长 = 数到主星宫 −1（数向按各宫奇偶；主在本座 = 12；旺 +1 落 −1）；双主宫择主。

═══ 框架注记（QW10）═══
新增一个宿系大运 = 填一行表(total, lords, seed, condition)，无需写新算法：
  - NakshatraDashaSpec(total, lords, seed_fn, applicable_fn)
  - build_nakshatra_dasha(spec, ...) 复用周期机
全局口径开关：
  - YEAR_MODE：年制(默认 solar 365.2425 日；savana=360 日复现古例)。
  - AD_START：子运起序(默认 self = 从本主自身起，与 Vimshottari 同；可选 next)。
  - CHARA_VARIANT：Chara 双主宫取主变体(默认 'classic' 节点占座优先；可选 'stronger' 用行星 5 级强弱序)。

不变量自检（模块导入即跑）：8 式各「主运年数之和 == 该式总年」。
"""

from flatlib import const

from astrostudy.nakshatra import NAKSHATRAS  # 27 宿(名, 中文, 宿主)
from astrostudy.india.primitives import (
    SIGNS, SIGN_INDEX, ODD_SIGNS, index_of, sign_at, offset_sign, quality,
)
from astrostudy.india.rasi_dasha import (
    SIGN_LORDS, _stronger_lord, is_exalted_in, is_debilitated_in,
)


# ════════════════════════════════════════════════════════════════════════
# 0. 口径开关 + 曜 const 映射
# ════════════════════════════════════════════════════════════════════════

YEAR_JULIAN = 365.25         # 儒略年(权威 §10.1.5 五档之默认)
YEAR_SOLAR = 365.2425        # 格里高利平均年
YEAR_SAVANA = 360.0          # Savana 古例年
YEAR_TROPICAL = 365.2422     # 回归年
YEAR_SIDEREAL = 365.2563     # 恒星年
# 🔴 YEAR_MODE 是进程级共享态:**只作默认值,绝不在运行期改写**(并发请求会互相污染,
#    与 swisseph set_sid_mode 同类风险)。运行期口径一律走 year_length_days 形参贯穿。
#    默认由 'solar' 统一为 'julian'(365.25):与主 Vimshottari 同口径,合权威 §10.1.5 默认。
YEAR_MODE = 'julian'
YEAR_DAYS = {'julian': YEAR_JULIAN, 'solar': YEAR_SOLAR, 'savana': YEAR_SAVANA,
             'tropical': YEAR_TROPICAL, 'sidereal': YEAR_SIDEREAL}


def year_mode_of(days):
    """年长(日)反查口径名;非五档标准值返回 'custom'。"""
    for k, v in YEAR_DAYS.items():
        if abs(float(days) - v) < 1e-6:
            return k
    return 'custom'

AD_START_SELF = 'self'       # 子运从本主自身起(默认，与 Vimshottari 同)
AD_START_NEXT = 'next'       # 子运从下一主起(末位本主)
AD_START = AD_START_SELF

CHARA_VARIANT = 'classic'    # {'classic','stronger'} —— Chara 双主宫取主变体

# 曜 key → flatlib const id（label 取中文，与 jyotish_engine.PLANET_CN 同）。
LORD_ID = {
    'Sun': const.SUN, 'Moon': const.MOON, 'Mars': const.MARS,
    'Mercury': const.MERCURY, 'Jupiter': const.JUPITER, 'Venus': const.VENUS,
    'Saturn': const.SATURN, 'Rahu': const.NORTH_NODE, 'Ketu': const.SOUTH_NODE,
}
LORD_LABEL = {
    'Sun': '太阳', 'Moon': '月亮', 'Mars': '火星', 'Mercury': '水星',
    'Jupiter': '木星', 'Venus': '金星', 'Saturn': '土星', 'Rahu': '罗睺', 'Ketu': '计都',
}


def year_days(mode=None):
    """当前年制对应的「年长(日)」。"""
    return YEAR_DAYS.get(mode or YEAR_MODE, YEAR_SOLAR)


def _lord_dict(key, years):
    """统一主运 dict 形状(与 jyotish_engine DASHA_SEQUENCE 同：key/id/label/years)。"""
    return {'key': key, 'id': LORD_ID.get(key), 'label': LORD_LABEL.get(key, key), 'years': years}


# ════════════════════════════════════════════════════════════════════════
# 1. 框架抽象（QW10）：NakshatraDashaSpec + 月宿种子函数
# ════════════════════════════════════════════════════════════════════════

class NakshatraDashaSpec:
    """一个条件型宿系大运的全部参数(填表即可新增一式)。

    name        : 系统名(英文)。
    total       : 总年数(不变量目标)。
    lords       : [(lord_key, years), …] 主运推进序 + 各主年数(和 == total)。
    seed_fn     : (moon_nak_index_1based) -> 0-based 起主序号(在 lords 内)。
                  实现「从某宿数到月宿 ÷ N 取余」定起主(见 _count_seed_fn)。
    applicable_fn: (ctx) -> bool 适用条件(ctx 为简单 dict；条件不满足仍可手动查看)。
    label       : 中文名(显示用)。
    """

    def __init__(self, name, total, lords, seed_fn, applicable_fn, label=None):
        self.name = name
        self.total = total
        self.lords = list(lords)
        self.seed_fn = seed_fn
        self.applicable_fn = applicable_fn
        self.label = label or name
        # 结构自检：年数和 == total（转录错立即暴露）。
        s = sum(y for _, y in self.lords)
        assert s == total, (name, 'years sum', s, '!=', total)

    def lord_dicts(self):
        return [_lord_dict(k, y) for k, y in self.lords]


def _count_seed_fn(start_nak_1based):
    """生成「从 start 宿数到月宿、对主数取模」的 seed_fn(用于多数式)。

    起主序号 = (月宿序 − start 宿序) mod N。即把 start 宿对到 lords[0]，逐宿循环推进。
    （N = 主数；27 宿对 N 主时按宿序差循环映射，与权威「÷N 取余」一致。）
    """
    def seed_fn(moon_nak_index, lords):
        n = len(lords)
        return (int(moon_nak_index) - int(start_nak_1based)) % n
    return seed_fn


def _count_seed_fn_reverse(end_nak_1based):
    """生成「从月宿数到 end 宿」反向 seed_fn(Dvadashottari 用，方向与正向刻意相反)。

    起主序号 = (end 宿序 − 月宿序) mod N。把 end 宿对到 lords[0]、逆宿序推进。
    """
    def seed_fn(moon_nak_index, lords):
        n = len(lords)
        return (int(end_nak_1based) - int(moon_nak_index)) % n
    return seed_fn


# ── Shashtihayani 专用：含 Abhijit 的 28 宿分组 → 起主（权威分组）────────────
# 8 组(宿名按 astrostudy.nakshatra.NAKSHATRAS + Abhijit)。起主 = 月宿所属组的主。
# Abhijit 介于 Uttara Ashadha 与 Shravana 之间(28 宿)，归 Saturn 组。月落 Abhijit 区段时
# 由 28 宿口径判属(见 shashtihayani_seed_index)，否则按 27 宿名归组。
SHASHTIHAYANI_GROUPS = [
    ('Jupiter', ['Ashwini', 'Bharani', 'Krittika', 'Punarvasu']),
    ('Sun', ['Rohini', 'Mrigashira', 'Ardra', 'Uttara Ashadha']),
    ('Mars', ['Pushya', 'Ashlesha', 'Magha', 'Revati']),
    ('Moon', ['Purva Phalguni', 'Uttara Phalguni', 'Hasta']),
    ('Mercury', ['Swati', 'Vishakha', 'Anuradha']),
    ('Venus', ['Jyeshtha', 'Mula', 'Purva Ashadha']),
    ('Saturn', ['Abhijit', 'Shravana', 'Dhanishta']),
    ('Rahu', ['Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada']),
]
_SHASHTIHAYANI_NAME_TO_LORD = {
    name: lord for lord, names in SHASHTIHAYANI_GROUPS for name in names
}


def shashtihayani_seed_index(moon_nak_index, lords, moon_lon=None, moon_nak_name=None):
    """Shashtihayani 起主序号：月宿(可含 Abhijit 28 宿口径)所属组的主 → lords 内序号。

    优先用 moon_nak_name(若调用方已判 Abhijit 则传 'Abhijit')；否则由 moon_lon 判 Abhijit；
    再否则按 27 宿名归组。返回该组主在 lords 内的 0-based 序号。
    """
    name = moon_nak_name
    if name is None and moon_lon is not None:
        from astrostudy.india.primitives import is_abhijit
        if is_abhijit(moon_lon):
            name = 'Abhijit'
    if name is None:
        # 由 27 宿序取宿名(1-based)。
        name = NAKSHATRAS[(int(moon_nak_index) - 1) % 27][0]
    lord = _SHASHTIHAYANI_NAME_TO_LORD.get(name)
    if lord is None:
        lord = NAKSHATRAS[(int(moon_nak_index) - 1) % 27][2]  # 兜底:用 27 宿主(罕见)
    keys = [k for k, _ in lords]
    return keys.index(lord) if lord in keys else 0


# ════════════════════════════════════════════════════════════════════════
# 2. 适用条件（applicable_fn）—— 简单 panchanga/varga 判定
# ════════════════════════════════════════════════════════════════════════
#
# ctx(条件上下文，由引擎填；缺键时该条件保守判 False，但 dasha 仍可手动计算)：
#   is_day(bool) paksha('Shukla'/'Krishna') weekday(0=Sun..6=Sat)
#   lagna_sign d9_lagna_sign d12_lagna_sign lagna_is_vargottama(bool)
#   tenth_lord_in_tenth(bool) lagna_lord_in_1_or_7(bool) sun_in_lagna(bool)
#   lagna_hora('Sun'/'Moon') —— lagna 升起所在 Hora 之主(日/月)。


def _cond_day_krishna_or_night_shukla(ctx):
    """昼·Krishna 或 夜·Shukla（Shodashottari）。"""
    is_day = ctx.get('is_day')
    paksha = ctx.get('paksha')
    if is_day is None or paksha is None:
        return False
    return (is_day and paksha == 'Krishna') or ((not is_day) and paksha == 'Shukla')


def _cond_lagna_venus_navamsa(ctx):
    """lagna 落金所主之 navamsa(D9 = Taurus / Libra)（Dvadashottari）。"""
    d9 = ctx.get('d9_lagna_sign')
    return d9 in (const.TAURUS, const.LIBRA)


def _cond_lagna_cancer_d12_cancer(ctx):
    """lagna 巨蟹 且 D12 也巨蟹（Panchottari）。"""
    return ctx.get('lagna_sign') == const.CANCER and ctx.get('d12_lagna_sign') == const.CANCER


def _cond_lagna_vargottama(ctx):
    """lagna Vargottama（D1 = D9 同座）（Shatabdika）。"""
    val = ctx.get('lagna_is_vargottama')
    if val is None and ctx.get('lagna_sign') is not None and ctx.get('d9_lagna_sign') is not None:
        return ctx.get('lagna_sign') == ctx.get('d9_lagna_sign')
    return bool(val)


def _cond_tenth_lord_in_tenth(ctx):
    """10 宫主在 10 宫（Chaturashiti-sama）。"""
    return bool(ctx.get('tenth_lord_in_tenth'))


def _cond_lagna_lord_in_1_or_7(ctx):
    """lagna 主在 1 或 7 宫（Dwisaptati-sama）。"""
    return bool(ctx.get('lagna_lord_in_1_or_7'))


def _cond_sun_in_lagna(ctx):
    """太阳在 lagna(1 宫)（Shashtihayani）。"""
    return bool(ctx.get('sun_in_lagna'))


def _cond_day_sunhora_or_night_moonhora(ctx):
    """昼+lagna 在日 Hora / 夜+lagna 在月 Hora（Shattrimsha-sama）。"""
    is_day = ctx.get('is_day')
    hora = ctx.get('lagna_hora')
    if is_day is None or hora is None:
        return False
    return (is_day and hora == 'Sun') or ((not is_day) and hora == 'Moon')


# ════════════════════════════════════════════════════════════════════════
# 3. 8 式 spec 实例（填表即得；不变量在 __init__ 自检）
# ════════════════════════════════════════════════════════════════════════

# Nakshatra 1-based 序(NAKSHATRAS 顺序：Ashwini=1 … Revati=27)。
_NAK = {name: i + 1 for i, (name, _l, _ld) in enumerate(NAKSHATRAS)}

SHODASHOTTARI = NakshatraDashaSpec(
    'Shodashottari', 116,
    [('Sun', 11), ('Mars', 12), ('Jupiter', 13), ('Saturn', 14),
     ('Ketu', 15), ('Moon', 16), ('Mercury', 17), ('Venus', 18)],
    _count_seed_fn(_NAK['Pushya']),                 # Pushya(#8) → 月宿 ÷8
    _cond_day_krishna_or_night_shukla,
    label='十六上行',
)

DVADASHOTTARI = NakshatraDashaSpec(
    'Dvadashottari', 112,
    [('Sun', 7), ('Jupiter', 9), ('Ketu', 11), ('Mercury', 13),
     ('Rahu', 15), ('Mars', 17), ('Saturn', 19), ('Moon', 21)],
    _count_seed_fn_reverse(_NAK['Revati']),         # 月宿 → Revati(#27) ÷8（刻意反向）
    _cond_lagna_venus_navamsa,
    label='十二上行',
)

PANCHOTTARI = NakshatraDashaSpec(
    'Panchottari', 105,
    [('Sun', 12), ('Mercury', 13), ('Saturn', 14), ('Mars', 15),
     ('Venus', 16), ('Moon', 17), ('Jupiter', 18)],
    _count_seed_fn(_NAK['Anuradha']),               # Anuradha(#17) → 月宿 ÷7
    _cond_lagna_cancer_d12_cancer,
    label='百五',
)

SHATABDIKA = NakshatraDashaSpec(
    'Shatabdika', 100,
    [('Sun', 5), ('Moon', 5), ('Venus', 10), ('Mercury', 10),
     ('Jupiter', 20), ('Mars', 20), ('Saturn', 30)],
    _count_seed_fn(_NAK['Revati']),                 # Revati(#27) → 月宿 ÷7（与 Dvadashottari 反向）
    _cond_lagna_vargottama,
    label='百年',
)

CHATURASHITI_SAMA = NakshatraDashaSpec(
    'Chaturashiti-sama', 84,
    [('Sun', 12), ('Moon', 12), ('Mars', 12), ('Mercury', 12),
     ('Jupiter', 12), ('Venus', 12), ('Saturn', 12)],   # 七曜各 12（周日序）
    _count_seed_fn(_NAK['Swati']),                  # Swati(#15) → 月宿 ÷7
    _cond_tenth_lord_in_tenth,
    label='八十四均',
)

DWISAPTATI_SAMA = NakshatraDashaSpec(
    'Dwisaptati-sama', 72,
    [('Sun', 9), ('Moon', 9), ('Mars', 9), ('Mercury', 9),
     ('Jupiter', 9), ('Venus', 9), ('Saturn', 9), ('Rahu', 9)],  # 七曜 + 罗各 9
    _count_seed_fn(_NAK['Mula']),                   # Mula(#19) → 月宿 ÷8
    _cond_lagna_lord_in_1_or_7,
    label='七十二均',
)

SHASHTIHAYANI = NakshatraDashaSpec(
    'Shashtihayani', 60,
    [('Jupiter', 10), ('Sun', 10), ('Mars', 10), ('Moon', 6),
     ('Mercury', 6), ('Venus', 6), ('Saturn', 6), ('Rahu', 6)],
    None,                                           # 专用 28 宿分组 seed(见 build)
    _cond_sun_in_lagna,
    label='六十',
)

SHATTRIMSHA_SAMA = NakshatraDashaSpec(
    'Shattrimsha-sama', 36,
    [('Moon', 1), ('Sun', 2), ('Jupiter', 3), ('Mars', 4),
     ('Mercury', 5), ('Saturn', 6), ('Venus', 7), ('Rahu', 8)],
    _count_seed_fn(_NAK['Shravana']),               # Shravana → 月宿 ÷8
    _cond_day_sunhora_or_night_moonhora,
    label='三十六均',
)

# 全部 8 式（构建/聚合用；顺序 = 总年降序展示）。
CONDITIONAL_SPECS = [
    SHODASHOTTARI, DVADASHOTTARI, PANCHOTTARI, SHATABDIKA,
    CHATURASHITI_SAMA, DWISAPTATI_SAMA, SHASHTIHAYANI, SHATTRIMSHA_SAMA,
]
CONDITIONAL_SPEC_BY_KEY = {
    'shodashottari': SHODASHOTTARI, 'dvadashottari': DVADASHOTTARI,
    'panchottari': PANCHOTTARI, 'shatabdika': SHATABDIKA,
    'chaturashitiSama': CHATURASHITI_SAMA, 'dwisaptatiSama': DWISAPTATI_SAMA,
    'shashtihayani': SHASHTIHAYANI, 'shattrimshaSama': SHATTRIMSHA_SAMA,
}


# ════════════════════════════════════════════════════════════════════════
# 4. 宿系大运 builder（复用 Vimshottari 周期机：主序 + 月宿余比 + 比例子运）
# ════════════════════════════════════════════════════════════════════════

def _sub_periods(lord_dicts, total, parent, parent_years, max_depth, start_offset):
    """通用子运(antardasha/pratyantardasha)：按本式 lords + total 比例细分。

    AD(子=B, 在 MD=A 内)= A_years × B_years / total；逐层同法。
    start_offset：子运起序偏移(AD_START self=0 / next=1)。
    返回相对年(years)，不绑定日期(供 UI 自行换算)。
    """
    keys = [d['key'] for d in lord_dicts]
    idx = keys.index(parent['key'])
    out = []
    for j in range(len(lord_dicts)):
        sub = lord_dicts[(idx + start_offset + j) % len(lord_dicts)]
        sub_years = parent_years * sub['years'] / float(total)
        item = {'lord': sub, 'years': sub_years}
        if max_depth > 2:
            item['pratyantardashas'] = _sub_periods(
                lord_dicts, total, sub, sub_years, max_depth - 1, start_offset)
        out.append(item)
    return out


def build_nakshatra_dasha(spec, moon_lon, moon_nak_index, moon_nak_remaining_ratio,
                          ctx=None, moon_nak_name=None, ad_start=None, max_depth=2,
                          year_length_days=None):
    """按 spec 构建一式条件型宿系大运（与 Vimshottari 同口径，复用其机制）。

    moon_lon                 : 月 sidereal 黄经(Shashtihayani 判 Abhijit 用)。
    moon_nak_index           : 月宿序 1-27(种子函数用)。
    moon_nak_remaining_ratio : 月在本宿剩余比(0,1](起运余额用；= 1 − 宿内进度)。
    ctx                      : 适用条件上下文(见「适用条件」节)；缺则条件判 False。
    ad_start                 : 子运起序覆盖('self'/'next'；默认全局 AD_START)。

    起运余额 = 起主满期 × 月宿剩余比(权威共通口径：lord_years × 未走弧/宿全长)。
    主运按 lords 序排满「总年」(覆盖到全周期，多式 < 120 年故排到周期收尾)。
    返回 {available, reason?, system, totalYears, firstLord, firstBalanceYears,
          mahadashas:[{lord, years, balance(bool), antardashas}], …}。
    返回恒含 mahadashas（条件不满足时 available=False 但仍可手动查看）。
    """
    ad_start = ad_start or AD_START
    start_offset = 1 if ad_start == AD_START_NEXT else 0
    lord_dicts = spec.lord_dicts()
    total = spec.total

    # 起主序号：Shashtihayani 用 28 宿分组，其余用 spec.seed_fn。
    if spec is SHASHTIHAYANI:
        start_idx = shashtihayani_seed_index(
            moon_nak_index, [(d['key'], d['years']) for d in lord_dicts],
            moon_lon=moon_lon, moon_nak_name=moon_nak_name)
    else:
        start_idx = spec.seed_fn(moon_nak_index, [(d['key'], d['years']) for d in lord_dicts])

    start_lord = lord_dicts[start_idx]
    first_balance = start_lord['years'] * float(moon_nak_remaining_ratio)
    first_elapsed = start_lord['years'] - first_balance

    # 排满主运到本式总年(首运用余额；其余满期)。覆盖一整轮 = len(lords) 项。
    maha = []
    n = len(lord_dicts)
    for i in range(n):
        it = lord_dicts[(start_idx + i) % n]
        years = first_balance if i == 0 else it['years']
        subs = _sub_periods(lord_dicts, total, it, years, max_depth, start_offset) \
            if max_depth >= 2 else []
        maha.append({
            'lord': it,
            'years': years,
            'fullYears': it['years'],
            'balance': i == 0,
            'antardashas': subs,
        })

    # 适用条件(缺 ctx 则 None → 判 False，但仍给 mahadashas)。
    applicable = bool(spec.applicable_fn(ctx)) if ctx is not None else False
    result = {
        'available': applicable,
        'system': spec.name,
        'label': spec.label,
        'totalYears': total,
        'yearMode': year_mode_of(year_length_days) if year_length_days else YEAR_MODE,
        'yearLengthDays': float(year_length_days) if year_length_days else year_days(),
        'adStart': ad_start,
        'lords': lord_dicts,
        'firstLord': start_lord,
        'firstBalanceYears': first_balance,
        'firstElapsedYears': first_elapsed,
        'moonNakshatraIndex': moon_nak_index,
        'moonNakRemainingRatio': float(moon_nak_remaining_ratio),
        'mahadashas': maha,
    }
    if not applicable:
        result['reason'] = 'condition_not_met'
    return result


def build_all_conditional_dashas(moon_lon, moon_nak_index, moon_nak_remaining_ratio,
                                 ctx=None, moon_nak_name=None, ad_start=None, max_depth=2,
                                 year_length_days=None):
    """聚合全部 8 式条件型宿系大运 → {key: result}。

    key ∈ {shodashottari, dvadashottari, panchottari, shatabdika,
           chaturashitiSama, dwisaptatiSama, shashtihayani, shattrimshaSama}。
    """
    out = {}
    for key, spec in CONDITIONAL_SPEC_BY_KEY.items():
        out[key] = build_nakshatra_dasha(
            spec, moon_lon, moon_nak_index, moon_nak_remaining_ratio,
            ctx=ctx, moon_nak_name=moon_nak_name, ad_start=ad_start, max_depth=max_depth,
            year_length_days=year_length_days)
    return out


# ════════════════════════════════════════════════════════════════════════
# 5. Chara dasha（Jaimini，权威口径变体）—— 12 连续星座 + 奇偶定向
# ════════════════════════════════════════════════════════════════════════
#
# 与 Narayana 区别：Chara = 连续宫 + 奇偶定向；Narayana = Brahma/Vishnu/Shiva 跳 +
# 奇足/偶足定向。这是两套不同 dasha，勿混。期长口径与 Narayana 的「数到主星宫 −1」
# 同核(故复用 rasi_dasha 的强主/旺落判定)，但 **数的方向按各宫自身奇偶**(非奇足)。

# classic 变体双主宫取主：Sc = Ketu(若占座/较强)否则 Mars；Aq = Rahu 否则 Saturn。
_CHARA_DUAL_CLASSIC = {
    const.SCORPIO: (const.SOUTH_NODE, const.MARS),   # (优先节点, 否则传统主)
    const.AQUARIUS: (const.NORTH_NODE, const.SATURN),
}


def _chara_lord(sign, planet_signs, planet_lons=None):
    """Chara 某宫之主。

    单主宫直接返回。双主宫(Sc/Aq)按变体取主：
      - classic(默认)：节点若占该座 → 取节点；否则取传统主(火/土)。
      - stronger     ：用 rasi_dasha 行星 5 级强弱序择强主(_stronger_lord)。
    """
    if sign not in _CHARA_DUAL_CLASSIC:
        return SIGN_LORDS[sign]
    if CHARA_VARIANT == 'stronger':
        return _stronger_lord(sign, planet_signs, planet_lons=planet_lons)
    node, trad = _CHARA_DUAL_CLASSIC[sign]
    # classic：节点占该座(罗/计落在本宫)→ 取节点，否则取传统主。
    if planet_signs.get(node) == sign:
        return node
    return trad


def chara_period_years(dasa_sign, planet_signs, planet_lons=None,
                       count_direction=None, dignity_rule='plus_minus_one'):
    """Chara 法期长(年)：从 dasa rasi 数到「其主星所在宫」− 1。

    规则(权威口径)：
      - 数向：dasa rasi **奇宫 → 顺数 / 偶宫 → 逆数**(注意：非奇足；与 Narayana 不同)。
      - 距离 − 1 = 年；主在本座(距离 1)→ 12 年。
      - 主旺 → +1；落 → −1（钳 [1,12]）。
      - 双主宫按变体取主(见 _chara_lord)。
    返回 int 年(1..12)。
    """
    lord = _chara_lord(dasa_sign, planet_signs, planet_lons)
    lord_sign = planet_signs.get(lord)
    if lord_sign is None:
        return 12                                   # 主缺位 → 退本宫(12 年)
    if count_direction is not None:
        # 主流口径:按大运全序方向统一数(顺=+1/逆=−1),含端。
        if count_direction == 1:
            dist = ((index_of(lord_sign) - index_of(dasa_sign)) % 12) + 1
        else:
            dist = ((index_of(dasa_sign) - index_of(lord_sign)) % 12) + 1
    elif dasa_sign in ODD_SIGNS:
        dist = ((index_of(lord_sign) - index_of(dasa_sign)) % 12) + 1   # 顺数(含本宫=1)
    else:
        dist = ((index_of(dasa_sign) - index_of(lord_sign)) % 12) + 1   # 逆数
    years = dist - 1
    if years <= 0:
        years = 12
    if dignity_rule == 'none':
        return years
    if is_exalted_in(lord, lord_sign):
        years += 1
    elif is_debilitated_in(lord, lord_sign):
        years -= 1
    return max(1, min(12, years))


def _chara_direction(lagna_sign):
    """Chara 整序方向：lagna 奇宫 → 顺(+1) / 偶宫 → 逆(−1)。"""
    return 1 if lagna_sign in ODD_SIGNS else -1


def _chara_antardashas(dasa_sign, direction, planet_signs, planet_lons=None,
                       antar_first='dasa_sign_first', count_direction=None,
                       dignity_rule='plus_minus_one'):
    """某 Chara 主运的子运(AD)：从 dasa rasi 起、同方向连续 12 宫。

    子运期长按各 AD 宫的 chara_period_years 占主运 12-rasi 期长和的比例分配总年。
    （这里给「相对年比例」的等价：AD_years = MD_years × ad_period / Σ(ad_period)。
    主运实际年由上层定，子运返回相对占比 + 该宫自身期长以备 UI 切换等分/按主期。）
    """
    seed_idx = index_of(dasa_sign)
    ad_signs = [sign_at(seed_idx + direction * i) for i in range(12)]
    if antar_first == 'dasa_sign_last':
        # 变体:中运自次座起、大运座本身排最后(同方向旋转一位)。
        ad_signs = ad_signs[1:] + ad_signs[:1]
    periods = [chara_period_years(s, planet_signs, planet_lons,
                                  count_direction=count_direction, dignity_rule=dignity_rule)
               for s in ad_signs]
    total = sum(periods) or 12
    out = []
    for s, p in zip(ad_signs, periods):
        out.append({
            'rasi': s,
            'rasiLabel': _SIGN_LABEL.get(s, s),
            'periodYears': p,                       # 该宫自身 Chara 期长(供等分/按主期切换)
            'ratio': p / float(total),              # 占主运的比例(按主期分时用)
            'lord': _chara_lord(s, planet_signs, planet_lons),
        })
    return out


_SIGN_LABEL = {
    const.ARIES: '白羊', const.TAURUS: '金牛', const.GEMINI: '双子', const.CANCER: '巨蟹',
    const.LEO: '狮子', const.VIRGO: '处女', const.LIBRA: '天秤', const.SCORPIO: '天蝎',
    const.SAGITTARIUS: '射手', const.CAPRICORN: '摩羯', const.AQUARIUS: '水瓶', const.PISCES: '双鱼',
}


# 奇足(Visama-pada)/偶足(Sama-pada)集(权威口径:奇足 = 白羊·金牛·双子·天秤·天蝎·人马)。
# 🔴 与奇/偶「象」不同(狮子是奇象但偶足)——足性专用于座运方向判据。
_ODD_FOOTED = {const.ARIES, const.TAURUS, const.GEMINI, const.LIBRA, const.SCORPIO, const.SAGITTARIUS}


def chara_dasha(lagna_sign, planet_signs, planet_lons=None, variant=None, with_antardashas=True,
                direction_rule='lagna_parity_sign', dignity_rule='plus_minus_one',
                antar_first='dasa_sign_first'):
    """Chara 大运（Jaimini，权威口径变体）。

    起点 = lagna；序列 = 从 lagna 起 **12 个连续星座**(非 kendra/trinal 跳)；
    方向 = lagna 奇宫 → 顺 / 偶宫 → 逆；期长 = chara_period_years(数到主宫 −1)。
    双主宫(Sc/Aq)取主变体 variant ∈ {'classic'(默认), 'stronger'}(临时覆盖全局 CHARA_VARIANT)。

    返回 {system, variant, seed(=lagna), direction, order(12 rasi),
          mahadashas:[{rasi, rasiLabel, years, quality, lord, antardashas?}]}。
    12 个主运覆盖全部星座(顺/逆连续一圈)。
    """
    global CHARA_VARIANT
    saved = CHARA_VARIANT
    if variant is not None:
        CHARA_VARIANT = variant
    try:
        if direction_rule == 'ninth_foot':
            # 主流口径:自 Lagna 第 9 座足性定全序方向(奇足→顺/偶足→逆);
            # 期长 count-to-lord 亦按全序方向数(非逐座奇偶)。
            ninth = sign_at(index_of(lagna_sign) + 8)
            direction = 1 if ninth in _ODD_FOOTED else -1
            count_dir = direction
        else:
            direction = _chara_direction(lagna_sign)
            count_dir = None                        # 现状:逐座按自身奇/偶象定数向
        seed_idx = index_of(lagna_sign)
        order = [sign_at(seed_idx + direction * i) for i in range(12)]
        maha = []
        for rasi in order:
            years = chara_period_years(rasi, planet_signs, planet_lons,
                                       count_direction=count_dir, dignity_rule=dignity_rule)
            item = {
                'rasi': rasi,
                'rasiLabel': _SIGN_LABEL.get(rasi, rasi),
                'years': years,
                'quality': quality(rasi),
                'lord': _chara_lord(rasi, planet_signs, planet_lons),
            }
            if with_antardashas:
                item['antardashas'] = _chara_antardashas(
                    rasi, direction, planet_signs, planet_lons,
                    antar_first=antar_first, count_direction=count_dir, dignity_rule=dignity_rule)
            maha.append(item)
        return {
            'system': 'Chara',
            'variant': CHARA_VARIANT,
            'directionRule': direction_rule,
            'dignityRule': dignity_rule,
            'seed': lagna_sign,
            'seedLabel': _SIGN_LABEL.get(lagna_sign, lagna_sign),
            'direction': 'forward' if direction == 1 else 'reverse',
            'order': list(order),
            'mahadashas': maha,
        }
    finally:
        CHARA_VARIANT = saved


# ════════════════════════════════════════════════════════════════════════
# 6. 顶层聚合（供引擎接 extendedDashas 键）
# ════════════════════════════════════════════════════════════════════════

def build_extended_dashas(inputs):
    """聚合「条件型宿系 8 式 + Chara」→ extendedDashas。

    inputs(简单 dict，由排盘引擎填)：
      lagna_sign               : ASC 所在 rasi(Chara 必填)。
      planet_signs             : {planet_id: sign}(Chara 期长/双主主用)。
      planet_lons              : {planet_id: 黄经}(可选；'stronger' 变体末级 tiebreak 用)。
      moon_lon                 : 月 sidereal 黄经(Shashtihayani 判 Abhijit)。
      moon_nak_index           : 月宿序 1-27(8 式种子)。
      moon_nak_name            : 月宿名(可选；Shashtihayani 分组优先用)。
      moon_nak_remaining_ratio : 月在本宿剩余比(0,1](起运余额)。
      conditionContext         : 适用条件上下文(见「适用条件」节；缺则各式 available=False 但可手算)。
      charaVariant             : Chara 双主取主变体(可选)。

    返回 {available, conditional:{8 式}, chara:{…}}。缺月宿则 conditional 降级。
    """
    lagna = inputs.get('lagna_sign')
    planet_signs = inputs.get('planet_signs') or {}
    planet_lons = inputs.get('planet_lons')
    if lagna is None:
        return {'available': False, 'reason': 'missing_lagna'}

    out = {'available': True}

    moon_nak_index = inputs.get('moon_nak_index')
    remaining = inputs.get('moon_nak_remaining_ratio')
    if moon_nak_index is not None and remaining is not None:
        out['conditional'] = build_all_conditional_dashas(
            inputs.get('moon_lon'), moon_nak_index, remaining,
            ctx=inputs.get('conditionContext'),
            moon_nak_name=inputs.get('moon_nak_name'),
            year_length_days=inputs.get('year_length_days'))
    else:
        out['conditional'] = {'available': False, 'reason': 'missing_moon_nakshatra'}

    _dv = inputs.get('dashaVariants') or {}
    out['chara'] = chara_dasha(
        lagna, planet_signs, planet_lons, variant=inputs.get('charaVariant'),
        direction_rule=_dv.get('charaDirection', 'lagna_parity_sign'),
        dignity_rule=_dv.get('charaDignity', 'plus_minus_one'),
        antar_first=_dv.get('rasiAntarFirst', 'dasa_sign_first'))
    return out


# ── 模块导入即跑：8 式总年不变量自检（spec.__init__ 已逐式 assert；这里汇总再保险）──
def _validate_totals():
    """8 式各「主运年数之和 == 该式总年」(转录错立即暴露，不拖到运行期)。"""
    expected = {
        'Shodashottari': 116, 'Dvadashottari': 112, 'Panchottari': 105,
        'Shatabdika': 100, 'Chaturashiti-sama': 84, 'Dwisaptati-sama': 72,
        'Shashtihayani': 60, 'Shattrimsha-sama': 36,
    }
    for spec in CONDITIONAL_SPECS:
        s = sum(y for _, y in spec.lords)
        assert s == expected[spec.name] == spec.total, (spec.name, s, spec.total)


_validate_totals()
