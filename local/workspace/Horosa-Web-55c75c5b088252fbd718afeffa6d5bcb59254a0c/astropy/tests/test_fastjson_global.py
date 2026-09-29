# -*- coding: utf-8 -*-
"""响应 JSON 快径 · 进程级范围(HOROSA_FAST_JSON_GLOBAL,隶属 HOROSA_FAST_JSON_ENCODE)。

webchartsrv 载入时把真 jsonpickle 模块的 encode 换成快径版(同判据、同回退),所有挂载服务共用。
判据:同一处理函数 + 同一载荷,快径下与原 encode 下的整串输出逐字节相同,且真走了快径;
名单外类型 / 非缺省参数 / 未显式 unpicklable=False 的调用原样交原 encode;重复安装幂等;子开关关不装。
载荷 = 真前端请求形状(日期地点统一为测试种子盘)。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import cherrypy  # noqa: E402
import jsonpickle  # noqa: E402
import pytest  # noqa: E402

from websrv import webchartsrv  # noqa: E402,F401  (载入即安装进程级快径)
from websrv import fastjson as FJ  # noqa: E402
from websrv.kentang.registry import KENTANG_SERVICE_SPECS, _load_service  # noqa: E402

PAYLOADS = {
    '/india/chart': {"date": "1990/05/18", "indiaAyanamsa": "lahiri", "dashaSystem": "vimshottari", "strongRecption": False, "lon": "118e27", "simpleAsp": False, "tajakaYear": 2026, "hsys": 0, "indiaHsys": 0, "zone": "+08:00", "tradition": False, "lat": "31n38", "_jyotishRev": "india_kernel_v8_sbc_transits", "ad": 1, "_indiaOptionsRev": "india_kernel_yoga_v1", "_wireRev": "pd_method_sync_v15", "predictive": False, "nodeType": "mean", "includePrimaryDirection": False, "virtualPointReceiveAsp": False, "southchart": False, "chartnum": 1, "ayanamsa": "lahiri", "siderealMode": "lahiri", "time": "10:00:00", "zodiacal": 1},
    '/location/acg': {"date": "1990/05/18", "draconic": "off", "lilithType": "mean", "lon": "118e27", "lotsCustom": "", "vibration": "0", "lsMode": "great", "posType": "apparent", "mode": "mundo", "coord": "geo", "hsys": "placidus", "zone": "+08:00", "midpointMode": "zodiac", "geodeticVar": "longitude", "lat": "31n38", "harmonic": "1", "ad": 1, "asteroids": "0", "stars": "0", "nodeType": "mean", "horizon": "geometric", "geodetic": "sepharial", "ayanamsa": "", "time": "10:00:00", "cuspLines": "0", "geodeticZero": ""},
    '/germany/midpoint': {"date": "1990/05/18", "gpsLon": 118.45, "frames": True, "personalOrb": 1, "strongRecption": False, "predictive": False, "lon": "118e27", "simpleAsp": False, "virtualPointReceiveAsp": False, "southchart": False, "hsys": 1, "zone": "+08:00", "school": "classic", "siderealAyanamsa": "", "gpsLat": 31.633333, "_v": "g2", "time": "10:00:00", "tradition": False, "zodiacal": 0, "lat": "31n38", "orb": 1},
    '/astroextra/harmonic': {"date": "1990-05-18", "ad": 1, "predictive": False, "lon": "118e27", "hsys": 1, "zone": "+08:00", "siderealAyanamsa": "", "time": "10:00:00", "tradition": False, "zodiacal": "Tropical", "lat": "31n38", "orb": 2, "harmonic": 9},
    '/cetian/pan': {"year": 1990, "month": 5, "day": 18, "hour": 10, "minute": 0, "second": 0, "date": "1990-05-18", "time": "10:00:00", "zone": "+08:00", "lat": "31n38", "lon": "118e27", "gender": "1", "pos": "", "after23NewDay": 1, "lateZiHourUseNextDay": 1, "ke": "初刻", "useKey": True, "method": "book", "startAge": 0, "dayunSteps": 8, "fatherBirthYear": None, "fatherDeathYear": None, "motherBirthYear": None, "motherDeathYear": None, "siblingsInfo": "", "maritalStatus": "", "childrenInfo": "", "calendarMode": "autoLunar", "lunarYear": 2026, "lunarMonth": 8, "lunarDay": 17, "stemOverride": False, "yearStem": "甲", "hourStem": "甲", "keMode": "auto", "beijiKeMode": "auto", "beijiKe": "1", "beijiLookupCode": "", "beijiKeyword": "", "useKe": False, "nanjiMode": "solar", "nanjiAfterLichun": "1", "nanjiLunarYear": 2026, "nanjiSolarMonth": 8, "nanjiDay": 27, "nanjiHourZhi": "卯", "nanjiDayGan": "", "nanjiDayZhi": "", "nanjiSection": "", "nanjiJianchu": "", "nanjiXiu": "", "nanjiPasswordCode": "海異山同", "nanjiChart": 1, "nanjiPalace": "子", "nanjiDegree": 1, "chunziKeMode": "auto", "chunziKe": "3", "chunziLunarMode": "auto", "chunziLunarMonth": 8, "chunziLunarDay": 17, "chunziLookupCode": "", "chunziKeyword": "", "chunziTags": "", "chunziMansion": "", "chunziHourBranch": "", "chunziResultLimit": "20", "lunarMode": "sxtwl", "starOrder": "reverse", "showWuXingJu": 1, "showSihua": 1, "showFlying": 1, "showBrightness": 1, "showSolarTerm": 1, "brightnessSchool": "yiyu", "shenGongMode": "yizheng", "daxianMode": "yiyu", "tianluoMode": "benshu", "palaceNameMode": "common", "liunianYear": 2026, "liunianQishaMode": "shengshi", "showLiunian": 1, "showShensha": 1, "showZaYao": 1, "showDuanjue": 1, "showXiu": 1, "showBianyao": 1},
    '/taiyi/pan': {"year": 1990, "month": 5, "day": 18, "hour": 10, "minute": 0, "second": 0, "date": "1990-05-18", "time": "10:00:00", "style": 3, "tn": 0, "sex": "男", "timeBasis": "direct", "after23NewDay": 1, "lateZiHourUseNextDay": 1, "enableGameTheory": False, "realSunTime": "1990-05-18 09:59:47", "jiedelta": "立夏后第13天"},
    '/qimen/pan': {"year": 1990, "month": 5, "day": 18, "hour": 10, "minute": 0, "second": 0, "dateStr": "1990-05-18", "timeStr": "10:00:00", "zone": "+08:00", "qimenMode": "hour", "qijuMethod": "zhirun", "option": 2, "school": "转盘", "realSunTime": "1990-05-18 09:59:47", "jiedelta": "立夏后第13天", "after23NewDay": 1, "lateZiHourUseNextDay": 1},
    '/chunzi/pan': {"year": 1990, "month": 5, "day": 18, "hour": 10, "minute": 0, "second": 0, "date": "1990-05-18", "time": "10:00:00", "zone": "+08:00", "lat": "31n38", "lon": "118e27", "gender": "1", "pos": "", "after23NewDay": 1, "lateZiHourUseNextDay": 1, "ke": "初刻", "useKey": True, "method": "kunji", "startAge": 0, "dayunSteps": 8, "fatherBirthYear": None, "fatherDeathYear": None, "motherBirthYear": None, "motherDeathYear": None, "siblingsInfo": "", "maritalStatus": "", "childrenInfo": "", "calendarMode": "autoLunar", "lunarYear": 1990, "lunarMonth": 4, "lunarDay": 24, "stemOverride": False, "yearStem": "甲", "hourStem": "甲", "keMode": "auto", "beijiKeMode": "auto", "beijiKe": "1", "beijiLookupCode": "", "beijiKeyword": "", "useKe": False, "nanjiMode": "solar", "nanjiAfterLichun": "1", "nanjiLunarYear": 1990, "nanjiSolarMonth": 4, "nanjiDay": 18, "nanjiHourZhi": "巳", "nanjiDayGan": "", "nanjiDayZhi": "", "nanjiSection": "", "nanjiJianchu": "", "nanjiXiu": "", "nanjiPasswordCode": "海異山同", "nanjiChart": 1, "nanjiPalace": "子", "nanjiDegree": 1, "chunziKeMode": "auto", "chunziKe": "3", "chunziLunarMode": "auto", "chunziLunarMonth": 4, "chunziLunarDay": 24, "chunziLookupCode": "", "chunziKeyword": "", "chunziTags": "", "chunziMansion": "", "chunziHourBranch": "", "chunziResultLimit": "20"},
    '/jieqi/year': {"lon": "121e28", "year": "2026", "zone": "+08:00", "lat": "0n00", "_v": "w4"},
}

_SPECS = {s['mount']: s for s in list(webchartsrv.CORE_SERVICE_SPECS) + list(KENTANG_SERVICE_SPECS)}
_SVC = {}


def _call(path, payload):
    mount, method = path.rsplit('/', 1)
    svc = _SVC.get(mount)
    if svc is None:
        svc = _SVC[mount] = _load_service(_SPECS[mount])
    cherrypy.request.json = dict(payload)
    cherrypy.request.method = 'POST'
    cherrypy.request.headers = {}
    out = getattr(svc, method)()
    return out.decode('utf-8') if isinstance(out, bytes) else out


def test_global_fast_encode_installed_and_original_reachable():
    if not FJ._FAST_JSON_ON or not FJ._FAST_JSON_GLOBAL_ON:
        pytest.skip('快径开关关')
    assert getattr(jsonpickle.encode, '_horosa_fast_global', False) is True
    orig = FJ.original_encode(jsonpickle)
    assert orig is not jsonpickle.encode and not getattr(orig, '_horosa_fast_global', False)


@pytest.mark.parametrize('path', list(PAYLOADS))
def test_endpoint_output_byte_identical_under_global_fast_path(path, monkeypatch):
    if not getattr(jsonpickle.encode, '_horosa_fast_global', False):
        pytest.skip('进程级快径未装')
    before = FJ.STATS['fast']
    fast = _call(path, PAYLOADS[path])
    took_fast = FJ.STATS['fast'] - before
    monkeypatch.setattr(jsonpickle, 'encode', FJ.original_encode(jsonpickle))
    slow = _call(path, PAYLOADS[path])
    assert fast == slow, path
    assert took_fast >= 1, path            # 真走了快径,不是回退撑起的相等
    assert len(fast) > 200 and '"err"' not in fast[:40], path


def test_non_default_calls_pass_through_untouched():
    enc = jsonpickle.encode
    if not getattr(enc, '_horosa_fast_global', False):
        pytest.skip('进程级快径未装')
    orig = FJ.original_encode(jsonpickle)

    class Stranger(object):
        def __init__(self):
            self.a = [1, 2]
    obj = {'x': Stranger(), 'n': 1}
    assert enc(obj) == orig(obj)                                  # 未写 unpicklable = True(带类型标签)
    assert enc(obj, unpicklable=False) == orig(obj, unpicklable=False)   # 名单外类 → 回退
    assert enc({'a': 1}, unpicklable=False, indent=2) == orig({'a': 1}, unpicklable=False, indent=2)
    assert enc({'a': 1}, False) == orig({'a': 1}, False)          # 位置参数形式


def test_install_global_idempotent_and_switch_off(monkeypatch):
    class FakeModule(object):
        @staticmethod
        def encode(value, unpicklable=True, **kw):
            return 'REAL'
    m = FakeModule()
    assert FJ.install_global(m) is True
    first = m.encode
    assert FJ.install_global(m) is False and m.encode is first     # 幂等
    assert FJ.original_encode(m)({'a': 1}) == 'REAL'
    m2 = FakeModule()
    monkeypatch.setattr(FJ, '_FAST_JSON_GLOBAL_ON', False)
    assert FJ.install_global(m2) is False
    assert not getattr(m2.encode, '_horosa_fast_global', False)
