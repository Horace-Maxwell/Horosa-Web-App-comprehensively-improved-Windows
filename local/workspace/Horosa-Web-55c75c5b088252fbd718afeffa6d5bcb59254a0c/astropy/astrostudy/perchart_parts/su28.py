"""PerChart 的宿度与恒星一族方法(由排盘模块整段搬出;PerChart 类仍在 astrostudy.perchart,经继承取得)。"""
from flatlib import const
from flatlib import object
from astrostudy.perchart_parts.chart_tables import takeRa, takeDecl
from astrostudy.perchart_parts.su28_moira import (
    SU28_MODE_REAL, SU28_MODE_DOUBING, SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL,
    SU28_MODE_EQUATORIAL_SIDEREAL, SU28_MODE_GUFA_LICHENG, SU28_MODE_EQUATORIAL_TROPICAL,
    SU28_MODE_EQUATORIAL_TROPICAL_LIVE, MOIRA_STELLAR_ORDER, MOIRA_CURRENT_STELLAR_DEGREES, MOIRA_KAIXI_STELLAR_DEGREES,
    _moira_ayanamsha, _moira_distar_lons, SU28_ID_BY_NAME,
)


class Su28Mixin:
    """宿度与恒星:二十八宿各口径 / 恒星表 / 北斗北极 / 行星入宿。"""

    @staticmethod
    def parseSu28Mode(value):
        if isinstance(value, bool):
            return SU28_MODE_DOUBING if value else SU28_MODE_REAL
        if value is None:
            return SU28_MODE_REAL
        if isinstance(value, str):
            txt = value.strip().lower()
            if txt == 'true':
                return SU28_MODE_DOUBING
            if txt == 'false' or txt == '':
                return SU28_MODE_REAL
        try:
            mode = int(value)
        except:
            return SU28_MODE_REAL
        if mode in (SU28_MODE_REAL, SU28_MODE_DOUBING, SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL, SU28_MODE_EQUATORIAL_SIDEREAL, SU28_MODE_GUFA_LICHENG, SU28_MODE_EQUATORIAL_TROPICAL, SU28_MODE_EQUATORIAL_TROPICAL_LIVE):
            return mode
        return SU28_MODE_REAL

    def getDoubingSu28SignsRA(self):
        res = []
        if not self.isDoubingSu28:
            return res

        deg = (self.eastRa - 225 + 360) % 360
        for i in range(12):
            sigid = const.LIST_SIGNS[i]
            sig = {
                'id': sigid,
                'ra': (deg + i * 30) % 360,
                'decl': 0
            }
            res.append(sig)
        return res

    def getSignsRA(self):
        res = []
        for i in range(12):
            sigid = const.LIST_SIGNS[i]
            deg = i * 30
            sig = {
                'id': sigid,
                'ra': deg,
                'decl': 0
            }
            res.append(sig)
        return res

    def getStars(self):
        res = []
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists
        planets = planets.copy()
        planets.extend(const.LIST_ANGLES)
        stars = self._getFixedStars67Cached()
        for planet in planets:
            fixstars = {
                'id': planet,
                'stars': []
            }
            for star in stars:
                plaObj = self.chart.get(planet)
                delta = abs(plaObj.lon - star.lon)
                # 跨 0° 白羊点的合相(如 359.7 vs 0.3,差 359.4)需折回最短分离角
                if delta > 180:
                    delta = 360 - delta
                # 轨档:byMagnitude 逐星取星等表 FixedStar.orb()(mag<2→7.5°…),否则平轨(默认 1°=现状)。
                _orb = star.orb() if self._starOrbByMag else self._starOrb
                if delta < _orb:
                    obj = [star.id, star.sign, star.signlon, delta, star.name]
                    fixstars['stars'].append(obj)
            res.append(fixstars)
        return res

    def getFixedStarSu28ByDouBing(self):
        from astrostudy.guostarsect.guo74 import Guo74
        g74 = Guo74(self)
        res = g74.compute()
        self.relocateSouthObjects(res)
        res.sort(key=takeRa)
        return res

    def getVirtualFixedStarSu28(self):
        from astrostudy.guostarsect.guo74 import Guo74
        g74 = Guo74(self)
        res = g74.virtualSu28()
        self.relocateSouthObjects(res)
        res.sort(key=takeRa)
        return res

    def getMoiraFixedStarSu28(self):
        # 三套宿度制对齐自有恒星案(均沿黄道置宿,planets 用黄经):
        #   回归今制(MOIRA_CURRENT): 28 距星活体 tropical 黄经(严格 IAU 岁差),逐宿不均匀。
        #   回归古制开禧(MOIRA_KAIXI): 开禧基值 + ayanamsha(1300/4.0)。
        #   恒星制郑式(ZHENG_SIDEREAL): 郑氏恒星基值原值(盘已 sidereal,planets 亦 sidereal)。
        jd = self.chart.date.jd
        if self.su28Mode == SU28_MODE_MOIRA_KAIXI:
            ayan = _moira_ayanamsha(jd)
            degrees = [(d + ayan) % 360 for d in MOIRA_KAIXI_STELLAR_DEGREES]
        elif self.su28Mode == SU28_MODE_ZHENG_SIDEREAL:
            degrees = [d % 360 for d in MOIRA_CURRENT_STELLAR_DEGREES]
        else:
            lon_by_name = _moira_distar_lons(jd)
            degrees = [lon_by_name[name] % 360 for name in MOIRA_STELLAR_ORDER]

        res = []
        for idx, name in enumerate(MOIRA_STELLAR_ORDER):
            lon = degrees[idx] % 360
            sig = const.LIST_SIGNS[int(lon / 30) % 12]
            star = {
                'ra': lon,
                'decl': 0,
                'name': name,
                'wuxing': const.Su28WuXing[name],
                'animal': const.Su28Animal[name],
                'id': SU28_ID_BY_NAME[name],
                'lon': lon,
                'lat': 0,
                'sign': sig,
                'signlon': lon % 30,
                'type': const.OBJ_FIXED_STAR
            }
            res.append(object.Object.fromDict(star))
        res.sort(key=lambda s: s.lon)
        return res

    def getEquatorialSu28(self):
        # 现代天赤恒星制(mode5):按赤经定宿,planets 用 RA(byLon=False)。
        # WP-B 真修:原实现取 MOIRA_DISTAR_J2000 的 RA 定宿(其换算函数现已停用),但该表为 mode2 黄经调好——
        #   数行赤纬非物理,黄仪取黄经恰好遮住、赤仪取赤经就爆(定宿偏 10–44°)。
        # 2026-08-04 复核(逐行 J2000 赤道→黄道换算):非物理者共 9 宿,较原注列的 7 宿多出【尾、斗】——
        #   胃 β=-41.9°、鬼 -44.9°、柳 +57.2°、星 -48.9°、张 +41.5°、亢 -56.8°、尾 +37.3°、斗 +62.7°
        #   (以上 |β|>30°),另 翼 +28.4° 亦非物理(实星 α Crt 约 -22.6°)。距星皆黄道带恒星,不应有此纬度。
        #   同时复核:全 28 行的黄经【是对的】(角 → 203.841°,恰合 SU28_JIAO_START_MODERN=203.84),
        #   即该表是自黄经反解 RA/Dec 而成,只在黄经上可用。
        #   (本仓复算另见 參 -25.3°、虛 +25.2°、奎 +27.1° 处在 25~30° 区间,未逐一比对实星,
        #    未计入上述 9 宿;若将来要复活赤经用法,这三行也须一并核。)
        # 改用与荀爽(REAL)同一份正确赤道距星活体源 chart.getFixedStartsSu28()(flatlib,已验在序),
        #   仅去掉 mode0 荀爽一家的 危/鬼 年改正(那是实测微调)→ 得干净现代真星赤经恒星制。
        # 绝不动 MOIRA_DISTAR_J2000(mode2/3/4 黄经依赖、字节默认盘)。
        stars = self.chart.getFixedStartsSu28()
        self.relocateSouthObjects(stars)
        res = []
        delta = 0.004
        for id in const.LIST_FIXED_SU28:
            star = stars.content[id]
            if 90 <= star.ra < 270:
                star.ra = star.ra - delta
            else:
                star.ra = star.ra + delta
            res.append(star)
        res.sort(key=takeRa)
        return res

    def getGufaLichengSu28(self):
        # WP-D 授时历古法立成:推变黄道术(元明赤道宿度→黄道宿度立成,极黄经)→ 28 宿黄道起界(360 frame)。
        # 角宿黄道起点由元时春分(壁6°)推导≈黄经193°(=元时 Spica/α Vir 实位,岁差核对吻合)。
        # 古宿固定(默认·永不变):宿界钉死元时;随岁差(guolaoGufaPrecess=1):宿界东移≈50.29″/年(授时历元 1280 起)。
        from astrostudy import guolao_tuibian as gt
        table = gt.mansion_huangdao_table(self.guolaoTuibianMethod)   # 28 宿黄道距度(365.2575 古度)
        scale = 360.0 / gt.ZHOUTIAN_ANCIENT
        anchor = (gt.chidao_to_huangdao(0.0, self.guolaoTuibianMethod) * scale) % 360.0   # 角宿黄道起点(元时)
        if self.guolaoGufaPrecess:
            try:
                anchor = (anchor + (float(self.year) - 1280.0) * (50.29 / 3600.0)) % 360.0
            except Exception:
                pass
        res = []
        cum = 0.0
        for idx, name in enumerate(gt.SU28_NAMES):
            lon = (anchor + cum) % 360.0
            sig = const.LIST_SIGNS[int(lon / 30) % 12]
            star = {
                'ra': lon, 'decl': 0, 'name': name,
                'wuxing': const.Su28WuXing[name], 'animal': const.Su28Animal[name],
                'id': SU28_ID_BY_NAME[name], 'lon': lon, 'lat': 0,
                'sign': sig, 'signlon': lon % 30, 'type': const.OBJ_FIXED_STAR
            }
            res.append(object.Object.fromDict(star))
            cum += table[idx] * scale
        res.sort(key=lambda s: s.lon)
        return res

    def getEquatorialTropicalSu28(self):
        # 额外档·赤道回归制(mode7):宿界=固定元明赤道宿度立成(× 360/365.2575),以春分/牛前冬至为锚、赤经常数、不随岁差;
        # 行星按盘历元赤经(byRA)落入 → 宿界钉死、真实恒星随岁差从宿界西移穿过(与 mode5「宿随星走」正相反)。
        # 不取 MOIRA_DISTAR_J2000 的赤经、不做 IAU 进动(这正是与 mode5 的分界)。中性命名,无软件名/书名。
        from astrostudy import guolao_tuibian as gt
        scale = 360.0 / gt.ZHOUTIAN_ANCIENT       # 365.2575 古度 → 360° 赤经
        cum = gt._cumulative_equatorial()         # 各宿起始累积赤道(角起 0,365.2575 古度)
        # 锚定常数(本档唯一关键决策点·做成选项):
        #   dongzhi 牛前冬至(默认):牛宿前缘 = 冬至 RA 270° → offset = 270 − 牛起(scaled)
        #   chunfen 春分壁2.3:壁宿2.3度 = 春分 RA 0° → offset = 0 − (壁起+2.3)(scaled)
        if self.guolaoEqTropicalAnchor == 'chunfen':
            anchor_pos = (cum[gt.SU28_NAMES.index('壁')] + 2.3) * scale
            offset = (0.0 - anchor_pos) % 360.0
        else:
            anchor_pos = cum[gt.SU28_NAMES.index('牛')] * scale
            offset = (270.0 - anchor_pos) % 360.0
        res = []
        for i, name in enumerate(gt.SU28_NAMES):
            ra = (cum[i] * scale + offset) % 360.0
            star = {
                'ra': ra, 'decl': 0, 'name': name,
                'wuxing': const.Su28WuXing[name], 'animal': const.Su28Animal[name],
                'id': SU28_ID_BY_NAME[name], 'lon': ra, 'lat': 0,
                'sign': const.LIST_SIGNS[int(ra / 30) % 12], 'signlon': ra % 30, 'type': const.OBJ_FIXED_STAR
            }
            res.append(object.Object.fromDict(star))
        res.sort(key=takeRa)
        return res

    def getEquatorialTropicalLiveSu28(self):
        # 赤道回归·实时(mode8):宿宽=盘历元距星真赤经差(与 mode5 恒星制同一活体距星源),
        # 锚=回归点(牛前冬至 270° 默认 / 春分壁2.3 古度,语义与 mode7 元明立成同款)——
        # 冬至/春分永远钉在锚宿位、宿形随时代实测,即授时历「实测宿度+冬至锚」体系的活体版;
        # 与 mode5 之别在锚(回归锚 vs 距星绝对赤经),与 mode7 之别在宿宽(实时 vs 元明立成)。
        base = self.getEquatorialSu28()
        ra_by_id = {}
        for s in base:
            ra_by_id[s.id] = s.ra
        if self.guolaoEqTropicalAnchor == 'chunfen':
            from astrostudy import guolao_tuibian as gt
            scale = 360.0 / gt.ZHOUTIAN_ANCIENT
            anchor_ra = (ra_by_id[const.START_QIANBI] + 2.3 * scale) % 360.0
            offset = (0.0 - anchor_ra) % 360.0
        else:
            offset = (270.0 - ra_by_id[const.START_NIU]) % 360.0
        name_by_id = dict(zip(const.LIST_FIXED_SU28, const.LIST_FIXED_SU28_NAME))
        res = []
        for s in base:
            ra = (s.ra + offset) % 360.0
            name = name_by_id.get(s.id)
            star = {
                'ra': ra, 'decl': 0, 'name': name,
                'wuxing': const.Su28WuXing[name], 'animal': const.Su28Animal[name],
                'id': s.id, 'lon': ra, 'lat': 0,
                'sign': const.LIST_SIGNS[int(ra / 30) % 12], 'signlon': ra % 30, 'type': const.OBJ_FIXED_STAR
            }
            res.append(object.Object.fromDict(star))
        res.sort(key=takeRa)
        return res

    def fillPlanetSu28(self, res, byLon=False):
        obj = const.LIST_ALL_POINTS
        for id in obj:
            try:
                planet = self.chart.get(id)
                self.setPlanetSu28(res, planet, byLon=byLon)
            except:
                continue


    # v3.0.1 perf ROUND-5:同一请求 'fixedStarSu28' 与 'su28Adjust' 两个键各调一次本方法,每次都从
    # swisseph 重取 28 星再重做同一套 ra 调整(单次 ~50ms)。memo **成品列表**(★方法会原地改 star.ra,
    # 缓存成品保证调整恰好执行一次);消费者只读。重复调用逐字节等值已实测证明。
    def getAdjustFixedStarSu28(self):
        if self._adjustSu28Cache is None:
            self._adjustSu28Cache = self._computeAdjustFixedStarSu28()
        return self._adjustSu28Cache

    # v3.0.1 perf ROUND-5:guo74.virtualSu28 原本逐星 chart.getFixedStar()×28 只为读 decl —— 同一请求
    # 对同一批 28 星的第三次取数。这里缓存一次**原始批**(未 relocate、未调 ra,与逐星取值同源同值:
    # 同 (star, jd, flags) 的 decl 确定性,重复取数逐字节等值已实测)。与上面的成品缓存严格分离:
    # 成品路径自己另取一批再变异,绝不共享对象,防变异串染。消费者(guo74)只读 decl。
    def getRawFixedStarSu28Cached(self):
        if self._rawSu28Cache is None:
            self._rawSu28Cache = self.chart.getFixedStartsSu28()
        return self._rawSu28Cache

    def _computeAdjustFixedStarSu28(self):
        stars = self.chart.getFixedStartsSu28()
        self.relocateSouthObjects(stars)
        res = []
        delta = 0.004
        y = int(self.year)
        for id in const.LIST_FIXED_SU28:
            star = stars.content[id]
            ra = star.ra

            if star.id == const.START_WEI:
                if y <= 2000:
                    ra = ra - 0.000053625*(y + 2000) - 1.4175
                else:
                    ra = ra - 0.00003*(y - 2000) - 1.632
                star.ra = ra
            elif star.id == const.START_GUI:
                if y <= 2000:
                    ra = ra - 0.000255*(y + 2000) + 0.7425
                else:
                    ra = ra - 0.0001725*(y - 2000) - 0.2775
                star.ra = ra

            if 90 <= star.ra < 270:
                star.ra = star.ra - delta
            else:
                star.ra = star.ra + delta

            res.append(star)
        res.sort(key=takeRa)
        return res

    def getFixedStarSu28(self):
        if self.isDoubingSu28:
            return self.getFixedStarSu28ByDouBing()

        # 回归今制 / 回归古制开禧 / 恒星制郑式 三制均走自有恒星案,沿黄道置宿(planets 用黄经)。
        if self.su28Mode in (SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL):
            res = self.getMoiraFixedStarSu28()
            self.fillPlanetSu28(res, byLon=True)
            return res

        # G3/G4 赤道恒星制(制一): 现代赤道距星案进动赤经定宿,planets 用 RA。
        if self.su28Mode == SU28_MODE_EQUATORIAL_SIDEREAL:
            res = self.getEquatorialSu28()
            self.fillPlanetSu28(res)
            return res

        # WP-D 授时历古法立成(mode6): 推变黄道宿度(极黄经)沿黄经置宿(planets 用黄经)。古宿固定(元时)或随岁差。
        if self.su28Mode == SU28_MODE_GUFA_LICHENG:
            res = self.getGufaLichengSu28()
            self.fillPlanetSu28(res, byLon=True)
            return res

        # 额外档·赤道回归制(mode7): 固定元明赤道宿度立成(春分/牛前冬至锚、赤经常数、不随岁差),planets 用赤经(byRA)。
        if self.su28Mode == SU28_MODE_EQUATORIAL_TROPICAL:
            res = self.getEquatorialTropicalSu28()
            self.fillPlanetSu28(res)
            return res

        # 赤道回归·实时(mode8): 宿宽=盘历元距星真赤经(mode5 同源),锚=回归点(mode7 同款),planets 用赤经(byRA)。
        if self.su28Mode == SU28_MODE_EQUATORIAL_TROPICAL_LIVE:
            res = self.getEquatorialTropicalLiveSu28()
            self.fillPlanetSu28(res)
            return res

        # 荀爽 19 年测量(REAL): 赤道距星活体,沿赤经置宿(planets 用 RA)。
        res = self.getAdjustFixedStarSu28()
        self.fillPlanetSu28(res)
        return res

    # v3.0.1 perf ROUND-5:67 恒星表在同一请求被 getStars 与 getFixedStars 各全量重算一次(flatlib 每次
    # 从 swisseph 重取 67 星,swisseph 逐星重扫 sefstars.txt,单次 ~130ms)。取一次 + relocate 一次后共享;
    # 两个消费者均只读。★防坑:relocateSouthObjects 是 +180° 原地变换,必须缓存在 relocate **之后**,
    # 否则南盘(lat<0)跑两次会把变换抵消。重复调用 jsonpickle 输出逐字节等值已实测证明。
    def _getFixedStars67Cached(self):
        if self._fixedStars67Cache is None:
            stars = self.chart.getFixedStars()
            self.relocateSouthObjects(stars)
            self._fixedStars67Cache = stars
        return self._fixedStars67Cache

    def getFixedStars(self):
        stars = self._getFixedStars67Cached()
        res = []
        for id in const.LIST_FIXED_STARS:
            obj = stars.content[id]
            res.append(obj)
        return res

    def getBeiDou(self):
        stars = self.chart.getFixedStarBeiDou()
        self.relocateSouthObjects(stars)
        res = []
        for id in const.LIST_BEIDOU:
            obj = stars.content[id]
            res.append(obj)
        return res

    def getBeiJi(self):
        stars = self.chart.getFixedStarBeiJi()
        self.relocateSouthObjects(stars)
        res = []
        for id in const.LIST_BEIJI:
            obj = stars.content[id]
            res.append(obj)
        res.sort(key=takeDecl)
        return res

    def setPlanetSu28(self, res, planet, byLon=False):
        # byLon=True: 沿黄道置宿(自有恒星案三制,宿界与行星均用黄经);
        # byLon=False: 沿赤经置宿(荀爽赤道距星法,用 RA)。
        pval = planet.lon if byLon else planet.ra
        starSel = None
        for star in res:
            sval = star.lon if byLon else star.ra
            if sval <= pval:
                starSel = star
            else:
                break
        if starSel == None:
            starSel = res[len(res) - 1]
        planet.su28 = starSel.name
