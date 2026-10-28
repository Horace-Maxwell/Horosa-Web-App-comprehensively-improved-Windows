import contextlib
import math
import os
import threading
import traceback

import swisseph
from flatlib import const
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import angle
from flatlib.dignities import essential
from flatlib.protocols.temperament import Temperament

from astrostudy.perchart import PerChart, push_request_terms, pop_request_terms, parse_terms_variant, push_classical_request, pop_classical_request
from astrostudy.perpredict import dateSolarReturn, dateLunarReturn
from astrostudy.thirteenthchart import HarmonicChart, DraconicChart
from astrostudy.astroextra_parts.common import (
    PLANET_SWISS_IDS, DEFAULT_EVENT_PLANETS, DEFAULT_NATAL_POINTS, MAJOR_ASPECTS, SIGN_ELEMENTS, SIGN_MODES,
    HOUSE_SCORES, DIGNITY_SCORES, norm360, norm180, angle_distance, signed_aspect_delta, safe_float, to_bool,
    zone_value, geo_to_degree, base_params, dt_from_data, date_time_from_jd, chart_params_from_jd, CENTER_FLAGS,
    center_flag, _SWE_LON_MEMO_ON, _SWE_LON_TL, swe_lon_memo_begin, swe_lon_memo_end, swe_lon_memo, swe_lon, sign_index,
    sign_name_from_lon, object_to_dict, chart_points, find_aspect,
)
from astrostudy.astroextra_parts.calendars import (
    _DAY_RULER_BY_DOW, _CHALDEAN_DESC, compute_planetary_hours, _BABYLON_NORMAL_STARS, _BABYLON_CUBIT_DEG,
    _babylon_star_positions, compute_babylonian_stars, compute_egyptian_calendar,
)
from astrostudy.astroextra_parts.analysis import (
    detect_patterns, _angle_lon, DISTRIBUTION_BODIES, distribution, almuten_table, extra_lots, _LOT_CATEGORY,
    _lot_category, _BEHENIAN_NATURE, _ROYAL_WATCHER, fixed_star_hits, compute_classical_patterns, _wheel_orb,
    compute_accidental_dignity, compute_bonification, _PTOL, _PTOL_CN, compute_aspect_dynamics, _TOPIC_HOUSES,
    compute_topic_almuten, analyze_chart, _analyze_chart_inner,
)
from astrostudy.astroextra_parts.ephemeris import (
    refine_crossing, calc_ingresses, calc_stations, moon_sun_elongation, calc_lunar_phases, eclipse_type, _eclipse_band,
    _syzygy_near, _calc_eclipses_inner, calc_eclipses, calc_daily_positions, calc_rise_set, calc_phenomena,
    calc_heliacal, compute_eclipse_detail,
)
from astrostudy.astroextra_parts.progressions import (
    progression_date, aspects_between, build_progressions, DECLINATION_BODIES, swe_decl, _decls_at, decl_parallels,
    build_declination_progressions, build_return_timeline, build_harmonic, build_relocation, compute_prenatal_syzygy,
    build_draconic,
)
from astrostudy.astroextra_parts.cycles import (
    _int_arg, _float_arg, compute_great_conjunctions, _SWE_PLANET_BY_NAME, _MEAN_PERIOD_DAYS, compute_planet_cycles,
    compute_barbault, compute_planet_return,
)
from astrostudy.astroextra_parts.relative import (
    RELATIVE_ASPECT_WEIGHT, RELATIVE_BODY_WEIGHT_DEFAULT, RELATIVE_BODY_WEIGHT, score_relative_comp,
    build_relative_score,
)


# 星历端点 build_ephemeris 与它的行运触发 calc_transit_aspects 留在门面:两者经本模块的全局名调用
# PerChart / chart_points / swe_lon / calc_* 等(测试按 astroextra.<名> 替换这些名字验证行为),
# 必须与这些名字同住一个模块。


