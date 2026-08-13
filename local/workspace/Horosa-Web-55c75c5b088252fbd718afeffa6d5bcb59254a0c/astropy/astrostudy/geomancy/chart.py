# -*- coding: utf-8 -*-
"""整盘聚合:起卦 → 盾牌盘 → 宫位盘(图形入宫) → 全套可计算读法 → 对应赋义。后端服务(webgeomancysrv)主入口。

返回富 JSON(每图全字段 + 见证/判官/调和者 + houses[*].figure 入宫 + perfection/aspect/company/points/
timing/quantity/via_puncti/paternitas + 定局落星甲乙 + 图数三系 + 转宫派生 + sikidy/hakata/ifa 分支)。

**传本粒度覆盖**:所有 granular 形参缺省一律回落 profile 值,不传即与既往逐字节等同(零回归)。
"""
from __future__ import annotations

import random
from typing import Optional

from . import correspondences as corr
from . import reading as R
from .figures import (active_elements, data, is_palindrome, name, opposite, points,
                      reverse, rotate, inverse)
from .hakata import cast_hakata
from .house import (PLANET_ORDER, ascendant_sign, ascendant_from_source,
                    astro_place_planets_from_chart, astro_place_planets_bytwelves,
                    astro_place_planets_real,
                    derived_house, house_chart, house_chart_buyut,
                    house_signs, HOUSE_SYSTEMS, HOUSE_PLACEMENTS, ASC_SOURCES)
from .ephem import real_erection
from .ifa import cast_ifa, CULTURAL_NOTICE as IFA_NOTICE, odu_of
from .numbers import all_numbers, figure_number, normalize_number_system
from .planetary import planetary_chart as build_planetary_chart, PCHART_ZODIAC_TABLES
from .vedic import vedic_overlay
from .random_source import make_rng, normalize_cast_method, normalize_mark_style
from .shield import cast_shield, cast_shield_from_numbers, reconciler_from, RECONCILER_MODES
from .sikidy import (cast_sikidy, check2b, col_to_figure, column_compare, princes_slaves,
                     quadrants, red_sikidy, sikidy_valid, tokan_sikidy, SIKIDY_COL_NAMES)
from .traditions import get_profile

# 定局落星四式:顺铺(不落星)/甲 图主之宫/乙 各星报数定宫/丁 真实星历黄经定宫(须时地)
HOUSE_PROJECTIONS = ("sequential", "astro_from_chart", "astro_bytwelves", "real_ephemeris")
DIRECTIONS = ("LTR", "RTL")
COMPOUND_MODES = ("inverse", "reverse")
# 名表体系:只列**有配对依据**者。马语名与月之十六相名所据基准均只载名与义、未载其与图之配属,
# 故不入此选(仍在各自视图作参考名录呈现),绝不臆造配对。
NAME_SYSTEMS = ("latin", "arabic", "greek", "hebrew", "yoruba")


def _display_name(d: dict, system: str) -> str:
    """按所选名表取图之主名;该体系缺名则回落拉丁名(绝不留空)。"""
    key = {"latin": "latin", "arabic": "name_arabic", "greek": "name_greek",
           "hebrew": "name_hebrew", "yoruba": "name_yoruba"}.get(system, "latin")
    return d.get(key) or d.get("latin")


def _pick(explicit, profile_value, allowed=None, default=None):
    """granular 取值:显式传入优先,否则回落 profile,再否则取 default。allowed 非空时做白名单校验。"""
    v = explicit if explicit is not None else profile_value
    if v is None:
        v = default
    if allowed and v not in allowed:
        v = profile_value if profile_value in (allowed or ()) else default
    return v


