import copy
import threading
import flatlib
import math
import traceback
import swisseph
from multiprocessing.dummy import Pool as ThreadPool
from flatlib.datetime import Datetime
from flatlib.geopos import GeoPos
from flatlib.chart import Chart
from flatlib import const
from flatlib import object
from flatlib import aspects
from flatlib.dignities import essential
from flatlib.dignities import tables
from flatlib.tools.chartdynamics import ChartDynamics
from flatlib import props
from flatlib import utils
from flatlib.tools import arabicparts
from flatlib.ephem import swe
from astrostudy.nakshatra import nakshatra_from_lon
from astrostudy import classical_tables as ctab
from astrostudy.helper import distance
from astrostudy.jieqi.realsuntime import getOffsetByDate

from astrostudy.perpredict import PerPredict
from astrostudy.guostarsect import guotables
from astrostudy.perchart_parts.chart_tables import (
    dayerStar, dayofweekStr, timerStar, excludeBad, isStrongGood, custHouse_Equal_MC_Middle, custHouse_Fortuna_Whole,
    hsys, LOTS, BODY_JD_DOMAIN, objectsForJD, getHSys, takeDelta, takeAsp, takeRa, takeDecl, takeLon, takeAttackDelta,
    ARCUS_VISIONIS,
)
from astrostudy.perchart_parts.su28_moira import (
    SU28_MODE_REAL, SU28_MODE_DOUBING, SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI, SU28_MODE_ZHENG_SIDEREAL,
    SU28_MODE_EQUATORIAL_SIDEREAL, SU28_MODE_GUFA_LICHENG, SU28_MODE_EQUATORIAL_TROPICAL,
    SU28_MODE_EQUATORIAL_TROPICAL_LIVE, ZHENG_SIDEREAL_MODE, MOIRA_STELLAR_ORDER, MOIRA_CURRENT_STELLAR_DEGREES,
    MOIRA_KAIXI_STELLAR_DEGREES, MOIRA_DISTAR_J2000, MOIRA_AYAN_BASE_YMD, MOIRA_AYAN_BASE_DEG, _moira_ayanamsha,
    _moira_distar_lon, _moira_distar_lons, _moira_distar_ra, SU28_ID_BY_NAME,
)
from astrostudy.perchart_parts.classical_request import (
    _TERMS_TABLES, _TETRABIBLOS_LEO_SATURN_FIRST, _LILLY_GEMINI_EMENDED, _CHALDEAN_WIDTHS, _CHALDEAN_DAY_ORDER,
    _CHALDEAN_SIGN_ELEMENT, _build_chaldean_terms, _CHALDEAN_TERMS_DAY, _CHALDEAN_TERMS_NIGHT, _PERCHART_TERMS_LOCK,
    parse_terms_variant, _CUSTOM_TERMS_SIGNS, _CUSTOM_TERMS_STARS, _buildCustomTermsTable, _PTOL_TRIP,
    _build_ptolemaic_dignities, _PTOLEMAIC_DIGNITIES, _PTOL_WATER_TRIP_DAY, _PTOL_WATER_TRIP_NIGHT,
    _build_ptolemaic_water_variant_dignities, _PTOLEMAIC_WATER_VARIANT_DIGNITIES_DAY,
    _PTOLEMAIC_WATER_VARIANT_DIGNITIES_NIGHT, _PERCHART_TRIP_LOCK, _PERCHART_EXALT_LOCK, _build_dignities_variant,
    _truthy, push_request_exalt_variants, pop_request_exalt_variants, _PERCHART_HOUSE_OFFSET_LOCK,
    _HOUSE_CUSP_ADVANCE_DEFAULT, _optional_float, parse_house_cusp_advance, push_request_house_offset,
    pop_request_house_offset, _PERCHART_SCORES_LOCK, push_request_scores, pop_request_scores,
)
from astrostudy.perchart_parts.su28 import Su28Mixin
from astrostudy.perchart_parts.houses import HousesMixin
from astrostudy.perchart_parts.planets import PlanetsMixin
from astrostudy.perchart_parts.lots import LotsMixin
from astrostudy.perchart_parts.aspects import AspectsMixin
from astrostudy.perchart_parts.besiege import BesiegeMixin
from astrostudy.perchart_parts.timing import TimingMixin


# 自定义界表夜表槽 / 昼向主表槽(界系与三分集请求级换表):push 设、pop 清,PerChart.setupPlanets 读 ——
# 改写方(global)与读取方必须同住本模块,故这几行与下面的 push/pop、优先级车道、七族统一入口留在门面;
# 各界系表、三分表与其它族的开关在 perchart_parts/classical_request.py。
_CUSTOM_TERMS_NIGHT_ACTIVE = None
# push 时的昼向主表引用:setupPlanets 夜盘换夜表后,同一临界区内的下一张昼盘
# (合盘 inner/outer、返照 natal→dirChart 等多盘一 push 端点)据此显式换回——否则夜表跨盘泄漏。
_PUSH_TERMS_DAY_ACTIVE = None
_PUSH_TRIP_DAY_ACTIVE = None


def push_request_terms(termsVariant, leoBoundFirst=False, geminiBoundEmended=False, customDay=None, customNight=None):
    """/chart 请求级界系:获取锁 + 换 essential.TERMS,返回还原令牌(原表);必须在 finally 配对 pop_request_terms。
    G15:leoBoundFirst 且托勒密界·校勘本(tv==1)时换狮子土星优先变体表;默认木优先零回归。
    卜卦 2b:geminiBoundEmended 且经典传本(tv==2)时换双子校勘口径表;默认忠原书零回归。
    [WP-7] tv==4 自定义界表:昼表必备(非法整表回落埃及);夜表可缺(缺=昼夜同表),
    夜表消费在 setupPlanets(isDiurnal 判定后,锁内安全,照迦勒底范式)。"""
    tv = parse_terms_variant(termsVariant)
    _acquire_first_lock_with_priority(_PERCHART_TERMS_LOCK)   # 首把锁走优先级车道
    global _CUSTOM_TERMS_NIGHT_ACTIVE, _PUSH_TERMS_DAY_ACTIVE
    orig = essential.TERMS
    _CUSTOM_TERMS_NIGHT_ACTIVE = None
    if tv == 4:
        day_tbl = _buildCustomTermsTable(customDay)
        if day_tbl is not None:
            essential.TERMS = day_tbl
            night_tbl = _buildCustomTermsTable(customNight) if customNight else None
            _CUSTOM_TERMS_NIGHT_ACTIVE = night_tbl
        else:
            essential.TERMS = _TERMS_TABLES[0]   # 非法整表回落埃及(前端编辑器禁存非法=双保险)
    elif tv == 3:
        essential.TERMS = _CHALDEAN_TERMS_DAY   # 迦勒底界:先昼表;夜盘由 perchart setupPlanets 据 isDiurnal 换夜表(锁内安全)
    elif tv == 1 and leoBoundFirst in (True, 1, '1', 'true'):
        essential.TERMS = _TETRABIBLOS_LEO_SATURN_FIRST
    elif tv == 2 and geminiBoundEmended in (True, 1, '1', 'true'):
        essential.TERMS = _LILLY_GEMINI_EMENDED
    else:
        essential.TERMS = _TERMS_TABLES[tv]
    _PUSH_TERMS_DAY_ACTIVE = essential.TERMS   # 记录昼向主表(夜盘换表后下一张昼盘据此复位)
    return orig


