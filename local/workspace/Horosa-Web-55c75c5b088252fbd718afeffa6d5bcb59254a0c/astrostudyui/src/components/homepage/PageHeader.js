import React from 'react';
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
import { isDesktopBridgeAvailable as hasUpdateBridge, updateCheckSilent } from '../../utils/aiAnalysisDesktop';
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
	XQToolbar,
} from '../xq-ui';
import XQIcon from '../xq-icons';
import { normalizeDayBoundary, DAY_BOUNDARY_AFTER23, DAY_BOUNDARY_AFTER24, normalizeLateZiHourMode, LATE_ZI_HOUR_NEXT_DAY, LATE_ZI_HOUR_TODAY, lateZiHourModeToBit } from '../../utils/dayBoundary';
import styles from './PageHeader.less';

// Windows 发行版:「关于」内的法律文档与官方下载渠道指向本平台仓库(windows-adaptations #23)。
const HOROSA_OFFICIAL_REPO = 'https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows';
const HOROSA_LEGAL_URL = `${HOROSA_OFFICIAL_REPO}/tree/main/docs/legal`;
const HOROSA_RELEASES_URL = `${HOROSA_OFFICIAL_REPO}/releases`;
function openHorosaLink(url){
	if(typeof window === 'undefined' || !url){ return; }
	try{ window.open(url, '_blank', 'noopener,noreferrer'); }catch(e){ /* noop */ }
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
};

function PageHeader(props){
	const [aiSettingVisible, setAiSettingVisible] = React.useState(false);
	const [globalSettingVisible, setGlobalSettingVisible] = React.useState(false);
	const [astroHelpVisible, setAstroHelpVisible] = React.useState(false);
	const [aboutVisible, setAboutVisible] = React.useState(false);
	const [aboutVersion, setAboutVersion] = React.useState('');
	const [aiSettingData, setAiSettingData] = React.useState(loadAIExportSettings());
	const aiSettingDataRef = React.useRef(aiSettingData);
	const [aiSettingTechs, setAiSettingTechs] = React.useState(listAIExportTechniqueSettings());
	const [aiSettingKey, setAiSettingKey] = React.useState('astrochart');

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
		setAiSettingVisible(true);
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

	function hasDesktopBridge(){
		return typeof window !== 'undefined'
			&& window.horosaDesktop
			&& typeof window.horosaDesktop.exportDiagnostics === 'function';
	}

	function collectSnapshotPayload(){
		const payload = {
			url: typeof window !== 'undefined' ? window.location.href : '',
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
			timestamp: new Date().toISOString(),
			snapshots: {},
			localKeys: [],
		};
		if(typeof window === 'undefined' || !window.localStorage){
			return payload;
		}
		for(let i=0; i<window.localStorage.length; i++){
			const key = window.localStorage.key(i);
			if(!key){
				continue;
			}
			payload.localKeys.push(key);
			if(key.indexOf('horosa.ai.snapshot.module.v1.') === 0){
				payload.snapshots[key] = window.localStorage.getItem(key);
			}
		}
		return payload;
	}

	async function onExportDiagnosticsClick(){
		if(!hasDesktopBridge()){
			message.warning('当前不是桌面 App 环境，无法导出诊断报告。');
			return;
		}
		const ret = await window.horosaDesktop.exportDiagnostics(collectSnapshotPayload());
		if(ret && ret.ok){
			message.success(ret.message || '诊断报告导出成功');
		}else if(ret && ret.canceled){
			message.info('已取消导出诊断报告');
		}else{
			message.error((ret && ret.message) ? ret.message : '诊断报告导出失败');
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
			if(hasUpdateBridge()){
				updateCheckSilent().then((res)=>{
					if(res && res.currentVersion){ setAboutVersion(res.currentVersion); }
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
				<Tooltip title="打开导航">
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
						<Tooltip title={`亮色配色：${getLightFlavorLabel(lightFlavor)}。点击切换 古典宣纸 / 经典白色。`}>
							<XQIconButton className={styles.astroRoundButton} size="small" iconName="sideStyle" onClick={cycleLightFlavor} />
						</Tooltip>
					) : null}
					<Tooltip title={`主题：${appearanceLabel}。点击切换昼夜模式。`}>
						<XQIconButton className={styles.astroRoundButton} size="small" iconName="theme" onClick={cycleAppearanceMode} />
					</Tooltip>
					<div className={styles.astroHeaderDivider} />
					<Dropdown menu={{
							items: menu,
							onClick: props.onMenuClick}}
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
					width={Math.min(920, typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.9) : 920)}
					footer={(
						<XQToolbar className={styles.aiSettingFooter}>
							<XQButton size="small" variant="primary" onClick={()=>setAstroHelpVisible(false)}>知道了</XQButton>
						</XQToolbar>
					)}
				>
					<div className={styles.astroHelpBody} style={{ maxHeight: '74vh', overflowY: 'auto' }}>
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
					onCancel={()=>setAiSettingVisible(false)}
					width={640}
					footer={(
						<XQToolbar className={styles.aiSettingFooter}>
							<XQButton size="small" onClick={()=>setAiSettingVisible(false)}>取消</XQButton>
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
							{listAIExportTechniqueSettingGroups().map((group)=>(
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
						<div className={styles.aiSettingEmpty}>作为所有技法的默认换日规则；个别技法仍可在其「排盘设置」中单独调整（左栏改过后全局不会覆盖）。「23点算第二天」=23点起日柱进位次日；「24点算第二天」=23点仍守今、24点才换日柱。</div>

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
