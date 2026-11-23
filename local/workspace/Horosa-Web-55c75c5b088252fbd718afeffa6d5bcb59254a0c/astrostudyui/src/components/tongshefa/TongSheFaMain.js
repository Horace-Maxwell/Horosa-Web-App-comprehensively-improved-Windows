import React, { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col, Divider, Tag, message } from 'antd';
import { saveModuleAISnapshot, saveModuleAISnapshotLazy } from '../../utils/moduleAiSnapshot';
import { loadFreshModuleAISnapshot } from '../../utils/moduleSnapshotRefresh';
import { getStore } from '../../utils/storageutil';
import { caseRestoreKey, openKentangCaseDrawer } from '../../utils/kentangCaseSave';
import {
	XQButton as Button,
	XQCard as Card,
	XQSelect as Select,
	XQTabs as Tabs,
	XQSideSection,
	XQSwitch,
} from '../xq-ui';
import SpaceTimePanel, { buildDateTimeFromFields } from '../comp/SpaceTimePanel';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import { subscribeRemoteNongli, timePatchFromDateTime, geoPatchFromRec } from '../../utils/divinationTimeDraft';
import styles from '../../css/styles.less';
import { withLabelCell } from '../../utils/labelCell';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { SIXIANG_PICKS, BAGUA_LIST, DEFAULT_SELECTION, POSITION_META, POSITION_KEYS, BAGUA_SANJIE_ORDER, YAO_ORIGIN, LEFT_YAO_META, RIGHT_YAO_META, MATRIX_PANEL_META, FIVE_FRIEND_EXPLANATIONS, OBSERVE_32, SANJIE_TEXT, BAGUA_DETAIL } from './main/data';
import { safeText, normalizeSelection, getBagua, shortGuaName, linePolarity, lineAdmit, lineVerb, relationByElem, buildTongSheFaModel } from './main/model';
import { formatBaguaLabel, buildTongSheFaSnapshot, groupFiveFriendItems, fiveFriendDynamicText, patternExplanation } from './main/snapshot';
export { buildTongSheFaModel } from './main/model';
export { buildTongSheFaSnapshot, buildShiYingSection, buildWuXingRelationSection } from './main/snapshot';

const { Option } = Select;
const { TabPane } = Tabs;

class TongSheFaMain extends Component{
	// 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props) {
		super(props);

		this.state = {
			selected: { ...DEFAULT_SELECTION },
			showMatrixBorder: true,
			detailTab: 'observe32',
			// [自由起盘] 占问时刻·地点草稿(统摄法手选八卦不吃占时;此仅作事盘的时地上下文,不改卦象)。
			localFields: null,
		};

		this.unmounted = false;
		this.lastRestoredCaseId = null;

