# -*- coding: utf-8 -*-
"""五兆全组合压力矩阵（真跑 HTTP）：每档位每取值 × 两两组合 × 边界/空值/极端/冲突。

每个组合都验证：
  中栏计算 ✅ = positions 六位五行合法、classic 结构完整、断辞逐乡命中
  右栏显示 ✅ = 15 段齐全且次第不变、快照无 NaN/undefined、类占九门俱在
  归一回显 ✅ = 非法/空值归默认，合法值原样回显

用法（先起服务，端口自选，勿与他人冲突）：
    HOROSA_CHART_PORT=8893 PYTHONPATH=<astropy> python3 -m websrv.webchartsrv &
    WUZHAO_MATRIX_URL=http://127.0.0.1:8893/wuzhao/pan python3 tests/stress/wuzhao_matrix.py

不放进 pytest 常规集：它要求服务在线，属 L5 真跑档；纯函数层的等价断言见
tests/test_wuzhao_adapter.py 与 tests/test_wuzhao_classics.py。
"""
import itertools
import json
import os
import sys
import urllib.error
import urllib.request

URL = os.environ.get('WUZHAO_MATRIX_URL', 'http://127.0.0.1:8893/wuzhao/pan')
BASE = dict(year=2026, month=8, day=11, hour=10, minute=30)
ELEMS = {'水', '火', '木', '金', '土'}
LEGACY9 = ['起盘', '揲筮', '兆', '木乡', '火乡', '土乡', '金乡', '水乡', '特殊标记']
NEW6 = ['断辞', '君子小人', '纳甲', '神煞', '行神', '类占']
MEN9 = ['卜病', '卜官事', '卜财', '卜行人', '卜六亲', '卜宅田丘墓', '卜数射覆', '卜怪异', '杂卜']

results = []
failures = []


