"""编辑层只读查询：人物 figure / 故事 story / 术数 technique /
天象词条 celestial_term / 朝代词条 dynasty_term / 频道 channel / 今日推送 daily_pick。

数据源 ``editorial.sqlite``（只读）。前台只读 status 为 published/auto 的内容。
人物相关事件经 ``figure_link`` -> ``translation`` -> ``public_data.xuanxue_event`` 补元数据。
"""

from __future__ import annotations

from typing import Any, Optional

from . import db


def _rows(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    conn = db.editorial_conn()
    if conn is None:
        return []
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def _row(sql: str, params: tuple = ()) -> Optional[dict[str, Any]]:
    conn = db.editorial_conn()
    if conn is None:
        return None
    r = conn.execute(sql, params).fetchone()
    return dict(r) if r else None


def figure_cooccurrence_graph(limit_nodes: int = 70, min_weight: int = 2) -> dict[str, Any]:
    """真实人物共现网络：同一玄学事件(figure_link.link_kind='event')中出现的人物互相成边，
    按人名聚合(合并重名);只取 event(弃 artifact/corpus_row 否则共享种子致稠密团爆炸)。
    返回 top ``limit_nodes`` 高共现节点及其之间(w>=``min_weight``)的边。"""
    rows = _rows(
        """
        WITH fe AS (
            SELECT DISTINCT fl.link_ref AS ref, f.name AS name
            FROM figure_link fl JOIN figure f ON fl.figure_id = f.id
            WHERE fl.link_kind = 'event' AND f.name IS NOT NULL AND f.name <> ''
        )
        SELECT a.name AS n1, b.name AS n2, COUNT(*) AS w
        FROM fe a JOIN fe b ON a.ref = b.ref AND a.name < b.name
        GROUP BY a.name, b.name
        HAVING w >= ?
        ORDER BY w DESC
        """,
        (int(min_weight),),
    )
    deg: dict[str, int] = {}
    for r in rows:
        deg[r["n1"]] = deg.get(r["n1"], 0) + r["w"]
        deg[r["n2"]] = deg.get(r["n2"], 0) + r["w"]
    top = set(sorted(deg, key=lambda n: -deg[n])[: int(limit_nodes)])
    edges = [
        {"source": r["n1"], "target": r["n2"], "weight": r["w"]}
        for r in rows if r["n1"] in top and r["n2"] in top
    ]
    used: set = set()
    for e in edges:
        used.add(e["source"])
        used.add(e["target"])
    # 节点顺序固定为「共现权重降序、同权按人名」:原按字符串集合迭代,顺序随进程哈希种子变 → 同一请求每次启动
    # 输出不同,前端力导向图按下标排初始位置,布局也跟着每次不同。节点集合与边不变。
    nodes = [{"id": n, "weight": deg[n]} for n in sorted(used, key=lambda n: (-deg[n], n))]
    return {"nodes": nodes, "edges": edges}


# ============================================================
# 人物 figure
# ============================================================

def list_figures(status="published", limit: int = 100, dynasty: Optional[str] = None,
                 offset: int = 0, q: Optional[str] = None) -> list[dict[str, Any]]:
    where: list[str] = []
    params: list[Any] = []
    if status:
        statuses = [status] if isinstance(status, str) else list(status)
        if statuses:
            ph = ",".join("?" * len(statuses))
            where.append(f"status IN ({ph})")
            params.extend(statuses)
    if dynasty:
        where.append("dynasty=?")
        params.append(dynasty)
    if q:
        like = f"%{q}%"
        where.append("(name LIKE ? OR alt_names LIKE ? OR pinyin LIKE ?)")
        params.extend([like, like, like])
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    return _rows(
        f"SELECT * FROM figure {where_sql} "
        f"ORDER BY (birth_year IS NULL), birth_year, name LIMIT ? OFFSET ?",
        (*params, int(limit), int(offset)),
    )


def count_figures(status="published", dynasty: Optional[str] = None, q: Optional[str] = None) -> int:
    where: list[str] = []
    params: list[Any] = []
    if status:
        statuses = [status] if isinstance(status, str) else list(status)
        if statuses:
            ph = ",".join("?" * len(statuses))
            where.append(f"status IN ({ph})")
            params.extend(statuses)
    if dynasty:
        where.append("dynasty=?")
        params.append(dynasty)
    if q:
        like = f"%{q}%"
        where.append("(name LIKE ? OR alt_names LIKE ? OR pinyin LIKE ?)")
        params.extend([like, like, like])
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    r = _row(f"SELECT COUNT(*) AS n FROM figure {where_sql}", tuple(params))
    return r["n"] if r else 0


def figure_dynasties(status="published") -> list[tuple[str, int]]:
    where = ["dynasty IS NOT NULL", "dynasty <> ''"]
    params: list[Any] = []
    if status:
        statuses = [status] if isinstance(status, str) else list(status)
        if statuses:
            ph = ",".join("?" * len(statuses))
            where.append(f"status IN ({ph})")
            params.extend(statuses)
    where_sql = "WHERE " + " AND ".join(where)
    rows = _rows(f"SELECT dynasty AS d, COUNT(*) AS n FROM figure {where_sql} GROUP BY dynasty",
                 tuple(params))
    from .period import all_macros
    order = {m: i for i, (m, _, _) in enumerate(all_macros())}
    out = [(r["d"], r["n"]) for r in rows if r["d"]]
    out.sort(key=lambda x: order.get(x[0], 999))
    return out


def get_figure(slug: str) -> Optional[dict[str, Any]]:
    if not slug:
        return None
    conn = db.editorial_conn()
    if conn is None:
        return None
    r = conn.execute("SELECT * FROM figure WHERE slug=?", (slug,)).fetchone()
    if not r:
        return None
    d = dict(r)
    d["links"] = [dict(x) for x in conn.execute(
        "SELECT * FROM figure_link WHERE figure_id=? ORDER BY sort_order, link_ref", (d["id"],)
    )]
    d["related_events"] = figure_related_events(d["id"])
    return d


def figure_related_events(figure_id: int, limit: int = 60) -> list[dict[str, Any]]:
    """人物参与的玄学事件：figure_link(event) -> translation(event_card) -> public_data 补元数据。"""
    conn = db.editorial_conn()
    if conn is None:
        return []
    links = conn.execute(
        "SELECT link_ref, note, sort_order FROM figure_link "
        "WHERE figure_id=? AND link_kind='event' ORDER BY sort_order LIMIT ?",
        (figure_id, int(limit)),
    ).fetchall()
    if not links:
        return []
    refs = [r["link_ref"] for r in links]
    ph = ",".join("?" * len(refs))
    trans_map: dict[str, Any] = {}
    for tr in conn.execute(
        f"SELECT source_ref, original_text, modern_text, status FROM translation "
        f"WHERE source_kind='event_card' AND source_ref IN ({ph})",
        refs,
    ).fetchall():
        trans_map[tr["source_ref"]] = tr

    from .queries import _XX_COLS  # 复用 xuanxue_event 列定义
    pconn = db.public_conn()
    meta_map: dict[str, dict[str, Any]] = {}
    meta_rows = pconn.execute(
        f"SELECT {_XX_COLS} FROM xuanxue_event WHERE event_id IN ({ph})", refs
    ).fetchall()
    for mr in meta_rows:
        meta_map[mr["event_id"]] = dict(mr)

    out: list[dict[str, Any]] = []
    for ln in links:
        ev_id = ln["link_ref"]
        tr = trans_map.get(ev_id)
        meta = meta_map.get(ev_id, {})
        out.append({
            "event_id": ev_id,
            "title": meta.get("title") or ln["note"] or "未命名事件",
            "history": meta.get("history"),
            "volume": meta.get("volume_no"),
            "citation": meta.get("citation"),
            "period": meta.get("period"),
            "region": meta.get("region"),
            "evidence": meta.get("evidence"),
            "techniques": meta.get("techniques") or "",
            "operators": meta.get("operators") or "",
            "targets": meta.get("targets") or "",
            "original_text": (tr["original_text"] if tr else meta.get("original_text")) or "",
            "modern_text": (tr["modern_text"] if tr else "") or "",
            "translation_status": tr["status"] if tr else None,
        })
    return out


# ============================================================
# 故事 story
# ============================================================

def list_stories(channel_slug: Optional[str] = None, dynasty: Optional[str] = None,
                 figure_slug: Optional[str] = None, technique_slug: Optional[str] = None,
                 status: str = "published", limit: int = 50, offset: int = 0,
                 search_text: Optional[str] = None) -> list[dict[str, Any]]:
    where: list[str] = []
    params: list[Any] = []
    if status:
        where.append("s.status=?")
        params.append(status)
    if channel_slug:
        where.append("c.slug=?")
        params.append(channel_slug)
    if dynasty:
        where.append("s.dynasty=?")
        params.append(dynasty)
    if figure_slug:
        where.append("s.primary_figure_slug=?")
        params.append(figure_slug)
    if technique_slug:
        where.append("s.primary_technique_slug=?")
        params.append(technique_slug)
    if search_text:
        like = f"%{search_text}%"
        where.append("(s.title LIKE ? OR s.subtitle LIKE ? OR s.summary LIKE ? OR s.body_md LIKE ?)")
        params.extend([like, like, like, like])
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    return _rows(
        f"""
        SELECT s.*, c.slug AS channel_slug, c.name AS channel_name, c.icon AS channel_icon,
               c.accent_color AS channel_color
        FROM story s LEFT JOIN channel c ON c.id=s.channel_id
        {where_sql}
        ORDER BY s.published_at DESC, s.updated_at DESC
        LIMIT ? OFFSET ?
        """,
        (*params, int(limit), int(offset)),
    )


def get_story(slug: str) -> Optional[dict[str, Any]]:
    if not slug:
        return None
    conn = db.editorial_conn()
    if conn is None:
        return None
    r = conn.execute(
        """
        SELECT s.*, c.slug AS channel_slug, c.name AS channel_name, c.icon AS channel_icon,
               c.accent_color AS channel_color
        FROM story s LEFT JOIN channel c ON c.id=s.channel_id
        WHERE s.slug=?
        """,
        (slug,),
    ).fetchone()
    if not r:
        return None
    d = dict(r)
    d["sources"] = [dict(x) for x in conn.execute(
        "SELECT * FROM story_source WHERE story_id=? ORDER BY sort_order, id", (d["id"],)
    )]
    d["tags"] = [dict(x) for x in conn.execute(
        "SELECT t.* FROM story_tag st JOIN content_tag t ON t.id=st.tag_id WHERE st.story_id=?",
        (d["id"],),
    )]
    return d


# ============================================================
# 术数 technique
# ============================================================

def list_techniques(status: str = "published", category: Optional[str] = None) -> list[dict[str, Any]]:
    where: list[str] = []
    params: list[Any] = []
    if status:
        where.append("status=?")
        params.append(status)
    if category:
        where.append("category=?")
        params.append(category)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    return _rows(f"SELECT * FROM technique {where_sql} ORDER BY name", tuple(params))


def get_technique(slug: str) -> Optional[dict[str, Any]]:
    if not slug:
        return None
    conn = db.editorial_conn()
    if conn is None:
        return None
    r = conn.execute("SELECT * FROM technique WHERE slug=?", (slug,)).fetchone()
    if not r:
        return None
    d = dict(r)
    d["links"] = [dict(x) for x in conn.execute(
        "SELECT * FROM technique_link WHERE technique_id=? ORDER BY sort_order", (d["id"],)
    )]
    return d


# ============================================================
# 天象词条 celestial_term / 朝代词条 dynasty_term
# ============================================================

def list_celestial_terms(status: str = "published") -> list[dict[str, Any]]:
    if status:
        return _rows("SELECT * FROM celestial_term WHERE status=? ORDER BY name", (status,))
    return _rows("SELECT * FROM celestial_term ORDER BY name")


def get_celestial_term(slug: str) -> Optional[dict[str, Any]]:
    return _row("SELECT * FROM celestial_term WHERE slug=?", (slug,)) if slug else None


def list_dynasties(status: str = "published") -> list[dict[str, Any]]:
    if status:
        return _rows(
            "SELECT * FROM dynasty_term WHERE status=? "
            "ORDER BY (span_start IS NULL), span_start, name", (status,))
    return _rows("SELECT * FROM dynasty_term ORDER BY (span_start IS NULL), span_start, name")


def get_dynasty(slug: str) -> Optional[dict[str, Any]]:
    return _row("SELECT * FROM dynasty_term WHERE slug=?", (slug,)) if slug else None


# ============================================================
# 频道 channel
# ============================================================

def list_channels(only_published: bool = True) -> list[dict[str, Any]]:
    where = "WHERE c.is_published=1" if only_published else ""
    return _rows(
        f"""
        SELECT c.*,
            (SELECT COUNT(*) FROM story s WHERE s.channel_id=c.id AND s.status='published') AS story_count
        FROM channel c {where}
        ORDER BY c.sort_order, c.id
        """
    )


# ============================================================
# 今日推送 daily_pick
# ============================================================

def get_daily_pick(date_key: str) -> Optional[dict[str, Any]]:
    return _row("SELECT * FROM daily_pick WHERE date_key=?", (date_key,)) if date_key else None


def recent_daily_picks(limit: int = 30) -> list[dict[str, Any]]:
    return _rows("SELECT * FROM daily_pick ORDER BY date_key DESC LIMIT ?", (int(limit),))


def resolve_daily(date_key: Optional[str] = None) -> Optional[dict[str, Any]]:
    """取某日推送（缺省取最新一条），并按 pick_kind 拉取被指对象。"""
    pick = get_daily_pick(date_key) if date_key else None
    if not pick:
        recent = recent_daily_picks(1)
        pick = recent[0] if recent else None
    if not pick:
        return None
    kind = pick.get("pick_kind")
    ref = pick.get("pick_ref")
    target: Any = None
    if kind == "figure":
        target = get_figure(ref)
    elif kind == "story":
        target = get_story(ref)
    elif kind == "technique":
        target = get_technique(ref)
    elif kind == "celestial_term":
        target = get_celestial_term(ref)
    elif kind == "celestial_event":
        from . import celestial as _ce
        target = _ce.get_event(ref)
    pick["target"] = target
    return pick


# ============================================================
# 编辑层综合统计（供 /summary 拼装）
# ============================================================

def editorial_stats() -> dict[str, Any]:
    conn = db.editorial_conn()
    if conn is None:
        return {}

    def cnt(sql: str) -> int:
        r = conn.execute(sql).fetchone()
        return r["n"] if r else 0

    return {
        "channels": cnt("SELECT COUNT(*) AS n FROM channel WHERE is_published=1"),
        "stories_published": cnt("SELECT COUNT(*) AS n FROM story WHERE status='published'"),
        "figures_published": cnt("SELECT COUNT(*) AS n FROM figure WHERE status='published'"),
        "figures_total": cnt("SELECT COUNT(*) AS n FROM figure WHERE status IN ('published','auto')"),
        "techniques_published": cnt("SELECT COUNT(*) AS n FROM technique WHERE status='published'"),
        "celestial_terms": cnt("SELECT COUNT(*) AS n FROM celestial_term WHERE status='published'"),
        "dynasty_terms": cnt("SELECT COUNT(*) AS n FROM dynasty_term WHERE status='published'"),
        "translations_published": cnt("SELECT COUNT(*) AS n FROM translation WHERE status IN ('published','published-partial')"),
        "daily_picks": cnt("SELECT COUNT(*) AS n FROM daily_pick"),
    }
