# -*- coding: utf-8 -*-
"""选项标签 ↔ 后端常量 ↔ Swiss Ephemeris 规范名 合同(选项语义证 · contract)。

「拨了有反应」只证明值被消费,不证明选到的就是标签写的那一制。本文件把三段各自独立写出的东西对上:
  ① 前端下拉的 value → label(astrostudyui 常量表 / 参数表原文,正则读取,不执行前端代码);
  ② 后端按 value 取到的分宫制 / 岁差常量(perchart.hsys、印占内核表、normalize_ayanamsa);
  ③ Swiss Ephemeris 自带的规范名(swe.house_name / swe.get_ayanamsa_name)。
标签 → 应得常量 由按名称书写的规则表判定(与后端列表顺序无关);常量 → 规范名 再核一遍族名。
已登记的不符项(KNOWN_MISMATCH)必须仍然不符:修好后本测试会要求把登记删掉(棘轮只减)。
"""
import math
import os
import re
import sys

import swisseph as pyswe

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import perchart  # noqa: E402
from astrostudy.india import india_chart_kernel as kernel  # noqa: E402
from flatlib.ephem import swe as fswe  # noqa: E402

UI_SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'astrostudyui', 'src'))
ASTRO_CONST = os.path.join(UI_SRC, 'constants', 'AstroConst.js')
HORARY_SPEC = os.path.join(UI_SRC, 'divination', 'horary', 'horarySchools.js')
MOUNT_SETTINGS = os.path.join(UI_SRC, 'utils', 'techniqueMountSettings.js')


def _read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def _array_block(text, start_pattern):
    m = re.search(start_pattern, text)
    assert m, f'找不到数组起点: {start_pattern}'
    depth = 0
    i = text.index('[', m.end())   # 从匹配末尾起找:key 行与数组之间可夹注释行(注释里的方括号不得被当成数组起点)
    for j in range(i, len(text)):
        ch = text[j]
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                return text[i:j + 1]
    raise AssertionError(f'数组未闭合: {start_pattern}')


_OPT_RE = re.compile(r"\{\s*value:\s*(?:'([^']*)'|(-?\d+))\s*,\s*label:\s*'([^']*)'")


def _options(block):
    out = []
    for m in _OPT_RE.finditer(block):
        value = m.group(1) if m.group(1) is not None else int(m.group(2))
        out.append((value, m.group(3)))
    assert out, '数组里没有 { value, label } 选项'
    return out


# ---------------------------------------------------------------- 分宫制

# 标签 → 应得分宫制(flatlib 常量值 / 自定义标记)。按名称书写,先具体后泛称(Vehlow / Equal MC / Equal 2 必须先于 Equal)。
HOUSE_LABEL_RULES = [
    (r'福点整宫', perchart.custHouse_Fortuna_Whole),
    (r'天顶为\s*10\s*宫中点', perchart.custHouse_Equal_MC_Middle),
    (r'整宫|whole\s*sign', 'Whole Sign'),
    (r'vehlow', 'Vehlow Equal'),
    (r'equal\s*mc', 'Equal MC'),
    (r'equal\s*2', 'Equal 2'),
    (r'命起宫|\bequal\b', 'Equal'),
    (r'sunshine\s*alt', 'Sunshine Alternate'),
    (r'sunshine', 'Sunshine'),
    (r'pullen\s*sd', 'Pullen SD'),
    (r'pullen\s*sr', 'Pullen SR'),
    (r'krusinski', 'Krusinski-Pisa-Goelzer'),
    (r'carter', 'Carter Poli-Equatorial'),
    (r'savard', 'Savard-A'),
    (r'\bapc\b', 'APC Houses'),
    (r'polich|topocentric', 'Polich Page'),
    (r'azimuth|horizon', 'Azimuthal'),
    (r'meridian|axial', 'Meridian'),
    (r'morin', 'Morinus'),
    (r'sripati', 'Sripati'),
    (r'porphyr|波菲', 'Porphyrius'),
    (r'campanus', 'Campanus'),
    (r'regiomontanus', 'Regiomontanus'),
    (r'placidus', 'Placidus'),
    (r'\bkoch\b', 'Koch'),
    (r'alcabit', 'Alcabitus'),
]

