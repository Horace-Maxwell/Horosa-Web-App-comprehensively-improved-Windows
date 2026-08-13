import os
import random
import sys
import traceback
from numbers import Integral, Real

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain
from websrv import wuzhao_classics as wz_classics
from websrv import wuzhao_leizhan as wz_leizhan


_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_HOROSA_WEB_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_VENDOR_ROOT = os.path.join(_HOROSA_WEB_ROOT, "vendor")
_KINWUZHAO_SRC = os.path.join(_HOROSA_WEB_ROOT, "vendor", "kinwuzhao")


def _preload_year_domain():
    """预载全年份域共享件到 sys.modules。

    🔴 vendor/kinwuzhao/config.py 的 gangzhi() 在 year<1 或 >9999 时才
    `from kin_year_domain import extreme_pillars`（延迟 import，在请求处理期执行）。
    而本模块的隔离导入用完即把 vendor 路径移出 sys.path —— 届时该 import 必然
    ModuleNotFoundError，公元前日期整盘 500。故此处预先载入使其常驻 sys.modules，
    延迟 import 直接命中，不必依赖请求期的 sys.path。该件为各 vendor 共享
    （太玄适配器亦用），常驻不构成污染。
    """
    if "kin_year_domain" in sys.modules:
        return
    inserted = False
    if _VENDOR_ROOT not in sys.path:
        sys.path.insert(0, _VENDOR_ROOT)
        inserted = True
    try:
        import kin_year_domain  # noqa: F401
    except Exception:
        pass
    finally:
        if inserted:
            try:
                sys.path.remove(_VENDOR_ROOT)
            except ValueError:
                pass


def _import_kinwuzhao():
    """Import kinwuzhao without leaking its top-level config.py to other adapters."""
    _preload_year_domain()
    previous_modules = {name: sys.modules.get(name) for name in ("config", "jieqi", "kinwuzhao")}
    for name in previous_modules:
        sys.modules.pop(name, None)
    inserted = False
    if _KINWUZHAO_SRC not in sys.path:
        sys.path.insert(0, _KINWUZHAO_SRC)
        inserted = True
    try:
        import config as wuzhao_config  # noqa: E402
        import jieqi as wuzhao_jieqi  # noqa: E402
        import kinwuzhao as wuzhao_core  # noqa: E402
        return wuzhao_config, wuzhao_jieqi, wuzhao_core
    finally:
        for name, module in previous_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module
        if inserted:
            try:
                sys.path.remove(_KINWUZHAO_SRC)
            except ValueError:
                pass


wuzhao_config, wuzhao_jieqi, wuzhao_core = _import_kinwuzhao()


POSITION_ORDER = ["兆", "木鄉", "火鄉", "土鄉", "金鄉", "水鄉"]
POSITION_LABELS = {
    "兆": "兆",
    "木鄉": "木乡",
    "火鄉": "火乡",
    "土鄉": "土乡",
    "金鄉": "金乡",
    "水鄉": "水乡",
}
FLAG_LABELS = {
    "孤": "孤",
    "虛": "虚",
    "關": "关",
    "籥": "籥",
    "將軍": "将军",
    "六獸死": "六兽死",
    "六獸害": "六兽害",
}
MODE_LABELS = {
    "ganzhi": "干支起盘",
    "day": "日干起盘",
    "hour": "时干起盘",
    "minute": "分干起盘",
    "tang": "唐代正法揲筮",
    "dunhuang": "敦煌校录揲筮",
    "qian": "以钱代筮",
    "zhushu": "直输五兆数",
}

# 敦煌校录揲筮：数→五行两派口径
SHIFA_VARIANTS = {
    "guayi": "挂一回加（0策=水、5=火、10=木、15=金、20=土）",
    "jiaolu": "校录原案（0策=土、5=水、10=火、15=木、20=金）",
}

