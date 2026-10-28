"""推运主页「按日期」九个入口 × 公元前 / 补零 / 五位年目标日;四张年表跨公元元年无 0 年重复行、日期串补位。

病理:
- helper.getChartDate 先按 '/' 拆、只有一段再按 '-' 拆:公元前的 '-0001-06-01' 拆成 ['', '0001', '06', '01'],年份为空 → 抛错,
  九个入口一律回「param error」;月返同月第二次求返照 dirparts[0].split('-') 同病。
- 年表循环 range(int(year) + 1, …) 含 0 年:flatlib 把 0 年读作公元前 1 年,多出一行与上一行同盘;日期串不补位('-2-03-10'、'01-03-10')。
判据:各入口四种写法都出盘(返照类返照盘太阳回到本命位),年表日期严格递增、无 0 年、串形与 civil_calendar 同。
"""
import pytest

from flatlib import const
from flatlib.geopos import GeoPos

from astrostudy import helper
from astrostudy.civil_calendar import parse_civil_date, civil_julday
from astrostudy.perchart import PerChart

BASE = {'time': '12:00:00', 'zone': '+00:00', 'lat': '41n54', 'lon': '12e30', 'hsys': 0}
TARGETS = ['-0001-06-01 00:00', '-0001/06/01 00:00', '0050-06-01 00:00', '12000-01-01 00:00']


def _sun(pc):
    return pc.chart.getObject(const.SUN).lon


def _moon(pc):
    return pc.chart.getObject(const.MOON).lon


def _dlon(a, b):
    return abs(((a - b + 180.0) % 360.0) - 180.0)


@pytest.fixture(scope='module')
def natal():
    pc = PerChart(dict(BASE, date='-0003/03/10', ad=-1, predictive=True))
    return pc, pc.getPredict()


def _params():
    return dict(date='-0003/03/10', time='12:00:00', zone='+00:00', lat='41n54', lon='12e30', hsys=0)


def test_get_chart_date_single_source():
    assert helper.getChartDate('-1-06-01') == '-0001/06/01'
    assert helper.getChartDate('-0001/06/01') == '-0001/06/01'
    assert helper.getChartDate('50-06-01') == '0050/06/01'
    assert helper.getChartDate('12000-01-01') == '12000/01/01'
    # 公元后常规写法:与旧输出起盘同值(旧输出 '2026/07/19')
    assert helper.getChartDate('2026-07-19') == '2026/07/19'
    assert helper.getChartDate('2026/07/19') == '2026/07/19'


@pytest.mark.parametrize('target', TARGETS)
def test_return_entries_land_on_natal(natal, target):
    pc, pp = natal
    ns, nm = _sun(pc), _moon(pc)
    r = pp.getSolarReturnByDate(_params(), target)
    assert _dlon(_sun(PerChart(r['dirParams'])), ns) < 0.01
    r = pp.getSolarReturnByDatePos(_params(), target, GeoPos('41n54', '12e30'))
    assert _dlon(_sun(PerChart(r['dirParams'])), ns) < 0.01
    r = pp.getLunarReturn(_params(), target, GeoPos('41n54', '12e30'))
    assert _dlon(_moon(PerChart(r['dirParams'])), nm) < 0.05
    sec = r.get('secLuneReturn')
    if sec:
        assert _dlon(_moon(PerChart(sec['dirParams'])), nm) < 0.05


@pytest.mark.parametrize('target', TARGETS)
def test_other_by_date_entries_build(natal, target):
    pc, pp = natal
    zone = '+00:00'
    assert pp.getProfectionByDate(target, zone)['chart']['objects']
    assert pp.getGivenYear(_params(), target, GeoPos('41n54', '12e30'))['chart']['objects']
    assert pp.getSolarArcByDate(target, 1)['chart']['objects']
    assert pp.getPlanetaryArcByDate(target, 1)['chart']['objects']
    assert pp.getPersianDirectedByDate(target)['chart']['objects']
    res = pp.getPrimaryDirectionChartByDate(target, zone)
    assert 'err' not in res


def test_lunar_return_second_round_bc_month_start(natal):
    """公元前目标月初:第一返照落在 < 5 日时同月再找一次(旧写法 split('-') 撕裂负年 → 崩)。"""
    pc, pp = natal
    nm = _moon(pc)
    hits = 0
    for mon in range(1, 13):
        r = pp.getLunarReturn(_params(), '-0001-{0:02d}-01 00:00'.format(mon), GeoPos('41n54', '12e30'))
        ay, m, d = parse_civil_date(r['date'])
        if d < 5:
            sec = r.get('secLuneReturn')
            if sec:
                hits += 1
                ay2, m2, _d2 = parse_civil_date(sec['date'])
                assert (ay2, m2) == (ay, m)
                assert _dlon(_moon(PerChart(sec['dirParams'])), nm) < 0.05
    assert hits >= 1


