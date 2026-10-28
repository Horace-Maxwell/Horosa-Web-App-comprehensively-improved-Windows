import datetime
import os
import sys
import traceback

import cherrypy
import cnlunar
import jsonpickle

from astrostudy.civil_calendar import civil_jdn_display, civil_ymd_valid, display_year, format_display_date, parse_civil_date
from websrv.helper import enable_crossdomain
from websrv.horosa_engine_common import (
    build_snapshot as _build_snapshot,
    plain_json_safe as _json_safe,
    plain_row as _row,
    to_int as _to_int,
    with_seed as _with_seed,
)


_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_HOROSA_WEB_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_TAIXUAN_SRC = os.path.join(_HOROSA_WEB_ROOT, "vendor", "taixuanshifa")


def _import_taixuan():
    """Import taixuanshifa in isolation so vendor top-level modules stay contained."""
    previous_modules = {name: sys.modules.get(name) for name in ("taixuanshifa",)}
    for name in previous_modules:
        sys.modules.pop(name, None)
    inserted = False
    if _TAIXUAN_SRC not in sys.path:
        sys.path.insert(0, _TAIXUAN_SRC)
        inserted = True
    try:
        import taixuanshifa as taixuan_core  # noqa: E402
        return taixuan_core
    finally:
        for name, module in previous_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module
        if inserted:
            try:
                sys.path.remove(_TAIXUAN_SRC)
            except ValueError:
                pass


taixuan_core = _import_taixuan()


POSITION_LABELS = ["方", "州", "部", "家"]
DIGIT_LABELS = {1: "一", 2: "二", 3: "三"}
LINE_SYMBOLS = {
    "1": "▅▅▅▅▅▅▅▅▅▅",
    "2": "▅▅▅▅  ▅▅▅▅",
    "3": "▅▅  ▅▅  ▅▅",
}
LINE_ORDER = ["初一", "次二", "次三", "次四", "次五", "次六", "次七", "次八", "上九"]
PERIOD_LINES = {
    "旦": ["初一", "次五", "次七"],
    "夕": ["次三", "次四", "次八"],
    "日中": ["次二", "次六", "上九"],
    "夜中": ["次二", "次六", "上九"],
}
DIVINE_YINYANG = {
    "旦陽": ["旦筮阳首", "一从二从三从", "大休"],
    "日中陰": ["日中筮阴首", "一从二从三违", "始中休终咎"],
    "夜中陰": ["夜中筮阴首", "一从二从三违", "始中休终咎"],
    "夕陰": ["夕筮阴首", "一违二从三从", "始咎中终休"],
    "日中陽": ["日中筮阳首", "一违二违三从", "始中咎终休"],
    "夜中陽": ["夜中阳首", "一违二违三从", "始中咎终休"],
    "夕陽": ["夕筮阳首", "一从二违三违", "始休中终咎"],
    "旦陰": ["旦筮阴首", "一违二违三违", "大咎"],
}


def _zone_to_hours(value, default=8.0):
    """时区字符串('+08:00'/'-05:30'/'8'/'+8')→ 小时数;不可解析即回缺省 +8。"""
    if value is None or value == "":
        return default
    try:
        txt = f"{value}".strip()
        sign = -1.0 if txt.startswith("-") else 1.0
        txt = txt.lstrip("+-")
        if ":" in txt:
            hh, mm = txt.split(":", 1)
            return sign * (int(hh) + int(mm) / 60.0)
        return sign * float(txt)
    except Exception:
        return default


def _read_vendor_text(filename, fallback=""):
    path = os.path.join(_TAIXUAN_SRC, filename)
    if not os.path.isfile(path):
        return fallback
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read().strip()
    return content or fallback


def _related_links():
    return [
        {
            "name": "taixuanshifa",
            "url": "https://github.com/kentang2017/taixuanshifa",
            "description": "kentang2017 太玄筮法 Python 项目。",
        },
        {
            "name": "PyPI taixuanshifa",
            "url": "https://pypi.org/project/taixuanshifa/",
            "description": "上游 README 中列出的 PyPI 包页面。",
        },
    ]