# 以钱代筮：四钱阳面数 → 撒币五行 → 取克之者为成卦五行
QIAN_YANG_TO_ELEM = {4: "火", 3: "金", 2: "土", 1: "木", 0: "水"}
QIAN_KE_SOURCE = {"火": "水", "金": "火", "土": "木", "木": "金", "水": "土"}
QIAN_YINYANG_TEXT = {4: "阳阳阳阳", 3: "阳阳阳阴", 2: "阳阳阴阴", 1: "阳阴阴阴", 0: "阴阴阴阴"}
ELEM_TO_NUM = {"水": 1, "火": 2, "木": 3, "金": 4, "土": 5}
NUM_TO_ELEM = {1: "水", 2: "火", 3: "木", 4: "金", 5: "土"}


def _to_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def _clean_text(value, default=""):
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _json_safe(value):
    if isinstance(value, dict):
        return {_clean_text(key): _json_safe(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, Integral) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, Real) and not isinstance(value, bool):
        return float(value)
    if hasattr(value, "item"):
        try:
            return _json_safe(value.item())
        except Exception:
            return _clean_text(value)
    return value


def _format_value(value):
    if value is None or value == "":
        return ""
    if isinstance(value, dict):
        parts = []
        for key, val in value.items():
            text = _format_value(val)
            if text:
                parts.append(f"{key}：{text}")
        return "；".join(parts)
    if isinstance(value, list):
        return "、".join([_format_value(item) for item in value if _format_value(item)])
    return _clean_text(value)


def _row(label, value):
    return {"label": label, "value": _format_value(value) or "—"}


# 注:原「古籍/来源」板块(vendor markdown 直录 + 相关项目链接 + 来源署名)已整块移除。
# 依赖归属与许可声明的唯一去处是仓根 THIRD_PARTY_NOTICES.md,不在技法界面内展示。


def _lunar_text(lunar):
    if not isinstance(lunar, dict):
        return "—"
    month = lunar.get("農曆月") or lunar.get("月") or ""
    day = lunar.get("日") or ""
    return f"{lunar.get('年', '')}年{month}{day}日".strip()


def _normalize_positions(raw):
    positions = []
    for key in POSITION_ORDER:
        item = raw.get(key, {}) if isinstance(raw, dict) else {}
        flags = [FLAG_LABELS.get(name, name) for name in ["孤", "虛", "關", "籥", "將軍", "六獸死", "六獸害"] if item.get(name)]
        positions.append({
            "key": key,
            "label": POSITION_LABELS.get(key, key),
            "palace": item.get("宮位1", ""),
            "prosperity": item.get("旺相", ""),
            "number": item.get("數字", ""),
            "element": item.get("五行", ""),
            "beast": item.get("六獸", ""),
            "relation": item.get("六親", ""),
            "flags": flags,
            "raw": _json_safe(item),
            "rows": [
                _row("宫位", item.get("宮位1")),
                _row("旺相", item.get("旺相")),
                _row("数字", item.get("數字")),
                _row("五行", item.get("五行")),
                _row("六兽", item.get("六獸")),
                _row("六亲", item.get("六親")),
                _row("特殊", "、".join(flags)),
            ],
        })
    return positions


