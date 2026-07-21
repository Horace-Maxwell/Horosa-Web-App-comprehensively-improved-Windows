"""玄史(中国玄学史)web 服务。

调本仓只读内核 ``astrostudy.xuanshi``（两个只读 SQLite bundle：玄学事件 / 天象 /
地名 / 人物图 + 编辑层人物/故事/术数/词条/频道/今日推送）。每端点从
``cherrypy.request.json`` 取参（兼容查询串），统一返 ``jsonpickle.encode(res, unpicklable=False)``，
异常回 ``{'err': str(e)}``。只读，绝不写库。
"""

import traceback

import cherrypy
import jsonpickle

from websrv.helper import enable_crossdomain

from astrostudy import xuanshi
from astrostudy.xuanshi import celestial as xs_celestial
from astrostudy.xuanshi import editorial as xs_editorial
from astrostudy.xuanshi import omen as xs_omen
from astrostudy.xuanshi import period as xs_period
from astrostudy.xuanshi import queries as xs_queries


def _params():
    """合并查询串参数与 JSON body（body 优先）。"""
    data = dict(cherrypy.request.params or {})
    body = getattr(cherrypy.request, "json", None)
    if isinstance(body, dict):
        data.update(body)
    return data


def _str(data, key, default=None):
    v = data.get(key)
    if v is None:
        return default
    s = str(v).strip()
    return s if s else default


def _int(data, key, default=None):
    v = data.get(key)
    if v is None or v == "":
        return default
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _bool(data, key, default=None):
    """三态布尔：缺省/空 → default；'true'/'1'/'yes'/True → True；其余 → False。"""
    v = data.get(key)
    if v is None or v == "":
        return default
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "y", "on"):
        return True
    if s in ("0", "false", "no", "n", "off"):
        return False
    return default


def _list(data, key):
    """多值 facet：接受 list 或分隔字符串（;/,/、/，）→ 去重列表；空 → None。"""
    v = data.get(key)
    if v is None or v == "":
        return None
    if isinstance(v, (list, tuple)):
        items = [str(x).strip() for x in v]
    else:
        s = str(v).replace("；", ";").replace("、", ";").replace("，", ";").replace(",", ";")
        items = [p.strip() for p in s.split(";")]
    out: list = []
    for it in items:
        if it and it not in out:
            out.append(it)
    return out or None


