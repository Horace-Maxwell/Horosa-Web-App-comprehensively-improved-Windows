
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
    _JSONPICKLE_REAL = True
except ImportError:
    class _JsonpickleCompat:
        @staticmethod
        def encode(obj, unpicklable=False):
            return json.dumps(obj, ensure_ascii=False, default=str)

    jsonpickle = _JsonpickleCompat()
    _JSONPICKLE_REAL = False

# [R5 T2] 响应 JSON 快径:单源见 websrv/fastjson.py(允许名单式扁平化;名单外回退真 jsonpickle;HOROSA_FAST_JSON_ENCODE=0 关)
if _JSONPICKLE_REAL:
    from websrv.fastjson import install as _install_fast_json, install_global as _install_fast_json_global
    # [R5 P0-3] 进程级:所有挂载服务共用真 jsonpickle 模块,先把它的 encode 换成快径版(HOROSA_FAST_JSON_GLOBAL=0 关)
    _install_fast_json_global(jsonpickle)
    jsonpickle = _install_fast_json(jsonpickle)

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

from astrostudy.perchart import PerChart, parse_terms_variant, push_classical_request, pop_classical_request
from astrostudy.guostarsect.guostarsect import GuoStarSect
from astrostudy.thirteenthchart import ThirteenthChart, HarmonicChart, DodecatemoriaChart
from astrostudy.helper import getPredictivesObj
from websrv.helper import enable_crossdomain
from websrv._guards import validate_geo
# [B5] 14 个非 kentang 服务改惰性挂载(复用 kentang _LazyMountedService 通用代理):
# 此前顶层同步 import 是 py.interp_start→imports_done 的主墙(每个服务各拖自家引擎链),
# 现挂载零导入、监听提前;warmup 线程在开门前逐个预装(prewarm)——任何业务 POST 的最早
# 可服务时刻不晚于旧方案(单一 STARTUP_GATE 语义不变,sid_mode 并发安全同旧)。
# kill-switch:HOROSA_CORE_LAZY=0 回退旧饿加载(eager import + 直挂)。
from websrv.kentang.registry import mount_kentang_services, _LazyMountedService, _load_service, KENTANG_SERVICE_SPECS

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
    # 天星择日·征象搜索(Calculate 侧;动盘侧=qizhengelection)。
    {"key": "electionscan", "mount": "/electionscan", "module": "websrv.webelectionscansrv", "class_name": "ElectionScanSrv"},
    # [Z7] 七政择日·征象扫描(qizheng_election_scan;与天星 electionscan 同形薄壳)。
    {"key": "qizhengelectionscan", "mount": "/qizhengelectionscan", "module": "websrv.webqizhengelectionscansrv", "class_name": "QizhengElectionScanSrv"},
    # [Z8] 印度择日·征象扫描(india_election_scan;同形薄壳)。
    {"key": "indiaelectionscan", "mount": "/indiaelectionscan", "module": "websrv.webindiaelectionscansrv", "class_name": "IndiaElectionScanSrv"},
]


# horosa_electionscan_postgate_prewarm_v1(v3.7.0 覆盖修):门前预装集是**预算表**。
# tier-3 核心预装跑在启动门开启(STARTUP_GATE 置位)之前,trusted 温启走串行档 ——
# (措辞刻意不写「门置位」的完整调用字面量:test_core_lazy_mount 以 find 首现做源序断言。)
# 集合里每加一个重服务,就把全体用户的就绪时刻推迟它整条冷 import 链(v3.7.0 实测:
# electionscan 链 [import swisseph + flatlib.ephem.swe + ~4.2k LOC] 令同机温启
# 3937→5042ms,与既档「门前 prewarm=直接推迟启动门」反模式同型,见下方门后段注记)。
# POST_GATE 集合内的键改在门后空闲段装载:首个真请求最坏付一次温 import(electionscan
# ~1.1s,落在显式「搜索」点击上;页面中栏 /chart 不受影响);/scan 的 ping 短路在触碰
# 引擎前返回;_LazyMountedService 每服务锁防双载。**新增 CORE 服务必须显式决定门前/门后**
# —— 发布链的门前键集白名单断言会拦住未决定的新键。
# kill-switch:HOROSA_ELECTIONSCAN_POSTGATE=0 ⇒ electionscan 回门前 tier-3(v3.7.0 原样)。
# [v3.10.0 +Z7/Z8] qizheng/india 择日扫描与 electionscan 同型:重冷 import 链(qizheng 走
# flatlib/swisseph,india 走 jyotish_engine ~10k LOC)、/scan ping 短路在触碰引擎前返回、
# 分钟级长任务只由显式「搜索」触发 —— 按 #89 显式决定:门后。共用同一 kill-switch。
POST_GATE_CORE_PREWARM_KEYS = {'electionscan', 'qizhengelectionscan', 'indiaelectionscan'}


