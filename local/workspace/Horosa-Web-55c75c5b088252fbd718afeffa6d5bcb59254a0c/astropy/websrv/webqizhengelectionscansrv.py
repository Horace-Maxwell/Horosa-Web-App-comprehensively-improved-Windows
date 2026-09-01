# -*- coding: utf-8 -*-
# [Z7] 七政择日·征象扫描端点(算法本体在 astrostudy/qizheng_election_scan.py,本文件只做薄壳)。
# 形制照 QiZhengKinSrv 系:jsonpickle {ResultCode, Result};错误 ResultCode=-1(前端缓存壳不缓存)。
import traceback

import cherrypy
import jsonpickle

from astrostudy import qizheng_election_scan
from websrv.helper import enable_crossdomain


class QizhengElectionScanSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    def _json(self, obj):
        return jsonpickle.encode(obj, unpicklable=False)

    def _payload(self, params):
        data = getattr(cherrypy.request, 'json', None)
        payload = dict(data) if isinstance(data, dict) else {}
        payload.update(params)
        return payload

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def scan(self, **params):
        enable_crossdomain()
        try:
            payload = self._payload(params)
            if payload.get('ping'):
                # 冒烟探针短路(route_smoke_probes 全路由验证用,照 qizhengelection.pan 先例)
                return self._json({'ResultCode': 0, 'Result': 'ok'})
            result = qizheng_election_scan.scan(payload)
        except Exception:
            traceback.print_exc()
            return self._json({'ResultCode': -1, 'Result': {'err': 'internal', 'detail': 'scan failed'}})
        if isinstance(result, dict) and result.get('err'):
            return self._json({'ResultCode': -1, 'Result': result})
        return self._json({'ResultCode': 0, 'Result': result})

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    def conditiontypes(self, **params):
        # GET 自检口:前端/真机可据此核对「已实现条件类型」集合(哨兵的运行时孪生)。
        enable_crossdomain()
        return self._json({'ResultCode': 0, 'Result': {
            'types': sorted(qizheng_election_scan.CONDITION_TYPES.keys()),
            'groups': list(qizheng_election_scan.GROUP_TYPES),
        }})

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def explain(self, **params):
        # R4 单时刻逐叶判读(详情面板):pass 复用扫描求值器微域自证,与 scan 绝对同源。
        enable_crossdomain()
        try:
            payload = self._payload(params)
            result = qizheng_election_scan.explain_at(payload)
        except Exception:
            traceback.print_exc()
            return self._json({'ResultCode': -1, 'Result': {'err': 'internal', 'detail': 'explain failed'}})
        if isinstance(result, dict) and result.get('err'):
            return self._json({'ResultCode': -1, 'Result': result})
        return self._json({'ResultCode': 0, 'Result': result})
