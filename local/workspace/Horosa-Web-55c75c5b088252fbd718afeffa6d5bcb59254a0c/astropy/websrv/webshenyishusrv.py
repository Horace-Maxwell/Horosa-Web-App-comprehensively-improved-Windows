import os
import sys
import traceback
from numbers import Integral, Real

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain


_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_HOROSA_WEB_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_SHENYISHU_SRC = os.path.join(_HOROSA_WEB_ROOT, "vendor", "shenyishu")


def _import_shenyishu():
    """Import shenyishu in isolation so vendor top-level modules stay contained."""
    previous_modules = {name: sys.modules.get(name) for name in ("shenyishu",)}
    for name in previous_modules:
        sys.modules.pop(name, None)
    inserted = False
    if _SHENYISHU_SRC not in sys.path:
        sys.path.insert(0, _SHENYISHU_SRC)
        inserted = True
    old_dont_write_bytecode = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        import shenyishu as shenyishu_core  # noqa: E402
        return shenyishu_core
    finally:
        sys.dont_write_bytecode = old_dont_write_bytecode
        for name, module in previous_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module
        if inserted:
            try:
                sys.path.remove(_SHENYISHU_SRC)
            except ValueError:
                pass


shenyishu_core = _import_shenyishu()


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


_DISPLAY_REPLACEMENTS = {
    "時": "时",
    "總": "总",
    "連": "连",
    "歸": "归",
    "兌": "兑",
    "離": "离",
    "陽": "阳",
    "陰": "阴",
    "數": "数",
    "強": "强",
    "於": "于",
    "將": "将",
    "賊": "贼",
    "個": "个",
    "軍": "军",
    "判斷": "判断",
    "參": "参",
    "謹": "谨",
    "擇": "择",
    "臨": "临",
    "貴": "贵",
    "驛": "驿",
    "馬": "马",
    "財": "财",
    "祿": "禄",
    "殺": "杀",
    "寶": "宝",
    "帶": "带",
}


def _display_text(value):
    text = _clean_text(value)
    for old, new in _DISPLAY_REPLACEMENTS.items():
        text = text.replace(old, new)
    return text


def _normalize_season(value, month=None):
    text = _display_text(value)
    if text in ("春", "夏", "秋", "冬"):
        return text
    try:
        m = int(month or 0)
    except Exception:
        m = 0
    if m in (3, 4, 5):
        return "春"
    if m in (6, 7, 8):
        return "夏"
    if m in (9, 10, 11):
        return "秋"
    return "冬"


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
    return _display_text(value).replace("None", "无")


def _row(label, value):
    return {"label": label, "value": _format_value(value) or "—"}


def _read_vendor_text(filename, fallback=""):
    path = os.path.join(_SHENYISHU_SRC, filename)
    if not os.path.isfile(path):
        return fallback
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read().strip()
    return content or fallback


def _line(label, value, extra=None):
    item = {"label": label, "value": _format_value(value) or "—"}
    if extra:
        item.update(extra)
    return item


def _source_sections():
    readme = _read_vendor_text("README.md", "暂无 README 内容。")
    zh = readme
    if "## English" in zh:
        zh = zh.split("## English", 1)[0].strip()
    feature = ""
    if "### 功能特色" in readme and "### 安裝" in readme:
        feature = readme.split("### 功能特色", 1)[1].split("### 安裝", 1)[0].strip()
    usage = ""
    if "### API 參數" in readme and "### 系統依賴" in readme:
        usage = readme.split("### API 參數", 1)[1].split("### 系統依賴", 1)[0].strip()
    license_note = ""
    if "## 授權" in readme:
        license_note = readme.split("## 授權", 1)[1].strip()
    return {
        "meta": [{
            "key": "shenyishu_readme",
            "title": "shenyishu 来源内容",
            "author": "Ken Tang / kentang2017",
            "description": "上游未提供独立 LICENSE 文件；README 标注项目仅供学术研究与文化传承之用。",
        }],
        "selectedKey": "shenyishu_readme",
        "sections": [
            {"title": "导读", "content": zh},
            {"title": "功能特色", "content": feature or "神易数兵占包含干支、八卦五行、主客、神煞与吉凶评分。"},
            {"title": "API 参数", "content": usage or "year、month、day、hour。"},
            {"title": "授权说明", "content": license_note or "上游未提供独立开源许可证文件。"},
        ],
        "links": [
            {"name": "shenyishu", "url": "https://github.com/kentang2017/shenyishu", "description": "kentang2017 神易数兵占 Python 项目。"},
            {"name": "sxtwl", "url": "https://pypi.org/project/sxtwl/", "description": "上游使用的寿星天文历依赖。"},
        ],
    }


