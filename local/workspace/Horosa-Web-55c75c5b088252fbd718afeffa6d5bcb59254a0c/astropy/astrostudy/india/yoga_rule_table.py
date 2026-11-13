"""经典 Yoga 判定表:111 条组合的逐条判定。

和 yoga_engine 的区别:那边按类别列「成立的组合」并打强度分,这里是一张固定的表,
每条都给「成立 / 不成立」和判定条件,方便逐条核对。

宫位一律按上升所在星座起整宫数(与 yoga_engine 的形状类同口径);计数只算七曜,不含南北交。
「经典」列是古表的字面写法,「改进」列按该组合的通行定义补正。字面写法自相矛盾或与定义
确定相反的条目不保留经典写法,两列相同。
"""

import swisseph
from flatlib import const

from astrostudy.india.primitives import PLANET_CN, SIGN_CN, SIGN_LORDS
from astrostudy.india.yoga_engine import CLASSICAL_PLANETS, EXALTATION, rel_house, sign_name

SU, MO, ME, VE, MA, JU, SA = (
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN)
RA, KE = const.NORTH_NODE, const.SOUTH_NODE
FIVE = (ME, VE, MA, JU, SA)

ARIES, TAURUS, GEMINI, CANCER, LEO, VIRGO, LIBRA, SCORPIO, SAGITTARIUS, CAPRICORN, AQUARIUS, PISCES = range(12)

KENDRA = (1, 4, 7, 10)
TRIKONA_REST = (5, 9)
ODD_HOUSES = (1, 3, 5, 7, 9, 11)
EVEN_HOUSES = (2, 4, 6, 8, 10, 12)
SUCCEDENT = (2, 5, 8, 11)
CADENT = (3, 6, 9, 12)
DUSTHANA = (6, 8, 12)

MODALITY = {'cardinal': (0, 3, 6, 9), 'fixed': (1, 4, 7, 10), 'dual': (2, 5, 8, 11)}
MODALITY_CN = {'cardinal': '活动座', 'fixed': '固定座', 'dual': '双体座'}

# 恒星相(Graha Drishti),与 jyotish 的 graha_drishti 同表
DRISHTI = {
    SU: (7,), MO: (7,), ME: (7,), VE: (7,),
    MA: (4, 7, 8), JU: (5, 7, 9), SA: (3, 7, 10),
    RA: (5, 7, 9), KE: (5, 7, 9),
}

ASC = 'ASC'


def L(house):
    """第 house 宫的宫主星。"""
    return ('lord', house)


def H(house):
    """第 house 宫这个星座本身。"""
    return ('cusp', house)


def D(point):
    """某点所在星座的星主。"""
    return ('dispositor', point)


def all_of(*items):
    return ('all', items)


def any_of(*items):
    return ('any', items)


def no(item):
    return ('not', item)


def in_house(point, *houses):
    return ('house', point, houses)


def in_kendra(point):
    return ('house', point, KENDRA)


def in_sign(point, *signs):
    return ('sign', point, signs)


def in_modality(point, kind):
    return ('modality', point, kind)


def from_point(point, base, *counts):
    """point 落在从 base 数的第 counts 宫(含 base 自己算第 1 宫)。"""
    return ('from', point, base, counts)


def together(a, b, same_ok=False):
    """同座。两个点指向同一颗星时默认不算会合,same_ok 放开。"""
    return ('with', a, b, same_ok)


def aspects(giver, receiver):
    return ('drishti', giver, receiver)


def exalted(point):
    return ('exalted', point)


def odd_sign(point):
    return ('parity', point, 1)


def even_sign(point):
    return ('parity', point, 0)


def planets_in(houses, op, count):
    return ('count', tuple(houses), op, count)


def empty(*houses):
    return planets_in(houses, '=', 0)


def filled(*houses):
    return all_of(*[planets_in((house,), '>=', 1) for house in houses])


def only(*houses):
    rest = tuple(house for house in range(1, 13) if house not in houses)
    return planets_in(rest, '=', 0)


def run_of_seven(start):
    """从 start 起连续七宫各一星。"""
    return all_of(*[planets_in((((start + i - 1) % 12) + 1,), '=', 1) for i in range(7)])


def run_of_four(start):
    houses = tuple(((start + i - 1) % 12) + 1 for i in range(4))
    return all_of(only(*houses), filled(*houses))


