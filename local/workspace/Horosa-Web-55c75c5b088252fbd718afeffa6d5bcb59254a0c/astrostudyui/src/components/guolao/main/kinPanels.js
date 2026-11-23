// 七政四余页 · 七政(另一引擎)盘的行、段落、解读卡、命宫块、盘面与信息栏
// 从 GuoLaoChartMain.js 按职责拆出的 GuoLaoChartMain 方法:this 仍是 GuoLaoChartMain 实例,门面里 mixinMethods(GuoLaoChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { XQTabs as Tabs } from '../../xq-ui';
import { FreezeSubTab } from '../../comp/FreezeInactive';
import GuoLaoQizhengWheel from '../GuoLaoQizhengWheel';
import { safeList, safeMap, fmtQizhengKinRowValue, splitQizhengKinDisplayLines, qizhengKinReadingLevel, qizhengKinReadingBadge } from './format';
const TabPane = Tabs.TabPane;

export const kinPanelMethods = {
	renderQizhengKinRows(rows){
		const list = safeList(rows);
		if(!list.length){
			return <div className="horosa-qizheng-kin-empty">暂无内容</div>;
		}
		return (
			<div className="horosa-qizheng-kin-row-list">
				{list.map((item, idx)=>{
					const value = fmtQizhengKinRowValue(item);
					const lines = splitQizhengKinDisplayLines(value);
					return (
						<div className="horosa-qizheng-kin-row" key={`${item.label || 'row'}-${idx}`}>
							<span>{item.label}</span>
							<strong className={lines.length > 1 ? 'is-multiline' : ''}>
								{lines.map((line, lineIdx)=>(
									<span className="horosa-qizheng-kin-row-line" key={`${item.label || 'row'}-${idx}-${lineIdx}`}>{line}</span>
								))}
							</strong>
						</div>
					);
				})}
			</div>
		);
	},

	renderQizhengKinSection(section){
		return (
			<div className="horosa-qizheng-kin-info-card" key={section.title}>
				<h4>{section.title}</h4>
				{this.renderQizhengKinRows(section.rows)}
			</div>
		);
	},

	renderQizhengKinReadingCards(section){
		const rows = safeList(section && section.rows);
		return (
			<div className="horosa-qizheng-kin-info-card horosa-qizheng-kin-reading-card">
				<h4>{section && section.title ? section.title : '张果断语'}</h4>
				{rows.length ? (
					<div className="horosa-qizheng-kin-reading-list">
						{rows.map((item, idx)=>{
							const level = qizhengKinReadingLevel(item);
							const value = fmtQizhengKinRowValue(item);
							const lines = splitQizhengKinDisplayLines(value);
							return (
								<div className={`horosa-qizheng-kin-reading-item horosa-qizheng-kin-reading-${level}`} key={`${item.label || 'reading'}-${idx}`}>
									<div className="horosa-qizheng-kin-reading-head">
										<span>{qizhengKinReadingBadge(level)}</span>
										<strong>{item.label || '断语'}</strong>
									</div>
									<div className="horosa-qizheng-kin-reading-detail">
										{lines.map((line, lineIdx)=>(
											<p key={`${item.label || 'reading'}-${idx}-${lineIdx}`}>{line}</p>
										))}
									</div>
								</div>
							);
						})}
					</div>
				) : <div className="horosa-qizheng-kin-empty">暂无断语</div>}
			</div>
		);
	},

	renderQizhengKinMingGongBlock(mingGong){
		const data = safeMap(mingGong);
		return (
			<div className="horosa-qizheng-kin-info-stack">
				<div className="horosa-qizheng-kin-info-card">
					<h4>命宫</h4>
					{this.renderQizhengKinRows([
						{label: '地支', value: data.branch},
						{label: '宫位', value: data.house},
						{label: '入命星', value: data.planets},
					])}
				</div>
				{safeList(data.items).map((item)=>(
					<div className="horosa-qizheng-kin-info-card horosa-qizheng-kin-prose" key={item.title}>
						<h4>{item.title}</h4>
						<p>{item.text}</p>
					</div>
				))}
			</div>
		);
	},

	renderQizhengKinBoard(){
		const pan = this.shownQizhengKinPan();
		if(this.state.qizhengKinLoading && !pan){
			return <div className="horosa-qizheng-kin-status">七政四余排盘中...</div>;
		}
		if(this.state.qizhengKinError && !pan){
			return <div className="horosa-qizheng-kin-status horosa-qizheng-kin-error">{this.state.qizhengKinError}</div>;
		}
		if(!pan){
			return <div className="horosa-qizheng-kin-status">请点击起盘，或调整左侧选项。</div>;
		}
		return <GuoLaoQizhengWheel pan={pan} />;
	},

	renderQizhengKinInfoPanel(){
		const pan = this.shownQizhengKinPan();
		const qz = pan && pan.qizheng ? pan.qizheng : {};
		const sections = safeList(pan && pan.sections);
		const sectionByTitle = new Map(sections.map((item)=>[item.title, item]));
		const options = this.state.kinastroOptions || {};
		const zhangguo = safeMap(qz.zhangguo);
		const mingGong = safeMap(qz.mingGong);
		// horosa_freeze_subtabs_v1 接线:content 一律改为**惰性 thunk**(原先在数组构造时就把
		// 全部 9 个面板的元素树造出来 —— 用户只看得见 1 个)。thunk 由 FreezeSubTab 在
		// 「本面板激活过」时才求值:未激活过=零成本;已激活过的面板切走后保留 DOM/组件实例,
		// 切回时拿本轮最新 thunk 立即重渲(不重挂载、不重取数、不闪烁、不丢滚动位置)。
		const overviewContent = ()=>{
			const list = [
				sectionByTitle.get('起盘'),
				sectionByTitle.get('四柱'),
			].filter(Boolean).map((item)=>this.renderQizhengKinSection(item));
			if(options.showMingGong !== false){
				list.push(this.renderQizhengKinMingGongBlock(mingGong));
			}
			return list;
		};
		const tabs = [
			{key: 'overview', label: '概览', content: overviewContent},
			{key: 'planets', label: '星曜', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('星曜') || {title: '星曜', rows: []})},
			{key: 'houses', label: '宫位', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('十二宫') || {title: '十二宫', rows: []})},
			options.showShensha === false ? null : {key: 'shensha', label: '神煞', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('神煞') || {title: '神煞', rows: []})},
			{key: 'dasha', label: '年限', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('年限') || {title: '年限', rows: []})},
			options.showZhangguo === false ? null : {key: 'readings', label: '断语', content: ()=>(
				<div className="horosa-qizheng-kin-info-stack">
					{this.renderQizhengKinReadingCards(sectionByTitle.get('张果断语') || {title: '张果断语', rows: []})}
					<div className="horosa-qizheng-kin-info-card">
						<h4>格局目录</h4>
						<div className="horosa-qizheng-kin-chip-cloud">
							{Object.keys(safeMap(zhangguo.patternsByCategory)).map((key)=>(
								<span key={key}>{key} {safeList(zhangguo.patternsByCategory[key]).length}</span>
							))}
						</div>
					</div>
				</div>
			)},
			qz.transit ? {key: 'transit', label: '流时', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('流时') || {title: '流时', rows: []})} : null,
			qz.electional ? {key: 'electional', label: '择日', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('择日') || {title: '择日', rows: []})} : null,
			qz.mansions ? {key: 'mansion', label: '宿度', content: ()=>(
				<div className="horosa-qizheng-kin-info-stack">
					{sections.filter((item)=>/宿度$/.test(item.title)).map((item)=>this.renderQizhengKinSection(item))}
				</div>
			)} : null,
		].filter(Boolean);
		const active = tabs.some((item)=>item.key === this.state.qizhengKinActiveTab)
			? this.state.qizhengKinActiveTab
			: (tabs[0] ? tabs[0].key : 'overview');
		return (
			<Tabs
				activeKey={active}
				onChange={this.onQizhengKinTabChange}
				tabPosition="top"
				className="horosa-content-tabs horosa-guolao-tabs horosa-qizheng-kin-tabs"
			>
				{tabs.map((item)=>(
					<TabPane tab={item.label} key={item.key}>
						<FreezeSubTab active={active === item.key}>
							{()=>(
								<div className="horosa-qizheng-kin-info-stack">
									{item.content()}
								</div>
							)}
						</FreezeSubTab>
					</TabPane>
				))}
			</Tabs>
		);
	},
};
