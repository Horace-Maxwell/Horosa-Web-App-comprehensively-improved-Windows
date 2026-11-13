import threading

import pytest
import swisseph

from flatlib import const

from astrostudy.india import transit_events as T

BASE = dict(date='2024/04/05', time='12:06:00', zone='+00:00', lat='47n36', lon='122w20', hsys=5)
ALL_KINDS = ['sign', 'nakshatra', 'pada', 'kakshya']


def events(**extra):
    return T.build_transit_events(dict(BASE, **extra))


def lahiri_lon(jd, body):
    swisseph.set_sid_mode(swisseph.SIDM_LAHIRI)
    return swisseph.calc_ut(jd, body, swisseph.FLG_SWIEPH | swisseph.FLG_SIDEREAL)[0][0]


def test_sign_ingress_lands_on_a_boundary():
    rows = events(transitDays=90, transitPlanet=const.SUN, transitKind='sign')['rows']
    assert len(rows) == 3
    for row in rows:
        assert abs((row['lon'] + 15.0) % 30.0 - 15.0) < 1e-3
        assert lahiri_lon(row['jd'] + 1e-3, swisseph.SUN) % 30.0 < 0.01


def test_kinds_step_by_their_own_span():
    for kind, span in (('nakshatra', 40 / 3), ('pada', 10 / 3), ('kakshya', 3.75)):
        for row in events(transitDays=20, transitPlanet=const.MOON, transitKind=kind)['rows']:
            nearest = round(row['lon'] / span) * span
            assert abs(row['lon'] - nearest) < 1e-3