def _electionscan_postgate_enabled():
    return os.environ.get('HOROSA_ELECTIONSCAN_POSTGATE', '1').lower() not in ('0', 'false', 'no', 'off')


def _postgate_core_keys():
    return POST_GATE_CORE_PREWARM_KEYS if _electionscan_postgate_enabled() else set()


def _core_lazy_enabled():
    return os.environ.get('HOROSA_CORE_LAZY', '1') not in ('0', 'false', 'no', 'off')


def mount_core_services():
    lazy = _core_lazy_enabled()
    for spec in CORE_SERVICE_SPECS:
        if lazy:
            cherrypy.tree.mount(_LazyMountedService(spec), spec["mount"])
        else:
            cherrypy.tree.mount(_load_service(spec), spec["mount"])


def prewarm_core_services(only_keys=None, exclude_keys=None):
    loaded = 0
    failed = 0
    # horosa_electionscan_postgate_prewarm_v1:POST_GATE 集合内的键不在门前装
    # (由门后段的 prewarm_postgate_core_services 承接;开关关闭时集合为空=原样)。
    # horosa_py_early_gate_v1:only_keys / exclude_keys 把同一预装拆成「首屏面」与「其余」两次调用
    # (两者都为 None 时行为逐字节同旧)。
    skip = _postgate_core_keys()
    for spec in CORE_SERVICE_SPECS:
        if spec.get("key") in skip:
            continue
        if only_keys is not None and spec.get("key") not in only_keys:
            continue
        if exclude_keys is not None and spec.get("key") in exclude_keys:
            continue
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


def prewarm_postgate_core_services():
    # 门后装载 POST_GATE 集合(与门前同构;饿加载态 root 非 _LazyMountedService ⇒ 天然 no-op)。
    loaded = 0
    failed = 0
    for spec in CORE_SERVICE_SPECS:
        if spec.get("key") not in _postgate_core_keys():
            continue
        try:
            app = cherrypy.tree.apps.get(spec["mount"])
            root = getattr(app, "root", None)
            if isinstance(root, _LazyMountedService):
                root._horosa_load()
                loaded += 1
        except Exception:
            failed += 1
            print("[core] postgate prewarm failed %s" % spec.get("key"), flush=True)
            traceback.print_exc()
    return loaded, failed

ledger_mark('py.imports_done', t0=_PY_T0)

# 请求级三段计时(HOROSA_PY_CHART_TIMING)并入启动账本:
# 开=对 /chart 记 init/build/encode 三段写账本;默认关=输出与响应逐字节不变。
_PY_CHART_TIMING = os.environ.get('HOROSA_PY_CHART_TIMING', '0').lower() in ('1', 'true', 'yes', 'on')
# horosa_chart_no_stdout_dump_v1:PERF-R9 起 /chart 不再把整份请求字典(出生日期/时间/经纬度/地名等个人数据)
# 打到 stdout;v3.11.2 上游 [R5 T2] 直接删除该 print,原 HOROSA_CHART_DEBUG_DUMP 复现开关随之退役。
# 本标记留作五层契约哨兵/apply.sh 定位(删掉它不影响行为,但会让发布门失去这条纵深)。



