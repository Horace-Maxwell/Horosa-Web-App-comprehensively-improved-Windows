import { Component } from 'react';
import { BaZiMsg } from '../../msg/bazimsg';
import { calcFlowShenSha } from '../../utils/baziShenShaLocal';
import { chartSCUEnabled } from '../../utils/perfFlags';

const PILLAR_KEYS = [
	['year', '年柱'],
	['month', '月柱'],
	['day', '日柱'],
	['time', '时柱'],
];

// 纳音古法（禄命·纳音派）：以年柱纳音为命主之纲，重纳音五行生克链。纯展示派生，与 BaZiAncientChart 同口径。
const NAYIN_EL_TOKEN = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
const NAYIN_GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const NAYIN_KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
function nayinElOf(n){ return n ? n.charAt(n.length - 1) : ''; }
function nayinRelate(a, b){
	if(!a || !b){ return ''; }
	if(a === b){ return '比和'; }
	if(NAYIN_GEN[a] === b){ return '我生'; }
	if(NAYIN_KE[a] === b){ return '我克'; }
	if(NAYIN_GEN[b] === a){ return '生我'; }
	if(NAYIN_KE[b] === a){ return '克我'; }
	return '';
}

function getGanzi(item){
	if(!item){
		return '';
	}
	return item.ganzi || item.ganZhi || `${item.stem && item.stem.cell ? item.stem.cell : ''}${item.branch && item.branch.cell ? item.branch.cell : ''}`;
}

function hiddenText(item){
	const stems = item && Array.isArray(item.stemInBranch) ? item.stemInBranch : [];
	return stems.map((stem)=>`${stem.cell || ''}${stem.relative || ''}`).filter(Boolean).join(' ');
}

function collectGods(item){
	if(!item){
		return [];
	}
	const gods = [];
	if(Array.isArray(item.shenSha)){
		gods.push(...item.shenSha);
	}
	if(Array.isArray(item.goodGods)){
		gods.push(...item.goodGods);
	}
	if(Array.isArray(item.neutralGods)){
		gods.push(...item.neutralGods);
	}
	if(Array.isArray(item.badGods)){
		gods.push(...item.badGods);
	}
	return Array.from(new Set(gods.filter(Boolean)));
}

