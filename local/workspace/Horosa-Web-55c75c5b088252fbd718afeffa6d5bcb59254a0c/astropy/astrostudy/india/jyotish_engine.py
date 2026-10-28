import math
from datetime import datetime, timedelta

from flatlib import const
from flatlib.datetime import Datetime
from flatlib.ephem import eph

from astrostudy.india.yoga_engine import build_yogas, house_number, safe_get
from astrostudy.india.primitives import chara_karakas, KARAKA_PLANETS, MOOLATRIKONA, PLANET_CN, SIGN_CN
from astrostudy.nakshatra import NAKSHATRAS, nakshatra_from_lon
from astrostudy.india.jyotish_parts.tables import (
    JYOTISH_PLANETS, DASHA_SEQUENCE, YOGINI_SEQUENCE, YOGINI_TOTAL, ASHTOTTARI_SEQUENCE, ASHTOTTARI_TOTAL,
    ASHTOTTARI_NAK_LORD, _ASHT_NAK_WIDTH, _ASHT_ARC_DEF, ASHTOTTARI_ARC, _ASHT_ARC_DEF_KRITTIKADI,
    ASHTOTTARI_ARC_KRITTIKADI, _nak_lord_table_from_arcdef, ASHTOTTARI_NAK_LORD_KRITTIKADI, ashtottari_arc_remaining,
    TITHI_NAMES, YOGA_NAMES, KARANA_SEQUENCE, VARA_NAMES, VARA_CN, OWN_SIGNS, EXALTATION, BENEFIC_HOUSES, KAKSHYA_LORDS,
    RASI_GUNAKARA, GRAHA_GUNAKARA, CHOGHADIA_CYCLE, CHOGHADIA_DAY_FIRST, NAISARGIKA_ORDER, MULA_MT_SIGN,
    MULA_VIMS_YEARS, _ODD_FOOTED_SIGNS,
)
from astrostudy.india.jyotish_parts.helpers import (
    norm, sign_index_from_lon, get_local_birth_datetime, format_dt, dasha_lord,
)
from astrostudy.india.jyotish_parts.ayurdaya import AyurdayaMixin
from astrostudy.india.jyotish_parts.nadi_varga import NadiVargaMixin
from astrostudy.india.jyotish_parts.factors import FactorsMixin
from astrostudy.india.jyotish_parts.dashas import DashasMixin
from astrostudy.india.jyotish_parts.panchanga import PanchangaMixin
from astrostudy.india.jyotish_parts.strengths import StrengthsMixin
from astrostudy.india.jyotish_parts.jaimini_kp import JaiminiKpMixin


