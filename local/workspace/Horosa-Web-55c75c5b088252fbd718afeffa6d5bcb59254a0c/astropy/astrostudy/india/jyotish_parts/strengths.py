"""JyotishEngine 的力量族方法(由 jyotish_engine.py 整段搬出;JyotishEngine 类仍在 astrostudy.india.jyotish_engine,经继承取得)。"""
from flatlib import const
from flatlib.ephem import eph
from astrostudy.india.yoga_engine import house_number, safe_get
from astrostudy.india.primitives import PLANET_CN, SIGN_CN, segment_index
from astrostudy.nakshatra import nakshatra_from_lon
from astrostudy.india.jyotish_parts.tables import (
    JYOTISH_PLANETS, BENEFIC_HOUSES, KAKSHYA_LORDS, RASI_GUNAKARA, GRAHA_GUNAKARA,
)
from astrostudy.india.jyotish_parts.helpers import sign_index_from_lon


class StrengthsMixin:
    """力量族:八分法 / 综合强弱 / 六力。"""

    def ashtakavarga(self):
        sign_names = const.LIST_SIGNS
        natal = {}
        for obj_id in [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN]:
            obj = safe_get(self.chart, obj_id)
            if obj:
                natal[obj_id] = sign_index_from_lon(obj.lon)
        if self.asc:
            natal['Lagna'] = sign_index_from_lon(self.asc.lon)
        if len(natal) < 8:
            return {'available': False, 'reason': 'missing_planets'}

        bhinna = {}
        for target, table in BENEFIC_HOUSES.items():
            values = {sign: 0 for sign in sign_names}
            for contributor, houses in table.items():
                source_key = contributor if contributor == 'Lagna' else contributor
                if source_key not in natal:
                    continue
                source_sign = natal[source_key]
                for house in houses:
                    sign = sign_names[(source_sign + house - 1) % 12]
                    values[sign] += 1
            bhinna[target] = values

        sarva = {sign: 0 for sign in sign_names}
        for values in bhinna.values():
            for sign, count in values.items():
                sarva[sign] += count

        # Trikona + Ekadhipatya Sodhana(化减)：各曜 BAV 化减。occupied = 七曜所居星座。
        sodhana_bhinna = {}
        try:
            from astrostudy.india.shadbala_bphs import sodhana as _sodhana
            occupied = sorted({
                natal[p] for p in  # natal[p] 已是星座索引 0-11
                [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN]
                if p in natal
            })
            for target, values in bhinna.items():
                sodhana_bhinna[target] = _sodhana(values, occupied)
        except Exception:
            sodhana_bhinna = {}

        # Kakshya(分区)展开:每曜 BAV 按 8 主管(KAKSHYA_LORDS)逐座是否贡献 bindu(prastara)。
        # 过运判据:行星落某座第 k 段(3°45′),若该段主管对其在该座贡献 bindu 则吉。零回归:新增键。
        kakshya = {}
        try:
            for target in BENEFIC_HOUSES:
                if target == 'Lagna':
                    continue
                grid = []
                for sidx in range(12):
                    cells = []
                    for lord in KAKSHYA_LORDS:
                        houses = BENEFIC_HOUSES[target].get(lord, [])
                        if lord in natal and (((sidx - natal[lord]) % 12) + 1) in houses:
                            cells.append(1)
                        else:
                            cells.append(0)
                    grid.append(cells)
                kakshya[target] = grid
        except Exception:
            kakshya = {}

        # Sodhya Pinda:对削减后(sodhana)BAV 求 RasiPinda + GrahaPinda(P0-6)。
        sodhya_pinda = {}
        try:
            occupants = [p for p in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                                     const.JUPITER, const.VENUS, const.SATURN] if p in natal]
            for target, reduced in sodhana_bhinna.items():
                if target == 'Lagna' or not isinstance(reduced, (list, tuple)) or len(reduced) < 12:
                    continue
                rasi_pinda = sum(reduced[i] * RASI_GUNAKARA[i] for i in range(12))
                graha_pinda = sum(reduced[natal[q]] * GRAHA_GUNAKARA.get(q, 0)
                                  for q in occupants)
                sodhya_pinda[target] = {
                    'rasiPinda': rasi_pinda,
                    'grahaPinda': graha_pinda,
                    'total': rasi_pinda + graha_pinda,
                }
        except Exception:
            sodhya_pinda = {}

        return {
            'available': True,
            'bhinna': bhinna,
            'sodhana': sodhana_bhinna,
            'sarva': sarva,
            'sarvaBySign': [
                {
                    'sign': sign,
                    'label': SIGN_CN.get(sign, sign),
                    'bindu': sarva[sign],
                }
                for sign in sign_names
            ],
            'kakshya': kakshya,
            'kakshyaLords': KAKSHYA_LORDS,
            'sodhyaPinda': sodhya_pinda,
        }

    def _sayanadi_ghati(self):
        """G：日出后的 ghati 序(1 ghati=24 分；日出起第 G 个 24 分段)。

        复用 upagraha()/_time_based_upagrahas() 的日出口径(eph.lastSunrise)。
        日出不定(极地等)或求根失败 → None（则 sayanadi 优雅降级为 None）。
        """
        try:
            jd = self.d1_perchart.dateTime.jd
            lat = self.d1_perchart.pos.lat
            lon = self.d1_perchart.pos.lon
            sunrise_jd = eph.lastSunrise(jd, lat, lon)
            elapsed_minutes = (jd - sunrise_jd) * 1440.0
            return int(elapsed_minutes // 24.0) + 1
        except Exception:
            return None

    def strengths(self):
        from astrostudy.india.primitives import is_combust, baladi_avastha, is_vargottama
        from astrostudy.india.avastha import (
            jagradadi_avastha, deeptadi_avastha, sayanadi_avastha,
            naisargika_karaka_table, sthira_karaka, lajjitadi_avastha)
        from astrostudy.india.primitives import relation_to_sign_lord, SIGN_LORDS as _SL
        # 燃烧恒以 D1(真太阳角距;分盘伪经度无物理意义)。
        sun_lon = getattr(self.d1_sun, 'lon', None)
        # 复合友敌的临时关系按 D1 星座(古法);D1 七曜星座表。
        _d1_signs = {}
        for _pid in JYOTISH_PLANETS:
            _o1 = safe_get(self.d1_chart, _pid)
            if _o1:
                _d1_signs[_pid] = _o1.sign
        _NATURAL_MALEFIC = {const.SUN, const.MARS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE}
        _MALEFIC_LORDS = {const.SUN, const.MARS, const.SATURN}
        _REL3 = {'adhimitra': 'friend', 'mitra': 'friend', 'sama': 'neutral',
                 'satru': 'enemy', 'adhisatru': 'enemy'}
        # Sayanadi 公共项(全曜共用)：M 月宿序、G 出生 ghati、L 上升星座序。恒以 D1 月/上升。
        sayanadi_moon_nak = nakshatra_from_lon(self.d1_moon.lon)['index'] if self.d1_moon else None
        sayanadi_ghati = self._sayanadi_ghati()
        sayanadi_lagna_sign = (
            const.LIST_SIGNS.index(self.d1_asc.sign) + 1 if self.d1_asc else None)
        navamsa_step = 30.0 / 9.0  # 每 navamsa 3°20′
        # Lajjitādi 前置:全曜星座 + 被自然凶曜(日火土罗计)相照的星座集(用各凶曜特殊相)。
        _SIGN_IDX = {s: i for i, s in enumerate(const.LIST_SIGNS)}
        _MALEFIC_ASP = {const.SUN: [7], const.MARS: [4, 7, 8], const.SATURN: [3, 7, 10],
                        const.NORTH_NODE: [5, 7, 9], const.SOUTH_NODE: [5, 7, 9]}
        _all_signs = {}
        for _pid in JYOTISH_PLANETS:
            _o = safe_get(self.chart, _pid)
            if _o:
                _all_signs[_pid] = _o.sign
        _malefic_aspected = set()
        for _mp, _offs in _MALEFIC_ASP.items():
            _ms = _all_signs.get(_mp)
            if _ms is None:
                continue
            _mi = _SIGN_IDX[_ms]
            for _off in _offs:
                _malefic_aspected.add((_mi + _off - 1) % 12)
        planets = []
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if not obj:
                continue
            dignity = self.dignity(obj_id, obj.sign, obj.signlon)
            retro = getattr(obj, 'movedir', None) == 'Retrograde'
            # vargottama = D1 与 D9 同宫，恒以 D1 盘判(与所绘分盘无关)。
            d1_obj = safe_get(self.d1_chart, obj_id)
            combust = bool(sun_lon is not None and d1_obj is not None
                           and is_combust(obj_id, d1_obj.lon, sun_lon, retro))
            # Jagradādi / Dīptādi 情境:对所在座主的复合友敌(临时关系按 D1)、合恶曜、落恶曜座。
            _compound = relation_to_sign_lord(obj_id, obj.sign, _d1_signs)
            _compound = None if _compound == 'self' else _compound
            _conj_mal = any(q in _NATURAL_MALEFIC and q != obj_id and _all_signs.get(q) == obj.sign
                            for q in _all_signs)
            _in_mal_sign = _SL.get(obj.sign) in _MALEFIC_LORDS and _SL.get(obj.sign) != obj_id
            vargottama = bool(d1_obj and is_vargottama(d1_obj.lon, 9))
            # Sayanadi 逐曜项：C 本曜宿序、P=obj_id(函数内映射)、A 本曜星座内 navamsa 序(1-9)。
            sayanadi_nak = nakshatra_from_lon(obj.lon)['index']
            sayanadi_navamsa = segment_index(obj.signlon, navamsa_step, 9) + 1
            planets.append({
                'id': obj_id,
                'label': PLANET_CN.get(obj_id, obj_id),
                'lon': obj.lon,
                'sign': obj.sign,
                'signLabel': SIGN_CN.get(obj.sign, obj.sign),
                'signlon': obj.signlon,
                'house': house_number(obj),
                'motion': getattr(obj, 'movedir', None),
                'retrograde': retro,
                'combust': combust,
                'vargottama': vargottama,
                'baladi': baladi_avastha(obj.sign, obj.signlon),
                'jagradadi': jagradadi_avastha(dignity, relation=_REL3.get(_compound)),
                'deeptadi': deeptadi_avastha(dignity, compound=_compound, combust=combust,
                                             conjunct_malefic=_conj_mal, in_malefic_sign=_in_mal_sign,
                                             khala_rule=self.dasha_variants.get('deeptadiKhala', 'malefic_sign')),
                'sayanadi': sayanadi_avastha(
                    sayanadi_nak, obj_id, sayanadi_navamsa,
                    sayanadi_moon_nak, sayanadi_ghati, sayanadi_lagna_sign),
                'lajjitadi': lajjitadi_avastha(
                    house_number(obj), dignity, obj.sign,
                    {q for q in _all_signs if q != obj_id and _all_signs[q] == obj.sign},
                    _SIGN_IDX[obj.sign] in _malefic_aspected, combust),
                'dignity': dignity,
                'nakshatra': self._nak_with_detail(obj.lon),
            })
        return {
            'planetaryStates': planets,
            'vargaDignity': self.varga_dignity(planets),
            'naisargikaKaraka': naisargika_karaka_table(),
            'sthiraKaraka': sthira_karaka(),
        }

    def _d1_day_window(self):
        """D1 出生时刻的昼夜窗:(is_day, 日出, 日没, 次日出, 上一日没) JD(出生所在吠陀日)。
        昼夜判据 = 视日出 / 日没(与 Tribhaga / Hora / Nathonnatha 同源),不再用几何太阳中心。
        日出求不出(极地)→ None。"""
        cached = getattr(self, '_d1_day_window_cache', None)
        if cached is not None:
            return cached or None
        try:
            p = self.d1_perchart
            jd = p.dateTime.jd
            lat, lon = p.pos.lat, p.pos.lon
            sr = eph.lastSunrise(jd, lat, lon)
            ss = eph.nextSunset(sr, lat, lon)
            nsr = eph.nextSunrise(ss, lat, lon)
            pss = eph.lastSunset(sr, lat, lon)
            if not (pss < sr < ss < nsr):
                raise ValueError('bad window')
            win = (sr <= jd < ss, sr, ss, nsr, pss)
        except Exception:
            win = False
        self._d1_day_window_cache = win
        return win or None

    def _is_day_birth(self):
        """出生昼夜(恒 D1;视日出 / 日没口径)。日出不可得 → 回落内核几何判据。"""
        win = self._d1_day_window()
        if win is not None:
            return bool(win[0])
        return bool(getattr(self.d1_perchart, 'isDiurnal', True))

    def _entered_prev_sign(self, obj_id):
        """Cheshta「反退」(Anuvakra)判据:逆行中且已退回逆行起点所在座的前一座。
        自出生向前逐日回溯到顺行末日(停留点),比较两刻恒星黄经所在座;求不出 → False。"""
        try:
            from flatlib.ephem import swe as fswe
            chart = self.d1_chart
            jd = self.d1_perchart.dateTime.jd
            obj = safe_get(chart, obj_id)
            if obj is None or getattr(obj, 'movedir', None) != 'Retrograde':
                return False
            cur_sign = int(float(obj.lon) // 30.0) % 12
            with chart._siderealContext():
                for k in range(1, 201):
                    r = fswe.sweObject(obj_id, jd - k, chart.flags)
                    if float(r['lonspeed']) > 0:
                        station_sign = int((float(r['lon']) % 360.0) // 30.0) % 12
                        return cur_sign == (station_sign - 1) % 12
            return False
        except Exception:
            return False

    def shadbala_bphs(self):
        """六源六力(Sthana/Dig/Kala/Cheshta/Naisargika/Drik)。

        位置类子项(Sthana / Dig / Drik / Cheshta 速度)随当前显示盘;**时间类子项恒取 D1 出生时刻**:
        昼夜(视日出 / 日没)、Tribhaga、Nathonnatha、Paksha(D1 日月)、Vāra / Hora(吠陀日,日界 = 日出)、
        Abda / Masa(D1 太阳)、Ayana(D1 赤纬)、Yuddha(D1 星战)。"""
        from astrostudy.india import shadbala_bphs as sb
        sun_lon = getattr(self.d1_sun, 'lon', 0.0)
        moon_lon = getattr(self.d1_moon, 'lon', 0.0)
        is_day = self._is_day_birth()
        planets = [const.SUN, const.MOON, const.MARS, const.MERCURY,
                   const.JUPITER, const.VENUS, const.SATURN]
        # 星期主(vara lord)的 const id(panchanga 已按吠陀日)。
        try:
            lord = (self.panchanga().get('vara') or {}).get('lord')
            weekday_lord = lord.get('id') if isinstance(lord, dict) else None
        except Exception:
            weekday_lord = None
        # 全曜 D1 星座(0-based)→ Saptavargaja 复合友谊用；同时备 D1 经度。
        planet_signs = {}
        d1_lons = {}
        for obj_id in planets:
            d1_obj = safe_get(self.d1_chart, obj_id)
            if d1_obj is not None:
                planet_signs[obj_id] = d1_obj.sign            # 星座名(const)
                d1_lons[obj_id] = float(d1_obj.lon)
        tribhaga_index, frac_mid, hora_seq = self._shadbala_time_context(is_day)
        hora_lord = sb.hora_lord_at(self.vedic_weekday(), hora_seq) \
            if hora_seq is not None else None
        year_lord, month_lord = self._shadbala_abda_masa_lords(sun_lon)
        # Dig 连续式所需角点(随显示盘,与 houseFromLagna 同框架)。
        angles = None
        try:
            _asc = self.chart.getAngle(const.ASC)
            _mc = self.chart.getAngle(const.MC)
            angles = {'asc': float(_asc.lon), 'mc': float(_mc.lon)}
        except Exception:
            angles = None
        contexts = {}
        for obj_id in planets:
            obj = safe_get(self.chart, obj_id)
            if not obj:
                continue
            speed = abs(float(getattr(obj, 'lonspeed', 0.0)))
            try:
                mean_speed = float(obj.meanMotion())
            except Exception:
                mean_speed = None
            movedir = getattr(obj, 'movedir', None)
            d1_obj = safe_get(self.d1_chart, obj_id)
            # 被照点:本曜外其余六曜对本曜的 Sphuta Drishti(传各照者真黄经,模块按角差算)。
            aspecting = [(o2, getattr(safe_get(self.chart, o2), 'lon', 0.0))
                         for o2 in planets if o2 != obj_id and safe_get(self.chart, o2)]
            contexts[obj_id] = {
                'lon': obj.lon, 'signlon': obj.signlon,
                'houseFromLagna': house_number(obj),
                'angles': angles,
                'd1Lon': d1_lons.get(obj_id, obj.lon),
                'd1Signlon': (float(d1_lons.get(obj_id, obj.lon)) % 30.0),
                'planetSigns': planet_signs,
                'vargaVariants': self.varga_variant_map,
                'sunLon': sun_lon, 'moonLon': moon_lon,
                'isDay': is_day, 'tribhagaIndex': tribhaga_index,
                'fractionFromMidnight': frac_mid,
                'weekdayLord': weekday_lord, 'horaLord': hora_lord,
                'yearLord': year_lord, 'monthLord': month_lord,
                'declination': getattr(d1_obj if d1_obj is not None else obj, 'decl', None),
                'retrograde': movedir == 'Retrograde',
                'stationary': movedir == 'Stationary',
                'speed': speed, 'meanSpeed': mean_speed,
                'enteredPrevSign': self._entered_prev_sign(obj_id) if movedir == 'Retrograde' else False,
                'aspecting': aspecting,
            }
        try:
            yuddha_pairs = (self.graha_yuddha() or {}).get('pairs') or []
        except Exception:
            yuddha_pairs = []
        try:
            return sb.compute_all(contexts, yuddha_pairs=yuddha_pairs)
        except Exception:
            return {'available': False}

    def _shadbala_time_context(self, is_day):
        """三分时段序(0/1/2)+ 距当地视午夜的时长比(0..0.5 日,供 Nathonnatha)+ 行星时序号(0..23)。

        全按 D1 出生时刻与出生所在吠陀日的视日出 / 日没 / 次日出;失败则回退(段 0、正午、None)。
        """
        try:
            win = self._d1_day_window()
            if win is None:
                # 极昼 / 极夜求不出日出日没:Tribhaga / Hora 仍 pending(段 0 / None),
                # Nathonnatha 改按视太阳时取距视午夜的时长 —— 不依赖日出(此前固定按正午 → 太阳恒 60)。
                return 0, self._apparent_unnata(), None
            _day, sunrise_jd, sunset_jd, next_sunrise_jd, prev_sunset_jd = win
            jd = self.d1_perchart.dateTime.jd
            day_len = sunset_jd - sunrise_jd
            night_len = next_sunrise_jd - sunset_jd
            if is_day:
                frac = (jd - sunrise_jd) / day_len                     # 昼内比例 0..1
                hora_seq = int(frac * 12.0)
            else:
                frac = (jd - sunset_jd) / night_len                    # 夜内比例 0..1(吠陀日的夜)
                hora_seq = 12 + int(frac * 12.0)
            frac = min(0.999999, max(0.0, frac))
            seg = min(2, int(frac * 3.0))
            hora_seq = max(0, min(23, hora_seq))
            # Nathonnatha:距最近视午夜(前夜中点 / 本夜中点)的实际时长(日),上限 0.5 日 = 12 小时。
            m_prev = (prev_sunset_jd + sunrise_jd) / 2.0
            m_next = (sunset_jd + next_sunrise_jd) / 2.0
            unnata = min(abs(jd - m_prev), abs(jd - m_next), 0.5)
            return seg, unnata, hora_seq
        except Exception:
            return 0, 0.5, None

    def _apparent_unnata(self):
        """出生距最近视午夜的时长(日,0..0.5):视太阳时 = 世界时 + 经度/360 + 均时差(swe.time_equ)。
        视午夜 = 视太阳时 0h。求不出 → 0.5(正午,旧回退)。"""
        try:
            import swisseph as _swe
            p = self.d1_perchart
            jd = float(p.dateTime.jd)
            e_days = float(_swe.time_equ(jd))
            frac = (jd + 0.5 + float(p.pos.lon) / 360.0 + e_days) % 1.0      # 0 = 视午夜
            return min(frac, 1.0 - frac, 0.5)
        except Exception:
            return 0.5

    def _shadbala_abda_masa_lords(self, sun_lon):
        """年/月主(Abda/Masa)的 const 主曜(近似)。

        Masa 主 = 太阳进入「当前星座 0°」那一吠陀日的星期主;Abda 主 = 太阳进入白羊 0°那一吠陀日的星期主。
        近似:以平太阳速度(≈0.98565°/日)由 D1 太阳恒星经度回推入宫日(非 Kali 积日法),
        星期按当地日出界(吠陀日)取。回推/取主曜任一步异常 → (None, None)(该子项 pending)。
        """
        from astrostudy.india import shadbala_bphs as sb
        from astrostudy.india.primitives import vedic_weekday
        try:
            p = self.d1_perchart
            jd = p.dateTime.jd
            sun = float(sun_lon) % 360.0
            mean = 360.0 / 365.2422                    # 平太阳日速(°/日)
            sign_start = (int(sun // 30.0) * 30.0)     # 当前星座 0°(sidereal)
            masa_jd = jd - (sun - sign_start) / mean
            abda_jd = jd - sun / mean
            masa_wd, _ = vedic_weekday(masa_jd, p.pos.lat, p.pos.lon, p.zone)
            abda_wd, _ = vedic_weekday(abda_jd, p.pos.lat, p.pos.lon, p.zone)
            return sb.WEEKDAY_LORDS[abda_wd], sb.WEEKDAY_LORDS[masa_wd]
        except Exception:
            return None, None