def pop_request_terms(token):
    """还原 essential.TERMS 并释放锁;token=None(未 push)时安全 no-op。"""
    if token is None:
        return
    global _CUSTOM_TERMS_NIGHT_ACTIVE, _PUSH_TERMS_DAY_ACTIVE
    try:
        essential.TERMS = token
        _CUSTOM_TERMS_NIGHT_ACTIVE = None   # 清自定义夜表槽(防跨请求泄漏)
        _PUSH_TERMS_DAY_ACTIVE = None       # 清昼表槽
    finally:
        _PERCHART_TERMS_LOCK.release(); _notify_first_lock_released()

def push_request_trip(triplicity):
    """G20-P2 请求级三分集:Ptolemaic 换 essential.TABLE 的 trip;默认 Dorothean 不动零回归。配对 pop_request_trip。
    PtolemaicWaterVariant:先置水象变体「昼」表(火/土/风同托勒密,水象昼=火+金);夜盘由 setupPlanets 据
    isDiurnal 换「夜」表(水象夜=火+月)——sect 区分仅在水象座可见(火/土/风与 Ptolemaic 一致)。"""
    tv = str(triplicity or 'Dorothean')
    if tv not in ('Ptolemaic', 'PtolemaicWaterVariant'):
        return None
    _PERCHART_TRIP_LOCK.acquire()
    global _PUSH_TRIP_DAY_ACTIVE
    orig = essential.TABLE
    if tv == 'PtolemaicWaterVariant':
        essential.TABLE = _PTOLEMAIC_WATER_VARIANT_DIGNITIES_DAY
    else:
        essential.TABLE = _PTOLEMAIC_DIGNITIES
    _PUSH_TRIP_DAY_ACTIVE = essential.TABLE   # 同 terms:夜盘换水象夜表后昼盘据此复位
    return orig

def pop_request_trip(token):
    """还原 essential.TABLE 并释放锁;token=None(未 push,默认 Dorothean)时安全 no-op。"""
    global _PUSH_TRIP_DAY_ACTIVE
    if token is None:
        return
    try:
        essential.TABLE = token
        _PUSH_TRIP_DAY_ACTIVE = None   # 清槽
    finally:
        _PERCHART_TRIP_LOCK.release()


# ── 请求优先级车道 ─────────────────────────────────────────────────
# 下方七把模块级锁让本命 / 推运全族在多线程下实际完全串行:用户点一下产生的真请求会排在前端预取(±步、
# 选项投机、数据预热)之后。这里在拿锁之前加一道「前台优先」:标了 prefetch 的请求只要发现有前台请求正在
# 等锁就先让(至多等 _PRIORITY_YIELD_MAX_S 秒,防饿死),前台请求永远不让。只改排队顺序,不改任何计算 /
# 输出;不标头的请求一律视作前台 = 旧行为。线程本地的优先级由 webchartsrv 的 CherryPy 工具按请求头
# X-Horosa-Priority 设置(kill:HOROSA_PRIORITY_LANE=0,由 webchartsrv 读后经 set_priority_lane_enabled 传入)。
import threading as _prio_threading
import time as _prio_time
_PRIORITY_LOCAL = _prio_threading.local()
_PRIORITY_COND = _prio_threading.Condition()
_PRIORITY_FG_WAITING = [0]
_PRIORITY_LANE_ON = [True]
_PRIORITY_YIELD_MAX_S = 5.0
PRIORITY_STATS = {'yielded': 0, 'fg': 0, 'bg': 0}


def set_priority_lane_enabled(on):
    _PRIORITY_LANE_ON[0] = bool(on)


def set_request_priority(kind):
    """'prefetch' = 后台预取(让前台);其它 / None = 前台。每个请求由 CherryPy 工具在 handler 前调用。"""
    _PRIORITY_LOCAL.kind = 'prefetch' if kind == 'prefetch' else 'fg'


def get_request_priority():
    return getattr(_PRIORITY_LOCAL, 'kind', 'fg')


def _acquire_first_lock_with_priority(lock):
    """临界区首把锁(界系锁)的获取:
    · 前台:登记「正在等锁」→ 阻塞拿锁 → 撤销登记并唤醒让路者(原生 Lock 里只有前台在阻塞等,释放时必到前台手里);
    · 预取:只要有前台在等就不去碰锁(等通知,有上限);无前台时非阻塞试锁,拿不到就等「释放通知 / 5ms」再试;
      让路超过 _PRIORITY_YIELD_MAX_S 后老老实实阻塞拿锁(不饿死)。
    车道关 / 不标头 = 直接阻塞拿锁 = 旧行为。只改排队顺序,不改任何计算 / 输出。"""
    if not _PRIORITY_LANE_ON[0]:
        lock.acquire()
        return
    if get_request_priority() != 'prefetch':
        PRIORITY_STATS['fg'] += 1
        with _PRIORITY_COND:
            _PRIORITY_FG_WAITING[0] += 1
        try:
            lock.acquire()
        finally:
            with _PRIORITY_COND:
                _PRIORITY_FG_WAITING[0] -= 1
                _PRIORITY_COND.notify_all()
        return
    PRIORITY_STATS['bg'] += 1
    deadline = _prio_time.monotonic() + _PRIORITY_YIELD_MAX_S
    while True:
        with _PRIORITY_COND:
            while _PRIORITY_FG_WAITING[0] > 0:
                remain = deadline - _prio_time.monotonic()
                if remain <= 0:
                    break
                PRIORITY_STATS['yielded'] += 1
                _PRIORITY_COND.wait(timeout=remain)
        if lock.acquire(blocking=False):
            return
        if _prio_time.monotonic() >= deadline:
            lock.acquire()
            return
        with _PRIORITY_COND:
            _PRIORITY_COND.wait(timeout=0.005)


def _notify_first_lock_released():
    """首把锁释放后唤醒等通知的预取(与前台无关)。"""
    with _PRIORITY_COND:
        _PRIORITY_COND.notify_all()