# [F2] 古典口径回显全清单(条件回显:请求带了才回显 → 默认响应字节零变)。
# 三端点(/chart /chart13 /chart12)与 helper.getChartObj 同清单;缺谁谁在派生链静默回默认。
_CLASSICAL_ECHO_KEYS = (
    'termsVariant', 'leoBoundFirst', 'geminiBoundEmended',
    'triplicity', 'lotReversal', 'westNodeType', 'sectBuffer',
    'houseCuspAdvance', 'cazimiOrb', 'combustOrb', 'underBeamsOrb',
    'vocMode', 'vocIncludeOuter', 'starOrb', 'starOrbMode',
    'antisciaOrb', 'viaCombustaVariant',
    'lotsDocReverse', 'nodeExaltation',
    'combustOwnChariotExempt', 'westLilithType', 'topocentricMoon',
    'stationMarking',
    'hermeticLotsReversal', 'erosConstruction', 'lotFortuneVariant',
    'lotFatherCombustAlt', 'lotProjection', 'dignityDebilities',
    'almutenTripMode', 'planetaryHourMethod', 'orbSystem',
    'luminaryOrbBonus', 'aspectIncludeCusps', 'aspectIncludeLots',
    'aspectIncludeMidpoints', 'solarReturnVariant', 'returnLatitudeMode',
    'vulcanCalc', 'customTermsDay', 'customTermsNight',
    'siderealAyanamsa', 'userAyanT0', 'userAyanDeg',
    'orbs', 'orbScale')


class WebChartSrv:
    exposed = True
    PD_SYNC_REV = 'pd_method_sync_v15'
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
        _cls_tokens = None  # [0d] 五族古典临界区复合令牌;守卫早退时 finally 引用,预初始化纪律(漏初始化=UnboundLocalError→500)
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
            # [R5 T2] 此处原有 print(data):每次请求把整份参数(出生日期 / 时间 / 经纬度 / 地名)同步写 stdout,
            # 打包件里 stdout 经管道回壳并落日志文件(本机已 31 MB)—— 请求路径上的同步 I/O + 隐私,故删(Windows PY-14 同款)。

            _cls_tokens = push_classical_request(data)
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
            # 古典口径键条件回显(请求带了才回显 → 默认响应字节零变)。全量 22 键与
            # helper.getChartObj 同清单:前端派生盘(chartParams 透传链,25+ 调用点)读
            # chartObj.params 续传口径,白名单缺谁谁静默回默认(与主盘分叉+缓存键丢维)。
            for _vk in _CLASSICAL_ECHO_KEYS:
                if data.get(_vk) is not None:
                    obj['params'][_vk] = data.get(_vk)
            # [WP-5b] 相位参与对象扩展(默认全关返回 None → 不产字段,响应字节零变)。
            _extra_asp = perchart.getExtraAspects()
            if _extra_asp:
                obj['extraAspects'] = _extra_asp
            # [WP-8] 祝融星(推算行星;默认 off 返回 None → 零字段)。
            _vulcan = perchart.getVulcan()
            if _vulcan:
                obj['vulcan'] = _vulcan
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
            pop_classical_request(_cls_tokens)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def chart13(self):
        enable_crossdomain()
        _cls_tokens = None  # [0d] 五族古典临界区复合令牌;守卫早退时 finally 引用,预初始化纪律(漏初始化=UnboundLocalError→500)
        try:
            data = cherrypy.request.json

            data['tradition'] = False
            data['predictive'] = False
            _cls_tokens = push_classical_request(data)
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

            # 界内变体键条件回显(同 index 路由:请求带了才回显,默认响应字节零变)。
            # [F2] 与主 /chart 同全清单回显(此前只回显 2 键,13宫/12分盘派生链丢口径)。
            for _vk in _CLASSICAL_ECHO_KEYS:
                if data.get(_vk) is not None:
                    obj['params'][_vk] = data.get(_vk)

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
            pop_classical_request(_cls_tokens)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def chart12(self):
        # 十二分盘(dodecatemoria / 印占 D12):自本座起算 —— newlon = ((sign + floor(d/2.5)) mod 12)×30 + (12d mod 30),
        # 与十三分盘同结构。T-50:此前用 HarmonicChart(12)= 自白羊起算的 12 次谐波,11/12 星座落座全错、与调波盘 H12 恒等。
        enable_crossdomain()
        _cls_tokens = None  # [0d] 五族古典临界区复合令牌;守卫早退时 finally 引用,预初始化纪律(漏初始化=UnboundLocalError→500)
        try:
            data = cherrypy.request.json

            data['tradition'] = False
            data['predictive'] = False
            _cls_tokens = push_classical_request(data)
            perchart = PerChart(data)
            DodecatemoriaChart(perchart).apply()

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

            # 界内变体键条件回显(同 index 路由:请求带了才回显,默认响应字节零变)。
            # [F2] 与主 /chart 同全清单回显(此前只回显 2 键,13宫/12分盘派生链丢口径)。
            for _vk in _CLASSICAL_ECHO_KEYS:
                if data.get(_vk) is not None:
                    obj['params'][_vk] = data.get(_vk)

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
            pop_classical_request(_cls_tokens)


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

