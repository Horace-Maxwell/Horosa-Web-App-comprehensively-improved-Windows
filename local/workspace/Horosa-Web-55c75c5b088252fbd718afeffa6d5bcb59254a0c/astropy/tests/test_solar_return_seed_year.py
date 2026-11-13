"""太阳返照取「所选那一年」的返照:种子 = 所选年份 + 生日月日 + 出生时刻,当年返照常在这个钟面之前几小时,
此前向后求根跳到下一年(1990-06-15 12:00 +08:00 生人选 2020–2027 全部得下一年)。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib.datetime import Datetime  # noqa: E402
from astrostudy.perchart import PerChart  # noqa: E402
from astrostudy.perpredict import PerPredict  # noqa: E402


def _predict():
    data = {"date": "1990/06/15", "time": "12:00:00", "zone": "+08:00", "lat": "31n14", "lon": "121e28",
            "hsys": 0, "zodiacal": 0, "tradition": False, "predictive": False}
    return data, PerPredict(PerChart(dict(data)))


def test_return_lands_in_selected_year():
    data, pred = _predict()
    for year in range(2020, 2028):
        res = pred.getSolarReturnByDate(dict(data), f'{year}-06-15 12:00')
        assert res['date'].startswith(str(year)), (year, res['date'])


def test_seed_far_from_birthday_still_finds_next_return():
    data, pred = _predict()
    res = pred.getSolarReturnByDate(dict(data), '2024-01-01 00:00')
    assert res['date'].startswith('2024'), res['date']
