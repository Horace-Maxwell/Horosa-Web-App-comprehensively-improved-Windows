import traceback
from datetime import datetime

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain
from websrv.kentang.kinastro_common import (
    authoritative_pillars,
    build_snapshot,
    clean_text,
    display_text,
    ensure_kinastro_path,
    gender_cn,
    json_safe,
    kinastro_source_sections,
    parse_datetime,
    row,
    to_int,
)


ensure_kinastro_path()

from astro.shaozi import calculate_ganzhi_from_datetime  # noqa: E402
from astro.tieban import TieBanBirthData, TieBanDiviner  # noqa: E402
from astro.tieban.tieban_calculator import Ganzhi  # noqa: E402


METHOD_OPTIONS = [
    {"value": "kunji", "label": "扣入法"},
    {"value": "suanpan", "label": "算盘打数"},
]
GANZHI_STEMS = "甲乙丙丁戊己庚辛壬癸"
GANZHI_BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
PALACE_ORDER = ["命宫", "兄弟宫", "夫妻宫", "子女宫", "财帛宫", "疾厄宫", "迁移宫", "交友宫", "官禄宫", "田宅宫", "福德宫", "父母宫"]


def _normalize_ganzhi(value, fallback):
    text = clean_text(value)
    if len(text) == 2 and text[0] in GANZHI_STEMS and text[1] in GANZHI_BRANCHES:
        return text
    return fallback


def _ganzhi_obj(text):
    text = _normalize_ganzhi(text, "甲子")
    return Ganzhi(text[0], text[1])


def _method_label(method):
    return next((item["label"] for item in METHOD_OPTIONS if item["value"] == method), "扣入法")


def _year_dt(value):
    year = to_int(value, 0)
    if year <= 0:
        return None
    try:
        return datetime(year, 1, 1)
    except Exception:
        return None


def _verse_text(value):
    if not value:
        return ""
    if isinstance(value, dict):
        return clean_text(value.get("text") or value.get("verse") or value.get("content") or value.get("raw_key"))
    return clean_text(value)


def _palace_rows(palace_verses):
    rows = []
    normalized = {display_text(key): value for key, value in (palace_verses or {}).items()}
    for palace in PALACE_ORDER:
        raw = (palace_verses or {}).get(palace) or (palace_verses or {}).get(palace.replace("宫", "宮")) or normalized.get(palace) or {}
        if raw:
            meta = []
            if raw.get("category"):
                meta.append(raw.get("category"))
            if raw.get("tags"):
                meta.append(raw.get("tags"))
            rows.append(row(palace, f"{raw.get('branch', '')}｜{raw.get('number', '')}｜{raw.get('verse', '')}", {"meta": "、".join([clean_text(item) for item in meta if clean_text(item)])}))
    return rows


def _palace_map_rows(palaces):
    rows = []
    normalized = {display_text(key): value for key, value in (palaces or {}).items()}
    for palace in PALACE_ORDER:
        value = (palaces or {}).get(palace) or (palaces or {}).get(palace.replace("宫", "宮")) or normalized.get(palace)
        if value:
            rows.append(row(palace, value))
    return rows


def _verse_meta_rows(title, verse_data):
    if not isinstance(verse_data, dict):
        return []
    rows = []
    for label, value in (
        (f"{title}编号", verse_data.get("number")),
        (f"{title}分类", verse_data.get("category")),
        (f"{title}标签", verse_data.get("tags")),
    ):
        if value:
            rows.append(row(label, value))
    return rows


def _db_info_rows(stats):
    if not isinstance(stats, dict) or not stats:
        return []
    rows = []
    if stats.get("total") is not None:
        rows.append(row("条文总数", stats.get("total")))
    if stats.get("data_file"):
        rows.append(row("数据文件", stats.get("data_file")))
    if stats.get("departments"):
        rows.append(row("五部", stats.get("departments")))
    if stats.get("by_department"):
        rows.append(row("五部分布", stats.get("by_department")))
    return rows


def _dayun_rows(dayun):
    rows = []
    for item in dayun or []:
        if isinstance(item, dict):
            rows.append(row(f"{item.get('age', '')}岁", f"{item.get('tiaowen_number', '')}｜{_verse_text(item.get('tiaowen'))}"))
        else:
            safe = json_safe(item)
            rows.append(row(f"{safe.get('dayun_number', '')}岁", f"{safe.get('tiaowen_key', '')}｜{_verse_text(safe.get('tiaowen'))}"))
    return rows


