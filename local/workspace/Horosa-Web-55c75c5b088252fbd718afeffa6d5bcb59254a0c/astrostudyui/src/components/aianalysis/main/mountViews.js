// AI 分析页 · 挂载:连接状态徽标、技法设置的打开 / 应用 / 存为默认 / 重置、导出设置落盘、行星信息开关、技法设置抽屉、挂载抽屉、上下文横幅
// 从 AIAnalysisMain.js 按职责拆出的 AIAnalysisMain 内层函数 / Hook 回调体 / 渲染树片段:原文原样,用到的局部名字经第一个参数显式传入;
// 门面原位置换成调用它的包装 / 箭头 / 表达式,调用那一刻取值传入(与闭包读到的是同一份)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { parseDateTimeMs } from '../../../utils/dateTimeParse';
import React from 'react';
import { Collapse, Tag, Tooltip, message } from 'antd';
import styles from '../AIAnalysisMain.less';
import XQIcon from '../../xq-icons';
import TechniqueSettingsFields from '../TechniqueSettingsFields';
import SectionChecklist from '../SectionChecklist';
import { XQButton as Button, XQCheckItem, XQCheckList, XQDrawer as Drawer, XQInput as Input, XQSectionTitle, XQSelect as Select, XQToolbar, XQEmpty } from '../../xq-ui';
import GeoCoordModal from '../../amap/GeoCoordModal';
import * as AstroHelper from '../../astro/AstroHelper';
import { dstAwareZoneAt } from '../../../utils/timezone';
import { SubjectFactsCardExtra } from '../chat';
import { AI_CONTEXT_MAX_CHARS, listAnalysisTechniqueOptions, snapshotSourceMismatch } from '../../../utils/aiAnalysisContext';
import { getTechniqueSettingsSchema, getTechniqueSettingsCurrentDefaults, isSectionsOnlyTechnique, hasMountSettingsFields, pruneOptionsToNonDefault, composeTechniqueDraft, adjustedMountBaseline, effectiveMountBaseline, saveMountTechniqueDefaults, getMountTechniqueDefault } from '../../../utils/techniqueMountSettings';
import { loadAIExportSettings, saveAIExportSettings, getSectionGroupsForTechnique } from '../../../utils/aiExport';
import { parseModelSelection } from '../../../utils/aiAnalysisProviders';
import { getContextStatusMeta, getContextTypeLabel, buildContextSignatureText, NATAL_SOURCE_ID, gpsToLonLatStrings, formatTimepointNow } from './sourceContext';
import { matchesUserQuery } from '../../../utils/scriptMode';
import { datePartOf } from '../../../utils/dateStrSafe';
import { QUICK_MOUNT_EXCLUDED_KEYS } from './pageConst';
const { TextArea } = Input;

export function renderConnChip({ activeProviderProfile, connState, modelSelection, openProviderEditor, testProfileChat }){
	const profile = activeProviderProfile;
	// C: chip 只反映「当前选择」下的测试结果(connState.key === 当前 modelSelection 才算数),
	// 切模型/接口后 key 失配 → 回灰「点击测试」;不读 profile.healthStatus(那是历史诊断,会残留过期的绿)。
	const tested = (connState.key && connState.key === modelSelection) ? connState.status : 'idle';
	let toneClass = styles.connIdle;
	let text = '点击测试';
	if(!profile){
		toneClass = styles.connIdle;
		text = '未配置接口';
	}else if(tested === 'testing'){
		toneClass = styles.connIdle;
		text = '测试中…';
	}else if(tested === 'healthy'){
		toneClass = styles.connOk;
		text = connState.latencyMs ? `测试成功 · ${connState.latencyMs}ms` : '测试成功';
	}else if(tested === 'error'){
		toneClass = styles.connErr;
		text = '测试失败';
	}
	const tip = !profile ? '尚未配置接口，点击去配置' :
		tested === 'error' && connState.error ? (
			<div style={{ maxWidth: 320 }}>
				<div style={{ fontWeight: 600, marginBottom: 4 }}>{connState.error.hint}</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', wordBreak: 'break-word' }}>{connState.error.raw || connState.error.message}</div>
				{connState.latencyMs ? <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>耗时 {connState.latencyMs}ms</div> : null}
			</div>
		) : (tested === 'healthy' && connState.latencyMs ? `连通性测试 · ${connState.latencyMs}ms` : '点击测试与该接口的连通性');
	return (
		<Tooltip title={tip} mouseEnterDelay={0.3} placement="bottom">
			<button
				type="button"
				className={`${styles.connChip} ${toneClass}`}
				onClick={()=>{
					if(!profile){ openProviderEditor(null); return; }
					testProfileChat(profile, parseModelSelection(modelSelection).model);
				}}
			>
				<span className={styles.connDot} />
				<span>{text}</span>
			</button>
		</Tooltip>
	);
}

