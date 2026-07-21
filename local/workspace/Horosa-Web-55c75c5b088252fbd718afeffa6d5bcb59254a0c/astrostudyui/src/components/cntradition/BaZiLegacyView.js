import { Component } from 'react';
import { XQTabs as Tabs } from '../xq-ui';
import { BaZiMsg } from '../../msg/bazimsg';
import MainDirectionSimple from './MainDirectionSimple';
import FourZhuGuaDesc from './FourZhuGuaDesc';
import BaZiZhangSheng from './BaZiZhangSheng';
import Gods from './Gods';
import MainDirection from './MainDirection';
import SmallDirection from './SmallDirection';
import GanHeCong from './GanHeCong';
import ZiHeCong from './ZiHeCong';
import { FreezeSubTab } from '../comp/FreezeInactive';

const TabPane = Tabs.TabPane;

const PILLAR_KEYS = [
	['year', '年柱'],
	['month', '月柱'],
	['day', '日柱'],
	['time', '时柱'],
];

const AUX_KEYS = [
	['tai', '胎元'],
	['ming', '命宫'],
	['shen', '身宫'],
	['ming12', '命宫'],
];

const STEM_COLOR = {
	Wood: 'var(--horosa-bazi-wood)',
	Fire: 'var(--horosa-bazi-fire)',
	Earth: 'var(--horosa-bazi-earth)',
	Metal: 'var(--horosa-bazi-metal)',
	Water: 'var(--horosa-bazi-water)',
};

function safeArray(value){
	return Array.isArray(value) ? value : [];
}

function getGanzi(item){
	if(!item){
		return '';
	}
	if(typeof item === 'string'){
		return item;
	}
	return item.ganzi || item.ganZhi || `${item.stem && item.stem.cell ? item.stem.cell : ''}${item.branch && item.branch.cell ? item.branch.cell : ''}`;
}

function stemCell(item){
	return item && item.stem && item.stem.cell ? item.stem.cell : '';
}

function branchCell(item){
	return item && item.branch && item.branch.cell ? item.branch.cell : '';
}

function colorOf(node){
	return node && node.element && STEM_COLOR[node.element] ? STEM_COLOR[node.element] : undefined;
}

function relationText(node){
	if(!node){
		return '';
	}
	const polar = BaZiMsg[node.polar] || '';
	const element = BaZiMsg[node.element] || '';
	const rel = BaZiMsg[node.relative] || node.relative || '';
	return `${polar}${node.cell || ''}${element}${rel ? `·${rel}` : ''}`;
}

function hiddenText(item){
	return safeArray(item && item.stemInBranch).map((stem)=>{
		const element = BaZiMsg[stem.element] || '';
		const rel = BaZiMsg[stem.relative] || stem.relative || '';
		return `${stem.cell || ''}${element}${rel ? `·${rel}` : ''}`;
	}).filter(Boolean).join('　');
}

function collectGods(item){
	if(!item){
		return [];
	}
	const gods = [
		...safeArray(item.shenSha),
		...safeArray(item.goodGods),
		...safeArray(item.neutralGods),
		...safeArray(item.badGods),
	];
	if(item.stem){
		gods.push(...collectGods(item.stem));
	}
	if(item.branch){
		gods.push(...collectGods(item.branch));
	}
	if(item.branch && Array.isArray(item.branch.taisuiGods)){
		gods.push(...item.branch.taisuiGods);
	}
	return Array.from(new Set(gods.filter(Boolean)));
}

function getGong12Text(gong12){
	if(!gong12){
		return '';
	}
	const gan = gong12['干'] && gong12['干'].name ? gong12['干'].name : '';
	const zhi = gong12['支'] && gong12['支'].name ? gong12['支'].name : '';
	return gan || zhi ? `${gan}·${zhi}` : '';
}

