"""请求级古典口径的表与换表开关:界系各表(埃及 / 托勒密 / 莉莉 / 迦勒底 / 自定义)、托勒密三分表、旺位异文、落宫宫头前移、尊贵计分表(由排盘模块整段搬出,astrostudy.perchart 照旧可取这些名字)。

界系与三分集的 push/pop、请求优先级车道、七族统一入口仍在排盘模块门面 astrostudy.perchart:它们改写的模块级槽位由 PerChart.setupPlanets 读取,车道参数也有测试直接在 perchart 上改写,必须与读取方同住一个模块。"""
import copy
import threading
import math
from flatlib import const
from flatlib import object
from flatlib.dignities import essential
from flatlib.dignities import tables


# 界系(bounds/terms)三套表:0 埃及(默认)/1 托勒密 Tetrabiblos/2 莉莉。essential.TERMS 是模块级全局,
# 所有界主相关计算(尊贵/界主/互容接纳/围攻日木互容/主限法界)都读它。CherryPy 多线程下:/chart 请求级
# 用锁包住「换表→整盘计算(尊贵+接纳+围攻+predictives)→还原」,防并发请求串界;默认 0=埃及 与现状逐字一致。
_TERMS_TABLES = [tables.EGYPTIAN_TERMS, tables.TETRABIBLOS_TERMS, tables.LILLY_TERMS]
# G15 托勒密界·狮子土星优先变体:狮子段首星 Jupiter↔Saturn 互换(度界 0-6/13-19 不变),余座同托勒密。
# 默认走 _TERMS_TABLES[1](木优先);仅 leoBoundFirst 且 termsVariant==1 时换本表。
_TETRABIBLOS_LEO_SATURN_FIRST = copy.deepcopy(tables.TETRABIBLOS_TERMS)
_TETRABIBLOS_LEO_SATURN_FIRST['Leo'] = [['Saturn', 0, 6], ['Mercury', 6, 13], ['Jupiter', 13, 19], ['Venus', 19, 25], ['Mars', 25, 30]]

# 托勒密界·经典传本(termsVariant==2)双子界4/5 校勘口径:原书 ♄21–25/♂25–30 → 校勘本对调 ♂21–25/♄25–30。
# 仅 geminiBoundEmended 且 termsVariant==2 时换本表;默认忠原书(零回归)。与 leoBoundFirst 同款请求级开关。
_LILLY_GEMINI_EMENDED = copy.deepcopy(tables.LILLY_TERMS)
_LILLY_GEMINI_EMENDED['Gemini'] = [['Mercury', 0, 7], ['Jupiter', 7, 14], ['Venus', 14, 21], ['Mars', 21, 25], ['Saturn', 25, 30]]

# G15 迦勒底界(界系 3·推演慎用):宽度 [8,7,6,5,4](和 30),星序按元素昼序;夜盘土↔水位置互换。
# 仅白羊有源、余按规则推演(故 UI 标「推演·慎用」)。按 sect 预生成昼/夜两表,perchart 据 isDiurnal 选。
_CHALDEAN_WIDTHS = [8, 7, 6, 5, 4]
_CHALDEAN_DAY_ORDER = {
    'Fire':  ['Jupiter', 'Venus', 'Saturn', 'Mercury', 'Mars'],
    'Earth': ['Venus', 'Saturn', 'Mercury', 'Mars', 'Jupiter'],
    'Air':   ['Saturn', 'Mercury', 'Mars', 'Jupiter', 'Venus'],
    'Water': ['Mercury', 'Venus', 'Saturn', 'Mars', 'Jupiter'],
}
_CHALDEAN_SIGN_ELEMENT = {
    'Aries': 'Fire', 'Leo': 'Fire', 'Sagittarius': 'Fire',
    'Taurus': 'Earth', 'Virgo': 'Earth', 'Capricorn': 'Earth',
    'Gemini': 'Air', 'Libra': 'Air', 'Aquarius': 'Air',
    'Cancer': 'Water', 'Scorpio': 'Water', 'Pisces': 'Water',
}

