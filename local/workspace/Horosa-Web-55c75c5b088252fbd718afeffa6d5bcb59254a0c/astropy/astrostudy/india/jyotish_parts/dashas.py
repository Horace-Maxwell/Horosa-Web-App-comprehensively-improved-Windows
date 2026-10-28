"""JyotishEngine 的大运族方法(由 jyotish_engine.py 整段搬出;JyotishEngine 类仍在 astrostudy.india.jyotish_engine,经继承取得)。"""
from datetime import datetime, timedelta
from flatlib import const
from flatlib.ephem import eph
from astrostudy.india.yoga_engine import safe_get
from astrostudy.india.primitives import chara_karakas, KARAKA_PLANETS, SIGN_CN, segment_index
from astrostudy.nakshatra import nakshatra_from_lon
from astrostudy.india.jyotish_parts.tables import (
    JYOTISH_PLANETS, DASHA_SEQUENCE, YOGINI_SEQUENCE, YOGINI_TOTAL, ASHTOTTARI_SEQUENCE, ASHTOTTARI_TOTAL,
    ASHTOTTARI_NAK_LORD, ASHTOTTARI_ARC, ASHTOTTARI_ARC_KRITTIKADI, ASHTOTTARI_NAK_LORD_KRITTIKADI,
    ashtottari_arc_remaining, NAISARGIKA_ORDER, MULA_MT_SIGN, MULA_VIMS_YEARS, _ODD_FOOTED_SIGNS,
)
from astrostudy.india.jyotish_parts.helpers import (
    get_local_birth_datetime, format_dt, dasha_lord, zone_offset_minutes, iso_with_zone, now_at_zone,
)


def vimshottari_sub_periods(parent_lord, start, parent_days, max_depth, year_days, iso=None):
    """Vimshottari 子运(antar → pratyantar …)纯算术单源:本命大运树与「过运 × 大运联动」共用。
    parent_lord = DASHA_SEQUENCE 条目;start = 父段起点(出生地当地墙钟);parent_days = 父段天数;
    iso = datetime → ISO 串(缺省不带时区)。"""
    to_iso = iso or (lambda d: d.isoformat())
    result = []
    lord_index = [x['key'] for x in DASHA_SEQUENCE].index(parent_lord['key'])
    current_start = start
    for i in range(len(DASHA_SEQUENCE)):
        sub_lord = DASHA_SEQUENCE[(lord_index + i) % len(DASHA_SEQUENCE)]
        sub_days = parent_days * sub_lord['years'] / 120.0
        end = current_start + timedelta(days=sub_days)
        item = {
            'lord': sub_lord,
            'start': format_dt(current_start),
            'end': format_dt(end),
            # 精确起讫(到秒,出生地当地时刻 + 出生时区偏移):前端深钻 / 联动按此,不再从「日期 0 点」推。
            'startIso': to_iso(current_start),
            'endIso': to_iso(end),
            'years': sub_days / year_days,
        }
        if max_depth > 2:
            item['pratyantardashas'] = vimshottari_sub_periods(sub_lord, current_start, sub_days, max_depth - 1,
                                                               year_days, iso)
        result.append(item)
        current_start = end
    return result