# ── 分级门:核心段(真 astropy + 主限法 + 核心服务 + 印度盘)装完即开 ──────────────────
# 新落盘的运行时(装包 / 更新后第一次启动)里,系统要对每个新原生库做一次首次加载评估,卜类引擎那一段
# 因此要多花 6–10 秒;主排盘这类不经卜类挂载点的请求此前一起被挡到全部装完(账本实证等了 9 秒多)。
# 分级后:
#   · 打到卜类挂载点的请求:照旧等全门(STARTUP_GATE),语义逐字不变;
#   · 其余业务请求:等核心门;核心门开后再给卜类段一段宽限(缺省 1.5 秒)—— 平时卜类段紧跟着就装完,
#     请求实际仍在全门之后放行(与单门相同);只有卜类段拖过宽限才先放行。
# 总开关 HOROSA_PY_TIERED_GATE=0 → 一律等全门(旧行为)。宽限 HOROSA_PY_CORE_GATE_GRACE_MS(毫秒)。
CORE_GATE = threading.Event()
_CORE_GATE_OPENED_AT = [None]
_KENTANG_MOUNTS = frozenset(spec['mount'] for spec in KENTANG_SERVICE_SPECS)


def _tiered_gate_enabled():
    return os.environ.get('HOROSA_PY_TIERED_GATE', '1').lower() not in ('0', 'false', 'no', 'off')


def _core_gate_grace_seconds():
    try:
        ms = float(os.environ.get('HOROSA_PY_CORE_GATE_GRACE_MS', '1500'))
    except (TypeError, ValueError):
        ms = 1500.0
    return min(max(ms, 0.0), 60000.0) / 1000.0


def _open_core_gate():
    if not CORE_GATE.is_set():
        _CORE_GATE_OPENED_AT[0] = time.perf_counter()
        ledger_mark('py.gate_core_open', t0=_PY_T0)
        CORE_GATE.set()


def _request_targets_kentang(req):
    return (getattr(req, 'script_name', '') or '') in _KENTANG_MOUNTS