def _build_sections(payload, positions):
    gz = payload.get("ganzhi", {})
    sections = [
        {
            "title": "起盘",
            "rows": [
                _row("起盘时间", f"{payload.get('dateStr', '')} {payload.get('timeStr', '')}".strip()),
                _row("起盘方式", payload.get("modeLabel")),
                _row("报数", payload.get("number")),
                _row("节气", payload.get("solarTerm")),
                _row("农历", payload.get("lunarDate", {}).get("text")),
                _row("年柱", gz.get("year")),
                _row("月柱", gz.get("month")),
                _row("日柱", gz.get("day")),
                _row("时柱", gz.get("hour")),
                _row("分柱", gz.get("minute")),
            ],
        },
        {
            "title": "揲筮",
            "rows": [
                _row("揲筮模式", "手动复现" if payload.get("manual") else "自动随机/干支计算"),
                _row("手动六数", payload.get("manualSplits")),
                _row("上柱", payload.get("upperGanzhi")),
                _row("下柱", payload.get("lowerGanzhi")),
            ],
        },
    ]
    sections.extend([{"title": item["label"], "rows": item["rows"]} for item in positions])
    flags = []
    for item in positions:
        for flag in item.get("flags", []):
            flags.append(f"{item['label']}：{flag}")
    sections.append({"title": "特殊标记", "rows": [_row("标记", "；".join(flags) if flags else "无")]})
    # 既有九段（起盘/揲筮/六位/特殊标记）标题与次第为向后相容契约，只增不改；
    # 逐段补 key 供前栏按键分组（旧下标切片仍可用）。
    legacy_keys = ["qipan", "shishi", "zhao", "muxiang", "huoxiang", "tuxiang",
                   "jinxiang", "shuixiang", "flags"]
    for idx, section in enumerate(sections):
        if idx < len(legacy_keys):
            section["key"] = legacy_keys[idx]
    return sections


