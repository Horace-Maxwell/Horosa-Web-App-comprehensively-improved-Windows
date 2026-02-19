import sys
import traceback
import jsonpickle
import cherrypy
from astrostudy.jieqi.YearJieQi import YearJieQi
from astrostudy.jieqi.BirthJieQi import BirthJieQi
from astrostudy.jieqi.NongLi import NongLi

from websrv.helper import enable_crossdomain

class JieQiSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def year(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            jieqi = YearJieQi(data)
            obj = jieqi.compute()
            res = jsonpickle.encode(obj, unpicklable=False)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def birth(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            jieqi = BirthJieQi(data)
            obj = jieqi.compute()
            res = jsonpickle.encode(obj, unpicklable=False)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def nongli(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            jieqi = NongLi(data)
            obj = jieqi.compute()
            res = jsonpickle.encode(obj, unpicklable=False)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)

