"""天文地占 web 服务。

调本仓纯内核 ``astrostudy.geomancy``(16 图不可变内核 + 可插拔流派 Profile),
覆盖盾牌盘 / 宫位盘(图形入宫)/ 占星定局 / 可计算读法 / Sikidy 异或表盘 / 多流派对应。
确定性:castMethod='manual' + seed 复现同盘。返回超集 JSON(旧字段兼容 + 新内核富数据)。
"""

import secrets
import traceback
from numbers import Integral, Real

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain

from astrostudy.geomancy import chart as geo_chart
from astrostudy.geomancy import correspondences as geo_corr
from astrostudy.geomancy.figures import (inverse, name as fig_name, opposite as fig_opposite,
                                         points, reverse, rotate as fig_rotate)
from astrostudy.geomancy.traditions import PROFILES
from astrostudy.geomancy.random_source import normalize_cast_method
from astrostudy.geomancy.ifa import odu_of as geo_odu_of
from astrostudy.geomancy.numbers import all_numbers as geo_all_numbers, figure_number as geo_figure_number
from astrostudy.geomancy.figures import is_palindrome as geo_is_palindrome, active_elements as geo_active_elements
from astrostudy.geomancy.vedic import vedic_overlay as geo_vedic

# 种子上界:与前端 InputNumber max 对齐(int32 正区间),保证回传种子可手填复现。
_SEED_MAX = 2147483647

# 黄道星座中文
_SIGN_ZH = {
    "Aries": "白羊", "Taurus": "金牛", "Gemini": "双子", "Cancer": "巨蟹", "Leo": "狮子",
    "Virgo": "处女", "Libra": "天秤", "Scorpio": "天蝎", "Sagittarius": "射手",
    "Capricorn": "摩羯", "Aquarius": "水瓶", "Pisces": "双鱼",
}
# 问类(11)→中文 + 主宫(对齐内核 question_house)
_QTYPES = [
    ("life", "命主/性格"), ("health", "疾病/健康"), ("wealth", "财富"), ("marriage", "婚姻/合伙"),
    ("career", "事业/名誉"), ("children", "子女/恋爱"), ("journey", "远行"), ("religion", "宗教/学问"),
    ("enemy", "对手/暗敌"), ("death", "死亡/遗产"), ("custom", "自定/综合"),
]


def _to_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def _clean(value, default=""):
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _sanitize_question(value):
    text = _clean(value)
    return text.replace("<", "").replace(">", "").replace("&", "＆")[:200]


def _json_safe(value):
    if isinstance(value, dict):
        return {_clean(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, Integral) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, Real) and not isinstance(value, bool):
        return float(value)
    return value


