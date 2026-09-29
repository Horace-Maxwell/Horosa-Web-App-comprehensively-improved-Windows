# -*- coding: utf-8 -*-
"""玄学史 · 年号首字分桶(HOROSA_XUANSHI_ERA_INDEX)与全表线性扫逐值等价。

分桶只改「扫哪些候选」,不改「谁命中、谁胜出」:
  · 桶内候选集 = 原全表命中集(年号键皆非空,前缀命中必同首字);
  · 桶内保持原表序 →「等长先到先得」的平手规则不变。
判据:同一进程内对全库天象行(带 / 不带 modern_date 提示年)+ 合成边界语料
(年号 × 年数后缀 × 帝号前缀 × 繁体变体 × 定种子随机串)开关两档逐值相同;
天象库载入结果(27k 行事件字典)两档整表相等。
"""
import os
import random
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

from astrostudy.xuanshi import celestial as C  # noqa: E402
from astrostudy.xuanshi import db  # noqa: E402
from astrostudy.xuanshi import period as P  # noqa: E402


def _corpus():
    pairs = []
    try:
        rows = db.public_conn().execute("SELECT date_phrase, modern_date FROM celestial_event").fetchall()
    except Exception:
        rows = []
    for r in rows:
        pairs.append((r["date_phrase"], C._modern_year(r["modern_date"])))
        pairs.append((r["date_phrase"], None))
    eras = list(P._ERA_ALIASES) + list(P.ERA_BEGINNINGS)
    syn = ["", " ", None, "年", "元年", "三十一年", "帝", "宗泰定", "泰定帝", "泰定帝泰定", "泰定帝泰定四年", "某某帝",
           "王", "太祖", "建中靖國元年", "大中祥符四年二月壬辰", "上元元年五月癸丑", "天寶五載五月壬子",
           "  武德元年十月壬申", "武德 三 年", "武德百年", "武德二十一年", "武德12年", "武德 12 载", "\t建炎\n二年"]
    suffixes = ["", "元年", "二年", "十一年", "二十三年", "百年", "5年", "五載", "五载", "年", "元", "十月壬申", " 元 年"]
    prefixes = ["", "唐高宗", "泰定帝", "某王", "后", "汉武帝", "明", "  ", "太后", "皇后"]
    for e in eras:
        for s in suffixes:
            syn.append(e + s)
        for pf in prefixes:
            syn.append(pf + e + "三年")
    inv = {}
    for k, v in P._ERA_TRAD2SIMP.items():
        inv.setdefault(chr(v) if isinstance(v, int) else v, []).append(chr(k))
    for e in eras:
        for i, ch in enumerate(e):
            for t in inv.get(ch, []):
                syn.append(e[:i] + t + e[i + 1:] + "二年")
                syn.append("泰定帝" + e[:i] + t + e[i + 1:] + "四年")
    rnd = random.Random(20260926)
    alph = sorted(set("".join(eras))) + list("帝宗祖后王年载載元一二三四五六七八九十百 0123456789")
    for _ in range(8000):
        syn.append("".join(rnd.choice(alph) for _ in range(rnd.randint(0, 10))))
    for _ in range(4000):
        syn.append("".join(rnd.choice(eras) for _ in range(rnd.randint(1, 3))) + rnd.choice(suffixes))
    for s in syn:
        for h in (None, 674, 760, 1335, -100):
            pairs.append((s, h))
    return pairs, len(rows)


def _run(pairs):
    out = []
    for s, h in pairs:
        try:
            out.append(P.date_phrase_to_year(s, hint_year=h))
        except Exception as ex:  # 两档须连异常类型都一致
            out.append("EXC:" + type(ex).__name__)
    return out


def test_bucket_index_covers_every_alias_once_in_table_order():
    flat = [k for bucket in P._ERA_BY_FIRST.values() for k in bucket]
    assert sorted(flat) == sorted(P._ERA_ALIASES)
    assert len(flat) == len(set(flat))
    order = {k: i for i, k in enumerate(P._ERA_ALIASES)}
    for first, bucket in P._ERA_BY_FIRST.items():
        assert all(k[0] == first for k in bucket)
        assert [order[k] for k in bucket] == sorted(order[k] for k in bucket)


def test_era_index_matches_linear_scan(monkeypatch):
    pairs, n_rows = _corpus()
    monkeypatch.setattr(P, "_ERA_INDEX_ON", True)
    on = _run(pairs)
    monkeypatch.setattr(P, "_ERA_INDEX_ON", False)
    off = _run(pairs)
    assert on == off
    # 语料确有分量:大量命中年号(非 None)且覆盖全库行
    assert sum(1 for v in on if isinstance(v, int)) > 20000
    if n_rows:
        assert n_rows > 20000


def test_celestial_load_identical_both_modes(monkeypatch):
    try:
        monkeypatch.setattr(P, "_ERA_INDEX_ON", True)
        on = [dict(e) for e in C.load_events(force=True)]
        monkeypatch.setattr(P, "_ERA_INDEX_ON", False)
        off = [dict(e) for e in C.load_events(force=True)]
    finally:
        monkeypatch.setattr(P, "_ERA_INDEX_ON", True)
        C.load_events(force=True)
    if not on:
        pytest.skip("天象库不在场")
    assert len(on) == len(off)
    assert on == off
