import pytest

from astrostudy import babylon_tables as B

BASE = dict(date='1950/01/01', time='00:00:00', zone='+00:00', lat='47n36', lon='122w20')
# 1950-01-01 0h UT、47°36′N 122°20′W 各 ziqpu 星的时角(独立核对过的逐星读数)
REFERENCE_HA = [124.40, 117.04, 104.60, 90.72, 79.65, 71.62, 58.93, 32.63, 27.81, 0.43, 343.96, 328.33, 303.85, 287.56, 276.49,
                259.49, 258.18, 224.89, 222.18, 208.44, 191.99, 186.31, 169.88, 161.11, 151.63, 129.67]


def test_ziqpu_hour_angles_match_within_a_tenth_of_a_degree():
    rows = B.build_babylon_tables(BASE)['ziqpu']['rows']
    assert len(rows) == 26
    for row, ha in zip(rows, REFERENCE_HA):
        assert row['ha'] == pytest.approx(ha, abs=0.1), row['star']


def test_ziqpu_beru_and_states():
    rows = B.build_babylon_tables(BASE)['ziqpu']['rows']
    first = rows[0]
    assert (first['ago']['beru'], first['ago']['us']) == (4, 4)
    assert (first['in']['beru'], first['in']['us']) == (7, 26)
    assert [r['star'] for r in rows if r.get('state') == 'now'] == ['α Lac']
    assert [r['star'] for r in rows if r.get('state') == 'next'] == ['λ And']
    assert sum(r['civ'] for r in rows) == pytest.approx(360.0)


def test_precession_matches_the_catalogue_for_a_bright_star():
    # 用 Capella 的 J2000 位置走自家岁差,与星历库(含自行)差不到 0.05°
    import swisseph
    jd = 2433282.5
    ra, dec = B._precess(79.17233, 45.99799, jd)
    cat = swisseph.fixstar2_ut('Capella', jd, swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL)[0]
    assert ra == pytest.approx(cat[0], abs=0.05) and dec == pytest.approx(cat[1], abs=0.05)


@pytest.mark.parametrize('dec, path, margin', [(6 + 22 / 60, 'Anu', 10 + 38 / 60), (-14 - 47 / 60, 'Anu', 2 + 13 / 60), (20.0, 'Enlil', 3.0), (-23.0, 'Ea', 6.0)])
def test_three_paths(dec, path, margin):
    assert B.path_of(dec)[0] == path
    assert B.path_of(dec)[1] == pytest.approx(margin, abs=1e-9)


def test_goal_year_rows():
    rows = B.build_babylon_tables(BASE)['goalYear']
    moon = rows[0]
    assert moon['id'] == 'Moon' and moon['syn'] == pytest.approx(223.0, abs=0.01)
    assert [r['years'] for r in rows[1:]] == [46, 8, 79, 47, 71, 83, 59]
    merc = rows[1]
    assert merc['date'].startswith('1904-01-01')
    assert abs(merc['dl']) < 5          # 46 年后水星几乎回到同一黄经


def test_goal_year_handles_bc_year_zero_and_leap_days():
    bc = B.build_babylon_tables(dict(date='-500/03/10', time='12:00:00', zone='+03:00', lat='32n33', lon='44e25'))['goalYear']
    assert len(bc) == 8 and bc[1]['date'].startswith('-0546-03-10')
    cross = B.build_babylon_tables(dict(date='0030/03/10', time='12:00:00', zone='+03:00', lat='32n33', lon='44e25'))['goalYear']
    assert cross[1]['date'].startswith('-0017-03-10')          # 没有公元 0 年:30 − 46 = 公元前 17 年
    leap = B.build_babylon_tables(dict(date='2024/02/29', time='12:00:00', zone='+03:00', lat='32n33', lon='44e25'))['goalYear']
    assert leap[2]['date'].startswith('2016-02-29')            # 目标年有 2 月 29 日就不退
    assert leap[1]['date'].startswith('1978-02-28')            # 没有才退到 28 日


def test_beru_wraps_at_a_full_turn():
    assert B._beru(359.8) == {'beru': 0, 'us': 0, 'minutes': 0.0}


def test_beru_keeps_minutes_just_past_culmination():
    assert B._beru(0.3) == {'beru': 0, 'us': 0, 'minutes': pytest.approx(1.2)}


