# -*- coding: utf-8 -*-
"""「此刻」的唯一入口(astrostudy/clock.py):请求带来了钉住的时刻就用它,没带就用系统时钟。

验证要能复现:同一批命例重跑,结果不该随跑的那一刻、计算服务所在机器的时区而变。批量验证把前端的时钟钉住并随请求带来
(正文 clientNowMs / 请求头 X-Horosa-Now,另可带客户端的时区偏移);计算服务里「请求没给目标时刻就取当前时间」的地方
一律经这个入口。这里锁:入口的读法、各处缺省确实跟着带来的时刻走、结果代码里不再有直接读系统时钟的写法。
"""
import datetime
import re
import time
from pathlib import Path

import cherrypy
import pytest

from astrostudy import clock

ASTROPY = Path(__file__).resolve().parents[1]
PIN_MS = 1906516800000          # 2030-06-01 04:00:00 UTC = 北京时间 12:00
PIN = {'clientNowMs': PIN_MS, 'clientNowOffsetMin': 480}


class _FakeRequest:
    def __init__(self, headers=None, json=None):
        self.headers = headers or {}
        if json is not None:
            self.json = json


# ------------------------------------------------------------------ 入口的读法
def test_without_a_pinned_moment_it_is_the_system_clock():
    assert clock.pinned_now() == (None, None)
    assert clock.pinned_now({}) == (None, None)
    assert abs(clock.now_ts() - time.time()) < 2
    assert abs((clock.now_local() - datetime.datetime.now()).total_seconds()) < 2
    assert abs((clock.now_utc() - datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)).total_seconds()) < 2


def test_pinned_moment_from_the_request_body():
    assert clock.pinned_now(PIN) == (float(PIN_MS), 480)
    assert clock.now_ts(PIN) == PIN_MS / 1000.0
    assert clock.now_utc(PIN) == datetime.datetime(2030, 6, 1, 4, 0, 0)
    assert clock.now_local(PIN) == datetime.datetime(2030, 6, 1, 12, 0, 0)          # 客户端的钟面,不看本机时区
    assert clock.now_at_offset(330, PIN) == datetime.datetime(2030, 6, 1, 9, 30, 0)   # 盘的时区 +05:30
    assert clock.now_at_offset(None, PIN) == datetime.datetime(2030, 6, 1, 12, 0, 0)
    assert abs(clock.now_jd(PIN) - 2462653.6666667) < 1e-6


def test_pinned_moment_without_offset_uses_this_machines_zone():
    only_ms = {'clientNowMs': PIN_MS}
    assert clock.pinned_now(only_ms) == (float(PIN_MS), None)
    assert clock.now_local(only_ms) == datetime.datetime.fromtimestamp(PIN_MS / 1000.0)
    assert clock.now_utc(only_ms) == datetime.datetime(2030, 6, 1, 4, 0, 0)


@pytest.mark.parametrize('bad', ['now', None, '', float('nan'), 1e20, -1e20, [], {'a': 1}])
def test_malformed_values_are_ignored(bad):
    assert clock.pinned_now({'clientNowMs': bad, 'clientNowOffsetMin': 480}) == (None, None)


@pytest.mark.parametrize('bad', ['x', 5000, -5000, None])
def test_malformed_offset_only_drops_the_offset(bad):
    assert clock.pinned_now({'clientNowMs': PIN_MS, 'clientNowOffsetMin': bad}) == (float(PIN_MS), None)


def test_read_from_the_current_request_body_then_headers(monkeypatch):
    monkeypatch.setattr(cherrypy.serving, 'request', _FakeRequest(headers={'X-Horosa-Now': str(PIN_MS), 'X-Horosa-Now-Offset': '-240'}))
    assert clock.pinned_now() == (float(PIN_MS), -240)                      # 直连排盘服务的接口:读请求头
    assert clock.now_local() == datetime.datetime(2030, 6, 1, 0, 0, 0)
    monkeypatch.setattr(cherrypy.serving, 'request', _FakeRequest(headers={'X-Horosa-Now': '1'}, json=dict(PIN)))
    assert clock.pinned_now() == (float(PIN_MS), 480)                       # 正文里有就先用正文(Java 后端转发来的)
    assert clock.pinned_now({'clientNowMs': 86400000}) == (86400000.0, None)   # 显式传进来的字典最先
    monkeypatch.setattr(cherrypy.serving, 'request', _FakeRequest(headers={'X-Horosa-Now': 'garbage'}))
    assert clock.pinned_now() == (None, None)


# ------------------------------------------------------------------ 各处缺省确实跟着带来的时刻走
_NATAL = {'date': '1990/01/01', 'time': '12:00:00', 'zone': '+08:00', 'lat': '39n54', 'lon': '116e24',
          'gpsLat': 39.9, 'gpsLon': 116.4, 'hsys': 0, 'tradition': False, 'predictive': False}


