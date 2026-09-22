import * as LRConst from './LRConst';

// 三传「初→中→末」递生递克关系小图（纯 SVG，仅在右栏「取象」tab 顶部显示，绝不画进中栏盘）。
// props.data = { branches:[初,中,末], gans:[遁干×3], dayGan, dayZhi, xunKong:[...] }
// 关系（上→下）：比和 / 生(上生下) / 克(上克下) / 生入(下生上) / 克入(下克上)。

const WX_COLOR = { '木': '#3fa45b', '火': '#e2574c', '土': '#d4a017', '金': '#b9b3a3', '水': '#5b8def' };
const SHENG = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' };
const KE = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };
const POS = ['初传', '中传', '末传'];

function relOf(a, b){
	if(!a || !b){ return null; }
	if(a === b){ return { label: '比和', color: 'var(--horosa-muted, #9a8f7d)' }; }
	if(SHENG[a] === b){ return { label: '生', color: '#3fa45b' }; }
	if(KE[a] === b){ return { label: '克', color: '#e2574c' }; }
	if(SHENG[b] === a){ return { label: '生入', color: '#1497a8' }; }
	if(KE[b] === a){ return { label: '克入', color: '#d68a2e' }; }
	return null;
}

// 日禄表(日干临官之支):与小图内联表同一份,抽出供纯函数与组件双用。
const LU_TABLE = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };

// [Q-450/T-413] 三传递生递克 + 逐传空/禄/马徽记的**纯函数单源**:此前只有右栏小图会算(relOf 是组件内
// 私有函数),AI 快照的 [三传] 表只有 干支/六亲/贵神,传间生克与逐传徽记一个字都不进 —— 页面看得见、
// AI 看不见。现抽为纯函数,小图与快照(大六壬 + 三式合一)三处同供,永不分叉。
// data = { branches:[初,中,末], gans, dayGan, dayZhi, xunKong:[...] }
export function buildSanChuanRelationFacts(data){
	const d = data || {};
	const branches = Array.isArray(d.branches) ? d.branches.map((b)=>`${b || ''}`.substring(0, 1)) : [];
	if(branches.length < 3 || branches.some((b)=>!b)){ return null; }
	const dayGan = d.dayGan ? `${d.dayGan}`.substring(0, 1) : '';
	const dayZhi = d.dayZhi ? `${d.dayZhi}`.substring(0, 1) : '';
	const xunKong = Array.isArray(d.xunKong) ? d.xunKong.map((z)=>`${z || ''}`.substring(0, 1)) : [];
	const yima = dayZhi ? (LRConst.ZiYiMa[dayZhi] || '') : '';
	const lu = dayGan ? (LU_TABLE[dayGan] || '') : '';
	const wxs = branches.map((b)=>LRConst.GanZiWuXing[b] || '');
	const nodes = branches.map((b, i)=>{
		const tags = [];
		if(xunKong.indexOf(b) >= 0){ tags.push('空'); }
		if(b === lu){ tags.push('禄'); }
		if(b === yima){ tags.push('马'); }
		return { pos: POS[i], branch: b, wuxing: wxs[i], tags };
	});
	const links = [0, 1].map((i)=>{
		const rel = relOf(wxs[i], wxs[i + 1]);
		return { from: POS[i], to: POS[i + 1], rel: rel ? rel.label : '' };
	}).filter((x)=>x.rel);
	return { nodes, links };
}

// 快照/导出用一行摘要:「初传→中传 生;中传→末传 克入」+「初传丑(空·禄)…」;无可算内容返 ''。
export function sanChuanRelationSnapshotLines(data){
	const facts = buildSanChuanRelationFacts(data);
	if(!facts){ return []; }
	const out = [];
	if(facts.links.length){
		out.push(`三传递生递克：${facts.links.map((l)=>`${l.from}→${l.to} ${l.rel}`).join('；')}`);
	}
	const marked = facts.nodes.filter((n)=>n.tags.length);
	if(marked.length){
		out.push(`逐传徽记：${marked.map((n)=>`${n.pos}${n.branch}(${n.tags.join('·')})`).join('；')}`);
	}
	return out;
}

