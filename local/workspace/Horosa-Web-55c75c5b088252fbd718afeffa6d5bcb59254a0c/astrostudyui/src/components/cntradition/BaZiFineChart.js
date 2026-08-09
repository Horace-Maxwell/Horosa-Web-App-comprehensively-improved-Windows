import { Component } from 'react';
import { chartSCUEnabled } from '../../utils/perfFlags';
import { BaZiMsg } from '../../msg/bazimsg';
import { getSelfZuo, hiddenStemsOf, xunKongOf } from '../../utils/baziLunarLocal';
import { filterShenShaByGroups } from '../../utils/baziShenShaLocal';

const GAN_HE = [
	['甲', '己', '土'], ['乙', '庚', '金'], ['丙', '辛', '水'], ['丁', '壬', '木'], ['戊', '癸', '火'],
];
const GAN_CHONG = [
	['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸'],
];
const ZHI_LIUHE = [
	['子', '丑', '土'], ['寅', '亥', '木'], ['卯', '戌', '火'], ['辰', '酉', '金'], ['巳', '申', '水'], ['午', '未', '火'],
];
const ZHI_CHONG = [
	['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥'],
];
const ZHI_SANHE = [
	[['申', '子', '辰'], '水'], [['亥', '卯', '未'], '木'], [['寅', '午', '戌'], '火'], [['巳', '酉', '丑'], '金'],
];
const ZHI_SANHUI = [
	[['寅', '卯', '辰'], '木'], [['巳', '午', '未'], '火'], [['申', '酉', '戌'], '金'], [['亥', '子', '丑'], '水'],
];
// 地支相刑(三刑逐对 + 自刑)/六害(穿)/相破 —— 后端 FourColumns 已算同源,此处前端逐对判定补显示层(§1.6)。
const ZHI_XING = [
	['寅', '巳'], ['巳', '申'], ['申', '寅'], ['丑', '戌'], ['戌', '未'], ['未', '丑'], ['子', '卯'],
	['辰', '辰'], ['午', '午'], ['酉', '酉'], ['亥', '亥'],
];
const ZHI_HAI = [
	['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌'],
];
const ZHI_PO = [
	['子', '酉'], ['午', '卯'], ['申', '巳'], ['寅', '亥'], ['辰', '丑'], ['戌', '未'],
];
const STEM_ELEMENT = {
	甲: 'Wood',
	乙: 'Wood',
	丙: 'Fire',
	丁: 'Fire',
	戊: 'Earth',
	己: 'Earth',
	庚: 'Metal',
	辛: 'Metal',
	壬: 'Water',
	癸: 'Water',
};
const BRANCH_MAIN_STEM = {
	子: '癸',
	丑: '己',
	寅: '甲',
	卯: '乙',
	辰: '戊',
	巳: '丙',
	午: '丁',
	未: '己',
	申: '庚',
	酉: '辛',
	戌: '戊',
	亥: '壬',
};

function shortRel(item){
	if(!item){
		return '';
	}
	if(item.relative === '日元'){
		return '日元';
	}
	return BaZiMsg[item.relative] || item.relative || '';
}

function hiddenStemText(rec){
	const stems = rec && rec.stemInBranch ? rec.stemInBranch : [];
	return stems.map((item)=>`${item.cell || ''}${item.relative || ''}`).filter(Boolean);
}

function collectGods(rec){
	if(!rec){
		return [];
	}
	const gods = [];
	if(Array.isArray(rec.shenSha)){
		gods.push(...rec.shenSha);
	}
	if(Array.isArray(rec.goodGods)){
		gods.push(...rec.goodGods);
	}
	if(Array.isArray(rec.neutralGods)){
		gods.push(...rec.neutralGods);
	}
	if(Array.isArray(rec.badGods)){
		gods.push(...rec.badGods);
	}
	if(rec.stem){
		gods.push(...collectGods(rec.stem));
	}
	if(rec.branch){
		gods.push(...collectGods(rec.branch));
	}
	return Array.from(new Set(gods.filter(Boolean)));
}

