# -*- coding: utf-8 -*-
"""天星择日·判读条件纯几何核(R3)。

本模块只放**吃裸 dict 快照、零 ScanContext**的判定核(照 election_scan._besieged_core 分层
范式)——每个核可被扫描叶与对拍测试(真 PerChart 抽同盘快照)双路喂料,是单源一致性的
执行面。ctx 接线/步长/参数校验在 election_scan_ext.py。

orb 口径(R3 决策表):判读页签移植核一律 `_chart_orb(a,b)=max(props.object.orb)`——与
astroextra._wheel_orb/相位页签同源;既有 feral 的 _MOIETY 均值口径冻结不动;
用户逐星 orb 覆盖扫描侧本期不支持。
"""

from flatlib import props as _fprops

SEVEN = ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')

_PTOL = (0, 60, 90, 120, 180)


def _norm360(x):
    return x % 360.0 if x % 360.0 >= 0 else x % 360.0 + 360.0


def _wrap180(x):
    return ((x + 180.0) % 360.0) - 180.0


def _dist(a, b):
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)


def _chart_orb(a, b):
    """判读页签 orb 单源:flatlib props 静态表双向取大(金8/交点12 特征)。"""
    return max(_fprops.object.orb.get(a, 5.0), _fprops.object.orb.get(b, 5.0))


# ---------------------------------------------------------------------------
# light_dynamics:光线连接八学说(传光/聚光/阻止/挫败/收回/空亡/不合意/交点弯曲)。
# 单源=astroextra.compute_aspect_dynamics(:743-909,相位·格局页签)判据逐字重建于裸快照;
# tab 对拍测试以真 PerChart 双路喂料断言九键集合恒等。orb=_chart_orb(props 表)。
# ---------------------------------------------------------------------------

