import traceback

import cherrypy
import jsonpickle

from astrostudy import astroextra
from astrostudy import directed_figures
from websrv.helper import enable_crossdomain


class AstroExtraSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    def _json(self, obj):
        return jsonpickle.encode(obj, unpicklable=False)

    def _payload(self, params):
        data = getattr(cherrypy.request, 'json', None)
        if isinstance(data, dict):
            payload = dict(data)
        else:
            payload = {}
        payload.update(params)
        return payload

    def _error(self):
        traceback.print_exc()
        return self._json({'err': 'param error'})

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def analysis(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.analyze_chart(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def prenatal_syzygy(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.compute_prenatal_syzygy(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def ephemeris(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.build_ephemeris(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def progressions(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.build_progressions(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def jaynesprog(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.build_declination_progressions(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def returns(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.build_return_timeline(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def harmonic(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.build_harmonic(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def draconic(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.build_draconic(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def relocation(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.build_relocation(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def greatconj(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.compute_great_conjunctions(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def planetcycles(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.compute_planet_cycles(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def barbault(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.compute_barbault(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def planetreturn(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.compute_planet_return(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def eclipsedetail(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.compute_eclipse_detail(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def relative(self, **params):
        enable_crossdomain()
        try:
            return self._json(astroextra.build_relative_score(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def neroman(self, **params):
        enable_crossdomain()
        try:
            return self._json(directed_figures.build_neroman(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def bezzafigure(self, **params):
        enable_crossdomain()
        try:
            return self._json(directed_figures.build_bezza(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def jayprofection(self, **params):
        enable_crossdomain()
        try:
            return self._json(directed_figures.build_jay(self._payload(params)))
        except Exception:
            return self._error()

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def michon(self, **params):
        enable_crossdomain()
        try:
            return self._json(directed_figures.build_michon(self._payload(params)))
        except Exception:
            return self._error()
