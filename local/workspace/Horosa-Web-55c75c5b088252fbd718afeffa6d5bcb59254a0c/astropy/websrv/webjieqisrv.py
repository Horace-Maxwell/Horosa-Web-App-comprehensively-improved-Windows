import sys
import traceback
import jsonpickle
import cherrypy
from astrostudy.jieqi.YearJieQi import YearJieQi
from astrostudy.jieqi.BirthJieQi import BirthJieQi
from astrostudy.jieqi.NongLi import NongLi

from websrv.helper import enable_crossdomain, build_param_error_response, RequestResultCache, get_request_cache_dir

class JieQiSrv:
    exposed = True
    RESPONSE_CACHE = RequestResultCache(max_entries=24, ttl_sec=1200, persist_dir=get_request_cache_dir('jieqi'))

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def year(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            def _build():
                jieqi = YearJieQi(data)
                obj = jieqi.compute()
                return jsonpickle.encode(obj, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('jieqi.year', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def birth(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            def _build():
                jieqi = BirthJieQi(data)
                obj = jieqi.compute()
                return jsonpickle.encode(obj, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('jieqi.birth', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def nongli(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            def _build():
                jieqi = NongLi(data)
                obj = jieqi.compute()
                return jsonpickle.encode(obj, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('jieqi.nongli', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)
