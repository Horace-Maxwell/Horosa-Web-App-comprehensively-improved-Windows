import math
import traceback

from flatlib import angle
from flatlib import const
from flatlib import utils
from flatlib.chart import Chart
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.dignities import essential
from flatlib.dignities import tables
from flatlib.ephem import eph
from flatlib.ephem import swe


INDIA_AYANAMSA_MODES = {
    'lahiri': {
        'key': 'lahiri',
        'label': 'Lahiri / Chitrapaksha',
        'mode': swe.SE_SIDM_LAHIRI,
    },
    'raman': {
        'key': 'raman',
        'label': 'Raman',
        'mode': swe.SE_SIDM_RAMAN,
    },
    'krishnamurti': {
        'key': 'krishnamurti',
        'label': 'Krishnamurti / KP',
        'mode': swe.SE_SIDM_KRISHNAMURTI,
    },
    'krishnamurti_vp291': {
        'key': 'krishnamurti_vp291',
        'label': 'Krishnamurti VP291',
        'mode': swe.SE_SIDM_KRISHNAMURTI_VP291,
    },
    'yukteshwar': {
        'key': 'yukteshwar',
        'label': 'Yukteshwar',
        'mode': swe.SE_SIDM_YUKTESHWAR,
    },
    'true_citra': {
        'key': 'true_citra',
        'label': 'True Citra',
        'mode': swe.SE_SIDM_TRUE_CITRA,
    },
    'true_revati': {
        'key': 'true_revati',
        'label': 'True Revati',
        'mode': swe.SE_SIDM_TRUE_REVATI,
    },
    'fagan_bradley': {
        'key': 'fagan_bradley',
        'label': 'Fagan/Bradley',
        'mode': swe.SE_SIDM_FAGAN_BRADLEY,
    },
    # ==== 全量补齐 (Swiss Ephemeris 全部 SIDM 模式) ==== #
    'lahiri_icrc': {'key': 'lahiri_icrc', 'label': 'Lahiri ICRC (官定2022)', 'mode': swe.SE_SIDM_LAHIRI_ICRC},
    'lahiri_1940': {'key': 'lahiri_1940', 'label': 'Lahiri 1940', 'mode': swe.SE_SIDM_LAHIRI_1940},
    'lahiri_vp285': {'key': 'lahiri_vp285', 'label': 'Lahiri VP285', 'mode': swe.SE_SIDM_LAHIRI_VP285},
    'deluce': {'key': 'deluce', 'label': 'De Luce', 'mode': swe.SE_SIDM_DELUCE},
    'jn_bhasin': {'key': 'jn_bhasin', 'label': 'J.N. Bhasin', 'mode': swe.SE_SIDM_JN_BHASIN},
    'ushashashi': {'key': 'ushashashi', 'label': 'Usha/Shashi', 'mode': swe.SE_SIDM_USHASHASHI},
    'true_pushya': {'key': 'true_pushya', 'label': 'True Pushya', 'mode': swe.SE_SIDM_TRUE_PUSHYA},
    'true_mula': {'key': 'true_mula', 'label': 'True Mula (Chandra Hari)', 'mode': swe.SE_SIDM_TRUE_MULA},
    'true_sheoran': {'key': 'true_sheoran', 'label': 'Vedic / Sheoran', 'mode': swe.SE_SIDM_TRUE_SHEORAN},
    'ss_citra': {'key': 'ss_citra', 'label': 'SS Citra', 'mode': swe.SE_SIDM_SS_CITRA},
    'ss_revati': {'key': 'ss_revati', 'label': 'SS Revati', 'mode': swe.SE_SIDM_SS_REVATI},
    'suryasiddhanta': {'key': 'suryasiddhanta', 'label': 'Surya Siddhanta', 'mode': swe.SE_SIDM_SURYASIDDHANTA},
    'suryasiddhanta_msun': {'key': 'suryasiddhanta_msun', 'label': 'Surya Siddhanta (mean Sun)', 'mode': swe.SE_SIDM_SURYASIDDHANTA_MSUN},
    'aryabhata': {'key': 'aryabhata', 'label': 'Aryabhata', 'mode': swe.SE_SIDM_ARYABHATA},
    'aryabhata_msun': {'key': 'aryabhata_msun', 'label': 'Aryabhata (mean Sun)', 'mode': swe.SE_SIDM_ARYABHATA_MSUN},
    'aryabhata_522': {'key': 'aryabhata_522', 'label': 'Aryabhata 522', 'mode': swe.SE_SIDM_ARYABHATA_522},
    'djwhal_khul': {'key': 'djwhal_khul', 'label': 'Djwhal Khul', 'mode': swe.SE_SIDM_DJWHAL_KHUL},
    'valens_moon': {'key': 'valens_moon', 'label': 'Vettius Valens', 'mode': swe.SE_SIDM_VALENS_MOON},
    'galcent_0sag': {'key': 'galcent_0sag', 'label': 'Galactic Center 0°Sag', 'mode': swe.SE_SIDM_GALCENT_0SAG},
    'galcent_rgilbrand': {'key': 'galcent_rgilbrand', 'label': 'Galactic Center (Gil Brand)', 'mode': swe.SE_SIDM_GALCENT_RGILBRAND},
    'galcent_mula_wilhelm': {'key': 'galcent_mula_wilhelm', 'label': 'Galactic Center/Mula (Wilhelm)', 'mode': swe.SE_SIDM_GALCENT_MULA_WILHELM},
    'galcent_cochrane': {'key': 'galcent_cochrane', 'label': 'Galactic Center (Cochrane)', 'mode': swe.SE_SIDM_GALCENT_COCHRANE},
    'galequ_iau1958': {'key': 'galequ_iau1958', 'label': 'Galactic Equator (IAU1958)', 'mode': swe.SE_SIDM_GALEQU_IAU1958},
    'galequ_true': {'key': 'galequ_true', 'label': 'Galactic Equator (true)', 'mode': swe.SE_SIDM_GALEQU_TRUE},
    'galequ_mula': {'key': 'galequ_mula', 'label': 'Galactic Equator (mid-Mula)', 'mode': swe.SE_SIDM_GALEQU_MULA},
    'galequ_fiorenza': {'key': 'galequ_fiorenza', 'label': 'Galactic Equator (Fiorenza)', 'mode': swe.SE_SIDM_GALEQU_FIORENZA},
    'galalign_mardyks': {'key': 'galalign_mardyks', 'label': 'Skydram (Mardyks)', 'mode': swe.SE_SIDM_GALALIGN_MARDYKS},
    'hipparchos': {'key': 'hipparchos', 'label': 'Hipparchos', 'mode': swe.SE_SIDM_HIPPARCHOS},
    'sassanian': {'key': 'sassanian', 'label': 'Sassanian', 'mode': swe.SE_SIDM_SASSANIAN},
    'aldebaran_15tau': {'key': 'aldebaran_15tau', 'label': 'Aldebaran 15°Tau', 'mode': swe.SE_SIDM_ALDEBARAN_15TAU},
    'babyl_kugler1': {'key': 'babyl_kugler1', 'label': 'Babylonian/Kugler 1', 'mode': swe.SE_SIDM_BABYL_KUGLER1},
    'babyl_kugler2': {'key': 'babyl_kugler2', 'label': 'Babylonian/Kugler 2', 'mode': swe.SE_SIDM_BABYL_KUGLER2},
    'babyl_kugler3': {'key': 'babyl_kugler3', 'label': 'Babylonian/Kugler 3', 'mode': swe.SE_SIDM_BABYL_KUGLER3},
    'babyl_huber': {'key': 'babyl_huber', 'label': 'Babylonian/Huber', 'mode': swe.SE_SIDM_BABYL_HUBER},
    'babyl_etpsc': {'key': 'babyl_etpsc', 'label': 'Babylonian/Eta Piscium', 'mode': swe.SE_SIDM_BABYL_ETPSC},
    'babyl_britton': {'key': 'babyl_britton', 'label': 'Babylonian/Britton', 'mode': swe.SE_SIDM_BABYL_BRITTON},
    'j2000': {'key': 'j2000', 'label': 'J2000', 'mode': swe.SE_SIDM_J2000},
    'j1900': {'key': 'j1900', 'label': 'J1900', 'mode': swe.SE_SIDM_J1900},
    'b1950': {'key': 'b1950', 'label': 'B1950', 'mode': swe.SE_SIDM_B1950},
}

