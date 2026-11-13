# -*- coding: utf-8 -*-
"""classical_tables.py —— 古典占星常量表(中性口径,无任何外部软件/作者名)。

收录:
- LUNAR_MANSIONS:28 月站(等分 12.857°,0°白羊起;名/性质/择日用途。与恒星制 27 nakshatra 并存、勿混)。
- MASCULINE_DEGREES:阳性度数(逐星座 1..30 度,阳性区间;余为阴性。来源为标准古典度数章,verbatim)。
所有"性质/择日"为标准古典传统转录,具体流派差异以盘主校订为准。
"""

# ── 28 月站(阿拉伯 manazil;等分黄道 360/28=12.8571°,首宿起于 0°白羊) ─────────────
# 每项:罗马转写名 / 中文译名 / 性质(吉/凶/平/参半) / 择日用途关键词。起度由 i*360/28 计算,不入表。
LUNAR_MANSIONS = [
    ('Al-Sharatain', '初星', '吉', '出行·开端'),
    ('Al-Butain', '腹星', '凶', '不宜动土'),
    ('Al-Thurayya', '昴聚', '参半', '炼金·种植'),
    ('Al-Dabaran', '随星', '凶', '破败·冲突'),
    ('Al-Haqah', '冠星', '吉', '建造·和合'),
    ('Al-Hanah', '印星', '吉', '狩猎·围攻'),
    ('Al-Dhira', '臂星', '吉', '增益·收获'),
    ('Al-Nathrah', '气星', '吉', '远行·释囚'),
    ('Al-Tarf', '目星', '凶', '损耗·疾病'),
    ('Al-Jabhah', '额星', '吉', '建造·恩宠'),
    ('Al-Zubrah', '鬃星', '吉', '荣升·丰收'),
    ('Al-Sarfah', '转星', '凶', '宜破·不宜立'),
    ('Al-Awwa', '吠星', '吉', '婚姻·旅行'),
    ('Al-Simak', '独星', '参半', '掘井·和睦/亦主分离'),
    ('Al-Ghafr', '覆星', '凶', '掘井·亦主败'),
    ('Al-Zubana', '螯星', '凶', '赎金·离散'),
    ('Al-Iklil', '冕星', '吉', '婚姻·修好'),
    ('Al-Qalb', '心星', '参半', '攻伐·复仇'),
    ('Al-Shaulah', '尾星', '凶', '围攻·毒害'),
    ('Al-Naaim', '鸵星', '凶', '驯兽·亦主险'),
    ('Al-Baldah', '荒星', '平', '耕作·建造'),
    ('Sad al-Dhabih', '屠者吉', '吉', '医疗·脱困'),
    ('Sad Bula', '吞者吉', '凶', '和解·亦主散'),
    ('Sad al-Suud', '至吉', '吉', '婚姻·商旅'),
    ('Sad al-Akhbiyah', '帐吉', '凶', '围攻·囚禁'),
    ('Al-Fargh al-Muqaddam', '前泻', '凶', '不宜立约'),
    ('Al-Fargh al-Muakhkhar', '后泻', '吉', '增益·得利'),
    ('Batn al-Hut', '鱼腹', '吉', '行船·商贸·和合'),
]
LUNAR_MANSION_WIDTH = 360.0 / 28.0  # 12.857142857°


def mansion_index(lon):
    """回归黄经(0..360,0°白羊起)→ 月站序号(0..27)。"""
    try:
        l = float(lon) % 360.0
    except Exception:
        return None
    return int(l / LUNAR_MANSION_WIDTH) % 28


def mansion_of(lon):
    """→ {idx(1基),name,cn,nature,use,startDeg}。"""
    idx = mansion_index(lon)
    if idx is None:
        return None
    name, cn, nature, use = LUNAR_MANSIONS[idx]
    return {
        'idx': idx + 1, 'name': name, 'cn': cn, 'nature': nature, 'use': use,
        'startDeg': round(idx * LUNAR_MANSION_WIDTH, 4),
    }


