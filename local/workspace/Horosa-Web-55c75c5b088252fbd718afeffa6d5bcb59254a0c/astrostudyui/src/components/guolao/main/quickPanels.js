// 七政四余页 · 速览面板:盘面信息、行星 / 年星 / 宫星行、格局、强弱、星曜、相位、神煞,速览弹窗与底部快捷栏
// 从 GuoLaoChartMain.js 按职责拆出的 GuoLaoChartMain 方法:this 仍是 GuoLaoChartMain 实例,门面里 mixinMethods(GuoLaoChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { XQModal, XQSlider } from '../../xq-ui';
import QuickDockBar from '../../common/QuickDockBar';
import { moiraGetZiGods, moiraCollectGods } from '../GuoLaoMoiraWheel';
import { GUOLAO_CHART_STYLE_PICK } from '../GuoLaoChartStyle';
import { GuoLaoElectionTable, GuoLaoElectionSearch } from '../GuoLaoElectionTable';
import { MOIRA_QUICK_ACTIONS } from './prefs';
import { MOIRA_YEAR_STAR_BY_STEM, MOIRA_YEAR_STAR_SEQ, MOIRA_YEAR_STAR_MAP, MOIRA_TEN_GOD_ORG, MOIRA_TEN_GOD_ALT, MOIRA_YEAR_INFO_GROUPS, MOIRA_BIRTH_GOD_ORDER, MOIRA_TRANSIT_GOD_ORDER } from './moiraConst';
import { safeList, safeMap, hasUnverifiedMoiraPatternSource, moiraStyleLevelMeta, applyMoiraStyleLevel, joinNames, joinMoiraYearItems } from './format';
import { buildGuolaoAspectRows } from './aspectsNodeMode';
import { paramsWithMoiraTransit } from './params';
import { stemBranchForYear, yearFromParams, baziStemBranch, baziText, lunarText, buildQuickPlanetRows, buildGodRowsFromChart, normalizeGodRows } from './snapshot';

// 骨架是模块级组件:中栏盘面的 memo 边界(门面里的 GuoLaoChartStage)与下面的同名方法共用这一份。
export function GuoLaoChartSkeleton(){
	return (
		<div className="horosa-guolao-chart-skeleton" aria-busy="true">
			<div className="horosa-guolao-chart-skeleton-ring" />
			<div className="horosa-guolao-chart-skeleton-ring is-mid" />
			<div className="horosa-guolao-chart-skeleton-ring is-core" />
			<div className="horosa-guolao-chart-skeleton-hint">排盘中…</div>
		</div>
	);
}

