import { Component } from 'react';
import { filterShenShaByGroups } from '../../utils/baziShenShaLocal';

// 古法（禄命·纳音派，八字大全 §6.8）：以年柱为纲、重纳音五行生克 / 纳音长生 / 神煞，
// 胎元列为第五柱，不以日干为我。行式表格（同简盘排版），五列=年月日时+胎元，纯展示派生。

const STEM_ELEMENT = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
const BRANCH_ELEMENT = { 寅: 'wood', 卯: 'wood', 巳: 'fire', 午: 'fire', 辰: 'earth', 戌: 'earth', 丑: 'earth', 未: 'earth', 申: 'metal', 酉: 'metal', 亥: 'water', 子: 'water' };
const EL_TOKEN = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
const NAYIN_GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const NAYIN_KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
const REL_ARROW = { 生: '→ 生 →', 克: '→ 克 →', 被生: '← 生 ←', 被克: '← 克 ←', 比和: '· 比和 ·' };

function colorVar(token){ return token ? `var(--horosa-bazi-${token})` : 'var(--horosa-text)'; }
function nayinEl(n){ return n ? n.charAt(n.length - 1) : ''; }
function relate(a, b){
	if(!a || !b){ return ''; }
	if(a === b){ return '比和'; }
	if(NAYIN_GEN[a] === b){ return '生'; }
	if(NAYIN_KE[a] === b){ return '克'; }
	if(NAYIN_GEN[b] === a){ return '被生'; }
	if(NAYIN_KE[b] === a){ return '被克'; }
	return '';
}
function godsOf(p){
	const s = [];
	['shenSha', 'neutralGods', 'goodGods', 'badGods'].forEach((k)=>{ if(p && Array.isArray(p[k])){ s.push(...p[k]); } });
	return Array.from(new Set(s.filter(Boolean)));
}

