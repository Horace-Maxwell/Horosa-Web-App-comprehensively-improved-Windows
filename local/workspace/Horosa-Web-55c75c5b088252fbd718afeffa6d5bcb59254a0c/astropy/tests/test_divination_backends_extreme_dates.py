"""卜类后端全部入口 × 儒略闰日 / 改历两侧 / 公元前:起得了盘,且日柱与全域权威四柱(kin_year_domain.extreme_pillars)一致;
不存在的日期(改历缺口 1582-10-05..14、2 月 30 日)一律报错,不按别的日子起盘。

病理:太乙 / 奇门 / 皇极 / 金口诀服务把年月日整数直接交给 vendor 库,库内节气 / 干支层用 stdlib datetime(外推格里历)
承载 sxtwl 给的民用历标签:1500-02-29 这类儒略闰日直接抛错(整盘「param error」),本地择日引擎却能出这一天的局;
1582-10-10 在 stdlib 里是合法日子,改历缺口被当真日期排盘。直接调服务 handler,不起服务。
"""
import json
import re

import cherrypy
import pytest

from kin_year_domain import extreme_pillars

EXISTING = [
    (1500, 2, 29, 12, 30),
    (1300, 2, 29, 12, 30),
    (1100, 2, 29, 12, 30),
    (1582, 10, 4, 23, 30),
    (1582, 10, 15, 0, 30),
    (-300, 3, 10, 12, 30),
]
NONEXISTENT = [(1582, 10, 10, 12, 0), (2026, 2, 30, 12, 0), (1500, 2, 30, 12, 0)]


def _qimen_day(r):
    return re.search(r'(..)日', r['raw']['干支']).group(1)


def _services():
    from websrv.webjingjuesrv import JingJueSrv
    from websrv.webjinkousrv import JinKouSrv
    from websrv.webqimensrv import QiMenSrv
    from websrv.webshenyishusrv import ShenYiShuSrv
    from websrv.webtaixuansrv import TaiXuanSrv
    from websrv.webtaiyisrv import TaiYiSrv
    from websrv.webwangjisrv import WangJiSrv
    from websrv.webwuzhaosrv import WuZhaoSrv
    # 名字 → (handler, 额外请求键, 取日柱;None = 该技法不用日柱,只要求起得了盘)
    return {
        'taiyi_hour': (TaiYiSrv, {'style': 3, 'tn': 0}, lambda r: r['ganzhi']['day']),
        'taiyi_day': (TaiYiSrv, {'style': 2, 'tn': 0}, lambda r: r['ganzhi']['day']),
        'taiyi_minute': (TaiYiSrv, {'style': 4, 'tn': 0}, lambda r: r['ganzhi']['day']),
        'taiyi_life': (TaiYiSrv, {'style': 5, 'tn': 0}, None),
        'qimen_chaibu': (QiMenSrv, {'qijuMethod': 'chaibu'}, _qimen_day),
        'qimen_zhirun': (QiMenSrv, {'qijuMethod': 'zhirun'}, _qimen_day),
        'qimen_maoshan': (QiMenSrv, {'qijuMethod': 'maoshan'}, _qimen_day),
        'qimen_wurun': (QiMenSrv, {'qijuMethod': 'wurun'}, _qimen_day),
        'qimen_year': (QiMenSrv, {'qimenMode': 'year'}, None),
        'qimen_minute': (QiMenSrv, {'qimenMode': 'minute'}, None),
        'qimen_golden': (QiMenSrv, {'qimenMode': 'golden'}, None),
        'qimen_overall': (QiMenSrv, {'qimenMode': 'overall'}, None),
        'wangji': (WangJiSrv, {}, lambda r: r['raw']['干支'][2]),
        'jinkou': (JinKouSrv, {}, lambda r: r['ganzhi']['day']),
        'wuzhao': (WuZhaoSrv, {}, lambda r: r['ganzhi']['day']),
        'taixuan': (TaiXuanSrv, {}, lambda r: r['ganzhi']['day']),
        'shenyishu': (ShenYiShuSrv, {}, lambda r: r['shenyishu']['raw']['干支']['日']),
        'jingjue': (JingJueSrv, {}, None),
    }


def _call(cls, body):
    cherrypy.request.json = json.loads(json.dumps(body))
    cherrypy.request.method = 'POST'
    cherrypy.request.headers = {}
    out = cls().pan()
    return json.loads(out.decode('utf-8') if isinstance(out, bytes) else out)


def _body(y, m, d, h, mi, extra):
    date = '{0}{1:04d}-{2:02d}-{3:02d}'.format('-' if y < 0 else '', abs(y), m, d)
    return dict({'year': y, 'month': m, 'day': d, 'hour': h, 'minute': mi, 'zone': '+08:00',
                 'date': date, 'time': '{0:02d}:{1:02d}:00'.format(h, mi)}, **extra)


SERVICE_NAMES = sorted(_services().keys())


@pytest.mark.parametrize('when', EXISTING, ids=lambda c: '{0}-{1}-{2}T{3}:{4}'.format(*c))
@pytest.mark.parametrize('name', SERVICE_NAMES)
def test_backend_casts_and_day_pillar_is_authoritative(name, when):
    cls, extra, day_of = _services()[name]
    out = _call(cls, _body(*when, extra))
    assert out.get('ResultCode') == 0, (name, when, str(out.get('Result'))[:160])
    if day_of is not None:
        assert day_of(out['Result']) == extreme_pillars(*when)[2], (name, when)


@pytest.mark.parametrize('when', NONEXISTENT, ids=lambda c: '{0}-{1}-{2}'.format(*c[:3]))
@pytest.mark.parametrize('name', [n for n in SERVICE_NAMES if n != 'jingjue'])
def test_backend_rejects_nonexistent_dates(name, when):
    cls, extra, _day = _services()[name]
    assert _call(cls, _body(*when, extra)).get('ResultCode') != 0, (name, when)


def test_require_civil_ymd_discrimination():
    from websrv.horosa_engine_common import require_civil_ymd
    assert require_civil_ymd(1500, 2, 29) == (1500, 2, 29)
    assert require_civil_ymd(-1, 12, 31) == (-1, 12, 31)
    for bad in [(1582, 10, 5), (1582, 10, 14), (1900, 2, 29), (0, 1, 1), (2026, 4, 31)]:
        with pytest.raises(ValueError):
            require_civil_ymd(*bad)


def test_election_scan_rejects_reform_gap():
    from astrostudy.election_scan import _jd_from
    assert _jd_from('1582-10-15', '00:00:00', '+00:00') - _jd_from('1582-10-04', '00:00:00', '+00:00') == 1.0
    for bad in ('1582-10-10', '2026-02-30'):
        with pytest.raises(ValueError):
            _jd_from(bad, '00:00:00', '+08:00')
