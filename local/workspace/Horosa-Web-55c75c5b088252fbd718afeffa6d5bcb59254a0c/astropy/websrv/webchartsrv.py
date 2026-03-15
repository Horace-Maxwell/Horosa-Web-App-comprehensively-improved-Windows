
import os
import sys
import traceback
import json
import time
import threading
from datetime import datetime
import cherrypy

try:
    import jsonpickle
except ImportError:
    class _JsonpickleCompat:
        @staticmethod
        def encode(obj, unpicklable=False):
            return json.dumps(obj, ensure_ascii=False, default=str)

    jsonpickle = _JsonpickleCompat()

# Ensure flatlib is resolvable from bundled sources.
_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJ_ROOT = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_FLATLIB_CANDIDATES = [
    os.path.join(_PROJ_ROOT, "flatlib-ctrad2"),
]
for _cand in reversed(_FLATLIB_CANDIDATES):
    if os.path.isdir(os.path.join(_cand, "flatlib")) and _cand not in sys.path:
        sys.path.insert(0, _cand)

from astrostudy.perchart import PerChart
from astrostudy.guostarsect.guostarsect import GuoStarSect
from astrostudy.thirteenthchart import ThirteenthChart
from astrostudy.acg.ACGraph import ACGraph
from astrostudy.helper import getPredictivesObj
from websrv.helper import enable_crossdomain, build_param_error_response, RequestResultCache, get_request_cache_dir
from websrv.webpredictsrv import PredictSrv
from websrv.webindiasrv import IndiaAstroSrv
from websrv.webmodernsrv import ModernAstroSrv
from websrv.webgermanysrv import GermanyAstroSrv
from websrv.webjieqisrv import JieQiSrv
from websrv.webjdn import WebJdnSrv
from websrv.webcalc import WebCalcSrv
from websrv.webacgsrv import AcgSrv


def _get_warmup_defaults():
    now = datetime.now()
    year = os.environ.get('HOROSA_WARM_YEAR') or str(now.year)
    return {
        'date': os.environ.get('HOROSA_WARM_DATE') or now.strftime('%Y/%m/%d'),
        'time': os.environ.get('HOROSA_WARM_TIME') or now.strftime('%H:%M:%S'),
        'zone': os.environ.get('HOROSA_WARM_ZONE') or '+08:00',
        'lat': os.environ.get('HOROSA_WARM_LAT') or '26n04',
        'lon': os.environ.get('HOROSA_WARM_LON') or '119e19',
        'gpsLat': float(os.environ.get('HOROSA_WARM_GPS_LAT') or '26.076417371316914'),
        'gpsLon': float(os.environ.get('HOROSA_WARM_GPS_LON') or '119.31516153077507'),
        'hsys': int(os.environ.get('HOROSA_WARM_HSYS') or '0'),
        'year': year,
    }


def _build_pd_warmup_sample():
    base = _get_warmup_defaults()
    return {
        'date': base['date'],
        'time': base['time'],
        'zone': base['zone'],
        'lat': base['lat'],
        'lon': base['lon'],
        'gpsLat': base['gpsLat'],
        'gpsLon': base['gpsLon'],
        'hsys': base['hsys'],
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
        'pdMethod': 'astroapp_alchabitius',
        'pdTimeKey': 'Ptolemy',
        'pdaspects': [0, 60, 90, 120, 180],
    }


def _build_jieqi_warmup_sample():
    base = _get_warmup_defaults()
    return {
        'year': base['year'],
        'zone': base['zone'],
        'lat': base['lat'],
        'lon': base['lon'],
        'gpsLat': base['gpsLat'],
        'gpsLon': base['gpsLon'],
        'hsys': base['hsys'],
        'zodiacal': 0,
        'doubingSu28': False,
    }


def _build_acg_warmup_sample():
    base = _get_warmup_defaults()
    return {
        'ad': 1,
        'date': base['date'],
        'time': base['time'],
        'zone': base['zone'],
        'lat': base['lat'],
        'lon': base['lon'],
        'gpsLat': base['gpsLat'],
        'gpsLon': base['gpsLon'],
        'name': 'Warmup',
        'pos': 'Warmup',
    }