# ── 五族古典临界区统一入口(0d) ────────────────────────────────────────────
# 此前只有 /chart、/chart13、/chart12、/relative 手写五对 push/pop;推运全族端点
# (websrv/webpredictsrv.py)一对都没有——界系/三分/宫头5°律/点公式口径/旺位异文在
# 返照·推运·主限链全走默认,与主盘口径静默分叉。统一入口后端点只见一对调用+finally,
# 「漏一族/漏 pop=锁泄漏全站卡死」结构性不可能。
# 🔴 顺序表(pop 严格反序,防 ABBA 死锁;未来新族在此追加,禁止端点散 push):
#   terms → trip → house_offset → lots_doc_reverse → exalt_variants → scores → orb_policy
def push_classical_request(data):
    """按请求体 push 七族古典临界区,返回还原令牌元组(供 pop_classical_request)。
    data 缺省/非 dict → 全默认(terms/trip 仍按默认表 push=与主盘 index 行为一致)。
    中途异常回滚已 push 的族(pop 对 None 令牌安全 no-op)再抛。"""
    from flatlib.tools.arabicparts import push_request_lots_doc_reverse
    from flatlib.aspects import push_request_orb_policy, enterAspectMemoScope
    d = data if isinstance(data, dict) else {}
    tokens = [None, None, None, None, None, None, None]
    enterAspectMemoScope()   # 相位请求级 memo 随临界区开启(pop 时关闭;异常回滚也关)
    try:
        tokens[0] = push_request_terms(d.get('termsVariant', 0), d.get('leoBoundFirst'), d.get('geminiBoundEmended'),
                                       d.get('customTermsDay'), d.get('customTermsNight'))
        tokens[1] = push_request_trip(d.get('triplicity'))
        tokens[2] = push_request_house_offset(d.get('houseCuspAdvance'))
        tokens[3] = push_request_lots_doc_reverse(d.get('lotsDocReverse'))
        tokens[4] = push_request_exalt_variants(d.get('nodeExaltation'))
        tokens[5] = push_request_scores(d.get('dignityDebilities', 1))
        tokens[6] = push_request_orb_policy(d.get('orbSystem'), d.get('luminaryOrbBonus'))
        return tokens
    except BaseException:
        # 含 KeyboardInterrupt / SystemExit:相位 memo 作用域也必须随之关闭,否则本线程深度永不归零、表跨请求累积
        pop_classical_request(tokens)
        raise


def pop_classical_request(tokens):
    """反序 pop 七族;tokens=None 或某位 None(未 push/守卫早退)一律安全。"""
    from flatlib.tools.arabicparts import pop_request_lots_doc_reverse
    from flatlib.aspects import pop_request_orb_policy, exitAspectMemoScope
    exitAspectMemoScope()    # 先关 memo 作用域(无论 tokens 形状;深度归零即丢表)
    if not tokens:
        return
    if len(tokens) > 6:
        pop_request_orb_policy(tokens[6])
    if len(tokens) > 5:
        pop_request_scores(tokens[5])
    pop_request_exalt_variants(tokens[4])
    pop_request_lots_doc_reverse(tokens[3])
    pop_request_house_offset(tokens[2])
    pop_request_trip(tokens[1])
    pop_request_terms(tokens[0])


