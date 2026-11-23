# -*- coding: utf-8 -*-
"""并列稳定:排序键 / 边界判断用到浮点量时的统一写法(纯函数,零依赖)。

同一张盘在不同机器上算出来的黄经,末位会差一点(数学库、处理器不同)。数学上本该相等的两个量 ——
南北交点成对的相位、正对两点的两个中点、恰落在宫头上的点 —— 末位各差各的:直接按数值排,谁先谁后由末位决定;
直接取整 / 比大小,落在边界这边还是那边也由末位决定。

这里把差不到 TIE_EPS 的两个值当作相等:并列的按后面的键、最后按原来的先后排;恰在边界上的按约定的那一边算。
TIE_EPS 远大于末位误差(1e-13 量级)、远小于任何显示精度,真有先后的两项不会被并到一起。
前端同款:astrostudyui/src/utils/stableOrder.js。
"""
import math

TIE_EPS = 1e-9


def _is_num(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def same_value(a, b, eps=TIE_EPS):
    """两个值是否「相等」:数值差不到 eps 即算;其余按 ==。"""
    if _is_num(a) and _is_num(b):
        if isinstance(a, float) and math.isnan(a) or isinstance(b, float) and math.isnan(b):
            return (isinstance(a, float) and math.isnan(a)) and (isinstance(b, float) and math.isnan(b))
        return abs(a - b) <= eps
    return a == b


def _key_spec(key):
    if callable(key):
        return key, False, TIE_EPS
    of = key['of']
    return of, bool(key.get('desc')), key.get('eps', TIE_EPS)


def tie_sorted(items, *keys):
    """按若干个键依次排序(返回新列表,不动原列表)。每个键是「取值函数」或 {'of': 函数, 'desc': 真假, 'eps': 容差}:
    取出的是数值时,相邻两项差不到 eps 算并列(一串挨着的都并列);并列的再按下一个键排;键用完了按原来的先后。
    例:tie_sorted(pairs, lambda row: row['orb'])  ← 按容许度排,容许度相等的保持生成时的先后
    """
    indexed = list(enumerate(items))

    def walk(rows, level):
        if len(rows) < 2:
            return rows
        if level >= len(keys):
            return sorted(rows, key=lambda r: r[0])
        of, desc, eps = _key_spec(keys[level])
        dec = [(of(r[1]), r) for r in rows]
        # 先按值排(并列按原先后);降序时值取反向、原先后不变
        dec.sort(key=lambda d: d[1][0])
        dec.sort(key=lambda d: d[0], reverse=desc)
        out = []
        run = []
        prev = None
        for value, row in dec:
            if run and not same_value(prev, value, eps):
                out.extend(walk(run, level + 1))
                run = []
            run.append(row)
            prev = value
        if run:
            out.extend(walk(run, level + 1))
        return out

    return [r[1] for r in walk(indexed, 0)]


def floor_stable(x, eps=TIE_EPS):
    """取整到下面那一格,但恰在整数上(差不到 eps)的算到那个整数:29.999999999999996 → 30,而不是 29。"""
    r = round(x)
    return int(r) if abs(x - r) <= eps else int(math.floor(x))


def snap_integer(x, eps=TIE_EPS):
    """把恰在整数上(差不到 eps)的值吸到那个整数,其余原样:用在取模 / 分段之前。"""
    r = round(x)
    return float(r) if abs(x - r) <= eps else x


def snap_mod(x, period, eps=TIE_EPS):
    """x 对 period 取模到 [0, period);恰在周期边界上(差不到 eps)的算 0 —— 359.99999999999994 与 0 是同一个位置。"""
    v = x % period
    if period - v <= eps or v <= eps:
        return 0.0
    return v


def lte_stable(a, b, eps=TIE_EPS):
    """a ≤ b,恰相等(差不到 eps)算「是」:阈值判断用(误差正好等于容许度的,各台机器判同一边)。"""
    return a <= b or same_value(a, b, eps)


def lt_stable(a, b, eps=TIE_EPS):
    """a < b,恰相等(差不到 eps)算「否」。"""
    return a < b and not same_value(a, b, eps)