def _build_chaldean_terms(night=False):
    tbl = {}
    for sign, elem in _CHALDEAN_SIGN_ELEMENT.items():
        order = list(_CHALDEAN_DAY_ORDER[elem])
        if night:   # 夜盘:土↔水位置互换
            si, mi = order.index('Saturn'), order.index('Mercury')
            order[si], order[mi] = order[mi], order[si]
        segs, start = [], 0
        for lord, w in zip(order, _CHALDEAN_WIDTHS):
            segs.append([lord, start, start + w]); start += w
        tbl[sign] = segs
    return tbl

_CHALDEAN_TERMS_DAY = _build_chaldean_terms(False)
_CHALDEAN_TERMS_NIGHT = _build_chaldean_terms(True)
_PERCHART_TERMS_LOCK = threading.Lock()


def parse_terms_variant(v):
    """界系入参 → 合法 0/1/2/3/4(非法回落 0=埃及)。3=迦勒底界(推演慎用);4=自定义界表([WP-7])。"""
    try:
        tv = int(v)
    except (TypeError, ValueError):
        tv = 0
    return tv if tv in (0, 1, 2, 3, 4) else 0


# 自定义界表:表体 = [[["jupiter",6],["venus",6],...]×12](白羊..双鱼序,每座 5 界 [星,宽度],
# 宽度和恒 30)。夜表槽为模块级(terms 锁内读写安全;push 设/pop 清,照迦勒底夜表消费范式)。
_CUSTOM_TERMS_SIGNS = ('Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
                       'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces')
_CUSTOM_TERMS_STARS = {'sun': const.SUN, 'moon': const.MOON, 'mercury': const.MERCURY, 'venus': const.VENUS,
                       'mars': const.MARS, 'jupiter': const.JUPITER, 'saturn': const.SATURN}


def _buildCustomTermsTable(rows):
    """表体 → flatlib TERMS 形({Sign:[[Star,start,end]×5]});任何非法(缺座/界数≠5/星名未知/
    宽度非正/合计≠30)返回 None(调用方整表回落埃及,绝不半表上盘)。"""
    try:
        if not isinstance(rows, list) or len(rows) != 12:
            return None
        out = {}
        for i, sign in enumerate(_CUSTOM_TERMS_SIGNS):
            row = rows[i]
            if not isinstance(row, list) or len(row) != 5:
                return None
            acc = 0.0
            cells = []
            for cell in row:
                star = _CUSTOM_TERMS_STARS.get(str(cell[0]).strip().lower())
                width = float(cell[1])
                # NaN 宽度会同时骗过 width<=0 与 abs(acc-30)>eps 两判(NaN 比较恒 False)→ isfinite 前置。
                if star is None or (not math.isfinite(width)) or width <= 0:
                    return None
                cells.append([star, acc, acc + width])
                acc += width
            if abs(acc - 30.0) > 1e-9:
                return None
            out[sign] = cells
        return out
    except Exception:
        return None


# G20-P2 三分集变体:默认 Dorothean(=ESSENTIAL_DIGNITIES,零回归);Ptolemaic 二主(无共同主、水象单主火星)。
# essential.TABLE 是模块级全局(尊贵评分/almuten 读 trip);请求级换表(同 terms 机制,独立锁)。
_PTOL_TRIP = {
    'Fire': ['Sun', 'Jupiter', ''], 'Earth': ['Venus', 'Moon', ''],
    'Air': ['Saturn', 'Mercury', ''], 'Water': ['Mars', 'Mars', ''],
}

def _build_ptolemaic_dignities():
    tbl = copy.deepcopy(tables.ESSENTIAL_DIGNITIES)
    for sign, elem in _CHALDEAN_SIGN_ELEMENT.items():
        if sign in tbl:
            tbl[sign]['trip'] = list(_PTOL_TRIP[elem])
    return tbl

_PTOLEMAIC_DIGNITIES = _build_ptolemaic_dignities()