# 分宫制常量 → Swiss Ephemeris house_name 里必须出现的族名(小写正则)
HOUSE_SWE_FAMILY = {
    'Whole Sign': r'whole', 'Vehlow Equal': r'vehlow', 'Equal MC': r'equal \(mc\)', 'Equal 2': r'^equal$', 'Equal': r'^equal$',
    'Sunshine Alternate': r'sunshine/alt', 'Sunshine': r'^sunshine$', 'Pullen SD': r'pullen sd', 'Pullen SR': r'pullen sr',
    'Krusinski-Pisa-Goelzer': r'krusinski', 'Carter Poli-Equatorial': r'carter', 'Savard-A': r'savard', 'APC Houses': r'apc',
    'Polich Page': r'polich', 'Azimuthal': r'azimut|horizon', 'Meridian': r'meridian', 'Morinus': r'morin', 'Sripati': r'sripati',
    'Porphyrius': r'porphyr', 'Campanus': r'campanus', 'Regiomontanus': r'regiomontanus', 'Placidus': r'placidus', 'Koch': r'koch',
    'Alcabitus': r'alcabit',
}

# 已登记的标签 ≠ 后端:(表, value) → 发现清单编号。修好后删登记(本测试会提示)。
KNOWN_MISMATCH = {
    # 卜卦宫制表 4/5/7 三项已改为后端真值(4=Koch / 9=Porphyry / 10=Campanus),登记清空(棘轮只减)。
}


def _expected_house(label):
    low = label.lower()
    for pat, const_value in HOUSE_LABEL_RULES:
        if re.search(pat, low):
            return const_value
    raise AssertionError(f'分宫制标签无规则可判: {label!r}')


def _check_house_table(table_name, options, backend_of):
    problems, still_known = [], set()
    for value, label in options:
        expected = _expected_house(label)
        actual = backend_of(value)
        key = (table_name, value)
        if actual != expected:
            if key in KNOWN_MISMATCH:
                still_known.add(key)
                continue
            problems.append(f'{table_name} value={value} 标签 {label!r} 应为 {expected!r},后端取到 {actual!r}')
    for key, ref in KNOWN_MISMATCH.items():
        if key[0] == table_name and key not in still_known:
            problems.append(f'{table_name} value={key[1]} 已与后端一致({ref} 已修?)→ 从 KNOWN_MISMATCH 删掉该登记')
    return problems


def test_house_system_labels_match_backend_generic_table():
    """HOUSE_SYSTEM_OPTIONS(西占本命 / 星运 / 量化 / 宿占等挂载齿轮共用)↔ perchart.hsys。"""
    opts = _options(_array_block(_read(ASTRO_CONST), r'export const HOUSE_SYSTEM_OPTIONS\s*='))
    assert len(opts) == len(perchart.hsys), '前端分宫制档数与后端 hsys 表长度不同'
    problems = _check_house_table('generic', opts, perchart.getHSys)
    assert not problems, '\n'.join(problems)


def test_mount_hsys_options_reuse_generic_table():
    """挂载齿轮的宫制下拉就是 HOUSE_SYSTEM_OPTIONS 原表(否则上一条合同证不到挂载面)。"""
    src = _read(MOUNT_SETTINGS)
    assert re.search(r'const HSYS_OPTIONS = \(AstroConst\.HOUSE_SYSTEM_OPTIONS \|\| \[\]\)\.map\(', src)


def test_house_system_labels_match_backend_india_table():
    """INDIA_HOUSE_SYSTEM_OPTIONS ↔ 印占内核 INDIA_HOUSE_SYSTEMS(印占页用自己的编号表,不走 perchart.hsys)。"""
    opts = _options(_array_block(_read(ASTRO_CONST), r'export const INDIA_HOUSE_SYSTEM_OPTIONS\s*='))
    assert {v for v, _ in opts} == set(kernel.INDIA_HOUSE_SYSTEMS), '前端印占分宫制编号集与内核表不同'
    problems = _check_house_table('india', opts, lambda v: kernel.normalize_house_system(v)[1]['flatlib'])
    assert not problems, '\n'.join(problems)


