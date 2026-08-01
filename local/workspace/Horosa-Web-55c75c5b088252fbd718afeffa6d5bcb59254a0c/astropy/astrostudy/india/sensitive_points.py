# -*- coding: utf-8 -*-
"""敏感点 Sphuta(权威 §20.5 / §17.5 / §22.5)。

三块纯函数,全部只吃经度、零星历调用:
  ① Beeja / Kshetra Sphuta(生育点):Beeja=(Sun+Venus+Jupiter)%360、
     Kshetra=(Moon+Mars+Jupiter)%360;判读看落座与落 D9 座之主星吉凶。
  ② Gandanta / Rasi Sandhi(凶界):三处水火交界(双鱼↔白羊/巨蟹↔狮子/天蝎↔射手,
     对应宿界 Revati↔Ashwini/Ashlesha↔Magha/Jyeshtha↔Mula)各 ±0°48′;
     Rasi Sandhi 为任意座界 29°–30°/0°–1°(判力减分,与 Gandanta 分别标记不混谈)。
  ③ 死亡指示点(仅风险标注,🔴 绝不输出确切寿数):22nd Drekkana(自 Lagna 所在
     Drekkana 起数第 22 个)与 64th Navamsa/Kharesha(自 Moon 或 Lagna 起数第 64 个)。
     权威给「Moon 或 Lagna」两种口径 → 两个都算并列输出,不擅自二选一。

Mrityu Bhaga(死亡度 10×12 查表)权威明言「逐格度数各古籍有出入,不臆造数表」→
本模块只留可插拔空表 MRITYU_BHAGA,空表时该判读整块不出(优雅降级,绝不编数)。
"""
from __future__ import annotations

from flatlib import const

from astrostudy.india.varga import varga_position
from astrostudy.india.yoga_engine import SIGN_LORDS, NATURAL_BENEFICS, NATURAL_MALEFICS

# 中文座名(与 jyotish_engine.SIGN_CN 同值;本模块零依赖引擎,自持一份防循环导入)
_SIGN_CN = {
    const.ARIES: '白羊', const.TAURUS: '金牛', const.GEMINI: '双子', const.CANCER: '巨蟹',
    const.LEO: '狮子', const.VIRGO: '处女', const.LIBRA: '天秤', const.SCORPIO: '天蝎',
    const.SAGITTARIUS: '射手', const.CAPRICORN: '摩羯', const.AQUARIUS: '水瓶', const.PISCES: '双鱼',
}

_PLANET_CN = {
    const.SUN: '太阳', const.MOON: '月亮', const.MARS: '火星', const.MERCURY: '水星',
    const.JUPITER: '木星', const.VENUS: '金星', const.SATURN: '土星',
    const.NORTH_NODE: '罗睺', const.SOUTH_NODE: '计都',
}


