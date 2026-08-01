import math

from flatlib import const
from flatlib import utils


VARGA_ENGINE_VERSION = 'india_kernel_varga_v2'


VARGA_DEFINITIONS = {
    1: {'key': 'd1', 'name': 'Rashi', 'label': 'D1 Rashi'},
    2: {'key': 'd2', 'name': 'Hora', 'label': 'D2 Hora'},
    3: {'key': 'd3', 'name': 'Drekkana', 'label': 'D3 Drekkana'},
    4: {'key': 'd4', 'name': 'Chaturthamsa', 'label': 'D4 Chaturthamsa'},
    5: {'key': 'd5', 'name': 'Panchamsa', 'label': 'D5 Panchamsa'},
    6: {'key': 'd6', 'name': 'Shashthamsa', 'label': 'D6 Shashthamsa'},
    7: {'key': 'd7', 'name': 'Saptamsa', 'label': 'D7 Saptamsa'},
    8: {'key': 'd8', 'name': 'Ashtamsa', 'label': 'D8 Ashtamsa'},
    9: {'key': 'd9', 'name': 'Navamsa', 'label': 'D9 Navamsa'},
    10: {'key': 'd10', 'name': 'Dasamsa', 'label': 'D10 Dasamsa'},
    11: {'key': 'd11', 'name': 'Rudramsa', 'label': 'D11 Rudramsa'},
    12: {'key': 'd12', 'name': 'Dwadasamsa', 'label': 'D12 Dwadasamsa'},
    16: {'key': 'd16', 'name': 'Shodasamsa', 'label': 'D16 Shodasamsa'},
    20: {'key': 'd20', 'name': 'Vimsamsa', 'label': 'D20 Vimsamsa'},
    24: {'key': 'd24', 'name': 'Chaturvimsamsa', 'label': 'D24 Chaturvimsamsa'},
    27: {'key': 'd27', 'name': 'Nakshatramsa', 'label': 'D27 Nakshatramsa'},
    30: {'key': 'd30', 'name': 'Trimsamsa', 'label': 'D30 Trimsamsa'},
    40: {'key': 'd40', 'name': 'Khavedamsa', 'label': 'D40 Khavedamsa'},
    45: {'key': 'd45', 'name': 'Akshavedamsa', 'label': 'D45 Akshavedamsa'},
    60: {'key': 'd60', 'name': 'Shashtiamsa', 'label': 'D60 Shashtiamsa'},
}


ODD_SIGNS = {0, 2, 4, 6, 8, 10}
MOVABLE_SIGNS = {0, 3, 6, 9}
FIXED_SIGNS = {1, 4, 7, 10}
FIRE_SIGNS = {0, 4, 8}
EARTH_SIGNS = {1, 5, 9}
AIR_SIGNS = {2, 6, 10}


def normalize_chartnum(chartnum):
    try:
        value = int(chartnum)
    except Exception:
        value = 1
    return value if value in VARGA_DEFINITIONS else 1


def get_supported_vargas():
    return [dict({'chartnum': chartnum}, **VARGA_DEFINITIONS[chartnum])
            for chartnum in sorted(VARGA_DEFINITIONS.keys())]


def _part(degree_in_sign, chartnum):
    interval = 30.0 / chartnum
    value = int(math.floor(degree_in_sign / interval))
    return min(max(value, 0), chartnum - 1)


def _scaled_degree(degree_in_sign, chartnum):
    interval = 30.0 / chartnum
    part = _part(degree_in_sign, chartnum)
    return ((degree_in_sign - part * interval) / interval) * 30.0


def _modality_start(sign_index, movable=0, fixed=4, dual=8):
    if sign_index in MOVABLE_SIGNS:
        return movable
    if sign_index in FIXED_SIGNS:
        return fixed
    return dual


def _element_start_for_d9(sign_index):
    if sign_index in FIRE_SIGNS:
        return 0
    if sign_index in EARTH_SIGNS:
        return 9
    if sign_index in AIR_SIGNS:
        return 6
    return 3


