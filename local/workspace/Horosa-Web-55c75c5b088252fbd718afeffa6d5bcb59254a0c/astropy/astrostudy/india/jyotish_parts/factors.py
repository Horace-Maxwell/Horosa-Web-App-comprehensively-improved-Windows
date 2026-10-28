"""JyotishEngine 的盘面因子方法(由 jyotish_engine.py 整段搬出;JyotishEngine 类仍在 astrostudy.india.jyotish_engine,经继承取得)。"""
from flatlib import const
from astrostudy.india.yoga_engine import build_yogas, house_number, safe_get
from astrostudy.india.primitives import MOOLATRIKONA, PLANET_CN, SIGN_CN
from astrostudy.nakshatra import nakshatra_from_lon
from astrostudy.india.jyotish_parts.tables import JYOTISH_PLANETS, OWN_SIGNS, EXALTATION
from astrostudy.india.jyotish_parts.helpers import sign_index_from_lon


class FactorsMixin:
    """盘面因子:补救 / 功能吉凶 / 宫力 / 星战 / 夹宫 / 三盘同参 / 友敌 / 外行星 / 星宿 / 瑜伽 / 相位 / 尊贵 / 附属上升 / 阿鲁达 / 行运 / 合盘壳。"""

    def remedies(self):
        """补救(宝石/化解)：取需增力的弱曜(落陷/燃烧)→ 宝石建议。恒以 D1 盘算。"""
        try:
            from astrostudy.india.remedies import compute as remedies_compute
            from astrostudy.india.primitives import is_combust
            weak = []
            sun_lon = getattr(self.d1_sun, 'lon', None)
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(self.d1_chart, obj_id)
                if not obj:
                    continue
                dignity = self.dignity(obj_id, obj.sign, obj.signlon)
                retro = getattr(obj, 'movedir', None) == 'Retrograde'
                combust = bool(sun_lon is not None and is_combust(obj_id, obj.lon, sun_lon, retro))
                if dignity == 'debilitation' or combust:
                    weak.append(obj_id)
            return remedies_compute(weak)
        except Exception:
            return {'available': False}

    def functional_nature(self):
        """行星功能吉凶(按上升分类:吉/凶/中/Yogakaraka/Maraka/Badhaka)。**以当前显示盘算**
        (chartnum==1 时即 D1;分盘时按该分盘的上升/星座,使右边栏随显示盘变化)。"""
        try:
            from astrostudy.india.functional_nature import functional_nature as _fn
            if not self.asc:
                return {'available': False}
            planet_signs = {}
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(self.chart, obj_id)
                if obj:
                    planet_signs[obj_id] = obj.sign
            return {'available': True, 'lagnaSign': self.asc.sign,
                    'grahas': _fn(self.asc.sign, planet_signs)}
        except Exception:
            return {'available': False}

    def bhava_bala(self):
        """宫力 Bhava Bala(宫主力+方位力+受视力+居宫星力)。**以当前显示盘算**。复用 shadbala_bphs 六力。"""
        try:
            from astrostudy.india import bhava_bala as bb
            if not self.asc:
                return {'available': False}
            planet_signs, planet_lons = {}, {}
            for obj_id in (const.SUN, const.MOON, const.MARS, const.MERCURY,
                           const.JUPITER, const.VENUS, const.SATURN):
                o = safe_get(self.chart, obj_id)
                if o is not None:
                    planet_signs[obj_id] = o.sign
                    planet_lons[obj_id] = float(o.lon)
            return bb.bhava_bala(lagna_sign=self.asc.sign,
                                 planet_shadbala=self.shadbala_bphs(),
                                 planet_lons=planet_lons, planet_signs=planet_signs)
        except Exception:
            return {'available': False}

    def graha_yuddha(self):
        """行星战争(Graha Yuddha):两星 <1° 同宫即战;纬度更北者胜,败者力损。仅五星参战。
        **恒以 D1**(真黄经 / 真黄纬的物理近合;分盘伪经度相距 1° 不是星战)。"""
        try:
            war_ids = [const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN]
            objs = [(p, safe_get(self.d1_chart, p)) for p in war_ids]
            objs = [(p, o) for p, o in objs if o]
            pairs = []
            for i in range(len(objs)):
                for j in range(i + 1, len(objs)):
                    pa, oa = objs[i]
                    pb, ob = objs[j]
                    if oa.sign != ob.sign:
                        continue
                    sep = abs(float(oa.lon) - float(ob.lon)) % 360.0
                    sep = min(sep, 360.0 - sep)
                    if sep < 1.0:
                        if self.yuddha_criterion == 'longitude':
                            # 另说:黄经较小(更西/先到)者胜
                            winner, loser = (pa, pb) if float(oa.lon) <= float(ob.lon) else (pb, pa)
                        else:
                            la = float(getattr(oa, 'lat', 0.0) or 0.0)
                            lb = float(getattr(ob, 'lat', 0.0) or 0.0)
                            winner, loser = (pa, pb) if la >= lb else (pb, pa)
                        pairs.append({'a': pa, 'aLabel': PLANET_CN.get(pa, pa),
                                      'b': pb, 'bLabel': PLANET_CN.get(pb, pb),
                                      'winner': winner, 'winnerLabel': PLANET_CN.get(winner, winner),
                                      'loser': loser, 'loserLabel': PLANET_CN.get(loser, loser),
                                      'sepDeg': round(sep, 3)})
            return {'available': True, 'pairs': pairs, 'criterion': self.yuddha_criterion, 'basis': 'd1'}
        except Exception:
            return {'available': False}

    def _d1_planet_signs(self):
        """D1 各曜星座 {planet_id: sign}(供 Sudarshana 等**本命**三盘视图复用,恒 D1)。"""
        out = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.d1_chart, obj_id)
            if obj:
                out[obj_id] = obj.sign
        return out

    def _planet_signs(self):
        """**当前显示盘**各曜星座 {planet_id: sign}(供 Kartari 夹宫等随显示盘变化的位置格局复用)。
        敌友(Pañcadhā Maitrī)不用它:临时友敌是出生 D1 的宫位关系,恒取 _d1_planet_signs。"""
        out = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if obj:
                out[obj_id] = obj.sign
        return out

    def kartari(self):
        """QW4 Kartari 夹击格局(吉夹 Shubha / 凶夹 Papa):某宫曜被前后相邻宫所夹。**以当前显示盘算**。"""
        try:
            from astrostudy.india.kartari import kartari_yogas
            if not self.asc:
                return {'available': False}
            return kartari_yogas(self._planet_signs(), self.asc.sign)
        except Exception:
            return {'available': False}

    def sudarshana(self):
        """QW4 Sudarshana Chakra 三盘合参(命/日/月分别为上升,同断一事三方印证)。恒 D1。"""
        try:
            from astrostudy.india.sudarshana import sudarshana_chakra
            if not self.d1_asc:
                return {'available': False}
            return sudarshana_chakra(
                self._d1_planet_signs(), self.d1_asc.sign,
                getattr(self.d1_sun, 'sign', None), getattr(self.d1_moon, 'sign', None))
        except Exception:
            return {'available': False}

    def graha_maitri(self):
        """敌友 Pañcadhā Maitrī(复合五分敌友 7×7 矩阵,非对称)+ Jaimini Rāśi Dṛṣṭi 座相(12×12)。
        **恒以 D1**:临时友敌按出生 D1 的宫位关系(对方在本星起 2/3/4/10/11/12 宫 = 临时友),
        与 Saptavargaja / Viṃśopaka / Jagradādi·Dīptādi 所用复合友敌同一口径;切分盘不变(basis='d1')。
        Rāśi Dṛṣṭi 只是座与座的固定照见表,与盘无关。算法在 primitives,此处只组矩阵。"""
        try:
            from astrostudy.india.primitives import (
                natural_relation, tatkalika_relation, compound_relation, rasi_drishti)
            SEVEN = [const.SUN, const.MOON, const.MARS, const.MERCURY,
                     const.JUPITER, const.VENUS, const.SATURN]
            d1_signs = self._d1_planet_signs()
            planet_signs = {pid: d1_signs[pid] for pid in SEVEN if pid in d1_signs}
            planets = [pid for pid in SEVEN if pid in planet_signs]
            if not planets:
                return {'available': False}
            NAT_CN = {'friend': '友', 'neutral': '中', 'enemy': '敌'}
            TAT_CN = {'friend': '临友', 'enemy': '临敌'}
            COMP_CN = {'adhimitra': '大友', 'mitra': '友', 'sama': '中立',
                       'satru': '敌', 'adhisatru': '大敌'}
            matrix = []
            for a in planets:
                cells = []
                for b in planets:
                    if a == b:
                        cells.append({'planet': b, 'planetLabel': PLANET_CN.get(b, b), 'self': True})
                        continue
                    nat = natural_relation(a, b)
                    tat = tatkalika_relation(a, b, planet_signs)
                    comp = compound_relation(a, b, planet_signs)
                    cells.append({
                        'planet': b, 'planetLabel': PLANET_CN.get(b, b),
                        'natural': nat, 'naturalCn': NAT_CN.get(nat, nat),
                        'temporal': tat, 'temporalCn': TAT_CN.get(tat, '—'),
                        'compound': comp, 'compoundCn': COMP_CN.get(comp, '—'),
                    })
                matrix.append({'planet': a, 'planetLabel': PLANET_CN.get(a, a), 'cells': cells})
            # Jaimini Rāśi Dṛṣṭi 座相(每座照见的座) — Jaimini 古法。
            SIGNS = [const.ARIES, const.TAURUS, const.GEMINI, const.CANCER, const.LEO, const.VIRGO,
                     const.LIBRA, const.SCORPIO, const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES]
            rasi_matrix = []
            for s in SIGNS:
                try:
                    seen = rasi_drishti(s)
                except Exception:
                    seen = []
                rasi_matrix.append({'sign': s, 'signLabel': SIGN_CN.get(s, s),
                                    'aspects': list(seen),
                                    'aspectLabels': [SIGN_CN.get(x, x) for x in seen]})
            return {
                'available': True,
                'basis': 'd1',
                'planets': planets,
                'planetLabels': [PLANET_CN.get(p, p) for p in planets],
                'matrix': matrix,
                'legend': [{'key': k, 'label': v} for k, v in
                           [('adhimitra', '大友'), ('mitra', '友'), ('sama', '中立'), ('satru', '敌'), ('adhisatru', '大敌')]],
                'rasiDrishti': rasi_matrix,
            }
        except Exception:
            return {'available': False}

    def outer_planets(self):
        """外行星 Ur/Ne/Pl(虚星,古籍补编)。内核已算,补输出供副星面板;以当前显示盘算。"""
        try:
            out = []
            for pid, label in [(const.URANUS, '天王 Ur'), (const.NEPTUNE, '海王 Ne'), (const.PLUTO, '冥王 Pl')]:
                o = safe_get(self.chart, pid)
                if not o:
                    continue
                nk = nakshatra_from_lon(o.lon)
                out.append({
                    'id': pid, 'label': label,
                    'sign': o.sign, 'signLabel': SIGN_CN.get(o.sign, o.sign),
                    'signlon': round(float(o.signlon), 2),
                    'house': house_number(o),
                    'nakshatra': nk.get('name'), 'pada': nk.get('pada'),
                    'retrograde': getattr(o, 'movedir', None) == 'Retrograde',
                })
            return {'available': bool(out), 'planets': out}
        except Exception:
            return {'available': False}

    def _nak_with_detail(self, lon):
        """nakshatra_from_lon + 合并 27 宿富属性(种姓/活动/方向/三性/动机/五行/阴阳/神人鬼/身体/象征/主神/yoni)。"""
        nk = dict(nakshatra_from_lon(lon))
        try:
            from astrostudy.india.nakshatra_data import nakshatra_detail_from_lon
            nk['detail'] = nakshatra_detail_from_lon(lon)
        except Exception:
            nk['detail'] = None
        # 28 宿口径(G6):纯增量键,显示/择吉专用。27 宿编号与全部 Dasha/Varga 计算不受影响
        # (Abhijit 恒不入 Vimshottari —— 权威口径,与 primitives 注释一致)。
        try:
            from astrostudy.india.primitives import is_abhijit, nakshatra_number_28, ABHIJIT_LABEL
            nk['isAbhijit'] = bool(is_abhijit(lon))
            nk['number28'] = nakshatra_number_28(lon, nk.get('index'))
            if nk['isAbhijit']:
                nk['abhijitLabel'] = ABHIJIT_LABEL
        except Exception:
            nk['isAbhijit'] = False
            nk['number28'] = nk.get('index')
        return nk

    def yogas(self):
        try:
            return build_yogas(self.perchart)
        except Exception as exc:
            return {
                'available': False,
                'error': str(exc),
            }

    def nakshatras(self):
        result = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if obj:
                result[obj_id] = self._nak_with_detail(obj.lon)
        if self.asc:
            result[const.ASC] = self._nak_with_detail(self.asc.lon)
        return result

    def graha_drishti(self):
        aspects = {
            const.SUN: [7],
            const.MOON: [7],
            const.MARS: [4, 7, 8],
            const.MERCURY: [7],
            const.JUPITER: [5, 7, 9],
            const.VENUS: [7],
            const.SATURN: [3, 7, 10],
            const.NORTH_NODE: [5, 7, 9],
            const.SOUTH_NODE: [5, 7, 9],
        }
        sign_map = self.planet_sign_map()
        result = []
        for giver, houses in aspects.items():
            if giver not in sign_map:
                continue
            giver_sign = sign_map[giver]
            for offset in houses:
                target_sign = (giver_sign + offset - 1) % 12
                receives = [
                    obj_id for obj_id, obj_sign in sign_map.items()
                    if obj_id != giver and obj_sign == target_sign
                ]
                result.append({
                    'giver': giver,
                    'giverLabel': PLANET_CN.get(giver, giver),
                    'aspectHouse': offset,
                    'targetSign': const.LIST_SIGNS[target_sign],
                    'targetSignLabel': SIGN_CN.get(const.LIST_SIGNS[target_sign], const.LIST_SIGNS[target_sign]),
                    'receives': receives,
                })
        return result

    def node_rasi_drishti(self):
        # 节点(罗/计)只取 rasi drishti「主照」，无 graha drishti，与 grahaDrishti 分列。
        # grahaDrishti 里节点仍保留 [5,7,9](零回归);此处另给 rasi drishti 并标注「主照」。
        from astrostudy.india.primitives import rasi_drishti as prim_rasi_drishti
        sign_map = self.planet_sign_map()  # {obj_id: 0-11}
        idx_of = {const.LIST_SIGNS[i]: i for i in range(12)}
        out = []
        for node in (const.NORTH_NODE, const.SOUTH_NODE):
            if node not in sign_map:
                continue
            node_sign = const.LIST_SIGNS[sign_map[node]]
            for tgt_sign in prim_rasi_drishti(node_sign):
                tgt_idx = idx_of[tgt_sign]
                receives = [oid for oid, s in sign_map.items() if oid != node and s == tgt_idx]
                out.append({
                    'giver': node,
                    'giverLabel': PLANET_CN.get(node, node),
                    'kind': 'rasiDrishti',
                    'note': '节点主照(rasi drishti)',
                    'targetSign': tgt_sign,
                    'targetSignLabel': SIGN_CN.get(tgt_sign, tgt_sign),
                    'receives': receives,
                })
        return out

    def planet_sign_map(self):
        result = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.chart, obj_id)
            if obj:
                result[obj_id] = sign_index_from_lon(obj.lon)
        return result

    def dignity(self, obj_id, sign, signlon):
        """尊贵档:单一实现在 primitives.classify_dignity(旺 / 本三角同座两曜按度段分)。"""
        from astrostudy.india.primitives import classify_dignity
        return classify_dignity(obj_id, sign, signlon)

    def varga_dignity(self, planets):
        # Amsa-bala：各 varga 组(Shad/Sapta/Dasa/Shodasavarga)内该曜居 MT/own/旺的分盘数 → amsa 名。
        # 各分盘星座由 D1 经度算(varga_position)，恒以 D1 盘判。
        from astrostudy.india.varga import varga_position
        from astrostudy.india.primitives import amsa_bala, VARGA_GROUPS, SHODASAVARGA, sign_of_lon
        dignified_set = {'deep_exaltation', 'exaltation', 'moolatrikona', 'own_sign'}
        out = []
        for item in planets:
            obj_id = item['id']
            row = {'id': obj_id, 'label': item['label'], 'd1': item['dignity']}
            d1_obj = safe_get(self.d1_chart, obj_id)
            if d1_obj is not None:
                d1_lon = float(d1_obj.lon)
                dignified = set()
                for v in SHODASAVARGA:
                    vlon = varga_position(d1_lon, v, self.varga_variant_map.get(v))
                    if self.dignity(obj_id, sign_of_lon(vlon), vlon % 30.0) in dignified_set:
                        dignified.add(v)
                row['amsa'] = {g: amsa_bala(dignified, g) for g in VARGA_GROUPS}
            out.append(row)
        return out

    def supplementary_lagnas(self):
        """补充上升族(月上升 / 烹煮上升 / Karakamsa / Swamsa / 行星参照点)。恒以 D1 盘算。

        Karakamsa = Atmakaraka(AK) 的 navamsa(D9)星座；AK 取 jaimini() charaKarakas 中
        karaka=='Atmakaraka'(label 'AK')那条的行星。D9 复用 varga_position(lon, 9)，不另算。
        失败 → {'available': False}。"""
        try:
            from astrostudy.india.supplementary_lagna import compute_supplementary_lagnas
            from astrostudy.india.varga import varga_position
            from astrostudy.india.primitives import sign_of_lon
            if not self.d1_asc:
                return {'available': False}
            lagna_sign = self.d1_asc.sign
            moon_sign = getattr(self.d1_moon, 'sign', None)

            # 上升主星所居星座(供 Paaka Lagna)：上升主用 D1 盘该行星星座。
            from astrostudy.india.arudha import SIGN_LORDS
            lagna_lord_id = SIGN_LORDS.get(lagna_sign)
            lagna_lord_obj = safe_get(self.d1_chart, lagna_lord_id) if lagna_lord_id else None
            lagna_lord_sign = getattr(lagna_lord_obj, 'sign', None)

            # AK → 其 D1 黄经 → D9 星座(Karakamsa)。
            ak_navamsa_sign = None
            karakas = (self.jaimini() or {}).get('charaKarakas') or []
            ak_row = next(
                (k for k in karakas
                 if k.get('karaka') == 'Atmakaraka' or k.get('karakaLabel') == 'AK'),
                None)
            if ak_row is not None:
                ak_obj = safe_get(self.d1_chart, ak_row.get('planet'))
                if ak_obj is not None:
                    ak_navamsa_sign = sign_of_lon(varga_position(float(ak_obj.lon), 9))

            # Graha Lagnas 用 D1 各行星星座。
            planet_signs = {}
            for obj_id in JYOTISH_PLANETS:
                obj = safe_get(self.d1_chart, obj_id)
                if obj:
                    planet_signs[obj_id] = obj.sign

            # Hora Lagna(供 Varṇada):取 upagraha 特殊上升 horaLagna 的座。
            hora_lagna_sign = None
            try:
                _sl = (self.upagraha() or {}).get('specialLagnas') or {}
                _hl = _sl.get('horaLagna')
                if isinstance(_hl, dict) and _hl.get('lon') is not None:
                    hora_lagna_sign = sign_of_lon(float(_hl['lon']))
            except Exception:
                hora_lagna_sign = None

            res = compute_supplementary_lagnas(
                lagna_sign, moon_sign, ak_navamsa_sign,
                planet_signs=planet_signs, lagna_lord_sign=lagna_lord_sign,
                hora_lagna_sign=hora_lagna_sign)
            res['available'] = True
            return res
        except Exception:
            return {'available': False}

    def arudha(self):
        """Arudha pada(12 宫 + AL/UL + graha pada)+ Argala。恒以 D1 盘算(natal)。"""
        from astrostudy.india.arudha import compute_arudha
        if not self.d1_asc:
            return {'available': False}
        planet_signs = {}
        planet_lons = {}
        for obj_id in JYOTISH_PLANETS:
            obj = safe_get(self.d1_chart, obj_id)
            if obj:
                planet_signs[obj_id] = obj.sign
                planet_lons[obj_id] = obj.lon
        try:
            res = compute_arudha(self.d1_asc.sign, planet_signs, planet_lons)
            res['available'] = True
            return res
        except Exception:
            return {'available': False}

    def transit_notes(self):
        # Gochara(过运)本命参照恒取 D1 月/土，分盘不改 Sade Sati 本命基准。
        moon_house = house_number(self.d1_moon) if self.d1_moon else None
        saturn = safe_get(self.d1_chart, const.SATURN)
        return {
            'sadeSatiNatalBasis': {
                'moonSign': getattr(self.d1_moon, 'sign', None),
                'saturnSign': getattr(saturn, 'sign', None),
                'moonHouse': moon_house,
                'note': 'natal_basis_only_current_transit_requires_transit_chart',
            }
        }

    def compatibility_shell(self):
        return {
            'available': False,
            'reason': 'requires_second_chart',
            'supportedFutureMethods': ['kuta_matching', 'tara_bala', 'yoni', 'graha_maitri'],
        }