function elementClass(label){
	const map = {
		木: 'wood',
		火: 'fire',
		土: 'earth',
		金: 'metal',
		水: 'water',
		冲: 'clash',
		刑: 'xing',
		害: 'hai',
		破: 'po',
	};
	return map[label] || 'neutral';
}

// 五行索引(相生序):木0 火1 土2 金3 水4。相生 (i+1)%5;相克 (i+2)%5。
const ELEMENT_INDEX = {
	Wood: 0, wood: 0, 木: 0,
	Fire: 1, fire: 1, 火: 1,
	Earth: 2, earth: 2, 土: 2,
	Metal: 3, metal: 3, 金: 3,
	Water: 4, water: 4, 水: 4,
};

// 取某干/支单元的五行索引(支取本气)。
function cellElementIndex(rec, STEM_ELEMENT_MAP, BRANCH_MAIN_STEM_MAP){
	const cell = typeof rec === 'string' ? rec : (rec && rec.cell);
	const element = (rec && rec.element) || STEM_ELEMENT_MAP[cell] || STEM_ELEMENT_MAP[BRANCH_MAIN_STEM_MAP[cell]];
	const idx = ELEMENT_INDEX[element];
	return (idx === undefined) ? null : idx;
}

// 相邻两单元五行关系:same 同 / forward A生B / backward B生A / null 克或被克(不连线)。
function interactionOf(ea, eb){
	if(ea === null || ea === undefined || eb === null || eb === undefined){
		return null;
	}
	if(ea === eb){
		return 'same';
	}
	if((ea + 1) % 5 === eb){
		return 'forward';
	}
	if((eb + 1) % 5 === ea){
		return 'backward';
	}
	return null;
}

function makeColumn(title, rec, kind, dayGan){
	const item = typeof rec === 'string' ? {
		ganzi: rec,
		stem: { cell: rec.charAt(0) },
		branch: { cell: rec.charAt(1) },
	} : (rec || {});
	const branchCell = item.branch && item.branch.cell ? item.branch.cell : '';
	const stemCell = item.stem && item.stem.cell ? item.stem.cell : '';
	const ganzi = item.ganzi || item.ganZhi || `${stemCell}${branchCell}`;
	// 藏干/空亡：原局柱自带 stemInBranch/xunEmpty；流年大运（pillarToRecord 精简记录）缺失时按支+日干就地补算。
	const stemInBranch = (item.stemInBranch && item.stemInBranch.length) ? item.stemInBranch : hiddenStemsOf(branchCell, dayGan);
	return {
		title,
		kind,
		rec: item,
		stem: stemCell,
		branch: branchCell,
		stemRel: shortRel(item.stem),
		branchRel: shortRel(item.branch), // 地支本气十神(副星);流年大运精简记录无 relative 时为空,无害
		hidden: hiddenStemText({ stemInBranch }),
		shenSha: collectGods(item),
		naying: item.naying || '',
		nayingPhase: item.nayingPhase || '',
		ganziPhase: item.ganziPhase || '',
		xunEmpty: item.xunEmpty || xunKongOf(ganzi),
	};
}

function pillarToRecord(pillar){
	if(!pillar){
		return null;
	}
	return {
		ganzi: pillar.ganzi || `${pillar.stem || ''}${pillar.branch || ''}`,
		stem: {
			cell: pillar.stem || '',
			relative: pillar.stemRel || '',
		},
		branch: {
			cell: pillar.branch || '',
			relative: pillar.branchRel || '',
		},
		naying: pillar.naYin || '',
	};
}