def signs_empty(kind):
    return ('modality_count', kind, 0)


def occupied(count):
    return ('occupied', count)


DAY = ('day', True)
NIGHT = ('day', False)


GROUPS = {
    'shape': '形状',
    'support': '依托',
    'number': '数目',
    'lunar': '月亮',
    'solar': '太阳',
    'sun_mars': '日在火星座',
    'great': '五大人',
    'fortune': '福贵',
    'wealth': '财',
    'poverty': '贫',
    'body': '身体',
    'kin': '眷属',
}

NATURE = {0: 'mixed', 1: 'good', 2: 'bad'}


def rule(rule_id, name, zh, group, nature, cond, classic=None):
    return {'id': rule_id, 'name': name, 'zh': zh, 'group': group, 'nature': NATURE[nature],
            'cond': cond, 'classic': classic}


def _moon_side(count, skip=None):
    planets = any_of(*[from_point(planet, MO, count) for planet in FIVE])
    return planets if skip is None else all_of(no(from_point(skip, MO, count)), planets)


def _sun_side(count, skip=None):
    planets = any_of(*[from_point(planet, SU, count) for planet in FIVE])
    return planets if skip is None else all_of(no(from_point(skip, SU, count)), planets)


def _sun_in_mars_sign(rule_id, name, zh, nature, planet):
    return rule(rule_id, name, zh, 'sun_mars', nature,
                all_of(in_sign(SU, ARIES, SCORPIO), aspects(planet, SU)))


def _mahapurusha(rule_id, name, zh, nature, planet, signs):
    return rule(rule_id, name, zh, 'great', nature, all_of(in_kendra(planet), in_sign(planet, *signs)))


def _lagna_aspected(rule_id, name, zh, planet, signs, givers):
    return rule(rule_id, name, zh, 'wealth', 1,
                all_of(in_sign(planet, *signs), in_house(planet, 1), *[aspects(giver, planet) for giver in givers]))


