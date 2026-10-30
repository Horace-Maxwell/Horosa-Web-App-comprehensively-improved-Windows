# -*- coding: utf-8 -*-
"""主限法 · Field Plane 的相位点借用黄纬。

Field Plane 的相位点黄经照常取 λ迫 + 相位;黄纬取该迫星出生之后第一次真正走到这个黄经那一刻的黄纬
(相位点被看作迫星将来实际经过的位置)。合相点就是迫星本身,黄纬取本命黄纬;「经典」口径(传统程序的写法)
合相点也借用:取迫星出生后下一次走回本命黄经那一刻的黄纬(见 perpredict.getPrimaryDirectionByF)。

求根:按各星的步长向后扫描,先用黄经速度的零点把区间切成单调段(外行星留驻前后会在一个粗区间里
出现一对很近的交点),再在每段内二分。全部角度单位为度。
"""
import math

import swisseph

# 扫描步长(天);上限只是数值安全界
_STEP_DAYS = {
    swisseph.SUN: 2.0, swisseph.MOON: 0.25, swisseph.MERCURY: 1.0, swisseph.VENUS: 1.0,
    swisseph.MARS: 2.0, swisseph.JUPITER: 5.0, swisseph.SATURN: 10.0,
    swisseph.URANUS: 20.0, swisseph.NEPTUNE: 20.0, swisseph.PLUTO: 20.0,
}
_MAX_DAYS = 200000.0


def _wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def first_arrival_latitude(jd_ut, body, target_lon, flags, start_days=1.0 / 86400.0):
    """出生(jd_ut)之后第一次黄经等于 target_lon 时的黄纬;找不到返回 None。
    start_days:从出生后多久开始找。合相点的目标黄经就是本命黄经(点表还做过 ΔT 修正),从出生后 1 秒找会先撞上
    「出生那一刻」这个平凡根 —— 经典口径的合相点要「下一次回到」,由调用方传 1 天跳过(没有星一天内回到同一黄经)。"""
    flags = int(flags) | swisseph.FLG_SPEED

    def pos(t):
        return swisseph.calc_ut(t, body, flags)[0]

    step = _STEP_DAYS.get(body, 5.0)
    t0 = jd_ut + float(start_days)
    base = jd_ut if float(start_days) <= 1.0 / 86400.0 else t0   # 缺省起点沿用原取样网格(逐位不变)
    p0 = pos(t0)
    k = 1
    while k * step <= _MAX_DAYS + step:
        t1 = base + k * step
        p1 = pos(t1)
        segs = [(t0, p0)]
        if p0[3] * p1[3] < 0:
            lo, hi, vl = t0, t1, p0[3]
            for _ in range(35):
                mid = (lo + hi) / 2.0
                vm = pos(mid)[3]
                if vm * vl <= 0:
                    hi = mid
                else:
                    lo, vl = mid, vm
            ts = (lo + hi) / 2.0
            segs.append((ts, pos(ts)))
        segs.append((t1, p1))
        for (ta, pa), (tb, pb) in zip(segs, segs[1:]):
            va = _wrap180(pa[0] - target_lon)
            vb = _wrap180(pb[0] - target_lon)
            if abs(vb - va) < 180.0 and va * vb <= 0:
                lo, hi, vlo = ta, tb, va
                for _ in range(45):
                    mid = (lo + hi) / 2.0
                    vm = _wrap180(pos(mid)[0] - target_lon)
                    if vm * vlo <= 0:
                        hi = mid
                    else:
                        lo, vlo = mid, vm
                return float(pos((lo + hi) / 2.0)[1])
        t0, p0 = t1, p1
        k += 1
    return None
