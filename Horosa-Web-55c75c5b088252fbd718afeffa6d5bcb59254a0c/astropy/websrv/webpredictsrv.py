import sys
import traceback
import jsonpickle
import cherrypy
from flatlib import const
from flatlib.geopos import GeoPos
from astrostudy.perchart import PerChart
from astrostudy.helper import getChartObj
from websrv.helper import enable_crossdomain


class PredictSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def solarreturn(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            data['tradition'] = False
            perchart = PerChart(data)
            predict = perchart.getPredict()
            res = {}
            asporb = -1
            params = {}
            params['date'] = data['date']
            params['time'] = data['time']
            params['zone'] = data['zone']
            params['lat'] = data['lat']
            params['lon'] = data['lon']
            params['hsys'] = data['hsys']
            if 'zodiacal' in data.keys():
                params['zodiacal'] = data['zodiacal']
            if 'dirZone' in data.keys():
                params['zone'] = data['dirZone']

            if 'asporb' in data.keys():
                asporb = data['asporb']
            if 'datetime' in data.keys():
                if data['datetime'] == None or data['datetime'] == '':
                    res = predict.getSolarReturn(params)
                else:
                    if 'dirLat' in data.keys() and 'dirLon' in data.keys():
                        params['lat'] = data['dirLat']
                        params['lon'] = data['dirLon']
                        pos = GeoPos(data['dirLat'], data['dirLon'])
                        res = predict.getSolarReturnByDatePos(params, data['datetime'], pos, asporb)
                    else:
                        res = predict.getSolarReturnByDate(params, data['datetime'], asporb)
            else:
                res = predict.getSolarReturn(params, asporb)

            dirchart = PerChart(res['dirParams'])
            res['dirChart'] = getChartObj(res['dirParams'], dirchart)

            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def lunarreturn(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            data['tradition'] = False
            perchart = PerChart(data)
            predict = perchart.getPredict()
            asporb = -1
            params = {}
            params['date'] = data['date']
            params['time'] = data['time']
            params['zone'] = data['zone']
            params['lat'] = data['dirLat']
            params['lon'] = data['dirLon']
            params['hsys'] = data['hsys']
            if 'zodiacal' in data.keys():
                params['zodiacal'] = data['zodiacal']
            if 'dirZone' in data.keys():
                params['zone'] = data['dirZone']

            if 'asporb' in data.keys():
                asporb = data['asporb']
            pos = GeoPos(data['dirLat'], data['dirLon'])
            res = predict.getLunarReturn(params, data['datetime'], pos, asporb)

            dirchart = PerChart(res['dirParams'])
            res['dirChart'] = getChartObj(res['dirParams'], dirchart)
            if 'secLuneReturn' in res.keys():
                seclr = res['secLuneReturn']
                secdirchart = PerChart(seclr['dirParams'])
                seclr['dirChart'] = getChartObj(seclr['dirParams'], secdirchart)

            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def givenyear(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            data['tradition'] = False
            perchart = PerChart(data)
            predict = perchart.getPredict()
            asporb = -1
            params = {}
            params['date'] = data['date']
            params['time'] = data['time']
            params['zone'] = data['zone']
            params['lat'] = data['dirLat']
            params['lon'] = data['dirLon']
            params['hsys'] = data['hsys']
            if 'zodiacal' in data.keys():
                params['zodiacal'] = data['zodiacal']
            if 'dirZone' in data.keys():
                params['zone'] = data['dirZone']

            if 'asporb' in data.keys():
                asporb = data['asporb']
            pos = GeoPos(data['dirLat'], data['dirLon'])
            res = predict.getGivenYear(params, data['datetime'], pos, asporb)

            dirchart = PerChart(res['dirParams'])
            res['dirChart'] = getChartObj(res['dirParams'], dirchart)

            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def profection(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            data['tradition'] = False
            perchart = PerChart(data)
            predict = perchart.getPredict()
            res = {}
            nodeRetrograde = False
            asporb = -1
            if 'nodeRetrograde' in data.keys():
                nodeRetrograde = data['nodeRetrograde']
            if 'asporb' in data.keys():
                asporb = data['asporb']

            if 'datetime' in data.keys():
                if data['datetime'] == None or data['datetime'] == '':
                    res = predict.getProfection(nodeRetrograde, asporb)
                else:
                    zone = perchart.zone
                    if 'dirZone' in data.keys():
                        zone = data['dirZone']
                    res = predict.getProfectionByDate(data['datetime'], zone, nodeRetrograde, asporb)
            else:
                res = predict.getProfection()

            return jsonpickle.encode(res, unpicklable=False)

        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def solararc(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            data['tradition'] = False
            perchart = PerChart(data)
            predict = perchart.getPredict()
            res = {}
            nodeRetrograde = False
            asporb = 1
            if 'asporb' in data.keys():
                asporb = data['asporb']
            if 'nodeRetrograde' in data.keys():
                nodeRetrograde = data['nodeRetrograde']
            if 'datetime' in data.keys():
                if data['datetime'] == None or data['datetime'] == '':
                    res = predict.getSolarArc(asporb, nodeRetrograde)
                else:
                    res = predict.getSolarArcByDate(data['datetime'], asporb, nodeRetrograde)
            else:
                res = predict.getSolarArc()

            return jsonpickle.encode(res, unpicklable=False)

        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def pd(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            perchart = PerChart(data)
            predict = perchart.getPredict()
            pdlist = predict.getPrimaryDirection()
            obj = {
                'pd': pdlist
            }
            return jsonpickle.encode(obj, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def td(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            perchart = PerChart(data)
            predict = perchart.getPredict()
            clockwise = True
            if 'clockwise' in data.keys():
                clockwise = data['clockwise']
            tdlist = predict.getTermDirection(clockwise)
            obj = {
                'td': tdlist
            }
            return jsonpickle.encode(obj, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def zr(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            data['predictive'] = False

            startSign = None
            perchart = PerChart(data)
            if 'startSign' in data.keys():
                startSign = data['startSign']
            if startSign == None:
                lot = perchart.getPar(const.PARS_FORTUNA)
                startSign = lot.sign

            stopLevelIdx = 3
            if 'stopLevelIdx' in data.keys():
                stopLevelIdx = data['stopLevelIdx'] if (data['stopLevelIdx'] < 4 and data['stopLevelIdx'] >= 0) else 3

            predict = perchart.getPredict()
            zrlist = predict.getZodiacalRelease(startSign, stopLevelIdx)
            obj = {
                'zr': zrlist
            }
            return jsonpickle.encode(obj, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def dice(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            perchart = PerChart(data)

            planet = data['planet']
            sign = data['sign']
            house = data['house']

            chart = getChartObj(data, perchart)
            predict = perchart.getPredict()
            dicechart = predict.getDiceChart(planet, sign, house)
            diceobj = getChartObj(data, dicechart)

            obj = {
                'chart': chart,
                'diceChart': diceobj,
                'planet': planet,
                'sign': sign,
                'house': house
            }
            return jsonpickle.encode(obj, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
