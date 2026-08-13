/**
 * 策天飞星·右栏美化渲染器（移语本段专属版式）。
 *
 * 按段名分派到专属组件：运限时间带 / 童限链 / 凶限警卡 / 会照徽章 / 流年星宫网格 /
 * 十七飞星列表 / 神煞四表 / 三日宫 / 廿八宿分野表 / 十干变曜 / 杂曜徽流 / 断诀分组卡 / 星曜别名卡。
 * 数据优先吃 pan.yiyu 原始结构（保繁体星名与支索引），纯资料段解析 section.rows；
 * 未识别段回落调用方传入的通用渲染（renderRows），其他技法零触碰。
 */
import React from 'react';

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const bn = (idx)=>(idx === undefined || idx === null ? '—' : BRANCHES[((idx % 12) + 12) % 12]);

// 断诀分组 → 色带（CSS data-group 着色）
const DUANJUE_GROUP_ORDER = ['太元賦', '所臨星論', '宮坐星斷', '金鏡圖', '諸星格', '諸星格·會合', '關煞', '身宮吉凶論'];

function SecCard({ title, extra, children, className }){
	return (
		<div className={`horosa-cetian-sec ${className || ''}`}>
			<div className="horosa-cetian-sec-head">
				<span className="horosa-cetian-sec-title">{title}</span>
				{extra ? <span className="horosa-cetian-sec-extra">{extra}</span> : null}
			</div>
			<div className="horosa-cetian-sec-body">{children}</div>
		</div>
	);
}

function BranchChip({ branch, label }){
	return <span className="horosa-cetian-branch-chip">{label || bn(branch)}</span>;
}

function StarToBranch({ name, branch }){
	return (
		<span className="horosa-cetian-star-pair">
			<span className="horosa-cetian-star-name">{name}</span>
			<BranchChip branch={branch} />
		</span>
	);
}

// ── 运限：十二限时间带（当前虚岁所在限高亮） ──
function YunxianSec({ yunxian, liunian }){
	const xuSui = liunian ? liunian.xu_sui : null;
	return (
		<SecCard title="运限" extra={yunxian.shun ? '顺行' : '逆行'} className="horosa-cetian-sec-yunxian">
			<div className="horosa-cetian-xian-list">
				{(yunxian.daxian || []).map((d)=>{
					const current = xuSui !== null && xuSui >= d.start && xuSui <= d.start + 9;
					return (
						<div className={`horosa-cetian-xian-row${current ? ' is-current' : ''}${d.ji ? ' is-ji' : ''}`} key={d.range}>
							<span className="horosa-cetian-xian-range">{d.range}</span>
							<span className="horosa-cetian-xian-branch">{d.branch_name}</span>
							<span className="horosa-cetian-xian-palace">{d.palace}</span>
							<span className="horosa-cetian-xian-name">{d.xian_name}</span>
							<span className="horosa-cetian-xian-buwei">{d.buwei}</span>
							{d.ji ? <span className="horosa-cetian-xian-jibadge">忌限</span> : null}
							{current ? <span className="horosa-cetian-xian-now">今</span> : null}
						</div>
					);
				})}
			</div>
			<div className="horosa-cetian-note">{yunxian.buwei_note}</div>
		</SecCard>
	);
}

// ── 童限：15 岁链 ──
function TongxianSec({ yunxian }){
	return (
		<SecCard title="童限" extra="一至十五岁" className="horosa-cetian-sec-tongxian">
			<div className="horosa-cetian-chip-flow">
				{(yunxian.tongxian || []).map((t)=>(
					<span className="horosa-cetian-tong-chip" key={t.age}>
						<i>{t.age}</i>{`${t.palace || ''}`.replace(/宮$/, '')}·{t.branch_name}
					</span>
				))}
			</div>
			<div className="horosa-cetian-note">一命二财三疾厄，四妻五福顺行流；六岁却从官禄位，循环十五满童周。</div>
		</SecCard>
	);
}

