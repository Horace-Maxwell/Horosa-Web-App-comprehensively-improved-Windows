# -*- coding: utf-8 -*-
"""身份握手端点 /horosaIdentity 回归。

背景:本地服务地址(query/存储/端口推导)一旦指向被其它进程占用的端口,「毒 200」会被
前端误判成服务未就绪且重试死循环。前端自愈依赖本端点返回稳定的 app 标记 + 壳注入的
启动 nonce(HOROSA_LAUNCH_NONCE)——本测试钉死其响应契约:
  · app == 'horosa-chart'(与 Java 侧 'horosa-backend' 区分);
  · proto == 2(起支持 deep 真算维度;旧断言 proto==1 已随协议升级);
  · nonce 原样回显且只允许 [A-Za-z0-9_-](其余字符过滤,无注入面);
  · 无 nonce 环境(浏览器直连 dev)回空串。
"""
import json


def _call_identity():
    import websrv.webchartsrv as srv
    return json.loads(srv.WebChartSrv().horosaIdentity())


def test_horosa_identity_marker_and_nonce_roundtrip(monkeypatch):
    monkeypatch.setenv('HOROSA_LAUNCH_NONCE', 'abc123-XY_z')
    data = _call_identity()
    assert data['app'] == 'horosa-chart'
    assert data['proto'] == 2
    assert data['nonce'] == 'abc123-XY_z'


def test_horosa_identity_filters_unsafe_nonce_chars(monkeypatch):
    monkeypatch.setenv('HOROSA_LAUNCH_NONCE', 'ab"c\\1<2>3&空 白')
    data = _call_identity()
    assert data['nonce'] == 'abc123'


def test_horosa_identity_without_nonce(monkeypatch):
    monkeypatch.delenv('HOROSA_LAUNCH_NONCE', raising=False)
    data = _call_identity()
    assert data['app'] == 'horosa-chart'
    assert data['nonce'] == ''

def _call_identity_deep():
    import websrv.webchartsrv as srv
    import json as _json
    return _json.loads(srv.WebChartSrv().horosaIdentity(deep='1'))


def test_horosa_identity_deep_ok(monkeypatch):
    # deep=1 → 真算通过时 deep:ok + proto:2;不带 deep 的响应无 deep 字段(向后兼容)
    monkeypatch.delenv('HOROSA_IDENTITY_DEEP_FAIL', raising=False)
    data = _call_identity_deep()
    assert data['proto'] == 2
    assert data['deep'] == 'ok'
    shallow = _call_identity()
    assert 'deep' not in shallow


def test_horosa_identity_deep_fail_hook(monkeypatch):
    # dev 注错钩:HOROSA_IDENTITY_DEEP_FAIL=1 → deep:fail(供看门狗深探演练)
    monkeypatch.setenv('HOROSA_IDENTITY_DEEP_FAIL', '1')
    data = _call_identity_deep()
    assert data['deep'] == 'fail'
