import swisseph
import traceback
import jsonpickle
import cherrypy
from flatlib import const
from flatlib import utils
from websrv.helper import enable_crossdomain

class WebCalcSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def azimuth(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            jdn = data['jdn']
            lat = data['lat']
            lon = data['lon']
            height = data['height']
            temp = data['temp']
            press = data['press']
            coordType = data['coordType']
            coordLat = data['coordLat']
            coordLon = data['coordLon']

            res = swisseph.azalt(jdn, lon, lat, height, coordLon, coordLat, 0, press, temp, coordType)
            res = {
                'azimuth': res[0],
                'altitudeTrue': res[1],
                'altitudeAppa': res[2]
            }

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
    def cotrans(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            cotype = data['type']
            lat = data['lat']
            lon = data['lon']
            obliquity = const.ECLI2EQ_OBLIQUITY if cotype == -1 else const.EQ2ECLI_OBLIQUITY

            res = swisseph.cotrans([lon, lat, 1], obliquity)
            res = {
                'lon': res[0],
                'lat': res[1],
            }

            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
