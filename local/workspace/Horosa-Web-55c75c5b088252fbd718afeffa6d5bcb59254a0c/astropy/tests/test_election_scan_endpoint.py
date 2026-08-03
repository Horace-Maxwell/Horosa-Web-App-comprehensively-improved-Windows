# -*- coding: utf-8 -*-
"""天星择日搜索端点层测试(WP-1):挂载注册 + handler exposed + 响应包装契约。

业务逻辑测试在 test_election_scan_engine.py(引擎直调);本文件照 test_pd3d_endpoint.py 范式
只锁「挂上了 + exposed + 包装口径」,不起 :8899。
"""
from astrostudy import election_scan


def test_core_service_specs_contains_electionscan():
    from websrv.webchartsrv import CORE_SERVICE_SPECS
    hits = [s for s in CORE_SERVICE_SPECS if s.get('key') == 'electionscan']
    assert len(hits) == 1
    spec = hits[0]
    assert spec['mount'] == '/electionscan'
    assert spec['module'] == 'websrv.webelectionscansrv'
    assert spec['class_name'] == 'ElectionScanSrv'


def test_handlers_exposed():
    from websrv.webelectionscansrv import ElectionScanSrv
    assert getattr(ElectionScanSrv, 'exposed', False)
    for name in ('scan', 'conditiontypes'):
        fn = getattr(ElectionScanSrv, name, None)
        assert fn is not None, name
        assert getattr(fn, 'exposed', False), '{0} 必须 cherrypy.expose'.format(name)


def test_conditiontypes_payload_matches_registry():
    """自检口返回的类型集必须与 CONDITION_TYPES 恒等(运行时孪生,防端点写死清单漂移)。"""
    import json
    from websrv.webelectionscansrv import ElectionScanSrv
    srv = ElectionScanSrv()
    rsp = json.loads(srv.conditiontypes())
    assert rsp['ResultCode'] == 0
    assert rsp['Result']['types'] == sorted(election_scan.CONDITION_TYPES.keys())
    assert rsp['Result']['groups'] == list(election_scan.GROUP_TYPES)


