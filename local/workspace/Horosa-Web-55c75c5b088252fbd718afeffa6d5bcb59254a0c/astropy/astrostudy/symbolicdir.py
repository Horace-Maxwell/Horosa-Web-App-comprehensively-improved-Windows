
# 波斯向运 / 周期推运（Persian Directed / Symbolic Direction）。
# 黄经象征向运：所有行星/点每年沿黄经前进固定速率，本命宫头(houses/angles)固定不动。
# 镜像 solararc.py 的旋转+相位网逻辑，差异：弧=象征弧(age*rate)、houses/angles 不转、向运星对本命宫重挂。
from flatlib import const
from flatlib.chart import Chart
from flatlib.datetime import Datetime

# 速率（度/年）。persian=1°/年(默认)；prophected=30°/年；naibod=0°59'08"≈0.9856473°/年。
RATE = {
    'persian': 1.0,
    'prophected': 30.0,
    'naibod': 0.9856473,
}


def compute(chart, ageYears, rateKey='persian', asporb=1, nodeRetrograde=False, direction='direct'):
    arc = ageYears * RATE.get(rateKey, 1.0)
    # converse(反向向运)：弧取负 => 外盘顺时针转;direct(默认)=> 逆时针。
    if direction == 'converse':
        arc = -arc

    pChart = chart.copy()
    for obj in pChart.objects:                      # 行星/点 +arc
        if nodeRetrograde and (obj.id == const.NORTH_NODE or obj.id == const.SOUTH_NODE):
            obj.relocate(obj.lon - arc)
        else:
            obj.relocate(obj.lon + arc)
    for par in pChart.pars:                         # 阿拉伯点也作为「点」向运 +arc
        par.relocate(par.lon + arc)
    # houses / angles 不旋转 —— 宫头/ASC/MC 固定本命（与 solararc 唯一差异）。
    # 向运星 house 对「本命」宫头重挂（供入宫判定/AI；flatlib relocate 不改 house）。
    try:
        for obj in pChart.objects:
            h = chart.houses.getHouseByLon(obj.lon)
            if h is not None:
                obj.house = h.id
    except Exception:
        pass

    natalObjs = [obj for obj in chart.objects]
    natalObjs.extend([obj for obj in chart.angles])

    objs = [obj for obj in pChart.objects]          # 向运角不入（角不动）

    orb = 1 if asporb < 0 else asporb
    res = []
    for obj in objs:
        asp = {
            'directId': obj.id,
            'objects': []
        }
        for natobj in natalObjs:
            natasp = {
                'natalId': natobj.id,
                'aspect': -1
            }
            delta = obj.lon - natobj.lon if obj.lon >= natobj.lon else natobj.lon - obj.lon
            # delta 是 |黄经差| ∈ [0,360)。下面每个相位都判了自身与 360 补角(45/315、90/270、
            # 135/225),唯独合相只判了 delta<orb 一侧 → 一星在 0.2°、另一星在 359.5° 时实际
            # 相距 0.9°(是合相),delta=359.3 却落不进任何分支,合相整条丢失。补上 360 侧。
            if delta < orb or delta > 360 - orb:
                natasp['aspect'] = 0
                natasp['delta'] = delta if delta < orb else 360 - delta
            elif abs(delta - 45) < orb or abs(delta - 315) < orb:
                tmpdelta = abs(delta - 45)
                if tmpdelta > orb:
                    tmpdelta = abs(delta - 315)
                natasp['aspect'] = 45
                natasp['delta'] = tmpdelta
            elif abs(delta - 90) < orb or abs(delta - 270) < orb:
                tmpdelta = abs(delta - 90)
                if tmpdelta > orb:
                    tmpdelta = abs(delta - 270)
                natasp['aspect'] = 90
                natasp['delta'] = tmpdelta
            elif abs(delta - 135) < orb or abs(delta - 225) < orb:
                tmpdelta = abs(delta - 135)
                if tmpdelta > orb:
                    tmpdelta = abs(delta - 225)
                natasp['aspect'] = 135
                natasp['delta'] = tmpdelta
            elif abs(delta - 180) < orb:
                natasp['aspect'] = 180
                natasp['delta'] = abs(delta - 180)
            if natasp['aspect'] >= 0:
                asp['objects'].append(natasp)
        res.append(asp)

    return {
        'objects': objs,
        'aspects': res,
        'chart': pChart
    }