def _normalize_result(raw, year, month, day, hour, minute, second, date_str, time_str, hour_source, season_source, season):
    result = _json_safe(raw)
    ganzhi = result.get("干支", {}) or {}
    wuxing = result.get("五行", {}) or {}
    zongshu = result.get("總數分析", {}) or {}
    zhuke = result.get("主客判斷", {}) or {}
    shensha = result.get("神煞", {}) or {}
    changsheng = result.get("長生", {}) or {}
    jixiong = result.get("吉凶", {}) or {}

    pillars = []
    pillar_labels = {"年": "年柱", "月": "月柱", "日": "日柱", "時": "时柱"}
    pillar_codes = []
    for key in ("年", "月", "日", "時"):
        gz_value = ganzhi.get(key)
        code = shenyishu_core.get_jiazi_code(gz_value)
        pillars.append({
            "key": key,
            "label": pillar_labels.get(key, f"{key}柱"),
            "ganzhi": gz_value,
            "wuxing": wuxing.get(key),
            "code": code,
        })
        pillar_codes.append({
            "key": key,
            "label": pillar_labels.get(key, f"{key}柱"),
            "ganzhi": gz_value,
            "code": code,
        })

    roles = []
    role_names = {"百位": "主将", "十位": "我兵", "個位": "贼寇"}
    role_labels = {"百位": "百位", "十位": "十位", "個位": "个位"}
    for key in ("百位", "十位", "個位"):
        item = zongshu.get(key, {}) or {}
        roles.append({
            "key": role_labels.get(key, key),
            "role": role_names.get(key, key),
            "number": item.get("數"),
            "gua": _display_text(item.get("卦")),
            "yinyang": {"陽": "阳", "陰": "阴"}.get(item.get("陰陽"), item.get("陰陽")),
        })

    # [X1] 貴人表仅甲/乙年干支载(vendor 上游残表);未载返 None → 诚实标「原表未载」,不伪造卦名。
    shensha_items = [{"label": _display_text(key), "value": _display_text(value) or "原表未载"} for key, value in shensha.items()]
    year_gz = ganzhi.get("年", "")
    shensha_items.append({"label": "正禄羊刃", "value": _display_text(shenyishu_core.get_zhenglu_yangren(year_gz))})
    shensha_items.append({"label": "饮泉食谷", "value": "是" if shenyishu_core.is_yinquan_shigu(year_gz) else "否"})
    changsheng_items = [{"label": pillar_labels.get(key, f"{key}柱"), "value": [_display_text(item) for item in value]} for key, value in changsheng.items()]
    zhuke_display = {
        "結論": _display_text(zhuke.get("結論")),
        "分析": [_display_text(item) for item in zhuke.get("分析", [])],
    }
    jixiong_display = {
        "level": _display_text(jixiong.get("level")),
        "score": jixiong.get("score"),
        "detail": _display_text(jixiong.get("detail")),
        "reasons": [_display_text(item) for item in jixiong.get("reasons", [])],
    }
    total = result.get("總數")
    total_digits = [int(ch) for ch in str(total) if ch.isdigit()]
    digit_gua = [{"digit": digit, "gua": _display_text(shenyishu_core.num_to_gua(digit))} for digit in total_digits]
    formula = " + ".join([f"{item.get('label')} {item.get('ganzhi')}={item.get('code')}" for item in pillar_codes])
    season_strength = [{"label": key, "value": value} for key, value in shenyishu_core.get_wuxing_strength(season).items()]
    wuxing_rules = {
        "sheng": [_display_text(item) for item in shenyishu_core.get_wuxing_sheng()],
        "ke": [_display_text(item) for item in shenyishu_core.get_wuxing_ke()],
        "season": season,
        "seasonSource": season_source,
        "seasonStrength": season_strength,
    }
    normalized = {
        "source": "shenyishu",
        "engine": "shenyishu",
        "dateStr": date_str,
        "timeStr": time_str,
        "hour": hour,
        "minute": minute,
        "second": second,
        "hourSource": hour_source,
        "seasonSource": season_source,
        "season": season,
        "birth": f"{year}年{month}月{day}日{hour}时",
        "shenyishu": {
            "pillars": pillars,
            "pillarCodes": pillar_codes,
            "total": total,
            "totalFormula": formula,
            "digitGua": digit_gua,
            "roles": roles,
            "zhuke": zhuke_display,
            "lianshan": _display_text(result.get("連山卦")),
            "guicang": _display_text(result.get("歸藏卦")),
            "bagua": [_display_text(item) for item in result.get("八卦", [])],
            "wuxing": wuxing,
            "wuxingRules": wuxing_rules,
            "shensha": shensha_items,
            "changsheng": changsheng_items,
            "jixiong": jixiong_display,
            "raw": result,
        },
        "classics": _source_sections(),
        "capabilities": {
            "inputs": ["year", "month", "day", "hour"],
            "options": ["hourSource", "manualHour", "seasonSource", "manualSeason"],
            "outputs": ["fourPillars", "jiaziCodes", "wuxing", "wuxingRules", "seasonStrength", "total", "totalFormula", "lianshan", "guicang", "bagua", "digitGua", "roles", "zhuke", "shensha", "changsheng", "jixiong", "readme"],
        },
    }
    normalized["sections"] = _build_sections(normalized)
    normalized["snapshot"] = _build_snapshot(normalized)
    return normalized


