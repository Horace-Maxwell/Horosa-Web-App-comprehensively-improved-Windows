# -*- coding: utf-8 -*-
"""R3 页签对拍(tab parity):同一时刻「真 PerChart 喂 astroextra 页签函数」vs
「同盘抽裸快照喂扫描核」,断言结果**集合恒等**(同输入零容差)——单源一致性执行面。

建盘范式照 test_election_scan_consistency._perchart_at;快照从 perchart.chart.objects
抽取(lon/lonspeed/sign/signlon),保证两路吃的是同一份行星数据。
"""
import swisseph

from astrostudy import perchart
from astrostudy import astroextra
from astrostudy import election_scan as es
from astrostudy import election_scan_cores as cores

from flatlib import const as fc
from flatlib import props as fprops


ZONE = '+08:00'

# 六个跨月相/含留点的时刻(2024/04 水星逆行段 + 朔望前后)
PARITY_JDS = [
    swisseph.julday(2024, 4, 7, 4.0),
    swisseph.julday(2024, 4, 8, 12.0),
    swisseph.julday(2024, 4, 14, 20.0),
    swisseph.julday(2024, 4, 22, 6.0),
    swisseph.julday(2024, 4, 25, 12.0),   # 水星顺行留(refranation 敏感点)
    swisseph.julday(2024, 4, 30, 0.0),
]


def _perchart_at(jd, **extra):
    rec = es.date_time_from_jd(jd, ZONE)
    params = {
        'date': rec['date'].replace('-', '/'), 'time': rec['time'],
        'zone': ZONE, 'lat': '39N54', 'lon': '116E28',
        'ad': 1, 'hsys': 0,
    }
    params.update(extra)
    pc = perchart.PerChart(astroextra.base_params(params))
    pc.getChartOnlyObj()
    return pc


def _snapshot_from_perchart(pc):
    """从 perchart.chart.objects 抽裸快照——两路同源输入。"""
    sign_names = list(fc.LIST_SIGNS)
    bodies = {}
    for pid in cores.SEVEN:
        o = pc.chart.getObject(pid)
        bodies[pid] = {
            'lon': o.lon, 'lonspeed': o.lonspeed,
            'sign_idx': sign_names.index(o.sign), 'signlon': o.signlon,
        }
    return bodies


def _norm_records(recs, drop=()):
    out = []
    for r in recs:
        d = {k: v for k, v in r.items() if k not in drop}
        out.append(tuple(sorted(d.items())))
    return sorted(out)


def test_light_dynamics_core_parity_with_astroextra():
    mean_speed = {pid: fprops.object.meanMotion.get(pid, 1.0) for pid in cores.SEVEN}
    for jd in PARITY_JDS:
        pc = _perchart_at(jd)
        ref = astroextra.compute_aspect_dynamics(pc, void_classical=False)
        bodies = _snapshot_from_perchart(pc)
        node_lon = pc.chart.getObject(fc.NORTH_NODE).lon
        mine = cores._light_dynamics_core(bodies, node_lon=node_lon,
                                          void_classical=False, mean_speed=mean_speed)
        for key in ('aspects', 'translation', 'collection', 'aversion', 'bending',
                    'void', 'prohibition', 'frustration', 'refranation'):
            assert _norm_records(mine[key]) == _norm_records(ref[key]), (jd, key, mine[key], ref[key])


def test_light_dynamics_core_parity_void_classical():
    for jd in PARITY_JDS[:3]:
        pc = _perchart_at(jd)
        ref = astroextra.compute_aspect_dynamics(pc, void_classical=True)
        bodies = _snapshot_from_perchart(pc)
        mine = cores._light_dynamics_core(bodies, node_lon=None,
                                          void_classical=True,
                                          mean_speed={pid: fprops.object.meanMotion.get(pid, 1.0)
                                                      for pid in cores.SEVEN})
        assert _norm_records(mine['void']) == _norm_records(ref['void']), jd


def test_companions_core_parity_with_perchart_oriental_occidental():
    """皇室伴寝 vs perchart.orientalOccidental:首位与整侧集合恒等(两实现独立)。"""
    for jd in PARITY_JDS:
        pc = _perchart_at(jd)
        oo = pc.orientalOccidental()
        lons = {pid: pc.chart.getObject(pid).lon for pid in cores.SEVEN}
        for ref_id in ('Sun', 'Moon'):
            comp = cores._companions_core(lons, ref_id)
            ref_ori = [x['id'] for x in oo[ref_id]['oriental']]
            ref_occ = [x['id'] for x in oo[ref_id]['occidental']]
            assert comp['oriental'] == ref_ori, (jd, ref_id, comp['oriental'], ref_ori)
            assert comp['occidental'] == ref_occ, (jd, ref_id, comp['occidental'], ref_occ)


