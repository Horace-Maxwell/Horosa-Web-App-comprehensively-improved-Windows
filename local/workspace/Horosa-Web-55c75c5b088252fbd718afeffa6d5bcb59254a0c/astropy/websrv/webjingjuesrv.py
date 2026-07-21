import os
import random
import re
import sys
import traceback
from numbers import Integral, Real

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain


_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_HOROSA_WEB_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_JINGJUE_SRC = os.path.join(_HOROSA_WEB_ROOT, "vendor", "jingjue")


def _import_jingjue():
    """Import jingjue in isolation so its top-level gua_dict module does not leak."""
    previous_modules = {name: sys.modules.get(name) for name in ("gua_dict", "jingjue")}
    for name in previous_modules:
        sys.modules.pop(name, None)
    inserted = False
    if _JINGJUE_SRC not in sys.path:
        sys.path.insert(0, _JINGJUE_SRC)
        inserted = True
    old_dont_write_bytecode = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        import gua_dict as jingjue_gua_dict  # noqa: E402
        import jingjue as jingjue_core  # noqa: E402
        return jingjue_gua_dict, jingjue_core
    finally:
        sys.dont_write_bytecode = old_dont_write_bytecode
        for name, module in previous_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module
        if inserted:
            try:
                sys.path.remove(_JINGJUE_SRC)
            except ValueError:
                pass


jingjue_gua_dict, jingjue_core = _import_jingjue()


POSITION_LABELS = ["上分", "中分", "下分"]
REMAINDER_LABELS = {1: "一", 2: "二", 3: "三", 4: "四"}
GUA_KEYWORDS = {
    "甲": {"keyword": "穷奇升天，中道而惊", "english": "Danger mid-journey; beware of powerful spirits"},
    "乙": {"keyword": "龙处于泽，欲登于天", "english": "Dragon ascending from the marsh; joyful occasion"},
    "丙": {"keyword": "有鸟将来，文身翠翼", "english": "Colorful bird arriving; happiness without limit"},
    "丁": {"keyword": "百事顺成，美人相知", "english": "All affairs succeed; a beautiful meeting of minds"},
    "戊": {"keyword": "冥冥之海，独得其光", "english": "Light amid darkness; noble arrival foretold"},
    "己": {"keyword": "泰官甚敬，身独遇恶", "english": "Honours without, hardship within; inauspicious"},
    "壬": {"keyword": "凤鸟不处，洋洋四国", "english": "The Phoenix alights nowhere; efforts go unrewarded"},
    "癸": {"keyword": "玄鸟朝飞，洋洋翠羽", "english": "The dark swallow soars; a person of promise draws near"},
    "子": {"keyword": "善哉首，如登高台", "english": "A fine beginning; a distant traveller returns"},
    "丑": {"keyword": "道路瞩望，美人不来", "english": "Watching the road in vain; obstacles block the way"},
    "寅": {"keyword": "山有玄木，劳心将死", "english": "Dark wood on the mountain; toil without recognition"},
    "卯": {"keyword": "蔼蔼者云，蔽天白日", "english": "Clouds veil the sun; desired meeting fails"},
    "辰": {"keyword": "玄龙在渊，嘉宾将来", "english": "Black dragon in the deep; honoured guest arrives"},
    "巳": {"keyword": "时命将合，百事皆成", "english": "Destined union; all endeavours meet with success"},
    "午": {"keyword": "前如凶，后乃吉光", "english": "Hardship before, brightness after; a turning point"},
    "未": {"keyword": "释哉心乎，翩翩飞鹄", "english": "The heart unsettled; prayers go unanswered"},
}


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


def _read_vendor_text(filename, fallback=""):
    path = os.path.join(_JINGJUE_SRC, filename)
    if not os.path.isfile(path):
        return fallback
    with open(path, "r", encoding="utf-8") as fh:
        content = fh.read().strip()
    return content or fallback


def _with_seed(seed, func):
    state = random.getstate()
    try:
        random.seed(seed)
        return func()
    finally:
        random.setstate(state)


