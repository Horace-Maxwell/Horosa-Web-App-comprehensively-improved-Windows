"""[Q-339/T-320] 西洋盘「时主星」(perchart.getTimerStar)与格局页行星时表(astroextra.compute_planetary_hours)
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