// ── 凶限：警卡 ──
function XiongxianSec({ yunxian }){
	const hitCls = (hit)=>(hit === '坐命' ? 'is-hit' : (hit === '會照命宮' ? 'is-zhao' : 'is-ref'));
	return (
		<SecCard title="凶限提示" className="horosa-cetian-sec-xiongxian">
			{(yunxian.xiongxian || []).map((x, i)=>(
				<div className={`horosa-cetian-xiong-card ${hitCls(x.hit)}`} key={i}>
					<div className="horosa-cetian-xiong-head">
						<span className="horosa-cetian-xiong-stars">{(x.stars || []).join('·')}</span>
						{(x.ages || []).length ? <span className="horosa-cetian-xiong-ages">{x.ages.join('/')}岁</span> : null}
						<span className="horosa-cetian-xiong-hit">{x.hit}</span>
					</div>
					<div className="horosa-cetian-xiong-text">{x.text}</div>
				</div>
			))}
			{(yunxian.jixian || []).length ? (
				<div className="horosa-cetian-jixian-row">
					忌限：{yunxian.jixian.map((j)=><BranchChip key={j.branch_name} label={`${j.branch_name}限`} />)}
					<span className="horosa-cetian-note-inline">（大限十二宫生人所值之处）</span>
				</div>
			) : null}
		</SecCard>
	);
}

// ── 会照 ──
function HuizhaoSec({ huizhao }){
	return (
		<SecCard title="会照" className="horosa-cetian-sec-huizhao">
			<div className="horosa-cetian-hz-row"><span>四正</span>{(huizhao.sizheng || []).map((b)=><BranchChip key={`sz${b}`} branch={b} />)}</div>
			<div className="horosa-cetian-hz-row"><span>三合夹照</span>{(huizhao.sanhe || []).map((b)=><BranchChip key={`sh${b}`} branch={b} />)}<em>七分福</em></div>
			<div className="horosa-cetian-hz-row"><span>对照</span><BranchChip branch={huizhao.duizhao} /><em>三分福</em></div>
			<div className="horosa-cetian-note">{huizhao.note}</div>
		</SecCard>
	);
}

// ── 流年飞星：主序星宫网格 ──
function LiunianZhuxuSec({ liunian }){
	return (
		<SecCard
			title="流年飞星"
			extra={`${liunian.liunian_year}年 · 太岁${bn(liunian.branch)} · 虚岁${liunian.xu_sui}`}
			className="horosa-cetian-sec-liunian"
		>
			<div className="horosa-cetian-pair-grid">
				{Object.keys(liunian.zhuxu || {}).map((name)=>(
					<StarToBranch key={name} name={name} branch={liunian.zhuxu[name]} />
				))}
			</div>
			<div className="horosa-cetian-hz-row is-sub">
				<StarToBranch name="飛哭" branch={liunian.feiku} />
				<StarToBranch name="小哭" branch={liunian.xiaoku} />
				<StarToBranch name="紅鸞" branch={liunian.hongluan} />
				<StarToBranch name="天喜" branch={liunian.tianxi} />
			</div>
		</SecCard>
	);
}

// ── 流年七煞 ──
function LiunianQishaSec({ liunian }){
	return (
		<SecCard title="流年七煞" extra={liunian.qisha_mode === 'suishu' ? '岁数法' : '生时法'} className="horosa-cetian-sec-qisha">
			<div className="horosa-cetian-pair-grid">
				{Object.keys(liunian.qisha || {}).map((name)=>(
					<StarToBranch key={name} name={name} branch={liunian.qisha[name]} />
				))}
				<StarToBranch name="三台" branch={liunian.santai} />
				<StarToBranch name="八座" branch={liunian.bazuo} />
			</div>
		</SecCard>
	);
}