YOGA_RULES = (
    rule(1, 'Ekaputra', '一子', 'kin', 0, any_of(in_kendra(L(5)), in_house(L(5), 5), in_house(L(5), 9))),
    rule(2, 'Budha', '水星福', 'fortune', 1, all_of(
        in_house(JU, 1), in_kendra(MO), from_point(RA, MO, 2), from_point(SU, RA, 3), from_point(MA, RA, 3))),
    rule(3, 'Nauka', '舟', 'shape', 1, run_of_seven(1)),
    rule(4, 'Koota', '堡', 'shape', 2, run_of_seven(4)),
    rule(5, 'Chatra', '伞', 'shape', 0, run_of_seven(7)),
    rule(6, 'Chapa', '弓', 'shape', 2, run_of_seven(10)),
    rule(7, 'Ardha Chandra', '半月', 'shape', 1,
         any_of(*[run_of_seven(start) for start in (2, 3, 5, 6, 8, 9, 11, 12)]),
         any_of(run_of_seven(2), run_of_seven(3))),
    rule(8, 'Padma', '莲花', 'shape', 1, only(*KENDRA)),
    rule(9, 'Vapi', '水池', 'shape', 1, empty(*KENDRA)),
    rule(10, 'Sakata', '车', 'shape', 2, only(1, 7)),
    rule(11, 'Vihaga', '鸟', 'shape', 2, only(4, 10)),
    rule(12, 'Gada', '棒', 'shape', 1, any_of(only(1, 4), only(4, 7), only(7, 10), only(10, 1))),
    rule(13, 'Sringataka', '三叉路', 'shape', 1, only(1, 5, 9)),
    rule(14, 'Hala', '犁', 'shape', 0, any_of(only(2, 6, 10), only(3, 7, 11), only(4, 8, 12))),
    rule(15, 'Chakra', '轮', 'shape', 1, all_of(only(*ODD_HOUSES), filled(*ODD_HOUSES))),
    rule(16, 'Samudra', '海', 'shape', 1, all_of(only(*EVEN_HOUSES), filled(*EVEN_HOUSES))),
    rule(17, 'Yupa', '祭柱', 'shape', 1, run_of_four(1)),
    rule(18, 'Sara', '箭', 'shape', 0, run_of_four(4)),
    rule(19, 'Sakti', '力', 'shape', 0, run_of_four(7)),
    rule(20, 'Danda', '杖', 'shape', 2, run_of_four(10)),
    rule(21, 'Rajju', '绳', 'support', 0, all_of(signs_empty('fixed'), signs_empty('dual'))),
    rule(22, 'Musala', '杵', 'support', 1, all_of(signs_empty('cardinal'), signs_empty('dual'))),
    rule(23, 'Nala', '芦管', 'support', 1, all_of(signs_empty('cardinal'), signs_empty('fixed')),
         all_of(signs_empty('cardinal'), signs_empty('fixed'), ('sign_empty', VIRGO))),
    rule(24, 'Gola', '球', 'number', 1, occupied(1)),
    rule(25, 'Yuga', '轭', 'number', 2, occupied(2)),
    rule(26, 'Sula', '矛', 'number', 0, occupied(3)),
    rule(27, 'Kedara', '田', 'number', 1, occupied(4)),
    rule(28, 'Pasa', '索', 'number', 0, occupied(5)),
    rule(29, 'Damini', '花环', 'number', 0, occupied(6)),
    rule(30, 'Veena', '琴', 'number', 1, occupied(7)),
    rule(31, 'Sunapha', '月后有星', 'lunar', 1, _moon_side(2), _moon_side(2, SU)),
    rule(32, 'Anapha', '月前有星', 'lunar', 1, _moon_side(12), _moon_side(12, SU)),
    rule(33, 'Durudhura', '月夹', 'lunar', 1, all_of(_moon_side(2), _moon_side(12))),
    rule(34, 'Kemadruma', '月孤', 'lunar', 2, all_of(no(_moon_side(2)), no(_moon_side(12)))),
    _sun_in_mars_sign(35, 'Sun in Mars sign, Moon', '日在火星座受月照', 1, MO),
    _sun_in_mars_sign(36, 'Sun in Mars sign, Mars', '日在火星座受火照', 0, MA),
    _sun_in_mars_sign(37, 'Sun in Mars sign, Mercury', '日在火星座受水照', 0, ME),
    _sun_in_mars_sign(38, 'Sun in Mars sign, Jupiter', '日在火星座受木照', 1, JU),
    _sun_in_mars_sign(39, 'Sun in Mars sign, Venus', '日在火星座受金照', 0, VE),
    _sun_in_mars_sign(40, 'Sun in Mars sign, Saturn', '日在火星座受土照', 0, SA),
    rule(41, 'Gajakesari', '象狮', 'lunar', 0, from_point(JU, MO, *KENDRA)),
    rule(42, 'Chandra Mangala', '月火', 'lunar', 0, together(MA, MO)),
    rule(43, 'Chatussagara', '四海', 'fortune', 0, filled(*KENDRA)),
    rule(44, 'Rajalakshana', '王相', 'fortune', 0, all_of(in_kendra(MO), in_kendra(ME), in_kendra(VE), in_kendra(JU))),
    rule(45, 'Sakata (Moon)', '月车', 'lunar', 2, from_point(MO, JU, 6, 8, 12)),
    rule(46, 'Vesi', '日后有星', 'solar', 1, _sun_side(2), _sun_side(2, MO)),
    rule(47, 'Vasi', '日前有星', 'solar', 1, _sun_side(12), _sun_side(12, MO)),
    _mahapurusha(48, 'Hamsa', '天鹅', 1, JU, (CANCER, SAGITTARIUS, PISCES)),
    _mahapurusha(49, 'Malavya', '摩罗毗耶', 1, VE, (PISCES, TAURUS, LIBRA)),
    _mahapurusha(50, 'Sasa', '沙沙', 0, SA, (LIBRA, CAPRICORN, AQUARIUS)),
    _mahapurusha(51, 'Ruchaka', '鲁查卡', 1, MA, (ARIES, SCORPIO, CAPRICORN)),
    rule(52, 'Mahabhagya (female)', '大福(女命)', 'fortune', 1,
         all_of(NIGHT, even_sign(ASC), even_sign(SU), even_sign(MO))),
    rule(53, 'Mahabhagya (male)', '大福(男命)', 'fortune', 1,
         all_of(DAY, odd_sign(ASC), odd_sign(SU), odd_sign(MO))),
    _mahapurusha(54, 'Bhadra', '跋陀罗', 1, ME, (GEMINI, VIRGO)),
    rule(55, 'Chapa (lords)', '弓(宫主互换)', 'fortune', 0,
         all_of(exalted(L(1)), in_house(L(4), 10), in_house(L(10), 4))),
    rule(56, 'Gaja', '象', 'fortune', 0,
         all_of(in_house(L(7), 11), in_house(MO, 11), aspects(L(11), MO)),
         all_of(in_house(L(7), 11), in_house(MO, 11), aspects(MO, L(11)))),
    rule(57, 'Amsavatara', '化身', 'fortune', 0, all_of(
        in_kendra(VE), in_kendra(JU), in_modality(ASC, 'cardinal'), in_sign(SA, LIBRA), in_kendra(SA))),
    rule(58, 'Kusuma', '花', 'fortune', 1,
         all_of(in_house(JU, 1), in_house(MO, 7), from_point(SU, MO, 8)),
         all_of(in_house(JU, 1), in_house(MO, 7), from_point(D(SU), MO, 8))),
    rule(59, 'Devendra', '天帝', 'fortune', 1, all_of(
        in_modality(ASC, 'fixed'), in_house(L(1), 11), in_house(L(11), 1), in_house(L(2), 10), in_house(L(10), 2))),
    rule(60, 'Vidyut', '电光', 'fortune', 1,
         all_of(exalted(L(11)), together(VE, L(11)), from_point(L(11), L(1), *KENDRA)),
         all_of(exalted(L(11)), from_point(VE, L(11), 1), in_kendra(L(11)))),
    rule(61, 'Siva', '湿婆', 'fortune', 1, all_of(in_house(L(5), 9), in_house(L(9), 10), in_house(L(10), 5))),
    rule(62, 'Indra', '因陀罗', 'fortune', 0, all_of(in_house(L(5), 11), in_house(L(11), 5), in_house(MO, 5))),
    rule(63, 'Ravi', '日', 'fortune', 1, all_of(in_house(SU, 10), in_house(L(10), 3), in_house(SA, 3))),
    rule(64, 'Chandra', '奇宫', 'shape', 1, empty(*EVEN_HOUSES)),
    rule(65, 'Sringataka (full)', '三叉路(三宫齐)', 'shape', 0, all_of(only(1, 5, 9), filled(1, 5, 9))),
    rule(66, 'Hala (others)', '犁(不在三方)', 'shape', 0, empty(1, 5, 9)),
    rule(67, 'Duryoga', '坏业', 'poverty', 2, in_house(L(10), *DUSTHANA)),
    rule(68, 'Daridra (11)', '贫(十一宫主)', 'poverty', 2, in_house(L(11), *DUSTHANA)),
    rule(69, 'Sareera Soukhya', '身安', 'body', 1,
         any_of(in_kendra(L(1)), in_kendra(VE), in_kendra(JU)),
         any_of(in_kendra(L(1)), in_kendra(D(VE)), in_kendra(D(JU)))),
    rule(70, 'Rogagrastha', '多病', 'body', 2, all_of(
        in_house(L(1), 1), any_of(together(L(1), L(6)), together(L(1), L(8)), together(L(1), L(12))))),
    rule(71, 'Krisanga', '瘦身', 'body', 0, in_sign(L(1), ARIES, TAURUS, GEMINI, LEO, VIRGO)),
    rule(72, 'Sada Sanchara', '常行', 'body', 2,
         any_of(in_modality(L(1), 'cardinal'), in_modality(D(L(1)), 'cardinal')),
         any_of(in_modality(L(1), 'dual'), in_modality(ASC, 'dual'))),
    rule(73, 'Dhana (lagna)', '财(五宫金星座)', 'wealth', 0,
         all_of(in_sign(H(5), TAURUS, LIBRA), in_house(VE, 5), in_house(SA, 11))),
    rule(74, 'Dhana (Mercury)', '财(水在五)', 'wealth', 0,
         all_of(in_sign(ME, GEMINI, VIRGO), in_house(ME, 5), in_house(MO, 11), in_house(MA, 11)),
         all_of(in_sign(ME, GEMINI), in_house(ME, 5), in_house(MO, 11), in_house(MA, 11))),
    rule(75, 'Dhana (Saturn)', '财(土在五)', 'wealth', 1,
         all_of(in_house(MA, 11), in_house(ME, 11), in_sign(SA, CAPRICORN, AQUARIUS), in_house(SA, 5))),
    rule(76, 'Dhana (Sun)', '财(日在五)', 'wealth', 1,
         all_of(in_house(SU, 5), in_sign(SU, LEO), in_house(MO, 11), in_house(JU, 11))),
    rule(77, 'Dhana (Jupiter)', '财(木在五)', 'wealth', 1,
         all_of(in_house(JU, 5), in_sign(JU, SAGITTARIUS, PISCES), in_house(MO, 11), in_house(MA, 11))),
    _lagna_aspected(78, 'Dhana (Sun, aspects)', '财(日守命受照)', SU, (LEO,), (MA, JU)),
    _lagna_aspected(79, 'Dhana (Moon, aspects)', '财(月守命受照)', MO, (CANCER,), (MA, JU)),
    _lagna_aspected(80, 'Dhana (Mars, aspects)', '财(火守命受照)', MA, (ARIES, SCORPIO), (MO, VE, SA)),
    _lagna_aspected(81, 'Dhana (Mercury, aspects)', '财(水守命受照)', ME, (GEMINI, VIRGO), (VE, SA)),
    _lagna_aspected(82, 'Dhana (Jupiter, aspects)', '财(木守命受照)', JU, (SAGITTARIUS, PISCES), (ME, MA)),
    _lagna_aspected(83, 'Dhana (Venus, aspects)', '财(金守命受照)', VE, (TAURUS, LIBRA), (ME, SA)),
    rule(84, 'Bahudravyarjana', '多财', 'wealth', 1, all_of(in_house(L(1), 2), in_house(L(2), 11), in_house(L(11), 1))),
    rule(85, 'Matrumooladdhana', '母财', 'wealth', 1, any_of(together(L(2), L(4)), aspects(L(4), L(2)))),   # 二主与四主同宫,或受四主照
    rule(86, 'Ayatnadhanalabha', '不劳而得', 'wealth', 1, all_of(in_house(L(1), 2), in_house(L(2), 1))),
    rule(87, 'Daridra (12)', '贫(十二宫主)', 'poverty', 2,
         all_of(in_house(L(1), 12), in_house(L(12), 1), aspects(L(7), L(12))),
         all_of(in_house(L(1), 12), in_house(L(12), 1), aspects(L(11), L(12)))),
    rule(88, 'Daridra (6)', '贫(六宫主)', 'poverty', 2,
         all_of(in_house(L(1), 6), in_house(L(6), 1), any_of(aspects(L(2), MO), aspects(L(7), MO))),
         all_of(in_house(L(1), 6), in_house(L(6), 1), any_of(aspects(L(2), D(MO)), aspects(L(7), D(MO))))),
    rule(89, 'Daridra (Ketu, Moon)', '贫(月计同命)', 'poverty', 2, all_of(in_house(MO, 1), in_house(KE, 1))),
    rule(90, 'Daridra (8)', '贫(八宫主)', 'poverty', 2,
         all_of(in_house(L(1), 8), in_house(L(8), 1), any_of(aspects(L(2), L(8)), aspects(L(7), L(8))))),
    rule(91, 'Daridra (5)', '贫(五宫主)', 'poverty', 2,
         all_of(in_house(L(5), 6, 10), any_of(*[aspects(L(house), L(5)) for house in (2, 6, 7, 8, 12)])),
         all_of(in_house(L(5), 6, 10), any_of(*[aspects(L(house), L(5)) for house in (2, 6, 7, 8)]))),
    rule(92, 'Bhaskara', '光辉', 'fortune', 1,
         all_of(from_point(ME, SU, 2), from_point(MO, ME, 11), from_point(JU, MO, 5, 9))),
    rule(93, 'Marud', '风神', 'fortune', 1,
         all_of(from_point(JU, VE, 5, 9), from_point(MO, JU, 5), from_point(SU, MO, *KENDRA)),
         all_of(from_point(JU, VE, 5), from_point(MO, JU, 5), from_point(SU, MO, *KENDRA))),
    rule(94, 'Mooka', '喑哑', 'body', 2, all_of(
        from_point(L(2), H(8), 1), from_point(L(2), JU, 1), no(in_sign(JU, CANCER, SAGITTARIUS, PISCES)))),
    rule(95, 'Netranasa', '损目', 'body', 2, all_of(in_house(L(2), 1), in_house(L(6), 1), in_house(L(10), 1))),
    rule(96, 'Andha', '目盲', 'body', 2, any_of(
        all_of(in_house(MO, 2), in_house(ME, 2)),
        all_of(in_house(L(1), 2), in_house(L(2), 2), in_house(SU, 2)))),
    rule(97, 'Sraddhannabhuktha', '食祭', 'body', 2, any_of(in_sign(H(2), CAPRICORN, AQUARIUS), together(L(2), SA))),
    rule(98, 'Ekabhagini', '一姊妹', 'kin', 0, all_of(in_house(ME, 3), from_point(L(3), MO, 1), from_point(MA, SA, 1))),
    rule(99, 'Sapthasankhya Sahodara', '七手足', 'kin', 0, all_of(
        from_point(L(12), MO, 1), from_point(L(12), MA, 1), from_point(MO, JU, 3), no(aspects(VE, MO)))),
    rule(100, 'Vichitra Saudha Prakara', '华屋', 'fortune', 1, all_of(
        together(L(4), L(10)), together(MA, SA), together(MA, L(4), True))),
    rule(101, 'Vahana', '车乘', 'fortune', 1, in_house(L(1), 4, 11), in_house(L(1), 4, 9, 11)),
    rule(102, 'Sarpasapa', '蛇咒', 'kin', 2, all_of(
        in_house(RA, 5), any_of(aspects(MA, RA), in_sign(H(5), ARIES, SCORPIO)))),
    rule(103, 'Pitrusapa Sutakshaya', '父咒损子', 'kin', 2, all_of(in_sign(SU, LIBRA), in_house(SU, 5))),
    rule(104, 'Matrusapa Sutakshaya', '母咒损子', 'kin', 2,
         all_of(in_house(L(8), 5), in_house(L(5), 8), together(MO, L(6))),
         all_of(in_house(L(8), 5), in_house(L(5), 8), in_house(MO, 6), in_house(L(4), 6))),
    rule(105, 'Bhratrusapa Sutakshaya', '兄咒损子', 'kin', 2,
         all_of(in_house(L(1), 8), in_house(L(5), 8), in_house(L(3), 5), in_house(MA, 5), in_house(RA, 5)),
         all_of(in_house(L(1), 8), in_house(L(5), 8), in_house(L(3), 5), in_house(D(MA), 5), in_house(D(RA), 5))),
    rule(106, 'Aputra', '无子', 'kin', 2, in_house(L(5), *DUSTHANA)),
    rule(107, 'Suputra', '佳子', 'kin', 1, all_of(in_sign(H(5), SAGITTARIUS, PISCES), in_sign(SU, ARIES, LEO))),
    rule(108, 'Kalanirdesat', '得子有时', 'kin', 1, all_of(in_house(JU, 5), from_point(L(5), VE, 1))),
    rule(109, 'Bahu Stree', '多妻', 'kin', 0, any_of(aspects(L(7), L(1)), aspects(L(1), L(7))), aspects(L(7), L(1))),
    rule(110, 'Satkalatra', '贤妻', 'kin', 1,
         any_of(aspects(ME, L(7)), aspects(JU, L(7)), aspects(ME, VE), aspects(JU, VE)),
         all_of(any_of(aspects(ME, L(7)), aspects(JU, L(7))), any_of(aspects(ME, VE), aspects(JU, VE)))),
    rule(111, 'Bhaga Chumbana', '婚合', 'kin', 0, all_of(in_house(L(7), 4), in_house(VE, 4))),
)


