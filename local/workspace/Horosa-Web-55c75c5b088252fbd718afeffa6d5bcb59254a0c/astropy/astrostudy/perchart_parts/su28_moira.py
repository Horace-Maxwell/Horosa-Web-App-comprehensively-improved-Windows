"""二十八宿口径编号与 Moira 距星表(J2000 距星、开禧 / 今制恒星度、岁差投射;由排盘模块整段搬出,astrostudy.perchart 照旧可取这些名字)。"""
import math
import swisseph
from flatlib import const
from flatlib.ephem import swe


SU28_MODE_REAL = 0
SU28_MODE_DOUBING = 1
SU28_MODE_MOIRA_CURRENT = 2
SU28_MODE_MOIRA_KAIXI = 3
SU28_MODE_ZHENG_SIDEREAL = 4
SU28_MODE_EQUATORIAL_SIDEREAL = 5   # G3/G4 赤道恒星制(制一):现代赤道距星案进动赤经定宿,planets 按赤经置宿,落宫仍黄道
SU28_MODE_GUFA_LICHENG = 6           # WP-D 授时历古法立成:推变黄道宿度(极黄经)按黄经置宿;古宿固定(元时·默认)或随岁差
SU28_MODE_EQUATORIAL_TROPICAL = 7    # 额外档·赤道回归制(元明):固定元明赤道宿度立成(春分/牛前冬至锚、赤经常数、不随岁差),行星按赤经落宿(与 mode5「宿随星走」正相反)
SU28_MODE_EQUATORIAL_TROPICAL_LIVE = 8   # 赤道回归·实时:宿宽=盘历元距星真赤经差(mode5 同源活体),锚=回归点(mode7 同款牛前冬至/春分壁2.3)——授时历「实测宿度+冬至锚」的活体版
ZHENG_SIDEREAL_MODE = {
    'mode': swe.SE_SIDM_USER,
    't0': 2195875.5,
    'ayan_t0': 4.0,
}

MOIRA_STELLAR_ORDER = [
    '娄', '胃', '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸', '角',
    '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁', '奎'
]

MOIRA_CURRENT_STELLAR_DEGREES = [
    15.9, 26.3, 41.1, 53.2, 69.0, 70.0, 81.8, 112.3, 115.2, 130.5, 136.4, 151.4,
    170.1, 187.2, 200.0, 208.9, 225.2, 230.6, 237.0, 255.6, 266.3, 290.1, 298.0,
    308.9, 318.3, 333.6, 349.4, 358.3
]

MOIRA_KAIXI_STELLAR_DEGREES = [
    16.0, 29.0, 44.0, 55.0, 70.5, 71.0, 80.0, 110.0, 113.0, 126.0, 133.0, 150.0,
    170.0, 189.0, 201.0, 211.0, 227.0, 233.0, 239.0, 256.0, 266.0, 288.0, 295.0,
    306.0, 315.0, 331.0, 349.0, 358.0
]

# 二十八宿距星 J2000 赤道坐标(自有星案,顺序同 MOIRA_STELLAR_ORDER 娄..奎)。
# 字段: (宿名, RA_h, RA_m, RA_s, dec_sign, Dec_d, Dec_m, Dec_s, pmRA, pmDec)。
# pmRA/pmDec 单位 0.01 (RA: s/yr 时秒; Dec: arcsec/yr)。
# 「回归今制」用此表逐宿做严格 IAU 岁差→盘历元 tropical 黄经(活体距星)。
MOIRA_DISTAR_J2000 = [
    ('娄', 1, 54, 38.401,  1, 20, 48, 28.82,  0.684, -11.11),
    ('胃', 3, 46, 50.889, -1, 23, 14, 58.97, -1.148, -52.91),
    ('昴', 3, 44, 48.180,  1, 24, 17, 21.44,  0.060,  -5.10),
    ('毕', 4, 28, 36.997,  1, 19, 10, 49.46,  0.756,  -3.77),
    ('觜', 5, 35,  8.419,  1,  9, 56,  3.96,  0.130,  -0.20),
    ('参', 5, 40, 45.520, -1,  1, 56, 33.30,  0.027,  -0.25),
    ('井', 6, 22, 57.621,  1, 22, 30, 48.79,  0.391, -11.10),
    ('鬼', 7, 49, 17.655, -1, 24, 51, 35.31, -0.022,  -0.18),
    ('柳', 11, 31, 24.248, 1, 69, 19, 51.87, -0.733,  -1.71),
    ('星', 8, 43, 35.545, -1, 33, 11, 11.02, -0.086,   1.08),
    ('张', 11, 46,  3.018, 1, 47, 46, 45.90, -1.361,   2.95),
    ('翼', 12, 26, 56.271, 1, 28, 16,  6.34, -0.626,  -8.02),
    ('轸', 12, 15, 48.366, -1, 17, 32, 30.97, -1.124,  2.33),
    ('角', 13, 25, 11.587, -1, 11,  9, 40.71, -0.278, -2.83),
    ('亢', 11, 35, 46.845, -1, 63,  1, 11.32, -0.606, -0.49),
    ('氐', 14, 56, 46.118, -1, 11, 24, 35.05,  0.076,  0.83),
    ('房', 15, 58, 51.120, -1, 26,  6, 50.75, -0.084, -2.55),
    ('心', 16, 21, 11.317, -1, 25, 35, 34.17, -0.076, -2.07),
    ('尾', 17, 14, 38.860,  1, 14, 23, 24.90, -0.046,  3.28),
    ('箕', 18,  5, 48.491, -1, 30, 25, 26.69, -0.412,-18.52),
    ('斗', 18, 24, 13.779,  1, 39, 30, 26.24, -0.200, -0.19),
    ('牛', 20, 21,  0.673, -1, 14, 46, 52.99,  0.291,  0.16),
    ('女', 20, 47, 40.559, -1,  9, 29, 44.74,  0.235, -3.43),
    ('虚', 21, 10, 20.518,  1, 10,  7, 53.57,  0.383,-15.33),
    ('危', 22,  5, 47.038, -1,  0, 19, 11.47,  0.131, -0.96),
    ('室', 23,  4, 45.658,  1, 15, 12, 18.90,  0.436, -4.25),
    ('壁', 23, 57, 45.535,  1, 25,  8, 28.98, -0.247, -3.32),
    ('奎',  0, 36, 52.858,  1, 33, 43,  9.63,  0.124, -0.40),
]