class WebChartSrv:
    exposed = True
    RESPONSE_CACHE = RequestResultCache(max_entries=48, ttl_sec=1200, persist_dir=get_request_cache_dir('chart'))
    PD_SYNC_REV = 'pd_method_sync_v6'
    PD_WARMUP_SAMPLE = _build_pd_warmup_sample()
    JIEQI_WARMUP_SAMPLE = _build_jieqi_warmup_sample()
    ACG_WARMUP_SAMPLE = _build_acg_warmup_sample()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def index(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            print(data)
            return self.RESPONSE_CACHE.get_or_compute('chart.index', data, lambda: _build_chart_response(data))
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def chart13(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            return self.RESPONSE_CACHE.get_or_compute('chart.chart13', data, lambda: _build_chart13_response(data))
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)


def _build_chart_response(data):
    perchart = PerChart(data)
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
            'doubingSu28': perchart.isDoubingSu28,
            'showPdBounds': data.get('showPdBounds', 1),
            'pdtype': perchart.pdtype,
            'pdMethod': perchart.pdMethod,
            'pdTimeKey': perchart.pdTimeKey,
            'pdSyncRev': WebChartSrv.PD_SYNC_REV,
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
            'houses': perchart.surroundHouses()
        },
        'guoStarSect': {
            'houses': guostar.allTerm()
        }
    }

    predictives = getPredictivesObj(data, perchart)
    if predictives is not None:
        obj['predictives'] = predictives

    return jsonpickle.encode(obj, unpicklable=False)


def _build_chart13_response(data):
    payload = dict(data)
    payload['tradition'] = False
    payload['predictive'] = False
    perchart = PerChart(payload)
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
            'showPdBounds': data.get('showPdBounds', 1),
            'pdtype': perchart.pdtype,
            'pdMethod': perchart.pdMethod,
            'pdTimeKey': perchart.pdTimeKey,
            'pdSyncRev': WebChartSrv.PD_SYNC_REV,
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
            'houses': perchart.surroundHouses()
        },
        'guoStarSect': {
            'houses': guostar.allTerm()
        }
    }

    predictives = getPredictivesObj(data, perchart)
    if predictives is not None:
        obj['predictives'] = predictives

    return jsonpickle.encode(obj, unpicklable=False)


def _build_pd_response(data):
    perchart = PerChart(data)
    predict = perchart.getPredict()
    return jsonpickle.encode({
        'pd': predict.getPrimaryDirection()
    }, unpicklable=False)


def _run_runtime_warmup():
    from astrostudy.jieqi.YearJieQi import YearJieQi

    def _run_step(label, func):
        start = time.time()
        try:
            func()
            print('[warmup] {0} runtime primed in {1:.3f}s'.format(label, time.time() - start))
        except Exception:
            print('[warmup] {0} runtime prime failed'.format(label))
            traceback.print_exc()

    _run_step('chart', lambda: WebChartSrv.RESPONSE_CACHE.get_or_compute(
        'chart.index',
        dict(WebChartSrv.PD_WARMUP_SAMPLE),
        lambda: _build_chart_response(dict(WebChartSrv.PD_WARMUP_SAMPLE))
    ))

    _run_step('jieqi', lambda: JieQiSrv.RESPONSE_CACHE.get_or_compute(
        'jieqi.year',
        dict(WebChartSrv.JIEQI_WARMUP_SAMPLE),
        lambda: jsonpickle.encode(YearJieQi(dict(WebChartSrv.JIEQI_WARMUP_SAMPLE)).compute(), unpicklable=False)
    ))

    _run_step('pd', lambda: PredictSrv.RESPONSE_CACHE.get_or_compute(
        'predict.pd',
        dict(WebChartSrv.PD_WARMUP_SAMPLE),
        lambda: _build_pd_response(dict(WebChartSrv.PD_WARMUP_SAMPLE))
    ))

    _run_step('acg', lambda: AcgSrv.RESPONSE_CACHE.get_or_compute(
        'location.acg',
        dict(WebChartSrv.ACG_WARMUP_SAMPLE),
        lambda: jsonpickle.encode(ACGraph(dict(WebChartSrv.ACG_WARMUP_SAMPLE)).compute(), unpicklable=False)
    ))


def _start_runtime_warmup_thread():
    worker = threading.Thread(target=_run_runtime_warmup, name='horosa-chart-warmup', daemon=True)
    worker.start()
    return worker


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


if __name__ == '__main__':
    chart_port = int(os.environ.get('HOROSA_CHART_PORT', '8899'))
    cherrypy.config.update({'server.socket_host': '127.0.0.1',
                            'server.socket_port': chart_port,
                            'server.thread_pool': 30,
                            })

    cherrypy.tools.cors = cherrypy._cptools.HandlerTool(CORS)

    cherrypy.tree.mount(WebChartSrv(), '/')
    cherrypy.tree.mount(PredictSrv(), '/predict')
    cherrypy.tree.mount(IndiaAstroSrv(), '/india')
    cherrypy.tree.mount(ModernAstroSrv(), '/modern')
    cherrypy.tree.mount(GermanyAstroSrv(), '/germany')
    cherrypy.tree.mount(JieQiSrv(), '/jieqi')
    cherrypy.tree.mount(WebJdnSrv(), '/jdn')
    cherrypy.tree.mount(WebCalcSrv(), '/calc')
    cherrypy.tree.mount(AcgSrv(), '/location')

    cherrypy.engine.start()
    _start_runtime_warmup_thread()
    cherrypy.engine.block()
