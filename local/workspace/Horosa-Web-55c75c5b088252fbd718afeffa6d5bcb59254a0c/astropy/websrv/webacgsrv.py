import traceback
import jsonpickle
import cherrypy
import swisseph
from astrostudy.acg.ACGraph import ACGraph, findMundaneEvent

from websrv.helper import enable_crossdomain


def _zone_to_hours(zone):
    """'+08:00' / '-05:30' / '8' / 8.0 / '+0800' → 小时数(float);空或不可解析 → 0(= UT,旧调用零回归)。"""
    if zone is None or zone == '':
        return 0.0
    try:
        if isinstance(zone, (int, float)):
            return float(zone)
        s = str(zone).strip()
        sign = -1.0 if s.startswith('-') else 1.0
        s = s.lstrip('+-')
        if ':' in s:
            hh, mm = s.split(':')[:2]
            return sign * (float(hh) + float(mm or 0) / 60.0)
        if len(s) == 4 and s.isdigit():
            return sign * (float(s[:2]) + float(s[2:]) / 60.0)
        return sign * float(s)
    except Exception:
        return 0.0

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

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def acgevent(self):
        """ 世运事件时刻查找(§19):kind=solar_eclipse/lunar_eclipse/newmoon/fullmoon/
        aries|cancer|libra|capricorn_ingress;direction=next/prev;fromDate=YYYY/MM/DD。
        返回 UTC 日期时刻(前端填入 CCG 通道画事件时刻线)。 """
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            kind = str(data.get('kind', 'solar_eclipse'))
            direction = str(data.get('direction', 'next'))
            fd = str(data.get('fromDate', '')).replace('-', '/').split('/')
            if len(fd) == 3:
                jd0 = swisseph.julday(int(fd[0]), int(fd[1]), int(fd[2]), 12.0)
            else:
                jd0 = swisseph.julday(2026, 1, 1, 0.0)
            jd = findMundaneEvent(kind, jd0, direction)
            if jd is None:
                return jsonpickle.encode({'err': 'not found'}, unpicklable=False)
            # T-49:回本命时区钟面(前端把 date/time 原样写进 CCG,后端 _ccgJd 再按本命 zone 解释);不带 zone 仍回 UT(旧调用零回归)
            zone_hours = _zone_to_hours(data.get('zone'))
            y, m, d, h = swisseph.revjul(jd + zone_hours / 24.0)
            hh = int(h)
            mi = int((h - hh) * 60.0)
            ss = int(round(((h - hh) * 60.0 - mi) * 60.0))
            if ss >= 60:
                ss -= 60
                mi += 1
            if mi >= 60:
                mi -= 60
                hh += 1
            obj = {'kind': kind, 'jd': round(jd, 6),
                   'date': '{0}/{1:02d}/{2:02d}'.format(y, m, d),
                   'time': '{0:02d}:{1:02d}:{2:02d}'.format(hh, mi, ss),
                   'zone': data.get('zone') if zone_hours else '+00:00'}
            return jsonpickle.encode(obj, unpicklable=False)
        except:
            traceback.print_exc()
            return jsonpickle.encode({'err': 'param error'}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def acgpoint(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            acg = ACGraph(data)
            orb = float(data.get('orb', 2.0))
            hsys = data.get('hsys', 'whole')
            obj = acg.pointReport(float(data['clickLat']), float(data['clickLon']), orb, hsys)
            res = jsonpickle.encode(obj, unpicklable=False)
            return res
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)