# PtolemaicWaterVariant(托勒密·水象变体):火/土/风三象同托勒密二主;唯水象座(巨蟹/天蝎/双鱼)
# 改取另一套水象主星——昼盘 火主+金次、夜盘 火主+月次(对齐前端 triplicityRulers.js / hellenisticData
# Water.text_variant: day=[Mars,Venus] / night=[Mars,Moon])。
# essential.score()/getInfo() 非 sect-aware(dayTrip/nightTrip 一律各 +3,不查 isDiurnal),
# 故单张静态 trip 三元无法把「昼第二主=金、夜第二主=月」的区别投影到评分上(两套的曜集合都是 {火,金,月},
# 与默认水象 [Venus,Mars,Moon] 同集合→评分塌成默认)。因此按 sect 预生成昼/夜两表:
#   昼:水象 trip=[Mars, Venus, '']  → 评分计 火(昼主)+金(昼次)
#   夜:水象 trip=[Mars, Moon,  '']  → 评分计 火(夜主)+月(夜次)
# push_request_trip 先置昼表(锁内),夜盘由 perchart.setupPlanets 据 isDiurnal 换夜表(同迦勒底界夜表机制)。
_PTOL_WATER_TRIP_DAY = ['Mars', 'Venus', '']
_PTOL_WATER_TRIP_NIGHT = ['Mars', 'Moon', '']

def _build_ptolemaic_water_variant_dignities(night=False):
    # 起点=普通托勒密表(火/土/风三象二主不变),仅水象座覆盖为昼/夜专表 → 非水象座与 Ptolemaic 字节一致。
    tbl = copy.deepcopy(_PTOLEMAIC_DIGNITIES)
    water_trip = _PTOL_WATER_TRIP_NIGHT if night else _PTOL_WATER_TRIP_DAY
    for sign, elem in _CHALDEAN_SIGN_ELEMENT.items():
        if elem == 'Water' and sign in tbl:
            tbl[sign]['trip'] = list(water_trip)
    return tbl

_PTOLEMAIC_WATER_VARIANT_DIGNITIES_DAY = _build_ptolemaic_water_variant_dignities(night=False)
_PTOLEMAIC_WATER_VARIANT_DIGNITIES_NIGHT = _build_ptolemaic_water_variant_dignities(night=True)
_PERCHART_TRIP_LOCK = threading.Lock()


# ── 旺位异文开关(月交点旺)请求级参数化 ────────────────────
# 改 essential.TABLE 的 exalt/fall 位 ⇒ 会动全盘尊贵计分,故默认关(零回归),
# 仅显式开启才 锁+换表,finally 配对 pop。照 push_request_trip 同款范式(pop(None)=no-op)。
#   nodeExaltation:北交旺 3°双子 / 南交旺 3°射手(对宫互为落);少数派传统,文档标「可作软件开关」。
#   (saturnExalt20 已删档 2026-08-18 用户拍板:degree 位全仓零消费者=真死开关。)
# 🔴 必须用独立锁:本开关叠加在 push_request_trip 之后(同线程),复用 _PERCHART_TRIP_LOCK 会自锁死。
#    两者串行嵌套(trip 先 push、exalt 后 push;pop 反序),各自持锁不交叉,无 ABBA 风险。
_PERCHART_EXALT_LOCK = threading.Lock()


def _build_dignities_variant(base_table, node_exalt=False):
    """在给定基表上叠加旺位异文;不改基表本身(深拷贝)。"""
    tbl = copy.deepcopy(base_table)
    if node_exalt:
        # 交点无 ruler/trip/face 语义,仅置 exalt/fall 两位(essential.score 只查这两处)
        if 'Gemini' in tbl:
            tbl['Gemini']['exalt'] = [const.NORTH_NODE, 3]
            tbl['Gemini']['fall'] = [const.SOUTH_NODE, 3]
        if 'Sagittarius' in tbl:
            tbl['Sagittarius']['exalt'] = [const.SOUTH_NODE, 3]
            tbl['Sagittarius']['fall'] = [const.NORTH_NODE, 3]
    return tbl


