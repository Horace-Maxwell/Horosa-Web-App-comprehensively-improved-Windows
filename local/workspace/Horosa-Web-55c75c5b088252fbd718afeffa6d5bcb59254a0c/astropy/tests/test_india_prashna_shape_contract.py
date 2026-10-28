"""问事各块「消费方读的键 ⊆ 生产方样例输出」形状合同 + 子块失败必落账源码护栏。

病理(曾真实发生):消费方按想当然的形状读生产方 —— 读 build_yogas 的 'yogas' / 'present' / 'key'
(真形状是 items[].status == 'present' / id)、读 panchanga 顶层 'paksha'(真在 tithi.paksha)、
把 detect_higher_yogas 的 dict 当 list 迭代(AttributeError 被 except 吞成 None)。页面那几行因此永远不出现,
测试也全绿 —— 因为没有任何一处把「读的键」和「产的键」对起来。

本文件把页面卡(IndiaChartMain.js)与 AI 快照(IndiaChart.js)里问事段的每条属性访问链抽出来,
在真实引擎跑出的样例输出里逐级走一遍:走不通 = 红。新增读法而生产方没给 → 当场红。
"""
import ast
import os
import re

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
ASTROPY = os.path.dirname(HERE)
UI_SRC = os.path.join(os.path.dirname(ASTROPY), 'astrostudyui', 'src')
PAGE_JS = os.path.join(UI_SRC, 'components', 'astro', 'IndiaChartMain.js')
SNAP_JS = os.path.join(UI_SRC, 'components', 'astro', 'IndiaChart.js')
DATA_JS = os.path.join(UI_SRC, 'components', 'astro', 'indiaMain', 'jyotishData.js')
SRV_PY = os.path.join(ASTROPY, 'websrv', 'webindiasrv.py')

BASE = {'date': '1985/03/12', 'time': '14:30:00', 'zone': '+05:30', 'lat': '19n04', 'lon': '72e52',
        'tradition': False, 'predictive': False, 'zodiacal': 1, 'hsys': 0, 'siderealMode': 'lahiri'}

# JS 侧不属于数据形状的成员名(数组 / 字符串 / 数值方法)
_JS_BUILTINS = {'length', 'map', 'join', 'slice', 'forEach', 'filter', 'toFixed', 'some', 'every',
                'indexOf', 'find', 'reduce', 'concat'}
# 只在特定分支才出现的键(其余分支有别的显示):逐个写明出现条件,不许扩成通配
_CONDITIONAL_KEYS = {
    'selfLordNote': 'Lagna 主 = 事项主(同曜)时才给',
    'reason': '块不可用(available=False)时才给',
}


def _srv_and_natal():
    from websrv.webindiasrv import IndiaAstroSrv, IndiaChartKernel
    return IndiaAstroSrv(), IndiaChartKernel(dict(BASE))


