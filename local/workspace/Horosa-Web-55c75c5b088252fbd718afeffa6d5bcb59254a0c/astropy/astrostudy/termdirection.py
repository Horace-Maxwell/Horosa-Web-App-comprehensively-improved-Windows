
from flatlib import const
from flatlib.dignities import tables

from astrostudy import signasctime



class TermDirection:
    # Define common significators
    SIG_HOUSES = []
    SIG_ANGLES = [const.ASC, const.MC]
    SIG_OBJECTS = [
        const.SUN, const.MOON, const.MERCURY,
        const.VENUS, const.MARS, const.JUPITER,
        const.SATURN, const.PARS_FORTUNA,
        const.NORTH_NODE, const.SOUTH_NODE,
        const.DARKMOON, const.PURPLE_CLOUDS
    ]

    # Maximum arc
    MAX_ARC = 100

    def __init__(self, chart, clockwise=True):
        self.chart = chart
        self.clockwise = clockwise
        self.asc = chart.getAngle(const.ASC);
        self.lat = chart.pos.lat
        self.terms = self._buildTerms()

    def _termlons(self, terms):
        res = []
        for i, sign in enumerate(const.LIST_SIGNS):
            termList = terms[sign]
            startdeg = 30 * i
            for (ID, start, end) in termList:
                ary = [ID, sign, start + startdeg, startdeg + end]
                res.append(ary)
        return res

    def _buildTerms(self):
        """ Builds a data structure indexing the terms
        longitude by sign and object.

        """
        terms = tables.EGYPTIAN_TERMS
        termLons = self._termlons(terms)
        res = {}
        for (ID, sign, lon, endlon) in termLons:
            if not (sign in res.keys()):
                res[sign] = {}

            if self.clockwise:
                res[sign][ID] = lon
            else:
                res[sign][ID] = endlon

        return res

    # === Object creation methods === #

    def G(self, ID, lon):
        """ Creates a generic entry for an object. """

        dist = 0
        if self.clockwise:
            if self.asc.lon > lon:
                dist = signasctime.getAscSignTime(self.lat, lon, self.asc.lon)
            else:
                dist = signasctime.getAscSignTime(self.lat, 0, self.asc.lon)
                dist = dist + signasctime.getAscSignTime(self.lat, lon, 360)
        else:
            if self.asc.lon < lon:
                dist = signasctime.getAscSignTime(self.lat, self.asc.lon, lon)
            else:
                dist = signasctime.getAscSignTime(self.lat, self.asc.lon, 360)
                dist = dist + signasctime.getAscSignTime(self.lat, 0, lon)

        return {
            'id': ID,
            'lon': lon,
            'dist': dist,
        }

    def T(self, ID, sign):
        """ Returns the term of an object in a sign. """
        lon = self.terms[sign][ID]
        ID = 'T_%s_%s' % (ID, sign)
        return self.G(ID, lon)

    def A(self, ID):
        """ Returns the Antiscia of an object. """
        obj = self.chart.getObject(ID).antiscia()
        ID = 'A_%s' % (ID)
        return self.G(ID, obj.lon)

    def C(self, ID):
        """ Returns the CAntiscia of an object. """
        obj = self.chart.getObject(ID).cantiscia()
        ID = 'C_%s' % (ID)
        return self.G(ID, obj.lon)

    def D(self, ID, asp):
        """ Returns the dexter aspect of an object. """
        obj = self.chart.getObject(ID).copy()
        obj.relocate(obj.lon - asp)
        ID = 'D_%s_%s' % (ID, asp)
        return self.G(ID, obj.lon)

    def S(self, ID, asp):
        """ Returns the sinister aspect of an object. """
        obj = self.chart.getObject(ID).copy()
        obj.relocate(obj.lon + asp)
        ID = 'S_%s_%s' % (ID, asp)
        return self.G(ID, obj.lon)

    def N(self, ID, asp=0):
        """ Returns the conjunction or opposition aspect
        of an object.

        """
        obj = self.chart.get(ID).copy()
        obj.relocate(obj.lon + asp)
        ID = 'N_%s_%s' % (ID, asp)
        return self.G(ID, obj.lon)

    def _elements(self, IDs, func, aspList):
        """ Returns the IDs as objects considering the
        aspList and the function.

        """
        res = []
        for asp in aspList:
            if (asp in [0, 180]):
                # Generate func for conjunctions and oppositions
                if func == self.N:
                    res.extend([func(ID, asp) for ID in IDs])
                else:
                    res.extend([func(ID) for ID in IDs])
            else:
                # Generate Dexter and Sinister for others
                res.extend([self.D(ID, asp) for ID in IDs])
                res.extend([self.S(ID, asp) for ID in IDs])
        return res

    def _terms(self):
        """ Returns a list with the objects as terms. """
        res = []
        for sign, terms in self.terms.items():
            for ID, lon in terms.items():
                res.append(self.T(ID, sign))
        return res

    def _arc(self, prom, sig):
        if sig['dist'] >= prom['dist']:
            return sig['dist'] - prom['dist']
        return self.MAX_ARC

    def getList(self, aspList):
        """ Returns a sorted list with all
        primary directions.

        """
        # Significators
        objects = self._elements(self.SIG_OBJECTS, self.N, [0])
        houses = self._elements(self.SIG_HOUSES, self.N, [0])
        angles = self._elements(self.SIG_ANGLES, self.N, [0])
        significators = objects + houses + angles

        # Promissors
        objects = self._elements(self.SIG_OBJECTS, self.N, aspList)
        terms = self._terms()
        antiscias = self._elements(self.SIG_OBJECTS, self.A, [0])
        cantiscias = self._elements(self.SIG_OBJECTS, self.C, [0])
        promissors = objects + terms + antiscias + cantiscias

        # Compute all
        res = []
        for prom in promissors:
            for sig in significators:
                if (prom['id'] == sig['id']):
                    continue
                arc = self._arc(prom, sig)
                if 0 < arc < self.MAX_ARC:
                    res.append([
                        arc,
                        prom['id'],
                        sig['id'],
                        'T'
                    ])

        return sorted(res)

