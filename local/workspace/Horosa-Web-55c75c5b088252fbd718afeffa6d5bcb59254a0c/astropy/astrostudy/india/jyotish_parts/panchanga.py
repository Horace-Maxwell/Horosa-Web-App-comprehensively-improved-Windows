"""JyotishEngine 的历时与择时方法(由 jyotish_engine.py 整段搬出;JyotishEngine 类仍在 astrostudy.india.jyotish_engine,经继承取得)。"""
from flatlib import const
from flatlib.datetime import Datetime
from astrostudy.civil_calendar import flatlib_civil_string
from flatlib.ephem import eph
from astrostudy.india.jyotish_parts.tables import (
    YOGA_NAMES, KARANA_SEQUENCE, VARA_NAMES, VARA_CN, choghadia_sequence, tithi_name,
)
from astrostudy.india.jyotish_parts.helpers import norm, dasha_lord
from astrostudy.india.primitives import segment_index, vedic_weekday, local_weekday


_VARA_LORD_IDS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']


class PanchangaMixin:
    """历时与择时:五支历 / 半日 / 日出 / 择时 / 时主表 / 吉凶时段 / 副星。"""

    def vedic_day(self):
        """出生所在吠陀日(日界 = 日出;恒以 D1 时刻 / 地点):{weekday 0=周日, sunriseJd, civilWeekday}。
        星期主 / Hora / Choghadia / Rahu Kālam / Panchaka / 六力 Vāra·Hora / KP RP 日主全取于此。"""
        cached = getattr(self, '_vedic_day_cache', None)
        if cached is not None:
            return cached
        p = self.d1_perchart
        jd = p.dateTime.jd
        try:
            civil = local_weekday(jd, p.zone)
        except Exception:
            civil = local_weekday(jd, 0)
        try:
            wd, sr = vedic_weekday(jd, p.pos.lat, p.pos.lon, p.zone)
        except Exception:
            wd, sr = civil, None
        cached = {'weekday': wd, 'sunriseJd': sr, 'civilWeekday': civil}
        self._vedic_day_cache = cached
        return cached

    def vedic_weekday(self):
        return self.vedic_day()['weekday']

    def panchanga(self):
        # Panchanga 取真日月经度，恒以 D1 盘为准(分盘不改 tithi/yoga/karana)。
        sun_lon = getattr(self.d1_sun, 'lon', 0)
        moon_lon = getattr(self.d1_moon, 'lon', 0)
        lunar_angle = norm(moon_lon - sun_lon)
        tithi_index = segment_index(lunar_angle, 12.0, 30)
        tithi_day = tithi_index + 1
        paksha = 'Shukla' if tithi_day <= 15 else 'Krishna'
        yoga_index = segment_index(norm(sun_lon + moon_lon), 360.0 / 27.0, 27)
        karana_index = segment_index(lunar_angle, 6.0, 60)
        vd = self.vedic_day()
        vara_index = vd['weekday']
        civil_index = vd['civilWeekday']
        return {
            'vara': {
                'index': vara_index,
                'name': VARA_NAMES[vara_index],
                'label': VARA_CN[vara_index],
                'lord': dasha_lord(_VARA_LORD_IDS[vara_index]),
                # 印度日界 = 日出:子夜→日出之间出生仍属前一日。民用日星期并列回显。
                'basis': 'sunrise',
                'civilIndex': civil_index,
                'civilName': VARA_NAMES[civil_index],
                'civilLabel': VARA_CN[civil_index],
            },
            'tithi': {
                'index': tithi_day,
                'name': tithi_name(tithi_day),
                'paksha': paksha,
                'angle': lunar_angle,
                'progress': (lunar_angle % 12) / 12.0,
            },
            'nakshatra': self._nak_with_detail(moon_lon),
            'yoga': {
                'index': yoga_index + 1,
                'name': YOGA_NAMES[yoga_index],
                'progress': (norm(sun_lon + moon_lon) % (360.0 / 27.0)) / (360.0 / 27.0),
            },
            'karana': self.karana(karana_index),
            'sunrise': self.safe_sunrise(),
        }

    def karana(self, karana_index):
        if karana_index == 0:
            name = 'Kimstughna'
        elif karana_index == 57:
            name = 'Shakuni'
        elif karana_index == 58:
            name = 'Chatushpada'
        elif karana_index == 59:
            name = 'Naga'
        else:
            name = KARANA_SEQUENCE[(karana_index - 1) % len(KARANA_SEQUENCE)]
        return {
            'index': karana_index + 1,
            'name': name,
        }

    def safe_sunrise(self):
        try:
            return self.perchart.getSunRiseTime()['timeStr']
        except Exception:
            return None

    def _vedic_day_bounds(self):
        """出生所在吠陀日的 (日出, 日没, 次日出) JD 与星期(0=周日);任一求不出 → None。"""
        p = self.d1_perchart
        lat, lon = p.pos.lat, p.pos.lon
        vd = self.vedic_day()
        sr = vd.get('sunriseJd')
        if sr is None:
            sr = eph.lastSunrise(p.dateTime.jd, lat, lon)
        ss = eph.nextSunset(sr, lat, lon)
        nsr = eph.nextSunrise(ss, lat, lon)
        if not (ss > sr and nsr > ss):
            return None
        return sr, ss, nsr, vd['weekday']

    def muhurta(self):
        """择时面板:Rahu Kālam / Yamaganda / Gulika / Hora / Choghadia / Abhijit 全按「出生所在吠陀日」
        (日界 = 日出:该日日出 → 次日日出;子夜后、日出前出生仍属前一日),星期取该吠陀日。"""
        try:
            bounds = self._vedic_day_bounds()
            if bounds is None:
                return {'available': False, 'reason': 'sunrise_unavailable'}
            sunrise_jd, sunset_jd, next_sunrise_jd, weekday = bounds
            zone = self.d1_perchart.zone
            sunrise = Datetime.fromJD(sunrise_jd, zone)
            sunset = Datetime.fromJD(sunset_jd, zone)
            day_length_hours = (sunset_jd - sunrise_jd) * 24
            rahu_slots = [8, 2, 7, 5, 6, 4, 3]
            yama_slots = [5, 4, 3, 2, 1, 7, 6]
            gulika_slots = [7, 6, 5, 4, 3, 2, 1]
            slot_hours = day_length_hours / 8.0
            result = {
                'vedicDate': flatlib_civil_string(sunrise).split(' ')[0],
                'vedicWeekday': weekday,
                'dayBasis': 'birth_vedic_day',
                'sunrise': sunrise.toCNString(),
                'sunset': sunset.toCNString(),
                'rahuKalam': self.muhurta_interval(sunrise, slot_hours, rahu_slots[weekday]),
                'yamaganda': self.muhurta_interval(sunrise, slot_hours, yama_slots[weekday]),
                'gulika': self.muhurta_interval(sunrise, slot_hours, gulika_slots[weekday]),
            }
            # 出生须臾(昼/夜各 15 = 30 muhurta)+ 全表;用出生日的日出→日没→次日出窗口(正确括住凌晨生)。
            try:
                from astrostudy.india.muhurta_day import birth_muhurta, all_muhurtas
                bjd = self.d1_perchart.dateTime.jd
                result['birthMuhurta'] = birth_muhurta(bjd, sunrise_jd, sunset_jd, next_sunrise_jd,
                                                       vedic_weekday=weekday)
                result['muhurtaTable'] = all_muhurtas()
            except Exception:
                result['birthMuhurta'] = None
                result.setdefault('partialErrors', []).append('birthMuhurta')
                self._note_partial('muhurta.birthMuhurta')
            # 昼夜 24 行星时(Hora)表(P0-7;新增键，零回归)。
            result['horaTable'] = self.hora_table()
            # Choghadia 民用择时(昼夜各 8 段;P1;新增键,零回归)。
            result['choghadia'] = self.choghadia_table()
            # Panchaka 五忌:(Tithi+Vara+Nakshatra+Lagna)%9 → 1死/2火/4王/6盗/8病为忌。恒 D1 上升 / 吠陀日。
            try:
                from astrostudy.india.primitives import panchaka_remainder, PANCHAKA_TYPES
                pan = self.panchanga()
                tithi_n = (pan.get('tithi') or {}).get('index')
                vara_n = (pan.get('vara') or {}).get('index')
                nak = pan.get('nakshatra') or {}
                nak_n = nak.get('index')
                lagna_n = (list(const.LIST_SIGNS).index(self.d1_asc.sign) + 1) if self.d1_asc else None
                if tithi_n and vara_n is not None and nak_n and lagna_n:
                    rem = panchaka_remainder(tithi_n, vara_n, nak_n, lagna_n)
                    result['panchaka'] = {
                        'remainder': rem,
                        'isPanchaka': rem in PANCHAKA_TYPES,
                        'type': PANCHAKA_TYPES.get(rem, (None, None))[0],
                        'typeLabel': PANCHAKA_TYPES.get(rem, (None, '无忌(吉)'))[1],
                        'note': '(Tithi+Vara+Nakshatra+Lagna)%9(Vara 周日=1,吠陀日);余1死/2火/4王/6盗/8病为忌,余0/3/5/7吉。',
                    }
            except Exception:
                result['panchaka'] = None
                result.setdefault('partialErrors', []).append('panchaka')
                self._note_partial('muhurta.panchaka')
            # Abhijit Muhurta(古法):全日 15 昼须臾之第 8(正午前后),除周三外通用大吉。
            from astrostudy.india.primitives import abhijit_auspicious
            result['abhijit'] = {
                'muhurtaIndex': 8,
                'auspicious': abhijit_auspicious(weekday),
                'note': '第 8 昼须臾(正午前后)通用大吉、破诸障;周三除外。',
            }
            return result
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def hora_table(self):
        """昼夜 24 行星时(Hora)表:昼=日出→日没均分 12、夜=日没→次日出均分 12(出生所在吠陀日)。
        每段主曜 = sb.hora_lord_at(吠陀日 vara 序, 段序),日出首段恒为当日 vara 主,
        之后按 Chaldean 序循环(与年/月主同源)。时段含起讫时刻。"""
        try:
            from astrostudy.india import shadbala_bphs as sb
            bounds = self._vedic_day_bounds()
            if bounds is None:
                return None
            sr, ss, nsr, weekday = bounds
            zone = self.d1_perchart.zone
            cn = {const.SUN: '太阳', const.MOON: '月亮', const.MARS: '火星',
                  const.MERCURY: '水星', const.JUPITER: '木星', const.VENUS: '金星',
                  const.SATURN: '土星'}
            day_slot = (ss - sr) / 12.0
            night_slot = (nsr - ss) / 12.0
            rows = []
            for i in range(24):
                if i < 12:
                    start_jd = sr + i * day_slot
                    end_jd = start_jd + day_slot
                    period = 'day'
                else:
                    start_jd = ss + (i - 12) * night_slot
                    end_jd = start_jd + night_slot
                    period = 'night'
                lord = sb.hora_lord_at(weekday, i)
                rows.append({
                    'index': i + 1,
                    'period': period,
                    'lord': lord,
                    'lordCN': cn.get(lord, lord),
                    'start': Datetime.fromJD(start_jd, zone).toCNString(),
                    'end': Datetime.fromJD(end_jd, zone).toCNString(),
                })
            return {'weekday': weekday, 'vedicDate': flatlib_civil_string(Datetime.fromJD(sr, zone)).split(' ')[0], 'rows': rows}
        except Exception:
            return None

    def choghadia_table(self):
        """Choghadia 民用择时:昼夜各 8 段(段长=昼/夜 ÷8;出生所在吠陀日)。排法走 tables.choghadia_sequence
        单源(昼首 = 当日 vara 类、昼段每段 +1;夜首 = 昼首 +5、夜段每段 +5)。每段含类(吉/凶)+对应曜+起讫。"""
        try:
            bounds = self._vedic_day_bounds()
            if bounds is None:
                return None
            sr, ss, nsr, weekday = bounds
            zone = self.d1_perchart.zone
            day_seq, night_seq = choghadia_sequence(weekday)
            day_slot = (ss - sr) / 8.0
            night_slot = (nsr - ss) / 8.0

            def _seg(period, c, i, slot, origin):
                start_jd = origin + i * slot
                return {
                    'index': i + 1, 'period': period,
                    'key': c['key'], 'cn': c['cn'], 'nature': c['nature'], 'planet': c['planet'],
                    'start': Datetime.fromJD(start_jd, zone).toCNString(),
                    'end': Datetime.fromJD(start_jd + slot, zone).toCNString(),
                }
            rows = [_seg('day', c, i, day_slot, sr) for i, c in enumerate(day_seq)]
            rows += [_seg('night', c, i, night_slot, ss) for i, c in enumerate(night_seq)]
            return {'weekday': weekday, 'vedicDate': flatlib_civil_string(Datetime.fromJD(sr, zone)).split(' ')[0], 'rows': rows}
        except Exception:
            return None

    def muhurta_interval(self, sunrise, slot_hours, slot):
        start_jd = sunrise.jd + (slot - 1) * slot_hours / 24.0
        end_jd = start_jd + slot_hours / 24.0
        return {
            'start': Datetime.fromJD(start_jd, self.d1_perchart.zone).toCNString(),
            'end': Datetime.fromJD(end_jd, self.d1_perchart.zone).toCNString(),
        }

    def upagraha(self):
        """副星：日基 5(由日)+ 特殊上升 BL/HL/GL/SL(日出 + 历时)+ 时基 6(Gulika/Maandi 等，
        昼/夜 8 段段中点/起点升起的 lagna)。恒以 D1 盘算。"""
        from astrostudy.india.upagraha import sun_based_upagrahas, special_lagnas
        sun_lon = getattr(self.d1_sun, 'lon', None)
        result = {'available': sun_lon is not None}
        if sun_lon is None:
            return result
        result['sunBased'] = sun_based_upagrahas(sun_lon)
        try:
            jd = self.d1_perchart.dateTime.jd
            lat = self.d1_perchart.pos.lat
            lon = self.d1_perchart.pos.lon
            sunrise_jd = eph.lastSunrise(jd, lat, lon)
            elapsed_minutes = (jd - sunrise_jd) * 1440.0
            # 太阳日均行 ~0.98565°，由出生太阳回推日出时太阳经度(对特殊上升足够精度)。
            sun_at_sunrise = (sun_lon - 0.98565 * (elapsed_minutes / 1440.0)) % 360.0
            result['specialLagnas'] = special_lagnas(
                sun_at_sunrise, elapsed_minutes,
                getattr(self.d1_asc, 'lon', 0.0), getattr(self.d1_moon, 'lon', 0.0),
                sun_lon_at_birth=sun_lon)   # PP 出生太阳变体(现代变体)
        except Exception:
            result['specialLagnas'] = None
            result['note'] = '日出不定(极地等)，特殊上升优雅降级'
        result['timeBased'] = self._time_based_upagrahas()
        return result

    def _time_based_upagrahas(self):
        """时基 6 副星：定昼/夜 8 段(印度日界从日出起算)，取所属段中点(Maandi 起点)升起的
        sidereal 上升点黄经。日出不定(极地)或求根失败 → None(优雅降级)。"""
        try:
            from astrostudy.india.upagraha import time_based_segment, TIME_BASED_DEFS
            from flatlib.ephem import swe as fswe
            jd = self.d1_perchart.dateTime.jd
            lat = self.d1_perchart.pos.lat
            lon = self.d1_perchart.pos.lon
            hsys = self.d1_chart.hsys
            sr = eph.lastSunrise(jd, lat, lon)
            ss = eph.nextSunset(sr, lat, lon)
            if jd < ss:                                  # 昼生：日出 → 日没
                night, origin, span = False, sr, ss - sr
            else:                                        # 夜生：日没 → 次日出
                nsr = eph.nextSunrise(ss, lat, lon)
                night, origin, span = True, ss, nsr - ss
            if span <= 0:
                return None
            # 印度日界从日出起算：星期取「起始日出」那天(夜生/午夜后仍属该日)——吠陀日单源。
            weekday = self.vedic_weekday()
            out = []
            with self.d1_chart._siderealContext():
                for name, planet, note in TIME_BASED_DEFS:
                    seg = time_based_segment(name, weekday, night)
                    if not seg:
                        continue
                    frac = (seg['segment'] + (0.5 if seg['point'] == 'mid' else 0.0)) / 8.0
                    _, angles = fswe.sweHousesLon(origin + frac * span, lat, lon, hsys,
                                                  fswe.swisseph.FLG_SIDEREAL)
                    out.append({
                        'key': name, 'planet': planet, 'note': note,
                        'segment': seg['segment'], 'point': seg['point'],
                        'lon': angles[0] % 360.0,
                    })
            return out
        except Exception:
            return None
