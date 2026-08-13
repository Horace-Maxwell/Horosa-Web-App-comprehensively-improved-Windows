# -*- coding: utf-8 -*-
"""解读技法:完美 Perfection / 相位 Aspect / 同伴 Company(移植);阻碍 / 点数是否 / 应期数量 / 三方(新补)。
每条判定均可由宫位盘 + 图形数据确定性导出,供上游赋义与 AI 真值。"""
from __future__ import annotations

from typing import Dict, List, Optional

from .figures import (AIR, EARTH, ELEMENT_ROWS, FIRE, WATER, data, inverse, name,
                      planet, points, reverse, row)

PAIRED_HOUSES = [(1, 2), (3, 4), (5, 6), (7, 8), (9, 10), (11, 12)]


def _adj(h: int, wrap: bool = False) -> List[int]:
    if wrap:
        return [(h - 2) % 12 + 1, h % 12 + 1]
    return [x for x in (h - 1, h + 1) if 1 <= x <= 12]


# 前宫 = 宫序之下一宫、后宫 = 上一宫(与宫序推进同向)。传本只给图示未著公式,此处收于一处以便他日改口径。
def _forward_house(h: int, wrap: bool = False) -> Optional[int]:
    if h >= 12:
        return 1 if wrap else None
    return h + 1


def _backward_house(h: int, wrap: bool = False) -> Optional[int]:
    if h <= 1:
        return 12 if wrap else None
    return h - 1


def _side_of(base: int, other: int, wrap: bool = False) -> Optional[str]:
    """other 相对 base 居前宫(forward)抑或后宫(backward)。"""
    if other == _forward_house(base, wrap):
        return "forward"
    if other == _backward_house(base, wrap):
        return "backward"
    return None


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


# ═══════════════════════════════════════════════════════════════════════════
# 传本对齐补齐:精准相位方向细则 / 法庭三角 / 时间流 / 有效性 / 得地 / 寻源四线 /
#              元素法 / 成败 / 希腊点 / 地占三角 / 宣判奇偶
# 均为纯函数;既有各键形态一字未改,新出者皆另立键。
# ═══════════════════════════════════════════════════════════════════════════

# 传递之四种知晓格局:以第三图分居两指示宫之前后宫论
_TRANSLATION_KNOWLEDGE = {
    ("backward", "backward"): "third_party_hidden",
    ("backward", "forward"): "quesited_knows",
    ("forward", "backward"): "querent_knows",
    ("forward", "forward"): "both_know",
}


def perfection_direction(hc: Dict[int, int], q: int, t: int, wrap: bool = False) -> dict:
    """精准相位之方向细则(传本盘式所载,既有 perfection_detail 之补,不改其四键):

    联合:以图现于对方之**前宫**抑或**后宫**分野 —— 后宫者其功成于对方背后(用对方不解之知),
          前宫者其功成于台面(用通识或双方有约)。双方皆有联合时,以联合之多寡与图之吉凶较其付出。
    传递:第三图分居两宫之前后,定四种知晓格局(俱藏/对象知/事主知/双方知)。
    突变:两图所落之宫即完成之法与地之线索。
    """
    typ = perfection(hc, q, t, wrap)
    out: Dict[str, object] = {"type": typ, "conjunctions_all": [], "sides": None,
                              "knowledge_code": None, "hint_code": None}
    if typ == "none":
        return out
    fq, ft = hc[q], hc[t]

    # 联合:枚举全部命中(供「双方皆有联合」时比较多寡)
    conj: List[dict] = []
    for h in _adj(t, wrap):
        if h != q and hc[h] == fq:
            conj.append({"mover": "querent", "house": h, "figure": name(fq),
                         "direction": _side_of(t, h, wrap), "relative_to": t})
    for h in _adj(q, wrap):
        if h != t and hc[h] == ft:
            conj.append({"mover": "quesited", "house": h, "figure": name(ft),
                         "direction": _side_of(q, h, wrap), "relative_to": q})
    out["conjunctions_all"] = conj

    if typ == "mutation":
        out["hint_code"] = "venue_clue"
        return out

    if typ == "translation":
        adj_q = {h: hc[h] for h in _adj(q, wrap)}
        adj_t = {h: hc[h] for h in _adj(t, wrap)}
        shared = (set(adj_q.values()) & set(adj_t.values())) - {fq, ft}
        if shared:
            fig = sorted(shared)[0]
            hq = [h for h, f in adj_q.items() if f == fig]
            ht = [h for h, f in adj_t.items() if f == fig]
            sq = _side_of(q, hq[0], wrap) if hq else None
            st = _side_of(t, ht[0], wrap) if ht else None
            out["sides"] = {"querent_side": sq, "quesited_side": st}
            out["knowledge_code"] = _TRANSLATION_KNOWLEDGE.get((sq, st))
    return out