function getCurrentDirection(rec){
	const dirs = rec && Array.isArray(rec.direction) ? rec.direction : [];
	const nowYear = new Date().getFullYear();
	let selected = null;
	for(let i=0; i<dirs.length; i++){
		const block = dirs[i] || {};
		const start = Number(block.startYear);
		const subs = Array.isArray(block.subDirect) ? block.subDirect : [];
		if(Number.isFinite(start) && subs.length && nowYear >= start && nowYear < start + subs.length){
			selected = {
				block,
				sub: subs[nowYear - start],
			};
			break;
		}
	}
	if(!selected && dirs.length){
		const block = dirs[0] || {};
		const subs = Array.isArray(block.subDirect) ? block.subDirect : [];
		selected = {
			block,
			sub: subs[0],
		};
	}
	return selected || {};
}

function getSelectedDirection(rec, selection){
	if(!selection){
		return null;
	}
	const dirs = rec && Array.isArray(rec.direction) ? rec.direction : [];
	let block = selection.luckRaw || null;
	if(!block && selection.luckType !== 'small' && selection.luckStartYear !== null && selection.luckStartYear !== undefined){
		block = dirs.find((item)=>Number(item && item.startYear) === Number(selection.luckStartYear)) || null;
	}
	if(!block && selection.luckType !== 'small' && selection.year !== null && selection.year !== undefined){
		block = dirs.find((item)=>{
			const start = Number(item && item.startYear);
			return Number.isFinite(start) && Number(selection.year) >= start && Number(selection.year) < start + 10;
		}) || null;
	}
	let sub = selection.yearRaw || null;
	if(!sub && block && Array.isArray(block.subDirect) && selection.year !== null && selection.year !== undefined){
		const index = Number(selection.year) - Number(block.startYear);
		if(index >= 0 && index < block.subDirect.length){
			sub = block.subDirect[index];
		}
	}
	if(!sub && selection.yearPillar){
		sub = pillarToRecord(selection.yearPillar);
	}
	if(!block && selection.luckPillar){
		block = {
			mainDirect: pillarToRecord(selection.luckPillar),
		};
	}
	if(!block && !sub){
		return null;
	}
	return {
		block,
		sub,
	};
}

function relationKey(start, end, label, type){
	return `${type}-${start}-${end}-${label}`;
}

function pairRelations(values, pairs, type, relationLabel){
	const rels = [];
	for(let i=0; i<values.length; i++){
		for(let j=i + 1; j<values.length; j++){
			const a = values[i];
			const b = values[j];
			if(!a || !b){
				continue;
			}
			for(let k=0; k<pairs.length; k++){
				const pair = pairs[k];
				if((a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0])){
					const label = relationLabel || pair[2] || '';
					rels.push({
						key: relationKey(i, j, label, type),
						start: i,
						end: j,
						label,
						type,
					});
				}
			}
		}
	}
	return rels;
}

function groupRelations(values, groups, type){
	const rels = [];
	groups.forEach((group)=>{
		const branches = group[0];
		const label = group[1];
		const idxs = branches.map((branch)=>values.indexOf(branch)).filter((idx)=>idx >= 0);
		if(idxs.length === branches.length){
			const start = Math.min(...idxs);
			const end = Math.max(...idxs);
			rels.push({
				key: relationKey(start, end, label, type),
				start,
				end,
				label,
				type,
			});
		}
	});
	return rels;
}

function compactRelations(rels, limit){
	const seen = new Set();
	return rels
		.filter((item)=>{
			if(seen.has(item.key)){
				return false;
			}
			seen.add(item.key);
			return true;
		})
		.sort((a, b)=>(b.end - b.start) - (a.end - a.start))
		.slice(0, limit);
}

function relOverlaps(a, b){
	return !(a.end < b.start || a.start > b.end);
}

function layoutRelations(rels){
	const lanes = [];
	return rels.map((item)=>{
		let lane = lanes.findIndex((line)=>!line.some((existing)=>relOverlaps(existing, item)));
		if(lane < 0){
			lane = lanes.length;
			lanes.push([]);
		}
		const next = {
			...item,
			lane,
		};
		lanes[lane].push(next);
		return next;
	});
}