class RuleChart:
    """规则要读的盘面量。signs 是九曜所在星座序号,asc_sign 是上升星座序号。"""

    def __init__(self, signs, asc_sign, diurnal):
        self.signs = signs
        self.asc_sign = asc_sign
        self.diurnal = diurnal

    def lord_of_sign(self, sign):
        return SIGN_LORDS[sign_name(sign)]

    def lord_of_house(self, house):
        return self.lord_of_sign(self.asc_sign + house - 1)

    def planet(self, point):
        """把点解析成具体的星;宫头、上升这种不是星的回 None。"""
        if isinstance(point, tuple):
            if point[0] == 'lord':
                return self.lord_of_house(point[1])
            if point[0] == 'dispositor':
                return self.lord_of_sign(self.sign(point[1]))
            return None
        return None if point == ASC else point

    def sign(self, point):
        if point == ASC:
            return self.asc_sign
        if isinstance(point, tuple) and point[0] == 'cusp':
            return (self.asc_sign + point[1] - 1) % 12
        return self.signs[self.planet(point)]

    def house(self, point):
        return rel_house(self.asc_sign, self.sign(point))

    def house_counts(self):
        counts = {house: 0 for house in range(1, 13)}
        for planet in CLASSICAL_PLANETS:
            counts[rel_house(self.asc_sign, self.signs[planet])] += 1
        return counts


