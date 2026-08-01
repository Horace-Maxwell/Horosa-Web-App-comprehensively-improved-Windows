# -*- coding: utf-8 -*-
"""主限法 平行三类守卫(P0-2:赤纬 / 世界 / 急动)。

  赤纬平行/反平行:映点法实现(黄道点),行前缀 PD_/PC_,与映点(A_/C_)独立开关、数值同构。
  世界平行:P 与固定 S 关于镜像轴在世界经度里镜像(W_P(RAMC+A)+W_S ≡ 2·axis;
           2·(axis+180)≡2·axis 故独立轴仅两条),行前缀 MP_,ID 第三段=物理轴名
           (HOR 地平/MER 子午;engine 域 mundane_pos ASC=0 → HOR=0°,MER=90°);
           严格 in-mundo(pdtype=1)。
  急动平行:双动版(W_P(A)+W_S(A) ≡ 2·axis),行前缀 RP_;严格 in-mundo。
零回归:pdParallel/pdRaptParallel 默认 False → 输出与不传逐字节一致(golden 另行看守)。
"""
import json

import pytest
import swisseph as swe

from astrostudy import perchart, perpredict, pd_engine


BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 'PLACIDUS',
    'pdTimeKey': 'Ptolemy', 'pdYears': 100,
    'pdtype': 0, 'pdaspects': [0, 60, 90, 120, 180],
}


def _rows(**over):
    cd = dict(BASE)
    cd.update(over)
    pc = perchart.PerChart(cd)
    return perpredict.PerPredict(pc).getPrimaryDirection()


def _dump(rows):
    return json.dumps(rows, sort_keys=True, ensure_ascii=False, default=str)


def _prefixes(rows):
    return {r[1].split('_')[0] for r in rows}


def test_switch_off_is_byte_identical():
    assert _dump(_rows()) == _dump(_rows(pdParallel=False, pdRaptParallel=False))


def test_declination_parallel_rows_on_core_kernel():
    rows = _rows(pdParallel=True)
    pres = _prefixes(rows)
    assert 'PD' in pres and 'PC' in pres
    # 与映点数值同构:同 body 的 PD_ 弧 == A_ 弧(同一映点点位)
    both = _rows(pdParallel=True, pdAntiscia=True)
    arcs = {}
    for r in both:
        arcs.setdefault(r[1], {})[r[2]] = r[0]
    hits = 0
    for pid, by_sig in arcs.items():
        if pid.startswith('PD_'):
            twin = 'A_' + pid[3:]
            if twin in arcs:
                for sig, a in by_sig.items():
                    if sig in arcs[twin]:
                        assert abs(a - arcs[twin][sig]) < 1e-9
                        hits += 1
    assert hits > 0


def test_declination_parallel_rows_on_engine_methods():
    rows = _rows(pdProjection='placidus', pdFrame='placidus', pdParallel=True)
    assert 'PD' in _prefixes(rows)


def test_mundane_and_rapt_parallels_in_mundo_only():
    # pdtype=0:MP_/RP_ 绝不出行(自洽性约束)
    z = _rows(pdProjection='placidus', pdParallel=True, pdRaptParallel=True)
    assert 'MP' not in _prefixes(z) and 'RP' not in _prefixes(z)
    # pdtype=1(placidus 引擎族):出 MP_/RP_ 行且 shape 5 元
    m = _rows(pdProjection='placidus', pdtype=1, pdParallel=True, pdRaptParallel=True)
    pres = _prefixes(m)
    assert 'MP' in pres and 'RP' in pres
    for r in m:
        assert len(r) == 5


def test_mundane_parallel_mirror_equation_residual():
    # 取一行 MP_,复核镜像方程 W_P(RAMC+arc) + W_S(RAMC) ≡ 2·axis(残差角分级)
    cd = dict(BASE)
    cd.update({'pdProjection': 'placidus', 'pdtype': 1, 'pdParallel': True})
    pc = perchart.PerChart(cd)
    pp = perpredict.PerPredict(pc)
    rows = pp.getPrimaryDirection()
    mp_rows = [r for r in rows if r[1].startswith('MP_')]
    assert mp_rows
    bodies, angles, armc, phi, eps, _jd = pp._pdEngineChartData()
    checked = 0
    AX = {'HOR': 0.0, 'MER': 90.0}          # engine 域(mundane_pos,ASC=0)
    for r in mp_rows[:6]:
        _, pname, axis = r[1].split('_')
        assert axis in AX, r[1]              # 轴名收敛守卫:只允许两条物理轴
        sig_name = r[2].split('_')[1]
        if pname not in bodies or sig_name not in bodies:
            continue
        w_s = pd_engine.mundane_pos(bodies[sig_name]['lon'], bodies[sig_name]['lat'],
                                    armc, phi, eps, 'placidus')
        w_p = pd_engine.mundane_pos(bodies[pname]['lon'], bodies[pname]['lat'],
                                    pd_engine.norm360(armc + r[0]), phi, eps, 'placidus')
        resid = pd_engine.norm180(w_p + w_s - 2.0 * AX[axis])
        assert abs(resid) < 0.05, (r, resid)
        checked += 1
    assert checked > 0


def test_rapt_parallel_double_motion_residual():
    cd = dict(BASE)
    cd.update({'pdProjection': 'placidus', 'pdtype': 1, 'pdRaptParallel': True})
    pc = perchart.PerChart(cd)
    pp = perpredict.PerPredict(pc)
    rows = pp.getPrimaryDirection()
    rp_rows = [r for r in rows if r[1].startswith('RP_')]
    assert rp_rows
    bodies, angles, armc, phi, eps, _jd = pp._pdEngineChartData()
    checked = 0
    AX = {'HOR': 0.0, 'MER': 90.0}          # engine 域(mundane_pos,ASC=0)
    for r in rp_rows[:6]:
        _, pname, axis = r[1].split('_')
        assert axis in AX, r[1]
        sig_name = r[2].split('_')[1]
        if pname not in bodies or sig_name not in bodies:
            continue
        ram = pd_engine.norm360(armc + r[0])
        w_p = pd_engine.mundane_pos(bodies[pname]['lon'], bodies[pname]['lat'], ram, phi, eps, 'placidus')
        w_s = pd_engine.mundane_pos(bodies[sig_name]['lon'], bodies[sig_name]['lat'], ram, phi, eps, 'placidus')
        resid = pd_engine.norm180(w_p + w_s - 2.0 * AX[axis])
        assert abs(resid) < 0.05, (r, resid)
        checked += 1
    assert checked > 0