function LRSanChuanRelationMini(props){
	const data = props && props.data ? props.data : null;
	const branches = data && Array.isArray(data.branches) ? data.branches.map((b)=>`${b || ''}`.substring(0, 1)) : [];
	if(branches.length < 3 || branches.some((b)=>!b)){
		return null;
	}
	const gans = data && Array.isArray(data.gans) ? data.gans : [];
	const dayGan = data && data.dayGan ? `${data.dayGan}`.substring(0, 1) : '';
	const dayZhi = data && data.dayZhi ? `${data.dayZhi}`.substring(0, 1) : '';
	const xunKong = data && Array.isArray(data.xunKong) ? data.xunKong : [];
	// [Q-450/T-413] 禄/马取法走上面的纯函数单源(LU_TABLE/ZiYiMa),此处不再各留一份表。
	const yima = dayZhi ? (LRConst.ZiYiMa[dayZhi] || '') : '';
	const lu = dayGan ? (LU_TABLE[dayGan] || '') : '';

	const wxs = branches.map((b)=>LRConst.GanZiWuXing[b] || '');
	const nodeH = 40;
	const gap = 30;
	const topPad = 8;
	const cx = 70;
	const boxW = 64;
	const height = topPad * 2 + nodeH * 3 + gap * 2;

	const nodes = branches.map((b, i)=>{
		const y = topPad + i * (nodeH + gap);
		const wx = wxs[i];
		const color = WX_COLOR[wx] || 'var(--horosa-text, #d8d2c7)';
		const gan = gans[i] ? `${gans[i]}`.substring(0, 1) : '';
		const liuqin = (dayGan && LRConst.ZiLiuQin[b]) ? (LRConst.ZiLiuQin[b][dayGan] || '') : '';
		const tags = [];
		if(xunKong.indexOf(b) >= 0){ tags.push('空'); }
		if(b === lu){ tags.push('禄'); }
		if(b === yima){ tags.push('马'); }
		return { b, y, wx, color, gan, liuqin, tags };
	});

	return (
		<svg width="100%" viewBox={`0 0 200 ${height}`} style={{ display: 'block', maxHeight: height + 4 }} role="img" aria-label="三传递生递克关系图">
			{nodes.map((n, i)=>(
				i < 2 ? (()=>{
					const rel = relOf(n.wx, nodes[i + 1].wx);
					const y1 = n.y + nodeH;
					const y2 = nodes[i + 1].y;
					const my = (y1 + y2) / 2;
					return (
						<g key={`link_${i}`}>
							<line x1={cx} y1={y1} x2={cx} y2={y2 - 2} stroke="var(--horosa-border, rgba(255,255,255,0.18))" strokeWidth="1.4" />
							{rel ? (
								<g>
									<rect x={cx - 17} y={my - 9} width="34" height="18" rx="9" fill="var(--horosa-surface-raised, rgba(20,20,24,0.9))" stroke={rel.color} strokeWidth="1" />
									<text x={cx} y={my + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill={rel.color}>{rel.label}</text>
								</g>
							) : null}
						</g>
					);
				})() : null
			))}
			{nodes.map((n, i)=>(
				<g key={`node_${i}`}>
					<text x={cx - boxW / 2 - 6} y={n.y + nodeH / 2} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--horosa-muted, #9a8f7d)">{POS[i]}</text>
					<rect x={cx - boxW / 2} y={n.y} width={boxW} height={nodeH} rx="8" fill={`${WX_COLOR[n.wx] || '#888888'}1f`} stroke={n.color} strokeWidth="1.2" />
					<text x={cx} y={n.y + nodeH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="700" fill={n.color}>{`${n.gan}${n.b}`}</text>
					<text x={cx + boxW / 2 + 6} y={n.y + nodeH / 2 - 6} textAnchor="start" dominantBaseline="middle" fontSize="11" fill="var(--horosa-liureng-square-jiang, #948e33)">{n.liuqin || ''}</text>
					{n.tags.length ? (
						<text x={cx + boxW / 2 + 6} y={n.y + nodeH / 2 + 9} textAnchor="start" dominantBaseline="middle" fontSize="10" fill="#d68a2e">{n.tags.join(' ')}</text>
					) : null}
				</g>
			))}
		</svg>
	);
}

export default LRSanChuanRelationMini;
