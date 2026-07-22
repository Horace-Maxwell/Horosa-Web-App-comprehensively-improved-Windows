# -*- coding: utf-8 -*-
"""解读技法:完美 Perfection / 相位 Aspect / 同伴 Company(移植);阻碍 / 点数是否 / 应期数量 / 三方(新补)。
每条判定均可由宫位盘 + 图形数据确定性导出,供上游赋义与 AI 真值。"""
from __future__ import annotations

from typing import Dict, List, Optional

from .figures import FIRE, data, inverse, planet, points, reverse, row

PAIRED_HOUSES = [(1, 2), (3, 4), (5, 6), (7, 8), (9, 10), (11, 12)]


def _adj(h: int, wrap: bool = False) -> List[int]:
    if wrap:
        return [(h - 2) % 12 + 1, h % 12 + 1]
    return [x for x in (h - 1, h + 1) if 1 <= x <= 12]


def perfection(hc: Dict[int, int], q: int, t: int, wrap: bool = False) -> str:
    """完美:occupation/conjunction/mutation/translation/none(检测顺序固定)。
    wrap=True 时宫位首尾相接(十二宫成环),邻宫判定跨 12↔1 —— 部分传本如此,缺省不环=零回归。"""
    fq, ft = hc[q], hc[t]
    if fq == ft:
        return "occupation"
    if (any(hc[h] == fq for h in _adj(t, wrap) if h != q)
            or any(hc[h] == ft for h in _adj(q, wrap) if h != t)):
        return "conjunction"
    pairs = [(h, h + 1) for h in range(1, 12)]
    if wrap:
        pairs.append((12, 1))
    for a, b in pairs:
        if a in (q, t) or b in (q, t):
            continue
        if {hc[a], hc[b]} == {fq, ft}:
            return "mutation"
    adj_q = {hc[h] for h in _adj(q, wrap)}
    adj_t = {hc[h] for h in _adj(t, wrap)}
    if (adj_q & adj_t) - {fq, ft}:
        return "translation"
    return "none"


def aspect(h1: int, h2: int) -> str:
    d = abs(h1 - h2)
    d = min(d, 12 - d)
    return {0: "conjunction", 2: "sextile", 3: "square", 4: "trine", 6: "opposition"}.get(d, "none")


def company(hc: Dict[int, int], a: int, b: int, compound_mode: str = "inverse") -> str:
    """同伴四型(成对宫):simple/demi_simple/compound/capitular/none。"""
    fa, fb = hc[a], hc[b]
    if fa == fb:
        return "simple"
    if planet(fa) == planet(fb):
        return "demi_simple"
    opp = inverse(fb) if compound_mode == "inverse" else reverse(fb)
    if fa == opp:
        return "compound"
    if row(fa, FIRE) == row(fb, FIRE):
        return "capitular"
    return "none"


# ---- 新补(WP-2 起步) ----
_MALEFIC = {"Rubeus", "Cauda Draconis"}


def prohibition(hc: Dict[int, int], q: int, t: int, wrap: bool = False) -> Optional[int]:
    """阻碍:两指示宫宫序间(开区间)插入强凶图(Rubeus/Cauda)→ 返回该阻碍宫号,否则 None。
    wrap=True 时另查「绕行一侧」的短弧:十二宫成环,取两宫之间较短的一段作阻碍区间。"""
    from .figures import name as _name
    lo, hi = (q, t) if q <= t else (t, q)
    inner = list(range(lo + 1, hi))
    if wrap:
        outer = [h for h in range(hi + 1, 13)] + [h for h in range(1, lo)]
        span = inner if len(inner) <= len(outer) else outer
    else:
        span = inner
    for h in span:
        if _name(hc[h]) in _MALEFIC:
            return h
    return None


# 点数取样范围。基准所载为「统计全盘(或四母、或某些关键图)」——**全盘**为主流,故以之为默认。
PARITY_SCOPES = ("shield16", "mothers", "houses12")


