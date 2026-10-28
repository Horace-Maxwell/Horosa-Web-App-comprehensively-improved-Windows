import copy
import traceback
import jsonpickle
import cherrypy
from websrv.helper import enable_crossdomain
from astrostudy.civil_calendar import (
    CivilDateTime, astro_year, civil_ymd_valid, display_year, format_display_date, parse_civil_date, reset_ad_for_date)
from astrostudy.india.india_chart_kernel import IndiaChartKernel
from astrostudy.india.jyotish_engine import build_jyotish
from astrostudy.india.varga import apply_varga_chart, normalize_chartnum, normalize_varga_variants


def getIndiaChartJson(data, indiachart, jyotish=None):
    obj = indiachart.to_response(data, jyotish)
    if jyotish is not None:
        obj['jyotish'] = jyotish
    return jsonpickle.encode(obj, unpicklable=False)


# 星期口径说明(问事 KP 块 / 校时扫描同一句;本命 / 问事 / 校时全引擎日界 = 日出)
VARA_BASIS_NOTE = '日界=日出;民用日口径并列回显,二者不同时以日出为准'


def _note_partial(block, name):
    """服务层子块失败的统一落账:块名记进 block['partialErrors'](与引擎 compute() 同名同义),
    绝不静默写 None —— 消费方 / 排障据此区分「本来没有」与「算炸了」。"""
    if isinstance(block, dict):
        errs = block.setdefault('partialErrors', [])
        if name not in errs:
            errs.append(name)


def _derived_kernel_data(data, date_text, time_text, drop_chartnum=True):
    """派生盘(过运 / 年盘 / 三旗 / 阴历返照 / 问时 / 区间采样)入参:换日期串与时刻,ad 随新日期重置。
    本命是公元前(ad=-1)时,沿用 ad 会把公元后的派生日期当成公元前那一年。date_text 必须带符号。"""
    d = dict(data)
    d['date'] = date_text
    d['time'] = time_text
    if drop_chartnum:
        d.pop('chartnum', None)
    return reset_ad_for_date(d)


def _civil_slash(dt):
    """民用历时刻(datetime / CivilDateTime)→ 起盘日期串 'YYYY/MM/DD'(负年带符号)。"""
    return format_display_date(dt.year, dt.month, dt.day, '/')


def _retro_flags(chart, planet_ids):
    """{planet_id: bool} 逆行标记(Tājika 入相 / 离相取决于快曜是否逆行;日月恒顺行)。"""
    from astrostudy.india.jyotish_engine import safe_get
    out = {}
    for oid in planet_ids:
        o = safe_get(chart, oid)
        if o is None:
            continue
        try:
            out[oid] = bool(o.isRetrograde())
        except Exception:
            out[oid] = False
    return out


def _zone_hours_of(v, default=0.0):
    """时区 → 小时数。真实请求(Java 网关透传)携带 '+08:00' 形字符串,
    naive float() 必炸(实测 traceback);兼容 数值 / '8' / '8.5' / '+08:00' / '-05:30'。"""
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        pass
    try:
        t = str(v).strip()
        sign = -1.0 if t.startswith('-') else 1.0
        t = t.lstrip('+-')
        if ':' in t:
            hh, mm = (t.split(':') + ['0'])[:2]
            return sign * (float(hh or 0) + float(mm or 0) / 60.0)
        return sign * float(t)
    except (TypeError, ValueError):
        return default