def _verdict(text):
    # [X1] 末句显式定谳优先:古文正文常带语境性吉凶字(「凶事盡除」「前如凶,後乃吉光」),
    # 全文单字双扫会把明写「吉。」终判的卦误报「吉凶并见」;结尾 大/小吉凶 直接采信,无终判才回落旧扫描。
    t = (text or "").strip()
    m = re.search(r"([大小]?[吉凶])[。．\s]*$", t)
    if m:
        return m.group(1)
    has_ji = "吉" in t
    has_xiong = "凶" in t
    if has_ji and has_xiong:
        return "吉凶并见"
    if has_ji:
        return "吉"
    if has_xiong:
        return "凶"
    return "未明"


def _spirit_note(text):
    # [X1·P2-31] 旧版自最后一个「祟」字起向后切片:「X為祟」句式丢主语出垃圾(如丢「泰父」只剩「祟,凶」)。
    # 改取【含祟之整句】(以。断句),保住「泰父為祟」类完整表述;无祟句回落 —。
    t = text or ""
    if "祟" not in t:
        return "—"
    sentences = [seg.strip("，；; ") for seg in t.split("。") if "祟" in seg]
    if not sentences:
        return "—"
    return "。".join(sentences).strip("。，；; ")


def _gua_table():
    table = []
    for key, item in jingjue_gua_dict.gua_dict.items():
        name, text = item
        meta = GUA_KEYWORDS.get(name, {})
        table.append({
            "key": key,
            "name": name,
            "verdict": _verdict(text),
            "spirit": _spirit_note(text),
            "keyword": meta.get("keyword", text.split("。", 1)[0]),
            "english": meta.get("english", ""),
            "text": text,
            "summary": text.split("。", 1)[0],
        })
    return table


def _cast(seed):
    def _run():
        stalks_first = 30
        divider = sorted(random.sample(range(10, stalks_first), 1))[0]
        top_count = divider - 10
        # [X1·P2-32] divider=10 时 top=0(同类物理不可能):仅无效时合法域重抽,有效种子字节不变。
        if top_count < 1:
            top_count = sorted(random.sample(range(1, 20), 1))[0]
        remainder_pool = stalks_first - top_count
        lower_cut = sorted(random.sample(range(1, 17), 1))[0]
        # [X1·P2-32] top>13 时 pool<17,旧抽样可产负/零中分(30 算实分三堆物理不可能):
        # 仅首抽无效时在合法域重抽 —— 有效种子字节不变,4.7% 垃圾态转为合法分堆。
        if remainder_pool - lower_cut < 1:
            lower_cut = sorted(random.sample(range(1, max(2, remainder_pool)), 1))[0]
        middle_count = remainder_pool - lower_cut
        bottom_count = lower_cut
        counts = [top_count, middle_count, bottom_count]
        remainders = [count % 4 or 4 for count in counts]
        key = "".join(str(item) for item in remainders)
        gua = jingjue_gua_dict.gua_dict.get(key)
        if not gua:
            raise ValueError(f"jingjue gua not found: {key}")
        name, text = gua
        gua_meta = GUA_KEYWORDS.get(name, {})
        groups = []
        for idx, count in enumerate(counts):
            rem = remainders[idx]
            groups.append({
                "key": POSITION_LABELS[idx],
                "count": count,
                "remainder": rem,
                "label": f"{POSITION_LABELS[idx]}：{count}算，余{REMAINDER_LABELS.get(rem, rem)}",
            })
        return {
            "seed": seed,
            "method": "三十算分三",
            "key": key,
            "divider": divider,
            "lowerCut": lower_cut,
            "groups": groups,
            "remainders": remainders,
            "gua": {
                "name": name,
                "text": text,
                "verdict": _verdict(text),
                "spirit": _spirit_note(text),
                "keyword": gua_meta.get("keyword", text.split("。", 1)[0]),
                "english": gua_meta.get("english", ""),
            },
            "allGua": _gua_table(),
            "raw": _json_safe(gua),
        }

    return _with_seed(seed, _run)