def points_parity(hc: Dict[int, int], shield=None, scope: str = "shield16") -> dict:
    """点数是否:所选范围之总点数奇偶。偶→是/稳、奇→否/动(古法通则)。

    🔴 **十二宫取样是数学退化,答案恒为「是」**(实测 3000 盘 even 3000 / odd 0):
       十二宫 = 四母 + 四女 + 四甥;四女是四母的**转置**,单点总数与四母恒等 ⇒ 母+女恒偶;
       四甥各由两图异或而成,成对之单点和亦恒偶 ⇒ 十二宫奇偶被结构锁死(同「判官点数恒偶」)。
       故此项取样默认改为**全盘十六图**(实测 odd 1504 / even 1496,真有判别力);
       十二宫仍可选,但如实标 degenerate,免得用户以为「怎么起都答是」是算错了。
    """
    sc = scope if scope in PARITY_SCOPES else "shield16"
    if sc == "houses12" or shield is None:
        figs = [hc[h] for h in range(1, 13)]
        sc = "houses12" if shield is None and scope not in PARITY_SCOPES else sc
    elif sc == "mothers":
        figs = list(shield.mothers)
    else:
        figs = (list(shield.mothers) + list(shield.daughters) + list(shield.nieces)
                + [shield.right_witness, shield.left_witness, shield.judge, shield.reconciler])
    total = sum(points(f) for f in figs)
    return {"total": total, "parity": "even" if total % 2 == 0 else "odd",
            "bias": "yes" if total % 2 == 0 else "no",
            "scope": sc, "sampled": len(figs),
            # 十二宫之和被结构锁死为偶 —— 如实交代,不装作是本卦算得
            "degenerate": sc == "houses12",
            "degenerate_note": ("十二宫之和受四女转置与四甥成对异或所限,结构上恒为偶数,"
                                "此项在该取样下恒答「是」,不具判别力") if sc == "houses12" else None}


# 应期:动静(quality) × 元素单位 × 宫角速度。
_UNIT = {"Fire": "日", "Air": "周", "Water": "月", "Earth": "年"}
_ANGULAR = {1: "fast", 4: "fast", 7: "fast", 10: "fast",
            2: "mid", 5: "mid", 8: "mid", 11: "mid",
            3: "slow", 6: "slow", 9: "slow", 12: "slow"}   # 角/续/果宫


def quantity(hc: Dict[int, int]) -> dict:
    """数量:十二宫总点数定多寡。十二图点数各 4–8,故总数域为 48–96;
    三分其域:少(≤63)/中(64–79)/多(≥80)。用于「有多少/几件/几人」一类问法。"""
    total = sum(points(hc[h]) for h in range(1, 13))
    if total <= 63:
        band, label = "few", "少"
    elif total <= 79:
        band, label = "moderate", "中"
    else:
        band, label = "many", "多"
    return {"total": total, "min": 48, "max": 96, "band": band, "label": label}


def timing(hc: Dict[int, int], house: int) -> dict:
    """应期与速度:动→快/静→慢;单位按内元素(火日风周水月地年);宫角:角宫快续宫中果宫慢。
    另出数量(总点数三分),供「多少/几件」一类问法。元素单位另有异说,可由上游改写。"""
    fd = data(hc[house])
    speed = "fast" if fd["quality"] == "mobile" else "slow"
    return {"speed": speed, "unit": _UNIT.get(fd["element_inner"], "月"),
            "angularity": _ANGULAR.get(house, "mid"), "reason": f"{fd['quality']}·{fd['element_inner']}",
            "quantity": quantity(hc)}


_TRIPLICITY = {"fire": [1, 5, 9], "earth": [2, 6, 10], "air": [3, 7, 11], "water": [4, 8, 12]}


def triplicities(house: int) -> List[int]:
    """黄道三方(宫位):火 1/5/9、地 2/6/10、风 3/7/11、水 4/8/12。"""
    for hs in _TRIPLICITY.values():
        if house in hs:
            return list(hs)
    return [house]