// ── 十七飞星 ──
function ShiqiSec({ liunian }){
	return (
		<SecCard title="十七飞星" extra="从太岁宫逆推一宫一位" className="horosa-cetian-sec-shiqi">
			<div className="horosa-cetian-shiqi-list">
				{(liunian.shiqi || []).map((it)=>(
					<div className="horosa-cetian-shiqi-row" key={it.star}>
						<StarToBranch name={it.star} branch={it.branch} />
						<span className="horosa-cetian-shiqi-text">{it.text}</span>
					</div>
				))}
			</div>
		</SecCard>
	);
}

// ── 神煞四表 ──
function ShenshaSec({ title, shensha }){
	if(title === '神煞·岁前'){
		return (
			<SecCard title="神煞·岁前" className="horosa-cetian-sec-shensha">
				{(shensha.suiqian || []).map((it)=>(
					<div className="horosa-cetian-shensha-row" key={it.name}>
						<StarToBranch name={it.name} branch={it.branch} />
						<span className="horosa-cetian-shensha-text">{it.text}</span>
					</div>
				))}
				<div className="horosa-cetian-note">{shensha.suiqian_note}</div>
			</SecCard>
		);
	}
	if(title === '神煞·岁后'){
		return (
			<SecCard title="神煞·岁后" className="horosa-cetian-sec-shensha">
				<div className="horosa-cetian-pair-grid">
					{(shensha.suihou || []).map((it)=>(
						<StarToBranch key={it.name} name={it.name} branch={it.branch} />
					))}
				</div>
			</SecCard>
		);
	}
	if(title === '神煞·年干'){
		return (
			<SecCard title="神煞·年干" className="horosa-cetian-sec-shensha">
				<div className="horosa-cetian-sub-title">本命（生年干）</div>
				<div className="horosa-cetian-pair-grid">
					{(shensha.niangan_benming || []).map((it)=>(
						<StarToBranch key={`b${it.name}`} name={it.name} branch={it.branch} />
					))}
				</div>
				<div className="horosa-cetian-sub-title">流年（流年干）</div>
				<div className="horosa-cetian-pair-grid">
					{(shensha.niangan_liunian || []).map((it)=>(
						<StarToBranch key={`l${it.name}`} name={it.name} branch={it.branch} />
					))}
				</div>
			</SecCard>
		);
	}
	return (
		<SecCard title="神煞·月煞" extra="按生月" className="horosa-cetian-sec-shensha">
			{(shensha.yuesha || []).map((it)=>(
				<div className="horosa-cetian-shensha-row" key={it.name}>
					<StarToBranch name={it.name} branch={it.branch} />
					<span className="horosa-cetian-shensha-text">{it.text}</span>
				</div>
			))}
		</SecCard>
	);
}

// ── 三日宫 ──
function SanriSec({ xiu }){
	return (
		<SecCard title="三日宫" extra={`太阳躔 ${xiu.sun_xiu}`} className="horosa-cetian-sec-sanri">
			<div className="horosa-cetian-sanri-cols">
				<div className="horosa-cetian-sanri-col">
					<div className="horosa-cetian-sanri-label">前三日宫 · 管前四十五年</div>
					<div className="horosa-cetian-sanri-value"><BranchChip branch={xiu.qian_sanri_gong} />{xiu.qian_sanri_xiu}</div>
				</div>
				<div className="horosa-cetian-sanri-col">
					<div className="horosa-cetian-sanri-label">后三日宫 · 管后四十五年</div>
					<div className="horosa-cetian-sanri-value"><BranchChip branch={xiu.hou_sanri_gong} />{xiu.hou_sanri_xiu}</div>
				</div>
			</div>
			<div className="horosa-cetian-note">{xiu.note}</div>
		</SecCard>
	);
}