def test_house_system_labels_match_backend_horary_spec():
    """卜卦参数表的宫制下拉(发往 perchart.getHSys)。"""
    block = _array_block(_read(HORARY_SPEC), r"key:\s*'hsys',[^\n]*\n(?:\s*//[^\n]*\n)*\s*options:\s*(?=\[)")
    problems = _check_house_table('horary', _options(block), perchart.getHSys)
    assert not problems, '\n'.join(problems)


def test_backend_house_constants_match_swiss_ephemeris_names():
    """后端用到的每个 flatlib 分宫制常量,其 Swiss Ephemeris 系统码的规范名属于同一族。"""
    consts = set(perchart.hsys) | {h['flatlib'] for h in kernel.INDIA_HOUSE_SYSTEMS.values()}
    problems = []
    for c in sorted(consts):
        if c in (perchart.custHouse_Equal_MC_Middle, perchart.custHouse_Fortuna_Whole):
            continue
        code = fswe.SWE_HOUSESYS.get(c)
        if code is None:
            problems.append(f'{c!r} 没有 Swiss Ephemeris 系统码')
            continue
        name = pyswe.house_name(code).lower()
        if not re.search(HOUSE_SWE_FAMILY[c], name):
            problems.append(f'{c!r} → 系统码 {code!r} 规范名 {name!r} 不属该族')
    assert not problems, '\n'.join(problems)


