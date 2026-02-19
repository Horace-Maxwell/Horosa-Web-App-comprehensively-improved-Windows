import traceback
import jsonpickle
import cherrypy
from websrv.helper import enable_crossdomain
from astrostudy.modern.chartcomp import ChartComp
from astrostudy.modern.chartcomposite import ChartComposite
from astrostudy.modern.chartsynastry import ChartSynastry
from astrostudy.modern.charttmspace import ChartTimeSpace
from astrostudy.modern.chartmarks import ChartMarks


class ModernAstroSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def relative(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            hsys = 0
            zodiacal = 0
            if 'hsys' in data.keys():
                hsys = data['hsys']
            if 'zodiacal' in data.keys():
                zodiacal = data['zodiacal']

            inner = data['inner']
            outer = data['outer']
            inner['tradition'] = False
            inner['predictive'] = False
            inner['hsys'] = hsys
            inner['zodical'] = zodiacal
            outer['tradition'] = False
            outer['predictive'] = False
            outer['hsys'] = hsys
            outer['zodical'] = zodiacal

            relative = 0
            if 'relative' in data.keys():
                relative = data['relative']

            reschart = None
            if relative == 1:
                reschart = ChartComposite(inner, outer)
            elif relative == 2:
                reschart = ChartSynastry(inner, outer)
            elif relative == 3:
                reschart = ChartTimeSpace(inner, outer)
            elif relative == 4:
                reschart = ChartMarks(inner, outer)
            else:
                reschart = ChartComp(inner, outer)

            res = reschart.compute()
            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