def _classic_rows(classic):
    """由古法层生成追加段（断辞／君子小人／纳甲／神煞／行神／类占）。"""
    if not classic:
        return []
    out = []

    # 断辞
    rows = []
    for item in classic.get("duanci25") or []:
        rows.append(_row("%s（%s）见%s支" % (item.get("xiang", ""), item.get("xiangRole", ""),
                                             item.get("zhiElem", "")), item.get("text", "")))
    zz = classic.get("duanciZhaozhi") or {}
    if zz.get("text"):
        rows.append(_row(zz.get("title", "兆支总断"), zz["text"]))
    ss = classic.get("duanciSishi") or {}
    if ss.get("text"):
        rows.append(_row("候四时·" + ss.get("title", ""), ss["text"]))
    for item in (classic.get("positions") or [])[1:]:
        x13 = item.get("xiang13") or {}
        if x13.get("name"):
            rows.append(_row("%s·%s" % (item.get("label", ""), x13["name"]), x13.get("text", "")))
    if rows:
        out.append({"key": "duanci", "title": "断辞", "rows": rows})

    # 君子小人 / 身命
    rows = []
    jz = classic.get("junzi") or {}
    if jz.get("role"):
        rows.append(_row("君子小人", "%s（%s）" % (jz["role"], jz.get("reason", ""))))
    else:
        rows.append(_row("君子小人", jz.get("reason", "—")))
    for t in jz.get("texts") or []:
        rows.append(_row("兆辞", t))
    bl = jz.get("boluo") or {}
    if bl.get("hit"):
        rows.append(_row("剥落卦", "%s%s" % (bl.get("text", ""), bl.get("verdict", ""))))
    sm = classic.get("shenming") or {}
    if sm.get("verdict"):
        rows.append(_row("身命", "%s：%s" % (sm["verdict"], sm.get("detail", ""))))
    if classic.get("junziZhaozhi"):
        rows.append(_row("兆支贵贱", classic["junziZhaozhi"]))
    qi = classic.get("qi") or {}
    if qi.get("zhaoWangshuai"):
        rows.append(_row("本兆休王", "%s（%s）·%s" % (qi["zhaoWangshuai"], qi.get("zhaoQi", ""),
                                                     qi.get("season", ""))))
    if rows:
        out.append({"key": "junzi", "title": "君子小人", "rows": rows})

    # 纳甲
    rows = []
    nj = classic.get("najia") or {}
    rows.append(_row("所在旬", nj.get("xun", "")))
    kw = nj.get("kongwang") or {}
    rows.append(_row("空亡", "、".join(kw.get("branches") or []) + "　" + (kw.get("text") or "")))
    if kw.get("zhaoText"):
        rows.append(_row("占空亡", kw["zhaoText"]))
    for item in classic.get("positions") or []:
        parts = []
        xiang_gz = "、".join(it.get("gz", "") for it in item.get("xiangNajia") or [])
        zhi_gz = "、".join(it.get("gz", "") for it in item.get("najia") or [])
        if item.get("index") == 0:
            if zhi_gz:
                parts.append("本兆%s：%s" % (item.get("elem", ""), zhi_gz))
        else:
            if xiang_gz:
                parts.append("乡%s：%s" % (item.get("xiangElem", ""), xiang_gz))
            if zhi_gz:
                parts.append("支%s：%s" % (item.get("elem", ""), zhi_gz))
        kws = list(dict.fromkeys((item.get("xiangKongwang") or []) + (item.get("kongwang") or [])))
        if kws:
            parts.append("空亡：" + "、".join(kws))
        if parts:
            rows.append(_row(item.get("label", ""), "　".join(parts)))
    for item in nj.get("ruMu") or []:
        rows.append(_row(item.get("name", "入墓"), item.get("detail", "")))
    if nj.get("ganZhuan"):
        rows.append(_row("干转", nj["ganZhuan"].get("detail", "")))
    if nj.get("zhiZhuan"):
        rows.append(_row("支转", nj["zhiZhuan"].get("detail", "")))
    for item in nj.get("relations") or []:
        rows.append(_row("%s %s" % (item.get("position", ""), item.get("gz", "")),
                         "与日支%s：%s" % (item.get("dayBranch", ""),
                                          "、".join(item.get("rels") or []))))
    if rows:
        out.append({"key": "najia", "title": "纳甲", "rows": rows})

    # 神煞
    rows = []
    for item in (classic.get("shensha") or {}).get("items") or []:
        val = item.get("branch") or ""
        if item.get("branches"):
            val = "；".join("%s%s" % (k, v) for k, v in item["branches"].items())
        rows.append(_row(item.get("name", ""), val))
    for item in classic.get("positions") or []:
        hits = item.get("shensha") or []
        if hits:
            rows.append(_row("%s所犯" % item.get("label", ""),
                             "、".join("%s(%s)" % (h["name"], h["branch"]) for h in hits)))
    if rows:
        out.append({"key": "shensha", "title": "神煞", "rows": rows})

    # 行神
    rows = []
    xs = classic.get("xingshen") or {}
    for item in xs.get("rows") or []:
        val = item.get("branch", "")
        if item.get("flags"):
            val += "（%s）" % "、".join(item["flags"])
        rows.append(_row(item.get("beast", ""), val))
    for item in xs.get("xingFu") or []:
        rows.append(_row("%s·行%s伏%s" % (item.get("position", ""), item.get("xing", ""),
                                          item.get("fu", "")), item.get("text", "")))
    ls = classic.get("liushen") or {}
    yg = "；".join("%s%s" % (it.get("position", ""), it.get("beast", ""))
                   for it in ls.get("yougong") or [])
    if yg:
        rows.append(_row("六神游宫", yg))
    if rows:
        out.append({"key": "xingshen", "title": "行神", "rows": rows})

    # 类占
    rows = []
    for men, block in (classic.get("leizhan") or {}).items():
        for item in block.get("rules") or []:
            rows.append(_row("%s·%s" % (men, item.get("title", "")), item.get("text", "")))
    if rows:
        out.append({"key": "leizhan", "title": "类占", "rows": rows})

    return out


