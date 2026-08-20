# [WP-4] 尊贵与判定批双向量锚(计分表 push/almuten 三分口径/行星时三制式)。
from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request
from astrostudy.astroextra import almuten_table
from flatlib.dignities import essential

BASE = {'date': '1991/08/21', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}


def test_scores_push_debilities_off():
    # 默认向量:不 push == push 默认(SCORES 原表)
    t = push_classical_request(dict(BASE))
    assert t[5] is None   # dignityDebilities 缺省=1 → 不 push
    pop_classical_request(t)
    # 非默认向量:fall/exile 归零,pop 后还原
    orig_fall = essential.SCORES['fall']
    t2 = push_classical_request({**BASE, 'dignityDebilities': 0})
    assert t2[5] is not None
    assert essential.SCORES['fall'] == 0 and essential.SCORES['exile'] == 0
    assert essential.SCORES['ruler'] == 5   # 其它分位不动
    pop_classical_request(t2)
    assert essential.SCORES['fall'] == orig_fall == -4


def test_almuten_trip_mode():
    pc_all = PerChart(dict(BASE))
    pc_sect = PerChart({**BASE, 'almutenTripMode': 'sectRulerOnly'})
    a = almuten_table(pc_all)
    b = almuten_table(pc_sect)
    # sectRulerOnly 只计当值主:总分必 ≤ 全计;且至少一星分数下降(三主表必有非当值命中)
    assert sum(b['totals'].values()) < sum(a['totals'].values())
    # 默认向量:不传 == 传 'all'
    c = almuten_table(PerChart({**BASE, 'almutenTripMode': 'all'}))
    assert a['totals'] == c['totals']


def test_planetary_hour_three_modes():
    base = PerChart(dict(BASE))
    star_sunrise = base.getTimerStar()
    eq = PerChart({**BASE, 'planetaryHourMethod': 'equal24'})
    star_eq = eq.getTimerStar()
    un = PerChart({**BASE, 'planetaryHourMethod': 'unequal'})
    star_un = un.getTimerStar()
    seven = ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')
    assert star_sunrise in seven and star_eq in seven and star_un in seven
    # 默认向量:不传 == 传 'sunrise'
    d = PerChart({**BASE, 'planetaryHourMethod': 'sunrise'})
    assert d.getTimerStar() == star_sunrise
    # 三制式在全天 24 小时扫描中必有分歧时刻(死开关防线:同日逐 2h 找一处不等)
    diverged = False
    for h in range(0, 24, 2):
        data = {**BASE, 'time': '%02d:30:00' % h}
        s1 = PerChart(dict(data)).getTimerStar()
        s2 = PerChart({**data, 'planetaryHourMethod': 'equal24'}).getTimerStar()
        s3 = PerChart({**data, 'planetaryHourMethod': 'unequal'}).getTimerStar()
        if not (s1 == s2 == s3):
            diverged = True
            break
    assert diverged, '三制式全天同值=死开关'
