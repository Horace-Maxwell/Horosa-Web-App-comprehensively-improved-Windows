import React from 'react';
import { newChartSeedValue, recordNewChartSeeds, subscribeNewChartSeeds } from '../../utils/newChartSeeds';
import { Avatar, Dropdown, message, Tooltip } from 'antd';
import blogo from '../../assets/blogo.jpg';
import appIcon from '../../assets/appicon.png';
import {
	getAppearanceLabel,
	getNextAppearanceMode,
	normalizeAppearanceMode,
	LIGHT_FLAVOR_CLASSIC,
	LIGHT_FLAVOR_PAPER,
	applyLightFlavorToDocument,
	getLightFlavorLabel,
	getStoredLightFlavor,
} from '../../utils/appearance';
import { isDesktopBridgeAvailable as hasUpdateBridge, appVersionLocal } from '../../utils/aiAnalysisDesktop';
import { getTechniqueHelpDoc } from '../help/techniqueHelpRegistry';
import {
	runAIExport,
	loadAIExportSettings,
	saveAIExportSettings,
	listAIExportTechniqueSettings,
	listAIExportTechniqueSettingGroups,
	getSectionGroupsForTechnique,
	getCurrentAIExportContext,
	getAIExportEffectiveSectionsForTechnique,
	AI_EXPORT_SETTINGS_VERSION,
} from '../../utils/aiExport';
import {
	XQButton,
	XQCheckItem,
	XQCheckList,
	XQIconButton,
	XQModal,
	XQSectionTitle,
	XQSegmented,
	XQSelect,
	XQToolbar, XQInputNumber, } from '../xq-ui';
import XQIcon from '../xq-icons';
import { normalizeDayBoundary, DAY_BOUNDARY_AFTER23, DAY_BOUNDARY_AFTER24, normalizeLateZiHourMode, LATE_ZI_HOUR_NEXT_DAY, LATE_ZI_HOUR_TODAY, lateZiHourModeToBit } from '../../utils/dayBoundary';
import { normalizeZeriSnapshotMaxRows, normalizeZeriSnapshotExplainRows, ZERI_SNAPSHOT_MAX_ROWS_MIN, ZERI_SNAPSHOT_MAX_ROWS_MAX, ZERI_SNAPSHOT_EXPLAIN_ROWS_MIN, ZERI_SNAPSHOT_EXPLAIN_ROWS_MAX } from '../../utils/zeriSnapshotPrefs';
import { openExternalUrl, hasTauriInvoke, invokeDesktopCommand } from '../../utils/aiAnalysisDesktop';
import styles from './PageHeader.less';
import { getLayoutViewportWidth } from '../../utils/shellZoom';

// Windows 发行版:「关于」内的法律文档与官方下载渠道指向本平台仓库(windows-adaptations #23)。
const HOROSA_OFFICIAL_REPO = 'https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows';
const HOROSA_LEGAL_URL = `${HOROSA_OFFICIAL_REPO}/tree/main/docs/legal`;
const HOROSA_RELEASES_URL = `${HOROSA_OFFICIAL_REPO}/releases`;
function openHorosaLink(url){
	if(typeof window === 'undefined' || !url){ return; }
	// [Q-305/T-297] 桌面 webview 无新窗口处理,window.open 被吞 → 点了无反应;走壳 open_external_url_command(数据库页同款),失败回落 window.open。
	Promise.resolve().then(()=>openExternalUrl(url)).then((ok)=>{
		if(ok){ return; }
		try{ window.open(url, '_blank', 'noopener,noreferrer'); }catch(e){ /* noop */ }
	}).catch(()=>{ try{ window.open(url, '_blank', 'noopener,noreferrer'); }catch(e){ /* noop */ } });
}

const Option = XQSelect.Option;
const PAGE_LABELS = {
	astrochart: '占星',
	direction: '星运',
	bazi: '八字',
	ziwei: '紫微',
	guolao: '七政',
	indiachart: '印占',
	auxchart: '辅盘',
	relativechart: '合盘',
	shusuan: '数算',
	yanqin: '演禽',
	mingother: '其他',
	sanshiunited: '三式',
	liureng: '六壬',
	dunjia: '遁甲',
	guazhan: '六爻',
	taiyi: '太乙',
	jieqichart: '分至',
	fengshui: '风水',
	tarot: '塔罗',   // [Q-309/T-313] 塔罗升一级导航后漏登 → 页头曾显示「导航」、帮助标题「导航 · 操作手册」
	cnyibu: '其他',
	aianalysis: 'AI分析',
	calendar: '黄历',
	cntradition: '辅助',
	astroreader: '书籍阅读',
	liveplayer: '星阙直播',
	admintools: '管理工具',
	// 2026-07-16 补缺:以下五键此前漏登 → 页头模块名 fallback 显示「导航」(与 navigationPages 对齐)
	astrochart3D: '3D星盘',
	planetarium: '天文馆',
	xuanshi: '玄学史',
	astrodata: '数据库',
	zeri: '择日',
};