// 流派标记层:school → gejuYongShen.schools 对应行(取喜忌五行);盲派 → mangpai.cells(宾主)。
// zonghe/nayin 无单一喜忌口径,不上标记(与右栏多派表不高亮口径一致)。
const SCHOOL_ROW_LABEL = { fuyi: '扶抑派', geju: '格局派', tiaohou: '调候派', bingyao: '病药派' };
const ELEMENT_CN = {
	Wood: '木', wood: '木', Fire: '火', fire: '火', Earth: '土', earth: '土',
	Metal: '金', metal: '金', Water: '水', water: '水',
};

class BaZiFineChart extends Component{
	// horosa_bazi_finechart_scu_v1（PERF-R9 Ship 6·八字族）：中栏四柱板无 state，输出**只**由下列
	// 六个 props 决定（本文件全文的 this.props.* 恰为这六个：value / mode / flowSelection /
	// showRelations / cangVersion / onlyZiGanShen —— 另有一个 fields 是传进来但从不读的）。
	// 六者引用/值全同 ⇒ 输出逐字节相同，跳过这次重渲；任一不同即返 true 照渲（宁可多渲不可漏渲）。
	// 收益：宿主 BaZi 因「只影响别处的 baziOpt/chartStyle/directLoading」重渲时，本板不再重跑
	// buildColumns + 干支刑冲合害配对 + 关系分道布局。
	// kill-switch 沿用既有 horosa.perf.chartSCU（置 '0' → 恒重渲的旧行为）。
	shouldComponentUpdate(nextProps){
		if(!chartSCUEnabled()){
			return true;
		}
		return nextProps.value !== this.props.value
			|| nextProps.mode !== this.props.mode
			|| nextProps.flowSelection !== this.props.flowSelection
			|| nextProps.showRelations !== this.props.showRelations
			|| nextProps.cangVersion !== this.props.cangVersion
			|| nextProps.onlyZiGanShen !== this.props.onlyZiGanShen;
	}

	hasDirection(rec){
		return !!(rec && Array.isArray(rec.direction) && rec.direction.length);
	}

	// 当前主用派的标记数据(showSchoolMarks 关/派无口径 → null=层完全不渲染,既有 DOM 字节不变)。
	buildSchoolMark(){
		if(this.props.showSchoolMarks === false){ return null; }
		const school = this.props.school || 'zonghe';
		const rec = this.props.value || {};
		if(school === 'mangpai'){
			const mp = rec.mangpai;
			if(!mp || !Array.isArray(mp.cells) || !mp.cells.length){ return null; }
			const roleByPillar = {};
			mp.cells.forEach((c)=>{ if(c && c.label){ roleByPillar[c.label.charAt(0)] = c.role; } });
			const zhu = mp.cells.filter((c)=>c.role === '主').map((c)=>c.label).join('·');
			const bin = mp.cells.filter((c)=>c.role === '宾').map((c)=>c.label).join('·');
			return { school, label: '盲派', roleByPillar, bar: `主位 ${zhu || '—'} ｜ 宾位 ${bin || '—'}`, note: '盲派以日时为主位(自身)、年月为宾位(外界),看主宾做功。' };
		}
		const rowLabel = SCHOOL_ROW_LABEL[school];
		const gy = rec.gejuYongShen;
		if(!rowLabel || !gy || !Array.isArray(gy.schools)){ return null; }
		const row = gy.schools.find((s)=>s && s.school === rowLabel);
		if(!row){ return null; }
		return {
			school, label: rowLabel, verdict: row.verdict || '', note: row.note || '',
			xi: new Set(row.xi || []), ji: new Set(row.ji || []),
		};
	}

	// 单元 → 标记类:喜用 is-yong / 忌 is-ji / 无标 ''。五行(中文,支按本气,与配色同源)与
	// 干字本身双匹配——调候派喜忌以天干论(如「癸·丙」),干格按字命中,支不标(调候不论支)。
	schoolMarkClass(mark, cellRec){
		if(!mark || !mark.xi){ return ''; }
		const cell = typeof cellRec === 'string' ? cellRec : (cellRec && cellRec.cell);
		if(cell && mark.xi.has(cell)){ return ' is-yong'; }
		if(cell && mark.ji.has(cell)){ return ' is-ji'; }
		const element = (cellRec && cellRec.element) || STEM_ELEMENT[cell] || STEM_ELEMENT[BRANCH_MAIN_STEM[cell]];
		const cn = ELEMENT_CN[element] || '';
		if(!cn){ return ''; }
		if(mark.xi.has(cn)){ return ' is-yong'; }
		if(mark.ji.has(cn)){ return ' is-ji'; }
		return '';
	}

