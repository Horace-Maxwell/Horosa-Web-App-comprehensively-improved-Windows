import copy
import swisseph
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import const
from flatlib import object
from flatlib import utils
from flatlib.ephem import swe


BEIDOU_YAOGUANG = 'Alkaid'
BEIDOU_KAIYANG = 'Mizar'

LiCunParam = {
    'deg': 38,
    'sign': const.SCORPIO,
    'su': ['房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁', '奎', '娄', '胃',
           '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸', '角', '亢', '氐']
}


SuDeg = {
    '角': 12,
    '亢': 9,
    '氐': 17,
    '房': 7,
    '心': 12,
    '尾': 9,
    '箕': 10.25,
    '斗': 22,
    '牛': 9,
    '女': 10,
    '虚': 14,
    '危': 9,
    '室': 20,
    '壁': 15,
    '奎': 12,
    '娄': 15,
    '胃': 11,
    '昴': 15,
    '毕': 15,
    '觜': 6,
    '参': 9,
    '井': 29,
    '鬼': 5,
    '柳': 18,
    '星': 13,
    '张': 13,
    '翼': 13,
    '轸': 16,
}

Su28Id = {
    '角': const.START_JIAO,
    '亢': const.START_KANG,
    '氐': const.START_DI,
    '房': const.START_FANG,
    '心': const.START_XIN,
    '尾': const.START_WEIBA,
    '箕': const.START_JI,
    '斗': const.START_DOU,
    '牛': const.START_NIU,
    '女': const.START_NV,
    '虚': const.START_XU,
    '危': const.START_WEIXIAN,
    '室': const.START_SHI,
    '壁': const.START_QIANBI,
    '奎': const.START_KUI,
    '娄': const.START_LOU,
    '胃': const.START_WEI,
    '昴': const.START_AN,
    '毕': const.START_BI,
    '觜': const.START_ZI,
    '参': const.START_CANG,
    '井': const.START_JIN,
    '鬼': const.START_GUI,
    '柳': const.START_NIUSHU,
    '星': const.START_XINGXING,
    '张': const.START_ZHANG,
    '翼': const.START_YI,
    '轸': const.START_ZHEN,

}


def takeRa(obj):
    return obj.ra


SU28TOTALDEG = 0
for su in SuDeg:
    SU28TOTALDEG = SU28TOTALDEG + SuDeg[su]

Su28IdMap = {}
for i in range(0, len(const.LIST_FIXED_SU28)):
    Su28IdMap[const.LIST_FIXED_SU28[i]] = const.LIST_FIXED_SU28_NAME[i]
    Su28IdMap[const.LIST_FIXED_SU28_NAME[i]] = const.LIST_FIXED_SU28[i]



class Guo74:
    def __init__(self, perchart):
        self.perchart = perchart

        self.params = {}
        self.params['year'] = perchart.year
        self.params['zone'] = perchart.zone
        self.params['lat'] = perchart.lat
        self.params['lon'] = perchart.lon
        self.params['hsys'] = 0
        self.params['zodiacal'] = 0
        self.params['predictive'] = False


    def virtualSu28(self):
        from astrostudy.jieqi import YearJieQi
        yearjieqi = YearJieQi.YearJieQi(self.params)
        jqname = '立春'
        licun = yearjieqi.computeOneJieQiByName(jqname)
        licunjdn = licun['jdn']
        if licunjdn > self.perchart.dateTime.jd:
            data = copy.deepcopy(self.params)
            y = int(data['year']) - 1
            if y == 0:
                y = -1
            data['year'] = str(y)
            yearjieqi = YearJieQi.YearJieQi(data)
            licun = yearjieqi.computeOneJieQiByName(jqname)
            licunjdn = licun['jdn']

        yaoguang = swe.sweFixedStar(BEIDOU_YAOGUANG, licunjdn)
        ygra = yaoguang['ra']

        su28 = LiCunParam['su']
        res = []
        startdeg = ygra + LiCunParam['deg'] / SU28TOTALDEG * 360

        self.perchart.eastRa = startdeg

        for idx in range(0, 28):
            su = su28[idx]
            fixedstar = self.perchart.chart.getFixedStar(Su28Id[su])
            eclip = swisseph.cotrans([startdeg, fixedstar.decl, 1], 1)
            sig = const.LIST_SIGNS[int(eclip[0] / 30) % 12]
            star = {
                'ra': startdeg,
                'decl': fixedstar.decl,
                'name': su,
                'wuxing': const.Su28WuXing[su],
                'animal': const.Su28Animal[su],
                'id': Su28Id[su],
                'lon': eclip[0],
                'lat': eclip[1],
                'sign': sig,
                'signlon': eclip[0] % 30,
                'type': const.OBJ_FIXED_STAR
            }
            sulen = SuDeg[su] / SU28TOTALDEG * 360
            startdeg = (startdeg + sulen) % 360

            starobj = object.Object.fromDict(star)
            res.append(starobj)

        res.sort(key=takeRa)

        return res

    def compute(self):
        res = self.virtualSu28()
        obj = const.LIST_ALL_POINTS
        for objid in obj:
            try:
                planet = self.perchart.chart.get(objid)
                self.perchart.setPlanetSu28(res, planet)
            except:
                continue
        return res