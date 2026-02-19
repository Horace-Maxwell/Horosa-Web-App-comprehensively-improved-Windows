import traceback
import jsonpickle
import cherrypy
from flatlib.datetime import Datetime
from websrv.helper import enable_crossdomain


class WebJdnSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def num(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            date = data['date']
            time = data['time']
            zone = data['zone']
            parts = date.split('/')
            if len(parts) == 1:
                parts = date.split('-')

            if len(parts) == 4:
                date = '-{0}/{1}/{2}'.format(parts[1], parts[2], parts[3])
            else:
                date = '{0}/{1}/{2}'.format(parts[0], parts[1], parts[2])

            tm = Datetime(date, time, zone)
            res = {
                'jdn': tm.jd
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
    def date(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            jdn = data['jdn']
            zone = data['zone']

            tm = Datetime.fromJD(jdn, zone)
            date = tm.toCNString()
            res={
                'date': date
            }

            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