	renderSchoolBar(mark){
		return (
			<div className="horosa-bazi-fine-school-bar" title={mark.note || ''}>
				<span className="horosa-bazi-fine-school-name">{mark.label}{mark.verdict ? `·${mark.verdict}` : ''}</span>
				{mark.xi && mark.xi.size ? <span className="horosa-bazi-fine-school-xi">喜 {Array.from(mark.xi).join('·')}</span> : null}
				{mark.ji && mark.ji.size ? <span className="horosa-bazi-fine-school-ji">忌 {Array.from(mark.ji).join('·')}</span> : null}
				{mark.bar ? <span className="horosa-bazi-fine-school-role">{mark.bar}</span> : null}
			</div>
		);
	}

	buildColumns(){
		const rec = this.props.value || {};
		const four = rec.fourColumns || {};
		const dayGan = four.day && four.day.stem ? four.day.stem.cell : '';
		if(this.props.mode === 'simple' || !this.hasDirection(rec)){
			return [
				makeColumn('年柱', four.year, 'natal', dayGan),
				makeColumn('月柱', four.month, 'natal', dayGan),
				makeColumn('日柱', four.day, 'day', dayGan),
				makeColumn('时柱', four.time, 'natal', dayGan),
			];
		}
		const current = getSelectedDirection(rec, this.props.flowSelection) || getCurrentDirection(rec);
		// 小运期（未起运）选中时大运列显示小运干支（经 selection.luckPillar 路由），避免空列。
		const luckRec = (current.block && current.block.mainDirect) ? current.block.mainDirect : null;
		return [
			makeColumn('流年', current.sub, 'flow', dayGan),
			makeColumn('大运', luckRec, 'luck', dayGan),
			makeColumn('年柱', four.year, 'natal', dayGan),
			makeColumn('月柱', four.month, 'natal', dayGan),
			makeColumn('日柱', four.day, 'day', dayGan),
			makeColumn('时柱', four.time, 'natal', dayGan),
		];
	}

	isNatalStart(idx, cols){
		return cols.length > 4 && idx === 2;
	}

	buildStemRelations(cols){
		const values = cols.map((item)=>item.stem);
		const rels = [...pairRelations(values, GAN_HE, 'stem-he')];
		// 刑冲破害可关(左栏「显示」开关);关闭时仅保留合/三合/三会。
		if(this.props.showRelations !== false){
			rels.push(...pairRelations(values, GAN_CHONG, 'stem-chong', '冲'));
		}
		return compactRelations(rels, 4);
	}

	buildBranchRelations(cols){
		const values = cols.map((item)=>item.branch);
		const rels = [
			...groupRelations(values, ZHI_SANHE, 'branch-sanhe'),
			...groupRelations(values, ZHI_SANHUI, 'branch-sanhui'),
			...pairRelations(values, ZHI_LIUHE, 'branch-liuhe'),
		];
		if(this.props.showRelations !== false){
			rels.push(
				...pairRelations(values, ZHI_CHONG, 'branch-chong', '冲'),
				...pairRelations(values, ZHI_XING, 'branch-xing', '刑'),
				...pairRelations(values, ZHI_HAI, 'branch-hai', '害'),
				...pairRelations(values, ZHI_PO, 'branch-po', '破'),
			);
		}
		return compactRelations(rels, 9);
	}

