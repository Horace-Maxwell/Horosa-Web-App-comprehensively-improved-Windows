"""PerChart 的希腊点一族方法(由排盘模块整段搬出;PerChart 类仍在 astrostudy.perchart,经继承取得)。"""
from flatlib import const


class LotsMixin:
    """希腊点:变体后处理 / 按座序计数投影 / 取点。"""

    def _applyLotVariants(self):
        """[WP-3] 希腊点变体一体后处理(收编原 _applyLotReversal;全默认=零 relocate 零回归):
        ① lotReversal=0 → 福点恒昼式(压过任何变体);
        ② lotFortuneVariant='moonAboveNight' → 月在地平上时福点恒用夜式(Valens 变体);
        ③ hermeticLotsReversal=0 → 夜盘赫尔墨斯六点(精神/爱欲/必然/勇气/胜利/复仇)用昼式(批判本校勘);
        ④ erosConstruction='valens' → 爱欲=Asc+(精神−福点)/必然=Asc+(福点−精神)(昼;夜按③口径定向);
        ⑤ lotFatherCombustAlt=1 且土星在日光束下 → 父点=Asc+(Jupiter−Mars)(昼;夜反转);
        ⑥ lotProjection='sign' → 全点整星座投射(点归座首,最后执行)。
        点对象就地 relocate:下游相位/落宫/快照自动吃新位。"""
        data = self.data if isinstance(self.data, dict) else {}
        from flatlib.tools import arabicparts as ap
        try:
            pf = self.chart.getObject(const.PARS_FORTUNA)
            asc = self.chart.getAngle(const.ASC)
            sun = self.chart.getObject(const.SUN)
            moon = self.chart.getObject(const.MOON)
            if pf is None or asc is None or sun is None or moon is None:
                return
            fortune_day = (asc.lon + moon.lon - sun.lon) % 360.0
            fortune_night = (asc.lon + sun.lon - moon.lon) % 360.0
            lot_rev_on = str(data.get('lotReversal', 1)) not in ('0', 'false', 'False')
            # ①/②:福点
            if not lot_rev_on:
                pf.relocate(fortune_day)
            elif (data.get('lotFortuneVariant') or 'standard') == 'moonAboveNight':
                try:
                    from flatlib import utils as _futils
                    mc = self.chart.getAngle(const.MC)
                    moon_above = _futils.isAboveHorizon(moon.ra, moon.decl, mc.ra, self.chart.pos.lat)
                except Exception:
                    moon_above = False
                if moon_above:
                    pf.relocate(fortune_night)
            # ③:批判本恒同式(夜盘六点用昼式;昼盘零动)
            _HERMETIC6 = (ap.PARS_SPIRIT, ap.PARS_EROS, ap.PARS_NECESSITY, ap.PARS_COURAGE, ap.PARS_VICTORY, ap.PARS_NEMESIS)
            schmidt_on = str(data.get('hermeticLotsReversal', 1)) in ('0', 'false', 'False')
            def _dayFormulaLon(pid):
                abc = ap.FORMULAS[pid][0]
                return (ap.objLon(abc[2], self.chart) + ap.objLon(abc[1], self.chart) - ap.objLon(abc[0], self.chart)) % 360.0
            if schmidt_on and not self.isDiurnal:
                for pid in _HERMETIC6:
                    try:
                        self.chart.get(pid).relocate(_dayFormulaLon(pid))
                    except Exception:
                        pass
            # ④:Valens 式爱欲/必然(福点·精神构成;夜按批判本口径决定是否反转)
            if data.get('erosConstruction') == 'valens':
                try:
                    spirit_lon = self.chart.get(ap.PARS_SPIRIT).lon
                    use_day = self.isDiurnal or schmidt_on
                    eros = (asc.lon + spirit_lon - pf.lon) if use_day else (asc.lon + pf.lon - spirit_lon)
                    nec = (asc.lon + pf.lon - spirit_lon) if use_day else (asc.lon + spirit_lon - pf.lon)
                    self.chart.get(ap.PARS_EROS).relocate(eros % 360.0)
                    self.chart.get(ap.PARS_NECESSITY).relocate(nec % 360.0)
                except Exception:
                    pass
            # ⑤:父点土星伏替代式(土星距日 < 日光束外界现值)
            if str(data.get('lotFatherCombustAlt', 0)) in ('1', 'true', 'True'):
                try:
                    saturn = self.chart.getObject(const.SATURN)
                    d_sun = abs(((saturn.lon - sun.lon + 180.0) % 360.0) - 180.0)
                    if d_sun < float(self._sunPosBeams):
                        jup = self.chart.getObject(const.JUPITER)
                        mars = self.chart.getObject(const.MARS)
                        alt = (asc.lon + jup.lon - mars.lon) if self.isDiurnal else (asc.lon + mars.lon - jup.lon)
                        self.chart.get(ap.PARS_FATHER).relocate(alt % 360.0)
                except Exception:
                    pass
            # ⑥:整星座投射 —— 真按座序计数(最后执行,福点同投):
            #   自 A 所在座数到 B 所在座得 n 座,再自 ASC 所在座数 n 座即签位座(Valens II 37「按宫数 / 按度数可落不同座」);
            #   一手来源不给座内度,取 ASC 的座内度(两点座内度相等时 Paulus 度式即退化为 ASC 度 + 整数座,自洽);
            #   同座 → n=0 落上升座。此前实现是「先按度算点再归所在座 0°」= 度式投射,跨座边界时与座序计数不同
            #   (400 盘抽样 137 盘福点座不同)。派生点(必然 / 勇气 / 复仇用福点,爱欲 / 胜利用精神)按已座序化的福点 / 精神再数。
            #   特殊式(基础点短弧 / 旺宫点绝对黄经)无 A→B 结构,维持归座首。
            if data.get('lotProjection') == 'sign':
                try:
                    self._projectLotsBySign(data, pf, asc, sun, moon, schmidt_on, ap)
                except Exception:
                    pass
        except Exception:
            pass

    @staticmethod
    def _signCountLon(a_lon, b_lon, c_lon):
        """座序计数签位:A 座→B 座的座数,自 C 座同数;度 = C 的座内度。"""
        sa = int((float(a_lon) % 360.0) // 30)
        sb = int((float(b_lon) % 360.0) // 30)
        sc = int((float(c_lon) % 360.0) // 30)
        n = (sb - sa) % 12
        return ((sc + n) % 12) * 30 + (float(c_lon) % 30.0)

    def _projectLotsBySign(self, data, pf, asc, sun, moon, schmidt_on, ap):
        """lotProjection='sign':全部希腊 / 阿拉伯点按座序计数重定位(见 _applyLotVariants ⑥)。"""
        from flatlib import const as _c
        chart = self.chart
        resolved = {}   # 已座序化的点:后续以此为 A/B(objLon 会按度重算,不能用)

        def _lon(ID):
            if ID in resolved:
                return resolved[ID]
            if ID == _c.PARS_FORTUNA:
                return pf.lon
            return ap.objLon(ID, chart)

        day = bool(self.isDiurnal)
        # 福点:①/② 已把 pf 定成昼式或夜式 → 按其现值判是昼式还是夜式再座序化
        fortune_day = (asc.lon + moon.lon - sun.lon) % 360.0
        pf_is_day = abs(((pf.lon - fortune_day + 180.0) % 360.0) - 180.0) < 1e-6
        pf_sign = self._signCountLon(sun.lon, moon.lon, asc.lon) if pf_is_day else self._signCountLon(moon.lon, sun.lon, asc.lon)
        pf.relocate(pf_sign % 360.0)
        resolved[_c.PARS_FORTUNA] = pf.lon

        hermetic6 = (ap.PARS_SPIRIT, ap.PARS_EROS, ap.PARS_NECESSITY, ap.PARS_COURAGE, ap.PARS_VICTORY, ap.PARS_NEMESIS)
        valens_eros = data.get('erosConstruction') == 'valens'
        father_alt = False
        if str(data.get('lotFatherCombustAlt', 0)) in ('1', 'true', 'True'):
            try:
                saturn = chart.getObject(_c.SATURN)
                d_sun = abs(((saturn.lon - sun.lon + 180.0) % 360.0) - 180.0)
                father_alt = d_sun < float(self._sunPosBeams)
            except Exception:
                father_alt = False
        doc_rev = ap._docReverseActive()

        def _triple(pid):
            use_day = day or (schmidt_on and pid in hermetic6)
            if valens_eros and pid == ap.PARS_EROS:
                return (_c.PARS_FORTUNA, ap.PARS_SPIRIT, _c.ASC) if use_day else (ap.PARS_SPIRIT, _c.PARS_FORTUNA, _c.ASC)
            if valens_eros and pid == ap.PARS_NECESSITY:
                return (ap.PARS_SPIRIT, _c.PARS_FORTUNA, _c.ASC) if use_day else (_c.PARS_FORTUNA, ap.PARS_SPIRIT, _c.ASC)
            if father_alt and pid == ap.PARS_FATHER:
                return (_c.MARS, _c.JUPITER, _c.ASC) if day else (_c.JUPITER, _c.MARS, _c.ASC)
            table = ap._DOC_REVERSE_FORMULAS if (doc_rev and pid in ap._DOC_REVERSE_FORMULAS) else ap.FORMULAS
            if pid not in table:
                return None
            return tuple(table[pid][0] if use_day else table[pid][1])

        pars = list(getattr(chart, 'pars', None) or [])
        # 先精神(其余赫尔墨斯点依赖它),再其它
        pars.sort(key=lambda p: 0 if p.id == ap.PARS_SPIRIT else 1)
        for p in pars:
            abc = _triple(p.id)
            if abc is None:
                p.relocate(float(int(p.lon // 30) * 30))   # 基础点 / 旺宫点等特殊式:归座首(旧口径)
                continue
            new_lon = self._signCountLon(_lon(abc[0]), _lon(abc[1]), _lon(abc[2])) % 360.0
            p.relocate(new_lon)
            resolved[p.id] = new_lon

    def getPars(self, chart):
        res = []
        for par in chart.pars:
            res.append(par)
        return res

    def getPar(self, lotId):
        return self.chart.get(lotId)