def test_kakshya_numbers_and_lords():
    rows = events(transitDays=60, transitPlanet=const.MOON, transitKind='kakshya')['rows']
    assert {row['number'] for row in rows} == set(range(1, 9))
    for row in rows:
        assert row['number'] == int((row['lon'] % 30.0 + 1e-6) // 3.75) + 1
        assert row['lord'] == T.KAKSHYA_LORDS[row['number'] - 1]
    assert {row['lord'] for row in rows if row['number'] == 8} == {const.ASC}


def test_pada_is_one_to_four():
    rows = events(transitDays=30, transitPlanet=const.MOON, transitKind='pada')['rows']
    assert {row['number'] for row in rows} == {1, 2, 3, 4}


def test_retrograde_marks_the_segment_it_backs_into():
    rows = events(transitStart='2024/04/01', transitDays=25, transitPlanet=const.MERCURY, transitKind='pada')['rows']
    back = [row for row in rows if row['retrograde']]
    assert back
    # 2024-04-09 左右逆行穿界,星退入第 4 足,下一段继续往回
    numbers = [row['number'] for row in back]
    assert all(((before - after) % 4) == 1 for before, after in zip(numbers, numbers[1:]))


def test_moon_never_retrogrades():
    assert not any(row['retrograde'] for row in events(transitDays=30, transitPlanet=const.MOON, transitKind='sign')['rows'])


def test_time_uses_the_chart_zone():
    utc = events(transitPlanet=const.SUN, transitKind='sign', transitDays=60)['rows'][0]
    east = events(zone='+08:00', transitPlanet=const.SUN, transitKind='sign', transitDays=60)['rows'][0]
    assert utc['jd'] == pytest.approx(east['jd'], abs=1e-3)
    assert utc['time'] != east['time'] or utc['date'] != east['date']


def test_start_date_is_local_midnight():
    east = events(zone='+08:00', transitStart='2024/05/01', transitDays=1, transitPlanet=const.MOON, transitKind=ALL_KINDS)['rows']
    assert all(row['date'] in ('2024-05-01', '2024/05/01', '2024-05-02', '2024/05/02') for row in east)


def test_order_and_cap():
    result = events(transitDays=366, transitKind=ALL_KINDS)
    assert result['truncated'] is True and result['total'] > T.MAX_EVENTS
    assert len(result['rows']) == T.MAX_EVENTS
    jds = [row['jd'] for row in result['rows']]
    assert jds == sorted(jds)


def test_bad_values_fall_back():
    result = events(transitDays='x', transitPlanet='Pluto', transitKind='nope')
    assert result['days'] == 30
    assert {row['kind'] for row in result['rows']} == {'sign'}


def test_days_are_clamped():
    assert events(transitDays=99999, transitPlanet=const.SATURN, transitKind='sign')['days'] == T.MAX_DAYS
    assert events(transitDays=-5, transitPlanet=const.SATURN, transitKind='sign')['days'] == 1


def test_ayanamsa_shifts_the_moment():
    lahiri = events(transitPlanet=const.SUN, transitKind='sign', transitDays=60)['rows'][0]
    other = events(siderealAyanamsa='raman', transitPlanet=const.SUN, transitKind='sign', transitDays=60)['rows'][0]
    assert lahiri['jd'] != pytest.approx(other['jd'], abs=0.1)


def test_relation_with_the_sign_lord():
    rows = events(transitDays=366, transitPlanet=const.SUN, transitKind='sign')['rows']
    assert {row['sign']: row['relation'] for row in rows}[4] == 'own'


def test_each_row_stays_on_the_requested_ayanamsa_under_load():
    # sid_mode 是进程全局,别的请求随时会改
    params = dict(transitDays=60, transitPlanet=const.MOON, transitKind='nakshatra', siderealAyanamsa='raman')
    quiet = events(**params)['rows']
    stop = threading.Event()

    def other_request():
        while not stop.is_set():
            swisseph.set_sid_mode(swisseph.SIDM_FAGAN_BRADLEY)

    thread = threading.Thread(target=other_request)
    thread.start()
    try:
        busy = events(**params)['rows']
    finally:
        stop.set()
        thread.join()
    assert [row['number'] for row in busy] == [row['number'] for row in quiet]
    assert [row['jd'] for row in busy] == pytest.approx([row['jd'] for row in quiet], abs=2e-5)


@pytest.mark.parametrize('kind, span, count', [('sign', 30.0, 12), ('nakshatra', 40 / 3, 27)])
def test_number_is_the_segment_the_body_just_entered(kind, span, count):
    rows = events(transitDays=120, transitKind=kind)['rows']
    assert rows
    for row in rows:
        body = T.BODY_IDS[row['planet']]
        assert row['number'] == int(lahiri_lon(row['jd'] + 5e-4, body) // span) % count + 1


def test_first_pada_starts_at_the_nakshatra_head():
    rows = [row for row in events(transitDays=60, transitPlanet=const.MOON, transitKind='pada')['rows'] if row['number'] == 1]
    assert rows
    for row in rows:
        assert min(row['lon'] % (40 / 3), 40 / 3 - row['lon'] % (40 / 3)) < 1e-3


def test_kakshya_lords_run_in_the_fixed_order():
    order = (const.SATURN, const.JUPITER, const.MARS, const.SUN, const.VENUS, const.MERCURY, const.MOON, const.ASC)
    rows = events(transitDays=40, transitPlanet=const.MOON, transitKind='kakshya')['rows']
    assert {row['number'] for row in rows} == set(range(1, 9))
    for row in rows:
        expected = int(lahiri_lon(row['jd'] + 5e-4, swisseph.MOON) % 30.0 // 3.75)
        assert row['number'] == expected + 1 and row['lord'] == order[expected]


def test_retrograde_row_reads_the_segment_it_backed_into():
    rows = [row for row in events(transitDays=366, transitPlanet=const.MERCURY, transitKind='nakshatra')['rows'] if row['retrograde']]
    assert rows
    for row in rows:
        lon = lahiri_lon(row['jd'] + 5e-4, swisseph.MERCURY)
        assert row['number'] == int(lon // (40 / 3)) + 1
        assert lahiri_lon(row['jd'] - 5e-4, swisseph.MERCURY) % 360.0 > lon % 360.0 or lon > 359.0


def test_sign_ingress_names_the_lord_of_the_new_sign():
    rows = events(transitDays=30, transitPlanet=const.SUN, transitKind='sign')['rows']
    assert rows[0]['number'] == 1 and rows[0]['lord'] == const.MARS and rows[0]['relation'] == 'friend'


def test_relation_reads_from_the_transiting_body():
    assert T._relation(const.MERCURY, const.MOON) == 'enemy'
    assert T._relation(const.MOON, const.MERCURY) == 'friend'
    assert T._relation(const.SUN, const.SUN) == 'own'


def test_start_date_converts_with_the_zone_sign():
    expected = swisseph.julday(2024, 4, 5, 0.0) - 8.0 / 24.0
    assert T._start_jd({'transitStart': '2024/04/05', 'zone': '+08:00'}, None) == pytest.approx(expected, abs=1e-9)


def test_rows_stay_inside_the_window_and_keep_the_earliest():
    data = dict(transitStart='2024/04/05', zone='+00:00', transitDays=366, transitKind=['pada', 'kakshya'])
    result = events(**data)
    start = swisseph.julday(2024, 4, 5, 0.0)
    assert result['truncated'] is True and len(result['rows']) == 600
    assert all(start < row['jd'] <= start + 366 for row in result['rows'])
    # 七星一年的足与段远超 600 条,留下的是最早的那批
    assert result['rows'][-1]['jd'] < start + 100


def test_range_limits_are_literal():
    assert T._days({'transitDays': 999}) == 366
    assert T._days({}) == 30
    assert T._planets('nope') == list(T.SEVEN)


@pytest.mark.parametrize('name', [const.MOON, const.MERCURY, const.SATURN])
def test_step_size_loses_nothing(name, monkeypatch):
    start = swisseph.julday(2024, 1, 1, 0.0)
    kernel_args = (name, 'pada', start, start + 200, '+00:00')
    coarse = T.planet_events(*kernel_args)
    monkeypatch.setitem(T.STEP_DAYS, name, T.STEP_DAYS[name] / 5.0)
    fine = T.planet_events(*kernel_args)
    assert [row['number'] for row in coarse] == [row['number'] for row in fine]
    assert [row['jd'] for row in coarse] == pytest.approx([row['jd'] for row in fine], abs=2e-5)


def test_rows_never_pass_the_end_of_a_short_window():
    start = swisseph.julday(2024, 4, 5, 0.0)
    for days in (1, 2, 3):
        rows = events(transitStart='2024/04/05', transitDays=days, transitKind=['pada', 'kakshya'])['rows']
        assert rows and all(row['jd'] <= start + days for row in rows)
    # 窗口恰好在一次穿界之前结束,步长比窗口长也不能走出去把它报出来
    crossing = T.planet_events(const.SUN, 'pada', start, start + 30, '+00:00')[0]['jd']
    assert T.planet_events(const.SUN, 'pada', crossing - 0.2, crossing - 0.01, '+00:00') == []
