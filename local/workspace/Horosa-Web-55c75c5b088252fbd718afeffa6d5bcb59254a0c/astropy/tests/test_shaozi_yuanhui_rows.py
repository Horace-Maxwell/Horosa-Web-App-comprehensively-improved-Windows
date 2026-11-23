# 邵子数「元会运世」段:按真实出生年(年柱同干支、立春前取上一年)重算;只给读得懂的几行,不摊原始周期字典、不印「错误：—」
import datetime

from websrv import webshaozisrv as S


def test_birth_year_follows_year_pillar():
    assert S._yuanhui_birth_year(datetime.datetime(1990, 5, 17, 8, 30), "庚午") == 1990
    assert S._yuanhui_birth_year(datetime.datetime(1990, 1, 20, 8, 30), "己巳") == 1989   # 立春前
    assert S._yuanhui_birth_year(datetime.datetime(1990, 5, 17, 8, 30), "甲子") == 1990   # 年柱手改对不上:按公历年


def test_rows_are_readable():
    rows = S._yuanhui_rows(S._yuanhui_of(1990))
    labels = [r["label"] for r in rows]
    assert labels == ["出生年", "元会运世", "人生阶段", "时代阶段"]
    text = " ".join(str(r["value"]) for r in rows)
    assert "birth_year" not in text and "错误" not in labels
    assert S._yuanhui_rows({"error": "x"}) == [{"label": "说明", "value": "元会运世没算出来"}]