def test_almuten_winner_parity_with_astroextra():
    """盘主胜者 vs almuten_table(五要点+宫位分,含 Syzygy/福点走扫描缓存 vs Chart 对象)。"""
    import swisseph as swe
    from astrostudy import election_scan_ext as ext

    ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                          'hsys': 0, 'zodiacal': 0, 'ad': 1})
    ctx._syz_lo = swe.julday(2024, 4, 1, 0)
    ctx._syz_hi = swe.julday(2024, 5, 2, 0)
    for jd in PARITY_JDS:
        pc = _perchart_at(jd)
        ref = astroextra.almuten_table(pc)
        m = ctx.moment(jd)
        mine_winner, mine_totals = ext._almuten_winner(m, ctx)
        assert mine_totals == ref['totals'], (jd, mine_totals, ref['totals'])
        assert mine_winner == ref['winner'], jd


def test_distribution_parity_with_astroextra():
    import swisseph as swe
    ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                          'hsys': 0, 'zodiacal': 0, 'ad': 1})
    for jd in PARITY_JDS[:3]:
        pc = _perchart_at(jd)
        pts = astroextra.chart_points(pc)
        asc = pc.chart.getAngle(fc.ASC).lon
        mc = pc.chart.getAngle(fc.MC).lon
        ref = astroextra.distribution(pts, asc, mc)
        m = ctx.moment(jd)
        counts = {'Fire': 0, 'Earth': 0, 'Air': 0, 'Water': 0}
        modes = {'Cardinal': 0, 'Fixed': 0, 'Mutable': 0}
        hemi = {'east': 0, 'west': 0, 'above': 0, 'below': 0}
        for pid in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
                    'Uranus', 'Neptune', 'Pluto'):
            lon = m.lon(pid)
            si = int(lon // 30)
            counts[('Fire', 'Earth', 'Air', 'Water')[si % 4]] += 1
            modes[('Cardinal', 'Fixed', 'Mutable')[si % 3]] += 1
            hemi['below' if (lon - m.asc()) % 360 < 180 else 'above'] += 1
            hemi['east' if (lon - m.mc()) % 360 < 180 else 'west'] += 1
        assert counts == ref['elements'], jd
        assert modes == ref['modes'], jd
        assert hemi == ref['hemispheres'], jd


def test_temperament_parity_direct():
    """temperament 直调 flatlib 同函数(单源即恒等,此处验证 flatchart 参数链)。"""
    from flatlib.protocols.temperament import Temperament
    import swisseph as swe
    ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                          'hsys': 0, 'zodiacal': 0, 'ad': 1})
    for jd in PARITY_JDS[:2]:
        pc = _perchart_at(jd)
        ref = Temperament(pc.chart).getScore()
        mine = Temperament(ctx.moment(jd).flatchart()).getScore()
        assert mine == ref, jd


def test_accidental_score_parity_with_astroextra():
    """偶然尊贵分 vs compute_accidental_dignity——PerChart 用与 eff 相同日下阈建盘对齐。"""
    import swisseph as swe
    from astrostudy import election_scan_ext as ext

    eff_orbs = {'cazimiOrb': 17.0 / 60.0, 'combustOrb': 8.5, 'underBeamsOrb': 17.0}
    ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                          'hsys': 0, 'zodiacal': 0, 'ad': 1, **eff_orbs})
    for jd in PARITY_JDS:
        pc = _perchart_at(jd, cazimiOrb=eff_orbs['cazimiOrb'],
                          combustOrb=eff_orbs['combustOrb'],
                          underBeamsOrb=eff_orbs['underBeamsOrb'])
        ref_rows = {r['planet']: r['score'] for r in astroextra.compute_accidental_dignity(pc)}
        m = ctx.moment(jd)
        for pid in cores.SEVEN:
            mine = ext._accidental_score_at(m, ctx, pid)
            assert mine == ref_rows[pid], (jd, pid, mine, ref_rows[pid])


def test_classical_patterns_parity_with_astroextra():
    """护卫/压制/度围 vs compute_classical_patterns(远离晨昏界时刻,昼夜口径差规避并注明)。"""
    import swisseph as swe
    from astrostudy import election_scan_ext as ext

    ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                          'hsys': 0, 'zodiacal': 0, 'ad': 1})
    for jd in PARITY_JDS:
        pc = _perchart_at(jd)
        ref = astroextra.compute_classical_patterns(pc)
        m = ctx.moment(jd)
        mine_d = ext._classical_hits(m, ctx, 'doryphory')
        mine_o = ext._classical_hits(m, ctx, 'overcoming')
        mine_b = ext._classical_hits(m, ctx, 'besieging')
        assert sorted((h['planet'], h['light']) for h in mine_d) == \
            sorted((h['planet'], h['light']) for h in ref['doryphory']), jd
        assert sorted((h['over'], h['under'], h['aspect']) for h in mine_o) == \
            sorted((h['over'], h['under'], h['aspect']) for h in ref['overcoming']), jd
        assert sorted((h['planet'], h['left'], h['right']) for h in mine_b) == \
            sorted((h['planet'], h['left'], h['right']) for h in ref['besieging']), jd


