
import time as _ledger_time
_PY_T0 = _ledger_time.perf_counter()  # 启动账本基准:必须在一切重导入之前

import os
import sys
import traceback
import json
import time
import socket
import signal
import subprocess
import threading

from websrv.startup_ledger import ledger_mark  # 零依赖,不入重导入墙

ledger_mark('py.interp_start', t0=_PY_T0)

import cherrypy

try:
    import jsonpickle
    _HAS_REAL_JSONPICKLE = True
except ImportError:
    class _JsonpickleCompat:
        @staticmethod
        def encode(obj, unpicklable=False):
            return json.dumps(obj, ensure_ascii=False, default=str)

    jsonpickle = _JsonpickleCompat()
    _HAS_REAL_JSONPICKLE = False


# horosa_fast_json_encode_v1(PERF-R10 B6):对**纯 JSON 树**,`json.dumps(obj)`(全默认参)
# 与 `jsonpickle.encode(obj, unpicklable=False)` 逐字节相等(含 unicode/int 键/float/大整数,
# 4/4 探针 EQ 实测)——而前者跳过 jsonpickle 的类型巡检层,大响应端点省 5-40ms。
# shim 只在三个条件同时成立才走快径:开关开 + 真 jsonpickle 在场(compat 桩用 ensure_ascii=False
# **不等价**,绝不套快径)+ 默认参调用;json.dumps 抛 TypeError/ValueError(非 JSON 类型/环)
# 即回退原实现 —— 回退触发本身零漂移(by construction)。全矩阵 --verify 是硬闸:任何漂移
# ⇒ 本项废弃。kill:HOROSA_FAST_JSON_ENCODE=0 ⇒ 恒走原实现。
_FAST_JSON_ON = os.environ.get("HOROSA_FAST_JSON_ENCODE", "1").lower() not in ("0", "false", "no", "off")


class _FastJsonEncodeShim:
    def __init__(self, real):
        self._real = real

    def __getattr__(self, name):
        return getattr(self._real, name)

    def encode(self, obj, unpicklable=False, **kw):
        if _FAST_JSON_ON and unpicklable is False and not kw:
            try:
                return json.dumps(obj)
            except (TypeError, ValueError):
                pass
        return self._real.encode(obj, unpicklable=unpicklable, **kw)


if _HAS_REAL_JSONPICKLE:
    jsonpickle = _FastJsonEncodeShim(jsonpickle)

# Ensure flatlib is resolvable from bundled sources.
_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJ_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_FLATLIB_CANDIDATES = [
    os.path.join(_PROJ_ROOT, "flatlib-ctrad2"),
    os.path.abspath(os.path.join(_PROJ_ROOT, "..", "flatlib-ctrad2")),
]
for _cand in reversed(_FLATLIB_CANDIDATES):
    if os.path.isdir(os.path.join(_cand, "flatlib")) and _cand not in sys.path:
        sys.path.insert(0, _cand)

from astrostudy.perchart import PerChart, push_request_terms, pop_request_terms, parse_terms_variant, push_request_trip, pop_request_trip
from astrostudy.guostarsect.guostarsect import GuoStarSect
from astrostudy.thirteenthchart import ThirteenthChart, HarmonicChart
from astrostudy.helper import getPredictivesObj
from websrv.helper import enable_crossdomain
from websrv._guards import validate_geo
# [B5] 14 个非 kentang 服务改惰性挂载(复用 kentang _LazyMountedService 通用代理):
# 此前顶层同步 import 是 py.interp_start→imports_done 的主墙(每个服务各拖自家引擎链),
# 现挂载零导入、监听提前;warmup 线程在开门前逐个预装(prewarm)——任何业务 POST 的最早
# 可服务时刻不晚于旧方案(单一 STARTUP_GATE 语义不变,sid_mode 并发安全同旧)。
# kill-switch:HOROSA_CORE_LAZY=0 回退旧饿加载(eager import + 直挂)。
from websrv.kentang.registry import mount_kentang_services, _LazyMountedService, _load_service