def _truthy(v):
    return v in (1, '1', True, 'true', 'True')


def push_request_exalt_variants(nodeExaltation=None):
    """请求级旺位异文:关 → 不 push(返回 None,零锁开销零回归);开 → 锁+叠加换表。
    在当前 essential.TABLE(可能已被 push_request_trip 换成托勒密表)之上叠加,故两层可共存。"""
    node_on = _truthy(nodeExaltation)
    if not node_on:
        return None
    _PERCHART_EXALT_LOCK.acquire()
    orig = essential.TABLE
    essential.TABLE = _build_dignities_variant(orig, node_exalt=node_on)
    return orig


def pop_request_exalt_variants(token):
    """还原 essential.TABLE 并释放锁;token=None(未 push)时安全 no-op。"""
    if token is None:
        return
    try:
        essential.TABLE = token
    finally:
        _PERCHART_EXALT_LOCK.release()


# ── 落宫宫头前移(five-degree rule)请求级参数化 ─────────────────────────────
# flatlib House._OFFSET 是类全局(-5.0=传统 5° 律):象限制 inHouse 以 [cusp+OFFSET, +size) 收纳,
# 星距下一宫头 |OFFSET|° 内前移入下一宫;整宫制分支天然豁免(无偏移)。落宫输出(object.house/
# house.planets/四角 house)全走 getHouseByLon→inHouse → 换 OFFSET 即全站落宫随动,且随当前 hsys 宫表。
# 照 push_request_trip 范式:默认 5° 不 push(零回归零锁开销);仅非默认才 锁+换值,finally 配对 pop。
_PERCHART_HOUSE_OFFSET_LOCK = threading.Lock()
_HOUSE_CUSP_ADVANCE_DEFAULT = 5.0

def _optional_float(v):
    """None/缺省/畸形 → None(调用方回落现值);数字/数串 → float。"""
    if v is None or v == '':
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_house_cusp_advance(v):
    """收编 houseCuspAdvance(度):仅认 0/1/3/5,缺省/畸形一律回 5=现状。"""
    try:
        n = float(v)
    except (TypeError, ValueError):
        return _HOUSE_CUSP_ADVANCE_DEFAULT
    return n if n in (0.0, 1.0, 3.0, 5.0) else _HOUSE_CUSP_ADVANCE_DEFAULT

def push_request_house_offset(houseCuspAdvance):
    """请求级换 House._OFFSET;返回还原令牌(原值)或 None(默认未 push)。必须 finally 配对 pop。"""
    adv = parse_house_cusp_advance(houseCuspAdvance)
    if adv == _HOUSE_CUSP_ADVANCE_DEFAULT:
        return None
    _PERCHART_HOUSE_OFFSET_LOCK.acquire()
    orig = object.House._OFFSET
    object.House._OFFSET = -adv
    return orig

def pop_request_house_offset(token):
    """还原 House._OFFSET 并释放锁;token=None(未 push)时安全 no-op。"""
    if token is None:
        return
    try:
        object.House._OFFSET = token
    finally:
        _PERCHART_HOUSE_OFFSET_LOCK.release()


# ── 必然尊贵计分表请求级参数化(dignityDebilities=0 → fall/exile 不减分) ──
# essential.SCORES 是模块级全局(essential.score/getInfo 消费=显赫计分/almuten/择日 getInfo);
# 照 terms 范式:默认(1=减分现状)不 push 零锁开销,仅显式关闭才 锁+换表,finally 配对 pop。
_PERCHART_SCORES_LOCK = threading.Lock()

def push_request_scores(dignityDebilities):
    on_default = str(dignityDebilities) not in ('0', 'false', 'False')
    if on_default:
        return None
    _PERCHART_SCORES_LOCK.acquire()
    orig = essential.SCORES
    nos = dict(orig)
    nos['fall'] = 0
    nos['exile'] = 0
    essential.SCORES = nos
    return orig

def pop_request_scores(token):
    if token is None:
        return
    try:
        essential.SCORES = token
    finally:
        _PERCHART_SCORES_LOCK.release()