export function openTechniqueSettings({
	activeSource, techniqueOptionOverrides, setTechniqueSettingsKey, setTechniqueSettingsDraft,
}, key){
	const k = `${key || ''}`;
	if(!k){
		return;
	}
	// 🔴 草稿初值 = schema 默认 叠加 **盘现状**(record 实值) 叠加 当前生效覆盖。
	// 此前只叠 schema 默认 → 抽屉打开恒显 schema 想象值(整宫制)而非盘实值(Alcabitus),
	// 用户「确认整宫制」=零变更=静默无操作(实锤二次误导)。现在:打开即见真实现状,
	// 改动=与盘的真实差异(prune 同锚盘现状)。
	const base = getTechniqueSettingsCurrentDefaults(k);   // 底稿 = 现值缺省(全局改过的键按全局现值),不是 schema 出厂值
	const chartBaseline = effectiveMountBaseline(k, activeSource && activeSource.record ? activeSource.record : null);
	const session = techniqueOptionOverrides[k];
	const eff = (session && typeof session === 'object') ? session : getMountTechniqueDefault(k);
	setTechniqueSettingsKey(k);
	// 覆盖里换了流派:先按联动规则在底稿上换派(与抽屉里亲手换同一条路),再叠覆盖 —— 应用 → 重开 → 再应用结果不变
	setTechniqueSettingsDraft(composeTechniqueDraft(k, { ...base, ...chartBaseline }, eff || {}));
}

// 「应用并重算」：把草稿(去默认后)写进会话覆盖 → 触发该技法重算(状态转「已按盘重算」)。
export function applyTechniqueSettings({
	techniqueSettingsKey, techniqueSettingsDraft, activeSource, setTechniqueOptionOverrides,
}){
	const k = techniqueSettingsKey;
	if(!k){
		return;
	}
	// prune 锚盘现状:与该盘真实值不同的项才算覆盖(整宫制 vs 盘存 Alcabitus=真覆盖)。
	const pruned = pruneOptionsToNonDefault(k, techniqueSettingsDraft, effectiveMountBaseline(k, activeSource && activeSource.record ? activeSource.record : null));
	setTechniqueOptionOverrides((prev)=>{
		const next = { ...prev };
		if(pruned && Object.keys(pruned).length){
			next[k] = pruned;
		}else{
			delete next[k];
		}
		return next;
	});
	message.success(Object.keys(pruned).length ? '已应用并按新设置重算该技法' : '已恢复该技法默认设置');
}

// 「设为同类默认」：持久到 mount defaults（以后该技法默认沿用）。同时清掉会话覆盖（避免双写歧义）。
export function saveTechniqueAsDefault({
	techniqueSettingsKey, techniqueSettingsDraft, activeSource, setTechniqueOptionOverrides,
	setMountSettingsNonce,
}){
	const k = techniqueSettingsKey;
	if(!k){
		return;
	}
	// 🔴 三参同锚盘现状:草稿自带盘现状全量后,二参(schema 默认锚)会把盘私值
	// 全判「覆盖」写进跨盘持久模板 —— 什么都不改点「设为同类默认」= 把这张盘的黄道/岁差
	// 强加给以后所有盘。同 apply 锚:只存用户本次显式改动。
	const pruned = pruneOptionsToNonDefault(k, techniqueSettingsDraft, effectiveMountBaseline(k, activeSource && activeSource.record ? activeSource.record : null));
	saveMountTechniqueDefaults(k, pruned);
	setTechniqueOptionOverrides((prev)=>{
		const next = { ...prev };
		delete next[k];
		return next;
	});
	setMountSettingsNonce((n)=>n + 1);
	message.success(Object.keys(pruned).length ? '已设为该技法的同类默认（持久）' : '已清除该技法的同类默认');
}

