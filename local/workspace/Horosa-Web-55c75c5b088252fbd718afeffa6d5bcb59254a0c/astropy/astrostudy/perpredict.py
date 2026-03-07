import copy
import math
import re
from pathlib import Path

import swisseph

try:
    import joblib
except Exception:
    joblib = None

from flatlib.chart import Chart
from flatlib.datetime import Datetime
from flatlib import angle
from flatlib import const
from flatlib import utils
from flatlib.ephem import swe
from flatlib.predictives.primarydirections import PrimaryDirections
from flatlib.predictives.primarydirections import PDTable
from flatlib.predictives import profections
from flatlib.tools import arabicparts
from astrostudy.signasctime import SignAscTime
from astrostudy import helper
from astrostudy import solararc
from astrostudy import firdaria
from astrostudy import zreleasing

MAX_ERROR = 0.0003
ASTROAPP_PD_DISPLAY_EPS = 3.0
ASTROAPP_PD_DISPLAY_WINDOW = 107.5
ASTROAPP_PD_ASC_PROM_TRUE_OBLIQUITY_OFFSET = -0.0014
ASTROAPP_PD_PROM_CORR_JD_CENTER = 2460500.0
ASTROAPP_PD_ASC_CASE_CORR_MODEL = (
    Path(__file__).resolve().parent / 'models' / 'astroapp_pd_asc_case_corr_et_v1.joblib'
)
ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_DIR = Path(__file__).resolve().parent / 'models'
ASTROAPP_PD_VIRTUAL_BODY_CORR_MODELS = {
    const.SUN: ('sun', swisseph.SUN),
    const.MOON: ('moon', swisseph.MOON),
    const.MERCURY: ('mercury', swisseph.MERCURY),
    const.VENUS: ('venus', swisseph.VENUS),
    const.MARS: ('mars', swisseph.MARS),
    const.JUPITER: ('jupiter', swisseph.JUPITER),
    const.SATURN: ('saturn', swisseph.SATURN),
    const.URANUS: ('uranus', swisseph.URANUS),
    const.NEPTUNE: ('neptune', swisseph.NEPTUNE),
    const.PLUTO: ('pluto', swisseph.PLUTO),
}
ASTROAPP_PD_PROM_LON_CORR = {
    const.SUN: (0.00011261706308644413, 5.198520293204767e-08),
    const.MOON: (0.0012746462660943947, 6.838483113920786e-07),
    const.MERCURY: (0.00011025867282253942, 4.805626861297303e-08),
    const.VENUS: (0.00010868299897535258, 4.381215954991389e-08),
    const.MARS: (5.667146433027108e-05, 2.7003810098335192e-08),
    const.JUPITER: (2.3720597470280884e-05, 2.2797822582784662e-09),
    const.SATURN: (5.854107029929437e-06, -4.0179952764840723e-10),
    const.URANUS: (5.269423715978646e-05, 2.5633763321056456e-09),
    const.NEPTUNE: (-5.952882774716672e-05, -1.4503852977808152e-08),
    const.PLUTO: (0.00012531606875190764, 2.213120222254395e-08),
    const.NORTH_NODE: (1.6895946721895652e-06, -8.915188959954432e-08),
}
ASTROAPP_PD_PLANET_IDS = {
    const.SUN,
    const.MOON,
    const.MERCURY,
    const.VENUS,
    const.MARS,
    const.JUPITER,
    const.SATURN,
    const.URANUS,
    const.NEPTUNE,
    const.PLUTO,
}
ASTROAPP_PD_OBJECT_IDS = [
    const.SUN,
    const.MOON,
    const.MERCURY,
    const.VENUS,
    const.MARS,
    const.JUPITER,
    const.SATURN,
    const.URANUS,
    const.NEPTUNE,
    const.PLUTO,
    const.NORTH_NODE,
]
_ASTROAPP_PD_ASC_CASE_CORR_MODEL_CACHE = None
_ASTROAPP_PD_ASC_CASE_CORR_MODEL_READY = False
_ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_CACHE = {}
_ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_READY = set()
_ASTROAPP_PD_VIRTUAL_BODY_CORR_DELTA_CACHE = {}

def takeLon(obj):
    return obj.lon

def getChartObjects(chart):
    objs = []
    for key in chart.objects.content.keys():
        objs.append(chart.objects.content[key])
    for key in chart.angles.content.keys():
        objs.append(chart.angles.content[key])
    objs.sort(key=takeLon)
    return objs


