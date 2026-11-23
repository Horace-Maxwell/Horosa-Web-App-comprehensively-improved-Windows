from flatlib import const
from astrostudy.germany.chart_objects import ephem_object
from astrostudy.perchart import PerChart
from astrostudy.stable_order import TIE_EPS, tie_sorted

LIST_OBJ = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN,
    const.NORTH_NODE, const.SOUTH_NODE, const.URANUS, const.NEPTUNE, const.PLUTO,
    const.DARKMOON, const.PURPLE_CLOUDS
]

# 严格汉堡因子集(D2):黑月/紫气非该学派因子(因子集=10 行星+8 虚星+Asc/MC/交点/白羊点)。
# strictFactors=True(仅 uranian=True 分支生效)时从「中点对来源」与「相位目标」双面剔除;
# 默认 False = 现状字节零回归(declination.py 的 LIST_DECL_PLANET 本就不含此二点,两处口径由此对齐)。
STRICT_EXCLUDE = (const.DARKMOON, const.PURPLE_CLOUDS)

def takeLon(obj):
    return obj['lon']


def near_midpoint(lon_a, lon_b):
    """近中点(短弧上的那个)。两点正对(相距恰 180°,如南北交点)时两个中点一样近:
    取黄经小的那个 —— 否则取哪个由黄经的浮点末位决定。前端同款:utils/uranianDial.js::midpoint。"""
    mid = (lon_a + lon_b) / 2.0
    gap = abs(mid - lon_a)
    if abs(gap - 90.0) <= TIE_EPS:
        return min(mid % 360, (mid + 180) % 360)
    if gap > 90:
        mid = (mid + 180) % 360
    return mid


# 个人点核心五点(宇宙生物学 Basic Five):Asc/MC/日/月/北交。
# personalOrb 仅作用于「相位目标」落在这五点时的放宽(宇宙生物学个人点宽容许度)。
BASIC_FIVE = (const.ASC, const.MC, const.SUN, const.MOON, const.NORTH_NODE)