	getElementColor(rec){
		const cell = typeof rec === 'string' ? rec : (rec && rec.cell);
		const element = (rec && rec.element) || STEM_ELEMENT[cell] || STEM_ELEMENT[BRANCH_MAIN_STEM[cell]];
		const map = {
			Wood: 'var(--horosa-bazi-wood)',
			wood: 'var(--horosa-bazi-wood)',
			Fire: 'var(--horosa-bazi-fire)',
			fire: 'var(--horosa-bazi-fire)',
			Earth: 'var(--horosa-bazi-earth)',
			earth: 'var(--horosa-bazi-earth)',
			Metal: 'var(--horosa-bazi-metal)',
			metal: 'var(--horosa-bazi-metal)',
			Water: 'var(--horosa-bazi-water)',
			water: 'var(--horosa-bazi-water)',
		};
		return map[element] || undefined;
	}

	renderHeader(cols, schoolMark){
		const roles = schoolMark && schoolMark.roleByPillar;
		return (
			<div className="horosa-bazi-fine-row horosa-bazi-fine-header">
				<div className="horosa-bazi-fine-label" />
				{cols.map((item, idx)=>{
					const role = roles ? roles[item.title.charAt(0)] : '';
					return (
						<div className={`horosa-bazi-fine-cell ${this.isNatalStart(idx, cols) ? 'horosa-bazi-fine-natal-start' : ''}`} key={item.title}>
							{item.title}
							{role ? <em className={`horosa-bazi-fine-role-tag ${role === '主' ? 'is-zhu' : 'is-bin'}`}>{role}</em> : null}
						</div>
					);
				})}
			</div>
		);
	}

	renderSimpleRow(label, cols, getter, className){
		return (
			<div className={`horosa-bazi-fine-row ${className || ''}`}>
				<div className="horosa-bazi-fine-label">{label}</div>
				{cols.map((item, idx)=>(
					<div className={`horosa-bazi-fine-cell ${this.isNatalStart(idx, cols) ? 'horosa-bazi-fine-natal-start' : ''}`} key={`${label}-${idx}`}>
						{getter(item, idx)}
					</div>
				))}
			</div>
		);
	}

	renderRelationLayer(rels, className, colCount){
		const cols = colCount || 1;
		const laid = layoutRelations(rels);
		const laneCount = laid.reduce((max, item)=>Math.max(max, item.lane + 1), 1);
		const gridHeight = Math.max(28, laneCount * 24 + 6);
		return (
			<div className={`horosa-bazi-fine-row horosa-bazi-fine-relation-row ${className || ''}`} style={{ minHeight: gridHeight + 4 }}>
				<div className="horosa-bazi-fine-label" />
				<div
					className="horosa-bazi-fine-relation-grid"
					style={{
						gridColumn: `2 / span ${cols}`,
						height: gridHeight,
					}}
				>
					{laid.map((item)=>{
						const left = ((item.start + 0.5) / cols) * 100;
						const width = Math.max(0, ((item.end - item.start) / cols) * 100);
						return (
						<div
							className={`horosa-bazi-fine-relation horosa-bazi-fine-relation-${elementClass(item.label)}`}
							style={{
								left: `${left}%`,
								top: `${item.lane * 24}px`,
								width: `${width}%`,
							}}
							key={item.key}
						>
							<span>{item.label}</span>
						</div>
					);})}
				</div>
			</div>
		);
	}

	// 横向相邻互动连线(同行左右):叠在对应行上,行内垂直居中,落在两字之间。which='stem'|'branch'。
	renderHConnOverlay(cols, which){
		const N = cols.length;
		if(!N){ return null; }
		const elems = cols.map((c)=>cellElementIndex(which === 'stem' ? c.rec.stem : c.rec.branch, STEM_ELEMENT, BRANCH_MAIN_STEM));
		const conns = [];
		for(let i=0; i<N - 1; i++){
			const r = interactionOf(elems[i], elems[i + 1]);
			if(r){ conns.push({ i, rel: r }); }
		}
		if(!conns.length){ return null; }
		return (
			<div className="horosa-bazi-fine-hconn-layer" aria-hidden="true">
				{conns.map((c)=>{
					const left = ((c.i + 0.68) / N) * 100;
					const width = (0.64 / N) * 100;
					const arrow = c.rel === 'forward' ? 'right' : (c.rel === 'backward' ? 'left' : '');
					return (
						<div key={`${which}-${c.i}`} className="horosa-bazi-fine-conn horosa-bazi-fine-conn-h" style={{ left: `${left}%`, width: `${width}%`, top: '50%' }}>
							<span className="horosa-bazi-fine-conn-line" />
							{arrow ? <span className={`horosa-bazi-fine-conn-arrow horosa-bazi-fine-conn-arrow-${arrow}`} /> : null}
						</div>
					);
				})}
			</div>
		);
	}