def _source_sections():
    readme = _read_vendor_text("README.md", "暂无 README 内容。")
    intro_marker = "## **1. Introduction"
    install_marker = "## **2. Installation"
    intro = readme
    if intro_marker in readme and install_marker in readme:
        intro = readme.split(intro_marker, 1)[1].split(install_marker, 1)[0].strip()
    features = ""
    feature_marker = "## **Features"
    if feature_marker in readme and intro_marker in readme:
        features = readme.split(feature_marker, 1)[1].split(intro_marker, 1)[0].strip()
    link_lines = [f"{item['name']}：{item['description']}（{item['url']}）" for item in _related_links()]
    return {
        "meta": [{
            "key": "taixuan_readme",
            "title": "taixuanshifa 来源内容",
            "author": "Ken Tang / kentang2017",
            "description": "上游未提供单独古籍 Markdown；星阙从 README 和核心 81 首数据中整理展示。",
        }],
        "selectedKey": "taixuan_readme",
        "sections": [
            {"title": "项目简介", "content": intro},
            {"title": "功能摘要", "content": features or "暂无功能摘要。"},
            {"title": "相关项目", "content": "\n".join(link_lines)},
        ],
        "links": _related_links(),
    }


def _period_for_hour(hour):
    hours = list(range(24))
    return taixuan_core.multi_key_dict_get({
        tuple(hours[6:12]): "旦",
        tuple(hours[12:18]): "日中",
        tuple(hours[18:24]): "夕",
        tuple(hours[0:6]): "夜中",
    }, hour)


# cnlunar 历表实测可用域:整年 1900–2099(2100 年 6 月起 IndexError;冬至还要查前一年,1899 年末可用)。
# 域内农历 / 冬至走 cnlunar(逐字节不变);域外改走全年份域农历件(astrostudy.jieqi.NongLi:定朔 + 冬至所在月为冬月,
# 与主链农历同一口径),取不到就回 None(界面显示「—」),绝不显示钳过的那一年。
CNLUNAR_MIN_YEAR = 1900
CNLUNAR_MAX_YEAR = 2099
_CN_DIGITS = "零一二三四五六七八九"
_CN_DAYS = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
            "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
            "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"]


def in_cnlunar_domain(year):
    return CNLUNAR_MIN_YEAR <= int(year) <= CNLUNAR_MAX_YEAR


def _prev_display_year(year):
    return -1 if year == 1 else year - 1


def _next_display_year(year):
    return 1 if year == -1 else year + 1


def _display_jdn(year, month, day):
    """显示年(公元前为负、无 0 年)→ JDN(1582-10-15 前按儒略历;民用历单源 civil_calendar,与四柱同一换算)。"""
    return civil_jdn_display(year, month, day)


def _parse_date_str(text):
    """'2026-01-19' / '-500-01-21' / '-12000-01-01 08:00' → (历史纪年, 月, 日)(民用历单源 parse_civil_date;
    不按定位切片截串 —— 五位年 '-12000-01-01' 截 11 位会把日截成 '0')。"""
    ay, m, d = parse_civil_date(text, 1)
    return display_year(ay), m, d


def _year_cn(year):
    digits = "".join(_CN_DIGITS[int(ch)] for ch in str(abs(year)))
    return f"公元前{digits}" if year < 0 else digits


def _zone_text(zone_hours):
    sign = "-" if zone_hours < 0 else "+"
    total = int(round(abs(zone_hours) * 60))
    return f"{sign}{total // 60:02d}:{total % 60:02d}"


def _nongli_year(year, zone_hours):
    from astrostudy.jieqi.NongLi import NongLi
    return NongLi({"year": str(year), "zone": _zone_text(zone_hours), "lat": "39n54", "lon": "116e28"}).compute()


