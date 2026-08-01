# -*- coding: utf-8 -*-
"""Sarvatobhadra Chakra(SBC,全吉盘)引擎(权威 §24.1)。

方阵尺寸系**算术推论**而非查表:N×N 方阵四隅留空时,边框非角格数 = 4(N−2);
权威定边框排 28 宿 ⇒ 4(N−2)=28 ⇒ N=9。9×9、四隅空、每边 7 宿是唯一解
(payload 标 derivation='arithmetic_4x7',以示非臆造)。

环坐标参数化(顺时针,起于上边最左非角格):
  i∈0..27,side=i//7,k=i%7 →
  上 (0,k+1) / 右 (k+1,8) / 下 (8,7−k) / 左 (7−k,0)。

Vedha = 五个反射算子(闭式纯几何,权威只名「对冲/上下/斜」,五算子全实现可裁,
默认全开 —— 歧义台账 A12):
  sammukha 对冲 (r,c)→(8−r,8−c) ⟹ 环 i→(i+14)%28
  vertical 上下 (r,c)→(8−r,c)
  horizontal 左右 (r,c)→(r,8−c)
  konaMain 斜   (r,c)→(c,r)
  konaAnti 斜   (r,c)→(8−c,8−r)
五算子皆为**对合**(op∘op=恒等)—— 最强可测不变量,测试锁死。

🔴 数据留空即降级(绝不臆造):
  ① SBC_RING_ANCHOR_NAK28:经典「哪一宿锚在哪个环位」+ 绕向 —— 权威未给。
     空 ⇒ layout.source='placeholder_sequential'(环按 1..28 占位)且
     vedhaEnabled=False、vedhaGraph/hits **全空**——绝不输出假 Vedha。
  ② SBC_INNER_GRID:内区 7×7(梵文元音辅音/12座/7Vara/Tithi)—— 权威未给格位。
     空 ⇒ 内区只画网格不填字。
  ③ 姓名宿音节表 —— 不建假表;等效能力由「手选宿」覆盖。
"""
from __future__ import annotations

from flatlib import const

from astrostudy.india.nakshatra_data import NAKSHATRA_DATA, ABHIJIT_ENTRY

N = 9                       # 4(N−2)=28 ⇒ N=9(算术推论)
DERIVATION = 'arithmetic_4x7'

# ── 28 宿名单:27 主表 + Abhijit 依 §4.3 插于第 22 位(仅此名单,主表零改动) ──
def nak28_list():
    """[{'index28', 'sanskrit', 'labelCn'}] × 28,Abhijit 在 22 位。"""
    out = []
    n28 = 1
    for row in NAKSHATRA_DATA:
        if n28 == 22:
            out.append({'index28': 22, 'sanskrit': ABHIJIT_ENTRY['sanskrit'],
                        'labelCn': ABHIJIT_ENTRY['labelCn'], 'isAbhijit': True})
            n28 += 1
        out.append({'index28': n28, 'sanskrit': row['sanskrit'],
                    'labelCn': row['labelCn'], 'isAbhijit': False,
                    'index27': row['index']})
        n28 += 1
    assert len(out) == 28
    return out


# ── 环几何 ────────────────────────────────────────────────────────────────
def ring_cell(i):
    """环序 i(0..27,顺时针,起上边最左非角格)→ (row, col)。"""
    i = int(i) % 28
    side, k = divmod(i, 7)
    if side == 0:
        return (0, k + 1)
    if side == 1:
        return (k + 1, 8)
    if side == 2:
        return (8, 7 - k)
    return (7 - k, 0)


_CELL_TO_RING = {ring_cell(i): i for i in range(28)}


def ring_index(cell):
    """(row, col) → 环序;非环格返回 None。"""
    return _CELL_TO_RING.get(tuple(cell))


# ── 五个 Vedha 反射算子(格坐标域) ────────────────────────────────────────
def op_sammukha(cell):
    r, c = cell
    return (8 - r, 8 - c)


def op_vertical(cell):
    r, c = cell
    return (8 - r, c)


def op_horizontal(cell):
    r, c = cell
    return (r, 8 - c)


def op_kona_main(cell):
    r, c = cell
    return (c, r)


def op_kona_anti(cell):
    r, c = cell
    return (8 - c, 8 - r)


VEDHA_OPS = (
    ('sammukha', op_sammukha, '对冲'),
    ('vertical', op_vertical, '上下'),
    ('horizontal', op_horizontal, '左右'),
    ('konaMain', op_kona_main, '斜(主对角)'),
    ('konaAnti', op_kona_anti, '斜(反对角)'),
)


def vedha_ring_targets(i, ops=None):
    """环位 i 的 Vedha 伙伴环位(五算子像去重、剔除自身;恒 ≤5)。"""
    cell = ring_cell(i)
    targets = []
    for key, op, _label in VEDHA_OPS:
        if ops is not None and key not in ops:
            continue
        t = ring_index(op(cell))
        if t is not None and t != (int(i) % 28) and t not in [x[1] for x in targets]:
            targets.append((key, t))
    return targets


