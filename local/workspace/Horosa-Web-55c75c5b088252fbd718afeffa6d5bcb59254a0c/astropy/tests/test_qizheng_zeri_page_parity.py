# -*- coding: utf-8 -*-
"""七政择日:内嵌页起盘(宿主钉的各档 + 工作台三参数,经七政页同一构参)× 扫描引擎内定口径逐项对拍。

扫描后端只收宿度制 / 罗计 / 月孛三项,其余口径内定(回归黄经 12 等分地支宫、命宫 = 上升所落宫、罗睺 = 升交点、
紫炁 = 28 年平行度、钟表时刻);宿主给内嵌页钉的其余档(报时星太阳时 / 身宫法 / 罗计称谓 / 宫起点等)必须不改变
扫描判的任何一项。判的项 = 十一曜所落宫与宿、命宫、行度(顺逆与速度)、昼夜。
参数来源 tests/fixtures/qizheng_zeri_page_params.json(前端产出由 jest qizhengZeriPageParams 锁成与它相同)。
"""
import json
import os

import pytest

from astrostudy import perchart
from astrostudy.qizheng_election_scan import QizhengScanContext, GONG_SEQ
from astrostudy.election_scan import _jd_from
from flatlib import const

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'fixtures', 'qizheng_zeri_page_params.json'), encoding='utf-8') as fh:
    FIX = json.load(fh)
BASE = FIX['params']
VARIANTS = [('default', {})] + sorted(FIX['variants'].items())
# 内嵌页左栏亲手改了宿主钉的档(只进覆盖层,点结果行回到钉值):这些档在页面构参里会带出的键,逐个核不改扫描判的任何一项
PAGE_ONLY = [('trueSolarMean', {'trueSolarTime': 'mean'}), ('trueSolarOff', {'trueSolarTime': 'off'}),
             ('bodyYoujin', {'guolaoBodyMode': 'youjin'}), ('hourUnequal', {'planetaryHourMethod': 'unequal'})]
BODIES = [(const.SUN, '日'), (const.MOON, '月'), (const.VENUS, '金'), (const.JUPITER, '木'), (const.MERCURY, '水'),
          (const.MARS, '火'), (const.SATURN, '土'), (const.NORTH_NODE, '罗睺'), (const.SOUTH_NODE, '计都'),
          (const.DARKMOON, '月孛'), (const.PURPLE_CLOUDS, '紫炁')]
SAMPLES = [('2026-03-01', '10:00:00'), ('2026-06-21', '23:40:00'), ('2025-11-07', '05:15:00'), ('2027-01-15', '17:30:00')]


def _scan_ctx(params):
    data = {'gpsLat': params['gpsLat'], 'gpsLon': params['gpsLon'], 'zone': params['zone'],
            'su28Mode': params['doubingSu28']}
    if params.get('guolaoNodeType') == 'true':
        data['nodeType'] = 'true'
    if params.get('guolaoLilithType') == 'true':
        data['lilithType'] = 'true'
    return QizhengScanContext(data)


@pytest.mark.parametrize('variant,extra', VARIANTS + PAGE_ONLY)
@pytest.mark.parametrize('d,t', SAMPLES)
def test_page_chart_equals_scan(variant, extra, d, t):
    params = dict(BASE, **extra)
    params['date'] = d.replace('-', '/')
    params['time'] = t
    pc = perchart.PerChart(dict(params))
    pc.getFixedStarSu28()   # 页面盘按所选宿度制给各曜定宿
    m = _scan_ctx(params).moment(_jd_from(d, t, params['zone'], 1))
    for oid, nm in BODIES:
        o = pc.chart.getObject(oid)
        assert GONG_SEQ[int((o.lon % 360.0) // 30.0) % 12] == m.gong(nm), (variant, d, t, nm, 'gong')
        assert getattr(o, 'su28', None) == m.xiu(nm), (variant, d, t, nm, 'xiu')
        if nm not in ('紫炁',):   # 紫炁页面无自行(恒按顺),扫描按 28 年平行度;两边「顺 / 非留」判定一致,下一条另核
            assert abs((o.lonspeed or 0.0) - m.speed(nm)) < 1e-6, (variant, d, t, nm, 'speed')
    asc = pc.chart.getAngle(const.ASC)
    assert GONG_SEQ[int((asc.lon % 360.0) // 30.0) % 12] == m.asc_gong(), (variant, d, t, 'asc')
    assert bool(pc.chart.isDiurnal()) == (m.sun_alt() > 0), (variant, d, t, 'day_night')


def test_ziqi_motion_state_same():
    """紫炁:页面自行恒 0、无速度谱 → 页面标「顺」;扫描按 28 年平行度 0.0352°/日 > 留阈 0.02 → 顺。两边都永不判留 / 逆。"""
    m = _scan_ctx(BASE).moment(_jd_from('2026-03-01', '10:00:00', '+08:00', 1))
    assert m.speed('紫炁') > 0.02


def test_fixture_variants_discriminate():
    """判别力自证:三个变体在样本里确实改变了扫描判的某一项(否则对拍空转)。"""
    d, t = SAMPLES[0]
    base = _scan_ctx(BASE).moment(_jd_from(d, t, '+08:00', 1))
    for name, extra in FIX['variants'].items():
        mv = _scan_ctx(dict(BASE, **extra)).moment(_jd_from(d, t, '+08:00', 1))
        diff = any(abs(base.lon(nm) - mv.lon(nm)) > 1e-6 or base.xiu(nm) != mv.xiu(nm) for _oid, nm in BODIES)
        assert diff, name