// ── 廿八宿分野（解析 section.rows：label=支·国 value=星座·星次·宿…·州域） ──
function FenyeSec({ section }){
	const rows = section.rows || [];
	const main = rows.filter((r)=>!/分野$/.test(r.label || ''));
	const marks = rows.filter((r)=>/分野$/.test(r.label || ''));
	return (
		<SecCard title="廿八宿分野" className="horosa-cetian-sec-fenye">
			<div className="horosa-cetian-fenye-table">
				{main.map((r)=>{
					const parts = `${r.value || ''}`.split('·');
					return (
						<div className="horosa-cetian-fenye-row" key={r.label}>
							<span className="horosa-cetian-fenye-branch">{r.label}</span>
							<span className="horosa-cetian-fenye-sign">{parts[0] || ''}{parts[1] ? `·${parts[1]}` : ''}</span>
							<span className="horosa-cetian-fenye-xiu">{parts[2] || ''}</span>
							<span className="horosa-cetian-fenye-region">{parts.slice(3).join('·')}</span>
						</div>
					);
				})}
			</div>
			{marks.length ? (
				<div className="horosa-cetian-hz-row is-sub">
					{marks.map((r)=><span className="horosa-cetian-fenye-mark" key={r.label}><b>{r.label}</b> {r.value}</span>)}
				</div>
			) : null}
		</SecCard>
	);
}

// ── 十干变曜 ──
function BianyaoSec({ bianyao }){
	const chip = (it, key)=>(
		<span className={`horosa-cetian-bianyao-chip${it.xiong ? ' is-xiong' : ''}`} key={key}>
			<i>{it.bianyao}</i><small>{it.gong}</small><b>{it.yao}</b>
		</span>
	);
	return (
		<SecCard title="十干变曜" className="horosa-cetian-sec-bianyao">
			<div className="horosa-cetian-sub-title">本命（生年干）</div>
			<div className="horosa-cetian-chip-flow">{(bianyao.benming || []).map((it)=>chip(it, `b${it.bianyao}`))}</div>
			<div className="horosa-cetian-sub-title">流年（流年干）</div>
			<div className="horosa-cetian-chip-flow">{(bianyao.liunian || []).map((it)=>chip(it, `l${it.bianyao}`))}</div>
			<div className="horosa-cetian-sub-title">十三官星变曜</div>
			<div className="horosa-cetian-chip-flow">
				{(bianyao.guanxing || []).map((it)=>(
					<span className="horosa-cetian-bianyao-chip is-guan" key={it.name} title={it.note || ''}>
						<i>{it.name}</i><b>{it.yao}</b>
					</span>
				))}
			</div>
			<div className="horosa-cetian-note">{bianyao.jieyue}</div>
		</SecCard>
	);
}

// ── 杂曜 ──
function ZayaoSec({ zayao, notes }){
	return (
		<SecCard title="杂曜" extra={`${Object.keys(zayao || {}).length} 曜`} className="horosa-cetian-sec-zayao">
			<div className="horosa-cetian-pair-grid">
				{Object.keys(zayao || {}).map((name)=>(
					<span className="horosa-cetian-star-pair" key={name} title={(notes || {})[name] || ''}>
						<span className="horosa-cetian-star-name">{name}</span>
						<BranchChip branch={zayao[name]} />
					</span>
				))}
			</div>
			<div className="horosa-cetian-note">悬停各曜可见起法。</div>
		</SecCard>
	);
}

// ── 断诀：分组色卡 ──
function DuanjueSec({ duanjue }){
	const groups = {};
	(duanjue || []).forEach((h)=>{
		(groups[h.group] = groups[h.group] || []).push(h);
	});
	const ordered = DUANJUE_GROUP_ORDER.filter((g)=>groups[g]).concat(
		Object.keys(groups).filter((g)=>DUANJUE_GROUP_ORDER.indexOf(g) < 0));
	return (
		<SecCard title="断诀" extra={`命中 ${(duanjue || []).length} 条`} className="horosa-cetian-sec-duanjue">
			{ordered.map((g)=>(
				<div className="horosa-cetian-dj-group" data-group={g} key={g}>
					<div className="horosa-cetian-dj-group-head">{g}<em>{groups[g].length}</em></div>
					{groups[g].map((h, i)=>(
						<div className="horosa-cetian-dj-card" key={`${g}${i}`}>
							<div className="horosa-cetian-dj-title">{h.title}</div>
							<div className="horosa-cetian-dj-text">{h.text}</div>
							<div className="horosa-cetian-dj-source">{h.source}</div>
						</div>
					))}
				</div>
			))}
		</SecCard>
	);
}

