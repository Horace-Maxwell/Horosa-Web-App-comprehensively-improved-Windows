"""JyotishEngine 的寿命族方法(由 jyotish_engine.py 整段搬出;JyotishEngine 类仍在 astrostudy.india.jyotish_engine,经继承取得)。"""
from flatlib import const
from astrostudy.india.yoga_engine import safe_get
from astrostudy.india.jyotish_parts.tables import JYOTISH_PLANETS, OWN_SIGNS
from astrostudy.india.primitives import segment_index


class AyurdayaMixin:
    """寿命族:三法寿命 / 最终寿命(配对裁决)/ 削减。"""

    # Āyurdāya(寿命)Piṇḍāyu:满寿(深庙旺)年 + 庙旺点黄经(度)。落陷=庙旺+180°,半值。
    PINDAYU_FULL = {const.SUN: 19, const.MOON: 25, const.MARS: 15, const.MERCURY: 12,
                    const.JUPITER: 15, const.VENUS: 21, const.SATURN: 20}
    PINDAYU_EXALT_LON = {const.SUN: 10.0, const.MOON: 33.0, const.MARS: 298.0,
                         const.MERCURY: 165.0, const.JUPITER: 95.0, const.VENUS: 357.0,
                         const.SATURN: 200.0}
    # Nisargāyu 自然寿年(VERIFIED 多源;Sun=20 异于 Piṇḍāyu 19)。
    NISARGAYU_YEARS = {const.SUN: 20, const.MOON: 1, const.MARS: 2, const.MERCURY: 9,
                       const.JUPITER: 18, const.VENUS: 20, const.SATURN: 50}

    def ayurdaya(self):
        """Āyurdāya 寿命基础贡献。Piṇḍāyu(Grahadatta)度式:每曜贡献 = 满寿 ×(½+½(180−|A−180|)/180),
        A=曜黄经距其落陷点的弧(庙旺满、落陷半、线性内插);7 曜和 = 基础 Piṇḍāyu(未施 haraṇa)。
        另列 Nisargāyu 自然寿表 + 强者定法说明。haraṇa(敌座⅓/合日½/Chakrapata/Krurodaya)门派分歧大,
        本视图给『基础值』并标注未施减,不臆断。零回归:纯新增 compute 键。"""
        try:
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土'}
            contribs = []
            base = 0.0
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN]:
                # 🔴 寿命法是 D1 量:恒取 d1_chart(同块 harana/vargottama 本就恒 D1)。
                # 曾用 self.chart → 切分盘时 pindayu/amsayu 随分盘漂移,与 harana 自相矛盾。
                obj = safe_get(self.d1_chart, pid)
                if obj is None:
                    continue
                full = self.PINDAYU_FULL[pid]
                debil = (self.PINDAYU_EXALT_LON[pid] + 180.0) % 360.0
                a = (float(obj.lon) - debil) % 360.0                  # 距落陷弧
                frac = 0.5 + 0.5 * (180.0 - abs(a - 180.0)) / 180.0    # 落陷½→庙旺1
                years = full * frac
                base += years
                contribs.append({
                    'planet': pid, 'planetCN': CN[pid], 'fullYears': full,
                    'exaltLon': self.PINDAYU_EXALT_LON[pid],
                    'lon': float(obj.lon) % 360.0,
                    'arcFromDebil': a, 'fraction': round(frac, 4),
                    'years': round(years, 3),
                })
            nis = [{'planet': p, 'planetCN': CN[p], 'years': self.NISARGAYU_YEARS[p]}
                   for p in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                             const.JUPITER, const.VENUS, const.SATURN]]
            # Aṁśāyu(Satyacharya ÷200 式):每曜 base=(自白羊总角分/200)%12(≤12);Bharaṇa 增:
            # ×3(庙旺 或 逆行)、×2(自座 或 vargottama),两适只取 ×3(多数派)。haraṇa 同标注未施。
            from astrostudy.india.primitives import is_vargottama as _is_varg
            ams = []
            ams_total = 0.0
            ams_total_bphs = 0.0
            ams_total_mul = 0.0
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN]:
                o = safe_get(self.d1_chart, pid)   # 同上:Aṁśāyu 亦恒 D1
                if o is None:
                    continue
                base_y = ((float(o.lon) % 360.0) * 60.0 / 200.0) % 12.0
                dig = self.dignity(pid, o.sign, o.signlon)
                exalt = dig in ('exaltation', 'deep_exaltation')
                retro = getattr(o, 'movedir', None) == 'Retrograde'
                d1o = safe_get(self.d1_chart, pid)
                varg = bool(d1o and _is_varg(d1o.lon, 9))
                own = o.sign in OWN_SIGNS.get(pid, set())
                mult = 3 if (exalt or retro) else (2 if (own or varg) else 1)        # 多数派(默认):庙旺/逆×3·自座/vargottama×2·取最高
                mult_bphs = 3 if (exalt or own) else 1                               # BPHS-literal:svakṣetra 入×3组,略逆/vargottama
                mult_mul = (6 if ((exalt or retro) and (own or varg))               # Sārāvalī 相乘:×3 与 ×2 合并 →×6
                            else (3 if (exalt or retro) else (2 if (own or varg) else 1)))
                y = base_y * mult
                ams_total += y
                ams_total_bphs += base_y * mult_bphs
                ams_total_mul += base_y * mult_mul
                ams.append({'planet': pid, 'planetCN': CN[pid], 'baseYears': round(base_y, 3),
                            'multiplier': mult, 'multiplierBphs': mult_bphs, 'multiplierMul': mult_mul,
                            'years': round(y, 3)})
            return {
                'available': True,
                'pindayu': {
                    'method': 'Piṇḍāyu (Grahadatta)',
                    'contributions': contribs,
                    'baseYears': round(base, 2),
                    'note': '7 曜度式基础贡献和(未施 haraṇa 减);满寿表 Sun19/Moon25/Mars15/Mer12/Jup15/Ven21/Sat20。',
                },
                'nisargayu': {
                    'method': 'Nisargāyu (自然寿)',
                    'naturalYears': nis,
                    'totalYears': 120,
                    'note': '自然寿表(Sun20/Moon1/Mars2/Mer9/Jup18/Ven20/Sat50=120);全期派原样不施 haraṇa。',
                },
                'amsayu': {
                    'method': 'Aṁśāyu (Satyacharya ÷200)',
                    'contributions': ams,
                    'baseYears': round(ams_total, 2),
                    'bharanaVariants': [
                        {'key': 'majority', 'label': '多数派(svakṣetra×2·庙旺/逆×3·取最高)', 'baseYears': round(ams_total, 2)},
                        {'key': 'bphs', 'label': 'BPHS-literal(svakṣetra×3·略逆/vargottama)', 'baseYears': round(ams_total_bphs, 2)},
                        {'key': 'multiply', 'label': 'Sārāvalī 相乘(×3·×2 合并→×6)', 'baseYears': round(ams_total_mul, 2)},
                    ],
                    'note': '每曜 base=(自白羊角分/200)%12(≤12);Bharaṇa 分组/合并门派分歧→三选项:多数派(默认)/BPHS-literal/Sārāvalī相乘;未施 haraṇa。',
                },
                'methodSelection': '强者定法:Lagna 强→Aṁśāyu、Sun 强→Piṇḍāyu、Moon 强→Nisargāyu(以 bala 比强;本视图列候选不自动选)。',
                'haranaNote': 'haraṇa 减(敌座⅓/合日½/Chakrapata/Krurodaya)门派分歧大;基础值未施,见下 harana 块的流派选项。',
                # 敌座豁免开关此前只进判读卡(ayurdaya_final),基础视图这两处 haraṇa 恒按缺省
                # 'retrograde' 算 → 同页两卡口径不一、快照「寿命基础」不跟开关。与判读卡同源读 dasha_variants。
                'harana': self._ayurdaya_harana(satruksetra_exemption=(self.dasha_variants or {}).get('satruksetraExemption', 'retrograde')),
                'haranaNisarga': self._ayurdaya_harana(self.NISARGAYU_YEARS, 'Nisargāyu', raw_total=120.0,
                                                       satruksetra_exemption=(self.dasha_variants or {}).get('satruksetraExemption', 'retrograde')),
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def ayurdaya_final(self):
        """Āyurdāya 判读层(全量):方法自动选定 + 开关化 haraṇa 并入总值 + 寿命档 +
        三对法离散寿数 + maraka 致死大运投影 + 22nd Drekkana/64th Navamsa。
        🔴 呈现纪律:风险窗口/因子清单语气,仅信息·非处方,不作个人断言。附加输出键零回归。"""
        try:
            dv = self.dasha_variants
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土',
                  const.NORTH_NODE: '罗', const.SOUTH_NODE: '计'}
            SOLAR = 360.0 / 365.0
            asc = self.d1_asc
            if asc is None:
                return {'available': False, 'reason': 'missing_lagna'}
            # ── 方法选定(43.30-31:{Lagna,日,月}最强 → Amsayu/Pindayu/Nisargayu)。
            # 强度判据按「尊位级+座内推进度」简化口径(原典未给逐级表;Lagna 以其主代比),注明。
            DIG_RANK = {'deep_exaltation': 5, 'exaltation': 5, 'moolatrikona': 4,
                        'own_sign': 3, 'neutral': 2, 'debilitation': 1}
            def _score(pid):
                o = safe_get(self.d1_chart, pid)
                if o is None:
                    return -1.0
                try:
                    dig = self.dignity(pid, o.sign, o.signlon)
                except Exception:
                    dig = 'neutral'
                return DIG_RANK.get(dig, 2) * 100.0 + float(o.signlon)
            from astrostudy.india.rasi_dasha import SIGN_LORDS as _SL
            lag_lord = _SL.get(asc.sign)
            scores = {'lagna': _score(lag_lord) if lag_lord else -1.0,
                      'sun': _score(const.SUN), 'moon': _score(const.MOON)}
            auto_pick = max(scores, key=lambda k: scores[k])
            AUTO_METHOD = {'sun': 'pindayu', 'moon': 'nisargayu', 'lagna': 'amsayu'}
            method_override = dv.get('ayurdayaMethod', 'auto')
            selected = AUTO_METHOD[auto_pick] if method_override == 'auto' else method_override
            # ── 三法「开关化管线」总值。
            satru = dv.get('satruksetraExemption', 'retrograde')
            kruro_mode = dv.get('krurodayaDenominator', 'zodiac21600')
            def _final_of(harana_res, no_harana=False, raw_total=None):
                if not harana_res or not harana_res.get('available'):
                    return None
                if no_harana:
                    base = raw_total if raw_total is not None else harana_res['baseSum']
                    sav = base + harana_res['lagnaAyu']
                else:
                    kr = harana_res['krurodaya']
                    kd = kr['formulaA'] if kruro_mode == 'zodiac21600' else kr['formulaB']
                    sav = harana_res['sumReduced'] - kd + harana_res['lagnaAyu']
                return {'savanaYears': round(sav, 2), 'solarYears': round(sav * SOLAR, 2)}
            pind_h = self._ayurdaya_harana(satruksetra_exemption=satru)
            finals = {'pindayu': _final_of(pind_h)}
            nis_mode = dv.get('nisargayuHarana', 'pindayu_like')   # 缺省同 Pindayu 施减(与 dasha_variants 缺省同源)
            nis_h = self._ayurdaya_harana(self.NISARGAYU_YEARS, 'Nisargāyu', raw_total=120.0,
                                          satruksetra_exemption=satru)
            finals['nisargayu'] = _final_of(nis_h, no_harana=(nis_mode == 'none'), raw_total=120.0)
            # Amsayu:base×bharana(#倍数开关)→ 同管线(无 Krurodaya·落陷减半)
            from astrostudy.india.primitives import is_vargottama as _is_varg
            amult = dv.get('amsayuMultiplier', 'majority_highest')
            ams_map = {}
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN]:
                o = safe_get(self.d1_chart, pid)
                if o is None:
                    continue
                base_y = ((float(o.lon) % 360.0) * 60.0 / 200.0) % 12.0
                try:
                    dig = self.dignity(pid, o.sign, o.signlon)
                except Exception:
                    dig = 'neutral'
                exalt = dig in ('exaltation', 'deep_exaltation')
                retro = getattr(o, 'movedir', None) == 'Retrograde'
                d1o = safe_get(self.d1_chart, pid)
                varg = bool(d1o and _is_varg(d1o.lon, 9))
                own = o.sign in OWN_SIGNS.get(pid, set())
                if amult == 'bphs_literal':
                    mult = 3 if (exalt or own) else 1
                elif amult == 'saravali_multiply':
                    mult = (6 if ((exalt or retro) and (own or varg))
                            else (3 if (exalt or retro) else (2 if (own or varg) else 1)))
                else:
                    mult = 3 if (exalt or retro) else (2 if (own or varg) else 1)
                ams_map[pid] = base_y * mult
            ams_h = self._ayurdaya_harana(method_label='Aṁśāyu', base_map=ams_map,
                                          satruksetra_exemption=satru,
                                          apply_krurodaya=False, neecha_half=True)
            finals['amsayu'] = _final_of(ams_h)
            sel_final = finals.get(selected)
            # ── 寿命档(#边界开关)。
            bounds_mode = dv.get('ayuClassBoundaries', 'bphs_32_64_120')
            mid_hi = 64.0 if bounds_mode == 'bphs_32_64_120' else 70.0
            def _classify(y):
                if y is None:
                    return None
                if y < 8:
                    return {'key': 'balarishta', 'label': '婴夭险段(0-8)'}
                if y < 20:
                    return {'key': 'yogarishta', 'label': '少亡险段(8-20)'}
                if y < 32:
                    return {'key': 'alpa', 'label': '短寿 Alpa(≤32)'}
                if y < mid_hi:
                    return {'key': 'madhya', 'label': '中寿 Madhya(32-%d)' % int(mid_hi)}
                if y <= 120:
                    return {'key': 'purna', 'label': '长寿 Purna(%d-120)' % int(mid_hi)}
                return {'key': 'divya', 'label': '神寿 Divya(>120)'}
            final_years = sel_final['solarYears'] if sel_final else None
            # ── 三对法离散寿数(读票映射:长3/2/1→120/108/91;中3/2/1→80/72/64;短3/2/1→32/36/40)。
            tri = self._jaimini_ayur_tri_pair()
            tri_years = None
            if tri and tri.get('available') is not False and tri.get('votes'):
                v = tri['votes']
                L, M, S = int(v.get('purna', 0)), int(v.get('madhya', 0)), int(v.get('alpa', 0))
                if L > 0:
                    tri_years = {3: 120, 2: 108, 1: 91}[L]
                elif M > 0:
                    tri_years = {3: 80, 2: 72, 1: 64}[M]
                elif S > 0:
                    tri_years = {3: 32, 2: 36, 1: 40}[S]
            # ── maraka 因子清单。
            SIGN_IDX = {sg: i for i, sg in enumerate(const.LIST_SIGNS)}
            lag_i = SIGN_IDX[asc.sign]
            second_sign = const.LIST_SIGNS[(lag_i + 1) % 12]
            seventh_sign = const.LIST_SIGNS[(lag_i + 6) % 12]
            maraka_lords = sorted({_SL.get(second_sign), _SL.get(seventh_sign)} - {None})
            occupants = []
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY, const.JUPITER,
                        const.VENUS, const.SATURN, const.NORTH_NODE, const.SOUTH_NODE]:
                o = safe_get(self.d1_chart, pid)
                if o and o.sign in (second_sign, seventh_sign):
                    occupants.append(pid)
            maraka_set = set(maraka_lords) | set(occupants)
            # Trishula 座(Rudra + 5 + 9;rasi_dasha.trishoola 现成)。
            tri_signs = None
            try:
                from astrostudy.india.primitives import rudra_candidate_signs as _rcs, trishoola as _trish
                from astrostudy.india.rasi_dasha import stronger_sign as _ss
                ps = {}
                pl = {}
                for pid in JYOTISH_PLANETS:
                    o = safe_get(self.d1_chart, pid)
                    if o:
                        ps[pid] = o.sign
                        pl[pid] = o.lon
                _ra, _rb = _rcs(asc.sign)
                _rudra = _ss(_ra, _rb, ps, None, pl)
                tri_signs = {'rudraSign': _rudra, 'signs': _trish(_rudra)}
            except Exception:
                tri_signs = None
            # 22nd Drekkana / 64th Navamsa(Khara)。
            lag_lon = float(asc.lon) % 360.0
            d3_g0 = int(lag_lon // 10.0)                     # 全局 drekkana 序 0-35
            d3_22 = (d3_g0 + 21) % 36
            d3_sign = const.LIST_SIGNS[d3_22 // 3]
            DREK_LORD_OFFSET = (0, 4, 8)                     # 1st=座主/2nd=第5座主/3rd=第9座主
            d3_lord_sign = const.LIST_SIGNS[(SIGN_IDX[d3_sign] + DREK_LORD_OFFSET[d3_22 % 3]) % 12]
            drek22 = {'sign': d3_sign, 'lord': _SL.get(d3_lord_sign)}
            moon_o = self.d1_moon
            nav_base = float(moon_o.lon) if moon_o is not None else lag_lon
            n0 = segment_index(nav_base % 360.0, 30.0 / 9.0, 108)     # 全局 navamsa 序 0-107(精确段界归后一段)
            n64 = (n0 + 63) % 108
            nav_sign = const.LIST_SIGNS[n64 % 12]
            nav64 = {'sign': nav_sign, 'lord': _SL.get(nav_sign), 'basis': 'moon' if moon_o is not None else 'lagna'}
            # ── 致死运投影:寿龄落 Vimshottari 轴(大运/中运)。
            projection = None
            if final_years is not None:
                try:
                    vim = self.vimshottari()
                    tgt = float(final_years)
                    for m in (vim.get('mahadashas') or []):
                        sa, ea = m.get('startAge'), m.get('endAge')
                        if sa is None or ea is None:
                            continue
                        if sa <= tgt < ea:
                            proj = {'mahaLord': m.get('lord'), 'mahaStartAge': sa, 'mahaEndAge': ea,
                                    'mahaIsMaraka': bool((m.get('lord') or {}).get('id') in maraka_set)}
                            for ad in (m.get('antardashas') or []):
                                asa, aea = ad.get('startAge'), ad.get('endAge')
                                if asa is not None and aea is not None and asa <= tgt < aea:
                                    proj['antarLord'] = ad.get('lord')
                                    proj['antarIsMaraka'] = bool((ad.get('lord') or {}).get('id') in maraka_set)
                                    break
                            projection = proj
                            break
                except Exception:
                    projection = None
            return {
                'available': True,
                'methodSelection': {
                    'auto': AUTO_METHOD[auto_pick],
                    'override': method_override,
                    'selected': selected,
                    'scores': {k: round(v, 2) for k, v in scores.items()},
                    'note': '强度判据按尊位级+座内推进度简化口径(Lagna 以其主代比);可手动指定法覆盖',
                },
                'finals': finals,
                'selectedFinal': sel_final,
                'ayuClass': _classify(final_years),
                'classBoundaries': bounds_mode,
                'triPairYears': tri_years,
                'triPairVotes': (tri or {}).get('votes'),
                'triPairNote': '离散寿数按三票读表(长3/2/1→120/108/91;中→80/72/64;短→32/36/40);'
                               '木星升档/土星降档修正之触发条件权威未详,未施',
                'maraka': {
                    'sthana': {'second': second_sign, 'seventh': seventh_sign},
                    'lords': maraka_lords,
                    'occupants': occupants,
                    'planets': sorted(maraka_set),
                },
                'trishula': tri_signs,
                'drekkana22': drek22,
                'navamsa64': nav64,
                'chhidraNote': 'Chhidra 脆弱窗定义权威未详 → 不输出(不臆造)',
                'projection': projection,
                'disclaimer': '仅信息·非处方:风险窗口与因子清单,不构成对任何个人的生死断言',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}

    def _ayurdaya_harana(self, full_table=None, method_label='Piṇḍāyu', raw_total=None,
                         satruksetra_exemption='retrograde', base_map=None,
                         apply_krurodaya=True, neecha_half=False):
        """Āyurdāya haraṇa(减)逐项 — 古法减寿全规则。施于 Piṇḍāyu(度式)或 Nisargāyu:
        敌座(Śatrukṣetra)⅓ 与合日(Astangata)½ 只取大者(BPHS 43.22 max;逆行免敌座、金/土免合日);
        Chakrapata 可见半球(自 Lagna 12/11/10/9/8/7 宫)凶星按表损·吉星半,独立连乘;
        Krurodaya(凶升 Lagna)对总和一次(式A 角分/21600 默认、式B navāṁśa/108 变体);
        +Lagna_Ayu=(Lagna 座内角分)/200;末 ×360/365 Savana→Solar。
        『做成不同流派选项』:未减(全期/Rath)vs 施减(技术/Sārāvalī)·Krurodaya A/B。
        full_table=贡献满寿表(Piṇḍāyu 默认);raw_total 给「全期派原值」(Nisargāyu=120,按流派开关)。
        恒 D1 算。零回归:纯新增子键。"""
        try:
            if full_table is None:
                full_table = self.PINDAYU_FULL
            from astrostudy.india.primitives import is_combust, natural_relation, house_distance
            from astrostudy.india.rasi_dasha import SIGN_LORDS
            CN = {const.SUN: '日', const.MOON: '月', const.MARS: '火', const.MERCURY: '水',
                  const.JUPITER: '木', const.VENUS: '金', const.SATURN: '土'}
            CHAKRA_KRURA = {12: 1.0, 11: 0.5, 10: 1.0 / 3, 9: 0.25, 8: 0.2, 7: 1.0 / 6}
            asc = self.d1_asc
            if asc is None:
                return {'available': False, 'reason': 'missing_lagna'}
            sun = safe_get(self.d1_chart, const.SUN)
            sun_lon = float(sun.lon) if sun else None
            moon = safe_get(self.d1_chart, const.MOON)
            moon_waning = bool(moon is not None and sun is not None
                               and (((float(moon.lon) - float(sun.lon)) % 360.0) > 180.0))   # 残月=Krishna paksha
            mal_signs = set()
            for mp in (const.SUN, const.MARS, const.SATURN):
                mo = safe_get(self.d1_chart, mp)
                if mo is not None:
                    mal_signs.add(mo.sign)

            def is_malefic(pid, sign):
                if pid in (const.SUN, const.MARS, const.SATURN):
                    return True
                if pid == const.MOON:
                    return moon_waning
                if pid == const.MERCURY:
                    return sign in mal_signs   # 恶配水星(与凶同座)
                return False

            rows = []
            sum_reduced = 0.0
            base_sum = 0.0
            krurodaya_planet = None
            for pid in [const.SUN, const.MOON, const.MARS, const.MERCURY,
                        const.JUPITER, const.VENUS, const.SATURN]:
                obj = safe_get(self.d1_chart, pid)
                if obj is None:
                    continue
                if base_map is not None:
                    if pid not in base_map:
                        continue
                    base_y = float(base_map[pid])       # 直供口径(Amsayu:base×bharana 后)
                else:
                    full = full_table[pid]
                    debil = (self.PINDAYU_EXALT_LON[pid] + 180.0) % 360.0
                    a = (float(obj.lon) - debil) % 360.0
                    base_y = full * (0.5 + 0.5 * (180.0 - abs(a - 180.0)) / 180.0)
                base_sum += base_y
                retro = getattr(obj, 'movedir', None) == 'Retrograde'
                lord = SIGN_LORDS.get(obj.sign)
                enemy_sign = bool(lord and lord != pid and natural_relation(pid, lord) == 'enemy')
                # 敌座豁免两读:vakra=逆行(多数,默认) / vakra=火星(变体:火星在敌座亦免)。
                if satruksetra_exemption == 'mars':
                    shatru = enemy_sign and pid != const.MARS
                else:
                    shatru = enemy_sign and not retro              # 逆行免敌座
                combust = bool(sun_lon is not None and pid not in (const.VENUS, const.SATURN)
                               and is_combust(pid, float(obj.lon), sun_lon, retro))   # 金/土免合日
                dignity_harana = max(1.0 / 3 if shatru else 0.0, 0.5 if combust else 0.0)   # 只取大者,绝不并施
                if neecha_half:
                    # Amsayu 附加:落陷减半(与尊位减取大者合并前独立;按同法连乘口径并入)
                    try:
                        if self.dignity(pid, obj.sign, obj.signlon) == 'debilitation':
                            dignity_harana = max(dignity_harana, 0.5)
                    except Exception:
                        self._note_partial('ayurdaya.neechaHalf')
                house = house_distance(asc.sign, obj.sign)
                chakra = 0.0
                if house in CHAKRA_KRURA:
                    chakra = CHAKRA_KRURA[house] if is_malefic(pid, obj.sign) else CHAKRA_KRURA[house] / 2.0
                reduced = base_y * (1.0 - dignity_harana) * (1.0 - chakra)
                sum_reduced += reduced
                if house == 1 and is_malefic(pid, obj.sign) and krurodaya_planet is None:
                    krurodaya_planet = pid
                rows.append({
                    'planet': pid, 'planetCN': CN[pid], 'baseYears': round(base_y, 3),
                    'enemySign': enemy_sign, 'combust': combust,
                    'dignityHarana': round(dignity_harana, 3), 'house': house,
                    'chakrapata': round(chakra, 4), 'reducedYears': round(reduced, 3),
                })
            # Krurodaya 缓和(古法):吉星望 Lagna → 减半(吉星在7宫冲、或木星在5/9宫特殊相;Indira 例 Moon 望致 Saturn 减半)。
            kruro_mitigated = False
            if krurodaya_planet:
                for bp in (const.JUPITER, const.VENUS, const.MERCURY, const.MOON):
                    bo = safe_get(self.d1_chart, bp)
                    if bo is None:
                        continue
                    if bp == const.MERCURY and bo.sign in mal_signs:
                        continue          # 恶配水星不作吉
                    if bp == const.MOON and moon_waning:
                        continue          # 残月不作吉
                    bh = house_distance(asc.sign, bo.sign)
                    if bh == 7 or (bp == const.JUPITER and bh in (5, 9)):   # 望 Lagna(7宫冲 / 木5·9特殊相)
                        kruro_mitigated = True
                        break
            if not apply_krurodaya:
                krurodaya_planet = None                 # Amsayu 不施 Krurodaya
            mit = 0.5 if kruro_mitigated else 1.0
            asc_arcmin = (float(asc.lon) % 30.0) * 60.0
            kruro_a = sum_reduced * asc_arcmin / 21600.0 * mit if krurodaya_planet else 0.0
            navamsa_count = segment_index(float(asc.lon) % 360.0, 30.0 / 9.0, 108) + 1   # 自白羊 navāṁśa 数 1-108
            kruro_b = sum_reduced * navamsa_count / 108.0 * mit if krurodaya_planet else 0.0
            lagna_ayu = asc_arcmin / 200.0
            SOLAR = 360.0 / 365.0
            final_a = sum_reduced - kruro_a + lagna_ayu
            final_b = sum_reduced - kruro_b + lagna_ayu
            # 全期派原值:Nisargāyu 用 raw_total(=120,全期派不施缩放/haraṇa);Piṇḍāyu 无 raw→用 scaled 未减和。
            full_base = raw_total if raw_total is not None else base_sum
            profiles = [
                {'key': 'noharana', 'label': '未减·全期派(传承)',
                 'savanaYears': round(full_base + lagna_ayu, 2),
                 'solarYears': round((full_base + lagna_ayu) * SOLAR, 2)},
                {'key': 'harana_a', 'label': '施减·式A 角分(技术派/Sārāvalī)',
                 'savanaYears': round(final_a, 2), 'solarYears': round(final_a * SOLAR, 2)},
                {'key': 'harana_b', 'label': '施减·式B navāṁśa',
                 'savanaYears': round(final_b, 2), 'solarYears': round(final_b * SOLAR, 2)},
            ]
            return {
                'available': True,
                'method': method_label,
                'planets': rows,
                'baseSum': round(base_sum, 3),
                'sumReduced': round(sum_reduced, 3),
                'krurodaya': {'applies': krurodaya_planet is not None,
                              'planetCN': (CN.get(krurodaya_planet) if krurodaya_planet else None),
                              'mitigated': kruro_mitigated,
                              'formulaA': round(kruro_a, 3), 'formulaB': round(kruro_b, 3)},
                'lagnaAyu': round(lagna_ayu, 3),
                'profiles': profiles,
                'note': 'Piṇḍāyu haraṇa:敌座⅓/合日½取大者(逆免敌·金土免合)·Chakrapata可见半球(12→1·11→½·10→⅓·9→¼·8→1/5·7→1/6,吉星半)独立·Krurodaya总和一次(吉星望Lagna减半);未施「一宫只取最强」与Krurodaya「吉在Lagna远近」细分(标注)。',
            }
        except Exception as exc:
            return {'available': False, 'reason': str(exc)}
