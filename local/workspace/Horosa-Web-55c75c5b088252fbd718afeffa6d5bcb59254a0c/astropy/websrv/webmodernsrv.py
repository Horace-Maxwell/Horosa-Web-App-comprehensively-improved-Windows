import traceback
import jsonpickle
import cherrypy
from websrv.helper import enable_crossdomain
from astrostudy.modern.chartcomp import ChartComp
from astrostudy.modern.chartcomposite import ChartComposite
from astrostudy.modern.chartsynastry import ChartSynastry
from astrostudy.modern.charttmspace import ChartTimeSpace
from astrostudy.modern.chartmarks import ChartMarks
from astrostudy.perchart import push_request_terms, pop_request_terms, push_request_trip, pop_request_trip, push_request_house_offset, pop_request_house_offset, push_request_exalt_variants, pop_request_exalt_variants
from flatlib.tools.arabicparts import push_request_lots_doc_reverse, pop_request_lots_doc_reverse


class ModernAstroSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()


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

            ayan = data.get('siderealAyanamsa', '')
            inner = data['inner']
            outer = data['outer']
            inner['tradition'] = False
            inner['predictive'] = False
            inner['hsys'] = hsys
            inner['zodiacal'] = zodiacal
            inner['siderealAyanamsa'] = ayan
            outer['tradition'] = False
            outer['predictive'] = False
            outer['hsys'] = hsys
            outer['zodiacal'] = zodiacal
            outer['siderealAyanamsa'] = ayan

            # 古典占星参数透传(与 /chart 同两条消费链;前端非默认才带,缺省零行为):
            #  ① westNodeType/sectBuffer/lotReversal —— perchart 从每盘 data dict 读 → 灌 inner/outer;
            #  ② termsVariant/leoBoundFirst/geminiBoundEmended/triplicity —— 请求级线程态,
            #     push/pop 包住 compute(与 webchartsrv 各路由同款,finally 必还原防污染后续请求)。
            for _ck in ('westNodeType', 'sectBuffer', 'lotReversal', 'houseCuspAdvance',
                        'cazimiOrb', 'combustOrb', 'underBeamsOrb', 'vocMode', 'vocIncludeOuter',
                        'starOrb', 'starOrbMode', 'antisciaOrb', 'viaCombustaVariant',
                        # ↓ 三键计算走线程态(push_request_terms),塞每盘仅供 helper.getChartObj
                        #   params 条件回显 → 前端合盘界环/「位于 X 界」与计算同口径(缺省不塞=响应字节零变)
                        'termsVariant', 'leoBoundFirst', 'geminiBoundEmended'):
                if _ck in data:
                    inner[_ck] = data[_ck]
                    outer[_ck] = data[_ck]

            relative = 0
            if 'relative' in data.keys():
                relative = data['relative']

            reschart = None
            if relative == 1:
                reschart = ChartComposite(inner, outer)
            elif relative == 2:
                reschart = ChartSynastry(inner, outer)
            elif relative == 3:
                reschart = ChartTimeSpace(inner, outer)
            elif relative == 4:
                reschart = ChartMarks(inner, outer)
            else:
                reschart = ChartComp(inner, outer)

            _terms_orig = push_request_terms(data.get('termsVariant', 0), data.get('leoBoundFirst'), data.get('geminiBoundEmended'))
            _trip_orig = push_request_trip(data.get('triplicity'))
            _hco_orig = push_request_house_offset(data.get('houseCuspAdvance'))
            # 与 webchartsrv 三路由同款令牌纪律:合盘的点表方向/旺位异文也须请求级 push,
            # 否则 _docReverseOn 等模块级全局在并发下会读到别的请求置的值(且合盘恒用默认)。
            _ldr_orig = push_request_lots_doc_reverse(data.get('lotsDocReverse'))
            _exv_orig = push_request_exalt_variants(data.get('nodeExaltation'), data.get('saturnExalt20'))
            try:
                res = reschart.compute()
            finally:
                pop_request_exalt_variants(_exv_orig)
                pop_request_lots_doc_reverse(_ldr_orig)
                pop_request_house_offset(_hco_orig)
                pop_request_trip(_trip_orig)
                pop_request_terms(_terms_orig)
            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