def _jd_of(text):
    ay, m, d = parse_civil_date(text)
    return civil_julday(ay, m, d)


@pytest.mark.parametrize('table', ['getSolarReturn', 'getProfection', 'getSolarArc', 'getPlanetaryArc'])
def test_year_tables_cross_ad1_without_year_zero(natal, table):
    pc, pp = natal
    fn = getattr(pp, table)
    rows = fn(_params()) if table == 'getSolarReturn' else (fn() if table == 'getProfection' else fn(1))
    dates = [r['date'].split(' ')[0] for r in rows]
    assert len(dates) == (89 if table == 'getSolarReturn' else 99)
    for t in dates:
        y = t[1:].split('-')[0] if t.startswith('-') else t.split('-')[0]
        assert len(y) >= 4, t                     # 年份补位(civil_calendar 同形)
        assert not t.startswith('0000') and not t.startswith('-0000'), t
    jds = [_jd_of(t) for t in dates]
    assert all(b > a for a, b in zip(jds, jds[1:])), dates[:8]     # 严格递增:无重复行
    assert '0001' in ''.join(d[:5] for d in dates)                 # 跨过公元元年
    if table == 'getSolarReturn':
        ns = _sun(pc)
        for r in rows[:6]:
            assert _dlon(_sun(PerChart(r['dirParams'])), ns) < 0.01


def test_modern_tables_unchanged_shape():
    """公元后出生:年表日期串与旧拼法逐字相同(年 ≥ 1000、月日来自本命串)。"""
    pc = PerChart(dict(BASE, date='1990/03/10', ad=1, predictive=True))
    pp = pc.getPredict()
    prof = pp.getProfection()
    assert [p['date'] for p in prof[:3]] == ['1991-03-10', '1992-03-10', '1993-03-10']
    sa = pp.getSolarArc(1)
    assert sa[0]['date'] == '1991-03-10'
    sr = pp.getSolarReturn(dict(date='1990/03/10', time='12:00:00', zone='+00:00', lat='41n54', lon='12e30', hsys=0))
    assert len(sr) == 89
    assert sr[0]['date'][:4] == '1991'


# ── 2 月 29 日出生:年表各行日期必须真实存在(平年不写出 2001-02-29),且与起盘实际算的那天同源 ──
@pytest.mark.parametrize('birth', ['2000/02/29', '1500/02/29'])
@pytest.mark.parametrize('table', ['getProfection', 'getSolarArc', 'getPlanetaryArc'])
def test_year_table_dates_exist_for_leap_day_birth(birth, table):
    from astrostudy.civil_calendar import civil_ymd_valid, display_year
    pc = PerChart(dict(BASE, date=birth, predictive=True))
    pr = pc.getPredict()
    rows = getattr(pr, table)() if table == 'getProfection' else getattr(pr, table)(-1)
    assert len(rows) == 99
    bad = []
    for r in rows:
        ay, m, d = parse_civil_date(r['date'])
        if not civil_ymd_valid(display_year(ay), m, d):
            bad.append(r['date'])
    assert not bad, '年表写出了不存在的日期:%s' % bad[:5]
    first = [r['date'] for r in rows[:4]]
    y0 = int(birth[:4])
    if y0 >= 1583:
        # 格里历 2 月 29 日生、平年落 3 月 1 日(起盘引擎的读法)
        assert first == ['%04d-03-01' % (y0 + 1), '%04d-03-01' % (y0 + 2), '%04d-03-01' % (y0 + 3), '%04d-02-29' % (y0 + 4)]
    else:
        # 周年日取在连续太阳年轴上:儒略 1500-02-29 = 外推格里历 1500-03-10,其后各年的同一太阳日落儒略
        # 2 月 28 日(闰年 29 日)——一个回归年后太阳回到原位正是儒略 2 月 28 日,不是 3 月 1 日(那是 366 天)。
        assert first == ['%04d-02-28' % (y0 + 1), '%04d-02-28' % (y0 + 2), '%04d-02-28' % (y0 + 3), '%04d-02-29' % (y0 + 4)]


def test_solar_return_dir_params_era_flag_follows_new_date():
    """公元前本命(ad=-1)推到公元后的返照:dirParams 的 ad 随新日期改成 1(沿用 -1 会把公元 39 年的返照盘当成公元前 39 年)。"""
    params = dict(date='-0050/03/10', time='12:00:00', zone='+01:00', lat='41n54', lon='12e30', hsys=0, ad=-1)
    pc = PerChart(dict(params, predictive=True))
    rows = pc.getPredict().getSolarReturn(dict(params))
    for r in rows:
        dp = r.get('dirParams') or {}
        if 'ad' in dp:
            assert int(dp['ad']) == (-1 if str(dp['date']).startswith('-') else 1), (dp['date'], dp['ad'])
    assert any(not str((r.get('dirParams') or {}).get('date', '-')).startswith('-') for r in rows)
