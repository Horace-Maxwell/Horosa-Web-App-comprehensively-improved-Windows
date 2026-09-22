"""[Q-254/T-224 ①, T-225] 太阳三态 sunPos 按黄经差直算(与偕日相 phase 链同阈值 17'/8.5°,同源);不再依赖相位表/容许度判据体系。"""
from astrostudy.perchart import PerChart

BASE = {'zone': '+08:00', 'lat': '31n14', 'lon': '121e28', 'hsys': 1, 'zodiacal': 0}


def _state(date, time, pid, **kw):
    d = dict(BASE); d.update({'date': date, 'time': time}); d.update(kw)
    pc = PerChart(d); pc.getChartObj(); pc.getAspects()
    o = pc.chart.get(pid)
    return getattr(o, 'sunPos', None), getattr(o, 'phase', None)


def test_cross_sign_combust_survives_whole_sign_orb_system():
    # 1990-06-28 04:00 日 95.90°(巨蟹)/ 水 89.93°(双子)距 5.97°:整星座两档此前丢「燃烧」
    assert _state('1990/06/28', '04:00:00', 'Mercury') == ('Combust', 'combust')
    assert _state('1990/06/28', '04:00:00', 'Mercury', orbSystem='wholeSign') == ('Combust', 'combust')
    assert _state('1990/06/28', '04:00:00', 'Mercury', orbSystem='wholeSignMoiety')[0] == 'Combust'


def test_sunbeams_beyond_by_aspect_cap():
    # 1990-01-19 16:00 土星距日 11.22°:「按相位名」档合相封顶 8° 此前不再判日光束下
    assert _state('1990/01/19', '16:00:00', 'Saturn')[0] == 'Sunbeams'
    assert _state('1990/01/19', '16:00:00', 'Saturn', orbSystem='byAspect')[0] == 'Sunbeams'


def test_default_thresholds_unified_between_sunpos_and_phase():
    # 8.2322°:此前 sunPos=Combust / phase=underBeams;0.2792°(16.75'):此前 sunPos=Cazimi / phase=combust
    assert _state('1990/01/05', '18:00:00', 'Mercury') == ('Combust', 'combust')
    assert _state('1990/05/04', '12:00:00', 'Mercury') == ('Cazimi', 'cazimi')
