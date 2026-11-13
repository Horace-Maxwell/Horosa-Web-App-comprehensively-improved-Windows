# -*- coding: utf-8 -*-
"""horosa_win_float_golden_v1 —— 全表金标的跨平台比较。

几份「整张表逐字相等」的金标是在另一套数学库 / 星历构建上录的:同一算法在本机算出的浮点数末几位不同
(实测位置量 1e-10 ~ 1e-12 度,由差分得到的速度百分比 ~3e-5),按容许度并列排序的行(例如互为对点的南北交,
容许度恒相等)先后次序也随末位抖动互换。逐字 == 在本机必红,红了也看不出算法有没有变。

这里的判据 ——
  * 数值:两边都是 int 必须相等;有一边是 float 按 math.isclose(rel_tol=1e-9, abs_tol=1e-4);
  * bool / str / None:必须相等(布尔不当数值);
  * dict:键集合相同,逐键比;
  * list:等长;先按位比,按位不过再做一对一配对(每个金标项配一个尚未用过、口径内相等的实际项)。
算法口径一变,差出来的量级远大于 1e-4(一个角秒是 2.8e-4 度),照样红。
"""
import math

REL_TOL = 1e-9
ABS_TOL = 1e-4


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _same(actual, golden):
    if isinstance(golden, bool) or isinstance(actual, bool):
        return type(actual) is type(golden) and actual == golden
    if _is_number(golden) and _is_number(actual):
        if isinstance(golden, int) and isinstance(actual, int):
            return actual == golden
        if math.isnan(actual) or math.isnan(golden):
            return math.isnan(actual) and math.isnan(golden)
        return math.isclose(actual, golden, rel_tol=REL_TOL, abs_tol=ABS_TOL)
    if isinstance(golden, dict):
        if not isinstance(actual, dict) or set(actual) != set(golden):
            return False
        return all(_same(actual[key], golden[key]) for key in golden)
    if isinstance(golden, (list, tuple)):
        if not isinstance(actual, (list, tuple)) or len(actual) != len(golden):
            return False
        if all(_same(a, g) for a, g in zip(actual, golden)):
            return True
        free = list(range(len(actual)))
        for item in golden:
            hit = next((index for index in free if _same(actual[index], item)), None)
            if hit is None:
                return False
            free.remove(hit)
        return True
    return type(actual) is type(golden) and actual == golden


def first_difference(actual, golden, path=''):
    """第一处口径外的差异(给断言信息用);没有差异返回 None。"""
    if _same(actual, golden):
        return None
    if isinstance(golden, dict) and isinstance(actual, dict):
        if set(actual) != set(golden):
            return '%s: keys differ (only actual %s / only golden %s)' % (
                path or '.', sorted(set(actual) - set(golden))[:6], sorted(set(golden) - set(actual))[:6])
        for key in golden:
            found = first_difference(actual[key], golden[key], '%s.%s' % (path, key))
            if found:
                return found
    if isinstance(golden, (list, tuple)) and isinstance(actual, (list, tuple)):
        if len(actual) != len(golden):
            return '%s: length %d != golden %d' % (path or '.', len(actual), len(golden))
        for index, (a, g) in enumerate(zip(actual, golden)):
            if not any(_same(other, g) for other in actual):
                return first_difference(a, g, '%s[%d]' % (path, index)) or '%s[%d]: no item matches golden %r' % (path, index, g)
        return '%s: items match one by one but not as a one-to-one pairing' % (path or '.')
    return '%s: actual %r != golden %r' % (path or '.', actual, golden)


def golden_equal(actual, golden):
    """在上面的口径内相等返回 True;不等时抛 AssertionError 并指出第一处差异。"""
    found = first_difference(actual, golden)
    if found:
        raise AssertionError('golden mismatch beyond float tolerance: ' + found)
    return True
