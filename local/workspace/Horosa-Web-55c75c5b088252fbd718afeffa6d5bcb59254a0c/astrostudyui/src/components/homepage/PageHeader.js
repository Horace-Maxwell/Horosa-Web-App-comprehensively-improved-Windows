import React from 'react';
import {  Avatar, Dropdown, Select, Button, message, Modal, Checkbox, Progress, } from 'antd';
import { UserOutlined, LogoutOutlined, SearchOutlined } from '@ant-design/icons';
import * as AstroConst from '../../constants/AstroConst';
import blogo from '../../assets/blogo.jpg';
import * as AstroText from '../../constants/AstroText';
import {
	runAIExport,
	loadAIExportSettings,
	saveAIExportSettings,
	listAIExportTechniqueSettings,
	getCurrentAIExportContext,
} from '../../utils/aiExport';
import {
	hasDesktopBridge,
	getDesktopAppInfo,
	checkDesktopUpdates,
	installDesktopUpdate,
	openDesktopLogsDirectory,
	retryDesktopRuntime,
	onDesktopUpdateState,
	onDesktopRuntimeState,
} from '../../utils/desktopBridge';
import styles from './PageHeader.less';

const Option = Select.Option;

function PageHeader(props){
	const currentColorTheme = AstroConst.normalizeColorThemeIndex(props.colorTheme);
	const [aiSettingVisible, setAiSettingVisible] = React.useState(false);
	const [aiSettingData, setAiSettingData] = React.useState(loadAIExportSettings());
	const [aiSettingTechs, setAiSettingTechs] = React.useState(listAIExportTechniqueSettings());
	const [aiSettingKey, setAiSettingKey] = React.useState('astrochart');
	const [desktopUpdateVisible, setDesktopUpdateVisible] = React.useState(false);
	const [desktopAppInfo, setDesktopAppInfo] = React.useState(null);
	const [desktopUpdateState, setDesktopUpdateState] = React.useState({
		status: 'manual-installer-only',
		message: '当前版本改为通过 GitHub Releases 下载完整安装器更新，请下载最新 Horosa-Setup 安装包后覆盖安装。',
	});
	const [desktopRuntimeState, setDesktopRuntimeState] = React.useState(null);

	const currentSettingTech = aiSettingTechs.find((item)=>item.key === aiSettingKey) || null;
	const currentSettingOptions = currentSettingTech && currentSettingTech.options ? currentSettingTech.options : [];
	const currentSettingSupportsPlanetMeta = !!(currentSettingTech && (currentSettingTech.supportsPlanetMeta || currentSettingTech.supportsPlanetInfo));
	const currentSettingSupportsAnnotation = !!(currentSettingTech && (currentSettingTech.supportsAnnotation || currentSettingTech.supportsAstroMeaning));
	const currentSettingSelected = (()=>{
		const sections = aiSettingData && aiSettingData.sections ? aiSettingData.sections : {};
		if(Array.isArray(sections[aiSettingKey])){
			return sections[aiSettingKey];
		}
		return currentSettingOptions.slice(0);
	})();
	const currentSettingPlanetMeta = (()=>{
		const planetMeta = aiSettingData && aiSettingData.planetInfo ? aiSettingData.planetInfo : (aiSettingData && aiSettingData.planetMeta ? aiSettingData.planetMeta : {});
		const raw = planetMeta && planetMeta[aiSettingKey] ? planetMeta[aiSettingKey] : {};
		return {
			showHouse: raw.showHouse === 0 ? 0 : 1,
			showRuler: raw.showRuler === 0 ? 0 : 1,
		};
	})();
	const currentSettingAnnotation = (()=>{
		const astroMeaning = aiSettingData && aiSettingData.astroMeaning ? aiSettingData.astroMeaning : {};
		const raw = astroMeaning[aiSettingKey];
		if(raw && typeof raw === 'object'){
			return raw.enabled === 0 ? 0 : 1;
		}
		const annotations = aiSettingData && aiSettingData.annotations ? aiSettingData.annotations : {};
		const legacy = annotations[aiSettingKey];
		return legacy === 0 ? 0 : 1;
	})();

	React.useEffect(()=>{
		if(!hasDesktopBridge()){
			return ()=>{};
		}
		let active = true;
		getDesktopAppInfo().then((info)=>{
			if(!active || !info){
				return;
			}
			setDesktopAppInfo(info);
			if(info.updateState){
				setDesktopUpdateState(info.updateState);
			}
			if(info.runtimeState){
				setDesktopRuntimeState(info.runtimeState);
			}
		}).catch(()=>{});

		const offUpdate = onDesktopUpdateState((state)=>{
			if(!active){
				return;
			}
			setDesktopUpdateState(state || {});
		});
		const offRuntime = onDesktopRuntimeState((state)=>{
			if(!active){
				return;
			}
			setDesktopRuntimeState(state || {});
		});
		return ()=>{
			active = false;
			offUpdate();
			offRuntime();
		};
	}, []);

	function changeColorTheme(val){
		if(props.dispatch){
			props.dispatch({
				type: 'app/save',
				payload:{ 
					colorTheme: AstroConst.normalizeColorThemeIndex(val),
				},
			});		
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
	
	function newChart(){
		if(props.dispatch){
			props.dispatch({
				type: 'astro/nowChart',
				payload:{ },
			});		
		}
	}

	async function onAIExportClick({key}){
		const ret = await runAIExport(key);
		if(ret.ok){
			message.success(ret.message);
		}else{
			message.error(ret.message);
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
		const saved = saveAIExportSettings(aiSettingData);
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
			return {
				...(prev || {}),
				version: 1,
				sections,
			};
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
			const planetMeta = {
				...(prev && prev.planetMeta ? prev.planetMeta : {}),
			};
			const astroMeaning = {
				...(prev && prev.astroMeaning ? prev.astroMeaning : {}),
			};
			const annotations = {
				...(prev && prev.annotations ? prev.annotations : {}),
			};
			delete sections[aiSettingKey];
			delete planetInfo[aiSettingKey];
			delete planetMeta[aiSettingKey];
			delete astroMeaning[aiSettingKey];
			delete annotations[aiSettingKey];
			return {
				...(prev || {}),
				version: 1,
				sections,
				planetInfo,
				planetMeta,
				astroMeaning,
				annotations,
			};
		});
	}

	function onAISettingPlanetMetaChange(key, checked){
		setAiSettingData((prev)=>{
			const sectionData = {
				...(prev && prev.sections ? prev.sections : {}),
			};
			const nextMeta = {
				...((prev && prev.planetInfo ? prev.planetInfo : (prev && prev.planetMeta ? prev.planetMeta : {}))),
				[aiSettingKey]: {
					...((prev && prev.planetInfo && prev.planetInfo[aiSettingKey]) ? prev.planetInfo[aiSettingKey] : ((prev && prev.planetMeta && prev.planetMeta[aiSettingKey]) ? prev.planetMeta[aiSettingKey] : {})),
					[key]: checked ? 1 : 0,
				},
			};
			const planetMeta = {
				...nextMeta,
			};
			return {
				...(prev || {}),
				version: 1,
				sections: sectionData,
				planetInfo: nextMeta,
				planetMeta,
			};
		});
	}

	function onAISettingAnnotationChange(checked){
		setAiSettingData((prev)=>{
			const astroMeaning = {
				...(prev && prev.astroMeaning ? prev.astroMeaning : {}),
				[aiSettingKey]: {
					enabled: checked ? 1 : 0,
				},
			};
			const annotations = {
				...(prev && prev.annotations ? prev.annotations : {}),
				[aiSettingKey]: checked ? 1 : 0,
			};
			return {
				...(prev || {}),
				version: 1,
				sections: {
					...(prev && prev.sections ? prev.sections : {}),
				},
				astroMeaning,
				planetMeta: {
					...(prev && prev.planetMeta ? prev.planetMeta : {}),
				},
				annotations,
			};
		});
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

	async function openDesktopUpdateModal(){
		setDesktopUpdateVisible(true);
		if(!hasDesktopBridge()){
			return;
		}
		try{
			const info = await getDesktopAppInfo();
			if(info){
				setDesktopAppInfo(info);
				if(info.updateState){
					setDesktopUpdateState(info.updateState);
				}
				if(info.runtimeState){
					setDesktopRuntimeState(info.runtimeState);
				}
			}
		}catch(e){}
	}

	async function onCheckDesktopUpdateClick(){
		if(!hasDesktopBridge()){
			message.warning('当前不是桌面 App 环境，无法检查更新。');
			return;
		}
		setDesktopUpdateVisible(true);
		try{
			const ret = await checkDesktopUpdates();
			if(ret){
				setDesktopUpdateState(ret);
			}
		}catch(e){
			message.error((e && e.message) ? e.message : '检查更新失败');
		}
	}

	async function onInstallDesktopUpdateClick(){
		try{
			const ret = await installDesktopUpdate();
			if(ret && ret.ok){
				message.success(ret.message || '即将安装更新');
			}else{
				message.warning((ret && ret.message) ? ret.message : '暂无可安装更新');
			}
		}catch(e){
			message.error((e && e.message) ? e.message : '安装更新失败');
		}
	}

	async function onOpenDesktopLogsClick(){
		try{
			const ret = await openDesktopLogsDirectory();
			if(ret && ret.ok){
				message.success(ret.message || '日志目录已打开');
			}else{
				message.warning((ret && ret.message) ? ret.message : '打开日志目录失败');
			}
		}catch(e){
			message.error((e && e.message) ? e.message : '打开日志目录失败');
		}
	}

	async function onRetryDesktopRuntimeClick(){
		try{
			const ret = await retryDesktopRuntime();
			if(ret && (ret.status === 'ready' || ret.status === 'starting-java' || ret.status === 'starting-python' || ret.status === 'starting-window')){
				setDesktopRuntimeState(ret || {});
				message.success(ret.message || '正在重新启动本地服务');
			}else{
				message.warning((ret && ret.message) ? ret.message : '重试本地服务失败');
			}
		}catch(e){
			message.error((e && e.message) ? e.message : '重试本地服务失败');
		}
	}

	const desktopDownloadPercent = (()=> {
		if(!desktopUpdateState || !desktopUpdateState.progress){
			return 0;
		}
		const percent = Number(desktopUpdateState.progress.percent);
		if(!Number.isFinite(percent)){
			return 0;
		}
		return Math.max(0, Math.min(100, percent));
	})();
	
	let pubmenu = [{
		key: 'chartlist',
		label: (<div><UserOutlined />&nbsp;管理命盘</div>)
	},{
		key: 'caselist',
		label: (<div><UserOutlined />&nbsp;管理事盘</div>)
	},{
		key: 'chartadd',
		label: (<div><UserOutlined />&nbsp;新增命盘</div>)
	}];

	let usermenu = [{
		key: 'chartlist',
		label: (<div><UserOutlined />&nbsp;我的星盘列表</div>)
	},{
		key: 'caselist',
		label: (<div><UserOutlined />&nbsp;管理事盘</div>)
	},{
		key: 'chartsgps',
		label: (<div><UserOutlined />&nbsp;我的星盘分布</div>)
	},{
		key: 'chartadd',
		label: (<div><UserOutlined />&nbsp;新增星盘数据</div>)
	},{
		key: 'changeparams',
		label: (<div><UserOutlined />&nbsp;星盘参数修改</div>)
	},{
		key: 'changepwd',
		label: (<div><UserOutlined />&nbsp;密码修改</div>)
	},{
		key: 'divider',
		label: (<hr />),
		disabled: true
	},{
		key: 'logout',
		label: (<div><LogoutOutlined />&nbsp;退出登录</div>)
	}];

	let menu = pubmenu;
	let username = '管理';
	if(props.userInfo){
		menu = usermenu;
		username = props.userInfo.uid;
	}

	let avatarcomp = null;
	if(props.avatar){
		avatarcomp = (<Avatar size="small" className={styles.avatar} src={props.avatar} />);
	}else{
		avatarcomp = (<Avatar size="small" className={styles.avatar} icon={<UserOutlined />} />);
	}

	let colorOpts = AstroConst.colorThemes.map((opt, idx)=>{
		return (
			<Option key={opt} value={idx}>{opt}</Option>
		);
	});

	const horosaqr = [{
		key: '1',
		label: (<img src={blogo} alt='星阙公众号' style={{width: 200, height:200}} />)
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

		return (
			<div className={styles.userbox}>
				<div className={styles.user} style={{left: 30}}>
					<span className={styles.action}>
						<Dropdown menu={{items: horosaqr}} placement="bottom" trigger={['click', 'hover']}>
							<span style={{color: '#79848e',}}><Button>公众号</Button></span>
						</Dropdown>				
					</span>
				</div>
			<div className={styles.user} style={{right: 30}}>
				<span className={styles.action} >
					<Button size='small' onClick={()=>{openDrawer('homepage')}}>首页</Button>
				</span>
				<span className={styles.action} >
					<Button size='small' onClick={()=>{openDrawer('memo')}}>批注</Button>
				</span>
				<span className={styles.action} >
					<Select 
						size='small'
						style={{ width: 150 }}
						value={currentColorTheme}
						onChange={changeColorTheme}
					>
						{colorOpts}
					</Select>

				</span>
				<span className={styles.action} >
					<Button size='small' onClick={()=>{openDrawer('commtools')}}>小工具</Button>
				</span>
				<span className={styles.action} >
					<Button size='small' onClick={()=>{openDrawer('selectchartdisplay')}}>星盘组件</Button>
				</span>
				<span className={styles.action} >
					<Button size='small' onClick={()=>{openDrawer('selectplanet')}}>行星选择</Button>
				</span>
				<span className={styles.action} >
					<Button size='small' onClick={()=>{openDrawer('selectasp')}}>相位选择</Button>
				</span>
					<span className={styles.action} >
						<Button size='small' onClick={newChart}>新命盘</Button>
					</span>
					<span className={styles.action} >
						<Dropdown menu={{items: aiExportMenu, onClick: onAIExportClick}} placement="bottom" trigger={['click']}>
							<Button size='small'>AI导出</Button>
						</Dropdown>
					</span>
					<span className={styles.action} >
						<Button size='small' onClick={openAIExportSettings}>AI导出设置</Button>
					</span>
					{hasDesktopBridge() ? (
					<span className={styles.action} >
						<Button size='small' onClick={openDesktopUpdateModal}>下载更新</Button>
					</span>
					) : null}
					{hasDesktopBridge() ? (
					<span className={styles.action} >
						<Button size='small' onClick={onOpenDesktopLogsClick}>日志目录</Button>
					</span>
					) : null}
					{hasDesktopBridge() ? (
					<span className={styles.action} >
						<Button size='small' onClick={onExportDiagnosticsClick}>导出诊断报告</Button>
					</span>
					) : null}
					<span className={styles.action} >
						<SearchOutlined onClick={()=>{openDrawer('query')}} />
					</span>
				<Dropdown menu={{
					items: menu, 
					onClick: props.onMenuClick}} 
				>
					<span className={`${styles.action} ${styles.account}`}>
						{avatarcomp}
						<span className={styles.name}>{username}</span>
					</span>
				</Dropdown>
			</div>
			<Modal
				title="AI导出设置"
				open={aiSettingVisible}
				onCancel={()=>setAiSettingVisible(false)}
				onOk={onAISettingSave}
				width={640}
			>
				<div style={{marginBottom: 10}}>选择技法：</div>
				<Select
					size='small'
					style={{width: '100%', marginBottom: 12}}
					value={aiSettingKey}
					onChange={(val)=>setAiSettingKey(val)}
				>
					{aiSettingTechs.map((item)=>(
						<Option key={item.key} value={item.key}>{item.label}</Option>
					))}
				</Select>
				<div style={{marginBottom: 10}}>
					<Button size='small' onClick={onAISettingSelectAll} style={{marginRight: 8}}>全选</Button>
					<Button size='small' onClick={onAISettingClear} style={{marginRight: 8}}>清空</Button>
					<Button size='small' onClick={onAISettingResetDefault}>恢复默认</Button>
				</div>
				{currentSettingOptions.length ? (
					<Checkbox.Group
						options={currentSettingOptions.map((item)=>({label: item, value: item}))}
						value={currentSettingSelected}
						onChange={onAISettingOptionsChange}
					/>
				) : (
					<div>当前技法暂未检测到可选分段，请先在该技法完成一次排盘后再设置。</div>
				)}
				{currentSettingSupportsPlanetMeta ? (
					<div style={{marginTop: 16}}>
						<div style={{marginBottom: 8}}>星曜附加信息：</div>
						<Checkbox
							checked={currentSettingPlanetMeta.showHouse === 1}
							onChange={(e)=>onAISettingPlanetMetaChange('showHouse', e.target.checked)}
							style={{marginRight: 16}}
						>
							显示星曜宫位
						</Checkbox>
						<Checkbox
							checked={currentSettingPlanetMeta.showRuler === 1}
							onChange={(e)=>onAISettingPlanetMetaChange('showRuler', e.target.checked)}
						>
							显示星曜主宰宫
						</Checkbox>
					</div>
				) : null}
				{currentSettingSupportsAnnotation ? (
					<div style={{marginTop: 12}}>
						<Checkbox
							checked={currentSettingAnnotation === 1}
							onChange={(e)=>onAISettingAnnotationChange(e.target.checked)}
						>
							占星注释
						</Checkbox>
					</div>
				) : null}
			</Modal>
			<Modal
				title="桌面安装包下载"
				open={desktopUpdateVisible}
				onCancel={()=>setDesktopUpdateVisible(false)}
				footer={[
					<Button key='logs' onClick={onOpenDesktopLogsClick}>打开日志目录</Button>,
					<Button key='retry-runtime' onClick={onRetryDesktopRuntimeClick}>重试本地服务</Button>,
					<Button key='check' type='primary' ghost onClick={onCheckDesktopUpdateClick}>打开 Release 下载页</Button>,
				]}
				width={640}
			>
				<div style={{marginBottom: 10}}>
					当前版本：{desktopAppInfo && desktopAppInfo.version ? desktopAppInfo.version : '未知版本'}
				</div>
				<div style={{marginBottom: 10}}>
					更新状态：{desktopUpdateState && desktopUpdateState.message ? desktopUpdateState.message : '请到 GitHub Releases 下载最新完整安装包'}
				</div>
				{desktopUpdateState && desktopUpdateState.latestReleaseUrl ? (
					<div style={{marginBottom: 10}}>
						下载页：{desktopUpdateState.latestReleaseUrl}
					</div>
				) : null}
				{desktopRuntimeState && desktopRuntimeState.serverRoot ? (
					<div style={{marginBottom: 10}}>
						本地服务：{desktopRuntimeState.serverRoot}
					</div>
				) : null}
				{desktopRuntimeState && desktopRuntimeState.status ? (
					<div style={{marginBottom: 10}}>
						运行状态：{desktopRuntimeState.status}{desktopRuntimeState.message ? ` / ${desktopRuntimeState.message}` : ''}
					</div>
				) : null}
				{desktopRuntimeState && desktopRuntimeState.startupDurationMs ? (
					<div style={{marginBottom: 10}}>
						最近一次后端启动耗时：{desktopRuntimeState.startupDurationMs} ms
					</div>
				) : null}
				<div style={{marginTop: 16, color: '#666'}}>
					当前发布渠道只提供离线安装器。若要升级，请打开 GitHub Releases 下载最新 `Horosa-Setup-*.exe` 覆盖安装。
				</div>
			</Modal>
		</div>
	);
}

export default PageHeader;
