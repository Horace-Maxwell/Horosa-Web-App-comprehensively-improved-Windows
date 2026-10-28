"""西洋盘「时主星」(perchart.getTimerStar)与格局页行星时表(astroextra.compute_planetary_hours)
必须同源同值:此前两套算法在 sunrise / equal24 档同盘落不同小时(北京 1990-05-18 12:00 sunrise 档:时主星 Sun / 表 Venus;
南京 10:00 equal24 档:Moon / Saturn)。改后西洋请求走同一函数;七政请求(带 doubingSu28/guolaoLifeMode)保留报时星太阳时算法。"""
import pytest

from astrostudy.perchart import PerChart
from astrostudy.astroextra import compute_planetary_hours

CASES = [
    ('1990/05/18', '10:00:00', '+08:00', '31n38', '118e27'),   # 南京(离 120E 远):equal24 曾 Moon vs Saturn
    ('1990/05/18', '12:00:00', '+08:00', '39n54', '116e28'),   # 北京:sunrise 曾 Sun vs Venus
    ('2000/01/01', '00:20:00', '-05:00', '40n42', '74w00'),    # 子夜后西半球
    ('2026/06/21', '04:50:00', '+01:00', '51n30', '0w07'),     # 日出前后边界
]


@pytest.mark.parametrize('mode', ['sunrise', 'equal24', 'unequal'])
@pytest.mark.parametrize('date,time,zone,lat,lon', CASES)
def test_western_timer_star_equals_planetary_hours_current_row(mode, date, time, zone, lat, lon):
    data = {'date': date, 'time': time, 'zone': zone, 'lat': lat, 'lon': lon, 'hsys': 1, 'zodiacal': 0,
            'planetaryHourMethod': mode}
    star = PerChart(data).getTimerStar()
    tbl = compute_planetary_hours(dict(data))
    cur = [h for h in tbl['hours'] if h['current']]
    assert cur, 'table has a current row'
    assert star == cur[0]['ruler']


def test_before_fix_discriminant_vectors_now_agree():
    """判别向量(改前红):北京 sunrise 档时主星曾 Sun(表 Venus);南京 equal24 档曾 Moon(表 Saturn)。"""
    bj = {'date': '1990/05/18', 'time': '12:00:00', 'zone': '+08:00', 'lat': '39n54', 'lon': '116e28', 'hsys': 1, 'zodiacal': 0, 'planetaryHourMethod': 'sunrise'}
    assert PerChart(bj).getTimerStar() == 'Venus'
    nj = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1, 'zodiacal': 0, 'planetaryHourMethod': 'equal24'}
    assert PerChart(nj).getTimerStar() == 'Saturn'


def test_guolao_request_keeps_solar_time_algorithm():
    """七政请求带 doubingSu28/guolaoLifeMode → 仍走报时星太阳时三档算法(不受本次统一影响)。"""
    g = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 0, 'zodiacal': 0,
         'doubingSu28': 0, 'guolaoLifeMode': 'yumao', 'planetaryHourMethod': 'equal24'}
    assert PerChart(g).getTimerStar() == 'Moon'


def _guolao_timer(method, solar):
    g = {'date': '2020/11/03', 'time': '10:00:00', 'zone': '+08:00', 'lat': '43n48', 'lon': '87e36', 'hsys': 0, 'zodiacal': 0,
         'doubingSu28': 0, 'guolaoLifeMode': 'asc', 'trueSolarTime': solar}
    if method != 'sunrise':
        g['planetaryHourMethod'] = method
    return PerChart(g).getTimerStar()


def test_guolao_solar_modes_identical_under_sunrise_method():
    """日出起算制式:出生与日出同加太阳时偏移 → 报时星三档恒同(左栏因此置灰)。"""
    assert len({_guolao_timer('sunrise', s) for s in ('true', 'mean', 'off')}) == 1


@pytest.mark.parametrize('method', ['equal24'])
def test_guolao_solar_modes_differ_under_non_sunrise_method(method):
    """非日出制式(廿四时等分):太阳时校正改变出生所落的时 → 三档结果不全同(七政页 / 挂载在全局制式非缺省时透传 planetaryHourMethod)。
    乌鲁木齐经度距东八区中央经线 -32°(平太阳时 -2 时 9 分),11 月初均时差 +16 分 → 钟表 10 时 / 平 7 时 / 真 8 时。"""
    stars = {s: _guolao_timer(method, s) for s in ('true', 'mean', 'off')}
    assert len(set(stars.values())) == 3, stars