// 「恢复默认」：删会话覆盖 + 删同类默认 + 草稿回默认 → 回现状。
export function resetTechniqueSettings({
	techniqueSettingsKey, setTechniqueOptionOverrides, setTechniqueSettingsDraft, activeSource,
	setMountSettingsNonce,
}){
	const k = techniqueSettingsKey;
	if(!k){
		return;
	}
	saveMountTechniqueDefaults(k, {});
	setTechniqueOptionOverrides((prev)=>{
		const next = { ...prev };
		delete next[k];
		return next;
	});
	// 清除覆盖后的真实生效值 = 盘现状(非 schema 想象值):草稿回落
	// defaults+盘现状,否则此刻再点「应用」会把 schema 默认误写成真覆盖。
	setTechniqueSettingsDraft({
		...getTechniqueSettingsCurrentDefaults(k),
		...effectiveMountBaseline(k, activeSource && activeSource.record ? activeSource.record : null),
	});
	setMountSettingsNonce((n)=>n + 1);
	message.success('已恢复该技法默认（设置 + 同类默认均清除）');
}

export function persistAIExportSettings({ setMountSettingsNonce }, mutator){
	const current = loadAIExportSettings();
	const next = mutator({
		...current,
		sections: { ...(current.sections || {}) },
		planetInfo: { ...(current.planetInfo || {}) },
		astroMeaning: { ...(current.astroMeaning || {}) },
	});
	saveAIExportSettings(next);
	// 段过滤是「显式自定义才生效」→ 改完即触发挂载重新 fetch 刷新卡片。
	setMountSettingsNonce((n)=>n + 1);
}

export function togglePlanetInfoForTech({ persistAIExportSettings }, key, field, checked){
	persistAIExportSettings((draft)=>{
		const current = draft.planetInfo[key] || { showHouse: 1, showRuler: 1 };
		draft.planetInfo[key] = {
			showHouse: current.showHouse === 1 || current.showHouse === true ? 1 : 0,
			showRuler: current.showRuler === 1 || current.showRuler === true ? 1 : 0,
		};
		draft.planetInfo[key][field] = checked ? 1 : 0;
		return draft;
	});
}