# ── 法庭三角:普遍吉凶性(传本口径,与全局 tone 并行不覆盖)──
def tone_class(fig: int) -> str:
    """传本普遍吉凶性归三类:吉 good / 凶 bad / 中 mid(含弱吉)。
    读 figures.json 之 tone_book(传本口径),与既有 tone(本仓固有口径)并存互不覆盖。"""
    tb = data(fig).get("tone_book") or data(fig).get("tone")
    if tb == "good":
        return "good"
    if tb == "bad":
        return "bad"
    return "mid"          # neutral 与 weak_good(弱吉)俱作「中」


# (左证, 法官, 右证) → 断语代码。传本原表仅列以下组合,未列者如实标 unlisted,不臆造。
# 🔴 结构性事实(全 16⁴ 母图穷举实证,见单测):吉凶组合共 23 种可达,而传本首行
#    「吉吉吉 → 自天佑之」**永不可达** —— 法官 = 右证⊕左证,点数奇偶等价于单点数奇偶,
#    故二证单点数必同奇偶;传本吉图五者中同奇偶者两两相配,其和恒落{道路,会合,牢狱,群众},
#    皆非吉图。故此行留表以存传本原貌,但界面不得宣称其可得,亦不可当作漏算之 bug。
_COURT_TABLE = {
    ("good", "good", "good"): "all_good",
    ("good", "good", "bad"): "end_good_delay",
    ("bad", "good", "good"): "end_good_delay",
    ("bad", "good", "bad"): "end_good_hard",
    ("good", "bad", "good"): "gain_not_self",
    ("bad", "bad", "good"): "no_success_has_end",
    ("mid", "bad", "good"): "no_success_has_end",
    ("good", "bad", "bad"): "well_unused",
    ("good", "bad", "mid"): "well_unused",
    ("bad", "bad", "bad"): "all_bad",
}
# 法官特例:此二图不问三方组合,别有专断
_JUDGE_SPECIAL = {"Via": "via", "Populus": "populus"}


def court_verdict(shield) -> dict:
    """法庭三角:以左证·法官·右证三图之吉凶断成否。
    法官定总方向;右证为事主、左证为条件环境(传本口径)。"""
    rw, lw, jd = shield.right_witness, shield.left_witness, shield.judge
    combo = (tone_class(lw), tone_class(jd), tone_class(rw))
    code = _COURT_TABLE.get(combo)
    return {
        "left": {"figure": name(lw), "tone_class": combo[0]},
        "judge": {"figure": name(jd), "tone_class": combo[1]},
        "right": {"figure": name(rw), "tone_class": combo[2]},
        "combo": list(combo),
        "verdict_code": code or "unlisted",
        "listed": code is not None,
        "judge_special": _JUDGE_SPECIAL.get(name(jd)),
    }


def time_flow(shield) -> dict:
    """时间流:右证为过去、法官为现在、左证为未来。
    论一段时间之吉凶,则三等分之:右证第一段、法官第二段、左证第三段。"""
    return {
        "past": {"role": "right_witness", "figure": name(shield.right_witness)},
        "present": {"role": "judge", "figure": name(shield.judge)},
        "future": {"role": "left_witness", "figure": name(shield.left_witness)},
        "segmenting": "tri",
        "segment_order": ["right_witness", "judge", "left_witness"],
    }


# ── 占卜有效性五则(与「首母中止」各自独立:中止只一档,此为传本五则全谱)──
_VALIDITY_BY_FIRST = {
    "Cauda Draconis": ("not_asked_or_decided", "传本自注:不认同此则"),
    "Rubeus": ("deceit", None),
    "Amissio": ("insufficient_info", "传本自注:未必"),
    "Populus": ("question_not_real", None),
}