def _build_classic(payload, raw, ganzhi, solar_term, lunar, extras):
    """调用古法层（《要诀略》复原）并挂类占九门。失败不影响主排盘。"""
    try:
        elements = []
        for key in POSITION_ORDER:
            item = raw.get(key, {}) if isinstance(raw, dict) else {}
            elements.append(_clean_text(item.get("五行", "")))
        if not elements or not elements[0]:
            return None
        classic = wz_classics.enrich(
            elements=elements,
            ganzhi=list(ganzhi),
            jieqi=solar_term,
            lunar_month=_lunar_month_num(lunar),
            options={
                "xingshenMonth": extras.get("xingshenMonth"),
                "mingZhi": extras.get("mingZhi"),
                "gender": extras.get("gender"),
            },
        )
        shensha_map = {item["name"]: item for item in classic["shensha"]["items"]}
        zhao_najia = [it["branch"] for it in (classic["positions"][0].get("najia") or [])]
        classic["leizhan"] = wz_leizhan.leizhan(
            zhao=classic["zhaoElem"],
            zhi=classic["zhiElem"],
            elements=elements,
            ganzhi=list(ganzhi),
            season=classic["season"],
            beasts=[p.get("beast", "") for p in classic["positions"]],
            shensha_map=shensha_map,
            wangshuai_map=classic["qi"]["map"],
            xun=classic["xun"],
            kongwang=classic["najia"]["kongwang"]["branches"],
            options={"zhaoNajiaBranches": zhao_najia},
        )
        classic["leizhanOrder"] = list(wz_leizhan.MEN_ORDER)
        return _json_safe(classic)
    except Exception:
        traceback.print_exc()
        return None


def _build_snapshot(pan):
    lines = []
    for section in pan.get("sections", []):
        lines.append(f"[{section.get('title', '')}]")
        for row in section.get("rows", []):
            lines.append(f"{row.get('label')}：{row.get('value')}")
        lines.append("")
    return "\n".join(lines).strip()


_BRANCHES = ("子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥")


def _extras(data):
    """新起兆法与古法层参数（全部进请求体 → 缓存键天然含新维度）。"""
    variant = _clean_text(data.get("shifaVariant"), "guayi")
    if variant not in SHIFA_VARIANTS:
        variant = "guayi"
    # ⚠️ 只认真列表:字符串也可切片,若不先判型,传 "x" 会被逐字符切成长度 1 的列表
    # （不崩,但语义错——非数组本该视作未给）。
    throws = data.get("qianThrows")
    throws = throws if isinstance(throws, (list, tuple)) else []
    throws = [max(0, min(4, _to_int(item, 0))) for item in throws[:6]]
    zhao_nums = data.get("zhaoNums")
    zhao_nums = zhao_nums if isinstance(zhao_nums, (list, tuple)) else []
    zhao_nums = [max(1, min(5, _to_int(item, 5))) for item in zhao_nums[:6]]
    xingshen_month = _clean_text(data.get("xingshenMonth"), "lunar")
    if xingshen_month not in ("lunar", "jieqi"):
        xingshen_month = "lunar"
    ming_zhi = _clean_text(data.get("mingZhi"))
    if ming_zhi not in _BRANCHES:
        ming_zhi = ""
    gender = _clean_text(data.get("gender"))
    if gender not in ("male", "female"):
        gender = ""
    return {
        "shifaVariant": variant,
        "qianThrows": throws,
        "qianAuto": bool(data.get("qianAuto")),
        "zhaoNums": zhao_nums,
        "xingshenMonth": xingshen_month,
        "mingZhi": ming_zhi,
        "gender": gender,
    }


def _lunar_month_num(lunar):
    """农历月序（1-12）；闰月按其本月序。"""
    text = _clean_text((lunar or {}).get("農曆月", ""))
    names = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"]
    text = text.replace("閏", "").replace("闰", "").replace("月", "")
    if text.startswith("十一"):
        return 11
    if text.startswith("十二"):
        return 12
    for idx, name in enumerate(names, start=1):
        if text.startswith(name):
            return idx
    return 0


def _manual_splits(data):
    if not data.get("manual"):
        return None
    raw = data.get("manualSplits")
    raw = raw if isinstance(raw, (list, tuple)) else []   # 同 _extras:非列表不逐字符切
    values = [_to_int(item, 1) for item in raw[:6]]
    while len(values) < 6:
        values.append(1)
    return [max(1, min(35, item)) for item in values]


