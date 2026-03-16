import traceback
import jsonpickle
import cherrypy
from astrostudy.acg.ACGraph import ACGraph

from websrv.helper import enable_crossdomain, build_param_error_response, RequestResultCache, get_request_cache_dir


def build_acg_cache_payload(data):
    if not isinstance(data, dict):
        return data
    cache_keys = (
        'date',
        'time',
        'zone',
        'lat',
        'lon',
        'ad',
        'zodiacal',
        'tradition',
        'southchart',
    )
    payload = {}
    for key in cache_keys:
        if key in data:
            payload[key] = data[key]
    return payload


class AcgSrv:
    exposed = True
    RESPONSE_CACHE = RequestResultCache(max_entries=24, ttl_sec=1200, persist_dir=get_request_cache_dir('acg'))

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def acg(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            cache_payload = build_acg_cache_payload(data)

            def _build():
                acg = ACGraph(data)
                obj = acg.compute()
                return jsonpickle.encode(obj, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('location.acg', cache_payload, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)