INDIA_AYANAMSA_ALIASES = {
    'chitrapaksha': 'lahiri',
    'kp': 'krishnamurti',
    'krishnamurti-vp291': 'krishnamurti_vp291',
    'senthilathiban': 'krishnamurti_vp291',
    'truecitra': 'true_citra',
    'true-citra': 'true_citra',
    'truerevati': 'true_revati',
    'true-revati': 'true_revati',
    'fagan': 'fagan_bradley',
    'fagan-bradley': 'fagan_bradley',
    'icrc': 'lahiri_icrc',
    'lahiri-icrc': 'lahiri_icrc',
    'pushya': 'true_pushya',
    'pushya_paksha': 'true_pushya',
    'chandrahari': 'true_mula',
    'chandra_hari': 'true_mula',
    'sheoran': 'true_sheoran',
    'bhasin': 'jn_bhasin',
    'wilhelm': 'galcent_mula_wilhelm',
    'galactic': 'galcent_mula_wilhelm',
    'galactic_center': 'galcent_0sag',
}

INDIA_HOUSE_SYSTEMS = {
    0: {
        'key': 'whole_sign',
        'label': 'Whole Sign / Rashi',
        'flatlib': const.HOUSES_WHOLE_SIGN,
        'base': const.HOUSES_PLACIDUS,
    },
    5: {
        'key': 'equal_lagna',
        'label': 'Equal / Lagna Bhava',
        'flatlib': const.HOUSES_EQUAL,
        'base': const.HOUSES_PLACIDUS,
    },
    7: {
        'key': 'sripati',
        'label': 'Sripati',
        'flatlib': const.HOUSES_SRIPATI,
        'base': const.HOUSES_SRIPATI,
    },
    3: {
        'key': 'kp_placidus',
        'label': 'KP / Placidus',
        'flatlib': const.HOUSES_PLACIDUS,
        'base': const.HOUSES_PLACIDUS,
    },
    # ==== 全量补齐 (flatlib/Swiss Ephemeris 全部分宫制；非 0/5 走 swe sidereal cusps) ==== #
    6: {'key': 'vehlow_equal', 'label': 'Vehlow 等宫·命居宫中', 'flatlib': const.HOUSES_VEHLOW_EQUAL, 'base': const.HOUSES_VEHLOW_EQUAL},
    9: {'key': 'porphyry', 'label': 'Porphyry 波菲', 'flatlib': const.HOUSES_PORPHYRIUS, 'base': const.HOUSES_PORPHYRIUS},
    4: {'key': 'koch', 'label': 'Koch', 'flatlib': const.HOUSES_KOCH, 'base': const.HOUSES_KOCH},
    10: {'key': 'campanus', 'label': 'Campanus', 'flatlib': const.HOUSES_CAMPANUS, 'base': const.HOUSES_CAMPANUS},
    2: {'key': 'regiomontanus', 'label': 'Regiomontanus', 'flatlib': const.HOUSES_REGIOMONTANUS, 'base': const.HOUSES_REGIOMONTANUS},
    8: {'key': 'alcabitus', 'label': 'Alcabitus', 'flatlib': const.HOUSES_ALCABITUS, 'base': const.HOUSES_ALCABITUS},
    11: {'key': 'morinus', 'label': 'Morinus', 'flatlib': const.HOUSES_MORINUS, 'base': const.HOUSES_MORINUS},
    12: {'key': 'meridian', 'label': 'Meridian / Axial', 'flatlib': const.HOUSES_MERIDIAN, 'base': const.HOUSES_MERIDIAN},
    13: {'key': 'polich_page', 'label': 'Polich-Page / Topocentric', 'flatlib': const.HOUSES_POLICH_PAGE, 'base': const.HOUSES_POLICH_PAGE},
    14: {'key': 'equal_mc', 'label': 'Equal MC', 'flatlib': const.HOUSES_EQUAL_MC, 'base': const.HOUSES_EQUAL_MC},
    15: {'key': 'azimuthal', 'label': 'Azimuthal / Horizon', 'flatlib': const.HOUSES_AZIMUTHAL, 'base': const.HOUSES_AZIMUTHAL},
    16: {'key': 'carter', 'label': 'Carter Poli-Equatorial', 'flatlib': const.HOUSES_CARTER_POLI_EQUATORIAL, 'base': const.HOUSES_CARTER_POLI_EQUATORIAL},
    17: {'key': 'sunshine', 'label': 'Sunshine', 'flatlib': const.HOUSES_SUNSHINE, 'base': const.HOUSES_SUNSHINE},
    18: {'key': 'sunshine_alt', 'label': 'Sunshine Alt', 'flatlib': const.HOUSES_SUNSHINE_ALT, 'base': const.HOUSES_SUNSHINE_ALT},
    19: {'key': 'krusinski', 'label': 'Krusinski', 'flatlib': const.HOUSES_KRUSINSKI, 'base': const.HOUSES_KRUSINSKI},
    20: {'key': 'pullen_sd', 'label': 'Pullen SD', 'flatlib': const.HOUSES_PULLEN_SD, 'base': const.HOUSES_PULLEN_SD},
    21: {'key': 'pullen_sr', 'label': 'Pullen SR', 'flatlib': const.HOUSES_PULLEN_SR, 'base': const.HOUSES_PULLEN_SR},
    22: {'key': 'apc', 'label': 'APC Houses', 'flatlib': const.HOUSES_APC, 'base': const.HOUSES_APC},
    23: {'key': 'savard_a', 'label': 'Savard-A', 'flatlib': const.HOUSES_SAVARD_A, 'base': const.HOUSES_SAVARD_A},
    24: {'key': 'equal_2', 'label': 'Equal 2', 'flatlib': const.HOUSES_EQUAL_2, 'base': const.HOUSES_EQUAL_2},
}

