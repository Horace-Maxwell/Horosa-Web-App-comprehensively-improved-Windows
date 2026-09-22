# T-49:世运事件时刻按本命时区钟面回给前端(CCG 通道按本命 zone 解释);不带 zone 仍是 UT。
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from websrv import webacgsrv as srv  # noqa: E402


def test_zone_to_hours_forms():
    assert srv._zone_to_hours('+08:00') == 8.0
    assert srv._zone_to_hours('-05:30') == -5.5
    assert srv._zone_to_hours('8') == 8.0
    assert srv._zone_to_hours(5.5) == 5.5
    assert srv._zone_to_hours('+0800') == 8.0
    assert srv._zone_to_hours(None) == 0.0
    assert srv._zone_to_hours('') == 0.0
    assert srv._zone_to_hours('abc') == 0.0