def _light_dynamics_core(bodies, node_lon=None, void_classical=False, mean_speed=None):
    """bodies={id:{lon,lonspeed,sign_idx,signlon}}(七政;sign/signlon 已按黄道制归一)。
    返回 {'aspects','translation','collection','aversion','bending','void',
          'prohibition','frustration','refranation'}(与 astroextra 同构)。"""
    ids = [i for i in SEVEN if i in bodies]
    mean_speed = mean_speed or {}

    def lon(i):
        return bodies[i]['lon']

    def spd(i):
        return bodies[i].get('lonspeed', 0.0) or 0.0

    def applying(a, b, asp):
        now = abs(_dist(lon(a), lon(b)) - asp)
        nxt = abs(_dist(lon(a) + spd(a) * 0.02, lon(b) + spd(b) * 0.02) - asp)
        return nxt < now

    aspects = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            for asp in _PTOL:
                d = _dist(lon(a), lon(b))
                if abs(d - asp) <= _chart_orb(a, b):
                    off = (bodies[a]['sign_idx'] - bodies[b]['sign_idx']) % 12
                    hand = 'dexter' if off in (9, 10, 11, 8) else 'sinister'
                    aspects.append({'a': a, 'b': b, 'aspect': asp, 'orb': round(abs(d - asp), 2),
                                    'applying': applying(a, b, asp), 'hand': hand})
                    break

    speeds = {i: abs(spd(i)) for i in ids}

    translation = []
    for mover in ids:
        seps = [x for x in aspects if mover in (x['a'], x['b']) and not x['applying']]
        apps = [x for x in aspects if mover in (x['a'], x['b']) and x['applying']]
        for s in seps:
            other_s = s['b'] if s['a'] == mover else s['a']
            for ap in apps:
                other_a = ap['b'] if ap['a'] == mover else ap['a']
                if other_s != other_a and speeds.get(mover, 0) >= speeds.get(other_s, 0) \
                        and speeds.get(mover, 0) >= speeds.get(other_a, 0):
                    translation.append({'mover': mover, 'from': other_s, 'to': other_a})

    collection = []
    aspect_set = {(x['a'], x['b']) for x in aspects} | {(x['b'], x['a']) for x in aspects}
    for collector in ids:
        incoming = [x for x in aspects if collector in (x['a'], x['b']) and x['applying']]
        fasters = [(x['b'] if x['a'] == collector else x['a']) for x in incoming
                   if speeds.get(x['b'] if x['a'] == collector else x['a'], 0) > speeds.get(collector, 0)]
        for m in range(len(fasters)):
            for n in range(m + 1, len(fasters)):
                if (fasters[m], fasters[n]) not in aspect_set:
                    collection.append({'collector': collector, 'p1': fasters[m], 'p2': fasters[n]})

    aversion = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            off = (bodies[a]['sign_idx'] - bodies[b]['sign_idx']) % 12
            if off in (1, 5, 7, 11):
                aversion.append({'a': a, 'b': b})

    bending = []
    if node_lon is not None:
        for i in ids:
            for tgt, tag in ((node_lon + 90.0, '北弯'), (node_lon - 90.0, '南弯')):
                if _dist(lon(i), tgt % 360.0) <= 3.0:
                    bending.append({'planet': i, 'at': tag})

    applying_list = []
    for x in aspects:
        if not x['applying']:
            continue
        sa = speeds.get(x['a'], 0.0)
        sb = speeds.get(x['b'], 0.0)
        mover = x['a'] if sa >= sb else x['b']
        target = x['b'] if mover == x['a'] else x['a']
        applying_list.append({'mover': mover, 'target': target, 'aspect': x['aspect'], 'r': x['orb']})

    void = []
    void_id = 'Moon' if 'Moon' in bodies else (ids[0] if ids else None)
    if void_id is not None:
        signlon = bodies[void_id].get('signlon')
        if signlon is None:
            signlon = lon(void_id) % 30.0
        raw_speed = spd(void_id)
        if void_classical:
            window = 30.0
        else:
            window = (signlon if raw_speed < 0 else (30.0 - signlon))
        will_perfect = False
        for x in applying_list:
            if void_id not in (x['mover'], x['target']):
                continue
            if x['r'] <= window:
                will_perfect = True
                break
        if not will_perfect:
            void.append({'planet': void_id, 'window': round(window, 2),
                         'mode': 'classical' if void_classical else 'sign'})

    prohibition = []
    for ab in applying_list:
        a, b = ab['mover'], ab['target']
        for cb in applying_list:
            if cb['target'] != b or cb['mover'] == a:
                continue
            c = cb['mover']
            if cb['r'] < ab['r'] and speeds.get(c, 0.0) > speeds.get(a, 0.0):
                prohibition.append({'blocker': c, 'between': a, 'to': b,
                                    'rBlocker': round(cb['r'], 2), 'rOriginal': round(ab['r'], 2)})

    frustration = []
    for ab in applying_list:
        a, b = ab['mover'], ab['target']
        for bd in applying_list:
            if b not in (bd['mover'], bd['target']):
                continue
            d = bd['target'] if bd['mover'] == b else bd['mover']
            if d in (a, b):
                continue
            if bd['r'] < ab['r']:
                frustration.append({'frustrated': a, 'via': b, 'to': d,
                                    'rOriginal': round(ab['r'], 2), 'rDefect': round(bd['r'], 2)})

    refranation = []
    seen_refran = set()
    for ab in applying_list:
        a = ab['mover']
        if a in seen_refran:
            continue
        sp = spd(a)
        ms = mean_speed.get(a)
        tiny = (ms is not None and abs(ms) > 0 and abs(sp) < abs(ms) * 0.04) or abs(sp) < 0.0005
        if tiny:
            refranation.append({'planet': a, 'to': ab['target'], 'r': round(ab['r'], 2)})
            seen_refran.add(a)

    return {'aspects': aspects, 'translation': translation, 'collection': collection,
            'aversion': aversion, 'bending': bending,
            'void': void, 'prohibition': prohibition,
            'frustration': frustration, 'refranation': refranation}


# ---------------------------------------------------------------------------
# royal_attendance:皇室伴寝·东升西没。单源=前端 astroPatternOverview.companionsOf
# (:141-145):西没=黄经在前(norm360(o−ref)∈(0,180) 取最近);东升=黄经在后。
# 与 dignity_state 的 wrap180(lon−Sun)<0 口径数学同构(ref=Sun 时恒等,真相锚钉死)。
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# dispositor_cycle:主宰星链。单源=前端 utils/dispositorChain.computeDispositors 逐字
# (七政各落座庙主顺链;落自家座=终极主宰;互容成环去重)。
# ---------------------------------------------------------------------------

