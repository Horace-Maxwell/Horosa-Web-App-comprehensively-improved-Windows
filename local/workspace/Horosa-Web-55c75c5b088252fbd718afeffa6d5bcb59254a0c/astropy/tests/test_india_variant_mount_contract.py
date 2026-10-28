# -*- coding: utf-8 -*-
"""印占流派开关 × AI 挂载合同(引擎侧)。

印占的全部算法变体表 —— 流派开关(dasha_variants.VARIANT_SPECS)、分盘变体(varga.VARGA_VARIANT_CHOICES)、
卡拉卡方案、星曜战判据 —— 每个非缺省档都必须让 /india/chart 的回包有真变化,
而且变化落在 AI 快照读得到的数据上。前端合同测试
astrostudyui/src/utils/__tests__/indiaVariantMountContract.test.js 读同一份夹具,
对每个档用「缺省回包 / 该档回包」各拼一次快照数据段,断言两者不同 —— 开关只进页面不进挂载即红。

本测试保证夹具就是本服务的真输出:任何一侧口径变了(引擎改算法 / 快照漏读),两侧必有一侧红。
重新生成夹具:在 Horosa-Web/astropy 下
    python3 -m tests.test_india_variant_mount_contract --write
(会在样例盘里按序找第一张「该档真有变化」的盘,写回夹具)。
"""
import copy
import json
import os
import sys
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
_FLAT = os.path.join(ROOT, '..', 'flatlib-ctrad2')
if _FLAT not in sys.path:
    sys.path.insert(0, _FLAT)

FIXTURE = (Path(__file__).resolve().parents[2] / 'astrostudyui' / 'src' / 'utils' / '__tests__'
           / 'fixtures' / 'indiaVariantMountContract.json')

# 样例盘(固定请求;顺序即搜索顺序)。孟买 / 北京两地,覆盖落陷曜、凶星升上升、罗睺三角、节点 Vedha 等触发条件。
CHARTS = [
    {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '39n54', 'lon': '116e23'},
]
for _y in range(1971, 2031, 3):
    CHARTS.append({'date': '%d/%02d/%02d' % (_y, (_y * 7) % 12 + 1, (_y * 5) % 27 + 1),
                   'time': '%02d:%02d:00' % ((_y * 11) % 24, (_y * 13) % 60),
                   'zone': '+05:30', 'lat': '19n04', 'lon': '72e52'})
COMMON = {'ad': 1, 'transitDate': '2026/01/01', 'tajakaYear': 2026}

# 开关所在的大运体系:页面只在选中该体系时展开它的树,快照也只写选中体系 → 合同在该体系下判。
DASHA_SYSTEM_CONTEXT = {
    'ashtottariReckoning': 'ashtottari',
    'charaDirection': 'chara',
    'charaDignity': 'chara',
    'rasiAntarFirst': 'chara',
    'rasiAntarSplit': 'chara',
}
# 引擎不消费、只在前端显示层切分的开关(回包恒同,合同改由前端按 fields 判)。
FRONTEND_ONLY = {
    'rasiAntarSplit': 'Chara 中运按比例 / 12 等分在前端由主期切分,引擎回包与此键无关',
}
# 流派开关以外的变体表:(键, 非缺省档, 请求体, 页面字段)。分盘变体在本命盘(D1)上判 —— 换到该分盘时整张盘
# 都变,那一层归星盘文本;D1 上它经六力 / 分盘吉位 / 变体对照进 jyotish,快照数据段必须跟着变。
def _other_switches():
    from astrostudy.india.varga import VARGA_VARIANT_CHOICES
    out = [('karakaScheme', '7', {'karakaScheme': '7'}, {'indiaKarakaScheme': '7'}),
           ('yuddhaCriterion', 'longitude', {'yuddhaCriterion': 'longitude'}, {'indiaYuddhaCriterion': 'longitude'})]
    for cn in sorted(VARGA_VARIANT_CHOICES):
        for v in VARGA_VARIANT_CHOICES[cn]:
            out.append(('vargaVariant.%d' % cn, v, {'vargaVariant': json.dumps({str(cn): v})}, {'indiaVargaVariant': {str(cn): v}}))
    return out


def _switches():
    from astrostudy.india.dasha_variants import VARIANT_SPECS
    out = []
    for key in sorted(VARIANT_SPECS):
        spec = VARIANT_SPECS[key]
        for value in spec['values']:
            if value != spec['default']:
                out.append((key, value, {'dashaVariants': json.dumps({key: value})}, {'indiaDashaVariants': {key: value}}))
    return out + _other_switches()


# 只回显所选档位、不改任何结果的子树(盘里没有星曜战时判据只是回显)→ 搜样例盘时不算「有变化」。
ECHO_ONLY = {
    'yuddhaCriterion': ('grahaYuddha/criterion',),
}
# 快照不读的深层(页面只展开到中运,快照同)→ 从夹具里剥掉以控体积;剥完仍须有变化,否则合同红。
SLIM_KEYS = ('pratyantardashas',)