def validity(shield, hc: Dict[int, int], q: int, t: int, wrap: bool = False) -> dict:
    """占卜有效性五则(传本所载,全项常驻;命中与否俱如实回传):
    一 首图龙尾 —— 此事不问,或事主已自决;
    二 首图红色 —— 自欺、隐瞒、有意欺骗;若两指示卦间有精准相位,则为有意欺骗对象;
    三 首图失去 —— 信息不足;
    四 首图群众 —— 所问非事主真实之问,宜重新提问;
    五 (盘式)一宫群众并十一宫红色 —— 问题虚假,同第四则。
    前四则论**第一卦**(首母,顺铺与四正入宫下即一宫之图);第五则为盘式,论一宫与十一宫。"""
    first = shield.mothers[0]
    fn = name(first)
    rules: List[dict] = []
    for idx, key in enumerate(("Cauda Draconis", "Rubeus", "Amissio", "Populus"), start=1):
        code, note = _VALIDITY_BY_FIRST[key]
        hit = fn == key
        if hit and key == "Rubeus" and perfection(hc, q, t, wrap) != "none":
            code = "deceive_quesited"
        rules.append({"id": idx, "hit": hit, "figure": key,
                      "code": code if hit else None, "book_note": note})
    h1, h11 = name(hc[1]), name(hc[11])
    hit5 = (h1 == "Populus" and h11 == "Rubeus")
    rules.append({"id": 5, "hit": hit5, "figure": "Populus+Rubeus",
                  "code": "false_question" if hit5 else None, "book_note": None,
                  "scope": "chart"})
    return {"first_figure": fn, "rules": rules,
            "any_hit": any(r["hit"] for r in rules)}


# ── 得地:盾十六位各配一元素(位序循环 火风水土),与所盛图之主元素论四档强弱 ──
TENANCY_POSITION_ELEMENTS = tuple(["Fire", "Air", "Water", "Earth"] * 4)
TENANCY_POSITION_LABELS = ("母一", "母二", "母三", "母四", "女一", "女二", "女三", "女四",
                           "甥一", "甥二", "甥三", "甥四", "右证", "左证", "判官", "宣判")
_HOT = ("Fire", "Air")          # 热:火风
_DRY = ("Fire", "Earth")        # 干:火土


def tenancy_grade(fig_element: str, position_element: str) -> str:
    """四档(传本得地):
    full   卦与位元素全同 —— 其位最强,能全展此卦之力;
    assist 温度同而湿度异 —— 作补充辅助而现,目标随时而移;
    stall  湿度同而温度异 —— 平衡而稳,致行动停滞,来日有增长之潜力,须释放或引外力;
    weak   全不相同 —— 于此位无力,不能(或不欲)完成其任。"""
    if fig_element == position_element:
        return "full"
    same_temp = (fig_element in _HOT) == (position_element in _HOT)
    same_humid = (fig_element in _DRY) == (position_element in _DRY)
    if same_temp:
        return "assist"
    if same_humid:
        return "stall"
    return "weak"


def tenancy(shield, reconciler_fig: Optional[int] = None) -> List[dict]:
    """盾十六位之得地。第十六位为宣判(调和者),不取调和者时如实留空。"""
    order = (list(shield.mothers) + list(shield.daughters) + list(shield.nieces)
             + [shield.right_witness, shield.left_witness, shield.judge])
    figs: List[Optional[int]] = list(order) + [reconciler_fig]
    out = []
    for i, f in enumerate(figs):
        pos_el = TENANCY_POSITION_ELEMENTS[i]
        if f is None:
            out.append({"position": i + 1, "label": TENANCY_POSITION_LABELS[i],
                        "position_element": pos_el, "figure": None,
                        "figure_element": None, "grade": None})
            continue
        fe = data(f)["element_inner"]
        out.append({"position": i + 1, "label": TENANCY_POSITION_LABELS[i],
                    "position_element": pos_el, "figure": name(f),
                    "figure_element": fe, "grade": tenancy_grade(fe, pos_el)})
    return out


# ── 寻源法四线:自法官之阳爻上溯(传本四线俱可寻,不限火线)──
_VIA_LINES = {"fire": FIRE, "air": AIR, "water": WATER, "earth": EARTH}
_VIA_LINE_ZH = {"fire": "火:目的、目标、渴望、指引、意志", "air": "风:交流、创造、思想、主意、逻辑、理论",
                "water": "水:感情、情绪、灵性层面", "earth": "土:结果、物质层面、隐藏、财富"}