CORE_SERVICE_SPECS = [
    {"key": "predict", "mount": "/predict", "module": "websrv.webpredictsrv", "class_name": "PredictSrv"},
    {"key": "india", "mount": "/india", "module": "websrv.webindiasrv", "class_name": "IndiaAstroSrv"},
    {"key": "modern", "mount": "/modern", "module": "websrv.webmodernsrv", "class_name": "ModernAstroSrv"},
    {"key": "germany", "mount": "/germany", "module": "websrv.webgermanysrv", "class_name": "GermanyAstroSrv"},
    {"key": "jieqi", "mount": "/jieqi", "module": "websrv.webjieqisrv", "class_name": "JieQiSrv"},
    {"key": "chart3d", "mount": "/chart3d", "module": "websrv.webchart3dsrv", "class_name": "Chart3DSrv"},
    {"key": "jdn", "mount": "/jdn", "module": "websrv.webjdn", "class_name": "WebJdnSrv"},
    {"key": "calc", "mount": "/calc", "module": "websrv.webcalc", "class_name": "WebCalcSrv"},
    {"key": "qizhengelection", "mount": "/qizhengelection", "module": "websrv.webqizhengelectionsrv", "class_name": "QiZhengElectionSrv"},
    {"key": "acg", "mount": "/location", "module": "websrv.webacgsrv", "class_name": "AcgSrv"},
    # 策天飞星:自有引擎(已从 kentang 摘出),同走惰性挂载。
    {"key": "cetian", "mount": "/cetian", "module": "websrv.webcetiansrv", "class_name": "CeTianSrv"},
    {"key": "astroextra", "mount": "/astroextra", "module": "websrv.webastroextrasrv", "class_name": "AstroExtraSrv"},
    {"key": "planetarium", "mount": "/planetarium", "module": "websrv.webplanetariumsrv", "class_name": "PlanetariumSrv"},
]


def _core_lazy_enabled():
    return os.environ.get('HOROSA_CORE_LAZY', '1') not in ('0', 'false', 'no', 'off')


def mount_core_services():
    lazy = _core_lazy_enabled()
    for spec in CORE_SERVICE_SPECS:
        if lazy:
            cherrypy.tree.mount(_LazyMountedService(spec), spec["mount"])
        else:
            cherrypy.tree.mount(_load_service(spec), spec["mount"])


def prewarm_core_services():
    loaded = 0
    failed = 0
    for spec in CORE_SERVICE_SPECS:
        try:
            app = cherrypy.tree.apps.get(spec["mount"])
            root = getattr(app, "root", None)
            if isinstance(root, _LazyMountedService):
                root._horosa_load()
                loaded += 1
        except Exception:
            failed += 1
            print("[core] prewarm failed %s" % spec.get("key"), flush=True)
            traceback.print_exc()
    return loaded, failed

ledger_mark('py.imports_done', t0=_PY_T0)

# 请求级三段计时(HOROSA_PY_CHART_TIMING)并入启动账本:
# 开=对 /chart 记 init/build/encode 三段写账本;默认关=输出与响应逐字节不变。
_PY_CHART_TIMING = os.environ.get('HOROSA_PY_CHART_TIMING', '0').lower() in ('1', 'true', 'yes', 'on')
# horosa_chart_no_stdout_dump_v1:默认关。置 1 恢复「每个 /chart 打印整个请求字典」的旧行为
# (只应在本机排障时开 —— 该字典含出生日期/时间/经纬度/地名等个人数据)。
_CHART_DEBUG_DUMP = os.environ.get('HOROSA_CHART_DEBUG_DUMP', '0').lower() in ('1', 'true', 'yes', 'on')



