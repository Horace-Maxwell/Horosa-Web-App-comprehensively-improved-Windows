"""合盘评分(由 astroextra.py 整段搬出,astrostudy.astroextra 照旧可取这些名字)。"""
from astrostudy.astroextra_parts.common import safe_float


# ── 关系量化：天体权重分档（占星通用口径，非门派）─────────────────────────────
# 相位两端天体各带权重，其积＝该相位的天体系数：七星与关系轴角主导、婚神次之、
# 其余小行星/虚点大幅压低，避免小天体虚高稀释主星信号。键＝flatlib obj.id 精确字面量。
RELATIVE_ASPECT_WEIGHT = {0: 6, 60: 3, 90: -4, 120: 4, 180: -5}
RELATIVE_BODY_WEIGHT_DEFAULT = 0.1
RELATIVE_BODY_WEIGHT = {
    # 七星（个人/社会主星）
    'Sun': 1.0, 'Moon': 1.0, 'Mercury': 1.0, 'Venus': 1.0, 'Mars': 1.0, 'Jupiter': 1.0, 'Saturn': 1.0,
    # 四轴（关系轴/事业轴，合盘中与主星同重）
    'Asc': 1.0, 'Desc': 1.0, 'MC': 1.0, 'IC': 1.0,
    # 三王（世代星，合盘仍具张力）
    'Uranus': 0.6, 'Neptune': 0.6, 'Pluto': 0.6,
    # 婚神（婚姻小行星，关系专属）
    'Juno': 0.5,
    # 交点（业力关系轴）
    'North Node': 0.4, 'South Node': 0.4,
    # 其余小行星 + 凯龙
    'Ceres': 0.2, 'Pallas': 0.2, 'Vesta': 0.2, 'Pholus': 0.2, 'Chiron': 0.2,
    # 杂点（朔望/福点/暗月/紫气/月亮远近地点）——未列天体亦落默认 0.1
    'Dark Moon': 0.1, 'Purple Clouds': 0.1, 'Syzygy': 0.1, 'Pars Fortuna': 0.1,
    'Intp_Apog': 0.1, 'Intp_Perg': 0.1,
}


def score_relative_comp(comp, body_weight=None):
    """由 ChartComp 结果算关系量化分：impact = 相位类型权 × 两端天体权之积 × 容许度衰减；
    基础分 50、结果 clamp[0,100]。纯函数（喂合成 comp 即可测），不触星历。"""
    if body_weight is None:
        body_weight = RELATIVE_BODY_WEIGHT

    def bw(name):
        return body_weight.get(name, RELATIVE_BODY_WEIGHT_DEFAULT)

    score = 50
    highlights = []
    challenges = []
    flat = []
    for group_key in ('outToInAsp', 'inToOutAsp'):
        for row in (comp.get(group_key) or []):
            key = row.get('id')
            for asp in row.get('objects', []):
                deg = int(asp.get('aspect', -999))
                weight = RELATIVE_ASPECT_WEIGHT.get(deg, 0)
                bId = asp.get('id') or asp.get('idB') or asp.get('obj') or ''
                orb = safe_float(asp.get('orb', asp.get('delta', 0)), 0)
                body_mult = bw(key) * bw(bId)
                impact = weight * body_mult * max(0.2, 1.0 - min(orb, 8) / 8.0)
                score += impact
                item = {
                    'a': key,
                    'b': bId,
                    'aspect': deg,
                    'orb': orb,
                    'impact': impact,
                    'direction': group_key,
                }
                flat.append(item)
                if impact > 0:
                    highlights.append(item)
                elif impact < 0:
                    challenges.append(item)
    return {
        'score': max(0, min(100, round(score, 1))),
        'aspects': sorted(flat, key=lambda item: abs(item['impact']), reverse=True)[:80],
        'highlights': sorted(highlights, key=lambda item: item['impact'], reverse=True)[:20],
        'challenges': sorted(challenges, key=lambda item: item['impact'])[:20],
    }


def build_relative_score(data):
    from astrostudy.modern.chartcomp import ChartComp
    params = dict(data or {})
    params['relative'] = 0
    inner = dict(params.get('inner') or {})
    outer = dict(params.get('outer') or {})
    hsys = params.get('hsys', 0)
    zodiacal = params.get('zodiacal', 0)
    for item in (inner, outer):
        item['tradition'] = False
        item['predictive'] = False
        item['hsys'] = hsys
        item['zodiacal'] = zodiacal
    comp = ChartComp(inner, outer).compute()
    result = score_relative_comp(comp)
    result['raw'] = comp
    return result
