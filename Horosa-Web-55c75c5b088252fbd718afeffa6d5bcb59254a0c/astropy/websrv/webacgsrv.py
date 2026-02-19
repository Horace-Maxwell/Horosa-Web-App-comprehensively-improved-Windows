import traceback
import jsonpickle
import cherrypy
from astrostudy.acg.ACGraph import ACGraph

from websrv.helper import enable_crossdomain

class AcgSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def acg(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            acg = ACGraph(data)
            obj = acg.compute()
            res = jsonpickle.encode(obj, unpicklable=False)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)


