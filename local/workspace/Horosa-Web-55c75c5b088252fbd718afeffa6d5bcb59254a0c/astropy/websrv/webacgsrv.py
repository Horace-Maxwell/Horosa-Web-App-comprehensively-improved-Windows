import traceback
import jsonpickle
import cherrypy
import swisseph
from astrostudy.acg.ACGraph import ACGraph, findMundaneEvent
from astrostudy.civil_calendar import civil_julday, civil_parts_from_jd, format_civil_date, parse_civil_date

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
            # 起查日按民用历读(历史纪年;1582-10-15 以前儒略历),与盘面日期同口径。
            try:
                fy, fm, fdd = parse_civil_date(data.get('fromDate', ''), data.get('ad', 1))
                jd0 = civil_julday(fy, fm, fdd, 12.0)
            except (ValueError, IndexError, TypeError):
                jd0 = civil_julday(2026, 1, 1, 0.0)
            jd = findMundaneEvent(kind, jd0, direction)
            if jd is None:
                return jsonpickle.encode({'err': 'not found'}, unpicklable=False)
            # T-49:回本命时区钟面(前端把 date/time 原样写进 CCG,后端 _ccgJd 再按本命 zone 解释);不带 zone 仍回 UT(旧调用零回归)
            zone_hours = _zone_to_hours(data.get('zone'))
            # 回写的日期 / 时刻要能原样再起盘:按民用历拆(历史纪年;1582-10-15 以前儒略历)。
            local = civil_parts_from_jd(jd + zone_hours / 24.0)
            obj = {'kind': kind, 'jd': round(jd, 6),
                   'date': format_civil_date(local['astroYear'], local['month'], local['day'], '/'),
                   'time': local['time'],
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


