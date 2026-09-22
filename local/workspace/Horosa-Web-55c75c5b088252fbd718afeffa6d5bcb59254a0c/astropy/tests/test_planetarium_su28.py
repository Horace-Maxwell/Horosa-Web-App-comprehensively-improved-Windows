"""
天文馆 二十八宿 = 赤道宿度(回归守护)。

二十八宿是**赤道**体系(赤道宿度):距星按其真赤经定宿、沿天赤道附近的实际星位排布,
**不是黄道**。曾有一版误把星宿标到黄道上(用 ecliptic lon 投影)被用户当场指出。本测试
钉死:默认(REAL)模式下 28 距星是真赤道坐标 —— ra 反映真赤经(普遍 ra≠lon)、decl 跨南北
两半天(真实星位),不得被压到黄道线上。

铁律②:测试与代码内不出现任何外部软件名;命例为自有测试盘。
"""
from astrostudy import perchart
from flatlib import const

CASE = {
    'date': '1994/05/21', 'time': '02:20:00', 'zone': '+08:00',
    'lat': '36N26', 'lon': '116E00', 'ad': 1, 'hsys': 'PLACIDUS',
}


def _ang_gap(a, b):
    g = abs(float(a) - float(b)) % 360
    return min(g, 360 - g)


def test_default_su28_is_equatorial_real_stars():
    # 不传 doubingSu28 -> 默认 SU28_MODE_REAL(赤道距星活体)。
    pc = perchart.PerChart(dict(CASE))
    stars = [s for s in pc.getFixedStarSu28() if s.type == const.OBJ_FIXED_STAR]
    assert len(stars) == 28
    # ra 是真赤经,普遍 != 黄经 lon(若被错当 ecliptic 处理则会 ra==lon)。
    real_ra = sum(1 for s in stars if _ang_gap(s.ra, s.lon) > 0.5)
    assert real_ra >= 20, f"only {real_ra}/28 mansions have ra!=lon — looks ecliptic, not equatorial"
    # decl 跨南北两半天(真实距星位置),不是被压平到某一条线上。
    decls = [float(s.decl) for s in stars]
    assert max(decls) > 5 and min(decls) < -5


def test_planetarium_pure_astronomy_independent_of_chart():
    """天文馆=纯天文,与星盘/七政四余绝对独立(用户铁律)。无论图表传入何种黄道模式/宿度制/岁差,
    天文馆都强制纯天文参数(zodiacal=0/doubingSu28=0/无岁差),二十八宿恒为真实距星(decl 跨南北、ra≠lon),
    绝不随图表宿度制落到黄道线上。"""
    from websrv.webplanetariumsrv import _force_pure_astronomy, _plain_obj
    # 模拟图表把恒星黄道+回归今制宿度制带进来
    polluted = dict(CASE, zodiacal=1, doubingSu28=2, siderealAyanamsa='Lahiri', guolaoZhengSidereal=1, termsVariant=2)
    forced = _force_pure_astronomy(dict(polluted))
    assert forced['zodiacal'] == 0
    assert forced['doubingSu28'] == 0
    assert forced['siderealAyanamsa'] == ''
    assert forced['guolaoZhengSidereal'] == 0
    # 据强制后的参数起盘,二十八宿是真实距星(decl 跨南北两半天,非压在黄道/赤道一条线上)
    pc = perchart.PerChart(forced)
    stars = [s for s in pc.getFixedStarSu28() if getattr(s, 'type', '') == const.OBJ_FIXED_STAR]
    assert len(stars) == 28
    decls = [float(s.decl) for s in stars]
    assert max(decls) > 5 and min(decls) < -5  # 真实距星跨南北,非一条线
    real_ra = sum(1 for s in stars if _ang_gap(s.ra, s.lon) > 0.5)
    assert real_ra >= 20  # ra 是真赤经(非黄经),证明非黄道置宿