def _build_sections(pan):
    tieban = pan.get("tieban", {})
    method = tieban.get("method")
    pillars = pan.get("pillars", [])
    sections = [
        {
            "title": "起盘",
            "rows": [
                row("起盘时间", f"{pan.get('dateStr', '')} {pan.get('timeStr', '')}".strip()),
                row("性别", pan.get("gender")),
                row("算法", tieban.get("methodLabel")),
                row("四柱来源", "手动覆写" if pan.get("pillarOverride") else "自动换算"),
                row("起运年龄", pan.get("startAge")),
                row("大运步数", pan.get("dayunSteps")),
            ],
        },
        {"title": "四柱", "rows": [row(item.get("label"), item.get("ganzhi")) for item in pillars]},
    ]
    if method == "suanpan":
        suanpan = tieban.get("suanpan", {})
        sections.extend([
            {
                "title": "算盘定部",
                "rows": [
                    row("纳音", suanpan.get("nayin")),
                    row("五部", suanpan.get("department")),
                    row("天干合计", suanpan.get("stem_sum")),
                    row("地支合计", suanpan.get("branch_sum")),
                    row("岁君加数", suanpan.get("suijun_add")),
                    row("算盘总数", suanpan.get("total_number")),
                ],
            },
            {
                "title": "条文",
                "rows": [
                    row("条文编号", suanpan.get("tiaowen_key")),
                    row("条文", _verse_text(suanpan.get("tiaowen"))),
                    row("原始键", (suanpan.get("tiaowen") or {}).get("raw_key") if isinstance(suanpan.get("tiaowen"), dict) else ""),
                    row("备注", suanpan.get("note")),
                ],
            },
            {
                "title": "计算摘要",
                "rows": [row(f"步骤 {idx + 1}", item) for idx, item in enumerate(suanpan.get("calculation_steps") or [])],
            },
        ])
    else:
        kunji = tieban.get("kunji", {})
        sections.extend([
            {
                "title": "命身刻分",
                "rows": [
                    row("命宫", kunji.get("ming_palace")),
                    row("身宫", kunji.get("shen_palace")),
                    row("五行局", kunji.get("wuxing_ju")),
                    row("刻", f"{kunji.get('ke_label')}（{kunji.get('ke')}）"),
                    row("分", kunji.get("fen")),
                    row("河洛数", kunji.get("he_luo_number")),
                ],
            },
            {
                "title": "神数号码",
                "rows": [
                    row("铁板号码", kunji.get("tieban_number")),
                    row("坤集条文号", kunji.get("tiaowen_number")),
                    row("扣入天干", kunji.get("kunji_tiangan")),
                    row("密码映射", kunji.get("secret_code")),
                ],
            },
            {
                "title": "条文",
                "rows": [
                    row("主条文", kunji.get("verse")),
                    *_verse_meta_rows("主条文", kunji.get("verse_data")),
                    row("足本条文", _verse_text(kunji.get("tiaowen_data"))),
                    row("足本备注", (kunji.get("tiaowen_data") or {}).get("note") if isinstance(kunji.get("tiaowen_data"), dict) else ""),
                    row("扣入天干序", (kunji.get("tiaowen_data") or {}).get("tiangan") if isinstance(kunji.get("tiaowen_data"), dict) else ""),
                    row("九十六刻", kunji.get("bake_fuqin_info")),
                    row("六亲刻分", kunji.get("six_qin_qizi_info")),
                ],
            },
            {"title": "十二宫", "rows": _palace_map_rows(kunji.get("palaces") or {})},
            {"title": "十二宫条文", "rows": _palace_rows(kunji.get("palace_verses") or {})},
            {
                "title": "紫微安星",
                "rows": [row(name, branch) for name, branch in (kunji.get("ziwei_stars") or {}).items()],
            },
        ])
    db_rows = _db_info_rows(tieban.get("dbInfo") or {})
    if db_rows:
        sections.append({"title": "条文库", "rows": db_rows})
    sections.append({"title": "大运", "rows": _dayun_rows(tieban.get("dayun"))})
    witness = tieban.get("witness") or {}
    if any(witness.values()):
        sections.append({
            "title": "六亲佐证",
            "rows": [
                row("父亲生年", witness.get("fatherBirthYear")),
                row("父亲卒年", witness.get("fatherDeathYear")),
                row("母亲生年", witness.get("motherBirthYear")),
                row("母亲卒年", witness.get("motherDeathYear")),
                row("兄弟信息", witness.get("siblingsInfo")),
                row("婚姻状况", witness.get("maritalStatus")),
                row("子女信息", witness.get("childrenInfo")),
            ],
        })
    return sections


