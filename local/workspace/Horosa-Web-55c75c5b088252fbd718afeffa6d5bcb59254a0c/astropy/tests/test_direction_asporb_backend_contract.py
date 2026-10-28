# -*- coding: utf-8 -*-
"""推运族「行运星与本命星交角容许度」档位 ↔ 后端判相位所用容许度 合同(选项语义证 · contract)。

档位表 constants/directionAspOrb.js 是页面与 AI 挂载齿轮同一份(纯数据表,由 node 求值取真表,不手抄)。
标签 → 应得容许度 按名书写:「N度」= 每对星都按 N°;「双星容许度相加除以2」= 该对两星各自容许度之和的一半。
后端两条取相位路径各自核:
  ① 返照 / 小限 / 流年(PerPredict.getAspects):合、六合、刑、拱、冲,一对星落在第一个「离相位角 < 容许度」的相位上;
  ② 太阳弧 / 行星弧(solararc.compute):合、半刑、刑、补八分、冲(弧类不列「相加除以2」,档位里也没有)。
判据是「报出的相位集合 = 按标签容许度独立算出的集合」,并要求每一档都至少有一对星恰在门槛内侧、一对恰在外侧
(样本能分清 N° 与 N±0.5°,否则合同不作数)。
"""
import json
import os
import re
import shutil
import subprocess
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from flatlib import const  # noqa: E402
from flatlib.datetime import Datetime  # noqa: E402
from flatlib.predictives import profections  # noqa: E402

from astrostudy import perchart, perpredict, solararc  # noqa: E402

UI_SRC = os.path.abspath(os.path.join(_ASTRO, '..', 'astrostudyui', 'src'))
ASPORB_JS = os.path.join(UI_SRC, 'constants', 'directionAspOrb.js')
MOUNT_SETTINGS = os.path.join(UI_SRC, 'utils', 'techniqueMountSettings.js')

BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 'PLACIDUS',
}
RETURN_ANGLES = (0, 60, 90, 120, 180)
ARC_ANGLES = (0, 45, 90, 135, 180)
WITNESS_BAND = 0.5


def _read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def _asporb_tables():
    src = _read(ASPORB_JS)
    assert not re.search(r'^\s*import\s', src, re.M), 'directionAspOrb.js 应是不引模块的纯数据表'
    node = shutil.which('node')
    assert node, '读前端档位表需要 node(与前端构建同一工具链)'
    code = re.sub(r'^export\s+', '', src, flags=re.M) + (
        '\nprocess.stdout.write(JSON.stringify({ all: directionAsporbOptions(false), arc: directionAsporbOptions(true) }));\n')
    out = subprocess.run([node, '-e', code], capture_output=True, check=True, timeout=120)
    return json.loads(out.stdout.decode('utf-8'))


def _allowed_rule(label):
    """标签 → 容许度规则:('fixed', N) | ('mean', None)。"""
    m = re.fullmatch(r'(\d+(?:\.\d+)?)度', label)
    if m:
        return 'fixed', float(m.group(1))
    if label == '双星容许度相加除以2':
        return 'mean', None
    raise AssertionError(f'认不出的容许度标签「{label}」')


def _sep(a, b):
    d = abs(a - b) % 360
    return 360 - d if d > 180 else d


def _expected(objs, natal, angles, allowed_of):
    out = {}
    for obj in objs:
        for nat in natal:
            allowed = allowed_of(obj, nat)
            s = _sep(obj.lon, nat.lon)
            hit = next((a for a in angles if abs(s - a) < allowed), None)
            if hit is not None:
                out[(obj.id, nat.id)] = hit
    return out


def _reported(aspects):
    return {(a['directId'], o['natalId']): o['aspect'] for a in aspects for o in a['objects']}


def _witness(objs, natal, angles, allowed_of):
    """恰在门槛内侧(离相位角 ∈ (N−0.5, N))与恰在外侧(∈ [N, N+0.5))各有几对。"""
    inner = outer = 0
    for obj in objs:
        for nat in natal:
            allowed = allowed_of(obj, nat)
            s = _sep(obj.lon, nat.lon)
            gap = min(abs(s - a) for a in angles)
            if allowed - WITNESS_BAND < gap < allowed:
                inner += 1
            elif allowed <= gap < allowed + WITNESS_BAND:
                outer += 1
    return inner, outer


def _natal():
    pc = perchart.PerChart(dict(BASE))
    return pc, perpredict.PerPredict(pc)


def _with_angles(chart):
    return list(chart.objects) + list(chart.angles)