def _element_start_for_d27(sign_index):
    if sign_index in FIRE_SIGNS:
        return 0
    if sign_index in EARTH_SIGNS:
        return 3
    if sign_index in AIR_SIGNS:
        return 6
    return 9


def _d30_position(sign_index, degree_in_sign):
    is_odd = sign_index in ODD_SIGNS
    if is_odd:
        ranges = [
            (0.0, 5.0, 0),
            (5.0, 10.0, 10),
            (10.0, 18.0, 8),
            (18.0, 25.0, 2),
            (25.0, 30.0, 6),
        ]
    else:
        ranges = [
            (0.0, 5.0, 1),
            (5.0, 12.0, 5),
            (12.0, 20.0, 11),
            (20.0, 25.0, 9),
            (25.0, 30.0, 7),
        ]
    for start, end, target_sign in ranges:
        if degree_in_sign < end or end == 30.0:
            span = end - start
            degree = ((degree_in_sign - start) / span) * 30.0 if span else 0.0
            return target_sign, max(0.0, min(degree, 29.999999999))
    return ranges[-1][2], 0.0


# 分盘变体（大运§9.2 / 09_chartcasting）：默认 None/'standard' = 标准 Parāśara（零回归，既有 golden 不变）。
# 已实现 D2 parivritti/kashinatha · D3 parivritti/jagannatha/somanatha · D24 correct · D30 equal(公式 _agentA_chartcasting.md)。
# D2 Kashinatha 依源座主星(_D2_KASH_DAY/NIGHT)、D3 Somanatha 奇象自白羊顺/偶象自双鱼逆。
_D3_JAGANNATHA = {0: (0, 4, 8), 1: (8, 0, 4), 2: (4, 8, 0)}


# D60 Ṣaṣṭyāṃśa 吉凶(09_chartcasting §D60):奇象恶段(Krūra)24 个段号;偶象神名逆序(deity=61−seg)+吉凶随之。
# 恶段(Krūra)24 个段号 = BPHS 权威的「按段号」吉凶编码(名义与段号冲突时以段号为准,_agentA_chartcasting.md:419)。偶象逆读 deity=61−seg、吉凶随之翻转。
_D60_KRURA = frozenset({1, 2, 8, 9, 10, 11, 12, 15, 16, 30, 31, 32, 33, 34, 35,
                        39, 40, 42, 43, 44, 48, 51, 52, 59})

# D60 六十神名(奇象顺序;Santhanam BPHS 体系,_agentA_chartcasting.md:421-439)。偶象取 deity=61−seg 逆序读。
_D60_NAMES = (
    'Ghora', 'Rākṣasa', 'Deva', 'Kubera', 'Yakṣa', 'Kinnara', 'Bhraṣṭa', 'Kulaghna',
    'Garala', 'Vahni', 'Māyā', 'Puriṣaka', 'Apāmpati', 'Marut', 'Kāla', 'Sarpa',
    'Amṛta', 'Indu', 'Mṛdu', 'Komala', 'Heramba', 'Brahmā', 'Viṣṇu', 'Maheśvara',
    'Deva', 'Ārdra', 'Kalināśa', 'Kṣitīśvara', 'Kamalākara', 'Gulika', 'Mṛtyu', 'Kāla',
    'Dāvāgni', 'Ghora', 'Yama', 'Kaṇṭaka', 'Sudhā', 'Amṛta', 'Pūrṇacandra', 'Viṣadagdha',
    'Kulanāśa', 'Vaṃśakṣaya', 'Utpāta', 'Kāla', 'Saumya', 'Komala', 'Śītala', 'Karāladaṃṣṭra',
    'Candramukhī', 'Pravīṇa', 'Kālapāvaka', 'Daṇḍāyudha', 'Nirmala', 'Saumya', 'Krūra', 'Atiśītala',
    'Amṛta', 'Payodhi', 'Bhramaṇa', 'Candrarekhā',
)

