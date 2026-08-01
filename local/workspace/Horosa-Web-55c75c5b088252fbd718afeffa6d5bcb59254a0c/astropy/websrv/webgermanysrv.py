import traceback
import jsonpickle
import cherrypy
from astrostudy.perchart import PerChart
from websrv.helper import enable_crossdomain
from astrostudy.germany.midpoint import MidPoint
from astrostudy.germany.houseframes import compute_house_frames
from astrostudy.germany.declination import compute_declination
from flatlib import const
from flatlib.ephem import ephem as flatlib_ephem


def _build_uranian_tnp(perchart):
    """8 颗汉堡虚星(TNP)，用 perchart 现成 dateTime/pos 纯读计算(Swiss Ephemeris body 40-47)。
    返回 (out, errors)：errors 非空时前端可提示「TNP 历表不可用」而非静默消失(原裸 except 会吞错)。"""
    out = []
    errors = []
    for oid in const.LIST_URANIAN:
        try:
            o = flatlib_ephem.getObject(oid, perchart.dateTime, perchart.pos)
            out.append({
                'id': o.id,
                'lon': o.lon,
                'lat': o.lat,
                'lonspeed': o.lonspeed,
                'sign': o.sign,
                'signlon': o.signlon,
            })
        except Exception as e:
            traceback.print_exc()
            errors.append({'id': oid, 'msg': '{0}'.format(e)})
    return out, errors


class GermanyAstroSrv:
    exposed = True

    def OPTIONS(*args, **kwargs):
        enable_crossdomain()


    @cherrypy.expose
    @cherrypy.config(**{'tools.cors.on': True})
    @cherrypy.tools.json_in()
    def midpoint(self):
        enable_crossdomain()
        try:
            data = cherrypy.request.json

            data['tradition'] = False
            data['predictive'] = False

            # 必要参数校验：缺 date/time/zone/lat/lon 时直接回结构化错误，不进 PerChart（避免 GeoPos/Datetime
            # 抛栈被裸 except 笼统兜成 'param error'）。前端已先校验、正常不会到这里，仅作后端兜底。
            missing = [k for k in ('date', 'time', 'zone', 'lat', 'lon')
                       if data.get(k) is None or '{0}'.format(data.get(k)).strip() == '']
            if missing:
                return jsonpickle.encode({'err': 'missing_param', 'missing': missing}, unpicklable=False)

            # 流派(汉堡学派 WP-1):classic/pure/uranian/cosmo。默认 classic = 现状字节零回归。
            #   宇宙生物学(cosmo)不用虚星 → include_tnp=False;默认中点容许度放宽到 1.5°(若前端未显式传 orb)。
            #   其余流派 include_tnp=True、默认 orb 1.0,与现状一致。
            school = '{0}'.format(data.get('school', 'classic') or 'classic').strip()
            include_tnp = (school != 'cosmo')

            # orb 可配(默认 1° 原始汉堡严格口径);前端传盘上容许度。cosmo 未显式给 orb 时默认 1.5°。
            orb_default = 1.5 if school == 'cosmo' else 1.0
            try:
                orb = float(data.get('orb', orb_default))
            except (TypeError, ValueError):
                orb = orb_default
            if not (0 < orb <= 10):
                orb = orb_default

            # 个人点容许度(Basic Five 放宽):仅前端显式下发时生效;缺省 None = 不分叉(零回归)。
            personal_orb = data.get('personalOrb', None)

            # 严格汉堡因子集(D2):true 时剔黑月/紫气(中点对+相位目标双面);缺省 False = 现状字节零回归。
            strict_factors = bool(data.get('strictFactors', False))

            perchart = PerChart(data)
            # uranian=True:中点对纳入 Asc/MC(+ include_tnp 时 8 TNP)、近中点单算、跨 0° 归一、TNP 作相位目标。
            midpoint = MidPoint(perchart, orb=orb, uranian=True, includeTnp=include_tnp, personalOrb=personal_orb,
                                strictFactors=strict_factors)
            mids = midpoint.calculate()
            # TNP 星体列表:仅在该流派启用虚星时计算并下发(cosmo 不返回 tnp,前端盘自然不含虚星)。
            if include_tnp:
                tnp, tnpErr = _build_uranian_tnp(perchart)
                mids['tnp'] = tnp
                if tnpErr:
                    mids['tnpError'] = tnpErr
            else:
                mids['tnp'] = []

            # 六大宫框(定局法 WP-2):frames 缺省 True → 只【新增】 houseFrames 字段,不改既有响应。
            #   pts = midpoint.objects 口径(行星+Asc/MC+8 TNP)+ 白羊点(固定黄经 0°)。
            #   子午局走 houses_ex(b'X') 赤道分宫,余五框等宫;前端 showHouseFrames 关时不渲染。
            if data.get('frames', True):
                try:
                    pts = [{'id': o.id, 'lon': o.lon} for o in midpoint.objects]
                    pts.append({'id': 'AriesPoint', 'lon': 0.0})  # 白羊点 0° 固定(与前端 AstroConst.ARIES_POINT 同 id)
                    mids['houseFrames'] = compute_house_frames(perchart, pts)
                except Exception as e:
                    traceback.print_exc()
                    mids['houseFramesError'] = '{0}'.format(e)

            # 赤纬接触(平行/反平行 WP-11):declination 缺省 True → 只【新增】 declination 字段。
            #   点集 = 10 行星(读 perchart.decl)+(include_tnp 时)8 TNP(eqCoords 现算真赤纬);四轴排除。
            #   同号 |Δdecl|≤orb = parallel(≈合);异号 |abs−abs|≤orb = contraParallel(≈冲)。
            if data.get('declination', True):
                try:
                    mids['declination'] = compute_declination(perchart, orb, include_tnp)
                except Exception as e:
                    traceback.print_exc()
                    mids['declinationError'] = '{0}'.format(e)

            # 戴维森盘(A5):请求显式携带 davison(第二人出生数据 dict:date/time/zone/lat/lon[,ad])
            # 时才计算,只【新增】 davison 字段;缺省不带 = 现状响应字节零回归。
            dav = data.get('davison')
            if isinstance(dav, dict):
                try:
                    from astrostudy.germany.davison import compute_davison
                    dav_data = dict(dav)
                    dav_data['tradition'] = False
                    dav_data['predictive'] = False
                    perchart_b = PerChart(dav_data)
                    mids['davison'] = compute_davison(perchart, perchart_b, include_tnp=include_tnp)
                except Exception as e:
                    traceback.print_exc()
                    mids['davisonError'] = '{0}'.format(e)

            res = jsonpickle.encode(mids, unpicklable=False)
            return res
        except Exception as e:
            traceback.print_exc()
            obj = {
                'err': 'compute_error',
                'detail': '{0}'.format(e),
            }
            return jsonpickle.encode(obj, unpicklable=False)