class WebChartSrv:
    exposed = True
    PD_SYNC_REV = 'pd_method_sync_v12'
    WARMED = False  # PD warmup 完成置 True;/healthz 据此报「真就绪」(P0 启动稳健化,纯增量)
    PD_WARMUP_SAMPLE = {
        'date': '2028/04/06',
        'time': '09:33:00',
        'zone': '+00:00',
        'lat': '41n26',
        'lon': '174w30',
        'gpsLat': -41.433333,
        'gpsLon': 174.5,
        'hsys': 1,
        'tradition': False,
        'predictive': True,
        'includePrimaryDirection': True,
        'zodiacal': 0,
        'simpleAsp': False,
        'strongRecption': False,
        'virtualPointReceiveAsp': True,
        'southchart': False,
        'ad': 1,
        'pdtype': 0,
        'pdMethod': 'core_alchabitius',
        'pdTimeKey': 'Ptolemy',
        'pdaspects': [0, 60, 90, 120, 180],
    }

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    def healthz(self):
        # 免签名就绪探针(P0):warmup 完成后 warm=True;能连通即存活,warm 区分「真就绪」。纯增量,不影响既有路由。
        enable_crossdomain()
        return jsonpickle.encode({'ok': True, 'service': 'chart', 'warm': WebChartSrv.WARMED, 'pdSyncRev': WebChartSrv.PD_SYNC_REV}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    def horosaIdentity(self, deep=None):
        # 身份握手端点:前端在采用任何本地服务地址(query/存储/端口推导)之前,先 GET 本端点核验
        # app 标记(+壳注入的每次启动 nonce)——防端口被其它进程占用时把「陌生 200 响应」误当后端
        # (症状:排盘失败但 statusCode:200)。明文、免签名,与 Java 侧 /horosaIdentity 同构。
        # [V-5] deep=1:附带一次微型真算(flatlib 儒略日,零 I/O)——看门狗借此看见
        # 「身份线程活着但算力已死」的灰区;proto 升 2 表示支持 deep 维度。
        enable_crossdomain()
        _nonce = os.environ.get('HOROSA_LAUNCH_NONCE', '') or ''
        # 与 Java 侧同构的 ASCII 白名单(str.isalnum 会放行 CJK,不可用)。
        _nonce = ''.join(ch for ch in _nonce
                         if ('a' <= ch <= 'z') or ('A' <= ch <= 'Z') or ('0' <= ch <= '9') or ch in '_-')
        payload = {'app': 'horosa-chart', 'proto': 2, 'nonce': _nonce}
        if deep:
            payload['deep'] = 'ok' if _identity_deep_ok() else 'fail'
        return jsonpickle.encode(payload, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def index(self):
        enable_crossdomain()
        if cherrypy.request.method != 'POST':
            return jsonpickle.encode({
                'ok': True,
                'service': 'chart',
                'pdSyncRev': self.PD_SYNC_REV,
            }, unpicklable=False)
        # 界系(termsVariant)请求级临界区:push 取锁+换 essential.TERMS,整盘计算(尊贵/界主/互容接纳/
        # 围攻日木互容/predictives)都用所选界,finally 必还原+释放锁(防并发串界)。默认埃及=零回归。
        _terms_orig = None
        _trip_orig = None  # 必须与 _terms_orig 同预初始化:守卫早退(invalid_date/invalid_coordinates)时 finally 引用它,漏初始化=UnboundLocalError→500
        try:
            data = cherrypy.request.json

            # 畸形日期护栏：前端 PD-sync 偶发会发来 date/time='NaN...'（旧 bug，前端亦已多处拦截）。
            # 此处干净返回、不进 PerChart（避免 Datetime 抛栈刷日志），前端按空响应处理、不弹 param error。
            _dprobe = '{0}'.format(data.get('date', ''))
            _tprobe = '{0}'.format(data.get('time', ''))
            if 'NaN' in _dprobe or 'NaN' in _tprobe or _dprobe.strip() == '':
                return jsonpickle.encode({'err': 'invalid_date'}, unpicklable=False)
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
            # horosa_chart_no_stdout_dump_v1:原先每个 /chart 都 print(data) —— 把**整个请求字典**
            # (含出生日期/时间/经纬度/地名等个人数据)同步写进 stdout。三重代价:①打包件里 stdout
            # 经管道回主进程并落日志文件,写盘在请求路径上同步发生;②它是调试残留,产线无人读;
            # ③把用户出生信息持续写进日志文件本身就不应该。需要时用下面的 _CHART_DEBUG_DUMP 显式开。
            if _CHART_DEBUG_DUMP:
                print(data, flush=True)

            _terms_orig = push_request_terms(data.get('termsVariant', 0), data.get('leoBoundFirst'))
            _trip_orig = push_request_trip(data.get('triplicity'))
            _pt0 = time.perf_counter() if _PY_CHART_TIMING else 0.0
            perchart = PerChart(data)
            _pt1 = time.perf_counter() if _PY_CHART_TIMING else 0.0
            guostar = GuoStarSect(perchart)
            guolao_sunrise_time = None
            if data.get('guolaoLifeMode') == 'yumao':
                try:
                    guolao_sunrise_time = perchart.getSunRiseTime().get('timeStr')
                except Exception:
                    traceback.print_exc()

            obj = {
                'params': {
                    'birth': perchart.getBirthStr(),
                    'ad': -1 if perchart.isBC else 1,
                    'lat': data['lat'],
                    'lon': data['lon'],
                    'hsys': data['hsys'],
                    'zone': data['zone'],
                    'tradition': perchart.tradition,
                    'zodiacal': perchart.zodiacal,
                    'siderealAyanamsa': perchart.siderealAyanamsa,
                    'doubingSu28': perchart.su28Mode,
                    'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
                    'showPdBounds': data.get('showPdBounds', 1),
                    'pdtype': perchart.pdtype,
                    'pdMethod': perchart.pdMethod,
                    'pdTimeKey': perchart.pdTimeKey,
                    'pdDirect': 1 if perchart.pdDirect else 0,
                    'pdConverse': 1 if perchart.pdConverse else 0,
                    'pdAntiscia': 1 if perchart.pdAntiscia else 0,
                    'pdTerms': 1 if perchart.pdTerms else 0,
                    'pdSyncRev': self.PD_SYNC_REV,
                },
                'chart': perchart.getChartObj(),
                'receptions': perchart.getReceptions(),
                'mutuals': perchart.getMutuals(),
                'declParallel': perchart.getParallel(),
                'aspects': {
                    'normalAsp': perchart.getAspects(),
                    'immediateAsp': perchart.getImmediateAspects(),
                    'signAsp': perchart.getSignAspects()
                },
                'lots': perchart.getPars(perchart.chart),
                'surround': {
                    'planets': perchart.surroundPlanets(),
                    'attacks': perchart.surroundAttacks(),
                    'houses': perchart.surroundHouses(),
                    'besiegement': perchart.besiegementDetail()
                },
                'guoStarSect': {
                    'houses': guostar.allTerm()
                }
            }
            if guolao_sunrise_time:
                obj['params']['guolaoLifeMode'] = data.get('guolaoLifeMode')
                obj['params']['guolaoSunRiseTime'] = guolao_sunrise_time

            predictives = getPredictivesObj(data, perchart)
            if predictives is not None:
                obj['predictives'] = predictives

            _pt2 = time.perf_counter() if _PY_CHART_TIMING else 0.0
            res = jsonpickle.encode(obj, unpicklable=False)
            if _PY_CHART_TIMING:
                # 三段:init(PerChart 构造)/build(取数组装)/encode(序列化)——补齐 python= 段构成黑盒
                _pt3 = time.perf_counter()
                ledger_mark('py.chart_req', extra={
                    'init_ms': round((_pt1 - _pt0) * 1000.0, 1),
                    'build_ms': round((_pt2 - _pt1) * 1000.0, 1),
                    'encode_ms': round((_pt3 - _pt2) * 1000.0, 1),
                })
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
        finally:
            pop_request_trip(_trip_orig)
            pop_request_terms(_terms_orig)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def chart13(self):
        enable_crossdomain()
        _terms_orig = None
        _trip_orig = None  # 必须与 _terms_orig 同预初始化:守卫早退(invalid_date/invalid_coordinates)时 finally 引用它,漏初始化=UnboundLocalError→500
        try:
            data = cherrypy.request.json

            data['tradition'] = False
            data['predictive'] = False
            _terms_orig = push_request_terms(data.get('termsVariant', 0), data.get('leoBoundFirst'))
            _trip_orig = push_request_trip(data.get('triplicity'))
            perchart = PerChart(data)
            chart13 = ThirteenthChart(perchart)
            chart13.fractal()

            guostar = GuoStarSect(perchart)

            obj = {
                'params': {
                    'birth': perchart.getBirthStr(),
                    'ad': -1 if perchart.isBC else 1,
                    'lat': data['lat'],
                    'lon': data['lon'],
                    'hsys': data['hsys'],
                    'zone': data['zone'],
                    'tradition': perchart.tradition,
                    'zodiacal': perchart.zodiacal,
                    'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
                    'showPdBounds': data.get('showPdBounds', 1),
                    'pdtype': perchart.pdtype,
                    'pdMethod': perchart.pdMethod,
                    'pdTimeKey': perchart.pdTimeKey,
                    'pdDirect': 1 if perchart.pdDirect else 0,
                    'pdConverse': 1 if perchart.pdConverse else 0,
                    'pdAntiscia': 1 if perchart.pdAntiscia else 0,
                    'pdTerms': 1 if perchart.pdTerms else 0,
                    'pdSyncRev': self.PD_SYNC_REV,
                },
                'chart': perchart.getChartObj(),
                'receptions': perchart.getReceptions(),
                'mutuals': perchart.getMutuals(),
                'declParallel': perchart.getParallel(),
                'aspects': {
                    'normalAsp': perchart.getAspects(),
                    'immediateAsp': perchart.getImmediateAspects(),
                    'signAsp': perchart.getSignAspects()
                },
                'lots': perchart.getPars(perchart.chart),
                'surround': {
                    'planets': perchart.surroundPlanets(),
                    'attacks': perchart.surroundAttacks(),
                    'houses': perchart.surroundHouses(),
                    'besiegement': perchart.besiegementDetail()
                },
                'guoStarSect': {
                    'houses': guostar.allTerm()
                }
            }

            predictives = getPredictivesObj(data, perchart)
            if predictives is not None:
                obj['predictives'] = predictives

            res = jsonpickle.encode(obj, unpicklable=False)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
        finally:
            pop_request_trip(_trip_orig)
            pop_request_terms(_terms_orig)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def chart12(self):
        # 十二分盘(Dwadasamsa):newlon = (lon × 12) mod 360,与十三分盘同结构,仅换 HarmonicChart(perchart, 12)。
        enable_crossdomain()
        _terms_orig = None
        _trip_orig = None  # 必须与 _terms_orig 同预初始化:守卫早退(invalid_date/invalid_coordinates)时 finally 引用它,漏初始化=UnboundLocalError→500
        try:
            data = cherrypy.request.json

            data['tradition'] = False
            data['predictive'] = False
            _terms_orig = push_request_terms(data.get('termsVariant', 0), data.get('leoBoundFirst'))
            _trip_orig = push_request_trip(data.get('triplicity'))
            perchart = PerChart(data)
            HarmonicChart(perchart, 12).apply()

            guostar = GuoStarSect(perchart)

            obj = {
                'params': {
                    'birth': perchart.getBirthStr(),
                    'ad': -1 if perchart.isBC else 1,
                    'lat': data['lat'],
                    'lon': data['lon'],
                    'hsys': data['hsys'],
                    'zone': data['zone'],
                    'tradition': perchart.tradition,
                    'zodiacal': perchart.zodiacal,
                    'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
                    'showPdBounds': data.get('showPdBounds', 1),
                    'pdtype': perchart.pdtype,
                    'pdMethod': perchart.pdMethod,
                    'pdTimeKey': perchart.pdTimeKey,
                    'pdDirect': 1 if perchart.pdDirect else 0,
                    'pdConverse': 1 if perchart.pdConverse else 0,
                    'pdAntiscia': 1 if perchart.pdAntiscia else 0,
                    'pdTerms': 1 if perchart.pdTerms else 0,
                    'pdSyncRev': self.PD_SYNC_REV,
                },
                'chart': perchart.getChartObj(),
                'receptions': perchart.getReceptions(),
                'mutuals': perchart.getMutuals(),
                'declParallel': perchart.getParallel(),
                'aspects': {
                    'normalAsp': perchart.getAspects(),
                    'immediateAsp': perchart.getImmediateAspects(),
                    'signAsp': perchart.getSignAspects()
                },
                'lots': perchart.getPars(perchart.chart),
                'surround': {
                    'planets': perchart.surroundPlanets(),
                    'attacks': perchart.surroundAttacks(),
                    'houses': perchart.surroundHouses(),
                    'besiegement': perchart.besiegementDetail()
                },
                'guoStarSect': {
                    'houses': guostar.allTerm()
                }
            }

            predictives = getPredictivesObj(data, perchart)
            if predictives is not None:
                obj['predictives'] = predictives

            res = jsonpickle.encode(obj, unpicklable=False)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
        finally:
            pop_request_trip(_trip_orig)
            pop_request_terms(_terms_orig)


def _identity_deep_ok():
    """[V-5] 身份深探真算:flatlib 儒略日(真业务库、纯计算零 I/O)。
    任何异常收敛为 False(探针绝不把服务打崩);HOROSA_IDENTITY_DEEP_FAIL=1 为 dev 注错钩。"""
    try:
        if os.environ.get('HOROSA_IDENTITY_DEEP_FAIL') == '1':
            return False
        from flatlib.datetime import Datetime as _IdDt
        jd = _IdDt('2000/01/01', '12:00', '+00:00').jd
        return abs(float(jd) - 2451545.0) < 1e-6
    except Exception:
        return False


def CORS():
    if cherrypy.request.method == 'OPTIONS':
        # preflign request
        # see http://www.w3.org/TR/cors/#cross-origin-request-with-preflight-0
        cherrypy.response.headers['Access-Control-Allow-Methods'] = 'GET, POST, HEAD, PUT, DELETE, OPTIONS'
        cherrypy.response.headers['Access-Control-Allow-Headers'] = 'Accept, Accept-Encoding, Accept-Language, Host, Origin, X-Requested-With, Content-Type, User-Agent, Content-Length, Last-Modified, Access-Control-Request-Headers, HTTP_X_REAL_IP, HTTP_X_FORWARDED_FOR, x-forwarded-for, Token, x-remote-IP, x-originating-IP, x-remote-addr, x-remote-ip, x-client-ip, x-client-IP, X-Real-ip, ImgTokenListName, SmsTokenListName, _IMGTOKENLIST, _SMSTOKENLIST, Signature, LocalIp, ClientChannel, ClientApp, ClientVer'
        cherrypy.response.headers['Access-Control-Allow-Origin'] = '*'
        # tell CherryPy no avoid normal handler
        return True
    else:
        cherrypy.response.headers['Access-Control-Allow-Origin'] = '*'


def _chart_port_free(host, port):
    """True if (host, port) can be bound right now (即没有活进程在 LISTEN)。"""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((host, port))
        return True
    except OSError:
        return False
    finally:
        try:
            s.close()
        except Exception:
            pass


def _pids_listening_on(port):
    """Best-effort 跨平台:返回正在 LISTEN 指定 TCP 端口的 PID 集合。"""
    pids = set()
    try:
        if sys.platform.startswith('win'):
            out = subprocess.run(['netstat', '-ano', '-p', 'tcp'],
                                 capture_output=True, text=True, timeout=6).stdout or ''
            needle = ':%d' % port
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 5 and parts[0].upper() == 'TCP' \
                        and parts[1].endswith(needle) and 'LISTEN' in parts[3].upper():
                    pid = parts[-1]
                    if pid.isdigit():
                        pids.add(int(pid))
        else:
            # -nP 必带:不带时 lsof 做 DNS/服务名反查,离线/DNS 慢时可拖数十秒(超出 timeout=6 假阴性)。
            out = subprocess.run(['lsof', '-nP', '-tiTCP:%d' % port, '-sTCP:LISTEN'],
                                 capture_output=True, text=True, timeout=6).stdout or ''
            for line in out.splitlines():
                line = line.strip()
                if line.isdigit():
                    pids.add(int(line))
    except Exception:
        pass
    return pids


def _is_stale_chart_python(pid):
    """启发式:该 PID 是否是「我们自己的 chart-service python 僵尸」(可安全回收)。
    只在命令行同时含 python 且含 webchartsrv/astropy/horosa 时为真 —— 绝不误杀第三方应用。"""
    try:
        if sys.platform.startswith('win'):
            out = subprocess.run(
                ['wmic', 'process', 'where', 'ProcessId=%d' % pid, 'get', 'CommandLine'],
                capture_output=True, text=True, timeout=6).stdout or ''
        else:
            out = subprocess.run(['ps', '-p', str(pid), '-o', 'command='],
                                 capture_output=True, text=True, timeout=6).stdout or ''
        cmd = out.lower()
        if 'python' not in cmd:
            return False
        return any(k in cmd for k in ('webchartsrv', 'astropy', 'horosa'))
    except Exception:
        return False


def _kill_pid(pid):
    try:
        if sys.platform.startswith('win'):
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(pid)],
                           capture_output=True, timeout=6)
        else:
            os.kill(pid, signal.SIGKILL)
    except Exception:
        pass


