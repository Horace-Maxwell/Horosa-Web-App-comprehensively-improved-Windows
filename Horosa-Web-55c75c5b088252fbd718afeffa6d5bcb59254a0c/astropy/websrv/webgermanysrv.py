import traceback
import jsonpickle
import cherrypy
from astrostudy.perchart import PerChart
from websrv.helper import enable_crossdomain
from astrostudy.germany.midpoint import MidPoint


class GermanyAstroSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def midpoint(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            data['tradition'] = False
            data['predictive'] = False

            perchart = PerChart(data)
            midpoint = MidPoint(perchart)
            mids = midpoint.calculate()

            res = jsonpickle.encode(mids, unpicklable=False)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