def _compare(left, op, right):
    return left >= right if op == '>=' else left == right


def evaluate(cond, chart):
    kind = cond[0]
    if kind == 'all':
        return all(evaluate(item, chart) for item in cond[1])
    if kind == 'any':
        return any(evaluate(item, chart) for item in cond[1])
    if kind == 'not':
        return not evaluate(cond[1], chart)
    if kind == 'house':
        return chart.house(cond[1]) in cond[2]
    if kind == 'sign':
        return chart.sign(cond[1]) in cond[2]
    if kind == 'modality':
        return chart.sign(cond[1]) in MODALITY[cond[2]]
    if kind == 'from':
        return rel_house(chart.sign(cond[2]), chart.sign(cond[1])) in cond[3]
    if kind == 'with':
        first, second = chart.planet(cond[1]), chart.planet(cond[2])
        if first is not None and first == second:
            return bool(cond[3])
        return chart.sign(cond[1]) == chart.sign(cond[2])
    if kind == 'drishti':
        giver, receiver = chart.planet(cond[1]), chart.planet(cond[2])
        if giver == receiver:
            return False
        return rel_house(chart.signs[giver], chart.sign(cond[2])) in DRISHTI[giver]
    if kind == 'exalted':
        planet = chart.planet(cond[1])
        return planet in EXALTATION and chart.sign(cond[1]) == const.LIST_SIGNS.index(EXALTATION[planet][0])
    if kind == 'parity':
        return (chart.sign(cond[1]) + 1) % 2 == cond[2]
    if kind == 'count':
        counts = chart.house_counts()
        return _compare(sum(counts[house] for house in cond[1]), cond[2], cond[3])
    if kind == 'modality_count':
        return sum(chart.signs[planet] in MODALITY[cond[1]] for planet in CLASSICAL_PLANETS) == cond[2]
    if kind == 'sign_empty':
        return all(chart.signs[planet] != cond[1] for planet in CLASSICAL_PLANETS)
    if kind == 'occupied':
        return len({chart.signs[planet] for planet in CLASSICAL_PLANETS}) == cond[1]
    if kind == 'day':
        return chart.diurnal == cond[1]
    raise ValueError(kind)


