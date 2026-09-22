"""玄史核心查询：玄学事件(xuanxue_event) + 地图 + 人物共现图 + 时间线 + 全局统计。

数据源 ``public_data.sqlite``（只读）。事件白话译文/解读从 ``editorial.sqlite``
的 ``translation`` 表（source_kind='event_card'）批量注入。
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from typing import Any, Optional

from . import db
from .period import all_macros, classify_period

# ============================================================
# 朝代大类映射 — 史书 → 朝代分组（正史导航轴）
# ============================================================

DYNASTY_GROUPS: list[tuple[str, list[str], str]] = [
    ("先秦两汉", ["史記", "漢書"], "☰"),
    ("东汉", ["後漢書"], "☱"),
    ("三国", ["三國志"], "☲"),
    ("两晋", ["晉書"], "☴"),
    ("南北朝", ["宋書", "南齊書", "梁書", "陳書", "魏書", "北齊書", "周書", "南史", "北史"], "☷"),
    ("隋", ["隋書"], "☵"),
    ("唐", ["舊唐書", "新唐書"], "☉"),
    ("五代", ["舊五代史", "新五代史"], "☶"),
    ("宋", ["宋史"], "☯"),
    ("辽金", ["遼史", "金史"], "☋"),
    ("元", ["元史"], "☄"),
    ("明", ["明史"], "☽"),
]

# 野载语料分类
CORPUS_GROUPS: list[tuple[str, list[str], str]] = [
    ("志怪笔记", ["xiaoshuo"], "☲"),
    ("道教神仙", ["daozang"], "☯"),
    ("佛教神异", ["buddhist"], "卍"),
    ("占书天象", ["shushu"], "☄"),
]

TRADITION_ZHENGSHI = "正史"
TRADITION_YEZAI = "野载"

# xuanxue_event 公共列（与 SELECT 对齐）
_XX_COLS = (
    "event_id, tradition, corpus, genre, history, volume_no, citation, title, "
    "period, region, dynasty, operators, targets, techniques, trigger, procedure, "
    "outcome, evidence, original_text, version_risk, reliability_note, cross_ref, paragraph_no"
)


def _parse_paragraph_no(citation: Optional[str]) -> Optional[int]:
    if not citation:
        return None
    m = re.search(r"段\s*(\d+)", citation)
    if not m:
        return None
    try:
        return int(m.group(1))
    except (ValueError, TypeError):
        return None


def _split_terms(value: Optional[str]) -> list[str]:
    if not value:
        return []
    out: list[str] = []
    for raw in str(value).replace("；", ";").replace("、", ";").replace(",", ";").split(";"):
        item = raw.strip()
        if item and item not in out:
            out.append(item)
    return out


# ============================================================
# 玄学事件加载 + 翻译注入 + 缓存
# ============================================================

_XX_CACHE: dict[str, Any] = {"events": None}


def _inject_translations(events: list[dict[str, Any]]) -> None:
    """批量从 editorial.sqlite/translation(source_kind='event_card') 注入白话/解读。"""
    ec = db.editorial_conn()
    if ec is None:
        return
    try:
        tr_map: dict[str, dict[str, Any]] = {}
        for r in ec.execute(
            "SELECT source_ref, modern_text, annotation FROM translation "
            "WHERE source_kind='event_card' AND status='published'"
        ):
            ann: dict[str, Any] = {}
            if r["annotation"]:
                try:
                    ann = json.loads(r["annotation"])
                except Exception:
                    ann = {}
            tr_map[r["source_ref"]] = {"modern": r["modern_text"] or "", "annotation": ann}
        for ev in events:
            tr = tr_map.get(ev["event_id"])
            if tr:
                ev["modern_text"] = tr["modern"]
                ann = tr["annotation"] or {}
                ev["reading"] = ann.get("reading", "")
                ev["dianjing"] = ann.get("dianjing", "")
                ev["mifa"] = ann.get("mifa", "")
    except Exception:
        pass


def load_events(force: bool = False) -> list[dict[str, Any]]:
    """加载全部玄学事件（正史+野载），注入翻译，缓存。"""
    if not force and _XX_CACHE["events"] is not None:
        return _XX_CACHE["events"]
    conn = db.public_conn()
    rows = conn.execute(
        """
        SELECT * FROM xuanxue_event
        ORDER BY CASE tradition WHEN '正史' THEN 0 ELSE 1 END, history, volume_no, event_id
        """
    ).fetchall()
    events: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        d.setdefault("modern_text", "")
        d["reading"] = ""
        d["dianjing"] = ""
        d["mifa"] = ""
        d["paragraph_no_parsed"] = _parse_paragraph_no(d.get("citation"))
        events.append(d)
    _inject_translations(events)
    _XX_CACHE["events"] = events
    return events


def _event_card(e: dict[str, Any]) -> dict[str, Any]:
    """事件 → 前端列表/详情卡片。"""
    return {
        "event_id": e.get("event_id"),
        "tradition": e.get("tradition") or TRADITION_ZHENGSHI,
        "corpus": e.get("corpus") or "24histories",
        "genre": e.get("genre") or "",
        "history": e.get("history") or "",
        "volume_no": e.get("volume_no") or "",
        "citation": e.get("citation") or "",
        "title": e.get("title") or "",
        "period": e.get("period") or "",
        "region": e.get("region") or "",
        "dynasty": e.get("dynasty") or "",
        "operators": e.get("operators") or "",
        "targets": e.get("targets") or "",
        "techniques": e.get("techniques") or "",
        "trigger": e.get("trigger") or "",
        "procedure": e.get("procedure") or "",
        "outcome": e.get("outcome") or "",
        "evidence": e.get("evidence") or "",
        "original_text": e.get("original_text") or "",
        "version_risk": e.get("version_risk") or "",
        "reliability_note": e.get("reliability_note") or "",
        "cross_ref": e.get("cross_ref") or "",
        "modern_text": e.get("modern_text") or "",
        "reading": e.get("reading") or "",
        "dianjing": e.get("dianjing") or "",
        "mifa": e.get("mifa") or "",
        "paragraph_no": e.get("paragraph_no_parsed"),
    }


def filter_events(
    *,
    q: Optional[str] = None,
    tradition: Optional[str] = None,
    dynasties: Optional[list[str]] = None,
    techniques: Optional[list[str]] = None,
    histories: Optional[list[str]] = None,
    evidence: Optional[str] = None,
) -> list[dict[str, Any]]:
    """按 facet 过滤事件。OR within facet, AND across facets。"""
    events = load_events()
    if tradition:
        events = [e for e in events if (e.get("tradition") or TRADITION_ZHENGSHI) == tradition]
    dyn_set = set(dynasties or [])
    tech_set = set(techniques or [])
    hist_set = set(histories or [])
    q_norm = (q or "").strip().lower()

    out: list[dict[str, Any]] = []
    for e in events:
        if dyn_set and (e.get("dynasty") or "").strip() not in dyn_set:
            continue
        if hist_set and (e.get("history") or "") not in hist_set:
            continue
        if evidence and (e.get("evidence") or "") != evidence:
            continue
        if tech_set:
            ev_techs = {t.strip() for t in (e.get("techniques") or "").split(";") if t.strip()}
            if not (ev_techs & tech_set):
                continue
        if q_norm:
            hay = " ".join([
                e.get("title") or "", e.get("original_text") or "", e.get("modern_text") or "",
                e.get("reading") or "", e.get("operators") or "", e.get("targets") or "",
                e.get("techniques") or "", e.get("history") or "",
            ]).lower()
            if q_norm not in hay:
                continue
        out.append(e)
    return out


def list_events(
    *,
    q: Optional[str] = None,
    tradition: Optional[str] = None,
    dynasty: Optional[str] = None,
    technique: Optional[str] = None,
    history: Optional[str] = None,
    dynasties: Optional[list[str]] = None,
    techniques: Optional[list[str]] = None,
    histories: Optional[list[str]] = None,
    evidence: Optional[str] = None,
    page: int = 1,
    page_size: int = 30,
) -> dict[str, Any]:
    """事件分页列表（facet 单值或多值；给了多值列表则优先，否则回落单值）。"""
    hits = filter_events(
        q=q, tradition=tradition,
        dynasties=dynasties or ([dynasty] if dynasty else None),
        techniques=techniques or ([technique] if technique else None),
        histories=histories or ([history] if history else None),
        evidence=evidence,
    )
    total = len(hits)
    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 30), 200))
    pages = (total + page_size - 1) // page_size if total else 0
    start = (page - 1) * page_size
    page_hits = hits[start:start + page_size]
    return {
        "items": [_event_card(e) for e in page_hits],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


def get_event(event_id: str) -> Optional[dict[str, Any]]:
    """事件详情 + 同卷/同 cross_ref 关联。"""
    if not event_id:
        return None
    events = load_events()
    by_id = {e["event_id"]: e for e in events}
    e = by_id.get(event_id)
    if not e:
        return None
    card = _event_card(e)
    # 关联：先 cross_ref，再同史同卷
    related: list[dict[str, Any]] = []
    seen: set[str] = {event_id}
    for ref in _split_terms(e.get("cross_ref")):
        r = by_id.get(ref)
        if r and r["event_id"] not in seen:
            related.append(_event_card(r))
            seen.add(r["event_id"])
    if len(related) < 8:
        for r in events:
            if len(related) >= 8:
                break
            if r["event_id"] in seen:
                continue
            if r.get("history") and r.get("history") == e.get("history") and \
               r.get("volume_no") and r.get("volume_no") == e.get("volume_no"):
                related.append(_event_card(r))
                seen.add(r["event_id"])
    card["related"] = related
    # 同朝代 / 同史书（对齐标准版事件详情底部，各 ≤6 条、排除自身与上面已列的关联）。
    # 同朝代限定在同一传统内（正史朝代大类 / 野载语料分类不混）。
    same_dyn: list[dict[str, Any]] = []
    same_hist: list[dict[str, Any]] = []
    ev_dyn = e.get("dynasty")
    ev_trad = e.get("tradition") or TRADITION_ZHENGSHI
    ev_hist = e.get("history")
    for r in events:
        rid = r["event_id"]
        if rid == event_id:
            continue
        if len(same_dyn) < 6 and ev_dyn and r.get("dynasty") == ev_dyn \
                and (r.get("tradition") or TRADITION_ZHENGSHI) == ev_trad:
            same_dyn.append(_event_card(r))
        if len(same_hist) < 6 and ev_hist and r.get("history") == ev_hist:
            same_hist.append(_event_card(r))
        if len(same_dyn) >= 6 and len(same_hist) >= 6:
            break
    card["same_dyn"] = same_dyn
    card["same_hist"] = same_hist
    return card


def event_facets(tradition: Optional[str] = None) -> dict[str, Any]:
    """事件 facet 计数：朝代分组 / 史书典籍 / 术数 / 传统。"""
    events = load_events()
    if tradition:
        scoped = [e for e in events if (e.get("tradition") or TRADITION_ZHENGSHI) == tradition]
    else:
        scoped = events
    by_dynasty: Counter = Counter()
    by_history: Counter = Counter()
    by_tech: Counter = Counter()
    by_tradition: Counter = Counter()
    for e in scoped:
        if e.get("dynasty"):
            by_dynasty[e["dynasty"]] += 1
        if e.get("history"):
            by_history[e["history"]] += 1
        by_tradition[(e.get("tradition") or TRADITION_ZHENGSHI)] += 1
        for t in (e.get("techniques") or "").split(";"):
            t = t.strip()
            if t:
                by_tech[t] += 1
    return {
        "dynasties": by_dynasty.most_common(),
        "histories": by_history.most_common(),
        "techniques": by_tech.most_common(40),
        "traditions": by_tradition.most_common(),
    }


def facets(
    *,
    tradition: Optional[str] = None,
    q: Optional[str] = None,
    dynasties: Optional[list[str]] = None,
    techniques: Optional[list[str]] = None,
    histories: Optional[list[str]] = None,
    evidence: Optional[str] = None,
) -> dict[str, Any]:
    """统一 facet 端点：所选传统内的稳定选项列表 + 在「当前其余维选择」下重算的计数
    + 实时命中总数。一次调用同时承担首载选项与勾选后实时计数。

    切换约定（与多维 facet 检索惯例一致）：某维某值的计数 = 在其余维选择保持不变、
    本维只取该单值时的命中数 —— 这样即便已选「唐」，也能看到「宋/明…」各自命中数
    以便切换。朝代（正史）/ 语料（野载）按规范史序，术数取前 24、史书按命中降序。
    """
    trad = tradition if tradition in (TRADITION_ZHENGSHI, TRADITION_YEZAI) else TRADITION_ZHENGSHI
    events = load_events()
    scoped = [e for e in events if (e.get("tradition") or TRADITION_ZHENGSHI) == trad]

    # —— 稳定选项宇宙（该传统内全部出现值）——
    order = [g[0] for g in (DYNASTY_GROUPS if trad == TRADITION_ZHENGSHI else CORPUS_GROUPS)]
    present_dyn = {(e.get("dynasty") or "").strip() for e in scoped if (e.get("dynasty") or "").strip()}
    dyn_names = [d for d in order if d in present_dyn]
    # 规范序之外的朝代值（兜底，按命中降序补在后）
    extra = sorted(
        present_dyn - set(dyn_names),
        key=lambda n: -sum(1 for e in scoped if (e.get("dynasty") or "").strip() == n),
    )
    dyn_names += extra

    tech_counter: Counter = Counter()
    hist_counter: Counter = Counter()
    for e in scoped:
        if e.get("history"):
            hist_counter[e["history"]] += 1
        for t in (e.get("techniques") or "").split(";"):
            t = t.strip()
            if t:
                tech_counter[t] += 1
    tech_names = [n for n, _ in tech_counter.most_common(24)]
    hist_names = [n for n, _ in hist_counter.most_common()]
    ev_names = ["高", "中", "低"]

    def count_with(dim: str, value: str) -> int:
        d = list(dynasties or [])
        t = list(techniques or [])
        h = list(histories or [])
        ev = evidence
        if dim == "dynasty":
            d = [value]
        elif dim == "technique":
            t = [value]
        elif dim == "history":
            h = [value]
        elif dim == "evidence":
            ev = value
        return len(filter_events(
            q=q, tradition=trad,
            dynasties=d or None, techniques=t or None, histories=h or None, evidence=ev,
        ))

    total = len(filter_events(
        q=q, tradition=trad,
        dynasties=dynasties or None, techniques=techniques or None,
        histories=histories or None, evidence=evidence,
    ))

    trad_counter: Counter = Counter()
    for e in events:
        trad_counter[(e.get("tradition") or TRADITION_ZHENGSHI)] += 1

    return {
        "tradition": trad,
        "traditions": [
            {"key": TRADITION_ZHENGSHI, "label": "正史玄学", "count": trad_counter.get(TRADITION_ZHENGSHI, 0)},
            {"key": TRADITION_YEZAI, "label": "野载玄学", "count": trad_counter.get(TRADITION_YEZAI, 0)},
        ],
        "options": {
            "dynasty": [{"name": n, "count": count_with("dynasty", n)} for n in dyn_names],
            "technique": [{"name": n, "count": count_with("technique", n)} for n in tech_names],
            "history": [{"name": n, "count": count_with("history", n)} for n in hist_names],
            "evidence": [{"name": n, "count": count_with("evidence", n)} for n in ev_names],
        },
        "totals": {"xuanxue_events": total, "corpus_paragraphs": 0},
    }


def events_page_meta(tradition: Optional[str] = None) -> dict[str, Any]:
    """玄学万象列表页头部元数据：统计 + 朝代游历（含图标 + 该朝代史书细分）+ 传统切换。

    对齐标准版 参考玄学万象页 的 stats / all_dynasties / tradition_tabs。
    正史轴=朝代大类（DYNASTY_GROUPS 图标），野载轴=语料分类（CORPUS_GROUPS 图标）；
    每个朝代/分类下挂其史书/典籍细分（按命中降序）。
    """
    trad = tradition if tradition in (TRADITION_ZHENGSHI, TRADITION_YEZAI) else TRADITION_ZHENGSHI
    events = load_events()
    scoped = [e for e in events if (e.get("tradition") or TRADITION_ZHENGSHI) == trad]
    total = len(scoped)
    translated = sum(1 for e in scoped if (e.get("modern_text") or "").strip())

    groups_def = DYNASTY_GROUPS if trad == TRADITION_ZHENGSHI else CORPUS_GROUPS
    icon_map = {g[0]: g[2] for g in groups_def}
    order = [g[0] for g in groups_def]

    by_dyn: dict[str, list] = defaultdict(list)
    for e in scoped:
        d = (e.get("dynasty") or "").strip()
        if d:
            by_dyn[d].append(e)
    present = set(by_dyn)
    dyn_order = [d for d in order if d in present] + sorted(present - set(order))

    all_dynasties = []
    for d in dyn_order:
        evs = by_dyn[d]
        hc: Counter = Counter()
        for e in evs:
            if e.get("history"):
                hc[e["history"]] += 1
        all_dynasties.append({
            "name": d,
            "icon": icon_map.get(d, ""),
            "count": len(evs),
            "histories": [{"name": n, "count": c} for n, c in hc.most_common()],
        })

    histories_n = len({e.get("history") for e in scoped if e.get("history")})
    trad_counter: Counter = Counter((e.get("tradition") or TRADITION_ZHENGSHI) for e in events)
    return {
        "tradition": trad,
        "stats": {
            "total": total,
            "translated": translated,
            "dynasties": len(all_dynasties),
            "histories": histories_n,
        },
        "all_dynasties": all_dynasties,
        "tradition_tabs": [
            {"key": TRADITION_ZHENGSHI, "label": "正史玄学", "count": trad_counter.get(TRADITION_ZHENGSHI, 0)},
            {"key": TRADITION_YEZAI, "label": "野载玄学", "count": trad_counter.get(TRADITION_YEZAI, 0)},
        ],
    }


# ============================================================
# 地图 — map_point
# ============================================================

# [Q-482/T-444] 地图钉点库 by_period_json 的键是粗桶(先秦两汉/东汉/三国/两晋/南北朝/隋/唐/五代/宋/辽金/元/明 + 四类语料),
# 前端朝代 chip 是 23 个细朝代 → 16 个 chip 恒空。细朝代 → 粗桶映射(同名者原样);查询同时接受桶键与细朝代。
_MAP_PERIOD_BUCKET = {
    '西周': '先秦两汉', '春秋': '先秦两汉', '战国': '先秦两汉', '秦': '先秦两汉', '西汉': '先秦两汉', '新莽': '先秦两汉',
    '东汉': '东汉', '三国': '三国', '西晋': '两晋', '东晋': '两晋', '十六国': '南北朝', '南朝': '南北朝', '北朝': '南北朝',
    '隋': '隋', '唐': '唐', '五代': '五代', '北宋': '宋', '南宋': '宋', '辽': '辽金', '金': '辽金', '西夏': '辽金',
    '元': '元', '明': '明',
}


def map_period_keys(period: Optional[str]) -> set[str]:
    """chip/桶名 → 可命中的 by_period 键集合(细朝代含其粗桶;桶名原样)。"""
    p = (period or '').strip()
    if not p:
        return set()
    keys = {p}
    if p in _MAP_PERIOD_BUCKET:
        keys.add(_MAP_PERIOD_BUCKET[p])
    return keys


def map_points(period: Optional[str] = None) -> dict[str, Any]:
    conn = db.public_conn()
    rows = conn.execute("SELECT * FROM map_point ORDER BY count DESC").fetchall()
    points: list[dict[str, Any]] = []
    want = map_period_keys(period)
    for r in rows:
        by_period = json.loads(r["by_period_json"] or "{}")
        if want and not any(by_period.get(k) for k in want):
            continue
        # [Q-483/T-445] 选了朝代后 count 此前恒取全时期总数(period 只做存在性过滤)→ 城市榜排序、钉点半径、
        # 悬停「N 个事件」与页头「N 个事件钉点」全是全时期数(唐:页头 1,497、by_period 唐合计 63;西安 610 vs 唐 19)。
        # 现:有朝代筛选时 count = 该期(细朝代含其粗桶,取所有命中键的最大值——桶与细名是同一批事件的两种计数,
        # 相加会重复);count_all 另带全时期总数供对照。
        cnt_all = r["count"]
        cnt = max((int(by_period.get(k) or 0) for k in want), default=0) if want else cnt_all
        points.append({
            "modern": r["modern"],
            "lng": r["lng"],
            "lat": r["lat"],
            "count": cnt,
            "count_all": cnt_all,
            "ancient_names": json.loads(r["ancient_names_json"] or "[]"),
            "by_period": by_period,
            "by_history": json.loads(r["by_history_json"] or "{}"),
        })
    if want:
        # 朝代视图按该期计数重排(SQL 是按全时期 count DESC)。
        points.sort(key=lambda p: -p["count"])
    return {"points": points, "total": len(points)}


# ============================================================
# 人物共现图 — person_node / person_edge
# ============================================================

def persons_graph(min_weight: int = 3, top_n: int = 80) -> dict[str, Any]:
    conn = db.public_conn()
    node_rows = conn.execute(
        "SELECT id, weight FROM person_node ORDER BY weight DESC LIMIT ?",
        (int(top_n),),
    ).fetchall()
    allowed = {r["id"] for r in node_rows}
    edge_rows = conn.execute(
        "SELECT source, target, weight FROM person_edge WHERE weight>=? ORDER BY weight DESC",
        (int(min_weight),),
    ).fetchall()
    edges = [
        {"source": r["source"], "target": r["target"], "weight": r["weight"]}
        for r in edge_rows
        if r["source"] in allowed and r["target"] in allowed
    ]
    used = {e["source"] for e in edges} | {e["target"] for e in edges}
    nodes = [
        {"id": r["id"], "weight": r["weight"]}
        for r in node_rows
        if r["id"] in used
    ]
    return {"nodes": nodes, "edges": edges}


# ============================================================
# 时间线 — xuanxue_event 按 period→macro 分布 + 术数矩阵
# ============================================================

def _period_spec(period: Optional[str], dynasty: Optional[str] = None):
    spec = classify_period(period)
    if spec:
        return spec
    if dynasty:
        return classify_period(dynasty)
    return None


def timeline() -> dict[str, Any]:
    conn = db.public_conn()
    rows = conn.execute(
        f"""
        SELECT {_XX_COLS}
        FROM xuanxue_event
        ORDER BY event_id
        """
    ).fetchall()

    by_macro: Counter = Counter()
    by_macro_tech: dict[str, Counter] = defaultdict(Counter)
    tech_totals: Counter = Counter()
    classified = 0
    for r in rows:
        spec = _period_spec(r["period"], r["dynasty"])
        if not spec:
            continue
        classified += 1
        by_macro[spec.macro] += 1
        terms = _split_terms(r["techniques"]) or ["未分类"]
        for term in terms[:4]:
            tech_totals[term] += 1
            by_macro_tech[spec.macro][term] += 1

    top_techs = [name for name, _ in tech_totals.most_common(12)]
    series: list[dict[str, Any]] = []
    matrix: list[dict[str, Any]] = []
    for sort_order, (macro, start, end) in enumerate(all_macros()):
        total = by_macro.get(macro, 0)
        if not total:
            continue
        series.append({
            "macro": macro,
            "sort_order": sort_order,
            "span_start": start,
            "span_end": end,
            "total": total,
        })
        row: dict[str, Any] = {"macro": macro}
        other = total
        for tech in top_techs:
            n = by_macro_tech[macro].get(tech, 0)
            row[tech] = n
            other -= n
        row["其他"] = max(other, 0)
        matrix.append(row)

    return {
        "total": len(rows),
        "classified": classified,
        "unclassified": len(rows) - classified,
        "series": series,
        "matrix": matrix,
        "top_techs": top_techs,
    }


def timeline_drilldown(macro: Optional[str], limit: int = 80) -> list[dict[str, Any]]:
    if not macro:
        return []
    conn = db.public_conn()
    rows = conn.execute(
        f"""
        SELECT {_XX_COLS}
        FROM xuanxue_event
        ORDER BY event_id
        """
    ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        spec = _period_spec(r["period"], r["dynasty"])
        if not spec or spec.macro != macro:
            continue
        out.append({
            "event_id": r["event_id"],
            "tradition": r["tradition"],
            "history": r["history"],
            "volume_no": r["volume_no"],
            "period": r["period"] or r["dynasty"] or macro,
            "title": r["title"],
            "original_text": r["original_text"],
            "evidence": r["evidence"],
            "techniques": r["techniques"],
        })
        if len(out) >= limit:
            break
    return out


# ============================================================
# 搜索 — public_data(事件) LIKE
# ============================================================

def search_events(query: str, limit: int = 30, tradition: Optional[str] = None) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if not q:
        return []
    hits = filter_events(q=q, tradition=tradition)
    return [_event_card(e) for e in hits[:max(1, int(limit))]]
