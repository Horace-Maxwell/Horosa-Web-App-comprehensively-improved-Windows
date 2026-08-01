"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    
    
    This module provides useful functions for computing 
    Arabic Parts.
  
"""

from flatlib import const
from flatlib.object import GenericObject
from flatlib.dignities import essential


# Define arabic parts
PARS_FORTUNA = const.PARS_FORTUNA
PARS_SPIRIT = 'Pars Spirit'
PARS_FAITH = 'Pars Faith'
PARS_SUBSTANCE = 'Pars Substance'
PARS_WEDDING_MALE = 'Pars Wedding [Male]'
PARS_WEDDING_FEMALE = 'Pars Wedding [Female]'
PARS_SONS = 'Pars Sons'
PARS_FATHER = 'Pars Father'
PARS_MOTHER = 'Pars Mother'
PARS_BROTHERS = 'Pars Brothers'
PARS_DISEASES = 'Pars Diseases'
PARS_DEATH = 'Pars Death'
PARS_TRAVEL = 'Pars Travel'
PARS_FRIENDS = 'Pars Friends'
PARS_ENEMIES = 'Pars Enemies'
PARS_SATURN = 'Pars Saturn'
PARS_JUPITER = 'Pars Jupiter'
PARS_MARS = 'Pars Mars'
PARS_VENUS = 'Pars Venus'
PARS_MERCURY = 'Pars Mercury'
PARS_HORSEMANSHIP = 'Pars Horsemanship'  # aka Bravery
PARS_LIFE = 'Pars Life'
PARS_RADIX = 'Pars Radix'
# 赫尔墨斯七界点（Hermetic Lots，除福点/精神点外）
PARS_EROS = 'Pars Eros'
PARS_NECESSITY = 'Pars Necessity'
PARS_COURAGE = 'Pars Courage'
PARS_VICTORY = 'Pars Victory'
PARS_NEMESIS = 'Pars Nemesis'
# 希腊化补全六点。🔴 Basis/Exaltation 两 ID 逐字对齐前端显赫指标既有硬编码,勿改字符串。
PARS_BASIS = 'Pars Basis'                       # 基础点:Asc + 福点↔精神点较短弧(昼夜同式,不反转)
PARS_EXALTATION = 'Pars Exaltation'             # 旺宫点:昼 Asc+(19°白羊−Sun) / 夜 Asc+(3°金牛−Moon)
PARS_SONS_VALENS = 'Pars Sons Valens'           # 儿子点(性别化子嗣):昼 Asc+(Mercury−Jupiter),夜反转
PARS_DAUGHTERS = 'Pars Daughters'               # 女儿点:昼 Asc+(Venus−Jupiter),夜反转
PARS_PRAXIS = 'Pars Praxis'                     # 事业/行动点:昼 Asc+(Mars−Mercury),夜反转
PARS_WEDDING_DOROTHEAN = 'Pars Wedding Dorothean'   # 婚姻通式:昼 Asc+(Venus−Sun),夜反转

LIST_PARS = [
    PARS_SPIRIT,
    PARS_FAITH,
    PARS_SUBSTANCE,
    PARS_WEDDING_MALE,
    PARS_WEDDING_FEMALE,
    PARS_SONS,
    PARS_FATHER,
    PARS_MOTHER,
    PARS_BROTHERS,
    PARS_DISEASES,
    PARS_DEATH,
    PARS_TRAVEL,
    PARS_FRIENDS,
    PARS_ENEMIES,
    PARS_SATURN,
    PARS_JUPITER,
    PARS_MARS,
    PARS_VENUS,
    PARS_MERCURY,
    PARS_HORSEMANSHIP,
    PARS_LIFE,
    PARS_RADIX,
    PARS_EROS,
    PARS_NECESSITY,
    PARS_COURAGE,
    PARS_VICTORY,
    PARS_NEMESIS,
    PARS_BASIS,
    PARS_EXALTATION,
    PARS_SONS_VALENS,
    PARS_DAUGHTERS,
    PARS_PRAXIS,
    PARS_WEDDING_DOROTHEAN
]


# Define Diurnal and Nocturnal formulas as
# "Distance of A to B projected from C".
# Note that '$R' stands for the Ruler of something
FORMULAS = {}

FORMULAS[PARS_FORTUNA] = [
    [const.SUN, const.MOON, const.ASC],  # Diurnal
    [const.MOON, const.SUN, const.ASC]   # Nocturnal
]

FORMULAS[PARS_SPIRIT] = [
    [const.MOON, const.SUN, const.ASC],
    [const.SUN, const.MOON, const.ASC]
]

FORMULAS[PARS_FAITH] = [
    [const.MOON, const.MERCURY, const.ASC],
    [const.MERCURY, const.MOON, const.ASC]
]

FORMULAS[PARS_SUBSTANCE] = [
    ['$R' + const.HOUSE2, const.HOUSE2, const.ASC],
    ['$R' + const.HOUSE2, const.HOUSE2, const.ASC]
]

FORMULAS[PARS_WEDDING_MALE] = [
    [const.SATURN, const.VENUS, const.ASC],
    [const.SATURN, const.VENUS, const.ASC]
]

FORMULAS[PARS_WEDDING_FEMALE] = [
    [const.VENUS, const.SATURN, const.ASC],
    [const.VENUS, const.SATURN, const.ASC]
]

FORMULAS[PARS_SONS] = [
    [const.JUPITER, const.SATURN, const.ASC],
    [const.SATURN, const.JUPITER, const.ASC]
]

FORMULAS[PARS_FATHER] = [
    [const.SUN, const.SATURN, const.ASC],
    [const.SATURN, const.SUN, const.ASC]
]

FORMULAS[PARS_MOTHER] = [
    [const.VENUS, const.MOON, const.ASC],
    [const.MOON, const.VENUS, const.ASC]
]

FORMULAS[PARS_BROTHERS] = [
    [const.SATURN, const.JUPITER, const.ASC],
    [const.SATURN, const.JUPITER, const.ASC]
]

FORMULAS[PARS_DISEASES] = [
    [const.SATURN, const.MARS, const.ASC],
    [const.MARS, const.SATURN, const.ASC]
]

FORMULAS[PARS_DEATH] = [
    [const.MOON, const.HOUSE8, const.SATURN],
    [const.MOON, const.HOUSE8, const.SATURN]
]

FORMULAS[PARS_TRAVEL] = [
    ['$R' + const.HOUSE9, const.HOUSE9, const.ASC],
    ['$R' + const.HOUSE9, const.HOUSE9, const.ASC]
]

FORMULAS[PARS_FRIENDS] = [
    [const.MOON, const.MERCURY, const.ASC],
    [const.MOON, const.MERCURY, const.ASC]
]

FORMULAS[PARS_ENEMIES] = [
    ['$R' + const.HOUSE12, const.HOUSE12, const.ASC],
    ['$R' + const.HOUSE12, const.HOUSE12, const.ASC]
]

FORMULAS[PARS_SATURN] = [
    [const.SATURN, const.PARS_FORTUNA, const.ASC],
    [const.PARS_FORTUNA, const.SATURN, const.ASC]
]

FORMULAS[PARS_JUPITER] = [
    [PARS_SPIRIT, const.JUPITER, const.ASC],
    [const.JUPITER, PARS_SPIRIT, const.ASC]
]

FORMULAS[PARS_MARS] = [
    [const.MARS, const.PARS_FORTUNA, const.ASC],
    [const.PARS_FORTUNA, const.MARS, const.ASC]
]

FORMULAS[PARS_VENUS] = [
    [PARS_SPIRIT, const.VENUS, const.ASC],
    [const.VENUS, PARS_SPIRIT, const.ASC]
]

FORMULAS[PARS_MERCURY] = [
    [const.MERCURY, const.PARS_FORTUNA, const.ASC],
    [const.PARS_FORTUNA, const.MERCURY, const.ASC]
]

FORMULAS[PARS_HORSEMANSHIP] = [
    [const.SATURN, const.MOON, const.ASC],
    [const.MOON, const.SATURN, const.ASC]
]

FORMULAS[PARS_LIFE] = [
    [const.SYZYGY, const.MOON, const.ASC],
    [const.SYZYGY, const.MOON, const.ASC]
]

FORMULAS[PARS_RADIX] = [
    [const.MOON, const.SYZYGY, const.ASC],
    [const.MOON, const.SYZYGY, const.ASC]
]

# 赫尔墨斯界点（c + b − a；昼/夜反置）。标准公式（Paulus / R.Hand）：
# 爱欲 Eros 日=Asc+精神−金星  夜=Asc+金星−精神
FORMULAS[PARS_EROS] = [
    [const.VENUS, PARS_SPIRIT, const.ASC],
    [PARS_SPIRIT, const.VENUS, const.ASC]
]
# 必然 Necessity 日=Asc+福点−水星  夜=Asc+水星−福点
FORMULAS[PARS_NECESSITY] = [
    [const.MERCURY, const.PARS_FORTUNA, const.ASC],
    [const.PARS_FORTUNA, const.MERCURY, const.ASC]
]
# 勇气 Courage 日=Asc+福点−火星  夜=Asc+火星−福点
FORMULAS[PARS_COURAGE] = [
    [const.MARS, const.PARS_FORTUNA, const.ASC],
    [const.PARS_FORTUNA, const.MARS, const.ASC]
]
# 胜利 Victory 日=Asc+精神−木星  夜=Asc+木星−精神
FORMULAS[PARS_VICTORY] = [
    [const.JUPITER, PARS_SPIRIT, const.ASC],
    [PARS_SPIRIT, const.JUPITER, const.ASC]
]
# 报应 Nemesis 日=Asc+福点−土星  夜=Asc+土星−福点
FORMULAS[PARS_NEMESIS] = [
    [const.SATURN, const.PARS_FORTUNA, const.ASC],
    [const.PARS_FORTUNA, const.SATURN, const.ASC]
]

# 希腊化补全四常规点(文档式「昼 Asc+(B−A)」↔ 本表三元 [A,B,ASC];反转=夜互换)
# 儿子 Sons(Valens):昼 Asc+(Mercury−Jupiter)
FORMULAS[PARS_SONS_VALENS] = [
    [const.JUPITER, const.MERCURY, const.ASC],
    [const.MERCURY, const.JUPITER, const.ASC]
]
# 女儿 Daughters(Valens):昼 Asc+(Venus−Jupiter)
FORMULAS[PARS_DAUGHTERS] = [
    [const.JUPITER, const.VENUS, const.ASC],
    [const.VENUS, const.JUPITER, const.ASC]
]
# 事业/行动 Praxis:昼 Asc+(Mars−Mercury)
FORMULAS[PARS_PRAXIS] = [
    [const.MERCURY, const.MARS, const.ASC],
    [const.MARS, const.MERCURY, const.ASC]
]
# 婚姻通式(Dorothean):昼 Asc+(Venus−Sun)
FORMULAS[PARS_WEDDING_DOROTHEAN] = [
    [const.SUN, const.VENUS, const.ASC],
    [const.VENUS, const.SUN, const.ASC]
]

# —— 文档口径覆盖(随流派请求级启用;默认关=零回归)——
# 婚姻男/女:文档标「反转」(现默认昼夜同式);子女点(PARS_SONS 三元=Saturn−Jupiter):文档标「不反转」(现默认反转)。
# 朋友点/疾病点:文档式与现状方向相反(文档自标「各家不一/存异文」),故同归此开关而非改默认。
_DOC_REVERSE_FORMULAS = {
    PARS_WEDDING_MALE: [
        [const.SATURN, const.VENUS, const.ASC],
        [const.VENUS, const.SATURN, const.ASC]
    ],
    PARS_WEDDING_FEMALE: [
        [const.VENUS, const.SATURN, const.ASC],
        [const.SATURN, const.VENUS, const.ASC]
    ],
    PARS_SONS: [
        [const.JUPITER, const.SATURN, const.ASC],
        [const.JUPITER, const.SATURN, const.ASC]
    ],
    # 朋友 Friends:文档昼式 Asc+(Moon−Mercury)(现状为 Mercury−Moon 且昼夜同式)
    PARS_FRIENDS: [
        [const.MERCURY, const.MOON, const.ASC],
        [const.MOON, const.MERCURY, const.ASC]
    ],
    # 疾病 Injury/Disease:文档昼式 Asc+(Saturn−Mars)(现状昼式为 Mars−Saturn)
    PARS_DISEASES: [
        [const.MARS, const.SATURN, const.ASC],
        [const.SATURN, const.MARS, const.ASC]
    ],
}
import threading
_DOC_REVERSE_LOCK = threading.Lock()
_docReverseOn = False


def push_request_lots_doc_reverse(flag):
    """请求级「点反转文档口径」:默认关不 push(返回 None,零锁开销);开启才 锁+置位,
    必须 finally 配对 pop_request_lots_doc_reverse(token);pop(None) 安全 no-op。照界系/三分范式。"""
    on = flag in (1, '1', True, 'true', 'True')
    if not on:
        return None
    _DOC_REVERSE_LOCK.acquire()
    global _docReverseOn
    orig = _docReverseOn
    _docReverseOn = True
    return ('lotsDocReverse', orig)


def pop_request_lots_doc_reverse(token):
    if token is None:
        return
    global _docReverseOn
    try:
        _docReverseOn = bool(token[1])
    finally:
        _DOC_REVERSE_LOCK.release()


def _docReverseActive():
    return _docReverseOn

# === Functions === #

def objLon(ID, chart):
    """ Returns the longitude of an object. """
    if ID.startswith('$R'):
        # Return Ruler
        ID = ID[2:]
        obj = chart.get(ID)
        rulerID = essential.ruler(obj.sign)
        ruler = chart.getObject(rulerID)
        return ruler.lon
    elif ID.startswith('Pars'):
        # Return an arabic part
        return partLon(ID, chart)
    else:
        # Return an object
        obj = chart.get(ID)
        return obj.lon
    
def partLon(ID, chart):
    """ Returns the longitude of an arabic part. """
    # special 公式(非 A/B/C 三元):基础点/旺宫点
    if ID == PARS_BASIS:
        # Asc + 福点↔精神点较短弧;昼夜同式不反转
        f = partLon(const.PARS_FORTUNA, chart) % 360
        s = partLon(PARS_SPIRIT, chart) % 360
        arc = (s - f) % 360
        arc = min(arc, 360 - arc)
        return objLon(const.ASC, chart) + arc
    if ID == PARS_EXALTATION:
        # 昼 Asc+(19°白羊−Sun) / 夜 Asc+(3°金牛−Moon)(19/33 为绝对黄经)
        asc = objLon(const.ASC, chart)
        if chart.isDiurnal():
            return asc + (19.0 - objLon(const.SUN, chart))
        return asc + (33.0 - objLon(const.MOON, chart))
    # Get diurnal or nocturnal formula(文档口径反转覆盖仅在请求级开关启用时替换三点)
    table = FORMULAS
    if _docReverseActive() and ID in _DOC_REVERSE_FORMULAS:
        table = _DOC_REVERSE_FORMULAS
    abc = table[ID][0] if chart.isDiurnal() else table[ID][1]
    a = objLon(abc[0], chart)
    b = objLon(abc[1], chart)
    c = objLon(abc[2], chart)
    return c + b - a

def getPart(ID, chart):
    """ Returns an Arabic Part. """
    obj = GenericObject()
    obj.id = ID
    obj.type = const.OBJ_ARABIC_PART
    obj.relocate(partLon(ID, chart))
    try:
        obj.house = chart.houses.getHouseByLon(obj.lon).id
    finally:
        return obj
