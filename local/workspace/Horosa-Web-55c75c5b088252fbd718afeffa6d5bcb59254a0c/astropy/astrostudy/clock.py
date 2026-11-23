# -*- coding: utf-8 -*-
"""「此刻」的唯一入口:凡是请求没给目标时刻、要拿当前时间当缺省的地方,都从这里取,不直接读系统时钟。

为什么要有这一层:验证要能复现 —— 同一批命例重跑,结果不该随「跑的那一刻」而变。批量验证把前端的时钟钉在一个时刻
(./horosa batch --now …),并把这一刻随每个请求带给计算服务;这里读到了就用它,读不到(桌面 App、单例调用、
测试里直接调函数)就用真实的系统时钟,行为与原来相同。

这一刻从哪读(先后次序):
  1. 请求正文里的 clientNowMs(Java 后端转发时放进正文,同时进了它的结果缓存键 —— 时刻不同不会串缓存);
  2. 请求头 X-Horosa-Now(前端直连排盘服务的那些接口);
  3. 系统时钟。
值是自 1970-01-01 UTC 起的毫秒数。
另可带「客户端的时区偏移」(分钟,东为正):正文 clientNowOffsetMin / 请求头 X-Horosa-Now-Offset。带了它,
「当地的今天 / 今年」按客户端的钟面算,不看计算服务所在机器设的时区(同一批在不同机器上跑,结果才相同)。
"""
import datetime
import time

NOW_HEADER = 'X-Horosa-Now'
NOW_FIELD = 'clientNowMs'
OFFSET_HEADER = 'X-Horosa-Now-Offset'
OFFSET_FIELD = 'clientNowOffsetMin'
# 认得的范围:公元 1 年到 9999 年之间(毫秒);出界、不是数的一律不认
_MIN_MS = -62135596800000
_MAX_MS = 253402300799000


def _valid_ms(value):
    try:
        ms = float(value)
    except (TypeError, ValueError):
        return None
    if ms != ms or ms < _MIN_MS or ms > _MAX_MS:
        return None
    return ms


def _valid_offset(value):
    try:
        minutes = int(round(float(value)))
    except (TypeError, ValueError, OverflowError):   # 无穷大取整抛 OverflowError:同样按「没带」处理
        return None
    return minutes if -1080 <= minutes <= 1080 else None


def _request_sources(data):
    """依次给出可以读的来源:(取字段的函数, 字段名表)。data = 已解析的请求正文;其后是当前请求的正文与请求头。"""
    if isinstance(data, dict):
        yield data.get, (NOW_FIELD, OFFSET_FIELD)
    try:
        import cherrypy
        request = cherrypy.request
        body = getattr(request, 'json', None)
        if isinstance(body, dict):
            yield body.get, (NOW_FIELD, OFFSET_FIELD)
        headers = getattr(request, 'headers', None)
        if headers is not None:
            yield headers.get, (NOW_HEADER, OFFSET_HEADER)
    except Exception:   # 不在请求上下文里(测试、热身、命令行):没有带来的时刻
        return


def pinned_now(data=None):
    """这次请求带来的「此刻」:(毫秒, 客户端时区偏移分钟或 None);没带 → (None, None)。"""
    for get, (now_key, offset_key) in _request_sources(data):
        ms = _valid_ms(get(now_key))
        if ms is not None:
            return ms, _valid_offset(get(offset_key))
    return None, None


def pinned_now_ms(data=None):
    """这次请求带来的「此刻」(毫秒);没带 / 不在请求里 → None。"""
    return pinned_now(data)[0]


def now_ts(data=None):
    """此刻的时间戳(秒,自 1970-01-01 UTC)。"""
    ms = pinned_now_ms(data)
    return time.time() if ms is None else ms / 1000.0


def now_jd(data=None):
    """此刻的儒略日(UT)。"""
    return 2440587.5 + now_ts(data) / 86400.0


def now_utc(data=None):
    """此刻的 UTC 时间(不带时区信息的 datetime)。"""
    ms = pinned_now_ms(data)
    if ms is None:
        return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    return datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=ms)


def now_local(data=None):
    """此刻的「当地」钟面时间(不带时区信息)。没有带来的时刻 → 本机当地时间(原来直接 datetime.now() 的行为);
    带来了时刻:有客户端偏移就按客户端的钟面,没有就按本机时区换算。"""
    ms, offset = pinned_now(data)
    if ms is None:
        return datetime.datetime.now()
    if offset is not None:
        return datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=ms, minutes=offset)
    return datetime.datetime.fromtimestamp(ms / 1000.0)


def now_at_offset(offset_minutes, data=None):
    """此刻在「UTC 偏移 offset_minutes 分钟」处的钟面时间;offset_minutes 为 None → 本机当地时间。"""
    if offset_minutes is None:
        return now_local(data)
    return now_utc(data) + datetime.timedelta(minutes=int(offset_minutes))
