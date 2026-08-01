"""
汉堡学派量化盘(/germany/midpoint)中点引擎测试。

守住两件事:
 1. uranian=True(量化盘):中点对纳入 Asc/MC + 8 TNP;相位跨 0° 归一;orb 可配;TNP 历表可用。
 2. uranian=False(默认,合盘 modern/chartcomp.py 复用):中点对只含传统体,绝不含 TNP/Asc/MC ——
    保证本次改动零侵入合盘。
"""
import gzip
import json
from pathlib import Path

from astrostudy import perchart
from astrostudy.germany.midpoint import MidPoint
from flatlib import const

_CORPUS = (
    Path(__file__).resolve().parent
    / 'data' / 'pd_calibration_corpus'
    / 'golden_alcabitius_ptolemy_v266.ndjson.gz'
)


def _sample_chart_data():
    with gzip.open(_CORPUS, 'rt', encoding='utf-8') as f:
        return json.loads(f.readline())['chart_data']


CD = _sample_chart_data()


def _perchart():
    return perchart.PerChart(dict(CD))


def _pair_ids(mids):
    ids = set()
    for m in mids:
        ids.add(m['idA'])
        ids.add(m['idB'])
    return ids


class _Stub:
    def __init__(self, oid, lon):
        self.id = oid
        self.lon = lon


def test_uranian_midpoints_include_tnp_and_angles():
    mids = MidPoint(_perchart(), uranian=True).getMidpoints()
    ids = _pair_ids(mids)
    assert const.ASC in ids and const.MC in ids, '四轴 Asc/MC 必须进中点对'
    present = [u for u in const.LIST_URANIAN if u in ids]
    assert len(present) == 8, f'8 TNP 必须进中点对,实得 {present}'


def test_composite_default_path_excludes_tnp_and_angles():
    # 默认 uranian=False —— 合盘路径,逐字节不变:绝不含 TNP/Asc/MC。
    mids = MidPoint(_perchart()).getMidpoints()
    ids = _pair_ids(mids)
    assert const.ASC not in ids and const.MC not in ids
    assert not any(u in ids for u in const.LIST_URANIAN)


def test_aspect_normalizes_across_zero():
    # 中点 359.6°、目标 0.3° → 真实角距 0.7°,应判「合」(原 abs 差 359.3 会漏判)。
    mp = MidPoint(_perchart(), orb=1.0, uranian=True)
    hits = mp.getAspects(_Stub('X', 0.3), [{'idA': 'a', 'idB': 'b', 'lon': 359.6}])['X']
    assert len(hits) == 1 and hits[0]['aspect'] == 0


def test_aspect_270_folds_to_square():
    mp = MidPoint(_perchart(), orb=1.0, uranian=True)
    hits = mp.getAspects(_Stub('X', 0.0), [{'idA': 'a', 'idB': 'b', 'lon': 270.0}])['X']
    assert hits and hits[0]['aspect'] == 90


def test_orb_configurable_monotonic():
    pc = _perchart()
    few = MidPoint(pc, orb=0.5, uranian=True).calculate()['aspects']
    many = MidPoint(pc, orb=3.0, uranian=True).calculate()['aspects']
    n_few = sum(len(v) for v in few.values())
    n_many = sum(len(v) for v in many.values())
    assert n_many >= n_few, f'放大 orb 不应减少相位数 (0.5°={n_few}, 3°={n_many})'


def test_tnp_ephemeris_eight_available():
    # 与 _build_uranian_tnp 同路径,但不依赖 cherrypy:验证 8 颗 Swiss Ephemeris 虚星可算。
    from flatlib.ephem import ephem as flatlib_ephem
    pc = _perchart()
    got = [flatlib_ephem.getObject(uid, pc.dateTime, pc.pos).id for uid in const.LIST_URANIAN]
    assert len(got) == 8


# ─────────────────────────────────────────────────────────────────────────────
# WP-1 四流派软预设:includeTnp / personalOrb 新参数。
# 铁律:uranian=False(合盘 chartcomp 复用)绝对字节不变;新参数仅 uranian=True 生效、默认=现行为。
# ─────────────────────────────────────────────────────────────────────────────

def _calc_payload(mp):
    """把 calculate() 结果摊平成可逐元素比对的纯量元组列表(midpoints + aspects),
    用于 uranian=False 路径的字节级守护:任何字段漂移都会让相等断言失败。"""
    res = mp.calculate()
    mids = tuple(
        (m['idA'], m['idB'], m['lon'], m['signlon'], m['sign'])
        for m in res['midpoints']
    )
    asp_keys = tuple(sorted(res['aspects'].keys()))
    asp_flat = tuple(
        (k,) + tuple(
            (a['idA'], a['idB'], a['aspect'], a.get('delta'))
            for a in res['aspects'][k]
        )
        for k in asp_keys
    )
    return mids, asp_flat


def test_composite_path_byte_identical_with_new_params_default():
    # 合盘路径(uranian=False):无论新参数默认与否,calculate() 逐元素必须完全相等。
    # 钉死「includeTnp/personalOrb 默认值绝不污染 uranian=False」(chartcomp.py MidPoint(chartB) 复用)。
    base = _calc_payload(MidPoint(_perchart()))
    with_defaults = _calc_payload(
        MidPoint(_perchart(), uranian=False, includeTnp=True, personalOrb=None)
    )
    assert base == with_defaults, 'uranian=False 路径在新参数默认下逐元素字节不变'