class DashasMixin:
    """大运族:扩展大运 / 起运点 / 各星宿大运 / 星座大运 / 子运。"""

    def _dasha_zone_minutes(self):
        """出生时区偏移(分钟);段界 ISO 带它,「当前」按出生地当地此刻判。"""
        p = getattr(self, 'd1_perchart', None) or getattr(self, 'perchart', None)
        return zone_offset_minutes(getattr(p, 'zone', None))

    def _iso(self, value):
        return iso_with_zone(value, self._dasha_zone_minutes())

    def _now_local(self):
        return now_at_zone(self._dasha_zone_minutes())

    def extended_dashas(self):
        """补充大运批量(条件型 8 宿系 + Chara Jaimini)。恒 D1。条件不满足仍可查 mahadasha。"""
        try:
            from astrostudy.india.dasha_extended import build_extended_dashas
            if not self.d1_asc or not self.d1_moon:
                return {'available': False}
            planet_signs, planet_lons = {}, {}
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(self.d1_chart, obj_id)
                if obj:
                    planet_signs[obj_id] = obj.sign
                    planet_lons[obj_id] = obj.lon
            seed_lon = self._dasha_seed_lon()  # 大运起点(默认 D1 月宿,可选七政/虚点)
            moon_lon = float(seed_lon if seed_lon is not None else self.d1_moon.lon)
            mk = nakshatra_from_lon(moon_lon)
            inputs = {
                'lagna_sign': self.d1_asc.sign,
                'planet_signs': planet_signs,
                'planet_lons': planet_lons,
                'moon_lon': moon_lon,
                'moon_nak_index': mk['index'],
                'moon_nak_name': mk['name'],
                'moon_nak_remaining_ratio': mk.get('remainingRatio', mk.get('progress')),
                'conditionContext': self._dasha_condition_context(),
            }
            inputs['year_length_days'] = self.dasha_year_days
            inputs['dashaVariants'] = self.dasha_variants
            return build_extended_dashas(inputs)
        except Exception:
            return {'available': False}

    def _dasha_condition_context(self):
        """补充大运适用条件上下文(尽量算,缺则该系 available:False 仍出 mahadasha)。"""
        ctx = {}
        SIGNS = [const.ARIES, const.TAURUS, const.GEMINI, const.CANCER, const.LEO, const.VIRGO,
                 const.LIBRA, const.SCORPIO, const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES]
        from astrostudy.india.rasi_dasha import SIGN_LORDS
        try:
            ctx['lagna_sign'] = self.d1_asc.sign
            try:
                ctx['is_day'] = bool(self._is_day_birth())    # 视日出 / 日没口径(与六力同源)
            except Exception:
                ctx['is_day'] = None
            if self.d1_moon and self.d1_sun:
                diff = (float(self.d1_moon.lon) - float(self.d1_sun.lon)) % 360.0
                ctx['paksha'] = 'Shukla' if diff < 180.0 else 'Krishna'
            try:
                ctx['weekday'] = self.vedic_weekday()           # 吠陀日(日界 = 日出),0=周日
            except Exception:
                self._note_partial('dashaCondition.weekday')
            d9_idx = segment_index(float(self.d1_asc.lon) % 360.0, 30.0 / 9.0, 108) % 12
            ctx['d9_lagna_sign'] = SIGNS[d9_idx]
            ctx['lagna_is_vargottama'] = (ctx['d9_lagna_sign'] == self.d1_asc.sign)
            # 🔴 条件系缺口根修:Panchottari 读 d12_lagna_sign、Shattrimsha-sama 读 lagna_hora,
            # 此前引擎从不生产这两键 → 两式 available 恒 False(条件恒判不满足)。
            # 分盘换算走 primitives.varga_sign 单源(排盘标准式,D2 恒出 Leo/Cancer)。
            try:
                from astrostudy.india.primitives import varga_sign as _vsign
                ctx['d12_lagna_sign'] = _vsign(self.d1_asc.lon, 12)
                _d2 = _vsign(self.d1_asc.lon, 2)
                ctx['lagna_hora'] = 'Sun' if _d2 == const.LEO else (
                    'Moon' if _d2 == const.CANCER else None)
            except Exception:
                self._note_partial('dashaCondition.vargaLagna')
            if self.d1_sun:
                ctx['sun_in_lagna'] = (self.d1_sun.sign == self.d1_asc.sign)
            lidx = SIGNS.index(self.d1_asc.sign)
            tenth_sign = SIGNS[(lidx + 9) % 12]
            tenth_lord = SIGN_LORDS.get(tenth_sign)
            lagna_lord = SIGN_LORDS.get(self.d1_asc.sign)

            def _house_of(planet_id):
                o = safe_get(self.d1_chart, planet_id)
                if not o:
                    return None
                return ((SIGNS.index(o.sign) - lidx) % 12) + 1
            if tenth_lord:
                ctx['tenth_lord_in_tenth'] = (_house_of(tenth_lord) == 10)
            if lagna_lord:
                ctx['lagna_lord_in_1_or_7'] = (_house_of(lagna_lord) in (1, 7))
        except Exception:
            # 条件上下文缺键 = 依赖它的大运体系判「条件不满足」:落账,不静默
            self._note_partial('dashaCondition')
        return ctx

    def _dasha_seed_lon(self):
        """大运起点黄经:默认 D1 月亮宿(seed='moon');可改取七政/节点/上升/特殊上升/副星(虚点)
        任一点。虚点不可用(极地/求根失败)优雅回退月亮,绝不让大运因起点缺失而 unavailable。"""
        seed = getattr(self, 'dasha_seed', 'moon') or 'moon'
        default_lon = getattr(self.d1_moon, 'lon', None)
        if seed == 'moon':
            return default_lon
        PLANET_SEED = {
            'sun': const.SUN, 'mars': const.MARS, 'mercury': const.MERCURY,
            'jupiter': const.JUPITER, 'venus': const.VENUS, 'saturn': const.SATURN,
            'rahu': const.NORTH_NODE, 'ketu': const.SOUTH_NODE,
        }
        try:
            if seed in ('asc', 'lagna'):
                return getattr(self.d1_asc, 'lon', default_lon)
            if seed in PLANET_SEED:
                o = safe_get(self.d1_chart, PLANET_SEED[seed])
                v = getattr(o, 'lon', None) if o else None
                return v if v is not None else default_lon
            # 虚点:取 upagraha() 输出对应点黄经(特殊上升 / 时基副星 / 日基副星)。
            up = self.upagraha() or {}
            SL_MAP = {'bhavalagna': 'bhavaLagna', 'horalagna': 'horaLagna',
                      'ghatikalagna': 'ghatikaLagna', 'ghatilagna': 'ghatikaLagna',
                      'sreelagna': 'sreeLagna'}
            sl = up.get('specialLagnas') or {}
            if seed in SL_MAP and isinstance(sl.get(SL_MAP[seed]), dict):
                lon = sl[SL_MAP[seed]].get('lon')
                if lon is not None:
                    return lon
            for bucket in ('timeBased', 'sunBased'):
                for it in (up.get(bucket) or []):
                    if isinstance(it, dict) and str(it.get('key', '')).lower() == seed and it.get('lon') is not None:
                        return it['lon']
        except Exception:
            # 所选起点算不出 → 回退月亮(大运照出),但落账:用户选的起点并未生效
            self._note_partial('dashaSeed')
        return default_lon

    def vimshottari(self):
        birth = get_local_birth_datetime(self.perchart)
        moon_lon = self._dasha_seed_lon()  # 大运起点(默认 D1 月宿,可选七政/虚点)
        if birth is None or moon_lon is None:
            return {
                'available': False,
                'reason': 'birth_date_outside_python_datetime_range',
            }

        moon_nak = nakshatra_from_lon(moon_lon)
        lord = dasha_lord(moon_nak['lord'])
        first_balance_years = lord['years'] * moon_nak['remainingRatio']
        first_elapsed_years = lord['years'] - first_balance_years
        cycle_start = birth - timedelta(days=first_elapsed_years * self.dasha_year_days)
        lord_index = [x['key'] for x in DASHA_SEQUENCE].index(lord['key'])
        current_start = cycle_start
        now = self._now_local()
        # 仅当本体系被选中才算三级 antar/pratyantar(下钻);未选中只出 maha 顶层(省体积)。
        full = (self.dasha_system == 'vimshottari')
        items = []
        current = None
        for i in range(10):
            item_lord = DASHA_SEQUENCE[(lord_index + i) % len(DASHA_SEQUENCE)]
            duration_days = item_lord['years'] * self.dasha_year_days
            current_end = current_start + timedelta(days=duration_days)
            is_active = current_start <= now < current_end
            item = {
                'lord': item_lord,
                'years': item_lord['years'],
                'start': format_dt(current_start),
                'end': format_dt(current_end),
                'startIso': self._iso(current_start),
                'endIso': self._iso(current_end),
                'startAge': (current_start - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'endAge': (current_end - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'birthBalance': i == 0,
                'active': is_active,
            }
            if full:
                # 三级大运(pratyantardasha)全算,使每个大运卡片均可下钻到三级。
                item['antardashas'] = self.dasha_sub_periods(item_lord, current_start, duration_days, 3)
            if is_active:
                current = item
            items.append(item)
            current_start = current_end
        return {
            'available': True,
            'system': 'Vimshottari',
            'yearLengthDays': self.dasha_year_days,
            'moonLongitude': moon_lon,
            'moonNakshatra': moon_nak,
            'firstLord': lord,
            'firstBalanceYears': first_balance_years,
            'firstElapsedYears': first_elapsed_years,
            'cycleStart': format_dt(cycle_start),
            'current': current,
            'mahadashas': items,
        }

    def tribhagi(self):
        """Tribhāgī(三分大运,Vimśottarī ÷3):每曜周期 ÷3,9 曜序绕 3 遍(3×40=120 年,
        对应 Alpa/Madhya/Pūrṇa 短/中/全寿三分)。起运同 Vimśottarī(月宿主),首运余 = 正常 ÷3;
        中运比例尺度不变(AD=MD×AD年/120)。归属 Rath/PVR Rao。零回归:纯新增。"""
        birth = get_local_birth_datetime(self.perchart)
        moon_lon = self._dasha_seed_lon()
        if birth is None or moon_lon is None:
            return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
        moon_nak = nakshatra_from_lon(moon_lon)
        lord = dasha_lord(moon_nak['lord'])
        scale = 1.0 / 3.0
        first_balance_years = lord['years'] * scale * moon_nak['remainingRatio']
        first_elapsed_years = lord['years'] * scale - first_balance_years
        cycle_start = birth - timedelta(days=first_elapsed_years * self.dasha_year_days)
        lord_index = [x['key'] for x in DASHA_SEQUENCE].index(lord['key'])
        current_start = cycle_start
        now = self._now_local()
        # 仅当本体系被选中才算三级 antar/pratyantar(下钻);未选中只出 maha 顶层(省体积)。
        full = (self.dasha_system == 'tribhagi')
        items = []
        current = None
        n = len(DASHA_SEQUENCE)
        BHAGA = ['Alpa（短寿分）', 'Madhya（中寿分）', 'Pūrṇa（全寿分）']
        for i in range(3 * n + 1):                    # 3 遍 ×9 = 27,+首余裕度
            item_lord = DASHA_SEQUENCE[(lord_index + i) % n]
            years = item_lord['years'] * scale
            duration_days = years * self.dasha_year_days
            current_end = current_start + timedelta(days=duration_days)
            is_active = current_start <= now < current_end
            item = {
                'lord': item_lord, 'years': years,
                'start': format_dt(current_start), 'end': format_dt(current_end),
                'startIso': self._iso(current_start), 'endIso': self._iso(current_end),
                'startAge': (current_start - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'endAge': (current_end - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'birthBalance': i == 0, 'active': is_active,
                'bhaga': BHAGA[min(2, i // n)],
            }
            if full:
                item['antardashas'] = self.dasha_sub_periods(item_lord, current_start, duration_days, 3)
            if is_active:
                current = item
            items.append(item)
            current_start = current_end
        return {
            'available': True, 'system': 'Tribhagi', 'yearLengthDays': self.dasha_year_days,
            'totalYears': 120, 'bhagaYears': 40,
            'moonLongitude': moon_lon, 'moonNakshatra': moon_nak, 'firstLord': lord,
            'firstBalanceYears': first_balance_years, 'firstElapsedYears': first_elapsed_years,
            'cycleStart': format_dt(cycle_start), 'current': current, 'mahadashas': items,
            'note': 'Vimśottarī ÷3,9 曜序绕 3 遍=120 年(Alpa/Madhya/Pūrṇa 三分寿)。',
        }

    # AKKG「所主之座」表(双主曜数向近者取;罗=水瓶/计=天蝎共主口径)。
    _AKKG_OWN = {
        const.SUN: (const.LEO,), const.MOON: (const.CANCER,),
        const.MARS: (const.ARIES, const.SCORPIO), const.MERCURY: (const.GEMINI, const.VIRGO),
        const.JUPITER: (const.SAGITTARIUS, const.PISCES), const.VENUS: (const.TAURUS, const.LIBRA),
        const.SATURN: (const.CAPRICORN, const.AQUARIUS),
        const.NORTH_NODE: (const.AQUARIUS,), const.SOUTH_NODE: (const.SCORPIO,),
    }

    def _kendradi_graha_order(self, ref_sign):
        """自 ref_sign 起 kendra(1/4/7/10)→panaphara→apoklima 的 9 曜强度序
        (组内旺庙>平>弱、再度数高;与 Mula 同判;ref 奇象先 panaphara、偶象先 apoklima)。"""
        SIGN_IDX = {sg: i for i, sg in enumerate(const.LIST_SIGNS)}
        ref_idx = SIGN_IDX[ref_sign]
        ents = []
        for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                    const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE]:
            obj = safe_get(self.chart, pid)
            if not obj:
                continue
            si = SIGN_IDX[obj.sign]
            house = ((si - ref_idx) % 12) + 1
            try:
                dig = self.dignity(pid, obj.sign, obj.signlon)
            except Exception:
                dig = 'neutral'
            ents.append({'planet': pid, 'sign': obj.sign, 'house': house, 'dignity': dig,
                         'signlon': float(obj.signlon)})
        KEN, PAN, APO = {1, 4, 7, 10}, {2, 5, 8, 11}, {3, 6, 9, 12}
        ref_odd = ref_sign in {const.ARIES, const.GEMINI, const.LEO, const.LIBRA,
                               const.SAGITTARIUS, const.AQUARIUS}
        groups = [KEN, PAN, APO] if ref_odd else [KEN, APO, PAN]
        DIG_RANK = {'deep_exaltation': 5, 'exaltation': 5, 'moolatrikona': 4,
                    'own_sign': 3, 'neutral': 2, 'debilitation': 1}
        ordered = []
        for g in groups:
            ordered.extend(sorted([x for x in ents if x['house'] in g],
                                  key=lambda en: (-DIG_RANK.get(en['dignity'], 2), -en['signlon'])))
        return ordered

    def tara_dasha(self):
        """Tara 大运(graha):期长 = Vimshottari 年表;排序 = 自 Lagna 的 kendra 行星(按强)
        →panaphara→apoklima;适用 = 至少一行星在 kendra;首运余额 = 起始行星自身宿未行比
        × 首运年;中运同 Vimshottari 比例(序用本强度环)。勿混座基 Tara Lagna(9 年/座)。"""
        from datetime import timedelta
        try:
            if not self.asc:
                return {'available': False, 'reason': 'missing_lagna'}
            birth = get_local_birth_datetime(self.perchart)
            if birth is None:
                return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
            ordered = self._kendradi_graha_order(self.asc.sign)
            if not ordered:
                return {'available': False, 'reason': 'missing_planets'}
            kendra_occupied = any(x['house'] in (1, 4, 7, 10) for x in ordered)
            seq = []
            for x in ordered:
                pid = x['planet']
                row = next((d for d in DASHA_SEQUENCE if d['id'] == pid), None)
                if row:
                    seq.append(dict(row))
            if not seq:
                return {'available': False, 'reason': 'missing_planets'}
            first = seq[0]
            # 大运种子恒 D1(与同块 vimshottari/yogini 的 _dasha_seed_lon 同基准;曾用当前分盘 → 漂移)
            first_obj = safe_get(self.d1_chart, first['id'])
            nak = nakshatra_from_lon(float(first_obj.lon)) if first_obj else None
            remaining = float(nak['remainingRatio']) if nak else 1.0
            res = self._build_periods(seq, 120, first['key'], remaining, birth,
                                      full=False)
            res.update({
                'available': True,
                'system': 'TaraDasha',
                'label': 'Tara 大运(kendra 强度序 · Vimshottari 年表)',
                'applicable': bool(kendra_occupied),
                'applicabilityNote': '至少一行星在 kendra 时适用' if kendra_occupied
                                     else 'kendra 无行星:条件未满足(仍可备览)',
                'totalYears': 120,
                'yearLengthDays': self.dasha_year_days,
                'orderPlanets': [x['planet'] for x in ordered],
                'seedNakshatra': nak,
                'firstLord': first,
            })
            return res
        except Exception:
            return {'available': False, 'reason': 'tara_dasha_failed'}

    def akkg_dasha(self):
        """AKKG(Karaka Kendradi Graha)大运:自 Atmakaraka 所在座起 kendra→panaphara→apoklima
        强度序;期长 = (沿数向数到其所主之座 − 1),自座 = 12,庙旺 +1/落陷 −1,钳 1-12;
        二轮 = 12 − 首轮。双主曜取沿数向较近之主座(口径注明);数向按曜所在座足性(同 Mula)。"""
        from datetime import timedelta
        try:
            birth = get_local_birth_datetime(self.perchart)
            if birth is None:
                return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
            _ak_lons = {}
            for _pid in KARAKA_PLANETS:
                _o = safe_get(self.d1_chart, _pid)   # Chara Karaka 是本命(D1)量
                if _o:
                    _ak_lons[_pid] = _o.lon
            karakas = chara_karakas(_ak_lons, scheme=self.karaka_scheme)
            ak_row = karakas[0] if karakas else None
            ak_id = ak_row.get('planet') if isinstance(ak_row, dict) else None
            ak_obj = safe_get(self.d1_chart, ak_id) if ak_id else None
            if not ak_obj:
                return {'available': False, 'reason': 'missing_atmakaraka'}
            SIGN_IDX = {sg: i for i, sg in enumerate(const.LIST_SIGNS)}
            ordered = self._kendradi_graha_order(ak_obj.sign)
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土',
                  const.NORTH_NODE: '罗', const.SOUTH_NODE: '计'}
            maha = []
            firsts = []
            for x in ordered:
                pid = x['planet']
                si = SIGN_IDX[x['sign']]
                fwd = x['sign'] in _ODD_FOOTED_SIGNS
                best = None
                for own in self._AKKG_OWN.get(pid, ()):
                    oi = SIGN_IDX[own]
                    n = ((oi - si) % 12) + 1 if fwd else ((si - oi) % 12) + 1
                    if best is None or n < best:
                        best = n
                n = best if best is not None else 1
                yrs = 12 if n == 1 else (n - 1)
                dig = x['dignity']
                if dig in ('exaltation', 'deep_exaltation'):
                    yrs += 1
                elif dig == 'debilitation':
                    yrs -= 1
                yrs = max(1, min(12, yrs))
                firsts.append({'planet': pid, 'planetCN': CN[pid], 'sign': x['sign'],
                               'house': x['house'], 'years': yrs, 'count': n, 'dignity': dig})
            YEAR = self.dasha_year_days
            cum = 0.0
            for cycle in (1, 2):
                for f in firsts:
                    yrs = f['years'] if cycle == 1 else (12 if f['years'] == 12 else 12 - f['years'])
                    try:
                        sdt = birth + timedelta(days=cum * YEAR)
                        edt = birth + timedelta(days=(cum + yrs) * YEAR)
                        sd, ed = format_dt(sdt), format_dt(edt)
                    except Exception:
                        sd = ed = None
                    maha.append(dict(f, years=yrs, cycle=cycle, start=sd, end=ed,
                                     startAge=round(cum, 2), endAge=round(cum + yrs, 2)))
                    cum += yrs
            return {
                'available': True,
                'system': 'AKKG',
                'label': 'Karaka Kendradi Graha(AK 播种)',
                'atmakaraka': ak_id,
                'seedSign': ak_obj.sign,
                'yearLengthDays': YEAR,
                'mahadashas': maha,
                'note': '年=(数到所主之座−1)·自座12·庙旺±1·钳1-12;二轮=12−首轮(12 仍 12);双主取沿数向近者',
            }
        except Exception:
            return {'available': False, 'reason': 'akkg_failed'}

    def mula_dasha(self):
        """Mūla(=Lagna Kendrādi Graha)大运。期长:N=曜数到其本三角座(奇足座顺/偶足座逆,含端);
        Reduction=(N−1)+E(庙旺+1/落陷−1);Mūla 年=Vimśottarī 年−Reduction(0→满,负→绝对值)。
        序:最强被占 kendra(1/4/7/10)起 → panaphara/apoklima(Lagna 奇先 panaphara、偶先 apoklima);
        组内强者先(旺>庙>平>弱,再度数高)。二轮补足 120(各曜 Vimśottarī−首轮)。归属 Rath/Sārāvalī。"""
        try:
            from datetime import timedelta
            if not self.asc:
                return {'available': False, 'reason': 'missing_lagna'}
            birth = get_local_birth_datetime(self.perchart)
            lagna = self.asc.sign
            SIGN_IDX = {s: i for i, s in enumerate(const.LIST_SIGNS)}
            lagna_idx = SIGN_IDX[lagna]
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土',
                  const.NORTH_NODE: '罗', const.SOUTH_NODE: '计'}
            ents = []
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                        const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE]:
                obj = safe_get(self.d1_chart, pid)   # Mūla 座位判据恒 D1(与兄弟系同基准)
                if not obj:
                    continue
                si = SIGN_IDX[obj.sign]
                mi = SIGN_IDX[MULA_MT_SIGN[pid]]
                n = ((mi - si) % 12) + 1 if obj.sign in _ODD_FOOTED_SIGNS else ((si - mi) % 12) + 1
                try:
                    dig = self.dignity(pid, obj.sign, obj.signlon)
                except Exception:
                    dig = 'neutral'
                e = 1 if dig in ('exaltation', 'deep_exaltation') else (-1 if dig == 'debilitation' else 0)
                yrs = MULA_VIMS_YEARS[pid] - ((n - 1) + e)
                yrs = MULA_VIMS_YEARS[pid] if yrs == 0 else (abs(yrs) if yrs < 0 else yrs)
                house = ((si - lagna_idx) % 12) + 1
                ents.append({'planet': pid, 'planetCN': CN[pid], 'sign': obj.sign,
                             'signLabel': SIGN_CN.get(obj.sign, obj.sign), 'house': house,
                             'years': yrs, 'count': n, 'adjust': e, 'dignity': dig,
                             'signlon': float(obj.signlon)})
            KEN, PAN, APO = {1, 4, 7, 10}, {2, 5, 8, 11}, {3, 6, 9, 12}
            lagna_odd = lagna in {const.ARIES, const.GEMINI, const.LEO, const.LIBRA, const.SAGITTARIUS, const.AQUARIUS}
            groups = [KEN, PAN, APO] if lagna_odd else [KEN, APO, PAN]
            DIG_RANK = {'deep_exaltation': 5, 'exaltation': 5, 'moolatrikona': 4,
                        'own_sign': 3, 'neutral': 2, 'debilitation': 1}
            ordered = []
            for g in groups:
                ordered.extend(sorted([e for e in ents if e['house'] in g],
                                      key=lambda en: (-DIG_RANK.get(en['dignity'], 2), -en['signlon'])))
            maha = []
            cum = [0.0]
            YEAR = self.dasha_year_days

            def _emit(items, rnd, yfn):
                for en in items:
                    y = yfn(en)
                    if birth is not None:
                        try:
                            s = format_dt(birth + timedelta(days=cum[0] * YEAR))
                            e2 = format_dt(birth + timedelta(days=(cum[0] + y) * YEAR))
                        except Exception:
                            s = e2 = None
                    else:
                        s = e2 = None
                    maha.append({'planet': en['planet'], 'planetCN': en['planetCN'],
                                 'sign': en['sign'], 'signLabel': en['signLabel'], 'house': en['house'],
                                 'years': round(y, 3), 'round': rnd, 'start': s, 'end': e2})
                    cum[0] += y
            _emit(ordered, 1, lambda en: en['years'])
            _emit(ordered, 2, lambda en: max(0.0, MULA_VIMS_YEARS[en['planet']] - en['years']))
            return {'available': True, 'system': 'Mula', 'totalYears': 120, 'lagna': lagna,
                    'order': [e['planetCN'] for e in ordered], 'mahadashas': maha,
                    'note': 'Mūla=Lagna Kendrādi Graha;期长由数到本三角座±庙旺得;二轮补足 120(Sārāvalī 系)。'}
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def sudarshana_chakra_dasha(self):
        """Sudarśana Chakra 大运(BPHS76):每宫 1 太阳年、12 年循环;三同心轮自 太阳(SL 灵)/月(CL 心)/
        上升(JL 身)并行,各每年顺行 1 宫。第 n 年活跃宫=((n−1)%12)+1,三处并读(全 3 合→最强)。
        固定-Lagna 标准式(近 Hellenistic Annual Profections)。"""
        try:
            # 三轮起点恒 D1(日/月/上升皆本命量;曾用当前分盘 → 切分盘时三轮整体漂移)
            if not (self.d1_sun and self.d1_moon and self.d1_asc):
                return {'available': False, 'reason': 'missing_sun_moon_or_lagna'}
            SIGN_IDX = {s: i for i, s in enumerate(const.LIST_SIGNS)}
            sun_i = SIGN_IDX[self.d1_sun.sign]
            moon_i = SIGN_IDX[self.d1_moon.sign]
            lag_i = SIGN_IDX[self.d1_asc.sign]
            cur_year = None
            birth = get_local_birth_datetime(self.perchart)
            if birth is not None:
                try:
                    age = (self._now_local() - birth).total_seconds() / 86400.0 / self.dasha_year_days
                    cur_year = (int(age) % 12) + 1
                except Exception:
                    cur_year = None
            rows = []
            for n in range(1, 13):
                h = (n - 1) % 12
                sl = const.LIST_SIGNS[(sun_i + h) % 12]
                cl = const.LIST_SIGNS[(moon_i + h) % 12]
                jl = const.LIST_SIGNS[(lag_i + h) % 12]
                rows.append({
                    'year': n,
                    'sl': sl, 'slLabel': SIGN_CN.get(sl, sl),
                    'cl': cl, 'clLabel': SIGN_CN.get(cl, cl),
                    'jl': jl, 'jlLabel': SIGN_CN.get(jl, jl),
                    'current': (n == cur_year),
                })
            return {
                'available': True, 'system': 'SudarshanaChakra', 'cycleYears': 12,
                'currentYear': cur_year, 'rows': rows,
                'wheels': {'SL': '太阳(灵)', 'CL': '月(心)', 'JL': '上升(身)'},
                'note': '每宫 1 太阳年、12 年循环;三轮(日 SL/月 CL/升 JL)并读,全 3 合→最强。固定-Lagna 标准式。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def dasha_sub_periods(self, parent_lord, start, parent_days, max_depth):
        return vimshottari_sub_periods(parent_lord, start, parent_days, max_depth, self.dasha_year_days, self._iso)

    def _sub_periods_generic(self, sequence, total_years, parent, start, parent_days, max_depth, start_offset=0):
        """通用子周期(antardasha/pratyantardasha):按所选大运体系的 sequence + total_years 比例细分。
        start_offset：子运起序偏移。Vim/Yogini=0(从本曜起);Ashtottari=1(B3:从下一曜起、末位本曜)。"""
        keys = [x['key'] for x in sequence]
        idx = keys.index(parent['key'])
        cur = start
        out = []
        for j in range(len(sequence)):
            sub = sequence[(idx + start_offset + j) % len(sequence)]
            sub_days = parent_days * sub['years'] / float(total_years)
            end = cur + timedelta(days=sub_days)
            item = {
                'lord': sub,
                'start': format_dt(cur),
                'end': format_dt(end),
                'startIso': self._iso(cur),
                'endIso': self._iso(end),
                'years': sub_days / self.dasha_year_days,
            }
            if max_depth > 2:
                item['pratyantardashas'] = self._sub_periods_generic(sequence, total_years, sub, cur, sub_days, max_depth - 1, start_offset)
            out.append(item)
            cur = end
        return out

    def _build_periods(self, sequence, total_years, start_key, remaining_ratio, birth, start_offset=0, full=True):
        """通用大运表(Yogini/Ashtottari 共用,与 vimshottari 同口径):起始曜+月宿余比 → 主运序列 + 子周期。
        覆盖 120 年(含多轮循环,如 Yogini 36 年需 ~3 轮);full=True 时三级 pratyantardasha 对所有主运全算(均可下钻),
        full=False 时只出 maha 顶层(省 antar/pratyantar 体积,未选中体系用)。maha 层两者字节一致。
        start_offset 透传给子周期(Ashtottari=1，子运从下一曜起)。"""
        keys = [x['key'] for x in sequence]
        start_idx = keys.index(start_key)
        start_item = sequence[start_idx]
        first_balance = start_item['years'] * remaining_ratio
        first_elapsed = start_item['years'] - first_balance
        cycle_start = birth - timedelta(days=first_elapsed * self.dasha_year_days)
        now = self._now_local()
        horizon = birth + timedelta(days=120 * self.dasha_year_days)
        cur = cycle_start
        items = []
        current = None
        i = 0
        while cur < horizon and i < 60:
            it = sequence[(start_idx + i) % len(sequence)]
            duration_days = it['years'] * self.dasha_year_days
            end = cur + timedelta(days=duration_days)
            is_active = cur <= now < end
            item = {
                'lord': it,
                'years': it['years'],
                'start': format_dt(cur),
                'end': format_dt(end),
                'startIso': self._iso(cur),
                'endIso': self._iso(end),
                'startAge': (cur - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'endAge': (end - birth).total_seconds() / 86400.0 / self.dasha_year_days,
                'birthBalance': i == 0,
                'active': is_active,
            }
            if full:
                item['antardashas'] = self._sub_periods_generic(sequence, total_years, it, cur, duration_days, 3, start_offset)
            if is_active:
                current = item
            items.append(item)
            cur = end
            i += 1
        return {
            'cycleStart': format_dt(cycle_start),
            'firstBalanceYears': first_balance,
            'firstElapsedYears': first_elapsed,
            'current': current,
            'mahadashas': items,
        }

    def yogini(self):
        birth = get_local_birth_datetime(self.perchart)
        moon_lon = self._dasha_seed_lon()  # 大运起点(默认 D1 月宿,可选七政/虚点)
        if birth is None or moon_lon is None:
            return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
        nak = nakshatra_from_lon(moon_lon)
        # 起始女神:(月宿序 + 3) mod 8(0→8 Sankata)。
        r = (nak['index'] + 3) % 8
        r = 8 if r == 0 else r
        start = YOGINI_SEQUENCE[r - 1]
        res = self._build_periods(YOGINI_SEQUENCE, YOGINI_TOTAL, start['key'], nak['remainingRatio'], birth,
                                  full=(self.dasha_system == 'yogini'))
        res.update({
            'available': True,
            'system': 'Yogini',
            'totalYears': YOGINI_TOTAL,
            'yearLengthDays': self.dasha_year_days,
            'moonLongitude': moon_lon,
            'moonNakshatra': nak,
            'firstYogini': start,
            'firstLord': start,
        })
        return res

    def ashtottari(self):
        birth = get_local_birth_datetime(self.perchart)
        moon_lon = self._dasha_seed_lon()  # 大运起点(默认 D1 月宿,可选七政/虚点)
        if birth is None or moon_lon is None:
            return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
        nak = nakshatra_from_lon(moon_lon)
        # 子型:Ardradi(默认=现状)/Krittikadi/依 Rahu 位自动(Rahu 自 Lagna 座距 5/9=trikona→Krittikadi,
        # 否则(含 kendra 与其余)→Ardradi;古典另有「从 Lagna 主起算」口径,此处按自 Lagna,注释存档)。
        reckoning = self.dasha_variants.get('ashtottariReckoning', 'ardradi')
        if reckoning == 'auto_by_rahu':
            reckoning = 'ardradi'
            try:
                rahu = safe_get(self.d1_chart, const.NORTH_NODE)
                if rahu is not None and self.d1_asc is not None:
                    dist = (const.LIST_SIGNS.index(rahu.sign) - const.LIST_SIGNS.index(self.d1_asc.sign)) % 12 + 1
                    if dist in (5, 9):
                        reckoning = 'krittikadi'
            except (ValueError, AttributeError, TypeError):
                pass
        krittikadi = (reckoning == 'krittikadi')
        nak_table = ASHTOTTARI_NAK_LORD_KRITTIKADI if krittikadi else ASHTOTTARI_NAK_LORD
        arc_table = ASHTOTTARI_ARC_KRITTIKADI if krittikadi else ASHTOTTARI_ARC
        lord_key = nak_table[(nak['index'] - 1) % 27]
        start = next(x for x in ASHTOTTARI_SEQUENCE if x['key'] == lord_key)
        arc_remaining = ashtottari_arc_remaining(lord_key, moon_lon, arc_table)  # 月在所辖弧的剩余比(非单宿)
        res = self._build_periods(
            ASHTOTTARI_SEQUENCE, ASHTOTTARI_TOTAL, lord_key, arc_remaining, birth, start_offset=1,
            full=(self.dasha_system == 'ashtottari'),
        )  # 子运从下一曜起、末位本曜
        res.update({
            'available': True,
            'system': 'Ashtottari',
            'reckoning': 'Krittikadi' if krittikadi else 'Ardradi',
            'totalYears': ASHTOTTARI_TOTAL,
            'yearLengthDays': self.dasha_year_days,
            'moonLongitude': moon_lon,
            'moonNakshatra': nak,
            'firstLord': start,
        })
        return res

    def naisargika_dasha(self):
        """Naisargika(自然/生命阶段)大运:7 曜固定自然年(总 120)。默认 Varahamihira 成熟序
        (月→火→水→金→木→日→土,年龄段几乎通行)。逐运给年龄段 + 由本命起算的日历起讫;
        子运(antardasha)按 drishti 权重(Sārāvalī/Rath),专门且少实现,暂不出。零回归:纯新增。"""
        from datetime import timedelta
        birth = get_local_birth_datetime(self.perchart)
        if birth is None:
            return {'available': False, 'reason': 'birth_date_outside_python_datetime_range'}
        YEAR = self.dasha_year_days
        # 排序变体(#排序分歧):固定自然序(默认,成长-衰老序,年龄档通行) vs
        # kendra 强度序(BPHS 原则:自月亮起,余曜按自 Lagna 的 kendra→panaphara→apoklima
        # 组序、组内按宫距升序;年数不变只换排序)。
        order_mode = self.dasha_variants.get('naisargikaOrder', 'fixed_natural')
        order_rows = list(NAISARGIKA_ORDER)
        if order_mode == 'kendra_strength' and self.d1_asc is not None:
            try:
                lag_i = const.LIST_SIGNS.index(self.d1_asc.sign)
                def _grp_rank(pid):
                    o = safe_get(self.d1_chart, pid)
                    if not o:
                        return (3, 99)
                    dist = (const.LIST_SIGNS.index(o.sign) - lag_i) % 12 + 1
                    grp = 0 if dist in (1, 4, 7, 10) else (1 if dist in (2, 5, 8, 11) else 2)
                    return (grp, dist)
                moon_row = [r for r in order_rows if r[0] == const.MOON]
                rest = [r for r in order_rows if r[0] != const.MOON]
                rest.sort(key=lambda r: _grp_rank(r[0]))
                order_rows = moon_row + rest
            except (ValueError, AttributeError, TypeError):
                order_rows = list(NAISARGIKA_ORDER)
        periods = []
        cum = 0
        for pid, cn, yrs in order_rows:
            try:
                s = birth + timedelta(days=cum * YEAR)
                e = birth + timedelta(days=(cum + yrs) * YEAR)
                sd, ed = format_dt(s), format_dt(e)
            except Exception:
                sd = ed = None
            periods.append({
                'planet': pid, 'planetCN': cn, 'years': yrs,
                'startAge': cum, 'endAge': cum + yrs, 'start': sd, 'end': ed,
            })
            cum += yrs
        return {
            'available': True, 'mode': 'varahamihira', 'totalYears': 120,
            'orderMode': order_mode,
            'note': ('Varahamihira 成熟序(月→火→水→金→木→日→土);年龄段通行'
                     if order_mode == 'fixed_natural'
                     else 'kendra 强度序(自月亮起,余曜按 kendra→panaphara→apoklima·组内宫距升序;年数不变)'),
            'antardashaNote': '中运按相位加权(对望 1/7·四八位 1/4·强相更高),完整权值表待原典,暂不输出',
            'periods': periods,
        }

    def rasi_dashas(self):
        """Jaimini rasi 大运族(Narayana/Sudasa/Drigdasa/Niryana Shoola/Shoola/Kalachakra)。恒 D1。
        部分逐格序/Kalachakra 全表为权威待补,缺则该体系优雅降级。"""
        from astrostudy.india.rasi_dasha import build_rasi_dashas
        from astrostudy.india.primitives import sign_of_lon
        if not self.d1_asc:
            return {'available': False}
        planet_signs = {}
        planet_lons = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.d1_chart, obj_id)
            if obj:
                planet_signs[obj_id] = obj.sign
                planet_lons[obj_id] = obj.lon
        # planet_lons 供 rasi 大运强弱判据的度数级 tiebreak(双主/seed 比较的终极一级)。
        inputs = {'lagna_sign': self.d1_asc.sign, 'planet_signs': planet_signs,
                  'planet_lons': planet_lons,
                  'sthira_start': getattr(self, 'sthira_start', 'lagna'),
                  'dashaVariants': self.dasha_variants}
        # 新增座运输入:Chakra 昼夜/座主、Navamsa D9 全盘、Varnada VL、Chara 结果(Paryaya 用)。
        try:
            inputs['is_day'] = bool(self._is_day_birth())    # 视日出 / 日没口径(与六力同源)
        except Exception:
            inputs['is_day'] = None
        inputs['lagna_signlon'] = float(getattr(self.d1_asc, 'signlon', 0.0) or 0.0)
        from astrostudy.india.rasi_dasha import SIGN_LORDS as _P_SIGN_LORDS
        _lag_lord = _P_SIGN_LORDS.get(self.d1_asc.sign)
        inputs['lagna_lord_sign'] = planet_signs.get(_lag_lord)
        if self.d1_moon is not None:
            _moon_lord = _P_SIGN_LORDS.get(self.d1_moon.sign)
            inputs['moon_lord_sign'] = planet_signs.get(_moon_lord)
        # D9 全盘(navamsa 座:lon×9 mod 360 与标准 D9 座同构)
        inputs['d9_lagna_sign'] = sign_of_lon((float(self.d1_asc.lon) * 9.0) % 360.0)
        inputs['d9_planet_signs'] = {pid: sign_of_lon((float(l) * 9.0) % 360.0)
                                     for pid, l in planet_lons.items()}
        inputs['d9_planet_lons'] = {pid: (float(l) * 9.0) % 360.0 for pid, l in planet_lons.items()}
        # Varnada Lagna:HL 与 upagraha.special_lagnas 同口径内联(日出回推),再经
        # supplementary_lagna.varnada_lagna 求 VL 座;日出不定(极地)→ 降级 None。
        try:
            from astrostudy.india.supplementary_lagna import varnada_lagna as _vl
            _jd = self.d1_perchart.dateTime.jd
            _sunrise = eph.lastSunrise(_jd, self.d1_perchart.pos.lat, self.d1_perchart.pos.lon)
            _elapsed_min = (_jd - _sunrise) * 1440.0
            _sun_lon = float(self.d1_sun.lon)
            _sun_rise_lon = (_sun_lon - 0.98565 * (_elapsed_min / 1440.0)) % 360.0
            _hl_lon = (_sun_rise_lon + (_elapsed_min / 60.0) * 30.0) % 360.0
            _vl_entry = _vl(self.d1_asc.sign, sign_of_lon(_hl_lon))
            inputs['varnada_lagna_sign'] = (_vl_entry or {}).get('sign')
        except Exception:
            inputs['varnada_lagna_sign'] = None
        # Chara 结果供 Paryaya(直接复算一次轻量 chara;年数序列小)
        try:
            from astrostudy.india.dasha_extended import chara_dasha as _chd
            _dvv = self.dasha_variants
            inputs['chara_result'] = _chd(
                self.d1_asc.sign, planet_signs, planet_lons, with_antardashas=False,
                direction_rule=_dvv.get('charaDirection', 'lagna_parity_sign'),
                dignity_rule=_dvv.get('charaDignity', 'plus_minus_one'))
        except Exception:
            inputs['chara_result'] = None
        if self.d1_moon:
            nak = 360.0 / 27.0
            moon_lon = float(self.d1_moon.lon)
            # Sree Lagna = lagna + 月在本宿进度×360°(内联，免重算 upagraha)。
            sl_lon = (float(self.d1_asc.lon) + ((moon_lon % nak) / nak) * 360.0) % 360.0
            inputs['sree_lagna_sign'] = sign_of_lon(sl_lon)
            inputs['sree_lagna_signlon'] = sl_lon % 30.0
            mk = nakshatra_from_lon(moon_lon)
            inputs['moon_lon'] = moon_lon
            # 月亮 D9(navamsa)座:Kalachakra 适用条件变体(#月navamsa强于rasi)判据输入。
            inputs['moon_d9_sign'] = sign_of_lon((moon_lon * 9.0) % 360.0)
            inputs['moon_nak_name'] = mk['name']
            inputs['moon_pada'] = mk['pada']
            inputs['moon_nak_progress'] = mk['progress']
        # AK 优先判据须知道 Chara Kāraka 方案(7 卡拉卡=剔罗睺):此前 rasi_dasha 恒按 8 曜含罗睺取 AK。
        inputs['karakaScheme'] = self.karaka_scheme
        try:
            return build_rasi_dashas(inputs)
        except Exception:
            return {'available': False}