INDIA_HOUSE_ALIASES = {
    'whole': 0,
    'whole_sign': 0,
    'rashi': 0,
    # Bhāva Chalit = Śrīpati(弧三分中点制),非等宫——旧值 5(Equal)与定义不符,订正为 7。
    # 用户可见下拉走数字 7 直达 HOUSES_SRIPATI 不经此串;全仓 grep 证无调用方依赖旧语义。
    'bhava_chalit': 7,
    'equal': 5,
    'equal_lagna': 5,
    'lagna_equal': 5,
    'sripati': 7,
    'placidus': 3,
    'kp': 3,
    'kp_placidus': 3,
    'vehlow': 6, 'vehlow_equal': 6,
    'porphyry': 9, 'porphyrius': 9,
    'koch': 4,
    'campanus': 10,
    'regiomontanus': 2, 'regio': 2,
    'alcabitus': 8, 'alcabitius': 8,
    'morinus': 11,
    'meridian': 12, 'axial': 12,
    'polich_page': 13, 'topocentric': 13,
    'equal_mc': 14,
    'azimuthal': 15, 'horizon': 15,
    'carter': 16,
    'sunshine': 17, 'sunshine_alt': 18,
    'krusinski': 19,
    'pullen_sd': 20, 'pullen_sr': 21,
    'apc': 22,
    'savard': 23, 'savard_a': 23,
    'equal_2': 24,
}