# ── 🔴 待录入常量(留空即降级,录入格式已注明,单点录入即生效) ─────────────
# 环起点锚:{'nak28': int 1..28, 'ringIndex': int 0..27, 'direction': 'cw'|'ccw'}
# 含义:28 宿口径第 nak28 宿钉在环位 ringIndex,按 direction 绕排其余 27 宿。
# 须录自经典 SBC 原图(如 Muhurta 典籍图版),录入后 vedhaEnabled 自动变 True。
SBC_RING_ANCHOR_NAK28 = None

# 内区 7×7:[[cell,…]×7]×7,cell = {'type': 'vowel'|'consonant'|'sign'|'vara'|'tithi',
# 'value': str} 或 None。须录自经典 SBC 原图;空 ⇒ 内区只画网格。
SBC_INNER_GRID = None


# ── 组装 ─────────────────────────────────────────────────────────────────
# 凶星集:权威未定义(歧义 A13)→ 引用仓内三处一致的 NATURAL_MALEFICS 口径。
def default_malefics():
    from astrostudy.india.yoga_engine import NATURAL_MALEFICS
    return set(NATURAL_MALEFICS)


def _nak28_at_ring(anchor):
    """按锚排 28 宿到环位:{ringIndex: nak28_index}。锚空返回 None。"""
    if not anchor:
        return None
    base_ring = int(anchor['ringIndex']) % 28
    base_nak = int(anchor['nak28'])                     # 1..28
    step = 1 if anchor.get('direction', 'cw') == 'cw' else -1
    out = {}
    for d in range(28):
        ring_i = (base_ring + d * step) % 28
        nak_i = ((base_nak - 1 + d) % 28) + 1
        out[ring_i] = nak_i
    return out


def compute_sbc(natal_refs=None, transit_nak28=None, malefics=None, ops=None):
    """SBC 组包(纯函数,输入均为已换算好的 28 宿口径序号)。

    natal_refs   : {'moon': n28, 'lagna': n28, 'custom': n28|None}(可缺)。
    transit_nak28: {planet_id: n28}(过运各曜所落 28 宿;可缺 → 无叠加层)。
    malefics     : 凶星集(缺省 NATURAL_MALEFICS 口径)。
    ops          : 启用的算子 key 集(缺省全开 —— 歧义 A12 默认)。

    锚空(当前状态)⇒ 占位布局 + vedhaEnabled=False + vedha 图/命中**全空**。
    """
    naks = nak28_list()
    anchor = SBC_RING_ANCHOR_NAK28
    placement = _nak28_at_ring(anchor)
    classical = placement is not None
    layout_rows = []
    for i in range(28):
        cell = ring_cell(i)
        nak_i = placement[i] if classical else (i + 1)     # 占位:环序即宿序
        nk = naks[nak_i - 1]
        layout_rows.append({
            'ringIndex': i, 'row': cell[0], 'col': cell[1],
            'nak28': nak_i, 'sanskrit': nk['sanskrit'], 'labelCn': nk['labelCn'],
            'isAbhijit': nk.get('isAbhijit', False),
        })

    result = {
        'available': True,
        'grid': {'n': N, 'derivation': DERIVATION, 'cornersEmpty': True},
        'layout': {
            'source': 'classical' if classical else 'placeholder_sequential',
            'rows': layout_rows,
            'note': None if classical else '环序占位(1..28 顺排)·非经典格位;经典锚待录入,Vedha 判定按纪律禁用',
        },
        'innerGrid': SBC_INNER_GRID,
        'vedhaEnabled': classical,
        'vedhaGraph': [],
        'natalRefs': natal_refs or {},
        # 过运曜落宿(28 宿口径)恒输出 —— 占位环序下宿序即环序,前端照落格标注;
        # 此前仅经典锚分支消费 transit_nak28,占位模式过运层被整体丢弃(中栏空盘根因)。
        'transits': [{'planet': pid, 'nak28': int(n)}
                     for pid, n in (transit_nak28 or {}).items() if n],
        'hits': [],
    }
    if not classical:
        return result

    # 经典锚在位时才产 Vedha 图与命中(本分支现不可达,录锚后自动生效)。
    nak_ring = {row['nak28']: row['ringIndex'] for row in layout_rows}
    graph = []
    for row in layout_rows:
        targets = vedha_ring_targets(row['ringIndex'], ops=ops)
        graph.append({
            'nak28': row['nak28'],
            'targets': [{'op': key, 'nak28': layout_rows[t]['nak28']} for key, t in targets],
        })
    result['vedhaGraph'] = graph
    mal = malefics if malefics is not None else default_malefics()
    hits = []
    for ref_key, ref_nak in (natal_refs or {}).items():
        if not ref_nak:
            continue
        ref_ring = nak_ring.get(int(ref_nak))
        if ref_ring is None:
            continue
        target_rings = {t for _k, t in vedha_ring_targets(ref_ring, ops=ops)}
        for planet, t_nak in (transit_nak28 or {}).items():
            if planet not in mal or not t_nak:
                continue
            if nak_ring.get(int(t_nak)) in target_rings:
                hits.append({'ref': ref_key, 'refNak28': int(ref_nak),
                             'planet': planet, 'transitNak28': int(t_nak)})
    result['hits'] = hits
    return result
