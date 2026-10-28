"""JyotishEngine 的杰米尼与 KP 方法(由 jyotish_engine.py 整段搬出;JyotishEngine 类仍在 astrostudy.india.jyotish_engine,经继承取得)。"""
from flatlib import const
from flatlib.ephem import eph
from astrostudy.india.yoga_engine import safe_get
from astrostudy.india.primitives import chara_karakas, KARAKA_PLANETS, PLANET_CN, SIGN_CN
from astrostudy.nakshatra import nakshatra_from_lon
from astrostudy.india.jyotish_parts.tables import JYOTISH_PLANETS, DASHA_SEQUENCE
from astrostudy.india.jyotish_parts.helpers import norm, sign_index_from_lon, dasha_lord


class JaiminiKpMixin:
    """杰米尼与 KP:杰米尼要素 / 三对寿命 / KP 宫头与子主 / 问事盘。"""

    def jaimini(self):
        # 8 卡拉卡(含罗睺逆量 30−宿内度)，降序 → AK..DK。复用 primitives.chara_karakas。
        # 🔴 恒以 D1 度数:卡拉卡按出生真度数排序;分盘里的「座内度」是放大后的伪度数,
        #    随分盘算会与 AKKG(恒 D1)互相矛盾、并让 Karakamsa / Swamsa 漂移。
        objs = {}
        planet_lons = {}
        for obj_id in KARAKA_PLANETS:
            obj = safe_get(self.d1_chart, obj_id)
            if obj:
                objs[obj_id] = obj
                planet_lons[obj_id] = obj.lon
        karakas = chara_karakas(planet_lons, scheme=self.karaka_scheme)
        rows = []
        for k in karakas:
            obj_id = k['planet']
            obj = objs.get(obj_id)
            if not obj:
                continue
            rows.append({
                'karaka': k['full'],          # 全名 Atmakaraka..Darakaraka(8)
                'karakaLabel': k['label'],    # 缩写 AK..DK
                'planet': obj_id,
                'label': PLANET_CN.get(obj_id, obj_id),
                'sign': obj.sign,
                'signLabel': SIGN_CN.get(obj.sign, obj.sign),
                'signlon': obj.signlon,
                'karakaDegree': k['degree'],  # 卡拉卡用度(罗睺为逆量)
            })
        return {'charaKarakas': rows, 'karakaScheme': self.karaka_scheme, 'basis': 'd1',
                'ayurTriPair': self._jaimini_ayur_tri_pair()}

    def _jaimini_ayur_tri_pair(self):
        """Jaimini 寿命三对法(古籍通行版本):①Lagna×Hora Lagna ②Moon×Lagna ③Saturn×Hora Lagna。
        每对按两点所在座「动/固/双」三态组合映射档位(各教材一致的循环表):
        同动=purna(长)/同固=alpa(短)/同双=madhya(中);混合取第三态档
        (动+固=madhya、固+双=purna、动+双=alpa)。三票多数,平票取 madhya。
        「前后关系」诸版本仅作次级微调且口径不一 → 不实现(不臆造),note 标注。"""
        try:
            from flatlib.ephem import eph
            from astrostudy.india.primitives import MOVABLE, FIXED
            asc = self.d1_asc if self.d1_asc is not None else self.asc
            moon = self.d1_moon if self.d1_moon is not None else self.moon
            sat = safe_get(self.d1_chart, const.SATURN)
            sun = self.d1_sun if getattr(self, 'd1_sun', None) is not None else safe_get(self.d1_chart, const.SUN)
            if asc is None or moon is None or sat is None or sun is None:
                return {'available': False, 'reason': 'missing_points'}
            # Hora Lagna:日出起每 2.5 灵时进 1 座 → 经度式 = 日出太阳 + elapsed×(360/720min)
            jd = self.d1_perchart.dateTime.jd
            lat = self.d1_perchart.pos.lat
            lon_geo = self.d1_perchart.pos.lon
            try:
                sunrise_jd = eph.lastSunrise(jd, lat, lon_geo)
                elapsed_minutes = (jd - sunrise_jd) * 1440.0
                sun_at_sunrise = (float(sun.lon) - 0.98565 * (elapsed_minutes / 1440.0)) % 360.0
                hl = (sun_at_sunrise + elapsed_minutes * 0.5) % 360.0
            except Exception:
                return {'available': False, 'reason': 'sunrise_unavailable'}

            def _quality(lon):
                sgn = const.LIST_SIGNS[sign_index_from_lon(lon)]
                if sgn in MOVABLE:
                    return 'movable'
                if sgn in FIXED:
                    return 'fixed'
                return 'dual'

            BAND = {'movable': 'purna', 'fixed': 'alpa', 'dual': 'madhya'}
            THIRD = {frozenset(('movable', 'fixed')): 'madhya',
                     frozenset(('fixed', 'dual')): 'purna',
                     frozenset(('movable', 'dual')): 'alpa'}
            BAND_CN = {'purna': '长寿 Pūrṇa(约64-100)', 'madhya': '中寿 Madhya(约32-64)', 'alpa': '短寿 Alpa(约0-32)'}

            def _verdict(a_lon, b_lon):
                qa, qb = _quality(a_lon), _quality(b_lon)
                if qa == qb:
                    return BAND[qa]
                return THIRD[frozenset((qa, qb))]

            asc_lon = float(asc.lon) % 360.0
            moon_lon = float(moon.lon) % 360.0
            sat_lon = float(sat.lon) % 360.0
            pairs_def = [
                ('Lagna × Hora Lagna', 'Lagna', asc_lon, 'Hora Lagna', hl),
                ('Moon × Lagna', 'Moon', moon_lon, 'Lagna', asc_lon),
                ('Saturn × Hora Lagna', 'Saturn', sat_lon, 'Hora Lagna', hl),
            ]
            pairs = []
            votes = {'purna': 0, 'madhya': 0, 'alpa': 0}
            for name, an, al, bn, bl in pairs_def:
                v = _verdict(al, bl)
                votes[v] += 1
                a_sign = const.LIST_SIGNS[sign_index_from_lon(al)]
                b_sign = const.LIST_SIGNS[sign_index_from_lon(bl)]
                pairs.append({'name': name, 'aPoint': an, 'bPoint': bn,
                              'aSign': a_sign, 'aSignLabel': SIGN_CN.get(a_sign, a_sign),
                              'bSign': b_sign, 'bSignLabel': SIGN_CN.get(b_sign, b_sign),
                              'aQuality': _quality(al), 'bQuality': _quality(bl),
                              'verdict': v, 'verdictLabel': BAND_CN[v]})
            best = max(votes.values())
            leaders = [k for k, n in votes.items() if n == best]
            majority = leaders[0] if len(leaders) == 1 else 'madhya'   # 平票取中档
            return {'available': True, 'pairs': pairs, 'votes': votes,
                    'majority': majority, 'band': majority, 'bandLabel': BAND_CN[majority],
                    'horaLagnaLon': round(hl, 4),
                    'note': '三对法·古籍通行版本(各版配对略异);同质=本档(动长/固短/双中),混合取第三态;仅档位参考,不作寿命断言。'}
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def _kp_placidus_cusps(self):
        """KP CSL 用真 Placidus 不等宫 sidereal 宫始(P0-9)。KP 标准恒用 Placidus,
        与盘面 hsys 设置无关。返回 12 个 sidereal 宫始度数(宫 1..12),首宫 = 上升点;
        求根失败(极地/无日出区等)→ None,由调用方退化为等宫近似。"""
        try:
            from flatlib.ephem import swe as fswe
            jd = self.d1_perchart.dateTime.jd
            lat = self.d1_perchart.pos.lat
            lon = self.d1_perchart.pos.lon
            with self.d1_chart._siderealContext():
                hlist, _ = fswe.sweHousesLon(jd, lat, lon, const.HOUSES_PLACIDUS,
                                             fswe.swisseph.FLG_SIDEREAL)
            if not hlist or len(hlist) < 12:
                return None
            return [float(h) % 360.0 for h in hlist[:12]]
        except Exception:
            return None

    def prasna(self):
        """Praśna KP 卜卦(最小版):问数 1-249 → 问时上升所落 KP 子段(243 宿×Sub + 6 跨界拆 = 249,
        全黄道固定结构,与盘/岁差无关)。返回 249 段表;前端按问数取行,显上升座/度区/宿/星主/子主/座主链。
        完整问时盘(该上升 + 问时九曜重排 + 显著星判读)后续。零回归:纯新增 compute 键。"""
        try:
            from astrostudy.india.kp_system import kp_249_table, sign_lord
            SIGN = const.LIST_SIGNS
            rows = []
            for seg in kp_249_table():
                rows.append({
                    'index': seg['index'],
                    'sign': SIGN[(seg['signNo'] - 1) % 12],
                    'startLon': round(seg['startLon'], 3),
                    'endLon': round(seg['endLon'], 3),
                    'nakName': seg['nakName'],
                    'starLord': seg['starLord'],
                    'subLord': seg['subLord'],
                    'signLord': sign_lord(seg['signNo']),
                })
            return {
                'available': True, 'count': len(rows), 'table': rows,
                'note': '问数 1-249 → 问时上升落该 KP 子段;子主链=座主→星主(宿主)→子主(Sub 主)。完整问时盘需另定问时刻重排九曜+显著星,本最小版只给上升定位。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def kp(self):
        """KP 盘点:恒以 D1(出生真经度 + 出生时刻真 Placidus 宫头),分盘视图下不随显示盘
        (分盘伪经度的子主无意义,且会与 D1 宫头混成两个框架)。basis='d1' 供界面标注。"""
        chart = self.d1_chart
        asc = self.d1_asc
        sublords = {}
        kp_levels = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(chart, obj_id)
            if not obj:
                continue
            sublords[obj_id] = self.kp_sublord(obj.lon)
        if asc:
            sublords[const.ASC] = self.kp_sublord(asc.lon)
        result = {
            'ayanamsa': getattr(self.d1_perchart, 'siderealModeLabel', 'Lahiri / Horosa sidereal context'),
            'ayanamsaKey': getattr(self.d1_perchart, 'siderealModeKey', 'lahiri'),
            'basis': 'd1',
            'sublords': sublords,
        }
        # KP 深化:6 级细分(Nak⊃Sub⊃Prati⊃Sook⊃Praana⊃Deha)+ CSL(真 Placidus)+ Ruling Planets + 意义星。
        try:
            from astrostudy.india.kp_system import kp_levels as _kpl, cuspal_sublords, ruling_planets
            from astrostudy.india.prashna import assemble_kp_significators, NODE_KEY_MAP_REV
            from astrostudy.india.primitives import weekday_mon0
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(chart, obj_id)
                if obj:
                    kp_levels[obj_id] = _kpl(obj.lon, 6)
            if asc:
                kp_levels[const.ASC] = _kpl(asc.lon, 6)
            result['kpLevels'] = kp_levels
            SIGNS = [const.ARIES, const.TAURUS, const.GEMINI, const.CANCER, const.LEO, const.VIRGO,
                     const.LIBRA, const.SCORPIO, const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES]
            if asc:
                cusps = self._kp_placidus_cusps()       # P0-9 KP 标准:真 Placidus 不等宫
                if cusps:
                    cusp_mode = 'placidus_sidereal'
                else:
                    cusps = [(float(asc.lon) + i * 30.0) % 360.0 for i in range(12)]
                    cusp_mode = 'equal_from_asc'         # 极地等求根失败优雅降级
                result['cuspalSubLords'] = cuspal_sublords(cusps)
                result['cuspMode'] = cusp_mode
                moon = safe_get(chart, const.MOON)
                # RP 日主:吠陀日(日界 = 日出),与问事 / 校时同一来源;kp_system 表 0=周一。
                weekday = weekday_mon0(self.vedic_weekday())
                result['rulingPlanets'] = ruling_planets(
                    SIGNS.index(asc.sign) + 1, nakshatra_from_lon(asc.lon)['lord'],
                    (SIGNS.index(moon.sign) + 1) if moon else None,
                    nakshatra_from_lon(moon.lon)['lord'] if moon else None, weekday)
                # KP 四重意义星:与问时盘同一组装(KP 键 + 宫头区间占宫 + 宫头落座定宫主 + 节点代理)。
                planet_lons = {}
                for obj_id in JYOTISH_PLANETS:
                    o = safe_get(chart, obj_id)
                    if o:
                        planet_lons[obj_id] = float(o.lon)
                asm = assemble_kp_significators(planet_lons, cusps)
                # 出参键沿用盘面 id(罗计 'North Node'/'South Node'),与盘面高亮 / 星曜卡同键。
                result['significators'] = {NODE_KEY_MAP_REV.get(k, k): v
                                           for k, v in asm['significators'].items()}
                result['nodeProxy'] = asm['nodeProxy']
                result['houseBasis'] = 'cusp'
        except Exception:
            # 6 级细分 / 宫头分主 / RP / 四重意义星这一段没算出来:落账(此前整段静默消失)
            result.setdefault('partialErrors', []).append('kpDeep')
            self._note_partial('kp.deep')
        return result

    def kp_sublord(self, lon):
        nak = nakshatra_from_lon(lon)
        lord_index = [x['key'] for x in DASHA_SEQUENCE].index(nak['lord'])
        span = 360.0 / 27.0
        # 宿内偏移以 nakshatra_from_lon 定的宿起点为准(精确宿界归后一宿,与 kp_subdivide 同口径)。
        progress_deg = max(0.0, norm(lon) - (nak['index'] - 1) * span)
        cursor = 0
        sublord = DASHA_SEQUENCE[lord_index]
        for i in range(len(DASHA_SEQUENCE)):
            candidate = DASHA_SEQUENCE[(lord_index + i) % len(DASHA_SEQUENCE)]
            part = span * candidate['years'] / 120.0
            if progress_deg < cursor + part - 1e-9 or i == len(DASHA_SEQUENCE) - 1:
                sublord = candidate
                break
            cursor += part
        return {
            'nakshatra': nak,
            'starLord': dasha_lord(nak['lord']),
            'subLord': sublord,
        }