def ensure_chart_port_free(host, port, attempts=12, wait=0.5):
    """成熟方案:CherryPy 绑定前确保 chart 端口可用,彻底消除「Port not free / 本地排盘服务未就绪」反复起不来。
    场景:上次实例崩溃/被强退后,僵尸 python 仍 LISTEN 8899 → CherryPy portend 直接 'Port not free' 退出(code 70)。
    做法:①探测端口;②若被占,定位 LISTEN 该端口的 PID,仅当它是「我们自己的 chart python 僵尸」才 kill(安全,不误杀他人);
         ③轮询等待 OS 释放后重试。返回端口是否最终可用。"""
    if _chart_port_free(host, port):
        return True
    print('[chart] port %d busy at boot, reclaiming stale runtime...' % port, flush=True)
    killed = False
    for pid in _pids_listening_on(port):
        if pid == os.getpid():
            continue
        if _is_stale_chart_python(pid):
            print('[chart] killing stale chart python pid=%d holding port %d' % (pid, port), flush=True)
            _kill_pid(pid)
            killed = True
    if not killed:
        print('[chart] no stale Horosa python found on port %d (held by another app?).' % port, flush=True)
    for _ in range(max(1, attempts)):
        if _chart_port_free(host, port):
            print('[chart] port %d is free, proceeding.' % port, flush=True)
            return True
        time.sleep(wait)
    print('[chart] WARNING port %d still busy after %d attempts.' % (port, attempts), flush=True)
    return _chart_port_free(host, port)


