import copy
import traceback
import jsonpickle
import cherrypy
from websrv.helper import enable_crossdomain
from astrostudy.india.india_chart_kernel import IndiaChartKernel
from astrostudy.india.jyotish_engine import build_jyotish
from astrostudy.india.varga import apply_varga_chart, normalize_chartnum


def getIndiaChartJson(data, indiachart, jyotish=None):
    obj = indiachart.to_response(data, jyotish)
    if jyotish is not None:
        obj['jyotish'] = jyotish
    return jsonpickle.encode(obj, unpicklable=False)


def warmup_india():
    """后端启动同步预热:跑一个 dummy 印度盘(核心 perchart + jyotish + D1 分盘 + 序列化),
    把 india 包(分盘/大运/jyotish/shadbala/...)的计算路径 + 星历全量载入,消除每次重启软件后
    *首次*进入印度占星的 ~3s 冷启动(模块已 import,但首次计算的星历首读 + 各子算法冷路径很重)。
    务必由 webchartsrv 在 PD 预热之后、engine.start 之前**同步**调用:复用已热 swisseph,
    且启动期无并发请求 → 不与真实请求争 swisseph 全局 sid_mode 而算错盘。失败由调用方兜底。"""
    data = {
        'date': '2000/1/1', 'time': '12:0:0', 'zone': 8,
        'lat': 39.9, 'lon': 116.4, 'ad': 1,
        'siderealMode': 'lahiri', 'hsys': 0,
        'tradition': False, 'predictive': False, 'zodiacal': 1,
    }
    srv = IndiaAstroSrv()
    perchart = IndiaChartKernel(data)
    jyotish = srv._safe_build_jyotish(perchart, 1, None)
    apply_varga_chart(perchart, 1)
    getIndiaChartJson(data, perchart, jyotish)


class IndiaAstroSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()



    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def chart(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            data['tradition'] = False
            data['predictive'] = False
            data['zodiacal'] = 1
            data['hsys'] = data.get('indiaHsys', data.get('hsys', 0))
            data['siderealMode'] = data.get('indiaAyanamsa', data.get('ayanamsa', data.get('siderealMode', 'lahiri')))
            chartnum = 1
            if 'chartnum' in data.keys():
                try:
                    chartnum = int(data['chartnum'])
                except:
                    chartnum = 1
            chartnum = normalize_chartnum(chartnum)
            dasha_seed = data.get('dashaSeed')  # 大运起点(默认月亮宿;可选七政/节点/上升/特殊上升/副星)
            sthira_start = data.get('sthiraStart')  # Sthira 固定座运起座:lagna(默认)/brahma(BPHS)
            # 选中的树形大运体系(默认 vimshottari):仅该体系算完整三级,其余只出 maha 顶层(省体积)。
            # UI 一次只显示一个体系,切换会带新 dashaSystem 重取。缺省 → 默认 vimshottari 全展开(零回归)。
            dasha_system = data.get('dashaSystem')

            perchart = IndiaChartKernel(data)
            # jyotish 须算在「实际所绘分盘」上(原先恒在 D1 上算)。
            # 分盘时另建独立 D1 副本，供 always-D1 子项(大运月宿/Panchanga/Gochara)；
            # chartnum==1 时 d1≡perchart、先算 jyotish 再 reinit，行为与重构前字节一致。
            d1_perchart = None
            if chartnum != 1:
                d1_perchart = IndiaChartKernel(data)
                apply_varga_chart(perchart, chartnum)
            jyotish = self._safe_build_jyotish(perchart, chartnum, d1_perchart, dasha_seed, sthira_start, dasha_system)
            if chartnum == 1:
                apply_varga_chart(perchart, chartnum)

            # vargaSet 可选多分盘 jyotish(jyotishByVarga)，opt-in、上限 16。
            varga_set = self._parse_varga_set(data.get('vargaSet'))
            if varga_set:
                # base_d1 = 干净 D1 核(从不被 varga 变换):chartnum!=1 时即 d1_perchart;
                # chartnum==1 时 perchart 只经 apply_varga_chart(·,1)(仅写 varga 元数据 + reinit，
                # 不动经纬)→ 坐标仍 D1，可安全作 base。每个分盘**深拷贝 base 再 apply_varga**，
                # 免去逐盘重算 D1 星历(深拷贝 ≈0.7ms vs 重建 ≈3.3ms;varga 变换不含星历)。
                # 深拷贝独立、不污染 base(apply_varga 末尾 reinit 重建 house.planets 等可变态)；
                # 字节级与「逐盘 IndiaChartKernel(data)」一致(全分盘/边界日期已核)。
                d1_for_set = d1_perchart if d1_perchart is not None else perchart
                base_d1 = d1_for_set
                jyotish_by_varga = {}
                for vnum in varga_set:
                    if vnum == chartnum:
                        # 断自循环引用:存浅拷贝而非 jyotish 本身。否则下方 jyotish['jyotishByVarga']=jyotish_by_varga
                        # 会令 jyotish→jyotishByVarga→该盘→jyotish 自指,jsonpickle(unpicklable=False 无环检测)无限递归
                        # → RecursionError → 整请求被 except 吞成「param error」(分盘集含主盘号时必崩的真因)。
                        # 浅拷贝取于 gochara/tajaka/jyotishByVarga 挂载之前,与其它分盘(无 gochara/tajaka)口径一致。
                        jyotish_by_varga[str(vnum)] = dict(jyotish)
                        continue
                    vchart = copy.deepcopy(base_d1)
                    if vnum != 1:
                        apply_varga_chart(vchart, vnum)
                    jyotish_by_varga[str(vnum)] = self._safe_build_jyotish(
                        vchart, vnum, None if vnum == 1 else d1_for_set, dasha_seed, sthira_start, dasha_system)
                jyotish['jyotishByVarga'] = jyotish_by_varga

            # Gochara(过运) + Tajaka(年度盘)：需另起过运盘 / 太阳回归盘，挂进主 jyotish。
            natal_perchart = d1_perchart if d1_perchart is not None else perchart
            if isinstance(jyotish, dict):
                gochara = self._compute_gochara(data, natal_perchart, jyotish)
                if gochara:
                    jyotish['gochara'] = gochara
                tajaka = self._compute_tajaka(data, natal_perchart)
                if tajaka:
                    jyotish['tajaka'] = tajaka

            res = getIndiaChartJson(data, perchart, jyotish)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)

    def _safe_build_jyotish(self, perchart, chartnum, d1_perchart, dasha_seed=None, sthira_start=None, dasha_system=None):
        """计算 jyotish；失败回退占位 dict(保留原 chart() 的错误兜底语义)。"""
        try:
            return build_jyotish(perchart, chartnum=chartnum, d1_perchart=d1_perchart, dasha_seed=dasha_seed, sthira_start=sthira_start, dasha_system=dasha_system)
        except:
            traceback.print_exc()
            return {
                'engine': {
                    'name': 'Horosa JyotishEngine',
                    'version': '0.1.0',
                    'ephemeris': 'Horosa Swiss Ephemeris / IndiaChartKernel',
                    'source': 'chart_json_only',
                    'chartnum': chartnum,
                },
                'error': 'jyotish calculation error'
            }

    @staticmethod
    def _parse_varga_set(raw):
        """解析 vargaSet(字符串 "1,9,10" 或列表)→ 去重、归一化、上限 16 的 chartnum 列表。"""
        if not raw:
            return []
        if isinstance(raw, str):
            parts = raw.replace('，', ',').split(',')
        elif isinstance(raw, (list, tuple)):
            parts = raw
        else:
            return []
        out = []
        for p in parts:
            try:
                vnum = normalize_chartnum(int(p))
            except (TypeError, ValueError):
                continue
            if vnum not in out:
                out.append(vnum)
            if len(out) >= 16:
                break
        return out

    def _compute_gochara(self, data, natal_perchart, jyotish):
        """过运盘(transitDate 或服务器今日 12:00、出生地)→ compute_gochara。默认即出当前过运 + Sade Sati。"""
        try:
            from astrostudy.india.gochara import compute_gochara
            from astrostudy.india.jyotish_engine import safe_get
            from flatlib import const
            natal_moon = safe_get(natal_perchart.chart, const.MOON)
            natal_asc = safe_get(natal_perchart.chart, const.ASC)
            if not natal_moon or not natal_asc:
                return None
            transit_date = data.get('transitDate')
            if not transit_date:
                import datetime as _dt
                transit_date = _dt.datetime.now().strftime('%Y/%m/%d')
            tdata = dict(data)
            tdata['date'] = transit_date
            tdata['time'] = '12:00:00'
            tdata.pop('chartnum', None)
            tchart = IndiaChartKernel(tdata)
            ids = [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                   const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE]
            from astrostudy.nakshatra import nakshatra_from_lon
            transit_signs = {}
            transit_naks = {}
            for oid in ids:
                o = safe_get(tchart.chart, oid)
                if o:
                    transit_signs[oid] = o.sign
                    transit_naks[oid] = nakshatra_from_lon(o.lon)['index']
            av = jyotish.get('ashtakavarga') if isinstance(jyotish, dict) else None
            res = compute_gochara(
                natal_moon.sign, natal_asc.sign, transit_signs, av, transit_date,
                natal_moon_nak_index=nakshatra_from_lon(natal_moon.lon)['index'],
                natal_lagna_nak_index=nakshatra_from_lon(natal_asc.lon)['index'],
                transit_naks=transit_naks)
            if isinstance(res, dict):
                res['transitDate'] = transit_date
            return res
        except:
            traceback.print_exc()
            return None

    def _compute_tajaka(self, data, natal_perchart):
        """年度盘(太阳回归到本命太阳经度，tajakaYear)→ build_tajaka。仅 tajakaYear 提供时算。
        回归时刻用同日线性逼近(太阳约 0.0411°/h)；精确求根为后续。"""
        try:
            tajaka_year = data.get('tajakaYear')
            if not tajaka_year:
                # 与过运盘同口径：未显式指定时默认当前公历年(服务器侧轻量补算，免依赖 Java 透传)。
                import datetime as _dt
                tajaka_year = _dt.datetime.now().year
            tajaka_year = int(tajaka_year)
            from astrostudy.india.tajaka import build_tajaka
            from astrostudy.india.jyotish_engine import safe_get
            from flatlib import const
            natal_sun = safe_get(natal_perchart.chart, const.SUN)
            natal_asc = safe_get(natal_perchart.chart, const.ASC)
            if not natal_sun or not natal_asc:
                return None
            parts = str(data.get('date', '')).lstrip('-').split('/')
            if len(parts) < 3:
                return None
            birth_year, month, day = int(parts[0]), parts[1], parts[2]
            target = float(natal_sun.lon)

            def build_at(time_str):
                d = dict(data)
                d['date'] = '%d/%s/%s' % (tajaka_year, month, day)
                d['time'] = time_str
                d.pop('chartnum', None)
                return IndiaChartKernel(d)

            kernel = build_at('12:00:00')
            sun = safe_get(kernel.chart, const.SUN)
            if sun:
                diff = ((sun.lon - target + 180.0) % 360.0) - 180.0
                hours = 12.0 - diff / (360.0 / 365.25 / 24.0)
                hours = max(0.0, min(23.999, hours))
                hh = int(hours)
                mm = int((hours - hh) * 60)
                ss = int(((((hours - hh) * 60) - mm) * 60))
                kernel = build_at('%02d:%02d:%02d' % (hh, mm, ss))
            ids = [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN]
            annual_positions = {}
            for oid in ids:
                o = safe_get(kernel.chart, oid)
                if o:
                    annual_positions[oid] = {'sign': o.sign, 'lon': o.lon}
            aasc = safe_get(kernel.chart, const.ASC)
            if not aasc:
                return None
            day_birth = bool(getattr(natal_perchart, 'isDiurnal', True))
            res = build_tajaka(annual_positions, natal_asc.sign, aasc.lon, tajaka_year - birth_year, day_birth)
            if isinstance(res, dict):
                res['tajakaYear'] = tajaka_year
            return res
        except:
            traceback.print_exc()
            return None
