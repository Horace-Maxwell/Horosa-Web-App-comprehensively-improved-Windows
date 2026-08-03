# -*- coding: utf-8 -*-
"""天星择日·判读条件求值层(R3):参数校验 + ScanContext 接线 + 步长选择。

EVALUATORS 在 election_scan.py 文件尾 `_EVALUATORS.update(...)` 并入(late-import,
本模块顶层反向 import election_scan 属函数运行期访问,无循环加载问题)。
纯几何/查表核在 election_scan_cores.py;新增条件键必须同步进 election_scan.CONDITION_TYPES
(一键一行,preflight[184]+jest conditionTypesSync 双向差空)。
"""

from astrostudy import election_scan as _es
from astrostudy import election_scan_cores as cores


def _b_step_width(planet, width_deg):
    """度宽窗自适应步长:窗宽/速度 的 0.35 倍,防 1° 级窄窗整段跳过
    (窄谷漏检坑的布尔孪生;R2 negative_intervals 谷捕捉只救 A 类残差,B 类靠步长)。"""
    speed = _es._MAX_SPEED.get(planet, 1.0)
    return max(0.02, min(3.0, 0.35 * width_deg / max(speed, 1e-6)))


def _seven_snapshot(m, ctx, need=()):
    """单 moment 七政快照(memo 于 m._ext):{id:{lon,lonspeed,sign_idx}} + 可选扩展键。
    need 可含 'node'(北交)/'houses'(落宫+宫头)/'rules'(各星主宰宫表)/'above'(在地平上)/
    'sect'(is_day)。sign_idx 恒星制减 ayanamsa(内部全回归框架,仅座判定处减)。"""
    key = ('snap7', tuple(sorted(need)))
    snap = m._ext.get(key)
    if snap is not None:
        return snap
    off = ctx.ayanamsa_deg(m.jd)
    bodies = {}
    for pid in cores.SEVEN:
        p = m.planet(pid)
        bodies[pid] = {
            'lon': p['lon'],
            'lonspeed': p['lonspeed'],
            'sign_idx': int(cores._norm360(p['lon'] - off) // 30.0),
        }
    snap = {'bodies': bodies, 'jd': m.jd}
    if 'node' in need:
        n = m.planet('North Node')
        snap['node_lon'] = n['lon']
    if 'houses' in need or 'rules' in need:
        cusps = m.houses()
        snap['cusps'] = cusps
        snap['asc'] = m.asc()
        snap['mc'] = m.mc()
        for pid in cores.SEVEN:
            bodies[pid]['house'] = _es._house_index(bodies[pid]['lon'], cusps, ctx.house_advance())
    if 'rules' in need:
        from flatlib.dignities import essential as _ess
        from flatlib import const as _fc
        sign_names = _fc.LIST_SIGNS
        rule_houses = {pid: [] for pid in cores.SEVEN}
        for hn in range(1, 13):
            cusp = cusps[hn - 1]
            sidx = int(cores._norm360(cusp - off) // 30.0)
            ruler = _ess.getInfo(sign_names[sidx], 15.0).get('ruler')
            if ruler in rule_houses:
                rule_houses[ruler].append(hn)
        for pid in cores.SEVEN:
            bodies[pid]['rule_houses'] = rule_houses[pid]
    if 'above' in need:
        for pid in cores.SEVEN:
            bodies[pid]['above'] = m.horizontal(pid)['altitudeTrue'] > 0
    if 'sect' in need:
        snap['is_day'] = m.is_diurnal(ctx.eff.get('sectBuffer') or 'geo')
    m._ext[key] = snap
    return snap


# ---------------------------------------------------------------------------
# light_dynamics
# ---------------------------------------------------------------------------

_LD_ITEMS = ('translation', 'collection', 'prohibition', 'frustration',
             'refranation', 'aversion', 'bending', 'void')

# 每 item 的角色槽(params 键 → 结果记录键;'any' = 存在量词)
_LD_ROLES = {
    'translation': (('mover', 'mover'), ('from', 'from'), ('to', 'to')),
    'collection': (('collector', 'collector'),),
    'prohibition': (('blocker', 'blocker'), ('between', 'between'), ('to', 'to')),
    'frustration': (('frustrated', 'frustrated'), ('via', 'via'), ('to', 'to')),
    'refranation': (('planet', 'planet'), ('to', 'to')),
    'aversion': (),
    'bending': (('planet', 'planet'),),
    'void': (),
}


def _snap_for_light(m, ctx):
    snap = _seven_snapshot(m, ctx)
    off = ctx.ayanamsa_deg(m.jd)
    bodies = {}
    for pid, rec in snap['bodies'].items():
        bodies[pid] = {
            'lon': rec['lon'], 'lonspeed': rec['lonspeed'], 'sign_idx': rec['sign_idx'],
            'signlon': cores._norm360(rec['lon'] - off) % 30.0,
        }
    return bodies


def _mean_speed_table():
    from flatlib import props as _fp
    return {pid: _fp.object.meanMotion.get(pid, 1.0) for pid in cores.SEVEN}


def _eval_light_dynamics(params, ctx, domain):
    """光线连接八学说(item 制)。口径=astroextra.compute_aspect_dynamics(相位·格局页签),
    orb=props 表双向取大;bending 交点随 ctx.node_swe(mean/true)。"""
    item = params.get('item')
    if item not in _LD_ITEMS:
        raise ValueError('light_dynamics.item 需为 {0}'.format('/'.join(_LD_ITEMS)))
    roles = _LD_ROLES[item]
    want = {}
    for pkey, rkey in roles:
        v = params.get(pkey) or 'any'
        if v != 'any':
            if v not in cores.SEVEN:
                raise ValueError('light_dynamics.{0} 需为七政或 any'.format(pkey))
            want[rkey] = v
    pair = None
    if item == 'aversion':
        a = params.get('a') or 'any'
        b = params.get('b') or 'any'
        for v in (a, b):
            if v != 'any' and v not in cores.SEVEN:
                raise ValueError('light_dynamics.a/b 需为七政或 any')
        if a != 'any' and b != 'any' and a == b:
            raise ValueError('light_dynamics.a/b 不能相同')
        pair = (a, b)
    which = None
    if item == 'bending':
        which = params.get('which') or 'any'
        if which not in ('north', 'south', 'any'):
            raise ValueError('light_dynamics.which 需为 north/south/any')
    void_planet = params.get('planet') or 'Moon'
    if item == 'void' and void_planet != 'Moon':
        raise ValueError('void 目前仅支持月亮(与页签口径一致)')
    void_classical = bool(params.get('voidClassical'))
    mean_speed = _mean_speed_table()
    jd0, jd1 = domain
    need_node = item == 'bending'

    def pred(jd):
        m = ctx.moment(jd)
        bodies = _snap_for_light(m, ctx)
        node_lon = m.planet('North Node')['lon'] if need_node else None
        res = cores._light_dynamics_core(bodies, node_lon=node_lon,
                                         void_classical=void_classical, mean_speed=mean_speed)
        recs = res[item]
        if item == 'aversion' and pair is not None:
            a, b = pair
            for r in recs:
                ids = {r['a'], r['b']}
                if (a == 'any' or a in ids) and (b == 'any' or b in ids) \
                        and (a == 'any' or b == 'any' or {a, b} == ids):
                    return True
            return False
        if item == 'bending' and which != 'any':
            tag = '北弯' if which == 'north' else '南弯'
            recs = [r for r in recs if r['at'] == tag]
        if item == 'collection':
            p1 = params.get('p1') or 'any'
            p2 = params.get('p2') or 'any'
            out = []
            for r in recs:
                ids = {r['p1'], r['p2']}
                if (p1 == 'any' or p1 in ids) and (p2 == 'any' or p2 in ids) \
                        and (p1 == 'any' or p2 == 'any' or {p1, p2} == ids):
                    out.append(r)
            recs = out
        for r in recs:
            if all(r.get(rk) == pv for rk, pv in want.items()):
                return True
        return False

    return _es.true_intervals(pred, jd0, jd1, _es._b_step(list(cores.SEVEN)))


# ---------------------------------------------------------------------------
# royal_attendance
# ---------------------------------------------------------------------------

def _eval_royal_attendance(params, ctx, domain):
    """皇室伴寝·东升西没(companionsOf 口径)。slot=first_* 取最近一位;any_* 取整侧。"""
    ref = params.get('ref')
    slot = params.get('slot')
    companion = params.get('companion')
    if ref not in cores.SEVEN:
        raise ValueError('royal_attendance.ref 需为七政')
    if slot not in ('first_occidental', 'first_oriental', 'any_occidental', 'any_oriental'):
        raise ValueError('royal_attendance.slot 非法')
    if companion not in cores.SEVEN or companion == ref:
        raise ValueError('royal_attendance.companion 需为七政且异于 ref')
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        lons = {pid: m.lon(pid) for pid in cores.SEVEN}
        comp = cores._companions_core(lons, ref)
        if slot == 'first_occidental':
            return comp['firstOccidental'] == companion
        if slot == 'first_oriental':
            return comp['firstOriental'] == companion
        if slot == 'any_occidental':
            return companion in comp['occidental']
        return companion in comp['oriental']

    return _es.true_intervals(pred, jd0, jd1, _es._b_step([ref, companion]))


# ---------------------------------------------------------------------------
# sect_joy:宗派/得时/喜乐
# ---------------------------------------------------------------------------

_JOY_HOUSE = {'Mercury': 1, 'Moon': 3, 'Venus': 5, 'Mars': 6, 'Sun': 9, 'Jupiter': 11, 'Saturn': 12}

_HAYYIZ_LEVELS = ('Hayyiz', 'DemiHayyiz', 'InWrongPos', 'None')


def _above_horizon_semiarc(m, planet):
    """perchart.isAboveHorizon 同款半弧法(ra/decl vs MC 赤经+纬度)——hayyiz 判据单源;
    与 sect 昼夜的真地平口径(altitudeTrue)是两个语义,勿混。"""
    from flatlib import utils as _futils
    eq = m.equatorial(planet)
    mc_ra, _mc_decl = _futils.eqCoords(m.mc(), 0)
    return _futils.isAboveHorizon(eq['ra'], eq['decl'], mc_ra, m.ctx.lat)


def _hayyiz_level(m, ctx, planet, is_day):
    """perchart.hayyiz(:2521) 逐字:faction=props 表;阳座=座序偶;火星夜盘阴座=DemiHayyiz。"""
    from flatlib import props as _fp
    from flatlib import const as _fc
    if not _above_horizon_semiarc(m, planet):
        return 'None'
    fact = _fp.object.faction.get(planet)
    off = ctx.ayanamsa_deg(m.jd)
    sigidx = int(cores._norm360(m.lon(planet) - off) // 30.0)
    if is_day and fact == _fc.DIURNAL:
        if sigidx % 2 == 0:
            return 'Hayyiz'
    elif (not is_day) and fact == _fc.DIURNAL and sigidx % 2 == 1:
        return 'InWrongPos'
    elif (not is_day) and fact == _fc.NOCTURNAL:
        if planet == 'Mars':
            return 'Hayyiz' if sigidx % 2 == 0 else 'DemiHayyiz'
        if sigidx % 2 == 1:
            return 'Hayyiz'
    elif is_day and fact == _fc.NOCTURNAL and sigidx % 2 == 0:
        return 'InWrongPos'
    return 'None'


def _eval_sect_joy(params, ctx, domain):
    """宗派/得时/喜乐(item 制)。昼夜=真地平+eff.sectBuffer;of_sect=perchart.setupSect 逐字
    (水星随东西向);hayyiz=perchart.hayyiz 逐字(地平=半弧法);house_joy=整宫制(行星页签口径);
    sign_joy=flatlib props.signJoy 表。"""
    item = params.get('item')
    if item not in ('diurnal', 'of_sect', 'hayyiz', 'house_joy', 'sign_joy'):
        raise ValueError('sect_joy.item 需为 diurnal/of_sect/hayyiz/house_joy/sign_joy')
    planet = params.get('planet')
    if item != 'diurnal':
        if planet not in cores.SEVEN:
            raise ValueError('sect_joy.planet 需为七政')
    levels = params.get('hayyizLevels') or ['Hayyiz']
    if item == 'hayyiz':
        for lv in levels:
            if lv not in _HAYYIZ_LEVELS:
                raise ValueError('hayyizLevels 含未知档 {0!r}'.format(lv))
    buf = ctx.eff.get('sectBuffer') or 'geo'
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        if item == 'diurnal':
            return m.is_diurnal(buf)
        if item == 'of_sect':
            is_day = m.is_diurnal(buf)
            if planet in ('Sun', 'Jupiter', 'Saturn'):
                return is_day
            if planet in ('Moon', 'Venus', 'Mars'):
                return not is_day
            oriental = cores._wrap180(m.lon('Mercury') - m.lon('Sun')) < 0
            return oriental == is_day
        if item == 'hayyiz':
            return _hayyiz_level(m, ctx, planet, m.is_diurnal(buf)) in levels
        if item == 'house_joy':
            return m.whole_sign_house(planet) == _JOY_HOUSE[planet]
        from flatlib import props as _fp
        off = ctx.ayanamsa_deg(jd)
        sign_name = _es._SIGN_NAMES[int(cores._norm360(m.lon(planet) - off) // 30.0)]
        return _fp.object.signJoy.get(planet) == sign_name

    if item == 'sign_joy':
        step = _es._b_step([planet])
    else:
        step = _es._b_step([planet or 'Sun'], fast=True)
    return _es.true_intervals(pred, jd0, jd1, step)


# ---------------------------------------------------------------------------
# degree_state:度性查表(月站/单度主/Darijan/明暗空烟/特殊度)
# ---------------------------------------------------------------------------

_DEGREE_WIDTH = {'mansion': 12.857, 'monomoiria': 1.0, 'darijan': 10.0, 'quality': 1.0, 'special': 1.0}


def _eval_degree_state(params, ctx, domain):
    """度性查表:直调 classical_tables(与 perchart 同源零移植);lon 一律恒星化(_sid_lon)。
    步长=度宽自适应(1° 级窄窗防漏检)。"""
    from astrostudy import classical_tables as ct
    planet = params.get('planet')
    ctx.swe_id(planet)
    item = params.get('item')
    if item not in _DEGREE_WIDTH:
        raise ValueError('degree_state.item 需为 mansion/monomoiria/darijan/quality/special')
    mansion = params.get('mansion')
    ruler = params.get('ruler')
    quality = params.get('quality')
    special = params.get('special')
    if item == 'mansion':
        mansion = int(mansion or 0)
        if not 1 <= mansion <= 28:
            raise ValueError('mansion 需为 1-28')
    if item in ('monomoiria', 'darijan'):
        if ruler not in cores.SEVEN:
            raise ValueError('degree_state.ruler 需为七政')
    if item == 'quality' and quality not in ('B', 'D', 'E', 'S'):
        raise ValueError('quality 需为 B/D/E/S(明/暗/空/烟)')
    if item == 'special' and special not in ('pitted', 'azemene', 'increasing_fortune'):
        raise ValueError('special 需为 pitted/azemene/increasing_fortune')
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        lon = _es._sid_lon(m, planet, ctx)
        if item == 'mansion':
            rec = ct.mansion_of(lon)
            return bool(rec) and rec['idx'] == mansion
        sign = _es._SIGN_NAMES[int(lon // 30.0)]
        signlon = lon % 30.0
        if item == 'monomoiria':
            return ct.monomoiria_ruler(lon) == ruler
        if item == 'darijan':
            return ct.darijan_ruler(sign, signlon) == ruler
        if item == 'quality':
            return ct.degree_quality(sign, signlon) == quality
        rec = ct.special_degree(sign, signlon) or {}
        key = {'pitted': 'pitted', 'azemene': 'azemene', 'increasing_fortune': 'fortune'}[special]
        return bool(rec.get(key))

    return _es.true_intervals(pred, jd0, jd1, _b_step_width(planet, _DEGREE_WIDTH[item]))


# ---------------------------------------------------------------------------
# decan_state:旬位/旬主/护符择时(埃及页签口径)
# ---------------------------------------------------------------------------

def _eval_decan_state(params, ctx, domain):
    """旬 decan:希腊序 int(sid_lon//10)+1(1..36);旬主=必然尊贵 face(essential 单源);
    护符择时=「ASC 正当该旬 ∨ 月行至该旬」(埃及页签 AstroEgypt 口径)。"""
    from flatlib.dignities import essential as _ess
    mode = params.get('mode')
    if mode not in ('planet_in', 'ruler_is', 'talisman'):
        raise ValueError('decan_state.mode 需为 planet_in/ruler_is/talisman')
    planet = params.get('planet')
    decans = params.get('decans')
    ruler = params.get('ruler')
    if mode in ('planet_in', 'ruler_is'):
        ctx.swe_id(planet)
        if planet is None:
            raise ValueError('decan_state.planet 必填')
    if mode in ('planet_in', 'talisman'):
        if not isinstance(decans, (list, tuple)) or not decans:
            raise ValueError('decan_state.decans 需为非空列表(1-36)')
        decans = [int(d) for d in decans]
        for d in decans:
            if not 1 <= d <= 36:
                raise ValueError('decans 取值需在 1-36')
        decans = set(decans)
    if mode == 'ruler_is' and ruler not in cores.SEVEN:
        raise ValueError('decan_state.ruler 需为七政')
    jd0, jd1 = domain

    def decan_of(lon):
        return int(cores._norm360(lon) // 10.0) + 1

    def pred(jd):
        m = ctx.moment(jd)
        if mode == 'planet_in':
            return decan_of(_es._sid_lon(m, planet, ctx)) in decans
        if mode == 'ruler_is':
            lon = _es._sid_lon(m, planet, ctx)
            sign = _es._SIGN_NAMES[int(lon // 30.0)]
            info = _ess.getInfo(sign, lon % 30.0)
            return info.get('face') == ruler
        off = ctx.ayanamsa_deg(jd)
        asc_d = decan_of(m.asc() - off)
        moon_d = decan_of(m.lon('Moon') - off)
        return asc_d in decans or moon_d in decans

    if mode == 'talisman':
        step = _es._b_step(['Moon'], fast=True)   # ASC 过旬 ~40min
    else:
        step = _b_step_width(planet, 10.0)
    return _es.true_intervals(pred, jd0, jd1, step)


# ---------------------------------------------------------------------------
# pattern_overview + dispositor_cycle
# ---------------------------------------------------------------------------

_OVERVIEW_ITEMS = ('dragon_embrace', 'dragon_intercept', 'lone_moon', 'apriori_power',
                   'eight_kill', 'strong_jupiter', 'afflicted_ruler', 'sentient_link')

_PURITY_KEYS = ('mundane_pure', 'eso_pure', 'eso_mundane', 'insentient', 'any_pure')


def _link_records_chart(m, ctx):
    """chartdynamics 参考实现(每 pred 建 Chart,慢)——只作对拍基准,生产路径用纯几何版。"""
    dyn = m.dynamics()
    recs = []
    pairs = set()
    seven = list(cores.SEVEN)
    for i, a in enumerate(seven):
        for b in seven[i + 1:]:
            linked = False
            if dyn.mutualReceptions(a, b):
                linked = True
            elif dyn.receives(a, b) or dyn.receives(b, a):
                linked = True
            else:
                d = cores._dist(m.lon(a), m.lon(b))
                moiety = 0.5 * (_es._MOIETY.get(a, 5.0) + _es._MOIETY.get(b, 5.0))
                if d <= moiety:
                    linked = True
            if linked:
                recs.append((a, b))
                pairs.add(frozenset((a, b)))
    return recs, pairs


def _link_records(m, ctx):
    """七政两两联结对(互容/接纳/合相)——chartdynamics 判据的**纯几何复刻**(零 Chart):
    互容=双方互落对方尊贵(essential.getInfo 查表,无相位要求,含邪档);
    接纳=受方落施方尊贵 ∧ 施方在其单星 orb 内成托勒密相位(isAspecting 严格 <,施方 orb);
    合相=moiety 均值。与参考实现的恒等由 tab 对拍钉死。
    性能:旧版每采样点建 Chart+21 对 dynamics(月级段 ~17s),纯几何 ~0.5ms/点——
    重叶(有情联结/龙截/先验权力)月段回到秒级(真机实抓 12 段扫描把前端拖死)。"""
    from flatlib.dignities import essential as _ess
    from flatlib import props as _fp
    off = ctx.ayanamsa_deg(m.jd)
    lons = {}
    info = {}
    for pid in cores.SEVEN:
        lon = m.lon(pid)
        lons[pid] = lon
        sid = cores._norm360(lon - off)
        info[pid] = _ess.getInfo(_es._SIGN_NAMES[int(sid // 30.0)], sid % 30.0)

    def digs_in(pos_info, owner):
        return any(v == owner for v in pos_info.values())

    recs = []
    pairs = set()
    seven = list(cores.SEVEN)
    for i, a in enumerate(seven):
        for b in seven[i + 1:]:
            d = cores._dist(lons[a], lons[b])

            def asp_from(src):
                orb = _fp.object.orb.get(src, 5.0)
                return any(abs(d - asp) < orb for asp in (0, 60, 90, 120, 180))

            b_in_a = digs_in(info[b], a)   # b 落 a 的尊贵(a 接纳 b 的位置条件)
            a_in_b = digs_in(info[a], b)
            # 注:chartdynamics 的互容=receives 双向(含相位),不存在「无相位纯落座」档
            # (对拍首轮实抓:多认 Mars-Venus 等恒联结假对)——linked 判据只有两支。
            linked = (asp_from(b) and b_in_a) or (asp_from(a) and a_in_b)
            if not linked:
                moiety = 0.5 * (_es._MOIETY.get(a, 5.0) + _es._MOIETY.get(b, 5.0))
                if d <= moiety:
                    linked = True
            if linked:
                recs.append((a, b))
                pairs.add(frozenset((a, b)))
    return recs, pairs


def _jupiter_lit(m, ctx):
    """强吉木星照耀数:与木星在 moiety 均值 orb 内成托勒密相位的七政(normalAsp 同源口径)。"""
    lit = []
    for pid in cores.SEVEN:
        if pid == 'Jupiter':
            continue
        d = cores._dist(m.lon(pid), m.lon('Jupiter'))
        moiety = 0.5 * (_es._MOIETY.get(pid, 5.0) + _es._MOIETY.get('Jupiter', 5.0))
        if any(abs(d - asp) <= moiety for asp in (0, 60, 90, 120, 180)):
            lit.append(pid)
    return lit


def _eval_pattern_overview(params, ctx, domain):
    """大势格局速览(item 制):龙拥/龙截/孤月独明/先验权力/八杀朝天/强吉木星/后天凶星/
    有情无情联结。判定核=前端 astroPatternOverview 逐字(共享 fixture 双端锁);
    联结走 chartdynamics 单源。盘面不可判(如缺数据)返 False 不抛。"""
    item = params.get('item')
    if item not in _OVERVIEW_ITEMS:
        raise ValueError('pattern_overview.item 需为 {0}'.format('/'.join(_OVERVIEW_ITEMS)))
    planet = params.get('planet') or 'any'
    if planet != 'any' and planet not in cores.SEVEN:
        raise ValueError('pattern_overview.planet 需为七政或 any')
    which = params.get('which') or 'any'
    if item in ('apriori_power', 'eight_kill') and which not in ('any', '8_12', '8_1'):
        raise ValueError('pattern_overview.which 需为 any/8_12/8_1')
    min_lit = int(params.get('minLit') or 0)
    if item == 'strong_jupiter' and not 0 <= min_lit <= 6:
        raise ValueError('minLit 需为 0-6')
    require_strong = params.get('requireStrong')
    require_strong = True if require_strong is None else bool(require_strong)
    purity = params.get('purity') or 'any_pure'
    if item == 'sentient_link' and purity not in _PURITY_KEYS:
        raise ValueError('purity 需为 {0}'.format('/'.join(_PURITY_KEYS)))
    jd0, jd1 = domain

    need_links = item in ('dragon_intercept', 'apriori_power', 'eight_kill', 'sentient_link')
    need_houses = item in ('apriori_power', 'eight_kill', 'strong_jupiter', 'afflicted_ruler',
                           'sentient_link', 'lone_moon')
    need_above = item == 'lone_moon'
    need_sect = item in ('lone_moon', 'eight_kill')

    def pred(jd):
        m = ctx.moment(jd)
        need = ['node']
        if need_houses:
            need += ['houses', 'rules']
        if need_above:
            need.append('above')
        if need_sect:
            need.append('sect')
        snap = _seven_snapshot(m, ctx, need=tuple(need))
        bodies = snap['bodies']
        link_recs, link_pairs = ([], set())
        loops = []
        if need_links:
            link_recs, link_pairs = _link_records(m, ctx)
            if item in ('apriori_power', 'eight_kill'):
                loops = cores._dispositors_core(
                    {pid: bodies[pid]['sign_idx'] for pid in cores.SEVEN})['loops']
        if item == 'strong_jupiter':
            bodies['Jupiter']['lit'] = _jupiter_lit(m, ctx)
        ov = cores._pattern_overview_core(
            bodies, snap.get('node_lon'), snap.get('is_day', False),
            link_pairs, link_recs, loops)
        if item == 'dragon_embrace':
            return ov['dragon'].get('has') and ov['dragon'].get('kind') == 'embrace'
        if item == 'dragon_intercept':
            d = ov['dragon']
            if not (d.get('has') and d.get('kind') == 'intercept'):
                return False
            if planet == 'any':
                return True
            return d.get('lone') == planet or planet in (d.get('pair') or [])
        if item == 'lone_moon':
            return bool(ov['lone_moon'])
        if item in ('apriori_power', 'eight_kill'):
            links = ov['apriori']['links']
            if which != 'any':
                links = [l for l in links if l['which'] == which]
            if planet != 'any':
                links = [l for l in links if planet in (l['a'], l['b'])]
            if not links:
                return False
            if item == 'eight_kill':
                return not snap.get('is_day', True)
            return True
        if item == 'strong_jupiter':
            j = ov['jupiter']
            if not j.get('present'):
                return False
            if require_strong and not j.get('strong'):
                return False
            return j.get('litCount', 0) >= min_lit
        if item == 'afflicted_ruler':
            if planet == 'any':
                return bool(ov['afflicted'])
            return planet in ov['afflicted']
        hits = ov['sentients']
        if planet != 'any':
            hits = [s for s in hits if planet in (s['a'], s['b'])]
        if purity == 'any_pure':
            return any(s['purity'].get('pure') for s in hits)
        return any(s['purity'].get('realm') == purity for s in hits)

    return _es.true_intervals(pred, jd0, jd1, _es._b_step(list(cores.SEVEN)))


def _eval_dispositor_cycle(params, ctx, domain):
    """主宰循环:终极主宰/互容环(dispositorChain 逐字,纯座主链)。"""
    mode = params.get('mode')
    if mode not in ('final_is', 'final_exists', 'in_loop', 'loop_exists'):
        raise ValueError('dispositor_cycle.mode 需为 final_is/final_exists/in_loop/loop_exists')
    planet = params.get('planet')
    if mode in ('final_is', 'in_loop') and planet not in cores.SEVEN:
        raise ValueError('dispositor_cycle.planet 需为七政')
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        snap = _seven_snapshot(m, ctx)
        res = cores._dispositors_core({pid: snap['bodies'][pid]['sign_idx']
                                       for pid in cores.SEVEN})
        if mode == 'final_is':
            return planet in res['finals']
        if mode == 'final_exists':
            return bool(res['finals'])
        if mode == 'in_loop':
            return any(planet in lp for lp in res['loops'])
        return bool(res['loops'])

    return _es.true_intervals(pred, jd0, jd1, _es._b_step(list(cores.SEVEN)))


# ---------------------------------------------------------------------------
# almuten_is / distribution_state / temperament / accidental_score
# ---------------------------------------------------------------------------

_HOUSE_SCORES_N = {1: 12, 2: 6, 3: 3, 4: 9, 5: 7, 6: 1, 7: 10, 8: 4, 9: 5, 10: 11, 11: 8, 12: 2}
_DIGNITY_SCORES = {'ruler': 5, 'exalt': 4, 'dayTrip': 3, 'nightTrip': 3, 'partTrip': 3, 'term': 2, 'face': 1}
_ELEMENT_BY_SIGN = ('Fire', 'Earth', 'Air', 'Water')       # sign_idx % 4
_MODE_BY_SIGN = ('Cardinal', 'Fixed', 'Mutable')            # sign_idx % 3
_OUTER3 = ('Uranus', 'Neptune', 'Pluto')


def _dig_scores_at(lon_sid):
    """某黄经(已恒星化)处的必然尊贵积分表 {七政: 分}。essential 单源(termsVariant 令牌自动生效)。"""
    from flatlib.dignities import essential as _ess
    sign = _es._SIGN_NAMES[int(cores._norm360(lon_sid) // 30.0)]
    dig = _ess.getInfo(sign, cores._norm360(lon_sid) % 30.0)
    out = {}
    for key, sc in _DIGNITY_SCORES.items():
        oid = dig.get(key)
        if oid in cores.SEVEN:
            out[oid] = out.get(oid, 0) + sc
    return out


def _almuten_winner(m, ctx):
    """盘主(Almuten):五要点(日/月/ASC/福点/朔望)尊贵积分 + 七政宫位分;胜者=最高分,
    平分按七政传统序首位胜(astroextra.almuten_table 同款 max 语义,文档钉死)。"""
    off = ctx.ayanamsa_deg(m.jd)
    totals = {pid: 0 for pid in cores.SEVEN}
    points = [m.lon('Sun') - off, m.lon('Moon') - off, m.asc() - off,
              m.lot_lon('fortuna') - off, m.syzygy_lon() - off]
    for lon in points:
        for pid, sc in _dig_scores_at(lon).items():
            totals[pid] += sc
    cusps = m.houses()
    for pid in cores.SEVEN:
        hn = _es._house_index(m.lon(pid), cusps, ctx.house_advance())
        totals[pid] += _HOUSE_SCORES_N.get(hn, 0)
    return max(totals.items(), key=lambda kv: kv[1])[0], totals


def _eval_almuten_is(params, ctx, domain):
    """胜利星:scope=chart(盘主,五要点+宫位分)/topic(单宫头必然尊贵积分胜者)。"""
    scope = params.get('scope') or 'chart'
    planet = params.get('planet')
    if scope not in ('chart', 'topic'):
        raise ValueError('almuten_is.scope 需为 chart/topic')
    if planet not in cores.SEVEN:
        raise ValueError('almuten_is.planet 需为七政')
    house = None
    if scope == 'topic':
        house = int(params.get('house') or 0)
        if not 1 <= house <= 12:
            raise ValueError('almuten_is.house 需为 1-12')
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        if scope == 'chart':
            return _almuten_winner(m, ctx)[0] == planet
        off = ctx.ayanamsa_deg(jd)
        cusp = m.houses()[house - 1]
        scores = _dig_scores_at(cusp - off)
        if not scores:
            return False
        seq = [(pid, scores[pid]) for pid in cores.SEVEN if pid in scores]
        return max(seq, key=lambda kv: kv[1])[0] == planet

    return _es.true_intervals(pred, jd0, jd1, _es._b_step(['Sun'], fast=True))


def _eval_distribution_state(params, ctx, domain):
    """分布权重:元素/模式/半球计数(astroextra.distribution 逐字,含 ASC/MC 轴半球式)。
    includeOuter 默认 true=十星(格局页签口径);false=七政。op=max 为严格最大(平局 False)。"""
    axis = params.get('axis')
    key = params.get('key')
    op = params.get('op') or 'max'
    valid_keys = {
        'element': ('Fire', 'Earth', 'Air', 'Water'),
        'mode': ('Cardinal', 'Fixed', 'Mutable'),
        'hemisphere': ('east', 'west', 'above', 'below'),
    }
    if axis not in valid_keys:
        raise ValueError('distribution_state.axis 需为 element/mode/hemisphere')
    if key not in valid_keys[axis]:
        raise ValueError('distribution_state.key 非法({0} 轴)'.format(axis))
    if op not in ('max', 'gte', 'lte', 'eq'):
        raise ValueError('distribution_state.op 需为 max/gte/lte/eq')
    value = None
    if op != 'max':
        value = int(params.get('value') if params.get('value') is not None else -1)
        if not 0 <= value <= 10:
            raise ValueError('distribution_state.value 需为 0-10')
    include_outer = params.get('includeOuter')
    include_outer = True if include_outer is None else bool(include_outer)
    planets = list(cores.SEVEN) + (list(_OUTER3) if include_outer else [])
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        off = ctx.ayanamsa_deg(jd)
        counts = {k: 0 for k in valid_keys[axis]}
        asc = m.asc()
        mc = m.mc()
        for pid in planets:
            lon = m.lon(pid)
            if axis == 'element':
                counts[_ELEMENT_BY_SIGN[int(cores._norm360(lon - off) // 30.0) % 4]] += 1
            elif axis == 'mode':
                counts[_MODE_BY_SIGN[int(cores._norm360(lon - off) // 30.0) % 3]] += 1
            else:
                if key in ('above', 'below'):
                    counts['below' if (lon - asc) % 360.0 < 180.0 else 'above'] += 1
                else:
                    counts['east' if (lon - mc) % 360.0 < 180.0 else 'west'] += 1
        n = counts[key]
        if op == 'max':
            return all(n > v for k, v in counts.items() if k != key)
        if op == 'gte':
            return n >= value
        if op == 'lte':
            return n <= value
        return n == value

    step = _es._b_step(['Sun'], fast=True) if axis == 'hemisphere' else _es._b_step(list(cores.SEVEN))
    return _es.true_intervals(pred, jd0, jd1, step)


def _eval_temperament(params, ctx, domain):
    """气质评估:flatlib protocols.temperament 单源直调(格局页签同函数);
    kind=temperament(四气质)/quality(四性质);op=dominant(严格最大)/gte/lte。"""
    kind = params.get('kind')
    value = params.get('value')
    op = params.get('op') or 'dominant'
    keys = {
        'temperament': ('Choleric', 'Melancholic', 'Sanguine', 'Phlegmatic'),
        'quality': ('Hot', 'Cold', 'Dry', 'Humid'),
    }
    if kind not in keys:
        raise ValueError('temperament.kind 需为 temperament/quality')
    if value not in keys[kind]:
        raise ValueError('temperament.value 非法({0})'.format(kind))
    if op not in ('dominant', 'gte', 'lte'):
        raise ValueError('temperament.op 需为 dominant/gte/lte')
    count = None
    if op != 'dominant':
        count = int(params.get('count') if params.get('count') is not None else -1)
        if not 0 <= count <= 12:
            raise ValueError('temperament.count 需为 0-12')
    jd0, jd1 = domain

    def pred(jd):
        from flatlib.protocols.temperament import Temperament
        m = ctx.moment(jd)
        sc = Temperament(m.flatchart()).getScore()
        table = sc['temperaments'] if kind == 'temperament' else sc['qualities']
        n = table.get(value, 0)
        if op == 'dominant':
            return all(n > v for k, v in table.items() if k != value)
        if op == 'gte':
            return n >= count
        return n <= count

    return _es.true_intervals(pred, jd0, jd1, _es._b_step(['Sun'], fast=True))


def _eval_accidental_score(params, ctx, domain):
    """偶然尊贵评分:astroextra.compute_accidental_dignity 权重逐项重写(该函数读 PerChart
    注入属性无法包装)。日下三态走 ctx.eff(cazimi/combust/underBeams);喜乐=整宫;
    会吉凶 orb=props 表;度数围攻=±7° 夹。"""
    planet = params.get('planet')
    op = params.get('op') or 'gte'
    if planet not in cores.SEVEN:
        raise ValueError('accidental_score.planet 需为七政')
    if op not in ('gte', 'lte', 'top1'):
        raise ValueError('accidental_score.op 需为 gte/lte/top1')
    value = None
    if op != 'top1':
        value = float(params.get('value') if params.get('value') is not None else -99)
        if not -30 <= value <= 40:
            raise ValueError('accidental_score.value 需在 -30..40')
    jd0, jd1 = domain

    def pred(jd):
        m = ctx.moment(jd)
        n = _accidental_score_at(m, ctx, planet)
        if op == 'gte':
            return n >= value
        if op == 'lte':
            return n <= value
        return all(n > _accidental_score_at(m, ctx, pid)
                   for pid in cores.SEVEN if pid != planet)

    return _es.true_intervals(pred, jd0, jd1, _es._b_step([planet], fast=True))


_ACC_INNER = ('Mercury', 'Venus')
_ACC_OUTER = ('Mars', 'Jupiter', 'Saturn')
_ACC_MALEFICS = ('Mars', 'Saturn')


def _accidental_score_at(m, ctx, pid):
    """单星偶然尊贵分(compute_accidental_dignity 权重逐项;模块级供 tab 对拍直调)。"""
    from flatlib import props as _fp
    score = 0
    lon = m.lon(pid)
    hn = _es._house_index(lon, m.houses(), ctx.house_advance())
    if hn in (1, 4, 7, 10):
        score += 5
    elif hn in (2, 5, 8, 11):
        score += 3
    elif hn:
        score -= 2
    if pid not in ('Sun', 'Moon'):
        ms = _fp.object.meanMotion.get(pid, 1.0)
        score += 2 if abs(m.lonspeed(pid)) > abs(ms) else -2
    sun_lon = m.lon('Sun')
    if pid != 'Sun':
        el = cores._wrap180(lon - sun_lon)
        if pid in _ACC_OUTER and el < 0:
            score += 2
        elif pid in _ACC_INNER and el > 0:
            score += 2
        # 日下三态与 phase 页签同源:仅 ARCUS_VISIONIS 表内五星有 phase(月亮无);
        # free 阈=逐星可见弧(非 underBeamsOrb)——setupPhasis 逐字。
        from astrostudy.perchart import ARCUS_VISIONIS as _ARCUS
        arcus = _ARCUS.get(pid)
        if arcus is not None:
            d = abs(el)
            if d <= ctx.eff['cazimiOrb']:
                score += 5
            elif d < ctx.eff['combustOrb']:
                score -= 5
            elif d >= arcus:
                score += 5
    if pid == 'Moon':
        me = (lon - sun_lon) % 360.0
        score += 2 if 0 < me < 180 else -2
    for bid, w in (('Jupiter', 5), ('Venus', 4), ('Saturn', -5), ('Mars', -4)):
        if bid != pid and abs(cores._wrap180(lon - m.lon(bid))) <= cores._chart_orb(pid, bid):
            score += w
    if m.whole_sign_house(pid) == _JOY_HOUSE.get(pid):
        score += 5
    if pid not in _ACC_MALEFICS:
        left = right = False
        for mid in _ACC_MALEFICS:
            el = cores._wrap180(m.lon(mid) - lon)
            if -7.0 <= el < 0.0:
                left = True
            elif 0.0 < el <= 7.0:
                right = True
        if left and right:
            score -= 5
    return score


# ---------------------------------------------------------------------------
# classical_pattern:护卫/优势压制/度数围攻(compute_classical_patterns 逐字)
# ---------------------------------------------------------------------------

def _classical_hits(m, ctx, want):
    """want='doryphory'|'overcoming'|'besieging';返回命中记录列表(判据=astroextra 逐字:
    护卫=同宗星距宗派光 −15..−7° 晨升侧,水星随东西向;压制=右旋座序 8/9/10;
    度围=两凶 ±7° 夹且间无他星)。昼夜=真地平口径(与 flatlib isDiurnal 黄经口径的边界分钟差
    已在对拍测试远界采样规避并注明)。"""
    off = ctx.ayanamsa_deg(m.jd)
    lons = {pid: m.lon(pid) for pid in cores.SEVEN}
    is_day = m.is_diurnal(ctx.eff.get('sectBuffer') or 'geo')
    out = []
    if want == 'doryphory':
        merc_oriental = cores._wrap180(lons['Mercury'] - lons['Sun']) < 0
        if is_day:
            sect_pl = ['Sun', 'Jupiter', 'Saturn'] + (['Mercury'] if merc_oriental else [])
        else:
            sect_pl = ['Moon', 'Venus', 'Mars'] + ([] if merc_oriental else ['Mercury'])
        light = 'Sun' if is_day else 'Moon'
        ll = lons[light]
        for pid in sect_pl:
            if pid == light:
                continue
            el = cores._wrap180(lons[pid] - ll)
            if -15.0 <= el <= -7.0:
                out.append({'planet': pid, 'light': light})
        return out
    if want == 'overcoming':
        OVR = {8: 'trine', 9: 'square', 10: 'sextile'}
        sidx = {pid: int(cores._norm360(lons[pid] - off) // 30.0) for pid in cores.SEVEN}
        for a in cores.SEVEN:
            for b in cores.SEVEN:
                if a == b:
                    continue
                offn = (sidx[a] - sidx[b]) % 12
                if offn in OVR:
                    out.append({'over': a, 'under': b, 'aspect': OVR[offn]})
        return out
    for tid in cores.SEVEN:
        if tid in ('Mars', 'Saturn'):
            continue
        t = lons[tid]
        left = right = None
        for mid in ('Mars', 'Saturn'):
            el = cores._wrap180(lons[mid] - t)
            if -7.0 <= el < 0.0:
                left = (mid, el)
            elif 0.0 < el <= 7.0:
                right = (mid, el)
        if left and right:
            between = any(
                oid not in (tid, left[0], right[0])
                and left[1] < cores._wrap180(lons[oid] - t) < right[1]
                for oid in cores.SEVEN)
            if not between:
                out.append({'planet': tid, 'left': left[0], 'right': right[0]})
    return out


def _eval_classical_pattern(params, ctx, domain):
    """古典格局(与既有 besieged 叶语义不同:besieged=体围/光围+救援;此处=度数围攻 ±7 夹)。"""
    pattern = params.get('pattern')
    if pattern not in ('doryphory', 'overcoming', 'besieging_degree'):
        raise ValueError('classical_pattern.pattern 需为 doryphory/overcoming/besieging_degree')
    planet = params.get('planet') or 'any'
    over = params.get('over') or 'any'
    under = params.get('under') or 'any'
    aspect_kind = params.get('aspectKind') or 'any'
    for v in (planet, over, under):
        if v != 'any' and v not in cores.SEVEN:
            raise ValueError('classical_pattern 星槽需为七政或 any')
    if aspect_kind not in ('any', 'trine', 'square', 'sextile'):
        raise ValueError('aspectKind 需为 any/trine/square/sextile')
    if pattern == 'overcoming' and over != 'any' and over == under:
        raise ValueError('over/under 不能相同')
    jd0, jd1 = domain
    want = 'besieging' if pattern == 'besieging_degree' else pattern

    def pred(jd):
        m = ctx.moment(jd)
        hits = _classical_hits(m, ctx, want)
        if pattern == 'doryphory':
            return any(planet in ('any', h['planet']) for h in hits)
        if pattern == 'overcoming':
            for h in hits:
                if over not in ('any', h['over']):
                    continue
                if under not in ('any', h['under']):
                    continue
                if aspect_kind not in ('any', h['aspect']):
                    continue
                return True
            return False
        return any(planet in ('any', h['planet']) for h in hits)

    fast = pattern == 'doryphory'   # sect 门控随地平翻转
    return _es.true_intervals(pred, jd0, jd1, _es._b_step(list(cores.SEVEN), fast=fast))


# ---------------------------------------------------------------------------
# eminence_level:显赫计分(AstroEminence.computeEminence 五指标逐字;
# s4 盘主=almuten 胜者(前端无 analysis 时回退上升主,扫描侧取正统盘主,差异 docstring 化)
# ---------------------------------------------------------------------------

_USEFUL_HOUSES = (1, 10, 11, 7, 4, 9, 5)
_ANGULAR_HOUSES = (1, 4, 7, 10)


def _self_dignities(m, ctx, pid):
    from flatlib.dignities import essential as _ess
    lon = _es._sid_lon(m, pid, ctx)
    sign = _es._SIGN_NAMES[int(lon // 30.0)]
    dig = _ess.getInfo(sign, lon % 30.0)
    return set(k for k in ('ruler', 'exalt', 'dayTrip', 'nightTrip', 'partTrip',
                           'term', 'face', 'exile', 'fall') if dig.get(k) == pid)


def _aspected_by(m, pid, pid_lon, bid):
    """受某星照映:moiety 均值口径(页签 normalAsp 同源;勿用近似常数——真机实抓分叉)。"""
    d = cores._dist(pid_lon, m.lon(bid))
    moiety = 0.5 * (_es._MOIETY.get(pid, 5.0) + _es._MOIETY.get(bid, 5.0))
    return any(abs(d - asp) <= moiety for asp in (0, 60, 90, 120, 180))


def _ruler_of_sign_idx(si):
    return cores._DOMICILE_BY_SIGN[si % 12]


def eminence_total(m, ctx):
    """显赫 0-10 分(五指标各 0-2,computeEminence 逐字;lot 四点走 LightMoment 惰性字段)。"""
    off = ctx.ayanamsa_deg(m.jd)
    cusps = m.houses()
    is_day = m.is_diurnal(ctx.eff.get('sectBuffer') or 'geo')

    def house_of_lon(lon):
        return _es._house_index(lon, cusps, ctx.house_advance())

    def sign_idx(lon):
        return int(cores._norm360(lon - off) // 30.0)

    # s1 两光
    s1 = 0.0
    for pid in ('Sun', 'Moon'):
        lon = m.lon(pid)
        h = house_of_lon(lon)
        pt = 0.0
        if h in _USEFUL_HOUSES:
            pt = 1.0 if h in _ANGULAR_HOUSES else 0.5
        # 同宫两凶夹(前端 isBesieged 直比口径)
        mal = [m.lon(x) for x in ('Mars', 'Saturn') if house_of_lon(m.lon(x)) == h]
        if len(mal) >= 2 and any(x < lon for x in mal) and any(x > lon for x in mal):
            pt = 0.0
        s1 += pt
    s1 = min(2.0, round(s1 * 2) / 2.0)

    # s2 福点及主星
    s2 = 0.0
    f_lon = m.lot_lon('fortuna')
    if house_of_lon(f_lon) in _ANGULAR_HOUSES:
        s2 += 1.0
    lord = _ruler_of_sign_idx(sign_idx(f_lon))
    lord_digs = _self_dignities(m, ctx, lord)
    lord_good = bool(lord_digs - {'exile', 'fall'}) or any(
        _aspected_by(m, lord, m.lon(lord), b) for b in ('Venus', 'Jupiter'))
    if lord_good:
        s2 += 1.0
    s2 = min(2.0, s2)

    # s3 持矛(轻量派生:同宗或强尊贵之金木水火土,落光体宫环形 ±1)
    light = 'Sun' if is_day else 'Moon'
    lh = house_of_lon(m.lon(light))
    guards = 0
    for gid in ('Venus', 'Jupiter', 'Mercury', 'Mars', 'Saturn'):
        if gid in ('Sun', 'Jupiter', 'Saturn'):
            same_sect = is_day
        elif gid in ('Moon', 'Venus', 'Mars'):
            same_sect = not is_day
        else:
            same_sect = (cores._wrap180(m.lon('Mercury') - m.lon('Sun')) < 0) == is_day
        strong = bool(_self_dignities(m, ctx, gid) & {'ruler', 'exalt'})
        if not same_sect and not strong:
            continue
        gh = house_of_lon(m.lon(gid))
        dd = abs(gh - lh)
        if min(dd, 12 - dd) <= 1:
            guards += 1
    s3 = 0.0 if guards == 0 else (2.0 if guards >= 2 else 1.0)

    # s4 盘主有力:与页签 computeEminence.deriveAlmuten 逐字=上升座庙主
    # (真机实抓:搜「显赫≥8」跳盘后页签显示 5/10——曾用 almuten 胜者致两处分叉,
    # 搜索结果必须与页签同分,单源铁律凌驾「更正统」取舍)。
    asc_lord = _ruler_of_sign_idx(sign_idx(m.asc()))
    s4 = 0.0
    if house_of_lon(m.lon(asc_lord)) in _ANGULAR_HOUSES:
        s4 += 1.0
    if _self_dignities(m, ctx, asc_lord) & {'ruler', 'exalt'}:
        s4 += 1.0
    s4 = min(2.0, s4)

    # s5 四显赫点
    s5 = 0.0
    for key in ('fortuna', 'spirit', 'basis', 'exaltation'):
        lon = m.lot_lon(key)
        if house_of_lon(lon) not in _USEFUL_HOUSES:
            continue
        lord = _ruler_of_sign_idx(sign_idx(lon))
        if not (_self_dignities(m, ctx, lord) & {'exile', 'fall'}):
            s5 += 0.5
    s5 = min(2.0, round(s5 * 2) / 2.0)

    return round((s1 + s2 + s3 + s4 + s5) * 2) / 2.0


def _eval_eminence_level(params, ctx, domain):
    """显赫程度:op=gte/lte(0-10 半分制)/band(显赫≥8/显著≥6/平凡≥3/暗晦<3)。"""
    op = params.get('op') or 'band'
    if op not in ('gte', 'lte', 'band'):
        raise ValueError('eminence_level.op 需为 gte/lte/band')
    band = params.get('band')
    value = None
    if op == 'band':
        if band not in ('eminent', 'notable', 'ordinary', 'obscure'):
            raise ValueError('band 需为 eminent/notable/ordinary/obscure')
    else:
        value = float(params.get('value') if params.get('value') is not None else -1)
        if not 0 <= value <= 10:
            raise ValueError('eminence_level.value 需为 0-10')
    jd0, jd1 = domain

    def pred(jd):
        t = eminence_total(ctx.moment(jd), ctx)
        if op == 'gte':
            return t >= value
        if op == 'lte':
            return t <= value
        if band == 'eminent':
            return t >= 8
        if band == 'notable':
            return 6 <= t < 8
        if band == 'ordinary':
            return 3 <= t < 6
        return t < 3

    return _es.true_intervals(pred, jd0, jd1, _es._b_step(['Sun'], fast=True))


# ---------------------------------------------------------------------------
# antiscia(A类)/fixed_star(A类)/planetary_hour(C类)
# ---------------------------------------------------------------------------

def _eval_antiscia(params, ctx, domain):
    """映点/反映点:mirror(lonA) 与目标点合相残差求根。
    映点=180−lon(至点轴镜像)/反映点=360−lon(分点轴)。轴=回归至点/分点轴
    (恒星制下显示座名随 ayanamsa,轴本身为回归框架,docstring 声明)。"""
    planet = params.get('planet')
    ctx.swe_id(planet)
    kind = params.get('kind')
    if kind not in ('antiscia', 'contra'):
        raise ValueError('antiscia.kind 需为 antiscia/contra')
    orb = float(params.get('orb') or 1.0)
    if not 0.05 <= orb <= 5.0:
        raise ValueError('antiscia.orb 需在 0.05-5')
    point = params.get('target') or {}
    lon_fn, _decl_fn, t_speed = _es._resolve_point(point, ctx)
    jd0, jd1 = domain
    rel = _es._MAX_SPEED.get(planet, 1.0) + t_speed
    if rel > 300.0:
        step = 0.0015
    else:
        window = 2.0 * orb / max(rel, 1e-6)
        step = max(0.02, min(1.0 if rel > 1.0 else 3.0, 0.4 * window))

    def g(jd):
        m = ctx.moment(jd)
        lon = m.lon(planet)
        mirror = (180.0 - lon) if kind == 'antiscia' else (360.0 - lon)
        return abs(cores._wrap180(mirror - lon_fn(m))) - orb

    return _es.negative_intervals(g, jd0, jd1, step)


def _eval_fixed_star(params, ctx, domain):
    """恒星触发:星黄经域中点冻结一次(93 天窗内岁差+自行漂移 <0.4″,对 orb≥0.1° 判定
    可忽略,docstring 注明)→退化为固定黄经合相残差(与 point_relation fixedLon 同求解器)。"""
    star = params.get('star')
    if not star or not isinstance(star, str):
        raise ValueError('fixed_star.star 必填')
    planet_point = params.get('target') or {}
    orb = float(params.get('orb') or 1.0)
    if not 0.1 <= orb <= 5.0:
        raise ValueError('fixed_star.orb 需在 0.1-5')
    jd0, jd1 = domain
    import swisseph as _swe
    try:
        xx, _nm, _fl = _swe.fixstar_ut(star, 0.5 * (jd0 + jd1), _swe.FLG_SWIEPH)
    except Exception:
        raise ValueError('未知恒星名 {0!r}'.format(star))
    star_lon = cores._norm360(xx[0])
    lon_fn, _decl_fn, t_speed = _es._resolve_point(planet_point, ctx)
    rel = max(t_speed, 1e-6)
    window = 2.0 * orb / rel
    step = 0.0015 if rel > 300.0 else max(0.02, min(3.0, 0.4 * window))

    def g(jd):
        m = ctx.moment(jd)
        return abs(cores._wrap180(lon_fn(m) - star_lon)) - orb

    return _es.negative_intervals(g, jd0, jd1, step)


_DAY_RULER_BY_DOW = {0: 'Moon', 1: 'Mars', 2: 'Mercury', 3: 'Jupiter',
                     4: 'Venus', 5: 'Saturn', 6: 'Sun'}
_CHALDEAN_DESC = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']


def _zone_hours(zone):
    s = str(zone or '+00:00')
    sign = -1.0 if s.startswith('-') else 1.0
    body = s.lstrip('+-')
    hh, mm = (body.split(':') + ['0'])[:2]
    return sign * (int(hh) + int(mm) / 60.0)


def _eval_planetary_hour(params, ctx, domain):
    """行星时(C 类生成式):rise_trans 视升落事件流 → 昼弧/夜弧各 12 不等分 →
    值日星(日出 civil 星期)起迦勒底降序轮替(compute_planetary_hours 同表)。
    极区无升降日=该日零区间(古典行星时无定义,不抛)。"""
    import swisseph as _swe
    kind = params.get('kind')
    planet = params.get('planet')
    if kind not in ('hour_ruler', 'day_ruler'):
        raise ValueError('planetary_hour.kind 需为 hour_ruler/day_ruler')
    if planet not in cores.SEVEN:
        raise ValueError('planetary_hour.planet 需为七政')
    jd0, jd1 = domain
    geopos = (ctx.lon, ctx.lat, ctx.alt)

    def next_evt(jd, which):
        try:
            res, tret = _swe.rise_trans(jd, _swe.SUN, which, geopos, 0.0, 0.0, _swe.FLG_SWIEPH)
        except _swe.Error:
            return None
        if res == 0 and tret and tret[0]:
            return tret[0]
        return None

    rises = []
    t = jd0 - 1.5
    for _g in range(int(jd1 - jd0) + 8):
        nxt = next_evt(t, _swe.CALC_RISE)
        if nxt is None or nxt <= t:
            break
        if nxt > jd1 + 1.8:
            rises.append(nxt)
            break
        rises.append(nxt)
        t = nxt + 1e-4
    out = []
    for i in range(len(rises) - 1):
        sr, sr_next = rises[i], rises[i + 1]
        if sr_next <= jd0 or sr >= jd1:
            continue
        # civil 星期按当地时区(compute_planetary_hours 同式 sr+zone/24;UT 直取会错一天)
        dow = _swe.day_of_week(sr + _zone_hours(ctx.zone) / 24.0)
        day_ruler = _DAY_RULER_BY_DOW[dow]
        if kind == 'day_ruler':
            if day_ruler == planet:
                out.append((max(sr, jd0), min(sr_next, jd1)))
            continue
        ss = next_evt(sr + 1e-4, _swe.CALC_SET)
        if ss is None or ss >= sr_next:
            continue
        start_idx = _CHALDEAN_DESC.index(day_ruler)
        day_len = (ss - sr) / 12.0
        night_len = (sr_next - ss) / 12.0
        for k in range(24):
            ruler = _CHALDEAN_DESC[(start_idx + k) % 7]
            if ruler != planet:
                continue
            if k < 12:
                s, e = sr + k * day_len, sr + (k + 1) * day_len
            else:
                s, e = ss + (k - 12) * night_len, ss + (k - 11) * night_len
            s, e = max(s, jd0), min(e, jd1)
            if e > s:
                out.append((s, e))
    return _es.norm_intervals(out)


# ---------------------------------------------------------------------------
# lifespan_state:寿命格局体系(lifespanEngine.js 逐字:三法 Hyleg/Alcocoden/盘主体系/医疗危机)
# ---------------------------------------------------------------------------

# APHETIC_RULES/HYLEG_CANDIDATE_ORDER 与前端 lifespanData.js 逐字(双端锁定勿单侧改)
_APHETIC_RULES = {
    'ptolemy': {'houses': {10: 5, 1: 4, 11: 3, 7: 2, 9: 1},
                'gender_houses': (), 'use_gender': False, 'five_degree': False, 'downgrade': False},
    'alcabitius': {'houses': {10: 5, 1: 4, 11: 3, 7: 2, 8: 1, 9: 1},
                   'gender_houses': (7, 8, 9), 'use_gender': False, 'five_degree': True, 'downgrade': False},
    'dorotheus': {'houses': {10: 5, 1: 4, 11: 3, 7: 2, 9: 1},
                  'gender_houses': (), 'use_gender': True, 'five_degree': False, 'downgrade': True},
}
_HYLEG_ORDER = {
    'day': ('sun', 'moon', 'asc', 'fortune', 'syzygy'),
    'night': ('moon', 'sun', 'asc', 'fortune', 'syzygy'),
}
_SIGN_ASPECT_BY_DIST = {0: 0, 2: 60, 3: 90, 4: 120, 6: 180}
_LIFE_DIG_ORDER = ('ruler', 'exalt', 'term', 'trip', 'face')   # Bonatti 序(trip=sect 单主)


def _life_points(m, ctx):
    off = ctx.ayanamsa_deg(m.jd)
    return {
        'sun': m.lon('Sun') - off, 'moon': m.lon('Moon') - off,
        'asc': m.asc() - off, 'fortune': m.lot_lon('fortuna') - off,
        'syzygy': m.syzygy_lon() - off,
    }


def _sign_aspect(lon_a, lon_b):
    d = abs(int(cores._norm360(lon_a) // 30.0) - int(cores._norm360(lon_b) // 30.0))
    d = min(d, 12 - d)
    return _SIGN_ASPECT_BY_DIST.get(d)


def _life_lords(lon_sid, is_day):
    """某点五尊贵主星(trip=宗派单主,寿命法口径;与 §almuten 的三 trip 各计不同)。"""
    from flatlib.dignities import essential as _ess
    sign = _es._SIGN_NAMES[int(cores._norm360(lon_sid) // 30.0)]
    dig = _ess.getInfo(sign, cores._norm360(lon_sid) % 30.0)
    return {
        'ruler': dig.get('ruler'), 'exalt': dig.get('exalt'),
        'trip': dig.get('dayTrip') if is_day else dig.get('nightTrip'),
        'term': dig.get('term'), 'face': dig.get('face'),
    }


def _life_state(m, ctx, method):
    """返回 {'hyleg': key|None, 'alcocoden': pid|None, 'oikodespotes', 'kurios', 'afflicted'}。"""
    is_day = m.is_diurnal(ctx.eff.get('sectBuffer') or 'geo')
    rule = _APHETIC_RULES[method]
    pts = _life_points(m, ctx)
    cusps = m.houses()
    off = ctx.ayanamsa_deg(m.jd)

    def house_of(lon_sid):
        return _es._house_index(cores._norm360(lon_sid + off), cusps, ctx.house_advance())

    def gender_of(lon_sid):
        return 'masculine' if int(cores._norm360(lon_sid) // 30.0) % 2 == 0 else 'feminine'

    def pref_of(key):
        return 'masculine' if key == 'sun' else ('feminine' if key == 'moon' else None)

    def aphetic(key):
        lon = pts[key]
        h = house_of(lon)
        if rule['five_degree']:
            nxt = (h % 12) + 1
            nc = cusps[nxt - 1]
            d = cores._wrap180(nc - cores._norm360(lon + off))
            if 0 < d <= 5:
                h = nxt
        if h not in rule['houses']:
            return False, h
        if h in rule['gender_houses']:
            pref = pref_of(key)
            if pref and gender_of(lon) != pref:
                return False, h
        if rule['use_gender']:
            pref = pref_of(key)
            if pref and gender_of(lon) != pref:
                return False, h
        return True, h

    def alcocoden_for(hy_key):
        lords = _life_lords(pts[hy_key], is_day)
        for dig in _LIFE_DIG_ORDER:
            pid = lords.get(dig)
            if pid not in cores.SEVEN:
                continue
            if _sign_aspect(cores._norm360(m.lon(pid) - off), pts[hy_key]) is not None:
                return pid
        return None

    hyleg = None
    for key in _HYLEG_ORDER['day' if is_day else 'night']:
        ok, _h = aphetic(key)
        if not ok:
            continue
        if rule['downgrade'] and alcocoden_for(key) is None:
            continue
        hyleg = key
        break

    alc = alcocoden_for(hyleg) if hyleg else None
    oiko = None
    if hyleg:
        oiko = cores._DOMICILE_BY_SIGN[int(cores._norm360(pts[hyleg]) // 30.0) % 12]
    # kurios=寿命法 almuten(五点×DIG_W 单 trip+宫位分,平分七政首序)
    totals = {pid: 0 for pid in cores.SEVEN}
    digw = {'ruler': 5, 'exalt': 4, 'trip': 3, 'term': 2, 'face': 1}
    for key in ('sun', 'moon', 'asc', 'fortune', 'syzygy'):
        lords = _life_lords(pts[key], is_day)
        for dig, w in digw.items():
            pid = lords.get(dig)
            if pid in totals:
                totals[pid] += w
    for pid in cores.SEVEN:
        hn = _es._house_index(m.lon(pid), cusps, ctx.house_advance())
        totals[pid] += _HOUSE_SCORES_N.get(hn, 0)
    kurios = max(totals.items(), key=lambda kv: kv[1])[0]
    afflicted = False
    if hyleg:
        for mid in ('Mars', 'Saturn'):
            asp = _sign_aspect(cores._norm360(m.lon(mid) - off), pts[hyleg])
            if asp in (0, 90, 180):
                afflicted = True
                break
    return {'hyleg': hyleg, 'alcocoden': alc, 'oikodespotes': oiko,
            'kurios': kurios, 'afflicted': afflicted}


def _eval_lifespan_state(params, ctx, domain):
    """寿命格局(item 制):生命主三法/寿主星/占控·家主·盘主/医疗危机受克。
    整宫相照口径;五度规则限 alcabitius;寿数年数不做条件(预测数值非择日征象)。"""
    item = params.get('item')
    items = ('hyleg_is', 'alcocoden_is', 'epikratetor_is', 'oikodespotes_is',
             'kurios_is', 'medical_crisis')
    if item not in items:
        raise ValueError('lifespan_state.item 需为 {0}'.format('/'.join(items)))
    method = params.get('method') or 'ptolemy'
    if method not in _APHETIC_RULES:
        raise ValueError('method 需为 ptolemy/alcabitius/dorotheus')
    point = params.get('point')
    planet = params.get('planet')
    if item in ('hyleg_is', 'epikratetor_is'):
        if point not in ('sun', 'moon', 'asc', 'fortune', 'syzygy', 'none'):
            raise ValueError('point 需为 sun/moon/asc/fortune/syzygy/none')
    if item in ('alcocoden_is', 'oikodespotes_is', 'kurios_is'):
        if planet != 'none' and planet not in cores.SEVEN:
            raise ValueError('planet 需为七政或 none')
    jd0, jd1 = domain

    def pred(jd):
        st = _life_state(ctx.moment(jd), ctx, method)
        if item in ('hyleg_is', 'epikratetor_is'):
            return (st['hyleg'] or 'none') == point
        if item == 'alcocoden_is':
            return (st['alcocoden'] or 'none') == planet
        if item == 'oikodespotes_is':
            return (st['oikodespotes'] or 'none') == planet
        if item == 'kurios_is':
            return st['kurios'] == planet
        return bool(st['afflicted'])

    return _es.true_intervals(pred, jd0, jd1, _es._b_step(['Sun'], fast=True))


EVALUATORS = {
    'antiscia': _eval_antiscia,
    'lifespan_state': _eval_lifespan_state,
    'fixed_star': _eval_fixed_star,
    'planetary_hour': _eval_planetary_hour,
    'light_dynamics': _eval_light_dynamics,
    'royal_attendance': _eval_royal_attendance,
    'sect_joy': _eval_sect_joy,
    'degree_state': _eval_degree_state,
    'decan_state': _eval_decan_state,
    'pattern_overview': _eval_pattern_overview,
    'dispositor_cycle': _eval_dispositor_cycle,
    'almuten_is': _eval_almuten_is,
    'distribution_state': _eval_distribution_state,
    'temperament': _eval_temperament,
    'accidental_score': _eval_accidental_score,
    'classical_pattern': _eval_classical_pattern,
    'eminence_level': _eval_eminence_level,
}


# ---------------------------------------------------------------------------
# explain:单时刻逐叶判读(R4)。pass 判定=在微域上跑**同一求值器**(与扫描绝对同源,
# 机械保证「搜到的时刻点开逐条全真」);actual=每类实测文本(32 类全覆盖,契约测试锁全)。
# ---------------------------------------------------------------------------

_SIGN_CN = ('白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼')
_PLANET_CN = {'Sun': '日', 'Moon': '月', 'Mercury': '水', 'Venus': '金', 'Mars': '火',
              'Jupiter': '木', 'Saturn': '土', 'Uranus': '天', 'Neptune': '海', 'Pluto': '冥',
              'North Node': '北交', 'South Node': '南交', 'Chiron': '凯龙'}


def _cn(pid):
    return _PLANET_CN.get(pid, pid or '')


def _fmt_pos(m, ctx, pid):
    lon = _es._sid_lon(m, pid, ctx)
    d = lon % 30.0
    return '{0}在{1} {2}°{3:02d}′'.format(_cn(pid), _SIGN_CN[int(lon // 30.0)],
                                          int(d), int(round((d - int(d)) * 60)) % 60)


def _leaf_actual(m, ctx, leaf):
    """单叶实测文本(设定 vs 实际 的「实际」列)。求值异常返回描述而非抛。"""
    t = leaf.get('type')
    p = leaf.get('params') or {}
    try:
        if t == 'aspect':
            a, b = p['planetA'], p['planetB']
            d = cores._dist(m.lon(a), m.lon(b))
            rel = m.lonspeed(a) - m.lonspeed(b)
            res = d - float(p.get('angle') or 0)
            motion = '入相位' if (res > 0) == (rel < 0) else '出相位'
            return '{0}—{1} 角距 {2:.2f}°(距 {3}° 差 {4:.2f}°)·{5}'.format(
                _cn(a), _cn(b), d, p.get('angle'), abs(res), motion)
        if t == 'in_sign':
            return _fmt_pos(m, ctx, p['planet'])
        if t == 'in_house':
            hn = _es._house_index(m.lon(p['planet']), m.houses(), ctx.house_advance())
            return '{0}在 {1} 宫'.format(_cn(p['planet']), hn)
        if t in ('reception', 'mutual_reception'):
            a, b = p['planetA'], p['planetB']
            dyn = m.dynamics()
            ab = dyn.inDignities(b, a)
            ba = dyn.inDignities(a, b)
            return '{0}位含{1}尊贵:{2};{3}位含{4}尊贵:{5}'.format(
                _cn(b), _cn(a), '/'.join(ab) or '无', _cn(a), _cn(b), '/'.join(ba) or '无')
        if t == 'rulership':
            key = p['planetB'] if p.get('mode') == 'rules' else p['planetA']
            lon = _es._sid_lon(m, key, ctx)
            ruler = cores._DOMICILE_BY_SIGN[int(lon // 30.0) % 12]
            return '{0}落{1},庙主={2}'.format(_cn(key), _SIGN_CN[int(lon // 30.0)], _cn(ruler))
        if t == 'dignity_state':
            digs = _self_dignities(m, ctx, p['planet'])
            sp = m.lonspeed(p['planet'])
            return '{0} 尊贵:{1};速 {2:+.3f}°/日'.format(
                _cn(p['planet']), '/'.join(sorted(digs)) or '无', sp)
        if t == 'considerations':
            lon = _es._sid_lon(m, 'Moon', ctx)
            return '月速 {0:.2f}°/日;{1}'.format(abs(m.lonspeed('Moon')), _fmt_pos(m, ctx, 'Moon'))
        if t == 'besieged':
            lons = {pid: m.lon(pid) for pid in cores.SEVEN}
            comp = cores._companions_core(lons, p['target'])
            return '{0} 前={1} 后={2}'.format(_cn(p['target']),
                                             _cn(comp['firstOccidental']), _cn(comp['firstOriental']))
        if t in ('aspect_pattern', 'chart_shape'):
            return '盘面七政:' + ' '.join(
                '{0}{1:.0f}°'.format(_cn(pid), m.lon(pid)) for pid in cores.SEVEN)
        if t == 'point_relation':
            lon_fn, decl_fn, _sp = _es._resolve_point(p.get('point') or {}, ctx)
            if p.get('relation') in ('parallel', 'contraparallel'):
                da = m.equatorial(p['planet'])['decl']
                dt_ = decl_fn(m)
                return '赤纬 {0:+.2f}° vs {1:+.2f}°'.format(da, dt_)
            d = cores._dist(m.lon(p['planet']), lon_fn(m))
            return '{0}与点角距 {1:.2f}°'.format(_cn(p['planet']), d)
        if t == 'numeric':
            v = _es._numeric_value(m, p['planet'], _es._NUMERIC_FIELDS[p['field']]['kind'],
                                   p.get('altitudeKind') or 'true')
            return '{0} {1} = {2:.4f}'.format(_cn(p['planet']), p['field'], v)
        if t == 'midpoint':
            la = m.lon(p['a'])
            lb = m.lon(p.get('b') or p['a'])
            mid = cores._norm360(la + cores._wrap180(lb - la) / 2.0)
            return '中点 {0:.2f}°'.format(mid)
        if t == 'day_window':
            rec = _es.date_time_from_jd(m.jd, ctx.zone)
            return '当地时刻 {0}'.format(rec['datetime'][11:16])
        if t == 'light_dynamics':
            bodies = _snap_for_light(m, ctx)
            node_lon = m.planet('North Node')['lon'] if p.get('item') == 'bending' else None
            res = cores._light_dynamics_core(bodies, node_lon=node_lon,
                                             void_classical=bool(p.get('voidClassical')),
                                             mean_speed=_mean_speed_table())
            recs = res.get(p.get('item')) or []
            if not recs:
                return '此刻无该学说记录'
            def fmt(r):
                return '·'.join('{0}={1}'.format(k, _cn(v) if v in _PLANET_CN else v)
                                for k, v in list(r.items())[:4])
            return ';'.join(fmt(r) for r in recs[:3])
        if t == 'royal_attendance':
            lons = {pid: m.lon(pid) for pid in cores.SEVEN}
            comp = cores._companions_core(lons, p['ref'])
            return '{0} 第一西没={1},第一东升={2}'.format(
                _cn(p['ref']), _cn(comp['firstOccidental']), _cn(comp['firstOriental']))
        if t == 'sect_joy':
            is_day = m.is_diurnal(ctx.eff.get('sectBuffer') or 'geo')
            if p.get('item') == 'diurnal':
                return '昼盘' if is_day else '夜盘'
            pid = p.get('planet')
            if p.get('item') == 'hayyiz':
                return '{0} 得时档={1}'.format(_cn(pid), _hayyiz_level(m, ctx, pid, is_day))
            if p.get('item') == 'house_joy':
                return '{0} 整宫 {1} 宫(喜乐宫 {2})'.format(_cn(pid), m.whole_sign_house(pid), _JOY_HOUSE.get(pid))
            return _fmt_pos(m, ctx, pid) + (';昼盘' if is_day else ';夜盘')
        if t == 'pattern_overview':
            need = ('node', 'houses', 'rules', 'above', 'sect')
            snap = _seven_snapshot(m, ctx, need=need)
            link_recs, link_pairs = _link_records(m, ctx)
            loops = cores._dispositors_core({pid: snap['bodies'][pid]['sign_idx']
                                             for pid in cores.SEVEN})['loops']
            if p.get('item') == 'strong_jupiter':
                snap['bodies']['Jupiter']['lit'] = _jupiter_lit(m, ctx)
            ov = cores._pattern_overview_core(snap['bodies'], snap.get('node_lon'),
                                              snap.get('is_day', False), link_pairs, link_recs, loops)
            item = p.get('item')
            if item in ('dragon_embrace', 'dragon_intercept'):
                d = ov['dragon']
                return '龙脉:{0}'.format(d.get('kind') or '分布均衡') + (
                    '·孤星' + _cn(d['lone']) if d.get('lone') else '')
            if item == 'lone_moon':
                return '孤月独明' if ov['lone_moon'] else '非孤月'
            if item in ('apriori_power', 'eight_kill'):
                ls = ov['apriori']['links']
                return '联结:' + (';'.join('{0}-{1}({2})'.format(_cn(x['a']), _cn(x['b']), x['which'])
                                          for x in ls[:3]) or '无')
            if item == 'strong_jupiter':
                j = ov['jupiter']
                return '木星{0}·照耀{1}星'.format('强吉' if j.get('strong') else '非强吉', j.get('litCount'))
            if item == 'afflicted_ruler':
                return '后天凶星:' + ('/'.join(_cn(x) for x in ov['afflicted']) or '无')
            ss = ov['sentients']
            return '有情联结:' + (';'.join('{0}-{1}·{2}'.format(_cn(x['a']), _cn(x['b']),
                                                              x['purity'].get('realm'))
                                         for x in ss[:3]) or '无')
        if t == 'dispositor_cycle':
            snap = _seven_snapshot(m, ctx)
            res = cores._dispositors_core({pid: snap['bodies'][pid]['sign_idx']
                                           for pid in cores.SEVEN})
            return '终极主宰:{0};环:{1}'.format(
                '/'.join(_cn(x) for x in sorted(res['finals'])) or '无',
                ';'.join('-'.join(_cn(y) for y in lp) for lp in res['loops']) or '无')
        if t == 'almuten_is':
            if p.get('scope') == 'topic':
                off = ctx.ayanamsa_deg(m.jd)
                cusp = m.houses()[int(p.get('house') or 1) - 1]
                scores = _dig_scores_at(cusp - off)
                seq = [(pid, scores[pid]) for pid in cores.SEVEN if pid in scores]
                w = max(seq, key=lambda kv: kv[1])[0] if seq else None
                return '第{0}宫题主星={1}'.format(p.get('house'), _cn(w))
            winner, totals = _almuten_winner(m, ctx)
            return '盘主={0}({1}分)'.format(_cn(winner), totals[winner])
        if t == 'distribution_state':
            return '分布实况见比较值'  # 详值下方通用行给
        if t == 'temperament':
            from flatlib.protocols.temperament import Temperament
            sc = Temperament(m.flatchart()).getScore()
            tb = sc['temperaments'] if p.get('kind') == 'temperament' else sc['qualities']
            return ' '.join('{0}{1}'.format(k[:4], v) for k, v in tb.items())
        if t == 'accidental_score':
            return '{0} 偶然分={1}'.format(_cn(p['planet']), _accidental_score_at(m, ctx, p['planet']))
        if t == 'classical_pattern':
            want = 'besieging' if p.get('pattern') == 'besieging_degree' else p.get('pattern')
            hits = _classical_hits(m, ctx, want)
            return '命中:' + ('; '.join(str({k: _cn(v) if v in _PLANET_CN else v
                                            for k, v in h.items()}) for h in hits[:3]) or '无')
        if t == 'eminence_level':
            tt = eminence_total(m, ctx)
            band = '显赫' if tt >= 8 else ('显著' if tt >= 6 else ('平凡' if tt >= 3 else '暗晦'))
            return '显赫 {0}/10·{1}'.format(tt, band)
        if t == 'lifespan_state':
            st = _life_state(m, ctx, p.get('method') or 'ptolemy')
            return '生命主={0};寿主={1};家主={2};盘主={3}{4}'.format(
                st['hyleg'] or '无', _cn(st['alcocoden']) if st['alcocoden'] else '无',
                _cn(st['oikodespotes']) if st['oikodespotes'] else '无', _cn(st['kurios']),
                ';受克' if st['afflicted'] else '')
        if t == 'degree_state':
            from astrostudy import classical_tables as ct
            lon = _es._sid_lon(m, p['planet'], ctx)
            sign = _es._SIGN_NAMES[int(lon // 30.0)]
            rec = ct.mansion_of(lon)
            return '{0};第{1}宿;单度主={2};Darijan={3};度质={4}'.format(
                _fmt_pos(m, ctx, p['planet']), rec['idx'] if rec else '?',
                _cn(ct.monomoiria_ruler(lon)), _cn(ct.darijan_ruler(sign, lon % 30.0)),
                ct.degree_quality(sign, lon % 30.0) or '-')
        if t == 'decan_state':
            off = ctx.ayanamsa_deg(m.jd)
            if p.get('mode') == 'talisman':
                asc_d = int(cores._norm360(m.asc() - off) // 10.0) + 1
                moon_d = int(cores._norm360(m.lon('Moon') - off) // 10.0) + 1
                return 'ASC第{0}旬;月第{1}旬'.format(asc_d, moon_d)
            lon = _es._sid_lon(m, p['planet'], ctx)
            from flatlib.dignities import essential as _ess2
            face = _ess2.getInfo(_es._SIGN_NAMES[int(lon // 30.0)], lon % 30.0).get('face')
            return '{0} 第{1}旬·旬主{2}'.format(_cn(p['planet']), int(lon // 10.0) + 1, _cn(face))
        if t == 'antiscia':
            lon = m.lon(p['planet'])
            mirror = (180.0 - lon) if p.get('kind') == 'antiscia' else (360.0 - lon)
            lon_fn, _d, _s = _es._resolve_point(p.get('target') or {}, ctx)
            d = abs(cores._wrap180(cores._norm360(mirror) - lon_fn(m)))
            return '映点 {0:.2f}°,与目标差 {1:.2f}°'.format(cores._norm360(mirror), d)
        if t == 'fixed_star':
            import swisseph as _swe
            xx, _n, _f = _swe.fixstar_ut(p['star'], m.jd, _swe.FLG_SWIEPH)
            lon_fn, _d, _s = _es._resolve_point(p.get('target') or {}, ctx)
            d = abs(cores._wrap180(lon_fn(m) - cores._norm360(xx[0])))
            return '{0} {1:.2f}°,与点差 {2:.2f}°'.format(p['star'], cores._norm360(xx[0]), d)
        if t == 'planetary_hour':
            ivs = _eval_planetary_hour({'kind': 'hour_ruler', 'planet': p['planet']},
                                       ctx, (m.jd - 0.02, m.jd + 0.02))
            now = any(s <= m.jd < e for s, e in ivs)
            return '{0} 此刻{1}值时'.format(_cn(p['planet']), '' if now else '非')
        return '—'
    except Exception as exc:   # 实测文本永不炸详情面板
        return '实测不可得({0})'.format(exc)


def explain_tree(tree, ctx, jd):
    """逐节点判读:pass=同 evaluator 微域自证([jd−1min, jd+2min] 区间含 jd);
    组=子节点按门聚合。返回与条件树同构的 {kind,op,pass,actual,children}。"""
    m = ctx.moment(jd)
    lo, hi = jd - 1.0 / 1440.0, jd + 2.0 / 1440.0

    def leaf_pass(leaf):
        fn = _es._EVALUATORS.get(leaf.get('type'))
        if fn is None:
            return False
        try:
            ivs = fn(leaf.get('params') or {}, ctx, (lo, hi))
        except Exception:
            return False
        return any(s <= jd < e or (s <= jd <= e) for s, e in ivs)

    def walk(node):
        if not isinstance(node, dict):
            return {'kind': 'leaf', 'pass': False, 'actual': '非法节点'}
        if node.get('type') in _es.GROUP_TYPES:
            kids = [walk(c) for c in (node.get('conditions') or [])]
            op = node['type']
            vals = [k['pass'] for k in kids]
            if op == 'all':
                ok = all(vals) and bool(vals)
            elif op == 'any':
                ok = any(vals)
            elif op == 'not':
                ok = not (vals[0] if vals else False)
            else:
                ok = (sum(1 for v in vals if v) % 2) == 1
            return {'kind': 'group', 'op': op, 'pass': ok, 'children': kids}
        return {'kind': 'leaf', 'type': node.get('type'), 'pass': leaf_pass(node),
                'actual': _leaf_actual(m, ctx, node)}

    return walk(tree)