# D2 Kashinatha(SJC 财富 horā,_agentA_chartcasting.md:206-215):唯一依「源座主星」的 D-2(不可纯 f(s,d))。
# 日 horā(段==座奇偶) → 主星「昼强座」;月 horā → 主星「夜强座」;巨蟹/狮子为发光体对(昼→狮子4/夜→巨蟹3)。
_D2_KASH_DAY = (7, 6, 5, 4, 4, 5, 6, 7, 11, 10, 10, 11)
_D2_KASH_NIGHT = (0, 1, 2, 3, 3, 2, 1, 0, 8, 9, 9, 8)


def shashtiamsa_nature(longitude):
    lon = float(longitude) % 360.0
    sign_index = int(math.floor(lon / 30.0)) % 12
    seg = int(math.floor((lon % 30.0) * 2.0)) + 1     # 1..60
    if seg > 60:
        seg = 60
    deity_idx = seg if (sign_index in ODD_SIGNS) else (61 - seg)   # 偶象神名逆序
    return {'segment': seg, 'deityIndex': deity_idx,
            'deity': _D60_NAMES[deity_idx - 1],
            'nature': 'malefic' if deity_idx in _D60_KRURA else 'benefic'}


# 分盘变体合法值注册表(仅列已实现集合;standard 恒等 None,不入表)。
# 新变体必须先在 _varga_variant_sign 落实现再登记,禁止先登记后实现。
VARGA_VARIANT_CHOICES = {
    2: ('parivritti', 'kashinatha'),
    3: ('parivritti', 'jagannatha', 'somanatha'),
    24: ('correct',),
    30: ('equal',),
}


def normalize_varga_variants(raw):
    """请求形状 {"2":"parivritti",...}(dict 或 JSON 串)→ {int chartnum: variant}。
    只保留注册表内合法非 standard 项;任何解析失败/非法值静默丢弃(缺省 {} = 零回归)。"""
    if not raw:
        return {}
    if isinstance(raw, str):
        try:
            import json as _json
            raw = _json.loads(raw)
        except Exception:
            return {}
    if not isinstance(raw, dict):
        return {}
    out = {}
    for k, v in raw.items():
        try:
            cn = int(k)
        except (TypeError, ValueError):
            continue
        if v and v != 'standard' and v in VARGA_VARIANT_CHOICES.get(cn, ()):
            out[cn] = v
    return out