# ── 阳性度数(verbatim;1..30 度,闭区间;表外为阴性)。应用:男命落阳性度/女命落阴性度 增力 ──
# 键用 flatlib 星座 id。区间为 1 基(第 1 度 = signlon[0,1))。
MASCULINE_DEGREES = {
    'Aries': [(1, 7), (16, 22), (30, 30)],
    'Taurus': [(8, 22)],
    'Gemini': [(7, 17), (24, 27)],
    'Cancer': [(1, 2), (8, 10), (22, 26), (30, 30)],
    'Leo': [(1, 5), (8, 13), (24, 30)],
    'Virgo': [(8, 12), (21, 30)],
    'Libra': [(1, 5), (11, 21), (29, 30)],
    'Scorpio': [(1, 4), (11, 14), (24, 30)],
    'Sagittarius': [(1, 2), (6, 12), (25, 30)],
    'Capricorn': [(1, 11), (20, 30)],
    'Aquarius': [(1, 5), (13, 18), (26, 30)],
    'Pisces': [(1, 10), (21, 23), (29, 30)],
}


def degree_gender(sign, signlon):
    """该度阴阳:落阳性区间→'masculine',否则'feminine'。"""
    try:
        deg = int(float(signlon)) + 1  # 1 基度序
    except Exception:
        return None
    ranges = MASCULINE_DEGREES.get(sign)
    if ranges is None:
        return None
    for lo, hi in ranges:
        if lo <= deg <= hi:
            return 'masculine'
    return 'feminine'


# ── 单度主星 monomoiria / 九分 / 十度分(面 + Darijan) ───────────────────────────
SIGNS_ORDER = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
               'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
# 迦勒底序(降速):土→木→火→日→金→水→月。
CHALDEAN_ORDER = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']
# 传统庙主(七政)。
SIGN_RULERS = {
    'Aries': 'Mars', 'Taurus': 'Venus', 'Gemini': 'Mercury', 'Cancer': 'Moon',
    'Leo': 'Sun', 'Virgo': 'Mercury', 'Libra': 'Venus', 'Scorpio': 'Mars',
    'Sagittarius': 'Jupiter', 'Capricorn': 'Saturn', 'Aquarius': 'Saturn', 'Pisces': 'Jupiter',
}


def monomoiria_ruler(lon):
    """单度主星:连续迦勒底序,0°白羊第1度=土星,逐度循环(作者默认;埃及界内细分为可选变体)。"""
    try:
        return CHALDEAN_ORDER[int(float(lon)) % 7]
    except Exception:
        return None


def ninth_part_sign(lon):
    """九分(navamsa 同构,回归制):每 3°20′ 一份,自三分性始宫起黄道序。
    连续式 floor(lon/(10/3))%12 即等价(动象始本座/固定始第10季宫/变动始第6季宫)。"""
    try:
        return SIGNS_ORDER[int(float(lon) * 3.0 / 10.0) % 12]     # 先乘后取整:座内 10°、20° 不落回前一份
    except Exception:
        return None


def darijan_ruler(sign, signlon):
    """Darijan(印度十度分):0–10°本座庙主、10–20°同三分性第5座庙主、20–30°第9座庙主。
    (迦勒底「面」主星另由必然尊贵 face 提供,不在此重复。)"""
    try:
        idx = SIGNS_ORDER.index(sign)
        decan = int(float(signlon) / 10.0)            # 0/1/2
        decan = 0 if decan < 0 else (2 if decan > 2 else decan)
        target = SIGNS_ORDER[(idx + decan * 4) % 12]  # 第1/5/9座
        return SIGN_RULERS.get(target)
    except Exception:
        return None