def dateSolarReturn(datetime, lon, zodiacal=const.TROPICAL):
    flags = swe.SEDEFAULT_FLAG
    if zodiacal == const.SIDEREAL:
        flags = swe.SEDEFAULT_FLAG | swisseph.FLG_SIDEREAL

    jd = datetime.jd
    sun = swe.sweObjectLon(const.SUN, jd, flags)
    delta = helper.distance(sun, lon)
    while abs(delta) > MAX_ERROR:
        jd = jd - delta / 0.9833  # Sun mean motion
        sun = swe.sweObjectLon(const.SUN, jd, flags)
        delta = helper.distance(sun, lon)
    return Datetime.fromJD(jd, datetime.utcoffset)


def dateLunarReturn(datetime, lon, zodiacal=const.TROPICAL):
    flags = swe.SEDEFAULT_FLAG
    if zodiacal == const.SIDEREAL:
        flags = swe.SEDEFAULT_FLAG | swisseph.FLG_SIDEREAL

    jd = datetime.jd
    moon = swe.sweObjectLon(const.MOON, jd, flags)
    delta = -helper.absDistance(moon, lon)
    while abs(delta) > MAX_ERROR:
        jd = jd - delta / 13.17638889  # Moon mean motion
        moon = swe.sweObjectLon(const.MOON, jd, flags)
        delta = helper.distance(moon, lon)
    return Datetime.fromJD(jd, datetime.utcoffset)



