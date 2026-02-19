from flatlib import const
from . import guotables

LIST_OBJECTS_NOCHIRON = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN,
    const.URANUS, const.NEPTUNE, const.PLUTO, const.NORTH_NODE,
    const.SOUTH_NODE, const.SYZYGY, const.PARS_FORTUNA, const.DARKMOON, const.PURPLE_CLOUDS
]

class GuoStarSect:
    def __init__(self, perchart):
        self.perchart = perchart


    def allTerm(self):
        res = []
        terms = guotables.copySu27()
        objs = const.LIST_OBJECTS_TRADITIONAL
        if self.perchart.tradition == False:
            objs = LIST_OBJECTS_NOCHIRON

        lifesu = None
        for obj in objs:
            try:
                planet = self.perchart.chart.getObject(obj)
            except:
                continue
            suid = planet.su
            term = terms[suid]
            term['id'] = suid
            term['planets'].append(obj)
            if obj == const.MOON:
                lifesu = suid
                cat = guotables.SU_CATEGORY[term['category']]
                term['character'].append(cat['birth'])

        lifesuidx = guotables.LIST_SU.index(lifesu)
        sulen = len(guotables.LIST_SU)
        j = 0
        for i in range(lifesuidx, lifesuidx + sulen):
            idx = i % sulen
            term = terms[guotables.LIST_SU[idx]]
            term['relation'] = guotables.LIST_SU_RELATION[j]
            term['sixhouse'] = None
            j = j + 1
            res.append(term)

        s = 0
        for obj in guotables.LIST_SU_SIXHOUSE:
            idx = (s + obj['count'] - 1) % sulen
            res[idx]['sixhouse'] = obj['id']

        return res