def test_composite_path_ignores_new_params_when_set():
    # 即便显式给 includeTnp=False / personalOrb=5(本应只影响 uranian=True),
    # uranian=False 分支也必须无视它们 → 与历史输出逐元素相等。
    base = _calc_payload(MidPoint(_perchart()))
    forced = _calc_payload(
        MidPoint(_perchart(), uranian=False, includeTnp=False, personalOrb=5.0)
    )
    assert base == forced, 'uranian=False 路径无视 includeTnp/personalOrb(合盘零侵入)'


def test_include_tnp_default_contains_eight_tnp():
    # includeTnp 默认 True:8 颗 TNP 必进中点对(现状口径)。
    mids = MidPoint(_perchart(), uranian=True).getMidpoints()
    present = [u for u in const.LIST_URANIAN if u in _pair_ids(mids)]
    assert len(present) == 8


def test_include_tnp_false_drops_tnp_from_pairs():
    # includeTnp=False(宇宙生物学):TNP 既不入中点对、也不作相位目标;Asc/MC 仍在。
    mp = MidPoint(_perchart(), uranian=True, includeTnp=False)
    ids = _pair_ids(mp.getMidpoints())
    assert not any(u in ids for u in const.LIST_URANIAN), 'includeTnp=False 时 8 TNP 不入中点对'
    assert const.ASC in ids and const.MC in ids, 'Asc/MC 仍应在(仅去虚星)'
    # 相位目标也不含 TNP。
    targets = set(MidPoint(_perchart(), uranian=True, includeTnp=False).calculate()['aspects'].keys())
    assert not any(u in targets for u in const.LIST_URANIAN)


def test_personal_orb_widens_basic_five_only():
    # personalOrb 放宽仅作用于「相位目标落 Basic Five(Asc/MC/日/月/北交)」;
    # 同一中点对此时对 Basic Five 用宽 orb、对其他目标用窄 orb。
    from astrostudy.germany.midpoint import BASIC_FIVE

    class _Obj:
        def __init__(self, oid, lon):
            self.id = oid
            self.lon = lon

    # 构造一个与目标差 2.5° 的中点:窄 orb(1°)判不到,Basic Five 宽 orb(5°)判到「合」。
    mids = [{'idA': 'a', 'idB': 'b', 'lon': 102.5}]
    mp = MidPoint(_perchart(), orb=1.0, uranian=True, personalOrb=5.0)
    sun = const.SUN
    assert sun in BASIC_FIVE
    hit_personal = mp.getAspects(_Obj(sun, 100.0), mids)[sun]
    assert len(hit_personal) == 1 and hit_personal[0]['aspect'] == 0, 'Basic Five 用放宽 orb 命中'
    # 非 Basic Five 目标(如 Mercury)同样 2.5° 差,窄 orb 下判不到。
    merc = const.MERCURY
    assert merc not in BASIC_FIVE
    hit_other = mp.getAspects(_Obj(merc, 100.0), mids)[merc]
    assert len(hit_other) == 0, '非 Basic Five 目标仍用窄 orb,2.5° 不命中'


def test_personal_orb_none_no_fork():
    # personalOrb=None:全程用 orb,Basic Five 与其他目标口径一致(无分叉,零回归)。
    mids = [{'idA': 'a', 'idB': 'b', 'lon': 102.5}]
    mp = MidPoint(_perchart(), orb=1.0, uranian=True, personalOrb=None)
    sun_hits = mp.getAspects(type('O', (), {'id': const.SUN, 'lon': 100.0})(), mids)[const.SUN]
    assert len(sun_hits) == 0, 'personalOrb=None 时 Basic Five 也用窄 orb(2.5° 不命中)'


# ── 严格汉堡因子集 strictFactors(D2)───────────────────────────────────────────


def test_strict_factors_excludes_darkmoon_purpleclouds():
    # strictFactors=True(uranian 分支):黑月/紫气从「中点对来源」与「相位目标」双面剔除;
    # 8 TNP + Asc/MC 照常在场(严格因子集 = 10 行星 + 8 虚星 + Asc/MC + 交点)。
    mp = MidPoint(_perchart(), uranian=True, strictFactors=True)
    res = mp.calculate()
    ids = _pair_ids(res['midpoints'])
    assert const.DARKMOON not in ids and const.PURPLE_CLOUDS not in ids, '严格集不得含黑月/紫气'
    assert const.ASC in ids and const.MC in ids
    assert len([u for u in const.LIST_URANIAN if u in ids]) == 8
    assert const.DARKMOON not in res['aspects'] and const.PURPLE_CLOUDS not in res['aspects'], \
        '黑月/紫气亦不得作相位目标'


def test_strict_factors_default_off_byte_identical():
    # 缺省(strictFactors=False)与显式 False 输出字节等,且黑月/紫气仍在场(现状零回归)。
    a = MidPoint(_perchart(), uranian=True).calculate()
    b = MidPoint(_perchart(), uranian=True, strictFactors=False).calculate()
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
    assert const.DARKMOON in _pair_ids(a['midpoints']), '默认关时黑月照旧在中点对(零回归)'


def test_strict_factors_noop_on_composite_path():
    # uranian=False(合盘复用路径):strictFactors 完全无作用,输出与默认逐字节一致。
    a = MidPoint(_perchart()).getMidpoints()
    b = MidPoint(_perchart(), strictFactors=True).getMidpoints()
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