def _shield_tree_with_positions(shield):
    """盾牌亲缘树(带盾位号:母一至母四=1-4、女一至女四=5-8),供寻源定终点。"""
    M, D, Nz = shield.mothers, shield.daughters, shield.nieces

    def leaf(f, pos):
        return {"figure": f, "position": pos, "children": []}

    def node(f, kids):
        return {"figure": f, "position": None, "children": kids}

    n1 = node(Nz[0], [leaf(M[0], 1), leaf(M[1], 2)])
    n2 = node(Nz[1], [leaf(M[2], 3), leaf(M[3], 4)])
    n3 = node(Nz[2], [leaf(D[0], 5), leaf(D[1], 6)])
    n4 = node(Nz[3], [leaf(D[2], 7), leaf(D[3], 8)])
    rw = node(shield.right_witness, [n1, n2])
    lw = node(shield.left_witness, [n3, n4])
    return node(shield.judge, [rw, lw])


def via_elements(shield) -> dict:
    """寻源四线:法官某行为阳爻(单点)者方可寻;沿该行单点之子逐层上溯至母/女层。
    终点落盾位一至四(个人宫位·我方)则多关事主自身之行,落五至八(人际宫位·对方)则多关他人环境客观。

    🔴 结构性事实(全 16⁴ 穷举实证,见单测):法官该行为阳爻者**必然一路贯通** ——
       法官=二证异或,该行为单点则二证中恰一者单点,每层皆然,故路径唯一且必达底层。
       下方 broken_at 一支为防御性保留(手造不自洽盾牌时),正常盘中结构上不出现。
       可见传本「由法官中的阳爻向上寻源」正是此法可定义之条件:阴爻者非「断路」,乃「不可由此寻」。

    ⚠️ 既有 via_puncti(旧法·只沿火行且不验法官本行,其 broken_at 实为「不可寻」之误呈)
       一字未改、仍照旧回传;此为传本全谱之补,两键并存各自如实。"""
    tree = _shield_tree_with_positions(shield)
    level_names = ["判官", "证", "甥/母层"]
    out: Dict[str, object] = {}
    for key, bit in _VIA_LINES.items():
        if row(shield.judge, bit) != 1:
            out[key] = {"traceable": False, "line_zh": _VIA_LINE_ZH[key],
                        "reason": "法官此行为双点(阴爻),传本不由此寻源",
                        "path": [], "broken_at": None, "through": False, "terminus": None}
            continue
        node, path, broken_at, depth = tree, [name(tree["figure"])], None, 0
        while node["children"]:
            actives = [c for c in node["children"] if row(c["figure"], bit) == 1]
            if len(actives) == 1:
                node = actives[0]
                path.append(name(node["figure"]))
            else:
                broken_at = level_names[depth] if depth < len(level_names) else f"层{depth}"
                break
            depth += 1
        pos = node.get("position")
        terminus = None
        if broken_at is None and pos:
            terminus = {"position": pos,
                        "side": "self" if pos <= 4 else "other",
                        "sphere": "personal" if pos <= 4 else "interpersonal",
                        "figure": name(node["figure"])}
        out[key] = {"traceable": True, "line_zh": _VIA_LINE_ZH[key], "reason": None,
                    "path": path, "broken_at": broken_at,
                    "through": broken_at is None, "terminus": terminus}
    return out


# ── 元素法:四女各由四母同爻位构成(火爻成第五卦、风爻第六、水爻第七、土爻第八)──
_ELEMENT_DAUGHTER_INDEX = {"fire": 0, "air": 1, "water": 2, "earth": 3}


def element_supply(shield, via: Optional[dict] = None) -> dict:
    """元素法:数各元素之女卦阳爻,三及以上为相对充沛、二及以下为相对匮乏。
    法官有此元素者,可用寻源法追之:寻得在我方为元素自给,在对方为元素借贷。

    ⚠️ 元素有无与充沛与否**皆非吉凶之判**,当结合盾图综合考虑(此注恒随回传,不得省)。"""
    out: Dict[str, object] = {"note": "元素之有无、充沛与否皆非吉凶判断,须结合盾图综合考虑"}
    per: Dict[str, object] = {}
    for key, bit in _VIA_LINES.items():
        d_idx = _ELEMENT_DAUGHTER_INDEX[key]
        fig = shield.daughters[d_idx]
        # 该女卦之阳爻即诸母于此元素之阳爻:女卦第 (3-k) 位 ← 母 k+1
        positions = [k + 1 for k in range(4) if (fig >> (3 - k)) & 1]
        cnt = len(positions)
        judge_has = row(shield.judge, bit) == 1
        src = None
        if judge_has and via and isinstance(via.get(key), dict):
            src = (via[key] or {}).get("terminus")
        per[key] = {
            "figure": name(fig), "daughter_index": d_idx + 1, "shield_position": d_idx + 5,
            "active_count": cnt, "mother_positions": positions,
            "level": "abundant" if cnt >= 3 else "scarce",
            "judge_has": judge_has,
            "source": src,
            "supply": (None if not src else ("self_supplied" if src.get("side") == "self"
                                             else "borrowed")),
        }
    out["elements"] = per
    return out