export function renderTechniqueSettingsDrawer({
	techniqueSettingsKey, techniqueLabelMap, getTechExportMeta, getEffectiveSectionSelected,
	activeSource, techniqueSettingsDraft, closeTechniqueSettings, techniqueDraftContext,
	updateTechniqueDraftField, applyTechniqueSettings, saveTechniqueAsDefault, resetTechniqueSettings,
	toggleSectionForTech, selectAllSectionsForTech, clearSectionsForTech, resetSectionsForTech,
	togglePlanetInfoForTech, toggleAstroMeaningForTech,
}){
	const key = techniqueSettingsKey;
	const open = !!key;
	const label = key ? (techniqueLabelMap.get(key) || key) : '';
	const schema = key ? getTechniqueSettingsSchema(key) : null;
	const exportMeta = key ? getTechExportMeta(key) : null;
	const sectionOptions = exportMeta ? (exportMeta.options || []) : [];
	const selectedSections = key ? getEffectiveSectionSelected(key) : [];
	const planetInfo = exportMeta ? exportMeta.planetInfo : null;
	const astroMeaning = exportMeta ? exportMeta.astroMeaning : null;
	const sectionsOnly = key ? isSectionsOnlyTechnique(key) : false;
	const hasFields = key ? hasMountSettingsFields(key) : false;
	// 字段渲染(含 group 分组/条件揭示)已抽到共用件 <TechniqueSettingsFields/>(各设置界面同源)。
	// 徽记计数与 apply/save 同锚盘现状:二参(schema 默认锚)时草稿含盘现状
	// 会双向误导——盘存非默认什么都不动显「已自定义」、拨到 schema 默认显「全默认」而应用落真覆盖。
	const drawerBaseline = key ? effectiveMountBaseline(key, activeSource && activeSource.record ? activeSource.record : null) : null;
	const pruned = key ? pruneOptionsToNonDefault(key, techniqueSettingsDraft, drawerBaseline) : {};
	const customizedCount = Object.keys(pruned).length;
	return (
		<Drawer
			title={label ? `${label} · 挂载设置` : '挂载设置'}
			placement="right"
			width={460}
			open={open}
			onClose={closeTechniqueSettings}
			className={styles.techSettingsDrawer}
		>
			{key ? (
				<div className={styles.techSettingsBody}>
					{/* 分区一：该技法设置（A/B/C 类可调；sectionsOnly / 空 schema 显示只读说明） */}
					<XQSectionTitle>该技法设置</XQSectionTitle>
					{sectionsOnly || !schema ? (
						<div className={styles.techSettingsReadonly}>
							{schema && schema.reason ? schema.reason : '该技法快照按已存卦象/盘面生成，挂载仅可调纳入内容、不支持重算设置。'}
						</div>
					) : !hasFields ? (
						<div className={styles.techSettingsReadonly}>
							{schema.emptyHint || '该技法按本命盘默认参数生成，挂载暂只支持内容勾选。'}
						</div>
					) : (
						<div className={styles.techSettingsFields}>
							<TechniqueSettingsFields
								schemaKey={key}
								draft={techniqueDraftContext ? { ...techniqueSettingsDraft, ...techniqueDraftContext } : techniqueSettingsDraft}
								baseline={adjustedMountBaseline(key, techniqueSettingsDraft, drawerBaseline)}
								record={activeSource && activeSource.record ? activeSource.record : null}
								onChange={updateTechniqueDraftField}
							/>
							<XQToolbar compact className={styles.techSettingsActions}>
								<Button size="small" type="primary" onClick={applyTechniqueSettings}>应用并重算</Button>
								<Button size="small" onClick={saveTechniqueAsDefault}>设为同类默认</Button>
								<Button size="small" onClick={resetTechniqueSettings}>恢复默认</Button>
							</XQToolbar>
							<div className={styles.techSettingsHint}>
								{customizedCount
									? `已自定义 ${customizedCount} 项；「应用并重算」在本会话内对该技法生效（换案例仍沿用），「设为同类默认」以后该技法默认沿用。`   /* 文案如实:覆盖随会话,不随案例清 */
									: '全部为默认值（与现状一致）；改动后点「应用并重算」让卡片快照刷新。'}
							</div>
						</div>
					)}

					{/* 分区二：纳入内容（段勾选，写同一份 AI导出设置 → 四同步） */}
					<XQSectionTitle>纳入内容</XQSectionTitle>
					{sectionOptions.length ? (
						<React.Fragment>
							<SectionChecklist
								options={sectionOptions}
								selected={selectedSections}
								groups={getSectionGroupsForTechnique(key, sectionOptions)}
								onToggle={(sec)=>toggleSectionForTech(key, sec)}
								onSelectAll={()=>selectAllSectionsForTech(key, sectionOptions)}
								onClear={()=>clearSectionsForTech(key)}
								onReset={()=>resetSectionsForTech(key)}
								toolbarClassName={styles.techSettingsActions}
								checklistClassName={styles.techSectionChecks}
								groupTitleClassName={styles.techSettingGroupTitle}
							/>
							{exportMeta && exportMeta.supportsPlanetInfo && planetInfo ? (
								<div>
									<div className={styles.techSettingGroupTitle}>星曜后天信息</div>
									<XQCheckList columns={2}>
										<XQCheckItem compact checked={planetInfo.showHouse === 1} onClick={()=>togglePlanetInfoForTech(key, 'showHouse', planetInfo.showHouse !== 1)}>显示星曜宫位</XQCheckItem>
										<XQCheckItem compact checked={planetInfo.showRuler === 1} onClick={()=>togglePlanetInfoForTech(key, 'showRuler', planetInfo.showRuler !== 1)}>显示星曜主宰宫</XQCheckItem>
									</XQCheckList>
								</div>
							) : null}
							{exportMeta && exportMeta.supportsAstroMeaning && astroMeaning ? (
								<div>
									<div className={styles.techSettingGroupTitle}>{exportMeta.astroMeaningTitle || '注释（仅AI导出）：'}</div>
									<XQCheckItem compact checked={astroMeaning.enabled === 1} onClick={()=>toggleAstroMeaningForTech(key, astroMeaning.enabled !== 1)}>
										{exportMeta.astroMeaningCheckbox || '在对应分段输出释义'}
									</XQCheckItem>
								</div>
							) : null}
							<div className={styles.techSettingsHint}>内容勾选与「AI导出设置」同源；取消某段 → 该技法挂载卡片与导出均去掉该段（默认全选＝现状）。</div>
						</React.Fragment>
					) : (
						<div className={styles.techSettingsReadonly}>该技法暂未检测到可选分段；请先在该技法完成一次排盘后再设置。</div>
					)}
				</div>
			) : null}
		</Drawer>
	);
}