_DOMICILE_BY_SIGN = ('Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
                     'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter')


def _dispositors_core(sign_idx_by_planet):
    """sign_idx_by_planet={id:0..11}(七政);返回 {'step','chains','finals','loops'}。"""
    step = {}
    for pid in SEVEN:
        si = sign_idx_by_planet.get(pid)
        if si is not None:
            step[pid] = _DOMICILE_BY_SIGN[si % 12]
    chains = {}
    finals = set()
    loops = []
    for start in SEVEN:
        if start not in step:
            continue
        path = []
        seen = set()
        cur = start
        while cur is not None and cur in step:
            if cur in seen:
                loops.append(path[path.index(cur):])
                path.append(cur)
                break
            seen.add(cur)
            path.append(cur)
            nxt = step[cur]
            if nxt == cur:
                finals.add(cur)
                break
            cur = nxt
        chains[start] = path
    seen_loop = set()
    uniq = []
    for c in loops:
        key = '>'.join(sorted(c))
        if key not in seen_loop:
            seen_loop.add(key)
            uniq.append(c)
    return {'step': step, 'chains': chains, 'finals': finals, 'loops': uniq}


# ---------------------------------------------------------------------------
# pattern_overview:大势格局速览(龙脉/孤月/先验权力/八杀/强吉木/后天凶/有情无情)。
# 单源=前端 utils/astroPatternOverview.buildPatternOverview 判定核逐字;
# 联结对(互容/接纳/合相)由求值层经 flatlib dynamics 算好传入。
# ---------------------------------------------------------------------------

_MALEFIC_HOUSES = frozenset((6, 8, 12))
_JUP_WEAK_HOUSES = frozenset((3, 6, 8, 12))
_NON_MUNDANE = frozenset((8, 12))


def _classify_star(rules, fall):
    rs = [h for h in (rules or []) if h is not None]
    if not rs or fall is None:
        return None
    rules_eso = any(h in _NON_MUNDANE for h in rs)
    fall_eso = fall in _NON_MUNDANE
    if not rules_eso and not fall_eso:
        return 'T1'
    if rules_eso and fall_eso:
        return 'T2'
    if not rules_eso and fall_eso:
        return 'T3'
    return 'T4'


def _judge_realm_purity(parts):
    """成格局四象(有情/无情):前端 judgeRealmPurity 逐字。返回 dict 或 None(不可分型)。"""
    ps = [p for p in (parts or []) if p]
    if not ps:
        return None
    types = [_classify_star(p.get('rules'), p.get('fall')) for p in ps]
    if any(t is None for t in types):
        return None
    def all_t(t):
        return all(x == t for x in types)
    swap = (len(ps) == 2 and ps[0].get('fall') is not None and ps[1].get('fall') is not None
            and ps[1]['fall'] in (ps[0].get('rules') or [])
            and ps[0]['fall'] in (ps[1].get('rules') or []))
    if swap:
        if all_t('T1'):
            return {'pure': True, 'realm': 'mundane_pure', 'swap': True}
        if all_t('T2'):
            return {'pure': True, 'realm': 'eso_pure', 'swap': True}
        return {'pure': True, 'realm': 'eso_mundane', 'swap': True}
    if all_t('T1'):
        return {'pure': True, 'realm': 'mundane_pure', 'swap': False}
    if all_t('T2'):
        return {'pure': True, 'realm': 'eso_pure', 'swap': False}
    if all_t('T3'):
        return {'pure': True, 'realm': 'eso_mundane', 'swap': False}
    return {'pure': False, 'realm': 'insentient', 'swap': False}