def _point_text(point):
    if point == ASC:
        return '上升'
    if isinstance(point, tuple):
        if point[0] == 'lord':
            return '{0}宫主'.format(point[1])
        if point[0] == 'cusp':
            return '{0}宫'.format(point[1])
        return '{0}的星主'.format(_point_text(point[1]))
    return PLANET_CN.get(point, point)


def _houses_text(houses):
    return '、'.join(str(house) for house in houses)


def _signs_text(signs):
    return '或'.join(SIGN_CN[sign_name(sign)] for sign in signs)


def describe(cond, nested=False):
    """把条件写成一句中文,界面和导出共用。"""
    kind = cond[0]
    if kind in ('all', 'any'):
        joint = ',且' if kind == 'all' else ',或'
        parts = _merge_counts(cond[1], kind)
        text = joint.join(describe(item, True) for item in parts) if parts else ''
        return '({0})'.format(text) if nested and len(parts) > 1 else text
    if kind == 'not':
        return '非 {0}'.format(describe(cond[1], True))
    if kind == 'text':
        return cond[1]
    if kind == 'house':
        if tuple(cond[2]) == KENDRA:
            return '{0}在角宫'.format(_point_text(cond[1]))
        return '{0}在{1}宫'.format(_point_text(cond[1]), _houses_text(cond[2]))
    if kind == 'sign':
        return '{0}在{1}'.format(_point_text(cond[1]), _signs_text(cond[2]))
    if kind == 'modality':
        return '{0}在{1}'.format(_point_text(cond[1]), MODALITY_CN[cond[2]])
    if kind == 'from':
        if tuple(cond[3]) == KENDRA:
            return '{0}在{1}的角宫'.format(_point_text(cond[1]), _point_text(cond[2]))
        if tuple(cond[3]) == (1,):
            return '{0}与{1}同座'.format(_point_text(cond[1]), _point_text(cond[2]))
        return '{0}在{1}起第{2}宫'.format(_point_text(cond[1]), _point_text(cond[2]), _houses_text(cond[3]))
    if kind == 'with':
        return '{0}与{1}同座'.format(_point_text(cond[1]), _point_text(cond[2]))
    if kind == 'drishti':
        return '{0}照{1}'.format(_point_text(cond[1]), _point_text(cond[2]))
    if kind == 'exalted':
        return '{0}入旺'.format(_point_text(cond[1]))
    if kind == 'parity':
        return '{0}在{1}座'.format(_point_text(cond[1]), '奇' if cond[2] else '偶')
    if kind == 'count':
        if cond[3] == 0:
            return '七曜不入{0}宫'.format(_houses_text(cond[1]))
        word = '恰有' if cond[2] == '=' else '至少有'
        return '{0}宫{1}{2}星'.format(_houses_text(cond[1]), word, cond[3])
    if kind == 'modality_count':
        return '七曜不入{0}'.format(MODALITY_CN[cond[1]])
    if kind == 'sign_empty':
        return '七曜不入{0}'.format(SIGN_CN[sign_name(cond[1])])
    if kind == 'occupied':
        return '七曜共占{0}座'.format(cond[1])
    if kind == 'day':
        return '昼生' if cond[1] else '夜生'
    raise ValueError(kind)