function line(label, value){
	if(value === undefined || value === null || value === ''){
		return null;
	}
	return (
		<div className="horosa-bazi-legacy-line" key={label}>
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}

function groupRows(obj, labels){
	const rows = [];
	(labels || []).forEach(([key, title])=>{
		const data = obj && obj[key];
		if(Array.isArray(data)){
			rows.push([title, data.join('、')]);
		}else if(data && typeof data === 'object'){
			const entries = Object.keys(data).map((name)=>{
				const value = data[name];
				if(Array.isArray(value)){
					return `${name}：${value.map((item)=>item && item.cell ? `${item.cell}${item.zhu ? `(${item.zhu})` : ''}` : item).join('、')}`;
				}
				return `${name}：${value}`;
			});
			rows.push([title, entries.join('；')]);
		}
	});
	return rows.filter((item)=>item[1]);
}

class LegacyPillar extends Component{
	render(){
		const item = this.props.value || {};
		const title = this.props.title || '';
		const gods = collectGods(item).slice(0, 4);
		const topMeta = getGong12Text(this.props.gong12) || [item.naying, item.nayingPhase].filter(Boolean).join('·');
		const stem = stemCell(item);
		const branch = branchCell(item);
		const isAux = this.props.compact;
		const needBranchRelation = !(this.props.baziOpt && this.props.baziOpt.onlyZiGanShen);
		return (
			<section className={`horosa-bazi-legacy-pillar ${isAux ? 'horosa-bazi-legacy-pillar-aux' : ''}`}>
				<h3>{title}</h3>
				<div className="horosa-bazi-legacy-pillar-meta">{topMeta || ' '}</div>
				<div className="horosa-bazi-legacy-pillar-meta">{relationText(item.stem) || ' '}</div>
				<div className="horosa-bazi-legacy-glyphs">
					<span style={{ color: colorOf(item.stem) }}>{stem}</span>
					<span style={{ color: colorOf(item.branch) }}>{branch}</span>
				</div>
				<div className="horosa-bazi-legacy-pillar-body">
					{needBranchRelation ? line('地支', relationText(item.branch)) : null}
					{line('藏干', hiddenText(item))}
					{line('空亡', item.xunEmpty)}
					{line('干支', item.ganziPhase)}
					{line('纳音', item.naying)}
					{gods.length ? line('神煞', gods.join('、')) : null}
				</div>
			</section>
		);
	}
}

function getNongliText(bazi){
	const nongli = bazi && bazi.nongli ? bazi.nongli : {};
	if(!nongli.year){
		return '';
	}
	return `${nongli.year}年${nongli.leap ? '闰' : ''}${nongli.month || ''}${nongli.day || ''}`;
}

function splitSubDirectRows(dir){
	const sub = safeArray(dir && dir.subDirect);
	const left = sub.slice(0, 5);
	const right = sub.slice(5, 10);
	return [left, right];
}

class LegacyDirectionSections extends Component{
	renderSubRows(items, dir){
		return (
			<div>
				{items.map((sub, idx)=>{
					const year = Number(dir.startYear || 0) + (safeArray(dir.subDirect).indexOf(sub));
					const age = Number(dir.age || 0) + (safeArray(dir.subDirect).indexOf(sub));
					return (
						<div className="horosa-bazi-legacy-sub-row" key={`${dir.startYear}-${idx}-${getGanzi(sub)}`}>
							<span>{getGanzi(sub)}</span>
							<span>{sub.naying || ''}</span>
							<span>{year || ''}　{age ? `${age}周岁` : ''}</span>
						</div>
					);
				})}
			</div>
		);
	}

	render(){
		const dirs = safeArray(this.props.value && this.props.value.direction);
		if(!dirs.length){
			return <div className="horosa-bazi-legacy-empty">暂无行运资料</div>;
		}
		return (
			<div className="horosa-bazi-legacy-direction-sections">
				{dirs.map((dir, idx)=>{
					const [left, right] = splitSubDirectRows(dir);
					const mainDirect = dir.mainDirect || {};
					return (
						<section key={`${dir.startYear}-${idx}`}>
							<div className="horosa-bazi-legacy-direction-title">
								<span />
								<strong>{dir.startYear} {getGanzi(mainDirect)} {mainDirect.naying || ''}</strong>
								<span />
							</div>
							<div className="horosa-bazi-legacy-sub-grid">
								{this.renderSubRows(left, dir)}
								{this.renderSubRows(right, dir)}
							</div>
						</section>
					);
				})}
			</div>
		);
	}
}

function getExtraLine(bazi){
	if(!bazi){
		return '';
	}
	const nongli = bazi.nongli || {};
	const detail = [nongli.jiedelta, nongli.chef].filter(Boolean).join('，');
	const tiaohou = Array.isArray(bazi.tiaohou) && bazi.tiaohou.length ? `调候：${bazi.tiaohou.join('，')}` : '';
	return [detail, tiaohou].filter(Boolean).join('； ');
}

function directionAgeText(item){
	if(!item){
		return '';
	}
	const year = item.startYear !== undefined ? item.startYear : item.year;
	const age = item.age !== undefined ? `${item.age}周岁` : '';
	return [year, getGanzi(item.mainDirect || item.direct || item.yearGanzi), age].filter(Boolean).join(' ');
}

class LegacyLuckMatrix extends Component{
	render(){
		const bazi = this.props.value || {};
		const dirs = safeArray(bazi.direction);
		if(!dirs.length){
			return <div className="horosa-bazi-legacy-empty">暂无行运资料</div>;
		}
		return (
			<div className="horosa-bazi-legacy-luck-matrix">
				{dirs.map((dir, idx)=>(
					<div className="horosa-bazi-legacy-luck-col" key={`${dir.startYear || idx}-${idx}`}>
						<div className="horosa-bazi-legacy-luck-head">
							<span>{dir.age !== undefined ? `${dir.age}周岁` : ''}</span>
							<strong>{dir.startYear}</strong>
							<b>{getGanzi(dir.mainDirect)}</b>
						</div>
						{safeArray(dir.subDirect).map((sub, subIdx)=>(
							<div className="horosa-bazi-legacy-year-chip" key={`${dir.startYear}-${subIdx}`}>
								{getGanzi(sub)}
							</div>
						))}
					</div>
				))}
			</div>
		);
	}
}

class LegacyLuckDetail extends Component{
	render(){
		const bazi = this.props.value || {};
		const dirs = safeArray(bazi.direction);
		const current = dirs[0] || {};
		const main = current.mainDirect || {};
		return (
			<div className="horosa-bazi-legacy-detail-pane">
				<h3>上运时间：{bazi.directAge !== undefined ? `${Math.round(bazi.directAge)}周岁` : ''} {bazi.directTime ? `${bazi.directTime}` : ''}</h3>
				<div className="horosa-bazi-legacy-detail-grid">
					<div>
						<strong>{getGanzi(main)}-{main.ganziPhase || ''}</strong>
						<span>{relationText(main.stem)}</span>
						<span>支：{[main.branch && main.branch.relative, ...collectGods(main).slice(0, 3)].filter(Boolean).join('，')}</span>
						<span>开始时间：{current.startYear || ''}</span>
					</div>
					<div>
						<strong>{main.naying || ''}-{main.nayingPhase || ''}</strong>
						<span>{relationText(main.branch)}</span>
					</div>
				</div>
				<div className="horosa-bazi-legacy-year-list">
					{safeArray(current.subDirect).map((sub, idx)=>(
						<div key={`${current.startYear}-${idx}`}>
							<span>{getGanzi(sub)}</span>
							<span>{sub.naying || ''}</span>
							<span>{Number(current.startYear || 0) + idx || ''}</span>
							<span>{current.age !== undefined ? `${current.age + idx}岁` : ''}</span>
						</div>
					))}
				</div>
				<div className="horosa-bazi-legacy-side-list">
					{dirs.slice(0, 8).map((item, idx)=>(
						<div className={idx === 0 ? 'is-active' : ''} key={`${item.startYear}-${idx}`}>{directionAgeText(item)}</div>
					))}
				</div>
			</div>
		);
	}
}

class LegacySmallLuck extends Component{
	render(){
		const items = safeArray(this.props.value && this.props.value.smallDirection);
		if(!items.length){
			return <div className="horosa-bazi-legacy-empty">暂无小运资料</div>;
		}
		return (
			<div className="horosa-bazi-legacy-simple-list">
				{items.map((item, idx)=>(
					<div key={`${item.year}-${idx}`}>
						<strong>{item.year} {item.age !== undefined ? `${item.age}岁` : ''}</strong>
						<span>小运：{getGanzi(item.direct)} {item.direct && item.direct.naying ? `(${item.direct.naying})` : ''}</span>
						<span>流年：{getGanzi(item.yearGanzi)} {item.yearGanzi && item.yearGanzi.naying ? `(${item.yearGanzi.naying})` : ''}</span>
					</div>
				))}
			</div>
		);
	}
}

class LegacyGua extends Component{
	render(){
		const four = this.props.value || {};
		const rows = [
			['胎元', four.tai],
			['年柱', four.year],
			['月柱', four.month],
			['日柱', four.day],
			['时柱', four.time],
		];
		return (
			<div className="horosa-bazi-legacy-card-list">
				{rows.map(([label, item])=>{
					const gua = item && item.gua64 ? item.gua64 : null;
					const hu = item && item.huGua ? item.huGua : null;
					const tong = item && item.tongGua ? item.tongGua : null;
					return (
						<section key={label}>
							<h3>{label} {getGanzi(item)}</h3>
							<p>本卦：{gua ? `${gua.abrname || ''}${gua.name ? ` ${gua.name}` : ''}` : '—'}</p>
							<p>互卦：{hu ? `${hu.abrname || ''}${hu.name ? ` ${hu.name}` : ''}` : '—'}</p>
							<p>旁通：{tong ? `${tong.abrname || ''}${tong.name ? ` ${tong.name}` : ''}` : '—'}</p>
							{gua && gua.desc ? <a href={gua.url} target="_blank" rel="noreferrer">{gua.desc}</a> : null}
						</section>
					);
				})}
			</div>
		);
	}
}

class LegacyZhangSheng extends Component{
	render(){
		const four = this.props.value || {};
		return (
			<div className="horosa-bazi-legacy-card-list">
				{[...PILLAR_KEYS, ...AUX_KEYS.slice(0, 3)].map(([key, label])=>{
					const item = four[key] || {};
					return (
						<section key={key}>
							<h3>{label} {getGanzi(item)}</h3>
							<p>干支星运：{item.ganziPhase || '—'}</p>
							<p>纳音星运：{item.nayingPhase || '—'}</p>
							<p>纳音：{item.naying || '—'}</p>
						</section>
					);
				})}
			</div>
		);
	}
}

class LegacyGods extends Component{
	render(){
		const four = this.props.value || {};
		return (
			<div className="horosa-bazi-legacy-card-list">
				{[...PILLAR_KEYS, ...AUX_KEYS.slice(0, 3)].map(([key, label])=>{
					const item = four[key] || {};
					const whole = collectGods(item);
					const stem = collectGods(item.stem);
					const branch = collectGods(item.branch);
					return (
						<section key={key}>
							<h3>{label}</h3>
							<p>整柱：{whole.length ? whole.join('、') : '—'}</p>
							<p>天干：{stem.length ? stem.join('、') : '—'}</p>
							<p>地支：{branch.length ? branch.join('、') : '—'}</p>
						</section>
					);
				})}
			</div>
		);
	}
}

class LegacyRelationPanel extends Component{
	render(){
		const rows = groupRows(this.props.value || {}, this.props.labels || []);
		if(!rows.length){
			return <div className="horosa-bazi-legacy-empty">暂无资料</div>;
		}
		return (
			<div className="horosa-bazi-legacy-card-list">
				{rows.map(([title, value])=>(
					<section key={title}>
						<h3>{title}</h3>
						<p>{value}</p>
					</section>
				))}
			</div>
		);
	}
}

export class BaZiLegacyMain extends Component{
	render(){
		const bazi = this.props.value || {};
		const fields = this.props.fields || {};
		const four = bazi.fourColumns || {};
		const gong12 = bazi.gong12God || {};
		const name = fields.name ? fields.name.value : '';
		const gender = BaZiMsg[bazi.gender] || '';
		const legacyNongli = bazi.nongli || {};
		const timeAlgNames = { 0: '真太阳时', 1: '直接时间', 2: '春分定卯时', 3: '地方卯时' };
		const timeAlgVal = fields.timeAlg ? fields.timeAlg.value : 0;
		const formClock = (fields.date && fields.time) ? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}` : '';
		const clockTime = legacyNongli.clockTime || formClock || legacyNongli.birth || '';
		const solarTime = legacyNongli.solarTime || legacyNongli.birth || '';
		return (
			<div className="horosa-bazi-legacy-main">
				<header className="horosa-bazi-legacy-header">
					<div>
						<strong>{gender}</strong>
						<span>{name}</span>
						<span>农历:{getNongliText(bazi)}</span>
						<span>直接时间:{clockTime}</span>
						<span>真太阳时:{solarTime}</span>
						<span>计算基准:{timeAlgNames[timeAlgVal] || '真太阳时'}</span>
						<p>{getExtraLine(bazi)}</p>
					</div>
					<button type="button">打印命盘</button>
				</header>
				<div className="horosa-bazi-legacy-pillar-grid">
					{PILLAR_KEYS.map(([key, label])=>(
						<LegacyPillar
							key={key}
							title={label}
							value={four[key]}
							gong12={gong12[label.charAt(0)]}
							baziOpt={this.props.baziOpt}
						/>
					))}
				</div>
				<div className="horosa-bazi-legacy-divider" />
				<div className="horosa-bazi-legacy-pillar-grid">
					{AUX_KEYS.map(([key, label])=>{
						const value = key === 'ming12'
							? {
								ganzi: four.ming12 && four.ming12.zhi ? four.ming12.zhi : '',
								stem: { cell: '', element: 'Water' },
								branch: { cell: four.ming12 && four.ming12.zhi ? four.ming12.zhi : '', element: 'Water' },
								naying: '十二串宫',
							}
							: four[key];
						const gongKey = key === 'tai' ? '胎' : (key === 'ming' || key === 'ming12' ? '命' : '身');
						return (
							<LegacyPillar
								compact
								key={key}
								title={label}
								value={value}
								gong12={gong12[gongKey]}
								baziOpt={this.props.baziOpt}
							/>
						);
					})}
				</div>
				<div className="horosa-bazi-legacy-divider" />
				<LegacyDirectionSections value={bazi} />
			</div>
		);
	}
}

export class BaZiLegacyInfoPanel extends Component{
	// horosa_freeze_subtabs_v1 接线（八字·传统视图右栏 8 子页签）。
	// 旧码是 defaultActiveKey 非受控 → 拿不到 active，无法冻结；先改受控（activeKey + onChange 记进
	// 本地 state），行为与非受控一致（初值仍是 'overview'，点击仍切页），再逐个包 FreezeSubTab。
	// 收益：切时间/改选项时，用户看不见的 7 个面板（大运/小运/神煞/卦释/十二长生/天干/地支，
	// 每个都是整表渲染）不再陪着重渲。冻结≠卸载：切回时组件实例、DOM、内部 state
	// （如 BaZiZhangSheng 的流派/天干下拉选择、滚动位置）原样保留，且立刻拿最新 value 渲一帧。
	constructor(props){
		super(props);
		this.state = {
			legacyTab: 'overview',
		};
		this.changeLegacyTab = this.changeLegacyTab.bind(this);
	}

	changeLegacyTab(key){
		this.setState({
			legacyTab: key,
		});
	}

	render(){
		const bazi = this.props.value || {};
		const four = bazi.fourColumns || {};
		const height = this.props.height || 760;
		const legacyHeight = typeof height === 'number' ? height + 130 : height;
		const cur = this.state.legacyTab;
		return (
			<Tabs className="horosa-bazi-legacy-tabs" activeKey={cur} onChange={this.changeLegacyTab}>
				<TabPane tab="行运概略" key="overview">
					<FreezeSubTab active={cur === 'overview'}>{()=>(
						<div className="horosa-bazi-legacy-overview-adapt">
							<MainDirectionSimple value={bazi} height={legacyHeight} />
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="卦释" key="gua">
					<FreezeSubTab active={cur === 'gua'}>{()=>(
						<FourZhuGuaDesc value={four} height={legacyHeight} />
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="十二长生" key="zhangsheng">
					<FreezeSubTab active={cur === 'zhangsheng'}>{()=>(
						<BaZiZhangSheng value={bazi} height={legacyHeight} />
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="神煞" key="gods">
					<FreezeSubTab active={cur === 'gods'}>{()=>(
						<Gods value={four} height={legacyHeight} />
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="大运" key="main">
					<FreezeSubTab active={cur === 'main'}>{()=>(
						<MainDirection value={bazi} height={legacyHeight} />
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="小运" key="small">
					<FreezeSubTab active={cur === 'small'}>{()=>(
						<SmallDirection value={bazi} height={legacyHeight} />
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="天干" key="gan">
					<FreezeSubTab active={cur === 'gan'}>{()=>(
						<GanHeCong value={four} height={legacyHeight} />
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="地支" key="zhi">
					<FreezeSubTab active={cur === 'zhi'}>{()=>(
						<ZiHeCong value={four} height={legacyHeight} />
					)}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}
}