function infoPair(label, value){
	if(value === undefined || value === null || value === ''){
		return null;
	}
	return (
		<div className="horosa-bazi-info-pair" key={label}>
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// horosa_bazi_info_split_v1（PERF-R9 Ship 6·八字族）
//
// 病灶：右栏信息面板旧来是一个整块组件。用户在中栏下方行运条点一格（大运/流年/流月/流日）
// 只改动 flowSelection，而 flowSelection **只被「神煞」一节消费**；旧结构却把
// 起盘信息 / 五行力量 / 格局用神 / 盲派 / 纳音古法 / 月令司令 / 三元宫位 全部重渲一遍
// —— 点一次就白跑一次，正好压在 owner 要的「点击→中右栏画完 ≤1s」预算上。
//
// 修法：按「输入依赖」把面板切成三个各自带 sCU 的相邻子块（DOM 顺序与旧版逐字一致）：
//   1) BaZiInfoStaticSections —— 依赖 value / fields / school / zodiacBoundary
//   2) BaZiFlowGodsSection    —— 依赖 value / flowSelection（点选行运时只有它重渲）
//   3) BaZiInfoAuxSection     —— 依赖 value
// 三个 sCU 一律「拿不准就判变」：任一列出的输入引用不等即返 true，父组件每次都用最新 props
// 构造它们 —— 该更新时必更新，零陈旧、零降级。渲染方法体逐字照搬旧版（props 名不变）。
// ═══════════════════════════════════════════════════════════════════════════════
class BaZiInfoStaticSections extends Component{
	shouldComponentUpdate(nextProps){
		if(!chartSCUEnabled()){
			return true;   // kill-switch 沿用既有 horosa.perf.chartSCU
		}
		return nextProps.value !== this.props.value
			|| nextProps.fields !== this.props.fields
			|| nextProps.school !== this.props.school
			|| nextProps.zodiacBoundary !== this.props.zodiacBoundary;
	}

	renderBasic(bazi, fields){
		const nongli = bazi.nongli || {};
		const name = fields && fields.name ? fields.name.value : '';
		const gender = BaZiMsg[bazi.gender] || '';
		const lunarText = nongli.year ? `${nongli.year}年${nongli.leap ? '闰' : ''}${nongli.month || ''}${nongli.day || ''}` : '';
		const timeAlgNames = { 0: '真太阳时', 1: '直接时间', 2: '春分定卯时', 3: '平太阳时' };
		const timeAlgVal = fields && fields.timeAlg ? fields.timeAlg.value : 0;
		const formClock = (fields && fields.date && fields.time) ? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}` : '';
		const clockTime = nongli.clockTime || formClock || nongli.birth || '';
		const solarTime = nongli.solarTime || nongli.birth || '';
		const shengXiao = this.props.zodiacBoundary === 'lunar' ? nongli.shengXiaoLunar : nongli.shengXiaoLichun;
		return (
			<section className="horosa-bazi-info-card horosa-bazi-info-card-hero">
				<div className="horosa-bazi-info-name">{name || '无名氏'}{gender ? `（${gender}）` : ''}</div>
				<div className="horosa-bazi-info-grid">
					{infoPair('阳历', fields && fields.date && fields.time ? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm')}` : '')}
					{infoPair('阴历', lunarText)}
					{infoPair('生肖', shengXiao)}
					{infoPair('直接时间', clockTime)}
					{infoPair('真太阳时', solarTime)}
					{infoPair('计算基准', timeAlgNames[timeAlgVal] || '真太阳时')}
					{infoPair('节气', nongli.jiedelta)}
					{infoPair('起运', bazi.directInfo)}
					{infoPair('交运', bazi.directTime)}
				</div>
			</section>
		);
	}

	renderPillars(four){
		return (
			<section className="horosa-bazi-info-card">
				<h3>四柱信息</h3>
				<div className="horosa-bazi-info-table">
					{PILLAR_KEYS.map(([key, label])=>{
						const item = four[key] || {};
						return (
							<div className="horosa-bazi-info-table-row" key={key}>
								<span>{label}</span>
								<strong>{getGanzi(item)}</strong>
								<em>{item.naying || ''}</em>
								<em>{item.xunEmpty ? `空亡 ${item.xunEmpty}` : ''}</em>
							</div>
						);
					})}
				</div>
			</section>
		);
	}

	renderHidden(four){
		return (
			<section className="horosa-bazi-info-card">
				<h3>藏干</h3>
				<div className="horosa-bazi-info-lines">
					{PILLAR_KEYS.map(([key, label])=>(
						<p key={key}><span>{label}</span>{hiddenText(four[key]) || '—'}</p>
					))}
				</div>
			</section>
		);
	}

	renderWuxing(bazi){
		const stat = bazi.wuxingStat;
		if(!stat || !Array.isArray(stat.scores) || !stat.scores.length){
			return null;
		}
		const token = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
		const dm = stat.dayMaster;
		return (
			<section className="horosa-bazi-info-card horosa-bazi-wuxing-card">
				<h3>五行力量</h3>
				<div className="horosa-bazi-wuxing-bars">
					{stat.scores.map((s)=>(
						<div className="horosa-bazi-wuxing-row" key={s.key}>
							<span className="horosa-bazi-wuxing-label" style={{color: `var(--horosa-bazi-${token[s.label] || 'earth'})`}}>{s.label}</span>
							<span className="horosa-bazi-wuxing-track">
								<span className="horosa-bazi-wuxing-fill" style={{width: `${Math.max(2, s.percent)}%`, background: `var(--horosa-bazi-${token[s.label] || 'earth'})`}} />
							</span>
							<span className="horosa-bazi-wuxing-pct">{s.percent}%</span>
						</div>
					))}
				</div>
				{dm ? (
					<div className="horosa-bazi-wuxing-verdict">
						<span>日主{dm.element}</span>
						<strong>{dm.verdict}</strong>
						<em>同党(印比) {dm.samePercent}% · 异党 {Math.round((100 - dm.samePercent) * 10) / 10}%</em>
					</div>
				) : null}
				<div className="horosa-bazi-wuxing-formula">{stat.cangVersion === 'fenye'
					? '分野加权：天干100 · 地支本气100/中气60/余气30 · 月柱仅当令司令×1.5（余月支藏干不加月乘）'
					: '通行示例权重：天干100 · 地支本气100/中气60/余气30 · 月令×1.5（可调）'}</div>
			</section>
		);
	}

	renderGejuYongShen(bazi){
		const gy = bazi.gejuYongShen;
		if(!gy || (!gy.geju && !gy.yongshen)){
			return null;
		}
		const ge = gy.geju;
		const schools = Array.isArray(gy.schools) ? gy.schools : [];
		const schoolKey = { fuyi: '扶抑派', geju: '格局派', tiaohou: '调候派', bingyao: '病药派', tongguan: '通关派', mangpai: '盲派' };
		// 综合(zonghe,默认)/纳音(nayin)无单一对应行 → curLabel 为 undefined,不高亮任一派(综合=各派综合,勿误指扶抑)。
		const curLabel = schoolKey[this.props.school];
		return (
			<section className="horosa-bazi-info-card horosa-bazi-geju-card">
				<h3>格局 · 用神</h3>
				{ge ? (
					<div className="horosa-bazi-geju-row">
						<span>格局</span>
						<strong>{ge.name}</strong>
						<em>{ge.tenGod ? `月令${ge.tenGod}·${ge.via}` : ge.via}</em>
					</div>
				) : null}
				{schools.length ? (
					<div className="horosa-bazi-yong-table">
						<div className="horosa-bazi-yong-thead"><span>流派</span><span>喜用</span><span>忌</span></div>
						{schools.map((s, i) => {
							const active = curLabel ? s.school === curLabel : false;
							return (
								<div className={`horosa-bazi-yong-trow ${active ? 'is-active' : ''}`} key={i} title={s.note}>
									<span className="horosa-bazi-yong-school">{s.school}{s.verdict ? `·${s.verdict}` : ''}</span>
									<span className="horosa-bazi-yong-xi">{s.xi && s.xi.length ? s.xi.join('·') : '—'}</span>
									<span className="horosa-bazi-yong-ji">{s.ji && s.ji.length ? s.ji.join('·') : '—'}</span>
								</div>
							);
						})}
						<div className="horosa-bazi-yong-foot">各派取用可异，当前高亮＝所选流派。鼠标悬停看依据。</div>
					</div>
				) : null}
				{Array.isArray(gy.bianGe) && gy.bianGe.length ? (
					<div className="horosa-bazi-bge">
						<div className="horosa-bazi-bge-head">疑似变格（需复核成立条件）</div>
						{gy.bianGe.map((b, i)=>(
							<div className="horosa-bazi-bge-item" key={i}>
								<span className="horosa-bazi-bge-name">{b.type}·{b.name}</span>
								<em>{b.cond}</em>
								<div className="horosa-bazi-bge-yong">若成立：用{b.yong}、忌{b.bei}</div>
								<div className="horosa-bazi-bge-note">{b.note}</div>
							</div>
						))}
					</div>
				) : null}
				{Array.isArray(gy.zaGe) && gy.zaGe.length ? (
					<div className="horosa-bazi-bge">
						<div className="horosa-bazi-bge-head">杂格（正格优先，需复核填实刑冲）</div>
						{gy.zaGe.map((b, i)=>(
							<div className="horosa-bazi-bge-item" key={i}>
								<span className="horosa-bazi-bge-name">{b.name}</span>
								<em>{b.cond}</em>
								<div className="horosa-bazi-bge-note">{b.note}</div>
							</div>
						))}
					</div>
				) : null}
			</section>
		);
	}

	renderMangPai(bazi){
		const mp = bazi.mangpai;
		if(!mp || !Array.isArray(mp.cells)){
			return null;
		}
		return (
			<section className="horosa-bazi-info-card horosa-bazi-mangpai-card">
				<h3>盲派结构 <em className="horosa-bazi-mp-tag">象法·参考</em></h3>
				<div className="horosa-bazi-mp-cells">
					{mp.cells.map((c, i) => (
						<div className={`horosa-bazi-mp-cell ${c.role === '主' ? 'is-zhu' : ''}`} key={i}>
							<span className="horosa-bazi-mp-role">{c.label}·{c.role}</span>
							<strong>{c.gan}{c.zhi}</strong>
							<em>{c.ganGod || '—'}/{c.zhiGod || '—'}</em>
						</div>
					))}
				</div>
				{mp.zuogong && mp.zuogong.length ? (
					<div className="horosa-bazi-mp-block">
						<div className="horosa-bazi-mp-head">做功路线</div>
						{mp.zuogong.map((z, i) => (
							<div className="horosa-bazi-mp-gong" key={i} title={z.text}>
								<b>{z.from}</b><i className={`rel-${z.kind}`}>{z.kind}</i><b>{z.to}</b>
							</div>
						))}
					</div>
				) : (
					<div className="horosa-bazi-mp-empty">主位之体未直接取宾位之用（做功不显，多看刑冲合害引动）。</div>
				)}
				{mp.feishen && mp.feishen.length ? <div className="horosa-bazi-mp-fei">废神：{mp.feishen.join('、')}</div> : null}
				<div className="horosa-bazi-mp-note">{mp.note}</div>
			</section>
		);
	}

	renderFenYe(bazi){
		const fy = bazi.fenYe;
		if(!fy || !fy.ruler || !Array.isArray(fy.segments)){
			return null;
		}
		return (
			<section className="horosa-bazi-info-card horosa-bazi-fenye-card">
				<h3>月令司令（分野·{fy.versionLabel}）</h3>
				<div className="horosa-bazi-fenye-ruler">
					<span>节后 {fy.daysAfterJie} 日</span>
					<strong>{fy.ruler.gan} 司令</strong>
					<em>{fy.ruler.pos}</em>
				</div>
				<div className="horosa-bazi-fenye-segs">
					{fy.segments.map((s, i)=>{
						const active = s.gan === fy.ruler.gan && s.pos === fy.ruler.pos && s.start === fy.ruler.start;
						return (
							<span key={i} className={`horosa-bazi-fenye-seg ${active ? 'is-active' : ''}`}>
								<b>{s.gan}</b><i>{s.pos}·{s.days}日</i>
							</span>
						);
					})}
				</div>
			</section>
		);
	}

	// 断命流派=纳音古法（禄命·纳音派）专属解读：以年柱纳音为纲、纳音五行生克链 + 纳音长生，
	// 不以日干为我。否则选「纳音古法」与「传统综合」面板零差异（bug）。胎元列入第五柱。
	renderNaYin(bazi){
		const four = bazi.fourColumns || {};
		const cols = [
			['year', '年柱·命主纲'],
			['month', '月柱'],
			['day', '日柱'],
			['time', '时柱'],
			['tai', '胎元'],
		].map(([k, label])=>({ k, label, p: four[k] })).filter((c)=>c.p && c.p.naying);
		if(cols.length < 2){ return null; }
		const yearEl = nayinElOf(cols[0].p.naying);
		const chain = cols.slice(0, -1).map((c, i)=>nayinRelate(nayinElOf(c.p.naying), nayinElOf(cols[i + 1].p.naying)));
		return (
			<section className="horosa-bazi-info-card horosa-bazi-nayin-card">
				<h3>纳音古法 <em className="horosa-bazi-mp-tag">禄命·纳音派</em></h3>
				<div className="horosa-bazi-nayin-zhu">
					<span>以年柱为纲</span>
					<strong style={{ color: `var(--horosa-bazi-${NAYIN_EL_TOKEN[yearEl] || 'earth'})` }}>{cols[0].p.naying || '—'}</strong>
					<em>命主纳音（不以日干为我）</em>
				</div>
				<div className="horosa-bazi-nayin-rows">
					{cols.map((c)=>(
						<div className="horosa-bazi-nayin-row" key={c.k}>
							<span className="horosa-bazi-nayin-label">{c.label}</span>
							<strong style={{ color: `var(--horosa-bazi-${NAYIN_EL_TOKEN[nayinElOf(c.p.naying)] || 'earth'})` }}>{c.p.naying || '—'}</strong>
							<em>纳音长生 {c.p.nayingPhase || '—'}</em>
						</div>
					))}
				</div>
				<div className="horosa-bazi-nayin-chain">
					<span className="horosa-bazi-nayin-chain-label">纳音五行生克</span>
					{cols.map((c, i)=>{
						const el = nayinElOf(c.p.naying);
						return (
							<span className="horosa-bazi-nayin-chain-seg" key={c.k}>
								<b style={{ color: `var(--horosa-bazi-${NAYIN_EL_TOKEN[el] || 'earth'})` }}>{el || '—'}</b>
								{chain[i] ? <i className={`rel-${chain[i]}`}>{chain[i]}</i> : null}
							</span>
						);
					})}
				</div>
			</section>
		);
	}

	render(){
		const bazi = this.props.value || {};
		return (
			<>
				{this.renderBasic(bazi, this.props.fields || {})}
				{this.renderWuxing(bazi)}
				{this.renderGejuYongShen(bazi)}
				{this.props.school === 'mangpai' ? this.renderMangPai(bazi) : null}
				{this.props.school === 'nayin' ? this.renderNaYin(bazi) : null}
				{this.renderFenYe(bazi)}
			</>
		);
	}
}

