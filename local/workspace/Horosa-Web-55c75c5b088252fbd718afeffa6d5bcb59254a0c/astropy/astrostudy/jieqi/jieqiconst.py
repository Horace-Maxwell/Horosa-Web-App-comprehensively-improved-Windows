
JieQi = [
    '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
    '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
]

DongZhiIdx = JieQi.index('冬至')

JieQiLon = {
    '春分': {
        'start': '03/20',
        'lon': 0,
        'ord': 3,
        'jie': False,
        'month': 3
    },
    '清明': {
        'lon': 15,
        'start': '04/04',
        'ord': 4,
        'jie': True,
        'month': 4
    },
    '谷雨': {
        'lon': 30,
        'start': '04/19',
        'ord': 5,
        'jie': False,
        'month': 4
    },
    '立夏': {
        'lon': 45,
        'start': '05/05',
        'ord': 6,
        'jie': True,
        'month': 5
    },
    '小满': {
        'lon': 60,
        'start': '05/20',
        'ord': 7,
        'jie': False,
        'month': 5
    },
    '芒种': {
        'lon': 75,
        'start': '06/05',
        'ord': 8,
        'jie': True,
        'month': 6
    },
    '夏至': {
        'lon': 90,
        'start': '06/21',
        'ord': 9,
        'jie': False,
        'month': 6
    },
    '小暑': {
        'lon': 105,
        'start': '07/06',
        'ord': 10,
        'jie': True,
        'month': 7
    },
    '大暑': {
        'lon': 120,
        'start': '07/22',
        'ord': 11,
        'jie': False,
        'month': 7
    },
    '立秋': {
        'lon': 135,
        'start': '08/07',
        'ord': 12,
        'jie': True,
        'month': 8
    },
    '处暑': {
        'lon': 150,
        'start': '08/22',
        'ord': 13,
        'jie': False,
        'month': 8
    },
    '白露': {
        'lon': 165,
        'start': '09/07',
        'ord': 14,
        'jie': True,
        'month': 9
    },
    '秋分': {
        'lon': 180,
        'start': '09/22',
        'ord': 15,
        'jie': False,
        'month': 9
    },
    '寒露': {
        'lon': 195,
        'start': '10/08',
        'ord': 16,
        'jie': True,
        'month': 10
    },
    '霜降': {
        'lon': 210,
        'start': '10/23',
        'ord': 17,
        'jie': False,
        'month': 10
    },
    '立冬': {
        'lon': 225,
        'start': '11/07',
        'ord': 18,
        'jie': True,
        'month': 11
    },
    '小雪': {
        'lon': 240,
        'start': '11/22',
        'ord': 19,
        'jie': False,
        'month': 11
    },
    '大雪': {
        'lon': 255,
        'start': '12/06',
        'ord': 20,
        'jie': True,
        'month': 12
    },
    '冬至': {
        'lon': 270,
        'start': '12/21',
        'ord': 21,
        'jie': False,
        'month': 12
    },
    '小寒': {
        'lon': 285,
        'start': '01/05',
        'ord': 22,
        'jie': True,
        'month': 1
    },
    '大寒': {
        'lon': 300,
        'start': '01/20',
        'ord': 23,
        'jie': False,
        'month': 1
    },
    '立春': {
        'start': '02/02',
        'lon': 315,
        'ord': 0,
        'jie': True,
        'month': 2
    },
    '雨水': {
        'start': '02/18',
        'lon': 330,
        'ord': 1,
        'jie': False,
        'month': 2
    },
    '惊蛰': {
        'start': '03/05',
        'lon': 345,
        'ord': 2,
        'jie': True,
        'month': 3
    },
}

MonthToJieQi = {
    '01': ['小寒', '大寒'],
    '02': ['立春', '雨水'],
    '03': ['惊蛰', '春分'],
    '04': ['清明', '谷雨'],
    '05': ['立夏', '小满'],
    '06': ['芒种', '夏至'],
    '07': ['小暑', '大暑'],
    '08': ['立秋', '处暑'],
    '09': ['白露', '秋分'],
    '10': ['寒露', '霜降'],
    '11': ['立冬', '小雪'],
    '12': ['大雪', '冬至'],
}

SouthEarthMonthToJieQi = {
    '07': ['小寒', '大寒'],
    '08': ['立春', '雨水'],
    '09': ['惊蛰', '春分'],
    '10': ['清明', '谷雨'],
    '11': ['立夏', '小满'],
    '12': ['芒种', '夏至'],
    '01': ['小暑', '大暑'],
    '02': ['立秋', '处暑'],
    '03': ['白露', '秋分'],
    '04': ['寒露', '霜降'],
    '05': ['立冬', '小雪'],
    '06': ['大雪', '冬至'],
}

SouthEarthJieQi = {
    '小寒': '小暑',
    '大寒': '大暑',
    '立春': '立秋',
    '雨水': '处暑',
    '惊蛰': '白露',
    '春分': '秋分',
    '清明': '寒露',
    '谷雨': '霜降',
    '立夏': '立冬',
    '小满': '小雪',
    '芒种': '大雪',
    '夏至': '冬至',
    '小暑': '小寒',
    '大暑': '大寒',
    '立秋': '立春',
    '处暑': '雨水',
    '白露': '惊蛰',
    '秋分': '春分',
    '寒露': '清明',
    '霜降': '谷雨',
    '立冬': '立夏',
    '小雪': '小满',
    '大雪': '芒种',
    '冬至': '夏至',
}

YearGanRemainder = {
    '4': '甲',
    '5': '乙',
    '6': '丙',
    '7': '丁',
    '8': '戊',
    '9': '己',
    '0': '庚',
    '1': '辛',
    '2': '壬',
    '3': '癸'
}

YearZiRemainder = {
    '4': '子',
    '5': '丑',
    '6': '寅',
    '7': '卯',
    '8': '辰',
    '9': '巳',
    '10': '午',
    '11': '未',
    '0': '申',
    '1': '酉',
    '2': '戌',
    '3': '亥'
}

BCYearGanRemainder = {
    '7': '甲',
    '6': '乙',
    '5': '丙',
    '4': '丁',
    '3': '戊',
    '2': '己',
    '1': '庚',
    '0': '辛',
    '9': '壬',
    '8': '癸'
}

BCYearZiRemainder = {
    '9': '子',
    '8': '丑',
    '7': '寅',
    '6': '卯',
    '5': '辰',
    '4': '巳',
    '3': '午',
    '2': '未',
    '1': '申',
    '0': '酉',
    '11': '戌',
    '10': '亥'
}

def getYearGanZi(year):
    y = 1 if year == 0 else year
    ganR = abs(y) % 10
    ziR = abs(y) % 12
    ganK = str(ganR)
    ziK = str(ziR)
    if y > 0:
        gan = YearGanRemainder[ganK]
        zi = YearZiRemainder[ziK]
    else:
        gan = BCYearGanRemainder[ganK]
        zi = BCYearZiRemainder[ziK]
    return gan + zi





def getJieQiInterval(lon):
    res = {
        'start': {
            'lon': 0,
            'jieqi': ''
        },
        'end': {
            'lon': 0,
            'jieqi': ''
        }
    }
    for jq in JieQi:
        if JieQiLon[jq] < lon:
            continue
        elif JieQiLon[jq] >= lon:
            res['end']['jieqi'] = jq
            res['end']['lon'] = JieQiLon[jq]
            idx = JieQi.index(jq)
            idx = (idx - 1 + 24) % 24
            prevjq = JieQi[idx]
            res['start']['jieqi'] = prevjq
            res['start']['lon'] = JieQiLon[prevjq]
            break
    return res