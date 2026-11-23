// AI 挂载·每技法「设置」schema。集中定义「技法 → 可调项 → 默认值 → 如何套用重算」。
//
// 设计铁律（守「默认即现状」）：
//  - 每个 field 的 default 必须 === 该技法组件/builder 里的现状默认（DunJiaCalc DEFAULT_OPTIONS /
//    buildFieldObject aiAnalysisContext / TaiYiMain state.options 等）。不调任何项 → 永不进 merge 路径 → 输出逐字不变。
//  - merge* 函数返回副本，绝不改原 record/payload。
//  - applyLocalStorageSettings 仅在用户显式设置时写 key；未设置 → 不碰全局默认。
//
// kind 分类（A/B/C/D 类）：
//  - 'record'        → A 类：把 fields 写进重算用 record.*（buildFieldObject 读 record，强制 regenerate 生效）。
//  - 'payload'       → B 类：把 options 写进重算用 payload（事盘 regenerate 已读 payload.options / payload.<field>）。
//                      optionsPath:'options' = 写 payload.options.<name>；optionsPath:'' = 写 payload.<name>（顶层）。
//  - 'localStorage'  → C 类：把值写进全局 localStorage（builder 自读），如七政四余命度/罗计。
//  - 'sectionsOnly'  → D 类：不可重算（六爻/统摄/世俗盘=确定性已存结果），只暴露「纳入内容」勾选 + 只读说明。
//
// field 形状：{ name, label, type:'select|switch|number|text', options?, default, group?, storageKey?, normalize? }
//  - type:'switch' 的值用 0/1（与 buildFieldObject 既有写法一致）。
//
// 本文件是门面(对外导入路径与导出不变),实现按职责拆在 techniqueMountSettings/ 下,依赖只朝前一层:
//   fieldAtoms(共用小件)→ divinationFields / astroFields(卜类 / 星类字段组)→ schema(总表 + 登记后补丁)
//   → baseline(取 schema / 现状默认 / 生效基线)→ draft(下拉 / 可见性 / 草稿 / 裁剪)→ persist(存取与套用)。
// 新技法:字段组写进对应的 *Fields,登记进 schema;读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。

export { recordIsNorthern } from './techniqueMountSettings/fieldAtoms';
export { HORARY_JUDGE_EMPTY, flattenLiuyaoStored, flattenTaiyiSchoolStored, flattenOptionsStored, mountContextLabel, flattenHoraryStored, flattenElectionStored } from './techniqueMountSettings/divinationFields';
export { indiaSchoolPresetDraft, PD_ASPECT_CHOICES, germanySchoolPresetDraft } from './techniqueMountSettings/astroFields';
export { flattenTarotStored, TECHNIQUE_SETTINGS_SCHEMA, DIRECTION_PAGE_BOUND_FIELDS } from './techniqueMountSettings/schema';
export { fillPageBoundDefaults, getTechniqueSettingsSchema, isSectionsOnlyTechnique, hasMountSettingsFields, getTechniqueSettingsDefaults, getTechniqueSettingsCurrentDefaults, fieldCurrentDefault, payloadSegmentOf, payloadBaselineSegment, localStorageMountBaseline, sharedFlatRecordKeys, isForeignFlatValue, scrubForeignFlatValues, effectiveMountBaseline, mountContextOf } from './techniqueMountSettings/baseline';
export { MOUNT_OPTION_UNSET, MOUNT_OPTION_BLANK, mountFieldOptions, fieldBlankFollowsBaseline, isMountFieldVisible, applyTechniqueDraftChange, composeTechniqueDraft, recordHandEditedOption, adjustedMountBaseline, pruneOptionsToNonDefault, sanitizeOptionsToSchema } from './techniqueMountSettings/draft';
export { MOUNT_TECHNIQUE_DEFAULTS_KEY, MOUNT_TECHNIQUE_DEFAULTS_VERSION, loadMountTechniqueDefaults, getMountTechniqueDefault, saveMountTechniqueDefaults, mergeOptionsIntoRecord, mergeOptionsIntoPayload, localStorageOverrideMap, applyLocalStorageSettings, snapshotLocalStorageSettings, restoreLocalStorageSettings, getMountableTechniqueAuditEntry, resolveEffectiveTechniqueOptions } from './techniqueMountSettings/persist';