def rectify_core(data):
    """校时扫描核心(可测可预热)。精算路径:每候选只走 sweHousesLon + sweObjectLon
    (~0.18ms),🔴 绝不逐候选建全盘(那是 ~27ms/候选 → 481 候选 6.6 秒)。

    分层:Tier-1 基盘一次 / Tier0 日出每窗口 ≤3 次(窗口 ≤ ±4h 至多跨 1 次日出:窗末前最近一次 +
    其前一次;每候选按所属日出取吠陀日 / Praṇapada 起点)/ Tier1 每候选两次 swe 调用 /
    Tier2 事件宫集按 (lagnaSign, moonSign) 记忆化(纯算术)/ Tier4 纯评分。
    """
    import datetime as _dt
    import math
    from astrostudy.india import rectification as rf
    from astrostudy.india.kp_system import (
        kp_levels, ruling_planets_extended, WEEKDAY_LORDS, SIGN_LORDS as KP_SIGN_LORDS,
        DASHA_ORDER, DASHA_YEARS, DASHA_TOTAL)
    from astrostudy.india import sensitive_points as sp
    from astrostudy.india.jyotish_engine import safe_get
    from astrostudy.nakshatra import nakshatra_from_lon
    from flatlib import const as fconst
    from flatlib.ephem import swe as fswe

    d = dict(data or {})
    d['tradition'] = False
    d['predictive'] = False
    d['zodiacal'] = 1
    d['hsys'] = d.get('indiaHsys', d.get('hsys', 0))
    d['siderealMode'] = d.get('indiaAyanamsa', d.get('ayanamsa', d.get('siderealMode', 'lahiri')))
    d.pop('chartnum', None)

    window_min = float(d.get('rectifyWindowMinutes') or 30.0)
    window_min = max(1.0, min(240.0, window_min))
    step_sec = int(d.get('rectifyStepSeconds') or 60)
    step_sec = max(1, min(600, step_sec))
    rp_source = str(d.get('rectifyRpSource') or 'anchor')
    events = d.get('rectifyEvents') or []
    top_k = max(1, min(10, int(d.get('rectifyTopK') or 3)))

    # Tier-1:锚盘一次(拿 sidereal 上下文 / 经纬 / anchor RP / 本命行星座)
    kernel = IndiaChartKernel(d)
    jd0 = kernel.dateTime.jd
    lat = kernel.pos.lat
    lon_geo = kernel.pos.lon
    zone_hours = _zone_hours_of(d.get('zone'))
    planet_signs_idx = {}
    for oid in (fconst.SUN, fconst.MOON, fconst.MARS, fconst.MERCURY, fconst.JUPITER,
                fconst.VENUS, fconst.SATURN, fconst.NORTH_NODE, fconst.SOUTH_NODE):
        o = safe_get(kernel.chart, oid)
        if o is not None:
            planet_signs_idx[oid] = int(float(o.lon) // 30.0)

    from astrostudy.india.primitives import local_weekday as _local_weekday, weekday_mon0 as _mon0

    def _weekday_local(jd):
        # 当地民用日星期(0=周一域)——与本命 / 问事同一函数(primitives.local_weekday)。
        return _mon0(_local_weekday(jd, zone_hours))

    n_side = int(round(window_min * 60.0 / step_sec))
    # Tier0:日出(窗口 ±4h 内至多跨 1 次日出 → 自窗末向前取 ≤3 次 lastSunrise 即可覆盖全窗)。
    # 每个候选的吠陀日 / Praṇapada 起点取「候选时刻之前最近一次日出」(与 primitives.vedic_weekday 同义),
    # 不再一律沿用锚点那次日出(跨日出的窗口里日出后的候选星期主 / PP 起点曾错一天)。
    win_lo = jd0 - n_side * step_sec / 86400.0
    win_hi = jd0 + n_side * step_sec / 86400.0
    sunrises = []
    try:
        from flatlib.ephem import eph
        probe = win_hi
        for _ in range(3):
            sr = eph.lastSunrise(probe, lat, lon_geo)
            if sr is None or not (probe - 1.5 < float(sr) <= probe + 1e-9):
                break
            sunrises.append(float(sr))
            if float(sr) <= win_lo:
                break
            probe = float(sr) - 1e-5
    except Exception:
        sunrises = []
    sunrises.sort()

    def _sunrise_for(jd):
        """候选时刻所属吠陀日的日出(之前最近一次;求不出 → None,回落民用日)。"""
        best = None
        for sr in sunrises:
            if sr <= jd + 1e-9 and jd - 1.5 < sr:
                best = sr
        return best

    sunrise_jd0 = _sunrise_for(jd0)

    # anchor RP(§17.3-4 歧义 A8:默认取原始钟表时刻,无自指)
    anchor_rp = None
    a_asc = safe_get(kernel.chart, fconst.ASC)
    a_moon = safe_get(kernel.chart, fconst.MOON)
    # 🔴 域换算:flatlib dayofweek() 0=周日,WEEKDAY_LORDS 0=周一 → 必须 -1 平移
    #   (漏平移则民用日主恒错一天,每盘都印「二者不同,以日出为准」注)。
    #   _weekday_local 本身已是 0=周一域,直用。
    vara_civil = WEEKDAY_LORDS[_weekday_local(jd0) % 7]
    vara_sunrise = vara_civil
    if sunrise_jd0 is not None:
        vara_sunrise = WEEKDAY_LORDS[_weekday_local(sunrise_jd0) % 7]
    if a_asc is not None and a_moon is not None:
        al, ml = float(a_asc.lon), float(a_moon.lon)
        anchor_rp = ruling_planets_extended(
            int(al // 30.0) + 1, nakshatra_from_lon(al)['lord'],
            int(ml // 30.0) + 1, nakshatra_from_lon(ml)['lord'],
            _weekday_local(sunrise_jd0) if sunrise_jd0 is not None
            else _weekday_local(jd0),   # 日出不可得 → 民用日(0=周一域)
            lagna_sub_lord=kp_levels(al, depth=2).get('Sub'),
            moon_sub_lord=kp_levels(ml, depth=2).get('Sub'))

    custom_rp = [x for x in str(d.get('rectifyCustomRp') or '').split(',') if x]

    # 事件预处理:目标日(民用历时刻,1582 年以前儒略历、公元前带符号)+ 宫组。
    # 读不出 / 不存在的日期如实落账 skippedEvents,不静默丢(旧实现 [:10] + strptime 对公元前串必败、被吞)。
    ev_parsed = []
    skipped_events = []
    for idx, ev in enumerate(events[:12]):
        try:
            kind = str(ev.get('kind') or 'custom')
            ey, em, edd = parse_civil_date(ev.get('date') or '', 1)
            evdt = CivilDateTime(display_year(ey), em, edd)
            ev_parsed.append({'kind': kind, 'dt': evdt,
                              'customHouses': ev.get('houses')})
        except Exception as exc:
            skipped_events.append({'index': idx, 'date': str(ev.get('date') or ''), 'reason': str(exc) or 'unparsable'})

    # 生日时刻(候选=生日 ± 偏移):日期经 parse_civil_date(公元前负号 / ad=-1 都认),
    # 承载 CivilDateTime(儒略日数轴;1582-10-15 以后与 stdlib datetime 的加减比较逐位相同)。
    by, bm, bd = parse_civil_date(d.get('date', ''), d.get('ad', 1))
    tparts = str(d.get('time', '12:0:0')).split(':')
    birth_dt = CivilDateTime(display_year(by), bm, bd,
                             int(tparts[0]), int(float(tparts[1]) if len(tparts) > 1 else 0),
                             int(float(tparts[2]) if len(tparts) > 2 else 0))

    # Tier2 记忆化:事件 Dasha 宫集分数按 (lagna_sign, moon_nak, moon_rem_bucket) 分段常数
    tier2_cache = {}

    def _dasha_lords_at(event_dt, cand_dt, moon_lon):
        """候选生时 + 事件日 → (maha, antar, pratyantar) 主星(纯算术 Vimshottari)。"""
        nak = nakshatra_from_lon(moon_lon)
        lord = nak['lord']
        rem = float(nak['remainingRatio'])
        year_days = 365.25
        idx = DASHA_ORDER.index(lord)
        bal_days = DASHA_YEARS[lord] * rem * year_days
        t = cand_dt + _dt.timedelta(days=bal_days)
        if event_dt < t:
            maha = lord
            maha_start = cand_dt - _dt.timedelta(days=DASHA_YEARS[lord] * (1 - rem) * year_days)
            maha_days = DASHA_YEARS[lord] * year_days
        else:
            k = 1
            maha = None
            while k <= 18:
                cur = DASHA_ORDER[(idx + k) % 9]
                dur = DASHA_YEARS[cur] * year_days
                if event_dt < t + _dt.timedelta(days=dur):
                    maha = cur
                    maha_start = t
                    maha_days = dur
                    break
                t += _dt.timedelta(days=dur)
                k += 1
            if maha is None:
                return None
        # antar / pratyantar:比例细分,自 maha 主起
        def _sub(parent_lord, start, days):
            i0 = DASHA_ORDER.index(parent_lord)
            tt = start
            for k2 in range(9):
                sub = DASHA_ORDER[(i0 + k2) % 9]
                sd = days * DASHA_YEARS[sub] / DASHA_TOTAL
                if event_dt < tt + _dt.timedelta(days=sd):
                    return sub, tt, sd
                tt += _dt.timedelta(days=sd)
            return DASHA_ORDER[i0], start, days
        antar, a_start, a_days = _sub(maha, maha_start, maha_days)
        praty, _, _ = _sub(antar, a_start, a_days)
        return maha, antar, praty

    def _houses_of(planet_key, lagna_sign_idx):
        """曜(KP 键)在候选盘上所占+所主宫(whole-sign 自候选 lagna;纯算术)。"""
        pid = {'Rahu': fconst.NORTH_NODE, 'Ketu': fconst.SOUTH_NODE}.get(planet_key, planet_key)
        houses = set()
        sidx = planet_signs_idx.get(pid)
        if sidx is not None:
            houses.add(((sidx - lagna_sign_idx) % 12) + 1)
        for sno in range(12):
            if KP_SIGN_LORDS[sno] == planet_key:
                houses.add(((sno - lagna_sign_idx) % 12) + 1)
        return houses

    # ── 扫描 ──
    import time as _time
    t_start = _time.time()
    samples = []
    for i in range(-n_side, n_side + 1):
        off_sec = i * step_sec
        jd = jd0 + off_sec / 86400.0
        asc_lon = None
        moon_lon = None
        cusp_mode = 'placidus'
        with kernel.chart._siderealContext():
            try:
                hl, _ = fswe.sweHousesLon(jd, lat, lon_geo, fconst.HOUSES_PLACIDUS,
                                          fswe.swisseph.FLG_SIDEREAL)
                if hl and len(hl) >= 12:
                    asc_lon = float(hl[0]) % 360.0
            except Exception:
                # 🔴 sweHousesLon 无极地兜底(仅 sweHouses 有)→ Porphyry 重试(仓规硬性要求)
                try:
                    hl, _ = fswe.sweHousesLon(jd, lat, lon_geo, fconst.HOUSES_PORPHYRIUS,
                                              fswe.swisseph.FLG_SIDEREAL)
                    if hl and len(hl) >= 12:
                        asc_lon = float(hl[0]) % 360.0
                        cusp_mode = 'porphyry_polar_fallback'
                except Exception:
                    asc_lon = None
            try:
                moon_lon = float(fswe.sweObjectLon(fconst.MOON, jd)) % 360.0
            except Exception:
                moon_lon = None
        cand_dt = birth_dt + _dt.timedelta(seconds=off_sec)
        row = {'offsetSeconds': off_sec,
               'time': cand_dt.strftime('%H:%M:%S'),
               'ascLon': asc_lon, 'moonLon': moon_lon, 'cuspMode': cusp_mode}
        if asc_lon is not None:
            lv = kp_levels(asc_lon, depth=2)
            row['lagnaSignLord'] = KP_SIGN_LORDS[int(asc_lon // 30.0) % 12]
            row['lagnaStarLord'] = lv.get('Nak')
            row['lagnaSubLord'] = lv.get('Sub')
        samples.append(row)

    # 逐候选评分
    sun_rise_lon_cache = {}
    for row in samples:
        asc_lon, moon_lon = row['ascLon'], row['moonLon']
        if asc_lon is None or moon_lon is None:
            row['score'] = None
            continue
        # Pranapada:自候选所属日出起算(日出时太阳经度按日出记忆化,每窗口 ≤3 次)
        cand_jd = jd0 + row['offsetSeconds'] / 86400.0
        cand_sr = _sunrise_for(cand_jd)
        # 候选所属吠陀日的星期主(日出求不出 → 民用日):candidate RP 用它,并逐候选回显
        cand_vara = WEEKDAY_LORDS[_weekday_local(cand_sr) % 7] if cand_sr is not None \
            else WEEKDAY_LORDS[_weekday_local(cand_jd) % 7]
        row['varaLord'] = cand_vara
        pp_lon = None
        if cand_sr is not None:
            try:
                from astrostudy.india.upagraha import pranapada
                if cand_sr not in sun_rise_lon_cache:
                    with kernel.chart._siderealContext():
                        sun_rise_lon_cache[cand_sr] = float(fswe.sweObjectLon(fconst.SUN, cand_sr)) % 360.0
                elapsed_min = (cand_jd - cand_sr) * 1440.0
                pp_lon = pranapada(sun_rise_lon_cache[cand_sr], elapsed_min)
            except Exception:
                pp_lon = None
        pp = rf.pranapada_verdict(pp_lon, asc_lon, moon_lon) if pp_lon is not None else None
        # RP:anchor(默认)/candidate/custom
        cand_lords = {'signLord': row.get('lagnaSignLord'),
                      'starLord': row.get('lagnaStarLord'),
                      'subLord': row.get('lagnaSubLord')}
        if rp_source == 'custom' and custom_rp:
            rp_res = rf.rp_hit_score(cand_lords, custom_rp, 'custom')
        elif rp_source == 'candidate':
            # 字面读法:候选同刻 RP(含 vara);自指项由判据层移除
            cand_rp_set = [cand_lords['signLord'], cand_lords['starLord'],
                           KP_SIGN_LORDS[int(moon_lon // 30.0) % 12],
                           nakshatra_from_lon(moon_lon)['lord'], cand_vara,
                           cand_lords['subLord'], kp_levels(moon_lon, depth=2).get('Sub')]
            rp_res = rf.rp_hit_score(cand_lords, cand_rp_set, 'candidate')
        else:
            rp_res = rf.rp_hit_score(cand_lords, (anchor_rp or {}).get('set'), 'anchor')
        # 事件(Tier2 记忆化:lagna_sign × moon 宿桶)
        ev_results = []
        lagna_sign_idx = int(asc_lon // 30.0) % 12
        for ev in ev_parsed:
            mkey = (lagna_sign_idx, nakshatra_from_lon(moon_lon)['index'],
                    round(nakshatra_from_lon(moon_lon)['remainingRatio'], 3),
                    ev['dt'].jdn, ev['kind'])
            if mkey in tier2_cache:
                ev_results.append(tier2_cache[mkey])
                continue
            cand_dt = birth_dt + _dt.timedelta(seconds=row['offsetSeconds'])
            lords = _dasha_lords_at(ev['dt'], cand_dt, moon_lon)
            if lords is None:
                continue
            maha, antar, praty = lords
            res = rf.event_score(ev['kind'], {
                'maha': _houses_of(maha, lagna_sign_idx),
                'antar': _houses_of(antar, lagna_sign_idx),
                'pratyantar': _houses_of(praty, lagna_sign_idx),
            }, custom_houses=ev.get('customHouses'))
            tier2_cache[mkey] = res
            ev_results.append(res)
        # 边界预警(§17.5)
        g_moon = sp.gandanta_status(moon_lon)
        g_asc = sp.gandanta_status(asc_lon)
        combined = rf.combine_scores(pp['score'] if pp else 0.0,
                                     rp_res['score'], ev_results)
        row['pranapada'] = pp
        row['rp'] = rp_res
        row['events'] = ev_results
        row['boundary'] = {'moonGandanta': g_moon if g_moon['inGandanta'] else None,
                           'lagnaGandanta': g_asc if g_asc['inGandanta'] else None}
        row['score'] = combined

    # runs + 步长诊断 + Top-K
    runs = rf.merge_runs(samples, 'lagnaSubLord')
    for r in runs:
        r['fromTime'] = samples[r['fromIndex']]['time']
        r['toTime'] = samples[r['toIndex']]['time']
    diag = rf.resolution_diagnostics([r['ascLon'] for r in samples], step_sec)
    scored = [r for r in samples if r.get('score')]
    top = sorted(scored, key=lambda r: -r['score']['total'])[:top_k]
    elapsed_ms = (_time.time() - t_start) * 1000.0
    return {
        'available': True,
        'anchorTime': birth_dt.strftime('%Y-%m-%d %H:%M:%S'),
        'windowMinutes': window_min, 'stepSeconds': step_sec,
        'candidates': len(samples),
        'rpSource': rp_source,
        'anchorRp': anchor_rp,
        'vara': {'civil': vara_civil, 'sunrise': vara_sunrise,
                 'basisUsed': 'sunrise',
                 'note': VARA_BASIS_NOTE},
        'resolution': diag,
        # 实际参评判据(诚实回显:事件评分仅在请求携 rectifyEvents 时参评;
        # 印占页现版 UI 不产事件输入 → 常态为三判据,勿按 docstring 五判据宣称)
        'criteriaActive': ['rp', 'pranapada', 'boundary'] + (['events'] if ev_parsed else []),
        'skippedEvents': skipped_events,
        'runs': {'lagnaSubLord': runs},
        'top': top,
        'samples': samples,
        'elapsedMs': round(elapsed_ms, 1),
        'disclaimer': '半自动校时:输出证据与排序,采信与「采用」由用户决定',
    }


def warmup_india():
    """后端启动同步预热:跑一个 dummy 印度盘(核心 perchart + jyotish + D1 分盘 + 序列化),
    把 india 包(分盘/大运/jyotish/shadbala/...)的计算路径 + 星历全量载入,消除每次重启软件后
    *首次*进入印度占星的 ~3s 冷启动(模块已 import,但首次计算的星历首读 + 各子算法冷路径很重)。
    务必由 webchartsrv 在 PD 预热之后、engine.start 之前**同步**调用:复用已热 swisseph,
    且启动期无并发请求 → 不与真实请求争 swisseph 全局 sid_mode 而算错盘。失败由调用方兜底。"""
    data = {
        'date': '2000/1/1', 'time': '12:0:0', 'zone': 8,
        'lat': 39.9, 'lon': 116.4, 'ad': 1,
        'siderealMode': 'lahiri', 'hsys': 0,
        'tradition': False, 'predictive': False, 'zodiacal': 1,
    }
    srv = IndiaAstroSrv()
    perchart = IndiaChartKernel(data)
    jyotish = srv._safe_build_jyotish(perchart, 1, None)
    apply_varga_chart(perchart, 1)
    getIndiaChartJson(data, perchart, jyotish)
    try:
        rectify_core(dict(data, rectifyWindowMinutes=2, rectifyStepSeconds=60))
    except Exception:
        pass


class IndiaAstroSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()



    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def rectify(self):
        """半自动出生时间校正(§17):候选时间扫描 + 五判据评分。独立端点(照
        shadbalarange 骨架)—— 不进 compute()/fieldsToParams,扫描参数绝不进命盘缓存键。"""
        enable_crossdomain()
        try:
            data = cherrypy.request.json
            res = rectify_core(data)
            return jsonpickle.encode(res, unpicklable=False)
        except Exception:
            traceback.print_exc()
            return jsonpickle.encode({'err': 'param error'}, unpicklable=False)

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def chart(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            data['tradition'] = False
            data['predictive'] = False
            data['zodiacal'] = 1
            data['hsys'] = data.get('indiaHsys', data.get('hsys', 0))
            data['siderealMode'] = data.get('indiaAyanamsa', data.get('ayanamsa', data.get('siderealMode', 'lahiri')))
            chartnum = 1
            if 'chartnum' in data.keys():
                try:
                    chartnum = int(data['chartnum'])
                except Exception:
                    chartnum = 1
            chartnum = normalize_chartnum(chartnum)
            dasha_seed = data.get('dashaSeed')  # 大运起点(默认月亮宿;可选七政/节点/上升/特殊上升/副星)
            sthira_start = data.get('sthiraStart')  # Sthira 固定座运起座:lagna(默认)/brahma(BPHS)
            # 选中的树形大运体系(默认 vimshottari):仅该体系算完整三级,其余只出 maha 顶层(省体积)。
            # UI 一次只显示一个体系,切换会带新 dashaSystem 重取。缺省 → 默认 vimshottari 全展开(零回归)。
            dasha_system = data.get('dashaSystem')
            dasha_variants = data.get('dashaVariants')   # 21 流派开关(单 JSON 对象;缺省 None=全默认零回归)
            dasha_year = data.get('dashaYearLength')  # 大运年长(§10.1.5 五档;缺省 365.25,引擎白名单校验)
            # W1 三设置(缺省=零回归):分盘变体映射/{chartnum:variant};Chara Karaka 7|8;星曜战判据。
            varga_variants = normalize_varga_variants(data.get('vargaVariant'))
            karaka_scheme = data.get('karakaScheme')
            yuddha_criterion = data.get('yuddhaCriterion')

            perchart = IndiaChartKernel(data)
            # jyotish 须算在「实际所绘分盘」上(原先恒在 D1 上算)。
            # 分盘时另建独立 D1 副本，供 always-D1 子项(大运月宿/Panchanga/Gochara)；
            # chartnum==1 时 d1≡perchart、先算 jyotish 再 reinit，行为与重构前字节一致。
            d1_perchart = None
            if chartnum != 1:
                d1_perchart = IndiaChartKernel(data)
                apply_varga_chart(perchart, chartnum, varga_variants.get(chartnum))
            jyotish = self._safe_build_jyotish(perchart, chartnum, d1_perchart, dasha_seed, sthira_start, dasha_system, dasha_year,
                                               dasha_variants=dasha_variants,
                                               varga_variants=varga_variants, karaka_scheme=karaka_scheme, yuddha_criterion=yuddha_criterion)
            if chartnum == 1:
                apply_varga_chart(perchart, chartnum)

            # vargaSet 可选多分盘 jyotish(jyotishByVarga)，opt-in、上限 16。
            varga_set = self._parse_varga_set(data.get('vargaSet'))
            if varga_set:
                # base_d1 = 干净 D1 核(从不被 varga 变换):chartnum!=1 时即 d1_perchart;
                # chartnum==1 时 perchart 只经 apply_varga_chart(·,1)(仅写 varga 元数据 + reinit，
                # 不动经纬)→ 坐标仍 D1，可安全作 base。每个分盘**深拷贝 base 再 apply_varga**，
                # 免去逐盘重算 D1 星历(深拷贝 ≈0.7ms vs 重建 ≈3.3ms;varga 变换不含星历)。
                # 深拷贝独立、不污染 base(apply_varga 末尾 reinit 重建 house.planets 等可变态)；
                # 字节级与「逐盘 IndiaChartKernel(data)」一致(全分盘/边界日期已核)。
                d1_for_set = d1_perchart if d1_perchart is not None else perchart
                base_d1 = d1_for_set
                jyotish_by_varga = {}
                for vnum in varga_set:
                    if vnum == chartnum:
                        # 断自循环引用:存浅拷贝而非 jyotish 本身。否则下方 jyotish['jyotishByVarga']=jyotish_by_varga
                        # 会令 jyotish→jyotishByVarga→该盘→jyotish 自指,jsonpickle(unpicklable=False 无环检测)无限递归
                        # → RecursionError → 整请求被 except 吞成「param error」(分盘集含主盘号时必崩的真因)。
                        # 浅拷贝取于 gochara/tajaka/jyotishByVarga 挂载之前,与其它分盘(无 gochara/tajaka)口径一致。
                        jyotish_by_varga[str(vnum)] = dict(jyotish)
                        continue
                    vchart = copy.deepcopy(base_d1)
                    if vnum != 1:
                        apply_varga_chart(vchart, vnum, varga_variants.get(vnum))
                    jyotish_by_varga[str(vnum)] = self._safe_build_jyotish(
                        vchart, vnum, None if vnum == 1 else d1_for_set, dasha_seed, sthira_start, dasha_system, dasha_year,
                        dasha_variants=dasha_variants,
                        varga_variants=varga_variants, karaka_scheme=karaka_scheme, yuddha_criterion=yuddha_criterion)
                jyotish['jyotishByVarga'] = jyotish_by_varga

            # Gochara(过运) + Tajaka(年度盘)：需另起过运盘 / 太阳回归盘，挂进主 jyotish。
            natal_perchart = d1_perchart if d1_perchart is not None else perchart
            if isinstance(jyotish, dict):
                # 服务层挂载块失败一律落 jyotish['partialErrors'](与引擎逐键容错同一张表)
                svc = {}
                tctx = self._transit_context(data, errs=svc)
                gochara = self._compute_gochara(data, natal_perchart, jyotish, tctx=tctx, errs=svc)
                if gochara:
                    jyotish['gochara'] = gochara
                    # 过运×大运联动:「过运日」所在大/中运主在「从月」过运里的吉凶/Vedha/AV 合参。
                    # 🔴 按所选过运日(tctx.transitDate,缺省今天)在 Vimshottari 段表里查,不按服务器此刻。
                    try:
                        link = self._dasha_link_at(jyotish, gochara, (tctx or {}).get('transitDate'))
                        if link:
                            gochara['dashaLink'] = link
                    except Exception:
                        traceback.print_exc()
                        _note_partial(svc, 'dashaLink')
                # Dehachanchala(Kalachakra 过运联动):恶星(火/日/土/罗)过 deha 座 → 风险;
                # 吉星(木/金,简化口径:不判月盈亏/水星伴凶)过 jeeva 座 → 振奋。附加输出键。
                try:
                    kc = ((jyotish.get('rasiDasha') or {}).get('kalachakra') or {})
                    if kc.get('available') and tctx and tctx.get('signs'):
                        deha, jeeva = kc.get('deha'), kc.get('jeeva')
                        MAL = ('Mars', 'Sun', 'Saturn', 'North Node')
                        BEN = ('Jupiter', 'Venus')
                        hits = []
                        for pid, tsign in (tctx.get('signs') or {}).items():
                            if pid in MAL and tsign == deha:
                                hits.append({'planet': pid, 'on': 'deha', 'nature': 'malefic'})
                            elif pid in BEN and tsign == jeeva:
                                hits.append({'planet': pid, 'on': 'jeeva', 'nature': 'benefic'})
                        kc['dehachanchala'] = {
                            'deha': deha, 'jeeva': jeeva,
                            'transitDate': tctx.get('transitDate'),
                            'hits': hits,
                            'note': '恶星过 Deha=事故/健康险;吉星过 Jiva=振奋(吉星取木/金简化口径)',
                        }
                except Exception:
                    traceback.print_exc()
                    _note_partial(svc, 'dehachanchala')
                tajaka = self._compute_tajaka(data, natal_perchart, natal_jyotish=jyotish, errs=svc)   # 带本命首运曜/月宿余比 → Mudda 年内大运
                if tajaka:
                    jyotish['tajaka'] = tajaka
                # SBC 全吉盘:输入与过运上下文完全重合 → 零额外星历成本,恒挂(体积小)。
                sbc = self._compute_sarvatobhadra(natal_perchart, tctx, errs=svc)
                if sbc:
                    jyotish['sarvatobhadra'] = sbc
                # 三旗盘:12 次建盘 ≈0.3-0.8s → opt-in(前端首次点击才带 tripataki=1)。
                if data.get('tripataki'):
                    tri = self._compute_tripataki(data, natal_perchart, errs=svc)
                    if tri:
                        jyotish['tripataki'] = tri
                # 问事族:显式起卦才算(prashnaTime 一次性冻结字符串,见前端契约)。
                pr = self._compute_prashna(data, natal_perchart, errs=svc)
                if pr:
                    jyotish['prashna'] = pr
                if svc.get('partialErrors'):
                    # 新列表(不就地改):分盘集里主盘那份是 jyotish 的浅拷贝,共享列表会串账
                    jyotish['partialErrors'] = list(jyotish.get('partialErrors') or []) + [
                        n for n in svc['partialErrors'] if n not in (jyotish.get('partialErrors') or [])]

            res = getIndiaChartJson(data, perchart, jyotish)
            return res
        except Exception:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)

    @staticmethod
    def _dasha_link_at(jyotish, gochara, transit_date):
        """过运日所在的 Vimshottari 大运 / 中运 + 其主星在「从月」过运里的状态。
        联动体系恒定为 Vimshottari(与大运标签所选体系无关;卡片写明体系名):
        Vimshottari 大运顶层恒算;未选中时引擎只出顶层,中运按过运日沿同一纯算术单源
        (vimshottari_sub_periods)现算 —— 不建全树,与选中时的树逐字节同值。
        transit_date 'YYYY/MM/DD'(过运盘取出生地当地 12:00);缺/坏 → 今天。段界用 startIso/endIso(精确到秒)。"""
        import datetime as _dt
        from astrostudy.india.jyotish_parts.helpers import parse_local_iso
        from astrostudy.india.jyotish_parts.dashas import vimshottari_sub_periods
        from astrostudy.india.jyotish_parts.helpers import _julian_label_to_gregorian
        try:
            # 段界 ISO 是 proleptic 格里历真时刻:民用日期(1582 年以前儒略历)先换成同一天的格里历日期再比。
            ay, m, d = parse_civil_date(transit_date, 1)
            if ay < 1:
                return None     # 公元前没有大运段界(get_local_birth_datetime 同口径)
            y = display_year(ay)
            if (y, m, d) < (1582, 10, 15):
                y, m, d = _julian_label_to_gregorian(y, m, d)
            when = _dt.datetime(y, m, d, 12, 0, 0)
        except Exception:
            when = _dt.datetime.now()
        vim = (jyotish.get('dasha') or {}).get('vimshottari') or {}

        def _span(item):
            try:
                return parse_local_iso(item['startIso']), parse_local_iso(item['endIso'])
            except Exception:
                return None, None

        def _within(item):
            s0, e0 = _span(item)
            return bool(s0 and e0 and s0 <= when < e0)
        act = next((x for x in (vim.get('mahadashas') or []) if _within(x)), None)
        if not act:
            return None
        from_moon = gochara.get('fromMoon') or []
        md_lord = (act.get('lord') or {}).get('id')
        link = {'system': 'vimshottari', 'systemLabel': 'Vimshottari',
                'mahaLord': act.get('lord'),
                'transitFromMoon': next((r for r in from_moon if r.get('planet') == md_lord), None),
                'atDate': when.strftime('%Y-%m-%d')}
        antars = act.get('antardashas')
        if not antars:
            s0, e0 = _span(act)
            year_days = float(vim.get('yearLengthDays') or 365.25)
            parent_days = float((act.get('lord') or {}).get('years') or act.get('years') or 0) * year_days
            antars = vimshottari_sub_periods(act['lord'], s0, parent_days, 2, year_days) if s0 and parent_days else []
        sub = next((x for x in antars if _within(x)), None)
        if sub:
            ad_lord = (sub.get('lord') or {}).get('id')
            link['antarLord'] = sub.get('lord')
            link['antarTransitFromMoon'] = next((r for r in from_moon if r.get('planet') == ad_lord), None)
        link['note'] = '过运日所在 Vimshottari 大/中运主的过运状态合参(激活性判读;与大运标签所选体系无关)'
        return link

    def _safe_build_jyotish(self, perchart, chartnum, d1_perchart, dasha_seed=None, sthira_start=None, dasha_system=None, dasha_year_days=None,
                            varga_variants=None, karaka_scheme=None, yuddha_criterion=None, dasha_variants=None):
        """计算 jyotish；失败回退占位 dict(保留原 chart() 的错误兜底语义)。"""
        try:
            return build_jyotish(perchart, chartnum=chartnum, d1_perchart=d1_perchart, dasha_seed=dasha_seed, sthira_start=sthira_start, dasha_system=dasha_system,
                                 dasha_year_days=dasha_year_days, dasha_variants=dasha_variants,
                                 varga_variants=varga_variants, karaka_scheme=karaka_scheme, yuddha_criterion=yuddha_criterion)
        except Exception:
            traceback.print_exc()
            return {
                'engine': {
                    'name': 'Horosa JyotishEngine',
                    'version': '0.1.0',
                    'ephemeris': 'Horosa Swiss Ephemeris / IndiaChartKernel',
                    'source': 'chart_json_only',
                    'chartnum': chartnum,
                },
                'error': 'jyotish calculation error'
            }

    @staticmethod
    def _parse_varga_set(raw):
        """解析 vargaSet(字符串 "1,9,10" 或列表)→ 去重、归一化、上限 16 的 chartnum 列表。"""
        if not raw:
            return []
        if isinstance(raw, str):
            parts = raw.replace('，', ',').split(',')
        elif isinstance(raw, (list, tuple)):
            parts = raw
        else:
            return []
        out = []
        for p in parts:
            try:
                vnum = normalize_chartnum(int(p))
            except (TypeError, ValueError):
                continue
            if vnum not in out:
                out.append(vnum)
            if len(out) >= 16:
                break
        return out

    def _transit_context(self, data, errs=None):
        """过运上下文(gochara/SBC 共用,一次建盘两处用 → SBC 零额外星历成本):
        {kernel, transitDate, signs, naks(27 序), naks28(28 序)}。失败返 None。"""
        try:
            from astrostudy.india.jyotish_engine import safe_get
            from astrostudy.nakshatra import nakshatra_from_lon
            from astrostudy.india.primitives import nakshatra_number_28
            from flatlib import const
            transit_date = data.get('transitDate')
            if not transit_date:
                import datetime as _dt
                transit_date = _dt.datetime.now().strftime('%Y/%m/%d')
            tdata = _derived_kernel_data(data, transit_date, '12:00:00')
            tchart = IndiaChartKernel(tdata)
            ids = [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                   const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE]
            signs, naks, naks28 = {}, {}, {}
            for oid in ids:
                o = safe_get(tchart.chart, oid)
                if o:
                    signs[oid] = o.sign
                    nk = nakshatra_from_lon(o.lon)
                    naks[oid] = nk['index']
                    naks28[oid] = nakshatra_number_28(o.lon, nk['index'])
            return {'kernel': tchart, 'transitDate': transit_date,
                    'signs': signs, 'naks': naks, 'naks28': naks28}
        except Exception:
            traceback.print_exc()
            _note_partial(errs, 'transitContext')
            return None

    def _compute_gochara(self, data, natal_perchart, jyotish, tctx=None, errs=None):
        """过运盘(transitDate 或服务器今日 12:00、出生地)→ compute_gochara。默认即出当前过运 + Sade Sati。
        tctx 缺省自建(旧签名调用零破坏);chart() 传入共享上下文免重复建盘。"""
        try:
            from astrostudy.india.gochara import compute_gochara
            from astrostudy.india.jyotish_engine import safe_get
            from flatlib import const
            natal_moon = safe_get(natal_perchart.chart, const.MOON)
            natal_asc = safe_get(natal_perchart.chart, const.ASC)
            if not natal_moon or not natal_asc:
                return None
            if tctx is None:
                tctx = self._transit_context(data)
            if tctx is None:
                return None
            transit_date = tctx['transitDate']
            transit_signs = tctx['signs']
            transit_naks = tctx['naks']
            from astrostudy.nakshatra import nakshatra_from_lon
            # 过运 AV 恒取本命 D1 八分点(行运位置是 D1;分盘视图下 jyotish.ashtakavarga 是分盘 AV)。
            av = jyotish.get('ashtakavarga') if isinstance(jyotish, dict) else None
            if (isinstance(jyotish, dict) and (jyotish.get('engine') or {}).get('chartnum', 1) != 1):
                try:
                    from astrostudy.india.jyotish_engine import JyotishEngine
                    av = JyotishEngine(natal_perchart).ashtakavarga()
                except Exception:
                    traceback.print_exc()
                    av = None
                    _note_partial(errs, 'gochara.ashtakavarga')
            natal_sun = safe_get(natal_perchart.chart, const.SUN)
            # vedhaBlockers 流派开关经 dashaVariants 白名单解析(缺省 'all' = 既有口径零回归)
            from astrostudy.india.dasha_variants import resolve_variants as _rv_vedha
            _vb = _rv_vedha(data.get('dashaVariants')).get('vedhaBlockers', 'all')
            res = compute_gochara(
                natal_moon.sign, natal_asc.sign, transit_signs, av, transit_date,
                natal_moon_nak_index=nakshatra_from_lon(natal_moon.lon)['index'],
                natal_lagna_nak_index=nakshatra_from_lon(natal_asc.lon)['index'],
                transit_naks=transit_naks,
                natal_sun_sign=(natal_sun.sign if natal_sun else None),
                vedha_blockers=_vb)
            if isinstance(res, dict):
                res['transitDate'] = transit_date
            return res
        except Exception:
            traceback.print_exc()
            _note_partial(errs, 'gochara')
            return None

    def _compute_sarvatobhadra(self, natal_perchart, tctx, errs=None):
        """SBC 全吉盘(§24.1):本命月/升 28 宿参照 + 过运 28 宿叠加 → compute_sbc。
        经典环锚未录入时引擎自降级(占位布局 + Vedha 全禁),此处照挂不判。"""
        try:
            if tctx is None:
                return None
            from astrostudy.india.sarvatobhadra import compute_sbc
            from astrostudy.india.jyotish_engine import safe_get
            from astrostudy.nakshatra import nakshatra_from_lon
            from astrostudy.india.primitives import nakshatra_number_28
            from flatlib import const
            refs = {}
            for key, oid in (('moon', const.MOON), ('lagna', const.ASC)):
                o = safe_get(natal_perchart.chart, oid)
                if o is not None:
                    nk = nakshatra_from_lon(o.lon)
                    refs[key] = nakshatra_number_28(o.lon, nk['index'])
            res = compute_sbc(natal_refs=refs, transit_nak28=tctx.get('naks28'))
            if isinstance(res, dict):
                res['transitDate'] = tctx.get('transitDate')
            return res
        except Exception:
            traceback.print_exc()
            _note_partial(errs, 'sarvatobhadra')
            return None

    def _compute_tripataki(self, data, natal_perchart, errs=None):
        """三旗盘(§11.11,opt-in):年盘(太阳返照)时刻起逐月 12 盘 → tripataki.build_tripataki。
        月界 equal12(权威未定,歧义 A14);中心 = 年盘月亮/土星双份一次算完。"""
        try:
            import datetime as _dt
            from astrostudy.india.tripataki import build_tripataki
            from astrostudy.india.jyotish_engine import safe_get
            from flatlib import const
            tajaka_year = data.get('tajakaYear')
            if not tajaka_year:
                tajaka_year = _dt.datetime.now().year
            tajaka_year = int(tajaka_year)
            natal_sun = safe_get(natal_perchart.chart, const.SUN)
            if not natal_sun:
                return None
            # 同 _compute_tajaka:本命月日经 parse_civil_date('/' '-' 两种分隔、公元前负号都认)
            _by, month, day = parse_civil_date(data.get('date', ''), data.get('ad', 1))
            target = float(natal_sun.lon)

            def build_at(date_str, time_str):
                return IndiaChartKernel(_derived_kernel_data(data, date_str, time_str))

            # 年首时刻:太阳返照求根(允许跨日 + 2/29 归一,与 _compute_tajaka 同 helper)
            varsha_dt, ann_adjusted = self._solar_return_moment(build_at, tajaka_year, month, day, target)
            kernel = build_at(_civil_slash(varsha_dt), varsha_dt.strftime('%H:%M:%S'))
            moon = safe_get(kernel.chart, const.MOON)
            saturn = safe_get(kernel.chart, const.SATURN)
            centers = {'moon': getattr(moon, 'sign', None),
                       'saturn': getattr(saturn, 'sign', None)}
            # 12 个月:年首 + k×(365.2422/12) 日,各起过运盘取九曜座
            ids = [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                   const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE]
            months = []
            for k in range(12):
                mdt = varsha_dt + _dt.timedelta(days=k * (365.2422 / 12.0))
                mk = build_at(_civil_slash(mdt), mdt.strftime('%H:%M:%S'))
                signs = {}
                for oid in ids:
                    o = safe_get(mk.chart, oid)
                    if o:
                        signs[oid] = o.sign
                months.append({'index': k + 1, 'label': mdt.strftime('%Y-%m-%d'),
                               'signs': signs})
            from astrostudy.india.dasha_variants import resolve_variants as _rv_vedha
            res = build_tripataki(months, centers,
                                  vedha_blockers=_rv_vedha(data.get('dashaVariants')).get('vedhaBlockers', 'all'))
            if isinstance(res, dict):
                res['tajakaYear'] = tajaka_year
                res['varshaMoment'] = varsha_dt.strftime('%Y-%m-%d %H:%M:%S')
                if ann_adjusted:
                    res['anniversaryAdjusted'] = '2/29 生日平年:以 2/28 同时刻为种子求真返照(实际时刻见 varshaMoment,常落 3/1)'
            return res
        except Exception:
            traceback.print_exc()
            _note_partial(errs, 'tripataki')
            return None

    @staticmethod
    def _solar_return_moment(build_kernel_fn, tajaka_year, month, day, target_lon):
        """太阳返照时刻求根(平速迭代,允许跨日;2/29 在目标年不存在时归一 2/28)。

        🔴 两个根修合一:
        ① 旧式单步逼近后 `max(0, min(23.999, hours))` —— 真回归时刻落在生日纪念日
          之外时被硬夹在当日边界(实测 45 年里 13 年触发,年盘上升可偏约 4 宫)。
          现允许跨日并迭代至收敛(平速二轮已 <0.1°)。
        ② 2/29 生日 + 平年:年盘走字符串静默滚日、三旗盘 datetime() 抛 ValueError
          被裸 except 吞成整块消失 —— 同一非法日期两种行为。统一归一 2/28 并回显。
        ③ 年份按民用历(历史纪年;1582 年以前儒略历闰年、公元前带符号):闰日存在与否经 civil_ymd_valid,
          迭代在儒略日数轴上走(CivilDateTime;1582-10-15 以后与 stdlib datetime 逐位相同)。
        build_kernel_fn(date_str, time_str) → kernel;返回 (CivilDateTime, anniversaryAdjusted)。"""
        import datetime as _dt
        from astrostudy.india.jyotish_engine import safe_get
        from flatlib import const as _c
        y, m, d = int(tajaka_year), int(month), int(day)
        adjusted = False
        if m == 2 and d == 29 and not civil_ymd_valid(y, 2, 29):
            d = 28
            adjusted = True
        cur = CivilDateTime(y, m, d, 12, 0, 0)
        rate = 360.0 / 365.25 / 24.0            # 太阳平均时速(°/h)
        for _ in range(3):
            k = build_kernel_fn(_civil_slash(cur), cur.strftime('%H:%M:%S'))
            sun = safe_get(k.chart, _c.SUN) if k is not None else None
            if sun is None:
                return cur, adjusted
            diff = ((float(sun.lon) - float(target_lon) + 180.0) % 360.0) - 180.0
            if abs(diff) < 1e-4:
                break
            cur = cur - _dt.timedelta(hours=diff / rate)
        return cur, adjusted

    @staticmethod
    def _weekday_from_jd_local(jd, zone_hours):
        """jd(UT)+ 时区 → 当地民用日星期(0=周一,与 kp_system.WEEKDAY_LORDS 同域)。
        单一来源 primitives.local_weekday(0=周日)经 weekday_mon0 换域。"""
        from astrostudy.india.primitives import local_weekday, weekday_mon0
        return weekday_mon0(local_weekday(jd, float(zone_hours)))

    def _compute_prashna(self, data, natal_perchart, errs=None):
        """问事族(§12.7/§25.1/§25.2):prashnaTime(冻结字符串)在场才算。
        KP 分区强制 KP 框架(krishnamurti + Placidus,与页面岁差解耦,回显供提示);
        Parāśarī/Tājika 分区用页面自身框架另起问时 kernel,全部复用既有引擎。"""
        try:
            q_time = data.get('prashnaTime')
            if not q_time:
                return None
            import datetime as _dt
            raw = str(q_time).replace('-', '/').strip()
            date_part, _, time_part = raw.partition(' ')
            time_part = time_part or '12:00:00'
            # 问时按民用历读(公元前负号、1582 年以前儒略历闰日都认);不存在的日期 → ValueError(整块落账)。
            # 显示用民用历标签;交给问时大运路径的是 proleptic 格里历真时刻(与本命大运段界 ISO 同一坐标,
            # 1582 年以前先换同一天的格里历;公元前没有大运段界 → None,与本命 get_local_birth_datetime 同口径)。
            from astrostudy.india.jyotish_parts.helpers import _julian_label_to_gregorian
            qy, qm, qd = parse_civil_date(date_part, 1)
            tp = time_part.split(':')
            if len(tp) not in (2, 3):
                raise ValueError('prashnaTime 时刻格式')
            q_hms = (int(tp[0]), int(tp[1]), int(tp[2]) if len(tp) > 2 else 0)
            q_label = CivilDateTime(display_year(qy), qm, qd, *q_hms)
            if qy < 1:
                q_dt = None
            else:
                gy, gm, gd = (q_label.year, qm, qd)
                if (gy, gm, gd) < (1582, 10, 15):
                    gy, gm, gd = _julian_label_to_gregorian(gy, gm, gd)
                q_dt = _dt.datetime(gy, gm, gd, *q_hms)
            schools = [x for x in str(data.get('prashnaSchools') or 'kp').split(',') if x]
            matter = str(data.get('prashnaMatter') or 'general')
            out = {'available': True, 'questionTime': q_label.strftime('%Y-%m-%d %H:%M:%S'),
                   'matter': matter, 'schools': schools}
            if 'kp' in schools:
                out['kp'] = self._prashna_kp_block(data, q_dt, date_part, time_part, matter)
            if 'parashari' in schools or 'tajika' in schools:
                pk = self._prashna_page_kernel(data, date_part, time_part)
                for school in ('parashari', 'tajika'):
                    if school not in schools:
                        continue
                    if pk is None:
                        out[school] = {'available': False, 'reason': 'page_kernel_error'}
                        _note_partial(out, school)
                    elif school == 'parashari':
                        out[school] = self._prashna_parashari_block(pk, natal_perchart)
                    else:
                        out[school] = self._prashna_tajika_block(pk, matter, data)
            return out
        except Exception:
            traceback.print_exc()
            _note_partial(errs, 'prashna')
            return None

    def _prashna_page_kernel(self, data, date_part, time_part):
        try:
            return IndiaChartKernel(_derived_kernel_data(data, date_part, time_part))
        except Exception:
            traceback.print_exc()
            return None

    def _prashna_kp_block(self, data, q_dt, date_part, time_part, matter):
        """KP 完整问时盘:问数定上升(段中点)→ 反解 Placidus 宫始 → CSL/Significator/RP/裁决/应期。"""
        try:
            from astrostudy.india import prashna as pr
            from astrostudy.india.kp_system import kp_levels, ruling_planets_extended
            from astrostudy.india.jyotish_engine import safe_get
            from astrostudy.nakshatra import nakshatra_from_lon
            from flatlib import const as fconst
            from flatlib.ephem import swe as fswe
            import swisseph

            number = data.get('prashnaNumber')
            try:
                number = int(number)
            except (TypeError, ValueError):
                return {'available': False, 'reason': 'missing_or_invalid_number'}
            if not 1 <= number <= 249:
                return {'available': False, 'reason': 'number_out_of_range'}

            kp_data = _derived_kernel_data(data, date_part, time_part)
            kp_data['siderealMode'] = 'krishnamurti'      # KP 框架强制(§12.8-1)
            kp_data['hsys'] = 3
            kernel = IndiaChartKernel(kp_data)
            jd = kernel.dateTime.jd
            lat = kernel.pos.lat
            lon_geo = kernel.pos.lon
            target = pr.horary_target_lon(number)
            cusp_mode = str(data.get('prashnaCuspMode') or 'asc_driven_placidus')
            if cusp_mode not in pr.CUSP_MODES or cusp_mode == 'equal_from_asc':
                cusp_mode = 'asc_driven_placidus'         # equal 仅降级,不可手选
            notes = ['KP 框架强制:KP Ayanamsa + Placidus(与页面岁差选择解耦)']

            def asc_fn(jd_probe):
                try:
                    hl, _ = fswe.sweHousesLon(jd_probe, lat, lon_geo,
                                              fconst.HOUSES_PLACIDUS,
                                              fswe.swisseph.FLG_SIDEREAL)
                    return float(hl[0]) % 360.0 if hl and len(hl) >= 12 else None
                except Exception:
                    return None

            def cusps_at(jd_probe):
                try:
                    hl, _ = fswe.sweHousesLon(jd_probe, lat, lon_geo,
                                              fconst.HOUSES_PLACIDUS,
                                              fswe.swisseph.FLG_SIDEREAL)
                    return [float(h) % 360.0 for h in hl[:12]] if hl and len(hl) >= 12 else None
                except Exception:
                    return None

            cusps = None
            mismatch = None
            with kernel.chart._siderealContext():
                if cusp_mode == 'asc_driven_placidus':
                    root_jd, err = pr.solve_asc_jd(asc_fn, target, jd)
                    if root_jd is not None:
                        cusps = cusps_at(root_jd)
                if cusp_mode == 'time_placidus' or cusps is None:
                    c2 = cusps_at(jd)
                    if c2 is not None and cusp_mode == 'time_placidus':
                        cusps = c2
                        mismatch = round(abs((c2[0] - target + 180.0) % 360.0 - 180.0), 4)
                    elif cusps is None and c2 is not None:
                        # asc_driven 求根失败但该刻 Placidus 可算 → 字面口径兜底
                        cusps = c2
                        cusp_mode = 'time_placidus'
                        mismatch = round(abs((c2[0] - target + 180.0) % 360.0 - 180.0), 4)
                        notes.append('上升反解未收敛,退化为问事时刻 Placidus(cuspAscMismatchDeg 已给)')
            if cusps is None:
                # 极地等 Placidus 不可算 → 等宫降级(仅降级路径,不可手选)
                cusps = [(target + 30.0 * i) % 360.0 for i in range(12)]
                cusp_mode = 'equal_from_asc'
                notes.append('Placidus 极区不可算,降级等宫(自问数上升起)')

            # 问事时刻九曜(KP 框架恒星经度) → KP 键
            planet_lons = {}
            for oid in (fconst.SUN, fconst.MOON, fconst.MARS, fconst.MERCURY, fconst.JUPITER,
                        fconst.VENUS, fconst.SATURN, fconst.NORTH_NODE, fconst.SOUTH_NODE):
                o = safe_get(kernel.chart, oid)
                if o is not None:
                    planet_lons[pr.to_kp_key(oid)] = float(o.lon)

            # RP(七项扩展版):问事时刻实际天象(非问数上升)
            asc_obj = safe_get(kernel.chart, fconst.ASC)
            moon_lon = planet_lons.get('Moon')
            rp = None
            vara = None
            if asc_obj is not None and moon_lon is not None:
                a_lon = float(asc_obj.lon)
                a_nak = nakshatra_from_lon(a_lon)
                m_nak = nakshatra_from_lon(moon_lon)
                # 星期:本命 / 问事 / 校时同一来源(primitives.vedic_weekday,日界 = 日出;0=周日 → 换 0=周一)
                from astrostudy.india.primitives import vedic_weekday, local_weekday, weekday_mon0
                zone_hours = _zone_hours_of(kp_data.get('zone'))
                weekday_civil = weekday_mon0(local_weekday(jd, zone_hours))
                _wd_sr, _sr = vedic_weekday(jd, lat, lon_geo, zone_hours)
                weekday_sunrise = weekday_mon0(_wd_sr) if _sr is not None else weekday_civil
                from astrostudy.india.kp_system import WEEKDAY_LORDS
                vara = {'civil': WEEKDAY_LORDS[weekday_civil % 7],
                        'sunrise': WEEKDAY_LORDS[weekday_sunrise % 7],
                        'basisUsed': 'sunrise',
                        'note': VARA_BASIS_NOTE}
                rp = ruling_planets_extended(
                    int(a_lon // 30.0) + 1, a_nak['lord'],
                    int(moon_lon // 30.0) + 1, m_nak['lord'],
                    weekday_sunrise,
                    lagna_sub_lord=kp_levels(a_lon, depth=2).get('Sub'),
                    moon_sub_lord=kp_levels(moon_lon, depth=2).get('Sub'))

            year_days = 365.25
            try:
                dy = float(data.get('dashaYearLength') or 365.25)
                if any(abs(dy - c) < 1e-6 for c in (365.25, 365.2425, 360.0, 365.2422, 365.2563)):
                    year_days = dy
            except (TypeError, ValueError):
                pass
            primary = data.get('prashnaPrimaryHouse')
            return pr.assemble_kp_horary(
                number, matter, cusps, cusp_mode, planet_lons, q_dt,
                rp, vara, primary_house=primary, year_days=year_days,
                cusp_asc_mismatch=mismatch, notes=notes)
        except Exception:
            traceback.print_exc()
            return {'available': False, 'reason': 'kp_block_error'}

    def _prashna_parashari_block(self, qkernel, natal_perchart):
        """Parāśarī 问事(§25.1):零新算法,全部复用 —— Lagna/宫主状态 + 月亮心念
        (宿/Tithi/Paksha)+ 相照 + Yoga + Arudha + 特殊 Lagna + Tara/Chandra(对本命月)。"""
        try:
            from astrostudy.india.jyotish_engine import JyotishEngine, safe_get, SIGN_CN
            from astrostudy.india.gochara import tara_bala, good_houses_for
            from astrostudy.india.yoga_engine import build_yogas, present_yogas_brief
            from astrostudy.nakshatra import nakshatra_from_lon
            from flatlib import const
            eng = JyotishEngine(qkernel)
            pan = eng.panchanga()
            asc = safe_get(qkernel.chart, const.ASC)
            moon = safe_get(qkernel.chart, const.MOON)
            block = {'available': True, 'frame': 'page'}
            if asc is not None:
                block['lagna'] = {'sign': asc.sign, 'signLabel': SIGN_CN.get(asc.sign, asc.sign),
                                  'lon': float(asc.lon)}
            if isinstance(pan, dict):
                tithi = pan.get('tithi') if isinstance(pan.get('tithi'), dict) else {}
                block['moon'] = {
                    'nakshatra': pan.get('nakshatra'),
                    'tithi': pan.get('tithi'),
                    # 白黑分在 panchanga.tithi.paksha(顶层无此键;曾读顶层 → 恒 None)
                    'paksha': tithi.get('paksha'),
                }
            try:
                # 生产方形状:build_yogas → {'items': [{id, name, zhName, status, ...}]},成立 = status=='present'
                block['yogas'] = present_yogas_brief(build_yogas(qkernel))
            except Exception:
                traceback.print_exc()
                block['yogas'] = None
                _note_partial(block, 'yogas')
            try:
                block['arudha'] = eng.arudha()
            except Exception:
                traceback.print_exc()
                block['arudha'] = None
                _note_partial(block, 'arudha')
            try:
                block['supplementaryLagnas'] = eng.supplementary_lagnas()
            except Exception:
                traceback.print_exc()
                block['supplementaryLagnas'] = None
                _note_partial(block, 'supplementaryLagnas')
            # Tara/Chandra Bala 需本命月参照;缺则置 None 但整块仍可用
            natal_moon = safe_get(natal_perchart.chart, const.MOON) if natal_perchart else None
            if natal_moon is not None and moon is not None:
                n_nak = nakshatra_from_lon(natal_moon.lon)['index']
                q_nak = nakshatra_from_lon(moon.lon)['index']
                block['taraBala'] = tara_bala(n_nak, q_nak)
                from astrostudy.india.gochara import house_from
                h = house_from(natal_moon.sign, moon.sign)
                block['chandraBala'] = {'house': h,
                                        'good': h in good_houses_for(const.MOON)}
            else:
                block['taraBala'] = None
                block['chandraBala'] = None
            return block
        except Exception:
            traceback.print_exc()
            return {'available': False, 'reason': 'parashari_block_error'}

    def _prashna_tajika_block(self, qkernel, matter, data):
        """Tājika 问事(§25.2):Lagna 主 × 事项主 Ithasala/Eesarpha + 高阶 Yoga +
        类别 Saham(只用 SAHAM_DEFS 既有键)。⚠ SEVEN_PLANETS 不含罗计(既有口径)。"""
        try:
            from astrostudy.india import tajaka as tj
            from astrostudy.india.jyotish_engine import safe_get
            from astrostudy.india import prashna as pr
            from flatlib import const
            asc = safe_get(qkernel.chart, const.ASC)
            if asc is None:
                return {'available': False, 'reason': 'missing_lagna'}
            lons = {}
            signs = {}
            for oid in tj.SEVEN_PLANETS:
                o = safe_get(qkernel.chart, oid)
                if o is not None:
                    lons[oid] = float(o.lon)
                    signs[oid] = o.sign
            retro = _retro_flags(qkernel.chart, tj.SEVEN_PLANETS)
            lagna_sign_no = int(float(asc.lon) // 30.0) % 12
            lagna_lord = tj.SIGN_LORD.get(const.LIST_SIGNS[lagna_sign_no])
            grp = pr.PRASHNA_HOUSE_GROUPS.get(matter) or pr.PRASHNA_HOUSE_GROUPS['general']
            primary = data.get('prashnaPrimaryHouse') or grp['primary']
            try:
                primary = int(primary)
            except (TypeError, ValueError):
                primary = grp['primary']
            karya_sign_no = (lagna_sign_no + primary - 1) % 12
            karya_lord = tj.SIGN_LORD.get(const.LIST_SIGNS[karya_sign_no])
            block = {'available': True, 'frame': 'page',
                     'lagnaLord': lagna_lord, 'karyaLord': karya_lord,
                     'primaryHouse': primary,
                     'note': 'Tājika 分块不含罗计(SEVEN_PLANETS 既有口径)'}
            if lagna_lord in lons and karya_lord in lons:
                if lagna_lord == karya_lord:
                    block['ithasala'] = None
                    block['selfLordNote'] = 'Lagna 主即事项主(同曜),Ithasala 不适用 → 看其力量与位置'
                else:
                    block['ithasala'] = tj.ithasala_detail(
                        lagna_lord, lons[lagna_lord], karya_lord, lons[karya_lord],
                        retro.get(lagna_lord, False), retro.get(karya_lord, False))
                try:
                    # 生产方形状:{'nakta'|'yamaya': [{a,b,via}], 'kamboola': [{pair:[a,b], moonWith}]}
                    block['higherYogas'] = tj.higher_yogas_for_pair(
                        tj.detect_higher_yogas(signs, lons, retro), lagna_lord, karya_lord)
                except Exception:
                    traceback.print_exc()
                    block['higherYogas'] = None
                    _note_partial(block, 'higherYogas')
            else:
                block['ithasala'] = None
            # 类别 → Saham(只用既有键;通用=karyasiddhi 事成点)
            saham_key = {'marriage': 'vivaha', 'wealth': 'artha', 'children': 'putra',
                         'career': 'karma', 'illness': 'roga', 'travel': 'paradesa',
                         'general': 'karyasiddhi'}.get(matter, 'karyasiddhi')
            try:
                day_birth = bool(getattr(qkernel, 'isDiurnal', True))
                sahams = tj.all_sahams(lons, float(asc.lon),
                                       const.LIST_SIGNS[lagna_sign_no], day_birth)
                block['saham'] = dict(sahams.get(saham_key) or {}, key=saham_key)                     if isinstance(sahams, dict) else None
            except Exception:
                traceback.print_exc()
                block['saham'] = None
                _note_partial(block, 'saham')
            return block
        except Exception:
            traceback.print_exc()
            return {'available': False, 'reason': 'tajika_block_error'}

    def _tithi_pravesh_kernel(self, data, natal_perchart, day_kernel, tajaka_year):
        """Tithi Pravesh 时刻求根 → (年盘 kernel, 'YYYY-MM-DD HH:MM:SS')。失败 None。
        elong 对岁差不敏感(Moon−Sun 同减抵消),求根在日盘 kernel 的 sidereal 上下文内
        走 fswe.sweObjectLon 轻量路径(不逐候选建盘)。"""
        try:
            import datetime as _dt
            from astrostudy.india.tajaka import tithi_pravesh_moment
            from astrostudy.india.jyotish_engine import safe_get
            from flatlib import const
            from flatlib.ephem import swe as fswe
            n_sun = safe_get(natal_perchart.chart, const.SUN)
            n_moon = safe_get(natal_perchart.chart, const.MOON)
            if not n_sun or not n_moon:
                return None
            natal_elong = (float(n_moon.lon) - float(n_sun.lon)) % 360.0
            anchor_jd = day_kernel.dateTime.jd

            def elong_fn(jd):
                try:
                    m = fswe.sweObjectLon(const.MOON, jd)
                    su = fswe.sweObjectLon(const.SUN, jd)
                    return (float(m) - float(su)) % 360.0
                except Exception:
                    return None

            with day_kernel.chart._siderealContext():
                root_jd, err = tithi_pravesh_moment(elong_fn, natal_elong, anchor_jd)
            if root_jd is None:
                return None
            zone_hours = _zone_hours_of(data.get('zone'))
            # 儒略日 → 当地民用时刻:在儒略日数轴上加减(CivilDateTime),1582 年以前出儒略历标签、
            # 公元前带符号;1582-10-15 以后与旧的 datetime(2000,1,1,12) + timedelta 逐位相同。
            local_dt = (CivilDateTime.from_jdn(2451545, 12 * 3600)
                        + _dt.timedelta(days=root_jd - 2451545.0)
                        + _dt.timedelta(hours=zone_hours))
            d = _derived_kernel_data(data, _civil_slash(local_dt), local_dt.strftime('%H:%M:%S'))
            return IndiaChartKernel(d), local_dt.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            traceback.print_exc()
            return None

    @staticmethod
    def _natal_mudda_inputs(natal_jyotish):
        """本命 Vimshottari 首运曜 key + 月宿未走比(Mudda 年内大运两入参;此前生产从不传 → 页面卡/AI 段/报告段全指向恒不存在的输出)。"""
        try:
            vim = ((natal_jyotish or {}).get('dasha') or {}).get('vimshottari') or {}
            lord = vim.get('firstLord') or {}
            key = lord.get('key') if isinstance(lord, dict) else lord
            nak = vim.get('moonNakshatra') or {}
            ratio = nak.get('remainingRatio', nak.get('progress')) if isinstance(nak, dict) else None
            ratio = float(ratio) if ratio is not None else None
            if ratio is not None and not (0.0 <= ratio <= 1.0):
                ratio = None
            return (key if key else None), ratio
        except Exception:
            return None, None

    def _compute_tajaka(self, data, natal_perchart, natal_jyotish=None, errs=None):
        """年度盘(太阳回归到本命太阳经度，tajakaYear)→ build_tajaka。仅 tajakaYear 提供时算。
        回归时刻用同日线性逼近(太阳约 0.0411°/h)；精确求根为后续。"""
        try:
            tajaka_year = data.get('tajakaYear')
            if not tajaka_year:
                # 与过运盘同口径：未显式指定时默认当前公历年(服务器侧轻量补算，免依赖 Java 透传)。
                import datetime as _dt
                tajaka_year = _dt.datetime.now().year
            tajaka_year = int(tajaka_year)
            from astrostudy.india.tajaka import build_tajaka
            from astrostudy.india.jyotish_engine import safe_get
            from flatlib import const
            natal_sun = safe_get(natal_perchart.chart, const.SUN)
            natal_asc = safe_get(natal_perchart.chart, const.ASC)
            if not natal_sun or not natal_asc:
                return None
            # 本命日期经 parse_civil_date:'/' '-' 两种分隔、公元前负号 / ad=-1 都认。
            # 年龄 = 两个天文年之差(公元前 300 年 → 天文年 -299;跨公元元年无 0 年,天文年相减自然少一)。
            birth_astro, month, day = parse_civil_date(data.get('date', ''), data.get('ad', 1))
            age_years = astro_year(tajaka_year) - birth_astro
            target = float(natal_sun.lon)

            # 年盘地点开关:出生地(默认)/居住地——varshaLat/varshaLon 覆盖仅影响年盘
            # Lagna/宫/Muntha 宫(行星黄经与地点无关);缺省 = 出生地零回归。
            _v_lat = data.get('varshaLat')
            _v_lon = data.get('varshaLon')

            def build_at(time_str, date_str=None):
                d = _derived_kernel_data(data, date_str or format_display_date(tajaka_year, month, day, '/'), time_str)
                if _v_lat is not None and _v_lon is not None:
                    d['lat'] = _v_lat
                    d['lon'] = _v_lon
                return IndiaChartKernel(d)

            annual_type = str(data.get('annualChartType') or 'varsha')
            kernel = build_at('12:00:00')
            pravesh_moment = None
            ann_adjusted = False
            if annual_type == 'tithi':
                # G13 阴历返照(Tithi Pravesh,§15.3):求日月角距回本命值、取最接近生日
                # 那一次(定案口径 A17)。角距对岁差不敏感(同减抵消),求根走 fswe 轻量路径。
                kernel2 = self._tithi_pravesh_kernel(data, natal_perchart, kernel, tajaka_year)
                if kernel2 is not None:
                    kernel, pravesh_moment = kernel2
                else:
                    annual_type = 'varsha'      # 求根失败 → 回落太阳返照并如实标注
            if annual_type == 'varsha':
                # 太阳返照求根(允许跨日 + 2/29 平年归一;此前 clamp 当日边界可偏数宫)
                ret_dt, ann_adjusted = self._solar_return_moment(
                    lambda ds, ts: build_at(ts, ds), tajaka_year, month, day, target)
                kernel = build_at(ret_dt.strftime('%H:%M:%S'), _civil_slash(ret_dt))
            ids = [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN]
            annual_positions = {}
            for oid in ids:
                o = safe_get(kernel.chart, oid)
                if o:
                    annual_positions[oid] = {'sign': o.sign, 'lon': o.lon}
            aasc = safe_get(kernel.chart, const.ASC)
            if not aasc:
                return None
            # T-27:年度 Tājika 的昼夜取**年盘(年首时刻)**的昼夜,不是本命盘的(build_tajaka docstring「年首是否在昼」;
            # 约半数年份 Saham 昼夜式 / Harsha / Triraasi / 年主候选①因此取反)。年盘 kernel 缺该属性才回落本命。
            day_birth = bool(getattr(kernel, 'isDiurnal', getattr(natal_perchart, 'isDiurnal', True)))
            node_positions = {}
            for oid in (const.NORTH_NODE, const.SOUTH_NODE):
                o = safe_get(kernel.chart, oid)
                if o:
                    node_positions[oid] = {'sign': o.sign, 'lon': o.lon}
            _mk, _mr = self._natal_mudda_inputs(natal_jyotish)
            res = build_tajaka(annual_positions, natal_asc.sign, aasc.lon, age_years, day_birth,
                               # 年盘七曜逆行 → 两两 / 高阶 Ithasala 的入相 / 离相(快曜逆行反判);此前从不传 = 恒按顺行
                               retro=_retro_flags(kernel.chart, ids),
                               node_positions=node_positions,
                               natal_first_vimshottari_key=_mk, natal_moon_remaining_ratio=_mr,
                         variants=data.get('dashaVariants'))
            if isinstance(res, dict):
                res['tajakaYear'] = tajaka_year
                res['annualType'] = annual_type
                if ann_adjusted:
                    res['anniversaryAdjusted'] = '2/29 生日平年:以 2/28 同时刻为种子求真返照(实际时刻见 varshaMoment,常落 3/1)'
                if pravesh_moment:
                    res['praveshMoment'] = pravesh_moment
                if str(data.get('annualChartType') or 'varsha') == 'tithi' and annual_type == 'varsha':
                    res['annualTypeNote'] = '阴历返照求根失败,已回落太阳返照'
            return res
        except Exception:
            traceback.print_exc()
            _note_partial(errs, 'tajaka')
            return None