def perfection_by_aspect(hc: Dict[int, int], q: int, t: int, wrap: bool = False) -> Optional[str]:
    """相位完美:若常规完美为 none,但两指示宫成吉相位(六分/拱)且其间无强凶图 → 借相位成局。"""
    if perfection(hc, q, t, wrap) != "none":
        return None
    asp = aspect(q, t)
    if asp in ("sextile", "trine") and prohibition(hc, q, t, wrap) is None:
        return asp
    return None


# ---- 盾牌树:亲缘 paternitas + 点之路 via puncti(需 Shield) ----
def paternitas(shield) -> dict:
    """亲缘生成树:判官←{右证,左证};右证←{甥1,甥2}←{母1母2,母3母4};左证←{甥3,甥4}←{女1女2,女3女4}。
    返回 {node: figure_int, children:[...]} 嵌套(叶=母/女)。"""
    from .figures import name as _name
    M, D, Nz = shield.mothers, shield.daughters, shield.nieces

    def leaf(f):
        return {"figure": f, "name": _name(f), "children": []}

    def node(f, kids):
        return {"figure": f, "name": _name(f), "children": kids}

    n1 = node(Nz[0], [leaf(M[0]), leaf(M[1])])
    n2 = node(Nz[1], [leaf(M[2]), leaf(M[3])])
    n3 = node(Nz[2], [leaf(D[0]), leaf(D[1])])
    n4 = node(Nz[3], [leaf(D[2]), leaf(D[3])])
    rw = node(shield.right_witness, [n1, n2])
    lw = node(shield.left_witness, [n3, n4])
    return node(shield.judge, [rw, lw])


def via_puncti(shield) -> dict:
    """点之路:自判官沿火行单点上溯。每层取火行=单点(active)的子;
    若恰一子为单点则贯通,若两子皆单/皆双则该层断/分叉。返回 {path:[名…], broken_at:层名 或 None}。"""
    tree = paternitas(shield)
    path = [tree["name"]]
    node = tree
    broken_at = None
    level_names = ["判官", "证", "甥/母层"]
    depth = 0
    while node["children"]:
        actives = [c for c in node["children"] if row(c["figure"], FIRE) == 1]
        if len(actives) == 1:
            node = actives[0]
            path.append(node["name"])
        else:
            broken_at = level_names[depth] if depth < len(level_names) else f"层{depth}"
            break
        depth += 1
    return {"path": path, "broken_at": broken_at, "through": broken_at is None}


def natural_cosignificator(judge_fig: int) -> Optional[str]:
    """月亮自然共主:判官为 Populus/Via(月亮系)时,月亮作天然共主参断。"""
    from .figures import name as _name
    return "Moon" if _name(judge_fig) in ("Populus", "Via") else None


# ── 古典判据补齐:位置 locus / 移动 motus / 盾牌生成三元组 / 完美之中介 ──
# 吉宫与凶宫取中世纪通行分野;其余为平宫。各家略有出入,故只标三档不作细分。
_FORTUNATE_HOUSES = (1, 5, 10, 11)
_UNFORTUNATE_HOUSES = (6, 8, 12)


def locus(hc: Dict[int, int], house: int) -> dict:
    """位置:所指之宫本身的吉凶,以及其所盛之图的吉凶基调。
    下判语前须并看「图之善恶」与「所落之宫善恶」——图吉而落凶宫,其吉减半。"""
    h = max(1, min(12, int(house)))
    if h in _FORTUNATE_HOUSES:
        band, label = "fortunate", "吉宫"
    elif h in _UNFORTUNATE_HOUSES:
        band, label = "unfortunate", "凶宫"
    else:
        band, label = "neutral", "平宫"
    fd = data(hc[h])
    return {"house": h, "band": band, "label": label,
            "figure_tone": fd.get("tone"), "figure": fd.get("latin")}