def _lunar_full_domain(year, month, day, zone_hours=8.0):
    """域外农历:取该年(必要时次年)的农历月表,定所在月与日序。"""
    target = _display_jdn(year, month, day)
    for table_year in (year, _next_display_year(year)):
        months = _nongli_year(table_year, zone_hours).get("months") or []
        starts = [_display_jdn(*_parse_date_str(m.get("date"))) for m in months]
        for i, start in enumerate(starts):
            if start > target:
                break
            last = i == len(starts) - 1
            if last:
                break   # 月表最后一个月的长度未知,换次年月表(首月即此月)再定
            if target >= starts[i + 1]:
                continue
            mon = months[i]
            first_zheng = next((k for k, m in enumerate(months) if m.get("name") == "正月"), 0)
            lunar_year = _prev_display_year(table_year) if i < first_zheng else table_year
            size = "大" if starts[i + 1] - start >= 30 else "小"
            name = ("闰" if mon.get("leap") else "") + f"{mon.get('name')}"
            day_cn = _CN_DAYS[target - start]
            return {
                "text": f"{_year_cn(lunar_year)}年{name}{day_cn}日",
                "year": _year_cn(lunar_year),
                "month": f"{name}{size}",
                "day": day_cn,
            }
    return None


def _lunar_payload(year, month, day, hour, zone_hours=8.0, errs=None):
    if in_cnlunar_domain(year):
        lunar = cnlunar.Lunar(datetime.datetime(year, month, day, hour, 0))
        return {
            "text": f"{lunar.lunarYearCn}年{lunar.lunarMonthCn[:-1]}{lunar.lunarDayCn}日",
            "year": lunar.lunarYearCn,
            "month": lunar.lunarMonthCn,
            "day": lunar.lunarDayCn,
        }
    try:
        res = _lunar_full_domain(year, month, day, zone_hours)
    except Exception:
        traceback.print_exc()
        res = None
    if res is None and errs is not None:
        errs.append("lunarDate")      # 算不出如实落账(不静默写空)
    return res


def _ganzhi_payload(year, month, day, hour, after23=1, hour_gan_next=1, zone_hours=8.0, errs=None):
    # 🔴 四柱统一走权威 extreme_pillars(与八字/主链一致:天文年立春界/定气月/儒略JDN)。
    # cnlunar 域限 1~9999(BC datetime 越域)且远古口径异;现代域两者一致(已验 AD2026=丙午乙未
    # 甲午乙亥),故全域换权威=现代零回归+修 BC(旧:庚子癸未…≠八字乙未庚辰己卯)。
    # 日界/晚子时/时区改为读参(缺省仍 1/1/8.0 = 现状字节不变):此前恒取缺省 →
    # 全局选「24 点换日」时 23 点档的太玄日柱比八字页多跳一天;非 +08:00 时区的月柱/年柱在交节与
    # 立春前后 (8−时区) 小时内可能错一柱。起筮(种子)按钟表日期,不受此三键影响。
    try:
        from kin_year_domain import extreme_pillars
        _y, _m, _d, _h, _zi = extreme_pillars(year, month, day, hour, 0,
                                              after23=after23, hour_gan_next=hour_gan_next,
                                              zone_hours=zone_hours)
        return {"year": _y, "month": _m, "day": _d, "hour": _h, "raw": [_y, _m, _d, _h]}
    except Exception as exc:
        traceback.print_exc()
        reason = str(exc) or exc.__class__.__name__
    # 权威四柱算不出(星历缺失等):cnlunar 只认 1900–2099、不认日界 / 晚子时 / 时区 —— 域外不回落(整盘报错,
    # 不拿别的年份充数);域内回落时回包必须写明降级与被忽略的三个口径,不静默顶替。
    if not in_cnlunar_domain(year):
        raise ValueError("四柱算不出(%s)" % reason)
    lunar = cnlunar.Lunar(datetime.datetime(year, month, day, hour, 0))
    if errs is not None:
        errs.append("ganzhi")
    return {
        "year": lunar.year8Char,
        "month": lunar.month8Char,
        "day": lunar.day8Char,
        "hour": lunar.twohour8Char,
        "raw": [lunar.year8Char, lunar.month8Char, lunar.day8Char, lunar.twohour8Char],
        "degraded": {
            "source": "cnlunar",
            "reason": reason,
            "ignored": ["after23NewDay", "lateZiHourUseNextDay", "zone"],
            "note": "四柱权威口径不可用,已按 cnlunar 回落:日界 / 晚子时 / 时区未生效",
        },
    }