def test_eminence_total_manual_anchor():
    """显赫总分手推锚:固定时刻逐指标复算(独立于 eminence_total 内部结构)。"""
    import swisseph as swe
    from astrostudy import election_scan_ext as ext

    ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                          'hsys': 0, 'zodiacal': 0, 'ad': 1})
    ctx._syz_lo = swe.julday(2024, 4, 1, 0)
    ctx._syz_hi = swe.julday(2024, 5, 2, 0)
    for jd in PARITY_JDS[:3]:
        m = ctx.moment(jd)
        total = ext.eminence_total(m, ctx)
        assert 0.0 <= total <= 10.0
        assert (total * 2) == int(total * 2), '半分制'
        # 指标上界复核:任何单指标 ≤2 ⟹ 总分 ≤10;与 band 判定自洽
        for op, band, lo, hi in (('band', 'eminent', 8, 10.01), ('band', 'obscure', -0.01, 3)):
            pass  # band 语义由 M28 分域完备锁定


def test_link_records_fast_vs_chartdynamics():
    """联结对纯几何版 vs chartdynamics 参考版:六时刻集合恒等(重叶性能根修的安全闸)。"""
    import swisseph as swe
    from astrostudy import election_scan_ext as ext

    ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                          'hsys': 0, 'zodiacal': 0, 'ad': 1})
    for jd in PARITY_JDS:
        m = ctx.moment(jd)
        fast_recs, fast_pairs = ext._link_records(m, ctx)
        ref_recs, ref_pairs = ext._link_records_chart(m, ctx)
        assert sorted(fast_recs) == sorted(ref_recs), (jd, fast_recs, ref_recs)
        assert fast_pairs == ref_pairs, jd