# ── 启动就绪门(温启提速):warmup(PD+india)移后台线程,HOROSA_READY 提前 ~1.5-2s。
# 正确性:业务 POST 在门上等 warmup 完成才放行 —— 与旧同步方案同语义(请求最早也要等
# warmup 完),但端口/探活/前端导航全部提前;任何请求的最早可服务时刻不晚于旧方案。
# 并发安全:门保证 warmup 期间无业务请求并发(沿旧注释对 swisseph 全局 sid_mode 的顾虑,
# 见 tests/test_swe_concurrency.py);探活(GET /、/healthz、OPTIONS)不改 sid_mode,放行。
# kill-switch:HOROSA_PY_WARMUP_SYNC=1 回退旧同步顺序。
STARTUP_GATE = threading.Event()


def _startup_gate_tool():
    if STARTUP_GATE.is_set():
        return
    req = cherrypy.request
    if req.method in ('GET', 'OPTIONS', 'HEAD'):
        return  # 探活/预检不碰计算与 sid_mode
    # 兜底超时:warmup 异常挂死也不至于永久拒绝服务(warmup 平常 1.5-2s)
    STARTUP_GATE.wait(timeout=60)


def _warm_real_astropy():
    # xuanshi_astropy_warmup:提前把真 astropy(PyPI 天文库,kintaiyi 太乙引擎依赖)装入
    # sys.modules——启动门(STARTUP_GATE)保证业务 POST 必在 warmup 之后,故「真 astropy
    # 先于任何桩交互场景装入」被钉死,kentang 挂载顺序从此不再承重(v3.2.0 太乙静默 404
    # 事故的顺序免疫层;根因层见 kinastro_common 桩 dunder 守卫)。瘦身包未随 astropy
    # 时 ImportError 静默跳过(功能由各服务自身兜底),其它异常打印不吞。
    try:
        import astropy.units   # noqa: F401
        import astropy.coordinates   # noqa: F401
        import astropy.time   # noqa: F401
    except ImportError:
        pass
    except Exception:
        traceback.print_exc()