class PerPredict:

    def __init__(self, perchart):
        self.perchart = perchart

    def getAspects(self, pChart, asporb=-1):
        natalObjs = [obj for obj in self.perchart.chart.objects]
        natalObjs.extend([obj for obj in self.perchart.chart.angles])

        objs = [obj for obj in pChart.objects]
        objs.extend([obj for obj in pChart.angles])

        res = []
        for obj in objs:
            asp = {
                'directId': obj.id,
                'objects': []
            }
            for natobj in natalObjs:
                orb = asporb if asporb > 0 else (natobj.orb() + obj.orb()) / 2
                natasp = {
                    'natalId': natobj.id,
                    'aspect': -1
                }
                delta = obj.lon - natobj.lon if obj.lon >= natobj.lon else natobj.lon - obj.lon
                if delta < orb:
                    natasp['aspect'] = 0
                    natasp['delta'] = delta
                elif abs(delta - 60) < orb or abs(delta - 300) < orb:
                    tmpdelta = abs(delta - 60)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 300)
                    natasp['aspect'] = 60
                    natasp['delta'] = tmpdelta
                elif abs(delta - 90) < orb or abs(delta - 270) < orb:
                    tmpdelta = abs(delta - 90)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 270)
                    natasp['aspect'] = 90
                    natasp['delta'] = tmpdelta
                elif abs(delta - 120) < orb or abs(delta - 240) < orb:
                    tmpdelta = abs(delta - 120)
                    if tmpdelta > 1:
                        tmpdelta = abs(delta - 240)
                    natasp['aspect'] = 120
                    natasp['delta'] = tmpdelta
                elif abs(delta - 180) < orb:
                    natasp['aspect'] = 180
                    natasp['delta'] = abs(delta - 180)
                if natasp['aspect'] >= 0:
                    asp['objects'].append(natasp)
            res.append(asp)
        return res

    def getTermDirection(self, clockwise):
        chart = self.perchart.getChart()
        td = TermDirection(chart, clockwise)
        tdlist = td.getList(self.perchart.pdaspects)
        self.appendDateStr(tdlist, False)
        return tdlist

    def getPrimaryDirection(self):
        pdtype = self.perchart.pdtype
        if pdtype == 0:
            return self.getPrimaryDirectionByZ()
        elif pdtype == 1:
            return self.getPrimaryDirectionByM()
        elif pdtype == 2:
            return self.getTermDirection(True)
        elif pdtype == 3:
            return self.getTermDirection(False)

        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        pdlist = pd.getList(self.perchart.pdaspects)
        self.appendDateStr(pdlist)
        return pdlist

    def getPrimaryDirectionByZ(self):
        if getattr(self.perchart, 'pdMethod', 'astroapp_alchabitius') == 'horosa_legacy':
            pdlist = self.getPrimaryDirectionByZLegacy()
        else:
            pdlist = self.getPrimaryDirectionByZAstroAppKernel()
        self.appendDateStr(pdlist)
        return pdlist

    def getPrimaryDirectionByZLegacy(self):
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        pdlist = []
        for item in pd.getList(self.perchart.pdaspects):
            if len(item) > 3 and item[3] == 'Z':
                pdlist.append(item)
        return pdlist

    def _isNodeDirectionId(self, ID):
        txt = '{0}'.format(ID if ID is not None else '')
        return ('North Node' in txt) or ('South Node' in txt)

    def _baseDirectionObjectId(self, ID):
        parts = '{0}'.format(ID if ID is not None else '').split('_')
        if len(parts) < 3:
            return '{0}'.format(ID if ID is not None else '')
        return '_'.join(parts[1:-1]).strip()

    def _norm180(self, deg):
        return (float(deg) + 180.0) % 360.0 - 180.0

    def _obliqueAscension(self, point, lat, zero_lat=False):
        ra_key = 'raZ' if zero_lat else 'ra'
        decl_key = 'declZ' if zero_lat else 'decl'
        ra = point.get(ra_key)
        decl = point.get(decl_key)
        if ra is None or decl is None:
            return None
        return angle.norm(float(ra) - utils.ascdiff(float(decl), float(lat)))

    def _astroappMeanObliquity(self, chart):
        # AstroApp's zodiacal PD rows align best when the ecliptic->equatorial
        # conversion uses the date's mean obliquity instead of flatlib's fixed 23.44 deg.
        return float(swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0][1])

    def _astroappTrueObliquity(self, chart):
        return float(swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0][0])

    def _astroappEqCoords(self, lon, lat, obliquity):
        eq = swisseph.cotrans([float(lon), float(lat), 1.0], -float(obliquity))
        return (angle.norm(float(eq[0])), float(eq[1]))

    def _astroappPointEqCoords(self, point, obliquity, zero_lat=False):
        lon = point.get('lon')
        lat = 0.0 if zero_lat else point.get('lat', 0.0)
        if lon is None:
            return (None, None)
        return self._astroappEqCoords(lon, lat, obliquity)

    def _astroappObliqueAscension(self, point, lat, obliquity, zero_lat=False):
        ra, decl = self._astroappPointEqCoords(point, obliquity, zero_lat=zero_lat)
        if ra is None or decl is None:
            return None
        return angle.norm(float(ra) - utils.ascdiff(float(decl), float(lat)))

    def _isAstroAppPlanetPair(self, prom_id, sig_id):
        return (
            self._baseDirectionObjectId(prom_id) in ASTROAPP_PD_PLANET_IDS
            and self._baseDirectionObjectId(sig_id) in ASTROAPP_PD_PLANET_IDS
        )

    def _astroappEphemerisFlags(self):
        flags = swe.SEDEFAULT_FLAG
        if getattr(self.perchart, 'zodiacal', const.TROPICAL) == const.SIDEREAL:
            flags = flags | swisseph.FLG_SIDEREAL
        return flags

    def _astroappLoadAscCaseCorrectionModel(self):
        global _ASTROAPP_PD_ASC_CASE_CORR_MODEL_CACHE
        global _ASTROAPP_PD_ASC_CASE_CORR_MODEL_READY

        if _ASTROAPP_PD_ASC_CASE_CORR_MODEL_READY:
            return _ASTROAPP_PD_ASC_CASE_CORR_MODEL_CACHE

        _ASTROAPP_PD_ASC_CASE_CORR_MODEL_READY = True
        if joblib is None or not ASTROAPP_PD_ASC_CASE_CORR_MODEL.exists():
            return None
        try:
            _ASTROAPP_PD_ASC_CASE_CORR_MODEL_CACHE = joblib.load(ASTROAPP_PD_ASC_CASE_CORR_MODEL)
        except Exception:
            _ASTROAPP_PD_ASC_CASE_CORR_MODEL_CACHE = None
        return _ASTROAPP_PD_ASC_CASE_CORR_MODEL_CACHE

    def _astroappLoadVirtualBodyCorrectionModel(self, base_id):
        global _ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_CACHE
        global _ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_READY

        if base_id in _ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_READY:
            return _ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_CACHE.get(base_id)

        _ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_READY.add(base_id)
        if joblib is None:
            return None
        info = ASTROAPP_PD_VIRTUAL_BODY_CORR_MODELS.get(base_id)
        if info is None:
            return None
        slug = info[0]
        path = ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_DIR / f'astroapp_pd_virtual_body_corr_{slug}_v1.joblib'
        if not path.exists():
            return None
        try:
            _ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_CACHE[base_id] = joblib.load(path)
        except Exception:
            _ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_CACHE[base_id] = None
        return _ASTROAPP_PD_VIRTUAL_BODY_CORR_MODEL_CACHE.get(base_id)

    def _astroappHasVirtualBodyCorrectionModel(self, base_id):
        return self._astroappLoadVirtualBodyCorrectionModel(base_id) is not None

    def _astroappParseCoord(self, value):
        text = '{0}'.format(value if value is not None else '').strip().upper()
        match = re.fullmatch(r'(\d+)([NSEW])(\d+)', text)
        if match:
            deg = float(match.group(1))
            minutes = float(match.group(3))
            coord = deg + minutes / 60.0
            if match.group(2) in ['S', 'W']:
                coord = -coord
            return coord

        try:
            return float(value)
        except Exception:
            return 0.0

    def _astroappAscCaseCorrectionFeatures(self, chart):
        ecl_nut = swisseph.calc_ut(chart.date.jd, swisseph.ECL_NUT)[0]
        jd_offset = float(chart.date.jd) - 2460000.0
        lat = self._astroappParseCoord(getattr(self.perchart, 'lat', 0.0))
        lon = self._astroappParseCoord(getattr(self.perchart, 'lon', 0.0))
        abs_lat = abs(lat)
        abs_lon = abs(lon)
        asc = chart.get(const.ASC)
        mc = chart.get(const.MC)
        sun = chart.get(const.SUN)
        moon = chart.get(const.MOON)

        angle_values = [
            float(asc.lon),
            float(mc.lon),
            float(asc.ra),
            float(mc.ra),
            float(sun.lon),
            float(moon.lon),
        ]
        feats = [
            jd_offset,
            lat,
            lon,
            abs_lat,
            abs_lon,
            float(ecl_nut[0]),
            float(ecl_nut[1]),
            float(ecl_nut[2]),
            float(ecl_nut[3]),
        ]
        for value in angle_values:
            rad = math.radians(float(value))
            feats.extend([float(value), math.sin(rad), math.cos(rad)])
        feats.extend([
            abs_lat * math.sin(math.radians(float(sun.lon))),
            abs_lat * math.cos(math.radians(float(sun.lon))),
            abs_lat * math.sin(math.radians(float(mc.ra))),
            abs_lat * math.cos(math.radians(float(mc.ra))),
        ])
        return feats

    def _astroappAscCaseCorrection(self, chart):
        model = self._astroappLoadAscCaseCorrectionModel()
        if model is None:
            return 0.0
        try:
            feats = self._astroappAscCaseCorrectionFeatures(chart)
            return float(model.predict([feats])[0])
        except Exception:
            return 0.0

    def _astroappVirtualBodyCorrectionFeatures(self, chart, swe_id):
        flags = self._astroappEphemerisFlags()
        calc = swisseph.calc_ut(chart.date.jd, swe_id, flags)[0]
        lon = float(calc[0])
        lat = float(calc[1])
        distance = float(calc[2]) if len(calc) > 2 else 0.0
        speed_lon = float(calc[3]) if len(calc) > 3 else 0.0
        speed_lat = float(calc[4]) if len(calc) > 4 else 0.0
        rad = math.radians(lon)
        return [
            float(chart.date.jd) - 2460000.0,
            lon,
            math.sin(rad),
            math.cos(rad),
            lat,
            distance,
            speed_lon,
            speed_lat,
        ]

    def _applyAstroAppPromissorBodyModelCorrection(self, pd, chart, point):
        point_id = point.get('id')
        base_id = self._baseDirectionObjectId(point_id)
        info = ASTROAPP_PD_VIRTUAL_BODY_CORR_MODELS.get(base_id)
        if info is None:
            return None

        global _ASTROAPP_PD_VIRTUAL_BODY_CORR_DELTA_CACHE
        cache_key = (float(chart.date.jd), base_id)
        cached = _ASTROAPP_PD_VIRTUAL_BODY_CORR_DELTA_CACHE.get(cache_key)
        if cached is None:
            payload = self._astroappLoadVirtualBodyCorrectionModel(base_id)
            if payload is None:
                return None

            try:
                swe_id = info[1]
                feats = self._astroappVirtualBodyCorrectionFeatures(chart, swe_id)
                lon_delta = float(payload['lon_model'].predict([feats])[0])
                lat_delta = float(payload['lat_model'].predict([feats])[0])
            except Exception:
                return None
            cached = (lon_delta, lat_delta)
            _ASTROAPP_PD_VIRTUAL_BODY_CORR_DELTA_CACHE[cache_key] = cached
        lon_delta, lat_delta = cached

        return pd.G(
            point_id,
            float(point.get('lat', 0.0)) + lat_delta,
            angle.norm(float(point.get('lon')) + lon_delta),
        )

    def _astroappTrueNodeBaseLons(self, chart):
        swisseph.set_sid_mode(swe.SEDEFAULT_SIDM__MODE)
        north = swisseph.calc_ut(chart.date.jd, swisseph.TRUE_NODE, self._astroappEphemerisFlags())[0][0]
        north = angle.norm(float(north))
        return {
            const.NORTH_NODE: north,
            const.SOUTH_NODE: angle.norm(north + 180.0),
        }

    def _parseDirectionAspect(self, ID):
        parts = '{0}'.format(ID if ID is not None else '').split('_')
        if len(parts) < 3:
            return (None, 0.0)
        try:
            asp = float(parts[-1])
        except Exception:
            asp = 0.0
        return (parts[0], asp)

    def _rebuildAstroAppNodePoint(self, pd, point, node_base_lons):
        point_id = point.get('id')
        base_id = self._baseDirectionObjectId(point_id)
        if base_id not in node_base_lons:
            return point

        kind, asp = self._parseDirectionAspect(point_id)
        lon = node_base_lons[base_id]
        if kind == 'D':
            lon = angle.norm(lon - abs(float(asp)))
        elif kind in ['S', 'N']:
            lon = angle.norm(lon + float(asp))
        return pd.G(point_id, 0.0, lon)

    def _rebuildAstroAppTruePosMoonPoint(self, pd, chart, point):
        point_id = point.get('id')
        if self._baseDirectionObjectId(point_id) != const.MOON:
            return point

        flags = self._astroappEphemerisFlags() | swisseph.FLG_TRUEPOS
        moon = swisseph.calc_ut(chart.date.jd, swisseph.MOON, flags)[0]
        lon = angle.norm(float(moon[0]))
        lat = float(moon[1])
        kind, asp = self._parseDirectionAspect(point_id)
        if kind == 'D':
            lon = angle.norm(lon - abs(float(asp)))
        elif kind in ['S', 'N']:
            lon = angle.norm(lon + float(asp))
        return pd.G(point_id, lat, lon)

    def _applyAstroAppPromissorLonCorrection(self, pd, chart, point):
        point_id = point.get('id')
        base_id = self._baseDirectionObjectId(point_id)
        corr = ASTROAPP_PD_PROM_LON_CORR.get(base_id)
        if corr is None:
            return point

        a, b = corr
        dlon = float(a) + float(b) * (float(chart.date.jd) - ASTROAPP_PD_PROM_CORR_JD_CENTER)
        return pd.G(point_id, float(point.get('lat', 0.0)), angle.norm(float(point.get('lon')) + dlon))

    def _passesAstroAppDisplayWindow(self, prom, sig, arc):
        raw_delta = float(sig.get('lon')) - float(prom.get('lon'))
        if abs(raw_delta) <= ASTROAPP_PD_DISPLAY_EPS:
            return True
        if arc > 0:
            return ASTROAPP_PD_DISPLAY_EPS < raw_delta < ASTROAPP_PD_DISPLAY_WINDOW
        if arc < 0:
            return -ASTROAPP_PD_DISPLAY_WINDOW < raw_delta < -ASTROAPP_PD_DISPLAY_EPS
        return False

    def getPrimaryDirectionByZAstroAppKernel(self):
        """
        AstroApp-aligned In Zodiaco kernel:
            arc = norm180(RA(sig, true_lat) - RA(promissor_aspected, zero_lat))

        Notes:
        - keeps direct + converse (positive/negative arc)
        - keeps original promissor/significator ID encoding for UI compatibility
        - keeps |arc| <= 100 to match existing age horizon
        """
        chart = self.perchart.getChart()
        pd = PrimaryDirections(chart)
        aspList = self.perchart.pdaspects

        # Significators
        sig_objs = pd._elements(ASTROAPP_PD_OBJECT_IDS, pd.N, [0])
        sig_houses = pd._elements(pd.SIG_HOUSES, pd.N, [0])
        sig_angles = pd._elements(pd.SIG_ANGLES, pd.N, [0])
        significators = sig_objs + sig_houses + sig_angles

        # Promissors
        promissors = pd._elements(ASTROAPP_PD_OBJECT_IDS, pd.N, aspList)

        # AstroApp settings use the true node, while flatlib's default north node
        # object is the mean node. Rebuild node-derived rows locally for this branch.
        node_base_lons = self._astroappTrueNodeBaseLons(chart)
        significators = [self._rebuildAstroAppNodePoint(pd, obj, node_base_lons) for obj in significators]
        promissors = [self._rebuildAstroAppNodePoint(pd, obj, node_base_lons) for obj in promissors]
        astroapp_mean_obliquity = self._astroappMeanObliquity(chart)
        astroapp_true_obliquity = self._astroappTrueObliquity(chart)
        astroapp_asc_prom_true_obliquity = astroapp_true_obliquity + ASTROAPP_PD_ASC_PROM_TRUE_OBLIQUITY_OFFSET
        astroapp_body_models_enabled = any(
            self._astroappHasVirtualBodyCorrectionModel(body_id)
            for body_id in ASTROAPP_PD_VIRTUAL_BODY_CORR_MODELS.keys()
        )
        astroapp_asc_case_correction = 0.0 if astroapp_body_models_enabled else self._astroappAscCaseCorrection(chart)

        max_arc = 100.0
        eps = 1e-12
        pdlist = []
        for prom in promissors:
            prom_id = prom.get('id')
            prom_ra_z, _ = self._astroappPointEqCoords(prom, astroapp_mean_obliquity, zero_lat=True)
            if prom_id is None or prom_ra_z is None:
                continue
            for sig in significators:
                sig_id = sig.get('id')
                if prom_id == sig_id:
                    continue
                if self._baseDirectionObjectId(prom_id) == self._baseDirectionObjectId(sig_id):
                    continue
                if sig_id is None:
                    continue

                sig_base = self._baseDirectionObjectId(sig_id)
                prom_for_arc = prom
                # Virtual-point rows are where Moon residuals dominate. AstroApp's
                # Moon body positions align slightly better to Swiss TRUEPOS for this
                # subset, while ordinary planet-to-planet rows should stay untouched.
                if sig_base == const.ASC and not self._astroappHasVirtualBodyCorrectionModel(self._baseDirectionObjectId(prom_id)):
                    prom_for_arc = self._rebuildAstroAppTruePosMoonPoint(pd, chart, prom)
                if sig_base in [const.ASC, const.MC, const.NORTH_NODE]:
                    prom_model_arc = self._applyAstroAppPromissorBodyModelCorrection(pd, chart, prom_for_arc)
                    if prom_model_arc is not None:
                        prom_for_arc = prom_model_arc
                    else:
                        prom_for_arc = self._applyAstroAppPromissorLonCorrection(pd, chart, prom_for_arc)
                if sig_base == const.ASC:
                    prom_oa_z = self._astroappObliqueAscension(prom_for_arc, pd.lat, astroapp_asc_prom_true_obliquity, zero_lat=True)
                    sig_oa_z = self._astroappObliqueAscension(sig, pd.lat, astroapp_true_obliquity, zero_lat=True)
                    if sig_oa_z is None or prom_oa_z is None:
                        continue
                    # AstroApp's Asc rows align to zero-lat OA on both sides. A tiny
                    # negative true-obliquity offset on the promissor side plus a
                    # current-version AstroApp promissor-longitude correction reduce
                    # the remaining multi-geo residual. A chart-level correction
                    # model then removes the small shared Asc bias still left in
                    # the whole table for that natal chart.
                    arc = self._norm180(float(prom_oa_z) - float(sig_oa_z) - astroapp_asc_case_correction)
                elif sig_base == const.MC:
                    sig_ra_z, _ = self._astroappPointEqCoords(sig, astroapp_mean_obliquity, zero_lat=True)
                    if sig_ra_z is None:
                        continue
                    prom_ra_arc, _ = self._astroappPointEqCoords(prom_for_arc, astroapp_mean_obliquity, zero_lat=True)
                    if prom_ra_arc is None:
                        continue
                    arc = self._norm180(float(prom_ra_arc) - float(sig_ra_z))
                else:
                    sig_ra, _ = self._astroappPointEqCoords(sig, astroapp_mean_obliquity, zero_lat=False)
                    if sig_ra is None:
                        continue
                    prom_ra_arc, _ = self._astroappPointEqCoords(prom_for_arc, astroapp_mean_obliquity, zero_lat=True)
                    if prom_ra_arc is None:
                        continue
                    arc = self._norm180(float(sig_ra) - float(prom_ra_arc))
                if abs(arc) <= eps:
                    continue
                if abs(arc) > max_arc:
                    continue
                if self._isAstroAppPlanetPair(prom_id, sig_id):
                    if not self._passesAstroAppDisplayWindow(prom, sig, arc):
                        continue
                pdlist.append([arc, prom_id, sig_id, 'Z'])

        pdlist.sort(key=lambda item: (abs(item[0]), item[0], item[1], item[2]))
        return pdlist

    def getPrimaryDirectionByM(self):
        chart = self.perchart.getChart()
        pdlist = []
        pd = PrimaryDirections(chart)
        for item in pd.getList(self.perchart.pdaspects):
            if item[3] == 'M':
                pdlist.append(item)
        self.appendDateStr(pdlist)
        return pdlist

    def bySignificator(self, ID):
        chart = self.perchart.getChart()
        tbl = PDTable(chart, self.perchart.pdaspects)
        list = tbl.bySignificator(ID)
        self.appendDateStr(list)
        return list


    def byPromissor(self, ID):
        chart = self.perchart.getChart()
        tbl = PDTable(chart, self.perchart.pdaspects)
        list = tbl.byPromissor(ID)
        self.appendDateStr(list)
        return list

    def appendDateStr(self, pdlist, usePD=True):
        chart = self.perchart.getChart()
        for item in pdlist:
            asc = chart.angles.get(const.ASC)
            asctime = SignAscTime(self.perchart.date, self.perchart.time, asc.sign, self.perchart.lat, self.perchart.zone)
            datestr = None
            if usePD:
                datestr = asctime.getDateFromPDArc(item[0])
            else:
                datestr = asctime.getDateFromTermDirArc(item[0])
            item.append(datestr)


    def getProfection(self, nodeRetrograde=False, asporb=-1):
        res = []
        for i in range(1, 100):
            year = int(self.perchart.year) + i
            date = '{0}/{1}/{2}'.format(year, self.perchart.month, self.perchart.day)
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = profections.compute(self.perchart.chart, dt, False, nodeRetrograde)
            obj = {
                'date': '{0}-{1}-{2}'.format(year, self.perchart.month, self.perchart.day),
                'chart': {
                    'objects': getChartObjects(chart),
                    'aspects': self.getAspects(chart, asporb)
                },
                'lots': self.perchart.getPars(chart)
            }
            res.append(obj)
        return res

    def getProfectionByDate(self, date, zone, nodeRetrograde=False, asporb=-1):
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        profDate = Datetime(dt, tm, zone)
        chart = profections.compute(self.perchart.chart, profDate, False, nodeRetrograde)
        obj = {
            'date': date,
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getSolarReturn(self, params, asporb=-1):
        res = []
        st = int(self.perchart.year) + 1
        ed = int(self.perchart.year) + 90
        zone = params['zone']

        for i in range(st, ed):
            chart = self.perchart.chart.solarReturn(i)
            srdt = Datetime.fromJD(chart.date.jd, zone)
            srdtstr = srdt.toCNString()
            dirparts = srdtstr.split(' ')
            cparams = copy.deepcopy(params)
            cparams['date'] = dirparts[0]
            cparams['time'] = dirparts[1]
            obj = {
                'date': srdtstr,
                'chart': {
                    'objects': getChartObjects(chart),
                    'aspects': self.getAspects(chart, asporb)
                },
                'dirParams': cparams,
                'lots': self.perchart.getPars(chart)
            }
            res.append(obj)
        return res

    def getSolarReturnByDate(self, params, date, asporb=-1):
        sun = self.perchart.chart.getObject(const.SUN)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        srDate = dateSolarReturn(returnDate, sun.lon, self.perchart.zodiacal)
        chart = Chart(srDate, self.perchart.pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
        srdt = Datetime.fromJD(srDate.jd, srDate.utcoffset)
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        params['time'] = dirparts[1]
        obj = {
            'date': srdtstr,
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getSolarReturnByDatePos(self, params, date, pos, asporb=-1):
        sun = self.perchart.chart.getObject(const.SUN)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        srDate = dateSolarReturn(returnDate, sun.lon, self.perchart.zodiacal)
        chart = Chart(srDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
        srdt = Datetime.fromJD(srDate.jd, srDate.utcoffset)
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        params['time'] = dirparts[1]

        obj = {
            'date': srdtstr,
            'pos': {
                'lat': pos.lat,
                'lon': pos.lon
            },
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getLunarReturn(self, params, date, pos, asporb=-1):
        moon = self.perchart.chart.getObject(const.MOON)
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        parts = dt.split('/')
        dt = '{0}/{1}/01'.format(parts[0], parts[1])
        tm = '00:00'
        zone = params['zone']
        returnDate = Datetime(dt, tm, zone)
        lrDate = dateLunarReturn(returnDate, moon.lon, self.perchart.zodiacal)
        chart = Chart(lrDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
        srdt = Datetime.fromJD(lrDate.jd, lrDate.utcoffset)
        srdtstr = srdt.toCNString()
        dirparts = srdtstr.split(' ')
        params['date'] = dirparts[0]
        params['time'] = dirparts[1]

        obj = {
            'date': srdtstr,
            'pos': {
                'lat': pos.lat,
                'lon': pos.lon
            },
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }

        parts = dirparts[0].split('-')
        m = parts[1]
        if int(parts[2]) < 5:
            dt = '{0}/{1}/21'.format(parts[0], parts[1])
            tm = '00:00'
            zone = params['zone']
            returnDate = Datetime(dt, tm, zone)
            seclrDate = dateLunarReturn(returnDate, moon.lon, self.perchart.zodiacal)
            secchart = Chart(seclrDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
            srdt = Datetime.fromJD(seclrDate.jd, seclrDate.utcoffset)
            srdtstr1 = srdt.toCNString()
            dirparts1 = srdtstr1.split(' ')
            params1 = copy.deepcopy(params)
            params1['date'] = dirparts1[0]
            params1['time'] = dirparts1[1]
            parts = dirparts1[0].split('-')
            if parts[1] == m:
                obj1 = {
                    'date': srdtstr1,
                    'pos': {
                        'lat': pos.lat,
                        'lon': pos.lon
                    },
                    'chart': {
                        'objects': getChartObjects(secchart),
                        'aspects': self.getAspects(secchart, asporb)
                    },
                    'dirParams': params1,
                    'lots': self.perchart.getPars(chart)
                }
                obj['secLuneReturn'] = obj1

        return obj

    def getGivenYear(self, params, date, pos, asporb=-1):
        parts = date.split(' ')
        dt = helper.getChartDate(parts[0])
        tm = parts[1]
        zone = params['zone']
        givenDate = Datetime(dt, tm, zone)
        chart = Chart(givenDate, pos, self.perchart.zodiacal, hsys=self.perchart.house, IDs=const.LIST_OBJECTS)
        params['date'] = parts[0]
        params['time'] = parts[1]

        obj = {
            'date': date,
            'pos': {
                'lat': pos.lat,
                'lon': pos.lon
            },
            'chart': {
                'objects': getChartObjects(chart),
                'aspects': self.getAspects(chart, asporb)
            },
            'dirParams': params,
            'lots': self.perchart.getPars(chart)
        }
        return obj

    def getSolarArc(self, asporb, nodeRetrograde=False):
        res = []
        for i in range(1, 100):
            year = int(self.perchart.year) + i
            date = '{0}/{1}/{2}'.format(year, self.perchart.month, self.perchart.day)
            dt = Datetime(date, self.perchart.time, self.perchart.zone)
            chart = solararc.compute(self.perchart.chart, dt, asporb, nodeRetrograde)
            objs = chart['objects']
            objs.sort(key=takeLon)
            obj = {
                'date': '{0}-{1}-{2}'.format(year, self.perchart.month, self.perchart.day),
                'chart': {
                    'objects': objs,
                    'aspects': chart['aspects']
                },
                'lots': self.perchart.getPars(chart['chart'])
            }
            res.append(obj)
        return res

    def getSolarArcByDate(self, date, asporb, nodeRetrograde=False):
        parts = date.split(' ');
        dt = helper.getChartDate(parts[0])
        tm = parts[1] if len(parts) > 1 else '00:00'
        saDate = Datetime(dt, tm, self.perchart.zone)
        chart = solararc.compute(self.perchart.chart, saDate, asporb, nodeRetrograde)
        objs = chart['objects']
        objs.sort(key=takeLon)
        obj = {
            'date': date,
            'chart': {
                'objects': objs,
                'aspects': chart['aspects']
            },
            'natalChart': {
                'chart': self.perchart.getChartOnlyObj(),
                'aspects': {
                    'normalAsp': self.perchart.getAspects(),
                    'immediateAsp': self.perchart.getImmediateAspects(),
                    'signAsp': self.perchart.getSignAspects()
                }
            },
            'lots': self.perchart.getPars(chart['chart'])
        }
        return obj


    def getFirdaria(self):
        return firdaria.compute(self.perchart.chart)

    def getZodiacalRelease(self, startSign, stopLevelIdx=3):
        return zreleasing.compute(self.perchart, startSign, stopLevelIdx)

    def getDiceChart(self, planet, sign, house):
        aspects = self.perchart.getAspects()
        planetobj = self.perchart.chart.get(planet)
        siglon = planetobj.signlon
        newlon = helper.getSignLon(sign) + siglon
        hidx = 0
        for hobj in self.perchart.chart.houses:
            if hobj.lon <= newlon and newlon <= hobj.lon + hobj.size:
                hidx = int(hobj.id[5:7]) - 1
                break

        objs = set()
        objs.add(planet)
        try:
            asp = aspects[planet]
            for aspobj in asp['Applicative']:
                objs.add(aspobj['id'])
            for aspobj in asp['Exact']:
                objs.add(aspobj['id'])
            for aspobj in asp['None']:
                objs.add(aspobj['id'])
            for aspobj in asp['Obvious']:
                objs.add(aspobj['id'])
            for aspobj in asp['Separative']:
                objs.add(aspobj['id'])
        except:
            pass

        for parid in arabicparts.LIST_PARS:
            if parid in objs:
                objs.remove(parid)
        for parid in const.LIST_ANGLES:
            if parid in objs:
                objs.remove(parid)

        objlist = []
        for objid in objs:
            objlist.append(objid)

        perchart = self.perchart.clone(objlist, const.HOUSES_WHOLE_SIGN, False)

        housedelta = hidx - house
        delta = housedelta * 30 + 360

        asc = perchart.chart.getAngle(const.ASC)
        mc = perchart.chart.getAngle(const.MC)
        desc = perchart.chart.getAngle(const.DESC)
        ic = perchart.chart.getAngle(const.IC)

        asc.relocate((asc.lon + delta) % 360)
        mc.relocate((mc.lon + delta) % 360)
        desc.relocate((desc.lon + delta) % 360)
        ic.relocate((ic.lon + delta) % 360)

        for hobj in perchart.chart.houses:
            hobj.relocate((hobj.lon + delta) % 360)

        planetobj = perchart.chart.getObject(planet)
        planetobj.relocate(newlon)

        perchart.reinit()
        return perchart