	// 纵向相邻互动连线(同柱上下):天干与地支之间一条专用间隔行,箭头落于间隔,不压字。
	renderVConnRow(cols){
		const N = cols.length;
		if(!N){ return null; }
		const stems = cols.map((c)=>cellElementIndex(c.rec.stem, STEM_ELEMENT, BRANCH_MAIN_STEM));
		const branches = cols.map((c)=>cellElementIndex(c.rec.branch, STEM_ELEMENT, BRANCH_MAIN_STEM));
		return (
			<div className="horosa-bazi-fine-row horosa-bazi-fine-vconn-row" aria-hidden="true">
				<div className="horosa-bazi-fine-label" />
				{cols.map((item, i)=>{
					const r = interactionOf(stems[i], branches[i]);
					if(!r){ return <div className="horosa-bazi-fine-cell" key={`vc-${i}`} />; }
					const arrow = r === 'forward' ? 'down' : (r === 'backward' ? 'up' : '');
					return (
						<div className="horosa-bazi-fine-cell horosa-bazi-fine-vconn-cell" key={`vc-${i}`}>
							<span className="horosa-bazi-fine-conn-vline" />
							{arrow ? <span className={`horosa-bazi-fine-conn-arrow horosa-bazi-fine-conn-arrow-${arrow}`} /> : null}
						</div>
					);
				})}
			</div>
		);
	}

	renderHiddenRow(cols){
		// 藏干版本=分野加权：月柱藏干中「当令司令」之干高亮加重（司令取 bazi.fenYe.ruler）。
		const fenYe = this.props.value && this.props.value.fenYe;
		const siling = (this.props.cangVersion === 'fenye' && fenYe && fenYe.ruler) ? fenYe.ruler.gan : '';
		return (
			<div className="horosa-bazi-fine-row horosa-bazi-fine-hidden-row">
				<div className="horosa-bazi-fine-label">藏干</div>
				{cols.map((item, idx)=>(
					<div className={`horosa-bazi-fine-cell ${this.isNatalStart(idx, cols) ? 'horosa-bazi-fine-natal-start' : ''}`} key={`hidden-${idx}`}>
						{item.hidden.map((txt, subIdx)=>{
							const isSiling = siling && item.title === '月柱' && `${txt}`.charAt(0) === siling;
							return <span key={`${txt}-${subIdx}`} className={isSiling ? 'horosa-bazi-fine-siling' : ''}>{txt}</span>;
						})}
					</div>
				))}
			</div>
		);
	}

	renderShenShaRow(cols){
		return (
			<div className="horosa-bazi-fine-row horosa-bazi-fine-shensha-row">
				<div className="horosa-bazi-fine-label">神煞</div>
				{cols.map((item, idx)=>{
					// 神煞分组过滤(G8):默认全开=原数组直返零回归;先过滤再截 6,免得被隐藏组占名额。
					const names = filterShenShaByGroups(item.shenSha, this.props.shenshaGroups);
					return (
						<div className={`horosa-bazi-fine-cell ${this.isNatalStart(idx, cols) ? 'horosa-bazi-fine-natal-start' : ''}`} key={`shensha-${idx}`}>
							{names.length ? names.slice(0, 6).map((txt)=>(
								<span key={txt}>{txt}</span>
							)) : <span className="horosa-bazi-fine-empty">—</span>}
						</div>
					);
				})}
			</div>
		);
	}