def _merge_counts(items, kind):
    """把一串「某宫至少一星 / 恰一星」并成一句,「某星在某点起第 n 宫」并成「诸星之一」。"""
    if kind != 'all':
        return _merge_from(items)
    merged, single = [], {}
    for item in items:
        if item[0] == 'count' and len(item[1]) == 1 and item[3] != 0:
            single.setdefault((item[2], item[3]), []).extend(item[1])
        else:
            merged.append(item)
    for (op, count), houses in single.items():
        word = '各恰有' if op == '=' else '各至少有'
        merged.append(('text', '{0}宫{1}{2}星'.format(_houses_text(houses), word, count)))
    return merged


def _merge_from(items):
    froms = [item for item in items if item[0] == 'from']
    if len(froms) < 2 or len(froms) != len(items) or len({(item[2], item[3]) for item in froms}) != 1:
        return items
    names = '、'.join(_point_text(item[1]) for item in froms)
    return [('text', '{0}之一在{1}起第{2}宫'.format(names, _point_text(froms[0][2]), _houses_text(froms[0][3])))]


def _row(item, chart):
    hit = evaluate(item['cond'], chart)
    classic = item['classic']
    row = {
        'id': item['id'], 'name': item['name'], 'zh': item['zh'], 'group': GROUPS[item['group']],
        'nature': item['nature'], 'hit': hit, 'classicHit': hit if classic is None else evaluate(classic, chart),
        'cond': describe(item['cond']),
    }
    if classic is not None:
        row['classicCond'] = describe(classic)
    return row


