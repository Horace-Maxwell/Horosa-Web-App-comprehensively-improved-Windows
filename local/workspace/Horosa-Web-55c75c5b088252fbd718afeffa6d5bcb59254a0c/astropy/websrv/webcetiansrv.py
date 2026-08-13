import traceback

import cherrypy
import jsonpickle

# 策天飞星已重写为自有引擎(astrostudy.cetian_ziwei),通用序列化辅助走自有 horosa_engine_common,
# 不再依赖 kentang/kinastro 框架(引擎已从 vendor/kinastro 摘出)。
from websrv.helper import enable_crossdomain
from websrv.horosa_engine_common import (
    build_snapshot,
    clean_text,
    coord_to_float,
    gender_cn,
    json_safe,
    parse_datetime,
    row,
    timezone_to_float,
)

from datetime import datetime

from astrostudy.cetian_ziwei import (
    CETIAN_18_FLYING_STARS,
    CETIAN_AUX_STAR_NAMES,
    CETIAN_FLYING_RULES,
    CETIAN_MAIN_STAR_NAMES,
    CETIAN_PATTERNS,
    CETIAN_SIHUA_TABLE,
    CETIAN_STAR_ATTRIBUTES,
    CETIAN_STAR_LORE,
    EARTHLY_BRANCHES,
    HEAVENLY_STEMS,
    HOUR_BRANCH_NAMES,
    LUNAR_MONTH_NAMES,
    WU_XING_JU_NAMES,
    compute_cetian_ziwei_chart,
)
from astrostudy.cetian_yiyu import (
    collect_xingge_verses,
    compute_bianyao,
    compute_nayin,
    compute_yinyang_gong,
    compute_huizhao,
    compute_liunian,
    compute_shensha,
    compute_xiu,
    compute_yunxian,
    compute_zayao,
    match_duanjue,
    ruyuan_month_row,
)
from astrostudy.cetian_yiyu_data import YIYU_XIU_FENYE
from astrostudy.cetian_yiyu_texts import YIYU_TEXTS

# 僧道起法宮名(移語本「僧道起法」節,按書法宮序同位替換;僅顯示層,判定層恆用通行宮名)。
MONK_PALACE_NAMES = [
    "命宮", "衣鉢宮", "徒弟宮", "本師宮", "小師宮", "人刀宮",
    "僧道宮", "疾厄宮", "遊行宮", "師號宮", "福德宮", "相品宮",
]


def _day_to_chinese(day):
    # 完整农历日名:初一..初十 / 十一..十九 / 二十 / 廿一..廿九 / 三十(自带「初」,调用处勿再加)。
    units = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
    if day <= 10:
        return f"初{units[day]}"
    if day < 20:
        return f"十{units[day - 10]}"
    if day == 20:
        return "二十"
    if day < 30:
        return f"廿{units[day - 20]}"
    return "三十"


def _palace_rows(palace, show_brightness=True, show_sihua=True, show_flying=True, extra=None):
    # 书法无宫干/四化/飞星/格局(留空不显示);原法(kentang)有,则随数据出现。
    # show_* 仅过滤显示行,不改既有计算;默认全显=现状(零回归)。
    # extra(仅书法): {zayao_by_branch, liunian_by_branch, huizhao_per_palace, xian_by_branch} 增行。
    stem = palace.get("stem_name") or ""
    rows = [
        row("宫名", palace.get("name")),
        row("干支" if stem else "地支", f"{stem}{palace.get('branch_name')}"),
        row("正曜", palace.get("stars")),
        row("副曜", palace.get("aux_stars")),
    ]
    if show_brightness:
        rows.append(row("亮度", palace.get("brightness")))
    branch = palace.get("branch")
    if extra:
        zy = (extra.get("zayao_by_branch") or {}).get(branch)
        if zy:
            rows.append(row("杂曜", zy))
        xian = (extra.get("xian_by_branch") or {}).get(branch)
        if xian:
            rows.append(row("大限", f"{palace.get('da_xian')}·{xian['xian_name']}·步位{xian['buwei']}"
                            + ("·忌限" if xian.get("ji") else "")))
        else:
            rows.append(row("大限", palace.get("da_xian")))
        ln = (extra.get("liunian_by_branch") or {}).get(branch)
        if ln:
            rows.append(row("流年", ln))
        hz = (extra.get("huizhao_per_palace") or {}).get(branch)
        if hz:
            rows.append(row("会照", hz))
    else:
        rows.append(row("大限", palace.get("da_xian")))
    if show_sihua and palace.get("sihua"):
        rows.append(row("四化", palace.get("sihua")))
    if show_flying and palace.get("flying_stars"):
        rows.append(row("飞星", palace.get("flying_stars")))
    if show_flying and palace.get("patterns"):
        rows.append(row("格局", palace.get("patterns")))
    return rows


