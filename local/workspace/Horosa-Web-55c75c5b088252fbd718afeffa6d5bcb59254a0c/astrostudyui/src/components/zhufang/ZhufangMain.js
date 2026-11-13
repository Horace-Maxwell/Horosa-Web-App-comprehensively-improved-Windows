// 命 · 其他 · 诸方:玛雅历 / 十三月亮历(前端算)+ 人类图 / 灵名字母(后端 /astroextra/zhufang)。
// 与「其他」页其余技法同一版式:左栏时间与选项,中栏图,右栏表,最右是技法切换。
import { Component } from 'react';
import SpaceTimePanel, { buildDateTimeFromFields, formatSpaceTime } from '../comp/SpaceTimePanel';
import { XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { SmallTable, cardStyle } from '../astro/AstroExtraCommon';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { fetchZhufangRemote } from '../../utils/zhufangRemote';
import { geoChangeFieldsPatch } from '../../utils/eastAsiaSnapshot';
import {
	ZHUFANG_TABS, ZHUFANG_PAGE_SETTINGS, MAYAN_CORRELATIONS, zhufangParamsFromFields, localZhufangModel, zhufangSnapshotLines, mayanDate, gregorianToJdn,
	HD_CENTER_CN, HD_TYPE_CN, HD_AUTHORITY_CN, HD_PROFILE_CN, HD_DEFINITION_CN, HD_POINT_CN, SPIRIT_POINT_CN,
} from '../../utils/zhufangArts';
import ZhufangBoard from './ZhufangBoard';
import QuickDockBar from '../common/QuickDockBar';

const { TabPane } = Tabs;
const { Option } = Select;
const FILL = { flex: '1 1 auto', minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 };
const PLANET_CN = { Sun: '太阳', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
const LOAD_RETRY_MS = 8000;

export default class ZhufangMain extends Component{
	constructor(props){
		super(props);
		this.state = { ...ZHUFANG_PAGE_SETTINGS.load(), remote: null, remoteKey: '', loading: false, loadError: '' };
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
	}

	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this._mounted = true;
		this.markRuntime();
		this.load();
	}

	componentWillUnmount(){ this._mounted = false; clearTimeout(this._retryTimer); }

	componentDidUpdate(prevProps, prevState){
		if(this.requestKey() !== this.state.remoteKey && !this.state.loading && this.requestKey() !== this._failedKey){
			this.load();
		}else if(prevState.mayanCorrelation !== this.state.mayanCorrelation || prevProps.fields !== this.props.fields){
			// 只用与当前入参对得上的后端结果(失败后再改设置时 remote 还是上一组入参的)
			this.saveSnapshot(this.state.remoteKey === this.requestKey() ? this.state.remote : null);
		}
	}

	markRuntime(){
		try{
			if(typeof window === 'undefined'){ return; }
			if(!window.__horosaKinAstroCurrent || typeof window.__horosaKinAstroCurrent !== 'object'){ window.__horosaKinAstroCurrent = {}; }
			window.__horosaKinAstroCurrent.mingother = 'zhufang';
			window.__horosaKinAstroCurrent.technique = 'zhufang';
		}catch(e){ /* 只影响导出上下文 */ }
	}

	params(){ return zhufangParamsFromFields(this.props.fields); }

	requestBody(){
		const p = this.params();
		return { ...p, hdTrueNode: this.state.hdTrueNode ? 1 : 0, spiritQuadrant: this.state.spiritQuadrant };
	}

	requestKey(){
		const p = this.params();
		if(!p.date){ return ''; }
		return JSON.stringify(this.requestBody());
	}

	async load(){
		const key = this.requestKey();
		if(!key){ return; }
		this._seq = (this._seq || 0) + 1;
		const seq = this._seq;
		this.setState({ loading: true });
		try{
			const res = await fetchZhufangRemote(this.params(), this.settings());
			if(!this._mounted || seq !== this._seq){ return; }
			if(!res){ throw new Error('诸方计算失败'); }
			this._failedKey = '';
			this.setState({ remote: res, remoteKey: key, loading: false, loadError: '' });
			this.saveSnapshot(res);
		}catch(e){
			if(!this._mounted || seq !== this._seq){ return; }
			// 失败键记下:同一组入参不立刻重试,停一会儿再放开
			this._failedKey = key;
			this.setState({ loading: false, remoteKey: '', loadError: (e && e.message) || '诸方计算失败' });
			this.saveSnapshot(null);   // 与无头挂载同口径:玛雅历 / 十三月亮历照出,人类图 / 灵名写「未算出」
			clearTimeout(this._retryTimer);
			this._retryTimer = setTimeout(()=>{ if(this._mounted){ this._failedKey = ''; this.forceUpdate(); } }, LOAD_RETRY_MS);
		}
	}

	settings(){
		return { mayanCorrelation: this.state.mayanCorrelation, hdTrueNode: this.state.hdTrueNode, spiritQuadrant: this.state.spiritQuadrant };
	}

	saveSnapshot(remote){
		try{
			const p = this.params();
			const text = zhufangSnapshotLines(localZhufangModel(p, this.settings()), remote, this.settings()).join('\n');
			if(text){ saveModuleAISnapshot('zhufang', text, { date: p.date, time: p.time, zone: p.zone, lon: p.lon, lat: p.lat }); }
		}catch(e){ /* 快照失败不阻塞页面 */ }
	}

	setOpt(patch){
		ZHUFANG_PAGE_SETTINGS.save(patch);
		this.setState(patch);
	}

	onFieldsChange(field){
		if(this.props.dispatch){
			this.props.dispatch({ type: 'astro/fetchByFields', payload: { ...(this.props.fields || {}), ...field } });
		}
	}

	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		this.onFieldsChange({ date: { value: dt.clone() }, time: { value: dt.clone() }, ad: { value: dt.ad }, zone: { value: dt.zone } });
	}

	// 选地点 → 坐标 + 时区校正 → fetchByFields 重排(灵名字母读上升与宫头,随地点变)
	changeGeo(rec){
		const patch = geoChangeFieldsPatch(this.props.fields, rec);
		if(patch){ this.onFieldsChange(patch); }
	}

	renderInputPanel(){
		const fields = this.props.fields || {};
		return (
			<div className="horosa-huangji-input-stack horosa-kinastro-input-stack">
				<div>
					<div className="horosa-side-panel-title">诸方设置</div>
					<div className="horosa-side-panel-subtitle">玛雅历 · 十三月亮历 · 人类图 · 灵名字母</div>
				</div>
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel fields={fields} value={buildDateTimeFromFields(fields)} timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
						onTimeChange={this.onTimeChanged} onGeoChange={this.changeGeo} />
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title="选项" storageKey="zhufang.options" className="horosa-side-input-section">
					<div className="horosa-side-fields-inner">
						<div className="horosa-side-field">
							<div className="horosa-side-field-label">玛雅历关联常数</div>
							<Select value={this.state.mayanCorrelation} onChange={(v)=>this.setOpt({ mayanCorrelation: Number(v) })}>
								{MAYAN_CORRELATIONS.map((c)=><Option key={c} value={c}>{c}{c === 584283 ? '(默认)' : ''}</Option>)}
							</Select>
						</div>
						<div className="horosa-side-field">
							<div className="horosa-side-field-label">人类图交点</div>
							<Select value={this.state.hdTrueNode ? 'true' : 'mean'} onChange={(v)=>this.setOpt({ hdTrueNode: v === 'true' })}>
								<Option value="true">真交点(默认)</Option>
								<Option value="mean">平交点</Option>
							</Select>
						</div>
						<div className="horosa-side-field">
							<div className="horosa-side-field-label">灵名象限</div>
							<Select value={this.state.spiritQuadrant} onChange={(v)=>this.setOpt({ spiritQuadrant: Number(v) })}>
								<Option value={1}>1 · 4 · 7 · 10 宫</Option>
								<Option value={2}>2 · 5 · 8 · 11 宫</Option>
								<Option value={3}>3 · 6 · 9 · 12 宫</Option>
							</Select>
						</div>
					</div>
				</XQSideSection>
			</div>
		);
	}

	renderTables(local, remote){
		const kv = (rows)=><SmallTable columns={[{ key: 'k', title: '项' }, { key: 'v', title: '值' }]} rows={rows.map(([k, v])=>({ k, v }))} />;
		const m = local && local.mayan;
		const ds = local && local.dreamspell;
		const hd = remote && remote.humanDesign;
		const sn = remote && remote.spiritNames;
		const wait = <div style={cardStyle}>{this.state.loading ? '计算中…' : (this.state.loadError || '没有结果')}</div>;
		const panes = {
			mayan: m ? (
				<div style={FILL}>
					{kv([
						['长历', m.longCountText], ['卓尔金', `${m.tzolkin.number} ${m.tzolkin.name}`], ['哈布', `${m.haab.day} ${m.haab.name}`],
						['历轮', `${m.tzolkin.number} ${m.tzolkin.name.split(' ')[0]} ${m.haab.day} ${m.haab.name}`], ['十三日组', `${m.trecena.name} 组第 ${m.trecena.day} 日`],
						['九夜神', `G${m.lordOfNight}`], ['长历日数', m.days], ['儒略日数', gregorianToJdn(local.y, local.mo, local.d)], ['关联常数', this.state.mayanCorrelation],
					])}
					{/* 三个关联常数并排对照:常数每差一日,卓尔金 / 哈布 / 夜神整体退一日 */}
					<div style={{ ...cardStyle, marginTop: 8 }}>三个关联常数对照(左栏所选为当前)</div>
					<SmallTable fill columns={[{ key: 'c', title: '常数' }, { key: 'lc', title: '长历' }, { key: 'tz', title: '卓尔金' }, { key: 'hb', title: '哈布' }, { key: 'g', title: '夜神' }]}
						rows={MAYAN_CORRELATIONS.map((c)=>{
							const x = mayanDate(gregorianToJdn(local.y, local.mo, local.d), c);
							return { c: `${c}${c === Number(this.state.mayanCorrelation) ? ' ★' : ''}`, lc: x.longCountText, tz: `${x.tzolkin.number} ${x.tzolkin.name.split(' ')[0]}`, hb: `${x.haab.day} ${x.haab.name}`, g: `G${x.lordOfNight}` };
						})} />
				</div>
			) : <div style={cardStyle}>公元前日期不排玛雅历。</div>,
			dreamspell: ds ? kv([
				['Kin', ds.kin], ['调性', `${ds.tone} ${ds.toneName}`], ['图腾', `${ds.seal} ${ds.sealName}`], ['波符', `Kin ${ds.wavespell.kin} ${ds.wavespell.sealName}`],
				['十三月亮历日期', ds.moonDate.special || `${ds.year} 年第 ${ds.moonDate.moon} 月第 ${ds.moonDate.day} 日`],
			]) : <div style={cardStyle}>公元前日期不排十三月亮历。</div>,
			hd: hd ? (
				<div style={FILL}>
					{kv([
						['类型', HD_TYPE_CN[hd.type] || hd.type], ['内在权威', HD_AUTHORITY_CN[hd.authority] || hd.authority],
						['人生角色', `${hd.profile.join('/')} ${hd.profile.map((x)=>HD_PROFILE_CN[x]).join(' / ')}`], ['定义', HD_DEFINITION_CN[hd.definition] || ''],
						['轮回交叉', `${hd.cross[0]}/${hd.cross[1]} | ${hd.cross[2]}/${hd.cross[3]}`],
						['有定义中心', hd.defined.map((c)=>HD_CENTER_CN[c]).join('、') || '无'], ['通道', hd.channels.map((c)=>c.gates.join('-')).join('、') || '无'],
					])}
					<SmallTable columns={[{ key: 'p', title: '点' }, { key: 'per', title: '个人', align: 'right' }, { key: 'des', title: '设计', align: 'right' }]}
						rows={hd.personality.map((r, i)=>({ p: HD_POINT_CN[r.id] || r.id, per: `${r.gate}.${r.line}`, des: `${hd.design[i].gate}.${hd.design[i].line}` }))} />
				</div>
			) : wait,
			spirit: sn ? (
				<div style={FILL}>
					<SmallTable columns={[{ key: 'p', title: '要点' }, { key: 'l', title: '字母' }]}
						rows={sn.ibnEzra.map((r)=>({ p: SPIRIT_POINT_CN[r.id] || r.id, l: r.letter ? `${r.letter.glyph} ${r.letter.name}(${r.letter.index})` : '—' }))} />
					<SmallTable columns={[{ key: 'h', title: '宫' }, { key: 'a', title: '度数主星' }, { key: 's', title: '分', align: 'right' }, { key: 'l', title: '字母' }]}
						rows={[{ h: '11', a: PLANET_CN[sn.eleventh.almuten], s: sn.eleventh.score, l: `${sn.eleventh.letter.glyph} ${sn.eleventh.letter.name}` },
							...sn.quadrantRows.map((r)=>({ h: String(r.house), a: PLANET_CN[r.almuten], s: r.score, l: `${r.letter.glyph} ${r.letter.name}` }))]} />
				</div>
			) : wait,
		};
		return (
			<Tabs activeKey={this.state.tab} onChange={(key)=>this.setOpt({ tab: key })} tabPosition="top" className="horosa-huangji-tabs horosa-kinastro-tabs">
				{ZHUFANG_TABS.map((item)=>(<TabPane tab={item.label} key={item.key}><div style={{ ...FILL, height: '100%' }}>{panes[item.key]}</div></TabPane>))}
			</Tabs>
		);
	}

	// 手动重算:人类图 / 灵名字母走后端,失败后有一段不重试的静默期,这里立刻放开再取一次
	reload(){
		clearTimeout(this._retryTimer);
		this._failedKey = '';
		this.load();
	}

	// 底部快捷栏:与「其他」页其余技法同一位置
	renderBottomQuickDock(local){
		return (
			<QuickDockBar
				page="zhufang"
				className="horosa-huangji-quick-dock horosa-kinastro-quick-dock"
				hasResult={!!local}
				primary={{ key: 'reload', label: '重算', disabled: !this.requestKey() || this.state.loading, onClick: ()=>this.reload() }}
				dispatch={this.props.dispatch}
			/>
		);
	}

	renderTechniqueRail(){
		const tabs = Array.isArray(this.props.techniqueTabs) ? this.props.techniqueTabs : [];
		if(tabs.length <= 1){ return null; }
		return (
			<div className="horosa-kinastro-technique-rail">
				{tabs.map((item)=>(
					<button type="button" key={item.key} className={this.props.activeTechnique === item.key ? 'is-active' : ''}
						onClick={()=>this.props.onTechniqueChange && this.props.onTechniqueChange(item.key)}>{item.label}</button>
				))}
			</div>
		);
	}

	render(){
		const local = localZhufangModel(this.params(), this.settings());
		const remote = this.state.remoteKey === this.requestKey() ? this.state.remote : null;
		const hasRail = Array.isArray(this.props.techniqueTabs) && this.props.techniqueTabs.length > 1;
		return (
			<div className="horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-kinastro-redesign horosa-kinastro-module-mingother horosa-zhufang-redesign" style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<div className={`horosa-astro-redesign-grid horosa-huangji-redesign-grid horosa-kinastro-grid${hasRail ? ' has-technique-rail' : ''}`} style={{ position: 'relative' }}>
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">{this.renderInputPanel()}</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer" style={{ position: 'relative' }}>
							<div className="horosa-huangji-board-host horosa-kinastro-board-host" style={{ width: '100%', height: '100%' }}>
								<ZhufangBoard tab={this.state.tab} local={local} remote={remote} />
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
							<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
								<div>
									<div className="horosa-side-panel-title">诸方杂术</div>
									<div className="horosa-side-panel-subtitle">玛雅历 · 十三月亮历 · 人类图 · 灵名字母</div>
								</div>
							</div>
							{this.renderTables(local, remote)}
						</div>
						{this.renderTechniqueRail()}
					</div>
					{this.renderBottomQuickDock(local)}
				</div>
			</div>
		);
	}
}