# horosa_py_early_gate_v1(PERF-R13 P1,Windows-ahead;v3.11.3 起与上游分级门并存):第三道、更早的「首屏门」。
#   上游分级门(CORE_GATE + 宽限)在**全部非卜类段**装完后开,且非卜类请求还要再等卜类段最多 1.5s 宽限 ——
#   平时卜类段紧跟着完成 ⇒ 请求实际仍在全门时刻放行(上游的目标场景是「首次加载检查拖慢卜类段」)。
#   Windows 温启每次都要付这一段:首屏门 EARLY_GATE 在真 astropy 序钉 + PD 预热 + 核心服务(cetian 除外)装完
#   即开(独立起服务实测 2.1s → 0.96s;kentang 1.1s / india 0.3s / cetian 0.12s 全挪到门后,预热总量不变),
#   开着时非卜类请求**不经宽限**直接放行;卜类挂载点(按 KENTANG_SERVICE_SPECS 现读)照旧等全门 STARTUP_GATE
#   (= 旧单门时刻,v3.2.0「桩 astropy 先于真 astropy」顺序免疫层原样:kentang 业务 POST 绝不早于
#   _warm_real_astropy + prewarm_kentang_services)。GET/OPTIONS/HEAD 探活照旧不设门。
#   开关:HOROSA_PY_EARLY_GATE=1 才启用(桌面壳显式传入);缺省/=0 ⇒ 首屏门与全门同刻置位,请求时序退回上游
#   分级门 —— 上游 tests/test_startup_gate_tiers.py 与 test_warmup_parallel.py 的不变量在缺省态原样成立。
EARLY_GATE = threading.Event()


def _early_gate_enabled():
    return os.environ.get('HOROSA_PY_EARLY_GATE', '0').lower() in ('1', 'true', 'yes', 'on')


# 首屏面核心键 = CORE_SERVICE_SPECS 全部 − cetian(策天飞星:kinastro 栈冷 import ~120ms,非首屏)− 门后集合。
FIRST_SCREEN_CORE_EXCLUDE = frozenset({'cetian'})


_GATE_FIRST_WAIT_LOGGED = [False]


_PRIORITY_LANE_ON = os.environ.get('HOROSA_PRIORITY_LANE', '1').lower() not in ('0', 'false', 'no', 'off')


def _priority_lane_tool():
    # [R5 T5] 每个请求都设一次(线程池线程复用,不设会沿用上一个请求的值);缺头 / 其它值 = 前台 = 旧行为
    try:
        from astrostudy import perchart as _pc
        _pc.set_priority_lane_enabled(_PRIORITY_LANE_ON)
        kind = None
        if _PRIORITY_LANE_ON:
            kind = (cherrypy.request.headers.get('X-Horosa-Priority') or '').strip().lower()
        _pc.set_request_priority(kind)
    except Exception:
        pass


# [R5 P0-3] 请求内黄经 memo(astroextra.swe_lon)只对下列服务前缀开启:同请求里同 (天体, jd, 中心, 站心坐标)
# 只算一次,请求结束清空;其它请求一律无 memo。开关 HOROSA_SWE_LON_MEMO=0 见 astroextra。
_SWE_LON_MEMO_PREFIXES = (
    '/astroextra/',
)


def _swe_lon_memo_tool():
    req = cherrypy.request
    path = (req.script_name or '') + (req.path_info or '')
    ax = sys.modules.get('astrostudy.astroextra')
    if not path.startswith(_SWE_LON_MEMO_PREFIXES):
        if ax is not None:
            ax.swe_lon_memo_end()   # 保险:非目标请求一律无 memo(线程复用不带进上一请求的 memo)
        return
    if ax is None:
        try:
            from astrostudy import astroextra as ax
        except Exception:
            return
    ax.swe_lon_memo_begin()
    req.hooks.attach('on_end_request', ax.swe_lon_memo_end)


