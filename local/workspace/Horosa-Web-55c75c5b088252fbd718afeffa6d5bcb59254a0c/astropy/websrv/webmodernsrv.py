import traceback
import copy
import jsonpickle
import cherrypy
from websrv.helper import enable_crossdomain, build_param_error_response, RequestResultCache, get_request_cache_dir
from astrostudy.modern.chartcomp import ChartComp
from astrostudy.modern.chartcomposite import ChartComposite
from astrostudy.modern.chartsynastry import ChartSynastry
from astrostudy.modern.charttmspace import ChartTimeSpace
from astrostudy.modern.chartmarks import ChartMarks


class ModernAstroSrv:
    exposed = True
    RESPONSE_CACHE = RequestResultCache(max_entries=48, ttl_sec=1800, persist_dir=get_request_cache_dir('modern-relative'))

    RELATIVE_MODE_MAP = {
        0: 'Comp',
        1: 'Composite',
        2: 'Synastry',
        3: 'TimeSpace',
        4: 'Marks'
    }

    RELATIVE_MODE_TEXT_MAP = {
        'Comp': '比较盘',
        'Composite': '组合盘',
        'Synastry': '影响盘',
        'TimeSpace': '时空中点盘',
        'Marks': '马克斯盘'
    }

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()

    def _safe_dict(self, obj):
        if isinstance(obj, dict):
            return obj
        return {}

    def _safe_list(self, obj):
        if isinstance(obj, list):
            return obj
        return []

    def _build_relative_unified(self, relative_mode, raw_res):
        mode_key = self.RELATIVE_MODE_MAP.get(relative_mode, 'Comp')
        raw = self._safe_dict(raw_res)

        unified = {
            'mode': mode_key,
            'modeText': self.RELATIVE_MODE_TEXT_MAP.get(mode_key, mode_key),
            'relative': relative_mode,
            'charts': {
                'inner': raw.get('inner'),
                'outer': raw.get('outer'),
                'composite': raw if (mode_key == 'Composite' or mode_key == 'TimeSpace') and raw.get('chart') is not None else None
            },
            'analysis': {
                'aspects': {
                    'inToOut': self._safe_list(raw.get('inToOutAsp')),
                    'outToIn': self._safe_list(raw.get('outToInAsp'))
                },
                'midpoints': {
                    'inToOut': self._safe_dict(raw.get('inToOutMidpoint')),
                    'outToIn': self._safe_dict(raw.get('outToInMidpoint'))
                },
                'antiscia': {
                    'inToOut': self._safe_list(raw.get('inToOutAnti')),
                    'outToIn': self._safe_list(raw.get('outToInAnti'))
                },
                'contraAntiscia': {
                    'inToOut': self._safe_list(raw.get('inToOutCAnti')),
                    'outToIn': self._safe_list(raw.get('outToInCAnti'))
                }
            }
        }
        return unified

    def _normalize_relative_payload(self, relative_mode, raw_res):
        normalized = self._safe_dict(raw_res).copy()
        unified = self._build_relative_unified(relative_mode, normalized)

        normalized['relativeMeta'] = {
            'relative': relative_mode,
            'mode': unified['mode'],
            'modeText': unified['modeText']
        }
        normalized['relativeUnified'] = unified

        # Keep legacy shape intact while adding shared keys for unified frontend reads.
        if 'inner' not in normalized:
            normalized['inner'] = None
        if 'outer' not in normalized:
            normalized['outer'] = None
        if 'inToOutAsp' not in normalized:
            normalized['inToOutAsp'] = []
        if 'outToInAsp' not in normalized:
            normalized['outToInAsp'] = []
        if 'inToOutMidpoint' not in normalized:
            normalized['inToOutMidpoint'] = {}
        if 'outToInMidpoint' not in normalized:
            normalized['outToInMidpoint'] = {}
        if 'inToOutAnti' not in normalized:
            normalized['inToOutAnti'] = []
        if 'outToInAnti' not in normalized:
            normalized['outToInAnti'] = []
        if 'inToOutCAnti' not in normalized:
            normalized['inToOutCAnti'] = []
        if 'outToInCAnti' not in normalized:
            normalized['outToInCAnti'] = []

        return normalized

    def _build_relative_cache_payload(self, inner, outer, hsys, zodiacal, relative_mode):
        return {
            'inner': copy.deepcopy(inner),
            'outer': copy.deepcopy(outer),
            'hsys': hsys,
            'zodiacal': zodiacal,
            'relative': relative_mode,
        }

    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def relative(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            hsys = 0
            zodiacal = 0
            if 'hsys' in data.keys():
                hsys = data['hsys']
            if 'zodiacal' in data.keys():
                zodiacal = data['zodiacal']

            inner = data['inner']
            outer = data['outer']
            inner['tradition'] = False
            inner['predictive'] = False
            inner['hsys'] = hsys
            inner['zodical'] = zodiacal
            outer['tradition'] = False
            outer['predictive'] = False
            outer['hsys'] = hsys
            outer['zodical'] = zodiacal

            relative = 0
            if 'relative' in data.keys():
                relative = data['relative']

            cache_payload = self._build_relative_cache_payload(inner, outer, hsys, zodiacal, relative)

            def _build():
                inner_input = copy.deepcopy(inner)
                outer_input = copy.deepcopy(outer)
                if relative == 1:
                    reschart = ChartComposite(inner_input, outer_input)
                elif relative == 2:
                    reschart = ChartSynastry(inner_input, outer_input)
                elif relative == 3:
                    reschart = ChartTimeSpace(inner_input, outer_input)
                elif relative == 4:
                    reschart = ChartMarks(inner_input, outer_input)
                else:
                    reschart = ChartComp(inner_input, outer_input)

                res = reschart.compute()
                res = self._normalize_relative_payload(relative, res)
                return jsonpickle.encode(res, unpicklable=False)

            return self.RESPONSE_CACHE.get_or_compute('modern.relative', cache_payload, _build)
        except Exception as ex:
            traceback.print_exc()
            return jsonpickle.encode(build_param_error_response(ex), unpicklable=False)
