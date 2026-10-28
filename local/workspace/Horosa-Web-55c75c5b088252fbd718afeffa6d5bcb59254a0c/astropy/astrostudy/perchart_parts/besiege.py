"""PerChart 的围攻与护卫一族方法(由排盘模块整段搬出;PerChart 类仍在 astrostudy.perchart,经继承取得)。"""
from flatlib import const
from flatlib import props
from astrostudy.perchart_parts.chart_tables import takeDelta, takeAttackDelta


class BesiegeMixin:
    """围攻与护卫:夹星 / 夹宫 / 围攻 / 协防 / 东出西入。"""

    def surroundPlanet(self, planet):
        oc = self.orientalOccidental()
        ocary = oc[planet.id]
        if len(ocary['occidental']) == 0 or len(ocary['oriental']) == 0:
            return []

        firstOcci = ocary['occidental'][0]
        firstOrient = ocary['oriental'][0]
        if firstOcci['delta'] + firstOrient['delta'] > 90:
            return []

        res = [firstOrient, firstOcci]
        return res


    def surroundPlanets(self):
        res = {}
        res[const.SUN] = []
        res[const.MOON] = []
        res['BySunMoon'] = None

        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in planets:
            try:
                planet = self.chart.getObject(obj)
            except:
                continue
            surobj = self.surroundPlanet(planet)
            if len(surobj) == 0:
                continue

            if obj == const.SUN or obj == const.MOON:
                res[obj] = surobj
            elif (surobj[0]['id'] == const.SUN and surobj[1]['id'] == const.MOON) or (surobj[1]['id'] == const.SUN and surobj[0]['id'] == const.MOON):
                res[obj] = {
                    'id': obj,
                    'SunMoon': surobj
                }

        return res

    def getSign(self, obj, asp):
        lon = obj.lon + asp
        lon = lon if lon >= 0 else 360 + lon
        lon = lon % 360
        idx = int(lon / 30)
        signlon = lon % 30
        return {
            'sign': const.LIST_SIGNS[idx],
            'signlon': signlon
        }

    def surroundAttack(self, planet):
        aspectlist = [-120, -90, -60, 0, 60, 90, 120, 180]
        alltmp = []
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        orb = 27
        edgeOrb = 7

        for objA in planets:
            if objA == planet.id:
                continue
            try:
                planetA = self.chart.getObject(objA)
            except:
                continue
            edgeOrbA = props.object.orb[planetA.id]
            for aspA in aspectlist:
                sigA = self.getSign(planetA, aspA)
                pntA = (planetA.lon + aspA + 360) % 360
                deltaA = (pntA - planet.lon + 360) % 360
                deltaA = deltaA if deltaA <= 180 else 360 - deltaA
                if deltaA > orb:
                    continue

                for objB in planets:
                    if objA == objB or objB == planet.id:
                        continue
                    try:
                        planetB = self.chart.getObject(objB)
                    except:
                        continue
                    edgeOrbB = props.object.orb[planetB.id]
                    # 用独立变量存「对的合并容许度」:原先复用外层 orb(=27),第一对之后
                    # 外层 deltaA 过滤/回绕窗口全被上一对的值污染,围攻判定随迭代顺序漂移。
                    pairOrb = edgeOrbA + edgeOrbB
                    for aspB in aspectlist:
                        sigB = self.getSign(planetB, aspB)
                        pntB = (planetB.lon + aspB + 360) % 360
                        deltaB = (pntB - planet.lon + 360) % 360
                        deltaB = deltaB if deltaB <= 180 else 360 - deltaB
                        # 原 `deltaA > orb or deltaA > orb` 为复制粘贴笔误,第二项应查 deltaB
                        if deltaA > pairOrb or deltaB > pairOrb:
                            continue

                        deltaAB = (pntA - pntB + 360) % 360
                        deltaAB = deltaAB if deltaAB <= 180 else 360 - deltaAB
                        if deltaAB <= pairOrb and deltaA <= edgeOrbA and deltaB <= edgeOrbB:
                            congPnt = (planet.lon + 180) % 360
                            if (pntA <= planet.lon <= pntB <= congPnt or congPnt <= pntA <= planet.lon <= pntB) or (360-pairOrb <= pntA <= planet.lon <= 360 and 0<= pntB <= pairOrb) or (360-pairOrb <= pntA and 0<= planet.lon <=pntB <= pairOrb):
                                atk = [{
                                    'aspect': aspA,
                                    'id': objA,
                                    'lon': pntA,
                                    'sign': sigA['sign'],
                                    'signlon': sigA['signlon'],
                                    'delta': deltaA
                                }, {
                                    'aspect': aspB,
                                    'id': objB,
                                    'lon': pntB,
                                    'sign': sigB['sign'],
                                    'signlon': sigB['signlon'],
                                    'delta': deltaB
                                }]
                                alltmp.append(atk)
                            elif (pntB <= planet.lon <= pntA <= congPnt or congPnt <= pntB <= planet.lon <= pntA) or (360-orb <= pntB <=planet.lon <= 360 and 0<= pntA <= orb) or (360-orb <= pntB and 0<= planet.lon <=pntA <= orb):
                                atk = [{
                                    'aspect': aspB,
                                    'id': objB,
                                    'lon': pntB,
                                    'sign': sigB['sign'],
                                    'signlon': sigB['signlon'],
                                    'delta': deltaB
                                }, {
                                    'aspect': aspA,
                                    'id': objA,
                                    'lon': pntA,
                                    'sign': sigA['sign'],
                                    'signlon': sigA['signlon'],
                                    'delta': deltaA
                                }]
                                alltmp.append(atk)

        alltmp.sort(key=takeAttackDelta)

        sunMoon = []
        venusJupiter = []
        marsSaturn = []
        for elm in alltmp:
            obj0 = elm[0]
            obj1 = elm[1]
            if (obj0['id'] == const.SUN and obj1['id'] == const.MOON) or (obj0['id'] == const.MOON and obj1['id'] == const.SUN):
                sunMoon = elm
            elif (obj0['id'] == const.VENUS and obj1['id'] == const.JUPITER) or (obj0['id'] == const.JUPITER and obj1['id'] == const.VENUS):
                venusJupiter = elm
            elif (obj0['id'] == const.MARS and obj1['id'] == const.SATURN) or (obj0['id'] == const.SATURN and obj1['id'] == const.MARS):
                marsSaturn = elm

        return {
            'SunMoon': sunMoon,
            'VenusJupiter': venusJupiter,
            'MarsSaturn': marsSaturn,
            'MinDelta': [] if len(alltmp) == 0 else alltmp[0]
        }

    # v3.0.1 perf ROUND-5:besiegementDetail 会再次调用本方法,而 webchartsrv 同一响应里已在
    # surround.attacks 键算过一遍(4 层 7×8×6×8 相位点循环 ×7 目标)。memo;相位数学只读不可变的
    # lon/sign 状态(getAspects 的 sunPos 变异不进本函数)。重复调用逐字节等值已实测。
    def surroundAttacks(self):
        if self._surroundAttacksCache is None:
            self._surroundAttacksCache = self._computeSurroundAttacks()
        return self._surroundAttacksCache

    def _computeSurroundAttacks(self):
        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in planets:
            try:
                planet = self.chart.get(obj)
            except:
                continue
            atk = self.surroundAttack(planet)
            if len(atk['SunMoon']) > 0 or len(atk['VenusJupiter']) > 0 or len(atk['MarsSaturn']) > 0 or len(atk['MinDelta']) > 0:
                res[obj] = atk

        return res

    # ── 围攻详断(《围攻》十六式):三种围 + 春秋势 + 宰执夏冬 + 协防 + 围魏救赵 + 日木互容制约 + 逆行 ──
    _BESIEGE_TYPE = {
        'MarsSaturn': ('围攻', '凶', ['Mars', 'Saturn']),
        'VenusJupiter': ('围荣', '富', ['Venus', 'Jupiter']),
        'SunMoon': ('围耀', '贵', ['Sun', 'Moon']),
    }

    def _is_strong_house(self, planet_obj):
        """后天强弱:一旦主宰 3/6/8/12 任一宫即「被污染」→弱(即便同时主吉宫,如主6又主10仍弱);
        只主吉宫(全不沾 3/6/8/12)→强;无主宫(罕见)退看落宫是否非凶宫。"""
        if planet_obj is None:
            return False
        weak = {const.LIST_HOUSES[i] for i in (2, 5, 7, 11)}  # House3/6/8/12
        try:
            rh = getattr(planet_obj, 'ruleHouses', []) or []
            if any(h in weak for h in rh):
                return False                                   # 主凶宫 → 污染 → 弱
            if rh:
                return True                                    # 只主吉宫 → 强
            return getattr(planet_obj, 'house', None) not in weak   # 无主宫,退看落宫
        except Exception:
            return False

    def _besiege_defense(self, target_id, target_lon, attacker_eps):
        """协防(《围攻》弃车保帅):吉星 木/日/金(及弱势水/月) 的相位点须落入「围攻区域」截击某围攻者——
        即与该侧围攻者相位点同侧、且更靠近被围星(距≤围攻者距,挡在被围星与围攻者之间),方成协防。
        以身作盾=截击的相位为合相(吉星本体落在围攻区内,如金身卫日);否则遥光(本体在它处、仅远程光线抵达)。
        强=主/落强宫(除3/6/8/12外;日木金可任,水月恒弱且协防常自陷、得不偿失)。"""
        aspectlist = [-120, -90, -60, 0, 60, 90, 120, 180]

        def sd(x):
            return ((x - target_lon + 180.0) % 360.0) - 180.0

        # 各侧最近的围攻者及其距(春=被围星高经度侧 d>0 / 秋=低经度侧)。
        side_attacker = {}
        for ep in (attacker_eps or []):
            d = sd(ep['lon'])
            s = '春' if d > 0 else '秋'
            if s not in side_attacker or abs(d) < side_attacker[s][1]:
                side_attacker[s] = (ep['id'], abs(d))

        out = []
        for yid in (const.JUPITER, const.SUN, const.VENUS, const.MOON, const.MERCURY):
            if yid == target_id:
                continue
            try:
                y = self.chart.getObject(yid)
            except Exception:
                continue
            best_asp, best_d = None, None
            for asp in aspectlist:
                d = sd((y.lon + asp + 360.0) % 360.0)
                if best_d is None or abs(d) < abs(best_d):
                    best_asp, best_d = asp, d
            if best_d is None:
                continue
            side = '春' if best_d > 0 else '秋'
            atkr = side_attacker.get(side)
            # 须截击:该侧有围攻者,且吉星相位点更近被围星(挡在中间)。否则不构成协防。
            if not atkr or abs(best_d) > atkr[1] + 1e-6:
                continue
            out.append({'id': yid, 'aspect': best_asp, 'side': side, 'against': atkr[0],
                        'orb': round(abs(best_d), 2),
                        'byBody': best_asp == 0,   # 截击相位=合相 ⇒ 吉星本体落在围攻区内 = 身盾;否则遥光
                        'strong': self._is_strong_house(y) and yid in (const.JUPITER, const.SUN, const.VENUS),
                        'selfTrap': yid in (const.MOON, const.MERCURY)})   # 水月协防得不偿失、反自陷
        return out

    def besiegementDetail(self):
        attacks = self.surroundAttacks()
        if not attacks:
            return []
        SIGNS = const.LIST_SIGNS

        def obj_of(pid):
            try:
                return self.chart.getObject(pid)
            except Exception:
                return None

        # 日木互容制约:被日/木互容的火/土,凶减半。文中"只有日、木可以,他俩还要主强宫"→ 制约方 须主/落强宫。
        # getMutuals()→{normal:[],abnormal:[]},每项 {planetA:{id..},planetB:{id..}}。
        restrained = {}
        try:
            mut = self.getMutuals() or {}
            for item in (mut.get('normal', []) + mut.get('abnormal', [])):
                a = (item.get('planetA') or {}).get('id')
                b = (item.get('planetB') or {}).get('id')
                for auth in (const.SUN, const.JUPITER):
                    if not self._is_strong_house(obj_of(auth)):   # 日/木 须主强宫方能制约
                        continue
                    if a == auth and b:
                        restrained.setdefault(b, []).append(auth)
                    elif b == auth and a:
                        restrained.setdefault(a, []).append(auth)
        except Exception:
            pass

        # 围魏救赵:围攻者自身也被某「围」(火土/金木/日月皆可,如日月围其凶星)所围 → 其害减。
        besieged_set = set(tid for tid, a in attacks.items()
                           if a.get('SunMoon') or a.get('VenusJupiter') or a.get('MarsSaturn'))

        out = []
        for tid, atk in attacks.items():
            t = obj_of(tid)
            if t is None:
                continue
            tsi = SIGNS.index(t.sign)
            for typ in ('MarsSaturn', 'VenusJupiter', 'SunMoon'):
                if not atk.get(typ):
                    continue
                kind, nature, _ids = self._BESIEGE_TYPE[typ]
                is_malefic = (typ == 'MarsSaturn')
                besiegers = []
                for ep in atk[typ]:
                    bid = ep['id']
                    b = obj_of(bid)
                    if b is None:
                        continue
                    # 春秋四季只标在「围攻者」(组间关系,被围星之冬夏可由此自然推得,不另标):
                    # off = 围攻者座 − 被围星座(星座相位,非光线)。春{7-11}主宰/秋{1-5}受制;
                    # 春+宰执被围星(off==9,被围星落围攻者10座之逆=围攻者落被围星之上)→ 夏(强极);
                    # 秋+被被围星宰执(off==3,被围星落围攻者10座)→ 冬(弱极)。
                    off = (SIGNS.index(b.sign) - tsi) % 12
                    if off in (7, 8, 9, 10, 11):
                        season = '夏' if off == 9 else '春'
                    elif off in (1, 2, 3, 4, 5):
                        season = '冬' if off == 3 else '秋'
                    else:
                        season = '中'
                    info = {'id': bid, 'aspect': ep['aspect'], 'season': season,
                            'retro': (getattr(b, 'lonspeed', 0) or 0) < 0, 'delta': round(ep.get('delta', 0), 2)}
                    if is_malefic:
                        info['restrained'] = restrained.get(bid, [])
                        info['counterBesieged'] = bid in besieged_set
                    besiegers.append(info)
                # 火土有一围攻者为春/夏(主宰侧)→ 见血(《围攻》:火土只要一颗为春夏,必见血)。
                severe = bool(is_malefic and any(x['season'] in ('春', '夏') for x in besiegers))
                # 协防:吉星相位点须截击某围攻者(同侧且更近被围星),并注明防御的是哪颗围攻星(against)。
                defense = self._besiege_defense(tid, t.lon, atk[typ]) if is_malefic else []
                out.append({
                    'target': tid, 'type': typ, 'kind': kind, 'nature': nature,
                    'besiegers': besiegers,
                    'targetRetro': (getattr(t, 'lonspeed', 0) or 0) < 0,
                    'severe': severe if is_malefic else None,
                    'defense': defense,
                })
        return out


    def surroundHouse(self, houseid):
        oc = self.orientalOccidentalHouses()
        ocary = oc[houseid]
        if len(ocary['occidental']) == 0 or len(ocary['oriental']) == 0 or len(ocary['inHouse']) > 0:
            return []

        idx = const.LIST_HOUSES.index(houseid)
        prevIdx = (12 + idx - 1) % 12
        nextIdx = (12 + idx + 1) % 12
        house = self.chart.getHouse(houseid)
        prevH = self.chart.getHouse(const.LIST_HOUSES[prevIdx])
        nextH = self.chart.getHouse(const.LIST_HOUSES[nextIdx])
        firstOcci = ocary['occidental'][0]
        firstOrient = ocary['oriental'][0]
        if firstOcci['delta'] > house.size + nextH.size or firstOrient['delta'] > prevH.size:
            return []

        res = [{
            'id': firstOrient['id'],
            'delta': firstOrient['delta']
        }, {
            'id': firstOcci['id'],
            'delta': firstOcci['delta'] - house.size
        }]
        return res



    def surroundHouses(self):
        res = {}
        for obj in const.LIST_HOUSES:
            houseRes = self.surroundHouse(obj)
            if len(houseRes) == 0:
                continue
            res[obj] = houseRes

        return res

    def orientalOccidental(self):
        if self.orientOccident != None:
            return self.orientOccident

        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in planets:
            try:
                planet = self.chart.getObject(obj)
            except:
                continue
            pntA = planet.lon
            pntB = pntA + 180 if pntA <= 180 else pntA - 180
            res[obj] = {
                'oriental': [],
                'occidental': []
            }
            for elm in planets:
                if obj == elm:
                    continue
                try:
                    planetB = self.chart.getObject(elm)
                except:
                    continue
                if (pntB < planetB.lon < pntA) or (0<= planetB.lon < pntA and pntB > 180) or (pntB > 180 and planetB.lon > pntB):
                    delta = planet.lon - planetB.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['oriental'].append({
                        'id': elm,
                        'delta': delta
                    })
                else:
                    delta = planetB.lon - planet.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['occidental'].append({
                        'id': elm,
                        'delta': delta
                    })
            res[obj]['oriental'].sort(key=takeDelta)
            res[obj]['occidental'].sort(key=takeDelta)

        self.orientOccident = res
        return res

    def orientalOccidentalHouses(self):
        if self.orientOccidentHouses != None:
            return self.orientOccidentHouses

        res = {}
        planets = const.LIST_SEVEN_PLANETS.copy()
        # if self.tradition == False:
        #     planets.append(const.URANUS)
        #     planets.append(const.NEPTUNE)
        #     planets.append(const.PLUTO)

        for obj in const.LIST_HOUSES:
            house = self.chart.get(obj)
            pntA = house.lon
            pntB = pntA + 180 if pntA <= 180 else pntA - 180
            res[obj] = {
                'inHouse': [],
                'oriental': [],
                'occidental': []
            }
            for elm in planets:
                try:
                    planetB = self.chart.getObject(elm)
                except:
                    continue
                if elm in house.planets:
                    res[obj]['inHouse'].append({
                        'id': elm,
                        'delta': planetB.lon - house.lon
                    })
                    continue
                if (pntB < planetB.lon < pntA) or (0<= planetB.lon < pntA and pntB > 180) or (pntB > 180 and planetB.lon > pntB):
                    delta = house.lon - planetB.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['oriental'].append({
                        'id': elm,
                        'delta': delta
                    })
                else:
                    delta = planetB.lon - house.lon
                    delta = delta if delta >= 0 else delta + 360
                    res[obj]['occidental'].append({
                        'id': elm,
                        'delta': delta
                    })
            res[obj]['inHouse'].sort(key=takeDelta)
            res[obj]['oriental'].sort(key=takeDelta)
            res[obj]['occidental'].sort(key=takeDelta)

        self.orientOccidentHouses = res
        return res