export function renderMountDrawer({
	mountDrawerOpen, setMountDrawerOpen, activeSource, selectedSourceId, natalDraft, timepointDraft,
	setNatalDraft, setTimepointDraft, setSelectedTechniqueKeys, handleSaveQuickDraftAsSource,
	activeTechniqueKeys, groupedTechniqueOptions, partnerSource, partnerOptions, setPartnerSourceId,
	referenceIds, setReferenceIds, referenceOptions, sessionSystemPrompt, setSessionSystemPrompt,
	lockedContextItems, contextActiveKeys, setContextActiveKeys, effectiveTechniqueOptions,
	promptClipStats, openTechniqueSettings,
}){
	return (
		<Drawer
			title="挂载设置"
			placement="right"
			width={560}
			open={mountDrawerOpen}
			onClose={()=>setMountDrawerOpen(false)}
			className={styles.mountDrawer}
		>
			{activeSource && (activeSource.sourceType === 'timepoint' || selectedSourceId === NATAL_SOURCE_ID) ? (() => {
				const isNatal = selectedSourceId === NATAL_SOURCE_ID;
				const draft = isNatal ? natalDraft : timepointDraft;
				const setDraft = isNatal ? setNatalDraft : setTimepointDraft;
				const timeKey = isNatal ? 'birth' : 'divTime';
				return (
					<div className={styles.mountSection}>
						<div className={styles.qcForm}>
								<div className={styles.qcHead}>
									<XQIcon name={isNatal ? 'ai' : 'calendar'} />
									<span>{isNatal ? '命盘时间 · 即时起命盘' : '起课时间 · 即时起式盘'}</span>
								</div>
								<div className={styles.qcRow}>
									<label className={styles.qcLabel}>时间</label>
									<Input className={styles.qcInput} value={draft[timeKey]} placeholder="YYYY-MM-DD HH:mm:ss" onChange={(e)=>setDraft((prev)=>({ ...prev, [timeKey]: e.target.value }))} />
									<Button size="small" className={styles.qcNow} onClick={()=>setDraft((prev)=>({ ...prev, [timeKey]: formatTimepointNow() }))}>此刻</Button>
								</div>
								<div className={styles.qcRow}>
									<label className={styles.qcLabel}>地点</label>
									<div className={styles.qcLocWrap}>
										<GeoCoordModal lat={draft.gpsLat} lng={draft.gpsLon} date={draft[timeKey]} onOk={(geo)=>{
											const ll = gpsToLonLatStrings(geo.gpsLat, geo.gpsLng);
											let zone = (geo.zone !== undefined && geo.zone !== null) ? geo.zone : null;
											if(!zone){
												try{
													const ds = (typeof draft[timeKey] === 'string') ? datePartOf(draft[timeKey]) : null;
													const z = dstAwareZoneAt(geo.gpsLat, geo.gpsLng, ds);
													if(z && z.offset){ zone = z.offset; }
												}catch(e){ /* 保底用旧时区 */ }
											}
											setDraft((prev)=>({ ...prev, gpsLat: geo.gpsLat, gpsLon: geo.gpsLng, lat: ll.lat, lon: ll.lon, zone: zone || prev.zone }));
										}}>
											<Button size="small" className={styles.qcLocBtn}>📍 选择地点 · atlas</Button>
										</GeoCoordModal>
										<span className={styles.qcLocInfo}>{`${AstroHelper.formatLonDms(draft.gpsLon) || draft.lon} · ${AstroHelper.formatLatDms(draft.gpsLat) || draft.lat} · UTC${draft.zone}`}</span>
									</div>
								</div>
								<div className={styles.qcRow}>
									<label className={styles.qcLabel}>微调</label>
									<div className={styles.qcInline}>
										<Input addonBefore="经" value={draft.lon} onChange={(e)=>setDraft((prev)=>({ ...prev, lon: e.target.value }))} />
										<Input addonBefore="纬" value={draft.lat} onChange={(e)=>setDraft((prev)=>({ ...prev, lat: e.target.value }))} />
										<Input addonBefore="时区" value={draft.zone} onChange={(e)=>setDraft((prev)=>({ ...prev, zone: e.target.value }))} />
									</div>
								</div>
								<div className={styles.qcRow}>
									<label className={styles.qcLabel}>{isNatal ? '姓名' : '事由'}</label>
									<div className={styles.qcInline}>
										<Input value={draft.name} placeholder="可留空" onChange={(e)=>setDraft((prev)=>({ ...prev, name: e.target.value }))} />
										<Select value={draft.gender} style={{ minWidth: 92 }} onChange={(val)=>setDraft((prev)=>({ ...prev, gender: val }))}>
											<Select.Option value={1}>男</Select.Option>
											<Select.Option value={0}>女</Select.Option>
											<Select.Option value={-1}>未知</Select.Option>
										</Select>
									</div>
								</div>
								<div className={styles.qcActions}>
									{/* 一键挂载：含六爻(无存卦则按时间起卦,见 sixyao 时间起卦路径)；排除奇门遁甲(用户考量:奇门不随一键带入,需手动勾选)。
									    六爻不进 TIME_CASTABLE_DIVINATION(保已存事盘不被时间凭空补六爻的护栏),仅在此一键集 + sixyao。 */}
									{isNatal ? null : <Button size="small" type="primary" title="含六爻(无存卦则按时间起卦)、皇极经世、太玄、荆诀、五兆、神易数、小六壬、飞宫、小成图(时间卦)；奇门遁甲不随一键加入，需手动勾选" onClick={()=>setSelectedTechniqueKeys(listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).map((o)=>o.value).filter((k)=>QUICK_MOUNT_EXCLUDED_KEYS.indexOf(k) < 0))}>一键挂载全部式法</Button>}
									<Button size="small" onClick={handleSaveQuickDraftAsSource}>{isNatal ? '保存为命盘' : '保存为事盘'}</Button>
								</div>
								<div className={styles.qcHint}>{isNatal ? '默认设置即时起命盘（八字 / 紫微 / 星盘 / 各推运），可改时间·地点·时区；保存后进入案例列表复用。' : '统摄法 / 宿占 / 世俗盘 需手动起盘后存为事盘再挂载（凭时间起会得无意义默认值，不在白名单）；其余 卜卦 / 报数 / 起例 全部式法均可按起课时间即时起盘。'}</div>
							</div>
					</div>
				);
			})() : null}
			{activeSource ? (
				<div className={styles.mountSection}>
					<div className={styles.mountSectionLabel}>使用技法</div>
					<Select
						mode="multiple"
						allowClear
						value={activeTechniqueKeys}
						placeholder={`选择${activeSource.sourceType === 'chart' ? '命盘' : '事盘'}技法`}
						style={{ width: '100%' }}
						onChange={(vals)=>setSelectedTechniqueKeys(vals || [])}
					>
						{groupedTechniqueOptions.map((group)=>(
							<Select.OptGroup key={group.title} label={group.title}>
								{group.items.map((item)=>(
									<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
								))}
							</Select.OptGroup>
						))}
					</Select>
				</div>
			) : null}
			{activeSource && activeSource.sourceType === 'chart' ? (
				<div className={styles.mountSection} data-pair-mount-section="1">
					<div className={styles.mountSectionLabel}>合盘对方（可选）</div>
					<Select
						showSearch
						allowClear
						value={partnerSource ? partnerSource.id : undefined}
						placeholder="选另一张命盘,两人一起挂载"
						style={{ width: '100%' }}
						filterOption={(input, option)=>{
							const hit = partnerOptions.find((item)=>item.value === option.value);
							return hit ? matchesUserQuery(hit.searchText, `${input || ''}`.trim()) : false;
						}}
						onChange={(val)=>setPartnerSourceId(val || '')}
					>
						{partnerOptions.map((item)=>(
							<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
						))}
					</Select>
					<div className={styles.qcHint}>选了对方后,上面勾选的每个技法都会挂两人的盘面(分开标注本人 / 对方);也可以在输入框用 /合盘 对方名字,或 @ 两张命盘。</div>
				</div>
			) : null}
			<div className={styles.mountSection}>
				<div className={styles.mountSectionLabel}>参考组合 / 资料（多选）</div>
				<Select
					mode="multiple"
					showSearch
					allowClear
					value={referenceIds}
					placeholder="选择固定资料、组合"
					style={{ width: '100%' }}
					onChange={(vals)=>setReferenceIds(vals || [])}
				>
					{referenceOptions.map((item)=>(
						<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
					))}
				</Select>
			</div>
			<div className={styles.mountSection}>
				<div className={styles.mountSectionLabel}>本轮系统提示</div>
				<TextArea
					value={sessionSystemPrompt}
					rows={3}
					placeholder="可留空；也可由组合一键带入"
					onChange={(e)=>setSessionSystemPrompt(e.target.value)}
				/>
			</div>
			<div className={styles.mountSection}>
				<div className={styles.mountSectionLabel}>本轮挂载上下文（预览）</div>
				{lockedContextItems.length === 0 ? (
					<XQEmpty description="还没有挂载任何前提" />
				) : (
					<Collapse
						activeKey={contextActiveKeys}
						onChange={(ks)=>setContextActiveKeys(Array.isArray(ks) ? ks : [ks])}
						className={styles.contextCollapse}
					>
						{lockedContextItems.map((item)=>{
							const statusMeta = getContextStatusMeta(item.status);
							const signature = buildContextSignatureText(item.meta);
							const techKey = item.type === 'technique' && typeof item.key === 'string' && item.key.indexOf('technique:') === 0
								? item.key.slice('technique:'.length).replace(/@partner$/, '')   // [双盘挂载] 对方卡与本人同一份技法设置
								: '';
							const techCustomized = !!(techKey && effectiveTechniqueOptions[techKey] && Object.keys(effectiveTechniqueOptions[techKey]).length);
							// [挂载预算] 最近一次发送的裁剪账本按层 key 对齐（案例前提层 key 在发送层里是 'source'）。
							const clipStatKey = typeof item.key === 'string' && item.key.indexOf('source:') === 0
								? 'source'
								: (typeof item.key === 'string' && item.key.indexOf('partner-source:') === 0 ? 'partner-source' : item.key);
							const clipStat = promptClipStats && promptClipStats.byKey ? promptClipStats.byKey[clipStatKey] : null;
							return (
								<Collapse.Panel
									key={item.key}
									style={item.muted ? { opacity: 0.72 } : undefined}
									extra={techKey ? (
										<Tooltip title="该技法挂载设置（纳入内容 / 排盘起卦选项）">
											<Button
												size="small"
												type="text"
												className={styles.contextGearBtn}
												icon={<XQIcon name="settings" />}
												onClick={(e)=>{ e.stopPropagation(); openTechniqueSettings(techKey); }}
											>
												设置{techCustomized ? ' ·已改' : ''}
											</Button>
										</Tooltip>
									) : (item.subjectFacts ? <SubjectFactsCardExtra item={item} /> : null)}
									header={(
										<div className={styles.contextPanelHeader}>
											<span className={styles.contextPanelTitle}>{item.title}</span>
											<span className={styles.contextPanelTags}>
												<Tag>{getContextTypeLabel(item)}</Tag>
												<Tag color={statusMeta.color}>{statusMeta.text}</Tag>
												{techCustomized ? <Tag color="purple">已自定义</Tag> : null}
												{item.type === 'technique' && item.content && snapshotSourceMismatch(item.meta, (item.partner ? (partnerSource && partnerSource.record) : (activeSource && activeSource.record)) || null) === 'mismatch' ? (
													<Tooltip title="快照的起盘时空与当前案例不一致(可能是旧盘/他盘残留)。不会自动重算;到该技法页面按本案例重新排盘,或在「设置」里应用重算即可刷新。">
														<Tag color="gold">快照或非本盘</Tag>
													</Tooltip>
												) : null}
												{clipStat && clipStat.dropped ? (
													<Tooltip title="最近一次发送时上下文超出预算，该层整层未纳入（已在提示词里注明「未纳入」，模型不会当它不存在）。可在「进阶 → 对话上下文策略 → 挂载字数预算」里调大，或减少挂载技法、在「设置」里精简纳入内容。">
														<Tag color="red">超预算未纳入</Tag>
													</Tooltip>
												) : null}
												{clipStat && !clipStat.dropped && clipStat.clipped ? (
													<Tooltip title="最近一次发送时上下文超出预算，该层按段边界公平裁剪后纳入（结尾注明了略去哪几段）。想要全文，可在「进阶 → 对话上下文策略 → 挂载字数预算」里调大。">
														<Tag color="orange">已裁剪 {clipStat.raw}→{clipStat.kept}字</Tag>
													</Tooltip>
												) : null}
											</span>
											{signature ? <span className={styles.contextPanelSig}>{signature}</span> : null}
										</div>
									)}
								>
									{item.content
										? <div className={styles.contextBody}>{item.content}</div>
										: <div className={styles.contextEmptyHint}>{item.emptyHint || '暂无内容'}</div>}
								</Collapse.Panel>
							);
						})}
					</Collapse>
				)}
			</div>
		</Drawer>
	);
}