class BaZiFlowGodsSection extends Component{
	shouldComponentUpdate(nextProps){
		if(!chartSCUEnabled()){
			return true;   // kill-switch 沿用既有 horosa.perf.chartSCU
		}
		return nextProps.value !== this.props.value
			|| nextProps.flowSelection !== this.props.flowSelection;
	}

	renderFlowGods(bazi){
		// 神煞面板显示「当前所选 大运/流年/流月/流日」之神煞（四柱神煞已在细盘呈现，此处不重复）。
		const four = bazi.fourColumns || {};
		const sel = this.props.flowSelection || {};
		const rows = [
			['大运', sel.luckPillar],
			['流年', sel.yearPillar],
			['流月', sel.monthPillar],
			['流日', sel.dayPillar],
		];
		// flowSelection 的 pillar 来自 normalizePillar：{ganzi, stem(字符串), branch(字符串), ...}
		const pgan = (p) => p ? (typeof p.stem === 'string' ? p.stem : (p.stem && p.stem.cell) || (p.ganzi ? p.ganzi.charAt(0) : '')) : '';
		const pzhi = (p) => p ? (typeof p.branch === 'string' ? p.branch : (p.branch && p.branch.cell) || (p.ganzi ? p.ganzi.charAt(1) : '')) : '';
		const any = rows.some(([, p]) => pgan(p) || pzhi(p));
		return (
			<section className="horosa-bazi-info-card">
				<h3>神煞 <em className="horosa-bazi-flow-tag">所选大运/流年/流月/流日</em></h3>
				<div className="horosa-bazi-info-lines horosa-bazi-flow-lines">
					{any ? rows.map(([label, p]) => {
						const gan = pgan(p);
						const zhi = pzhi(p);
						if(!gan && !zhi){ return null; }
						const gods = calcFlowShenSha(four, gan, zhi);
						return <p key={label}><span className="horosa-bazi-flow-key">{label}<b>{gan}{zhi}</b></span><span className="horosa-bazi-flow-gods">{gods.length ? gods.join('、') : '—'}</span></p>;
					}) : <p className="horosa-bazi-flow-empty">在下方大运/流年/流月/流日栏点选，查看其神煞。</p>}
				</div>
			</section>
		);
	}

