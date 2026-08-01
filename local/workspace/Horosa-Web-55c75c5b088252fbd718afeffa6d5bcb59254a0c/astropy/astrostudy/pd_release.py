# -*- coding: utf-8 -*-
"""主限法 · 释放框架(hyleg / apheta 自动选定 + anareta 被限星集)。

  五释放位置(aphetic places)优先序:第1宫 > 第10宫 > 第11宫 > 第7宫 > 第9宫;
  落 2/3/4/5/6/8/12 宫的候选不取。
  四候选 × 昼夜 sect:昼生(☉在地平上)日→月→ASC→福点→产前朔望;
  夜生 月→日→ASC→福点→产前朔望。取「按 sect 优先且落释放位置」的第一个。
  anareta 候选(步骤 2):凶星(♄♂)本体及其全部相位射线;其余行星仅刑(90)/冲(180)射线。
  (第三类「杀界 / 凶界主」依赖杀界表,权威文档未给表 → 不实现,不臆造。)

🔴 免责(依传统文献原口径):寿命计算是历史技术,各家规则分歧极大,不应据以预测
真实寿命;本框架仅作技术还原,展示弧与对应年龄,不产出任何「预测寿命」结论。
"""

APHETIC_HOUSES = (1, 10, 11, 7, 9)

RELEASE_DISCLAIMER = (
    '释放框架(hyleg-anareta)为古典寿限技术的还原:仅展示定向弧与对应年龄。'
    '寿命计算是历史技术,各家规则分歧极大,不应据以预测真实寿命。'
)

MALEFICS = ('Saturn', 'Mars')


def house_of(lon, cusps):
    """点黄经落宫(cusps: 12 元宫始黄经数组,1..12 宫序),返回 1..12。"""
    lon = float(lon) % 360.0
    for i in range(12):
        a = float(cusps[i]) % 360.0
        b = float(cusps[(i + 1) % 12]) % 360.0
        span = (b - a) % 360.0
        if span <= 0:
            span = 360.0
        if ((lon - a) % 360.0) < span:
            return i + 1
    return 1


def hyleg_candidate_order(is_diurnal):
    """候选序:昼 日→月→ASC→福点→产前朔望;夜 月→日→ASC→福点→产前朔望。"""
    if is_diurnal:
        return ('Sun', 'Moon', 'Asc', 'Pars Fortuna', 'Syzygy')
    return ('Moon', 'Sun', 'Asc', 'Pars Fortuna', 'Syzygy')


def select_hyleg(candidate_lons, cusps, is_diurnal):
    """自动定 hyleg。candidate_lons: {name: lon}。
    返回 {'name','lon','house','sect','candidates':[逐候选 {name,lon,house,aphetic,chosen}]}。
    ASC 恒落第 1 宫 → 序列内天然兜底(发光体都不合格则用上升等兜底)。"""
    order = hyleg_candidate_order(is_diurnal)
    trail = []
    chosen = None
    for name in order:
        if name not in candidate_lons or candidate_lons[name] is None:
            continue
        lon = float(candidate_lons[name])
        h = house_of(lon, cusps)
        ok = h in APHETIC_HOUSES
        item = {'name': name, 'lon': round(lon, 4), 'house': h, 'aphetic': ok, 'chosen': False}
        trail.append(item)
        if ok and chosen is None:
            item['chosen'] = True
            chosen = {'name': name, 'lon': lon, 'house': h,
                      'sect': 'diurnal' if is_diurnal else 'nocturnal'}
    if chosen is None and trail:
        # 理论不可达(ASC 恒 1 宫);防御性取序列首个存在者
        first = trail[0]
        first['chosen'] = True
        chosen = {'name': first['name'], 'lon': first['lon'], 'house': first['house'],
                  'sect': 'diurnal' if is_diurnal else 'nocturnal'}
    return {'hyleg': chosen, 'candidates': trail}


ALCOCODEN_ASPECTS = (0, 60, 90, 120, 180)
ALCOCODEN_ORB = 8.0   # 与 hyleg 成相位的容许度(古典常用口径,识别层标注非硬门)


def alcocoden_identify(hyleg_sign, hyleg_signlon, hyleg_lon, planet_lons,
                       dignity_info, dignity_scores):
    """Alcocoden(寿主)识别:对 hyleg 度数按界主+庙/旺/三分/外观计 almuten、
    且与 hyleg 成相位、得分最高的行星。🔴 仅识别输出得分与相位标记——**不产出行星年
    与任何寿命估值**(与释放框架同一免责纪律)。
    dignity_info: essential.getInfo(sign, signlon) 结果;dignity_scores: 权重表。"""
    scores = {}
    for key, score in (dignity_scores or {}).items():
        obj_id = (dignity_info or {}).get(key)
        if obj_id is None:
            continue
        scores[obj_id] = scores.get(obj_id, 0) + score
    ranked = []
    for obj_id, sc in scores.items():
        lon = (planet_lons or {}).get(obj_id)
        has_asp = False
        asp_hit = None
        if lon is not None:
            diff = abs((float(lon) - float(hyleg_lon) + 180.0) % 360.0 - 180.0)
            for a in ALCOCODEN_ASPECTS:
                if abs(diff - a) <= ALCOCODEN_ORB:
                    has_asp = True
                    asp_hit = a
                    break
        ranked.append({'planet': obj_id, 'score': sc, 'hasAspect': has_asp, 'aspect': asp_hit})
    ranked.sort(key=lambda r: (-r['score'], r['planet']))
    winner = next((r for r in ranked if r['hasAspect']), None)
    return {
        'candidates': ranked[:5],
        'winner': winner,
        'note': 'Alcocoden 仅作技术识别(almuten 得分+与 hyleg 相位标记),不输出行星年与寿命估值。',
    }


def anareta_promissors(planet_points, aspects=(0, 60, 90, 120, 180)):
    """anareta 被限星集(步骤 2)。planet_points: {name: {'lon','lat'}}(七政)。
    凶星:本体 + 全相位双侧射线;非凶星:仅 90/180 射线。ID 语法与主表同源
    (N_<body>_0 / N_<body>_180 / D|S_<body>_<asp>),射线为黄道点(lat=0)。"""
    out = []
    for name, pt in planet_points.items():
        lon = float(pt.get('lon', 0.0))
        lat = float(pt.get('lat', 0.0))
        is_mal = name in MALEFICS
        asp_set = [a for a in aspects] if is_mal else [a for a in aspects if a in (90, 180)]
        for asp in asp_set:
            if asp == 0:
                out.append({'id': 'N_%s_0' % name, 'lon': lon, 'lat': lat})
            elif asp == 180:
                out.append({'id': 'N_%s_180' % name, 'lon': (lon + 180.0) % 360.0, 'lat': 0.0})
            else:
                out.append({'id': 'D_%s_%d' % (name, asp), 'lon': (lon + asp) % 360.0, 'lat': 0.0})
                out.append({'id': 'S_%s_%d' % (name, asp), 'lon': (lon - asp) % 360.0, 'lat': 0.0})
    return out