def _source_sections():
    readme = _read_vendor_text("README.md", "暂无 README 内容。")
    intro_marker = "## **1. 導讀"
    gua_marker = "## **2. 十六卦"
    install_marker = "## **3. 安裝"
    refs_marker = "## **6. 參考資料"
    intro = readme
    if intro_marker in readme and gua_marker in readme:
        intro = readme.split(intro_marker, 1)[1].split(gua_marker, 1)[0].strip()
    gua_overview = ""
    if gua_marker in readme and install_marker in readme:
        gua_overview = readme.split(gua_marker, 1)[1].split(install_marker, 1)[0].strip()
    refs = ""
    if refs_marker in readme:
        refs = readme.split(refs_marker, 1)[1].strip()
    link_lines = [
        "jingjue：kentang2017 荆诀 Python 项目（https://github.com/kentang2017/jingjue）",
        "PyPI jingjue：上游 README 中列出的 PyPI 包页面（https://pypi.org/project/jingjue/）",
    ]
    return {
        "meta": [{
            "key": "jingjue_readme",
            "title": "jingjue 来源内容",
            "author": "Ken Tang / kentang2017",
            "description": "上游未提供单独古籍 Markdown；星阙从 README、核心十六卦字典与参考资料中整理展示。",
        }],
        "selectedKey": "jingjue_readme",
        "sections": [
            {"title": "导读", "content": intro},
            {"title": "十六卦一览", "content": gua_overview or "十六卦内容已整理在“十六卦”页。"},
            {"title": "参考资料", "content": refs or "暂无参考资料。"},
            {"title": "相关项目", "content": "\n".join(link_lines)},
        ],
        "links": [
            {"name": "jingjue", "url": "https://github.com/kentang2017/jingjue", "description": "kentang2017 荆诀 Python 项目。"},
            {"name": "PyPI jingjue", "url": "https://pypi.org/project/jingjue/", "description": "上游 README 中列出的 PyPI 包页面。"},
        ],
    }


def _build_sections(payload):
    cast = payload.get("jingjue", {})
    gua = cast.get("gua", {})
    groups = cast.get("groups", [])
    return [
        {
            "title": "起课",
            "rows": [
                _row("起课时间", f"{payload.get('dateStr', '')} {payload.get('timeStr', '')}".strip()),
                _row("起课方式", cast.get("method")),
                _row("起筮种子", payload.get("seed")),
                _row("卦键", cast.get("key")),
                _row("三分余数", cast.get("remainders")),
                _row("第一次分界", cast.get("divider")),
                _row("下分截数", cast.get("lowerCut")),
            ],
        },
        {
            "title": "卦辞",
            "rows": [
                _row("干卦", gua.get("name")),
                _row("吉凶", gua.get("verdict")),
                _row("关键词", gua.get("keyword")),
                _row("英文提示", gua.get("english")),
                _row("祟提示", gua.get("spirit")),
                _row("卦义", gua.get("text")),
            ],
        },
        {
            "title": "三分",
            "rows": [_row(item.get("key"), item.get("label")) for item in groups],
        },
        {
            "title": "十六卦",
            "rows": [_row(item.get("name"), f"{item.get('key')}｜{item.get('verdict')}｜{item.get('keyword')}") for item in cast.get("allGua", [])],
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


class JingJueSrv:
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
            seed = _to_int(data.get("seed"), random.randint(0, 999999999))
            seed = max(0, min(999999999, seed))
            year = _to_int(data.get("year"), 0)
            month = _to_int(data.get("month"), 0)
            day = _to_int(data.get("day"), 0)
            hour = _to_int(data.get("hour"), 0)
            minute = _to_int(data.get("minute"), 0)
            second = _to_int(data.get("second"), 0)
            date_str = data.get("date") or (f"{year:04d}-{month:02d}-{day:02d}" if year and month and day else "")
            time_str = data.get("time") or f"{hour:02d}:{minute:02d}:{second:02d}"
            cast = _cast(seed)
            normalized = {
                "source": "jingjue",
                "engine": "jingjue",
                "dateStr": date_str,
                "timeStr": time_str,
                "seed": seed,
                "jingjue": cast,
                "classics": _source_sections(),
                "capabilities": {
                    "inputs": ["seed", "date", "time"],
                    "outputs": ["gua", "key", "remainders", "groups", "keywords", "allGua", "readme", "references"],
                },
            }
            normalized["sections"] = _build_sections(normalized)
            normalized["snapshot"] = _build_snapshot(normalized)
            return jsonpickle.encode({"ResultCode": 0, "Result": normalized}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "jingjue calculation failed"}, unpicklable=False)