def _winter_solstice_full_domain(year, month, day, zone_hours=8.0):
    """冬至起算(全年份域):与 Taixuan.getdz_date / getdz 同一规则(本日早于本年冬至取上年冬至),冬至按定气时刻的当地日期。"""
    res = _nongli_year(year, zone_hours)
    cur = _display_jdn(year, month, day)
    picks = []
    for key in ("dongzi", "prevDongzi"):
        item = res.get(key) or {}
        txt = item.get("time") or item.get("date")
        if not txt:
            return None
        ymd = _parse_date_str(txt)
        picks.append((ymd, _display_jdn(*ymd)))
    (dz_ymd, dz_jdn), (pdz_ymd, pdz_jdn) = picks
    use_ymd, use_jdn = (pdz_ymd, pdz_jdn) if cur < dz_jdn else (dz_ymd, dz_jdn)
    y, m, d = use_ymd
    return {"date": format_display_date(y, m, d), "days": cur - use_jdn}


def _winter_solstice_payload(year, month, day, hour, zone_hours=8.0, errs=None):
    """冬至起算一律走全年份域件(定气时刻的当地日期)。

    cnlunar 历表域内(1900–2099)按北京时间算,与 vendor 核心 getdz_date / getdz 逐字相同(1901–2099 逐年对拍);
    唯独 1900 年冬至前,「上一个冬至」落在 1899 年、出了 vendor 节气表的域,核心算成 1899-12-21(实为 12-22 08:56),
    天数多 1,且与前一天(1899-12-31,域外件)的天数跳 2。全年份域件失败时才回落 vendor 核心(仅域内)。
    """
    in_domain = in_cnlunar_domain(year)
    try:
        res = _winter_solstice_full_domain(year, month, day, 8.0 if in_domain else zone_hours)
        if res:
            return res
    except Exception:
        traceback.print_exc()
    if in_domain:
        tx = taixuan_core.Taixuan(year, month, day, hour)
        return {
            "date": tx.getdz_date().strftime("%Y-%m-%d"),
            "days": tx.getdz(),
        }
    if errs is not None:
        errs.append("winterSolstice")
    return None