def test_custom_house_markers_have_semantics():
    """两个自定义宫制标记的语义锚:天顶为 10 宫中点(10 宫中点 = MC)与福点整宫(1 宫 = 福点所在座 0°)。"""
    data = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'ad': 1, 'predictive': 0}
    mid = perchart.PerChart({**data, 'hsys': 8})
    houses = sorted(mid.chart.houses, key=lambda h: int(h.id[5:]))
    mc = mid.chart.getAngle('MC').lon
    h10_mid = (houses[9].lon + 15.0) % 360.0
    assert abs((h10_mid - mc + 180.0) % 360.0 - 180.0) < 1e-6
    fortuna = perchart.PerChart({**data, 'hsys': 24})
    fh = sorted(fortuna.chart.houses, key=lambda h: int(h.id[5:]))
    assert abs(fh[0].lon % 30.0) < 1e-6 or abs(fh[0].lon % 30.0 - 30.0) < 1e-6
    # 样本为昼盘(10:00):福点 = 上升 + 月 − 日,1 宫起于福点所在座首;各宫 30°
    asc = fortuna.chart.getAngle('Asc').lon
    sun = fortuna.chart.getObject('Sun').lon
    moon = fortuna.chart.getObject('Moon').lon
    pof_sign = int(((asc + moon - sun) % 360.0) // 30)
    assert int((fh[0].lon % 360.0 + 1e-6) // 30) % 12 == pof_sign
    assert all(abs(((fh[(i + 1) % 12].lon - fh[i].lon) % 360.0) - 30.0) < 1e-6 for i in range(12))


# ---------------------------------------------------------------- 岁差(ayanāṃśa)

def _tokens(s):
    words = re.findall(r'[a-z0-9]+', s.lower())
    return {w[:5] if len(w) >= 5 else w for w in words if w not in ('the', 'and')}


def test_ayanamsa_option_values_resolve_to_themselves():
    """INDIA_AYANAMSA_OPTIONS 每个 value 在后端都解析成它自己(不被静默回落到 lahiri)。"""
    opts = _options(_array_block(_read(ASTRO_CONST), r'export const INDIA_AYANAMSA_OPTIONS\s*='))
    assert {v for v, _ in opts} == set(kernel.INDIA_AYANAMSA_MODES), '前端岁差档集与内核表不同'
    bad = [v for v, _ in opts if kernel.normalize_ayanamsa(v)['key'] != v]
    assert not bad, f'被回落的岁差档: {bad}'


def test_ayanamsa_labels_best_match_their_swiss_ephemeris_mode():
    """每个前端标签与自己档位的 Swiss Ephemeris 规范名最像(按稀有词加权;防标签与模式错位)。"""
    opts = _options(_array_block(_read(ASTRO_CONST), r'export const INDIA_AYANAMSA_OPTIONS\s*='))
    names = {k: pyswe.get_ayanamsa_name(m['mode']) for k, m in kernel.INDIA_AYANAMSA_MODES.items()}
    df = {}
    for n in names.values():
        for t in _tokens(n):
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log(1.0 + len(names) / c) for t, c in df.items()}
    problems = []
    for value, label in opts:
        lt = _tokens(label)
        scores = {k: sum(idf.get(t, 0.0) for t in (lt & _tokens(n))) for k, n in names.items()}
        best = max(scores.values())
        if scores[value] < best - 1e-9:
            winner = max(scores, key=scores.get)
            problems.append(f'{value}: 标签 {label!r} 更像 {winner} 的规范名 {names[winner]!r},而非本档 {names[value]!r}')
        if scores[value] <= 0.0:
            problems.append(f'{value}: 标签 {label!r} 与本档规范名 {names[value]!r} 零共词')
    assert not problems, '\n'.join(problems)


def test_ayanamsa_mode_constant_names_match_keys():
    """内核表每档的模式号 = pyswisseph 同名常量(SIDM_<KEY 大写>),防同表内模式号抄错。"""
    problems = []
    for key, m in kernel.INDIA_AYANAMSA_MODES.items():
        attr = 'SIDM_' + key.upper()
        if not hasattr(pyswe, attr):
            continue
        if getattr(pyswe, attr) != m['mode']:
            problems.append(f'{key}: 模式号 {m["mode"]} ≠ pyswisseph.{attr}={getattr(pyswe, attr)}')
    assert not problems, '\n'.join(problems)


def test_mount_ayanamsa_selects_reuse_india_table():
    """西占 / 宿占 / 量化盘挂载「岁差制」与七政「恒星岁差」下拉 = 空档 + INDIA_AYANAMSA_OPTIONS 原表(+ 自定义)。"""
    src = _read(MOUNT_SETTINGS)
    assert re.search(r"name: 'siderealAyanamsa'.*options: \[\{ value: '', label: '默认（随盘 / Lahiri）' \}, \.\.\.AstroConst\.INDIA_AYANAMSA_OPTIONS, \{ value: 'user'", src)
    assert re.search(r"options: \[\{ value: '', label: '郑式（默认）' \}, \.\.\.AstroConst\.INDIA_AYANAMSA_OPTIONS\]", src)
    assert re.search(r"name: 'indiaAyanamsa'.*options: AstroConst\.INDIA_AYANAMSA_OPTIONS", src)


def test_western_sidereal_default_and_zheng_default_semantics():
    """空档语义:西洋恒星黄道空档 = 后端缺省模式(不设 sid_mode);七政恒星制空档 = 郑氏模式;显式 lahiri 走 Lahiri。"""
    base = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'ad': 1, 'predictive': 0, 'hsys': 0}
    west_empty = perchart.PerChart({**base, 'zodiacal': 1, 'siderealAyanamsa': ''})
    assert west_empty.siderealMode is None
    west_lahiri = perchart.PerChart({**base, 'zodiacal': 1, 'siderealAyanamsa': 'lahiri'})
    assert west_lahiri.siderealMode['key'] == 'lahiri'
    zheng = perchart.PerChart({**base, 'doubingSu28': perchart.SU28_MODE_ZHENG_SIDEREAL})
    assert zheng.isZhengSidereal
    assert zheng.siderealMode == perchart.ZHENG_SIDEREAL_MODE
    zheng_lahiri = perchart.PerChart({**base, 'doubingSu28': perchart.SU28_MODE_ZHENG_SIDEREAL, 'guolaoAyanamsa': 'lahiri', 'siderealAyanamsa': 'lahiri'})
    assert zheng_lahiri.siderealMode['key'] == 'lahiri'