def _startup_gate_tool():
    if STARTUP_GATE.is_set():
        return
    req = cherrypy.request
    if req.method in ('GET', 'OPTIONS', 'HEAD'):
        return  # 探活/预检不碰计算与 sid_mode
    _is_kentang = _request_targets_kentang(req)
    # horosa_py_early_gate_v1:首屏门已开且非卜类挂载点 ⇒ 直接放行(不经上游核心门的宽限等待)。
    if _early_gate_enabled() and not _is_kentang and EARLY_GATE.is_set():
        return
    # [R4-P0 观察位] 门真实咬到业务 POST 时记一次(等待时长+路径)——P3-b 分级门的裁决数据
    # (装机首启 early-nav 下首个 /chart 是否撞门、撞多久;<300ms 则分级门判不做)。纯旁路。
    _wait_t0 = time.perf_counter()
    _via = 'full'
    if _early_gate_enabled() and not _is_kentang:
        # horosa_py_early_gate_v1:非卜类请求等首屏门(PD + 核心−cetian 装完即开);60 秒兜底同旧
        if EARLY_GATE.wait(timeout=60) and not STARTUP_GATE.is_set():
            _via = 'early'
    elif _tiered_gate_enabled() and not _is_kentang:
        # 核心门 60 秒都没开 = warmup 挂死,兜底放行(同旧);开了就再给卜类段剩余的宽限
        if CORE_GATE.wait(timeout=60):
            _opened = _CORE_GATE_OPENED_AT[0]
            _remaining = _core_gate_grace_seconds() - (time.perf_counter() - (_opened if _opened is not None else _wait_t0))
            if _remaining > 0:
                STARTUP_GATE.wait(timeout=_remaining)
            if not STARTUP_GATE.is_set():
                _via = 'core'
    else:
        # 兜底超时:warmup 异常挂死也不至于永久拒绝服务(warmup 平常 1.5-2s)
        STARTUP_GATE.wait(timeout=60)
    if not _GATE_FIRST_WAIT_LOGGED[0]:
        _GATE_FIRST_WAIT_LOGGED[0] = True
        try:
            _wait_ms = (time.perf_counter() - _wait_t0) * 1000.0
            ledger_mark('py.gate_first_wait', t0=_PY_T0, ms=_wait_ms,
                        extra={'path': getattr(req, 'path_info', '') or '', 'via': _via})
        except Exception:
            pass


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


def _warmup_stage_pd():
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


def _warmup_stage_core(only_keys=None, exclude_keys=None, label='core services', seg='py.warmup_core'):
    # [B5] 核心 14 服务预装(开门前):挂载阶段零导入的债在此偿清 —— 门保证业务 POST
    # 必在预装后,任何请求最早可服务时刻不晚于旧方案;失败留给首个真实请求响亮 500。
    # horosa_py_early_gate_v1:可按键集拆两次(首屏面 / 其余),缺省参数 = 旧行为。
    try:
        t_core = time.perf_counter()
        if only_keys is None and exclude_keys is None:
            _c_loaded, _c_failed = prewarm_core_services()   # 缺省调用形保留(上游 test_core_lazy_mount 以此字面做源序断言)
        else:
            _c_loaded, _c_failed = prewarm_core_services(only_keys=only_keys, exclude_keys=exclude_keys)
        _core_ms = (time.perf_counter() - t_core) * 1000.0
        print('{3} prewarm ready in {0:.3f}s (loaded={1}, failed={2})'.format(
            _core_ms / 1000.0, _c_loaded, _c_failed, label), flush=True)
        ledger_mark(seg, t0=_PY_T0, ms=_core_ms)
    except Exception:
        traceback.print_exc()


def _warmup_stage_india():
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


def _warmup_stage_kentang():
    # kentang 懒挂载空闲预热(WS-3d):挂载阶段零导入(mounts 段 -1.2~1.9s),
    # 监听后在 warmup 阶段逐个补装真服务——用户首点通常已就绪;
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