# 日出日没按日面上缘接地平、含大气折射(与六力、大运同一口径):日心真高度高于 −50′ 即为昼
SUNRISE_ALTITUDE = -50.0 / 60.0


def sun_is_up(perchart):
    """昼夜是出生事实:看本命时刻太阳是否已升(日面上缘 + 折射),不跟盘上的恒星黄经和分盘走。"""
    jd = perchart.dateTime.jd
    sun = swisseph.calc_ut(jd, swisseph.SUN)[0]
    return swisseph.azalt(jd, swisseph.ECL2HOR, (perchart.pos.lon, perchart.pos.lat, 0.0), 0.0, 0.0, (sun[0], sun[1], sun[2]))[1] > SUNRISE_ALTITUDE


def build_yoga_table(perchart, d1_perchart=None):
    """perchart 用 yoga_engine 同一份盘,可以是分盘;d1_perchart 是本命盘。取不到七曜时回 available=False。"""
    from astrostudy.india.yoga_engine import YogaEngine
    engine = YogaEngine(perchart)
    missing = [planet for planet in CLASSICAL_PLANETS + [RA, KE] if planet not in engine.signs]
    if missing:
        return {'available': False, 'error': '缺少星体 {0}'.format(','.join(missing))}
    chart = RuleChart(engine.signs, engine.asc_sign, sun_is_up(d1_perchart or perchart))
    rows = [_row(item, chart) for item in YOGA_RULES]
    return {
        'available': True,
        'rows': rows,
        'hits': sum(row['hit'] for row in rows),
        'classicHits': sum(row['classicHit'] for row in rows),
    }
