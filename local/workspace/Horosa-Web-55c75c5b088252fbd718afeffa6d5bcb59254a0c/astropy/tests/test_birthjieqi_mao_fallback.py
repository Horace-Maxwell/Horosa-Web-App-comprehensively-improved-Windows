# -*- coding: utf-8 -*-
"""生辰节气 · 卯时上升求解不收敛时的回退。

按黄经求上升点(byLon=1)在 |纬度| ≳ 50°(看季节)可永不收敛,此前请求永不返回、线程永久空转。
现牛顿迭代设上限(_ASC_APPROACH_MAX_ITER),超限退到按赤经(恒收敛),结果里注明 maoFallback='byRA';
按赤经也不收敛(防御,实测未见)则不做卯时校正(05:00 基准,timeOffset=0),注明 maoFallback='none'。
收敛的输入不出现 maoFallback,结果与加上限前逐字节相同。
卡死类用例放子进程并设超时:上限被删时测试报红,而不是把整个测试进程挂住。
"""
import json
import os
import subprocess
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from astrostudy.jieqi import BirthJieQi as BJ  # noqa: E402

# 此前卡死的两例:北半球夏季 50°N;南半球对应季节 58°S
HANG_CASES = [
    {'date': '2024-06-15', 'time': '12:00:00', 'zone': '+00:00', 'lat': '50n00', 'lon': '15e00', 'byLon': 1, 'useLocalMao': 0},
    {'date': '2017/10/22', 'time': '02:34:46', 'zone': '-09:30', 'lat': '58s12', 'lon': '137w50', 'byLon': 1, 'useLocalMao': 1},
]

_SNIPPET = (
    "import json, sys\n"
    "sys.path.insert(0, %r)\n"
    "from astrostudy.jieqi import BirthJieQi as BJ\n"
    "c = json.loads(sys.argv[1])\n"
    "r_lon = BJ.BirthJieQi(dict(c)).compute()\n"
    "r_ra = BJ.BirthJieQi(dict(c, byLon=0)).compute()\n"
    "keys = ('mao', 'timeOffset', 'timeOffsetJDN')\n"
    "print(json.dumps({'fb': r_lon.get('maoFallback'), 'lon': [r_lon[k] for k in keys], 'ra': [r_ra[k] for k in keys],\n"
    "                  'ra_fb': r_ra.get('maoFallback')}))\n"
) % _ASTRO


def test_previously_hanging_cases_return_and_fall_back_to_right_ascension():
    for c in HANG_CASES:
        out = subprocess.run([sys.executable, '-c', _SNIPPET, json.dumps(c)], capture_output=True, text=True, timeout=120)
        assert out.returncode == 0, out.stderr[-400:]
        r = json.loads(out.stdout.strip().splitlines()[-1])
        assert r['fb'] == 'byRA', c
        assert r['lon'] == r['ra'], c          # 卯时 / 时差 = 按赤经结果
        assert r['ra_fb'] is None, c           # 按赤经本身正常收敛,不带标注


def test_converging_inputs_carry_no_fallback_marker():
    for c in (
        {'date': '1990-05-18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'byLon': 1, 'useLocalMao': 1},
        {'date': '1990-05-18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'byLon': 0, 'useLocalMao': 0},
        {'date': '2024-06-15', 'time': '12:00:00', 'zone': '+00:00', 'lat': '78n13', 'lon': '15e38', 'byLon': 0, 'useLocalMao': 0},
    ):
        r = BJ.BirthJieQi(dict(c)).compute()
        assert 'maoFallback' not in r, c
        assert len(r['mao'].split(':')) == 3, c   # 正常求出的卯时(HH:MM:SS)


def test_defensive_fallback_when_right_ascension_also_fails(monkeypatch):
    monkeypatch.setattr(BJ, '_ASC_APPROACH_MAX_ITER', 0)
    for by in (0, 1):
        c = {'date': '1990-05-18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'byLon': by, 'useLocalMao': 0}
        r = BJ.BirthJieQi(dict(c)).compute()
        assert r['maoFallback'] == 'none', by
        assert r['mao'] == '05:00:00' and r['timeOffset'] == 0 and r['timeOffsetJDN'] == 0, by


def test_iteration_cap_leaves_margin_over_observed_convergence():
    # 实测能收敛的按黄经求解最多 3,476 步(临界带 600 例),常规纬度 ≤ 193 步;上限须远高于此,否则会改变现有结果
    assert BJ._ASC_APPROACH_MAX_ITER >= 20000