def _sign_of(lon):
    return const.LIST_SIGNS[int((float(lon) % 360.0) // 30.0) % 12]


def _sign_pack(lon):
    sign = _sign_of(lon)
    lord = SIGN_LORDS.get(sign)
    return {
        'sign': sign, 'signLabel': _SIGN_CN.get(sign, sign),
        'lord': lord, 'lordLabel': _PLANET_CN.get(lord, lord),
        'lordNature': ('benefic' if lord in NATURAL_BENEFICS
                       else 'malefic' if lord in NATURAL_MALEFICS else 'neutral'),
    }


# ── ① Beeja / Kshetra Sphuta ─────────────────────────────────────────────
def beeja_kshetra_sphuta(sun_lon, venus_lon, jupiter_lon, moon_lon, mars_lon):
    """生育点两式。三源经度任一缺失 → 对应点 available=False(不编值)。

    判读口径(如实按权威语义,不加精度):取该点**落座**与**落 D9 Navamsa 座**,
    两座之主星均为自然吉星 → 佳;均为自然凶星 → 不利;其余 → 中平。
    判据基础(lordNature 两座)一并出参,显示层可自行陈列不必只信结论。
    """
    def _one(parts, kind):
        if any(p is None for p in parts):
            return {'available': False, 'kind': kind, 'reason': 'missing_source_longitude'}
        lon = sum(float(p) % 360.0 for p in parts) % 360.0
        rasi = _sign_pack(lon)
        nav_lon = varga_position(lon, 9)
        nav = _sign_pack(nav_lon)
        natures = {rasi['lordNature'], nav['lordNature']}
        if natures == {'benefic'}:
            verdict, verdict_label = 'favorable', '两座主皆吉星,生育力佳'
        elif natures == {'malefic'}:
            verdict, verdict_label = 'unfavorable', '两座主皆凶星,不利'
        else:
            verdict, verdict_label = 'mixed', '座主吉凶相杂,中平'
        return {
            'available': True, 'kind': kind, 'lon': lon,
            'rasi': rasi, 'navamsa': nav,
            'verdict': verdict, 'verdictLabel': verdict_label,
            'basis': '落座与落 Navamsa 座之主星自然吉凶(古法口径)',
        }

    return {
        'beeja': _one((sun_lon, venus_lon, jupiter_lon), 'beeja'),
        'kshetra': _one((moon_lon, mars_lon, jupiter_lon), 'kshetra'),
        'note': 'Beeja=(日+金+木)男精 / Kshetra=(月+火+木)女宫;古典生育力指示,仅供参考',
    }


# ── ② Gandanta / Rasi Sandhi ─────────────────────────────────────────────
# 三处水火交界(junction 经度 0°/120°/240°),各 ±0°48′(=0.8°)。
GANDANTA_ORB_DEG = 48.0 / 60.0
_GANDANTA_JUNCTIONS = (
    (0.0, 'Pisces-Aries', 'Revati↔Ashwini', '双鱼↔白羊'),
    (120.0, 'Cancer-Leo', 'Ashlesha↔Magha', '巨蟹↔狮子'),
    (240.0, 'Scorpio-Sagittarius', 'Jyeshtha↔Mula', '天蝎↔射手'),
)
RASI_SANDHI_ORB_DEG = 1.0     # 座末 29°–30° / 座初 0°–1°(§17.5)


def gandanta_status(lon):
    """Nakshatra Gandanta 判定:distToJunction ≤ 0°48′。跨 0° 用模差(唯一 wrap 用例)。"""
    v = float(lon) % 360.0
    for j, key, naks, label in _GANDANTA_JUNCTIONS:
        diff = abs((v - j + 180.0) % 360.0 - 180.0)   # 环上最短角距
        if diff <= GANDANTA_ORB_DEG + 1e-9:
            return {
                'inGandanta': True, 'junction': key, 'junctionLabel': label,
                'nakshatraPair': naks,
                'side': 'end' if ((v - j) % 360.0) > 180.0 else 'start',
                'arcminToBoundary': round(diff * 60.0, 2),
            }
    return {'inGandanta': False}


def rasi_sandhi_status(lon):
    """任意座界 ±1°(座末/座初)之 Sandhi:判力减分层,与 Gandanta 分别标记。"""
    v = float(lon) % 360.0
    in_sign = v % 30.0
    if in_sign >= 30.0 - RASI_SANDHI_ORB_DEG:
        return {'inSandhi': True, 'position': 'sign_end',
                'arcminToBoundary': round((30.0 - in_sign) * 60.0, 2)}
    if in_sign < RASI_SANDHI_ORB_DEG:
        return {'inSandhi': True, 'position': 'sign_start',
                'arcminToBoundary': round(in_sign * 60.0, 2)}
    return {'inSandhi': False}


def boundary_flags_for(bodies):
    """{name: lon} → 逐体 Gandanta/Sandhi 命中清单(未命中者不出行,显示层零噪音)。"""
    hits = []
    for name, lon in bodies.items():
        if lon is None:
            continue
        g = gandanta_status(lon)
        s = rasi_sandhi_status(lon)
        if g['inGandanta'] or s['inSandhi']:
            hits.append({
                'body': name, 'bodyLabel': _PLANET_CN.get(name, name), 'lon': float(lon) % 360.0,
                'gandanta': g if g['inGandanta'] else None,
                'rasiSandhi': s if s['inSandhi'] else None,
            })
    return hits


# ── ③ 死亡指示点(仅风险标注)──────────────────────────────────────────
def _drekkana_index(lon):
    return int((float(lon) % 360.0) // 10.0) % 36        # 全黄道 36 个 Drekkana,各 10°


def _navamsa_index(lon):
    return int((float(lon) % 360.0) / (10.0 / 3.0)) % 108  # 108 个 Navamsa,各 3°20′


def _nth_drekkana(lon, n):
    """自 lon 所在 Drekkana 起数第 n 个(含起点为第 1)。lord 按 D3 映射座取
    (即该段中点过 varga D3 之座主 —— 复用 varga_position,绝不另写一份 D3 规则)。"""
    idx = (_drekkana_index(lon) + n - 1) % 36
    seg_mid = idx * 10.0 + 5.0
    containing = _sign_pack(seg_mid)                      # 该段落在黄道哪个 rasi
    d3 = _sign_pack(varga_position(seg_mid, 3))           # 该段的 D3 座(主星取此,标准口径)
    return {
        'countedTo': n, 'segmentIndex': idx + 1,
        'containingSign': containing['sign'], 'containingSignLabel': containing['signLabel'],
        'drekkanaSign': d3['sign'], 'drekkanaSignLabel': d3['signLabel'],
        'lord': d3['lord'], 'lordLabel': d3['lordLabel'],
        'lordBasis': 'D3 映射座之主(标准);所落 rasi 一并出参供对照',
    }


def _nth_navamsa(lon, n):
    idx = (_navamsa_index(lon) + n - 1) % 108
    seg_mid = idx * (10.0 / 3.0) + (10.0 / 6.0)
    containing = _sign_pack(seg_mid)
    d9 = _sign_pack(varga_position(seg_mid, 9))
    return {
        'countedTo': n, 'segmentIndex': idx + 1,
        'containingSign': containing['sign'], 'containingSignLabel': containing['signLabel'],
        'navamsaSign': d9['sign'], 'navamsaSignLabel': d9['signLabel'],
        'lord': d9['lord'], 'lordLabel': d9['lordLabel'],
        'lordBasis': 'D9 映射座之主(Kharesha 标准);所落 rasi 一并出参供对照',
    }


def death_indicator_points(lagna_lon, moon_lon):
    """22nd Drekkana(自 Lagna)+ 64th Navamsa(自 Moon 与自 Lagna 两口径并列)。
    🔴 仅风险因子标注:输出主星清单,绝不推算寿数;显示层配固定免责文案。"""
    out = {'available': True}
    if lagna_lon is None:
        return {'available': False, 'reason': 'missing_lagna'}
    out['drekkana22'] = _nth_drekkana(lagna_lon, 22)
    out['navamsa64FromLagna'] = _nth_navamsa(lagna_lon, 64)
    if moon_lon is not None:
        out['navamsa64FromMoon'] = _nth_navamsa(moon_lon, 64)     # Kharesha 主口径
    else:
        out['navamsa64FromMoon'] = None
    out['disclaimer'] = '古典风险指示,仅作研究性标注,不构成任何寿命预测'
    return out


# ── Mrityu Bhaga 可插拔空表(🔴 待录入,绝不臆造)──────────────────────────
# 形状:{body: {sign: degree_float}} —— body ∈ {'Lagna', 9 曜 const id},sign ∈ 12 座
# const,degree 为该座内 0–30 的「致命度」。来源须为所选经典原表(BPHS 或 Jataka
# Parijata,两籍逐格有出入,录入时注明所采版本并对拍 JHora)。空表 ⇒ mrityu_bhaga_hits
# 恒返回 None ⇒ 显示层整块不渲染。
MRITYU_BHAGA = {}


def mrityu_bhaga_hits(bodies, orb_deg=1.0):
    """{name: lon} → Mrityu Bhaga 命中(表空返回 None = 功能待录入,非「无命中」)。"""
    if not MRITYU_BHAGA:
        return None
    hits = []
    for name, lon in bodies.items():
        if lon is None:
            continue
        table = MRITYU_BHAGA.get(name)
        if not table:
            continue
        sign = _sign_of(lon)
        deg = table.get(sign)
        if deg is None:
            continue
        diff = abs((float(lon) % 30.0) - float(deg))
        if diff <= orb_deg:
            hits.append({'body': name, 'bodyLabel': _PLANET_CN.get(name, name),
                         'sign': sign, 'degree': deg, 'orb': round(diff, 3)})
    return hits