def _mount_list_for(name):
    """齿轮各推运技法的容许度档位用的是哪张表:True = 弧类表(不含相加除以2),False = 全表。"""
    text = _read(MOUNT_SETTINGS)
    if name in ('profection', 'solarreturn', 'lunarreturn', 'givenyear'):
        block = re.search(r'const PREDICTIVE_PERIOD_BASE_FIELDS = \[(.*?)\n\];', text, re.S).group(1)
    elif name == 'planetaryarc':
        block = re.search(r'const PLANETARY_ARC_FIELDS = \[(.*?)\n\];', text, re.S).group(1)
    else:
        block = re.search(r'\n\tsolararc:\s*\{[^\n]*', text).group(0)
    m = re.search(r"name:\s*'asporb'[^\n]*?directionAsporbOptions\((true|false)\)", block) or \
        re.search(r"f\.name === 'asporb' \? \{ \.\.\.f, options: directionAsporbOptions\((true|false)\)", block)
    assert m, f'{name} 齿轮的容许度档位不是 directionAsporbOptions(...)'
    return m.group(1) == 'true'


def test_mount_asporb_fields_use_page_tables():
    assert _mount_list_for('profection') is False
    assert _mount_list_for('solarreturn') is False
    assert _mount_list_for('lunarreturn') is False
    assert _mount_list_for('givenyear') is False
    assert _mount_list_for('solararc') is True
    assert _mount_list_for('planetaryarc') is True
    tables = _asporb_tables()
    assert [o['value'] for o in tables['arc']] == [o['value'] for o in tables['all'] if o['value'] != -1]


def test_return_family_asporb_labels_match_get_aspects():
    """返照 / 小限 / 流年:每档报出的相位集合 = 按标签容许度独立算出的集合。"""
    pc, pp = _natal()
    natal = _with_angles(pc.chart)
    charts = []
    for year in range(1991, 2031):
        dt = Datetime(f'{year}/03/15', BASE['time'], BASE['zone'])
        charts.append(profections.compute(pc.chart, dt, False, False))
    bad = []
    for opt in _asporb_tables()['all']:
        kind, n = _allowed_rule(opt['label'])
        allowed_of = (lambda o, t, n=n: n) if kind == 'fixed' else (lambda o, t: (o.orb() + t.orb()) / 2)
        inner = outer = 0
        for chart in charts:
            objs = _with_angles(chart)
            got = _reported(pp.getAspects(chart, opt['value']))
            want = _expected(objs, natal, RETURN_ANGLES, allowed_of)
            if got != want:
                bad.append(f"{opt['value']}「{opt['label']}」:多报 {sorted(set(got) - set(want))[:3]} 漏报 {sorted(set(want) - set(got))[:3]}")
                break
            i, o = _witness(objs, natal, RETURN_ANGLES, allowed_of)
            inner += i
            outer += o
        assert inner and outer, f"「{opt['label']}」样本里没有恰在门槛两侧的星对,分不清 N° 与 N±0.5°"
    assert not bad, '容许度档位与后端取相位不符:\n  ' + '\n  '.join(bad)


def test_arc_family_asporb_labels_match_solararc():
    """太阳弧 / 行星弧(月亮弧):每档报出的相位集合 = 按标签容许度独立算出的集合。"""
    pc, _ = _natal()
    natal = _with_angles(pc.chart)
    bad = []
    for opt in _asporb_tables()['arc']:
        kind, n = _allowed_rule(opt['label'])
        assert kind == 'fixed', '弧类档位不该有「相加除以2」'
        inner = outer = 0
        for source in (const.SUN, const.MOON):
            for year in range(1991, 2061, 3):
                dt = Datetime(f'{year}/03/15', BASE['time'], BASE['zone'])
                res = solararc.compute(pc.chart, dt, opt['value'], False, source)
                objs = list(res['objects'])
                got = _reported(res['aspects'])
                want = _expected(objs, natal, ARC_ANGLES, lambda o, t, n=n: n)
                if got != want:
                    bad.append(f"{opt['value']}「{opt['label']}」({source} {year}):多报 {sorted(set(got) - set(want))[:3]} 漏报 {sorted(set(want) - set(got))[:3]}")
                    break
                i, o = _witness(objs, natal, ARC_ANGLES, lambda o, t, n=n: n)
                inner += i
                outer += o
        assert inner and outer, f"「{opt['label']}」样本里没有恰在门槛两侧的星对,分不清 N° 与 N±0.5°"
    assert not bad, '弧类容许度档位与后端取相位不符:\n  ' + '\n  '.join(bad)


def test_label_rule_discriminates():
    assert _allowed_rule('2.5度') == ('fixed', 2.5)
    assert _allowed_rule('双星容许度相加除以2') == ('mean', None)
    pc, pp = _natal()
    chart = profections.compute(pc.chart, Datetime('2001/03/15', BASE['time'], BASE['zone']), False, False)
    natal = _with_angles(pc.chart)
    objs = _with_angles(chart)
    # 若后端把 3° 当 2° 用,报出集合必与按 3° 算的不同(样本里确有 2°–3° 之间的星对)
    want3 = _expected(objs, natal, RETURN_ANGLES, lambda o, t: 3.0)
    want2 = _expected(objs, natal, RETURN_ANGLES, lambda o, t: 2.0)
    assert want3 != want2
    assert _reported(pp.getAspects(chart, 3)) == want3
