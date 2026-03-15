import sys
import traceback
import jsonpickle
import cherrypy
from flatlib import const
from flatlib.geopos import GeoPos
from astrostudy.perchart import PerChart
from astrostudy.helper import getChartObj
from websrv.helper import enable_crossdomain, build_param_error_response, RequestResultCache, get_request_cache_dir


class PredictSrv:
    exposed = True
    RESPONSE_CACHE = RequestResultCache(max_entries=48, ttl_sec=1200, persist_dir=get_request_cache_dir('predict'))

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def solarreturn(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            def _build():
                payload = dict(data)
                payload['tradition'] = False
                perchart = PerChart(payload)
                predict = perchart.getPredict()
                res = {}
                asporb = -1
                params = {}
                params['date'] = payload['date']
                params['time'] = payload['time']
                params['zone'] = payload['zone']
                params['lat'] = payload['lat']
                params['lon'] = payload['lon']
                params['hsys'] = payload['hsys']
                if 'zodiacal' in payload.keys():
                    params['zodiacal'] = payload['zodiacal']
                if 'dirZone' in payload.keys():
                    params['zone'] = payload['dirZone']

                if 'asporb' in payload.keys():
                    asporb = payload['asporb']
                if 'datetime' in payload.keys():
                    if payload['datetime'] == None or payload['datetime'] == '':
                        res = predict.getSolarReturn(params)
                    else:
                        if 'dirLat' in payload.keys() and 'dirLon' in payload.keys():
                            params['lat'] = payload['dirLat']
                            params['lon'] = payload['dirLon']
                            pos = GeoPos(payload['dirLat'], payload['dirLon'])
                            res = predict.getSolarReturnByDatePos(params, payload['datetime'], pos, asporb)
                        else:
                            res = predict.getSolarReturnByDate(params, payload['datetime'], asporb)
                else:
                    res = predict.getSolarReturn(params, asporb)

                dirchart = PerChart(res['dirParams'])
                res['dirChart'] = getChartObj(res['dirParams'], dirchart)
                return jsonpickle.encode(res, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('predict.solarreturn', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def lunarreturn(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            def _build():
                payload = dict(data)
                payload['tradition'] = False
                perchart = PerChart(payload)
                predict = perchart.getPredict()
                asporb = -1
                params = {}
                params['date'] = payload['date']
                params['time'] = payload['time']
                params['zone'] = payload['zone']
                params['lat'] = payload['dirLat']
                params['lon'] = payload['dirLon']
                params['hsys'] = payload['hsys']
                if 'zodiacal' in payload.keys():
                    params['zodiacal'] = payload['zodiacal']
                if 'dirZone' in payload.keys():
                    params['zone'] = payload['dirZone']

                if 'asporb' in payload.keys():
                    asporb = payload['asporb']
                pos = GeoPos(payload['dirLat'], payload['dirLon'])
                res = predict.getLunarReturn(params, payload['datetime'], pos, asporb)

                dirchart = PerChart(res['dirParams'])
                res['dirChart'] = getChartObj(res['dirParams'], dirchart)
                if 'secLuneReturn' in res.keys():
                    seclr = res['secLuneReturn']
                    secdirchart = PerChart(seclr['dirParams'])
                    seclr['dirChart'] = getChartObj(seclr['dirParams'], secdirchart)

                return jsonpickle.encode(res, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('predict.lunarreturn', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def givenyear(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            def _build():
                payload = dict(data)
                payload['tradition'] = False
                perchart = PerChart(payload)
                predict = perchart.getPredict()
                asporb = -1
                params = {}
                params['date'] = payload['date']
                params['time'] = payload['time']
                params['zone'] = payload['zone']
                params['lat'] = payload['dirLat']
                params['lon'] = payload['dirLon']
                params['hsys'] = payload['hsys']
                if 'zodiacal' in payload.keys():
                    params['zodiacal'] = payload['zodiacal']
                if 'dirZone' in payload.keys():
                    params['zone'] = payload['dirZone']

                if 'asporb' in payload.keys():
                    asporb = payload['asporb']
                pos = GeoPos(payload['dirLat'], payload['dirLon'])
                res = predict.getGivenYear(params, payload['datetime'], pos, asporb)

                dirchart = PerChart(res['dirParams'])
                res['dirChart'] = getChartObj(res['dirParams'], dirchart)

                return jsonpickle.encode(res, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('predict.givenyear', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def profection(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            def _build():
                payload = dict(data)
                payload['tradition'] = False
                perchart = PerChart(payload)
                predict = perchart.getPredict()
                res = {}
                nodeRetrograde = False
                asporb = -1
                if 'nodeRetrograde' in payload.keys():
                    nodeRetrograde = payload['nodeRetrograde']
                if 'asporb' in payload.keys():
                    asporb = payload['asporb']

                if 'datetime' in payload.keys():
                    if payload['datetime'] == None or payload['datetime'] == '':
                        res = predict.getProfection(nodeRetrograde, asporb)
                    else:
                        zone = perchart.zone
                        if 'dirZone' in payload.keys():
                            zone = payload['dirZone']
                        res = predict.getProfectionByDate(payload['datetime'], zone, nodeRetrograde, asporb)
                else:
                    res = predict.getProfection()

                return jsonpickle.encode(res, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('predict.profection', data, _build)

        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def solararc(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            def _build():
                payload = dict(data)
                payload['tradition'] = False
                perchart = PerChart(payload)
                predict = perchart.getPredict()
                res = {}
                nodeRetrograde = False
                asporb = 1
                if 'asporb' in payload.keys():
                    asporb = payload['asporb']
                if 'nodeRetrograde' in payload.keys():
                    nodeRetrograde = payload['nodeRetrograde']
                if 'datetime' in payload.keys():
                    if payload['datetime'] == None or payload['datetime'] == '':
                        res = predict.getSolarArc(asporb, nodeRetrograde)
                    else:
                        res = predict.getSolarArcByDate(payload['datetime'], asporb, nodeRetrograde)
                else:
                    res = predict.getSolarArc()

                return jsonpickle.encode(res, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('predict.solararc', data, _build)

        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def pd(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            def _build():
                perchart = PerChart(data)
                predict = perchart.getPredict()
                pdlist = predict.getPrimaryDirection()
                obj = {
                    'pd': pdlist
                }
                return jsonpickle.encode(obj, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('predict.pd', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def pdchart(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            def _build():
                perchart = PerChart(data)
                predict = perchart.getPredict()
                zone = data['dirZone'] if 'dirZone' in data.keys() else data['zone']
                obj = predict.getPrimaryDirectionChartByDate(data['datetime'], zone)
                return jsonpickle.encode(obj, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('predict.pdchart', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)

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
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def zr(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            def _build():
                payload = dict(data)
                payload['predictive'] = False

                startSign = None
                perchart = PerChart(payload)
                if 'startSign' in payload.keys():
                    startSign = payload['startSign']
                if startSign == None:
                    lot = perchart.getPar(const.PARS_FORTUNA)
                    startSign = lot.sign

                stopLevelIdx = 3
                if 'stopLevelIdx' in payload.keys():
                    stopLevelIdx = payload['stopLevelIdx'] if (payload['stopLevelIdx'] < 4 and payload['stopLevelIdx'] >= 0) else 3

                predict = perchart.getPredict()
                zrlist = predict.getZodiacalRelease(startSign, stopLevelIdx)
                obj = {
                    'zr': zrlist
                }
                return jsonpickle.encode(obj, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('predict.zr', data, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)

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
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)
