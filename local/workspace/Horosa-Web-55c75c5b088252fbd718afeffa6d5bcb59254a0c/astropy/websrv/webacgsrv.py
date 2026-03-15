import traceback
import jsonpickle
import cherrypy
from astrostudy.acg.ACGraph import ACGraph

from websrv.helper import enable_crossdomain, build_param_error_response, RequestResultCache, get_request_cache_dir

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

            def _build():
                acg = ACGraph(data)
                obj = acg.compute()
                return jsonpickle.encode(obj, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('location.acg', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)

