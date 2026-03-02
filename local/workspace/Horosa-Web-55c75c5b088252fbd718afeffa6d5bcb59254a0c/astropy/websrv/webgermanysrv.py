import traceback
import jsonpickle
import cherrypy
from astrostudy.perchart import PerChart
from websrv.helper import enable_crossdomain, build_param_error_response
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
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)
