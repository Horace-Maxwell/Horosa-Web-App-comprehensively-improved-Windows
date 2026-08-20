# [WP-5a] 容许度体系批双向量锚(flatlib aspects 请求级 orb 政策)。
from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request
from flatlib import aspects as fasp

BASE = {'date': '1991/08/21', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}


def _aspect_pairs(data):
    """主相位对集合(id×id×asp)。真链路语义:端点在复合临界区内构造+取相位,
    测试同构地以 push_classical_request 包裹(直接裸构造=政策未生效,不代表线上行为)。"""
    tokens = push_classical_request(dict(data))
    try:
        pc = PerChart(dict(data))
        res = pc.getAspects()
    finally:
        pop_classical_request(tokens)
    pairs = set()
    for a, cat in res.items():
        for k in ('Exact', 'Applicative', 'Separative'):
            for o in cat.get(k, []):
                if o.get('asp') in (0, 60, 90, 120, 180):
                    pairs.add((a, o['id'], o['asp']))
    return pairs


def test_push_pop_pairing_and_default():
    t = push_classical_request(dict(BASE))
    assert t[6] is None   # 默认 perObject+0 加成 → 不 push
    pop_classical_request(t)
    t2 = push_classical_request({**BASE, 'orbSystem': 'byAspect'})
    assert t2[6] is not None
    assert fasp._orbPolicy['mode'] == 'byAspect'
    pop_classical_request(t2)
    assert fasp._orbPolicy['mode'] == 'perObject'   # 还原锚


def test_by_aspect_tightens():
    p0 = _aspect_pairs(dict(BASE))
    p1 = _aspect_pairs({**BASE, 'orbSystem': 'byAspect'})
    # 按相位名封顶(8/4°)严于星体轨(日15/月12):对集必 ⊆ 且真收紧
    assert p1 <= p0
    assert len(p1) < len(p0), (len(p0), len(p1))


def test_whole_sign_changes_set():
    p0 = _aspect_pairs(dict(BASE))
    p1 = _aspect_pairs({**BASE, 'orbSystem': 'wholeSign'})
    assert p0 != p1   # 整星座位相=跨界宽入/出界剔除,集合必变
    p2 = _aspect_pairs({**BASE, 'orbSystem': 'wholeSignMoiety'})
    assert p2 <= p1   # 半距和收紧是 wholeSign 的子集


def test_luminary_bonus_expands():
    p0 = _aspect_pairs(dict(BASE))
    p1 = _aspect_pairs({**BASE, 'luminaryOrbBonus': 30})
    assert p0 <= p1   # 只放大不收缩


def test_default_vector_parity():
    a = _aspect_pairs(dict(BASE))
    b = _aspect_pairs({**BASE, 'orbSystem': 'perObject', 'luminaryOrbBonus': 0})
    assert a == b
