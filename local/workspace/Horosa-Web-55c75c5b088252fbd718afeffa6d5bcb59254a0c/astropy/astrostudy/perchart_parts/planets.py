"""PerChart 的行星状态与尊贵一族方法(由排盘模块整段搬出;PerChart 类仍在 astrostudy.perchart,经继承取得)。"""
import swisseph
from flatlib import const
from flatlib.dignities import essential
from flatlib.ephem import swe
from astrostudy.perchart_parts.chart_tables import ARCUS_VISIONIS


def _nodes_in_dignity_table():
    """当前尊贵表(请求级可被古典口径换表)里占了擢升 / 落位的交点。"""
    hit = set()
    for row in essential.TABLE.values():
        for key in ('exalt', 'fall'):
            v = row.get(key) if isinstance(row, dict) else None
            if v and v[0] in (const.NORTH_NODE, const.SOUTH_NODE):
                hit.add(v[0])
    return [n for n in (const.NORTH_NODE, const.SOUTH_NODE) if n in hit]


class PlanetsMixin:
    """行星状态与尊贵:燃烧之路 / 出界 / 偕日相 / 野逸 / 喜乐 / 宗派 / 留驻 / 站心月 / 区分昼夜 / 得时 / 必然尊贵 / 祝融星。"""

    # 燃烧之路边界四档(2026-07 全局化,用户拍板默认对齐传统):
    #   standard(默认)=天秤15°–天蝎15°(195–225,古典标准);narrow=旧硬编码窄口径(208–217,
    #   天秤28°–天蝎7°,作历史变体保留);scorpioFull=天秤后15°+天蝎全宫(195–240);
    #   bothFull=天秤+天蝎全段(180–240)。isViaRepression(178–186)非本参数域,原样不动。
    _VIA_COMBUSTA_RANGES = {
        'standard': (195.0, 225.0),
        'narrow': (208.0, 217.0),
        'scorpioFull': (195.0, 240.0),
        'bothFull': (180.0, 240.0),
    }

    def setupSpecial(self, star):
        lo, hi = self._viaCombustaRange
        if lo <= star.lon < hi:
            star.isViaCombust = True
        if 178 <= star.lon < 186:
            star.isViaRepression = True

    def setupOutOfBounds(self, planet, obj):
        """出界 Out-of-Bounds:|赤纬| > 真黄赤交角 ε。月亮另判趋势(going 远离极值 / returning 回归)。
        赤纬为赤道坐标、与黄道制无关 → 恒星制盘同样适用。"""
        eps = getattr(self, 'eclObliquity', 23.4367)
        decl = getattr(planet, 'decl', None)
        if decl is None:
            return
        planet.outOfBounds = bool(abs(decl) > eps)
        planet.oobDelta = round(abs(decl) - eps, 3)
        if obj == const.MOON:
            try:
                eqflag = swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL
                jd0 = self.dateTime.jd
                d_now = abs(swisseph.calc_ut(jd0, swisseph.MOON, eqflag)[0][1])
                d_prev = abs(swisseph.calc_ut(jd0 - 1.0 / 24.0, swisseph.MOON, eqflag)[0][1])
                planet.oobMode = 'going' if d_now > d_prev else 'returning'
            except Exception:
                planet.oobMode = None

    def setupPhasis(self, planet, obj, sun):
        """偕日相 phasis / 可见弧:据与太阳的黄经差细分 核心/焦伤/日光束下/自由光;
        若出生临近该星偕日升(晨星初现)或偕日没(昏星初没)则标 phasisEvent。仅日月五星中的五星。"""
        arcus = ARCUS_VISIONIS.get(obj)
        if arcus is None or sun is None:
            return
        ae = abs(((planet.lon - sun.lon + 180.0) % 360.0) - 180.0)
        planet.phasisElong = round(ae, 3)
        if ae <= self._phaseCazimi:
            planet.phase = 'cazimi'
        elif ae < self._phaseCombust:
            planet.phase = 'combust'
        elif ae < arcus:
            planet.phase = 'underBeams'
        else:
            planet.phase = 'free'
        # 仅当落在可见弧边界窗(±5°)时才查偕日升/没事件(heliacal_ut 较贵,远离边界无意义)。
        planet.phasisEvent = None
        if abs(ae - arcus) <= 5.0:
            planet.phasisEvent = self._phasis_event(obj)

    def _phasis_event(self, obj):
        """birth 临近(≤7 天)该星偕日升→morningRising(晨星初现);偕日没→eveningSetting(昏星初没)。任何异常返 None。"""
        try:
            geopos = [float(self.pos.lon), float(self.pos.lat), 0.0]
            atmo = [1013.25, 15.0, 40.0, 0.25]
            observer = [36.0, 1.0, 0.0, 0.0, 0.0, 0.0]
            birth_jd = self.dateTime.jd
            flag = swisseph.FLG_SWIEPH | swisseph.HELFLAG_HIGH_PRECISION
            for event, label in ((swisseph.HELIACAL_RISING, 'morningRising'), (swisseph.HELIACAL_SETTING, 'eveningSetting')):
                tret = swisseph.heliacal_ut(birth_jd - 15.0, geopos, atmo, observer, obj, event, flag)
                jd = tret[0] if isinstance(tret, (list, tuple)) else tret
                if abs(jd - birth_jd) <= 7.0:
                    return label
        except Exception:
            pass
        return None

    _FERAL_PTOL = (0, 60, 90, 120, 180)

    def _feralPtolTargets(self, obj):
        """obj 向七政发出的托勒密相位(0/60/90/120/180)目标集,复用本盘 dynchart(moiety 容许度,
        与星图所绘/相位tab 同源);本盘缓存,7 星共 7 次调用。异常返回 None。"""
        cache = getattr(self, '_feralAspCache', None)
        if cache is None:
            cache = self._feralAspCache = {}
        if obj in cache:
            return cache[obj]
        targets = set()
        try:
            asp = self.dynchart.aspectsByCat(obj, list(self._FERAL_PTOL), False)
            for cat in ('Exact', 'Applicative', 'Separative'):
                for a in (asp.get(cat) or []):
                    if a.get('asp') in self._FERAL_PTOL and a.get('id') is not None:
                        targets.add(a.get('id'))
        except Exception:
            targets = None
        cache[obj] = targets
        return targets

    def setupFeral(self, planet, obj):
        """野逸 feral:该星与七政中任何他星皆不成托勒密相位(0/60/90/120/180)→ 野逸(完全无相)。
        相位判定复用本盘 dynchart(与星图所绘、相位tab 同一 moiety 容许度)——绝不另设固定容许度,
        否则偏窄会漏真相位(如月对水冲 11.7°、月六合土 10.2°)误标野逸。相位是「画出一条线即成」,
        故须**双向并集**:容许度随主星(月容许大、土容许小),只要任一方向成相即非野逸。仅计七政互相,不含外行星/虚点/四角。"""
        lons = getattr(self, '_sevenLons', None)
        if not lons or obj not in lons:
            return
        others = set(lons.keys())
        others.discard(obj)
        mine = self._feralPtolTargets(obj)
        if mine is None:
            planet.feral = False   # 相位引擎异常时不武断标野逸(宁漏标不错标)
            return
        feral = True
        for q in others:
            if q in mine:                       # obj → q 成相
                feral = False
                break
            qt = self._feralPtolTargets(q)       # q → obj 成相(另一方向,另一方容许度)
            if qt and obj in qt:
                feral = False
                break
        planet.feral = bool(feral)

    def setupJoy(self, planet, obj):
        """行星喜乐 joy:整宫制下行星所落宫 == 该星喜乐宫。整宫房=自上升星座起算。"""
        JOY = {const.MERCURY: 1, const.MOON: 3, const.VENUS: 5, const.MARS: 6, const.SUN: 9, const.JUPITER: 11, const.SATURN: 12}
        j = JOY.get(obj)
        if j is None:
            return
        try:
            psidx = const.LIST_SIGNS.index(planet.sign)
            wsh = ((psidx - getattr(self, 'ascSignIdx', 0)) % 12) + 1
            planet.wholeSignHouse = wsh
            planet.joy = bool(wsh == j)
            planet.joyHouse = j
        except Exception:
            pass

    def setupSect(self, planet, obj, sun):
        """宗派 sect:日间星(日木土)在日盘 / 夜间星(月金火)在夜盘 = 同宗(of-sect);水星随其东西向(晨星=日间)。"""
        if obj in (const.SUN, const.JUPITER, const.SATURN):
            planet.ofSect = bool(self.isDiurnal)
        elif obj in (const.MOON, const.VENUS, const.MARS):
            planet.ofSect = bool(not self.isDiurnal)
        elif obj == const.MERCURY and sun is not None:
            oriental = (((planet.lon - sun.lon + 180.0) % 360.0) - 180.0) < 0
            planet.ofSect = bool(oriental == self.isDiurnal)

    # 行星均速表(度/日,标准值):留驻 relSpeed 法阈值基准+求根前置滤。日月交点不逆不列。
    _MEAN_DAILY_SPEED = {
        const.MERCURY: 1.383, const.VENUS: 1.2, const.MARS: 0.524, const.JUPITER: 0.083,
        const.SATURN: 0.033, const.URANUS: 0.012, const.NEPTUNE: 0.006, const.PLUTO: 0.004,
    }

    def _ownChariotExempt(self, objid):
        """[WP-2] own chariot(Porphyry 引):行星在自己的界(term)或当值三分主(昼/夜随 sect)领地内,
        免「燃烧/日光束下」判定;cazimi 吉态不豁免。默认关=零回归零成本。仅有界/三分身份的七政生效。"""
        if not self._combustOwnChariot:
            return False
        try:
            o = self.chart.get(objid)
            if essential.term(o.sign, o.signlon) == objid:
                return True
            trip = essential.dayTrip(o.sign) if self.isDiurnal else essential.nightTrip(o.sign)
            return trip == objid
        except Exception:
            return False

    def _nearestStation(self, swid, jd):
        """±40 日窗内最近的速度变号点(留)。逐日粗扫 + 24 次二分。
        返回 (t0_jd, sd_bool) —— sd=True 为顺行留(逆转顺 SD);无留点返回 None。"""
        try:
            def spd(t):
                return swisseph.calc_ut(t, swid, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0][3]
            prev_t = jd - 40.0
            prev_v = spd(prev_t)
            hit = None
            t = prev_t + 1.0
            while t <= jd + 40.0:
                v = spd(t)
                if (prev_v < 0) != (v < 0):
                    lo, hi = prev_t, t
                    lov = prev_v
                    for _ in range(24):
                        mid = (lo + hi) / 2.0
                        mv = spd(mid)
                        if (lov < 0) != (mv < 0):
                            hi = mid
                        else:
                            lo, lov = mid, mv
                    t0 = (lo + hi) / 2.0
                    sd = bool(prev_v < 0)   # 由逆转顺
                    if hit is None or abs(t0 - jd) < abs(hit[0] - jd):
                        hit = (t0, sd)
                prev_t, prev_v = t, v
                t += 1.0
            return hit
        except Exception:
            return None

    def _stationState(self, obj, planet):
        """[WP-2] 留驻判定四法 → 'S'(留驻带内/将留)/'D'(顺行留后回顺初段)/None。
        默认 off 零成本;absSpeed/relSpeed 瞬时零额外星历;exactWindow/distance 仅对
        「近留候选」(|日速|<20% 均速)求根,单星最多一次求根。"""
        mode = self._stationMode
        if mode == 'off' or not mode:
            return None
        mean = self._MEAN_DAILY_SPEED.get(obj)
        if mean is None:
            return None
        try:
            v = float(getattr(planet, 'lonspeed', 0.0))
        except Exception:
            return None
        if mode == 'absSpeed':
            return 'S' if abs(v) < (1.0 / 60.0) else None
        if mode == 'relSpeed':
            return 'S' if abs(v) < 0.03 * mean else None
        if mode in ('exactWindow', 'distance'):
            if abs(v) >= 0.2 * mean:
                return None   # 远离留驻带,免求根
            # 注:setupPlanets 的 _SWE_BODY 是函数局部,此处自带八行星映射(日月交点不逆不列)。
            _SW = {const.MERCURY: swisseph.MERCURY, const.VENUS: swisseph.VENUS, const.MARS: swisseph.MARS,
                   const.JUPITER: swisseph.JUPITER, const.SATURN: swisseph.SATURN, const.URANUS: swisseph.URANUS,
                   const.NEPTUNE: swisseph.NEPTUNE, const.PLUTO: swisseph.PLUTO}
            swid = _SW.get(obj)
            if swid is None:
                return None
            hit = self._nearestStation(swid, self.dateTime.jd)
            if hit is None:
                return None
            t0, sd = hit
            if mode == 'exactWindow':
                if abs(self.dateTime.jd - t0) > 1.0:
                    return None
            else:
                try:
                    lon0 = swisseph.calc_ut(t0, swid, swisseph.FLG_SWIEPH)[0][0]
                except Exception:
                    return None
                d = abs(((planet.lon - lon0 + 180.0) % 360.0) - 180.0)
                if d > (2.0 / 60.0):
                    return None
            return 'D' if (sd and self.dateTime.jd >= t0) else 'S'
        return None

    def _applyTopoMoon(self):
        """[WP-2] 月亮站心视差修正:测站坐标重算月亮(黄经差可达 ~1°),随后福点与全部
        阿拉伯点按新月位重投(点公式吃月)。默认关零回归。set_topo 显式逐次设置
        (防跨请求泄漏,照 astroextra CENTER_FLAGS 纪律;仅本次带 FLG_TOPOCTR 的 calc 受影响)。"""
        if not self._topoMoon:
            return
        from flatlib.tools import arabicparts as _ap
        try:
            moon = self.chart.getObject(const.MOON)
            pos = self.chart.pos
            jd = self.chart.date.jd
            with self.chart._siderealContext():
                swe.swisseph.set_topo(pos.lon, pos.lat, 0.0)
                flags = getattr(self.chart, 'flags', swe.SEDEFAULT_FLAG) | swe.swisseph.FLG_TOPOCTR
                xx = swe.swisseph.calc_ut(jd, 1, flags)[0]
                eq = swe.swisseph.calc_ut(jd, 1, flags | swe.SEFLG_EQUATORIAL)[0]
            moon.relocate(xx[0] % 360.0)
            moon.lat = xx[1]
            moon.lonspeed = xx[3]
            moon.latspeed = xx[4]
            moon.ra = eq[0] % 360.0
            moon.decl = eq[1]
            pf = self.chart.getObject(const.PARS_FORTUNA)
            if pf is not None:
                pf.relocate(_ap.partLon(const.PARS_FORTUNA, self.chart) % 360.0)
            for p in (getattr(self.chart, 'pars', None) or []):
                try:
                    p.relocate(_ap.partLon(p.id, self.chart) % 360.0)
                except Exception:
                    pass
        except Exception:
            pass

    def _diurnalWithSectBuffer(self):
        """G13 区分昼夜:默认纯几何地平(chart.isDiurnal);sectBuffer=='ptolemy5' 加 5° 缓冲——
        太阳虽在地平下,但黄经距上升点 5° 内(拂晓将升)仍判昼。默认 geo 零回归。
        [WP-2] sectBuffer=='apparent':视地平判昼——真日出/日没时刻(swisseph rise_trans,
        默认含大气折射-34′与日面上缘),比较「下一事件」归属:下一事件是日没⇒当前昼;是日出⇒当前夜。
        极昼极夜(rise_trans 无解)回落几何地平。
        sect 翻转连锁影响:得失区分凶星 / 三分昼夜序 / 福点反转 / 寿命法 hyleg 优先 / ZR 默认释放点。"""
        base = bool(self.chart.isDiurnal())
        data = self.data if isinstance(self.data, dict) else {}
        sb = data.get('sectBuffer')
        if sb == 'apparent':
            try:
                jd = self.chart.date.jd
                pos = self.chart.pos
                geopos = (pos.lon, pos.lat, 0.0)
                rr, tr = swe.swisseph.rise_trans(jd, swe.swisseph.SUN, swe.swisseph.CALC_RISE, geopos)
                rs, ts = swe.swisseph.rise_trans(jd, swe.swisseph.SUN, swe.swisseph.CALC_SET, geopos)
                if rr == 0 and rs == 0:
                    next_rise = tr[0]
                    next_set = ts[0]
                    return bool(next_set < next_rise)   # 将先日没 ⇒ 现在在地平上(昼)
            except Exception:
                pass
            return base
        if base or sb != 'ptolemy5':
            return base
        try:
            sun = self.chart.getObject(const.SUN)
            asc = self.chart.getAngle(const.ASC)
            d = abs(((sun.lon - asc.lon + 180.0) % 360.0) - 180.0)   # 太阳↔上升 最小角距 0..180
            return d <= 5.0
        except Exception:
            return base

    def setupDignities(self):
        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        if not self.tradition:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        sun = self.chart.get(const.SUN)
        signplanets = {}
        for obj in planets:
            try:
                pla = self.chart.getObject(obj)
            except:
                continue
            if pla.sign not in signplanets.keys():
                signplanets[pla.sign] = []
            signplanets[pla.sign].append(obj)

        for itemA in planets:
            try:
                obj = self.chart.get(itemA)
            except:
                continue
            dig = essential.getInfo(obj.sign, obj.signlon)
            govidx = (const.LIST_SIGNS.index(obj.sign) - 3 + len(const.LIST_SIGNS)) % len(const.LIST_SIGNS)
            govsign = const.LIST_SIGNS[govidx]
            govplanets = []
            if govsign in signplanets.keys():
                govplanets = signplanets[govsign]

            obj.score = essential.score(itemA, obj.sign, obj.signlon)
            obj.dignities = dig
            obj.selfDignity = self.takePlanetDignity(itemA, dig)
            obj.isPeregrining = essential.isPeregrine(itemA, obj.sign, obj.signlon)
            obj.governSign = govsign
            obj.governPlanets = govplanets
            if itemA == const.MOON:
                obj.isVOC = self.dynchart.isVOC(itemA, self._vocMode, self._vocIncludeOuter)
                obj.moonPhase = self.chart.getMoonPhase()

        # 交点入旺(古典口径开关,classical_request.push_request_exalt_variants)开着时,当前尊贵表把交点排进
        # 双子 / 射手的擢升与落位:落在这两座的交点给出自身禀赋(擢升 / 落)与分值(按当前分值表,缺省 ±4)。
        # 交点没有本垣 / 三分 / 界 / 面,不在这两座时不给禀赋(不显示成「游走」);开关关着时交点不进尊贵计算(零回归)。
        for node in _nodes_in_dignity_table():
            try:
                obj = self.chart.get(node)
            except Exception:
                continue
            dig = essential.getInfo(obj.sign, obj.signlon)
            own = self.takePlanetDignity(node, dig)
            if own:
                obj.dignities = dig
                obj.selfDignity = own
                obj.score = essential.score(node, obj.sign, obj.signlon)

    def takePlanetDignity(self, planetId, dignities):
        res = []
        if dignities['ruler'] == planetId:
            res.append('ruler')
        if dignities['exalt'] == planetId:
            res.append('exalt')
        if dignities['dayTrip'] == planetId:
            res.append('dayTrip')
        if dignities['nightTrip'] == planetId:
            res.append('nightTrip')
        if dignities['partTrip'] == planetId:
            res.append('partTrip')
        if dignities['term'] == planetId:
            res.append('term')
        if dignities['face'] == planetId:
            res.append('face')
        if dignities['fall'] == planetId:
            res.append('fall')
        if dignities['exile'] == planetId:
            res.append('exile')

        return res

    def hayyiz(self, planet, isDiunal):
        """
        计算得时失时
        :param planet:
        :param isDiunal:
        :return:
        """
        res = 'None'
        planet.aboveHorizon = self.isAboveHorizon(planet)
        if planet.id in const.LIST_SEVEN_PLANETS:
            if planet.aboveHorizon:
                fact = planet.faction()
                sigidx = const.LIST_SIGNS.index(planet.sign)
                if isDiunal and fact == const.DIURNAL:
                    if sigidx % 2 == 0:
                        res = 'Hayyiz'
                elif isDiunal == False and fact == const.DIURNAL and sigidx % 2 == 1:
                    res = 'InWrongPos'
                elif isDiunal == False and fact == const.NOCTURNAL:
                    if planet.id == const.MARS:
                        if sigidx % 2 == 0:
                            res = 'Hayyiz'
                        else:
                            res = 'DemiHayyiz'
                    else:
                        if sigidx % 2 == 1:
                            res = 'Hayyiz'
                elif isDiunal and fact == const.NOCTURNAL and sigidx % 2 == 0:
                    res = 'InWrongPos'
        planet.hayyiz = res
        return res

    def getVulcan(self):
        """[WP-8] 祝融星(推算行星,灵学体系;默认 off 返回 None=响应零字段):
        'weston' = Swiss Ephemeris 内置轨道根数(虚构行星 55 号;需 seorbel 扩展文件——运行时探测,
                   不可用时诚实回落 baker 几何并标 method='baker(fallback)',绝不伪造精度);
        'baker'  = 纯几何:恒在水星向日侧,距日 min(3°, |水星−太阳|)(水星距日 <3° 时合日)。"""
        data = self.data if isinstance(self.data, dict) else {}
        mode = data.get('vulcanCalc') or 'off'
        if mode not in ('weston', 'baker'):
            return None
        try:
            sun = self.chart.getObject(const.SUN)
            mercury = self.chart.getObject(const.MERCURY)
            if sun is None or mercury is None:
                return None
            jd = self.chart.date.jd
            lon = None
            method = mode
            if mode == 'weston':
                try:
                    with self.chart._siderealContext():
                        flags = getattr(self.chart, 'flags', swe.SEDEFAULT_FLAG)
                        xx = swe.swisseph.calc_ut(jd, 55, flags)[0]
                    lon = xx[0] % 360.0
                except Exception:
                    lon = None
                    method = 'baker(fallback)'   # 星历扩展缺失:诚实回落几何法并标注
            if lon is None:
                d = ((mercury.lon - sun.lon + 180.0) % 360.0) - 180.0   # 水星相对太阳的有向弧
                step = max(-3.0, min(3.0, d))
                lon = (sun.lon + step) % 360.0
            sign_idx = int(lon // 30) % 12
            return {
                'lon': round(lon, 6),
                'sign': const.LIST_SIGNS[sign_idx],
                'signlon': round(lon % 30.0, 6),
                'method': method,
                'distToSun': round(abs(((lon - sun.lon + 180.0) % 360.0) - 180.0), 4),
            }
        except Exception:
            return None