def _run_warmups():
    _warm_real_astropy()
    try:
        t0 = time.perf_counter()
        warm_chart = PerChart(dict(WebChartSrv.PD_WARMUP_SAMPLE))
        warm_chart.getPredict().getPrimaryDirection()
        WebChartSrv.WARMED = True
        _pd_ms = (time.perf_counter() - t0) * 1000.0
        print('pd warmup ready in {0:.3f}s'.format(_pd_ms / 1000.0), flush=True)
        ledger_mark('py.warmup_pd', t0=_PY_T0, ms=_pd_ms)
    except Exception:
        traceback.print_exc()
    # [B5] 核心 14 服务预装(开门前):挂载阶段零导入的债在此偿清 —— 门保证业务 POST
    # 必在预装后,任何请求最早可服务时刻不晚于旧方案;失败留给首个真实请求响亮 500。
    try:
        t_core = time.perf_counter()
        _c_loaded, _c_failed = prewarm_core_services()
        _core_ms = (time.perf_counter() - t_core) * 1000.0
        print('core services prewarm ready in {0:.3f}s (loaded={1}, failed={2})'.format(
            _core_ms / 1000.0, _c_loaded, _c_failed), flush=True)
        ledger_mark('py.warmup_core', t0=_PY_T0, ms=_core_ms)
    except Exception:
        traceback.print_exc()
    # 印度盘预热:把 india 各子算法冷路径载入,消除首次进入印度占星的 ~3s 冷启动;
    # 与业务请求的并发由启动门隔离(门开前无业务 POST 进入)。失败静默不影响服务。
    try:
        from websrv.webindiasrv import warmup_india   # [B5] 下沉:india 链离开 import 墙
        t1 = time.perf_counter()
        warmup_india()
        _in_ms = (time.perf_counter() - t1) * 1000.0
        print('india warmup ready in {0:.3f}s'.format(_in_ms / 1000.0), flush=True)
        ledger_mark('py.warmup_india', t0=_PY_T0, ms=_in_ms)
    except Exception:
        traceback.print_exc()
    # kentang 懒挂载空闲预热(WS-3d):挂载阶段零导入(mounts 段 -1.2~1.9s),
    # 监听后在本 warmup 线程逐个补装真服务——用户首点通常已就绪;
    # 预热失败只打日志,首个真实请求会以 KentangServiceLoadError 响亮 500(同一加载路径)。
    try:
        from websrv.kentang.registry import prewarm_kentang_services
        t2 = time.perf_counter()
        _loaded, _failed = prewarm_kentang_services()
        _kt_ms = (time.perf_counter() - t2) * 1000.0
        print('kentang prewarm ready in {0:.3f}s (loaded={1}, failed={2})'.format(
            _kt_ms / 1000.0, _loaded, _failed), flush=True)
        ledger_mark('py.warmup_kentang', t0=_PY_T0, ms=_kt_ms)
    except Exception:
        traceback.print_exc()
    STARTUP_GATE.set()
    # horosa_kentang_prewarm_modules_v1:请求路径内惰性 import 的重模块(当前:太乙·博弈论,
    # 实测冷导入 528ms / 温 0.001ms)。**刻意放在门之后** —— prewarm_kentang_services() 跑在
    # 门之前,把这半秒并进去等于直接把启动门推迟 528ms;预热只许吃空闲,不许延长等待窗
    # (与下面 xuanshi 预热同一条规矩)。只 import 不调用 ⇒ 任何请求输出逐字节不变。
    # kill-switch:HOROSA_KENTANG_MODULE_PREWARM=0。
    if os.environ.get('HOROSA_KENTANG_MODULE_PREWARM', '1').lower() not in ('0', 'false', 'no', 'off'):
        try:
            t5 = time.perf_counter()
            from websrv.kentang.registry import prewarm_kentang_modules
            _mw, _mf = prewarm_kentang_modules()
            _mw_ms = (time.perf_counter() - t5) * 1000.0
            print('kentang module prewarm ready in {0:.3f}s (warmed={1}, failed={2})'.format(
                _mw_ms / 1000.0, _mw, _mf), flush=True)
            ledger_mark('py.warmup_kentang_modules', t0=_PY_T0, ms=_mw_ms)
        except Exception:
            traceback.print_exc()
    # xuanshi_summary_warmup_v1:玄学史首点的最大一次性成本不在 XuanShiSrv 类加载
    # (上面的 kentang prewarm 已盖),而在 global_summary() 首算(全表 load_events()
    # SELECT + 译名 join + celestial 装载,冷 ~2.3s)。放在门开之后:绝不延长业务请求
    # 的等待窗;global_summary 纯只读 + 模块级 memo,预热与首点返回同一 dict,逐字节
    # 一致,只是把成本从可见点击路径挪进空闲。失败静默=首点回到冷即付的现状。
    # kill-switch:HOROSA_XUANSHI_WARMUP=0。
    if os.environ.get('HOROSA_XUANSHI_WARMUP', '1').lower() not in ('0', 'false', 'no', 'off'):
        try:
            t3 = time.perf_counter()
            from astrostudy import xuanshi as _xs_wu
            _xs_wu.global_summary()
            _xs_ms = (time.perf_counter() - t3) * 1000.0
            print('xuanshi summary warmup ready in {0:.3f}s'.format(_xs_ms / 1000.0), flush=True)
            ledger_mark('py.warmup_xuanshi_summary', t0=_PY_T0, ms=_xs_ms)
        except Exception:
            pass
        # horosa_xuanshi_longtext_ondemand_v1:上面那发只暖到 summary 端点(20KB/59ms,且客户端已去重),
        # 天象微年表页首屏真正付的是 microchronology 无筛选那一发(全表扫 + 全量序列化)。它不走
        # load_events memo,故 summary 预热盖不到 —— 这里按「前端进页时的同一组参数」
        # (无筛选 + limit=MICRO_LIST_LIMIT)预热 celestial 模块自己的 micro memo:预热与首点命中
        # 同一 memo 键、返回同一 dict,逐字节一致,只是把成本从可见点击路径挪进空闲。
        # 失败静默 = 首点回到冷即付的现状;kill-switch 同上 HOROSA_XUANSHI_WARMUP=0。
        try:
            t4 = time.perf_counter()
            from astrostudy.xuanshi import celestial as _xs_ce
            _xs_ce.microchronology(limit=_xs_ce.MICRO_LIST_LIMIT)
            _mc_ms = (time.perf_counter() - t4) * 1000.0
            print('xuanshi microchronology warmup ready in {0:.3f}s'.format(_mc_ms / 1000.0), flush=True)
            ledger_mark('py.warmup_xuanshi_micro', t0=_PY_T0, ms=_mc_ms)
        except Exception:
            pass