def _run_warmups():
    _warm_real_astropy()
    # [R4-P3a] PD 段并入并行组(下方),不再恒串行前置 —— 串行档(trusted)保持旧序逐字节不变。
    # 并行安全性依据:①flatlib 线程本地 sidereal context + 裸调用点 set→use 相邻直线
    # (tests/test_swe_concurrency.py 钉死);②生产稳态 CherryPy thread_pool=30 本就并发计算,
    # warmup 期并发不超出生产语义信封;③astropy 先序钉不动(_warm_real_astropy 恒第一,
    # kentang 桩免疫不破)。kill-switch:HOROSA_PY_PD_PARALLEL=0 恒回 PD 串行前置旧序。
    # [R3-B5] core/india/kentang 三段并行(原五段全串行):三段互不依赖(各装各的模块;
    # 共享底层 import 由解释器 import 锁天然互斥,数据面零竞争),磁盘 IO/SQLite 段真并行
    # → STARTUP_GATE 开门时刻从 sum(三段) 提前到 max(三段)。
    # 🔴 档位=auto(2026-07-21 ladder 实测定档):
    #   · 冷启/untrusted(首启·修复):串行 sum≈3.3s → 并行 max≈1.35s,大赢 → 并行;
    #   · 温启/trusted:串行链本就全程隐没在 Java 就绪墙影子里(端 1.34s < java 2.4s),
    #     并行反而三线程与 Java 启动抢核(实测 java_http_ready +141ms、py 门 1344→1457ms
    #     双输)→ 回串行旧序(行为逐字节同基线)。
    # 语义钉不变:门仍在全部预装完成后才 set;单段失败照旧段内自吞。
    # kill-switch:HOROSA_PY_WARMUP_PARALLEL=0 恒串行 / =1 恒并行 / 缺省 auto(按 trusted 分档)。
    _par_env = os.environ.get('HOROSA_PY_WARMUP_PARALLEL', 'auto')
    if _par_env == '0':
        _parallel = False
    elif _par_env == '1':
        _parallel = True
    else:
        # horosa_trusted_env_shape_v1(Windows-ahead,可上游化):trusted 的取值形态跨启动器
        # 不统一 —— Tauri/start.sh 传 '1',Electron 壳传 'true'。只判 != '1' 会把 Windows 温启
        # 误判成 untrusted → 并行档在温启与 Java 抢核(上游实测双输:java +141ms / py 门 +113ms)。
        # 按 truthy 家族解析,两种启动器语义一致;缺省 '0' 行为不变。
        _trusted_env = os.environ.get('HOROSA_TRUSTED_RUNTIME', '0').strip().lower()
        _parallel = _trusted_env not in ('1', 'true', 'yes', 'on')
    # [R4-P3a] PD 入并行组开关。🔴 缺省【关】(2026-08-03 同会话 ladder 实测定档):script 档
    # (untrusted 并行)PD 入组=并行窗四线程,与同窗 JVM 引导抢核【双输】——py 门开 1440→1857ms、
    # java_http_ready 2528→3551ms(R3「温启并行双输回串行」同族形态,冷启档同样成立)。
    # 代码路径保留:显式 HOROSA_PY_PD_PARALLEL=1 才开(装机首启档 Java 未必同窗,可另测再议)。
    _pd_parallel = _parallel and os.environ.get('HOROSA_PY_PD_PARALLEL', '0') == '1'
    if _early_gate_enabled():
        # horosa_py_early_gate_v1:首屏面(PD + 核心服务−cetian)串行先装 → 首屏门即开;其余(cetian /
        # india / kentang)按原并行档位继续 → 非卜类段装完开上游核心门、全部装完开全门。真 astropy 序钉在上方
        # _warm_real_astropy 恒第一,全门仍在 prewarm_kentang_services 之后 ⇒ 顺序免疫不破。
        _warmup_stage_pd()
        _warmup_stage_core(exclude_keys=FIRST_SCREEN_CORE_EXCLUDE)
        ledger_mark('py.gate_early_open', t0=_PY_T0)
        EARLY_GATE.set()
        _stages = (
            lambda: _warmup_stage_core(only_keys=FIRST_SCREEN_CORE_EXCLUDE, label='core services (rest)', seg='py.warmup_core_rest'),
            _warmup_stage_india,
            _warmup_stage_kentang,
        )
    elif _pd_parallel:
        # 冷启/untrusted 并行档:四段真并行,门开时刻 sum(pd+3段) → max(4段)
        # (R3 三段并行已证 sum→max 大赢;PD ~370-570ms 原恒串行前置,并入再省一段)。
        _stages = (_warmup_stage_pd, _warmup_stage_core, _warmup_stage_india, _warmup_stage_kentang)
    else:
        # 串行档(trusted/显式关):PD 保持原「先于三段」的位置 —— 执行序与 R3 逐字节同。
        _warmup_stage_pd()
        _stages = (_warmup_stage_core, _warmup_stage_india, _warmup_stage_kentang)
    if _parallel:
        _threads = [threading.Thread(target=_fn, name='horosa-warmup-{0}'.format(_i), daemon=True)
                    for _i, _fn in enumerate(_stages)]
        for _t in _threads:
            _t.start()
        # 分级门:卜类之外的各段先收齐 → 开核心门;再等卜类段
        for _t, _fn in zip(_threads, _stages):
            if _fn is not _warmup_stage_kentang:
                _t.join()
        _open_core_gate()
        for _t in _threads:
            _t.join()
    else:
        for _fn in _stages:
            if _fn is _warmup_stage_kentang:
                _open_core_gate()   # 串行档:卜类段之前的各段已装完
            _fn()
    _open_core_gate()   # 兜底:段表里没有卜类段时也要开
    # [R4-P0 观察位] 门开绝对时刻显式化(改前基线里门开时刻要靠 warmup 末段推算)。
    ledger_mark('py.gate_open', t0=_PY_T0)
    STARTUP_GATE.set()
    # horosa_py_early_gate_v1:全门(= 旧单门时刻)开后首屏门必开 —— 缺省态两门同刻,请求时序即上游分级门。
    EARLY_GATE.set()
    # horosa_electionscan_postgate_prewarm_v1:POST_GATE 集合的门后装载(注记见
    # CORE_SERVICE_SPECS 上方)。刻意放在门后段**首位**(先于 kentang modules 与 xuanshi
    # 两级预热)——冷 import 窗口最小化(~gate+1.1s 内收口);与邻居同款 try/except 吞错。
    if _postgate_core_keys():
        try:
            t6 = time.perf_counter()
            _pg_loaded, _pg_failed = prewarm_postgate_core_services()
            _pg_ms = (time.perf_counter() - t6) * 1000.0
            print('postgate core prewarm ready in {0:.3f}s (warmed={1}, failed={2})'.format(
                _pg_ms / 1000.0, _pg_loaded, _pg_failed), flush=True)
            ledger_mark('py.warmup_core_postgate', t0=_PY_T0, ms=_pg_ms)
        except Exception:
            traceback.print_exc()
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
    # [R5 T5] 请求优先级车道:X-Horosa-Priority: prefetch 的请求在 perchart 古典临界区前让前台请求先拿锁
    cherrypy.tools.priority_lane = cherrypy.Tool('before_handler', _priority_lane_tool, priority=11)
    cherrypy.config.update({'tools.priority_lane.on': True})
    cherrypy.tools.swe_lon_memo = cherrypy.Tool('before_handler', _swe_lon_memo_tool, priority=12)
    cherrypy.config.update({'tools.swe_lon_memo.on': True})

    cherrypy.tree.mount(WebChartSrv(), '/')
    mount_core_services()
    mount_kentang_services(cherrypy)
    ledger_mark('py.mounts_done', t0=_PY_T0)

    # 绑定前先确保端口可用(回收上次崩溃残留的僵尸 chart python),消除「Port 8899 not free」反复起不来。
    ensure_chart_port_free('127.0.0.1', chart_port)

    if not _warmup_sync:
        threading.Thread(target=_run_warmups, name='horosa-warmup', daemon=True).start()
    else:
        EARLY_GATE.set()   # horosa_py_early_gate_v1:同步档三道门同刻开
        CORE_GATE.set()
        STARTUP_GATE.set()

    cherrypy.engine.start()
    # P0 启动握手:监听后向 stdout 报端口,壳/launcher 可确认「此端口确为本次起的 chart 后端」(消 TOCTOU/误判)。
    print('HOROSA_READY chart_port={0}'.format(chart_port), flush=True)
    ledger_mark('py.listening', t0=_PY_T0, extra={'port': chart_port})
    cherrypy.engine.block()