class TieBanSrv:
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
            gender = gender_cn(data.get("gender"), "男")
            method = clean_text(data.get("method"), "kunji")
            if method not in ("kunji", "suanpan"):
                method = "kunji"
            start_age = max(0, min(120, to_int(data.get("startAge"), 0)))
            dayun_steps = max(1, min(12, to_int(data.get("dayunSteps"), 8)))

            gz = calculate_ganzhi_from_datetime(dt, data.get("after23NewDay", 1))

            # 🔴 标准四柱换全局权威口径(立春界/定气月/儒略JDN,全域含 BC)。

            #    现代域两者一致=零回归;1/2 月未过立春与 BC 年才有差(那正是要修的)。

            #    取不到权威实现时保留旧值,故用 update 而非整体替换。

            _auth_gz = authoritative_pillars(dt, data)

            if _auth_gz:

                gz = dict(gz)

                gz.update(_auth_gz)
            override_values = [data.get("yearGz"), data.get("monthGz"), data.get("dayGz"), data.get("hourGz")]
            pillar_override = any(clean_text(item) for item in override_values)
            year_gz = _normalize_ganzhi(data.get("yearGz"), gz["year"])
            month_gz = _normalize_ganzhi(data.get("monthGz"), gz["month"])
            day_gz = _normalize_ganzhi(data.get("dayGz"), gz["day"])
            hour_gz = _normalize_ganzhi(data.get("hourGz"), gz["hour"])

            witness = {
                "fatherBirthYear": clean_text(data.get("fatherBirthYear")),
                "fatherDeathYear": clean_text(data.get("fatherDeathYear")),
                "motherBirthYear": clean_text(data.get("motherBirthYear")),
                "motherDeathYear": clean_text(data.get("motherDeathYear")),
                "siblingsInfo": clean_text(data.get("siblingsInfo")),
                "maritalStatus": clean_text(data.get("maritalStatus")),
                "childrenInfo": clean_text(data.get("childrenInfo")),
            }
            birth_data = TieBanBirthData(
                birth_dt=dt,
                year_gz=_ganzhi_obj(year_gz),
                month_gz=_ganzhi_obj(month_gz),
                day_gz=_ganzhi_obj(day_gz),
                hour_gz=_ganzhi_obj(hour_gz),
                gender=gender,
                father_birth=_year_dt(witness["fatherBirthYear"]),
                father_death=_year_dt(witness["fatherDeathYear"]),
                mother_birth=_year_dt(witness["motherBirthYear"]),
                mother_death=_year_dt(witness["motherDeathYear"]),
                siblings_info=witness["siblingsInfo"],
                marital_status=witness["maritalStatus"],
                children_info=witness["childrenInfo"],
            )
            diviner = TieBanDiviner(method=method)
            result = diviner.calculate(birth_data)
            dayun = diviner.get_dayun(birth_data, start_age=start_age, steps=dayun_steps)
            try:
                db_info = diviner.get_suanpan_stats() if method == "suanpan" else diviner.get_kunji_db_info()
            except Exception:
                db_info = {}

            safe_result = json_safe(result)
            safe_dayun = json_safe(dayun)
            pillars = [
                {"key": "year", "label": "年柱", "ganzhi": year_gz},
                {"key": "month", "label": "月柱", "ganzhi": month_gz},
                {"key": "day", "label": "日柱", "ganzhi": day_gz},
                {"key": "hour", "label": "时柱", "ganzhi": hour_gz},
            ]
            tieban = {
                "method": method,
                "methodLabel": _method_label(method),
                "witness": witness,
                "dayun": safe_dayun,
                "dbInfo": json_safe(db_info),
                "raw": safe_result,
            }
            if method == "suanpan":
                tieban["suanpan"] = safe_result
            else:
                tieban["kunji"] = safe_result
            pan = {
                "source": "kinastro",
                "engine": "kinastro-tieban",
                "technique": "tieban",
                "title": "铁板神数",
                "dateStr": data.get("date", dt.strftime("%Y-%m-%d")),
                "timeStr": data.get("time", dt.strftime("%H:%M:%S")),
                "gender": gender,
                "startAge": start_age,
                "dayunSteps": dayun_steps,
                "pillarOverride": pillar_override,
                "pillars": pillars,
                "tieban": tieban,
                "classics": kinastro_source_sections("铁板神数", "接入 kinastro 的铁板神数扣入法与算盘打数，两法均保留四柱、条文、大运与六亲佐证输入。"),
                "capabilities": {
                    "inputs": [
                        "date", "time", "gender", "method", "startAge", "dayunSteps",
                        "yearGz", "monthGz", "dayGz", "hourGz",
                        "fatherBirthYear", "fatherDeathYear", "motherBirthYear", "motherDeathYear",
                        "siblingsInfo", "maritalStatus", "childrenInfo",
                    ],
                    "outputs": ["fourPillars", "kunji", "suanpan", "tiaowen", "palaceVerses", "dayun", "witness"],
                    "database": json_safe(db_info),
                    "methodOptions": METHOD_OPTIONS,
                },
            }
            pan["sections"] = _build_sections(pan)
            pan["snapshot"] = build_snapshot(pan)
            return jsonpickle.encode({"ResultCode": 0, "Result": pan}, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({"ResultCode": -1, "Result": "tieban calculation failed"}, unpicklable=False)