// 挂载状态条：紧跟在 composer 上方显示，让用户随时看到「当前要发什么」。
export function renderContextBanner({
	activeTechniqueKeys, referenceIds, activeSource, focusSourceSelect, partnerSource, promptClipStats,
	setMountDrawerOpen,
}){
	const tCnt = activeTechniqueKeys ? activeTechniqueKeys.length : 0;
	const refCnt = referenceIds ? referenceIds.length : 0;
	if(!activeSource){
		return (
			<div className={styles.contextBanner + ' ' + styles.contextBannerEmpty}>
				未挂载案例 · <a onClick={focusSourceSelect}>选择案例</a>{/* 直接开顶栏那个下拉,不再打开没有案例选择器的挂载抽屉 */}
			</div>
		);
	}
	return (
		<div className={styles.contextBanner}>
			<span className={styles.contextBannerLabel}>当前挂载：</span>
			{/* 存档时刻显性化:事盘挂载 = 保存时刻的存档真值,技法页重新起课不改存档。
			    在技法页改信息重起课后点「刷新案例」仍是旧数据,是因为案例没重新保存;
			    banner 常驻「存 MM-DD HH:mm」+ tooltip 讲清这层语义。 */}
			<span
				className={styles.contextBannerItem}
				title={`${activeSource.title}${activeSource.sourceType === 'case' ? `\n挂载内容 = 该案例存档(保存时刻的盘面数据)。\n在技法页改动信息/重新起课后,需在技法页重新保存案例,再回此处点「刷新案例」才会更新。` : ''}`}
			>{activeSource.sourceType === 'chart' ? '📊' : '📋'} {activeSource.title}{(() => {
				if(activeSource.sourceType !== 'case' || !activeSource.updatedAt){
					return null;
				}
				const ts = parseDateTimeMs(activeSource.updatedAt);
				if(!ts){
					return null;
				}
				const d = new Date(parseDateTimeMs(ts));
				const p2 = (n)=>`${n < 10 ? '0' : ''}${n}`;
				return <span className={styles.contextBannerSavedAt}>（存 {p2(d.getMonth() + 1)}-{p2(d.getDate())} {p2(d.getHours())}:{p2(d.getMinutes())}）</span>;
			})()}</span>
			{partnerSource ? <span className={styles.contextBannerItem} title="合盘对方:所选技法同时挂两人的盘面">👥 对方 {partnerSource.title}</span> : null}
			{tCnt > 0 ? <span className={styles.contextBannerItem}>🧮 {tCnt} 技法</span> : null}
			{refCnt > 0 ? <span className={styles.contextBannerItem}>📚 {refCnt} 资料/组合</span> : null}
			{promptClipStats && promptClipStats.stats ? (
				<span
					className={styles.contextBannerItem}
					title={`最近一次发送给模型的上下文字数 / 预算上限（预算按当前模型的上下文窗口实算；可在「进阶 → 对话上下文策略 → 挂载字数预算」里固定）${promptClipStats.stats.droppedCount ? `；有 ${promptClipStats.stats.droppedCount} 层超预算未纳入（见挂载预览）` : ''}`}
				>
					上下文约 {promptClipStats.stats.totalKept}/{promptClipStats.stats.maxChars || AI_CONTEXT_MAX_CHARS} 字
				</span>
			) : null}
			<a className={styles.contextBannerEdit} onClick={()=>setMountDrawerOpen(true)}>编辑</a>
		</div>
	);
}