	render(){
		return this.renderFlowGods(this.props.value || {});
	}
}

class BaZiInfoAuxSection extends Component{
	shouldComponentUpdate(nextProps){
		if(!chartSCUEnabled()){
			return true;   // kill-switch 沿用既有 horosa.perf.chartSCU
		}
		return nextProps.value !== this.props.value;
	}

	renderAux(four){
		const aux = [
			['胎元', four.tai],
			['命宫', four.ming],
			['身宫', four.shen],
			['串宫', four.ming12],
		];
		return (
			<section className="horosa-bazi-info-card">
				<h3>三元宫位</h3>
				<div className="horosa-bazi-info-mini-grid">
					{aux.map(([label, item])=>(
						<div key={label}>
							<span>{label}</span>
							<strong>{label === '串宫' ? (item && item.zhi ? item.zhi : '') : getGanzi(item)}</strong>
						</div>
					))}
				</div>
			</section>
		);
	}

	render(){
		const bazi = this.props.value || {};
		return this.renderAux(bazi.fourColumns || {});
	}
}

class BaZiAppInfoPanel extends Component{
	render(){
		// 组合层：DOM 顺序与旧版逐字一致（起盘…月令司令 → 神煞 → 三元宫位），
		// 三个子块各自按输入依赖决定是否重渲（见 horosa_bazi_info_split_v1）。
		return (
			<div className="horosa-bazi-app-info-panel">
				<BaZiInfoStaticSections
					value={this.props.value}
					fields={this.props.fields}
					school={this.props.school}
					zodiacBoundary={this.props.zodiacBoundary}
				/>
				{this.props.showShenSha === false ? null : (
					<BaZiFlowGodsSection
						value={this.props.value}
						flowSelection={this.props.flowSelection}
					/>
				)}
				<BaZiInfoAuxSection value={this.props.value} />
			</div>
		);
	}
}

export default BaZiAppInfoPanel;