def _fig_obj(f: int, number_system: str = "points", names_system: str = "latin") -> dict:
    """图形对外对象:全字段 + 点数 + reverse/inverse/converse 名 + 多语异名 + 逐图含义 + 图数三系 + 对应主形。"""
    d = dict(data(f))
    lat = d["latin"]
    d["int"] = f
    d["points"] = points(f)
    d["reverse_of"] = name(reverse(f))
    d["inverse_of"] = name(inverse(f))
    d["converse_of"] = name(reverse(inverse(f)))
    # 传本图形关系六式之余二:对卦(语义相对)与减法(地爻置上)
    d["opposite_of"] = name(opposite(f))
    d["rotate_of"] = name(rotate(f))
    alt = corr.figure_alt_names(lat)
    d["name_greek"] = alt.get("greek")
    d["name_hebrew"] = alt.get("hebrew")
    d["meanings"] = corr.figure_meaning(lat)
    d["numbers"] = all_numbers(f)
    d["number"] = figure_number(f, number_system)
    e = odu_of(f)
    d["odu"] = {"name": e["name"], "seniority": e["seniority"], "marks": list(e["marks"])} if e else None
    # 结构属性(数学定义,无流派分歧)
    d["is_palindrome"] = is_palindrome(f)
    d["active_elements"] = active_elements(f)
    # 东传一支叠加层(纯显示,不改起盘与判读)
    d["vedic"] = vedic_overlay(f)
    d["display_name"] = _display_name(d, names_system)
    d["names_system"] = names_system
    return d