def _bn(idx):
    return EARTHLY_BRANCHES[idx % 12] if idx is not None else "—"


def _stars_to_branch_text(mapping):
    """{星: 支} → 「星:支宫」压缩文本(按支序)。"""
    return "  ".join(f"{name}:{_bn(b)}" for name, b in mapping.items())


def _build_yiyu_sections(chart, yiyu, show):
    """书法(移语本)增强段。yiyu: pan 计算产物 dict;show: 开关 dict。"""
    sections = []
    liunian = yiyu.get("liunian")
    shensha = yiyu.get("shensha")
    yunxian = yiyu.get("yunxian")
    huizhao = yiyu.get("huizhao")
    xiu = yiyu.get("xiu")
    bianyao = yiyu.get("bianyao")
    zayao = yiyu.get("zayao")
    zayao_notes = yiyu.get("zayao_notes") or {}
    duanjue = yiyu.get("duanjue")

    # 运限(恒出)
    if yunxian:
        rows = []
        for d in yunxian["daxian"]:
            val = f"{d['palace']}({d['branch_name']})·{d['xian_name']}·步位{d['buwei']}"
            if d.get("ji"):
                val += "·忌限"
            rows.append(row(d["range"], val))
        rows.append(row("步位诀", yunxian["buwei_note"]))
        sections.append({"title": "运限", "rows": rows})

        tong = yunxian["tongxian"]
        tong_txt = "  ".join(f"{t['age']}岁{t['palace']}({t['branch_name']})" for t in tong)
        sections.append({"title": "童限", "rows": [
            row("童限十五岁", tong_txt),
            row("起童限诀", "一命二财三疾厄,四妻五福顺行流,六岁却从官禄位,循环十五满童周"),
        ]})

        rows = []
        for x in yunxian["xiongxian"]:
            ages = "/".join(str(a) for a in x["ages"]) if x["ages"] else "—"
            rows.append(row(f"{'/'.join(x['stars'])}({ages}岁)", f"{x['text']}〔{x['hit']}〕"))
        if yunxian["jixian"]:
            rows.append(row("忌限", "、".join(f"{j['branch_name']}限" for j in yunxian["jixian"])
                            + "(大限十二宫生人所值之处)"))
        if rows:
            sections.append({"title": "凶限提示", "rows": rows})

    # 会照(恒出)
    if huizhao:
        sections.append({"title": "会照", "rows": [
            row("四正", [_bn(b) for b in huizhao["sizheng"]]),
            row("三合夹照", [_bn(b) for b in huizhao["sanhe"]]),
            row("对照", _bn(huizhao["duizhao"])),
            row("福分诀", huizhao["note"]),
        ]})

    # 阴阳宫相得(恒出:星之阴阳 vs 宫之阴阳)
    yygong = yiyu.get("yinyang_gong")
    if yygong:
        rows = [row(f"{it['star']}({it['yinyang']}星·{it['branch_name']}{it['gong_yinyang']}宫)", it["verdict"])
                for it in yygong["items"]]
        rows.append(row("通则", yygong["note"]))
        sections.append({"title": "阴阳宫", "rows": rows})

    # 诸星格·星解与运限歌(恒出:只出本盘落宫之星,非全库罗列)
    verses = yiyu.get("xingge_verses")
    if verses:
        rows = []
        for v in verses:
            if v.get("jie"):
                rows.append(row(f"{v['star']}·{v['branch_name']}宫·星解", v["jie"]))
            if v.get("yunxian"):
                rows.append(row(f"{v['star']}·运限歌", v["yunxian"]))
        if rows:
            sections.append({"title": "星解与运限歌", "rows": rows})

    # 流年(showLiunian)
    if liunian and show.get("liunian", True):
        sections.append({"title": "流年飞星", "rows": [
            row("流年", f"{liunian['liunian_year']}年·太岁{_bn(liunian['branch'])}·虚岁{liunian['xu_sui']}"),
            row("主序十二星", _stars_to_branch_text(liunian["zhuxu"])),
            row("飞哭", f"{_bn(liunian['feiku'])}宫"),
            row("小哭", f"{_bn(liunian['xiaoku'])}宫(太岁六合)"),
            row("红鸾天喜", f"红鸾{_bn(liunian['hongluan'])} 天喜{_bn(liunian['tianxi'])}"),
        ]})
        sections.append({"title": "流年七煞", "rows": [
            row("七煞", _stars_to_branch_text(liunian["qisha"])),
            row("三台八座", f"三台{_bn(liunian['santai'])} 八座{_bn(liunian['bazuo'])}"),
            row("起法", "生时法(七煞星逐年飞例/飞星赋)" if liunian["qisha_mode"] != "suishu"
                else "岁数法(起外缠诸星例,一岁一宫)"),
        ]})
        sections.append({"title": "十七飞星", "rows": [
            row(f"{it['star']}({_bn(it['branch'])})", it["text"]) for it in liunian["shiqi"]
        ]})

    # 神煞四表(showShensha)
    if shensha and show.get("shensha", True):
        sections.append({"title": "神煞·岁前", "rows": [
            row(f"{it['name']}({_bn(it['branch'])})", it["text"]) for it in shensha["suiqian"]
        ] + [row("异说", shensha["suiqian_note"])]})
        sections.append({"title": "神煞·岁后", "rows": [
            row(it["name"], _bn(it["branch"]) + (f"({it['note']})" if it["note"] else ""))
            for it in shensha["suihou"]
        ]})
        sections.append({"title": "神煞·年干", "rows": [
            row(f"本命·{it['name']}", _bn(it["branch"])) for it in shensha["niangan_benming"]
        ] + [
            row(f"流年·{it['name']}", _bn(it["branch"])) for it in shensha["niangan_liunian"]
        ]})
        sections.append({"title": "神煞·月煞", "rows": [
            row(f"{it['name']}({_bn(it['branch'])})", it["text"]) for it in shensha["yuesha"]
        ]})

    # 廿八宿/三日宫(showXiu)
    if xiu and show.get("xiu", True):
        sections.append({"title": "三日宫", "rows": [
            row("太阳躔宿", f"{xiu['sun_xiu']}(黄经{xiu['sun_lon']:.2f}°)"),
            row("前三日宫", f"{_bn(xiu['qian_sanri_gong'])}宫·{xiu['qian_sanri_xiu']}(管前四十五年)"),
            row("后三日宫", f"{_bn(xiu['hou_sanri_gong'])}宫·{xiu['hou_sanri_xiu']}(管后四十五年)"),
            row("说明", xiu["note"]),
        ]})
        fenye_rows = []
        for b in range(12):
            f = YIYU_XIU_FENYE[b]
            xiu_txt = " ".join(f"{name}{deg}" for name, deg in f["xiu"])
            fenye_rows.append(row(f"{_bn(b)}·{f['guo']}", f"{f['sign']}·{f['xingci']}·{xiu_txt}·{f['region']}"))
        fenye_rows.append(row("命宫分野", f"{_bn(chart.get('ming_gong_branch'))}·{xiu['ming_fenye']['sign']}({xiu['ming_fenye']['xingci']})"))
        fenye_rows.append(row("身宫分野", f"{_bn(chart.get('shen_gong_branch'))}·{xiu['shen_fenye']['sign']}({xiu['shen_fenye']['xingci']})"))
        sections.append({"title": "廿八宿分野", "rows": fenye_rows})

    # 十干变曜(showBianyao)
    if bianyao and show.get("bianyao", True):
        rows = [row(f"本命·{it['bianyao']}({it['gong']})",
                    it["yao"] + ("·凶" if it["xiong"] else "")) for it in bianyao["benming"]]
        rows += [row(f"流年·{it['bianyao']}({it['gong']})",
                     it["yao"] + ("·凶" if it["xiong"] else "")) for it in bianyao["liunian"]]
        rows += [row(it["name"], it["yao"] + (f"({it['note']})" if it["note"] else ""))
                 for it in bianyao["guanxing"]]
        rows.append(row("解曰", bianyao["jieyue"]))
        sections.append({"title": "十干变曜", "rows": rows})

    # 杂曜(showZaYao)
    if zayao and show.get("zayao", True):
        sections.append({"title": "杂曜", "rows": [
            row(f"{name}({_bn(b)})", zayao_notes.get(name, "")) for name, b in zayao.items()
        ]})

    # 断诀(showDuanjue)
    if duanjue and show.get("duanjue", True):
        sections.append({"title": "断诀", "rows": [
            row(f"{h['group']}·{h['title']}", f"{h['text']}〔{h['source']}〕") for h in duanjue
        ]})

    # 星曜别名志(恒出,进 INTERNAL,AI 快照携带、右栏典籍展示)
    lore_rows = []
    for star, lore in CETIAN_STAR_LORE.items():
        dedi = "".join(_bn(b) for b in lore["dedi"])
        val = f"{lore['yinyang']}·别名{'/'.join(lore['aliases'])}·得地{dedi}"
        if lore.get("shidi"):
            val += f"·失地为{lore['shidi']}"
        lore_rows.append(row(star, val))
    sections.append({"title": "星曜别名", "rows": lore_rows})
    return sections