def calc_transit_aspects(base, start_jd, end_jd, zone, planets, natal_points, aspects, max_hits=600, stats=None):
    """行运触发:此前按「星体 → 本命点 → 相位」嵌套序扫描、满 600 条即整体停扫 → 长区间被
    前几颗星(日月水)填满,后面的星 0 条且列表不按时间完整。改为:每颗行运体全窗黄经序列只算一次(各本命点/
    相位共用同一格点,过零判据与细化与此前逐点算法完全同源),全部命中先按时间排序再截前 max_hits 条;
    stats(dict,可选)回填 total/limit/truncated 供页面明示。"""
    try:
        perchart = PerChart(base)
    except Exception:
        return []
    natal = {p['id']: p for p in chart_points(perchart, include_angles=True) if p['id'] in natal_points}
    events = []
    for t_body in planets:
        if t_body not in PLANET_SWISS_IDS:
            continue
        step = 0.25 if t_body == const.MOON else 1.0
        grid = []
        jd = start_jd
        lon0, _, _ = swe_lon(t_body, jd)
        grid.append((jd, lon0))
        while jd < end_jd:
            nxt = min(jd + step, end_jd)
            cur_lon, _, _ = swe_lon(t_body, nxt)
            grid.append((nxt, cur_lon))
            jd = nxt
        for n_id, n_point in natal.items():
            for aspect in aspects:
                target = float(aspect)
                prev = signed_aspect_delta(grid[0][1], n_point['lon'], target)
                for gi in range(1, len(grid)):
                    jd_prev = grid[gi - 1][0]
                    nxt, cur_lon = grid[gi]
                    cur = signed_aspect_delta(cur_lon, n_point['lon'], target)
                    # 有符号角差在对径处 ±180 跳变(合相式在冲位、冲相式在合位)会伪装成变号:真过零两步之差
                    # 远小于 180°(月亮 0.25 日步 <4°、行星 1 日步 <3°),跳变约 360° → 以 |prev-cur|<180 甄别。
                    if ((prev <= 0 <= cur) or (prev >= 0 >= cur)) and abs(prev - cur) < 180.0:
                        def f(x, _b=t_body, _n=n_point['lon'], _t=target):
                            l, _, _ = swe_lon(_b, x)
                            return signed_aspect_delta(l, _n, _t)
                        hit_jd = refine_crossing(f, jd_prev, nxt)
                        hit_lon, hit_speed, _ = swe_lon(t_body, hit_jd)
                        events.append({
                            **date_time_from_jd(hit_jd, zone),
                            'type': 'transit_aspect',
                            'transitBody': t_body,
                            'natalPoint': n_id,
                            'aspect': target,
                            'orb': abs(signed_aspect_delta(hit_lon, n_point['lon'], target)),
                            'lon': hit_lon,
                            'speed': hit_speed,
                            'sign': sign_name_from_lon(hit_lon),
                            'signlon': hit_lon % 30,
                        })
                    prev = cur
    events.sort(key=lambda item: item['jd'])
    total = len(events)
    if max_hits and total > max_hits:
        events = events[:max_hits]
    if isinstance(stats, dict):
        stats['total'] = total
        stats['limit'] = max_hits
        stats['truncated'] = bool(max_hits and total > max_hits)
    return events


def build_ephemeris(data):
    params = base_params(data)
    start_date = data.get('startDate') or data.get('date')
    end_date = data.get('endDate') or start_date
    start_time = data.get('startTime', '00:00:00')
    end_time = data.get('endTime', '23:59:59')
    start_dt = Datetime(start_date, start_time, params.get('zone', '+00:00'))
    end_dt = Datetime(end_date, end_time, params.get('zone', '+00:00'))
    start_jd = start_dt.jd
    end_jd = max(end_dt.jd, start_jd + 1)
    # 三道静默截断(区间 ≤732 天 / 逐日 ≤370 天 / 行运触发 ≤600 条)改为在 params 明示,页面据此提示。
    requested_end_jd = end_jd
    range_limit_days = 732
    daily_limit_days = 370
    if end_jd - start_jd > range_limit_days:
        end_jd = start_jd + range_limit_days
    planets = data.get('planets') or DEFAULT_EVENT_PLANETS
    natal_points = data.get('natalPoints') or DEFAULT_NATAL_POINTS
    aspects = data.get('aspects') or [0, 60, 90, 120, 180]
    include_transits = to_bool(data.get('includeTransits'), True)
    transit_stats = {}
    transit_aspects = calc_transit_aspects(params, start_jd, end_jd, params.get('zone', '+00:00'), planets, natal_points, aspects, stats=transit_stats) if include_transits else []
    daily_days = int(math.floor(end_jd - start_jd)) + 1
    return {
        'params': {
            'startDate': date_time_from_jd(start_jd, params.get('zone', '+00:00')),
            'endDate': date_time_from_jd(end_jd, params.get('zone', '+00:00')),
            'planets': planets,
            'natalPoints': natal_points,
            'aspects': aspects,
            'limits': {
                'rangeDays': range_limit_days,
                'rangeTruncated': requested_end_jd > end_jd,
                'requestedEndDate': date_time_from_jd(requested_end_jd, params.get('zone', '+00:00')),
                'dailyDays': daily_limit_days,
                'dailyTruncated': daily_days > daily_limit_days,
                'transitLimit': transit_stats.get('limit', 600),
                'transitTotal': transit_stats.get('total', len(transit_aspects)),
                'transitTruncated': bool(transit_stats.get('truncated', False)),
            },
        },
        'dailyPositions': calc_daily_positions(start_jd, end_jd, params.get('zone', '+00:00'), planets, max_days=daily_limit_days),
        'ingresses': calc_ingresses(start_jd, end_jd, params.get('zone', '+00:00'), planets),
        'stations': calc_stations(start_jd, end_jd, params.get('zone', '+00:00'), planets),
        'lunarPhases': calc_lunar_phases(start_jd, end_jd, params.get('zone', '+00:00')),
        'eclipses': calc_eclipses(start_jd, end_jd, params.get('zone', '+00:00'), data.get('eclipseTimeMode') or 'max'),
        'transitAspects': transit_aspects,
        'riseSet': calc_rise_set(start_jd, params, planets),
        'phenomena': calc_phenomena(start_jd, planets),
        'heliacal': calc_heliacal(start_jd, params, planets),
    }