class PerChart(Su28Mixin, HousesMixin, PlanetsMixin, LotsMixin, AspectsMixin, BesiegeMixin, TimingMixin):

    def __init__(self, data):
        self.data = data

        # ── 古典口径请求级参数(全局设置「星盘组件」;缺省 None/默认=各保现硬编码值,零回归)──
        # 太阳三态阈值:传键时 sunPos(合相口径)与 phase(可见弧口径)两套统一吃全局值;
        # 缺省时两链亦统一为 17'/8.5(1647 口径;phase 链此前各保 16'/8 → 同一颗星同卡可同时
        # 显「燃烧」与「日光束下」,且默认档恰是 17'/8.5 却永远到不了 phase 链)。phase 日光束界恒逐星 arcus visionis。
        _cz = _optional_float(data.get('cazimiOrb'))
        _cb = _optional_float(data.get('combustOrb'))
        _ub = _optional_float(data.get('underBeamsOrb'))
        self._sunPosCazimi = _cz if _cz is not None else 17.0 / 60.0
        self._sunPosCombust = _cb if _cb is not None else 8.5
        self._sunPosBeams = _ub if _ub is not None else 17.0
        self._phaseCazimi = _cz if _cz is not None else 17.0 / 60.0
        self._phaseCombust = _cb if _cb is not None else 8.5
        # 恒星合相轨:starOrb 平轨(默认 1°=现状);starOrbMode='byMagnitude' 走 FixedStar.orb() 星等表。
        _so = _optional_float(data.get('starOrb'))
        self._starOrb = _so if _so is not None else 1.0
        self._starOrbByMag = (data.get('starOrbMode') == 'byMagnitude')
        # 映点接触容许度(同座 signlon 差,默认 1°=现状)。
        _ao = _optional_float(data.get('antisciaOrb'))
        self._antisciaOrb = _ao if _ao is not None else 1.0
        # 月亮空亡口径(六口径,默认 lilly=现实现「无入相/正合主相位即空」;前端 'classic'/'backend' 同义)。
        _vm = data.get('vocMode') or 'lilly'
        self._vocMode = 'lilly' if _vm in ('classic', 'backend') else _vm
        self._vocIncludeOuter = bool(data.get('vocIncludeOuter'))
        # 燃烧之路边界(默认 standard=195–225 传统口径;2026-07 用户拍板由旧窄口径 208–217 归正,
        # 旧值以 'narrow' 档保留)。畸形键回默认。
        self._viaCombustaRange = self._VIA_COMBUSTA_RANGES.get(
            data.get('viaCombustaVariant') or 'standard', self._VIA_COMBUSTA_RANGES['standard'])
        # ── 天文口径 2026-08 对标批(缺省=历史现值零回归)──
        # own chariot(Porphyry):行星在自己的界或当值三分内免「燃烧/日光束下」判定(cazimi 吉态不豁免)。
        self._combustOwnChariot = str(data.get('combustOwnChariotExempt', 0)) in ('1', 'true', 'True')
        # 月亮站心视差修正:月亮(及其派生点)按测站坐标重算(黄经差可达 ~1°)。
        self._topoMoon = str(data.get('topocentricMoon', 0)) in ('1', 'true', 'True')
        # (polarMcMode 已删档。极圈内天顶口径单一来源在 flatlib swe.upperMeridianAscmc:MC 一律取子午线
        #  上中天交点 —— 本时刻它落地平下时 swisseph 会对 Regiomontanus / Campanus / Polich-Page 等换成 IC,
        #  那里统一改回并在 houses[].polarMc 打徽记;不再有按分宫制分叉的口径。锁:test_polar_mc_house_systems.py)
        # 留驻判定:'off'(默认=现状,仅逆行 R 标)/'exactWindow'(距留点 ≤1 日)/'distance'(距留点黄经 ≤2′)/
        # 'absSpeed'(|日速|<1′)/'relSpeed'(|日速|<3% 均速)。产出行星 stationState 属性供盘面 S/D 标。
        self._stationMode = data.get('stationMarking') or 'off'

        date = data['date']
        self.time = data['time']
        self.zone = data['zone']
        self.lat = data['lat']
        self.lon = data['lon']

        parts = date.split('/')
        if len(parts) == 1:
            parts = date.split('-')
        if len(parts) == 4:
            self.year = '-{0}'.format(parts[1])
            self.month = parts[2]
            self.day = parts[3]
        else:
            self.year = parts[0]
            self.month = parts[1]
            self.day = parts[2]

        self.date = '{0}/{1}/{2}'.format(self.year, self.month, self.day)

        self.pdaspects = const.MAJOR_ASPECTS
        self.tradition = False
        self.house = const.HOUSES_WHOLE_SIGN
        self.strongRecption = True
        self.virtualPointReceiveAsp = False
        self.simpleAsp = False
        self.pdtype = 0
        self.pdMethod = 'core_alchabitius'
        # 投影×定局解耦(正交):pdProjection 决定弧、pdFrame 决定盘面宫始点。
        # None = 未显式指定 → 由 pdMethod 兼容映射推导(perpredict._PD_METHOD_TO_PAIR),
        # 全缺省时 = ('ptolemy','alcabitius') = 现状默认路径,字节零回归。
        self.pdProjection = None
        self.pdFrame = None
        self.pdTimeKey = 'Ptolemy'
        self.pdYears = 100
        # 自研引擎方位法的开关(仅 placidus / regio / campanus / topo 生效；core/legacy 不受影响）。
        # 默认「顺逆都开」(用户偏好):Alcabitius 走自有引擎本就含正负弧、忽略此开关;
        # 切到新方位法时默认两向都算、按年龄交错。
        self.pdDirect = True      # 顺向 direct(默认开)
        self.pdConverse = True    # 逆向 converse(默认开;可与 direct 同时开)
        self.pdAntiscia = False   # 映点/反映点作 promissor
        self.pdTerms = False      # 界(terms)边界作 promissor
        self.pdParallel = False       # 赤纬平行/反平行(映点法);pdtype=1 时为世界平行
        self.pdRaptParallel = False   # 急动平行(双动求根;仅世界主限)
        self.pdFramework = 'aspect'   # 框架:aspect 相位主限(默认)/bounds 界行/release 释放(hyleg)
        # S/P 清单扩展(默认 None=现状集,零回归):
        # pdSignificators 追加键 ∈ {Desc, IC, Syzygy, Spirit, Cusps};pdPromissorTypes ∈ {cusps}
        self.pdSignificators = None
        self.pdPromissorTypes = None
        self.pdTimeKeyCustom = None   # User 钥匙:自定义每年度数(仅 pdTimeKey='User' 时消费)
        self.termsVariant = 0         # 界系:0 埃及(默认)/1 托勒密/2 莉莉(PD 界行/分配星同用)

        self.isBC = False
        if 'ad' in data.keys():
            if int(data['ad']) == 1:
                self.isBC = False
            else:
                self.isBC = True
                if self.date[0:1] != '-':
                    self.date = '-{0}'.format(self.date)
                    self.year = '-{0}'.format(self.year)

        if self.year[0:1] == '-':
            self.isBC = True

        if 'strongRecption' in data.keys():
            self.strongRecption = data['strongRecption']

        if 'virtualPointReceiveAsp' in data.keys():
            self.virtualPointReceiveAsp = data['virtualPointReceiveAsp']
        if 'simpleAsp' in data.keys():
            self.simpleAsp = data['simpleAsp']

        self.houseCust = None
        if 'hsys' in data.keys():
            self.house = getHSys(data['hsys'])
            if self.house == custHouse_Equal_MC_Middle:
                self.house = const.HOUSES_ALCABITUS
                self.houseCust = custHouse_Equal_MC_Middle
            elif self.house == custHouse_Fortuna_Whole:
                self.house = const.HOUSES_WHOLE_SIGN
                self.houseCust = custHouse_Fortuna_Whole

        if 'pdaspects' in data.keys():
            # 🔴 空/非法相位集回落主相位默认:pdaspects 继承自主盘相位设置,用户在主盘
            # 清空相位会让主限表变成 0 行死表(合相 0 也是相位集成员,清空 = 连本体行都没有)。
            # 与其它参数「非法值回落默认」同口径;显式给出的非空集合原样尊重(零回归)。
            _asp = data['pdaspects']
            self.pdaspects = _asp if (isinstance(_asp, (list, tuple)) and len(_asp)) else const.MAJOR_ASPECTS

        self.southchart = False
        if 'southchart' in data.keys():
            self.southchart = data['southchart']

        if 'pdtype' in data.keys():
            self.pdtype = data['pdtype']

        if 'pdMethod' in data.keys():
            self.pdMethod = data['pdMethod']
            # whitelist 与 perpredict._PD_METHOD_REGISTRY 保持同步；未识别 method 一律
            # 回退到默认 Alcabitius (core_alchabitius)，护住默认路径字节级一致。
            if self.pdMethod not in ('core_alchabitius', 'horosa_legacy', 'placidus',
                                     'regiomontanus', 'campanus', 'topocentric',
                                     'meridian', 'porphyry', 'equal_ecliptic',
                                     'equal_hour_circle', 'morinus',
                                     'in_zodiaco_lon', 'in_zodiaco_abs'):
                self.pdMethod = 'core_alchabitius'

        if 'pdProjection' in data.keys():
            v = '{0}'.format(data['pdProjection'] or '')
            if v in ('ptolemy', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
                     'zodiacal', 'ra_direct', 'in_zodiaco_lon', 'in_zodiaco_abs', 'horosa_legacy',
                     'placidus_under_pole'):
                self.pdProjection = v
        if 'pdFrame' in data.keys():
            v = '{0}'.format(data['pdFrame'] or '')
            if v in ('alcabitius', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
                     'meridian', 'porphyry', 'equal', 'wholesign', 'morinus', 'koch',
                     'equal_hour_circle'):
                self.pdFrame = v

        if 'pdTimeKey' in data.keys():
            self.pdTimeKey = data['pdTimeKey']

        if 'pdYears' in data.keys():
            try:
                # 上限 3000 年:>360 走多圈复发行(perpredict._extendCorePdRecurrences),≤360 与既往逐位一致。
                self.pdYears = max(1, min(3000, int(round(float(data['pdYears'])))))
            except (TypeError, ValueError):
                self.pdYears = 100

        def _truthy(v):
            return v is True or v == 1 or v == '1' or v == 'true'
        if 'pdDirect' in data.keys():
            # 顺向默认开;仅当显式传 0/false 才关。
            v = data['pdDirect']
            self.pdDirect = not (v is False or v == 0 or v == '0' or v == 'false')
        if 'pdConverse' in data.keys():
            self.pdConverse = _truthy(data['pdConverse'])
        if 'pdAntiscia' in data.keys():
            self.pdAntiscia = _truthy(data['pdAntiscia'])
        if 'pdTerms' in data.keys():
            self.pdTerms = _truthy(data['pdTerms'])
        if 'pdParallel' in data.keys():
            self.pdParallel = _truthy(data['pdParallel'])
        if 'pdRaptParallel' in data.keys():
            self.pdRaptParallel = _truthy(data['pdRaptParallel'])
        if 'pdFramework' in data.keys():
            v = '{0}'.format(data['pdFramework'] or '')
            if v in ('aspect', 'bounds', 'release'):
                self.pdFramework = v
        def _strlist(v):
            if isinstance(v, (list, tuple)):
                return [str(x) for x in v]
            if isinstance(v, str) and v.strip():
                return [x.strip() for x in v.split(',') if x.strip()]
            return None
        if 'pdSignificators' in data.keys():
            vs = _strlist(data['pdSignificators'])
            if vs is not None:
                allow = ('Desc', 'IC', 'Syzygy', 'Spirit', 'Cusps', 'Stars', 'Lots')
                self.pdSignificators = [x for x in vs if x in allow] or None
        if 'pdPromissorTypes' in data.keys():
            vs = _strlist(data['pdPromissorTypes'])
            if vs is not None:
                self.pdPromissorTypes = [x for x in vs if x in ('cusps', 'stars', 'lots')] or None
        if 'pdTimeKeyCustom' in data.keys():
            try:
                v = float(data['pdTimeKeyCustom'])
                if 0.001 <= v <= 30.0:
                    self.pdTimeKeyCustom = v
            except (TypeError, ValueError):
                pass
        if 'termsVariant' in data.keys():
            self.termsVariant = parse_terms_variant(data['termsVariant'])

        # 容许度自定义：orbs(逐星 id->度) / orbScale(全局倍数)。默认 None → 盘对象 orb() 回退默认表，零回归。
        self.orbOverrides = None
        self.orbScale = None
        if isinstance(data.get('orbs'), dict):
            try:
                self.orbOverrides = {k: float(v) for k, v in data['orbs'].items() if v is not None and str(v) != ''}
            except (TypeError, ValueError):
                self.orbOverrides = None
        if 'orbScale' in data.keys():
            try:
                sc = float(data['orbScale'])
                self.orbScale = sc if sc > 0 else None
            except (TypeError, ValueError):
                self.orbScale = None

        self.su28Mode = self.parseSu28Mode(data.get('doubingSu28', SU28_MODE_REAL))
        # WP-D 授时历古法(mode6)子参:推变法(jiyuan闭式·默认/jintui进退/huiyuan会圆) + 古宿是否随岁差(默认固定·元时永不变)。
        _tm = str(data.get('guolaoTuibianMethod', 'jiyuan') or 'jiyuan')
        self.guolaoTuibianMethod = _tm if _tm in ('jiyuan', 'jintui', 'huiyuan') else 'jiyuan'
        self.guolaoGufaPrecess = 1 if data.get('guolaoGufaPrecess') in (1, '1', True) else 0
        # 赤道回归制(mode7)锚定(做成选项):dongzhi 牛前冬至 270°(默认) / chunfen 春分壁2.3°。
        self.guolaoEqTropicalAnchor = 'chunfen' if str(data.get('guolaoEqTropicalAnchor', '') or '').strip() == 'chunfen' else 'dongzhi'
        self.isZhengSidereal = self.su28Mode == SU28_MODE_ZHENG_SIDEREAL or data.get('guolaoZhengSidereal') == 1 or data.get('guolaoZhengSidereal') == '1'

        self.zodiacal = const.TROPICAL
        if 'zodiacal' in data.keys():
            if data['zodiacal'] == 1 or data['zodiacal'] == const.SIDEREAL:
                self.zodiacal = const.SIDEREAL
        if self.isZhengSidereal:
            self.zodiacal = const.SIDEREAL

        self.dateTime = Datetime(self.date, self.time, self.zone)
        self.pos = GeoPos(self.lat, self.lon)

        self.objlists = []

        jd = self.dateTime.jd
        # 凯龙域内=全表(与旧行为字节一致);域外=按各天体数据域精确筛
        #(旧版整组剔除小行星,致 relative/midpoint 等在古代/远期缺 Ceres 等全域可算天体)。
        if 1967601.5 <= jd <= 3419437.5:
            self.objlists.extend(const.LIST_OBJECTS)
        else:
            self.objlists.extend(objectsForJD(jd))

        if 'objlists' in data.keys():
            self.objlists = data['objlists']
        objset = set(self.objlists)
        self.hasSun = const.SUN in objset
        self.hasMoon = const.MOON in objset
        if not self.hasMoon:
            self.objlists.append(const.MOON)
        if not self.hasSun:
            self.objlists.append(const.SUN)

        self.eastRa = None
        self.isDoubingSu28 = self.su28Mode == SU28_MODE_DOUBING
        # 用户在「黄道 → 恒星黄道」下选了具体 ayanāṃśa(Lahiri/Raman/KP… 全 47)→ 用该模式;
        # 缺省(空)走 Swiss Ephemeris 现默认,与改前逐位一致,向后兼容。
        self.siderealAyanamsa = ''
        siderealMode = None
        ayan_key = data.get('siderealAyanamsa') or data.get('ayanamsa') or ''
        if self.isZhengSidereal:
            # G2(七政恒星制历元可选):用户显式选 ayanāṃśa 则优先,否则回落郑氏(默认=零回归)。
            if ayan_key:
                try:
                    from astrostudy.india.india_chart_kernel import normalize_ayanamsa
                    resolved = normalize_ayanamsa(ayan_key)
                    siderealMode = resolved
                    self.siderealAyanamsa = resolved.get('key', '')
                except Exception:
                    siderealMode = ZHENG_SIDEREAL_MODE
            else:
                siderealMode = ZHENG_SIDEREAL_MODE
        elif self.zodiacal == const.SIDEREAL and ayan_key:
            # 自定义恒星黄道:ayan_key='user' + userAyanT0(参考历元 JD) + userAyanDeg(该历元
            # ayanamsa 度值) → SIDM_USER 三参(通道 swe.setSiderealContext 早已齐备,此前只有两处
            # 硬编码历元)。参数缺失/畸形回落 47 档 normalize(默认 lahiri),不炸盘。
            if str(ayan_key).strip().lower() == 'user':
                _ut0 = _optional_float(data.get('userAyanT0'))
                _udeg = _optional_float(data.get('userAyanDeg'))
                if _ut0 is not None and _udeg is not None:
                    siderealMode = {'key': 'user', 'mode': swe.SE_SIDM_USER, 't0': _ut0, 'ayan_t0': _udeg}
                    self.siderealAyanamsa = 'user'
            if siderealMode is None:
                try:
                    from astrostudy.india.india_chart_kernel import normalize_ayanamsa
                    resolved = normalize_ayanamsa(ayan_key)
                    siderealMode = resolved
                    self.siderealAyanamsa = resolved.get('key', '')
                except Exception:
                    siderealMode = None
        self.siderealMode = siderealMode

        self.needpars = True
        if 'needpars' in data.keys():
            self.needpars = False

        ids = []
        ids.extend(self.objlists)

        if self.tradition:
            self.chart = Chart(self.dateTime, self.pos, self.zodiacal, hsys=self.house, needpars=self.needpars, sidereal_mode=siderealMode)
        else:
            self.chart = Chart(self.dateTime, self.pos, self.zodiacal,
                               hsys=self.house, IDs=ids, needpars=self.needpars, sidereal_mode=siderealMode)
        if const.SATURN in objset and const.MARS in objset and const.JUPITER in objset and const.VENUS in objset:
            self.objlists.extend(const.LIST_MIDDLE_POINTS)

        self.applyGuolaoSiyu()   # G10/G11 四余真交点/真远地点(默认平算零回归;在 reinit 前,宿度随新 lon 重算)

        self.custHouse()

        if self.southchart and self.pos.lat < 0:
            self.setupSouthChart()
        else:
            self.reinit()

    def applyGuolaoSiyu(self):
        """G10/G11 四余取法:罗计真交点(SE_TRUE_NODE=11)/月孛真远地点(SE_OSCU_APOG=13)。
        默认平交点(10)/平远地点(12)零回归;仅 guolaoNodeType=='true'/guolaoLilithType=='true' 触发。
        占星(希腊化)G12:西占月交点真平共用本链路 —— westNodeType=='true' 同样触发真交点置换
        (与 guolaoNodeType 等效,默认 mean 零回归;两键互不污染:七政走 guolao*、西占走 west*)。
        复用 chart 自身 sidereal context+flags;本调用在 reinit(setupPlanets)前,宿度随新 lon 重算。
        失败安全回退保留平算(同 india _apply_true_node:南交=北交 lon/ra+180,lat/decl 不取负)。"""
        data = self.data if isinstance(self.data, dict) else {}
        nodeTrue = (data.get('guolaoNodeType', 'mean') == 'true'
                    or data.get('westNodeType', 'mean') == 'true')
        # 黑月补西占专用键 westLilithType(交点早有双键、黑月此前只有七政键——
        # 西占用户要切真远地点必须借 guolao 键名,域污染):两键 or 等效,默认 mean 零回归。
        lilithTrue = (data.get('guolaoLilithType', 'mean') == 'true'
                      or data.get('westLilithType', 'mean') == 'true')
        if not nodeTrue and not lilithTrue:
            return
        jd = self.dateTime.jd
        flags = getattr(self.chart, 'flags', swe.SEDEFAULT_FLAG)

        def calc(swid):
            with self.chart._siderealContext():
                pos = swe.swisseph.calc_ut(jd, swid, flags)[0]
                eq = swe.swisseph.calc_ut(jd, swid, flags | swe.SEFLG_EQUATORIAL)[0]
            ra = eq[0] if eq[0] >= 0 else (eq[0] + 360) % 360
            return pos, eq, ra

        def findobj(objid):
            return next((o for o in self.chart.objects if getattr(o, 'id', None) == objid), None)

        if nodeTrue:
            north = findobj(const.NORTH_NODE)
            south = findobj(const.SOUTH_NODE)
            if north is not None or south is not None:
                try:
                    pos, eq, ra = calc(11)
                except Exception:
                    pos = None
                if pos is not None:
                    if north is not None:
                        north.relocate(pos[0])
                        north.lat = pos[1]; north.lonspeed = pos[3]; north.latspeed = pos[4]
                        north.ra = ra; north.decl = eq[1]
                    if south is not None:
                        south.relocate((pos[0] + 180.0) % 360.0)
                        south.lat = pos[1]; south.lonspeed = pos[3]; south.latspeed = pos[4]
                        south.ra = (ra + 180.0) % 360.0; south.decl = eq[1]

        if lilithTrue:
            darkmoon = findobj(const.DARKMOON)
            if darkmoon is not None:
                try:
                    pos, eq, ra = calc(13)
                except Exception:
                    pos = None
                if pos is not None:
                    darkmoon.relocate(pos[0])
                    darkmoon.lat = pos[1]; darkmoon.lonspeed = pos[3]; darkmoon.latspeed = pos[4]
                    darkmoon.ra = ra; darkmoon.decl = eq[1]

    def clone(self, objlists, hid=const.HOUSES_WHOLE_SIGN, needpars=True):
        data = copy.deepcopy(self.data)
        data['objlists'] = objlists
        data['hid'] = hsys.index(hid)
        data['needpars'] = needpars
        perchart = PerChart(data)
        return perchart

    def applyOrbOverrides(self):
        """ 把 orbs(逐星)/orbScale(全局倍数) 挂到盘对象上；默认无参直接返回，orb() 回退默认表，行为字节级不变。 """
        ov = getattr(self, 'orbOverrides', None)
        sc = getattr(self, 'orbScale', None)
        if not ov and sc is None:
            return
        for obj in self.chart.objects:
            if ov and obj.id in ov:
                obj._orbOverride = ov[obj.id]
            if sc is not None:
                obj._orbScale = sc

    def reinit(self):
        self.orientOccident = None
        self.orientOccidentHouses = None
        # v3.0.1 perf ROUND-5 请求内 memo:同一 /chart 请求内被重复计算的纯函数结果(重复调用逐字节
        # 等值已实测证明;各访问器处有防坑注释)。与 orientOccident 同生命周期,reinit 即全部失效。
        self._fixedStars67Cache = None
        self._adjustSu28Cache = None
        self._rawSu28Cache = None
        self._sunRiseCache = None
        self._surroundAttacksCache = None
        self._mutualsCache = None
        self.dynchart = ChartDynamics(self.chart)
        self.dynchart.simpleAsp = self.simpleAsp
        self.applyOrbOverrides()
        self.setupPlanets()
        self.setupDignities()

    def _applyClassicalNightTables(self):
        """界表 / 三分表的昼夜变体(锁由 webchartsrv 请求级持有,此处改 essential.TERMS / TABLE 安全)。
        - 迦勒底界(termsVariant=3)夜盘换夜表(土↔水位置互换);自定义界表(4)夜盘且夜表在槽才换;
        - 三分集水象变体夜盘换水象「夜」表(水象 trip = 火 + 月);
        - 昼盘(或夜盘无独立夜表)显式复位 push 时的昼向主表:同一临界区内「夜盘在前、昼盘在后」
          (合盘 inner/outer、返照 natal→dirChart)不再吃前一张的夜表。
        默认 / 其它界系与三分集不命中任何换表分支 → 零回归。
        不包 try 吞错:这里只是按请求参数选表,没有依赖外部数据的失败面;真抛错就是代码错。吞掉的后果不是
        「回落缺省表」,而是 essential 里留着上一张盘换上的表(夜表跨盘泄漏)、本盘选的变体静默失效 ——
        宁可整请求报错,也不出一张口径不明的盘。"""
        data = self.data if isinstance(self.data, dict) else {}
        tv = str(data.get('termsVariant', ''))
        if tv == '3' and not self.isDiurnal:
            essential.TERMS = _CHALDEAN_TERMS_NIGHT
        elif tv == '4' and not self.isDiurnal and _CUSTOM_TERMS_NIGHT_ACTIVE is not None:
            essential.TERMS = _CUSTOM_TERMS_NIGHT_ACTIVE
        elif _PUSH_TERMS_DAY_ACTIVE is not None:
            essential.TERMS = _PUSH_TERMS_DAY_ACTIVE
        if str(data.get('triplicity', '')) == 'PtolemaicWaterVariant' and not self.isDiurnal:
            essential.TABLE = _PTOLEMAIC_WATER_VARIANT_DIGNITIES_NIGHT
        elif _PUSH_TRIP_DAY_ACTIVE is not None:
            essential.TABLE = _PUSH_TRIP_DAY_ACTIVE

    def setupPlanets(self):
        self.isDiurnal = self._diurnalWithSectBuffer()
        self._applyTopoMoon()      # 站心月(默认关);须在点变体前(变体公式吃新月位)
        self._applyLotVariants()   # 希腊点变体一体(收编福点反转;全默认零 relocate 零回归)
        if self.houseCust == custHouse_Fortuna_Whole:
            # 福点整宫制按「最终福点」(站心月 + 变体之后)重定 12 宫;缺省两次同座零回归。
            # 不包 try:构造期那次本来就不包,缺福点 / 缺光体的情形函数内部已有回退;再抛错就是代码错,
            # 吞掉会让盘头写「福点整宫」、宫位却停在变体前的福点上。
            self._placeFortunaWholeHouses()
        self._applyClassicalNightTables()
        suobjs = const.LIST_OBJECTS_TRADITIONAL.copy()
        objs = const.LIST_OBJECTS_TRADITIONAL
        planets = const.LIST_SEVEN_PLANETS.copy()
        if not self.tradition:
            planets.append(const.URANUS)
            planets.append(const.NEPTUNE)
            planets.append(const.PLUTO)
            objs = self.objlists
            suobjs = self.objlists.copy()

        asc = self.chart.getAngle(const.ASC)
        ascsign = asc.sign
        sidx = const.LIST_SIGNS.index(ascsign)
        self.ascSignIdx = sidx   # 整宫制起算(WI-03 喜乐 等用)

        suobjs.extend(const.LIST_ANGLES)
        for obj in suobjs:
            planet = self.chart.get(obj)
            term = guotables.TERM_SU27[planet.sign]
            for pos in term:
                if pos[1] <= planet.signlon < pos[2]:
                    planet.su = pos[0]
                    break

        for obj in const.LIST_ANGLES:
            angle = self.chart.get(obj)
            antipnt = angle.antiscia()
            cantipnt = angle.cantiscia()
            angle.antisciaPoint = {
                'sign': antipnt.sign,
                'signlon': antipnt.signlon,
                'lon': antipnt.lon
            }
            angle.cantisciaPoint = {
                'sign': cantipnt.sign,
                'signlon': cantipnt.signlon,
                'lon': cantipnt.lon
            }
            house = self.chart.houses.getHouseByLon(angle.lon)
            angle.house = house.id
            angle.mansion = ctab.mansion_of(angle.lon)   # WI-07 上升宿
            self.setupSpecial(angle)

        for obj in const.LIST_HOUSES:
            house = self.chart.getHouse(obj)
            house.planets = []
            house.exalt = None

        # 真黄赤交角(度,≈23.436):出界 Out-of-Bounds 判据(赤纬与黄道制无关,恒星盘亦适用)。
        try:
            self.eclObliquity = round(swisseph.calc_ut(self.dateTime.jd, swisseph.ECL_NUT)[0][0], 4)
        except Exception:
            self.eclObliquity = 23.4367
        try:
            sunObj = self.chart.get(const.SUN)
        except Exception:
            sunObj = None
        # 七政经度(野逸判据用):七星互相是否成相。
        self._sevenLons = {}
        for sid in const.LIST_SEVEN_PLANETS:
            try:
                self._sevenLons[sid] = self.chart.get(sid).lon
            except Exception:
                pass
        # WI-25/25b 远地点/数增减/光增减 用:七政→swisseph 体 id + 当下太阳黄经。
        _SWE_BODY = {const.SUN: swisseph.SUN, const.MOON: swisseph.MOON, const.MERCURY: swisseph.MERCURY,
                     const.VENUS: swisseph.VENUS, const.MARS: swisseph.MARS,
                     const.JUPITER: swisseph.JUPITER, const.SATURN: swisseph.SATURN}
        _sun_lon_now = sunObj.lon if sunObj else None

        for obj in objs:
            planet = self.chart.get(obj)
            self.setupSpecial(planet)
            self.setupOutOfBounds(planet, obj)
            self.setupPhasis(planet, obj, sunObj)
            self.setupJoy(planet, obj)
            self.setupSect(planet, obj, sunObj)
            self.setupFeral(planet, obj)
            # WI-09 阳/阴度数 + WI-07 月站(回归制,0°白羊起;与恒星制 nakshatra 并存勿混)。
            planet.degreeGender = ctab.degree_gender(planet.sign, planet.signlon)
            planet.mansion = ctab.mansion_of(planet.lon)
            # WI-05 度数性质 明/暗/空/烟 + WI-09 特殊度数 陷度/慢病/增福(al-Qabisi 录本)。
            planet.degreeQuality = ctab.degree_quality(planet.sign, planet.signlon)
            planet.specialDegree = ctab.special_degree(planet.sign, planet.signlon)
            # WI-15 单度主星 + WI-17 九分 + WI-14 Darijan(印度十度分;迦勒底面另由必然尊贵 face 提供)。
            planet.monomoiria = ctab.monomoiria_ruler(planet.lon)
            planet.ninthPart = ctab.ninth_part_sign(planet.lon)
            planet.darijan = ctab.darijan_ruler(planet.sign, planet.signlon)
            planet.movedir = planet.movement()
            # 留驻判定(stationMarking 四法;默认 off=None 零成本):'S' 留驻带内/'D' 顺行留后初段。
            planet.stationState = self._stationState(obj, planet)
            # WI-25/25b 远地点 apogee 升降 + 数增数减 + (月)光增光减:用 swisseph 距速 distspeed。
            # distspeed>0=距地渐增→趋远地点(升)+行速渐慢(数减);<0=距地渐减→趋近地点(降)+行速渐快(数增)。
            try:
                _swid = _SWE_BODY.get(obj)
                if _swid is not None:
                    _distspeed = swisseph.calc_ut(self.dateTime.jd, _swid, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0][5]
                    planet.apogeeDir = 'rising' if _distspeed > 0 else 'falling'
                    planet.numberTrend = 'decreasing' if _distspeed > 0 else 'increasing'
                    if obj == const.MOON and _sun_lon_now is not None:
                        _elong = (planet.lon - _sun_lon_now) % 360.0
                        planet.lightTrend = 'waxing' if _elong < 180.0 else 'waning'
            except Exception:
                pass
            antipnt = planet.antiscia()
            cantipnt = planet.cantiscia()
            planet.antisciaPoint = {
                'sign': antipnt.sign,
                'signlon': antipnt.signlon,
                'lon': antipnt.lon
            }
            planet.cantisciaPoint = {
                'sign': cantipnt.sign,
                'signlon': cantipnt.signlon,
                'lon': cantipnt.lon
            }
            planethouse = self.chart.houses.getHouseByLon(planet.lon)
            planet.house = planethouse.id
            # 返照落宫「计入黄纬」(Umar al-Tabari 系):行星按赤经落宫头 ra 区间
            # (黄纬经赤道座标自然生效)。仅返照盘生效(_isReturnChart 内部标记由 perpredict 注入,
            # 主盘即便带 returnLatitudeMode 键也零效);默认 'ecliptic' 零动。
            if (isinstance(self.data, dict) and self.data.get('returnLatitudeMode') == 'withLatitude'
                    and self.data.get('_isReturnChart')):
                ra_house = self._houseByRa(getattr(planet, 'ra', None))
                if ra_house is not None:
                    planet.house = ra_house
            if obj in props.object.meanMotion.keys():
                planet.meanSpeed = planet.meanMotion()
                self.hayyiz(planet, self.isDiurnal)

            if obj not in planets:
                continue

            planet.ruleHouses = []
            i = 0
            for elm in range(sidx, sidx + 12):
                sign = const.LIST_SIGNS[elm % 12]
                ruler = tables.ESSENTIAL_DIGNITIES[sign]['ruler']
                exalt = tables.ESSENTIAL_DIGNITIES[sign]['exalt'][0]
                houseid = const.LIST_HOUSES[i]
                house = self.chart.getHouse(houseid)
                if exalt == obj:
                    planet.exaltHouse = houseid
                    house.exalt = obj
                if ruler == obj:
                    planet.ruleHouses.append(houseid)
                    house.ruler = obj
                if planethouse.id == houseid:
                    house.planets.append(obj)

                i = i +1


    def getChart(self):
        return self.chart

    def getChartObj(self):
        chart = self.chart
        houses = []
        objs = []
        for key in chart.houses.content.keys():
            houses.append(chart.houses.content[key])
        for key in chart.objects.content.keys():
            if (key == const.SUN and not self.hasSun) or (key == const.MOON and not self.hasMoon):
                continue
            objs.append(chart.objects.content[key])
        for key in chart.angles.content.keys():
            objs.append(chart.angles.content[key])

        houses.sort(key=takeLon)
        objs.sort(key=takeLon)

        res = {
            'zodiacal': self.zodiacal,
            'date': self.chart.orgdate,
            'geo': self.chart.pos,
            'hsys': self.house,
            'houses': houses,
            'objects': objs,
            'nakshatras': ({o.id: nakshatra_from_lon(o.lon) for o in objs} if self.zodiacal == const.SIDEREAL else None),
            'siderealAyanamsa': self.siderealAyanamsa,
            'isDiurnal': self.isDiurnal,
            'antiscias': self.getAntiscia(),
            'stars': self.getStars(),
            'orientOccident': self.orientalOccidental(),
            # 黄仪/赤仪显示口径(单一真值源,前端/Java 一律读此字段,勿自行判断):
            # 与 getFixedStarSu28 的 byLon/byRA 置宿分派同一集合——黄仪(byLon 四制)=全黄经显示,
            # 赤仪(byRA 四制)=全赤经显示;显示口径与入宿判定永远同体系。
            'displayCoord': 'ecliptic' if self.su28Mode in (
                SU28_MODE_MOIRA_CURRENT, SU28_MODE_MOIRA_KAIXI,
                SU28_MODE_ZHENG_SIDEREAL, SU28_MODE_GUFA_LICHENG,
            ) else 'equatorial',
            'fixedStarSu28': self.getFixedStarSu28(),
            'fixedStars': self.getFixedStars(),
            'signsRA': self.getSignsRA(),
            'signsRaDoubingSu28': self.getDoubingSu28SignsRA(),
            'su28Adjust': self.getAdjustFixedStarSu28(),
            'su28Virtual': self.getVirtualFixedStarSu28(),
            'beidou': self.getBeiDou(),
            'beiji': self.getBeiJi(),
            'timerStar': self.getTimerStar(),
            'dayerStar': self.getDayerStar(),
            'dayofweek': dayofweekStr[self.dateTime.date.dayofweek()],
            'sunRiseTime': self.getSunRiseTime()['timeStr'],
            'sunSetTime': self.getSunSetTime()['timeStr'],
        }
        return res

    def getChartOnlyObj(self):
        chart = self.chart
        houses = []
        objs = []
        for key in chart.houses.content.keys():
            houses.append(chart.houses.content[key])
        for key in chart.objects.content.keys():
            if (key == const.SUN and not self.hasSun) or (key == const.MOON and not self.hasMoon):
                continue
            objs.append(chart.objects.content[key])
        for key in chart.angles.content.keys():
            objs.append(chart.angles.content[key])

        houses.sort(key=takeLon)
        objs.sort(key=takeLon)

        res = {
            'hsys': self.house,
            'houses': houses,
            'objects': objs,
            'nakshatras': ({o.id: nakshatra_from_lon(o.lon) for o in objs} if self.zodiacal == const.SIDEREAL else None),
            'siderealAyanamsa': self.siderealAyanamsa,
            'isDiurnal': self.isDiurnal
        }
        return res

    def getPredict(self):
        return PerPredict(self)