class BaZiAncientChart extends Component{
	render(){
		const bazi = this.props.value || {};
		const four = bazi.fourColumns || {};
		const cols = [
			{ key: 'year', label: '年柱', tag: '命主·纲', primary: true },
			{ key: 'month', label: '月柱' },
			{ key: 'day', label: '日柱' },
			{ key: 'time', label: '时柱' },
			{ key: 'tai', label: '胎元', tag: '第五柱', fifth: true },
		].map((c)=>({ ...c, p: four[c.key] })).filter((c)=>c.p);

		const td = (content, c, extra)=>(
			<div className={`horosa-bazi-anc-td ${c.primary ? 'is-primary' : ''} ${c.fifth ? 'is-fifth' : ''} ${extra || ''}`} key={c.key}>{content}</div>
		);
		const row = (label, render)=>(
			<div className="horosa-bazi-anc-tr" key={label}>
				<div className="horosa-bazi-anc-th">{label}</div>
				{cols.map((c)=>td(render(c.p, c), c))}
			</div>
		);
		const glyph = (char, token)=> <span className="horosa-bazi-anc-glyph" style={{ color: colorVar(token) }}>{char || ''}</span>;
		const chain = cols.slice(0, -1).map((c, i)=>relate(nayinEl(c.p.naying), nayinEl(cols[i + 1].p.naying)));

		// 流派徽标:古法盘本身即纳音派视图(nayin/zonghe 不再重复标);主用其他派时提示其喜忌口径(与细盘 school-bar 同款类)。
		const school = this.props.school || 'zonghe';
		let schoolBar = null;
		if(this.props.showSchoolMarks !== false && school !== 'nayin' && school !== 'zonghe'){
			if(school === 'mangpai' && bazi.mangpai && Array.isArray(bazi.mangpai.cells) && bazi.mangpai.cells.length){
				const zhu = bazi.mangpai.cells.filter((c)=>c.role === '主').map((c)=>c.label).join('·');
				const bin = bazi.mangpai.cells.filter((c)=>c.role === '宾').map((c)=>c.label).join('·');
				schoolBar = (
					<div className="horosa-bazi-fine-school-bar">
						<span className="horosa-bazi-fine-school-name">盲派</span>
						<span className="horosa-bazi-fine-school-role">主位 {zhu || '—'} ｜ 宾位 {bin || '—'}（此盘为纳音视图）</span>
					</div>
				);
			}else{
				const ROW = { fuyi: '扶抑派', geju: '格局派', tiaohou: '调候派', bingyao: '病药派' };
				const gy = bazi.gejuYongShen;
				const r = ROW[school] && gy && Array.isArray(gy.schools) ? gy.schools.find((s)=>s && s.school === ROW[school]) : null;
				if(r){
					schoolBar = (
						<div className="horosa-bazi-fine-school-bar" title={r.note || ''}>
							<span className="horosa-bazi-fine-school-name">{r.school}{r.verdict ? `·${r.verdict}` : ''}</span>
							{r.xi && r.xi.length ? <span className="horosa-bazi-fine-school-xi">喜 {r.xi.join('·')}</span> : null}
							{r.ji && r.ji.length ? <span className="horosa-bazi-fine-school-ji">忌 {r.ji.join('·')}</span> : null}
							<span className="horosa-bazi-fine-school-role">（此盘为纳音视图）</span>
						</div>
					);
				}
			}
		}

		return (
			<div className="horosa-bazi-ancient">
				{schoolBar}
				<div className="horosa-bazi-ancient-note">古法（禄命·纳音派）：以年柱为纲，重纳音五行生克 · 纳音长生 · 神煞，胎元列为第五柱，不以日干为我。</div>
				<div className="horosa-bazi-anc-table">
					<div className="horosa-bazi-anc-tr horosa-bazi-anc-headrow">
						<div className="horosa-bazi-anc-th" />
						{cols.map((c)=>td(<span className="horosa-bazi-anc-head">{c.label}{c.tag ? <em>{c.tag}</em> : null}</span>, c))}
					</div>
					{row('主星', (p, c)=> c.key === 'day' ? <strong className="horosa-bazi-anc-self">日元</strong> : <strong>{(p.stem && p.stem.relative) || ''}</strong>)}
					{row('天干', (p)=>glyph(p.stem && p.stem.cell, STEM_ELEMENT[p.stem && p.stem.cell]))}
					{row('地支', (p)=>glyph(p.branch && p.branch.cell, BRANCH_ELEMENT[p.branch && p.branch.cell]))}
					{row('藏干', (p)=>(
						<div className="horosa-bazi-anc-hide">
							{(p.stemInBranch || []).map((s, i)=><span key={i}>{(s.cell || '')}{(s.relative || '')}</span>)}
						</div>
					))}
					{row('纳音', (p)=><span className="horosa-bazi-anc-nayin" style={{ color: colorVar(EL_TOKEN[nayinEl(p.naying)]) }}>{p.naying || '—'}</span>)}
					{row('纳音长生', (p)=><span>{p.nayingPhase || '—'}</span>)}
					{/* 神煞分组勾选与「显示·神煞」此前都绕过了古法盘:勾掉的组照样列、关了也照样显示。 */}
					{this.props.showShenSha === false ? null : row('神煞', (p)=>{
						const g = filterShenShaByGroups(godsOf(p), this.props.shenshaGroups);
						return <span className="horosa-bazi-anc-gods">{g.length ? g.join('、') : '—'}</span>;
					})}
				</div>
				{chain.length ? (
					<div className="horosa-bazi-ancient-chain">
						<span className="horosa-bazi-ancient-chain-label">纳音五行生克</span>
						{cols.map((c, i)=>{
							const el = nayinEl(c.p.naying);
							return (
								<span className="horosa-bazi-ancient-chain-seg" key={c.key}>
									<b style={{ color: colorVar(EL_TOKEN[el]) }}>{el || '—'}</b>
									{chain[i] ? <em className={`rel-${chain[i]}`}>{REL_ARROW[chain[i]] || '·'}</em> : null}
								</span>
							);
						})}
					</div>
				) : null}
			</div>
		);
	}
}

export default BaZiAncientChart;
