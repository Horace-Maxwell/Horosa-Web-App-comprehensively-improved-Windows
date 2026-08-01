# -*- coding: utf-8 -*-
"""出生时间校正(Rectification)判据层(权威 §17 全部)。

本模块只装**纯函数判据与评分**,零星历调用、零盘构建 —— 扫描器(候选时刻精算 +
分层缓存)在服务层(webindiasrv /india/rectify),此处的每个函数对给定输入确定性
可测。五个判据全对权威,不对实现:

  ① Ishta Kaal(§17.3-1):出生 − 日出,化 Ghati/Pala。
  ② Pranapada 判据(§17.3-2):PP 距 Lagna/Moon 落 1/2/4/5/7/9/10/11 吉、6/8/12 疑;
     🔴 第 3 宫权威**未列**(歧义 A9)→ 判 neutral 得 0 分,UI 明示,不得擅自归吉/归疑。
  ③ RP 命中(§17.3-4):候选时刻 Lagna 子主(及星主/座主)∈ RP 集。
     🔴 歧义 A8:RP 与候选同刻取会使「Lagna 座主/星主 ∈ RP」恒真 → rpSource 三值:
     anchor(默认,RP 取自原始钟表时刻,无自指)/ candidate(字面读法,自动把候选
     自身的座/星/子主移出比较集并标 rpSelfExcluded)/ custom。
  ④ 事件回推(§17.3-5):事件日 Dasha 主星所司/所占宫 × 事项宫组(§12.5)重合计分。
  ⑤ 边界预警(§17.5):复用 sensitive_points 的 Gandanta/Sandhi。

步长充分性(§17.2 工程化):KP 最窄 Sub 段 = 13°20′×6/120 = 0°40′;「每 4 分钟 1°」
是中纬平均,快升座/高纬可到 3°/min → 诊断输出必须给 maxLagnaDeltaDeg 与
suggestedStepSeconds,不足时前端红字提示。
"""
from __future__ import annotations

# ── ① Ishta Kaal ─────────────────────────────────────────────────────────
GHATI_MIN = 24.0          # 1 Ghati = 24 分;1 日 = 60 Ghati;1 Ghati = 60 Pala


def ishta_kaal(minutes_since_sunrise):
    """出生时刻 − 当日日出(分)→ {ghati, pala, totalMinutes}。负值=日出前(前一 Vara 日界)。"""
    m = float(minutes_since_sunrise)
    total_ghati = m / GHATI_MIN
    ghati = int(total_ghati)
    pala = (total_ghati - ghati) * 60.0
    return {'totalMinutes': m, 'ghati': ghati, 'pala': round(pala, 2),
            'beforeSunrise': m < 0}


# ── ② Pranapada 判据 ─────────────────────────────────────────────────────
PP_GOOD_HOUSES = (1, 2, 4, 5, 7, 9, 10, 11)
PP_SUSPECT_HOUSES = (6, 8, 12)
# 🔴 8 + 3 = 11 宫;第 3 宫权威未列(歧义 A9)→ neutral,0 分。


