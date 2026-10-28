"""服务层的日界口径与降级不许静默。

病理:
- 奇门:设置引擎线程局部日界开关时异常被吞,本请求沿用本线程上一个请求的口径,回包毫无标记;开关在请求结束后也不撤,
  公元前分支还不读开关(恒按 23 点换日);
- 太玄:权威四柱算不出时静默回落 cnlunar(不认日界 / 时区),回包无降级标记;五位年月表日期按 [:11] 截串;
- kinastro 系:请求缺日界两键时后端写死按 1 / 1 算,回包不写所用口径;字符串 '0' 原样交给引擎被当真。
判据:开关算完即撤、设不上整请求报错;降级必写 degraded + partialErrors;日界口径恒写进回包,缺键时盘面加「日界口径」行。
"""
import json
import sys

import pytest

from websrv.horosa_engine_common import day_boundary_of, day_boundary_note


def _call(svc_method, body):
    import cherrypy
    cherrypy.request.json = json.loads(json.dumps(body))
    cherrypy.request.method = 'POST'
    cherrypy.request.headers = {}
    out = svc_method()
    return json.loads(out.decode('utf-8') if isinstance(out, bytes) else out)


# ── 日界单源 ──
def test_day_boundary_value_shapes_and_defaulted_keys():
    assert day_boundary_of({'after23NewDay': '0', 'lateZiHourUseNextDay': False}) == \
        {'after23NewDay': 0, 'lateZiHourUseNextDay': 0, 'defaulted': []}
    assert day_boundary_of({'after23NewDay': 1, 'lateZiHourUseNextDay': 'true'})['defaulted'] == []
    got = day_boundary_of({})
    assert (got['after23NewDay'], got['lateZiHourUseNextDay']) == (1, 1)
    assert got['defaulted'] == ['after23NewDay', 'lateZiHourUseNextDay']
    assert '出厂缺省' in day_boundary_note(got)
    assert '24 点换日' in day_boundary_note(day_boundary_of({'after23NewDay': 0, 'lateZiHourUseNextDay': 1}))


def _shaozi(body):
    from websrv.webshaozisrv import ShaoZiSrv
    return _call(ShaoZiSrv().pan, body)