def _varga_variant_sign(chartnum, variant, sign_index, part):
    if not variant or variant == 'standard':
        return None
    if chartnum == 2 and variant == 'parivritti':
        return ((sign_index % 6) * 2 + part) % 12
    if chartnum == 2 and variant == 'kashinatha':
        sun = (part == sign_index % 2)            # 段==座奇偶 → 日 horā(取主星昼强座)
        return _D2_KASH_DAY[sign_index] if sun else _D2_KASH_NIGHT[sign_index]
    if chartnum == 3 and variant == 'parivritti':
        return (3 * sign_index + part) % 12
    if chartnum == 3 and variant == 'jagannatha':
        return (sign_index + _D3_JAGANNATHA[sign_index % 3][part]) % 12
    if chartnum == 3 and variant == 'somanatha':
        if sign_index % 2 == 0:                   # 奇象(Jyotish parity):自白羊顺
            return (3 * (sign_index // 2) + part) % 12
        return (11 - 3 * ((sign_index - 1) // 2) - part) % 12   # 偶象:自双鱼逆
    if chartnum == 24 and variant == 'correct':
        is_odd = sign_index in ODD_SIGNS
        return ((4 + part) % 12) if is_odd else ((3 - part) % 12)   # 偶象座逆(Narasimha Rao)
    if chartnum == 30 and variant == 'equal':
        return (sign_index + part) % 12   # 30×1° 等分(配 _scaled_degree 等分度)
    return None


def varga_position(longitude, chartnum, variant=None):
    chartnum = normalize_chartnum(chartnum)
    lon = float(longitude) % 360.0
    if chartnum == 1:
        return lon

    sign_index = int(math.floor(lon / 30.0)) % 12
    degree_in_sign = lon % 30.0
    part = _part(degree_in_sign, chartnum)
    degree = _scaled_degree(degree_in_sign, chartnum)
    is_odd = sign_index in ODD_SIGNS

    _vsign = _varga_variant_sign(chartnum, variant, sign_index, part)
    if _vsign is not None:
        return (_vsign * 30.0 + degree) % 360.0

    if chartnum == 2:
        if is_odd:
            target_sign = 4 if degree_in_sign < 15.0 else 3
        else:
            target_sign = 3 if degree_in_sign < 15.0 else 4
    elif chartnum == 3:
        target_sign = (sign_index + part * 4) % 12
    elif chartnum == 4:
        target_sign = (sign_index + part * 3) % 12
    elif chartnum in (5, 6):
        target_sign = ((0 if is_odd else 6) + part) % 12
    elif chartnum == 7:
        target_sign = (sign_index + (0 if is_odd else 6) + part) % 12
    elif chartnum in (8, 11, 16, 45):
        target_sign = (_modality_start(sign_index) + part) % 12
    elif chartnum == 9:
        target_sign = (_element_start_for_d9(sign_index) + part) % 12
    elif chartnum == 10:
        target_sign = (sign_index + (0 if is_odd else 8) + part) % 12
    elif chartnum == 12:
        target_sign = (sign_index + part) % 12
    elif chartnum == 20:
        target_sign = (_modality_start(sign_index, movable=0, fixed=8, dual=4) + part) % 12
    elif chartnum == 24:
        target_sign = ((4 if is_odd else 3) + part) % 12
    elif chartnum == 27:
        target_sign = (_element_start_for_d27(sign_index) + part) % 12
    elif chartnum == 30:
        target_sign, degree = _d30_position(sign_index, degree_in_sign)
    elif chartnum == 40:
        target_sign = ((0 if is_odd else 6) + part) % 12
    elif chartnum == 60:
        target_sign = (sign_index + part) % 12
    else:
        target_sign = sign_index

    return (target_sign * 30.0 + degree) % 360.0


def _relocate(point, longitude):
    point.relocate(longitude % 360.0)


def _relocate_house(house, longitude, hsys):
    house.hsys = hsys
    house.size = 30.0
    house.relocate(longitude % 360.0)
    ra, decl = utils.eqCoords(house.lon, 0)
    house.ra = ra
    house.decl = decl


def apply_varga_chart(perchart, chartnum, variant=None):
    chartnum = normalize_chartnum(chartnum)
    definition = VARGA_DEFINITIONS[chartnum]
    # variant=None|'standard' 走原分支(字节级零回归);非法值按 None 处理(防御)。
    if variant == 'standard' or (variant and variant not in VARGA_VARIANT_CHOICES.get(chartnum, ())):
        variant = None
    perchart.vargaChart = dict({'chartnum': chartnum}, **definition)
    if variant:
        perchart.vargaChart['variant'] = variant
    perchart.vargaEngineVersion = VARGA_ENGINE_VERSION
    if chartnum == 1:
        perchart.reinit()
        return perchart

    chart = perchart.chart
    asc = chart.getAngle(const.ASC)
    mc = chart.getAngle(const.MC)
    desc = chart.getAngle(const.DESC)
    ic = chart.getAngle(const.IC)

    asclon = varga_position(asc.lon, chartnum, variant)
    mclon = varga_position(mc.lon, chartnum, variant)
    _relocate(asc, asclon)
    _relocate(mc, mclon)
    _relocate(desc, asclon + 180.0)
    _relocate(ic, mclon + 180.0)

    if getattr(perchart, 'houseCode', None) == 5:
        house1lon = asclon
    else:
        house1lon = math.floor(asclon / 30.0) * 30.0
    for house in chart.houses:
        house_num = int(house.id[5:])
        _relocate_house(house, house1lon + (house_num - 1) * 30.0, perchart.house)

    for obj in chart.objects:
        _relocate(obj, varga_position(obj.lon, chartnum, variant))
    for obj in chart.pars:
        _relocate(obj, varga_position(obj.lon, chartnum, variant))

    perchart.reinit()
    return perchart
