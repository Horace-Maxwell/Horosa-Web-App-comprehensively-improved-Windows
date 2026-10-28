"""PerChart 的相位与互容一族方法(由排盘模块整段搬出;PerChart 类仍在 astrostudy.perchart,经继承取得)。"""
from flatlib import const
from flatlib import aspects
from flatlib.tools import arabicparts
from astrostudy.perchart_parts.chart_tables import excludeBad, isStrongGood, takeAsp


class AspectsMixin:
    """相位与互容:接纳 / 互容 / 即时相位 / 日下状态 / 相位表 / 映点 / 星座相位 / 赤纬平行 / 扩展相位对象。"""

    def getReceptions(self):
        res = {
            'normal': [],
            'abnormal': []
        }
        planets = const.LIST_SEVEN_PLANETS.copy()
        if self.tradition == False:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        for itemA in planets:
            for itemB in planets:
                if itemA != itemB:
                    try:
                        planetB = self.chart.getObject(itemB)
                        rec = self.dynchart.receives(itemA, itemB)
                    except:
                        continue
                    if len(rec) > 0:
                        filter_ = ['exile', 'fall']
                        list = []
                        for ele in rec:
                            if ele not in filter_:
                                list.append(ele)

                        dig = planetB.selfDignity
                        if ('exalt' in list or 'ruler' in list) or (len(list) > 1 and self.strongRecption == False):
                            obj = {
                                'beneficiary': itemB,
                                'supplier': itemA,
                                'beneficiaryDignity': dig,
                                'supplierRulerShip': rec
                            }
                            if 'exile' in dig or 'fall' in dig:
                                res['abnormal'].append(obj)
                            else:
                                res['normal'].append(obj)

        return res

    # v3.0.1 perf ROUND-5:besiegementDetail 会再次调用本方法(10×10 inDignities 对),同一响应的
    # mutuals 键已算过。memo;只读互容判定,无状态变异。重复调用逐字节等值已实测。
    def getMutuals(self):
        if self._mutualsCache is None:
            self._mutualsCache = self._computeMutuals()
        return self._mutualsCache

    def _computeMutuals(self):
        res = []
        planets = const.LIST_SEVEN_PLANETS.copy()
        if self.tradition == False:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        for itemA in planets:
            for itemB in planets:
                if itemA != itemB:
                    flag = False
                    for obj in res:
                        if itemA in obj['mutual'] and itemB in obj['mutual']:
                            flag = True
                            break
                    if flag:
                        continue
                    try:
                        orgab = self.dynchart.inDignities(itemA, itemB)
                        orgba = self.dynchart.inDignities(itemB, itemA)
                        ablist = list(filter(excludeBad, orgab))
                        balist = list(filter(excludeBad, orgba))
                        abgood = list(filter(isStrongGood, ablist))
                        bagood = list(filter(isStrongGood, balist))
                        if self.strongRecption:
                            if len(abgood) > 0 and len(bagood) > 0:
                                obj = {
                                    'mutual': [itemA, itemB],
                                    'dignity': [balist, ablist]
                                }
                                res.append(obj)
                        elif (len(ablist) > 1 and len(balist) > 1) or (len(abgood) > 0 and len(bagood) > 0) \
                                or (len(abgood) > 0 and len(balist) > 1) or (len(ablist) > 1 and len(bagood) > 0):
                            obj = {
                                'mutual': [itemA, itemB],
                                'dignity': [orgba, orgab]
                            }
                            res.append(obj)
                    except:
                        continue

        mobj = {
            'normal': [],
            'abnormal': []
        }
        for elm in res:
            elmobj = {
                'planetA': {
                    'id': elm['mutual'][0],
                    'rulerShip': elm['dignity'][0]
                },
                'planetB': {
                    'id': elm['mutual'][1],
                    'rulerShip': elm['dignity'][1]
                }
            }
            foundabnormal = False
            for elmdig in elm['dignity'][0]:
                if elmdig == 'exile' or elmdig == 'fall':
                    foundabnormal = True
                    break
            for elmdig in elm['dignity'][1]:
                if elmdig == 'exile' or elmdig == 'fall':
                    foundabnormal = True
                    break
            if foundabnormal:
                mobj['abnormal'].append(elmobj)
            else:
                mobj['normal'].append(elmobj)

        return mobj

    def getImmediateAspects(self):
        virPoints = const.LIST_VIRTUAL_POINTS
        res = {}
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists

        asplist = const.MAJOR_ASPECTS
        excludeVirpnt = not self.virtualPointReceiveAsp
        for itemA in planets:
            if not self.virtualPointReceiveAsp and itemA in virPoints:
                continue
            try:
                asp = self.dynchart.immediateAspects(itemA, asplist, excludeVirpnt)
                if asp[0] != None and asp[1] != None:
                    res[itemA] = asp
            except:
                continue
        return res


    def _assignSunPos(self, planets):
        """各体对太阳的黄经差 → sunPos(Cazimi / Combust / Sunbeams);阈值与相位表无关,own chariot 免燃烧/光束下(cazimi 不豁免)。"""
        try:
            sun = self.chart.get(const.SUN)
        except Exception:
            return
        if sun is None:
            return
        for pid in planets:
            if pid == const.SUN:
                continue
            try:
                plobj = self.chart.get(pid)
            except Exception:
                continue
            if plobj is None or getattr(plobj, 'lon', None) is None:
                continue
            # 只判实体/交点/小行星类(旧口径也只在与太阳成合相的这些体上设 sunPos;角点/希腊点/中点不设)
            if getattr(plobj, 'type', None) not in (const.OBJ_PLANET, const.OBJ_ASTEROID, const.OBJ_MOON_NODE) and pid not in const.LIST_OBJECTS:
                continue
            elong = abs(((float(plobj.lon) - float(sun.lon) + 180.0) % 360.0) - 180.0)
            if elong < self._sunPosCazimi:
                plobj.sunPos = 'Cazimi'
            elif self._ownChariotExempt(pid):
                pass   # own chariot:界/当值三分内免燃烧与光束下(cazimi 吉态不豁免)
            elif self._sunPosCazimi <= elong < self._sunPosCombust:
                plobj.sunPos = 'Combust'
            elif self._sunPosCombust <= elong < self._sunPosBeams:
                plobj.sunPos = 'Sunbeams'

    def getAspects(self):
        virPoints = const.LIST_VIRTUAL_POINTS.copy()
        virPoints.extend(arabicparts.LIST_PARS)
        res = {}
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists
        planets = planets.copy()
        planets.extend(const.LIST_ANGLES)
        planets.extend(arabicparts.LIST_PARS)
        planets.extend(const.LIST_MIDDLE_POINTS)

        asplist = const.MAJOR_ASPECTS.copy()
        asplist.append(45)
        excludeVirpnt = not self.virtualPointReceiveAsp
        # 太阳三态(sunPos)改按黄经差直算(与偕日相 phase 链同源),不再依赖相位表:
        # 此前只在「与太阳成合相且在相位表内」的对象上判 → 容许度判据体系切整星座两档时跨座 6° 的水星不再「燃烧」、
        # 「按相位名」档 8° 外不再「日光束下」,且与逐星按黄经差的偕日相卡两行分叉。
        self._assignSunPos(planets)
        for itemA in planets:
            if not self.virtualPointReceiveAsp and itemA in virPoints:
                continue
            try:
                item = self.chart.get(itemA)
            except:
                continue
            if item.type == const.OBJ_ARABIC_PART:
                continue

            asp = self.dynchart.aspectsByCat(itemA, asplist, excludeVirpnt)
            asp['Obvious'] = []
            for obj in asp['Exact']:
                asp['Obvious'].append(obj)

            for obj in asp['Applicative']:
                if obj['orb'] <= aspects.MAX_MINOR_ASP_ORB:
                    asp['Obvious'].append(obj)

            for obj in asp['None']:
                if obj['orb'] <= aspects.MAX_MINOR_ASP_ORB:
                    asp['Obvious'].append(obj)

            for obj in asp['Separative']:
                if obj['orb'] <= aspects.MAX_MINOR_ASP_ORB:
                    asp['Obvious'].append(obj)

            res[itemA] = asp


        return res

    def _getSameSignlonObj(self, planets, obj):
        res = []
        for planet in planets:
            if planet != obj.id:
                cmpobj = self.chart.getObject(planet)
                if cmpobj.sign == obj.sign and (abs(cmpobj.signlon - obj.signlon) < self._antisciaOrb):
                    res.append(cmpobj)
        for angle in const.LIST_ANGLES:
            cmpobj = self.chart.getAngle(angle)
            if cmpobj.sign == obj.sign and (abs(cmpobj.signlon - obj.signlon) < self._antisciaOrb):
                res.append(cmpobj)
        if len(res) > 0:
            return res
        return None

    def getAntiscia(self):
        ares = []
        cares = []
        planets = const.LIST_OBJECTS_TRADITIONAL
        if self.tradition == False:
            planets = self.objlists

        for item in planets:
            planet = self.chart.getObject(item)
            obj = planet.antiscia()
            cobj = planet.cantiscia()
            anti = self._getSameSignlonObj(planets, obj)
            canti = self._getSameSignlonObj(planets, cobj)
            if anti != None:
                flag = True
                for tmp in ares:
                    if item in tmp:
                        flag = False
                        break
                if flag:
                    for antiobj in anti:
                        ares.append([item, antiobj.id, abs(antiobj.signlon - obj.signlon)])

            if canti != None:
                flag = True
                for tmp in cares:
                    if item in tmp:
                        flag = False
                        break
                if flag:
                    for cantiobj in canti:
                        cares.append([item, cantiobj.id, abs(cantiobj.signlon - obj.signlon)])


        res = {
            'antiscia': ares,
            'cantiscia': cares
        }

        return res

    def getSignAspects(self):
        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        if self.tradition == False:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)

        for objA in planets:
            try:
                planetA = self.chart.getObject(objA)
            except:
                continue
            signIdxA = const.LIST_SIGNS.index(planetA.sign)

            res[objA] = []
            for objB in planets:
                if objA == objB:
                    continue
                try:
                    planetB = self.chart.getObject(objB)
                except:
                    continue
                signIdxB = const.LIST_SIGNS.index(planetB.sign)
                delta = signIdxA - signIdxB
                delta = delta if delta >= 0 else delta + 12
                if delta == 0:
                    res[objA].append({
                        'asp': 0,
                        'id': objB
                    })
                elif delta == 2:
                    res[objA].append({
                        'asp': 60,
                        'id': objB
                    })
                elif delta == 3:
                    res[objA].append({
                        'asp': 90,
                        'id': objB
                    })
                elif delta == 4:
                    res[objA].append({
                        'asp': 120,
                        'id': objB
                    })
                elif delta == 6:
                    res[objA].append({
                        'asp': 180,
                        'id': objB
                    })
                elif delta == 8:
                    res[objA].append({
                        'asp': 120,
                        'id': objB
                    })
                elif delta == 8:
                    res[objA].append({
                        'asp': 120,
                        'id': objB
                    })
                elif delta == 9:
                    res[objA].append({
                        'asp': 90,
                        'id': objB
                    })
                elif delta == 10:
                    res[objA].append({
                        'asp': 60,
                        'id': objB
                    })
            res[objA].sort(key=takeAsp)

        return res

    def getParallel(self):
        res = {}
        res['parallel'] = []
        res['contraParallel'] = {}

        planets = const.LIST_ALL_POINTS.copy()
        for objA in planets:
            try:
                planetA = self.chart.get(objA)
            except:
                continue
            for objB in planets:
                if objA == objB:
                    continue
                try:
                    planetB = self.chart.get(objB)
                except:
                    continue
                delta = abs(planetA.decl - planetB.decl)
                sameSize = planetA.decl * planetB.decl > 0
                if delta <= 1 and sameSize:
                    found = False
                    for pSet in res['parallel']:
                        if objA in pSet:
                            pSet.add(objB)
                            found = True
                            break
                    if found is False:
                        pSet = set()
                        pSet.add(objA)
                        pSet.add(objB)
                        res['parallel'].append(pSet)
                elif sameSize is False and abs(abs(planetA.decl) - abs(planetB.decl)) <= 1:
                    if objA in res['contraParallel']:
                        res['contraParallel'][objA].add(objB)
                    else:
                        # 原先建空 set 后漏 add(objB):每颗行星的第一个反平行伙伴被静默丢弃
                        res['contraParallel'][objA] = set()
                        res['contraParallel'][objA].add(objB)

        # set 迭代序随 PYTHONHASHSEED 跨进程漂移,同参请求在服务重启后响应字节不稳
        # (2026-07 对拍实证:仅此字段序漂移,数值全同)。出口确定化:组内按 id 字典序,
        # parallel 组间按首元素排序;纯排序,成员与数值零变。
        res['parallel'] = sorted((sorted(pSet) for pSet in res['parallel']), key=lambda grp: grp[0])
        res['contraParallel'] = {objA: sorted(objBs) for objA, objBs in res['contraParallel'].items()}
        return res

    def getExtraAspects(self):
        """[WP-5b] 相位参与对象扩展(默认全关=返回 None,响应零字段零回归):
        aspectIncludeCusps    → 行星×12 宫头 主相位(宫头无速度,恒 separating 语义;orb ≤3°);
        aspectIncludeLots     → 行星×希腊点 主相位(点为受体,单向;orb ≤3°);
        aspectIncludeMidpoints→ 行星×{日/月/Asc/MC}两两 6 组中点 0/90/180 硬相(orb ≤1.5°,量化盘先例)。
        (恒星汇合已有 chart.stars 现成输出,前端直接引用零重算。)
        固定口径不吃 orbSystem(对象无自有星轨,半距语义不适用;文档声明)。"""
        data = self.data if isinstance(self.data, dict) else {}
        def _on(k):
            return str(data.get(k, 0)) in ('1', 'true', 'True')
        want_cusps = _on('aspectIncludeCusps')
        want_lots = _on('aspectIncludeLots')
        want_mid = _on('aspectIncludeMidpoints')
        if not (want_cusps or want_lots or want_mid):
            return None
        MAJOR = (0, 60, 90, 120, 180)
        HARD = (0, 90, 180)
        planets = [self.chart.getObject(o) for o in const.LIST_SEVEN_PLANETS]
        planets = [p for p in planets if p is not None]
        def _pairs(targets, asps, orbcap):
            rows = []
            for t_id, t_lon in targets:
                for p in planets:
                    d = abs(((p.lon - t_lon + 180.0) % 360.0) - 180.0)
                    for asp in asps:
                        orb = abs(d - asp)
                        if orb <= orbcap:
                            rows.append({'planet': p.id, 'target': t_id, 'asp': asp,
                                         'orb': round(orb, 4)})
                            break
            return rows
        out = {}
        if want_cusps:
            targets = []
            for h in self.chart.houses:
                targets.append((getattr(h, 'id', ''), h.lon))
            out['cusps'] = _pairs(targets, MAJOR, 3.0)
        if want_lots:
            targets = [(const.PARS_FORTUNA, self.chart.getObject(const.PARS_FORTUNA).lon)] if self.chart.getObject(const.PARS_FORTUNA) else []
            for pobj in (getattr(self.chart, 'pars', None) or []):
                targets.append((pobj.id, pobj.lon))
            out['lots'] = _pairs(targets, MAJOR, 3.0)
        if want_mid:
            pts = []
            for oid in (const.SUN, const.MOON):
                o = self.chart.getObject(oid)
                if o is not None:
                    pts.append((oid, o.lon))
            for aid in (const.ASC, const.MC):
                a = self.chart.getAngle(aid)
                if a is not None:
                    pts.append((aid, a.lon))
            targets = []
            for i in range(len(pts)):
                for j in range(i + 1, len(pts)):
                    (id1, l1), (id2, l2) = pts[i], pts[j]
                    # 短弧中点:l1 + 有向短弧差的一半(模 360)。
                    mid = (l1 + (((l2 - l1 + 180.0) % 360.0) - 180.0) / 2.0) % 360.0
                    targets.append(('%s/%s' % (id1, id2), mid))
            out['midpoints'] = _pairs(targets, HARD, 1.5)
        return out