SEATTLE_SKY = dict(date='1975/02/10', time='21:15:00', zone='-08:00', lat='47n36', lon='122w20')


_SKY = {}


def _events(name):
    if 'sky' not in _SKY:
        _SKY['sky'] = B.build_babylon_tables(SEATTLE_SKY)
    return {p['id']: p for p in _SKY['sky']['phenomena']}[name]


def test_phenomena_conjunctions_stations_oppositions():
    mars = _events('Mars')
    conj = [e for e in mars['events'] if e['kind'] == 'conjunction']
    assert conj[0]['date'].startswith('1974-10-14 04:5')
    assert [e['kind'] for e in mars['events'] if e['kind'] in ('firstStation', 'opposition', 'secondStation')][:3] == ['firstStation', 'opposition', 'secondStation']
    saturn = _events('Saturn')
    last = [e for e in saturn['events'] if e.get('state') == 'last'][0]
    assert last['kind'] == 'opposition' and last['date'].startswith('1975-01-06 01:2')
    mercury = _events('Mercury')
    kinds = {e['kind'] for e in mercury['events']}
    assert {'inferiorConjunction', 'superiorConjunction', 'morningStation', 'eveningStation', 'morningFirst', 'eveningLast'} <= kinds


def test_phenomena_visibility_at_birth():
    assert _events('Venus')['visible'] is True and _events('Venus')['since'].startswith('1974-12-29 16:5')
    assert _events('Mars')['visible'] is False and _events('Mars')['since'].startswith('1974-06-15 21:1')
    assert _events('Jupiter')['visible'] is True


def test_phenomena_window_and_order():
    for p in B.build_babylon_tables(SEATTLE_SKY)['phenomena']:
        days = [e['days'] for e in p['events']]
        assert days == sorted(days)
        period = B.SYNODIC[p['id']]
        assert all(-period - 1e-6 <= d <= period + 1e-6 for d in days)
        assert sum(1 for e in p['events'] if e.get('state') == 'last') == 1
        assert sum(1 for e in p['events'] if e.get('state') == 'next') == 1
        outer = p['id'] not in B.INNER
        assert outer == any(e['kind'] == 'opposition' for e in p['events'])


def test_phenomena_bc_and_polar_do_not_break():
    bc = B.build_babylon_tables(dict(date='-500/03/10', time='12:00:00', zone='+03:00', lat='32n33', lon='44e25'))
    assert bc['phenomena'] and all(p['events'] for p in bc['phenomena'])
    polar = B.build_babylon_tables(dict(SEATTLE_SKY, lat='78n00'))['phenomena']
    assert len(polar) == 5 and all(p['polar'] and p['visible'] is None for p in polar)
    assert all(e['sym'] not in ('Γ', 'Σ', 'Ξ', 'Ω') for p in polar for e in p['events'])


def test_ziqpu_works_inside_the_polar_circle():
    from astrostudy.babylon_tables import build_babylon_tables
    res = build_babylon_tables({'date': '2024/06/20', 'time': '23:00:00', 'zone': '+02:00', 'lat': '69n39', 'lon': '18e57'})
    assert res['ziqpu']


def test_high_latitude_heliacal_events_stay_in_the_sequence_marked_delayed():
    """赫尔辛基仲夏:每个会合周期仍各有始见、末见;离日 40° 外发生的(夏夜天光推迟)照列,标 delayed。"""
    from astrostudy import babylon_tables as B
    res = B.build_babylon_tables({'date': '2024/06/20', 'time': '23:00:00', 'zone': '+03:00', 'lat': '60n10', 'lon': '24e56'})
    heliacal = {'morningFirst', 'eveningLast', 'eveningFirst', 'morningLast'}
    saturn = next(p for p in res['phenomena'] if p['id'] == 'Saturn')
    kinds = [e['kind'] for e in saturn['events'] if e['kind'] in heliacal]
    assert 'morningFirst' in kinds and 'eveningLast' in kinds
    body = dict(B.PHENOMENA_PLANETS)['Saturn']
    for planet in res['phenomena']:
        for event in planet['events']:
            if event['kind'] in heliacal:
                far = abs(B._elong(event['jd'], dict(B.PHENOMENA_PLANETS)[planet['id']])[1]) > B.HELIACAL_MAX_ELONGATION
                assert bool(event.get('delayed')) == far
    assert sum(p['twilight'] for p in res['phenomena']) > 0