def _chart(req):
    import cherrypy
    import websrv.webindiasrv as W
    cherrypy.request.json = dict(req)
    return json.loads(W.IndiaAstroSrv().chart())


def _request(chart_idx, key, extra=None):
    req = dict(CHARTS[chart_idx])
    req.update(COMMON)
    sys_name = DASHA_SYSTEM_CONTEXT.get(key)
    if sys_name:
        req['dashaSystem'] = sys_name
    if extra:
        req.update(extra)
    return req


def _slim(o):
    if isinstance(o, dict):
        return {k: _slim(v) for k, v in o.items() if k not in SLIM_KEYS}
    if isinstance(o, list):
        return [_slim(v) for v in o]
    return o


def _changed_subtrees(base, alt):
    """jyotish 下第二层(jyotish/X/Y;X 本身是叶子则 jyotish/X)有差异的路径。回包 jyotish 以外有差异 → 抛错。"""
    assert {k: v for k, v in base.items() if k != 'jyotish'} == {k: v for k, v in alt.items() if k != 'jyotish'}, \
        '流派开关改动了 jyotish 以外的回包字段,合同夹具需扩展'
    jb, ja = _slim(base.get('jyotish') or {}), _slim(alt.get('jyotish') or {})
    paths = []
    for k in sorted(set(jb) | set(ja)):
        vb, va = jb.get(k), ja.get(k)
        if vb == va:
            continue
        if isinstance(vb, dict) and isinstance(va, dict):
            for k2 in sorted(set(vb) | set(va)):
                if vb.get(k2) != va.get(k2):
                    paths.append('%s/%s' % (k, k2))
        else:
            paths.append(k)
    return paths


def _leaves(o, pre=''):
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            out.update(_leaves(v, '%s/%s' % (pre, k) if pre else str(k)))
        return out if o else {pre: o}
    if isinstance(o, list):
        out = {}
        for i, v in enumerate(o):
            out.update(_leaves(v, '%s/%d' % (pre, i) if pre else str(i)))
        return out if o else {pre: o}
    return {pre: o}


def _alt_payload(b, a):
    """同形(叶子路径集相同、只改值)→ 只记改了的叶子 {'$patch': [[相对路径, 新值], …]};否则记整棵。"""
    lb, la = _leaves(b), _leaves(a)
    if isinstance(b, (dict, list)) and isinstance(a, (dict, list)) and set(lb) == set(la) and '' not in lb:
        return {'$patch': sorted([k, la[k]] for k in la if la[k] != lb[k])}
    return a


def _get(j, path):
    cur = j
    for p in path.split('/'):
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def _entry(chart_idx, key, extra, base_cache):
    bkey = '%d|%s' % (chart_idx, DASHA_SYSTEM_CONTEXT.get(key, ''))
    if bkey not in base_cache:
        base_cache[bkey] = _chart(_request(chart_idx, key))
    base = base_cache[bkey]
    if key in FRONTEND_ONLY:
        alt = base
        paths = []
    else:
        alt = _chart(_request(chart_idx, key, extra))
        paths = _changed_subtrees(base, alt)
    return bkey, base, alt, paths


def build_contract(search):
    recorded = {}
    if not search:
        old = json.loads(FIXTURE.read_text(encoding='utf-8'))
        recorded = {(e['key'], e['value']): e['chart'] for e in old['entries']}
    base_cache = {}
    entries = []
    bases = {}
    for key, value, extra, fields in _switches():
        if search:
            cands = range(len(CHARTS))
        else:
            assert (key, value) in recorded, '夹具缺 %s=%s(新增开关 / 档位须重生成夹具)' % (key, value)
            cands = [recorded[(key, value)]]
        hit = None
        for ci in cands:
            if key in FRONTEND_ONLY and ci != cands[0]:
                break
            bkey, base, alt, paths = _entry(ci, key, extra, base_cache)
            if [p for p in paths if p not in ECHO_ONLY.get(key, ())] or key in FRONTEND_ONLY:
                hit = (ci, bkey, base, alt, paths)
                break
        assert hit, '%s=%s 在全部样例盘上回包零变化(引擎死开关)' % (key, value)
        ci, bkey, base, alt, paths = hit
        sub = bases.setdefault(bkey, {'dashaSystem': DASHA_SYSTEM_CONTEXT.get(key, ''),
                                      'request': {k: v for k, v in _request(ci, key).items() if k != 'dashaSystem'},
                                      'jyotish': {}})
        jb, ja = _slim(base.get('jyotish') or {}), _slim(alt.get('jyotish') or {})
        for p in paths:
            sub['jyotish'][p] = _get(jb, p)
            # 同一容器的标量兄弟(available / 方法名 / 年基 …)快照拼段时要读,一并带上。
            if '/' in p:
                cont = p.split('/')[0]
                for k2, v2 in (jb.get(cont) or {}).items():
                    if not isinstance(v2, (dict, list)):
                        sub['jyotish']['%s/%s' % (cont, k2)] = v2
        entries.append({'key': key, 'value': value, 'chart': ci, 'base': bkey, 'fields': fields,
                        'frontendOnly': key in FRONTEND_ONLY,
                        'alt': {p: _alt_payload(_get(jb, p), _get(ja, p)) for p in paths}})
    # 前端独有键要在基准盘上带上它读的那棵树(Chara 中运)。
    for e in entries:
        if e['frontendOnly']:
            sub = bases[e['base']]
            jb = _slim(base_cache[e['base']].get('jyotish') or {})
            sub['jyotish'].setdefault('extendedDashas/chara', _get(jb, 'extendedDashas/chara'))
    return {'_doc': '由 astropy/tests/test_india_variant_mount_contract.py 生成,勿手改',
            'frontendOnly': FRONTEND_ONLY, 'bases': bases, 'entries': entries}