def _calculate(year, month, day, hour, seed):
    tx = taixuan_core.Taixuan(year, month, day, hour)
    zhou, zhan_number, digits = _with_seed(seed, tx.qigua_number)
    gua_number = int(zhou)
    gua_details = taixuan_core.taixuandict.get(gua_number) or {}
    gua = gua_details.get("卦") or {}
    if not gua:
        raise ValueError(f"taixuan hexagram not found: {gua_number}")

    period = _period_for_hour(hour)
    cnums = [DIGIT_LABELS.get(item, str(item)) for item in digits]
    head = "{}方{}州{}部{}家".format(cnums[0], cnums[1], cnums[2], cnums[3])
    xzlist = {
        "一家": 1, "二家": 2, "三家": 3,
        "一部": 0, "二部": 3, "三部": 6,
        "一州": 0, "二州": 9, "三州": 18,
        "一方": 0, "二方": 27, "三方": 54,
    }
    xuan_head = xzlist.get(head[0:2]) + xzlist.get(head[2:4]) + xzlist.get(head[4:6]) + xzlist.get(head[6:8])
    xuan_yinyang = taixuan_core.yy(xuan_head)
    head_relation = {"陽": "从", "陰": "违"}.get(xuan_yinyang)
    judgment = DIVINE_YINYANG.get(period + xuan_yinyang, ["—", "—", "—"])
    zhan_base = (xuan_head - 1) * 9
    biao_base = (xuan_head - 1) * 3
    xuan_zan = zhan_base // 2
    lodge = dict(zip(list(range(365)), taixuan_core.yearsu)).get(xuan_zan)
    selected_names = PERIOD_LINES.get(period, [])
    selected_lines = [{"name": name, "content": gua_details.get(name, "")} for name in selected_names]
    all_lines = [{"name": name, "content": gua_details.get(name, "")} for name in LINE_ORDER]
    gua_name = list(gua.keys())[0]
    gua_text = list(gua.values())[0]
    four_places = [
        {
            "key": POSITION_LABELS[idx],
            "value": value,
            "label": f"{DIGIT_LABELS.get(value, value)}{POSITION_LABELS[idx]}",
            "symbol": LINE_SYMBOLS.get(str(value), ""),
        }
        for idx, value in enumerate(digits)
    ]
    return {
        "guaNumber": gua_number,
        "digits": digits,
        "zhou": zhou,
        "zhanNumber": zhan_number,
        "gua": {"name": gua_name, "text": gua_text},
        "period": period,
        "fourPlaces": four_places,
        "head": head,
        "xuanHead": {
            "number": xuan_head,
            "yinYang": xuan_yinyang,
            "relation": head_relation,
            "method": judgment[0],
            "sequence": judgment[1],
            "judgment": judgment[2],
            "zhanBase": zhan_base,
            "biaoBase": biao_base,
            "xuanZan": xuan_zan,
        },
        "starLodge": {"text": f"{lodge}度" if lodge else "—", "raw": lodge},
        "selectedLines": selected_lines,
        "allLines": all_lines,
        "raw": _json_safe(gua_details),
    }


def _build_sections(payload):
    gz = payload.get("ganzhi", {})
    tx = payload.get("taixuan", {})
    xh = tx.get("xuanHead", {})
    winter = payload.get("winterSolstice") or {}
    sections = [
        {
            "title": "起盘",
            "rows": [
                _row("起筮时间", f"{payload.get('dateStr')} {payload.get('hour', 0):02d}时"),
                _row("农历", (payload.get("lunarDate") or {}).get("text")),
                _row("年柱", gz.get("year")),
                _row("月柱", gz.get("month")),
                _row("日柱", gz.get("day")),
                _row("时柱", gz.get("hour")),
                _row("起筮时段", tx.get("period")),
                _row("起筮种子", payload.get("seed")),
                _row("冬至起算", winter.get("date")),
                _row("距冬至日", f"{winter.get('days')}日" if winter.get("days") is not None else None),
            ],
        },
        {
            "title": "玄首",
            "rows": [
                _row("筮得", tx.get("zhou")),
                _row("首序", tx.get("guaNumber")),
                _row("占位", tx.get("zhanNumber")),
                _row("首", tx.get("gua", {}).get("name")),
                _row("首辞", tx.get("gua", {}).get("text")),
                _row("方州部家", tx.get("head")),
                _row("玄首", f"{xh.get('number')}，{xh.get('relation')}"),
                _row("阴阳", xh.get("yinYang")),
                _row("起筮法", xh.get("method")),
                _row("休咎序", xh.get("sequence")),
                _row("休咎", xh.get("judgment")),
                _row("赞基", xh.get("zhanBase")),
                _row("表基", xh.get("biaoBase")),
                _row("玄赞", xh.get("xuanZan")),
                _row("星宿", tx.get("starLodge", {}).get("text")),
            ],
        },
        {
            "title": "方州部家",
            "rows": [_row("筮数", tx.get("digits"))] + [_row(item.get("key"), item.get("label")) for item in tx.get("fourPlaces", [])],
        },
        {
            "title": "表",
            "rows": [_row(item.get("name"), item.get("content")) for item in tx.get("selectedLines", [])],
        },
    ]
    degraded = gz.get("degraded") if isinstance(gz, dict) else None
    if degraded:
        sections[0]["rows"].append(_row("四柱口径", degraded.get("note")))
    return sections