class MidPoint:
    # uranian=False(默认):与历史实现逐字节一致,供合盘(modern/chartcomp.py)复用,绝不改其输出。
    #   (唯一的例外:正对的两点 —— 南北交点 —— 的中点。两个中点一样近,原先取哪个、出一条还是两条由黄经的浮点末位决定;
    #    现固定为黄经小的那一个、一条,见 near_midpoint。)
    # uranian=True(量化盘 /germany/midpoint 专用):
    #   ① 中点对来源纳入 Asc/MC(四轴)+ 8 颗 TNP 虚星(汉堡学派核心,原实现遗漏);
    #   ② 无序对各算一个近中点(短弧),消除原 A-B/B-A 双算 + 浮点精确去重导致的近/远重复;
    #   ③ 相位判断跨 0° 归一(修原 abs 差未归一致 mid≈359、obj≈0 漏判);orb 可配;
    #   ④ TNP 也作相位目标(捕获 TNP 落中点轴)。
    #
    # includeTnp / personalOrb / strictFactors 仅 uranian=True 分支生效,默认=现行为(零回归):
    #   includeTnp=False  → 8 颗 TNP 既不入中点对、也不作相位目标(宇宙生物学不用虚星);
    #   personalOrb=None  → 无分叉,全程用 self.orb;给定数值时仅「相位目标落 Basic Five」放宽到该值;
    #   strictFactors=True → 剔除黑月/紫气(STRICT_EXCLUDE,中点对+相位目标双面)。
    # uranian=False(合盘 modern/chartcomp.py 复用)逐字节不变:tnpObjs 恒空,这三个参数完全无作用。
    def __init__(self, perchart: PerChart, orb=1.0, uranian=False, includeTnp=True, personalOrb=None, strictFactors=False):
        self.perchart = perchart
        self.uranian = bool(uranian)
        try:
            self.orb = float(orb)
        except (TypeError, ValueError):
            self.orb = 1.0
        if not (0 < self.orb <= 10):
            self.orb = 1.0
        self.includeTnp = bool(includeTnp)
        self.strictFactors = bool(strictFactors)
        # personalOrb=None → 不分叉;否则校验为合法正容许度(同 orb 口径),非法则回退 None(无分叉)。
        self.personalOrb = None
        if personalOrb is not None:
            try:
                po = float(personalOrb)
                if 0 < po <= 30:
                    self.personalOrb = po
            except (TypeError, ValueError):
                self.personalOrb = None
        # 逐星取:个别小体在其星历物理域外(如凯龙 AD675-4649)时该星缺席,
        # 其余照常(域内全员在场,行为与旧实现一致)。
        self.objects = []
        for _oid in LIST_OBJ:
            try:
                _obj = self.perchart.chart.getObject(_oid)
            except KeyError:
                continue
            if _obj is not None:
                self.objects.append(_obj)
        self.tnpObjs = []
        if self.uranian:
            chart = perchart.chart
            angleObjs = [a for a in chart.angles if a.id in (const.ASC, const.MC)]
            if self.includeTnp:
                for uid in const.LIST_URANIAN:
                    try:
                        self.tnpObjs.append(ephem_object(perchart, uid))   # 按本盘黄道制取(恒星盘 = 恒星黄经)
                    except Exception:
                        pass
            # 严格因子集(D2):剔黑月/紫气,使中点对来源与 declination 因子口径一致。默认 False 不过滤。
            if self.strictFactors:
                self.objects = [o for o in self.objects if o.id not in STRICT_EXCLUDE]
            self.objects = self.objects + angleObjs + self.tnpObjs

    def getAspects(self, obj, mids):
        if self.uranian:
            return self._getAspectsUranian(obj, mids)
        # —— 历史路径(合盘复用,逐字节不变)——
        asps = {}
        asps[obj.id] = []
        for mid in mids:
            asp = {
                'idA': mid['idA'],
                'idB': mid['idB'],
                'aspect': -1
            }
            delta = abs(mid['lon'] - obj.lon)
            if delta < 1:
                asp['aspect'] = 0
                asp['delta'] = delta
            elif abs(delta - 90) < 1 or abs(delta - 270) < 1:
                tmpdelta = abs(delta - 90)
                if tmpdelta > 1:
                    tmpdelta = abs(delta - 270)
                asp['aspect'] = 90
                asp['delta'] = tmpdelta
            elif abs(delta - 180) < 1:
                asp['aspect'] = 180
                asp['delta'] = abs(delta - 180)

            if asp['aspect'] > -1:
                asps[obj.id].append(asp)
        return asps

    def _getAspectsUranian(self, obj, mids):
        # 相位目标 obj 落 Basic Five(Asc/MC/日/月/北交)且 personalOrb 给定 → 用放宽容许度;
        # 否则用通用 orb。personalOrb=None 时全程 orb,无任何分叉(零回归)。
        orb = self.personalOrb if (self.personalOrb is not None and obj.id in BASIC_FIVE) else self.orb
        asps = {obj.id: []}
        for mid in mids:
            d = abs(mid['lon'] - obj.lon) % 360.0   # 跨 0° 归一到 0..180
            if d > 180.0:
                d = 360.0 - d
            asp = {'idA': mid['idA'], 'idB': mid['idB'], 'aspect': -1}
            if d < orb:                # 合(90°盘上 0/90/180/270 经归一后落 0 或 90 或 180)
                asp['aspect'] = 0
                asp['delta'] = d
            elif abs(d - 90.0) < orb:  # 刑(含 270 折叠)
                asp['aspect'] = 90
                asp['delta'] = abs(d - 90.0)
            elif abs(d - 180.0) < orb:  # 冲
                asp['aspect'] = 180
                asp['delta'] = abs(d - 180.0)
            if asp['aspect'] > -1:
                asps[obj.id].append(asp)
        return asps

    def getMidpoints(self):
        if self.uranian:
            return self._getMidpointsUranian()
        # —— 历史路径(合盘复用,逐字节不变)——
        midsdeg = set()
        mids = []
        objs = []
        for obj in self.objects:
            if not (obj in const.LIST_MIDDLE_POINTS):
                objs.append(obj)

        for objA in objs:
            for objB in objs:
                if objA.id == objB.id:
                    continue
                mid = near_midpoint(objA.lon, objB.lon)
                if mid in midsdeg:
                    continue
                sigidx = int(mid / 30)
                pnt = {
                    'lon': mid,
                    'signlon': mid % 30,
                    'sign': const.LIST_SIGNS[sigidx],
                    'idA': objA.id,
                    'idB': objB.id
                }
                mids.append(pnt)
                midsdeg.add(mid)
        return tie_sorted(mids, takeLon)   # 黄经相等的中点保持生成时的先后

    def _getMidpointsUranian(self):
        objs = [o for o in self.objects if o not in const.LIST_MIDDLE_POINTS]
        mids = []
        n = len(objs)
        for i in range(n):
            for j in range(i + 1, n):
                objA = objs[i]
                objB = objs[j]
                mid = near_midpoint(objA.lon, objB.lon)
                sigidx = int(mid / 30) % 12
                mids.append({
                    'lon': mid,
                    'signlon': mid % 30,
                    'sign': const.LIST_SIGNS[sigidx],
                    'idA': objA.id,
                    'idB': objB.id
                })
        return tie_sorted(mids, takeLon)   # 黄经相等的中点保持生成时的先后


    def calculate(self):
        mids = self.getMidpoints()
        asps = {}
        # 相位目标:四轴 + 行星(+ uranian 时附 TNP)。非 uranian 时 tnpObjs 为空,与历史一致。
        targets = list(self.perchart.chart.angles) + list(self.perchart.chart.objects) + self.tnpObjs
        # 严格因子集(D2):黑月/紫气亦不作相位目标(与中点对来源同口径);仅 uranian 分支可能为 True。
        if self.uranian and self.strictFactors:
            targets = [t for t in targets if t.id not in STRICT_EXCLUDE]
        for obj in targets:
            objasp = self.getAspects(obj, mids)
            if len(objasp[obj.id]) > 0:
                asps[obj.id] = objasp[obj.id]

        res = {
            'midpoints': mids,
            'aspects': asps
        }
        return res
