# -*- coding: utf-8 -*-
"""古典口径「交点入旺」:开时交点落在双子 / 射手即有自身禀赋(擢升 / 落)与分值,关时交点不进尊贵计算。

定义:双子 3° = 北交点擢升、南交点落;射手 3° = 南交点擢升、北交点落(两交点恒对冲,一旺必一落 / 双旺)。
分值按当前分值表(缺省擢升 +4、落 −4);七政的禀赋与分值不随开关变;请求结束(pop)后尊贵表还原。
"""
import pytest
from flatlib import const
from flatlib.dignities import essential

from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request

BASE = {'time': '10:00:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28', 'hsys': 0, 'zodiacal': 0, 'tradition': False}
SEVEN = const.LIST_SEVEN_PLANETS


def _chart(date, on):
    data = dict(BASE, date=date, nodeExaltation=1 if on else 0)
    tok = push_classical_request(data)
    try:
        return PerChart(data).getChart()
    finally:
        pop_classical_request(tok)


@pytest.mark.parametrize('date,north_sign,want_north,want_south', [
    ('2002/06/01', 'Gemini', 'exalt', 'exalt'),        # 北交双子(旺)· 南交射手(旺)
    ('2012/06/01', 'Sagittarius', 'fall', 'fall'),     # 北交射手(落)· 南交双子(落)
])
def test_nodes_get_exalt_or_fall_when_switch_on(date, north_sign, want_north, want_south):
    on, off = _chart(date, True), _chart(date, False)
    nn, sn = on.get(const.NORTH_NODE), on.get(const.SOUTH_NODE)
    assert nn.sign == north_sign
    sign_score = {'exalt': essential.SCORES['exalt'], 'fall': essential.SCORES['fall']}
    assert nn.selfDignity == [want_north] and nn.score == sign_score[want_north]
    assert sn.selfDignity == [want_south] and sn.score == sign_score[want_south]
    for node in (const.NORTH_NODE, const.SOUTH_NODE):
        o = off.get(node)
        assert getattr(o, 'selfDignity', None) is None and getattr(o, 'score', None) is None
    for pid in SEVEN:
        a, b = on.get(pid), off.get(pid)
        assert (a.selfDignity, a.score) == (b.selfDignity, b.score), pid


def test_nodes_elsewhere_get_no_dignity_and_table_restored():
    on = _chart('2013/03/01', True)     # 北交天蝎:不在双子 / 射手
    for node in (const.NORTH_NODE, const.SOUTH_NODE):
        assert getattr(on.get(node), 'selfDignity', None) is None
    # 请求结束后尊贵表还原:不开开关时交点不在任何擢升 / 落位
    assert all((row.get('exalt') or [None])[0] not in (const.NORTH_NODE, const.SOUTH_NODE)
               and (row.get('fall') or [None])[0] not in (const.NORTH_NODE, const.SOUTH_NODE)
               for row in essential.TABLE.values())
    assert essential.score(const.NORTH_NODE, 'Gemini', 3) == 0