def call(payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(URL, body, {'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())


def verify(label, payload):
    """返回 (通过?, 失败原因列表)。"""
    problems = []
    try:
        rsp = call(payload)
    except urllib.error.HTTPError as e:
        return False, ['HTTP %s' % e.code]
    except Exception as e:
        return False, ['EXC %s' % e]
    if rsp.get('ResultCode') != 0:
        return False, ['ResultCode=%s %s' % (rsp.get('ResultCode'), rsp.get('Result'))]
    p = rsp['Result']

    # —— 中栏计算 ——
    pos = p.get('positions') or []
    if len(pos) != 6:
        problems.append('positions 非六位:%d' % len(pos))
    for i, it in enumerate(pos):
        if it.get('element') not in ELEMS:
            problems.append('位%d 五行非法:%r' % (i, it.get('element')))
        if not isinstance(it.get('number'), int) or not (1 <= it['number'] <= 5):
            problems.append('位%d 数字越界:%r' % (i, it.get('number')))
    c = p.get('classic')
    if not c:
        problems.append('classic 缺失')
    else:
        if c.get('zhaoElem') not in ELEMS:
            problems.append('zhaoElem 非法:%r' % c.get('zhaoElem'))
        if c.get('zhiElem') not in ELEMS:
            problems.append('zhiElem 非法:%r' % c.get('zhiElem'))
        if len(c.get('duanci25') or []) != 5:
            problems.append('廿五式命中非五条:%d' % len(c.get('duanci25') or []))
        for row in (c.get('duanci25') or []):
            if not row.get('text'):
                problems.append('断辞空文:%s' % row.get('xiang'))
        if not (c.get('duanciZhaozhi') or {}).get('text'):
            problems.append('兆支总断缺')
        named = [(x.get('xiang13') or {}).get('name') for x in (c.get('positions') or [])[1:]]
        if len([n for n in named if n]) != 5:
            problems.append('十三名词非五格:%r' % named)
        if not (c.get('najia') or {}).get('xun', '').endswith('旬'):
            problems.append('旬缺:%r' % (c.get('najia') or {}).get('xun'))
        if len(((c.get('najia') or {}).get('kongwang') or {}).get('branches') or []) != 2:
            problems.append('空亡非二支')
        for it in (c.get('positions') or []):
            if len(it.get('najia') or []) != 2 or len(it.get('xiangNajia') or []) != 2:
                problems.append('%s 纳甲非两干' % it.get('label'))
        lz = c.get('leizhan') or {}
        for men in MEN9:
            if men not in lz:
                problems.append('类占缺门:%s' % men)
            elif not lz[men].get('texts'):
                problems.append('类占%s 无通则' % men)

    # —— 右栏显示 ——
    secs = p.get('sections') or []
    titles = [s.get('title') for s in secs]
    if titles[:9] != LEGACY9:
        problems.append('既有九段次第变:%r' % titles[:9])
    for t in NEW6:
        if t not in titles:
            problems.append('新段缺:%s' % t)
    for s in secs:
        if not s.get('key'):
            problems.append('段缺 key:%s' % s.get('title'))
        for row in (s.get('rows') or []):
            v = '%s' % row.get('value')
            if 'undefined' in v or 'NaN' in v:
                problems.append('段[%s]行[%s]含脏值' % (s.get('title'), row.get('label')))
    snap = p.get('snapshot') or ''
    if 'undefined' in snap or 'NaN' in snap:
        problems.append('快照含 undefined/NaN')
    for t in LEGACY9 + NEW6:
        if ('[%s]' % t) not in snap:
            problems.append('快照缺段:%s' % t)

    # —— 回显一致性(用户所设 = 后端所认) ——
    # 枚举类空串/非法值应归一为默认(不是回显原值);合法值必须原样回显。
    DEFAULTS = {'shifaVariant': 'guayi', 'xingshenMonth': 'lunar', 'mingZhi': '', 'gender': ''}
    LEGAL = {
        'shifaVariant': {'guayi', 'jiaolu'},
        'xingshenMonth': {'lunar', 'jieqi'},
        'mingZhi': set('子丑寅卯辰巳午未申酉戌亥'),
        'gender': {'male', 'female'},
    }
    for key, legal in LEGAL.items():
        if key not in payload:
            continue
        want = payload[key] if payload[key] in legal else DEFAULTS[key]
        if p.get(key) != want:
            problems.append('%s 归一/回显不符:设%r期望%r得%r' % (key, payload[key], want, p.get(key)))

    return (not problems), problems


def run(label, payload):
    ok, probs = verify(label, payload)
    results.append((label, ok, probs))
    if not ok:
        failures.append((label, payload, probs))
    return ok


# ── 1. 每档位每取值 ───────────────────────────────────────────
MODES = ['ganzhi', 'day', 'hour', 'minute', 'tang', 'dunhuang', 'qian', 'zhushu']
for m in MODES:
    run('mode=%s' % m, {**BASE, 'mode': m})
for n in range(0, 10):
    run('number=%d' % n, {**BASE, 'mode': 'ganzhi', 'number': n})
for v in ['guayi', 'jiaolu']:
    run('shifaVariant=%s' % v, {**BASE, 'mode': 'dunhuang', 'shifaVariant': v})
for v in ['lunar', 'jieqi']:
    run('xingshenMonth=%s' % v, {**BASE, 'mode': 'zhushu', 'zhaoNums': [3] * 6, 'xingshenMonth': v})
for z in ['', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']:
    run('mingZhi=%r' % z, {**BASE, 'mode': 'zhushu', 'zhaoNums': [3] * 6, 'mingZhi': z, 'gender': 'male'})
for g in ['', 'male', 'female']:
    run('gender=%s' % g, {**BASE, 'mode': 'zhushu', 'zhaoNums': [3] * 6, 'mingZhi': '亥', 'gender': g})
for v in range(1, 6):
    run('zhaoNums=all%d' % v, {**BASE, 'mode': 'zhushu', 'zhaoNums': [v] * 6})
for v in range(0, 5):
    run('qianThrows=all%d' % v, {**BASE, 'mode': 'qian', 'qianAuto': False, 'qianThrows': [v] * 6})
for a in [True, False]:
    run('qianAuto=%s' % a, {**BASE, 'mode': 'qian', 'qianAuto': a, 'qianThrows': [1, 2, 3, 3, 3, 4]})
for m in ['day', 'hour', 'minute', 'tang']:
    for manual in [True, False]:
        run('%s manual=%s' % (m, manual),
            {**BASE, 'mode': m, 'manual': manual, 'manualSplits': [18, 8, 5, 2, 1, 1]})
for sp in ([1] * 6, [35] * 6, [18, 8, 5, 2, 1, 1], [10, 20, 30, 1, 2, 3]):
    run('manualSplits=%r' % (sp,), {**BASE, 'mode': 'tang', 'manual': True, 'manualSplits': sp})

# ── 2. 边界 / 空值 / 极端 / 冲突 ─────────────────────────────
EDGE = [
    ('极早年', {**BASE, 'year': 1, 'mode': 'zhushu', 'zhaoNums': [3] * 6}),
    ('公元前', {**BASE, 'year': -500, 'mode': 'zhushu', 'zhaoNums': [3] * 6}),
    ('极晚年', {**BASE, 'year': 2999, 'mode': 'zhushu', 'zhaoNums': [3] * 6}),
    ('闰年229', {**BASE, 'year': 2024, 'month': 2, 'day': 29, 'mode': 'ganzhi'}),
    ('跨年末', {**BASE, 'year': 2024, 'month': 12, 'day': 31, 'hour': 23, 'minute': 59, 'mode': 'ganzhi'}),
    ('子初', {**BASE, 'hour': 0, 'minute': 0, 'mode': 'ganzhi'}),
    ('晚子23时', {**BASE, 'hour': 23, 'minute': 0, 'mode': 'ganzhi'}),
    ('闰六月', {**BASE, 'year': 2025, 'month': 7, 'day': 20, 'mode': 'zhushu', 'zhaoNums': [3] * 6}),
    ('number越界91', {**BASE, 'mode': 'ganzhi', 'number': 91}),
    ('number负数', {**BASE, 'mode': 'ganzhi', 'number': -5}),
    ('zhaoNums越界0', {**BASE, 'mode': 'zhushu', 'zhaoNums': [0, 9, 3, 3, 3, 3]}),
    ('zhaoNums短数组', {**BASE, 'mode': 'zhushu', 'zhaoNums': [3, 3]}),
    ('zhaoNums空', {**BASE, 'mode': 'zhushu', 'zhaoNums': []}),
    ('zhaoNums非数组', {**BASE, 'mode': 'zhushu', 'zhaoNums': 'x'}),
    ('qianThrows越界', {**BASE, 'mode': 'qian', 'qianAuto': False, 'qianThrows': [9, -3, 2, 2, 2, 2]}),
    ('qianThrows空', {**BASE, 'mode': 'qian', 'qianAuto': False, 'qianThrows': []}),
    ('manualSplits越界', {**BASE, 'mode': 'tang', 'manual': True, 'manualSplits': [0, 99, 5, 2, 1, 1]}),
    ('manualSplits短', {**BASE, 'mode': 'tang', 'manual': True, 'manualSplits': [1, 2]}),
    ('mode非法', {**BASE, 'mode': 'bogus'}),
    ('mode空', {**BASE, 'mode': ''}),
    ('mingZhi非法', {**BASE, 'mode': 'zhushu', 'zhaoNums': [3] * 6, 'mingZhi': '甲'}),
    ('gender非法', {**BASE, 'mode': 'zhushu', 'zhaoNums': [3] * 6, 'gender': 'other'}),
    ('shifaVariant非法', {**BASE, 'mode': 'dunhuang', 'shifaVariant': 'bogus'}),
    ('xingshenMonth非法', {**BASE, 'mode': 'zhushu', 'zhaoNums': [3] * 6, 'xingshenMonth': 'bogus'}),
    ('全档位空串', {**BASE, 'mode': '', 'shifaVariant': '', 'xingshenMonth': '', 'mingZhi': '', 'gender': ''}),
    # 冲突组合：起兆法与其不相干的专属档位同时给
    ('冲突:干支+掷钱数', {**BASE, 'mode': 'ganzhi', 'qianThrows': [4] * 6, 'qianAuto': False}),
    ('冲突:直输+手动六数', {**BASE, 'mode': 'zhushu', 'zhaoNums': [2] * 6, 'manual': True, 'manualSplits': [35] * 6}),
    ('冲突:掷钱+卜数', {**BASE, 'mode': 'qian', 'qianAuto': False, 'qianThrows': [0] * 6, 'zhaoNums': [5] * 6}),
    ('冲突:敦煌+报数', {**BASE, 'mode': 'dunhuang', 'number': 7}),
    ('冲突:年命无性别', {**BASE, 'mode': 'zhushu', 'zhaoNums': [3] * 6, 'mingZhi': '子', 'gender': ''}),
    ('冲突:性别无年命', {**BASE, 'mode': 'zhushu', 'zhaoNums': [3] * 6, 'mingZhi': '', 'gender': 'female'}),
]
for label, pl in EDGE:
    run(label, pl)

# ── 3. 两两组合（确定性起兆法 × 断法档位全笛卡尔）────────────
det = [('zhushu', {'zhaoNums': [4, 3, 2, 2, 2, 1]}),
       ('qian', {'qianAuto': False, 'qianThrows': [1, 2, 3, 3, 3, 4]}),
       ('ganzhi', {'number': 3})]
for (m, extra), xm, mz, gd in itertools.product(det, ['lunar', 'jieqi'],
                                                ['', '亥', '午'], ['', 'male', 'female']):
    run('组合 %s×%s×%r×%r' % (m, xm, mz, gd),
        {**BASE, 'mode': m, **extra, 'xingshenMonth': xm, 'mingZhi': mz, 'gender': gd})

# 敦煌两口径 × 断法
for v, xm in itertools.product(['guayi', 'jiaolu'], ['lunar', 'jieqi']):
    run('组合 dunhuang×%s×%s' % (v, xm),
        {**BASE, 'mode': 'dunhuang', 'shifaVariant': v, 'xingshenMonth': xm})

# 四时全覆盖（休王随季变）× 起兆法
for (mo, day) in [(2, 10), (5, 10), (7, 20), (8, 20), (11, 10)]:
    for m, extra in det:
        run('四时 %d月×%s' % (mo, m), {**BASE, 'month': mo, 'day': day, 'mode': m, **extra})

total = len(results)
passed = sum(1 for _, ok, _ in results if ok)
print('=' * 72)
print('压力矩阵：%d 组合，通过 %d，失败 %d' % (total, passed, total - passed))
print('=' * 72)
if failures:
    for label, pl, probs in failures[:40]:
        print('❌ %s' % label)
        for p in probs[:6]:
            print('     · %s' % p)
    sys.exit(1)
print('全部通过')
