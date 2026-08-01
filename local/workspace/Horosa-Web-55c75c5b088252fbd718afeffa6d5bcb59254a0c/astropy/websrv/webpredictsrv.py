import sys
import os
import json
import traceback
import jsonpickle
import cherrypy

# horosa_fast_json_encode_v1(PERF-R10 B6):同 webchartsrv 的 shim(纯 JSON 树上
# json.dumps 全默认参与 jsonpickle.encode(unpicklable=False) 逐字节相等,快 5-40ms;
# 非 JSON 类型抛 TypeError/ValueError 即回退原实现,回退零漂移;全矩阵 --verify 硬闸)。
# /predict/zr 载荷最大(~1MB 明文),本文件 45 个调用点全部受益。
_FAST_JSON_ON = os.environ.get("HOROSA_FAST_JSON_ENCODE", "1").lower() not in ("0", "false", "no", "off")


class _FastJsonEncodeShim:
    def __init__(self, real):
        self._real = real

    def __getattr__(self, name):
        return getattr(self._real, name)

    def encode(self, obj, unpicklable=False, **kw):
        if _FAST_JSON_ON and unpicklable is False and not kw:
            try:
                return json.dumps(obj)
            except (TypeError, ValueError):
                pass
        return self._real.encode(obj, unpicklable=unpicklable, **kw)


jsonpickle = _FastJsonEncodeShim(jsonpickle)
from flatlib import const
from flatlib.geopos import GeoPos
from astrostudy.perchart import PerChart
from astrostudy.helper import getChartObj
from websrv.helper import enable_crossdomain
from websrv._guards import validate_geo


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
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
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

            # 年表模式(无 datetime → getSolarReturn 返回 90 年列表)无 dirParams,原样返回;
            # 单次模式(dict)才补 dirChart。旧实现对列表无条件取 ['dirParams'] 会 TypeError → 假"param error"。
            if isinstance(res, dict) and 'dirParams' in res:
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
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
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
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
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

            # 年表模式(无 datetime → getSolarReturn 返回 90 年列表)无 dirParams,原样返回;
            # 单次模式(dict)才补 dirChart。旧实现对列表无条件取 ['dirParams'] 会 TypeError → 假"param error"。
            if isinstance(res, dict) and 'dirParams' in res:
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
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
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
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
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
    def planetaryarc(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
            data['tradition'] = False
            perchart = PerChart(data)
            predict = perchart.getPredict()
            nodeRetrograde = data['nodeRetrograde'] if 'nodeRetrograde' in data.keys() else False
            asporb = data['asporb'] if 'asporb' in data.keys() else 1
            arcSource = data['arcSource'] if 'arcSource' in data.keys() else const.MOON
            if 'datetime' in data.keys() and data['datetime'] != None and data['datetime'] != '':
                res = predict.getPlanetaryArcByDate(data['datetime'], asporb, nodeRetrograde, arcSource)
            else:
                res = predict.getPlanetaryArc(asporb, nodeRetrograde, arcSource)
            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            return jsonpickle.encode({'err': 'param error'}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def persianchart(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
            data['tradition'] = False
            perchart = PerChart(data)
            predict = perchart.getPredict()
            rateKey = data['rateKey'] if 'rateKey' in data.keys() else 'persian'
            asporb = data['asporb'] if 'asporb' in data.keys() else 1
            nodeRetrograde = data['nodeRetrograde'] if 'nodeRetrograde' in data.keys() else False
            direction = data['direction'] if 'direction' in data.keys() else 'direct'
            res = predict.getPersianDirectedByDate(data['datetime'], rateKey, asporb, nodeRetrograde, direction)
            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            return jsonpickle.encode({'err': 'param error'}, unpicklable=False)


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def pd(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
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
    def pdchart(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
            perchart = PerChart(data)
            predict = perchart.getPredict()
            zone = data['dirZone'] if 'dirZone' in data.keys() and data['dirZone'] else perchart.zone
            # 向运方向：复用已在 Java 白名单的 direction 参（'converse' 即逆向，默认 direct）——零 Java 改动。
            converse = ('{0}'.format(data.get('direction', '')).lower() == 'converse')
            res = predict.getPrimaryDirectionChartByDate(data.get('datetime'), zone, converse)
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
    def td(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
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
    def dist(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
            perchart = PerChart(data)
            predict = perchart.getPredict()
            obj = {
                'dist': predict.getDistributions()
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
    def agepoint(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
            perchart = PerChart(data)
            predict = perchart.getPredict()
            obj = {
                'agepoint': predict.getAgePoint()
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
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
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
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
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

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def pdpoles(self):
        # §19 Pole 高级输出:S 集逐应星极点(随 resolved projection)。
        # 行 shape 5 元锁死不扩 → 独立元信息端点,前端 Pole 列按应星 join。
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
            perchart = PerChart(data)
            predict = perchart.getPredict()
            res = predict.getPdPoles()
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
    def pd3d(self):
        # 主限法 3D 天球数据(WS-3):表行走既有 getPrimaryDirectionByZ(弧零重算),
        # 附每个 id 的引擎真实坐标(points)/应星位置圈(circles)/天球框架(frame)。
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            _geoerr = validate_geo(data)
            if _geoerr:
                return jsonpickle.encode(_geoerr, unpicklable=False)
            perchart = PerChart(data)
            predict = perchart.getPredict()
            res = predict.getPrimaryDirection3D()
            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