def _dunhuang_one(rng):
    """敦煌校录揲筮：单兆一轮（取三十六策，挂一、分二、五轮除五去余）。

    P.2859 与《唐六典·太卜署》「凡五兆之策，三十有六，用三十六筭，六变而成卦」；
    今传操作法：第一步挂一分二各除五去余（能被五整除者不去），第二至四步同法而
    能被五整除者去余五，末以五除所剩之策。返回 (剩策, 逐步轨迹)。
    """
    remain = 36
    trace = []
    for step in range(4):
        if remain <= 1:
            break
        remain -= 1  # 挂一
        left = rng.randint(1, remain - 1) if remain > 1 else remain
        right = remain - left
        if step == 0:
            drop = (left % 5) + (right % 5)
        else:
            drop = (left % 5 or 5) + (right % 5 or 5)
        after = max(0, remain - drop)
        trace.append({"step": step + 1, "left": left, "right": right,
                      "drop": drop, "remain": after})
        remain = after
    return remain, trace


def _dunhuang_shifa(variant, rng):
    """六兆各自独立揲筮，返回 (五兆卜数[6], 轨迹[6])。"""
    nums = []
    details = []
    for i in range(6):
        remain, trace = _dunhuang_one(rng)
        quotient = remain // 5
        if variant == "jiaolu":
            num = quotient or 5           # 0 策按五记（校录原案：0=土）
        else:
            num = quotient + 1            # 挂一回加（0 策 = 水）
        num = max(1, min(5, num))
        nums.append(num)
        details.append({"index": i, "position": POSITION_ORDER[i], "remain": remain,
                        "quotient": quotient, "num": num,
                        "element": NUM_TO_ELEM.get(num, ""), "trace": trace})
    return nums, details


def _qian_shifa(throws, auto, rng):
    """以钱代筮：四钱六掷，阳面数定撒币五行，取克之者为成卦五行。"""
    values = []
    for i in range(6):
        if auto or i >= len(throws):
            values.append(sum(rng.randint(0, 1) for _ in range(4)))
        else:
            values.append(max(0, min(4, _to_int(throws[i], 0))))
    nums = []
    details = []
    for i, yang in enumerate(values):
        coin_elem = QIAN_YANG_TO_ELEM.get(yang, "土")
        gua_elem = QIAN_KE_SOURCE.get(coin_elem, coin_elem)
        num = ELEM_TO_NUM.get(gua_elem, 5)
        nums.append(num)
        details.append({"index": i, "position": POSITION_ORDER[i], "yang": yang,
                        "yinyang": QIAN_YINYANG_TEXT.get(yang, ""),
                        "coinElement": coin_elem, "element": gua_elem, "num": num})
    return nums, details


def _assemble_from_nums(zhao_nums, solar_term, lunar_month, gz1, gz2):
    """由五兆卜数组装排盘（复用上游 InterpretationEngine，不改其语义）。"""
    core = wuzhao_core
    beast_seq = core.SixBeastsArranger.arrange(gz1[0])
    lock, key, general_gong = core.InterpretationEngine.compute_lock_key_general(
        solar_term, lunar_month, gz1, gz2)
    gu, xu = core.GuxuJudge.judge(gz2)
    result = {}
    my_element = ""
    for idx, (gong, label) in enumerate(core.InterpretationEngine.POSITIONS):
        num = zhao_nums[idx] if idx < len(zhao_nums) else 5
        if idx == 0:
            my_element = core.FiveElementsMapper.element_for(num)
        result[label] = core.InterpretationEngine.build_position_result(
            gong=gong, label=label, zhao_num=num, beast=beast_seq[idx],
            my_element=my_element, idx=idx, jq=solar_term, lock=lock,
            key=key, general_gong=general_gong, gu=gu, xu=xu)
    return result