// ── 星曜别名（解析 rows：value='陽·别名A/B·得地子丑…·失地为X'） ──
function LoreSec({ section }){
	return (
		<SecCard title="星曜别名" className="horosa-cetian-sec-lore">
			<div className="horosa-cetian-lore-grid">
				{(section.rows || []).map((r)=>{
					const parts = `${r.value || ''}`.split('·');
					const yy = parts[0] || '';
					return (
						<div className="horosa-cetian-lore-card" key={r.label}>
							<div className="horosa-cetian-lore-head">
								<b>{r.label}</b>
								<span className={`horosa-cetian-lore-yy${yy === '阴' || yy === '陰' ? ' is-yin' : ''}`}>{yy}</span>
							</div>
							<div className="horosa-cetian-lore-body">{parts.slice(1).join(' · ')}</div>
						</div>
					);
				})}
			</div>
		</SecCard>
	);
}

/**
 * 主入口：按段名分派美化渲染。
 * @param sections  当前页签的段数组
 * @param pan       完整 pan（取 yiyu 原始数据）
 * @param fallback  (sectionsSubset)=>JSX 通用渲染（未识别段回落）
 */
export function renderCetianSectionList(sections, pan, fallback){
	const yiyu = (pan && pan.yiyu) || {};
	const out = [];
	let plain = [];
	const flushPlain = ()=>{
		if(plain.length){
			out.push(<React.Fragment key={`plain${out.length}`}>{fallback(plain)}</React.Fragment>);
			plain = [];
		}
	};
	(sections || []).forEach((section)=>{
		const t = section.title;
		let node = null;
		if(t === '运限' && yiyu.yunxian){ node = <YunxianSec yunxian={yiyu.yunxian} liunian={yiyu.liunian} />; }
		else if(t === '童限' && yiyu.yunxian){ node = <TongxianSec yunxian={yiyu.yunxian} />; }
		else if(t === '凶限提示' && yiyu.yunxian){ node = <XiongxianSec yunxian={yiyu.yunxian} />; }
		else if(t === '会照' && yiyu.huizhao){ node = <HuizhaoSec huizhao={yiyu.huizhao} />; }
		else if(t === '流年飞星' && yiyu.liunian){ node = <LiunianZhuxuSec liunian={yiyu.liunian} />; }
		else if(t === '流年七煞' && yiyu.liunian){ node = <LiunianQishaSec liunian={yiyu.liunian} />; }
		else if(t === '十七飞星' && yiyu.liunian){ node = <ShiqiSec liunian={yiyu.liunian} />; }
		else if(/^神煞·/.test(t) && yiyu.shensha){ node = <ShenshaSec title={t} shensha={yiyu.shensha} />; }
		else if(t === '三日宫' && yiyu.xiu){ node = <SanriSec xiu={yiyu.xiu} />; }
		else if(t === '廿八宿分野'){ node = <FenyeSec section={section} />; }
		else if(t === '十干变曜' && yiyu.bianyao){ node = <BianyaoSec bianyao={yiyu.bianyao} />; }
		else if(t === '杂曜' && yiyu.zayao){ node = <ZayaoSec zayao={yiyu.zayao} notes={yiyu.zayao_notes} />; }
		else if(t === '断诀' && yiyu.duanjue){ node = <DuanjueSec duanjue={yiyu.duanjue} />; }
		else if(t === '星曜别名'){ node = <LoreSec section={section} />; }
		if(node){
			flushPlain();
			out.push(<React.Fragment key={t}>{node}</React.Fragment>);
		}else{
			plain.push(section);
		}
	});
	flushPlain();
	return <div className="horosa-cetian-rich">{out}</div>;
}

export default renderCetianSectionList;