class JyotishEngine(AyurdayaMixin, NadiVargaMixin, FactorsMixin, DashasMixin, PanchangaMixin, StrengthsMixin, JaiminiKpMixin):
    # 四个 nakshatra 树形大运体系(maha→antar→pratyantar 三级树)。UI 一次只显示选中一个,
    # 故仅「选中体系」算完整三级(与历史字节一致),其余只算 maha 顶层(省 antar/pratyantar)→
    # 响应 dasha 体积大降。前端切体系会重取(带新 dashaSystem)。
    _DASHA_TREE_SYSTEMS = ('vimshottari', 'yogini', 'ashtottari', 'tribhagi')

    # 年长五档白名单(古法权威口径):儒略(默认)/格里/Savana/回归/恒星。
    _DASHA_YEAR_CHOICES = (365.25, 365.2425, 360.0, 365.2422, 365.2563)
    # 类级默认:兜住 __new__ 直构(仓内 pytest 直构即如此)与任何绕过 __init__ 的路径。
    dasha_year_days = 365.25
    varga_variant_map = {}
    karaka_scheme = '8'
    yuddha_criterion = 'latitude'
    # 流派开关全默认(类级兜底同 __new__ 直构):见 dasha_variants.VARIANT_SPECS。
    from astrostudy.india.dasha_variants import DEFAULT_VARIANTS as _DV_DEFAULTS
    dasha_variants = dict(_DV_DEFAULTS)

    def __init__(self, perchart, chartnum=1, d1_perchart=None, dasha_seed=None, sthira_start=None, dasha_system=None,
                 dasha_year_days=None, varga_variants=None, karaka_scheme=None, yuddha_criterion=None,
                 dasha_variants=None):
        self.perchart = perchart
        # 流派开关(21 枚举键):容错规范化;缺省/坏值 = 全默认 = 今日行为字节一致。
        from astrostudy.india.dasha_variants import resolve_variants as _rv
        self.dasha_variants = _rv(dasha_variants)
        # 大运年长(日):贯穿全大运族(Vimshottari/Tribhagi/Yogini/Ashtottari/Mula/Naisargika/
        # Sudarshana 年齿 + extended 条件宿系)。默认 365.25 与既有主 Vimshottari 字节一致;
        # 非白名单值静默回落默认(绝不因坏参炸盘)。🔴 只存实例属性,绝不写任何模块全局。
        try:
            _yd = float(dasha_year_days) if dasha_year_days is not None else 365.25
        except (TypeError, ValueError):
            _yd = 365.25
        self.dasha_year_days = _yd if any(abs(_yd - c) < 1e-6 for c in self._DASHA_YEAR_CHOICES) else 365.25
        # 分盘变体映射 {chartnum:variant}(缺省 {} = 全 standard,零回归);经 normalize 只留合法值。
        from astrostudy.india.varga import normalize_varga_variants as _nvv
        self.varga_variant_map = _nvv(varga_variants)
        # Chara Karaka 方案:'8'(默认,含罗睺)/'7'(古典);其余值回落 '8'。
        self.karaka_scheme = '7' if str(karaka_scheme) == '7' else '8'
        # 星曜战判据:'latitude'(默认,纬北者胜)/'longitude'(黄经小者胜);其余回落默认。
        self.yuddha_criterion = 'longitude' if str(yuddha_criterion) == 'longitude' else 'latitude'
        self.chart = perchart.chart
        # 大运起点(seed):默认 'moon'(标准月宿起运);可改取七政/节点/上升/特殊上升/副星任一点。
        self.dasha_seed = (str(dasha_seed).lower() if dasha_seed else 'moon')
        self.sthira_start = (str(sthira_start).lower() if sthira_start else 'lagna')   # Sthira 起座:lagna(默认)/brahma
        # 选中的树形大运体系(决定哪个算完整三级);非四树之一(或缺省)→ 'vimshottari'(默认全展开,零回归)。
        _ds = str(dasha_system).lower() if dasha_system else 'vimshottari'
        self.dasha_system = _ds if _ds in self._DASHA_TREE_SYSTEMS else 'vimshottari'
        try:
            self.chartnum = int(chartnum)
        except (TypeError, ValueError):
            self.chartnum = 1
        self.asc = safe_get(self.chart, const.ASC)
        self.sun = safe_get(self.chart, const.SUN)
        self.moon = safe_get(self.chart, const.MOON)
        # always-D1 子项(月宿大运起点 / Panchanga 真日月 / Gochara 本命参照)恒用 D1 盘。
        # 分盘时由 webindiasrv 传入独立 D1 副本，避免分盘 in-place 重定位污染这些子项；
        # chartnum==1 时 d1_perchart 为 None → D1 引用即自身，行为与重构前字节一致。
        d1p = d1_perchart if d1_perchart is not None else perchart
        self.d1_perchart = d1p
        self.d1_chart = d1p.chart
        self.d1_asc = safe_get(self.d1_chart, const.ASC)
        self.d1_sun = safe_get(self.d1_chart, const.SUN)
        self.d1_moon = safe_get(self.d1_chart, const.MOON)

    def _note_partial(self, name):
        """子块里「这一段没算出来」的落账(compute() 汇入 partialErrors;页面 / AI 快照据此写明未能计算)。
        子块内部的宽 except 一律经此记名,不许静默 pass —— 否则该段在回包里直接消失、无从得知。"""
        errs = self.__dict__.setdefault('_partial_errors', [])
        if name not in errs:
            errs.append(name)

    def _dasha_block(self):
        """七体系大运块:逐体系容错(个别体系在极端年份炸时置 None,不拖垮整块)。"""
        block = {}
        for key, fn in [
            ('vimshottari', self.vimshottari), ('yogini', self.yogini),
            ('ashtottari', self.ashtottari), ('naisargika', self.naisargika_dasha),
            ('tribhagi', self.tribhagi), ('mula', self.mula_dasha),
            ('sudarshanaChakra', self.sudarshana_chakra_dasha),
            ('taraDasha', self.tara_dasha), ('akkg', self.akkg_dasha),
        ]:
            try:
                block[key] = fn()
            except Exception:
                block[key] = None
                self._note_partial('dasha.' + key)
        return block

    def compute(self):
        # 逐键安全组装:任一子块在极端年份(如凯龙域外/极地历法边界)失败时,
        # 该键置 None 并记入 partialErrors,其余子块照常输出——绝不整包丢失。
        # 正常年份全部成功 ⇒ 键序与键值与旧实现完全一致(零回归),且不出现 partialErrors 键。
        res = {
            'engine': {
                'name': 'Horosa JyotishEngine',
                'version': '0.1.0',
                'ephemeris': 'Horosa Swiss Ephemeris / IndiaChartKernel',
                'source': 'chart_json_only',
                'chartnum': self.chartnum,
            },
        }
        errs = []
        for key, fn in [
            ('panchanga', self.panchanga), ('nakshatras', self.nakshatras),
            ('yogas', self.yogas), ('dasha', self._dasha_block),
            ('rasiDasha', self.rasi_dashas), ('grahaDrishti', self.graha_drishti),
            ('nodeRasiDrishti', self.node_rasi_drishti), ('ashtakavarga', self.ashtakavarga),
            # 六力只出六源式 shadbalaBphs(页面 / AI / 导出单一来源);粗估层已删。
            ('shadbalaBphs', self.shadbala_bphs),
            ('strengths', self.strengths), ('jaimini', self.jaimini),
            ('arudha', self.arudha), ('kp', self.kp),
            ('prasna', self.prasna), ('muhurta', self.muhurta),
            ('transit', self.transit_notes), ('upagraha', self.upagraha),
            ('supplementaryLagnas', self.supplementary_lagnas), ('remedies', self.remedies),
            ('functionalNature', self.functional_nature), ('bhavaBala', self.bhava_bala),
            ('extendedDashas', self.extended_dashas), ('grahaYuddha', self.graha_yuddha),
            ('kartari', self.kartari), ('sudarshana', self.sudarshana),
            ('grahaMaitri', self.graha_maitri), ('outerPlanets', self.outer_planets),
            ('compatibility', self.compatibility_shell), ('nadi', self.nadi),
            ('shashtiamsa', self.shashtiamsa), ('vargaVariants', self.varga_variants),
            ('ayurdaya', self.ayurdaya), ('ayurdayaFinal', self.ayurdaya_final),
            ('sensitivePoints', self.sensitive_points),
        ]:
            try:
                res[key] = fn()
            except Exception:
                res[key] = None
                errs.append(key)
        for name in (self.__dict__.get('_partial_errors') or []):
            if name not in errs:
                errs.append(name)
        if errs:
            res['partialErrors'] = errs
        return res


