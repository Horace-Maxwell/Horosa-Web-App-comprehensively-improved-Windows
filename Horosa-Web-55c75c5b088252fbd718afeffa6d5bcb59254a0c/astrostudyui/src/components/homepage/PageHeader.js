import React from 'react';
import {  Avatar, Dropdown, Select, Button, message, Modal, Checkbox, } from 'antd';
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
import styles from './PageHeader.less';

const Option = Select.Option;

function PageHeader(props){
	const currentColorTheme = AstroConst.normalizeColorThemeIndex(props.colorTheme);
	const [aiSettingVisible, setAiSettingVisible] = React.useState(false);
	const [aiSettingData, setAiSettingData] = React.useState(loadAIExportSettings());
	const [aiSettingTechs, setAiSettingTechs] = React.useState(listAIExportTechniqueSettings());
	const [aiSettingKey, setAiSettingKey] = React.useState('astrochart');

	const currentSettingTech = aiSettingTechs.find((item)=>item.key === aiSettingKey) || null;
	const currentSettingOptions = currentSettingTech && currentSettingTech.options ? currentSettingTech.options : [];
	const currentSettingSupportsPlanetMeta = !!(currentSettingTech && currentSettingTech.supportsPlanetMeta);
	const currentSettingSelected = (()=>{
		const sections = aiSettingData && aiSettingData.sections ? aiSettingData.sections : {};
		if(Array.isArray(sections[aiSettingKey])){
			return sections[aiSettingKey];
		}
		return currentSettingOptions.slice(0);
	})();
	const currentSettingPlanetMeta = (()=>{
		const planetMeta = aiSettingData && aiSettingData.planetMeta ? aiSettingData.planetMeta : {};
		const raw = planetMeta && planetMeta[aiSettingKey] ? planetMeta[aiSettingKey] : {};
		return {
			showHouse: raw.showHouse === 0 ? 0 : 1,
			showRuler: raw.showRuler === 0 ? 0 : 1,
		};
	})();

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
			const planetMeta = {
				...(prev && prev.planetMeta ? prev.planetMeta : {}),
			};
			delete sections[aiSettingKey];
			delete planetMeta[aiSettingKey];
			return {
				...(prev || {}),
				version: 1,
				sections,
				planetMeta,
			};
		});
	}

	function onAISettingPlanetMetaChange(key, checked){
		setAiSettingData((prev)=>{
			const sectionData = {
				...(prev && prev.sections ? prev.sections : {}),
			};
			const planetMeta = {
				...(prev && prev.planetMeta ? prev.planetMeta : {}),
				[aiSettingKey]: {
					...(prev && prev.planetMeta && prev.planetMeta[aiSettingKey] ? prev.planetMeta[aiSettingKey] : {}),
					[key]: checked ? 1 : 0,
				},
			};
			return {
				...(prev || {}),
				version: 1,
				sections: sectionData,
				planetMeta,
			};
		});
	}

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
							显示星曜主宰星
						</Checkbox>
					</div>
				) : null}
			</Modal>
		</div>
	);
}

export default PageHeader;
