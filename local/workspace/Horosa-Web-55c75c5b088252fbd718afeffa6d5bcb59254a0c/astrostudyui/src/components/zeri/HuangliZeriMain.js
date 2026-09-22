// [Z1·黄历择日] 择日页子技法宿主:内嵌完整 <HuangLiMain>(techniqueScope='huanglizeri' 独立快照槽,
// 与 calendar 聚合实例 keep-alive 并存互不竞写——奇门 scope 化同律),控制条经 renderExtraControls
// 插「黄历择日…」入口,弹出择吉工作台(HuangliZeriWorkbench);扫描走纯本地 huangliZeriScanEngine
// (日粒度),结果行 pick 经 ref.pickAuspiciousDay 跳该日(年度吉日榜同一回填链)。
// 快照冻结纪律(天星/奇门同款):择吉瞬间冻结 _scanCfg/_scanTree,结果行判读/日卡恒用冻结值;
// _scanUiJson 指纹驱动 resultsStale 黄条。
import { Component } from 'react';
import { restoreZeriWorkbenchFromCase, buildZeriCasePayload } from './zeriCaseRestore';
const ZERI_SCOPE = 'huanglizeri';   // 与 saveCase 的 payload.module / openKentangCaseDrawer module 同名
import HuangLiMain from '../calendar/HuangLiMain';
import HuangliZeriWorkbench from './HuangliZeriWorkbench';
import { XQButton } from '../xq-ui';
import DateTime from '../comp/DateTime';
import { openKentangCaseDrawer } from '../../utils/kentangCaseSave';
import { loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { newHuangliLeaf, newHuangliGroup, compileHuangliTree } from '../../divination/zeri/huangliZeriConditionTypes';
import { scanHuangli, explainHuangliAt } from '../../divination/zeri/huangliZeriScanEngine';
import { buildHuangliZeriSnapshotExtra } from '../../divination/zeri/huangliZeriSnapshot';
import { huangliZeriSchemeStore } from '../../divination/zeri/schemeStore';

function pad2(n){
	return n < 10 ? `0${n}` : `${n}`;
}
function todayStr(){
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function initialTree(){
	return { ...newHuangliGroup('all'), children: [newHuangliLeaf('tianshen_dao')] };
}

export default class HuangliZeriMain extends Component{
	constructor(props){
		super(props);
		const today = todayStr();
		this.state = {
			searchOpen: false,
			cfg: { startDate: today, endDate: today },
			tree: initialTree(),
			scanning: false,
			progress: null,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: 0,
		};
		this.unmounted = false;
		this.huangliRef = null;
		this._abort = null;
		this._scanCfg = null;
		this._scanTree = null;
		this._scanUiJson = '';
		this.captureHuangli = this.captureHuangli.bind(this);
		this.renderExtraControls = this.renderExtraControls.bind(this);
		this.saveCase = this.saveCase.bind(this);
		this.openSearch = this.openSearch.bind(this);
		this.runSearch = this.runSearch.bind(this);
		this.cancelScan = this.cancelScan.bind(this);
		this.onPickInterval = this.onPickInterval.bind(this);
		this.explainRow = this.explainRow.bind(this);
		this.composeAiSnapshot = this.composeAiSnapshot.bind(this);
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._abort){
			this._abort.abort();
		}
	}

	captureHuangli(inst){
		this.huangliRef = inst;
	}

	openSearch(){
		this.setState({ searchOpen: true });
	}

	currentUiJson(){
		return JSON.stringify({ cfg: this.state.cfg, tree: this.state.tree });
	}

	async runSearch(){
		if(this.state.scanning){
			return;
		}
		let compiled = null;
		try{
			compiled = compileHuangliTree(this.state.tree);
		}catch(e){
			this.setState({ scanErr: (e && e.message) || '条件无效' });
			return;
		}
		const cfg = { ...this.state.cfg };
		// 冻结择吉快照(判读/日卡恒用冻结值)
		this._scanCfg = cfg;
		this._scanTree = compiled;
		this._scanUiJson = this.currentUiJson();
		// 冻结 UI 树:详情面「设定」列用它配冻结判读树(活树被增删后按序配对会错位,审查实抓)
		this._scanUiTree = JSON.parse(JSON.stringify(this.state.tree));
		try{
			huangliZeriSchemeStore.pushHistory({ cfg }, this.state.tree);
		}catch(e){
			// 历史落盘失败不阻断择吉
		}
		this._abort = typeof AbortController !== 'undefined' ? new AbortController() : { signal: { aborted: false }, abort(){ this.signal.aborted = true; } };
		this.setState({
			scanning: true,
			progress: null,
			results: null,
			truncated: false,
			scanErr: '',
			scanEpoch: this.state.scanEpoch + 1,
		});
		try{
			const res = await scanHuangli({
				cfg,
				tree: compiled,
				signal: this._abort.signal,
				onProgress: (p)=>{
					if(this.unmounted){
						return;
					}
					this.setState({ progress: p, results: p.partial && p.partial.length ? p.partial : this.state.results });
				},
			});
			if(this.unmounted){
				return;
			}
			this.setState({ scanning: false, progress: null, results: res.intervals, truncated: res.truncated });
			// 结果落定即刷快照槽(挂载读到含命中清单的最新态;HuangLiMain 的选中日快照+择日三段)
			if(this.huangliRef && typeof this.huangliRef.saveAISnapshot === 'function'){
				try{
					this.huangliRef.saveAISnapshot();
				}catch(e){
					// 快照刷新失败不阻断
				}
			}
		}catch(e){
			if(this.unmounted){
				return;
			}
			if(e && e.name === 'AbortError'){
				this.setState({ scanning: false, progress: null });
			}else{
				this.setState({ scanning: false, progress: null, scanErr: (e && e.message) || '择吉失败' });
			}
		}
	}

	cancelScan(){
		if(this._abort){
			this._abort.abort();
		}
	}

	// 点击结果行:跳该日(黄历页选中+网格随月刷新——年度吉日榜 pickAuspiciousDay 同链),关工作台看日课。
	onPickInterval(row, which){
		if(!this.huangliRef || typeof this.huangliRef.pickAuspiciousDay !== 'function'){
			return;
		}
		const ymd = `${(which === 'end' ? row.end : row.start) || row.start}`;
		this.huangliRef.pickAuspiciousDay(ymd);
		this.setState({ searchOpen: false });
	}

	// [Q-453] 同步引擎直算(快照前 N 行判读树与工作台「详情▼」同源);explainRow 保持 Promise 形给工作台。
	explainRowSync(row){
		return explainHuangliAt({
			tree: this._scanTree,
			t: row.pick || row.start,
		});
	}

	explainRow(row){
		return Promise.resolve(this.explainRowSync(row));
	}

	// 快照 composer:黄历日课快照(选中日)之后拼「择吉三段」(段头与 aiExport preset 🔒逐字成对)。
	composeAiSnapshot(baseText){
		try{
			const extra = buildHuangliZeriSnapshotExtra({
				cfg: this._scanCfg || this.state.cfg,
				tree: this._scanUiTree || this.state.tree,	// 冻结树:与命中行同源(活树曾致条件描述≠结果,复审 F5)
				results: this.state.results,
				truncated: this.state.truncated,
				explainAt: (row)=>this.explainRowSync(row),   // [Q-453] 前 N 行判读树(全局可配)
			});
			return extra ? `${baseText ? `${baseText}\n\n` : ''}${extra}` : baseText;
		}catch(e){
			return baseText;
		}
	}

	// [挂载自检 F-36] 存为事盘:黄历页无存档钮 → 「黄历择日」事盘类型恒无实例。事发时刻=黄历页当前选中日(午时代表),
	// 快照取本宿主槽(选中日日课+择吉三段);事盘源层按 payload.module=huanglizeri 认领 payload.snapshot。
	componentDidMount(){
		restoreZeriWorkbenchFromCase(this, ZERI_SCOPE);   // [Q-270/T-264] 载入存案还原工作台态(此前五宿主写而不读)
	}

	componentDidUpdate(){
		restoreZeriWorkbenchFromCase(this, ZERI_SCOPE);
	}

	saveCase(){
		if(!this.props.dispatch){ return; }
		const h = this.huangliRef;
		const st = h && h.state ? h.state : {};
		const base = st.date && st.date.format ? st.date : new DateTime();
		const sel = st.selectedYmd;
		const ymd = sel && sel.y ? `${sel.y}-${`${sel.m}`.padStart(2, '0')}-${`${sel.d}`.padStart(2, '0')}` : base.format('YYYY-MM-DD');
		const dt = new DateTime();
		const t = dt.parse ? dt.parse(`${ymd} 12:00:00`, 'YYYY-MM-DD HH:mm:ss') : dt;
		const fields = {
			date: { value: t },
			time: { value: t.clone ? t.clone() : t },
			zone: { value: base.zone !== undefined && base.zone !== null ? base.zone : '+08:00' },
			lon: { value: st.lon || '' },
			lat: { value: '' },
			gender: { value: 1 },
		};
		let snapshot = '';
		try{ const m = loadModuleAISnapshot('huanglizeri'); snapshot = m && m.content ? `${m.content}` : ''; }catch(e){ snapshot = ''; }
		if(!snapshot){ try{ snapshot = this.composeAiSnapshot('') || ''; }catch(e){ snapshot = ''; } }
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields,
			module: 'huanglizeri',
			label: '黄历择日',
			payload: {
				module: 'huanglizeri',
				zeri: buildZeriCasePayload(this)   /* [Q-270/T-264] 补 geo/options/natal/pickText,载入存案可还原工作台与点选时刻 */,
				snapshot,
			},
		});
	}

	renderExtraControls(){
		return (
			<div className='horosa-huangli-yearbtn' style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
				<XQButton variant='primary' onClick={this.openSearch}>黄历择日…</XQButton>
				{this.props.dispatch ? <XQButton onClick={this.saveCase} data-zeri-save="1">存为事盘</XQButton> : null}
			</div>
		);
	}

	render(){
		const resultsStale = !!(this._scanUiJson && this.currentUiJson() !== this._scanUiJson);
		return (
			// rail(xq-tabs)的 tabpane 是 flex 容器:宿主必须显式撑满,否则按内容宽收缩(奇门真机实抓同病)。
			<div className="horosa-zeri-huangli-host" style={{ height: '100%', width: '100%', flex: '1 1 auto', minWidth: 0 }}>
				{/* 高度走 100%(本宿主已 100% 贴 rail 页签盒):传工作区 px 高时,老黄历按「工作区高 − 30」定高,而择日页还要分给底部快捷栏一行,
				    工作台比宿主高出一截 → 右侧「选中日详情」滚动盒底部被页签盒裁掉、滚到底也看不到最后几十像素(放大档最明显)。 */}
				<HuangLiMain
					ref={this.captureHuangli}
					height="100%"
					techniqueScope="huanglizeri"
					composeAiSnapshot={this.composeAiSnapshot}
					renderExtraControls={this.renderExtraControls}
				/>
				<HuangliZeriWorkbench
					open={this.state.searchOpen}
					onClose={()=>this.setState({ searchOpen: false })}
					cfg={this.state.cfg}
					onCfgChange={(cfg)=>this.setState({ cfg })}
					tree={this.state.tree}
					frozenTree={this._scanUiTree}
					onTreeChange={(tree)=>this.setState({ tree })}
					onRun={this.runSearch}
					onCancelScan={this.cancelScan}
					onPickInterval={this.onPickInterval}
					onExplain={this.explainRow}
					scanEpoch={this.state.scanEpoch}
					resultsStale={resultsStale}
					scanning={this.state.scanning}
					progress={this.state.progress}
					results={this.state.results}
					truncated={this.state.truncated}
					scanErr={this.state.scanErr}
				/>
			</div>
		);
	}
}