def _calculate(mode, ganzhi, number, solar_term, lunar_month, manual_splits, extras=None):
    """返回 (raw, 上柱, 下柱, detail)。detail 为新起兆法的过程明细，旧法为 None。"""
    extras = extras or {}
    if mode == "day":
        return wuzhao_core.five_zhao_paipan(number, solar_term, lunar_month, ganzhi[1], ganzhi[2], manual_splits=manual_splits), ganzhi[1], ganzhi[2], None
    if mode == "hour":
        return wuzhao_core.five_zhao_paipan(number, solar_term, lunar_month, ganzhi[2], ganzhi[3], manual_splits=manual_splits), ganzhi[2], ganzhi[3], None
    if mode == "minute":
        return wuzhao_core.five_zhao_paipan(number, solar_term, lunar_month, ganzhi[3], ganzhi[4], manual_splits=manual_splits), ganzhi[3], ganzhi[4], None
    if mode == "tang":
        divination = wuzhao_core.WuzhaoDivination(
            jq=solar_term,
            cm=lunar_month,
            gz1=ganzhi[2],
            gz2=ganzhi[3],
            manual_splits=manual_splits,
        )
        return divination.divine(), ganzhi[2], ganzhi[3], None
    if mode in ("dunhuang", "qian", "zhushu"):
        rng = random.Random()
        if mode == "dunhuang":
            nums, detail = _dunhuang_shifa(extras.get("shifaVariant") or "guayi", rng)
            detail = {"kind": "dunhuang", "variant": extras.get("shifaVariant") or "guayi",
                      "variantLabel": SHIFA_VARIANTS.get(
                          extras.get("shifaVariant") or "guayi", ""),
                      "rows": detail}
        elif mode == "qian":
            nums, rows = _qian_shifa(extras.get("qianThrows") or [],
                                     bool(extras.get("qianAuto")), rng)
            detail = {"kind": "qian", "auto": bool(extras.get("qianAuto")), "rows": rows}
        else:
            raw_nums = extras.get("zhaoNums") or []
            nums = []
            for i in range(6):
                nums.append(max(1, min(5, _to_int(raw_nums[i] if i < len(raw_nums) else 5, 5))))
            detail = {"kind": "zhushu", "rows": [
                {"index": i, "position": POSITION_ORDER[i], "num": n,
                 "element": NUM_TO_ELEM.get(n, "")} for i, n in enumerate(nums)]}
        return (_assemble_from_nums(nums, solar_term, lunar_month, ganzhi[2], ganzhi[3]),
                ganzhi[2], ganzhi[3], detail)
    return wuzhao_core.gangzhi_paipan(ganzhi, number, solar_term, lunar_month), ganzhi[3], ganzhi[4], None