function PageHeader(props){
	const [aiSettingVisible, setAiSettingVisible] = React.useState(false);
	const [globalSettingVisible, setGlobalSettingVisible] = React.useState(false);
	const [astroHelpVisible, setAstroHelpVisible] = React.useState(false);
	const [aboutVisible, setAboutVisible] = React.useState(false);
	const [aboutVersion, setAboutVersion] = React.useState('');
	// [Q-417/T-380] useState 实参每次渲染都急切求值:listAIExportTechniqueSettings 遍历全部技法并解析快照缓存,
	//   页头无 memo 且订阅整状态 → 任意盘面状态变化都白跑一遍。改惰性初始化(只在首帧算一次,返回值不变)。
	const [aiSettingData, setAiSettingData] = React.useState(()=>loadAIExportSettings());
	const aiSettingDataRef = React.useRef(aiSettingData);
	const aiSettingOpenedRef = React.useRef(null);   // [Q-309/T-307] 打开弹窗时的设置快照(取消回滚用)
	const [aiSettingTechs, setAiSettingTechs] = React.useState(()=>listAIExportTechniqueSettings());
	const [aiSettingKey, setAiSettingKey] = React.useState('astrochart');

	// [Q-417/T-380] 分组只在弹窗打开时按 aiSettingTechs 算一次(此前 render 里直接调 listAIExportTechniqueSettingGroups(),
	//   弹窗开过一次后每次渲染都重算整套快照选项);数据真值仍是 aiSettingTechs。
	const aiSettingGroups = React.useMemo(()=>(aiSettingVisible ? listAIExportTechniqueSettingGroups() : []), [aiSettingVisible, aiSettingTechs]);
	const currentSettingTech = aiSettingTechs.find((item)=>item.key === aiSettingKey) || null;
	const currentSettingOptions = currentSettingTech && currentSettingTech.options ? currentSettingTech.options : [];
	const currentSettingSupportsPlanetInfo = !!(currentSettingTech && currentSettingTech.supportsPlanetInfo);
	const currentSettingSupportsAstroMeaning = !!(currentSettingTech && currentSettingTech.supportsAstroMeaning);
	const currentSettingMeaningTitle = currentSettingTech && currentSettingTech.astroMeaningTitle
		? currentSettingTech.astroMeaningTitle
		: '占星注释（仅AI导出）：';
	const currentSettingMeaningCheckbox = currentSettingTech && currentSettingTech.astroMeaningCheckbox
		? currentSettingTech.astroMeaningCheckbox
		: '在对应分段输出星/宫/座/相/希腊点释义';
	const currentSettingSelected = (()=>{
		const sections = aiSettingData && aiSettingData.sections ? aiSettingData.sections : {};
		if(Array.isArray(sections[aiSettingKey])){
			return sections[aiSettingKey];
		}
		// [独立复核修] 未自定义基底=有效段(剔默认关段),与挂载侧面板同源(AIAnalysisMain 同款)。
		// 否则默认关段谎报已勾,且用户取消任一普通段保存后默认关段被静默转显式开(机制第四点破口)。
		const effective = getAIExportEffectiveSectionsForTechnique(aiSettingKey, aiSettingData);
		if(Array.isArray(effective) && effective.length){
			return effective;
		}
		return currentSettingOptions.slice(0);
	})();
	const currentSettingPlanetInfo = (()=>{
		const map = aiSettingData && aiSettingData.planetInfo ? aiSettingData.planetInfo : {};
		const one = map && map[aiSettingKey] ? map[aiSettingKey] : null;
		if(!one){
			return {
				showHouse: 1,
				showRuler: 1,
			};
		}
		return {
			showHouse: one && (one.showHouse === 1 || one.showHouse === true) ? 1 : 0,
			showRuler: one && (one.showRuler === 1 || one.showRuler === true) ? 1 : 0,
		};
	})();
	const currentSettingAstroMeaning = (()=>{
		const map = aiSettingData && aiSettingData.astroMeaning ? aiSettingData.astroMeaning : {};
		const one = map && map[aiSettingKey] ? map[aiSettingKey] : null;
		return {
			enabled: one && (one.enabled === 1 || one.enabled === true) ? 1 : 0,
		};
	})();

	function changeAppearanceMode(mode){
		if(props.dispatch){
			props.dispatch({
				type: 'app/save',
				payload:{
					appearanceMode: normalizeAppearanceMode(mode),
				},
			});		
		}
	}

	function cycleAppearanceMode(){
		changeAppearanceMode(getNextAppearanceMode(props.appearanceMode));
	}

	// 亮色配色档(古典宣纸 ↔ 经典白色):纯 CSS 变量层切换,localStorage 记忆;仅亮色下显示按钮。
	const [lightFlavor, setLightFlavor] = React.useState(()=>getStoredLightFlavor());
	// 全局「时间算法」缺省 = 新盘种子 timeAlg(紫微页亲手改也写同一仓;八字左栏的覆盖层复位到它)
	const [defaultTimeAlg, setDefaultTimeAlg] = React.useState(()=>newChartSeedValue('timeAlg'));
	React.useEffect(()=>subscribeNewChartSeeds(()=>setDefaultTimeAlg(newChartSeedValue('timeAlg'))), []);
	function changeDefaultTimeAlg(value){
		const v = Number(value);
		recordNewChartSeeds({ timeAlg: [0, 1, 2, 3].indexOf(v) >= 0 ? v : 0 });
		setDefaultTimeAlg(newChartSeedValue('timeAlg'));
	}
	function cycleLightFlavor(){
		const next = lightFlavor === LIGHT_FLAVOR_CLASSIC ? LIGHT_FLAVOR_PAPER : LIGHT_FLAVOR_CLASSIC;
		setLightFlavor(next);
		applyLightFlavorToDocument(next);
	}

	function changeDayBoundary(value){
		const normalized = normalizeDayBoundary(value);
		if(props.dispatch){
			props.dispatch({
				type: 'app/save',
				payload: { dayBoundary: normalized },
			});
		}
		// 即时同步: 广播事件,让各技法立即更新自己的 after23NewDay(下拉/options 立即变,下次操作即取新值;不主动 re-fetch 已渲染盘)
		try {
			if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
				const after23NewDay = normalized === 'after24' ? 0 : 1;
				window.dispatchEvent(new CustomEvent('horosa:day-boundary-changed', {
					detail: { dayBoundary: normalized, after23NewDay }
				}));
			}
		} catch (e) {
			// silently ignore
		}
	}

	// [Q-452/Q-453] 择日 AI 快照命中清单:上限 / 附判读树行数(app 仓 → globalSetup 持久化;builder 直读同键)。
	function changeZeriSnapshotPref(key, value){
		if(!props.dispatch){ return; }
		const normalized = key === 'zeriSnapshotMaxRows' ? normalizeZeriSnapshotMaxRows(value) : normalizeZeriSnapshotExplainRows(value);
		props.dispatch({ type: 'app/save', payload: { [key]: normalized } });
	}

	function changeLateZiHourMode(value){
		const normalized = normalizeLateZiHourMode(value);
		if(props.dispatch){
			props.dispatch({
				type: 'app/save',
				payload: { lateZiHourMode: normalized },
			});
		}
		try {
			if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
				const lateZiHourUseNextDay = lateZiHourModeToBit(normalized);
				window.dispatchEvent(new CustomEvent('horosa:late-zi-hour-mode-changed', {
					detail: { lateZiHourMode: normalized, lateZiHourUseNextDay }
				}));
			}
		} catch (e) {
			// silently ignore
		}
	}

    function openDrawer(key){
		if(props.dispatch){
			props.dispatch({
				type: 'astro/openDrawer',
				payload:{ 
					key: key,
				},
			});		
		}
	}
	
	// 「新命盘」= 起此刻的空白新盘(会覆盖当前输入,这是它的语义)。
	function newChart(){
		if(props.dispatch){
			props.dispatch({
				type: 'astro/nowChart',
				payload:{ },
			});		
		}
	}

	// 「重算当前」= 用已录生辰重排。此前它与「新命盘」共用同一 handler,
	// 于是这个菜单项实际把生辰清成当下,名实相反。
	function recalcChart(){
		if(props.dispatch){
			props.dispatch({ type: 'astro/recalcChart' });
		}
	}

	async function onAIExportClick({key}){
		try{
			const ret = await runAIExport(key);
			if(ret && ret.ok){
				message.success(ret.message);
			}else{
				message.error(ret && ret.message ? ret.message : 'AI导出失败，请重试。');
			}
		}catch(e){
			const msg = e && e.message ? e.message : 'AI导出异常';
			message.error(msg);
		}
	}

	function openAIExportSettings(){
		const settings = loadAIExportSettings();
		const techs = listAIExportTechniqueSettings();
		const current = getCurrentAIExportContext();
		let key = techs.length ? techs[0].key : 'astrochart';
		if(current && current.key){
			const found = techs.find((item)=>item.key === current.key);
			if(found){
				key = found.key;
			}
		}
		setAiSettingData(settings);
		setAiSettingTechs(techs);
		setAiSettingKey(key);
		// [Q-309/T-307] 记住打开时的设置:弹窗内每次改动即时落盘(下方 effect,供导出实时预览),
		// 「取消 / 关闭」须回滚到打开时的快照,否则以为放弃的改动已生效、「保存设置」形同虚设。
		try{ aiSettingOpenedRef.current = JSON.parse(JSON.stringify(settings)); }catch(e){ aiSettingOpenedRef.current = settings; }
		setAiSettingVisible(true);
	}

	function onAISettingCancel(){
		const snap = aiSettingOpenedRef.current;
		if(snap){
			const restored = saveAIExportSettings(snap);
			aiSettingDataRef.current = restored;
			setAiSettingData(restored);
		}
		setAiSettingVisible(false);
	}

	function onAISettingSave(){
		const saved = saveAIExportSettings(aiSettingDataRef.current);
		aiSettingDataRef.current = saved;
		setAiSettingData(saved);
		setAiSettingVisible(false);
		message.success('AI导出设置已保存');
	}

	function onAISettingOptionsChange(vals){
		const arr = Array.isArray(vals) ? vals.map((item)=>`${item}`) : [];
		setAiSettingData((prev)=>{
			const sections = {
				...(prev && prev.sections ? prev.sections : {}),
				[aiSettingKey]: arr,
			};
			const next = {
				...(prev || {}),
				version: AI_EXPORT_SETTINGS_VERSION,
				sections,
			};
			aiSettingDataRef.current = next;
			return next;
		});
	}

	function onAISettingToggleOption(item){
		const key = `${item}`;
		const selected = currentSettingSelected.indexOf(key) >= 0;
		const next = selected
			? currentSettingSelected.filter((rec)=>rec !== key)
			: currentSettingSelected.concat([key]);
		onAISettingOptionsChange(next);
	}

	// [v2 底座] 全局导出偏好(格式 v1/v2 · PDF/Word 附页面截图):非 per-technique,随设置对象整体保存。
	function onAISettingPrefChange(patch){
		setAiSettingData((prev)=>{
			const next = {
				...(prev || {}),
				version: AI_EXPORT_SETTINGS_VERSION,
				prefs: { ...((prev && prev.prefs) || {}), ...(patch || {}) },
			};
			aiSettingDataRef.current = next;
			return next;
		});
	}

	function onAISettingSelectAll(){
		onAISettingOptionsChange(currentSettingOptions.slice(0));
	}

	function onAISettingClear(){
		onAISettingOptionsChange([]);
	}

	function onAISettingResetDefault(){
		setAiSettingData((prev)=>{
			const sections = {
				...(prev && prev.sections ? prev.sections : {}),
			};
			const planetInfo = {
				...(prev && prev.planetInfo ? prev.planetInfo : {}),
			};
			const astroMeaning = {
				...(prev && prev.astroMeaning ? prev.astroMeaning : {}),
			};
			delete sections[aiSettingKey];
			delete planetInfo[aiSettingKey];
			delete astroMeaning[aiSettingKey];
			const next = {
				...(prev || {}),
				version: AI_EXPORT_SETTINGS_VERSION,
				sections,
				planetInfo,
				astroMeaning,
			};
			aiSettingDataRef.current = next;
			return next;
		});
	}

	function onAISettingPlanetInfoChange(field, checked){
		setAiSettingData((prev)=>{
			const current = prev && prev.planetInfo && prev.planetInfo[aiSettingKey]
				? prev.planetInfo[aiSettingKey]
				: { showHouse: 1, showRuler: 1 };
			const nextOne = {
				showHouse: current.showHouse === 1 || current.showHouse === true ? 1 : 0,
				showRuler: current.showRuler === 1 || current.showRuler === true ? 1 : 0,
			};
			nextOne[field] = checked ? 1 : 0;
			const next = {
				...(prev || {}),
				version: AI_EXPORT_SETTINGS_VERSION,
				sections: {
					...(prev && prev.sections ? prev.sections : {}),
				},
				planetInfo: {
					...(prev && prev.planetInfo ? prev.planetInfo : {}),
					[aiSettingKey]: nextOne,
				},
				astroMeaning: {
					...(prev && prev.astroMeaning ? prev.astroMeaning : {}),
				},
			};
			aiSettingDataRef.current = next;
			return next;
		});
	}

	function onAISettingAstroMeaningChange(checked){
		setAiSettingData((prev)=>{
			const next = {
				...(prev || {}),
				version: AI_EXPORT_SETTINGS_VERSION,
				sections: {
					...(prev && prev.sections ? prev.sections : {}),
				},
				planetInfo: {
					...(prev && prev.planetInfo ? prev.planetInfo : {}),
				},
				astroMeaning: {
					...(prev && prev.astroMeaning ? prev.astroMeaning : {}),
					[aiSettingKey]: {
						enabled: checked ? 1 : 0,
					},
				},
			};
			aiSettingDataRef.current = next;
			return next;
		});
	}

	React.useEffect(()=>{
		aiSettingDataRef.current = aiSettingData;
	}, [aiSettingData]);

	React.useEffect(()=>{
		if(!aiSettingVisible){
			return;
		}
		saveAIExportSettings(aiSettingData);
	}, [aiSettingData, aiSettingVisible]);

	// [Q-305/T-296] 此前判 window.horosaDesktop.exportDiagnostics(全仓无定义)→ 菜单项永不出现;改判壳 invoke 可用(与存储健康弹窗同一命令)。
	function hasDesktopBridge(){
		return hasTauriInvoke();
	}

	async function onExportDiagnosticsClick(){
		if(!hasDesktopBridge()){
			message.warning('当前不是桌面 App 环境，无法导出诊断报告。');
			return;
		}
		// [Q-305/T-296] 壳命令 export_diagnostics_bundle(存储健康弹窗同款;由壳自行收集日志/环境,不再前端自拼含 AI 快照原文的载荷)。
		try{
			const path = await invokeDesktopCommand('export_diagnostics_bundle', {});
			message.success(path ? `诊断报告已导出：${path}` : '诊断报告导出成功');
		}catch(e){
			message.error('诊断报告导出失败');
		}
	}

	function menuLabel(icon, text){
		return (
			<div className={styles.userMenuItem}>
				<XQIcon name={icon} />
				<span>{text}</span>
			</div>
		);
	}
	
	let pubmenu = [{
		key: 'chartlist',
		label: menuLabel('astro', '管理命盘')
	},{
		key: 'caselist',
		label: menuLabel('note', '管理事盘')
	},{
		// [Q-417/T-378 裁决 2026-09-18] 分布入口从不可达的登录态菜单移到公共菜单(数据源已改本机命盘库)
		key: 'chartsgps',
		label: menuLabel('locastro', '命盘分布')
	},{
		key: 'chartadd',
		label: menuLabel('newChart', '新增命盘')
	}];

	let usermenu = [{
		key: 'chartlist',
		label: menuLabel('astro', '我的星盘列表')
	},{
		key: 'caselist',
		label: menuLabel('note', '管理事盘')
	},{
		key: 'chartsgps',
		label: menuLabel('locastro', '我的星盘分布')
	},{
		key: 'chartadd',
		label: menuLabel('newChart', '新增星盘数据')
	},{
		key: 'changeparams',
		label: menuLabel('aiSettings', '星盘参数修改')
	},{
		key: 'changepwd',
		label: menuLabel('admin', '密码修改')
	},{
		key: 'divider',
		label: (<hr />),
		disabled: true
	},{
		key: 'logout',
		label: menuLabel('support', '退出登录')
	}];

	let menu = pubmenu;
	let username = '管理';
	if(props.userInfo){
		menu = usermenu;
		username = props.userInfo.uid;
	}

	// 🛡 inline style 兜底:某些 prod 加载顺序/CSS var 未注入场景,.avatar 的 var(--horosa-panel-bg)/var(--horosa-accent-strong)
	// 可能为空 → 头像背景透明 + icon 无色 → 用户看到"切主题后人头 icon 没了"。
	// 用 explicit fallback 颜色 + 暗亮各取一套 — 即使 CSS var 全空也保留对比鲜明的人头剪影。
	const isDarkAvatar = (props.resolvedAppearance || props.appearanceMode) === 'dark';
	const avatarInline = {
		background: isDarkAvatar ? '#0b0d10' : '#ffffff',
		color: isDarkAvatar ? '#f2cf91' : '#7a541c',
		border: isDarkAvatar ? '1px solid rgba(218, 177, 111, 0.32)' : '1px solid rgba(0,0,0,0.12)',
	};
	let avatarcomp = null;
	if(props.avatar){
		avatarcomp = (<Avatar size="small" className={styles.avatar} src={props.avatar} style={avatarInline} />);
	}else{
		avatarcomp = (<Avatar size="small" className={styles.avatar} icon={<XQIcon name="user" />} style={avatarInline} />);
	}

	const appearanceMode = normalizeAppearanceMode(props.appearanceMode);
	const appearanceLabel = getAppearanceLabel(appearanceMode, props.resolvedAppearance);

	const horosaqr = [{
		key: '1',
		label: (<img className={styles.brandQrImage} src={blogo} alt='星阙公众号' />)
	}];
	const aiExportMenu = [{
		key: 'all',
		label: (<div>一键复制+导出全部</div>),
	},{
		key: 'copy',
		label: (<div>复制AI纯文字</div>),
	},{
		key: 'txt',
		label: (<div>导出TXT</div>),
	},{
		key: 'word',
		label: (<div>导出Word</div>),
	},{
		key: 'pdf',
		label: (<div>导出PDF</div>),
	}];
	const currentPageLabel = PAGE_LABELS[props.currentTab] || '导航';
	// 设置下拉:按使用习惯三组(占星盘面 / AI 导出 / 应用),divider 分隔;
	// 图标逐项独立(chartPanel/aspectGeo/orbRange 为专绘,勿再与齿轮混用)。
	// 「排盘设置」(key 'query',老式「星盘配置」提交表单)入口已按用户定案移除:
	// 日期/地点/黄道/宫制与左栏命盘设置重复;表单独有的少数开关(强接纳/简单相位/虚点接相/需要推运)
	// 另行处置,勿把该入口加回。
	const astroSettingsMenu = [{
		key: 'selectchartdisplay',
		label: menuLabel('chartPanel', '星盘设置')
	},{
		key: 'selectplanet',
		label: menuLabel('sidePlanets', '显示星体')
	},{
		key: 'selectasp',
		label: menuLabel('aspectGeo', '相位设置')
	},{
		key: 'selectorb',
		label: menuLabel('orbRange', '容许度')
	},{
		type: 'divider'
	},{
		key: 'aiExportSettings',
		label: menuLabel('ai', 'AI导出设置')
	},{
		type: 'divider'
	},{
		key: 'globalsettings',
		label: menuLabel('settings', '全局设置')
	}].concat(hasUpdateBridge() ? [{
		key: 'checkUpdate',
		label: menuLabel('sync', '检查更新')
	}] : []).concat(hasDesktopBridge() ? [{
		key: 'diagnostics',
		label: menuLabel('diagnostics', '诊断报告')
	}] : []).concat([{
		key: 'about',
		label: menuLabel('help', '关于星阙')
	}]);

	function onAstroSettingsClick({key}){
		if(key === 'globalsettings'){
			setGlobalSettingVisible(true);
			return;
		}
		if(key === 'aiExportSettings'){
			openAIExportSettings();
			return;
		}
		if(key === 'diagnostics'){
			onExportDiagnosticsClick();
			return;
		}
		if(key === 'checkUpdate'){
			if(typeof window !== 'undefined' && typeof window.__horosaTriggerUpdateCheck === 'function'){
				window.__horosaTriggerUpdateCheck();
			}
			return;
		}
		if(key === 'about'){
			setAboutVisible(true);
			// [Q-308/M-105] 只取本地版本号:此前调 updateCheckSilent —— 打开「关于」即联网查更新,
			//   无视「自动检查更新」偏好、把「有新版」结果丢掉、还刷新 4 小时节流窗(启动时该弹的提示被推迟),
			//   且离线时请求失败连版本号都显示不出来。
			if(hasUpdateBridge()){
				appVersionLocal().then((res)=>{
					if(res && res.appVersion){ setAboutVersion(res.appVersion); }
				}).catch(()=>{ /* noop */ });
			}
			return;
		}
		openDrawer(key);
	}

	const astroNewChartMenu = [{
		key: 'now',
		label: menuLabel('newChart', '重算当前')
	},{
		key: 'chartadd',
		label: menuLabel('save', '存为命盘')
	},{
		key: 'chartlist',
		label: menuLabel('astro', '命盘列表')
	}];

	function onAstroNewChartMenuClick({key}){
		if(key === 'now'){
			recalcChart();
			return;
		}
		openDrawer(key);
	}

	return (
		<div className={`${styles.userbox} ${styles.astroUserbox}`}>
				<div className={styles.astroBrand}>
					<Dropdown menu={{items: horosaqr}} placement="bottomLeft" trigger={['click']} overlayClassName={styles.brandQrDropdown}>
						<button className={`${styles.brandButton} ${styles.astroBrandButton}`} type="button">
							<span className={`${styles.brandMark} ${styles.astroBrandMark}`}><XQIcon name="astro" /></span>
							<span className={`${styles.brandText} ${styles.astroBrandText}`}>星阙</span>
						</button>
					</Dropdown>
					<div className={styles.astroNewChartGroup}>
						<XQButton className={styles.astroPrimaryCommand} size="small" iconName="newChart" onClick={newChart}>新命盘</XQButton>
						<Dropdown menu={{items: astroNewChartMenu, onClick: onAstroNewChartMenuClick}} placement="bottomLeft" trigger={['click']}>
							<XQIconButton className={styles.astroSplitButton} size="small" iconName="chevronDown" label="" />
						</Dropdown>
					</div>
				</div>
				{/* 🔴 标题栏内的 Tooltip 一律 placement="bottom":antd 默认 top,而标题栏紧贴窗口顶边,
				    向上弹必然整个溢出窗外 —— 用户只看得见一个朝下的小箭头,内容全在窗口外(2026-08-01 实测)。 */}
				<Tooltip title="打开导航" placement="bottom">
					<button className={styles.astroCurrentModule} type="button" onClick={()=>openDrawer('homepage')}>
						<XQIcon name="sideSwitch" />
						<span>{currentPageLabel}</span>
						<XQIcon name="chevronDown" />
					</button>
				</Tooltip>
				<div className={styles.astroCommandCenter}>
					<Dropdown menu={{items: aiExportMenu, onClick: onAIExportClick}} placement="bottom" trigger={['click']}>
						<XQButton className={styles.astroHeaderCommand} size="small" iconName="aiExport">AI导出</XQButton>
					</Dropdown>
					<Dropdown menu={{items: astroSettingsMenu, onClick: onAstroSettingsClick}} placement="bottom" trigger={['click']}>
						<XQButton className={styles.astroHeaderCommand} size="small" iconName="settings">设置</XQButton>
					</Dropdown>
					<XQButton className={styles.astroHeaderCommand} size="small" iconName="help" onClick={()=>setAstroHelpVisible(true)}>帮助</XQButton>
				</div>
				<div className={styles.astroUtilityBar}>
					{/* 亮色配色档切换(仅亮色显示):古典宣纸 ↔ 经典白色,只换配色变量其余零动。
					    放在主题钮【左侧】—— 主题钮紧贴分隔线位置恒定,配色钮只在其左侧长出/隐去,
					    切换昼夜时主题钮不移位(用户诉求:主题钮固定不动)。 */}
					{(props.resolvedAppearance || props.appearanceMode) !== 'dark' ? (
						<Tooltip title={`亮色配色：${getLightFlavorLabel(lightFlavor)}。点击切换 古典宣纸 / 经典白色。`} placement="bottom">
							<XQIconButton className={styles.astroRoundButton} size="small" iconName="sideStyle" onClick={cycleLightFlavor} />
						</Tooltip>
					) : null}
					<Tooltip title={`主题：${appearanceLabel}。点击切换昼夜模式。`} placement="bottom">
						<XQIconButton className={styles.astroRoundButton} size="small" iconName="theme" data-appearance-toggle="1" onClick={cycleAppearanceMode} />
					</Tooltip>
					<div className={styles.astroHeaderDivider} />
					{/* 🔴 placement 必须显式 bottomRight:本触发器是标题栏最右一枚,antd 默认 bottomLeft
					    会从触发器左边缘向右展开 → 菜单越过窗口右界被裁,「管理命盘」只剩「管理」。
					    同排其余 Dropdown 都显式给了 placement,唯独这枚漏了(2026-08-01 实测)。 */}
					<Dropdown menu={{
							items: menu,
							onClick: props.onMenuClick}}
							placement="bottomRight"
					>
						<span className={`${styles.account} ${styles.astroAccount}`}>
							{avatarcomp}
							<span className={styles.name}>{username}</span>
						</span>
					</Dropdown>
				</div>
				<XQModal
					title={`${currentPageLabel} · 操作手册`}
					open={astroHelpVisible}
					onCancel={()=>setAstroHelpVisible(false)}
					width={Math.min(920, typeof window !== 'undefined' ? Math.round((getLayoutViewportWidth() || 1024) * 0.9) : 920)}
					footer={(
						<XQToolbar className={styles.aiSettingFooter}>
							<XQButton size="small" variant="primary" onClick={()=>setAstroHelpVisible(false)}>知道了</XQButton>
						</XQToolbar>
					)}
				>
					<div className={styles.astroHelpBody} style={{ maxHeight: 'calc(74 * var(--horosa-lvh, 1vh))', overflowY: 'auto' }}>
						{(()=>{ const HelpDoc = getTechniqueHelpDoc(props.currentTab, props.currentSubTab); return HelpDoc ? <HelpDoc /> : (
							<>
								<p>左侧为排盘输入与显示设置，中间为盘面绘制，右侧分页查看信息、相位、行星与判读。</p>
								<p>底部快捷功能跳转到对应技法或抽屉；切换任一设置即时全组合重算。</p>
							</>
						); })()}
					</div>
				</XQModal>
				<XQModal
					title="AI导出设置"
					open={aiSettingVisible}
					onCancel={onAISettingCancel}
					width={640}
					footer={(
						<XQToolbar className={styles.aiSettingFooter}>
							<XQButton size="small" onClick={onAISettingCancel}>取消</XQButton>
							<XQButton size="small" variant="primary" onClick={onAISettingSave}>保存设置</XQButton>
						</XQToolbar>
					)}
				>
					<div className={styles.aiSettingModal}>
						<XQSectionTitle>通用（全部技法）</XQSectionTitle>
						<XQCheckList columns={2}>
							<XQCheckItem
								compact
								checked={(aiSettingData && aiSettingData.prefs && aiSettingData.prefs.format) === 'v2'}
								onClick={()=>onAISettingPrefChange({ format: (aiSettingData && aiSettingData.prefs && aiSettingData.prefs.format) === 'v2' ? 'v1' : 'v2' })}
							>
								新版导出格式 v2（表格化排版）
							</XQCheckItem>
							<XQCheckItem
								compact
								checked={!(aiSettingData && aiSettingData.prefs && aiSettingData.prefs.attachScreenshot === false)}
								onClick={()=>onAISettingPrefChange({ attachScreenshot: (aiSettingData && aiSettingData.prefs && aiSettingData.prefs.attachScreenshot === false) })}
							>
								PDF/Word 附当前页面截图
							</XQCheckItem>
							{/* [Q-309/T-308] 图例只在 v2 格式下拼装:v1 时置灰并注明,免「勾了不带图例」的哑弹。 */}
							<XQCheckItem
								compact
								data-ai-export-legend="1"
								disabled={(aiSettingData && aiSettingData.prefs && aiSettingData.prefs.format) !== 'v2'}
								title={(aiSettingData && aiSettingData.prefs && aiSettingData.prefs.format) !== 'v2' ? '图例随新版 v2 格式拼装;经典 v1 格式不带图例' : undefined}
								checked={!!(aiSettingData && aiSettingData.prefs && aiSettingData.prefs.legend === true)}
								onClick={()=>{ if((aiSettingData && aiSettingData.prefs && aiSettingData.prefs.format) !== 'v2'){ return; } onAISettingPrefChange({ legend: !(aiSettingData && aiSettingData.prefs && aiSettingData.prefs.legend === true) }); }}
							>
								AI 导出附[图例]术语速查(紫微/八字/星盘){(aiSettingData && aiSettingData.prefs && aiSettingData.prefs.format) !== 'v2' ? '（仅 v2 格式）' : ''}
							</XQCheckItem>
						</XQCheckList>
						<XQSectionTitle>选择技法</XQSectionTitle>
						<XQSelect
						size='small'
						style={{width: '100%'}}
						value={aiSettingKey}
						showSearch
						optionFilterProp='children'
						onChange={(val)=>setAiSettingKey(val)}
						>
							{/* [YE] 73 项按术数域分组(+搜索);数据仍以 aiSettingTechs 为真值,分组只是展示。 */}
							{aiSettingGroups.map((group)=>(
								<XQSelect.OptGroup key={group.title} label={group.title}>
									{group.items.map((item)=>(
										<Option key={item.key} value={item.key}>{item.label}</Option>
									))}
								</XQSelect.OptGroup>
							))}
						</XQSelect>
						<XQToolbar compact className={styles.aiSettingActions}>
							<XQButton size='small' onClick={onAISettingSelectAll}>全选</XQButton>
							<XQButton size='small' onClick={onAISettingClear}>清空</XQButton>
							<XQButton size='small' onClick={onAISettingResetDefault}>恢复默认</XQButton>
						</XQToolbar>
						<XQSectionTitle>导出分段</XQSectionTitle>
						{currentSettingOptions.length ? (()=>{
							// [YE] 厚技法(印占/三式)段清单按 tab 语义两级分组渲染;无规则技法平铺现状。纯展示层,存储零变更。
							const sectionGroups = getSectionGroupsForTechnique(aiSettingKey, currentSettingOptions);
							const renderChecks = (items)=>(
								<XQCheckList columns={2} className={styles.aiSettingChecks}>
									{items.map((item)=>(
										<XQCheckItem
											key={item}
											compact
											checked={currentSettingSelected.indexOf(item) >= 0}
											onClick={()=>onAISettingToggleOption(item)}
										>
											{item}
										</XQCheckItem>
									))}
								</XQCheckList>
							);
							if(!sectionGroups){
								return renderChecks(currentSettingOptions);
							}
							return sectionGroups.map((group)=>(
								<div key={group.title}>
									<div className={styles.aiSettingGroupTitle}>{group.title}</div>
									{renderChecks(group.items)}
								</div>
							));
						})() : (
							<div className={styles.aiSettingEmpty}>当前技法暂未检测到可选分段，请先在该技法完成一次排盘后再设置。</div>
						)}
						{currentSettingSupportsPlanetInfo ? (
							<div>
								<XQSectionTitle>星曜后天信息</XQSectionTitle>
								<XQCheckList columns={2}>
									<XQCheckItem
										compact
										checked={currentSettingPlanetInfo.showHouse === 1}
										onClick={()=>onAISettingPlanetInfoChange('showHouse', currentSettingPlanetInfo.showHouse !== 1)}
									>
										显示星曜宫位
									</XQCheckItem>
									<XQCheckItem
										compact
										checked={currentSettingPlanetInfo.showRuler === 1}
										onClick={()=>onAISettingPlanetInfoChange('showRuler', currentSettingPlanetInfo.showRuler !== 1)}
									>
										显示星曜主宰宫
									</XQCheckItem>
								</XQCheckList>
							</div>
						) : null}
						{currentSettingSupportsAstroMeaning ? (
							<div>
								<XQSectionTitle>{currentSettingMeaningTitle}</XQSectionTitle>
								<XQCheckItem
									compact
									checked={currentSettingAstroMeaning.enabled === 1}
									onClick={()=>onAISettingAstroMeaningChange(currentSettingAstroMeaning.enabled !== 1)}
								>
									{currentSettingMeaningCheckbox}
								</XQCheckItem>
							</div>
						) : null}
					</div>
				</XQModal>
				<XQModal
					title="全局设置"
					open={globalSettingVisible}
					onCancel={()=>setGlobalSettingVisible(false)}
					width={520}
					footer={(
						<XQToolbar className={styles.aiSettingFooter}>
							<XQButton size="small" variant="primary" onClick={()=>setGlobalSettingVisible(false)}>完成</XQButton>
						</XQToolbar>
					)}
				>
					<div className={styles.aiSettingModal}>
						<XQSectionTitle>日界点（日柱换日规则）</XQSectionTitle>
						<XQSegmented
							value={normalizeDayBoundary(props.dayBoundary)}
							onChange={(e)=>changeDayBoundary(e && e.target ? e.target.value : e)}
							options={[
								{value: DAY_BOUNDARY_AFTER23, label: '23点算第二天'},
								{value: DAY_BOUNDARY_AFTER24, label: '24点算第二天'},
							]}
						/>
						<div className={styles.aiSettingEmpty}>作为所有技法的默认换日规则；个别技法仍可在其「排盘设置」中单独调整（左栏改过后全局不会覆盖）。八字左栏的改动只作用于八字页（其它技法不跟随），新建或载入命盘时复位；载入命盘自带的口径优先于这里的全局值。「23点算第二天」=23点起日柱进位次日；「24点算第二天」=23点仍守今、24点才换日柱。</div>

						<XQSectionTitle>时间算法（新命盘的缺省）</XQSectionTitle>
						<XQSegmented
							value={defaultTimeAlg}
							onChange={(e)=>changeDefaultTimeAlg(e && e.target ? e.target.value : e)}
							options={[
								{value: 0, label: '真太阳时'},
								{value: 3, label: '平太阳时'},
								{value: 1, label: '直接时间'},
							]}
						/>
						<div className={styles.aiSettingEmpty}>新命盘与重开软件时的时间算法由此起始;紫微页亲手改「时间算法」也会更新它。八字左栏的时间算法只作用于八字页,新命盘 / 载入命盘时复位到这里的缺省;载入命盘一律按记录里存的算法。</div>
						<XQSectionTitle>晚子时·时柱起干（独立于日柱）</XQSectionTitle>
						<XQSegmented
							value={normalizeLateZiHourMode(props.lateZiHourMode)}
							onChange={(e)=>changeLateZiHourMode(e && e.target ? e.target.value : e)}
							options={[
								{value: LATE_ZI_HOUR_NEXT_DAY, label: '晚子时按次日日柱计算'},
								{value: LATE_ZI_HOUR_TODAY, label: '晚子时按当日柱计算'},
							]}
						/>
						<div className={styles.aiSettingEmpty}>晚子时＝23:00–24:00。「按次日日柱计算」（默认）= 时干用次日日干起子时；「按当日柱计算」= 时干用今日日干起子时。这跟日柱开关独立——只在 23:00–23:59 时段影响时干。</div>

						{/* [Q-452 裁决 A / Q-453 裁决 2026-09-18] 择日九宿主 + 天星快照「命中清单」上限与判读树行数全局可配 */}
						<XQSectionTitle>择日 AI 快照·命中清单</XQSectionTitle>
						<div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
							<span>最多列出 <XQInputNumber size="small" min={ZERI_SNAPSHOT_MAX_ROWS_MIN} max={ZERI_SNAPSHOT_MAX_ROWS_MAX} precision={0} style={{ width: 84 }} value={normalizeZeriSnapshotMaxRows(props.zeriSnapshotMaxRows)} onChange={(v)=>changeZeriSnapshotPref('zeriSnapshotMaxRows', v)} /> 段</span>
							<span>前 <XQInputNumber size="small" min={ZERI_SNAPSHOT_EXPLAIN_ROWS_MIN} max={ZERI_SNAPSHOT_EXPLAIN_ROWS_MAX} precision={0} style={{ width: 72 }} value={normalizeZeriSnapshotExplainRows(props.zeriSnapshotExplainRows)} onChange={(v)=>changeZeriSnapshotPref('zeriSnapshotExplainRows', v)} /> 段附判读树</span>
						</div>
						<div className={styles.aiSettingEmpty}>择日各宿主与天星择日的 AI 快照「命中时段」清单默认只列前 60 段(页面表格仍逐行全列);前 3 段下附与「详情▼」同源的判读树(设定 vs 实际),便于 AI 看到条件是怎么命中的。改大上限会加长快照。</div>
					</div>
				</XQModal>
				<XQModal
					title="关于星阙"
					open={aboutVisible}
					onCancel={()=>setAboutVisible(false)}
					width={460}
					footer={(
						<XQToolbar className={styles.aiSettingFooter}>
							<XQButton size="small" variant="primary" onClick={()=>setAboutVisible(false)}>完成</XQButton>
						</XQToolbar>
					)}
				>
					<div className={styles.aboutBody}>
						<div className={styles.aboutHeadRow}>
							<div className={styles.aboutLogo}><img src={appIcon} alt="星阙 Horosa" /></div>
							<div>
								<div className={styles.aboutName}>星阙 Horosa</div>
								<div className={styles.aboutVersion}>{aboutVersion ? `版本 v${aboutVersion}` : '玄学与星座云平台'}</div>
							</div>
						</div>
						<div className={styles.aboutDesc}>本地优先的玄学与星座桌面应用，涵盖占星、八字、紫微、七政四余、三式与数算等技法，并内置 AI 分析与挂载上下文。</div>
						<div className={styles.aboutLegal}>
							<div className={styles.aboutLegalText}>
								<strong>开源 · 永久免费。</strong>星阙 Horosa 以 AGPL-3.0 开源许可发布。未来如有收费，仅限创始人 / 官方渠道；请仅从官方渠道下载，勿轻信其他来源。玄学内容仅供文化研究与娱乐，不构成任何专业建议。
							</div>
							<div className={styles.aboutLegalLinks}>
								<button type="button" className={styles.aboutLegalLink} onClick={()=>openHorosaLink(HOROSA_LEGAL_URL)}>用户协议与隐私政策</button>
								<span className={styles.aboutLegalSep}>·</span>
								<button type="button" className={styles.aboutLegalLink} onClick={()=>openHorosaLink(HOROSA_RELEASES_URL)}>官方下载渠道</button>
							</div>
						</div>
						{hasUpdateBridge() ? (
							<div className={styles.aboutActions}>
								<XQButton size="small" variant="primary" onClick={()=>{ if(typeof window !== 'undefined' && typeof window.__horosaTriggerUpdateCheck === 'function'){ window.__horosaTriggerUpdateCheck(); } }}>检查更新</XQButton>
								<span className={styles.aboutCheckState}>进入软件会自动检测，有新版会在右下角提示，可后台下载、随时重启更新。</span>
							</div>
						) : null}
					</div>
				</XQModal>
		</div>
	);
}

export default PageHeader;