export const quickPanelMethods = {
	renderMoiraSection(title, children, extraClass = ''){
		return (
			<div className={`horosa-guolao-quick-section ${extraClass}`.trim()}>
				<div className="horosa-guolao-quick-section-title">{title}</div>
				{children}
			</div>
		);
	},

	renderMoiraEmpty(text){
		return (
			<div className="horosa-guolao-quick-empty">{text}</div>
		);
	},

	renderQuickMeta(items){
		return (
			<div className="horosa-guolao-quick-meta-grid">
				{items.filter((item)=>item && item.value !== undefined && item.value !== null && item.value !== '').map((item)=>(
					<div className="horosa-guolao-quick-meta" key={item.label}>
						<span>{item.label}</span>
						<strong>{item.value}</strong>
					</div>
				))}
			</div>
		);
	},

	renderQuickPlanetRows(rows){
		if(!rows.length){
			return this.renderMoiraEmpty('当前星历响应里没有可输出的星曜数据。');
		}
		return (
			<div className="horosa-guolao-quick-table horosa-guolao-quick-planet-table">
				<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
					<span>星曜</span><span>宫位</span><span>黄道</span><span>宿度</span><span>势态</span><span>速度</span>
				</div>
				{rows.map((row)=>(
					<div className="horosa-guolao-quick-table-row" key={row.id}>
						<strong>{row.name}</strong>
						<span>{row.house || '-'}</span>
						<span>{row.degree || row.signName || '-'}</span>
						<span>{row.su28 ? `${row.su28} ${row.compactDegree}` : row.compactDegree}</span>
						<span>{[row.dignity, row.status].filter(Boolean).join(' / ') || '-'}</span>
						<span>{row.speed || '-'}</span>
					</div>
				))}
			</div>
		);
	},

	renderQuickYearPlanetRows(rows){
		const list = safeList(rows);
		if(!list.length){
			return this.renderMoiraEmpty('当前 Moira 规则层未返回化曜数据。');
		}
		return (
			<div className="horosa-guolao-quick-table horosa-guolao-quick-planet-table">
				<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
					<span>曜</span><span>化曜</span><span>同归项</span><span></span><span></span><span></span>
				</div>
				{list.map((row)=>(
					<div className="horosa-guolao-quick-table-row" key={row.star}>
						<strong>{row.star}</strong>
						<span>{row.changeTo || '-'}</span>
						<span>{joinNames(row.items)}</span>
						<span></span><span></span><span></span>
					</div>
				))}
			</div>
		);
	},

	renderQuickYearGroups(groups){
		const list = safeList(groups);
		if(!list.length){
			return this.renderMoiraEmpty('当前 Moira 规则层未返回天禄至天权数据。');
		}
		return (
			<div className="horosa-guolao-quick-card-grid horosa-guolao-quick-year-grid">
				{list.map((group, idx)=>(
					<div className="horosa-guolao-quick-card" key={`${group.main || 'group'}-${idx}`}>
						<div className="horosa-guolao-quick-card-title">{group.main || '-'}</div>
						<div className="horosa-guolao-quick-card-text">{joinMoiraYearItems(group.items)}</div>
					</div>
				))}
			</div>
		);
	},

	renderQuickYearSignRows(rows){
		const list = safeList(rows);
		if(!list.length){
			return this.renderMoiraEmpty('当前 Moira 规则层未返回命曜数据。');
		}
		return (
			<div className="horosa-guolao-quick-table horosa-guolao-quick-weak-table">
				<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
					<span>宫名</span><span>化曜</span><span>曜名</span><span>宫性</span>
				</div>
				{list.map((row)=>(
					<div className="horosa-guolao-quick-table-row" key={`${row.mode || 'year'}-${row.name}`}>
						<strong>{row.name}</strong>
						<span>{row.star || '-'}</span>
						<span>{row.shortName || '-'}</span>
						<span>{[row.quality, row.zi, row.signName].filter(Boolean).join(' · ')}</span>
					</div>
				))}
			</div>
		);
	},

		renderQuickPatterns(){
			const rules = this.state.moiraRules || {};
			const unverifiedSource = hasUnverifiedMoiraPatternSource(rules);
			const meta = moiraStyleLevelMeta(rules, this.state.moiraStyleLevel);
			const allPatterns = unverifiedSource ? [] : safeList(rules.patterns);
			const byLevel = applyMoiraStyleLevel(allPatterns, meta);
			const patterns = byLevel;
			const warning = rules.styleWarning || (unverifiedSource ? '当前接口返回的是旧版 Horosa 近似格局，不是 Moira 本体的政余喜格/忌格；已在前端屏蔽，避免误读。' : '');
			const good = patterns.filter((item)=>item.level === 'good');
			const bad = patterns.filter((item)=>item.level === 'bad');
			const other = patterns.filter((item)=>item.level !== 'good' && item.level !== 'bad');
			const renderPatternGroup = (type, label, list, emptyText)=>(
				<div className={`horosa-guolao-quick-pattern-group horosa-guolao-quick-pattern-group-${type}`}>
					<div className="horosa-guolao-quick-pattern-group-head">
						<span>{type === 'good' ? '喜' : '忌'}</span>
						<strong>{label}</strong>
						<em>{list.length} 条</em>
					</div>
					<div className="horosa-guolao-quick-pattern-chip-list">
						{list.length ? list.map((item, idx)=>(
							<span key={`${type}-${item.name}-${idx}`} title={item.detail || item.dsl || item.name}>{item.name}</span>
						)) : <i>{emptyText}</i>}
					</div>
				</div>
			);
			return (
				<div className="horosa-guolao-quick-dialog">
					{warning ? this.renderMoiraSection('格局数据源', (
						<div className="horosa-guolao-quick-warning">{warning}</div>
					)) : null}
					{this.renderMoiraSection('显示程度', (
						<div className="horosa-guolao-quick-meta horosa-guolao-quick-style-level">
							<label>
								<span>最低</span>
								<XQSlider
									className="horosa-guolao-moira-level"
									min={meta.min}
									max={meta.max}
									step={1}
									value={meta.level}
									tooltipVisible={false}
									onChange={this.onMoiraStyleLevelChange}
								/>
								<span>最高</span>
							</label>
							<div className="horosa-guolao-quick-card-text">
								当前 {meta.level} 档，显示格局档位 ≥ {meta.displayLevel}；显示 {patterns.length}/{allPatterns.length} 条命中格局。
							</div>
						</div>
					))}
					<div className="horosa-guolao-quick-pattern-output">
						{renderPatternGroup('good', '政余喜格', good, warning ? 'Moira 真实喜格 DSL 尚未接入，暂不输出正式喜格。' : '当前盘未命中 Moira 喜格。')}
						{renderPatternGroup('bad', '政余忌格', bad, warning ? 'Moira 真实忌格 DSL 尚未接入，暂不输出正式忌格。' : '当前盘未命中 Moira 忌格。')}
					</div>
				{other.length ? this.renderMoiraSection('察看项', (
					<div className="horosa-guolao-quick-card-grid">
						{other.map((item, idx)=>(
							<div className={`horosa-guolao-quick-card horosa-guolao-quick-pattern-${item.level || 'neutral'}`} key={`${item.name}-${idx}`}>
								<div className="horosa-guolao-quick-card-title">{item.name}</div>
								<div className="horosa-guolao-quick-card-text">{item.detail || 'Moira 规则命中，但后端未返回细节。'}</div>
							</div>
						))}
					</div>
				)) : null}
			</div>
		);
	},

	renderQuickYearStars(){
		const birthParams = this.genParams();
		const transitParams = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const birthYear = yearFromParams(birthParams);
		const transitYear = yearFromParams(transitParams);
		const birthGz = baziStemBranch(this.state.chartObj, 'year', birthYear);
		const transitGz = stemBranchForYear(transitYear);
		const rules = this.state.moiraRules || {};
		const nativeYearStars = safeMap(rules.yearStars);
		const birthYearStars = safeMap(nativeYearStars.birth);
		const transitYearStars = safeMap(nativeYearStars.transit);
		if(safeList(transitYearStars.groups).length || safeList(birthYearStars.groups).length){
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('年曜化星', this.renderQuickMeta([
						{label: '本命年柱', value: birthYearStars.yearPole || birthGz},
						{label: '流年年柱', value: transitYearStars.yearPole || transitGz},
						{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
						{label: '本命首曜', value: birthYearStars.yearStar},
						{label: '流年首曜', value: transitYearStars.yearStar},
						{label: '规则源', value: rules.styleSource || 'moira_s.prop'},
					]))}
					{this.renderMoiraSection('流年化曜', this.renderQuickYearPlanetRows(transitYearStars.planetRows))}
					{this.renderMoiraSection('本命化曜', this.renderQuickYearPlanetRows(birthYearStars.planetRows))}
					{this.renderMoiraSection('流年天禄至天权', this.renderQuickYearGroups(transitYearStars.groups))}
				</div>
			);
		}
		const stem = transitGz.slice(0, 1);
		const currentStar = MOIRA_YEAR_STAR_BY_STEM[stem] || '';
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('年曜化星', this.renderQuickMeta([
					{label: '本命年柱', value: birthGz},
					{label: '流年年柱', value: transitGz},
					{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
					{label: 'Moira化曜', value: currentStar ? `${stem}年化${currentStar}` : '未取得流年干'},
					{label: '年曜序', value: MOIRA_YEAR_STAR_SEQ.join('、')},
					{label: '年干序', value: MOIRA_YEAR_STAR_MAP.join('、')},
				]))}
				{this.renderMoiraSection('天禄至天权', (
					<div className="horosa-guolao-quick-card-grid horosa-guolao-quick-year-grid">
						{MOIRA_YEAR_INFO_GROUPS.map((items, idx)=>(
							<div className="horosa-guolao-quick-card" key={items[0]}>
								<div className="horosa-guolao-quick-card-title">{items[0]}</div>
								<div className="horosa-guolao-quick-card-text">{items.slice(1).join('、') || '主项'}</div>
								{idx === 0 && currentStar ? <em>本流年化星：{currentStar}</em> : null}
							</div>
						))}
					</div>
				))}
				{this.renderMoiraSection('十神序', this.renderQuickMeta([
					{label: '原十神序', value: MOIRA_TEN_GOD_ORG.join('、')},
					{label: '替代十神序', value: MOIRA_TEN_GOD_ALT.join('、')},
				]))}
			</div>
		);
	},

	renderQuickWeakSolid(){
		const rules = this.state.moiraRules || {};
		const nativeWeakSolid = safeMap(rules.weakSolid);
		const nativeHouseRows = safeList(nativeWeakSolid.houses);
		if(nativeHouseRows.length){
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('虚实宫位', (
						<div className="horosa-guolao-quick-table horosa-guolao-quick-weak-table">
							<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
								<span>宫位</span><span>虚实</span><span>虚柱</span><span>实柱</span>
							</div>
							{nativeHouseRows.map((house, idx)=>(
								<div className="horosa-guolao-quick-table-row" key={`${house.house}-${idx}`}>
									<strong>{house.house}</strong>
									<span className={house.solid ? 'horosa-guolao-quick-solid' : (house.weak ? 'horosa-guolao-quick-weak' : '')}>{house.label || '-'}</span>
									<span>{joinNames(house.weakPillars)}</span>
									<span>{joinNames(house.solidPillars)}</span>
								</div>
							))}
						</div>
					))}
					{this.renderMoiraSection('Moira口径', this.renderQuickMeta([
						{label: '虚宫', value: '按四柱旬空推虚：Moira computeWeakHouse。'},
						{label: '实宫', value: '按年、月、日、时四柱地支定实。'},
					]))}
				</div>
			);
		}
		const houses = safeList(rules.houses);
		const rows = buildQuickPlanetRows(this.state.chartObj, rules.planets);
		const byHouse = new Map();
		rows.forEach((row)=>{
			const key = row.house || '未定';
			if(!byHouse.has(key)){
				byHouse.set(key, []);
			}
			byHouse.get(key).push(row.name);
		});
		const houseRows = houses.length ? houses : Array.from(byHouse.keys()).map((name)=>({name}));
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('虚实宫位', (
					<div className="horosa-guolao-quick-table horosa-guolao-quick-weak-table">
						<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
							<span>宫位</span><span>虚实</span><span>星曜</span><span>位置</span>
						</div>
						{houseRows.map((house, idx)=>{
							const stars = byHouse.get(house.name) || [];
							return (
								<div className="horosa-guolao-quick-table-row" key={`${house.name}-${idx}`}>
									<strong>{house.name}</strong>
									<span className={stars.length ? 'horosa-guolao-quick-solid' : 'horosa-guolao-quick-weak'}>{stars.length ? '实' : '虚'}</span>
									<span>{stars.length ? stars.join('、') : '无星曜驻守'}</span>
									<span>{[house.zi, house.area, house.signName].filter(Boolean).join(' · ') || '-'}</span>
								</div>
							);
						})}
						{houseRows.length === 0 ? this.renderMoiraEmpty('当前 Moira 规则层未返回宫位虚实数据。') : null}
					</div>
				))}
				{this.renderMoiraSection('Moira口径', this.renderQuickMeta([
					{label: '虚宫', value: '无七政四余驻守的宫位，按 Moira 虚宫线口径展示。'},
					{label: '实宫', value: '有七政四余驻守的宫位，按 Moira 实宫线口径展示。'},
				]))}
			</div>
		);
	},

	renderQuickNatalStars(){
		const rules = this.state.moiraRules || {};
		const nativeRows = safeList(rules.natalYearStars);
		if(nativeRows.length){
			const anchors = safeMap(rules.anchors);
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('命曜', this.renderQuickYearSignRows(nativeRows))}
					{this.renderMoiraSection('命身锚点', this.renderQuickMeta([
						{label: '命度', value: anchors.life ? [anchors.life.signName, anchors.life.degreeText, anchors.life.zi, anchors.life.moiraHouse, anchors.lifeModeName || rules.lifeModeName].filter(Boolean).join(' · ') : ''},
						{label: '身度', value: anchors.self ? [anchors.self.signName, anchors.self.degreeText, anchors.self.zi, anchors.self.moiraHouse].filter(Boolean).join(' · ') : ''},
						{label: '四柱', value: baziText(this.state.chartObj)},
						{label: '规则源', value: rules.styleSource || 'moira_s.prop'},
					]))}
				</div>
			);
		}
		const rows = buildQuickPlanetRows(this.state.chartObj, rules.planets);
		const anchors = safeMap(rules.anchors);
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('命盘星曜', this.renderQuickPlanetRows(rows))}
				{this.renderMoiraSection('命身锚点', this.renderQuickMeta([
					{label: '命度', value: anchors.life ? [anchors.life.signName, anchors.life.degreeText, anchors.life.zi, anchors.life.moiraHouse, anchors.lifeModeName || rules.lifeModeName].filter(Boolean).join(' · ') : ''},
					{label: '身度', value: anchors.self ? [anchors.self.signName, anchors.self.degreeText, anchors.self.zi, anchors.self.moiraHouse].filter(Boolean).join(' · ') : ''},
					{label: '四柱', value: baziText(this.state.chartObj)},
					{label: '农历', value: lunarText(this.state.chartObj)},
				]))}
			</div>
		);
	},

	renderQuickTransitStars(){
		const rows = buildQuickPlanetRows(this.shownMoiraTransitChartObj(), []);
		const transitParams = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const transitYear = yearFromParams(transitParams);
		const rules = this.state.moiraRules || {};
		const nativeRows = safeList(rules.transitYearStars);
		const currentYearStars = safeMap(safeMap(rules.yearStars).transit);
		if(nativeRows.length || safeList(currentYearStars.planetRows).length){
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('流曜', this.state.moiraTransitLoading
						? this.renderMoiraEmpty('流年盘正在计算。')
						: this.renderQuickYearSignRows(nativeRows))}
					{this.renderMoiraSection('流年化曜', this.renderQuickYearPlanetRows(currentYearStars.planetRows))}
					{this.renderMoiraSection('流年参数', this.renderQuickMeta([
						{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
						{label: '流年干支', value: currentYearStars.yearPole || stemBranchForYear(transitYear)},
						{label: '规则源', value: rules.styleSource || 'moira_s.prop'},
					]))}
				</div>
			);
		}
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('流曜星体', this.state.moiraTransitLoading
					? this.renderMoiraEmpty('流年盘正在计算。')
					: this.renderQuickPlanetRows(rows))}
				{this.renderMoiraSection('流年参数', this.renderQuickMeta([
					{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
					{label: '流年干支', value: stemBranchForYear(transitYear)},
					{label: '流年化曜', value: `${stemBranchForYear(transitYear).slice(0, 1)} → ${MOIRA_YEAR_STAR_BY_STEM[stemBranchForYear(transitYear).slice(0, 1)] || '-'}`},
				]))}
			</div>
		);
	},

	renderQuickAspects(){
		// 与盘上的相位连线同一单源:七政相位、跟左栏相位药丸与容许度、隐藏的曜不列
		const rows = buildGuolaoAspectRows(this.state.chartObj && this.state.chartObj.chart, this.state.guolaoDisplay);
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('相位列表', rows.length ? (
					<div className="horosa-guolao-quick-table horosa-guolao-quick-aspect-table">
						<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
							<span>主星</span><span>相位</span><span>客星</span><span>状态</span><span>误差</span>
						</div>
						{rows.map((row)=>(
							<div className="horosa-guolao-quick-table-row" key={row.key}>
								<strong>{row.from}</strong>
								<span>{row.aspect}</span>
								<span>{row.to}</span>
								<span>{row.state}</span>
								<span>{row.orb || '-'}</span>
							</div>
						))}
					</div>
				) : this.renderMoiraEmpty('按当前勾选的相位与容许度,本盘没有成相位的星曜对。'))}
			</div>
		);
	},

	renderQuickGodRows(rows){
		if(!rows.length){
			return this.renderMoiraEmpty('当前盘没有返回可列出的神煞数据。');
		}
		return (
			<div className="horosa-guolao-quick-god-grid">
				{rows.map((row, idx)=>(
					<div className="horosa-guolao-quick-god-card" key={`${row.house}-${row.zi}-${idx}`}>
							<div className="horosa-guolao-quick-card-title">{row.house || row.zi || `宫位${idx + 1}`}</div>
							<div className="horosa-guolao-quick-card-subtitle">{[row.zi, row.signName].filter(Boolean).join(' · ')}</div>
							{safeList(row.gods).length ? <div><span>曜</span>{joinNames(row.gods)}</div> : (
								<>
									<div><span>吉</span>{joinNames(row.goodGods)}</div>
									<div><span>平</span>{joinNames(row.neutralGods)}</div>
									<div><span>忌</span>{joinNames(row.badGods)}</div>
									<div><span>岁</span>{joinNames(row.taisuiGods)}</div>
								</>
							)}
						</div>
					))}
			</div>
		);
	},

	renderQuickGods(){
		const rules = this.state.moiraRules || {};
		const birthRows = normalizeGodRows(safeList(rules.godHits).length ? rules.godHits : buildGodRowsFromChart(this.state.chartObj, this.props.fields), MOIRA_BIRTH_GOD_ORDER);
		const transitRows = normalizeGodRows(safeList(rules.transitGodHits).length ? rules.transitGodHits : buildGodRowsFromChart(this.shownMoiraTransitChartObj(), this.props.fields), MOIRA_TRANSIT_GOD_ORDER);
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('本命神煞', this.renderQuickGodRows(birthRows))}
				{this.renderMoiraSection('流年神煞', this.state.moiraTransitLoading ? this.renderMoiraEmpty('流年神煞正在计算。') : this.renderQuickGodRows(transitRows))}
				{this.renderMoiraSection('Moira显示序', this.renderQuickMeta([
					{label: '本命显示序', value: MOIRA_BIRTH_GOD_ORDER.join('、')},
					{label: '流年显示序', value: MOIRA_TRANSIT_GOD_ORDER.join('、')},
				]))}
			</div>
		);
	},

	renderMoiraQuickContent(key){
		if(this.state.moiraLoading && key !== 'transitStars'){
			return this.renderMoiraEmpty('Moira 规则层正在推演，稍后会自动填入。');
		}
		if(key === 'patterns'){
			return this.renderQuickPatterns();
		}
		if(key === 'yearStars'){
			return this.renderQuickYearStars();
		}
		if(key === 'weakSolid'){
			return this.renderQuickWeakSolid();
		}
		if(key === 'natalStars'){
			return this.renderQuickNatalStars();
		}
		if(key === 'transitStars'){
			return this.renderQuickTransitStars();
		}
		if(key === 'aspects'){
			return this.renderQuickAspects();
		}
		if(key === 'gods'){
			return this.renderQuickGods();
		}
		return this.renderMoiraEmpty('请选择一个快捷功能。');
	},

	// 化曜/虚实/命曜/流曜/相位 五类信息面板原本没有——注入为右栏常驻 tab(信息不得仅在
	// 快捷弹层可见);格局/神煞面板已有同源信息,不重复注入(格局弹窗仍留盘面徽标入口)。
	// horosa_freeze_subtabs_v1:children 一律传【thunk `()=>节点`】(GuoLaoMoiraPanel 的 extraTabs
	// 契约两种形态都吃,那边统一归一后交 FreezeSubTab)。原先是即时构造的节点 —— 择日表/择日搜索/
	// 相位三块的元素树(含 resolveElectionDeclination()、memoTransitParams()、renderQuickAspects()
	// 三次真计算)在每次本组件重渲时都跑一遍,而右栏同时只显 1 个 tab。
	// [horosa_guolao_render_slice_v1] extraTabs 数组引用稳定化(单槽缓存,照 memoTransitParams 范式):
	// children 全是读 live state 的 thunk,数组重建本身廉价——稳定引用的意义在于不击穿 Panel 侧
	// wrapperPropsEqual 记忆。键必须涵盖「不经 Panel 其它 props 流动」的轴(electionData/electionOptions)
	// + aspects 轴 chartObj(rootValue 可能被 moiraPanelChartObj 覆盖,不可依赖它传导);
	// 其余键(moiraRules/fields/moiraTransitTime 等)与 Panel props 重复=双保险,多余失效无害。
	buildMoiraExtraTabs(){
		const sig = [
			this.state.chartStyle,
			this.state.electionData,
			this.shownMoiraTransitChartObj(),   // 键 = 实际渲染的流年盘(按来源键比对后的那份,与 GuoLaoElectionTable 入参同源)
			this.state.moiraRules,
			this.state.electionOptions,
			this.props.fields,
			this.state.moiraTransitTime,
			this.state.chartObj,
		];
		if(this._extraTabsValue && this._extraTabsSig
			&& this._extraTabsSig.length === sig.length
			&& this._extraTabsSig.every((v, i)=>v === sig[i])){
			return this._extraTabsValue;
		}
		const wrap = (node)=>(<div className="horosa-guolao-moira">{node}</div>);
		const electionTabs = this.state.chartStyle === GUOLAO_CHART_STYLE_PICK ? [
			{ key: 'election', label: '择日', children: ()=>wrap(
				<GuoLaoElectionTable
					electionData={this.state.electionData}
					transitChartObj={this.shownMoiraTransitChartObj()}
					moiraRules={this.state.moiraRules}
					election={this.state.electionOptions}
					declination={this.resolveElectionDeclination()}
				/>
			) },
			{ key: 'electionSearch', label: '搜索', children: ()=>wrap(
				<GuoLaoElectionSearch
					fields={this.props.fields}
					transitParams={this.memoTransitParams()}
					onPickMoment={(row)=>this.onPickElectionMoment(row)}
				/>
			) },
		] : [];
		// 化曜/虚实/命曜/流曜 四 tab 已裁撤:化曜=概览生年化曜+星曜表已有;虚实=概览「虚实四柱」
		// 卡;命曜/流曜=星曜 tab 本命/流年两节已有——信息不重复设 tab(用户钦定)。
		const tabs = [
			...electionTabs,
			{ key: 'aspects', label: '相位', children: ()=>wrap(this.renderQuickAspects()) },
		];
		this._extraTabsSig = sig;
		this._extraTabsValue = tabs;
		return tabs;
	},

	renderMoiraQuickModal(){
		const key = this.state.moiraQuickDialog;
		const meta = MOIRA_QUICK_ACTIONS.find((item)=>item.key === key);
		return (
			<XQModal
				className="horosa-guolao-quick-modal"
				visible={!!key}
				title={meta ? `Moira ${meta.label}` : 'Moira'}
				width={980}
				footer={null}
				destroyOnClose
				onCancel={this.closeMoiraQuickDialog}
			>
				{this.renderMoiraQuickContent(key)}
			</XQModal>
		);
	},

	// 快捷栏契约:kinastro 引擎模式下原 9 键=右栏 Tabs 静态镜像,撤;精确引擎模式原 7 张
	// 速查弹层信息已全部常驻右栏(化曜/虚实/命曜/流曜/相位=注入 extraTabs;格局/神煞=面板
	// 原生 tab,格局另留盘面徽标弹窗入口)——信息不得仅在快捷栏可见。命例保存页头已有,不放。
	renderQuickDock(useKinastroQizheng){
		if(useKinastroQizheng){
			return (
				<QuickDockBar
					page="guolao"
					className="horosa-guolao-quick-dock horosa-qizheng-kin-quick-dock"
					hasResult={!!this.shownQizhengKinPan()}
					dispatch={this.props.dispatch}
				/>
			);
		}
		return (
			<QuickDockBar
				page="guolao"
				className="horosa-guolao-quick-dock"
				hasResult={!!this.state.chartObj}
				dispatch={this.props.dispatch}
			/>
		);
	},

	// 骨架已提为模块级 GuoLaoChartSkeleton(memo 边界内共用);此方法保留为同名转发,
	// 结构逐字节不变。
	renderGuolaoChartSkeleton(){
		return <GuoLaoChartSkeleton />;
	},

	// 神煞筛选清单=数据驱动:从当前盘 godHits/transitGodHits 现场收集全字集(后端 rule 引擎
	// 实际会画的字远多于固定序表——固定序只作排序前缀,新字追加,保证「选择全面+全联动」)。
	// horosa_guolao_render_memo_v1:神煞全字集收集(遍历 godHits/transitGodHits ~107 字 + 排序)
	// 原先**每帧**跑一次并返回新对象(左栏 GuoLaoInput 的 godNamePools prop 因此帧帧变新)。
	// 键=(moiraRules, chartObj, shownMoiraTransitChartObj()) 引用 —— 三者正是收集函数读取的全部输入,
	// 任一变化即重算,勾选↔盘面联动口径不变。
	collectGodNamePools(){
		const rules = this.state.moiraRules;
		const co = this.state.chartObj;
		const tco = this.shownMoiraTransitChartObj();   // 与 computeGodNamePools 实读的同一份(按来源键比对后)
		if(this._godPools && this._godPoolsRules === rules && this._godPoolsChart === co && this._godPoolsTransit === tco){
			return this._godPools;
		}
		this._godPoolsRules = rules;
		this._godPoolsChart = co;
		this._godPoolsTransit = tco;
		this._godPools = this.computeGodNamePools();
		return this._godPools;
	},

	computeGodNamePools(){
		// 与盘面绝对同源:盘面神煞环已切到 rules 引擎(godHits/transitGodHits,Moira prop 规则本尊),
		// 清单从同一 hits 收集(全集 ~107 字,勾选与盘一一联动);rules 未到回退历法 ziGods。
		const rules = this.state.moiraRules || {};
		const pickHits = (hits)=>{
			const out = [];
			const seen = new Set();
			(hits || []).forEach((h)=>{
				[].concat((h && h.gods) || [], (h && h.goodGods) || [], (h && h.neutralGods) || [], (h && h.badGods) || [], (h && h.taisuiGods) || []).forEach((g)=>{
					const name = `${g || ''}`.trim();
					if(name && !seen.has(name)){ seen.add(name); out.push(name); }
				});
			});
			return out;
		};
		const pick = (co)=>{
			const zg = moiraGetZiGods(co, co) || {};
			const out = [];
			const seen = new Set();
			Object.keys(zg).forEach((zi)=>{
				moiraCollectGods(zg, zi).forEach((g)=>{
					if(g && !seen.has(g)){ seen.add(g); out.push(g); }
				});
			});
			return out;
		};
		const orderBy = (names, order)=>{
			const inOrder = order.filter((g)=>names.indexOf(g) >= 0);
			const extras = names.filter((g)=>order.indexOf(g) < 0);
			return inOrder.concat(extras);
		};
		const birthHits = pickHits(rules.godHits);
		const transitHits = pickHits(rules.transitGodHits);
		return {
			birth: orderBy(birthHits.length ? birthHits : pick(this.state.chartObj), MOIRA_BIRTH_GOD_ORDER),
			transit: orderBy(transitHits.length ? transitHits : pick(this.shownMoiraTransitChartObj() || this.state.chartObj), MOIRA_TRANSIT_GOD_ORDER),
		};
	},
};
