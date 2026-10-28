"""印占引擎子块失败落账:Panchaka 五忌 / KP 宫头分主·RP·意义星 这类整段在回包里静默消失的块,失败时子块带
partialErrors、jyotish.partialErrors 汇总子块名(页面 / AI 快照据此写明「未能计算」);正常盘不出现该键。"""
import json

import cherrypy

BODY = {'date': '1990/05/18', 'time': '10:30:00', 'zone': '+05:30', 'lat': '28n36', 'lon': '77e12', 'ad': 1,
        'indiaHsys': 0, 'indiaAyanamsa': 'lahiri', 'zodiacal': 1, 'tradition': False, 'predictive': 0}


def _jyotish():
    from websrv.webindiasrv import IndiaAstroSrv
    cherrypy.request.json = json.loads(json.dumps(BODY))
    cherrypy.request.method = 'POST'
    cherrypy.request.headers = {}
    out = IndiaAstroSrv().chart()
    res = json.loads(out.decode('utf-8') if isinstance(out, bytes) else out)
    return (res.get('Result') or res)['jyotish']


def test_normal_chart_has_no_partial_errors():
    j = _jyotish()
    assert 'partialErrors' not in j
    assert 'partialErrors' not in (j.get('kp') or {})
    assert (j.get('kp') or {}).get('cuspalSubLords')
    assert (j.get('muhurta') or {}).get('panchaka')


def test_failed_blocks_are_recorded(monkeypatch):
    import astrostudy.india.kp_system as kp_system
    import astrostudy.india.primitives as primitives

    def boom(*_a, **_k):
        raise RuntimeError('injected')

    monkeypatch.setattr(kp_system, 'cuspal_sublords', boom)
    monkeypatch.setattr(primitives, 'panchaka_remainder', boom)
    j = _jyotish()
    assert 'kp.deep' in j['partialErrors'] and 'muhurta.panchaka' in j['partialErrors']
    assert j['kp']['partialErrors'] == ['kpDeep']
    assert j['muhurta']['panchaka'] is None and 'panchaka' in j['muhurta']['partialErrors']