def build_taixuan_pan(data):
    """起筮请求体 → 归一化盘(纯函数;pan() 与测试共用)。"""
    # 🔴 raw_year=原始年:四柱(权威 extreme_pillars)、种子、农历 / 冬至(域内 cnlunar、域外全年份域农历件)都按它。
    #    calc_year 只是给 Taixuan 构造器的占位年(起卦只吃种子,与年份无关);此前农历 / 冬至也用钳过的年
    #    (1900–2100),1900 年前 / 公元前显示成 1900 年,2100 年起 cnlunar 越界整盘失败。
    raw_year = _to_int(data.get("year"), 2026)
    if raw_year == 0:
        raise ValueError("year 0 does not exist")
    calc_year = max(CNLUNAR_MIN_YEAR, min(CNLUNAR_MAX_YEAR, raw_year))
    month = max(1, min(12, _to_int(data.get("month"), 1)))
    day = max(1, min(31, _to_int(data.get("day"), 1)))
    hour = max(0, min(23, _to_int(data.get("hour"), 0)))
    seed = _to_int(data.get("seed"), raw_year * 1000000 + month * 10000 + day * 100 + hour)
    # 日界/晚子时/时区:缺省 1/1/+08:00 = 旧行为,前端不带时字节不变。
    after23 = 1 if _to_int(data.get("after23NewDay"), 1) else 0
    hour_gan_next = 1 if _to_int(data.get("lateZiHourUseNextDay"), 1) else 0
    zone_hours = _zone_to_hours(data.get("zone"))
    if not civil_ymd_valid(raw_year, month, day):
        # 民用历单源判「这一天有没有」:1582 年以前按儒略历(1500-02-29 有)、1582-10-05..14 没有
        raise ValueError("invalid day")
    partial_errors = []

    taixuan = _calculate(calc_year, month, day, hour, seed)
    normalized = {
        "source": "taixuanshifa",
        "engine": "taixuanshifa",
        "dateStr": data.get("date", format_display_date(raw_year, month, day)),
        "timeStr": data.get("time", f"{hour:02d}:00:00"),
        "year": raw_year,
        "month": month,
        "day": day,
        "hour": hour,
        "seed": seed,
        "lunarDate": _lunar_payload(raw_year, month, day, hour, zone_hours, errs=partial_errors),
        "ganzhi": _ganzhi_payload(raw_year, month, day, hour, after23, hour_gan_next, zone_hours, errs=partial_errors),
        "winterSolstice": _winter_solstice_payload(raw_year, month, day, hour, zone_hours, errs=partial_errors),
        "taixuan": taixuan,
        "classics": _source_sections(),
        "capabilities": {
            "inputs": ["date", "time", "hour", "seed"],
            "outputs": [
                "guaNumber", "zhou", "digits", "zhanNumber", "xuanHead", "xuanZan",
                "zhanBase", "biaoBase", "fourPlaces", "period", "starLodge",
                "selectedLines", "allLines", "winterSolstice", "readme",
            ],
        },
    }
    if partial_errors:
        normalized["partialErrors"] = partial_errors
    normalized["sections"] = _build_sections(normalized)
    normalized["snapshot"] = _build_snapshot(normalized)
    return normalized


class TaiXuanSrv:
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
            normalized = build_taixuan_pan(data)
            return jsonpickle.encode({"ResultCode": 0, "Result": normalized}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "taixuan calculation failed"}, unpicklable=False)