def compute_reading(question_type: str = "custom", profile_id: str = "european_classical",
                    cast_method: str = "rng", seed: Optional[int] = None,
                    time_seed: Optional[int] = None, reading_scope: Optional[str] = None,
                    zodiac_system: Optional[str] = None,
                    # ---- granular 传本覆盖(全部缺省回落 profile) ----
                    mark_style: Optional[str] = None, direction: Optional[str] = None,
                    house_projection: Optional[str] = None, wrap_houses: Optional[bool] = None,
                    reconciler: Optional[bool] = None, reconciler_mode: Optional[str] = None,
                    halt_enabled: Optional[bool] = None, compound_mode: Optional[str] = None,
                    number_system: Optional[str] = None, chart_mode: Optional[str] = None,
                    turn_to: Optional[int] = None,
                    house_system: Optional[str] = None,
                    asc_source: Optional[str] = None,
                    names_system: Optional[str] = None,
                    quesited_house: Optional[int] = None,
                    parity_scope: Optional[str] = None,
                    # ---- 传本对齐新增(全部缺省 None,不传即零回归) ----
                    house_placement: Optional[str] = None,
                    cast_numbers: Optional[list] = None,
                    planetary_chart: Optional[bool] = None,
                    planetary_chart_zodiac: Optional[str] = None,
                    planetary_chart_nodes: Optional[bool] = None,
                    planetary_chart_extras: Optional[bool] = None,
                    # ---- 真实星历盘(据所问之时地起上升与宫头;三者缺一即无真实盘)----
                    jd: Optional[float] = None,
                    geo_lon: Optional[float] = None,
                    geo_lat: Optional[float] = None) -> dict:
    """一次完整判读。profile 决定方向/记号/黄道/范围/盘式/调和者/中止默认,可由 granular 形参逐项覆盖。"""
    prof = get_profile(profile_id)
    zsys = zodiac_system or prof.get("zodiac_system", "classical")
    scope = reading_scope or prof.get("reading_scope", "L3")
    cm = normalize_cast_method(cast_method)
    rng = make_rng(cm, seed, time_seed)

    # ---- granular 解析(缺省=profile,故不传即零回归)----
    g_mark = normalize_mark_style(_pick(mark_style, prof.get("mark_style"), default="dots"))
    g_dir = _pick(direction, prof.get("direction"), DIRECTIONS, "LTR")
    g_proj = _pick(house_projection, prof.get("house_projection"), HOUSE_PROJECTIONS, "sequential")
    g_wrap = bool(_pick(wrap_houses, prof.get("wrap_houses"), default=False))
    g_recon = bool(_pick(reconciler, prof.get("reconciler"), default=True))
    g_rmode = _pick(reconciler_mode, prof.get("reconciler_mode"), RECONCILER_MODES, "judge_first_mother")
    g_halt = bool(_pick(halt_enabled, prof.get("halt_enabled"), default=True))
    g_comp = _pick(compound_mode, prof.get("compound_mode"), COMPOUND_MODES, "inverse")
    g_nums = normalize_number_system(_pick(number_system, prof.get("number_system"), default="points"))
    g_chart = _pick(chart_mode, prof.get("chart"), default="shield+house")
    g_hsys = _pick(house_system, prof.get("house_system"), HOUSE_SYSTEMS, "whole_sign")
    g_asc = _pick(asc_source, prof.get("asc_source"), ASC_SOURCES, "h1_figure")
    # 流派自带 names 字段(如希腊档 names="greek")即为其默认名表
    g_names = _pick(names_system, prof.get("names"), NAME_SYSTEMS, "latin")
    g_parity = _pick(parity_scope, prof.get("parity_scope"), R.PARITY_SCOPES, "shield16")
    g_place = _pick(house_placement, prof.get("house_placement"), HOUSE_PLACEMENTS, "sequential")
    g_pchart = bool(_pick(planetary_chart, prof.get("planetary_chart"), default=False))
    g_pczod = _pick(planetary_chart_zodiac, prof.get("planetary_chart_zodiac"),
                    PCHART_ZODIAC_TABLES, "classical")
    g_pcnodes = bool(_pick(planetary_chart_nodes, prof.get("planetary_chart_nodes"), default=False))
    g_pcextras = bool(_pick(planetary_chart_extras, prof.get("planetary_chart_extras"), default=False))

    # 起卦:报数(十六数奇偶定爻)为传本诸法之一,合法即用之,否则照旧走随机源。
    cast_nums = None
    if cast_numbers is not None:
        try:
            nums = [int(x) for x in list(cast_numbers)]
            if len(nums) == 16:
                cast_nums = nums
        except (TypeError, ValueError):
            cast_nums = None
    if cast_nums is not None:
        s = cast_shield_from_numbers(cast_nums)
        cm = "numbers"
    else:
        s = cast_shield(rng)
    hc = house_chart(s, g_place)
    q_house = 1
    # 所问宫:**显式指定优先**,否则由问类查表。
    # 🔴 正法是「取与问题主题对应之宫的图」,十一个问类只是**快捷预设,不是真值源**。
    #    此前只能查表,而表里 custom→1、life→1,与问者宫恒为一撞车 ⇒ q==t ⇒
    #    hc[1]==hc[1] 恒真 → 完美恒「入主」;|1-1|=0 → 相位恒「合」。
    #    而前端默认问类正是 custom,故**开箱即坏**(300 盘全同)。今许手选所问宫破此死局。
    t_house = corr.question_house(question_type)
    if quesited_house is not None:
        try:
            qh = int(quesited_house)
            if 1 <= qh <= 12:
                t_house = qh
        except (TypeError, ValueError):
            pass
    # 退化:问者宫与所问宫重合时,完美/相位在数学上恒成立,不具判别力 —— 如实标注供界面提示。
    indicators_coincide = (q_house == t_house)

    # 调和者:两法同为异或,仅第二操作数不同(首母 / 问者指示星)。
    # ⚠️ 数学事实:顺铺投影下宫一所盛正是首母,故未转宫时两法**必然同值**(3000 盘零反例)。
    #    为免此选项对用户成为「怎么切都不变」的死开关,问者指示星一法在**转宫时以转宫所指之宫**
    #    为问者宫取图 —— 转宫后问者指示星本就应随之易主,此为语义正解,两法由此真正分野。
    turn_i = None
    if turn_to is not None:
        try:
            turn_i = max(1, min(12, int(turn_to)))
        except (TypeError, ValueError):
            turn_i = None
    recon_house = (turn_i or q_house) if g_rmode == "judge_querent_significator" else None
    recon_other = hc[recon_house] if recon_house else s.mothers[0]
    recon_fig = reconciler_from(s.judge, recon_other)
    # 两法同值时如实告知,免得用户以为开关坏了。
    recon_coincides = (g_rmode == "judge_querent_significator"
                       and recon_other == s.mothers[0])

    # 指示星角色 + 十二宫断语
    houses = []
    for h in range(1, 13):
        f = hc[h]
        role = []
        if h == q_house:
            role.append("querent")
        if h == t_house:
            role.append("quesited")
        hr = corr.house_reading(name(f), h)
        houses.append({
            "house": h, "meaning": corr.house_meaning(h),
            "figure": _fig_obj(f, g_nums, g_names), "roles": role,
            "reading": hr.get("reading") if hr else None,
            # 东传一支叠加层**带宫号**:图对象那份只有曜与星座(vedic_overlay 不给宫则无 bhava),
            # 故宫位之支名此前无处可取 —— 而 AI 口径已承诺给出,等于让模型据不存在的字段臆造。
            "vedic": vedic_overlay(f, house=h),
        })

    # 定局落星:甲=图形所主之宫;乙=每星另起四行点数定宫(**独立子 rng,不污染盘 rng**)
    # 🔴 旧码此处两处旁路,合起来使「定局法」成了死开关:
    #    ① 甲法**无条件**计算(压根不看 g_proj)→ 选「顺铺」与选「甲」输出恒等;
    #    ② `or scope == "L4"` **无视用户选择**恒算乙 → L4 档下三态指纹全同。
    #    今改为按所选之法门控:顺铺=不做占星定局(不落星)、甲=只产甲、乙=只产乙。
    #    唯一保留的兜底:L4 本就是「占星定局」档,用户**未显式指定**时给主流甲法,免得该档空无落星。
    #    丁法(真实星历)另须所问之时地,缺则如实回落甲法并在 astro_erection 标出原因。
    # ⚠️ 真实盘**只在真被选用时才算**:如此则未选此二档者一个新键都不多、一次星历都不查(字节零回归),
    #    且星历为纯函数不动 rng,故插在此处不影响后续任何随机取值之次序。
    real_chart = None
    if g_asc == "real_chart" or g_proj == "real_ephemeris":
        if jd is not None and geo_lon is not None and geo_lat is not None:
            real_chart = real_erection(jd, geo_lat, geo_lon, g_hsys)

    planets = None
    planets_by12 = None
    planets_real = None
    if g_proj == "astro_from_chart":
        planets = astro_place_planets_from_chart(hc)
    elif g_proj == "astro_bytwelves":
        sub = random.Random(rng.getrandbits(64))
        planets_by12 = astro_place_planets_bytwelves(sub)
    elif g_proj == "real_ephemeris":
        planets_real = (astro_place_planets_real(jd, real_chart["cusps"])
                        if (real_chart and real_chart.get("cusps")) else None)
        if planets_real is None:
            planets = astro_place_planets_from_chart(hc)     # 时地不可用即如实回落甲法
    elif scope == "L4" and house_projection not in HOUSE_PROJECTIONS:
        planets = astro_place_planets_from_chart(hc)

    halted = g_halt and name(s.mothers[0]) in (prof.get("halt_on_first_mother") or [])
    rd = {
        "perfection": R.perfection(hc, q_house, t_house, g_wrap),
        "perfection_by_aspect": R.perfection_by_aspect(hc, q_house, t_house, g_wrap),
        "aspect": R.aspect(q_house, t_house),
        "prohibition": R.prohibition(hc, q_house, t_house, g_wrap),
        "company": [{"pair": list(p), "type": R.company(hc, p[0], p[1], g_comp)} for p in R.PAIRED_HOUSES],
        "points_parity": R.points_parity(hc, s, g_parity),
        "timing": R.timing(hc, t_house),
        "triplicities": R.triplicities(t_house),
        "via_puncti": R.via_puncti(s),
        # 注:paternitas(嵌套亲缘树)与 shield_triads(七组扁平「父·父→子」)同源同义,
        #     显示层只消费后者。两份一起传等于每盘白传一棵树,故此处不再出参;
        #     R.paternitas 函数与其单测保留(仍是内核可自证之能力,他处需要时可直接调)。
        "natural_cosignificator": R.natural_cosignificator(s.judge),
        # 古典判据补齐:位置吉凶 / 图之重现 / 盾牌生成三元组 / 完美之中介
        "locus_querent": R.locus(hc, q_house),
        "locus_quesited": R.locus(hc, t_house),
        "motus": R.motus(hc),
        "shield_triads": R.shield_triads(s),
        "perfection_detail": R.perfection_detail(hc, q_house, t_house, g_wrap),
        # 注:此前尚有 derived_house_example(问者宫+所问宫的转宫示例),已被下方 `derived` 块
        #     (真转宫重算:派生指示/完美/相位/阻碍/应期/宫图)完全取代,且全仓零消费方 —— 已删。
        # ── 传本对齐补齐(既有各键形态一字未动,此下皆新键)──
        "perfection_direction": R.perfection_direction(hc, q_house, t_house, g_wrap),
        "court_verdict": R.court_verdict(s),
        "time_flow": R.time_flow(s),
        "validity": R.validity(s, hc, q_house, t_house, g_wrap),
        "tenancy": R.tenancy(s, recon_fig if g_recon else None),
        "via_elements": R.via_elements(s),
        "success": R.success(hc, q_house, t_house, g_wrap),
        "greek_points": R.greek_points(hc),
        "shield_triangles": R.shield_triangles(s),
        "reconciler_parity": R.reconciler_parity(recon_fig if g_recon else None),
    }
    # 元素法须用寻源四线之终点判自给/借贷,故排在其后
    rd["element_supply"] = R.element_supply(s, rd["via_elements"])

    # 转宫:以所指之宫为新命宫重算指示与完美(转宫本身早有,此处补交互重算)
    derived_block = None
    if turn_i:
        tt = turn_i
        if tt:
            dq = tt
            dt = derived_house(tt, t_house)
            derived_block = {
                "turn_to": tt, "derived_querent_house": dq, "derived_quesited_house": dt,
                "perfection": R.perfection(hc, dq, dt, g_wrap),
                "perfection_by_aspect": R.perfection_by_aspect(hc, dq, dt, g_wrap),
                "aspect": R.aspect(dq, dt),
                "prohibition": R.prohibition(hc, dq, dt, g_wrap),
                "timing": R.timing(hc, dt),
                "figure": _fig_obj(hc[dt], g_nums, g_names),
            }

    settings = {
        "mark_style": g_mark, "direction": g_dir, "house_projection": g_proj,
        "wrap_houses": g_wrap, "reconciler": g_recon, "reconciler_mode": g_rmode,
        "halt_enabled": g_halt, "compound_mode": g_comp, "number_system": g_nums,
        "chart_mode": g_chart, "cast_method": cm,
        "house_system": g_hsys, "asc_source": g_asc, "names_system": g_names,
        "parity_scope": g_parity, "house_placement": g_place,
        "cast_numbers": cast_nums,
        "planetary_chart": g_pchart, "planetary_chart_zodiac": g_pczod,
        "planetary_chart_nodes": g_pcnodes, "planetary_chart_extras": g_pcextras,
        "quesited_house": t_house,
        "quesited_house_explicit": quesited_house is not None and t_house == quesited_house,
        # 问者宫与所问宫重合 → 完美/相位恒成立,界面须显式标注「不具判别力」,
        # 否则用户看到的是「怎么起盘都入主·合」,会以为算法坏了。
        "indicators_coincide": indicators_coincide,
        "reconciler_house": recon_house,
        # 未转宫时问者宫为一、其所盛正是首母,两法必然同值 —— 如实回传,界面据此说明,
        # 免得用户以为开关失灵。转宫后即分野。
        "reconciler_modes_coincide": recon_coincides,
    }
    # 真实星历盘之实况:**只在用户真选了此二档时才添此二键**,故未选者 settings 字节零变。
    # 有此二键界面才能如实说「已按所选时地起真实盘」或「时地缺失,已回落图形取法」,不至于静默变脸。
    if g_asc == "real_chart" or g_proj == "real_ephemeris":
        settings["real_chart_requested"] = True
        settings["real_chart_available"] = real_chart is not None

    out = {
        "profile": prof, "zodiac_system": zsys, "reading_scope": scope, "settings": settings,
        "question_type": question_type, "querent_house": q_house, "quesited_house": t_house,
        "ascendant_sign": ascendant_sign(hc, zsys),
        "mothers": [_fig_obj(f, g_nums, g_names) for f in s.mothers],
        "daughters": [_fig_obj(f, g_nums, g_names) for f in s.daughters],
        "nieces": [_fig_obj(f, g_nums, g_names) for f in s.nieces],
        "right_witness": _fig_obj(s.right_witness, g_nums, g_names),
        "left_witness": _fig_obj(s.left_witness, g_nums, g_names),
        "judge": _fig_obj(s.judge, g_nums, g_names),
        "reconciler": _fig_obj(recon_fig, g_nums, g_names) if g_recon else None,
        "halted_on_first_mother": halted,
        "houses": houses,
        "astro_erection": (lambda _a: {**_a, **house_signs(
            _a["sign"], g_hsys, real_chart if _a.get("asc_source") == "real_chart" else None)})(
            ascendant_from_source(hc, zsys, g_asc, random.Random(rng.getrandbits(64)), s.judge,
                                  real_chart)),
        "planet_placement": planets,
        "planet_placement_by_twelves": planets_by12,
        "reading": rd,
        "derived": derived_block,
    }

    # 真实星历落星:与行星地占盘同法只在真用时出键 —— 未选此档者响应字节零变。
    if planets_real is not None:
        out["planet_placement_real"] = planets_real
        out["real_chart"] = {
            "asc_lon": real_chart.get("asc_lon"), "mc_lon": real_chart.get("mc_lon"),
            "cusps": [round(float(c), 4) for c in real_chart.get("cusps") or []],
            "quadrant_system": real_chart.get("quadrant_system"),
        }

    # 行星地占盘:自成一盘(上升取首图之星座、七政各以报数落宫),与盾牌落星正交并存。
    # ⚠️ 子 rng 必取在 astro_erection 之后 —— 关此开关则一颗随机数不取,故开关关闭时全响应字节零变。
    if g_pchart:
        out["planetary_chart"] = build_planetary_chart(
            s.mothers[0], random.Random(rng.getrandbits(64)), g_pczod, g_pcnodes, g_pcextras)

    if g_chart == "buyut":
        b = house_chart_buyut(s)
        out["buyut"] = {
            "read_order": b["read_order"],
            "daira_order": b["daira_order"],
            "overview": [
                {"role": r, "figure": _fig_obj(f, g_nums, g_names)}
                for r, f in zip(b["overview_roles"], b["overview"])
            ],
            "note": "前十二图入十二宫,余四图作总览;宫序自右向左读。",
        }

    if g_chart == "sikidy":
        col = cast_sikidy(rng)
        meta = corr.sikidy_meta()
        out["sikidy"] = {
            "columns": {str(i): {"name": SIKIDY_COL_NAMES[i], "rows": list(col[i]),
                                 "figure": name(col_to_figure(col[i])),
                                 "role": (meta.get(str(i)) or {}).get("role"),
                                 "meaning": (meta.get(str(i)) or {}).get("meaning")} for i in range(1, 17)},
            "valid": sikidy_valid(col), "valid_check2b": check2b(col),
            "red_sikidy": red_sikidy(col),
            "tokan": tokan_sikidy(col), "quadrants": quadrants(col),
            # 列比对:问者列(1)对各主题列,同列即断(如与造物主列同主愈、与诸灵列同主灵扰)
            "compare": {str(b): column_compare(col, 1, b) for b in range(2, 17)},
            **princes_slaves(col),
        }

    if g_chart == "hakata":
        out["hakata"] = cast_hakata(rng)

    if g_chart == "ifa":
        blk = cast_ifa(rng, "opele")
        blk["figure_right"] = _fig_obj(blk["right"]["figure_int"], g_nums, g_names)
        blk["figure_left"] = _fig_obj(blk["left"]["figure_int"], g_nums, g_names)
        out["ifa"] = blk
        out["cultural_notice"] = IFA_NOTICE
        # 结构对照模式:不套地占判读,关完美/相位等赋义卡
        out["structural_only"] = True
        out["reading"] = {"structural_only": True, "note": "结构对照模式不产出地占判读。"}

    return out
