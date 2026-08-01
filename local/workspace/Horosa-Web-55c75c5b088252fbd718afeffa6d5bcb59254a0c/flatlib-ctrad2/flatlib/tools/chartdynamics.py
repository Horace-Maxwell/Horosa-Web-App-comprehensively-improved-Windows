"""
    This file is part of flatlib - (C) FlatAngle
    Author: João Ventura (flatangleweb@gmail.com)
    
    
    This module implements the ChartDynamics class for
    handling some of the dynamics of an astrology Chart.
  
"""

from flatlib import const
from flatlib import aspects
from flatlib.dignities import essential
from . import arabicparts



LIST_POINTS_PARS = const.LIST_ALL_POINTS.copy()
LIST_POINTS_PARS.extend(arabicparts.LIST_PARS)

# ----------------------- #
#   ChartDynamics Class   #
# ----------------------- #

class ChartDynamics:
    
    def __init__(self, chart):
        self.chart = chart
        self.simpleAsp = False


    # === Dignities and Mutual Reception === #
    
    def inDignities(self, idA, idB):
        """ Returns the dignities of A which belong to B. """
        objA = self.chart.get(idA)
        info = essential.getInfo(objA.sign, objA.signlon)
        # Should we ignore exile and fall?
        return [dign for (dign, ID) in info.items() if ID == idB]
    
    def receives(self, idA, idB):
        """ Returns the dignities where A receives B.
        A receives B when (1) B aspects A and (2) B is in 
        dignities of A.

        """
        objA = self.chart.get(idA)
        objB = self.chart.get(idB)
        asp = aspects.isAspecting(objB, objA, const.MAJOR_ASPECTS)
        return self.inDignities(idB, idA) if asp else []
    
    def disposits(self, idA, idB):
        """ Returns the dignities where A is dispositor of B. """
        return self.inDignities(idB, idA)
    
    def mutualReceptions(self, idA, idB):
        """ Returns all pairs of dignities in mutual reception. """
        AB = self.receives(idA, idB)
        BA = self.receives(idB, idA)
        # Returns a product of both lists
        return [(a,b) for a in AB for b in BA]
        
    def reMutualReceptions(self, idA, idB):
        """ Returns ruler and exaltation mutual receptions. """
        mr = self.mutualReceptions(idA, idB)
        filter_ = ['ruler', 'exalt']
        # Each pair of dignities must be 'ruler' or 'exalt'
        return [(a,b) for (a,b) in mr if (a in filter_ and b in filter_)]
    
    
    # === Aspects === #
    
    def validAspects(self, ID, aspList, excludeVirtualPnt=False):
        """ Returns a list with the aspects an object 
        makes with the other six planets, considering a
        list of possible aspects. 
        
        """
        obj = self.chart.get(ID)
        res = []

        list = LIST_POINTS_PARS
        if excludeVirtualPnt:
            list = const.LIST_ALL_POINTS_EXCLUDE_VIRTUALPNT
        
        for otherID in list:
            if ID == otherID:
                continue
            try:
                otherObj = self.chart.get(otherID)
                aspType = aspects.aspectType(obj, otherObj, aspList)
                if aspType != const.NO_ASPECT:
                    res.append({
                        'id': otherID,
                        'asp': aspType,
                    })
            except KeyError:
                continue

        return res
    
    def aspectsByCat(self, ID, aspList, excludeVirtualPnt=False):
        """ Returns the aspects an object makes with the
        other six planets, separated by category (applicative,
        separative, exact). 
        Aspects must be within orb of the object.
        
        """
        res = {
            const.APPLICATIVE: [],
            const.SEPARATIVE: [],
            const.EXACT: [],
            const.NO_MOVEMENT: []
        }


        objA = self.chart.get(ID)
        valid = self.validAspects(ID, aspList, excludeVirtualPnt)
        for elem in valid:
            objB = self.chart.get(elem['id'])
            asp = aspects.getAspect(objA, objB, aspList, self.simpleAsp)
            role = asp.getRole(objA.id)
            if role['inOrb']:
                movement = role['movement']
                res[movement].append({
                    'id': objB.id,
                    'asp': asp.type,
                    'orb': asp.orb
                })

        return res

    def immediateAspects(self, ID, aspList, excludeVirtualPnt=False):
        """ Returns the last separation and next application
        considering a list of possible aspects.

        """
        asps = self.aspectsByCat(ID, aspList, excludeVirtualPnt)

        applications = asps[const.APPLICATIVE]
        separations = asps[const.SEPARATIVE]
        exact = asps[const.EXACT]

        # Get applications and separations sorted by orb

        applications = applications + [val for val in exact if val['orb'] >= 0]

        applications = sorted(applications, key=lambda var: var['orb'])
        separations = sorted(separations, key=lambda var: var['orb'])

        return (
            separations[0] if separations else None,
            applications[0] if applications else None
        )
        
    # 空亡六口径(2026-07 请求级参数化;与前端 divination/engine/moon.js 六模式数学对齐):
    #   lilly(默认=历史实现,零回归):对全点集(含虚点/阿拉伯点)无入相/正合主相位即空;
    #   by_orb:对七政(±三王)主相位入相且 orb≤12°30′ 存在 → 非空;
    #   by_sign_perfect:入相 orb ≤ 本座剩余弧(30−signlon) 存在 → 非空(本座内能精确);
    #   by_sign_orb / kenodromia:对七政(±三王)存在入相/正合主相位即非空(表内=已入容许);
    #   exempt4:按 lilly 判空后,月落金牛/巨蟹/射手/双鱼则豁免。
    # includeOuter 仅作用于新五口径的目标星集;lilly 保持历史点集不动。
    _VOC_TARGETS = [const.SUN, const.MOON, const.MERCURY, const.VENUS,
                    const.MARS, const.JUPITER, const.SATURN]
    _VOC_TARGETS_OUTER = [const.URANUS, const.NEPTUNE, const.PLUTO]
    _VOC_EXEMPT_SIGNS = (const.TAURUS, const.CANCER, const.SAGITTARIUS, const.PISCES)

    def _vocApplyingOrbs(self, ID, includeOuter):
        """新五口径共用:ID 对七政(±三王)的入相/正合主相位 orb 列表(绝对值)。"""
        targets = list(self._VOC_TARGETS)
        if includeOuter:
            targets = targets + list(self._VOC_TARGETS_OUTER)
        obj = self.chart.get(ID)
        orbs = []
        for otherID in targets:
            if otherID == ID:
                continue
            try:
                other = self.chart.get(otherID)
            except KeyError:
                continue
            asp = aspects.getAspect(obj, other, const.MAJOR_ASPECTS, self.simpleAsp)
            role = asp.getRole(obj.id)
            if role['inOrb'] and role['movement'] in (const.APPLICATIVE, const.EXACT):
                orbs.append(abs(asp.orb))
        return orbs

    def isVOC(self, ID, mode='lilly', includeOuter=False):
        """ Returns if a planet is Void of Course.
        mode='lilly'(default, historical behavior): not VOC if has any
        exact or applicative major aspects ignoring the sign status.
        Other modes documented above.
        """
        if mode in (None, '', 'lilly', 'classic', 'backend'):
            asps = self.aspectsByCat(ID, const.MAJOR_ASPECTS)
            applications = asps[const.APPLICATIVE]
            exacts = asps[const.EXACT]
            return len(applications) == 0 and len(exacts) == 0
        if mode == 'exempt4':
            base = self.isVOC(ID, 'lilly')
            if base:
                try:
                    if self.chart.get(ID).sign in self._VOC_EXEMPT_SIGNS:
                        return False
                except KeyError:
                    pass
            return base
        orbs = self._vocApplyingOrbs(ID, includeOuter)
        if mode == 'by_orb':
            return not any(o <= 12.5 for o in orbs)
        if mode == 'by_sign_perfect':
            try:
                remain = 30.0 - float(getattr(self.chart.get(ID), 'signlon', 0.0))
            except (KeyError, TypeError, ValueError):
                remain = 30.0
            return not any(o <= remain + 1e-9 for o in orbs)
        if mode in ('by_sign_orb', 'kenodromia'):
            return len(orbs) == 0
        # 未知口径回落历史行为(防御:绝不因新键值抛错)。
        return self.isVOC(ID, 'lilly')