	render(){
		const cols = this.buildColumns();
		const dayGan = (cols.find((c)=>c.kind === 'day') || {}).stem || '';
		const stemRelations = this.buildStemRelations(cols);
		const branchRelations = this.buildBranchRelations(cols);
		const isSimple = this.props.mode === 'simple';
		const schoolMark = this.buildSchoolMark();
		return (
			<div className={`horosa-bazi-fine-chart ${cols.length === 4 ? 'horosa-bazi-fine-chart-core' : ''} ${isSimple ? 'horosa-bazi-fine-chart-simple' : ''}`}>
				{schoolMark ? this.renderSchoolBar(schoolMark) : null}
				{this.renderHeader(cols, schoolMark)}
				{this.renderSimpleRow('主星', cols, (item)=><strong>{item.stemRel}</strong>, 'horosa-bazi-fine-main-star-row')}
				{this.renderRelationLayer(stemRelations, 'horosa-bazi-fine-stem-relations', cols.length)}
				<div className="horosa-bazi-fine-row-wrap">
					{this.renderSimpleRow('天干', cols, (item)=>(
						<span className={`horosa-bazi-fine-glyph${this.schoolMarkClass(schoolMark, item.rec.stem)}`} style={{ color: this.getElementColor(item.rec.stem) }}>{item.stem}</span>
					), 'horosa-bazi-fine-stem-row')}
					{this.renderHConnOverlay(cols, 'stem')}
				</div>
				{this.renderVConnRow(cols)}
				<div className="horosa-bazi-fine-row-wrap">
					{this.renderSimpleRow('地支', cols, (item)=>(
						<span className={`horosa-bazi-fine-glyph${this.schoolMarkClass(schoolMark, item.rec.branch)}`} style={{ color: this.getElementColor(item.rec.branch) }}>{item.branch}</span>
					), 'horosa-bazi-fine-branch-row')}
					{this.renderHConnOverlay(cols, 'branch')}
				</div>
				{this.renderRelationLayer(branchRelations, 'horosa-bazi-fine-branch-relations', cols.length)}
				{/* 副星=地支本气十神;仅在「只显示地支藏干十神」取消勾选时另立一行(默认勾选=不显=字节不变)。 */}
				{this.props.onlyZiGanShen === false ? this.renderSimpleRow('副星', cols, (item)=><strong>{item.branchRel}</strong>, 'horosa-bazi-fine-main-star-row') : null}
				{this.renderHiddenRow(cols)}
				{/* 「显示·神煞」此前只关右栏卡片,中栏盘照旧列出 —— 关了却还在显示,开关名不符实。 */}
				{isSimple && this.props.showShenSha !== false ? this.renderShenShaRow(cols) : null}
				{!isSimple ? this.renderSimpleRow('纳音', cols, (item)=><strong>{item.naying}</strong>, 'horosa-bazi-fine-info-row') : null}
				{/* [B 三档接活] 星运/自坐随「长生」档(fields.phaseType):曾恒阳顺阴逆(不吃档)=档0↔2 死档对+与主盘 diShi 两口径。 */}
				{!isSimple ? this.renderSimpleRow('星运', cols, (item)=><strong>{getSelfZuo(dayGan, item.branch, this.props.fields && this.props.fields.phaseType ? this.props.fields.phaseType.value : undefined)}</strong>, 'horosa-bazi-fine-info-row') : null}
				{!isSimple ? this.renderSimpleRow('自坐', cols, (item)=><strong>{getSelfZuo(item.stem, item.branch, this.props.fields && this.props.fields.phaseType ? this.props.fields.phaseType.value : undefined)}</strong>, 'horosa-bazi-fine-info-row') : null}
				{!isSimple ? this.renderSimpleRow('空亡', cols, (item)=><strong>{item.xunEmpty}</strong>, 'horosa-bazi-fine-info-row') : null}
			</div>
		);
	}
}

export default BaZiFineChart;