def _fig_dict(f, zodiac_system="classical"):
    """内核图形对象 → 前端超集(旧字段 nameEn/nameZh/dots/element*/planet*/sign*/quality*/keywords* 兼容 + 新字段透传)。"""
    if not f:
        return None
    # 黄道三套并存:古典定局 / 行星归属 / 行星归属·乙(另一传本表)。
    # 非 classical 且非 planetary_alt 者回落行星归属 —— 与三套并存前的历史分支一致(零回归)。
    if zodiac_system == "classical":
        sign = f.get("zodiac_classical")
    elif zodiac_system == "planetary_alt":
        sign = f.get("zodiac_planetary_alt") or f.get("zodiac_planetary")
    else:
        sign = f.get("zodiac_planetary")
    sign = (sign or "").rstrip("?")

    def _zt(key):
        s = (f.get(key) or "").rstrip("?")
        return {"en": s, "zh": _SIGN_ZH.get(s, s)} if s else None

    return {
        "nameEn": f.get("latin"), "nameZh": f.get("name_zh"),
        "dots": list(f.get("bits") or []),
        "element": f.get("element_inner"), "elementZh": f.get("element_inner_zh"),
        "planet": f.get("planet"), "planetZh": f.get("planet_zh"),
        "sign": sign, "signZh": _SIGN_ZH.get(sign, sign),
        "quality": f.get("quality"), "qualityZh": f.get("quality_zh"),
        "keywordsZh": f.get("nature"), "keywordsEn": "",
        # 新内核字段(WP-1/2):
        "points": f.get("points"), "tone": f.get("tone"),
        "elementOuter": f.get("element_outer"), "elementOuterZh": f.get("element_outer_zh"),
        "direction": f.get("direction"), "partiality": f.get("partiality"),
        "bodyPart": f.get("body_part"), "color": f.get("color"), "humor": f.get("humor"),
        "unicode": f.get("unicode"), "nameArabic": f.get("name_arabic"), "nameYoruba": f.get("name_yoruba"),
        "nameGreek": f.get("name_greek"), "nameHebrew": f.get("name_hebrew"),
        "meanings": f.get("meanings"),
        "reverseOf": f.get("reverse_of"), "inverseOf": f.get("inverse_of"),
        # 全流派补齐新增字段(必须显式拷:不拷则前端恒缺)
        "converseOf": f.get("converse_of"),
        "nameArabicScript": f.get("name_arabic_script"),
        "directionCompass": f.get("direction_compass"),
        "numbers": _json_safe(f.get("numbers")) if f.get("numbers") else None,
        "number": _json_safe(f.get("number")) if f.get("number") else None,
        "odu": _json_safe(f.get("odu")) if f.get("odu") else None,
        # 收尾补齐新增字段(必须显式拷:不拷则前端恒缺)
        "displayName": f.get("display_name"),
        "namesSystem": f.get("names_system"),
        "isPalindrome": f.get("is_palindrome"),
        "activeElements": _json_safe(f.get("active_elements")) if f.get("active_elements") else None,
        "vedic": _json_safe(f.get("vedic")) if f.get("vedic") else None,
        # 传本对齐新增字段(必须显式拷:不拷则前端恒缺 —— 本文件历来之坑)
        "toneBook": f.get("tone_book"),
        "qualityBook": f.get("quality_book"),
        "imageryZh": f.get("imagery_zh"),
        "bodyDetailZh": f.get("body_detail_zh"),
        "kabbalah": list(f.get("kabbalah") or []) or None,
        "oppositeOf": f.get("opposite_of"),
        "rotateOf": f.get("rotate_of"),
        # 三套黄道并显(目录卡「双黄道」之补:古典 / 行星归属 / 行星归属·乙)
        "zodiacTriple": {"classical": _zt("zodiac_classical"),
                         "planetary": _zt("zodiac_planetary"),
                         "planetaryAlt": _zt("zodiac_planetary_alt")},
    }


def _figure_catalog(zodiac_system="classical", number_system="points", names_system="latin"):
    """十六图目录。除旧有字段外补:逆反名 / 三系图数(按当前体系取一) / 对应主形 ——
    目录卡与盘面图形走的是两条组装路径,此处不补则目录永远缺这几项(与盘面不一致)。"""
    cat = geo_corr.catalog()
    out = []
    for v in cat.values():
        i = v["int"]
        e = geo_odu_of(i)
        out.append(_fig_dict({
            **v, "points": points(i),
            "reverse_of": fig_name(reverse(i)), "inverse_of": fig_name(inverse(i)),
            "converse_of": fig_name(reverse(inverse(i))),
            # 关系六式之余二(目录与盘面两条组装路径,此处不补则目录恒缺)
            "opposite_of": fig_name(fig_opposite(i)), "rotate_of": fig_name(fig_rotate(i)),
            "numbers": geo_all_numbers(i),
            "number": geo_figure_number(i, number_system),
            "odu": ({"name": e["name"], "seniority": e["seniority"], "marks": list(e["marks"])} if e else None),
            "is_palindrome": geo_is_palindrome(i),
            "active_elements": geo_active_elements(i),
            "vedic": geo_vedic(i),
            "display_name": (v.get({"latin": "latin", "arabic": "name_arabic", "greek": "name_greek",
                                    "hebrew": "name_hebrew", "yoruba": "name_yoruba"}.get(names_system, "latin"))
                             or v.get("latin")),
            "names_system": names_system,
        }, zodiac_system))
    return out


