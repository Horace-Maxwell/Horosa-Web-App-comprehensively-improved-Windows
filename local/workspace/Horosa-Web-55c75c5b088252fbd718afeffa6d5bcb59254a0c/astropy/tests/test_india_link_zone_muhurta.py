"""印占口径锁(续):
- 过运 × 大运联动恒按 Vimshottari(四种树形大运体系下中运都在且相等,卡片写明体系);
- 大运段界 ISO 带出生时区偏移,「当前」按出生地当地此刻判(不看服务器所在时区);
- Abhijit 须臾唯吠陀日周三不取(面板 / 出生须臾 / 择日两种取法同一判据);
- 28 宿口径 Abhijit 的中文名是宿名「牛」(其余皆宿名);
- 极昼 / 极夜 Nathonnatha 按视太阳时取视午夜(不再固定按正午);
- 校时窗口跨日出:日出后的候选按新吠陀日取星期主。
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ASTROPY = os.path.dirname(HERE)

BASE = {'date': '1985/03/12', 'time': '14:30:00', 'zone': '+05:30', 'lat': '19n04', 'lon': '72e52'}


def _srv_chart(data):
    import json
    import cherrypy
    import websrv.webindiasrv as W
    cherrypy.request.json = dict(data)
    return json.loads(W.IndiaAstroSrv().chart())


# ── M6 联动恒按 Vimshottari ───────────────────────────────────────────────
def test_dasha_link_is_vimshottari_for_every_tree_system():
    links = {}
    for sysn in ('vimshottari', 'yogini', 'ashtottari', 'tribhagi'):
        g = _srv_chart(dict(BASE, transitDate='2030/06/01', dashaSystem=sysn))['jyotish']['gochara']
        link = g['dashaLink']
        assert link['system'] == 'vimshottari' and link['systemLabel'] == 'Vimshottari'
        assert link.get('antarLord'), sysn
        links[sysn] = (link['mahaLord']['key'], link['antarLord']['key'])
    assert len(set(links.values())) == 1, links


def test_dasha_link_antar_matches_full_tree_at_every_boundary():
    """未选中时现算的中运 ≡ 选中时全树里的中运(同一纯算术单源)。"""
    import datetime as _dt
    full = _srv_chart(dict(BASE, transitDate='2030/06/01'))['jyotish']['dasha']['vimshottari']
    from astrostudy.india.jyotish_parts.helpers import parse_local_iso
    checked = 0
    for m in full['mahadashas']:
        for a in m.get('antardashas') or []:
            t0 = parse_local_iso(a['startIso'])
            if not ('2026' <= a['startIso'][:4] <= '2045'):
                continue
            after = (t0 + _dt.timedelta(days=2)).strftime('%Y/%m/%d')
            yl = _srv_chart(dict(BASE, transitDate=after, dashaSystem='yogini'))['jyotish']['gochara']['dashaLink']
            assert yl['antarLord']['key'] == a['lord']['key'], (after, yl['antarLord'], a['lord'])
            checked += 1
            if checked >= 4:
                return
    assert checked


# ── L5 段界 ISO 带出生时区 / 当前按出生地此刻 ─────────────────────────────
def test_dasha_iso_carries_birth_zone_offset():
    j = _srv_chart(dict(BASE, transitDate='2030/06/01'))['jyotish']
    v = j['dasha']['vimshottari']
    m0 = v['mahadashas'][0]
    assert m0['startIso'].endswith('+05:30') and m0['endIso'].endswith('+05:30')
    a0 = m0['antardashas'][0]
    assert a0['startIso'].endswith('+05:30')
    assert a0['pratyantardashas'][0]['startIso'] == a0['startIso']
    yo = j['dasha']['yogini']['mahadashas'][0]
    assert yo['startIso'].endswith('+05:30')
    neg = _srv_chart(dict(BASE, zone='-05:00', lat='40n42', lon='74w00'))['jyotish']['dasha']['vimshottari']
    assert neg['mahadashas'][0]['startIso'].endswith('-05:00')


def test_active_flag_uses_birthplace_now(monkeypatch):
    """服务器所在时区不同,当前段按出生地当地此刻判:取一个段界,把「此刻」放在界后 1 小时(出生地墙钟)。"""
    import datetime as _dt
    from astrostudy.india.jyotish_parts import helpers as H
    from astrostudy.india.jyotish_parts import dashas as D
    from astrostudy.india.jyotish_engine import build_jyotish
    from websrv.webindiasrv import IndiaChartKernel
    v = build_jyotish(IndiaChartKernel(dict(BASE, tradition=False, predictive=False, zodiacal=1,
                                            hsys=0, siderealMode='lahiri')))['dasha']['vimshottari']
    bound = v['mahadashas'][3]
    t_local = H.parse_local_iso(bound['startIso']) + _dt.timedelta(hours=1)
    utc_now = t_local - _dt.timedelta(minutes=330)

    class _FakeDT(_dt.datetime):
        @classmethod
        def now(cls, tz=None):
            if tz is None:
                return utc_now - _dt.timedelta(hours=9)          # 「服务器」在 UTC−9 —— 不得被拿来比
            return utc_now.replace(tzinfo=_dt.timezone.utc)
    monkeypatch.setattr(H, 'datetime', _FakeDT)
    v2 = build_jyotish(IndiaChartKernel(dict(BASE, tradition=False, predictive=False, zodiacal=1,
                                             hsys=0, siderealMode='lahiri')))['dasha']['vimshottari']
    assert v2['mahadashas'][3]['active'] is True
    assert v2['mahadashas'][2]['active'] is False
    assert D  # 模块已导入(DashasMixin._now_local 经 helpers.now_at_zone)


def test_zone_helpers():
    from astrostudy.india.jyotish_parts.helpers import zone_offset_minutes, iso_with_zone, parse_local_iso
    import datetime as _dt
    assert zone_offset_minutes('+05:30') == 330 and zone_offset_minutes('-05:00') == -300
    assert zone_offset_minutes(8) == 480 and zone_offset_minutes('8.5') == 510 and zone_offset_minutes(None) is None
    d = _dt.datetime(1997, 1, 4, 7, 57, 58, 123456)
    s = iso_with_zone(d, 330)
    assert s == '1997-01-04T07:57:58.123456+05:30' and parse_local_iso(s) == d
    assert iso_with_zone(d, None) == d.isoformat()


# ── M5 Abhijit 周三不取(单一判据)────────────────────────────────────────
def test_abhijit_single_source_and_scan_excludes_wednesday():
    from astrostudy.india.primitives import abhijit_auspicious, muhurta_effective_nature
    from astrostudy.india.muhurta_day import day_muhurtas
    from astrostudy.india_election_scan import IndiaScanContext, _EVALUATORS as EV, _iter_days
    from astrostudy.election_scan import _jd_from
    assert [abhijit_auspicious(w) for w in range(7)] == [True, True, True, False, True, True, True]
    ab_row = day_muhurtas()[7]
    assert ab_row['isAbhijit']
    assert muhurta_effective_nature(ab_row, 3) == 'mixed' and muhurta_effective_nature(ab_row, 4) == 'auspicious'
    ctx = IndiaScanContext({'zone': '+05:30', 'lat': '28n36', 'lon': '77e12', 'gpsLat': 28.61, 'gpsLon': 77.21,
                            'ayanamsa': 'lahiri'})
    jd0 = _jd_from('2026-01-05', '06:00:00', '+05:30', 1)           # 周一起扫一周
    dom = (jd0, jd0 + 7.0)
    days = list(_iter_days(ctx, dom))
    wed = [(r, s) for r, s, _n, vara in days if vara == 3]
    assert wed, '一周里必有周三'
    picks = EV['muhurta_seg']({'pick': 'abhijit'}, ctx, dom)
    for rise, set_ in wed:
        assert not any(rise <= a < set_ for a, b in picks), '周三的 Abhijit 段不得入选'
    in_dom = [d for d in days if d[3] != 3 and dom[0] < d[0] + (d[1] - d[0]) / 15.0 * 8 and d[0] + (d[1] - d[0]) / 15.0 * 7 < dom[1]]
    assert len(picks) == len(in_dom) >= 5
    good = EV['muhurta_seg']({'pick': 'grade', 'grades': ['auspicious']}, ctx, dom)
    for rise, set_, _n, vara in days:
        slot = (set_ - rise) / 15.0
        a0 = rise + slot * 7
        if not (dom[0] <= a0 and a0 + slot <= dom[1]):
            continue                                              # 域外(扫描首日日出早于域起点)
        covered = any(a <= a0 + 1e-6 and a0 + slot - 1e-6 <= b for a, b in good)
        assert covered == (vara != 3), (vara, covered)


def test_panel_and_birth_muhurta_share_abhijit_rule():
    from astrostudy.india.muhurta_day import birth_muhurta
    from astrostudy.india.jyotish_engine import JyotishEngine
    from websrv.webindiasrv import IndiaChartKernel
    # 2026-01-07 = 周三,德里正午前后(第 8 昼须臾)出生
    k = IndiaChartKernel({'date': '2026/01/07', 'time': '12:20:00', 'zone': '+05:30', 'lat': '28n36',
                          'lon': '77e12', 'tradition': False, 'predictive': False, 'zodiacal': 1, 'hsys': 0,
                          'siderealMode': 'lahiri'})
    mu = JyotishEngine(k).muhurta()
    assert mu['vedicWeekday'] == 3
    assert mu['abhijit']['auspicious'] is False
    bm = mu['birthMuhurta']
    assert bm['isAbhijit'] is True and bm['abhijitAuspicious'] is False and bm['nature'] == 'mixed'
    # 缺省不传星期 → 按表(旧行为)
    raw = birth_muhurta(bm['startJd'] + 1e-4, bm['startJd'] - 7 * (bm['endJd'] - bm['startJd']),
                        bm['startJd'] + 8 * (bm['endJd'] - bm['startJd']), bm['startJd'] + 1.0)
    assert raw['nature'] == 'auspicious' and raw['abhijitAuspicious'] is None


def test_no_scattered_wednesday_literals():
    files = []
    for root, _d, names in os.walk(os.path.join(ASTROPY, 'astrostudy', 'india')):
        files += [os.path.join(root, n) for n in names if n.endswith('.py')]
    files.append(os.path.join(ASTROPY, 'astrostudy', 'india_election_scan.py'))
    pat = re.compile(r'\b(weekday|vara|wd|vedic_weekday)\w*\s*[!=]=\s*3\b')
    bad = []
    for f in files:
        for i, ln in enumerate(open(f, encoding='utf-8').read().splitlines(), 1):
            if pat.search(ln.split('#')[0]):
                bad.append('%s:%d' % (os.path.relpath(f, ASTROPY), i))
    assert not bad, '星期 == 3 字面判据散落(改用 primitives.abhijit_auspicious):' + ', '.join(bad)


# ── L7 Abhijit 中文宿名 ────────────────────────────────────────────────────
def test_abhijit_label_is_mansion_name():
    from astrostudy.india.primitives import ABHIJIT_LABEL
    from astrostudy.india.nakshatra_data import ABHIJIT_ENTRY, NAKSHATRA_DATA
    from astrostudy.nakshatra import nakshatra_from_lon
    assert ABHIJIT_LABEL == '牛' and ABHIJIT_ENTRY['labelCn'] == ABHIJIT_LABEL
    labels = [r['labelCn'] for r in NAKSHATRA_DATA] + [ABHIJIT_LABEL]
    assert all(len(x) == 1 for x in labels) and len(set(labels)) == 28
    assert nakshatra_from_lon(278.0)['nak28Label'] == '牛'


# ── L6 极地 Nathonnatha ────────────────────────────────────────────────────
def test_polar_nathonnatha_follows_apparent_midnight():
    from astrostudy.india.jyotish_engine import JyotishEngine
    from websrv.webindiasrv import IndiaChartKernel

    def eng(t, lat='69n39', lon='18e57'):
        return JyotishEngine(IndiaChartKernel({'date': '2000/06/21', 'time': t, 'zone': '+02:00', 'lat': lat,
                                               'lon': lon, 'tradition': False, 'predictive': False,
                                               'zodiacal': 1, 'hsys': 0, 'siderealMode': 'lahiri'}))
    night, noon = eng('02:00:00'), eng('12:00:00')
    assert night._d1_day_window() is None                       # 极昼:求不出日没
    sun_night = night.shadbala_bphs()['Sun']['kala']['nathonnatha']
    sun_noon = noon.shadbala_bphs()['Sun']['kala']['nathonnatha']
    assert sun_night < 15 < 50 < sun_noon, (sun_night, sun_noon)
    # 常规纬度:视太阳时午夜与「日没—次日出中点」相差 < 2 分钟(同一量的两种取法)
    for t in ('02:00:00', '08:00:00', '21:00:00'):
        e = eng(t, '19n04', '72e52')
        _seg, unnata, _h = e._shadbala_time_context(e._is_day_birth())
        assert abs(unnata - e._apparent_unnata()) < 2.0 / 1440.0, t


# ── L2 校时窗口跨日出 ──────────────────────────────────────────────────────
def test_rectify_window_crossing_sunrise_uses_new_vedic_day():
    import datetime as _dt
    from flatlib.ephem import eph
    from astrostudy.india.kp_system import WEEKDAY_LORDS
    from websrv.webindiasrv import rectify_core, IndiaChartKernel
    from astrostudy.india.primitives import vedic_weekday, weekday_mon0
    base = {'date': '1985/03/12', 'time': '06:00:00', 'zone': '+05:30', 'lat': '19n04', 'lon': '72e52',
            'tradition': False, 'predictive': False, 'zodiacal': 1, 'hsys': 0, 'siderealMode': 'lahiri'}
    k = IndiaChartKernel(dict(base))
    sr = eph.nextSunrise(k.dateTime.jd, k.pos.lat, k.pos.lon)
    # 锚点 = 日出前 10 分钟(当地墙钟)
    from flatlib.datetime import Datetime
    anchor = Datetime.fromJD(sr - 10.0 / 1440.0, '+05:30')
    hh, mm, ss = anchor.time.toList()[1:4]
    d = dict(base, time='%02d:%02d:%02d' % (hh, mm, int(ss)), rectifyWindowMinutes=30, rectifyStepSeconds=300,
             rectifyRpSource='candidate')
    res = rectify_core(d)
    after = [r for r in res['samples'] if r['offsetSeconds'] >= 20 * 60 and r.get('rp')]
    before = [r for r in res['samples'] if r['offsetSeconds'] <= 0 and r.get('rp')]
    assert after and before
    jd_after = sr + 15.0 / 1440.0
    wd_after, _ = vedic_weekday(jd_after, k.pos.lat, k.pos.lon, '+05:30')
    new_lord = WEEKDAY_LORDS[weekday_mon0(wd_after)]
    wd_before, _ = vedic_weekday(sr - 15.0 / 1440.0, k.pos.lat, k.pos.lon, '+05:30')
    old_lord = WEEKDAY_LORDS[weekday_mon0(wd_before)]
    assert new_lord != old_lord
    for r in after:
        assert r['varaLord'] == new_lord, (r['time'], r['varaLord'], new_lord)
        rp = r['rp']
        assert new_lord in set(rp['rpCompared']) | set(rp['rpSelfExcluded'])
    for r in before:
        assert r['varaLord'] == old_lord
    assert res['vara']['note'] == '日界=日出;民用日口径并列回显,二者不同时以日出为准'