BASE = {'date': '2026-01-27', 'time': '23:30:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'gender': '1'}


def test_kin_pan_states_the_day_boundary_it_used():
    explicit = _shaozi(dict(BASE, after23NewDay=0, lateZiHourUseNextDay=1))['Result']
    assert explicit['dayBoundary']['defaulted'] == [] and explicit['dayBoundary']['after23NewDay'] == 0
    assert '日界口径' not in explicit['snapshot']
    bare = _shaozi(dict(BASE))['Result']
    assert bare['dayBoundary']['defaulted'] == ['after23NewDay', 'lateZiHourUseNextDay']
    assert '日界口径' in bare['snapshot'] and '出厂缺省' in bare['snapshot']


def test_kin_string_zero_is_off_not_truthy():
    off = _shaozi(dict(BASE, after23NewDay='0', lateZiHourUseNextDay='1'))['Result']
    on = _shaozi(dict(BASE, after23NewDay='1', lateZiHourUseNextDay='1'))['Result']
    assert [p['ganzhi'] for p in off['pillars']][2] != [p['ganzhi'] for p in on['pillars']][2]   # 23:30 日柱随日界变


# ── 奇门:开关请求内设定、请求后撤掉、设不上就报错 ──
def _qimen(body):
    from websrv.webqimensrv import QiMenSrv
    return _call(QiMenSrv().pan, body)


def _jieqi():
    import websrv.webqimensrv  # noqa: F401  导入时把 vendor/kinqimen 挂上 sys.path 并加载 jieqi
    return sys.modules['jieqi']


QM = {'year': 2026, 'month': 1, 'day': 27, 'hour': 23, 'minute': 30, 'qimenMode': 'hour'}


def test_qimen_switches_do_not_leak_to_next_request():
    J = _jieqi()
    _qimen(dict(QM, after23NewDay=0, lateZiHourUseNextDay=0))
    assert not hasattr(J._TLS, 'after23') and not hasattr(J._TLS, 'hour_gan_next')
    assert getattr(J._TLS, 'req_memo', None) is None


def test_qimen_day_boundary_changes_day_pillar_both_directions():
    a = _qimen(dict(QM, after23NewDay=1))['Result']['selected']['干支']
    b = _qimen(dict(QM, after23NewDay=0))['Result']['selected']['干支']
    c = _qimen(dict(QM, after23NewDay=1))['Result']['selected']['干支']
    assert a != b and a == c


def test_qimen_bc_branch_honours_request_switch():
    J = _jieqi()
    J.set_after23_new_day(0)
    try:
        off = J.gangzhi(-300, 3, 10, 23, 30)
    finally:
        J.clear_request_switches()
    on = J.gangzhi(-300, 3, 10, 23, 30)
    assert off[2] != on[2]


def test_qimen_switch_setter_failure_fails_loudly(monkeypatch):
    """设开关抛错(旧实现 except: pass 吞掉,沿用本线程上一请求的口径照算)→ 整请求报错。"""
    import types
    real = _jieqi()
    stub = types.ModuleType('jieqi')

    def _boom(_v):
        raise RuntimeError('switch store unavailable')
    stub.set_after23_new_day = _boom
    stub.set_hour_gan_use_next_day = _boom
    monkeypatch.setitem(sys.modules, 'jieqi', stub)
    res = _qimen(dict(QM))
    monkeypatch.setitem(sys.modules, 'jieqi', real)
    assert res['ResultCode'] == -1


def test_qimen_missing_switch_setter_fails_loudly(monkeypatch):
    import types
    real = _jieqi()
    stub = types.ModuleType('jieqi')
    monkeypatch.setitem(sys.modules, 'jieqi', stub)
    res = _qimen(dict(QM))
    monkeypatch.setitem(sys.modules, 'jieqi', real)
    assert res['ResultCode'] == -1


# ── 太玄:降级必标、域外不回落、五位年月表日期不截串 ──
def test_taixuan_pillar_fallback_is_marked(monkeypatch):
    import kin_year_domain
    from websrv import webtaixuansrv as T

    def boom(*a, **k):
        raise RuntimeError('ephemeris unavailable')
    monkeypatch.setattr(kin_year_domain, 'extreme_pillars', boom)
    pan = T.build_taixuan_pan({'year': 2026, 'month': 1, 'day': 27, 'hour': 23, 'seed': 1})
    assert pan['ganzhi']['degraded']['source'] == 'cnlunar'
    assert 'ganzhi' in pan['partialErrors']
    assert '四柱口径' in pan['snapshot']
    with pytest.raises(ValueError):
        T.build_taixuan_pan({'year': 1500, 'month': 2, 'day': 29, 'hour': 10, 'seed': 1})


def test_taixuan_normal_pan_has_no_partial_errors_and_accepts_julian_leap_day():
    from websrv import webtaixuansrv as T
    assert 'partialErrors' not in T.build_taixuan_pan({'year': 2026, 'month': 1, 'day': 27, 'hour': 10, 'seed': 1})
    pan = T.build_taixuan_pan({'year': 1500, 'month': 2, 'day': 29, 'hour': 10, 'seed': 1})
    assert pan['dateStr'] == '1500-02-29'
    with pytest.raises(ValueError):
        T.build_taixuan_pan({'year': 1582, 'month': 10, 'day': 10, 'hour': 10, 'seed': 1})


def test_taixuan_date_parser_handles_five_digit_years():
    from websrv.webtaixuansrv import _parse_date_str
    assert _parse_date_str('-12000-01-01') == (-12000, 1, 1)
    assert _parse_date_str('-500-01-21 08:00') == (-500, 1, 21)
    assert _parse_date_str('2026-01-19') == (2026, 1, 19)
