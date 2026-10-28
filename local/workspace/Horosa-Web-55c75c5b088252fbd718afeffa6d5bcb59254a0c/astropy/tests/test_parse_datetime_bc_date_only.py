"""kinastro 系 / 卜类后端的请求日期解析:只给 date(外部智能体 / 无头调用的常见形态)的公元前请求也得到正确年份。

病理:两份 parse_datetime 对 '-0300-03-10' 拆不出年份(strptime / 按 '-' 拆三段都失败),回落请求体 year 字段;
调用方只给 date、不给 year 时静默回落 2025 → 公元前命主拿到 2025 年的盘,零提示。
判据:date-only 的公元前 / 补零 / 五位年 / ad=-1 正年写法逐一解析正确;两者都缺 → 报错不充数;
真服务入口(邵子)只给公元前 date 时的四柱与同时给 year 字段时完全相同。
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from websrv.horosa_engine_common import parse_datetime as engine_parse, parse_datetime_fields  # noqa: E402
from websrv.kentang.kinastro_common import parse_datetime as kin_parse  # noqa: E402

CASES = [
    ({'date': '-0300-03-10', 'time': '10:30:00'}, (-300, 3, 10, 10, 30, 0)),
    ({'date': '-300/3/10', 'time': '10:30'}, (-300, 3, 10, 10, 30, 0)),
    ({'date': '0300-03-10', 'time': '10:30:00', 'ad': -1}, (-300, 3, 10, 10, 30, 0)),
    ({'date': '-0001-12-31 23:59:59'}, (-1, 12, 31, 23, 59, 59)),
    ({'date': '-12998-12-29', 'time': '18:49:00'}, (-12998, 12, 29, 18, 49, 0)),
    ({'date': '0050-06-01', 'time': '00:00:00'}, (50, 6, 1, 0, 0, 0)),
    ({'date': '12000/01/01', 'time': '06:00:00'}, (12000, 1, 1, 6, 0, 0)),
    ({'date': '1990-05-18', 'time': '10:30:00'}, (1990, 5, 18, 10, 30, 0)),
    ({'year': -300, 'month': 3, 'day': 10, 'hour': 10, 'minute': 30}, (-300, 3, 10, 10, 30, 0)),
]


def _tuple(dt):
    return (dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)


@pytest.mark.parametrize('data,want', CASES)
def test_fields_single_source(data, want):
    assert parse_datetime_fields(dict(data)) == want


@pytest.mark.parametrize('data,want', CASES)
def test_both_parsers_agree(data, want):
    assert _tuple(engine_parse(dict(data))) == want
    assert _tuple(kin_parse(dict(data))) == want


def test_no_date_no_year_raises_instead_of_2025():
    for p in (parse_datetime_fields, engine_parse, kin_parse):
        with pytest.raises(ValueError):
            p({'time': '10:30:00'})


def test_in_domain_still_stdlib_datetime():
    import datetime as _dt
    assert isinstance(kin_parse({'date': '2026-07-19', 'time': '00:00:00'}), _dt.datetime)
    assert isinstance(engine_parse({'date': '2026/07/19', 'time': '00:00:00'}), _dt.datetime)


def test_service_entry_date_only_matches_year_fields():
    """真服务入口(邵子 pan):只给公元前 date 与同时给 year/month/day 字段,四柱逐字相同、绝非 2025 年。"""
    cherrypy = pytest.importorskip('cherrypy')
    try:
        from websrv import webshaozisrv as SZ
    except Exception as e:   # pragma: no cover
        pytest.skip('webshaozisrv unavailable: %s' % e)
    svc = next(getattr(SZ, n)() for n in dir(SZ)
               if isinstance(getattr(SZ, n), type) and hasattr(getattr(SZ, n), 'pan') and getattr(SZ, n).__module__ == SZ.__name__)

    def pan(payload):
        cherrypy.request.json = payload
        cherrypy.request.method = 'POST'
        cherrypy.request.headers = {}
        out = svc.pan()
        res = json.loads(out.decode('utf-8') if isinstance(out, bytes) else out)
        assert res.get('ResultCode') == 0, res
        return res['Result']

    base = {'time': '10:30:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'gender': '1', 'after23NewDay': 1, 'lateZiHourUseNextDay': 1}
    only_date = pan(dict(base, date='-0300-03-10'))
    with_fields = pan(dict(base, date='-0300-03-10', year=-300, month=3, day=10, hour=10, minute=30, second=0))
    modern = pan(dict(base, date='2025-03-10'))
    pick = lambda r: json.dumps(r.get('pillars') or r.get('bazi') or r.get('ganzhi') or r, ensure_ascii=False, sort_keys=True, default=str)
    assert pick(only_date) == pick(with_fields)
    assert pick(only_date) != pick(modern)
