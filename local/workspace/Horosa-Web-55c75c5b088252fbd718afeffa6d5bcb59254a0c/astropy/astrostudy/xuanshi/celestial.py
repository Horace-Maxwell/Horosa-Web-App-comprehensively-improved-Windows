"""天象大章 — celestial_event(27K 行) 列表 / 详情 / 聚合 / 微年表。

数据源 ``public_data.sqlite/celestial_event``（只读）。表的 ``omen`` 列已是预归一标签，
对外 facet/聚合统一折叠到 14 个产品类（见 omen.fold_to_canonical）。
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any, Optional

from . import db
from .fmt import fmt_modern
from .omen import CANONICAL_LABELS, fold_to_canonical

_CANONICAL_LABEL_SET = set(CANONICAL_LABELS) | {"未分类"}
from .period import all_macros, year_to_macro, date_phrase_to_year

# celestial_event 完整列（与表 schema 对齐）
_CE_COLS = (
    "event_id, source, source_label, source_file, row_index, history, volume_no, "
    "paragraph_no, citation, date_phrase, era, julian_date, year, dynasty, "
    "omen_raw, omen, subject, action, target, original, interpretation, "
    "modern, modern_date, modern_date_disp, modern_precision, "
    "has_crosswalk, day_delta, routing_theme, in_chapter"
)

# horosa_xuanshi_longtext_ondemand_v1 —— 微年表长文本按需取 + 模块级 memo。
# ``micro`` 子表：微年表结果按 (history, omen_type, decade, limit) 缓存。库是只读 bundle
# （db.py 以 mode=ro 打开），无随机 / 无 now / 无副作用 → 同参恒同结果，缓存与现算逐字节一致。
# ``MICRO_LIST_LIMIT``：无筛选总览列表的下发条数上限，必须与前端 XuanShiMicro 的渲染上限一致
# （XuanShiMicro 只渲染 events.slice(0, 300)），warmup 亦按此值预热同一 memo 键。
MICRO_LIST_LIMIT = 300
_MICRO_CACHE_MAX = 32

_CACHE: dict[str, Any] = {"events": None, "micro": {}}


def _modern_year(md: Optional[str]) -> Optional[int]:
    """'0760-07-11' / '-0014-01-30' / '1011-03-08' → 公历年;解析不了返 None。"""
    if not md:
        return None
    m = re.match(r"^(-?\d{1,5})-", f"{md}")
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def effective_year(date_phrase: Optional[str], stored_year: Optional[int], modern_date: Optional[str]) -> Optional[int]:
    """[Q-486/T-448] 天象「公历年」的运行时纠偏(库列 ``year`` 由旧版 date_phrase_to_year 生成,433 条错一两百年:
    「大中祥符」被「大中」截走成 847、「建中靖国」被「建中」截走成 780、「泰定帝泰定四年」只取到元年、
    唐肃宗「上元」记成高宗 674…)。库文件只读不改,这里按修好的解析器重算:
      · 年号纪年解析成功 → 以之为准(同名年号按 modern_date 年份择近);
      · 解析不了 → 沿用库值(与旧行为一致,零回归)。
    对 798 条「year 与 modern_date 年份差 1」的农历跨年行,重算结果与库值相同(它们本就是年号纪年的正确值)。
    """
    hint = _modern_year(modern_date)
    y = date_phrase_to_year(date_phrase, hint_year=hint)
    if y is not None:
        return y
    if stored_year is not None:
        return stored_year
    # [TL-36/T-217 2026-09-18] 年号解析不了且库列 year 为空,但 modern_date 有公历日期(10,256 条)→ 取公历日期之年,
    # 否则起年 / 终年筛选会把这些有日期的天象全部排除(帮助称按公历年筛)。三者皆空才 None。
    return hint


_MACRO_SPAN: dict[str, tuple[int, int]] = {name: (a, b) for name, a, b in all_macros()}


def effective_dynasty(stored: Optional[str], year: Optional[int]) -> Optional[str]:
    """[Q-485/T-447] 星象大典「朝代」= 按公历年归入的大朝代(帮助原话),而库列 dynasty 按**史书归属**填写
    (《宋史》整体记北宋 → 1127 年后 2,023 条仍标北宋、316 年后 116 条仍标西晋,选「南宋 / 东晋」查不到)。
    规则:库列是大朝代名且其区间容得下该年(±1 年容农历跨年)→ 沿用(辽 / 金 / 西夏等史书归属正确者不动);
    容不下 → 按年重归(year_to_macro);库列非大朝代名或无年 → 原样。
    """
    if year is None:
        return stored or None
    if stored and stored in _MACRO_SPAN:
        a, b = _MACRO_SPAN[stored]
        if a - 1 <= year <= b + 1:
            return stored
        return year_to_macro(year) or stored
    if stored:
        return stored
    return year_to_macro(year)


def _row_to_event(r) -> dict[str, Any]:
    """celestial_event 行 → 事件字典。omen 折叠到 14 类（保留原始 omen_raw）。"""
    _eff_year = effective_year(r["date_phrase"], r["year"], r["modern_date"])
    return {
        "event_id": r["event_id"] or f"{r['source']}-{r['row_index']}",
        "source": r["source"] or "",
        "source_label": r["source_label"] or "",
        "source_file": r["source_file"] or "",
        "row_index": r["row_index"] or 0,
        "history": r["history"],
        "volume_no": r["volume_no"],
        "paragraph_no": r["paragraph_no"],
        "citation": r["citation"],
        "date_phrase": r["date_phrase"],
        "era": r["era"],
        "julian_date": r["julian_date"],
        "year": _eff_year,
        "dynasty": effective_dynasty(r["dynasty"], _eff_year),
        "omen_raw": r["omen_raw"] or "",
        "omen": fold_to_canonical(r["omen"] or r["omen_raw"]),
        "subject": r["subject"],
        "action": r["action"],
        "target": r["target"],
        "original": r["original"] or "",
        "interpretation": r["interpretation"] or "",
        "modern": r["modern"] or "",
        "modern_date": r["modern_date"] or "",
        "modern_date_disp": (r["modern_date_disp"]
                             or (fmt_modern(r["modern_date"], "", r["modern_precision"] or "")
                                 if r["modern_date"] else "")),
        "modern_precision": r["modern_precision"] or "",
        "has_crosswalk": bool(r["has_crosswalk"]),
        "day_delta": r["day_delta"],
        "routing_theme": r["routing_theme"],
        "in_chapter": bool(r["in_chapter"]),
    }


def load_events(force: bool = False) -> list[dict[str, Any]]:
    if not force and _CACHE["events"] is not None:
        return _CACHE["events"]
    conn = db.public_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM celestial_event ORDER BY year, source_file, row_index"
        ).fetchall()
    except Exception:
        rows = []
    events = [_row_to_event(r) for r in rows]
    # [Q-486/T-448] SQL 按旧 year 列排序;纠偏后按有效年重排(无年者沿后,原相对序不变)。
    events.sort(key=lambda e: (e["year"] is None, e["year"] if e["year"] is not None else 0, e["source_file"], e["row_index"]))
    _CACHE["events"] = events
    if force:
        _CACHE["micro"].clear()   # horosa_xuanshi_longtext_ondemand_v1：强制重载时一并弃 memo
    return events


# ============================================================
# 聚合
# ============================================================

def summarize(events: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(events)
    with_year = sum(1 for e in events if e["year"] is not None)
    by_source: Counter = Counter()
    by_history: Counter = Counter()
    by_dynasty: Counter = Counter()
    by_omen: Counter = Counter()
    by_decade: Counter = Counter()
    has_crosswalk = sum(1 for e in events if e["has_crosswalk"])
    in_chapter = sum(1 for e in events if e["in_chapter"])

    matrix: dict[tuple[str, str], int] = defaultdict(int)
    for e in events:
        if e["source_label"]:
            by_source[e["source_label"]] += 1
        if e["history"]:
            by_history[e["history"]] += 1
        if e["dynasty"]:
            by_dynasty[e["dynasty"]] += 1
        by_omen[e["omen"]] += 1
        if e["year"] is not None:
            by_decade[(e["year"] // 10) * 10] += 1
        if e["dynasty"] and e["omen"] and e["omen"] != "未分类":
            matrix[(e["dynasty"], e["omen"])] += 1

    macro_order = [m for m, _, _ in all_macros() if m in by_dynasty]
    omen_order = [o for o in CANONICAL_LABELS if o in by_omen and o not in ("未分类", "其他")]

    matrix_rows: list[dict[str, Any]] = []
    for m in macro_order:
        row = {"macro": m, "total": by_dynasty[m], "cells": []}
        for o in omen_order:
            row["cells"].append({"omen": o, "n": matrix.get((m, o), 0)})
        matrix_rows.append(row)

    return {
        "total": total,
        "with_year": with_year,
        "has_crosswalk": has_crosswalk,
        "in_chapter": in_chapter,
        "by_source": by_source.most_common(),
        "by_history": by_history.most_common(),
        "by_dynasty": [(m, by_dynasty[m]) for m in macro_order],
        "by_omen": by_omen.most_common(),
        "by_decade": sorted(by_decade.items()),
        "matrix_rows": matrix_rows,
        "matrix_omens": omen_order,
        "max_decade_n": max(by_decade.values()) if by_decade else 1,
        "max_cell": max(matrix.values()) if matrix else 1,
    }


def filter_events(
    events: list[dict[str, Any]],
    *,
    dynasty: Optional[str] = None,
    omen: Optional[str] = None,
    history: Optional[str] = None,
    source: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    has_crosswalk: Optional[bool] = None,
    in_chapter: Optional[bool] = None,
    keyword: Optional[str] = None,
) -> list[dict[str, Any]]:
    kw = (keyword or "").strip().lower()
    out: list[dict[str, Any]] = []
    for e in events:
        if dynasty and e["dynasty"] != dynasty:
            continue
        if omen and e["omen"] != omen:
            continue
        if history and e["history"] != history:
            continue
        if source and e["source_label"] != source:
            continue
        if year_from is not None and (e["year"] is None or e["year"] < year_from):
            continue
        if year_to is not None and (e["year"] is None or e["year"] > year_to):
            continue
        if has_crosswalk is not None and e["has_crosswalk"] != has_crosswalk:
            continue
        if in_chapter is not None and e["in_chapter"] != in_chapter:
            continue
        if kw:
            hay = " ".join([
                e["original"] or "", e["interpretation"] or "", e["date_phrase"] or "",
                e["subject"] or "", e["action"] or "", e["target"] or "", e["omen_raw"] or "",
            ]).lower()
            if kw not in hay:
                continue
        out.append(e)
    return out


# ============================================================
# 列表（分页）+ 详情
# ============================================================

def list_events(
    *,
    dynasty: Optional[str] = None,
    omen: Optional[str] = None,
    history: Optional[str] = None,
    source: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    has_crosswalk: Optional[bool] = None,
    in_chapter: Optional[bool] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 30,
) -> dict[str, Any]:
    all_events = load_events()
    filtered = filter_events(
        all_events, dynasty=dynasty, omen=omen, history=history, source=source,
        year_from=year_from, year_to=year_to, has_crosswalk=has_crosswalk,
        in_chapter=in_chapter, keyword=keyword,
    )
    any_filter = any(v is not None for v in (
        dynasty, omen, history, source, year_from, year_to, has_crosswalk, in_chapter, keyword,
    ))
    total = len(filtered)
    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 30), 200))
    pages = (total + page_size - 1) // page_size if total else 0
    start = (page - 1) * page_size
    page_events = filtered[start:start + page_size]
    return {
        "events": page_events,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "global_summary": summarize(all_events),
        "filtered_summary": summarize(filtered) if any_filter else None,
        "omen_labels": CANONICAL_LABELS,
    }


def get_event(event_id: str) -> Optional[dict[str, Any]]:
    if not event_id:
        return None
    for e in load_events():
        if e["event_id"] == event_id:
            return e
    return None


def term_profile(omen_canonical: str) -> dict[str, Any]:
    """某一类 omen 的事件画像（朝代/史书/年代分布 + 均衡样本）。"""
    events = [e for e in load_events() if e["omen"] == omen_canonical]
    if not events:
        return {"total": 0, "samples": []}

    macro_order = [m for m, _, _ in all_macros()]
    by_history: Counter = Counter()
    by_dynasty: Counter = Counter()
    by_decade: Counter = Counter()
    by_source: Counter = Counter()
    raw_variants: Counter = Counter()
    in_chapter = with_crosswalk = with_year = 0
    earliest_year = latest_year = None

    for e in events:
        if e["history"]:
            by_history[e["history"]] += 1
        if e["dynasty"]:
            by_dynasty[e["dynasty"]] += 1
        if e["year"] is not None:
            with_year += 1
            by_decade[(e["year"] // 10) * 10] += 1
            earliest_year = e["year"] if earliest_year is None else min(earliest_year, e["year"])
            latest_year = e["year"] if latest_year is None else max(latest_year, e["year"])
        if e["source_label"]:
            by_source[e["source_label"]] += 1
        if e["omen_raw"]:
            raw_variants[e["omen_raw"].strip()] += 1
        if e["in_chapter"]:
            in_chapter += 1
        if e["has_crosswalk"]:
            with_crosswalk += 1

    # 去重样本：同事件常在多源 CSV 重复
    seen: set[tuple] = set()
    unique: list[dict[str, Any]] = []
    for e in events:
        if not e["original"]:
            continue
        key = (e["history"] or "", e["date_phrase"] or "", (e["original"] or "")[:40])
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)
    unique.sort(key=lambda e: (
        0 if e["in_chapter"] else 1,
        0 if e["has_crosswalk"] else 1,
        -(e["year"] or -9999),
    ))
    # 朝代均衡：每朝最多 4，凑 24
    per_macro_cap = 4
    picked_count: Counter = Counter()
    picked: list[dict[str, Any]] = []
    leftover: list[dict[str, Any]] = []
    for e in unique:
        m = e["dynasty"] or "_"
        if picked_count[m] < per_macro_cap:
            picked.append(e)
            picked_count[m] += 1
        else:
            leftover.append(e)
        if len(picked) >= 24:
            break
    if len(picked) < 24:
        picked.extend(leftover[: 24 - len(picked)])

    return {
        "omen": omen_canonical,
        "total": len(events),
        "with_year": with_year,
        "in_chapter": in_chapter,
        "with_crosswalk": with_crosswalk,
        "earliest_year": earliest_year,
        "latest_year": latest_year,
        "by_history": by_history.most_common(),
        "by_dynasty": [(m, by_dynasty[m]) for m in macro_order if m in by_dynasty],
        "by_decade": sorted(by_decade.items()),
        "by_source": by_source.most_common(),
        "raw_variants": raw_variants.most_common(20),
        "max_decade_n": max(by_decade.values()) if by_decade else 1,
        "samples": picked,
    }


# ============================================================
# 微年表 — 直接走 SQL（带 history/omen/decade 过滤）
# ============================================================

# 列表查询只取短列：``original`` / ``interpretation`` / ``modern`` 三个长文本列被排除在
# SELECT 之外（WHERE 里仍可引用它们，筛选语义分毫未变），全表扫描的 I/O 与序列化因此塌缩。
# 真正要下发的那几百行，再按 rowid 走一次窄查询把长文本贴回去（``_micro_texts``）。
_MICRO_LIST_COLS = (
    "rowid AS _rid, event_id, source_file, row_index, history, volume_no, paragraph_no, "
    "date_phrase, era, julian_date, year, dynasty, omen, omen_raw, subject, action, target, "
    "modern_date, modern_date_disp, modern_precision, routing_theme"
)


def _micro_texts(conn, rids: list[int]) -> dict[int, Any]:
    """按 rowid 批量取长文本列（rowid 唯一；event_id 在本表并不唯一，不能作主键用）。"""
    out: dict[int, Any] = {}
    step = 400   # 远低于 SQLite 变量上限，避免 too many SQL variables
    for i in range(0, len(rids), step):
        chunk = rids[i:i + step]
        ph = ",".join("?" * len(chunk))
        sql = (
            "SELECT rowid AS _rid, original, interpretation, modern "
            f"FROM celestial_event WHERE rowid IN ({ph})"
        )
        for r in conn.execute(sql, chunk).fetchall():
            out[r["_rid"]] = r
    return out


def microchronology(
    history: Optional[str] = None,
    omen_type: Optional[str] = None,
    decade: Optional[int] = None,
    limit: Optional[int] = None,
) -> dict[str, Any]:
    """微年表。``limit``=下发事件条数上限（``None``=全量，天象大典年代下钻按此口径）。

    horosa_xuanshi_longtext_ondemand_v1：summary 恒按**全部**命中行统计（total /
    with_year / by_history / by_omen / by_decade 与旧版逐字段一致），只有 ``events``
    数组按 ``limit`` 截断；长文本只贴给真正下发的那些行，其余可经
    ``microchronology_detail(event_id)`` 按需取回（正文迟到，绝不丢失）。
    结果按参数 memo，同参二次调用零查询。
    """
    lim = None if limit is None else max(0, int(limit))
    ckey = (history or "", omen_type or "", decade, lim)
    cached = _CACHE["micro"].get(ckey)
    if cached is not None:
        return cached

    conn = db.public_conn()
    where: list[str] = []
    params: list[Any] = []
    if history:
        where.append("history=?")
        params.append(history)
    # [Q-484/T-446] 左栏「按征兆类型」的计数是 fold_to_canonical 归一后的类计数,点击却把类名当子串去
    # LIKE omen / omen_raw / original 三列 →「星变 30」点开得 11,239 条(「流星星变」被「星变」命中、原文提到
    # 「客星」「月食」的其它类也被带入)。现:类名 ∈ 14 类 → 与计数同一函数在 Python 侧按归一类精确过滤;
    # 非类名(自由文本)才保留子串匹配。
    omen_canonical = omen_type if (omen_type and omen_type in _CANONICAL_LABEL_SET) else None
    if omen_type and not omen_canonical:
        where.append("(omen LIKE ? OR omen_raw LIKE ? OR original LIKE ?)")
        like = f"%{omen_type}%"
        params.extend([like, like, like])
    # [Q-486/T-448] 十年期过滤改到 Python 侧按纠偏后的有效年(库列 year 有 433 条错一两百年)。
    sql = f"""
        SELECT {_MICRO_LIST_COLS}
        FROM celestial_event
    """
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY year IS NULL, year, modern_date, history, row_index"
    rows = conn.execute(sql, params).fetchall()

    # horosa_xuanshi_longtext_ondemand_v1:先按上游口径在 Python 侧过滤(归一类精确匹配 + 有效年十年期),
    # 再对**全部**命中行做 summary 统计;只有下发的 events 按 limit 截断(长文本按需回贴)。
    by_hist: Counter = Counter()
    by_omen: Counter = Counter()
    by_decade: Counter = Counter()
    decade_omens_map: dict[int, Counter] = defaultdict(Counter)
    hits: list[tuple[Any, Optional[int], str]] = []
    total = 0
    with_year = 0
    for r in rows:
        year = effective_year(r["date_phrase"], r["year"], r["modern_date"])
        omen = fold_to_canonical(r["omen"] or r["omen_raw"])
        if omen_canonical and omen != omen_canonical:
            continue
        if decade is not None and (year is None or year < decade or year >= decade + 10):
            continue
        hits.append((r, year, omen))
        total += 1
        if r["history"]:
            by_hist[r["history"]] += 1
        if omen:
            by_omen[omen] += 1
        if year:
            with_year += 1
            dd = (int(year) // 10) * 10
            by_decade[dd] += 1
            if omen:
                decade_omens_map[dd][omen] += 1
    # [Q-486/T-448] SQL 的 ORDER BY 用旧 year 列;按有效年稳定重排(无年者沿后),再按 limit 截断下发。
    hits.sort(key=lambda h: (h[1] is None, h[1] if h[1] is not None else 0))

    kept = hits if lim is None else hits[:lim]
    texts = _micro_texts(conn, [h[0]["_rid"] for h in kept]) if kept else {}
    events: list[dict[str, Any]] = []
    for r, year, omen in kept:
        t = texts.get(r["_rid"])
        events.append({
            "event_id": r["event_id"],
            "history": r["history"],
            "volume_no": r["volume_no"],
            "paragraph_no": r["paragraph_no"],
            "period": effective_dynasty(r["dynasty"], year),   # [Q-485/T-447] 与大典同律按年重归
            "title": r["date_phrase"] or r["modern_date_disp"] or r["event_id"],
            "original": t["original"] if t is not None else None,
            "year": year,
            "date_phrase": r["date_phrase"],
            "era": r["era"] or r["modern_date_disp"] or "",
            "omen": omen,
            "omen_raw": r["omen_raw"] or "",
            "interpretation": (t["interpretation"] or t["modern"] or "") if t is not None else "",
            "routing_theme": r["routing_theme"] or "",
            "subject": r["subject"] or "",
            "target": r["target"] or "",
            "modern_date_disp": r["modern_date_disp"] or "",
            # [Q-495/T-457] 下发儒略日:modern_date 同列混两种历法 —— 有 julian_date 者 modern_date 是由
            # 儒略日换算的格里历,无者就是史料所载的儒略历日期。显示层据此按来源标「公历/儒略历」,
            # 此前本查询不下发该列 → 前端无从分辨、一律标「公历」。
            "julian_date": r["julian_date"] or "",
            # [Q-487/T-449] 精度同下发:月级/年级/年段的合成日期不得被当精确日(排此日提示「约」+ 年级按 1 月 1 日)。
            "modern_precision": r["modern_precision"] or "",
        })
    summary = {
        "by_history": by_hist.most_common(),
        "by_omen": by_omen.most_common(30),
        "by_decade": sorted(by_decade.items()),
        "decade_omens": {d: dict(c) for d, c in decade_omens_map.items()},
        "total": total,
        "with_year": with_year,
    }
    res = {"events": events, "summary": summary}
    if len(_CACHE["micro"]) >= _MICRO_CACHE_MAX:
        _CACHE["micro"].clear()
    _CACHE["micro"][ckey] = res
    return res


def microchronology_detail(event_id: str) -> dict[str, Any]:
    """horosa_xuanshi_longtext_ondemand_v1：按 event_id 取回长文本（列表被 ``limit``
    截断后的兜底取数路径）。只读、幂等，可安全客户端缓存。"""
    if not event_id:
        return {}
    conn = db.public_conn()
    row = conn.execute(
        "SELECT event_id, original, interpretation, modern FROM celestial_event "
        "WHERE event_id=? LIMIT 1",
        (event_id,),
    ).fetchone()
    if row is None:
        return {}
    return {
        "event_id": row["event_id"],
        "original": row["original"],
        "interpretation": row["interpretation"] or row["modern"] or "",
        "modern": row["modern"] or "",
    }


def decade_omens() -> dict[str, Any]:
    """十年期 × omen 堆叠序列（供曲线/面积图）。"""
    events = load_events()
    by_decade: dict[int, Counter] = defaultdict(Counter)
    omen_totals: Counter = Counter()
    for e in events:
        if e["year"] is None:
            continue
        d = (e["year"] // 10) * 10
        by_decade[d][e["omen"]] += 1
        omen_totals[e["omen"]] += 1
    decades = sorted(by_decade.keys())
    omens = [o for o in CANONICAL_LABELS if o in omen_totals and o not in ("未分类", "其他")]
    series = []
    for o in omens:
        series.append({"omen": o, "data": [by_decade[d].get(o, 0) for d in decades]})
    return {"decades": decades, "omens": omens, "series": series}