# 自有恒星案 ayanamsha 基准: 基准历元 1300-01-01, 基准黄经差 4.0°(与「恒星制」一致)。
MOIRA_AYAN_BASE_YMD = (1300, 1, 1, 0.0)
MOIRA_AYAN_BASE_DEG = 4.0


def _moira_ayanamsha(jd):
    """指定 jd 的 ayanamsha(SE_SIDM_USER, 基准 1300/4.0)。用于回归古制/恒星制基值→tropical 投射。

    ⚠️ 并发约定:set_sid_mode 是 swisseph 进程级全局态;下面 set→get 两行必须保持
    相邻直线代码(中间不得插入任何 Python 语句),否则多线程下会被其他制式抢改。
    钉子: tests/test_swe_concurrency.py。
    """
    y, m, d, h = MOIRA_AYAN_BASE_YMD
    swisseph.set_sid_mode(swisseph.SIDM_USER, swisseph.julday(y, m, d, h, swisseph.GREG_CAL), MOIRA_AYAN_BASE_DEG)
    return swisseph.get_ayanamsa_ut(jd)


def _moira_distar_lon(rec, jd):
    """单颗距星 J2000 赤道坐标 → 盘历元 tropical 黄经(proper motion + 严格 IAU 岁差)。"""
    name, rh, rm, rs, sg, dd, dm, ds, pmra, pmdec = rec
    ra = (rh + rm / 60.0 + rs / 3600.0) * 15.0
    dec = sg * (dd + dm / 60.0 + ds / 3600.0)
    yr = (jd - 2451545.0) / 365.25
    ra += pmra * 0.01 * 15.0 * yr / 3600.0
    dec += pmdec * 0.01 * yr / 3600.0
    T = (jd - 2451545.0) / 36525.0
    zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600.0
    z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600.0
    th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600.0
    rr = math.radians(ra)
    dr = math.radians(dec)
    Z = math.radians(zeta)
    ZZ = math.radians(z)
    TH = math.radians(th)
    A = math.cos(dr) * math.sin(rr + Z)
    B = math.cos(TH) * math.cos(dr) * math.cos(rr + Z) - math.sin(TH) * math.sin(dr)
    C = math.sin(TH) * math.cos(dr) * math.cos(rr + Z) + math.cos(TH) * math.sin(dr)
    ra_d = math.atan2(A, B) + ZZ
    dec_d = math.asin(C)
    eps = math.radians(swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0])
    lon = math.degrees(math.atan2(
        math.sin(ra_d) * math.cos(eps) + math.tan(dec_d) * math.sin(eps),
        math.cos(ra_d))) % 360.0
    return (name, lon)


def _moira_distar_lons(jd):
    """全 28 距星盘历元 tropical 黄经,返回 {宿名: 黄经}。"""
    return dict(_moira_distar_lon(rec, jd) for rec in MOIRA_DISTAR_J2000)


def _moira_distar_ra(rec, jd):
    """【已停用】单颗距星 J2000 赤道坐标 → 盘历元赤经/赤纬。

    停用原因:MOIRA_DISTAR_J2000 是自黄经反解 RA/Dec 而成,只在【黄经】上可用;
    其中 9 宿的赤纬非物理(|β| 达 28°~63°,而距星皆黄道带恒星)。
    黄仪只取黄经恰好遮住,一旦按赤经定宿即偏 10–44°(见 getEquatorialSu28 的注)。
    赤道恒星制请走 chart.getFixedStartsSu28()(flatlib 活体真星),勿复活本函数。
    此处硬报错而非静默返回,是为拦住「改回来试试」——真要用须先把该表的赤纬逐行换成真星值。
    旧换算体与批量入口均已删去(全仓无调用方),只留本守卫:任何调用即报错。
    """
    raise RuntimeError(
        "_moira_distar_ra 已停用:MOIRA_DISTAR_J2000 仅黄经可用(9 宿赤纬非物理),"
        "按赤经定宿会偏 10–44°;赤道恒星制请用 chart.getFixedStartsSu28()。"
    )


SU28_ID_BY_NAME = dict(zip(const.LIST_FIXED_SU28_NAME, const.LIST_FIXED_SU28))