def test_scan_pick_field_inside_interval():
    """pick=安全起盘时刻:秒级、恒在区间内部(起点+ε)——防边界错侧起盘(真机实抓月未入庙)。"""
    from astrostudy import election_scan as es
    data = {
        'startDate': '2024/04/07', 'startTime': '00:00:00',
        'endDate': '2024/04/10', 'endTime': '00:00:00',
        'zone': '+08:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
        'hsys': 0, 'zodiacal': 0, 'ad': 1,
        'conditions': {'type': 'in_sign', 'params': {'planet': 'Moon', 'signs': [0]}},
    }
    rsp = es.scan(data)
    assert rsp['intervals']
    for iv in rsp['intervals']:
        assert len(iv['pick']) == 19, iv['pick']   # 秒级 YYYY-MM-DD HH:mm:ss
        pick_jd = es._jd_from(iv['pick'][:10].replace('-', '/'), iv['pick'][11:], '+08:00')
        assert iv['startJd'] - 1e-6 < pick_jd < iv['endJd'], iv
        # pick 时刻征象必须成立:直接复核月在白羊
        ctx = es.ScanContext(data)
        m = ctx.moment(pick_jd)
        assert int(m.lon('Moon') // 30) == 0, (iv, m.lon('Moon'))


def _default_leaf_for(t):
    """给 explain 契约测试构造每类合法默认叶(与前端 defaults 语义等价的最小参数)。"""
    D = {
        'aspect': {'planetA': 'Moon', 'planetB': 'Sun', 'angle': 90, 'orb': 6, 'motion': 'any', 'side': 'any', 'partile': 'off'},
        'in_sign': {'planet': 'Moon', 'signs': [0, 1, 2]},
        'numeric': {'planet': 'Moon', 'field': 'Lat', 'op': 'gte', 'value': -6},
        'midpoint': {'a': 'Sun', 'b': 'Moon', 'target': {'kind': 'planet', 'id': 'Venus'}, 'modulus': 90, 'orb': 3},
        'point_relation': {'planet': 'Moon', 'point': {'kind': 'angle', 'id': 'ASC'}, 'relation': 'any', 'orb': 8},
        'in_house': {'planet': 'Moon', 'houses': [1, 2, 3, 4, 5, 6]},
        'reception': {'planetA': 'Moon', 'planetB': 'Venus', 'levels': ['ruler', 'exalt', 'trip', 'term', 'face'], 'match': 'any', 'requireAspect': False},
        'mutual_reception': {'planetA': 'Mercury', 'planetB': 'Venus', 'levels': ['ruler', 'exalt', 'trip', 'term', 'face'], 'pairing': 'any_pair', 'requireAspect': False},
        'rulership': {'planetA': 'Mars', 'planetB': 'Moon', 'mode': 'dispositor_is'},
        'dignity_state': {'planet': 'Venus', 'states': ['direct'], 'require': 'any'},
        'considerations': {'item': 'moon_waxing'},
        'besieged': {'target': 'Moon', 'besiegerA': 'Venus', 'besiegerB': 'Mars', 'mode': 'ray', 'orbLeft': 30, 'orbRight': 30, 'rescue': {'enabled': False}, 'mitigation': {}},
        'aspect_pattern': {'pattern': 'grand_trine', 'apex': 'any', 'members': 'any', 'orb': 8},
        'chart_shape': {'shape': 'splash', 'includeOuter': True},
        'day_window': {'from': '00:00', 'to': '23:59'},
        'light_dynamics': {'item': 'aversion', 'a': 'any', 'b': 'any'},
        'royal_attendance': {'ref': 'Moon', 'slot': 'any_occidental', 'companion': 'Venus'},
        'sect_joy': {'item': 'diurnal'},
        'degree_state': {'planet': 'Moon', 'item': 'monomoiria', 'ruler': 'Saturn'},
        'decan_state': {'mode': 'planet_in', 'planet': 'Moon', 'decans': list(range(1, 19))},
        'pattern_overview': {'item': 'afflicted_ruler', 'planet': 'any'},
        'dispositor_cycle': {'mode': 'final_exists'},
        'almuten_is': {'scope': 'chart', 'planet': 'Sun'},
        'distribution_state': {'axis': 'element', 'key': 'Fire', 'op': 'gte', 'value': 0},
        'temperament': {'kind': 'quality', 'value': 'Hot', 'op': 'gte', 'count': 0},
        'accidental_score': {'planet': 'Jupiter', 'op': 'gte', 'value': -30},
        'classical_pattern': {'pattern': 'overcoming', 'over': 'any', 'under': 'any', 'aspectKind': 'any'},
        'eminence_level': {'op': 'gte', 'value': 0},
        'lifespan_state': {'item': 'kurios_is', 'method': 'ptolemy', 'planet': 'Sun'},
        'antiscia': {'planet': 'Moon', 'kind': 'antiscia', 'target': {'kind': 'planet', 'id': 'Venus'}, 'orb': 3},
        'fixed_star': {'star': 'Regulus', 'target': {'kind': 'planet', 'id': 'Moon'}, 'orb': 3},
        'planetary_hour': {'kind': 'hour_ruler', 'planet': 'Sun'},
    }
    return {'type': t, 'params': D[t]}


def test_explain_contract_all_types_and_scan_agreement():
    """R4 契约:①32 类叶 explain 全产非空 actual(新类不写实测文本即红——制度化);
    ②pass 与 scan 微域判定逐类一致(explain 复用同求值器,防未来重构分叉)。"""
    from astrostudy import election_scan as es

    base = {
        'startDate': '2024/04/07', 'startTime': '00:00:00',
        'endDate': '2024/04/07', 'endTime': '00:10:00',
        'zone': '+08:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
        'hsys': 0, 'zodiacal': 0, 'ad': 1,
        't': '2024/04/07 00:05:00',
    }
    for t in sorted(es.CONDITION_TYPES.keys()):
        leaf = _default_leaf_for(t)
        data = dict(base)
        data['conditions'] = leaf
        rsp = es.explain(data)
        assert 'err' not in rsp, (t, rsp)
        node = rsp['tree']
        assert node['kind'] == 'leaf' and node.get('actual'), (t, node)
        assert '实测不可得' not in node['actual'], (t, node['actual'])
        # pass ↔ scan 一致:同微域 scan 的区间含 t ⟺ explain.pass
        srsp = es.scan(data)
        assert 'err' not in srsp, (t, srsp)
        jd = es._jd_from('2024/04/07', '00:05:00', '+08:00')
        in_scan = any(iv['startJd'] <= jd <= iv['endJd'] for iv in srsp['intervals'])
        assert in_scan == node['pass'], (t, in_scan, node['pass'])