def _house_between(from_lon, to_lon):
    """to 相对 from 的整宫序(1..12,whole-sign 宫距)。"""
    fs = int((float(from_lon) % 360.0) // 30.0)
    ts = int((float(to_lon) % 360.0) // 30.0)
    return ((ts - fs) % 12) + 1


def pranapada_verdict(pp_lon, lagna_lon, moon_lon):
    """PP 距 Lagna 与距 Moon 的宫位判据。综合:两者取更差(疑 > 中 > 吉),保守口径。"""
    def _one(ref_lon, ref_key):
        if ref_lon is None:
            return {'ref': ref_key, 'house': None, 'verdict': 'unknown'}
        h = _house_between(ref_lon, pp_lon)
        if h in PP_GOOD_HOUSES:
            v = 'good'
        elif h in PP_SUSPECT_HOUSES:
            v = 'suspect'
        else:
            v = 'neutral'          # 恰第 3 宫:权威未列,不得擅自归吉/归疑
        return {'ref': ref_key, 'house': h, 'verdict': v}

    from_lagna = _one(lagna_lon, 'lagna')
    from_moon = _one(moon_lon, 'moon')
    order = {'suspect': 0, 'neutral': 1, 'unknown': 1, 'good': 2}
    overall = min((from_lagna['verdict'], from_moon['verdict']), key=lambda v: order[v])
    score = {'good': 1.0, 'neutral': 0.0, 'unknown': 0.0, 'suspect': -1.0}[overall]
    return {'fromLagna': from_lagna, 'fromMoon': from_moon,
            'overall': overall, 'score': score,
            'neutralNote': '第 3 宫权威未列吉疑,判中性得 0 分' if 'neutral' in (
                from_lagna['verdict'], from_moon['verdict']) else None}


# ── ③ RP 命中 ────────────────────────────────────────────────────────────
RP_SOURCES = ('anchor', 'candidate', 'custom')


def rp_hit_score(candidate_lords, rp_set, rp_source='anchor'):
    """候选时刻 Lagna 三级主(座/星/子)对 RP 集的命中评分。

    candidate_lords: {'signLord', 'starLord', 'subLord'}(候选时刻 Lagna 的三级主)。
    rp_set: RP 行星名列表(anchor/custom 模式:调用方给定;candidate 模式:给定的是
            候选同刻 RP 全集,本函数**自动移除候选自身三级主的自指项**再比)。
    权重:子主命中最重(KP 校时的靶心),星主次之,座主最轻。
    """
    src = rp_source if rp_source in RP_SOURCES else 'anchor'
    rp = [x for x in (rp_set or []) if x]
    self_excluded = []
    if src == 'candidate':
        # 字面读法自指消解:候选自身的座/星/子主若在 RP 集,移出后再比(否则判据恒真零区分度)
        selfset = {candidate_lords.get('signLord'), candidate_lords.get('starLord'),
                   candidate_lords.get('subLord')}
        self_excluded = [x for x in rp if x in selfset]
        rp = [x for x in rp if x not in selfset]
    hits = {}
    score = 0.0
    for key, weight in (('subLord', 3.0), ('starLord', 2.0), ('signLord', 1.0)):
        lord = candidate_lords.get(key)
        hit = bool(lord and lord in rp)
        hits[key] = {'lord': lord, 'hit': hit, 'weight': weight}
        if hit:
            score += weight
    return {'rpSource': src, 'rpCompared': rp, 'rpSelfExcluded': self_excluded,
            'hits': hits, 'score': score, 'maxScore': 6.0}


# ── ④ 事件回推评分 ───────────────────────────────────────────────────────
# 事项宫组:逐字转录 §12.5(与 prashna 同表同源;A10:「亲丧」无对应宫组 → custom)。
EVENT_HOUSE_GROUPS = {
    'marriage': {'houses': (2, 7, 11), 'label': '婚姻'},
    'wealth': {'houses': (2, 6, 10, 11), 'label': '财务'},
    'children': {'houses': (2, 5, 11), 'label': '子女'},
    'career': {'houses': (2, 6, 10, 11), 'label': '事业'},
    'illness': {'houses': (6, 8, 12), 'label': '疾病'},
    'travel': {'houses': (3, 9, 12), 'label': '外出/移居'},
}


def event_score(event_kind, dasha_lord_houses, custom_houses=None):
    """单事件评分:运行期(Maha/Antar/Pratyantar)主星所司/所占宫 ∩ 事项宫组。

    event_kind       : EVENT_HOUSE_GROUPS 键;或 'custom'(须给 custom_houses;
                       权威无「亲丧」宫组 —— A10,custom 路径由用户自填并明示非权威)。
    dasha_lord_houses: {'maha': set(houses), 'antar': set(...), 'pratyantar': set(...)}
                       (各级主星在候选本命盘上所主+所占宫集;服务层算好喂入)。
    评分:Maha 命中 ×3、Antar ×2、Pratyantar ×1(层级越高权重越大 —— 应期主导序)。
    """
    if event_kind == 'custom':
        houses = set(int(h) for h in (custom_houses or []) if 1 <= int(h) <= 12)
        label = '自定义(非权威宫组)'
    else:
        grp = EVENT_HOUSE_GROUPS.get(event_kind)
        if not grp:
            return {'available': False, 'reason': 'unknown_event_kind'}
        houses = set(grp['houses'])
        label = grp['label']
    if not houses:
        return {'available': False, 'reason': 'empty_house_group'}
    detail = {}
    score = 0.0
    for level, weight in (('maha', 3.0), ('antar', 2.0), ('pratyantar', 1.0)):
        lord_houses = set(dasha_lord_houses.get(level) or ())
        overlap = sorted(houses & lord_houses)
        detail[level] = {'overlap': overlap, 'weight': weight}
        if overlap:
            score += weight
    return {'available': True, 'kind': event_kind, 'label': label,
            'houses': sorted(houses), 'levels': detail,
            'score': score, 'maxScore': 6.0}


# ── 步长充分性诊断(§17.2 工程化)─────────────────────────────────────────
KP_NARROWEST_SUB_DEG = (360.0 / 27.0) * 6.0 / 120.0     # 13°20′ × 6/120 = 0°40′


def resolution_diagnostics(lagna_lons, step_seconds):
    """候选序列的 Lagna 步进诊断:最窄 Sub(0°40′)必须 ≥ 单步最大 Lagna 位移,
    否则整段子主会被跳过(KP 校时的靶就是子主区段)。"""
    deltas = []
    for i in range(1, len(lagna_lons)):
        a, b = lagna_lons[i - 1], lagna_lons[i]
        if a is None or b is None:
            continue
        deltas.append(abs((float(b) - float(a) + 180.0) % 360.0 - 180.0))
    max_delta = max(deltas) if deltas else 0.0
    adequate = max_delta <= KP_NARROWEST_SUB_DEG
    suggested = step_seconds
    if not adequate and max_delta > 0:
        suggested = max(1, int(float(step_seconds) * KP_NARROWEST_SUB_DEG / max_delta))
    return {'maxLagnaDeltaDeg': round(max_delta, 4),
            'narrowestSubDeg': round(KP_NARROWEST_SUB_DEG, 4),
            'adequate': adequate,
            'stepSeconds': int(step_seconds),
            'suggestedStepSeconds': int(suggested)}


def merge_runs(samples, key):
    """连续同值合并成时段:[{...key...}] → [{'value', 'fromIndex', 'toIndex', 'count'}]。
    §17.3-4 真正要的是**子主区段**而非孤立采样点(runs.lagnaSubLord 由此而来)。"""
    runs = []
    for i, s in enumerate(samples):
        v = s.get(key)
        if runs and runs[-1]['value'] == v:
            runs[-1]['toIndex'] = i
            runs[-1]['count'] += 1
        else:
            runs.append({'value': v, 'fromIndex': i, 'toIndex': i, 'count': 1})
    return runs


def combine_scores(pp_score, rp_score, event_scores, weights=None):
    """总分合成(线性加权;权重可调,默认 RP 与事件并重、PP 辅助)。
    只排序不判真伪 —— 校时器是「半自动」:输出证据与排序,采信权在用户。"""
    w = dict({'pranapada': 1.0, 'rp': 2.0, 'events': 2.0}, **(weights or {}))
    ev_total = sum(e.get('score', 0.0) for e in (event_scores or []) if e.get('available'))
    total = (w['pranapada'] * float(pp_score)
             + w['rp'] * float(rp_score)
             + w['events'] * ev_total)
    return {'total': round(total, 3), 'weights': w,
            'parts': {'pranapada': float(pp_score), 'rp': float(rp_score),
                      'events': round(ev_total, 3)}}
