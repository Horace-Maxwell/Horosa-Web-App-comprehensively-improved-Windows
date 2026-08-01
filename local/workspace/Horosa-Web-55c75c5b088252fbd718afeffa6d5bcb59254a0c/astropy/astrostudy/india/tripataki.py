# -*- coding: utf-8 -*-
"""Tri-pataki Chakra(三旗盘)引擎(权威 §11.11)。

权威明写:「算法上等价于『逐月过运 + Vedha 标注』,实现可作图层」——
故判定 100% 委托 gochara(transit_from_reference + apply_vedha),零新数表、
吉凶与 Vedha 一字节不新写,自动继承节点代理(罗睺→土星表/计都→火星表)与
日↔土、月↔水例外。

两处权威未定,如实标注(歧义台账 A14/A15):
  · 月界:'equal12'(默认,年盘时刻起每 1/12 回归年一采)/'solar_ingress'(预留);
  · 三旗几何:权威只给「三面旗」意象未给格位 → 取权威自有的 Kendradi 三分
    (角 1/4/7/10 · 续 2/5/8/11 · 果 3/6/9/12),layoutSource 标 horosa_derived_kendradi,
    **仅呈现分组,不参与任何判定**。

双中心(年盘月亮/土星)一次算完:12 次建盘与中心无关,判定纯函数跑 2 遍,
中心切换零请求。
"""
from __future__ import annotations

from astrostudy.india.gochara import (
    transit_from_reference, apply_vedha, GOCHARA_PLANETS)

MONTH_BASIS_DEFAULT = 'equal12'
LAYOUT_SOURCE = 'horosa_derived_kendradi'

# Kendradi 三旗分组(呈现层;文档自有的角/续/果三分,天然 3×4=12)
FLAG_GROUPS = (
    {'key': 'kendra', 'label': '角旗(1/4/7/10)', 'houses': (1, 4, 7, 10)},
    {'key': 'panapara', 'label': '续旗(2/5/8/11)', 'houses': (2, 5, 8, 11)},
    {'key': 'apoklima', 'label': '果旗(3/6/9/12)', 'houses': (3, 6, 9, 12)},
)


def month_rows(center_sign, transit_signs, month_index, month_label=None, vedha_blockers='all'):
    """单月单中心:委托 gochara 得逐曜行(good/vedha/effective),并附旗组。
    vedha_blockers 同 compute_gochara(罗计是否作遮蔽者;默认 all=零回归)。"""
    rows = transit_from_reference(center_sign, transit_signs, 'tripataki')
    from astrostudy.india.gochara import RAHU, KETU
    _vbf = None if vedha_blockers != 'exclude_nodes' else (lambda p: p not in (RAHU, KETU))
    apply_vedha(rows, center_sign, transit_signs, blocker_filter=_vbf)
    for row in rows:
        h = row.get('house')
        row['flagGroup'] = next(
            (g['key'] for g in FLAG_GROUPS if h in g['houses']), None)
        # 半旗语义:吉位但被 Vedha 遮 → blocked(旗面减半 + ⊘,呈现层用)
        row['blocked'] = bool(row.get('good')) and not row.get('effective')
    good_eff = sum(1 for r in rows if r.get('effective'))
    blocked = sum(1 for r in rows if r.get('blocked'))
    bad = sum(1 for r in rows if r.get('good') is False)
    return {
        'month': month_index, 'label': month_label,
        'rows': rows,
        'score': {'effectiveGood': good_eff, 'blocked': blocked, 'bad': bad,
                  'net': good_eff - bad},
    }


def build_tripataki(months, centers, month_basis=None, vedha_blockers='all'):
    """全年三旗盘(纯函数)。

    months : [{'index': 1..12, 'label': 'YYYY-MM-DD', 'signs': {planet: rasi}}] × 12
             (12 次过运盘由服务层建好;signs 与中心无关,故只建一次)。
    centers: {'moon': rasi|None, 'saturn': rasi|None}(年盘月亮/土星所在座)。

    返回 byCenter 两份 + 顶层 goodHousesByPlanet(抽到顶层,免 12×9×2 重复,
    体积 ~60KB → ~26KB)。
    """
    from astrostudy.india.gochara import good_houses_for
    by_center = {}
    for key, center_sign in (centers or {}).items():
        if not center_sign:
            by_center[key] = {'available': False, 'reason': 'missing_center_sign'}
            continue
        rows = [month_rows(center_sign, m.get('signs') or {}, m.get('index'), m.get('label'),
                           vedha_blockers=vedha_blockers)
                for m in (months or [])]
        by_center[key] = {
            'available': True, 'centerSign': center_sign,
            'months': rows,
        }
    # goodHousesByPlanet 顶层一份(各行不再重复携带)
    ghbp = {p: good_houses_for(p) for p in GOCHARA_PLANETS}
    for center in by_center.values():
        for m in center.get('months') or []:
            for r in m['rows']:
                r.pop('goodHouses', None)
    return {
        'available': True,
        'monthBasis': month_basis or MONTH_BASIS_DEFAULT,
        'monthBasisNote': '月界权威未定义:equal12=年盘时刻起每 1/12 回归年一采(默认);solar_ingress 预留',
        'layoutSource': LAYOUT_SOURCE,
        'layoutNote': '三旗格位权威未给,取权威自有 Kendradi 三分(仅呈现分组,不参与判定)',
        'flagGroups': [dict(g, houses=list(g['houses'])) for g in FLAG_GROUPS],
        'goodHousesByPlanet': ghbp,
        'byCenter': by_center,
    }
