# -*- coding: utf-8 -*-
"""大运流派开关(dasha variants)单一真值源。

权威口径:实现总纲「必须暴露为开关的参数」表(21 项)。其中岁差/起算天体/主年长基/
条件体系启用四项已有独立参数(siderealMode / dashaSeed / dashaYearLength / dashaSystem),
不重复入本表;其余全部枚举类流派开关集中在此,经 `resolve_variants()` 规范化后由
JyotishEngine(及 tajaka/rasi_dasha 纯函数层)按键取用。

🔴 铁律:
  - 每键默认值 = 今日代码现状行为(字节零回归);文档另有推荐口径的,以 `doc_default`
    标注供 UI 呈现「文档推荐」,但绝不作为缺省。
  - `resolve_variants(raw)` 对未知键/未知值一律回退默认,绝不抛错(容错解析)。
  - 新增键必须同步:前端 INDIA_DASHA_VARIANT_SPECS(AstroConst)/挂载 schema/
    fieldsToParams(仅非默认下发)/buildIndiaChartCacheKey/buildDashaFieldsKey/
    Java 白名单 dashaVariants(整对象一键,无需逐键)。
"""

import json


# key → {'values': 合法值元组(首个=默认), 'default': 默认值, 'doc_default': 文档推荐(≠默认时标注),
#        'affects': 影响面(注释级说明,不入显示层)}
VARIANT_SPECS = {
    # ── 星宿大运族 ──────────────────────────────────────────────
    'ashtottariReckoning': {
        'values': ('ardradi', 'krittikadi', 'auto_by_rahu'),
        'default': 'ardradi',
        'doc_default': 'auto_by_rahu',   # 文档:依 Rahu 位(kendra→Ardradi/trikona→Krittikadi)
        'affects': 'Ashtottari 宿主映射表(Ardra 起 vs Krittika 起)',
    },
    # ── 过运 Vedha ─────────────────────────────────────────────
    'vedhaBlockers': {
        'values': ('all', 'exclude_nodes'),
        'default': 'all',
        'affects': 'Vedha 遮蔽者集合:罗睺/计都是否作遮蔽者(各家不一;默认计入=既有口径零回归)',
    },
    # ── Kalachakra ─────────────────────────────────────────────
    'kalachakraCycle': {
        'values': ('carry', 'repeat', 'same_nak_carry', 'reset'),
        'default': 'carry',
        'affects': 'paramayus 用尽后的周期换接法;进位绝不跨 savya/apasavya 组',
    },
    'kalachakraApplicability': {
        'values': ('universal', 'navamsa_stronger'),
        'default': 'universal',
        'affects': '是否仅当月亮 navamsa 强于 rasi 才启用 Kalachakra(仅标注,不禁算)',
    },
    # ── Jaimini 座运族 ─────────────────────────────────────────
    'charaDirection': {
        'values': ('lagna_parity_sign', 'ninth_foot'),
        'default': 'lagna_parity_sign',   # 现状:Lagna 奇偶「象」定全序方向
        'doc_default': 'ninth_foot',      # 文档主流:自 Lagna 第 9 座「足性」定向
        'affects': 'Chara 大运 12 座全序方向',
    },
    'charaDignity': {
        'values': ('plus_minus_one', 'none'),
        'default': 'plus_minus_one',      # 现状:主旺 +1/落 −1 恒施
        'doc_default': 'none',            # 文档主流:不施
        'affects': 'Chara 期长尊位修正',
    },
    'jaiminiStrengthOrder': {
        'values': ('standard', 'ak_first'),
        'default': 'standard',
        'affects': 'rasi_dasha 行星/星座强弱判据链的比较次序',
    },
    'rasiAntarFirst': {
        'values': ('dasa_sign_first', 'dasa_sign_last'),
        'default': 'dasa_sign_first',     # 现状:中运自大运座本身起
        'affects': '座运中运(AD)首座:大运座先 vs 大运座末(次座起)',
    },
    'rasiAntarSplit': {
        'values': ('proportional', 'equal'),
        'default': 'proportional',        # 现状:按各 AD 座自身期长占比分割
        'doc_default': 'equal',           # 文档默认:等分
        'affects': 'Chara 座运中运期长分割(前端显示层消费;引擎座序/主期不受影响):比例制 vs 12 等分',
    },
    'chakraDayStart': {
        'values': ('bphs', 'reversed'),
        'default': 'bphs',
        'affects': 'Chakra(10 年/座)昼夜黄昏起座规则(夜=Lagna座/昼=Lagna主座/黄昏=第2宫座 vs 反转)',
    },
    # ── 行星自然运 ─────────────────────────────────────────────
    'naisargikaOrder': {
        'values': ('fixed_natural', 'kendra_strength'),
        'default': 'fixed_natural',       # 现状:固定成熟序(月火水金木日土)
        'affects': 'Naisargika 主运排序:固定自然序 vs kendra 强度序',
    },
    # ── Ayurdaya(寿命)─────────────────────────────────────────
    'nisargayuHarana': {
        'values': ('none', 'pindayu_like'),
        'default': 'none',                # 现状:Nisargayu 全期不减
        'affects': 'Nisargayu 是否施与 Pindayu 相同的 harana 减算',
    },
    'amsayuMultiplier': {
        'values': ('majority_highest', 'bphs_literal', 'saravali_multiply'),
        'default': 'majority_highest',    # 现状主值:庙旺/逆×3·自座/vargottama×2·取最高
        'affects': 'Amsayu bharana 倍数口径(重算总值)',
    },
    'krurodayaDenominator': {
        'values': ('zodiac21600', 'nav108'),
        'default': 'zodiac21600',         # 现状式A:Lagna 座内角分/21600
        'doc_default': 'nav108',          # 文档默认:navamsa 数/108
        'affects': 'Krurodaya(凶升 Lagna)减分分母',
    },
    'ayuClassBoundaries': {
        'values': ('bphs_32_64_120', 'popular_32_70'),
        'default': 'bphs_32_64_120',
        'affects': '寿命档 Alpa/Madhya/Purna 边界(32/64/120 vs 32/70)',
    },
    'satruksetraExemption': {
        'values': ('retrograde', 'mars'),
        'default': 'retrograde',          # 现状:逆行免敌座减
        'affects': '敌座 harana 豁免条件(逆行豁免 vs 火星豁免)',
    },
    'ayurdayaMethod': {
        'values': ('auto', 'pindayu', 'nisargayu', 'amsayu'),
        'default': 'auto',
        'affects': '寿命法选定:auto=按 Lagna/日/月最强自动;或手动指定一法',
    },
    # ── 年盘(Varshaphala)───────────────────────────────────────
    'annualNakYearBasis': {
        'values': ('classical360', 'julian365_25'),
        'default': 'classical360',        # 现状:Mudda 120 年压 360 日(×3)
        'affects': 'Mudda/年 Yogini 的年基(360 古典 vs 365.25)',
    },
    'patyayiniYearConstant': {
        'values': ('gregorian365_2425', 'd365', 'sidereal365_2563', 'savana360'),
        'default': 'gregorian365_2425',   # 现状:365.2425
        'doc_default': 'd365',            # 文档默认:365
        'affects': 'Patyayini 年常量(总日数)',
    },
    'patyayiniLagnaPoint': {
        'values': ('degree', 'cusp'),
        'default': 'degree',              # 现状:Lagna 取座内实际度数为 krisamsa
        'doc_default': 'cusp',
        'affects': 'Patyayini 的 Lagna 取点(座内度数 vs 宫首 0°)',
    },
    'haddaScheme': {
        'values': ('egyptian', 'equal6'),
        'default': 'egyptian',            # 现状:埃及界(不等分)
        'affects': 'Hadda(界主)分法:埃及界 vs 等 6° 五分',
    },
    # ── 新增座运变体 ────────────────────────────────────────────
    'varnadaPeriodRule': {
        'values': ('count_to_lord', 'equal_nine'),
        'default': 'count_to_lord',
        'affects': 'Varnada 大运期长:数到座主(Chara 式) vs 恒 9 年(两本分歧)',
    },
}