def _dump(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'


def test_fixture_covers_every_non_default_value():
    fx = json.loads(FIXTURE.read_text(encoding='utf-8'))
    want = {(k, v) for k, v, _e, _f in _switches()}
    have = {(e['key'], e['value']) for e in fx['entries']}
    assert have == want


def test_every_engine_variant_changes_the_response():
    fx = json.loads(FIXTURE.read_text(encoding='utf-8'))
    for e in fx['entries']:
        if e['frontendOnly']:
            assert e['key'] in FRONTEND_ONLY
            continue
        assert e['alt'], '%s=%s 回包零变化' % (e['key'], e['value'])


def _platform_tail_mismatches(fresh, fixture, path=''):
    """horosa_win_float_tail_v1(Windows 侧移植适配):夹具在 macOS 上生成,Windows 的 libm / 星历浮点运算尾数与之差 1e-12 级
    (本机实测 916 处:浮点相对差最大 1.6e-12、ISO 时刻最大差 21µs,结构 / 键 / 字符串零差)。逐叶比:结构、键、字符串、整数、
    布尔一律全等;只有浮点允许相对 1e-9 以内、ISO 时刻允许 1ms 以内的平台尾差。返回不满足的叶路径。"""
    from datetime import datetime
    if isinstance(fresh, dict) and isinstance(fixture, dict):
        if set(fresh) != set(fixture):
            return [path + '{keys}']
        return [m for k in sorted(fresh) for m in _platform_tail_mismatches(fresh[k], fixture[k], '%s/%s' % (path, k))]
    if isinstance(fresh, list) and isinstance(fixture, list):
        if len(fresh) != len(fixture):
            return [path + '[len]']
        return [m for i, (u, v) in enumerate(zip(fresh, fixture)) for m in _platform_tail_mismatches(u, v, '%s[%d]' % (path, i))]
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)  # noqa: E731
    if num(fresh) and num(fixture) and (isinstance(fresh, float) or isinstance(fixture, float)):
        return [] if abs(fresh - fixture) <= 1e-9 * max(abs(fresh), abs(fixture), 1.0) else [path]
    if isinstance(fresh, str) and isinstance(fixture, str) and fresh != fixture:
        try:
            if abs((datetime.fromisoformat(fresh) - datetime.fromisoformat(fixture)).total_seconds()) < 1e-3:
                return []
        except ValueError:
            pass
        return [path]
    return [] if (type(fresh) is type(fixture) and fresh == fixture) else [path]


def test_fixture_is_the_service_output():
    """夹具 = 现行引擎输出(按记录的样例盘重算逐位比)。引擎口径变了 → 重生成夹具,前端合同随之重判。"""
    fresh = build_contract(search=False)
    # horosa_win_float_tail_v1:macOS(夹具生成平台)逐字节照比;其它平台逐叶比,只放过浮点 / 时刻的平台尾差(见上)。
    if sys.platform == 'darwin':
        assert _dump(fresh) == FIXTURE.read_text(encoding='utf-8')
    else:
        bad = _platform_tail_mismatches(json.loads(_dump(fresh)), json.loads(FIXTURE.read_text(encoding='utf-8')))
        assert bad == [], '夹具与现行引擎输出不同(超出平台浮点尾差):%s' % bad[:20]


def test_frontend_only_keys_really_do_not_reach_the_engine():
    """登记为前端独有的键,引擎回包必须与它无关(否则应从 FRONTEND_ONLY 移出,按引擎键判)。"""
    from astrostudy.india.dasha_variants import VARIANT_SPECS
    for key in FRONTEND_ONLY:
        for value in VARIANT_SPECS[key]['values'][1:]:
            assert _chart(_request(0, key)) == _chart(_request(0, key, {'dashaVariants': json.dumps({key: value})})), key


if __name__ == '__main__':
    if '--write' in sys.argv:
        FIXTURE.write_text(_dump(build_contract(search=True)), encoding='utf-8')
        print('wrote', FIXTURE)
