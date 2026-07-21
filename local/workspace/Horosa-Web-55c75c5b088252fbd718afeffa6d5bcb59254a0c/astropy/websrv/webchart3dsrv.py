# -*- coding: utf-8 -*-
"""全行星中心盘 REST 薄壳(3D 星盘多中心引擎)。

只做参数解析(date/time/zone/ad → UT 儒略日)与 JSON 编解码,
全部计算在 astrostudy.chart3d(结构性隔离,不触主限法链路)。
"""

import traceback

import jsonpickle
import cherrypy

from flatlib.datetime import Datetime

from astrostudy import chart3d
from websrv.helper import enable_crossdomain


def _normalize_date(date_text, ad=None):
    """'YYYY-MM-DD' / 'YYYY/MM/DD' → 'Y/M/D';ad!=1(公元前)补 '-' 年前缀。"""
    text = str(date_text)
    parts = text.split('/')
    if len(parts) == 1:
        parts = text.split('-')
    if len(parts) == 4:
        # '-Y-M-D' 按 '-' 拆出 4 段 = 已带负号的公元前年份
        year, month, day = '-{0}'.format(parts[1]), parts[2], parts[3]
    else:
        year, month, day = parts[0], parts[1], parts[2]
    if ad is not None and int(ad) != 1 and year[0:1] != '-':
        year = '-{0}'.format(year)
    return '{0}/{1}/{2}'.format(year, month, day)


def _jd_from_data(data):
    """请求体 date/time/zone/ad → UT 儒略日。"""
    date = _normalize_date(data['date'], data.get('ad'))
    time = data.get('time', '12:00:00')
    zone = data.get('zone', '+00:00')
    return Datetime(date, time, zone).jd


class Chart3DSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def state(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            obj = chart3d.state(
                center=data.get('center', 'geo'),
                jd_ut=_jd_from_data(data),
                include_moon=data.get('includeMoon'),
                orbit_samples=data.get('orbitSamples', chart3d.DEFAULT_ORBIT_SAMPLES),
                asporb=data.get('asporb', chart3d.DEFAULT_ASPECT_ORB),
                aspect_angles=data.get('aspects'),
            )
            return jsonpickle.encode(obj, unpicklable=False)
        except Exception:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