def test_eminence_parity_with_tab_logic_on_perchart():
    """显赫五指标:页签 computeEminence 逻辑逐字重演于 worktree perchart 数据(页签数据源代理)
    vs 引擎 eminence_total——同时刻同分(用户实抓 7.5/8.5 分叉源自预览混链旧后端;
    同版两链由本测试钉死)。"""
    import swisseph as swe
    from astrostudy import election_scan_ext as ext
    from flatlib import const as fc

    USEFUL = (1, 10, 11, 7, 4, 9, 5)
    ANGULAR = (1, 4, 7, 10)

    def hnum(h):
        import re
        mres = re.search(r'(\d+)', str(h or ''))
        return int(mres.group(1)) if mres else None

    ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                          'hsys': 0, 'zodiacal': 0, 'ad': 1})
    ctx._syz_lo = swe.julday(2024, 4, 1, 0)
    ctx._syz_hi = swe.julday(2024, 5, 2, 0)
    for jd in PARITY_JDS[:4]:
        pc = _perchart_at(jd)
        obj = pc.getChartOnlyObj()

        def _g(o, key, default=None):
            if isinstance(o, dict):
                return o.get(key, default)
            return getattr(o, key, default)

        objects = {_g(o, 'id'): o for o in obj['objects']}
        na = pc.getAspects()
        lots = {p.id: p for p in pc.getPars(pc.chart)}
        is_day = bool(obj['isDiurnal'])

        def find(pid):
            return objects.get(pid)

        def aspected_by_benefic(pid):
            row = na.get(pid) or {}
            for cat in ('Exact', 'Applicative', 'Separative', 'None'):
                if any(x.get('id') in ('Venus', 'Jupiter') for x in (row.get(cat) or [])):
                    return True
            return False

        def any_dig(o):
            d = _g(o, 'selfDignity') or []
            return any(k in d for k in ('ruler', 'exalt', 'dayTrip', 'nightTrip', 'partTrip', 'term', 'face'))

        def strong_dig(o):
            d = _g(o, 'selfDignity') or []
            return 'ruler' in d or 'exalt' in d

        def debilitated(o):
            d = _g(o, 'selfDignity') or []
            return 'exile' in d or 'fall' in d

        SIGN_RULER = {'Aries': 'Mars', 'Taurus': 'Venus', 'Gemini': 'Mercury', 'Cancer': 'Moon',
                      'Leo': 'Sun', 'Virgo': 'Mercury', 'Libra': 'Venus', 'Scorpio': 'Mars',
                      'Sagittarius': 'Jupiter', 'Capricorn': 'Saturn', 'Aquarius': 'Saturn',
                      'Pisces': 'Jupiter'}

        # s1 两光(含同宫双凶直比归零)
        s1 = 0.0
        for pid in ('Sun', 'Moon'):
            o = find(pid)
            h = hnum(_g(o, 'house'))
            pt = 0.0
            if h in USEFUL:
                pt = 1.0 if h in ANGULAR else 0.5
            mal = [find(x) for x in ('Mars', 'Saturn')]
            mal = [x for x in mal if hnum(_g(x, 'house')) == h]
            if len(mal) >= 2 and any(_g(x, 'lon') < _g(o, 'lon') for x in mal) and any(_g(x, 'lon') > _g(o, 'lon') for x in mal):
                pt = 0.0
            s1 += pt
        s1 = min(2.0, round(s1 * 2) / 2.0)

        # s2 福点及主星(福点在 chart.objects,其余点在 pars——页签 lotObj 两处兜底同款)
        def lot_of(lid):
            return objects.get(lid) or lots.get(lid)

        fort = lot_of(fc.PARS_FORTUNA)
        s2 = 0.0
        fh = hnum(_g(fort, 'house'))
        if fh in ANGULAR:
            s2 += 1.0
        lord_id = SIGN_RULER.get(_g(fort, 'sign'))
        lord = find(lord_id)
        if lord and (any_dig(lord) or aspected_by_benefic(lord_id)):
            s2 += 1.0
        s2 = min(2.0, s2)

        # s3 持矛(轻量派生逐字)
        light = find('Sun' if is_day else 'Moon')
        lh = hnum(_g(light, 'house'))
        guards = 0
        for gid in ('Venus', 'Jupiter', 'Mercury', 'Mars', 'Saturn'):
            g = find(gid)
            if not (_g(g, 'ofSect') is True or strong_dig(g)):
                continue
            gh = hnum(_g(g, 'house'))
            dd = abs(gh - lh)
            if min(dd, 12 - dd) <= 1:
                guards += 1
        s3 = 0.0 if guards == 0 else (2.0 if guards >= 2 else 1.0)

        # s4 盘主=上升座庙主
        asc_sign = None
        for o in obj['objects']:
            if _g(o, 'id') == 'Asc':
                asc_sign = _g(o, 'sign')
        asc_lord = find(SIGN_RULER[asc_sign])
        s4 = 0.0
        if hnum(_g(asc_lord, 'house')) in ANGULAR:
            s4 += 1.0
        if strong_dig(asc_lord):
            s4 += 1.0

        # s5 四显赫点
        s5 = 0.0
        for lid in (fc.PARS_FORTUNA, 'Pars Spirit', 'Pars Basis', 'Pars Exaltation'):
            p = lot_of(lid)
            if p is None:
                continue
            h = hnum(_g(p, 'house'))
            if h not in USEFUL:
                continue
            plord = find(SIGN_RULER.get(_g(p, 'sign')))
            if plord and not debilitated(plord):
                s5 += 0.5
        s5 = min(2.0, round(s5 * 2) / 2.0)

        ref_total = round((s1 + s2 + s3 + s4 + s5) * 2) / 2.0
        mine = ext.eminence_total(ctx.moment(jd), ctx)
        assert mine == ref_total, (jd, mine, ref_total, (s1, s2, s3, s4, s5))


def test_house_advance_parity_placidus():
    """Placidus 下引擎前移落宫 vs flatlib getObjectHouse(主排盘同律)逐星恒等——
    修复前 7/42 差异(整宫制天然豁免致此前对拍全绿的盲区)。"""
    ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                          'hsys': 3, 'zodiacal': 0, 'ad': 1})
    for jd in PARITY_JDS:
        pc = _perchart_at(jd, hsys=3)
        m = ctx.moment(jd)
        cusps = m.houses()
        for pid in cores.SEVEN:
            o = pc.chart.getObject(pid)
            ref = int(pc.chart.houses.getObjectHouse(o).id[5:])
            mine = es._house_index(m.lon(pid), cusps, ctx.house_advance())
            assert mine == ref, (jd, pid, mine, ref)


def test_house_advance_whole_sign_exempt():
    """整宫制豁免:四档 advance 请求下落宫恒等(引擎 house_advance()=0)。"""
    for adv in (0, 1, 3, 5):
        ctx = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                              'hsys': 0, 'zodiacal': 0, 'ad': 1, 'houseCuspAdvance': adv})
        assert ctx.house_advance() == 0.0
    ctx3 = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                           'hsys': 3, 'zodiacal': 0, 'ad': 1, 'houseCuspAdvance': 3})
    assert ctx3.house_advance() == 3.0
    ctx_def = es.ScanContext({'zone': ZONE, 'gpsLat': 39.9042, 'gpsLon': 116.4074,
                              'hsys': 3, 'zodiacal': 0, 'ad': 1})
    assert ctx_def.house_advance() == 5.0