def build_jyotish(perchart, chartnum=1, d1_perchart=None, dasha_seed=None, sthira_start=None, dasha_system=None,
                  dasha_year_days=None, varga_variants=None, karaka_scheme=None, yuddha_criterion=None,
                  dasha_variants=None):
    """在 perchart(可为分盘) 上计算 Jyotish；d1_perchart 提供 always-D1 子项的 D1 盘。

    chartnum==1 且 d1_perchart 为 None、dasha_seed/dasha_system 缺省时退化为重构前行为
    (dasha_system 缺省 → 'vimshottari' 全展开,与历史字节一致)。
    dasha_seed 改大运起点(默认月亮宿;可选七政/节点/上升/特殊上升/副星)。
    dasha_system 选中的树形大运体系:仅该体系算完整三级(maha→antar→pratyantar),
    其余三树(vimshottari/yogini/ashtottari/tribhagi)只出 maha 顶层(剪 antar/pratyantar,顶层元数据与 maha 时间轴保留)。
    """
    return JyotishEngine(perchart, chartnum=chartnum, d1_perchart=d1_perchart, dasha_seed=dasha_seed,
                         dasha_year_days=dasha_year_days,
                         varga_variants=varga_variants, karaka_scheme=karaka_scheme,
                         yuddha_criterion=yuddha_criterion, dasha_variants=dasha_variants,
                         sthira_start=sthira_start, dasha_system=dasha_system).compute()
