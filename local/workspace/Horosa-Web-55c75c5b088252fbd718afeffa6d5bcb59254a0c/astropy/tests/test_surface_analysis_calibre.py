# [SURF 战役 2026-08-19] /astroextra/analysis 古典口径行为差分:
# 病灶=analyze_chart 此前未进 push_classical_request 临界区+compute_planetary_hours
# 双实现分裂(不读 planetaryHourMethod)——右栏 Almuten/逐题主星/行星时对改档全空转。
# 本组用例逐键差分定谳:默认 vs 非默认档,关键面数值必须可分辨。
import pytest

from astrostudy import astroextra

BASE = {
    'date': '1990/06/15', 'time': '10:30:00', 'zone': '+08:00',
    'lat': '39n54', 'lon': '116e28', 'hsys': 5,
}


def _almuten_totals(extra):
    alm = extra.get('almutem') or {}
    totals = alm.get('totals') or {}
    return {k: totals[k] for k in totals}


def test_terms_variant_moves_almuten():
    # 界系换档(埃及→迦勒底)改界主计分 → Almuten 总分向量必须变(临界区未 push 时恒等=回归红)。
    a = astroextra.analyze_chart(dict(BASE))
    b = astroextra.analyze_chart({**BASE, 'termsVariant': 3})
    ta, tb = _almuten_totals(a), _almuten_totals(b)
    assert ta and tb
    assert ta != tb, 'termsVariant=3 未撼动 Almuten(analyze_chart 临界区丢失?)'


def test_triplicity_moves_almuten():
    a = astroextra.analyze_chart(dict(BASE))
    b = astroextra.analyze_chart({**BASE, 'triplicity': 'Ptolemaic'})
    assert _almuten_totals(a) != _almuten_totals(b), 'triplicity 未撼动 Almuten'


def test_almuten_trip_mode_sect_ruler_only():
    a = astroextra.analyze_chart(dict(BASE))
    b = astroextra.analyze_chart({**BASE, 'almutenTripMode': 'sectRulerOnly'})
    ta, tb = _almuten_totals(a), _almuten_totals(b)
    assert ta != tb, 'almutenTripMode=sectRulerOnly 未撼动 Almuten'
    assert sum(tb.values()) < sum(ta.values()), '仅当值主应整体少计分'


def test_planetary_hours_three_modes_differ():
    ha = astroextra.analyze_chart(dict(BASE))['planetaryHours']
    hu = astroextra.analyze_chart({**BASE, 'planetaryHourMethod': 'unequal'})['planetaryHours']
    he = astroextra.analyze_chart({**BASE, 'planetaryHourMethod': 'equal24'})['planetaryHours']
    assert ha and hu and he
    assert ha['hourMode'] == 'sunrise' and hu['hourMode'] == 'unequal' and he['hourMode'] == 'equal24'
    starts = lambda h: [x['start'] for x in h['hours']]
    # 三档时段表两两可分辨(同一北京盘昼夜弧≠12h,三口径必然错位)。
    assert starts(ha) != starts(hu)
    assert starts(hu) != starts(he)
    assert starts(ha) != starts(he)
    # equal24 整点对齐(当地 0 时起等分)。
    assert all(s.endswith(':00') or s[-2:] == '00' for s in [he['hours'][0]['start']])


def test_default_request_untouched_regression_anchor():
    # 零回归锚:不带任何古典键的默认请求,almuten winner 与 push 临界区加入前后必须一致
    # (默认态 push 是 no-op:全键缺省不换表)。冒烟判据=winner 存在且 totals 七星俱全。
    r = astroextra.analyze_chart(dict(BASE))
    alm = r.get('almutem') or {}
    assert alm.get('winner')
    assert len(_almuten_totals(r)) >= 7


def test_planetary_hours_equal24_dawn_birth_uses_civil_day_sun():
    # [SURF-R2a] 凌晨盘 equal24:判 diurnal 须用「出生民用日」的日出日没,
    # 而非「覆盖出生时刻的日出周期」(=前一日)——修前全表恒 diurnal=False。
    from astrostudy import astroextra
    r = astroextra.analyze_chart({'date': '1990/06/15', 'time': '03:00:00',
                                  'zone': '+08:00', 'lat': '39n54', 'lon': '116e28', 'hsys': 5,
                                  'planetaryHourMethod': 'equal24'})
    ph = r.get('planetaryHours')
    assert ph and ph.get('hourMode') == 'equal24'
    diur = [h['diurnal'] for h in ph['hours']]
    assert any(diur) and not all(diur)          # 白昼行在、黑夜行也在
    assert diur[12] is True                      # 正午行必为昼(12:00-13:00)
    assert any(h['current'] for h in ph['hours'])


def test_planetary_hours_sunrise_late_autumn_high_lat_has_current():
    # [SURF-R3a] 高纬秋季日出逐日推迟:行星日 sr→srn>24h,生于尾窗的盘末行放宽到次日出,
    # current 不再全空(修前 68n58 1990-11-28 11:29-11:36 六探全空)。
    from astrostudy import astroextra
    r = astroextra.analyze_chart({'date': '1990/11/28', 'time': '11:33:00',
                                  'zone': '+01:00', 'lat': '68n58', 'lon': '33e05', 'hsys': 5})
    ph = r.get('planetaryHours')
    assert ph is not None
    assert any(h['current'] for h in ph['hours'])


def test_house_ra_sidereal_vs_tropical_divergence_documents_pseudo_ra():
    # [SURF-R1b 佐证] 后端 sweHouses 对恒星制宫头黄经直接做黄→赤旋转,产出的 ra 并非真赤经
    # (差≈ayanamsa 的赤道投影)。前端已按制回落不显;此例锁「两制 ra 确实分岔」的事实,
    # 若未来后端治本(恒星制 ra 修正为真赤经),本例翻红提醒同步放开前端回落。
    from astrostudy.perchart import PerChart
    base = {'date': '1990/06/15', 'time': '12:00:00', 'zone': '+08:00',
            'lat': '39n54', 'lon': '116e28', 'hsys': 5}
    def h10ra(extra):
        co = PerChart({**base, **extra}).getChartObj()
        houses = co['houses'] if isinstance(co, dict) else co.houses
        for h in houses:
            hid = h.get('id') if isinstance(h, dict) else getattr(h, 'id', None)
            if hid == 'House10':
                return h.get('ra') if isinstance(h, dict) else getattr(h, 'ra', None)
        return None
    ra_trop = h10ra({})
    ra_sid = h10ra({'zodiacal': 1, 'siderealAyanamsa': 'lahiri'})
    assert ra_trop is not None and ra_sid is not None
    d = abs(((ra_trop - ra_sid) + 180) % 360 - 180)
    assert d > 5.0   # 伪 ra 与真 ra 差≈ayanamsa 投影(~24°),显著分岔