if __name__ == '__main__':
    _warmup_sync = os.environ.get('HOROSA_PY_WARMUP_SYNC', '0') == '1'
    if _warmup_sync:
        _run_warmups()   # 旧行为:warmup 完才继续起服务

    chart_port = int(os.environ.get('HOROSA_CHART_PORT', '8899'))
    cherrypy.config.update({'server.socket_host': '127.0.0.1',
                            'server.socket_port': chart_port,
                            'server.thread_pool': 30,
                            'engine.autoreload.on': False,
                            })

    cherrypy.tools.cors = cherrypy._cptools.HandlerTool(CORS)
    cherrypy.tools.startup_gate = cherrypy.Tool('before_handler', _startup_gate_tool, priority=10)
    cherrypy.config.update({'tools.startup_gate.on': True})

    cherrypy.tree.mount(WebChartSrv(), '/')
    mount_core_services()
    mount_kentang_services(cherrypy)
    ledger_mark('py.mounts_done', t0=_PY_T0)

    # 绑定前先确保端口可用(回收上次崩溃残留的僵尸 chart python),消除「Port 8899 not free」反复起不来。
    ensure_chart_port_free('127.0.0.1', chart_port)

    if not _warmup_sync:
        threading.Thread(target=_run_warmups, name='horosa-warmup', daemon=True).start()
    else:
        STARTUP_GATE.set()

    cherrypy.engine.start()
    # P0 启动握手:监听后向 stdout 报端口,壳/launcher 可确认「此端口确为本次起的 chart 后端」(消 TOCTOU/误判)。
    print('HOROSA_READY chart_port={0}'.format(chart_port), flush=True)
    ledger_mark('py.listening', t0=_PY_T0, extra={'port': chart_port})
    cherrypy.engine.block()
