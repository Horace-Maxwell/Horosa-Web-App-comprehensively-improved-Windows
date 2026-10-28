# -*- coding: utf-8 -*-
"""太玄起筮 × 全年份域。

农历 / 冬至的 cnlunar 历表只覆盖整年 1900–2099:此前服务把年份钳到 1900–2100 再查表 ——
2100 年起 cnlunar 越界、整盘失败;1900 年前 / 公元前的「农历」「冬至」显示成 1900 年,与同屏四柱不是同一年。
本测钉住:每档年份都出盘;农历要么为空、要么就是输入那一年;冬至起算落在输入年或其前一年;
域内结果与 cnlunar 逐字相同,域外件在域内与 cnlunar 对拍一致(判据有判别力)。
运行: PYTHONPATH=.:../flatlib-ctrad2:../vendor python3 -m pytest tests/test_taixuan_year_domain.py -q
"""
import datetime

import cnlunar
import pytest

from websrv import webtaixuansrv as tx


def _pan(year, month=6, day=15, hour=10):
    return tx.build_taixuan_pan({"year": year, "month": month, "day": day, "hour": hour, "seed": 12345, "zone": "+08:00"})


def _prev(year):
    return -1 if year == 1 else year - 1


def _ws_year(ws):
    d = ws["date"]
    neg = d.startswith("-")
    y = int(d.lstrip("-").split("-")[0])
    return -y if neg else y


@pytest.mark.parametrize("year", [-500, 1850, 2099, 2100, 2150, 9999])
def test_every_year_casts_and_calendar_matches_input_year(year):
    pan = _pan(year)
    assert pan["taixuan"]["gua"]["name"]
    assert pan["year"] == year
    lunar = pan["lunarDate"]
    if lunar is not None:
        # 6 月中旬:农历年就是输入年(公元前写「公元前…」)
        assert lunar["text"].startswith(tx._year_cn(year) + "年"), lunar
    ws = pan["winterSolstice"]
    if ws is not None:
        assert _ws_year(ws) == _prev(year), ws
        assert 150 <= ws["days"] <= 200, ws
    # 起盘段落照常成形(域外为空时显示「—」而不是抛错)
    rows = {r["label"]: r["value"] for r in pan["sections"][0]["rows"]}
    assert rows["农历"]
    assert rows["冬至起算"]


@pytest.mark.parametrize("year", [-500, 1850, 2100, 2150])
def test_out_of_domain_has_full_domain_calendar(year):
    pan = _pan(year)
    assert pan["lunarDate"] is not None
    assert pan["winterSolstice"] is not None


def test_in_domain_is_cnlunar_verbatim():
    for (y, m, d) in [(1900, 3, 1), (2026, 1, 10), (2026, 6, 15), (2099, 12, 31)]:
        lunar = cnlunar.Lunar(datetime.datetime(y, m, d, 10, 0))
        assert tx._lunar_payload(y, m, d, 10)["text"] == f"{lunar.lunarYearCn}年{lunar.lunarMonthCn[:-1]}{lunar.lunarDayCn}日"


@pytest.mark.parametrize("ymd", [(2026, 1, 10), (2026, 2, 17), (2026, 6, 15), (2026, 12, 25), (2023, 4, 10), (2020, 5, 30), (1985, 11, 20)])
def test_full_domain_engine_agrees_with_cnlunar_inside_domain(ymd):
    y, m, d = ymd
    lunar = cnlunar.Lunar(datetime.datetime(y, m, d, 10, 0))
    full = tx._lunar_full_domain(y, m, d, 8.0)
    assert full["text"] == f"{lunar.lunarYearCn}年{lunar.lunarMonthCn[:-1]}{lunar.lunarDayCn}日"
    ws_full = tx._winter_solstice_full_domain(y, m, d, 8.0)
    core = tx.taixuan_core.Taixuan(y, m, d, 10)
    assert ws_full == {"date": core.getdz_date().strftime("%Y-%m-%d"), "days": core.getdz()}


def test_domain_bounds_are_the_probed_cnlunar_range():
    assert tx.in_cnlunar_domain(1900) and tx.in_cnlunar_domain(2099)
    assert not tx.in_cnlunar_domain(1899) and not tx.in_cnlunar_domain(2100)


def _core_ws(y, m, d):
    core = tx.taixuan_core.Taixuan(y, m, d, 10)
    return {"date": core.getdz_date().strftime("%Y-%m-%d"), "days": core.getdz()}


def test_in_domain_solstice_agrees_with_core_every_year_except_1900():
    """域内逐年:冬至起算与 vendor 核心逐字相同;唯一例外是 1900 年冬至前(核心把 1899 冬至算成 12-21)。"""
    diffs = []
    for y in range(1900, 2100):
        for (m, d) in ((1, 5), (6, 15), (12, 30)):
            got = tx._winter_solstice_payload(y, m, d, 10, 8.0)
            if got != _core_ws(y, m, d):
                diffs.append(((y, m, d), got))
    assert [k for k, _ in diffs] == [(1900, 1, 5), (1900, 6, 15)], diffs
    assert all(g["date"] == "1899-12-22" for _, g in diffs), diffs


def test_solstice_day_count_is_continuous_across_domain_edge():
    """1899-12-20 … 1900-01-05 逐日:冬至当天天数归 0,之后每天加 1(跨域界不许跳 2)。"""
    seq = []
    day = datetime.date(1899, 12, 20)
    while day <= datetime.date(1900, 1, 5):
        seq.append((day, tx._winter_solstice_payload(day.year, day.month, day.day, 10, 8.0)))
        day += datetime.timedelta(days=1)
    for (d0, a), (d1, b) in zip(seq, seq[1:]):
        if d1 == datetime.date(1899, 12, 22):
            assert b == {"date": "1899-12-22", "days": 0}, (d1, b)
        else:
            assert b["days"] == a["days"] + 1 and b["date"] == a["date"], (d0, a, d1, b)