class XuanShiSrv:
    exposed = True

    def OPTIONS(self, *args, **kwargs):
        enable_crossdomain()

    # ------------------------------------------------------------
    # 概览
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def summary(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            return jsonpickle.encode(xuanshi.global_summary(), unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # 玄学事件 xuanxue_event
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def events(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_queries.list_events(
                q=_str(d, "q"),
                tradition=_str(d, "tradition"),
                dynasty=_str(d, "dynasty"),
                technique=_str(d, "technique"),
                history=_str(d, "history"),
                dynasties=_list(d, "dynasties"),
                techniques=_list(d, "techniques"),
                histories=_list(d, "histories"),
                evidence=_str(d, "evidence"),
                page=_int(d, "page", 1),
                page_size=_int(d, "page_size", _int(d, "pageSize", 30)),
            )
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def event(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_queries.get_event(_str(d, "event_id", _str(d, "id", "")))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # 天象 celestial_event
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def celestial(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_celestial.list_events(
                dynasty=_str(d, "dynasty"),
                omen=_str(d, "omen"),
                history=_str(d, "history"),
                source=_str(d, "source"),
                year_from=_int(d, "year_from", _int(d, "yearFrom")),
                year_to=_int(d, "year_to", _int(d, "yearTo")),
                has_crosswalk=_bool(d, "has_crosswalk", _bool(d, "hasCrosswalk")),
                in_chapter=_bool(d, "in_chapter", _bool(d, "inChapter")),
                keyword=_str(d, "keyword", _str(d, "q")),
                page=_int(d, "page", 1),
                page_size=_int(d, "page_size", _int(d, "pageSize", 30)),
            )
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def celestial_event(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_celestial.get_event(_str(d, "event_id", _str(d, "id", "")))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # horosa_xuanshi_longtext_ondemand_v1:limit 缺省 None = 全量(天象大典年代下钻的既有口径);
    # 天象微年表页显式传 limit=300(= 它的渲染上限),长文本因此只随真正下发的行走。
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def microchronology(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_celestial.microchronology(
                history=_str(d, "history"),
                omen_type=_str(d, "omen_type", _str(d, "omenType", _str(d, "omen"))),
                decade=_int(d, "decade"),
                limit=_int(d, "limit"),
            )
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # horosa_xuanshi_longtext_ondemand_v1:被 limit 截断后的长文本按需取回(只读幂等,可客户端缓存)。
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def microchronology_detail(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_celestial.microchronology_detail(
                _str(d, "event_id", _str(d, "id", "")) or ""
            )
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def decade_omens(self, **kwargs):
        """十年期 × 天象类 堆叠序列(供星象大典 echarts 堆叠面积图)。"""
        if enable_crossdomain():
            return ""
        try:
            return jsonpickle.encode(xs_celestial.decade_omens(), unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def celestial_term_profile(self, **kwargs):
        """某一类 omen 的事件画像（朝代/史书/年代分布 + 均衡样本）。"""
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_celestial.term_profile(_str(d, "omen", _str(d, "label", "")) or "")
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # 编辑层：人物 figure
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def figures(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            status = _str(d, "status", "published")
            if status == "all":  # 列传子页：列全部人物(含未成稿 stub)
                status = None
            dynasty = _str(d, "dynasty")
            q = _str(d, "q")
            limit = _int(d, "limit", 100)
            offset = _int(d, "offset", 0)
            items = xs_editorial.list_figures(
                status=status, limit=limit, dynasty=dynasty, offset=offset, q=q,
            )
            total = xs_editorial.count_figures(status=status, dynasty=dynasty, q=q)
            res = {
                "items": items,
                "total": total,
                "limit": limit,
                "offset": offset,
                "dynasties": xs_editorial.figure_dynasties(status=status),
            }
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def figure(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.get_figure(_str(d, "slug", ""))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # 编辑层：术数 technique
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def techniques(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.list_techniques(
                status=_str(d, "status", "published"),
                category=_str(d, "category"),
            )
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def technique(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.get_technique(_str(d, "slug", ""))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # 编辑层：天象词条 celestial_term
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def celestial_terms(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.list_celestial_terms(status=_str(d, "status", "published"))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def celestial_term(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.get_celestial_term(_str(d, "slug", ""))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # 编辑层：朝代词条 dynasty_term
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def dynasties(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.list_dynasties(status=_str(d, "status", "published"))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def dynasty(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.get_dynasty(_str(d, "slug", ""))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # 编辑层：故事 story / 频道 channel
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def stories(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.list_stories(
                channel_slug=_str(d, "channel_slug", _str(d, "channelSlug")),
                dynasty=_str(d, "dynasty"),
                figure_slug=_str(d, "figure_slug", _str(d, "figureSlug")),
                technique_slug=_str(d, "technique_slug", _str(d, "techniqueSlug")),
                status=_str(d, "status", "published"),
                limit=_int(d, "limit", 50),
                offset=_int(d, "offset", 0),
                search_text=_str(d, "search_text", _str(d, "q")),
            )
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def story(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.get_story(_str(d, "slug", ""))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def channels(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            only_pub = _bool(d, "only_published", _bool(d, "onlyPublished", True))
            res = xs_editorial.list_channels(only_published=bool(only_pub))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # 地图 / 人物图 / 时间线
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def map(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_queries.map_points(period=_str(d, "period"))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def persons_graph(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            # 真实人物共现网络(同一玄学事件的人物互相成边,按人名聚合);替换原 NER 泛化节点
            res = xs_editorial.figure_cooccurrence_graph(
                limit_nodes=_int(d, "top_n", _int(d, "topN", 70)),
                min_weight=_int(d, "min_weight", _int(d, "minWeight", 2)),
            )
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def timeline(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            macro = _str(d, "macro")
            if macro:
                res = {"drilldown": xs_queries.timeline_drilldown(macro, limit=_int(d, "limit", 80))}
            else:
                res = xs_queries.timeline()
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # facet 计数（首页多维检索：传统/朝代/术数/史书/证据 + 实时命中）
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def events_meta(self, **kwargs):
        """玄学万象列表页头部:统计 + 朝代游历(图标+史书细分)+ 传统切换。"""
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_queries.events_page_meta(tradition=_str(d, "tradition"))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def facets(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_queries.facets(
                tradition=_str(d, "tradition"),
                q=_str(d, "q"),
                dynasties=_list(d, "dynasty"),
                techniques=_list(d, "technique"),
                histories=_list(d, "history"),
                evidence=_str(d, "evidence"),
            )
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    # ------------------------------------------------------------
    # 搜索 / 今日推送
    # ------------------------------------------------------------
    @cherrypy.expose
    @cherrypy.tools.json_in()
    def search(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_queries.search_events(
                _str(d, "q", _str(d, "query", "")) or "",
                limit=_int(d, "limit", 30),
                tradition=_str(d, "tradition"),
            )
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.tools.json_in()
    def daily(self, **kwargs):
        if enable_crossdomain():
            return ""
        try:
            d = _params()
            res = xs_editorial.resolve_daily(date_key=_str(d, "date_key", _str(d, "dateKey")))
            return jsonpickle.encode(res, unpicklable=False)
        except Exception as e:
            traceback.print_exc()
            return jsonpickle.encode({"err": str(e)}, unpicklable=False)