def _build_response(r, seed=None):
    """内核 compute_reading 结果 → 前端超集响应。

    seed:本盘实际用于起卦的确定性种子(manual=输入种子;random/time=服务端生成)。
    回传给前端供「锁定复现 / 历史回放 / AI 快照」一致复现同盘。
    """
    zsys = r.get("zodiac_system", "classical")
    mothers = [_fig_dict(f, zsys) for f in r["mothers"]]
    daughters = [_fig_dict(f, zsys) for f in r["daughters"]]
    nieces = [_fig_dict(f, zsys) for f in r["nieces"]]
    rw = _fig_dict(r["right_witness"], zsys)
    lw = _fig_dict(r["left_witness"], zsys)
    judge = _fig_dict(r["judge"], zsys)
    recon = _fig_dict(r["reconciler"], zsys) if r.get("reconciler") else None
    figures16 = mothers + daughters + nieces + [rw, lw, judge] + ([recon] if recon else [])
    # 🔴 十二宫星座取**定局所得**(自上升起顺铺),不是 house_meanings 里写死的自然星座。
    #    写死的 1=白羊…12=双鱼 是合法参考数据(次要判断用),但把它当定局结果画在盘上,
    #    会与盘心「上升 X」自相矛盾 —— 定局既已算出(astro_erection.signs),此处必须取之。
    erection = r.get("astro_erection") or {}
    sign_by_house = {int(x["house"]): x for x in (erection.get("signs") or [])}
    houses = []
    for h in r["houses"]:
        hm = h.get("meaning") or {}
        nat = hm.get("sign") or ""
        rot = sign_by_house.get(int(h["house"])) or {}
        sign = rot.get("sign") or nat                       # 定局星座优先;无定局块时退回自然星座
        houses.append({
            "house": h["house"], "figure": _fig_dict(h["figure"], zsys),
            "roles": h.get("roles", []), "reading": h.get("reading"),
            "nameZh": hm.get("latin"), "topicsZh": hm.get("theme"),
            "topicsDetailZh": hm.get("theme_detail"),
            "sign": sign, "signZh": rot.get("sign_zh") or _SIGN_ZH.get(sign, sign),
            "naturalSign": nat, "naturalSignZh": _SIGN_ZH.get(nat, nat),
            "ruler": hm.get("ruler"), "element": hm.get("element"),
            # 宫位之东传支名:数据表本有 bhava 一列,却从未挂到宫上 —— 补出,免得 AI 据承诺而无据。
            "bhava": (h.get("vedic") or {}).get("bhava_sanskrit"),
            "bhavaZh": (h.get("vedic") or {}).get("bhava_zh"),
        })
    # 盘心「上升」与宫一星座必须同源:定局块的上升(随 asc_source 取法而变)才是本盘真上升。
    # 缺省取法 h1_figure 下二者恒等,故此改动在默认路径上字节零回归。
    asc_sign = erection.get("sign") or r.get("ascendant_sign") or ""
    reading = {
        "questionType": r.get("question_type"), "primaryHouse": r.get("quesited_house"),
        "querentHouse": r.get("querent_house"),
        "ascendantSign": asc_sign,
        "ascendantSignZh": erection.get("sign_zh") or _SIGN_ZH.get(asc_sign, asc_sign),
        "ascendantSignH1": r.get("ascendant_sign"),   # 第一宫图之星座(取法甲),留档不丢
        "ascendantFigure": mothers[0] if mothers else None,
        "zodiacSystem": zsys, "readingScope": r.get("reading_scope"),
        "haltedOnFirstMother": r.get("halted_on_first_mother"),
        "motherFigures": mothers, "daughterFigures": daughters, "nieceFigures": nieces,
        "rightWitness": rw, "leftWitness": lw,
        "figures16": figures16, "judge": judge, "reconciler": recon,
        "houses": houses,
        "technique": _json_safe(r.get("reading") or {}),
        "planetPlacement": _json_safe(r.get("planet_placement") or {}),
        "profileId": (r.get("profile") or {}).get("id"),
    }
    if seed is not None:
        reading["seed"] = int(seed)
    # 全流派补齐新增块(显式拷贝,缺一则前端该功能空转)
    reading["settings"] = _json_safe(r.get("settings") or {})
    if r.get("astro_erection"):
        reading["astroErection"] = _json_safe(r["astro_erection"])
    if r.get("planet_placement_by_twelves"):
        reading["planetPlacementByTwelves"] = _json_safe(r["planet_placement_by_twelves"])
    if r.get("derived"):
        reading["derived"] = _json_safe(r["derived"])
    if r.get("planetary_chart"):
        reading["planetaryChart"] = _json_safe(r["planetary_chart"])
    if r.get("buyut"):
        reading["buyut"] = _json_safe(r["buyut"])
    if r.get("sikidy"):
        reading["sikidy"] = _json_safe(r["sikidy"])
    if r.get("hakata"):
        reading["hakata"] = _json_safe(r["hakata"])
    if r.get("ifa"):
        reading["ifa"] = _json_safe(r["ifa"])
    if r.get("cultural_notice"):
        reading["culturalNotice"] = r["cultural_notice"]
    if r.get("structural_only"):
        reading["structuralOnly"] = True
    return reading


class GeomancySrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def reading(self, **params):
        enable_crossdomain()
        try:
            if cherrypy.request.method == "OPTIONS":
                return jsonpickle.encode({"ResultCode": 0, "Result": "ok"}, unpicklable=False)
            data = dict(params or {})
            data.update(getattr(cherrypy.request, "json", None) or {})

            question = _sanitize_question(data.get("question"))
            question_type = _clean(data.get("questionType") or data.get("question_type"), "custom")
            valid_q = {k for k, _ in _QTYPES}
            if question_type not in valid_q:
                question_type = "custom"
            # 起卦:新参 castMethod 优先,回退旧 seedMode(random/time_seed/manual)。
            cast_method = _clean(data.get("castMethod"), "") or {
                "manual": "manual", "time_seed": "time", "random": "rng",
            }.get(_clean(data.get("seedMode") or data.get("seed_mode"), "random"), "rng")
            cast_method = normalize_cast_method(cast_method)
            manual_seed = _to_int(data.get("seed") or data.get("manualSeed"), None)
            time_seed = _to_int(data.get("timeSeed"), None)
            # 落定一个确定性 int 种子:manual=输入(缺省 0);time=优先 timeSeed,缺则真随机生成;
            # random/皮肤(dice/sand/coins/tablets)=有显式 seed 则用,否则真随机生成。
            # 三者都成确定 int 再喂内核 → random/time 也可复现,且把实际种子回传前端。
            if cast_method == "manual":
                effective_seed = manual_seed if manual_seed is not None else 0
            elif cast_method == "time":
                effective_seed = time_seed if time_seed is not None else secrets.randbelow(_SEED_MAX + 1)
            else:
                effective_seed = manual_seed if manual_seed is not None else secrets.randbelow(_SEED_MAX + 1)
            # 按内核 make_rng 取值优先级喂入:time 模式走 time_seed,其余走 seed。
            kernel_seed = None if cast_method == "time" else effective_seed
            kernel_time_seed = effective_seed if cast_method == "time" else None
            profile_id = _clean(data.get("tradition") or data.get("profile"), "european_classical")
            if profile_id not in PROFILES:
                profile_id = "european_classical"
            zodiac_system = _clean(data.get("zodiacSystem"), "") or None
            reading_scope = _clean(data.get("readingScope"), "") or None

            # 传本粒度覆盖:一律「未传=None → 内核回落 profile 值」,故旧客户端字节零变。
            def _opt(key, alt=None):
                v = data.get(key)
                if v is None and alt:
                    v = data.get(alt)
                v = _clean(v, "")
                return v or None

            def _optb(key):
                v = data.get(key)
                if v is None or v == "":
                    return None
                if isinstance(v, bool):
                    return v
                return str(v).strip().lower() in ("1", "true", "yes", "on")

            turn_to = _to_int(data.get("turnTo"), None)
            # 报数起卦:十六个数(奇=单点/偶=双点)。非十六个或含非数即弃,由内核回落随机源并如实回传。
            cast_numbers = data.get("castNumbers")
            if isinstance(cast_numbers, str):
                cast_numbers = [x for x in cast_numbers.replace(",", " ").replace("，", " ").split() if x]
            if isinstance(cast_numbers, (list, tuple)):
                try:
                    nums = [int(x) for x in cast_numbers]
                    cast_numbers = nums if len(nums) == 16 and all(n >= 1 for n in nums) else None
                except (TypeError, ValueError):
                    cast_numbers = None
            else:
                cast_numbers = None
            r = geo_chart.compute_reading(
                question_type=question_type, profile_id=profile_id,
                cast_method=cast_method, seed=kernel_seed, time_seed=kernel_time_seed,
                reading_scope=reading_scope, zodiac_system=zodiac_system,
                mark_style=_opt("markStyle"), direction=_opt("direction"),
                house_projection=_opt("houseProjection"), wrap_houses=_optb("wrapHouses"),
                reconciler=_optb("reconciler"), reconciler_mode=_opt("reconcilerMode"),
                halt_enabled=_optb("haltEnabled"), compound_mode=_opt("compoundMode"),
                number_system=_opt("numberSystem"), chart_mode=_opt("chartMode"),
                turn_to=turn_to,
                house_system=_opt("houseSystem"), asc_source=_opt("ascSource"),
                names_system=_opt("namesSystem"),
                # 所问宫:显式指定优先于问类查表(问类只是快捷预设,不是真值源)
                quesited_house=_to_int(data.get("quesitedHouse"), None),
                parity_scope=_opt("parityScope"),
                # 传本对齐新增:图形入宫三式 / 报数起卦 / 行星地占盘(开关+星座表+交点+可选加星)
                house_placement=_opt("housePlacement"),
                cast_numbers=cast_numbers,
                planetary_chart=_optb("planetaryChart"),
                planetary_chart_zodiac=_opt("planetaryChartZodiac"),
                planetary_chart_nodes=_optb("planetaryChartNodes"),
                planetary_chart_extras=_optb("planetaryChartExtras"),
            )
            reading = _build_response(r, seed=effective_seed)
            reading["question"] = question
            zsys = reading["zodiacSystem"]
            result = {
                "reading": _json_safe(reading),
                "squareSvg": "", "wheelSvg": "",   # 前端用原生暗金盘,不取引擎 SVG
                "figures": _figure_catalog(zsys, (r.get("settings") or {}).get("number_system", "points"),
                                           (r.get("settings") or {}).get("names_system", "latin")),
                "questionTypes": [{"key": k, "label": lb, "primaryHouse": geo_corr.question_house(k)} for k, lb in _QTYPES],
                "traditions": [{"id": pid, "label": p.get("label", pid)} for pid, p in PROFILES.items()],
                "aiPrompt": "",
            }
            return jsonpickle.encode({"ResultCode": 0, "Result": result}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "geomancy calculation failed"}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def catalog(self, **params):
        """切流派即时刷新 16 图目录(随黄道体系)。"""
        enable_crossdomain()
        try:
            if cherrypy.request.method == "OPTIONS":
                return jsonpickle.encode({"ResultCode": 0, "Result": "ok"}, unpicklable=False)
            data = dict(params or {})
            data.update(getattr(cherrypy.request, "json", None) or {})
            profile_id = _clean(data.get("tradition") or data.get("profile"), "european_classical")
            prof = PROFILES.get(profile_id, PROFILES["european_classical"])
            zsys = _clean(data.get("zodiacSystem"), "") or prof.get("zodiac_system", "classical")
            # 目录端点无盘上下文,图数体系取显式入参,缺则回落该流派默认(再缺=点数)。
            nsys = _clean(data.get("numberSystem"), "") or prof.get("number_system") or "points"
            namesys = _clean(data.get("namesSystem"), "") or prof.get("names") or "latin"
            result = {"figures": _figure_catalog(zsys, nsys, namesys),
                      "traditions": [{"id": pid, "label": p.get("label", pid)} for pid, p in PROFILES.items()]}
            return jsonpickle.encode({"ResultCode": 0, "Result": result}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "geomancy catalog failed"}, unpicklable=False)