class _Obj:
    def __init__(self, lon, retro=False):
        from flatlib import const
        self.lon = float(lon)
        self.sign = const.LIST_SIGNS[int(self.lon // 30.0) % 12]
        self._retro = retro

    def isRetrograde(self):
        return self._retro


class _Chart:
    def __init__(self, lons, retro=()):
        self._o = {k: _Obj(v, k in retro) for k, v in lons.items()}

    def get(self, oid):
        return self._o[oid]


class _Kernel:
    def __init__(self, lons, retro=()):
        self.chart = _Chart(lons, retro)
        self.isDiurnal = True


def _nakta_lons():
    """Lagna 双子(主 = 水)× 第 7 宫射手(主 = 木):水 / 木 宫距 6 无相位,更快的月与二者皆入相 → Nakta。"""
    from flatlib import const
    return {const.ASC: 75.0, const.MERCURY: 10.0, const.JUPITER: 162.0, const.MOON: 125.0,
            const.SUN: 250.0, const.MARS: 280.0, const.VENUS: 300.0, const.SATURN: 330.0}


def _samples():
    """真实引擎 + 构造盘的样例输出(并集):覆盖有 Ithasala / 有 Nakta / 同曜三种分支。"""
    from flatlib import const
    srv, natal = _srv_and_natal()
    out = []
    for qt, num, matter in (('2026/10/24 05:30:00', 77, 'marriage'),
                            ('2026/07/21 15:30:00', 123, 'career')):
        d = dict(BASE, prashnaTime=qt, prashnaNumber=num, prashnaMatter=matter,
                 prashnaSchools='kp,parashari,tajika')
        out.append(srv._compute_prashna(d, natal))
    nak = _Kernel(_nakta_lons())
    out.append({'tajika': srv._prashna_tajika_block(nak, 'marriage', {})})
    same = dict(_nakta_lons())
    same[const.ASC] = 5.0                                   # Lagna 白羊(主 = 火),第 8 宫天蝎(主 = 火)
    out.append({'tajika': srv._prashna_tajika_block(_Kernel(same), 'general', {'prashnaPrimaryHouse': 8})})
    return out


def _js_func_body(src, name):
    """类方法 / 导出函数体(到下一个同级定义为止)。"""
    m = re.search(r'(?m)^(\t?)(?:export function )?' + re.escape(name) + r'\(', src)
    assert m, name
    indent = m.group(1)
    nxt = re.compile(r'(?m)^' + indent + r'(?:export function |\w+\()').search(src, m.end())
    return src[m.start(): nxt.start() if nxt else len(src)]


def _chains(body, alias):
    """body 中 alias.a.b.c 访问链 → [['a','b','c'], ...](遇 JS 内建成员截断)。"""
    out = []
    for m in re.finditer(r'(?<![\w.])' + re.escape(alias) + r'((?:\.[A-Za-z_]\w*)+)', body):
        keys = []
        for k in m.group(1).split('.')[1:]:
            if k in _JS_BUILTINS:
                break
            keys.append(k)
        if keys:
            out.append(keys)
    return out


def _walk(node, path):
    """沿 path(点分;'[]' = 取数组首元)走到节点;走不到 → None。"""
    cur = node
    for seg in [p for p in path.split('.') if p]:
        arr = seg.endswith('[]')
        key = seg[:-2] if arr else seg
        if key:
            if not isinstance(cur, dict) or key not in cur:
                return None
            cur = cur[key]
        if arr:
            if not isinstance(cur, list) or not cur:
                return None
            cur = cur[0]
    return cur


def _resolves(samples, root_path, keys):
    for smp in samples:
        cur = _walk(smp, root_path)
        ok = cur is not None
        for k in keys:
            if isinstance(cur, list):
                cur = cur[0] if cur else None
            if not isinstance(cur, dict) or k not in cur:
                ok = False
                break
            cur = cur[k]
        if ok:
            return True
    return False


# (源文件, 函数名或片段锚, {别名: 样例里的根路径})
_CONTRACTS = [
    (PAGE_JS, 'renderPrashnaParashariCard', {'pa': 'parashari', 'lg': 'parashari.lagna',
                                             'moon': 'parashari.moon', 'nk': 'parashari.moon.nakshatra'}),
    (PAGE_JS, 'renderPrashnaTajikaCard', {'tj': 'tajika', 'it': 'tajika.ithasala'}),
    (PAGE_JS, 'renderPrashnaKpCards', {'kp': 'kp', 'j': 'kp.judgement', 'seg': 'kp.segment',
                                       'c': 'kp.cuspalSubLords[]', 'w': 'kp.timingWindows[]'}),
    (DATA_JS, 'prashnaYogaNames', {'y': 'parashari.yogas[]'}),
    (DATA_JS, 'prashnaHigherYogaText', {'y': 'tajika.higherYogas[]'}),
]


def _snapshot_section():
    src = open(SNAP_JS, encoding='utf-8').read()
    a = src.index('const pr = j.prashna;')
    b = src.index("out['问事 Praśna'] = pl2;", a)
    return src[a:b]


_SNAP_ALIASES = {'pr': '', 'kp2': 'kp', 'jj': 'kp.judgement', 'w': 'kp.timingWindows[]',
                 'pa': 'parashari', 'tj2': 'tajika', 'it2': 'tajika.ithasala'}


@pytest.fixture(scope='module')
def samples():
    return _samples()


def _check(body, aliases, samples, where):
    missing = []
    n = 0
    for alias, root in aliases.items():
        for keys in _chains(body, alias):
            n += 1
            if keys[-1] in _CONDITIONAL_KEYS and len(keys) == 1:
                continue
            if not _resolves(samples, root, keys):
                missing.append('%s: %s.%s(根 %s)' % (where, alias, '.'.join(keys), root or '<prashna>'))
    return n, missing


def test_consumer_keys_exist_in_producer_samples(samples):
    total = 0
    missing = []
    for path, fn, aliases in _CONTRACTS:
        body = _js_func_body(open(path, encoding='utf-8').read(), fn)
        n, miss = _check(body, aliases, samples, fn)
        total += n
        missing += miss
    n, miss = _check(_snapshot_section(), _SNAP_ALIASES, samples, 'AI 快照·问事段')
    total += n
    missing += miss
    assert total >= 40, '抽到的访问链太少(%d):函数名 / 别名改了?' % total
    assert not missing, '消费方读了生产方不产的键:\n' + '\n'.join(missing)


def test_contract_bites_on_wrong_key(samples):
    """自证:把一条读法改成曾经的错键,判据必红。"""
    body = "pa.yogas.map((y)=>y.present); moon.pakshaTop; tj.higherYogas.map((y)=>y.planets)"
    _, miss = _check(body, {'moon': 'parashari.moon'}, samples, 'mut')
    assert miss
    _, miss = _check("y.planets", {'y': 'tajika.higherYogas[]'}, samples, 'mut')
    assert miss


def test_parashari_yogas_and_paksha_present(samples):
    pa = samples[0]['parashari']
    assert pa['yogas'], '已知有成立瑜伽的问时,问时 Yoga 不得为空'
    assert all(y['key'] and y['name'] for y in pa['yogas'])
    assert pa['moon']['paksha'] in ('Shukla', 'Krishna')
    assert 'partialErrors' not in pa


def test_tajika_nakta_reaches_block(samples):
    tj = samples[2]['tajika']
    assert tj['lagnaLord'] == 'Mercury' and tj['karyaLord'] == 'Jupiter'
    assert [y['type'] for y in tj['higherYogas']] == ['nakta']
    assert tj['higherYogas'][0]['via'] == 'Moon'
    assert 'partialErrors' not in tj


def test_tajika_retrograde_flips_ithasala():
    """快曜逆行 → 入相判定反转(此前从不传逆行 = 恒按顺行)。
    Lagna 双子(主 = 水,白羊 10°)× 第 7 宫射手(主 = 木,射手 15°):三合、互在 orb 内。"""
    from flatlib import const
    srv, _ = _srv_and_natal()
    lons = dict(_nakta_lons())
    lons[const.JUPITER] = 255.0
    direct = srv._prashna_tajika_block(_Kernel(lons), 'marriage', {})
    retro = srv._prashna_tajika_block(_Kernel(lons, retro={const.MERCURY}), 'marriage', {})
    assert direct['ithasala']['type'] == 'vartamana' and direct['ithasala']['applying'] is True
    assert retro['ithasala']['type'] == 'eesarpha' and retro['ithasala']['applying'] is False


# ── 源码护栏:问事 / 服务层挂载块的 except Exception 必须落账,不许静默写 None / pass ──
_GUARDED = ('_compute_prashna', '_prashna_kp_block', '_prashna_parashari_block', '_prashna_tajika_block',
            '_compute_sarvatobhadra', '_compute_tripataki', '_compute_gochara', '_compute_tajaka',
            '_transit_context')


def _handler_ok(h):
    for node in ast.walk(ast.Module(body=h.body, type_ignores=[])):
        if isinstance(node, ast.Call) and getattr(node.func, 'id', None) == '_note_partial':
            return True
        if isinstance(node, ast.Return) and isinstance(node.value, ast.Dict):
            if any(isinstance(k, ast.Constant) and k.value == 'reason' for k in node.value.keys):
                return True
    return False


def _catches_exception(h):
    return isinstance(h.type, ast.Name) and h.type.id == 'Exception'


def _guard_violations(tree):
    bad = []
    for fn in ast.walk(tree):
        if not isinstance(fn, ast.FunctionDef):
            continue
        if fn.name in _GUARDED:
            # 只看本函数直属的 handler(内层数值探针函数 asc_fn / cusps_at 的 None 是求根语义,不是块)
            stack = list(fn.body)
            while stack:
                node = stack.pop()
                if isinstance(node, (ast.FunctionDef, ast.Lambda)):
                    continue
                if isinstance(node, ast.ExceptHandler) and _catches_exception(node) and not _handler_ok(node):
                    bad.append('%s:%d' % (fn.name, node.lineno))
                stack.extend(ast.iter_child_nodes(node))
        if fn.name == 'chart':
            for node in ast.walk(fn):
                if isinstance(node, ast.ExceptHandler) and _catches_exception(node) \
                        and len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                    bad.append('chart:%d(except Exception: pass)' % node.lineno)
    return bad


def test_service_block_excepts_record_partial_errors():
    tree = ast.parse(open(SRV_PY, encoding='utf-8').read())
    names = {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    assert set(_GUARDED) <= names, set(_GUARDED) - names
    bad = _guard_violations(tree)
    assert not bad, '子块失败未落 partialErrors / reason:' + ', '.join(bad)


def test_guard_bites_on_silent_none():
    src = (
        "def _prashna_tajika_block(self):\n"
        "    try:\n        x = 1\n    except Exception:\n        block = None\n"
        "def chart(self):\n    try:\n        y = 1\n    except Exception:\n        pass\n")
    bad = _guard_violations(ast.parse(src))
    assert len(bad) == 2, bad


def test_partial_errors_recorded_when_subblock_raises(monkeypatch):
    from astrostudy.india import tajaka as tj
    srv, _ = _srv_and_natal()

    def boom(*a, **k):
        raise RuntimeError('x')
    monkeypatch.setattr(tj, 'detect_higher_yogas', boom)
    blk = srv._prashna_tajika_block(_Kernel(_nakta_lons()), 'marriage', {})
    assert blk['higherYogas'] is None and blk['partialErrors'] == ['higherYogas']
