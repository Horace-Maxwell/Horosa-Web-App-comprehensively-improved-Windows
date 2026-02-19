"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    

    This module defines the names of signs, objects, angles, 
    houses and fixed-stars used in the library.

"""


# === Base constants === */

# Zodiacal System
SIDEREAL = 'Sidereal'
TROPICAL = 'Tropical'
ZODIACALSYS = [TROPICAL, SIDEREAL]

# Four primitive qualities
HOT = 'Hot'
COLD = 'Cold'
DRY = 'Dry'
HUMID = 'Humid'

# Four Elements
FIRE = 'Fire'
EARTH = 'Earth'
AIR = 'Air'
WATER = 'Water'

# Four Temperaments
CHOLERIC = 'Choleric'
MELANCHOLIC = 'Melancholic'
SANGUINE = 'Sanguine'
PHLEGMATIC = 'Phlegmatic'

# Genders
MASCULINE = 'Masculine'
FEMININE = 'Feminine'
NEUTRAL = 'Neutral'

# Factions
DIURNAL = 'Diurnal'
NOCTURNAL = 'Nocturnal'

# Sun seasons
SPRING = 'Spring'
SUMMER = 'Summer'
AUTUMN = 'Autumn'
WINTER = 'Winter'

# Moon Quarters
MOON_FIRST_QUARTER = 'First Quarter'
MOON_SECOND_QUARTER = 'Second Quarter'
MOON_THIRD_QUARTER = 'Third Quarter'
MOON_LAST_QUARTER = 'Last Quarter'


# === Signs === */

ARIES = 'Aries'
TAURUS = 'Taurus'
GEMINI = 'Gemini'
CANCER = 'Cancer'
LEO = 'Leo'
VIRGO = 'Virgo'
LIBRA = 'Libra'
SCORPIO = 'Scorpio'
SAGITTARIUS = 'Sagittarius'
CAPRICORN = 'Capricorn'
AQUARIUS = 'Aquarius'
PISCES = 'Pisces'

# Sign modes
CARDINAL = 'Cardinal'
FIXED = 'Fixed'
MUTABLE = 'Mutable'

# Sign figures
SIGN_FIGURE_NONE = 'None'
SIGN_FIGURE_BEAST = 'Beast'
SIGN_FIGURE_HUMAN = 'Human'
SIGN_FIGURE_WILD = 'Wild'

# Sign fertilities
SIGN_FERTILE = 'Fertile'
SIGN_STERILE = 'Sterile'
SIGN_MODERATELY_FERTILE = 'Moderately Fertile'
SIGN_MODERATELY_STERILE = 'Moderately Sterile'


# === Objects === */

# Names
SUN = 'Sun'
MOON = 'Moon'
MERCURY = 'Mercury'
VENUS = 'Venus'
MARS = 'Mars'
JUPITER = 'Jupiter'
SATURN = 'Saturn'
URANUS = 'Uranus'
NEPTUNE = 'Neptune'
PLUTO = 'Pluto'
CHIRON = 'Chiron'
NORTH_NODE = 'North Node'
SOUTH_NODE = 'South Node'
SYZYGY = 'Syzygy'
PARS_FORTUNA = 'Pars Fortuna'
NO_PLANET = 'None'
DARKMOON = 'Dark Moon'
PURPLE_CLOUDS = 'Purple Clouds'
PHOLUS = 'Pholus'
CERES = 'Ceres'
PALLAS = 'Pallas'
JUNO = 'Juno'
VESTA = 'Vesta'
INTP_APOG = 'Intp_Apog'
INTP_PERG = 'Intp_Perg'

MOONSUN = 'MoonSun'
SATURNMARS = 'SaturnMars'
JUPITERVENUS = 'JupiterVenus'

# Object movement
DIRECT = 'Direct'
RETROGRADE = 'Retrograde'
STATIONARY = 'Stationary'

# Mean daily motions
MEAN_MOTION_SUN = 0.9833
MEAN_MOTION_MOON = 13.1833

# Object type
OBJ_PLANET = 'Planet'
OBJ_HOUSE = 'House'
OBJ_MOON_NODE = 'Moon Node'
OBJ_ARABIC_PART = 'Arabic Part'
OBJ_FIXED_STAR = 'Fixed Star'
OBJ_ASTEROID = 'Asteroid'
OBJ_LUNATION = 'Lunation'
OBJ_GENERIC = 'Generic'
OBJ_MIDDLE = 'Middle'


# === Houses === */

HOUSE1 = 'House1'
HOUSE2 = 'House2'
HOUSE3 = 'House3'
HOUSE4 = 'House4'
HOUSE5 = 'House5'
HOUSE6 = 'House6'
HOUSE7 = 'House7'
HOUSE8 = 'House8'
HOUSE9 = 'House9'
HOUSE10 = 'House10'
HOUSE11 = 'House11'
HOUSE12 = 'House12'

# House conditions
ANGULAR = 'Angular'
SUCCEDENT = 'Succedent'
CADENT = 'Cadent'

# Benefic/Malefic houses
HOUSES_BENEFIC = [HOUSE1, HOUSE5, HOUSE11]
HOUSES_MALEFIC = [HOUSE6, HOUSE12]

# House Systems
HOUSES_PLACIDUS = 'Placidus'
HOUSES_KOCH = 'Koch'
HOUSES_PORPHYRIUS = 'Porphyrius'
HOUSES_REGIOMONTANUS = 'Regiomontanus'
HOUSES_CAMPANUS = 'Campanus'
HOUSES_EQUAL = 'Equal'
HOUSES_EQUAL_2 = 'Equal 2'
HOUSES_VEHLOW_EQUAL = 'Vehlow Equal'
HOUSES_WHOLE_SIGN = 'Whole Sign'
HOUSES_MERIDIAN = 'Meridian'
HOUSES_AZIMUTHAL = 'Azimuthal'
HOUSES_POLICH_PAGE = 'Polich Page'
HOUSES_ALCABITUS = 'Alcabitus'
HOUSES_MORINUS = 'Morinus'
HOUSES_SRIPATI = 'Sripati'
HOUSES_EQUAL_MC = 'Equal MC'
HOUSES_DEFAULT = HOUSES_WHOLE_SIGN


# === Angles === */

ASC = 'Asc'
DESC = 'Desc'
MC = 'MC'
IC = 'IC'


# === Fixed Stars === */

STAR_ALGENIB = 'Algenib'
STAR_ALPHERATZ = 'Alpheratz'
STAR_ZAUR = 'Zaur'
STAR_ALGOL = 'Algol'
STAR_ALCYONE = 'Alcyone'
STAR_PLEIADES = STAR_ALCYONE
STAR_ALDEBARAN = 'Aldebaran'
STAR_RIGEL = 'Rigel'
STAR_CAPELLA = 'Capella'
STAR_BETELGEUSE = 'Betelgeuse'
STAR_SIRIUS = 'Sirius'
STAR_CANOPUS = 'Canopus'
STAR_CASTOR = 'Castor'
STAR_POLLUX = 'Pollux'
STAR_PROCYON = 'Procyon'
STAR_ASELLUS_BOREALIS = 'Asellus Borealis'
STAR_ASELLUS_AUSTRALIS = 'Asellus Australis'
STAR_ALPHARD = 'Alphard'
STAR_REGULUS = 'Regulus'
STAR_DENEBOLA = 'Denebola'
STAR_ALGORAB = 'Algorab'
STAR_SPICA = 'Spica'
STAR_ARCTURUS = 'Arcturus'
STAR_ALPHECCA = 'Alphecca'
STAR_ZUBEN_ELGENUBI = 'Zuben Elgenubi'
STAR_ZUBEN_ELSCHEMALI = 'Zuben Eshamali'
STAR_UNUKALHAI = 'Unukalhai'
STAR_AGENA = 'Agena'
STAR_RIGEL_CENTAURUS = 'Rigel Kentaurus'
STAR_ANTARES = 'Antares'
STAR_LESATH = 'Lesath'
STAR_VEGA = 'Vega'
STAR_ALTAIR = 'Altair'
STAR_DENEB_ALGEDI = 'Deneb Algedi'
STAR_FOMALHAUT = 'Fomalhaut'
STAR_DENEB_ADIGE = 'Deneb'  # Alpha-Cygnus
STAR_ACHERNAR = 'Achernar'

STAR_ALDERAMIN = 'Alderamin'
STAR_ANDROMEDA = 'Andromeda'
STAR_ALRISCHA = 'Alrischa'
STAR_MIRACH = 'Mirach'
STAR_ALMAC = 'Almac'
STAR_ALNATH = 'Alnath'
STAR_ALNILAM = 'Alnilam'
STAR_MENKALINAN = 'Menkalinan'
STAR_MURZIM = 'Murzim'
STAR_ALHENA = 'Alhena'
STAR_WASAT = 'Wasat'
STAR_ADARA = 'Adara'
STAR_WEZEN = 'Wezen'
STAR_KOCHAB = 'Kochab'
STAR_ACUBENS = 'Acubens'
STAR_SUHAIL = 'Suhail'
STAR_AVIOR = 'Avior'
STAR_VINDEMIATRIX = 'Vindemiatrix'
STAR_MIAPLACIDUS = 'Miaplacidus'
STAR_GACRUX = 'Gacrux'
STAR_ACRUX = 'Acrux'
STAR_UNUKALHAI = 'Unuk Alhai'
STAR_RASALHAGUE = 'Ras Alhague'
STAR_SHAULA = 'Shaula'
STAR_SARGAS = 'Sargas'
STAR_APEX = 'Apex'
STAR_KAUSAUSTRALIS = 'Kaus Australis'
STAR_PEACOCK = 'Peacock'
STAR_ALNAIR = 'Alnair'
STAR_NASHIRA = 'Nashira'
STAR_SKAT = 'Skat'

STAR_NAMES = {
    'Algenib': '壁宿一',
    'Alpheratz': '壁宿二',
    'Zaur': '天苑一',
    'Algol': '大陵五',
    'Alcyone': '昴宿六',
    'Aldebaran': '毕宿五',
    'Rigel': '参宿七',
    'Capella': '五车二',
    'Betelgeuse': '参宿四',
    'Sirius': '天狼星',
    'Canopus': '老人星',
    'Castor': '北河二',
    'Pollux': '北河三',
    'Procyon': '南河三',
    'Asellus Borealis': '鬼宿三',
    'Asellus Australis': '鬼宿四',
    'Alphard': '星宿一',
    'Regulus': '狮心轩辕十四',
    'Denebola': '五帝座一',
    'Algorab': '轸宿三',
    'Spica': '角宿一',
    'Arcturus': '大角',
    'Alphecca': '贯索四',
    'Zuben Elgenubi': '氐宿一',
    'Zuben Eshamali': '氐宿四',
    'Unukalhai': '天市右垣七',
    'Agena': '马腹一',
    'Rigel Kentaurus': '南門二',
    'Antares': '蝎心心宿二',
    'Lesath': '尾宿九',
    'Vega': '织女星',
    'Altair': '牛郎星',
    'Deneb Algedi': '垒壁阵四',
    'Fomalhaut': '北落师门',
    'Deneb': '天津四',
    'Achernar': '水委一',

    'Alderamin': '天鉤五',
    'Andromeda': '仙女星雲',
    'Alrischa': '外屏七',
    'Mirach': '奎宿九',
    'Almac': '天大將軍一',
    'Alnath': '五車五',
    'Alnilam': '參宿二',
    'Menkalinan': '五车三',
    'Murzim': '軍市一',
    'Alhena': '井宿三',
    'Wasat': '天樽二',
    'Adara': '弧矢七',
    'Wezen': '弧矢一',
    'Acubens': '柳宿增三',
    'Suhail': '天社',
    'Avior': '海石一',
    'Vindemiatrix': '东次將',
    'Miaplacidus': '南船五',
    'Gacrux': '十字架一',
    'Acrux': '十字架二',
    'Unuk Alhai': '蜀',
    'Ras Alhague': '侯',
    'Shaula': '尾宿八',
    'Sargas': '尾宿五',
    'Apex': '太陽奔赴点',
    'Kaus Australis': '箕宿三',
    'Peacock': '孔雀十一',
    'Alnair': '鶴一',
    'Nashira': '壁垒阵三',
    'Skat': '羽林军二六',

    'Dubhe': '天枢，大熊座α',
    'Merak': '天璇，大熊座β',
    'Phecda': '天玑，大熊座γ',
    'Megrez': '天权，大熊座δ',
    'Alioth': '玉衡，大熊座ε',
    'Mizar': '开阳，大熊座ζ',
    'Alkaid': '摇光，大熊座η',

    'Polaris': '勾陈一',
    ',zeUMi': '勾陈四',
    'Edasich': '左枢',
    'Thuban': '右枢',
    'Ketu': '天龙座κ',
    'Alrai': '少卫增八',
    'Kochab': '帝星，北极二',

}

BEIDOU_DUBHE = 'Dubhe'
BEIDOU_MERAK = 'Merak'
BEIDOU_PHECDA = 'Phecda'
BEIDOU_MEGREZ = 'Megrez'
BEIDOU_ALIOTH = 'Alioth'
BEIDOU_MIZAR = 'Mizar'
BEIDOU_ALKAID = 'Alkaid'

LIST_BEIDOU = [BEIDOU_DUBHE, BEIDOU_MERAK, BEIDOU_PHECDA, BEIDOU_MEGREZ, BEIDOU_ALIOTH, BEIDOU_MIZAR, BEIDOU_ALKAID]



BEIJI_POLARIS = 'Polaris'
BEIJI_EDASICH = 'Edasich'
BEIJI_THUBAN = 'Thuban'
BEIJI_KETU = 'Ketu'
BEIJI_ALRAI = 'Alrai'
BEIJI_ZEUMI = ',zeUMi'
BEIJI_KOCHAB = 'Kochab'

LIST_BEIJI = [BEIJI_POLARIS, BEIJI_EDASICH, BEIJI_THUBAN, BEIJI_KETU, BEIJI_ALRAI, BEIJI_ZEUMI, BEIJI_KOCHAB]

START_JIAO = 'Spica'
START_KANG = ',kaVir'
START_DI = 'Zubenelgenubi'
START_FANG = ',piSco'
START_XIN = 'Alniyat'
START_WEIBA = ',epSco'
START_JI = 'Alnasl'
START_DOU = ',phSgr'
START_NIU = 'Dabih'
START_NV = 'Albali'
START_XU = 'Sadalsuud'
START_WEIXIAN = 'Sadalmelik'
START_SHI = 'Markab'
START_QIANBI = 'Alpheratz'
START_KUI = ',zeAnd'
START_LOU = 'Sheratan'
START_WEI = ',41Ari'
START_AN = 'Electra'
START_BI = ',epTau'
START_ZI = 'Bellatrix'
START_CANG = 'Mintaka'
START_JIN = 'Tejat'
START_GUI = ',etCnc'
START_NIUSHU = ',deHya'
START_XINGXING = 'Alphard'
START_ZHANG = ',nuHya'
START_YI = 'Alkes'
START_ZHEN = ',gaCrv'

# === Aspects === */

# Major Aspects
NO_ASPECT = -1
CONJUNCTION = 0
SEXTILE = 60
SQUARE = 90
TRINE = 120
OPPOSITION = 180

# Minor Aspects
SEMISEXTILE = 30
SEMIQUINTILE = 36
SEMISQUARE = 45
QUINTILE = 72
SESQUIQUINTILE = 108
SESQUISQUARE = 135
BIQUINTILE = 144
QUINCUNX = 150

# Aspect movement
APPLICATIVE = 'Applicative'
SEPARATIVE = 'Separative'
EXACT = 'Exact'
NO_MOVEMENT = 'None'

# Aspect direction
DEXTER = 'Dexter'      # Right side
SINISTER = 'Sinister'  # Left side

# Aspect properties
ASSOCIATE = 'Associate'
DISSOCIATE = 'Dissociate'

# Aspect lists
MAJOR_ASPECTS = [0, 60, 90, 120, 180]
MINOR_ASPECTS = [30, 36, 45, 72, 108, 135, 144, 150]
ALL_ASPECTS = MAJOR_ASPECTS + MINOR_ASPECTS


# === Some Lists === */

LIST_SIGNS = [
    ARIES, TAURUS, GEMINI, CANCER, LEO, VIRGO, LIBRA,
    SCORPIO, SAGITTARIUS, CAPRICORN, AQUARIUS, PISCES
]

LIST_OBJECTS = [
    SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN, 
    URANUS, NEPTUNE, PLUTO, CHIRON, NORTH_NODE,
    SOUTH_NODE, SYZYGY, PARS_FORTUNA, DARKMOON, PURPLE_CLOUDS,
    PHOLUS, CERES, PALLAS, JUNO, VESTA, INTP_APOG, INTP_PERG,
]

LIST_OBJECTS_TRADITIONAL = [
    SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN,
    NORTH_NODE, SOUTH_NODE, SYZYGY, PARS_FORTUNA, DARKMOON, PURPLE_CLOUDS
]

LIST_SEVEN_PLANETS = [
    SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN
]

LIST_VIRTUAL_POINTS = [
    DARKMOON, PURPLE_CLOUDS, NORTH_NODE, SOUTH_NODE, PARS_FORTUNA, SYZYGY,
    MC, IC, ASC, DESC
]

LIST_ALL_POINTS = [
    SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN,
    URANUS, NEPTUNE, PLUTO, CHIRON, NORTH_NODE,
    SOUTH_NODE, SYZYGY, PARS_FORTUNA, DARKMOON, PURPLE_CLOUDS,
    PHOLUS, CERES, PALLAS, JUNO, VESTA, INTP_APOG, INTP_PERG,
    MC, IC, ASC, DESC
]

LIST_ALL_POINTS_EXCLUDE_VIRTUALPNT = [
    SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN,
    URANUS, NEPTUNE, PLUTO
]

LIST_MIDDLE_POINTS = [
    MOONSUN, SATURNMARS, JUPITERVENUS
]

LIST_HOUSES = [
    HOUSE1, HOUSE2, HOUSE3, HOUSE4, HOUSE5, HOUSE6,
    HOUSE7, HOUSE8, HOUSE9, HOUSE10, HOUSE11, HOUSE12,
]

LIST_ANGLES = [
    ASC, MC, DESC, IC
]

LIST_FIXED_STARS = [
    STAR_ALGENIB, STAR_ALPHERATZ, STAR_ZAUR, STAR_ALGOL, STAR_ALCYONE,
    STAR_PLEIADES, STAR_ALDEBARAN, STAR_RIGEL, STAR_CAPELLA,
    STAR_BETELGEUSE, STAR_SIRIUS, STAR_CANOPUS, STAR_CASTOR,
    STAR_POLLUX, STAR_PROCYON, STAR_ASELLUS_BOREALIS,
    STAR_ASELLUS_AUSTRALIS, STAR_ALPHARD, STAR_REGULUS,
    STAR_DENEBOLA, STAR_ALGORAB, STAR_SPICA, STAR_ARCTURUS,
    STAR_ALPHECCA, STAR_ZUBEN_ELSCHEMALI, STAR_UNUKALHAI,
    STAR_AGENA, STAR_RIGEL_CENTAURUS, STAR_ANTARES,
    STAR_LESATH, STAR_VEGA, STAR_ALTAIR, STAR_DENEB_ALGEDI,
    STAR_FOMALHAUT, STAR_DENEB_ADIGE, STAR_ACHERNAR,
    STAR_ALDERAMIN, STAR_ANDROMEDA, STAR_ALRISCHA, STAR_MIRACH,
    STAR_ALMAC, STAR_ALNATH, STAR_ALNILAM,
    STAR_MENKALINAN, STAR_MURZIM, STAR_ALHENA, STAR_WASAT,
    STAR_ADARA, STAR_WEZEN, STAR_KOCHAB, STAR_ACUBENS,
    STAR_SUHAIL, STAR_AVIOR, STAR_VINDEMIATRIX, STAR_MIAPLACIDUS,
    STAR_GACRUX, STAR_ACRUX, STAR_UNUKALHAI,
    STAR_RASALHAGUE, STAR_SHAULA, STAR_SARGAS,
    STAR_APEX, STAR_KAUSAUSTRALIS, STAR_PEACOCK,
    STAR_ALNAIR, STAR_NASHIRA, STAR_SKAT
]

LIST_FIXED_SU28 = [
    START_JIAO, START_KANG, START_DI, START_FANG, START_XIN, START_WEIBA, START_JI,
    START_DOU, START_NIU, START_NV, START_XU, START_WEIXIAN, START_SHI, START_QIANBI,
    START_KUI, START_LOU, START_WEI, START_AN, START_BI, START_ZI, START_CANG,
    START_JIN, START_GUI, START_NIUSHU, START_XINGXING, START_ZHANG, START_YI, START_ZHEN
]

LIST_FIXED_SU28_NAME = [
    '角', '亢', '氐', '房', '心', '尾', '箕',
    '斗', '牛', '女', '虚', '危', '室', '壁',
    '奎', '娄', '胃', '昴', '毕', '觜', '参',
    '井', '鬼', '柳', '星', '张', '翼', '轸'
]

Su28WuXing = {
    '角': '木',
    '亢': '金',
    '氐': '土',
    '房': '火',
    '心': '水',
    '尾': '火',
    '箕': '水',
    '斗': '木',
    '牛': '金',
    '女': '土',
    '虚': '火',
    '危': '水',
    '室': '火',
    '壁': '水',
    '奎': '木',
    '娄': '金',
    '胃': '土',
    '昴': '火',
    '毕': '水',
    '觜': '火',
    '参': '水',
    '井': '木',
    '鬼': '金',
    '柳': '土',
    '星': '火',
    '张': '水',
    '翼': '火',
    '轸': '水',

}

Su28Animal = {
    '角': '木蛟',
    '亢': '金龙',
    '氐': '土貉',
    '房': '日兔',
    '心': '月狐',
    '尾': '火虎',
    '箕': '水豹',
    '斗': '木獬',
    '牛': '金牛',
    '女': '土蝠',
    '虚': '日鼠',
    '危': '月燕',
    '室': '火猪',
    '壁': '水獝',
    '奎': '木狼',
    '娄': '金狗',
    '胃': '土雉',
    '昴': '日鸡',
    '毕': '月乌',
    '觜': '火猴',
    '参': '水猿',
    '井': '木犴',
    '鬼': '金羊',
    '柳': '土獐',
    '星': '日马',
    '张': '月鹿',
    '翼': '火蛇',
    '轸': '水蚓',

}

ECLI2EQ_OBLIQUITY = -23.44
EQ2ECLI_OBLIQUITY = 23.44