def test_chart_details_default_target_follows_the_pinned_moment():
    from astrostudy.directed_figures import _natal_from_request
    frame = _natal_from_request({**_NATAL, **PIN})
    assert abs(frame['targetJd'] - (2440587.5 + PIN_MS / 86400000.0)) < 1e-9
    assert abs(frame['age'] - 40.41) < 0.02                                   # 1990-01-01 → 2030-06-01
    explicit = _natal_from_request({**_NATAL, **PIN, 'targetDate': '2000/01/01', 'targetTime': '12:00:00'})
    assert abs(explicit['age'] - 10.0) < 0.01                                 # 请求明给目标日期时照旧以它为准
    real = _natal_from_request(dict(_NATAL))
    assert abs(real['targetJd'] - (2440587.5 + time.time() / 86400.0)) < 1e-3  # 没带:系统时钟(原行为)


def test_india_current_period_marker_follows_the_pinned_moment(monkeypatch):
    from astrostudy.india.jyotish_parts.helpers import now_at_zone
    monkeypatch.setattr(cherrypy.serving, 'request', _FakeRequest(json=dict(PIN)))
    assert now_at_zone(330) == datetime.datetime(2030, 6, 1, 9, 30, 0)
    assert now_at_zone(None) == datetime.datetime(2030, 6, 1, 12, 0, 0)


def test_qizheng_current_age_follows_the_pinned_moment():
    from websrv.webqizhengkinsrv import compute_qizheng_kin_pan
    base = {'date': '1990-01-01', 'time': '12:00:00', 'zone': '+08:00', 'gpsLat': 39.9, 'gpsLon': 116.4, 'gender': 1}
    a = str(compute_qizheng_kin_pan({**base, **PIN}))
    b = str(compute_qizheng_kin_pan({**base, 'clientNowMs': PIN_MS + 10 * 365 * 86400000, 'clientNowOffsetMin': 480}))
    c = str(compute_qizheng_kin_pan({**base, **PIN}))
    assert a == c            # 同一刻:逐字相同
    assert a != b            # 换一刻(十年后):当前年龄 / 当前大限随之变


def test_taiyi_age_follows_the_pinned_moment(monkeypatch):
    import sys
    vendor = str(ASTROPY.parent / 'vendor' / 'kintaiyi' / 'src')
    if vendor not in sys.path:
        sys.path.insert(0, vendor)
    from kintaiyi import config as taiyi_config
    monkeypatch.setattr(cherrypy.serving, 'request', _FakeRequest(json=dict(PIN)))
    assert taiyi_config.calculateAge(datetime.date(1990, 1, 1)) == 40
    assert taiyi_config.calculateAge(datetime.date(1990, 6, 2)) == 39       # 生日还没到


# ------------------------------------------------------------------ 源码守卫:结果代码不直接读系统时钟
_CLOCK_READ = re.compile(r'datetime\.now\(|datetime\.utcnow\(|\.today\(\)|(?<![\w.])time\.time\(\)|_time\.time\(\)|time\.localtime\(|time\.gmtime\(\)')
# 允许直接读系统时钟的地方(都与结果无关:耗时统计、缓存文件的新旧)。写成「文件 → 允许出现的那几行里的特征」
_ALLOWED = {
    'astrostudy/clock.py': None,                                              # 入口本身
    'websrv/webindiasrv.py': ('t_start = _time.time()', 'elapsed_ms = (_time.time() - t_start)'),   # 耗时统计
}


def _code_lines(path):
    in_doc = False
    for no, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        stripped = line.strip()
        quotes = stripped.count('"""') + stripped.count("'''")
        if in_doc:
            if quotes % 2 == 1:
                in_doc = False
            continue
        if quotes % 2 == 1:
            in_doc = True
            continue
        yield no, line.split('#', 1)[0]


def test_result_code_does_not_read_the_system_clock_directly():
    hits = []
    scanned = 0
    for sub in ('astrostudy', 'websrv'):
        for path in (ASTROPY / sub).rglob('*.py'):
            if '__pycache__' in path.parts:
                continue
            scanned += 1
            rel = path.relative_to(ASTROPY).as_posix()
            allowed = _ALLOWED.get(rel, ())
            if allowed is None:
                continue
            for no, code in _code_lines(path):
                if _CLOCK_READ.search(code) and not any(mark in code for mark in allowed):
                    hits.append('%s:%d %s' % (rel, no, code.strip()[:80]))
    assert scanned > 150
    assert hits == [], '结果代码直接读了系统时钟(改经 astrostudy.clock 取):\n' + '\n'.join(hits)


def test_the_guard_pattern_catches_what_it_should():
    for bad in ('n = datetime.now()', 'x = _dt.datetime.utcnow()', 'd = date.today()', 't = time.time()', 'y = datetime.datetime.now().year'):
        assert _CLOCK_READ.search(bad), bad
    for ok in ('n = clock.now_local(data)', 't0 = time.perf_counter()', 'x = self.runtime.time()', 'when = _dt.datetime(y, m, d)'):
        assert not _CLOCK_READ.search(ok), ok