INDIA_OBJECTS = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE, const.PLUTO,
    const.CHIRON, const.NORTH_NODE, const.SOUTH_NODE, const.SYZYGY, const.PARS_FORTUNA,
    const.DARKMOON, const.PURPLE_CLOUDS,
]

# Jyotish 必需子集(9 曜 + 节点 + SYZYGY/PARS)——均为宽星历区间或派生点。
# 极端古/未来日期某些天体星历越界(如 Chiron 限 JD 1967601.5–3419437.5 ≈ 675–4650AD)时退到此集，优雅降级不崩。
_INDIA_SAFE_OBJECTS = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE,
    const.SYZYGY, const.PARS_FORTUNA,
]


def normalize_ayanamsa(value):
    if value is None or value == '':
        value = 'lahiri'
    key = str(value).strip().lower()
    key = INDIA_AYANAMSA_ALIASES.get(key, key)
    return INDIA_AYANAMSA_MODES.get(key, INDIA_AYANAMSA_MODES['lahiri'])


def normalize_house_system(value):
    if value is None or value == '':
        return 0, INDIA_HOUSE_SYSTEMS[0]
    if isinstance(value, str):
        key = value.strip().lower()
        if key in INDIA_HOUSE_ALIASES:
            code = INDIA_HOUSE_ALIASES[key]
            return code, INDIA_HOUSE_SYSTEMS[code]
        try:
            value = int(key)
        except Exception:
            return 0, INDIA_HOUSE_SYSTEMS[0]
    try:
        code = int(value)
    except Exception:
        code = 0
    if code not in INDIA_HOUSE_SYSTEMS:
        code = 0
    return code, INDIA_HOUSE_SYSTEMS[code]