def test_planetarium_moira_su28_not_on_equator():
    """回归守护(R6):回归今制/回归开禧/恒星制郑式 三制的 su28 在盘层是黄道点(decl=0,沿黄道置宿),
    天文馆序列化须把它们重算成真实赤道坐标——否则二十八宿全落赤道线(decl≈0)。
    默认宿度制即回归今制,访问七政后全局 doubingSu28=2 带入天文馆即触发,曾被用户当场指出。
    钉死:天文馆 _fix_moira_su28_equatorial 后 decl 不再全 0、且跨开(不在一条线上)。"""
    from websrv.webplanetariumsrv import _plain_obj, _fix_moira_su28_equatorial
    from astrostudy.perchart import (
        SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL,
    )
    for mode in (SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL):
        pc = perchart.PerChart(dict(CASE, doubingSu28=mode))
        raw = [_plain_obj(s) for s in pc.getFixedStarSu28()
               if getattr(s, 'type', '') == const.OBJ_FIXED_STAR]
        # 盘层(修复前):三制黄道置宿 → decl 普遍为 0(若此断言失败说明盘层口径变了,需复核)。
        assert sum(1 for s in raw if abs(s['decl']) < 0.01) >= 20, \
            f"mode {mode}: expected ecliptic-placed su28 (decl~0) at chart level"
        # 天文馆修复后:decl 不得全 0,且南北跨开(真实天球散布,绝不全落赤道线)。
        fixed = _fix_moira_su28_equatorial([dict(s) for s in raw], mode, pc.dateTime.jd)
        decls = [s['decl'] for s in fixed]
        nonzero = sum(1 for d in decls if abs(d) > 0.5)
        assert nonzero == len(decls), \
            f"mode {mode}: {len(decls)-nonzero} su28 still on equator (decl~0) after planetarium fix"
        assert max(decls) > 5, f"mode {mode}: su28 decl never reaches north ({max(decls):.1f})"
        # ra 也须被重算成真赤经(不再等于黄经 lon)。
        real_ra = sum(1 for s in fixed if _ang_gap(s['ra'], s['lon']) > 0.5)
        assert real_ra >= 20, f"mode {mode}: only {real_ra}/28 have ra!=lon after fix"


def test_true_distance_stars_attached_for_wei_and_gui():
    """[Q-371/T-350] 胃宿 / 鬼宿星点:后端给 trueStar(35 Ari HR801 / θ Cnc HR3357,J2000 → 当日 + 地平),
    与 REAL 口径的修正赤经(item.ra,宿界用)分开;其余 26 宿无该字段。"""
    import websrv.webplanetariumsrv as w
    pc = perchart.PerChart(dict(CASE))
    su28 = [w._plain_obj(item) for item in pc.getFixedStarSu28()]
    w._attach_true_distance_stars(su28, pc, w._base_star_catalog())
    by_id = {it.get('id'): it for it in su28}
    wei = by_id[const.START_WEI]
    gui = by_id[const.START_GUI]
    assert wei['trueStar']['id'] == 'bsc5-801' and gui['trueStar']['id'] == 'bsc5-3357'
    # 35 Ari 在 41 Ari 西 ~1.6°(赤经),与修正后 item.ra 不同点、赤纬不同(+27.71 vs +27.26)
    assert _ang_gap(wei['trueStar']['raJ2000'], 40.863) < 0.05 and abs(wei['trueStar']['declJ2000'] - 27.707) < 0.05
    assert abs(wei['trueStar']['decl'] - float(wei['decl'])) > 0.3
    # θ Cnc 在 η Cnc 东 ~0.28°、南 ~2.3°:星点不再落在 η Cnc 赤经西侧的修正位
    assert _ang_gap(gui['trueStar']['raJ2000'], 127.899) < 0.05 and abs(gui['trueStar']['declJ2000'] - 18.094) < 0.05
    assert abs(gui['trueStar']['decl'] - float(gui['decl'])) > 1.5
    for k in ('azimuth', 'altitudeTrue', 'altitudeAppa'):
        assert k in wei['trueStar'] and k in gui['trueStar']
    assert sum(1 for it in su28 if it.get('trueStar')) == 2