def _build_sections(pan, show_wu_xing_ju=True, show_sihua=True, show_flying=True, show_brightness=True, show_solar_term=True, yiyu=None, palace_extra=None, show_yiyu=None):
    # show_* 显示开关仅过滤输出段/行,绝不改既有算法;默认全显=现状(字节级零回归)。
    # yiyu/palace_extra/show_yiyu: 书法(移语本)增强层,原法(kentang)恒为 None,零触碰。
    chart = pan.get("cetian", {})
    lunar = pan.get("lunar", {})
    is_kentang = chart.get("method") == "kentang"

    nayin = (yiyu or {}).get("nayin") if isinstance(yiyu, dict) else None
    mingshen_rows = [
        row("农历", lunar.get("text")),
    ] + ([row("纳音", f"{nayin['ganzhi']}·{nayin['wuxing']}")] if nayin and nayin.get("wuxing") else []) + [
        row("时辰", pan.get("hourBranch")),
        row("命宫", pan.get("mingGong")),
        row("身宫", pan.get("shenGong")),
    ]
    if is_kentang and pan.get("wuXingJu") and show_wu_xing_ju:
        mingshen_rows.append(row("五行局", pan.get("wuXingJu")))
    mingshen_rows.append(row("紫微", pan.get("ziwei")))
    if show_solar_term:
        mingshen_rows.append(row("节气", chart.get("solar_term_influence")))

    sections = [
        {
            "title": "起盘",
            "rows": [
                row("起盘时间", f"{pan.get('dateStr', '')} {pan.get('timeStr', '')}".strip()),
                row("时区", f"UTC{pan.get('timezone'):+.1f}"),
                row("经度", pan.get("longitude")),
                row("纬度", pan.get("latitude")),
                row("地点", pan.get("location")),
                row("性别", chart.get("gender")),
                row("阴阳", chart.get("yin_yang")),
                row("算法", "原法·标准紫微" if is_kentang else "书法·策天本法"),
            ],
        },
        {"title": "农历与命身", "rows": mingshen_rows},
    ]
    # 四化/飞星/格局:仅原法(kentang);show_sihua/show_flying 控制是否输出对应段(格局与飞星成对)。
    if is_kentang:
        if show_sihua:
            sections.append({
                "title": "四化",
                "rows": [row(s, h) for s, h in (chart.get("sihua") or {}).items()],
            })
        if show_flying:
            sections.append({
                "title": "飞星",
                "rows": [
                    row(s, f"{EARTHLY_BRANCHES[f.get('from_branch', 0)]} → {EARTHLY_BRANCHES[f.get('to_branch', 0)]}；{f.get('nature')}")
                    for s, f in (chart.get("star_flight") or {}).items()
                ],
            })
            sections.append({
                "title": "格局",
                "rows": [
                    row(it.get("name"), f"{it.get('stars')}；{it.get('meaning')}；{EARTHLY_BRANCHES[it.get('palace_branch', 0)]}宫")
                    for it in (chart.get("active_patterns") or [])
                ],
            })
    if yiyu is not None:
        sections.extend(_build_yiyu_sections(chart, yiyu, show_yiyu or {}))
    for palace in chart.get("palaces", []):
        sections.append({"title": palace.get("name", "宫位"), "rows": _palace_rows(palace, show_brightness, show_sihua, show_flying, extra=palace_extra)})
    sections.append({
        "title": "星曜属性",
        "rows": [row(star, f"{attrs[0]} · {attrs[1]}") for star, attrs in CETIAN_STAR_ATTRIBUTES.items()],
    })
    sections.append({
        "title": "正曜副曜",
        "rows": [row("十二正曜", CETIAN_MAIN_STAR_NAMES), row("七副曜", CETIAN_AUX_STAR_NAMES)],
    })
    if is_kentang:
        if show_sihua:
            sections.append({
                "title": "宫干四化表",
                "rows": [
                    row(HEAVENLY_STEMS[i], {"禄": it[0], "权": it[1], "科": it[2], "忌": it[3]})
                    for i, it in enumerate(CETIAN_SIHUA_TABLE)
                ],
            })
        if show_flying:
            sections.append({"title": "飞化规则", "rows": [row(k, v) for k, v in CETIAN_FLYING_RULES.items()]})
            sections.append({"title": "古法格局规则", "rows": [row(k, v) for k, v in CETIAN_PATTERNS.items()]})
    sections.append({
        "title": "三合组",
        "rows": [
            row(f"三合{idx + 1}", [EARTHLY_BRANCHES[item] for item in group])
            for idx, group in enumerate(chart.get("sanhe_groups") or [])
        ],
    })
    return sections


class CeTianSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def pan(self):
        enable_crossdomain()
        try:
            if cherrypy.request.method == "OPTIONS":
                return jsonpickle.encode({"ResultCode": 0, "Result": "ok"}, unpicklable=False)
            data = cherrypy.request.json or {}
            dt = parse_datetime(data)
            timezone = timezone_to_float(data.get("zone") or data.get("timezone"), 8.0)
            latitude = coord_to_float(data.get("lat") or data.get("latitude"), 26.0667)
            longitude = coord_to_float(data.get("lon") or data.get("longitude"), 119.3167)
            location = clean_text(data.get("location") or data.get("place"), "星阙地点")
            gender = gender_cn(data.get("gender"), "男")
            chart = json_safe(compute_cetian_ziwei_chart(
                year=dt.year,
                month=dt.month,
                day=dt.day,
                hour=dt.hour,
                minute=dt.minute,
                timezone=timezone,
                latitude=latitude,
                longitude=longitude,
                location_name=location,
                gender=gender,
                method=("kentang" if str(data.get("method") or "book").lower() in ("kentang", "classic", "original") else "book"),
                lunar_mode=("classic" if str(data.get("lunarMode") or "sxtwl").lower() == "classic" else "sxtwl"),
                star_order=("forward" if str(data.get("starOrder") or "reverse").lower() == "forward" else "reverse"),
                shen_gong_mode=("literal" if str(data.get("shenGongMode") or "yizheng").lower() == "literal" else "yizheng"),
                daxian_mode=("legacy" if str(data.get("daxianMode") or "yiyu").lower() == "legacy" else "yiyu"),
                brightness_school=("quanji" if str(data.get("brightnessSchool") or "yiyu").lower() == "quanji" else "yiyu"),
            ))
            is_kentang = chart.get("method") == "kentang"
            lunar_text = (
                f"{chart.get('lunar_year')}年"
                f"{HEAVENLY_STEMS[chart.get('lunar_year_stem', 0)]}{EARTHLY_BRANCHES[chart.get('lunar_year_branch', 0)]}年 "
                f"{'闰' if chart.get('is_leap_month') else ''}"
                f"{LUNAR_MONTH_NAMES[chart.get('lunar_month', 1) - 1]}"
                f"{_day_to_chinese(chart.get('lunar_day', 1))}"
            )
            pan = {
                "source": "horosa",
                "engine": "horosa-cetian",
                "technique": "cetian",
                "title": "策天飞星",
                "dateStr": data.get("date", dt.strftime("%Y-%m-%d")),
                "timeStr": data.get("time", dt.strftime("%H:%M:%S")),
                "timezone": timezone,
                "latitude": latitude,
                "longitude": longitude,
                "location": location,
                "lunar": {"text": lunar_text},
                "hourBranch": HOUR_BRANCH_NAMES[chart.get("hour_branch", 0)],
                "mingGong": f"{EARTHLY_BRANCHES[chart.get('ming_gong_branch', 0)]}宫",
                "shenGong": f"{EARTHLY_BRANCHES[chart.get('shen_gong_branch', 0)]}宫",
                "ziwei": f"{EARTHLY_BRANCHES[chart.get('ziwei_branch', 0)]}宫",
                "method": chart.get("method", "book"),
                "lunarMode": chart.get("lunar_mode", "sxtwl"),
                "starOrder": chart.get("star_order", "reverse"),
                "cetian": chart,
                "rules": {
                    "stars": json_safe(CETIAN_18_FLYING_STARS),
                    "starAttributes": json_safe(CETIAN_STAR_ATTRIBUTES),
                    "mainStars": json_safe(CETIAN_MAIN_STAR_NAMES),
                    "auxStars": json_safe(CETIAN_AUX_STAR_NAMES),
                },
                "classics": [
                    {
                        "title": "来源",
                        "rows": [
                            row("依据", "《十八飞星策天紫微斗数（附地星会源）》卷一安星定宫法；《正命二十八宿移语》(道藏系策天古籍)流年飞星/神煞/杂曜/运限/诸星格")
                            if not is_kentang else
                            row("依据", "原法=标准紫微嫁接(五行局/按农历日起紫微/四化飞化格局),非本书"),
                            row("说明", "命/身/紫微/宫序按古籍安星法；庙旺/身宫/大限口径可切两古籍流派(默认移语本)；流年飞星、神煞四表、杂曜、断诀依《正命二十八宿移语》。")
                            if not is_kentang else
                            row("说明", "左栏可切「书法/原法」;原法另可选 农历(sxtwl/原) 与 正曜(逆布/顺布)。"),
                        ],
                    },
                ],
                "capabilities": {
                    "inputs": ["date", "time", "gender", "timezone", "latitude", "longitude", "location",
                               "method", "lunarMode", "starOrder",
                               "shenGongMode", "daxianMode", "brightnessSchool", "tianluoMode", "palaceNameMode",
                               "liunianYear", "liunianQishaMode",
                               "showLiunian", "showShensha", "showZaYao", "showDuanjue", "showXiu", "showBianyao"],
                    "outputs": ["lunarDate", "mingShen", "palaces", "18Stars", "starAttributes", "brightness",
                                "sanheGroups", "solarTerm", "zayao", "liunianFeixing", "shensha", "yunxian",
                                "huizhao", "xiu", "bianyao", "duanjue"],
                },
            }
            if is_kentang:
                pan["wuXingJu"] = WU_XING_JU_NAMES.get(chart.get("wu_xing_ju"), chart.get("wu_xing_ju"))
                pan["rules"]["sihuaTable"] = json_safe(CETIAN_SIHUA_TABLE)
                pan["rules"]["flyingRules"] = json_safe(CETIAN_FLYING_RULES)
                pan["rules"]["patterns"] = json_safe(CETIAN_PATTERNS)
            # 显示开关(默认 1=显示=现状);仅过滤输出,不改算法。showBrightness=0 主动清空 palace.brightness(图与表都隐)。
            def _flag(key):
                return str(data.get(key, 1)).strip().lower() not in ("0", "false", "no", "off", "")
            show_brightness = _flag("showBrightness")
            if not show_brightness:
                for _p in (chart.get("palaces") or []):
                    if isinstance(_p, dict):
                        _p["brightness"] = {}

            # 书法(移语本)增强层:流年/神煞/杂曜/运限/会照/躔宿/变曜/断诀。原法恒不进此支。
            yiyu = None
            palace_extra = None
            show_yiyu = None
            if not is_kentang:
                try:
                    liunian_year = int(data.get("liunianYear") or 0)
                except (TypeError, ValueError):
                    liunian_year = 0
                if liunian_year < 1 or liunian_year > 9999:  # 负数/零/荒谬值一律回落当年(int('-5')非0会穿透 or 短路)
                    liunian_year = datetime.now().year
                qisha_mode = "suishu" if str(data.get("liunianQishaMode") or "shengshi").lower() == "suishu" else "shengshi"
                tianluo_mode = "zhongtian" if str(data.get("tianluoMode") or "benshu").lower() == "zhongtian" else "benshu"
                show_yiyu = {
                    "liunian": _flag("showLiunian"), "shensha": _flag("showShensha"),
                    "zayao": _flag("showZaYao"), "duanjue": _flag("showDuanjue"),
                    "xiu": _flag("showXiu"), "bianyao": _flag("showBianyao"),
                }
                palaces = chart.get("palaces") or []
                ming_b = chart.get("ming_gong_branch", 0)
                shen_b = chart.get("shen_gong_branch", 0)
                year_b = chart.get("lunar_year_branch", 0)
                year_s = chart.get("lunar_year_stem", 0)
                hour_b = chart.get("hour_branch", 0)

                zayao, zayao_notes = compute_zayao(
                    year_b, year_s, chart.get("lunar_month", 1), chart.get("lunar_day", 1),
                    hour_b, shen_b, tianluo_mode=tianluo_mode)
                liunian = compute_liunian(liunian_year, chart.get("lunar_year", liunian_year),
                                          hour_b, qisha_mode=qisha_mode)
                shensha = compute_shensha(liunian["branch"], liunian["stem"], year_s,
                                          chart.get("lunar_month", 1))
                huizhao = compute_huizhao(ming_b, shen_b)
                xiu = compute_xiu(chart.get("julian_day", 0.0), ming_b, shen_b)
                is_shun = ((chart.get("yin_yang") == "陽" and chart.get("gender") == "男")
                           or (chart.get("yin_yang") == "陰" and chart.get("gender") == "女"))
                daxian_mode = chart.get("daxian_mode", "yiyu")
                if daxian_mode == "legacy":
                    start_branch = ming_b if is_shun else shen_b
                else:
                    start_branch = ming_b if chart.get("yin_yang") == "陽" else shen_b
                yunxian = compute_yunxian(palaces, ming_b, shen_b, year_b, is_shun, start_branch)
                bianyao = compute_bianyao(year_s, liunian["stem"])
                duanjue = match_duanjue(palaces, ming_b, shen_b, zayao)
                yinyang_gong = compute_yinyang_gong(palaces, CETIAN_STAR_LORE)
                nayin = compute_nayin(year_s, year_b)
                xingge_verses = collect_xingge_verses(palaces)
                yiyu = {
                    "yinyang_gong": yinyang_gong, "nayin": nayin, "xingge_verses": xingge_verses,
                    "zayao": zayao, "zayao_notes": zayao_notes, "liunian": liunian,
                    "shensha": shensha, "huizhao": huizhao, "xiu": xiu,
                    "yunxian": yunxian, "bianyao": bianyao, "duanjue": duanjue,
                    "ruyuan_month": ruyuan_month_row(chart.get("lunar_month", 1)),
                }
                pan["yiyu"] = yiyu

                # 宫段增行数据(按支索引)。
                zayao_by_branch = {}
                for name, b in zayao.items():
                    zayao_by_branch.setdefault(b, []).append(name)
                liunian_by_branch = {}
                if show_yiyu["liunian"]:
                    for name, b in list(liunian["zhuxu"].items()) + list(liunian["qisha"].items()):
                        liunian_by_branch.setdefault(b, []).append(name)
                    liunian_by_branch.setdefault(liunian["feiku"], []).append("飞哭")
                    liunian_by_branch.setdefault(liunian["xiaoku"], []).append("小哭")
                xian_by_branch = {d["branch"]: d for d in yunxian["daxian"]}
                palace_extra = {
                    "zayao_by_branch": {b: v for b, v in zayao_by_branch.items()} if show_yiyu["zayao"] else {},
                    "liunian_by_branch": liunian_by_branch,
                    "huizhao_per_palace": huizhao["per_palace"],
                    "xian_by_branch": xian_by_branch,
                }

                # 僧道宫名(仅显示层;判定层已按通行宫名算完)。
                if str(data.get("palaceNameMode") or "common").lower() == "monk":
                    for _p in palaces:
                        if isinstance(_p, dict):
                            idx = _p.get("index")
                            if isinstance(idx, int) and 0 <= idx < 12:
                                _p["name"] = MONK_PALACE_NAMES[idx]
                    pan["palaceNameMode"] = "monk"
                else:
                    pan["palaceNameMode"] = "common"
                pan["liunianYear"] = liunian_year
                pan["showFlags"] = show_yiyu  # 前端盘面层按此过滤杂曜/流年层(与右栏段开关同源)
                pan["shenGongMode"] = chart.get("shen_gong_mode", "yizheng")
                pan["daxianMode"] = daxian_mode
                pan["brightnessSchool"] = chart.get("brightness_school", "yiyu")
                pan["tianluoMode"] = tianluo_mode
                pan["liunianQishaMode"] = qisha_mode

            pan["sections"] = _build_sections(
                pan,
                show_wu_xing_ju=_flag("showWuXingJu"),
                show_sihua=_flag("showSihua"),
                show_flying=_flag("showFlying"),
                show_brightness=show_brightness,
                show_solar_term=_flag("showSolarTerm"),
                yiyu=yiyu,
                palace_extra=palace_extra,
                show_yiyu=show_yiyu,
            )
            pan["snapshot"] = build_snapshot(pan)
            return jsonpickle.encode({"ResultCode": 0, "Result": pan}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "cetian calculation failed"}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    def texts(self):
        """移语本典籍全文库(静态,前端「典籍」页惰性拉取并缓存)。"""
        enable_crossdomain()
        try:
            return jsonpickle.encode({"ResultCode": 0, "Result": {"texts": YIYU_TEXTS}}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "cetian texts failed"}, unpicklable=False)