# ── 成败:有无精准相位定发生与否,再以两指示图之吉凶分四格 ──
_SUCCESS_TONE = {("good", "good"): "both_good", ("good", "bad"): "querent_better",
                 ("bad", "good"): "quesited_better", ("bad", "bad"): "both_bad"}


def success(hc: Dict[int, int], q: int, t: int, wrap: bool = False) -> dict:
    """成败判定(传本盘式):有精准相位=成功(事将发生)、无=失败(不发生);
    再以事主图与对象图之吉凶分四格。此判只论成否,与结果好坏(法庭三角)、过程顺逆(相位)无关,
    且必与法官合参。传本原表只列吉/凶两态,遇「中」则如实标 not_covered,不臆造。"""
    perf = perfection(hc, q, t, wrap)
    has = perf != "none"
    cq, ct = tone_class(hc[q]), tone_class(hc[t])
    key = _SUCCESS_TONE.get((cq, ct))
    stem = "occur" if has else "fail"
    return {
        "has_perfection": has, "perfection": perf,
        "querent_tone": cq, "quesited_tone": ct,
        "code": f"{stem}_{key}" if key else "not_covered",
        "covered": key is not None,
        "caveat": "只判成否,不判好坏顺逆;须与法官合参,勿滥用",
    }


# ── 希腊点(地占式):福点取十二卦点数之和、灵点取十二卦阳爻数之和,各除十二取余入盘 ──
def greek_points(hc: Dict[int, int]) -> dict:
    """福点:好运所在、身体健康、财富、事业成败、心理素质。
    灵点:意志、梦想、希望、追求、欲望、幻想。余零者入十二宫。"""
    f_total = sum(points(hc[h]) for h in range(1, 13))
    s_total = sum(sum(row(hc[h], b) for b in ELEMENT_ROWS) for h in range(1, 13))
    return {
        "fortune_total": f_total, "fortune_house": 12 if f_total % 12 == 0 else f_total % 12,
        "spirit_total": s_total, "spirit_house": 12 if s_total % 12 == 0 else s_total % 12,
    }


# ── 地占三角:四组(盾位 1,2→9 / 3,4→10 / 5,6→11 / 7,8→12)──
_TRIANGLE_GROUPS = ((1, 2, 9), (3, 4, 10), (5, 6, 11), (7, 8, 12))


def shield_triangles(shield) -> List[dict]:
    """地占三角四组:底二卦为补充、顶卦(甥)为概括之果;读法同法庭三角。
    动态发展另可按时间流看过去现在未来 —— 传本未著逐位之映射,故此处只出结构,不硬标时序。"""
    seq = list(shield.mothers) + list(shield.daughters) + list(shield.nieces)
    out = []
    for idx, (a, b, c) in enumerate(_TRIANGLE_GROUPS, start=1):
        fa, fb, fc = seq[a - 1], seq[b - 1], seq[c - 1]
        out.append({
            "index": idx,
            "base": [{"position": a, "figure": name(fa), "tone_class": tone_class(fa)},
                     {"position": b, "figure": name(fb), "tone_class": tone_class(fb)}],
            "apex": {"position": c, "figure": name(fc), "tone_class": tone_class(fc)},
            "time_flow_note": "静态以顶卦概括、底卦补充;动态可按时间流三分",
        })
    return out


# ── 宣判(补卦)之奇偶:偶为客观事实(偏实)、奇为主观意志(偏虚)。援传本对应系统之奇偶主客观义。 ──
RECONCILER_PARITY_CODE = {"even": "objective_real", "odd": "subjective_virtual"}


def reconciler_parity(recon_fig: Optional[int]) -> Optional[dict]:
    """宣判卦(第十六卦=一卦⊕法官)之奇偶,参断事之真假虚实。
    据传本对应系统「奇数卦主观意志内在、偶数卦客观事实外在」推得:偶偏实、奇偏虚。"""
    if recon_fig is None:
        return None
    p = "even" if points(recon_fig) % 2 == 0 else "odd"
    return {"figure": name(recon_fig), "points": points(recon_fig), "parity": p,
            "code": RECONCILER_PARITY_CODE[p],
            "basis": "对应系统奇偶主客观义", "tradition_note": "arabic"}