def _build_sections(payload):
    ss = payload.get("shenyishu", {}) or {}
    jixiong = ss.get("jixiong", {}) or {}
    zhuke = ss.get("zhuke", {}) or {}
    return [
        {
            "title": "起盘",
            "rows": [
                _row("起盘时间", f"{payload.get('dateStr', '')} {payload.get('timeStr', '')}".strip()),
                _row("生辰", payload.get("birth")),
                _row("计时", "手动小时" if payload.get("hourSource") == "manual" else "自动取小时"),
                _row("入式小时", f"{payload.get('hour')}时"),
                _row("季令", f"{payload.get('season')}（{'手动' if payload.get('seasonSource') == 'manual' else '自动'}）"),
            ],
        },
        {
            "title": "干支与五行",
            "rows": [_row(item.get("label"), f"{item.get('ganzhi')}（{item.get('wuxing')}，数码 {item.get('code')}）") for item in ss.get("pillars", [])],
        },
        {
            "title": "神卦",
            "rows": [
                _row("总数", ss.get("total")),
                _row("数码公式", ss.get("totalFormula")),
                _row("连山卦", ss.get("lianshan")),
                _row("归藏卦", ss.get("guicang")),
                _row("八卦", ss.get("bagua")),
                _row("逐数取卦", [f"{item.get('digit')}→{item.get('gua')}" for item in ss.get("digitGua", [])]),
            ],
        },
        {
            "title": "五行法则",
            "rows": [
                _row("相生", (ss.get("wuxingRules") or {}).get("sheng")),
                _row("相克", (ss.get("wuxingRules") or {}).get("ke")),
                _row("季令旺衰", [f"{item.get('label')}：{item.get('value')}" for item in (ss.get("wuxingRules") or {}).get("seasonStrength", [])]),
            ],
        },
        {
            "title": "兵占",
            "rows": [
                _row(item.get("role"), f"{item.get('key')} {item.get('number')} → {item.get('gua')}，{item.get('yinyang')}数")
                for item in ss.get("roles", [])
            ],
        },
        {
            "title": "主客判断",
            "rows": [
                _row("结论", zhuke.get("結論")),
                _row("分析", zhuke.get("分析")),
            ],
        },
        {
            "title": "神煞",
            "rows": [_row(item.get("label"), item.get("value")) for item in ss.get("shensha", [])],
        },
        {
            "title": "长生",
            "rows": [_row(item.get("label"), item.get("value")) for item in ss.get("changsheng", [])],
        },
        {
            "title": "吉凶",
            "rows": [
                _row("等级", jixiong.get("level")),
                _row("评分", jixiong.get("score")),
                _row("结论", jixiong.get("detail")),
                _row("理由", jixiong.get("reasons")),
            ],
        },
    ]


def _build_snapshot(payload):
    lines = []
    for section in payload.get("sections", []):
        lines.append(f"[{section.get('title', '')}]")
        for row in section.get("rows", []):
            lines.append(f"{row.get('label')}：{row.get('value')}")
        lines.append("")
    return "\n".join(lines).strip()


class ShenYiShuSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{"tools.cors.on": True})
    @cherrypy.tools.json_in()
    def pan(self, **params):
        enable_crossdomain()
        try:
            if cherrypy.request.method == "OPTIONS":
                return jsonpickle.encode({"ResultCode": 0, "Result": "ok"}, unpicklable=False)
            data = dict(params or {})
            data.update(getattr(cherrypy.request, "json", None) or {})
            year = _to_int(data.get("year"), 2023)
            month = _to_int(data.get("month"), 7)
            day = _to_int(data.get("day"), 4)
            minute = _to_int(data.get("minute"), 0)
            second = _to_int(data.get("second"), 0)
            hour_source = _clean_text(data.get("hourSource"), "auto")
            raw_hour = data.get("manualHour") if hour_source == "manual" else data.get("hour")
            hour = max(0, min(23, _to_int(raw_hour, 0)))
            season_source = _clean_text(data.get("seasonSource"), "auto")
            raw_season = data.get("manualSeason") if season_source == "manual" else ""
            season = _normalize_season(raw_season, month)
            date_str = data.get("date") or f"{year:04d}-{month:02d}-{day:02d}"
            time_str = data.get("time") or f"{hour:02d}:{minute:02d}:{second:02d}"
            # [X1] lateZiHourUseNextDay 全局开关透传(默认 1=旧行为字节不变)。
            result = shenyishu_core.Shenyishu(year, month, day, hour, _to_int(data.get("after23NewDay"), 1), _to_int(data.get("lateZiHourUseNextDay"), 1)).get_bingzhan_result()
            normalized = _normalize_result(result, year, month, day, hour, minute, second, date_str, time_str, hour_source, season_source, season)
            return jsonpickle.encode({"ResultCode": 0, "Result": normalized}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "shenyishu calculation failed"}, unpicklable=False)
