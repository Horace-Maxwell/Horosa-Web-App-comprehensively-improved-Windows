"""JyotishEngine 的 nadi 与分盘对照方法(由 jyotish_engine.py 整段搬出;JyotishEngine 类仍在 astrostudy.india.jyotish_engine,经继承取得)。"""
from flatlib import const
from astrostudy.india.yoga_engine import safe_get
from astrostudy.india.primitives import PLANET_CN, SIGN_CN, segment_index
from astrostudy.nakshatra import nakshatra_from_lon
from astrostudy.india.jyotish_parts.helpers import sign_index_from_lon, format_dt


class NadiVargaMixin:
    """nadi 与分盘对照:nadi / 敏感点 / 六十分盘 / 分盘异文对照。"""

    def nadi(self):
        """Nāḍī 流派敏感点。Bhrigu Bindu(福点)= Rahu 与 Moon 的「较短弧中点」
        =(λRahu+λMoon)/2,若两点黄经差 >180° 则 +180°(取短弧)。落座/宫 = 业力焦点/应期。
        缺月/罗睺 → available False(不臆造)。零回归:纯新增 compute 键。"""
        try:
            # Bhrigu Bindu 是 D1 量(帮助:标准恒星盘、绝对黄经):恒取 d1_chart 的月亮与罗睺,
            # 不随所绘分盘(D9 等伪黄经)漂移;chartnum==1 时 d1_chart≡chart,字节不变。同座合 / 木星推进沿用同一 D1 点。
            moon = self.d1_moon if self.d1_moon is not None else self.moon
            rahu = safe_get(self.d1_chart, const.NORTH_NODE)
            if rahu is None:
                rahu = safe_get(self.chart, const.NORTH_NODE)
            if moon is None or rahu is None:
                return {'available': False, 'reason': 'missing_moon_or_rahu'}
            m = float(moon.lon) % 360.0
            r = float(rahu.lon) % 360.0
            mid = ((m + r) / 2.0) % 360.0
            if abs(r - m) > 180.0:               # 取较短弧中点
                mid = (mid + 180.0) % 360.0
            sidx = sign_index_from_lon(mid)
            sign = const.LIST_SIGNS[sidx]
            # D150 Nāḍiāṃśa(每座 30°/150 = 0°12′):奇座顺/偶座逆(五支古法)。
            # 专名表(Vasudha/Vaishnavi… 150 名)所给文档仅列 3 例 → 号位先显,名 blocked 不臆造。
            def _nadiamsa(lon):
                psidx = sign_index_from_lon(lon)
                raw = segment_index(float(lon) % 30.0, 0.2, 150)
                if raw > 149:
                    raw = 149
                num = (raw + 1) if (psidx % 2 == 0) else (150 - raw)   # 奇座(0基偶)顺、偶座逆
                return num, psidx
            # 纳迪全段按 D1(帮助:计算型 Nāḍī 用标准恒星盘):D150 / 同座合 / 木星推进同 BB 恒取 d1_chart
            d150 = []
            for pid in (const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN,
                        const.NORTH_NODE, const.SOUTH_NODE):
                pobj = safe_get(self.d1_chart, pid)
                if pobj is None:
                    continue
                plon = float(pobj.lon) % 360.0
                num, psidx = _nadiamsa(plon)
                psign = const.LIST_SIGNS[psidx]
                # A3:每格 0°12′ 精确边界(座内 raw 格序 = 顺排第 raw+1 格,与号位的奇顺偶逆无关)
                raw = segment_index(plon % 30.0, 0.2, 150)
                if raw > 149:
                    raw = 149
                start_in_sign = raw * 0.2
                d150.append({'planet': pid, 'nadiamsa': num,
                             'sign': psign, 'signLabel': SIGN_CN.get(psign, psign),
                             'withinSignDeg': round(plon % 30.0, 4),
                             'startLon': round(psidx * 30.0 + start_in_sign, 4),
                             'endLon': round(psidx * 30.0 + start_in_sign + 0.2, 4),
                             'name': None})
            # ── A1:同座合 + parivartana 交换(Bhrigu Nadi「同座=合;庙座互驻=强联动」)──
            from astrostudy.india.rasi_dasha import SIGN_LORDS as _SL, SIGN_LORDS_DUAL as _SLD
            nine = (const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                    const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE)
            by_sign = {}
            plon_map = {}
            for pid in nine:
                pobj = safe_get(self.d1_chart, pid)
                if pobj is None:
                    continue
                plon_map[pid] = float(pobj.lon) % 360.0
                by_sign.setdefault(pobj.sign, []).append(pid)
            combinations = []
            for sgn in const.LIST_SIGNS:
                grp = by_sign.get(sgn) or []
                if len(grp) >= 2:
                    combinations.append({'sign': sgn, 'signLabel': SIGN_CN.get(sgn, sgn),
                                         'planets': list(grp), 'count': len(grp)})

            def _own_signs(pid):
                out = set()
                for sg, lord in _SL.items():
                    if lord == pid:
                        out.add(sg)
                for sg, lord in _SLD.items():
                    if lord == pid:
                        out.add(sg)
                return out

            exchanges = []
            seen_pairs = set()
            for a in nine:
                for b in nine:
                    if a >= b or a not in plon_map or b not in plon_map:
                        continue
                    a_sign = const.LIST_SIGNS[sign_index_from_lon(plon_map[a])]
                    b_sign = const.LIST_SIGNS[sign_index_from_lon(plon_map[b])]
                    if a_sign == b_sign:
                        continue
                    owns_a = _own_signs(a)
                    owns_b = _own_signs(b)
                    if a_sign in owns_b and b_sign in owns_a:
                        key = (a, b)
                        if key in seen_pairs:
                            continue
                        seen_pairs.add(key)
                        dual = (a_sign in _SLD) or (b_sign in _SLD) \
                            or (a in _SLD.values()) or (b in _SLD.values())
                        exchanges.append({'a': a, 'b': b,
                                          'aSign': a_sign, 'aSignLabel': SIGN_CN.get(a_sign, a_sign),
                                          'bSign': b_sign, 'bSignLabel': SIGN_CN.get(b_sign, b_sign),
                                          'dualLord': bool(dual)})
            # ── A2:木星逐座推进时间轴(默认每座 1 木星年;各 Bhrigu 派年数不同 → 标版本)──
            JUPITER_YEARS_PER_SIGN = 1.0
            jup_prog = None
            jup = safe_get(self.d1_chart, const.JUPITER)
            if jup is not None:
                import datetime as _dt
                start_sidx = sign_index_from_lon(float(jup.lon))
                birth_dt = None
                try:
                    jd0 = float(self.perchart.dateTime.jd)
                    birth_dt = _dt.datetime(2000, 1, 1, 12) + _dt.timedelta(days=jd0 - 2451545.0)
                except Exception:
                    birth_dt = None
                segments = []
                for k in range(24):
                    sidx_k = (start_sidx + k) % 12
                    sgn_k = const.LIST_SIGNS[sidx_k]
                    seg = {'index': k + 1, 'sign': sgn_k,
                           'signLabel': SIGN_CN.get(sgn_k, sgn_k),
                           'startAge': round(k * JUPITER_YEARS_PER_SIGN, 2),
                           'endAge': round((k + 1) * JUPITER_YEARS_PER_SIGN, 2),
                           'natalPlanets': list(by_sign.get(sgn_k) or [])}
                    if birth_dt is not None:
                        sd = birth_dt + _dt.timedelta(days=k * JUPITER_YEARS_PER_SIGN * 365.25)
                        ed = birth_dt + _dt.timedelta(days=(k + 1) * JUPITER_YEARS_PER_SIGN * 365.25)
                        seg['startDate'] = format_dt(sd)
                        seg['endDate'] = format_dt(ed)
                    segments.append(seg)
                jup_prog = {'rule': 'one_year_per_sign',
                            'ruleLabel': '推进规则:每座 1 木星年(各 Bhrigu 派年数不同,版本可调)',
                            'startSign': const.LIST_SIGNS[start_sidx],
                            'segments': segments}
            # ── A3:Nadi Karaka 体系(九曜象征,Bhrigu Nadi 木星为首要 karaka)──
            nadi_karakas = [
                {'planet': const.SUN, 'label': PLANET_CN.get(const.SUN, 'Sun'), 'significations': ['父', '灵魂']},
                {'planet': const.MOON, 'label': PLANET_CN.get(const.MOON, 'Moon'), 'significations': ['母', '心']},
                {'planet': const.MARS, 'label': PLANET_CN.get(const.MARS, 'Mars'), 'significations': ['兄弟', '技术']},
                {'planet': const.MERCURY, 'label': PLANET_CN.get(const.MERCURY, 'Mercury'), 'significations': ['言', '商']},
                {'planet': const.JUPITER, 'label': PLANET_CN.get(const.JUPITER, 'Jupiter'), 'significations': ['子', '智', '夫(女命)'], 'primary': True},
                {'planet': const.VENUS, 'label': PLANET_CN.get(const.VENUS, 'Venus'), 'significations': ['妻', '欲']},
                {'planet': const.SATURN, 'label': PLANET_CN.get(const.SATURN, 'Saturn'), 'significations': ['寿', '业']},
                {'planet': const.NORTH_NODE, 'label': PLANET_CN.get(const.NORTH_NODE, 'Rahu'), 'significations': ['外缘']},
                {'planet': const.SOUTH_NODE, 'label': PLANET_CN.get(const.SOUTH_NODE, 'Ketu'), 'significations': ['解脱', '旧业']},
            ]
            return {
                'available': True,
                'bhriguBindu': {
                    'lon': mid,
                    'sign': sign,
                    'signLabel': SIGN_CN.get(sign, sign),
                    'signIndex': sidx,
                    'signlon': mid % 30.0,
                    'nakshatra': nakshatra_from_lon(mid),
                    'moonLon': m, 'rahuLon': r,
                },
                'd150': d150,
                'namesAvailable': False,
                'd150Note': 'D150 纳地盘:各曜落第几个 nāḍiāṃśa(150/座,0°12′);150 专名待录入原典表,暂显号位。',
                'combinations': combinations,
                'exchanges': exchanges,
                'jupiterProgression': jup_prog,
                'karakas': nadi_karakas,
                'combinationNote': '同座=合;仅出结构不出断语(组合字典原典未列全,不臆造)。',
                'note': 'Bhrigu Bindu = Rahu/Moon 短弧中点;业力焦点,过运触发为重大应期。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def sensitive_points(self):
        """敏感点 Sphuta(古法三类):生育点 + Gandanta/Sandhi 界位 + 死亡指示点
        (仅风险标注)+ Mrityu Bhaga(表空即 None,待录入)。纯派生,失败整块置 None
        由 compute() 的逐键 try/except 兜住。"""
        from astrostudy.india import sensitive_points as sp
        lons = {}
        for pid in (const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                    const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE):
            obj = safe_get(self.chart, pid)
            lons[pid] = getattr(obj, 'lon', None)
        lagna_lon = getattr(self.asc, 'lon', None)
        bodies = dict(lons)
        if lagna_lon is not None:
            bodies['Lagna'] = lagna_lon
        return {
            'available': True,
            'beejaKshetra': sp.beeja_kshetra_sphuta(
                lons.get(const.SUN), lons.get(const.VENUS), lons.get(const.JUPITER),
                lons.get(const.MOON), lons.get(const.MARS)),
            'gandanta': {
                'orbArcmin': 48,
                'hits': sp.boundary_flags_for(bodies),
                'note': '三处水火交界(双鱼↔白羊/巨蟹↔狮子/天蝎↔射手)±0°48′;Rasi Sandhi 为任意座界 ±1°,判力减分',
            },
            'deathIndicators': sp.death_indicator_points(lagna_lon, lons.get(const.MOON)),
            'mrityuBhaga': sp.mrityu_bhaga_hits(bodies),
        }

    def shashtiamsa(self):
        """D60 Ṣaṣṭyāṃśa(六十分盘)吉凶:各曜本命经度落第几个 0°30′ 段(1..60),
        奇象顺/偶象神名逆序(deity=61−段);Krūra(恶段)24 个 → 凶,余吉(D60 古法)。
        神名全表(Ghora/Rakshasa/Deva… 60 名,Santhanam BPHS)已落地;显段号+神名+吉凶+D60 落座。
        恒以本命 D1 经度算(与所绘分盘无关)。零回归:纯新增 compute 键。"""
        try:
            from astrostudy.india.varga import shashtiamsa_nature, varga_position
            rows = []
            for pid in (const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN,
                        const.NORTH_NODE, const.SOUTH_NODE):
                pobj = safe_get(self.d1_chart, pid)
                if pobj is None:
                    continue
                d1_lon = float(pobj.lon) % 360.0
                nat = shashtiamsa_nature(d1_lon)
                vsidx = sign_index_from_lon(varga_position(d1_lon, 60))
                vsign = const.LIST_SIGNS[vsidx]
                rows.append({
                    'planet': pid,
                    'segment': nat['segment'],
                    'deityIndex': nat['deityIndex'],
                    'deity': nat['deity'],
                    'nature': nat['nature'],
                    'sign': vsign,
                    'signLabel': SIGN_CN.get(vsign, vsign),
                })
            if not rows:
                return {'available': False, 'reason': 'no_planets'}
            benefic = sum(1 for r in rows if r['nature'] == 'benefic')
            return {
                'available': True,
                'planets': rows,
                'beneficCount': benefic,
                'maleficCount': len(rows) - benefic,
                'note': 'D60 六十分盘吉凶:本命经度落第几段(1..60);Krūra 恶段→凶,余吉。偶象神名逆序(61−段)。60 神名(BPHS 译本)已显。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def varga_variants(self):
        """分盘变体对照(古籍分盘章):D2/D3/D5/D11/D24/D30 各流派下落座可异。
        标准 Parāśara 为默认;另列 D2 Parivṛtti·D3 Parivṛtti/Jagannātha·D24 Narasiṃha(偶座逆)·D30 等分。
        含 D2 Kashinatha(依源座主星)、D3 Somanatha(奇顺偶逆),公式 _agentA_chartcasting.md。
        恒以本命 D1 经度算;同曜在各方案落座并列,differs 标差异。零回归:纯新增 compute 键。"""
        try:
            from astrostudy.india.varga import varga_position
            schemes = [
                {'chartnum': 2,  'key': 'd2',  'label': 'D2 Horā 二分盘',
                 'variants': [('standard', '标准 Parāśara'), ('parivritti', 'Parivṛtti 循环'), ('kashinatha', 'Kāśīnātha 财富·依主星')]},
                {'chartnum': 3,  'key': 'd3',  'label': 'D3 Drekkāṇa 三分盘',
                 'variants': [('standard', '标准 Parāśara'), ('parivritti', 'Parivṛtti 循环'), ('jagannatha', 'Jagannātha'), ('somanatha', 'Somanātha 奇顺偶逆')]},
                {'chartnum': 5,  'key': 'd5',  'label': 'D5 Pañcāṃśa 五分盘',
                 'variants': [('standard', '标准 奇白羊偶天秤'), ('parashara', 'Parāśara 主星序')]},
                {'chartnum': 11, 'key': 'd11', 'label': 'D11 Rudrāṃśa 十一分盘',
                 'variants': [('standard', '标准 动定双起'), ('cyclic', '连续循环')]},
                {'chartnum': 24, 'key': 'd24', 'label': 'D24 Siddhāṃśa 廿四分盘',
                 'variants': [('standard', '标准'), ('correct', 'Narasiṃha 偶座逆')]},
                {'chartnum': 30, 'key': 'd30', 'label': 'D30 Triṃśāṃśa 卅分盘',
                 'variants': [('standard', '标准 不等分'), ('equal', '等分 1°')]},
            ]
            planets = (const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                       const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE)
            charts = []
            for sc in schemes:
                rows = []
                has_diff = False
                for pid in planets:
                    pobj = safe_get(self.d1_chart, pid)
                    if pobj is None:
                        continue
                    d1_lon = float(pobj.lon) % 360.0
                    cells = []
                    for vk, _vlabel in sc['variants']:
                        sidx = sign_index_from_lon(
                            varga_position(d1_lon, sc['chartnum'], None if vk == 'standard' else vk))
                        sign = const.LIST_SIGNS[sidx]
                        cells.append({'variant': vk, 'sign': sign, 'signLabel': SIGN_CN.get(sign, sign)})
                    differs = len({c['sign'] for c in cells}) > 1
                    has_diff = has_diff or differs
                    rows.append({'planet': pid, 'cells': cells, 'differs': differs})
                charts.append({
                    'chartnum': sc['chartnum'], 'key': sc['key'], 'label': sc['label'],
                    'variants': [{'key': k, 'label': l} for k, l in sc['variants']],
                    'planets': rows, 'hasDifference': has_diff,
                    'selected': self.varga_variant_map.get(sc['chartnum']) or 'standard',
                })
            return {
                'available': True,
                'charts': charts,
                'note': '分盘变体对照:同曜在各流派分盘落座可异;标准 Parāśara 为默认。含 Kashinatha/Somanatha 等变体。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}
