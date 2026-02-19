import traceback
import jsonpickle
import cherrypy
from astrostudy.perchart import PerChart
from astrostudy.helper import getChartJson
from websrv.helper import enable_crossdomain
from astrostudy.india.chart2 import Chart2
from astrostudy.india.chart3 import Chart3
from astrostudy.india.chart4 import Chart4
from astrostudy.india.chart5 import Chart5
from astrostudy.india.chart6 import Chart6
from astrostudy.india.chart7 import Chart7
from astrostudy.india.chart8 import Chart8
from astrostudy.india.chart9 import Chart9
from astrostudy.india.chart10 import Chart10
from astrostudy.india.chart11 import Chart11
from astrostudy.india.chart12 import Chart12
from astrostudy.india.chart16 import Chart16
from astrostudy.india.chart20 import Chart20
from astrostudy.india.chart24 import Chart24
from astrostudy.india.chart27 import Chart27
from astrostudy.india.chart30 import Chart30
from astrostudy.india.chart40 import Chart40
from astrostudy.india.chart45 import Chart45
from astrostudy.india.chart60 import Chart60


class IndiaAstroSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def chart(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            data['tradition'] = False
            data['predictive'] = False
            data['zodiacal'] = 1
            chartnum = 1
            if 'chartnum' in data.keys():
                chartnum = data['chartnum']

            perchart = PerChart(data)
            indiachart = perchart
            if chartnum == 2:
                indiachart = Chart2(perchart)
            elif chartnum == 3:
                indiachart = Chart3(perchart)
            elif chartnum == 4:
                indiachart = Chart4(perchart)
            elif chartnum == 5:
                indiachart = Chart5(perchart)
            elif chartnum == 6:
                indiachart = Chart6(perchart)
            elif chartnum == 7:
                indiachart = Chart7(perchart)
            elif chartnum == 8:
                indiachart = Chart8(perchart)
            elif chartnum == 9:
                indiachart = Chart9(perchart)
            elif chartnum == 10:
                indiachart = Chart10(perchart)
            elif chartnum == 11:
                indiachart = Chart11(perchart)
            elif chartnum == 12:
                indiachart = Chart12(perchart)
            elif chartnum == 16:
                indiachart = Chart16(perchart)
            elif chartnum == 20:
                indiachart = Chart20(perchart)
            elif chartnum == 24:
                indiachart = Chart24(perchart)
            elif chartnum == 27:
                indiachart = Chart27(perchart)
            elif chartnum == 30:
                indiachart = Chart30(perchart)
            elif chartnum == 40:
                indiachart = Chart40(perchart)
            elif chartnum == 45:
                indiachart = Chart45(perchart)
            elif chartnum == 60:
                indiachart = Chart60(perchart)
            else:
                res = getChartJson(data, perchart)
                return res

            indiachart.fractal()

            res = getChartJson(data, perchart)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