class WuZhaoSrv:
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
            year = _to_int(data.get("year"), 2025)
            month = _to_int(data.get("month"), 1)
            day = _to_int(data.get("day"), 1)
            hour = _to_int(data.get("hour"), 0)
            minute = _to_int(data.get("minute"), 0)
            after23 = _to_int(data.get("after23NewDay"), 1)
            # v2.2.1 第二全局开关·晚子时·时柱起干。仅 hour==23 时影响时干;hour!=23 完全 NO-OP。
            late_zi = _to_int(data.get("lateZiHourUseNextDay"), 1)
            mode = _clean_text(data.get("mode"), "ganzhi")
            if mode not in MODE_LABELS:
                mode = "ganzhi"
            number = max(0, min(90, _to_int(data.get("number"), 0)))
            if number > 9:
                number = number % 9
            manual_splits = _manual_splits(data)
            extras = _extras(data)

            ganzhi = _json_safe(wuzhao_config.gangzhi(year, month, day, hour, minute, after23, late_zi))
            solar_term = wuzhao_jieqi.jq(year, month, day, hour, minute)
            lunar = _json_safe(wuzhao_config.lunar_date_d(year, month, day))
            lunar_month = _clean_text(lunar.get("農曆月", ""))[0] if lunar.get("農曆月") else "正"
            raw, upper_gz, lower_gz, shi_detail = _calculate(
                mode, ganzhi, number, solar_term, lunar_month, manual_splits, extras)
            raw = _json_safe(raw)
            if isinstance(raw, dict) and raw.get("錯誤"):
                return jsonpickle.encode({"ResultCode": -1, "Result": raw.get("錯誤")}, unpicklable=False)

            positions = _normalize_positions(raw)
            normalized = {
                "source": "kinwuzhao",
                "engine": "kinwuzhao",
                "mode": mode,
                "modeLabel": MODE_LABELS[mode],
                "number": number,
                "manual": bool(manual_splits),
                "manualSplits": manual_splits or [],
                "dateStr": data.get("date", f"{year:04d}-{month:02d}-{day:02d}"),
                "timeStr": data.get("time", f"{hour:02d}:{minute:02d}:00"),
                "solarTerm": solar_term,
                "lunarDate": {
                    "raw": lunar,
                    "text": _lunar_text(lunar),
                    "month": lunar_month,
                },
                "ganzhi": {
                    "year": ganzhi[0] if len(ganzhi) > 0 else "",
                    "month": ganzhi[1] if len(ganzhi) > 1 else "",
                    "day": ganzhi[2] if len(ganzhi) > 2 else "",
                    "hour": ganzhi[3] if len(ganzhi) > 3 else "",
                    "minute": ganzhi[4] if len(ganzhi) > 4 else "",
                    "raw": ganzhi,
                },
                "upperGanzhi": upper_gz,
                "lowerGanzhi": lower_gz,
                "positions": positions,
                "raw": raw,
                "shifaVariant": extras["shifaVariant"],
                "shifaVariantLabel": SHIFA_VARIANTS.get(extras["shifaVariant"], ""),
                "shifaDetail": shi_detail,
                "qianThrows": extras["qianThrows"],
                "qianAuto": extras["qianAuto"],
                "zhaoNums": extras["zhaoNums"],
                "xingshenMonth": extras["xingshenMonth"],
                "mingZhi": extras["mingZhi"],
                "gender": extras["gender"],
                "capabilities": {
                    "inputs": [
                        "date",
                        "time",
                        "mode",
                        "number",
                        "manualSplits",
                        "shifaVariant",
                        "qianThrows",
                        "zhaoNums",
                        "xingshenMonth",
                        "mingZhi",
                        "gender",
                    ],
                    "modes": [{"key": key, "label": label} for key, label in MODE_LABELS.items()],
                    "shifaVariants": [{"key": k, "label": v} for k, v in SHIFA_VARIANTS.items()],
                    "outputs": [
                        "sixPositions",
                        "fiveElements",
                        "sixBeasts",
                        "sixRelations",
                        "guxu",
                        "lockKeyGeneral",
                        "prosperity",
                        "xiangZhiThirteen",
                        "seasonalProsperity",
                        "duanci25",
                        "zhaozhiJudgement",
                        "sishiJudgement",
                        "junziXiaoren",
                        "shenMing",
                        "najiaXun",
                        "kongwang",
                        "ruMuThree",
                        "ganZhiZhuan",
                        "shenshaFull",
                        "xingshenMonthly",
                        "leizhanNineMen",
                    ],
                },
            }
            normalized["classic"] = _build_classic(normalized, raw, ganzhi, solar_term,
                                                   lunar, extras)
            normalized["sections"] = _build_sections(normalized, positions)
            normalized["sections"].extend(_classic_rows(normalized["classic"]))
            normalized["snapshot"] = _build_snapshot(normalized)
            return jsonpickle.encode({"ResultCode": 0, "Result": normalized}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "wuzhao calculation failed"}, unpicklable=False)