def motus(hc: Dict[int, int]) -> dict:
    """移动:同一图在十二宫中重现于哪几宫、共几次。
    重现愈多则其象愈贯穿全局;仅现一次者为局部之象。"""
    where: Dict[int, List[int]] = {}
    for h in range(1, 13):
        where.setdefault(hc[h], []).append(h)
    from .figures import name as _name
    recur = [{"figure": _name(f), "houses": hs, "count": len(hs)}
             for f, hs in where.items() if len(hs) > 1]
    recur.sort(key=lambda x: (-x["count"], x["houses"][0]))
    return {"recurring": recur, "distinct_figures": len(where),
            "max_recurrence": max((r["count"] for r in recur), default=1)}


def shield_triads(shield) -> List[dict]:
    """盾牌生成三元组:每组「父·父·子」共七组,用以追某结论之来源。
    与黄道宫三方(火 1/5/9 等)是两回事,勿混。"""
    from .figures import name as _name
    M, D, Nz = shield.mothers, shield.daughters, shield.nieces
    groups = [
        ("母一母二→甥一", M[0], M[1], Nz[0]),
        ("母三母四→甥二", M[2], M[3], Nz[1]),
        ("女一女二→甥三", D[0], D[1], Nz[2]),
        ("女三女四→甥四", D[2], D[3], Nz[3]),
        ("甥一甥二→右证", Nz[0], Nz[1], shield.right_witness),
        ("甥三甥四→左证", Nz[2], Nz[3], shield.left_witness),
        ("右证左证→判官", shield.right_witness, shield.left_witness, shield.judge),
    ]
    return [{"label": lb, "parents": [_name(a), _name(b)], "child": _name(c),
             "parent_ints": [a, b], "child_int": c} for lb, a, b, c in groups]


def perfection_detail(hc: Dict[int, int], q: int, t: int, wrap: bool = False) -> dict:
    """完美之细情:除类型外,并出**中介之图与其所在之宫**、以及会合中「移就」的一方。
    传递之第三图所在之宫即揭示中介者身份(如落七宫则为配偶或合伙之人促成)。
    注:reading['perfection'] 仍回字符串以保既有读取零回归,此处为其细情之补。"""
    from .figures import name as _name
    typ = perfection(hc, q, t, wrap)
    out = {"type": typ, "via_figure": None, "via_house": None, "mover": None}
    if typ == "none" or typ == "occupation":
        return out
    fq, ft = hc[q], hc[t]
    if typ == "conjunction":
        # 何方移就:问者之图现于所问之邻宫 → 问者移就;反之则所问移就
        for h in _adj(t, wrap):
            if h != q and hc[h] == fq:
                out["mover"] = "querent"
                out["via_house"] = h
                out["via_figure"] = _name(fq)
                return out
        for h in _adj(q, wrap):
            if h != t and hc[h] == ft:
                out["mover"] = "quesited"
                out["via_house"] = h
                out["via_figure"] = _name(ft)
                return out
        return out
    if typ == "mutation":
        pairs = [(h, h + 1) for h in range(1, 12)]
        if wrap:
            pairs.append((12, 1))
        for a, b in pairs:
            if a in (q, t) or b in (q, t):
                continue
            if {hc[a], hc[b]} == {fq, ft}:
                out["via_house"] = [a, b]
                out["via_figure"] = [_name(hc[a]), _name(hc[b])]
                return out
        return out
    if typ == "translation":
        adj_q = {h: hc[h] for h in _adj(q, wrap)}
        adj_t = {h: hc[h] for h in _adj(t, wrap)}
        shared = (set(adj_q.values()) & set(adj_t.values())) - {fq, ft}
        if shared:
            fig = sorted(shared)[0]
            hs = sorted([h for h, f in list(adj_q.items()) + list(adj_t.items()) if f == fig])
            out["via_figure"] = _name(fig)
            out["via_house"] = hs
        return out
    return out