		this.onBorderToggle = this.onBorderToggle.bind(this);
		this.changeSelect = this.changeSelect.bind(this);
		this.changeDetailTab = this.changeDetailTab.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.saveSnapshot = this.saveSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{
				if(this.unmounted){
					return;
				}
				this.restoreFromCurrentCase();
			};
		}
	}

	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		this.restoreFromCurrentCase(true);
		this.saveSnapshot();
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentDidUpdate(prevProps, prevState){
		// horosa_panel_ready_v1:统摄法之中栏(矩阵)与右栏(详情)全由 props.value/fields + state.selected
		// 纯派生 —— 没有「取数落定」的那一次 setState,故就绪点=这三者变更所引发的这一次 commit。
		// markPanelReady 内部按 generation 去重、且未开始交互时为空操作,重复调用无副作用。
		if(prevProps.value !== this.props.value || prevProps.fields !== this.props.fields
			|| prevState.selected !== this.state.selected){
			markPanelReady('cnyibu');
		}
		if(prevState.selected !== this.state.selected){
			this.saveSnapshot();
		}
		// 🔴 此前本方法**只看 prevState.selected、不看 fields**,等于没有载档通路:
		// 子技法面板常驻挂载,用户已停在统摄法页再从事盘列表载档时,mount 不响、hook 也不响
		// (hook 只在 currentSubTab 变化时触发,而此时子页签没变)→ 载档静默不生效。
		if(prevProps.fields !== this.props.fields && this.props.fields){ this.restoreFromCurrentCase(); }
	}

	componentWillUnmount(){
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前 state 即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(reload/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'tongshefa'){
			return;
		}
		const selected = this.state ? this.state.selected : null;
		if(!selected){
			return;
		}
		let snapshotText = '';
		try{
			snapshotText = `${buildTongSheFaSnapshot(buildTongSheFaModel(selected)) || ''}`.trim();
		}catch(e){
			snapshotText = '';
		}
		if(snapshotText){
			saveModuleAISnapshot('tongshefa', snapshotText);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = snapshotText;
			}
		}
	}

	parseCasePayload(raw){
		if(!raw){
			return null;
		}
		if(typeof raw === 'string'){
			try{
				return JSON.parse(raw);
			}catch(e){
				return null;
			}
		}
		if(typeof raw === 'object'){
			return raw;
		}
		return null;
	}

	restoreFromCurrentCase(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		// 读档去重键走共用件(kentangCaseSave.caseRestoreKey,只认显式载入):同一条记录再载入一次必换键;
		// 编辑 / 存为事盘 / 保存编辑换掉的当前事盘不是载入 → null,不还原。禁另拼一份。
		const caseVersion = caseRestoreKey('tongshefa', userState);
		if(!caseVersion){
			return;
		}
		if(!force && this.lastRestoredCaseId === caseVersion){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		if(sourceModule !== 'tongshefa' && caseType !== 'tongshefa'){
			return;
		}
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload || typeof payload !== 'object'){
			return;
		}
		let selected = null;
		if(payload.selection){
			selected = payload.selection;
		}else if(payload.tongshefa && payload.tongshefa.selection){
			selected = payload.tongshefa.selection;
		}
		if(!selected){
			return;
		}
		this.lastRestoredCaseId = caseVersion;
		this.setState({
			selected: normalizeSelection(selected),
			// 载档必清本地时地草稿:存档 divTime 取自 activeFields()(草稿优先),
			// 不清则左栏仍显示先前草稿时地,与存档所记不符。
			localFields: null,
		});
	}

	saveSnapshot(){
		const selected = this.state.selected;
		saveModuleAISnapshotLazy('tongshefa', ()=>buildTongSheFaSnapshot(buildTongSheFaModel(selected)));
	}

	onBorderToggle(val){
		this.setState({
			showMatrixBorder: val === 1,
		});
	}

	changeSelect(key, val){
		const selected = {
			...this.state.selected,
			[key]: val,
		};
		this.setState({
			selected: normalizeSelection(selected),
		});
	}

	changeDetailTab(key){
		this.setState({
			detailTab: key,
		});
	}

	// 快捷栏契约:detailTab 镜像与边框开关(左栏已有)不进栏;cnyibu 容器透传渲染。
	getQuickDockConfig(){
		return {
			hasResult: !!this.props.value,
			save: ()=>this.clickSaveCase(),
		};
	}

	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields(){
		return this.state.localFields || this.props.fields || {};
	}
	// [自由起盘] 占问时刻/地点选择 → 写本地草稿(仅入事盘,不改卦象;不写主命盘)。
	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...timePatchFromDateTime(dt) } });
	}
	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...geoPatchFromRec(rec, base) } });
	}
	clickSaveCase(){
		const flds = this.activeFields();
		if(!flds || !flds.date || !flds.time){
			message.warning('缺少时间参数，暂无法保存');
			return;
		}
		const snapshot = loadFreshModuleAISnapshot('tongshefa');   // 存案 = 页面此刻所见(先请本页按当前盘重存再读槽,与挂载 / 导出同源)
		const payload = {
			selection: this.state.selected,
			snapshot: snapshot,
		};
		// 🔴 改走共用件 openKentangCaseDrawer:此前手写 record 漏了 payload.fieldSnapshot
		// (日界点/晚子时/卦日界/时间算法)与顶层 gender —— applyCase 正是从这两处回灌口径,
		// 取不到就沿用全局当前值,载回来的盘因此可能与存档不同。
		// 共用件产出的 record 与原手写逐项等价(event/caseType/divTime/zone/lat/lon/gps/pos),
		// 且 module/version/savedAt 由它统一注入,故这里的 payload 不必再自带那三键。
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: flds,
			module: 'tongshefa',
			label: '统摄法',
			payload,
		});
	}

	renderOneYaoLine(val, key){
		if(val === 1){
			return (
				<div key={key} style={{ height: 6, backgroundColor: 'var(--horosa-text, #333)', borderRadius: 3, marginBottom: 6 }} />
			);
		}
		const partStyle = {
			height: 6,
			backgroundColor: 'var(--horosa-text, #333)',
			borderRadius: 3,
			width: '44%',
		};
		return (
			<div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
				<div style={partStyle} />
				<div style={partStyle} />
			</div>
		);
	}

	renderYaoStack(lines, prefix){
		const list = [];
		for(let i=lines.length - 1; i>=0; i--){
			list.push(this.renderOneYaoLine(lines[i], `${prefix}_${i}`));
		}
		return (
			<div style={{ width: 58, margin: '6px auto 0 auto' }}>
				{list}
			</div>
		);
	}

	renderHexColumn(label, hex, topLabel, bottomLabel){
		return (
			<div style={{ border: '1px solid var(--horosa-border, #f0f0f0)', borderRadius: 4, padding: 8, height: '100%' }}>
				<div style={{ textAlign: 'center', fontWeight: 500 }}>{label}：{hex.gua ? hex.gua.name : '—'}</div>
				<div style={{ textAlign: 'center', color: 'var(--horosa-muted, #888)', marginTop: 2 }}>{hex.gua ? `${hex.gua.house.name}宫${hex.gua.house.elem}` : ''}</div>
				<div style={{ marginTop: 8 }}>
					<div style={{ textAlign: 'center', fontSize: 13, color: 'var(--horosa-text-soft, #666)' }}>{topLabel}</div>
					<div style={{ textAlign: 'center', fontSize: 13 }}>{hex.upper.cname}（{hex.upper.name}）</div>
					{this.renderYaoStack(hex.upper.value, `${label}_up`)}
				</div>
				<Divider style={{ margin: '8px 0' }} />
				<div>
					<div style={{ textAlign: 'center', fontSize: 13, color: 'var(--horosa-text-soft, #666)' }}>{bottomLabel}</div>
					<div style={{ textAlign: 'center', fontSize: 13 }}>{hex.lower.cname}（{hex.lower.name}）</div>
					{this.renderYaoStack(hex.lower.value, `${label}_down`)}
				</div>
			</div>
		);
	}

	renderHexPanel(title, leftHex, rightHex){
		return (
			<Card size='small' title={<div style={{ textAlign: 'center' }}>{title}</div>} style={{ height: '100%' }}>
				<div style={{ textAlign: 'center', marginBottom: 8, fontWeight: 500 }}>
					（{shortGuaName(leftHex.gua ? leftHex.gua.name : '左卦')} · {shortGuaName(rightHex.gua ? rightHex.gua.name : '右卦')}）
				</div>
				<Row gutter={8}>
					<Col span={12}>
						{this.renderHexColumn('左卦', leftHex, '太阴·本体', '少阳·认识')}
					</Col>
					<Col span={12}>
						{this.renderHexColumn('右卦', rightHex, '太阳·方法', '少阴·宇宙')}
					</Col>
				</Row>
			</Card>
		);
	}

	renderMatrixYaoBlock(bagua, prefix){
		if(!bagua){
			return <div style={{ textAlign: 'center' }}>—</div>;
		}
		return (
			<div style={{ textAlign: 'center' }}>
				{this.renderYaoStack(bagua.value, `${prefix}_stack`)}
			</div>
		);
	}

	renderMatrixStylePanel(title, leftHex, rightHex){
		const subtitle = MATRIX_PANEL_META[title] || '';
		const tableStyle = { width: '100%', borderCollapse: 'collapse' };
		const borderColor = this.state.showMatrixBorder ? 'var(--horosa-border, #e8e8e8)' : 'transparent';
		const tdStyle = {
			border: `1px solid ${borderColor}`,
			padding: '6px 4px',
			textAlign: 'center',
			verticalAlign: 'middle',
		};
		const sideTd = {
			...tdStyle,
			width: '12%',
		};
		const colTd = { ...tdStyle, width: '38%' };
		const smallTitle = {
			color: 'var(--horosa-text-soft, #666)',
			fontSize: 13,
			fontWeight: 500,
		};
		return (
			<Card size='small' style={{ height: '100%' }}>
				<div style={{ textAlign: 'center', fontWeight: 600, marginBottom: 6 }}>
					{title}
				</div>
				{subtitle && (
					<div style={{ textAlign: 'center', color: 'var(--horosa-text-soft, #666)', fontSize: 12, marginTop: -2, marginBottom: 5 }}>
						{subtitle}
					</div>
				)}
				<div style={{ textAlign: 'center', marginBottom: 8 }}>
					（{shortGuaName(leftHex.gua ? leftHex.gua.name : '左卦')} · {shortGuaName(rightHex.gua ? rightHex.gua.name : '右卦')}）
				</div>
				<table style={tableStyle}>
					<tbody>
						<tr>
							<td style={sideTd}></td>
							<td style={withLabelCell({ ...colTd, ...smallTitle }, '太阴')}>太阴</td>
							<td style={withLabelCell({ ...colTd, ...smallTitle }, '太阳')}>太阳</td>
							<td style={sideTd}></td>
						</tr>
						<tr>
							<td style={sideTd}>{formatBaguaLabel(leftHex.upper)}</td>
							<td style={colTd}>{this.renderMatrixYaoBlock(leftHex.upper, `${title}_left_up`)}</td>
							<td style={colTd}>{this.renderMatrixYaoBlock(rightHex.upper, `${title}_right_up`)}</td>
							<td style={sideTd}>{formatBaguaLabel(rightHex.upper)}</td>
						</tr>
						<tr>
							<td style={sideTd}></td>
							<td style={withLabelCell(colTd, '本体')}>本体</td>
							<td style={withLabelCell(colTd, '方法')}>方法</td>
							<td style={sideTd}></td>
						</tr>
						<tr>
							<td style={sideTd}></td>
							<td style={withLabelCell({ ...colTd, ...smallTitle }, '少阳')}>少阳</td>
							<td style={withLabelCell({ ...colTd, ...smallTitle }, '少阴')}>少阴</td>
							<td style={sideTd}></td>
						</tr>
						<tr>
							<td style={sideTd}>{formatBaguaLabel(leftHex.lower)}</td>
							<td style={colTd}>{this.renderMatrixYaoBlock(leftHex.lower, `${title}_left_down`)}</td>
							<td style={colTd}>{this.renderMatrixYaoBlock(rightHex.lower, `${title}_right_down`)}</td>
							<td style={sideTd}>{formatBaguaLabel(rightHex.lower)}</td>
						</tr>
						<tr>
							<td style={sideTd}></td>
							<td style={withLabelCell(colTd, '认识')}>认识</td>
							<td style={withLabelCell(colTd, '宇宙')}>宇宙</td>
							<td style={sideTd}></td>
						</tr>
					</tbody>
				</table>
			</Card>
		);
	}

	renderObserveTab(model, tabheight){
		const cards = POSITION_KEYS.map((posKey)=>{
			const meta = POSITION_META[posKey];
			const trigram = model.selected[posKey];
			const bagua = getBagua(trigram);
			const observe = OBSERVE_32[meta.observeKey];
			const desc = observe && observe.items ? observe.items[bagua.key] : '';
			return (
				<Col span={12} key={posKey} style={{ marginBottom: 8 }}>
					<Card
						size='small'
						title={`${meta.label}：${bagua.symbol}${bagua.cname}`}
						bodyStyle={{ padding: 10 }}
					>
						<div style={{ color: 'var(--horosa-muted, #888)', marginBottom: 6 }}>{observe ? observe.intro : ''}</div>
						<div>{safeText(desc, '—')}</div>
					</Card>
				</Col>
			);
		});

		return (
			<div className={styles.scrollbar} style={{ height: tabheight, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2 }}>
				<Row gutter={8}>
					{cards}
				</Row>
			</div>
		);
	}

	renderSanJieTab(model, tabheight){
		const selectedTagMap = {};
		POSITION_KEYS.forEach((posKey)=>{
			const baguaKey = model.selected[posKey];
			if(!baguaKey){
				return;
			}
			if(!selectedTagMap[baguaKey]){
				selectedTagMap[baguaKey] = [];
			}
			selectedTagMap[baguaKey].push(POSITION_META[posKey].label);
		});
		const baguaCards = BAGUA_SANJIE_ORDER.map((baguaKey)=>{
			const bagua = getBagua(baguaKey);
			const detail = BAGUA_DETAIL[bagua.key];
			const t = bagua.value[2] === 1 ? '阳' : '阴';
			const r = bagua.value[1] === 1 ? '阳' : '阴';
			const d = bagua.value[0] === 1 ? '阳' : '阴';
			const selectedTags = selectedTagMap[bagua.key] || [];
			return (
				<Card key={bagua.key} size='small' style={{ marginBottom: 8 }} title={`${detail ? detail.title : bagua.symbol + bagua.cname}`}>
					{
						selectedTags.length > 0 && (
							<div style={{ marginBottom: 6 }}>
								{selectedTags.map((txt)=>{
									return <Tag key={`${bagua.key}_${txt}`}>{txt}</Tag>;
								})}
							</div>
						)
					}
					<div style={{ color: 'var(--horosa-text-soft, #666)', marginBottom: 6 }}>{detail ? detail.subtitle : ''}</div>
					<div style={{ marginBottom: 6 }}>三界阴阳：天界{t} · 人界{r} · 地界{d}</div>
					{detail && detail.rows.map((row, idx)=>{
						return <p key={`${bagua.key}_${idx}`} style={{ marginBottom: 8 }}>{row}</p>;
					})}
				</Card>
			);
		});

		return (
			<div className={styles.scrollbar} style={{ height: tabheight, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2 }}>
				<Card size='small' title='三界'>
					{SANJIE_TEXT.map((item)=>{
						return (
							<div key={item.title} style={{ marginBottom: 8 }}>
								<div style={{ fontWeight: 500 }}>{item.title}</div>
								<div>{item.desc}</div>
							</div>
						);
					})}
				</Card>
				<Divider style={{ margin: '10px 0' }} />
				<div style={{ color: 'var(--horosa-text-soft, #666)', marginBottom: 8 }}>八卦全文（固定显示全部八卦）：</div>
				{baguaCards}
			</div>
		);
	}

	renderYaoWeiTab(model, tabheight){
		const leftTitle = shortGuaName(model.baseLeft.gua ? model.baseLeft.gua.name : '左卦');
		const rightTitle = shortGuaName(model.baseRight.gua ? model.baseRight.gua.name : '右卦');
		const leftLines = model.baseLeft.lines.map((value, idx)=>{
			const meta = LEFT_YAO_META[idx];
			return `${idx + 1}爻（${meta.role}）为${linePolarity(value)}（${lineAdmit(value)}）。我${lineVerb(value)}【${meta.target}】。`;
		}).reverse();
		const rightLines = model.baseRight.lines.map((value, idx)=>{
			const meta = RIGHT_YAO_META[idx];
			return `${idx + 1}爻（${meta.role}）为${linePolarity(value)}（${lineAdmit(value)}）。我${lineVerb(value)}【${meta.target}】。`;
		}).reverse();

		return (
			<div className={styles.scrollbar} style={{ height: tabheight, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2 }}>
				<Card size='small' title='爻位原意' style={{ marginBottom: 8 }}>
					{YAO_ORIGIN.map((item)=>{
						return <div key={item.line}>{item.line}爻：{item.name}</div>;
					})}
				</Card>
				<Card size='small' title={`左侧${leftTitle}卦，思想上`} style={{ marginBottom: 8 }}>
					{leftLines.map((txt, idx)=>{
						return <p key={`l_${idx}`} style={{ marginBottom: 8 }}>{txt}</p>;
					})}
				</Card>
				<Card size='small' title={`右侧${rightTitle}卦，实践上`}>
					{rightLines.map((txt, idx)=>{
						return <p key={`r_${idx}`} style={{ marginBottom: 8 }}>{txt}</p>;
					})}
				</Card>
				{this.renderPreferenceSummary(model)}
			</div>
		);
	}

	renderPreferenceSummary(model){
		const buildItems = (value)=>{
			const left = model.baseLeft.lines.map((line, idx)=>{
				if(line !== value){
					return null;
				}
				const meta = LEFT_YAO_META[idx];
				return `思想·${meta.role}：${meta.target}`;
			}).filter(Boolean);
			const right = model.baseRight.lines.map((line, idx)=>{
				if(line !== value){
					return null;
				}
				const meta = RIGHT_YAO_META[idx];
				return `实践·${meta.role}：${meta.target}`;
			}).filter(Boolean);
			return left.concat(right);
		};
		const columns = [
			{ title: '我看重', items: buildItems(0) },
			{ title: '我蔑视', items: buildItems(1) },
		];
		return (
			<Card size='small' title='取舍总览' style={{ marginTop: 8 }}>
				<div className='horosa-tongshefa-preference-grid'>
					{columns.map((col)=>{
						return (
							<div className='horosa-tongshefa-preference-col' key={col.title}>
								<div className='horosa-tongshefa-mini-title'>{col.title}</div>
								{col.items.map((item)=>{
									return <div className='horosa-tongshefa-pill' key={`${col.title}_${item}`}>{item}</div>;
								})}
							</div>
						);
					})}
				</div>
			</Card>
		);
	}

	renderNaJiaTable(rows, includeShiYing){
		const thStyle = { border: '1px solid var(--horosa-border, #e8e8e8)', padding: '4px 6px', backgroundColor: 'var(--horosa-panel-soft, #fafafa)', textAlign: 'center' };
		const tdStyle = { border: '1px solid var(--horosa-border, #e8e8e8)', padding: '4px 6px', textAlign: 'center' };
		return (
			<div style={{ overflowX: 'auto', maxWidth: '100%', marginBottom: 8 }}>   {/* 窄栏放不下七列时横滚,不被卡片裁掉右侧几列 */}
			<table style={{ width: '100%', borderCollapse: 'collapse' }}>
				<thead>
					<tr>
						<th style={withLabelCell(thStyle, '左卦')}>左卦</th>
						<th style={withLabelCell(thStyle, '五行关系')}>五行关系</th>
						{includeShiYing && <th style={withLabelCell(thStyle, '世/应')}>世/应</th>}
						<th style={withLabelCell(thStyle, '爻位')}>爻位</th>
						<th style={withLabelCell(thStyle, '右卦')}>右卦</th>
						<th style={withLabelCell(thStyle, '五行关系')}>五行关系</th>
						{includeShiYing && <th style={withLabelCell(thStyle, '世/应')}>世/应</th>}
					</tr>
				</thead>
				<tbody>
					{rows.map((row)=>{
						return (
							<tr key={`row_${row.line}`}>
								<td style={tdStyle}>{row.leftPattern}</td>
								<td style={tdStyle}>{row.leftFive}</td>
								{includeShiYing && <td style={tdStyle}>{row.leftSY || ''}</td>}
								<td style={tdStyle}>{row.line}爻</td>
								<td style={tdStyle}>{row.rightPattern}</td>
								<td style={tdStyle}>{row.rightFive}</td>
								{includeShiYing && <td style={tdStyle}>{row.rightSY || ''}</td>}
							</tr>
						);
					})}
				</tbody>
			</table>
			</div>
		);
	}

	renderFiveFriendsCard(title, subtitle, mainElem, model){
		const groups = groupFiveFriendItems(mainElem, model.leftLines, model.rightLines);
		return (
			<Card size='small' title={title} style={{ marginBottom: 8 }}>
				<div className='horosa-tongshefa-card-subtitle'>
					{subtitle}
					<span className='horosa-tongshefa-main-badge'>{mainElem || '—'}为主</span>
				</div>
				<div className='horosa-tongshefa-relation-list'>
					{FIVE_FRIEND_EXPLANATIONS.map((item)=>{
						const rows = groups[item.key] || [];
						return (
							<div className='horosa-tongshefa-relation-row' key={`${title}_${item.key}`}>
								<div className='horosa-tongshefa-relation-badge'>{item.key}</div>
								<div className='horosa-tongshefa-relation-body'>
									<div className='horosa-tongshefa-relation-title'>{item.title}</div>
									<div className='horosa-tongshefa-muted'>{item.definition}</div>
									<div className='horosa-tongshefa-relation-dynamic'>{fiveFriendDynamicText(item.key, rows)}</div>
								</div>
							</div>
						);
					})}
				</div>
			</Card>
		);
	}

	renderPatternSide(title, context, pattern){
		const explanation = patternExplanation(context, pattern ? pattern.type : '');
		return (
			<div className='horosa-tongshefa-soft-panel'>
				<div className='horosa-tongshefa-mini-title'>{title}：{pattern ? pattern.type : '—'}</div>
				{
					pattern && pattern.details && pattern.details.length > 0 ? (
						<div className='horosa-tongshefa-chip-row'>
							{pattern.details.map((item)=>{
								return (
									<span className='horosa-tongshefa-chip' key={`${title}_${item.from}_${item.to}`}>
										{item.from}/{item.to}：{item.branchPair || '—'}{item.status === '无' ? '' : item.status}
									</span>
								);
							})}
						</div>
					) : (
						<div className='horosa-tongshefa-muted'>未见明显六合、六穿成局。</div>
					)
				}
				{explanation && <div className='horosa-tongshefa-explain'>{explanation}</div>}
			</div>
		);
	}

	renderBigPatternDetailCard(model){
		return (
			<Card size='small' title='大局' style={{ marginBottom: 8 }}>
				<div className='horosa-tongshefa-two-col'>
					{this.renderPatternSide('左卦', '思想', model.leftBigPattern)}
					{this.renderPatternSide('右卦', '实践', model.rightBigPattern)}
				</div>
			</Card>
		);
	}

	renderShiYingSide(title, lines, metas){
		const items = lines.map((info, idx)=>{
			if(!info.shiYing){
				return null;
			}
			const meta = metas[idx] || {};
			const rel = info.ownRel || '';
			return {
				mark: info.shiYing,
				text: `${idx + 1}爻（${meta.role || `${idx + 1}爻`}）· ${info.branch || ''}${info.elem || ''}${rel}`,
			};
		}).filter(Boolean);
		return (
			<div className='horosa-tongshefa-soft-panel'>
				<div className='horosa-tongshefa-mini-title'>{title}</div>
				{
					items.length === 0 ? (
						<div className='horosa-tongshefa-muted'>未标出世应</div>
					) : items.map((item, idx)=>{
						return (
							<div className='horosa-tongshefa-mark-row' key={`${title}_${idx}`}>
								<span className='horosa-tongshefa-round-mark'>{item.mark}</span>
								<span>{item.text}</span>
							</div>
						);
					})
				}
			</div>
		);
	}

	renderShiYingCard(model){
		return (
			<Card size='small' title='世应' style={{ marginBottom: 8 }}>
				<div className='horosa-tongshefa-explain'>
					世爻=着眼点。应爻=吸引点。吸引与着眼，是成对出现的；世爻与应爻，也总是成对，共同指明此人的第一兴趣，或者说，聚焦点。
				</div>
				<div className='horosa-tongshefa-two-col' style={{ marginTop: 8 }}>
					{this.renderShiYingSide('左卦 · 思想', model.leftLines, LEFT_YAO_META)}
					{this.renderShiYingSide('右卦 · 实践', model.rightLines, RIGHT_YAO_META)}
				</div>
			</Card>
		);
	}

	renderRiseSide(title, attacks, metas){
		return (
			<div className='horosa-tongshefa-soft-panel'>
				<div className='horosa-tongshefa-mini-title'>{title}</div>
				{
					!attacks || attacks.length === 0 ? (
						<div className='horosa-tongshefa-muted'>无明显升击。</div>
					) : attacks.map((attack)=>{
						const fromRole = metas[attack.from - 1] ? metas[attack.from - 1].role : `${attack.from}爻`;
						const targetRoles = attack.targets.map((line)=>{
							return metas[line - 1] ? metas[line - 1].role : `${line}爻`;
						}).join('、');
						return (
							<div className='horosa-tongshefa-rise-item' key={`${title}_${attack.from}_${attack.targets.join('_')}`}>
								<div className='horosa-tongshefa-relation-title'>{attack.from}击{attack.targets.join('、')}</div>
								<div className='horosa-tongshefa-muted'>有浓烈的渴望让{fromRole}上升，超越于{targetRoles}。这是阳气向上、主动突破与征服阴位的倾向。</div>
							</div>
						);
					})
				}
			</div>
		);
	}

	renderRiseDetailCard(model){
		return (
			<Card size='small' title='升降' style={{ marginBottom: 8 }}>
				<div className='horosa-tongshefa-two-col'>
					{this.renderRiseSide('左卦 · 思想', model.leftRise, LEFT_YAO_META)}
					{this.renderRiseSide('右卦 · 实践', model.rightRise, RIGHT_YAO_META)}
				</div>
				<div className='horosa-tongshefa-explain' style={{ marginTop: 8 }}>
					阳气渴望上升，直到遇到另一阳爻为止。阳击阴，就是战斗，阳想征服阴。一个爻，它本身的阴阳，是其本然；这个爻，能变化升降，是其应然。
				</div>
			</Card>
		);
	}

	renderYaoChangeDetailCard(model){
		return (
			<Card size='small' title='爻变' style={{ marginBottom: 8 }}>
				<div className='horosa-tongshefa-change-grid'>
					{model.yaoChanges.map((item)=>{
						return (
							<div className='horosa-tongshefa-change-item' key={`chg_${item.line}`}>
								<span>{item.line}爻</span>
								<strong>{item.changed ? '有变' : '不变'}</strong>
							</div>
						);
					})}
				</div>
				<div className='horosa-tongshefa-explain' style={{ marginTop: 8 }}>
					同一爻位上，左右若阴阳不同，那就是爻变。一旦发生爻变，那左右两爻的五行，就要在相互作用中激变。爻变是动荡之象，凡参与其中的爻，其阴阳性都不稳定，往往具有两面性。
				</div>
			</Card>
		);
	}

	renderNaJiaTab(model, tabheight){
		const baseRows = [];
		const leftAsMainRows = [];
		const rightAsMainRows = [];
		for(let line=6; line>=1; line--){
			const idx = line - 1;
			const left = model.leftLines[idx];
			const right = model.rightLines[idx];
			const leftOwn = relationByElem(model.leftElem, left.elem);
			const rightOwn = relationByElem(model.rightElem, right.elem);
			const leftMainLeft = relationByElem(model.leftElem, left.elem);
			const leftMainRight = relationByElem(model.leftElem, right.elem);
			const rightMainLeft = relationByElem(model.rightElem, left.elem);
			const rightMainRight = relationByElem(model.rightElem, right.elem);
			baseRows.push({
				line,
				leftPattern: left.pattern,
				rightPattern: right.pattern,
				leftFive: `${safeText(left.branch, '')}${safeText(left.elem, '')}${leftOwn || ''}` || '—',
				rightFive: `${safeText(right.branch, '')}${safeText(right.elem, '')}${rightOwn || ''}` || '—',
				leftSY: left.shiYing,
				rightSY: right.shiYing,
			});
			leftAsMainRows.push({
				line,
				leftPattern: left.pattern,
				rightPattern: right.pattern,
				leftFive: `${safeText(left.branch, '')}${safeText(left.elem, '')}${leftMainLeft || ''}` || '—',
				rightFive: `${safeText(right.branch, '')}${safeText(right.elem, '')}${leftMainRight || ''}` || '—',
			});
			rightAsMainRows.push({
				line,
				leftPattern: left.pattern,
				rightPattern: right.pattern,
				leftFive: `${safeText(left.branch, '')}${safeText(left.elem, '')}${rightMainLeft || ''}` || '—',
				rightFive: `${safeText(right.branch, '')}${safeText(right.elem, '')}${rightMainRight || ''}` || '—',
			});
		}

		return (
			<div className={styles.scrollbar} style={{ height: tabheight, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2, paddingBottom: 14 }}>
				<Card size='small' title='左右卦之五行关系' style={{ marginBottom: 8 }}>
					<div style={{ marginBottom: 6 }}>
						<Tag>{model.mainRelation}</Tag>
						<span>~（{model.mainRelationLabel}）</span>
					</div>
					<div>左卦：{model.leftElem || '—'}（思想） · {model.leftHouseLabel}</div>
					<div>右卦：{model.rightElem || '—'}（实践） · {model.rightHouseLabel}</div>
				</Card>

				<Card size='small' title='左右卦五行展开' style={{ marginBottom: 8 }}>
					{this.renderNaJiaTable(baseRows, true)}
					<div>鬼=压力与拘束；爱=心之所向；制=我所欲控；同=竞争关系；义=恩人贵人。</div>
					<div>世爻=着眼点；应爻=吸引点。</div>
				</Card>

				<Card size='small' title='左卦与十二爻（以左卦为主）' style={{ marginBottom: 8 }}>
					<div style={{ marginBottom: 6 }}>左卦属性：{model.leftElem || '—'}（思想）</div>
					{this.renderNaJiaTable(leftAsMainRows, false)}
				</Card>
				{this.renderFiveFriendsCard('五友：左卦为主', '以思想为主，十二爻是客。', model.leftElem, model)}

				<Card size='small' title='右卦与十二爻（以右卦为主）' style={{ marginBottom: 8 }}>
					<div style={{ marginBottom: 6 }}>右卦属性：{model.rightElem || '—'}（实践）</div>
					{this.renderNaJiaTable(rightAsMainRows, false)}
				</Card>
				{this.renderFiveFriendsCard('五友：右卦为主', '以实践为主，十二爻是客。', model.rightElem, model)}

				{this.renderBigPatternDetailCard(model)}
				{this.renderShiYingCard(model)}
				{this.renderRiseDetailCard(model)}
				{this.renderYaoChangeDetailCard(model)}
			</div>
		);
	}

	render(){
		// 定高一律走 100% 链(页 → 列 → 右列 flex → Tabs → pane → 叶子,样式见 .horosa-tongshefa-*):
		// 此前内层用「工作区高 − 304 / − 46」估高,常数与真实标题行 / 选择行 / 页签高不等 —— 右栏叶子滚动盒比所在 pane 高出一截,
		// 盒底那段内容落在 pane 之外、滚到底也看不见;左列同理多出十几像素。100% 链下任何缩放 / 窗高零常数。
		const height = '100%';
		const tabheight = undefined;
		const tabContentHeight = '100%';
		const leftHeight = '100%';
		const model = buildTongSheFaModel(this.state.selected);

		return (
			<div className="horosa-tongshefa-page" style={{ height, minHeight: 0, overflow: 'hidden' }}>
				<Row gutter={6} className="horosa-tongshefa-layout" style={{ height: '100%', minHeight: 0 }}>
					<Col span={16} className="horosa-tongshefa-left-col">
							<div className={styles.scrollbar} style={{ height: leftHeight, overflowY: 'auto', overflowX: 'hidden', paddingRight: 3 }}>
								<Row gutter={8}>
									<Col span={12}>
									{this.renderMatrixStylePanel('本卦', model.baseLeft, model.baseRight)}
								</Col>
								<Col span={12}>
									{this.renderMatrixStylePanel('错亲', model.oppositeLeft, model.oppositeRight)}
								</Col>
							</Row>
							<Row gutter={8} style={{ marginTop: 8 }}>
								<Col span={12}>
									{this.renderMatrixStylePanel('互潜', model.mutualLeft, model.mutualRight)}
								</Col>
							</Row>
							</div>
						</Col>
						<Col span={8} className="horosa-tongshefa-right-col">
							{/* [自由起盘] 占问时刻·地点:统摄法手选八卦不吃占时,此处记录占问的时地入事盘(不改卦象;原仅能取主命盘时间) */}
							<XQSideSection
								iconName={sideSectionIcon('time')}
								title="占问时刻 · 地点"
								collapsible={false}
								className="horosa-tongshefa-when"
								extra={(
									<span className="horosa-tongshefa-head-tools">
										<span className="horosa-tongshefa-border-switch">
											<span>显示边框</span>
											<XQSwitch
												size="small"
												aria-label="显示边框"
												checked={!!this.state.showMatrixBorder}
												onChange={(checked)=>this.onBorderToggle(checked ? 1 : 0)}
											/>
										</span>
										<Button size="small" onClick={this.clickSaveCase}>保存为事盘</Button>
									</span>
								)}
							>
								<SpaceTimePanel
									compact
									fields={this.activeFields()}
									value={buildDateTimeFromFields(this.activeFields())}
									onTimeChange={this.onTimeChanged}
									onGeoChange={this.changeGeo}
								/>
							</XQSideSection>
							<div className="horosa-tongshefa-picks">
								{SIXIANG_PICKS.map(([key, label])=>(
									<div className="horosa-tongshefa-pick" key={key}>
										<span className="horosa-tongshefa-pick-label">{label}</span>
										<Select value={model.selected[key]} onChange={(val)=>this.changeSelect(key, val)}>
											{BAGUA_LIST.map((item)=>(
												<Option key={`${key}_${item.key}`} value={item.key}>{item.symbol}{item.cname}（{item.name}）</Option>
											))}
										</Select>
									</div>
								))}
							</div>
						{/* horosa_freeze_subtabs_v1:四个详情页签(三十二观/三界/爻位/纳甲筮法)皆为长表,
						    非激活者此前每次重渲都跟着重建。冻结≠卸载,切回即拿最新 model 立刻重画。 */}
						<Tabs
							activeKey={this.state.detailTab}
							defaultActiveKey='observe32'
								onChange={this.changeDetailTab}
								tabPosition='top'
								className='horosa-tongshefa-tabs'
								style={tabheight ? { height: tabheight } : undefined}
							>
							<TabPane tab='三十二观' key='observe32'>
								<FreezeSubTab active={this.state.detailTab === 'observe32'}>{() => this.renderObserveTab(model, tabContentHeight)}</FreezeSubTab>
							</TabPane>
							<TabPane tab='三界' key='sanjie'>
								<FreezeSubTab active={this.state.detailTab === 'sanjie'}>{() => this.renderSanJieTab(model, tabContentHeight)}</FreezeSubTab>
							</TabPane>
							<TabPane tab='爻位' key='yaowei'>
								<FreezeSubTab active={this.state.detailTab === 'yaowei'}>{() => this.renderYaoWeiTab(model, tabContentHeight)}</FreezeSubTab>
							</TabPane>
							<TabPane tab='纳甲筮法' key='najia'>
								<FreezeSubTab active={this.state.detailTab === 'najia'}>{() => this.renderNaJiaTab(model, tabContentHeight)}</FreezeSubTab>
							</TabPane>
						</Tabs>
					</Col>
				</Row>
			</div>
		);
	}
}

export default TongSheFaMain;