def _pattern_overview_core(bodies, node_lon, is_day, linked_pairs, link_records, loops):
    """bodies={id:{lon,house,rule_houses,above}}(七政);linked_pairs=frozenset 对集合(2:5 龙截用);
    link_records=[(a,b)](互容/接纳对,先验权力与有情无情用);loops=主宰环列表。
    返回速览 dict(dragon/lone_moon/apriori/jupiter/afflicted/sentients)。"""
    ids = [i for i in SEVEN if i in bodies]

    # 龙脉:北交黄经为轴分半盘统计七政
    dragon = {'has': False}
    if node_lon is not None and len(ids) == 7:
        side_a = []
        side_b = []
        for pid in ids:
            (side_a if _norm360(bodies[pid]['lon'] - node_lon) < 180.0 else side_b).append(pid)
        small = side_a if len(side_a) <= len(side_b) else side_b
        if len(small) == 0:
            dragon = {'has': True, 'kind': 'embrace'}
        elif len(small) == 1:
            dragon = {'has': True, 'kind': 'intercept', 'lone': small[0]}
        elif len(small) == 2 and frozenset(small) in linked_pairs:
            dragon = {'has': True, 'kind': 'intercept', 'pair': list(small)}
    # 孤月独明:夜生且七政唯月在地平上
    if is_day:
        lone_moon = False
    else:
        above = [pid for pid in ids if bodies[pid].get('above')]
        lone_moon = len(above) == 1 and above[0] == 'Moon'

    # 先验权力:两星分立成对(落或主宰)8&12 或 8&1,经互容/接纳/主宰环联结
    def in_or_rules(pid, h):
        if bodies[pid].get('house') == h:
            return True
        return h in (bodies[pid].get('rule_houses') or [])

    def apriori_link(a, b):
        if (in_or_rules(a, 8) and in_or_rules(b, 12)) or (in_or_rules(a, 12) and in_or_rules(b, 8)):
            return '8_12'
        if (in_or_rules(a, 8) and in_or_rules(b, 1)) or (in_or_rules(a, 1) and in_or_rules(b, 8)):
            return '8_1'
        return None

    apriori = {'has': False, 'links': []}
    pairs_seen = list(link_records)
    for lp in loops:
        for x in range(len(lp)):
            for y in range(x + 1, len(lp)):
                pairs_seen.append((lp[x], lp[y]))
    for a, b in pairs_seen:
        w = apriori_link(a, b)
        if w:
            apriori['has'] = True
            apriori['links'].append({'a': a, 'b': b, 'which': w})

    # 强吉木星:不主 {3,6,8,12}(例外恰主{6,9})+照耀数(moiety 均值相位计数,normalAsp 同源口径)
    jupiter = {'present': False}
    if 'Jupiter' in bodies:
        rh = bodies['Jupiter'].get('rule_houses') or []
        rh_set = set(rh)
        is69 = rh_set == {6, 9}
        strong = (not any(h in _JUP_WEAK_HOUSES for h in rh)) or is69
        lit = bodies['Jupiter'].get('lit') or []
        jupiter = {'present': True, 'strong': strong, 'lit': lit, 'litCount': len(lit)}

    afflicted = [pid for pid in ids
                 if any(h in _MALEFIC_HOUSES for h in (bodies[pid].get('rule_houses') or []))]

    # 有情无情:每条联结对的 realm 纯粹档
    sentients = []
    for a, b in link_records:
        purity = _judge_realm_purity([
            {'rules': bodies[a].get('rule_houses'), 'fall': bodies[a].get('house')},
            {'rules': bodies[b].get('rule_houses'), 'fall': bodies[b].get('house')},
        ])
        if purity is not None:
            sentients.append({'a': a, 'b': b, 'purity': purity})

    return {'dragon': dragon, 'lone_moon': lone_moon, 'apriori': apriori,
            'jupiter': jupiter, 'afflicted': afflicted, 'sentients': sentients}


def _companions_core(lons, ref):
    """lons={id:lon}(七政);返回 {'firstOccidental','firstOriental','occidental':[..],'oriental':[..]}。"""
    others = [pid for pid in SEVEN if pid != ref and pid in lons]
    occ = sorted((( (lons[o] - lons[ref]) % 360.0), o) for o in others
                 if 0.0 < (lons[o] - lons[ref]) % 360.0 < 180.0)
    ori = sorted((( (lons[ref] - lons[o]) % 360.0), o) for o in others
                 if 0.0 < (lons[ref] - lons[o]) % 360.0 < 180.0)
    return {
        'firstOccidental': occ[0][1] if occ else None,
        'firstOriental': ori[0][1] if ori else None,
        'occidental': [o for _, o in occ],
        'oriental': [o for _, o in ori],
    }