VARIANT_KEYS = tuple(sorted(VARIANT_SPECS.keys()))

DEFAULT_VARIANTS = {k: spec['default'] for k, spec in VARIANT_SPECS.items()}


def resolve_variants(raw):
    """规范化流派开关:dict / JSON 字符串 / None 均可;未知键忽略、未知值回退默认。

    返回全键 dict(每键必有值)。绝不抛错——解析失败即全默认(与今日行为字节一致)。
    """
    out = dict(DEFAULT_VARIANTS)
    if raw is None:
        return out
    data = raw
    if isinstance(raw, (str, bytes)):
        try:
            data = json.loads(raw)
        except (ValueError, TypeError):
            return out
    if not isinstance(data, dict):
        return out
    for k, v in data.items():
        spec = VARIANT_SPECS.get(k)
        if spec is None:
            continue
        sv = str(v) if v is not None else None
        if sv in spec['values']:
            out[k] = sv
    return out


def is_default_variants(variants):
    """是否全默认(缓存零 churn 判据:全默认 → 请求不带 dashaVariants 键)。"""
    if not variants:
        return True
    return all(variants.get(k, spec['default']) == spec['default']
               for k, spec in VARIANT_SPECS.items())


def non_default_variants(variants):
    """仅非默认键的子集(下发/缓存键用;空 dict = 全默认)。"""
    if not variants:
        return {}
    return {k: v for k, v in variants.items()
            if k in VARIANT_SPECS and v != VARIANT_SPECS[k]['default']}
