import traceback
import jsonpickle
import cherrypy
from websrv.helper import enable_crossdomain
from astrostudy.modern.chartcomp import ChartComp
from astrostudy.modern.chartcomposite import ChartComposite
from astrostudy.modern.chartsynastry import ChartSynastry
from astrostudy.modern.charttmspace import ChartTimeSpace
from astrostudy.modern.chartmarks import ChartMarks
from astrostudy.perchart import push_classical_request, pop_classical_request


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
            for _ck in ('westNodeType', 'sectBuffer', 'lotReversal', 'houseCuspAdvance', 'triplicity',   # [R4-P2] setupPlanets 水象夜表分支读每盘 data.get('triplicity'),缺=夜换挡死
                        'cazimiOrb', 'combustOrb', 'underBeamsOrb', 'vocMode', 'vocIncludeOuter',
                        'starOrb', 'starOrbMode', 'antisciaOrb', 'viaCombustaVariant',
                        # [F3] WP-2~8 per-chart 实例键(perchart 从每盘 data dict 读;缺省不塞=零变)
                        'combustOwnChariotExempt', 'westLilithType', 'topocentricMoon',
                        'stationMarking', 'planetaryHourMethod', 'vulcanCalc',
                        'hermeticLotsReversal', 'erosConstruction', 'lotFortuneVariant',
                        'lotFatherCombustAlt', 'lotProjection',
                        'siderealAyanamsa', 'userAyanT0', 'userAyanDeg',
                        # ↓ 三键计算走线程态(push_classical_request),塞每盘仅供 helper.getChartObj
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

            # [F3] 收编复合临界区(七族全:terms 含自定义表体/trip/house_offset/lots 族/exalt/
            # scores/orb_policy——旧散 push 只五族且不带 custom 表体,合盘 orbSystem/dignityDebilities 恒默认)。
            _cls_tokens = push_classical_request(data)
            try:
                res = reschart.compute()
            finally:
                pop_classical_request(_cls_tokens)
            return jsonpickle.encode(res, unpicklable=False)
        except:
            traceback.print_exc()
            obj = {
                'err': 'param error'
            }
            return jsonpickle.encode(obj, unpicklable=False)