# ── WI-05 度数性质 明/暗/空/烟 + WI-09 陷度/慢病/增福度数 ────────────────────────
# 源:权威古典度数章录本(单一传承,与该录本卷七正文锚定吻合:白羊 = 0-3暗,3-8明,8-16暗,
# 16-20明,20-24空,24-29明,29-30空)。注:此类度数表存在多套传承、数值各异,本表统一采一套。
# 质码:B=明(光明增吉) D=暗(黑暗损) E=空(空虚中性) S=烟(烟雾微凶);run-length 自 0° 累加,每座 sum=30。
DEGREE_QUALITY = {
    'Aries':       [('D', 3), ('B', 5), ('D', 8), ('B', 4), ('E', 4), ('B', 5), ('E', 1)],
    'Taurus':      [('D', 3), ('B', 7), ('E', 2), ('B', 8), ('D', 5), ('B', 3), ('E', 2)],
    'Gemini':      [('B', 7), ('D', 3), ('B', 5), ('E', 2), ('B', 6), ('D', 5), ('E', 2)],
    'Cancer':      [('B', 12), ('D', 2), ('E', 4), ('S', 2), ('B', 8), ('E', 2)],
    'Leo':         [('D', 10), ('S', 6), ('E', 5), ('B', 9)],
    'Virgo':       [('D', 6), ('B', 3), ('E', 2), ('B', 6), ('S', 4), ('E', 5), ('D', 4)],
    'Libra':       [('B', 5), ('D', 5), ('B', 8), ('D', 3), ('B', 6), ('E', 3)],
    'Scorpio':     [('D', 3), ('B', 5), ('E', 6), ('B', 6), ('S', 2), ('E', 5), ('D', 3)],
    'Sagittarius': [('B', 9), ('D', 3), ('B', 7), ('S', 4), ('B', 7)],
    'Capricorn':   [('D', 7), ('B', 3), ('S', 5), ('B', 4), ('D', 2), ('E', 4), ('D', 5)],
    'Aquarius':    [('S', 4), ('B', 5), ('D', 4), ('B', 8), ('E', 4), ('B', 5)],
    'Pisces':      [('D', 6), ('B', 6), ('D', 6), ('B', 4), ('E', 3), ('B', 3), ('D', 2)],
}
DEGREE_QUALITY_CN = {'B': '明', 'D': '暗', 'E': '空', 'S': '烟'}


def degree_quality(sign, signlon):
    """该度明/暗/空/烟;返回 'B'/'D'/'E'/'S' 或 None。run-length 自 0° 累加定位。"""
    runs = DEGREE_QUALITY.get(sign)
    if not runs:
        return None
    try:
        s = float(signlon)
    except Exception:
        return None
    s = 0.0 if s < 0 else (29.999 if s >= 30 else s)
    acc = 0.0
    for q, ln in runs:
        acc += ln
        if s < acc:
            return q
    return runs[-1][0]


# 陷度 well/pitted(行星正落该度=陷,不前不后)、慢病 azemene(残疾/慢性病)、增福 increasing-fortune。
PITTED_DEGREES = {
    'Aries': [6, 9, 11, 17, 24, 29], 'Taurus': [5, 13, 18, 24, 25, 29],
    'Gemini': [2, 12, 17, 26, 30], 'Cancer': [12, 17, 23, 26, 30],
    'Leo': [6, 13, 15, 22, 23, 28], 'Virgo': [8, 13, 16, 21, 25],
    'Libra': [1, 7, 20, 30], 'Scorpio': [9, 10, 22, 23, 27],
    'Sagittarius': [7, 12, 15, 24, 27, 30], 'Capricorn': [2, 7, 17, 22, 24, 28],
    'Aquarius': [1, 12, 17, 23, 29], 'Pisces': [4, 9, 24, 27, 28],
}
AZEMENE_DEGREES = {
    'Taurus': [6, 7, 8, 10], 'Cancer': [9, 10, 11, 12, 13, 14, 15],
    'Leo': [18, 27, 28], 'Scorpio': [19, 29],
    'Sagittarius': [1, 7, 8, 18, 19], 'Capricorn': [26, 27, 28, 29],
    'Aquarius': [10, 18, 19],
}
FORTUNE_DEGREES = {
    'Aries': [19], 'Taurus': [3, 15, 27], 'Gemini': [11], 'Cancer': [1, 2, 3, 14, 15],
    'Leo': [3, 5, 7, 17], 'Virgo': [3, 12, 20], 'Libra': [3, 5, 21], 'Scorpio': [7, 12, 20],
    'Sagittarius': [13, 20], 'Capricorn': [12, 13, 14, 20], 'Aquarius': [7, 17, 20], 'Pisces': [13, 20],
}


def special_degree(sign, signlon):
    """该度特殊性质:陷度 pitted / 慢病 azemene / 增福 fortune 各布尔(命中才置键);deg=int(signlon)+1 (1基)。"""
    try:
        deg = int(float(signlon)) + 1
    except Exception:
        return None
    deg = 1 if deg < 1 else (30 if deg > 30 else deg)
    res = {}
    if deg in PITTED_DEGREES.get(sign, []):
        res['pitted'] = True
    if deg in AZEMENE_DEGREES.get(sign, []):
        res['azemene'] = True
    if deg in FORTUNE_DEGREES.get(sign, []):
        res['fortune'] = True
    return res or None