def positive_distance(start, end):
    return (end - start + 360.0) % 360.0


def sorted_objects(values):
    return sorted(list(values), key=lambda item: getattr(item, 'lon', 0))


class IndiaChartKernel:
    def __init__(self, data):
        self.data = data
        self.time = data['time']
        self.zone = data['zone']
        self.lat = data['lat']
        self.lon = data['lon']
        self.tradition = False
        self.zodiacal = const.SIDEREAL
        self.southchart = False
        self.su28Mode = 0
        self.pdtype = data.get('pdtype', 0)
        self.pdMethod = data.get('pdMethod', 'india_kernel')
        self.pdTimeKey = data.get('pdTimeKey', 'Birth')
        self.isBC = False

        date = data['date']
        parts = date.split('/')
        if len(parts) == 1:
            parts = date.split('-')
        if len(parts) == 4:
            self.year = '-{0}'.format(parts[1])
            self.month = parts[2]
            self.day = parts[3]
        else:
            self.year = parts[0]
            self.month = parts[1]
            self.day = parts[2]
        self.date = '{0}/{1}/{2}'.format(self.year, self.month, self.day)

        if 'ad' in data:
            self.isBC = int(data.get('ad', 1)) != 1
            if self.isBC and self.date[0:1] != '-':
                self.date = '-{0}'.format(self.date)
                self.year = '-{0}'.format(self.year)
        if self.year[0:1] == '-':
            self.isBC = True

        self.dateTime = Datetime(self.date, self.time, self.zone)
        self.pos = GeoPos(self.lat, self.lon)

        self.siderealMode = normalize_ayanamsa(data.get('indiaAyanamsa', data.get('ayanamsa', data.get('siderealMode', 'lahiri'))))
        self.siderealModeKey = self.siderealMode['key']
        self.siderealModeLabel = self.siderealMode['label']
        self.ayanamsaValue = self._compute_ayanamsa_value()

        self.houseCode, self.houseSystem = normalize_house_system(data.get('indiaHsys', data.get('hsys', 0)))
        self.house = self.houseSystem['flatlib']
        self.houseLabel = self.houseSystem['label']

        # 罗睺/计都交点口径:'mean'(平交点,SE_MEAN_NODE,默认零回归)或 'true'(真交点,SE_TRUE_NODE)。
        self.nodeType = str(data.get('nodeType', data.get('indiaNodeType', 'mean'))).strip().lower()
        if self.nodeType not in ('mean', 'true'):
            self.nodeType = 'mean'

        self.objlists = [obj for obj in INDIA_OBJECTS if obj in swe.SWE_OBJECTS or obj in [const.SOUTH_NODE, const.SYZYGY, const.PARS_FORTUNA]]
        self.hasSun = const.SUN in self.objlists
        self.hasMoon = const.MOON in self.objlists

        try:
            self.chart = Chart(
                self.dateTime,
                self.pos,
                const.SIDEREAL,
                hsys=self.houseSystem['base'],
                IDs=self.objlists,
                needpars=True,
                sidereal_mode=self.siderealMode,
            )
        except Exception:
            # 极端日期某些天体星历越界(如 Chiron)→ 退到 Jyotish 必需子集，优雅降级。
            # 非星历问题(如日期格式)在子集上同样会失败并向上抛出，不会被掩盖。
            self.objlists = [obj for obj in self.objlists if obj in _INDIA_SAFE_OBJECTS]
            self.chart = Chart(
                self.dateTime,
                self.pos,
                const.SIDEREAL,
                hsys=self.houseSystem['base'],
                IDs=self.objlists,
                needpars=True,
                sidereal_mode=self.siderealMode,
            )
        self.chart.hsys = self.house
        self._apply_india_houses()
        if self.nodeType == 'true':
            self._apply_true_node()
        self.reinit()

    def _apply_true_node(self):
        """把默认平交点(SE_MEAN_NODE=10)替换为真交点(SE_TRUE_NODE=11)。
        仅 nodeType=='true' 调用,默认 mean 零回归。零全局污染:复用 chart 自己的
        sidereal context+flags 直接算 swe ID 11,再 relocate 罗睺/计都两对象。
        与 flatlib ephem.getObject 的交点对处理一致(南交=北交 lon+180、ra+180,lat/decl 不取负)。
        失败安全回退:保留平交点。"""
        north = next((o for o in self.chart.objects if getattr(o, 'id', None) == const.NORTH_NODE), None)
        south = next((o for o in self.chart.objects if getattr(o, 'id', None) == const.SOUTH_NODE), None)
        if north is None and south is None:
            return
        jd = self.dateTime.jd
        flags = getattr(self.chart, 'flags', swe.SEDEFAULT_FLAG)
        try:
            with self.chart._siderealContext():
                sweList = swe.swisseph.calc_ut(jd, 11, flags)[0]
                eqlist = swe.swisseph.calc_ut(jd, 11, flags | swe.SEFLG_EQUATORIAL)[0]
        except Exception:
            return
        true_lon = sweList[0]
        ra = eqlist[0] if eqlist[0] >= 0 else (eqlist[0] + 360) % 360
        if north is not None:
            north.relocate(true_lon)
            north.lat = sweList[1]
            north.lonspeed = sweList[3]
            north.latspeed = sweList[4]
            north.ra = ra
            north.decl = eqlist[1]
        if south is not None:
            south.relocate((true_lon + 180.0) % 360.0)
            south.lat = sweList[1]
            south.lonspeed = sweList[3]
            south.latspeed = sweList[4]
            south.ra = (ra + 180.0) % 360.0
            south.decl = eqlist[1]

    def _compute_ayanamsa_value(self):
        try:
            swe.setSiderealContext(self.siderealMode['mode'])
            swe.applySiderealMode()
            return swe.swisseph.get_ayanamsa_ut(self.dateTime.jd)
        except Exception:
            return None
        finally:
            swe.clearSiderealContext()

    def _apply_india_houses(self):
        if self.houseCode not in (0, 5):
            for house in self.chart.houses:
                house.hsys = self.house
            return

        asc = self.chart.getAngle(const.ASC)
        start_lon = math.floor(asc.lon / 30.0) * 30.0 if self.houseCode == 0 else asc.lon
        for house in self.chart.houses:
            house_num = int(house.id[5:])
            house.hsys = self.house
            house.size = 30.0
            house.relocate((start_lon + (house_num - 1) * 30.0) % 360.0)
            ra, decl = utils.eqCoords(house.lon, 0)
            house.ra = ra
            house.decl = decl
        self.chart.hsys = self.house

    def _house_for_lon(self, lon):
        houses = sorted(list(self.chart.houses), key=lambda item: int(item.id[5:]))
        for idx, house in enumerate(houses):
            next_house = houses[(idx + 1) % len(houses)]
            size = positive_distance(house.lon, next_house.lon)
            house.size = size if size > 0 else 30.0
            if positive_distance(house.lon, lon) < house.size:
                return house
        return houses[0] if houses else None

    def _assign_house(self, obj):
        house = self._house_for_lon(obj.lon)
        obj.house = house.id if house else None

    def reinit(self):
        self.isDiurnal = self.chart.isDiurnal()
        self.chart.hsys = self.house
        for house in self.chart.houses:
            house.planets = []
            house.ruler = None
            house.exalt = None

        asc = self.chart.getAngle(const.ASC)
        asc_sign_index = const.LIST_SIGNS.index(asc.sign)
        for index in range(12):
            sign = const.LIST_SIGNS[(asc_sign_index + index) % 12]
            house = self.chart.getHouse(const.LIST_HOUSES[index])
            try:
                ruler = tables.ESSENTIAL_DIGNITIES[sign]['ruler']
                exalt = tables.ESSENTIAL_DIGNITIES[sign]['exalt'][0]
                house.ruler = ruler
                house.exalt = exalt
            except Exception:
                pass

        for obj in list(self.chart.angles) + list(self.chart.objects) + list(self.chart.pars):
            self._assign_house(obj)
            try:
                obj.movedir = obj.movement()
            except Exception:
                obj.movedir = None
            try:
                obj.dignities = essential.getInfo(obj.sign, obj.signlon)
                obj.selfDignity = []
            except Exception:
                obj.dignities = {}
                obj.selfDignity = []

        for obj in self.chart.objects:
            if not getattr(obj, 'id', '').startswith('House') and getattr(obj, 'house', None):
                try:
                    self.chart.getHouse(obj.house).planets.append(obj.id)
                except Exception:
                    pass

    def getBirthStr(self):
        return '{0}-{1}-{2} {3}'.format(self.year, self.month, self.day, self.time)

    def getSunRiseTime(self):
        try:
            sunrise_jd = eph.lastSunrise(self.dateTime.jd + 0.5, self.pos.lat, self.pos.lon)
            dt = Datetime.fromJD(sunrise_jd, self.zone)
            text = dt.toCNString()
            parts = text.split(' ')
            return {
                'datetime': dt,
                'timeStr': parts[1] if len(parts) > 1 else text,
            }
        except Exception:
            return {
                'datetime': self.dateTime,
                'timeStr': '',
            }

    def getRiseSetTimes(self):
        def fmt(jd):
            dt = Datetime.fromJD(jd, self.zone)
            parts = dt.toCNString().split(' ')
            return parts[1] if len(parts) > 1 else dt.toCNString()

        try:
            sunrise = eph.lastSunrise(self.dateTime.jd + 0.5, self.pos.lat, self.pos.lon)
            sunset = eph.nextSunset(sunrise, self.pos.lat, self.pos.lon)
            return {
                'sunrise': fmt(sunrise),
                'sunset': fmt(sunset),
                'moonrise': '',
                'moonset': '',
                'source': 'swisseph.rise_trans',
            }
        except Exception:
            return {
                'sunrise': '',
                'sunset': '',
                'moonrise': '',
                'moonset': '',
                'source': 'swisseph.rise_trans',
            }

    def getChartObj(self):
        houses = sorted_objects(self.chart.houses)
        objs = sorted_objects(list(self.chart.objects) + list(self.chart.angles))
        rise_set = self.getRiseSetTimes()
        return {
            'zodiacal': self.zodiacal,
            'date': self.chart.orgdate,
            'geo': self.chart.pos,
            'hsys': self.houseLabel,
            'houses': houses,
            'objects': objs,
            'isDiurnal': self.isDiurnal,
            'antiscias': {},
            'stars': [],
            'orientOccident': {},
            'fixedStarSu28': [],
            'fixedStars': [],
            'signsRA': [],
            'signsRaDoubingSu28': [],
            'su28Adjust': {},
            'su28Virtual': [],
            'beidou': [],
            'beiji': [],
            'timerStar': '',
            'dayerStar': '',
            'dayofweek': '',
            'sunRiseTime': rise_set.get('sunrise', ''),
            'sunSetTime': rise_set.get('sunset', ''),
            'moonRiseTime': rise_set.get('moonrise', ''),
            'moonSetTime': rise_set.get('moonset', ''),
            'riseSet': rise_set,
            'sunrise': rise_set.get('sunrise', ''),
            'sunset': rise_set.get('sunset', ''),
            'moonrise': rise_set.get('moonrise', ''),
            'moonset': rise_set.get('moonset', ''),
        }

    def getLots(self):
        return sorted_objects(self.chart.pars)

    def empty_parallel(self):
        return {
            'parallel': [],
            'contraParallel': {},
        }

    def to_response(self, data, jyotish=None):
        varga = getattr(self, 'vargaChart', {
            'chartnum': 1,
            'key': 'd1',
            'name': 'Rashi',
            'label': 'D1 Rashi',
        })
        varga_engine_version = getattr(self, 'vargaEngineVersion', 'india_kernel_varga_v2')
        params = {
            'birth': self.getBirthStr(),
            'ad': -1 if self.isBC else 1,
            'lat': data['lat'],
            'lon': data['lon'],
            'chartnum': varga.get('chartnum', 1),
            'varga': varga,
            'hsys': self.houseCode,
            'hsysLabel': self.houseLabel,
            'ayanamsa': self.siderealModeKey,
            'ayanamsaLabel': self.siderealModeLabel,
            'ayanamsaValue': self.ayanamsaValue,
            'zone': data['zone'],
            'tradition': False,
            'zodiacal': const.SIDEREAL,
            'doubingSu28': 0,
            'showPdBounds': data.get('showPdBounds', 1),
            'pdtype': self.pdtype,
            'pdMethod': self.pdMethod,
            'pdTimeKey': self.pdTimeKey,
            'pdSyncRev': varga_engine_version,
            'engine': 'IndiaChartKernel',
            'nodeType': self.nodeType,
        }
        if 'name' in data:
            params['name'] = data['name']

        obj = {
            'params': params,
            'chart': self.getChartObj(),
            'receptions': {
                'normal': [],
                'abnormal': [],
            },
            'mutuals': {},
            'declParallel': self.empty_parallel(),
            'aspects': {
                'normalAsp': [],
                'immediateAsp': [],
                'signAsp': [],
            },
            'lots': self.getLots(),
            'surround': {
                'planets': {},
                'attacks': {},
                'houses': {},
            },
            'guoStarSect': {
                'houses': [],
            },
        }
        if jyotish is not None:
            obj['jyotish'] = jyotish
        return obj


def build_india_chart(data, chartnum=1):
    kernel = IndiaChartKernel(data)
    return kernel
