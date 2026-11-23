// 策天页 · 中栏各流派盘:邵子 / 铁板(框架与卦)/ 分经 / 北极 / 南极 / 春字 / 策天 / 紫微
// 从 KinAstroMain.js 按职责拆出的 KinAstroMain 方法:this 仍是 KinAstroMain 实例,门面里 mixinMethods(KinAstroMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { buildTiebanFramework, buildTiebanFrameworkSnapshot, tiebanKeBeyondEight } from '../../../utils/tiebanFrameworkLocal';
import ZiWeiChart from '../../ziwei/ZiWeiChart';
import { parseYearFromDateStr } from '../../../utils/dateStrSafe';
import { ownedBoxSizeRef, narrowBoardVars } from '../../../utils/boxSizeVars';
import { TWELVE_PALACE_LAYOUT } from './config';
import { fmtValue, textValue } from './snapshot';
import { buildZiWeiRulesForChart, buildKinAstroZiWeiChart } from './ziweiChart';

export const schoolCenterMethods = {
	renderMetaGrid(items){
		return (
			<div className="horosa-huangji-meta-grid horosa-kinastro-meta-grid">
				{items.map((item)=>(
					<div key={item.label}>
						<span>{item.label}</span>
						<strong>{fmtValue(item.value)}</strong>
					</div>
				))}
			</div>
		);
	},

	renderShaoziCenter(pan){
		const sz = pan.shaozi || {};
		const full = pan.full || {};
		const key = full.key || {};
		const pillars = pan.pillars || [];
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-shaozi-board" ref={ownedBoxSizeRef(this, 'shaozi', narrowBoardVars)}>
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">邵子神数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '条文号', value: sz.tiaowenId },
					{ label: '集', value: sz.collection },
					{ label: '卦名', value: sz.guaName || full.gua },
					{ label: '基础数', value: full.base_number },
					{ label: '钥匙', value: key['名稱'] },
					{ label: '刻数', value: pan.ke },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{pillars.map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.key}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-feature-grid">
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>四位起数</span>
						<strong>{fmtValue(sz.yearDigit)} / {fmtValue(sz.monthDigit)} / {fmtValue(sz.dayDigit)} / {fmtValue(sz.hourDigit)}</strong>
						<p>{fmtValue(sz.note)}</p>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>条文</span>
						<strong>{fmtValue(sz.tiaowenText)}</strong>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>64钥匙</span>
						<strong>{fmtValue(key['說明'])}</strong>
						<p>{fmtValue(key['特殊事項'])}</p>
					</div>
				</div>
			</div>
		);
	},

	renderTiebanCenter(pan){
		const tieban = pan.tieban || {};
		const kunji = tieban.kunji || {};
		const suanpan = tieban.suanpan || {};
		const isSuanpan = tieban.method === 'suanpan';
		const pillars = pan.pillars || [];
		const primaryText = isSuanpan ? textValue(suanpan.tiaowen) : textValue(kunji.tiaowen_data || kunji.verse);
		const palaceRows = Object.keys(kunji.palace_verses || {}).slice(0, 6).map((name)=>{
			const item = kunji.palace_verses[name] || {};
			return {
				name: name.replace(/[宮宫]$/, ''),
				branch: item.branch,
				number: item.number,
				verse: item.verse,
			};
		});
		const dayun = tieban.dayun || [];
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-tieban-board" ref={ownedBoxSizeRef(this, 'tieban', narrowBoardVars)}>
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">铁板神数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '算法', value: tieban.methodLabel },
					{ label: isSuanpan ? '算盘总数' : '铁板号码', value: isSuanpan ? suanpan.total_number : kunji.tieban_number },
					{ label: isSuanpan ? '条文编号' : '坤集条文号', value: isSuanpan ? suanpan.tiaowen_key : kunji.tiaowen_number },
					{ label: isSuanpan ? '五部' : '命宫', value: isSuanpan ? suanpan.department : kunji.ming_palace },
					{ label: isSuanpan ? '纳音' : '身宫', value: isSuanpan ? suanpan.nayin : kunji.shen_palace },
					{ label: isSuanpan ? '岁君加数' : '刻分', value: isSuanpan ? suanpan.suijun_add : `${fmtValue(kunji.ke_label)} / ${fmtValue(kunji.fen)}` },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{pillars.map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.key}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-feature-grid horosa-kinastro-tieban-feature-grid">
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>{isSuanpan ? '算盘结构' : '命身刻分'}</span>
						<strong>{isSuanpan ? `${fmtValue(suanpan.stem_sum)} + ${fmtValue(suanpan.branch_sum)} + ${fmtValue(suanpan.suijun_add)}` : `${fmtValue(kunji.ming_palace)} / ${fmtValue(kunji.shen_palace)} / ${fmtValue(kunji.wuxing_ju)}`}</strong>
						<p>{isSuanpan ? fmtValue(suanpan.note) : `河洛数 ${fmtValue(kunji.he_luo_number)}，扣入 ${fmtValue(kunji.kunji_tiangan)}`}</p>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card is-large">
						<span>条文</span>
						<strong>{primaryText}</strong>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>大运</span>
						<strong>{dayun.slice(0, 3).map((item)=>fmtValue(item.age || item.dayun_number)).filter((item)=>item !== '—').join(' / ') || '—'}</strong>
						<p>{dayun.length ? textValue(dayun[0].tiaowen) : '—'}</p>
					</div>
				</div>
				{palaceRows.length ? (
					<div className="horosa-kinastro-tieban-palace-strip">
						{palaceRows.map((item)=>(
							<div key={`${item.name}_${item.branch}`}>
								<span>{item.name} {fmtValue(item.branch)}</span>
								<strong>{fmtValue(item.number)}</strong>
								<p>{fmtValue(item.verse)}</p>
							</div>
						))}
					</div>
				) : null}
				{this.renderTiebanFramework(pan)}
			</div>
		);
	},

	tiebanFrameworkSuffix(pan){
		if(this.config.serviceKey !== 'tieban' || !pan){ return ''; }
		try{ return buildTiebanFrameworkSnapshot(this.tiebanFrameworkOf(pan)) || ''; }catch(e){ return ''; }
	},

	renderTiebanFramework(pan){
		const fw = this.tiebanFrameworkOf(pan);
		if(!fw){ return null; }
		const keLabel = ['初', '二', '三', '四', '五', '六', '七', '八'];
		const twinLabel = { off: '', shang: '·上分', zhong: '·中分', xia: '·下分' }[this.state.tiebanTwinFen] || '';
		return (
			<div className="horosa-kinastro-tieban-framework">
				<div className="horosa-kinastro-tieban-fw-head">
					<h3>框架推演</h3>
					<span className="horosa-kinastro-tieban-fw-tags">{fw.schoolInfo.label} · {fw.keSystemInfo.label} · {fw.sanyuanLabel}{twinLabel}{this.state.tiebanGuofang ? ' · 过房对条' : ''}</span>
				</div>
				<div className="horosa-kinastro-tieban-fw-grid">
					<div className="horosa-huangji-info-card">
						<div className="horosa-huangji-info-heading">考刻六亲（年父母·月兄弟·日夫妻·时子女）</div>
						{fw.liuQin.map((q)=>(
							<div className="horosa-huangji-info-row" key={q.pillar}><span>{q.label}·{q.liuqin}</span><strong>{fmtValue(q.ganzhi)}{q.shengxiao ? `（属${q.shengxiao}）` : ''} · 太玄 {fmtValue(q.taixuanGan)}/{fmtValue(q.taixuanZhi)}</strong></div>
						))}
						<div className="horosa-huangji-info-row"><span>八刻天干</span><strong className="horosa-kinastro-tieban-keline">{fw.eightKe.map((k)=>(<em key={k.ke} className={k.active ? 'is-active' : ''}>{keLabel[k.ke - 1]}{k.gan}</em>))}</strong></div>
						{tiebanKeBeyondEight(fw) ? <div className="horosa-huangji-info-row"><span>考刻</span><strong>{tiebanKeBeyondEight(fw)}</strong></div> : null}
						{fw.ju ? <div className="horosa-huangji-info-row"><span>九十六局</span><strong>{fw.ju.label} · {fw.keSystemInfo.juStruct}</strong></div> : null}
					</div>
					<div className="horosa-huangji-info-card">
						<div className="horosa-huangji-info-heading">八卦滚（{fw.baseGua.name}起 · {fw.roll.seq.length}卦{fw.roll.verseCount}条结构）</div>
						<div className="horosa-kinastro-tieban-bagua-strip">
							{fw.roll.seq.map((g)=>(
								<div className="horosa-kinastro-tieban-bagua-item" key={g.idx}>{this.renderTiebanGua(g.lines)}<span>{g.name}</span></div>
							))}
						</div>
						<div className="horosa-huangji-info-row"><span>三元取数</span><strong>{fw.sanyuanLabel} 权重{fw.roll.weight} · 变爻 {fw.roll.bianYao9.pos}·{fw.roll.bianYao9.ying}／{fw.roll.bianYao6.pos}爻</strong></div>
						<div className="horosa-kinastro-tieban-fw-note">精确条文号由坤集密码表定（秘传），框架层只推卦象。</div>
					</div>
					<div className="horosa-huangji-info-card">
						<div className="horosa-huangji-info-heading">批断顺序</div>
						<div className="horosa-kinastro-tieban-piduan">
							{fw.piduan.map((pp, i)=>(<span className="horosa-kinastro-tieban-piduan-step" key={pp.key}>{i + 1}.{pp.name}<em>{pp.pillar}</em></span>))}
						</div>
					</div>
				</div>
			</div>
		);
	},

	tiebanFrameworkOf(pan){
		const pillars = pan.pillars || [];
		const gz = (k, i)=>{ const byKey = pillars.find((pp)=>pp.key === k); return (byKey && byKey.ganzhi) || (pillars[i] && pillars[i].ganzhi) || ''; };
		const fourPillars = { year: gz('year', 0), month: gz('month', 1), day: gz('day', 2), hour: gz('hour', 3) };
		const birthYear = parseYearFromDateStr(`${pan.dateStr || ''}`) || 0;
		return buildTiebanFramework(fourPillars, { school: this.state.tiebanSchool, keSystem: this.state.tiebanKeSystem, ke: this.state.tiebanKe, gender: this.state.gender, birthYear });
	},

	renderTiebanGua(lines){
		const rows = [];
		for(let p = 6; p >= 1; p -= 1){
			const yang = lines[p - 1] === 1;
			rows.push(<span className="horosa-kinastro-tieban-yao" key={p}>{yang ? <i className="is-yang" /> : <i className="is-yin"><b /><b /></i>}</span>);
		}
		return <div className="horosa-kinastro-tieban-gua">{rows}</div>;
	},

	renderTiebanFrameworkTab(){
		const pan = this.state.pan;
		const fw = pan ? this.tiebanFrameworkOf(pan) : null;
		if(!fw){ return <div className="horosa-huangji-empty">起盘后显示框架参考</div>; }
		const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
		const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		return (
			<>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">流派 · 刻制</div>
					<div className="horosa-huangji-info-row"><span>流派</span><strong>{fw.schoolInfo.label}</strong></div>
					<div className="horosa-huangji-info-row"><span>主算柱</span><strong>{fw.schoolInfo.zhuGan}</strong></div>
					<div className="horosa-huangji-info-row"><span>卦数偏好</span><strong>{fw.schoolInfo.guaPref} · 取数 {fw.schoolInfo.quShu}</strong></div>
					<div className="horosa-huangji-info-row"><span>条文</span><strong>{fw.schoolInfo.tiaowen}（{fw.schoolInfo.note}）</strong></div>
					<div className="horosa-huangji-info-row"><span>刻制</span><strong>{fw.keSystemInfo.label} · {fw.keSystemInfo.note}</strong></div>
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">太玄配数表（相合干支同数）</div>
					<div className="horosa-huangji-info-row"><span>天干</span><strong>{GAN.map((g)=>`${g}${fw.taixuanTable.gan[g]}`).join(' ')}</strong></div>
					<div className="horosa-huangji-info-row"><span>地支</span><strong>{ZHI.map((z)=>`${z}${fw.taixuanTable.zhi[z]}`).join(' ')}</strong></div>
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">九十六局（12时辰×8刻）</div>
					{fw.ju ? <div className="horosa-huangji-info-row"><span>本命</span><strong>{fw.ju.label}</strong></div> : null}
					<div className="horosa-huangji-info-row"><span>刻制定局</span><strong>{fw.keSystemInfo.juStruct}</strong></div>
					<div className="horosa-huangji-info-row"><span>结构</span><strong>96局给大运流年粗分类（好/坏/起伏），六亲精细到384爻</strong></div>
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">借用子系统（杂用诸法之零件）</div>
					{fw.subsystems.map((sub)=>(
						<div className="horosa-huangji-info-row" key={sub.key}><span>{sub.name}</span><strong>{sub.struct}<em style={{ display: 'block', fontStyle: 'normal', color: 'var(--horosa-text-secondary)', fontSize: '11px', marginTop: '2px' }}>源 {sub.source} · {sub.use}</em></strong></div>
					))}
				</div>
			</>
		);
	},

	renderFendjingCenter(pan){
		const fendjing = pan.fendjing || {};
		const pillars = pan.pillars || [];
		const sections = fendjing.sections || {};
		const sectionCards = [
			{ key: 'foundation', title: '基业', value: sections.foundation },
			{ key: 'siblings', title: '兄弟', value: sections.siblings },
			{ key: 'conduct', title: '行藏', value: sections.conduct },
			{ key: 'marriage', title: '婚姻', value: sections.marriage },
			{ key: 'children', title: '子息', value: sections.children },
			{ key: 'harvest', title: '收成', value: sections.harvest },
		];
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-fendjing-board" ref={ownedBoxSizeRef(this, 'fendjing', narrowBoardVars)}>
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">鬼谷分定经</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '两头钳', value: fendjing.twoGanKey },
					{ label: '年干', value: fendjing.yearStem },
					{ label: '时干', value: fendjing.hourStem },
					{ label: '命格', value: fendjing.minggeName },
					{ label: '来源', value: fendjing.stemOverride ? '手动指定' : '自动换算' },
					{ label: '组合库', value: fendjing.dataSize },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{pillars.map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.key}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-feature-grid horosa-kinastro-fendjing-feature-grid">
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>判断</span>
						<strong>{fmtValue(fendjing.judgment)}</strong>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card is-large">
						<span>命格</span>
						<strong>{fmtValue(fendjing.minggeName)}</strong>
						<p>{fmtValue(fendjing.minggeText)}</p>
					</div>
					<div className="horosa-taixuan-text-card horosa-kinastro-text-card">
						<span>两头取象</span>
						<strong>{fmtValue(fendjing.twoGanKey)}</strong>
						<p>{fmtValue(fendjing.yearStem)}年干 · {fmtValue(fendjing.hourStem)}时干</p>
					</div>
				</div>
				<div className="horosa-kinastro-fendjing-verse-grid">
					{sectionCards.map((item)=>(
						<div key={item.key}>
							<span>{item.title}</span>
							<p>{fmtValue(item.value)}</p>
						</div>
					))}
				</div>
			</div>
		);
	},

	renderBeijiCenter(pan){
		const beiji = pan.beiji || {};
		const queries = beiji.queries || [];
		const dayun = beiji.dayun || [];
		const family = (beiji.queryGroups && beiji.queryGroups.family) || queries.filter((item)=>['parents', 'siblings', 'first_wife_surname', 'remarriage_wife_surname', 'children'].includes(item.type));
		const fortune = (beiji.queryGroups && beiji.queryGroups.fortune) || queries.filter((item)=>['character', 'wealth', 'career', 'health'].includes(item.type));
		const queryCard = (item)=>(
			<div key={`${item.type}_${item.code}`}>
				<span>{fmtValue(item.label)}</span>
				<strong>{fmtValue(item.code)} · {fmtValue(item.palaceName)}宫{item.surname ? ` · 姓${fmtValue(item.surname)}` : ''}</strong>
				<p>{fmtValue(item.verse)}</p>
			</div>
		);
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-beiji-board" ref={ownedBoxSizeRef(this, 'beiji', narrowBoardVars)}>
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">北极神数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '年干支', value: `${fmtValue(beiji.yearStem)}${fmtValue(beiji.yearBranch)}` },
					{ label: '生肖', value: beiji.yearShengxiao },
					{ label: '时辰', value: `${fmtValue(beiji.hourBranch)}时` },
					{ label: '刻', value: `${fmtValue(beiji.keValue)} · ${fmtValue(beiji.keLabel)}` },
					{ label: '刻法', value: beiji.keModeLabel },
					{ label: '条文库', value: beiji.verseCount },
					...(beiji.keMode === 'manual' ? [{ label: '自动刻', value: `${fmtValue(beiji.autoKeValue)} · ${fmtValue(beiji.autoKeLabel)}` }] : []),
				])}
				<div className="horosa-kinastro-beiji-core">
					<div className="horosa-shenyishu-pillar-card">
						<span>年干</span>
						<strong>{fmtValue(beiji.yearStem)}</strong>
					</div>
					<div className="horosa-shenyishu-pillar-card">
						<span>年支</span>
						<strong>{fmtValue(beiji.yearBranch)}</strong>
					</div>
					<div className="horosa-shenyishu-pillar-card">
						<span>时辰</span>
						<strong>{fmtValue(beiji.hourBranch)}时</strong>
					</div>
					<div className="horosa-shenyishu-pillar-card">
						<span>刻分</span>
						<strong>{fmtValue(beiji.keLabel)}</strong>
					</div>
				</div>
				<div className="horosa-kinastro-beiji-query-grid">
					{family.slice(0, 4).map(queryCard)}
					{fortune.slice(0, 4).map(queryCard)}
				</div>
				<div className="horosa-kinastro-beiji-dayun-grid">
					{dayun.map((item)=>(
						<div key={`${item.index}_${item.code}`}>
							<span>{fmtValue(item.startAge)}-{fmtValue(item.endAge)}岁</span>
							<strong>{fmtValue(item.stemBranch)}</strong>
							<p>{fmtValue(item.code)} · {fmtValue(item.direction)}行</p>
						</div>
					))}
				</div>
			</div>
		);
	},

	renderNanjiCenter(pan){
		const nanji = pan.nanji || {};
		const fp = nanji.fourPillars || {};
		const query = nanji.query || {};
		const palaceEntries = nanji.palaceEntries || [];
		const queryEntries = query.entries || [];
		const dayun = nanji.daYun || [];
		const primaryEntries = queryEntries.length ? queryEntries : palaceEntries.slice(0, 6);
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-nanji-board" ref={ownedBoxSizeRef(this, 'nanji', narrowBoardVars)}>
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">南极神数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '宫部', value: nanji.palaceSection },
					{ label: '起盘方式', value: nanji.modeLabel },
					{ label: '年干阴阳', value: fp.yearYinyang },
					{ label: '条文库', value: nanji.verseCount },
					{ label: '查询密码', value: query.code },
					{ label: '命中数', value: query.count },
					{ label: '星图', value: nanji.divine && nanji.divine.chart },
					{ label: '推演宫', value: nanji.divine && nanji.divine.palace },
					{ label: '宿度', value: nanji.divine && nanji.divine.degree },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{[
						{ label: '年柱', value: fp.year },
						{ label: '月柱', value: fp.month },
						{ label: '日柱', value: fp.day },
						{ label: '时柱', value: fp.hour },
					].map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.label}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.value)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-nanji-entry-grid">
					{primaryEntries.slice(0, 6).map((item, idx)=>(
						<div key={`${item.rawSection || item.section}_${item.rawCode || item.code}_${idx}`}>
							<span>{fmtValue(item.section)} · {fmtValue(item.code)}</span>
							<strong>{fmtValue(item.verse)}</strong>
							<p>{fmtValue(item.comment)}</p>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-beiji-dayun-grid horosa-kinastro-nanji-dayun-grid">
					{dayun.map((item)=>(
						<div key={`${item.index}_${item.ganzhi}`}>
							<span>{fmtValue(item.startAge)}-{fmtValue(item.endAge)}岁</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
							<p>第{fmtValue(item.index)}运</p>
						</div>
					))}
				</div>
			</div>
		);
	},

	renderChunziCenter(pan){
		const chunzi = pan.chunzi || {};
		const analysis = chunzi.analysis || {};
		const parents = analysis.parents || {};
		const spouse = analysis.spouse || {};
		const children = analysis.children || {};
		const verses = chunzi.verses || [];
		const renderVerse = (item, idx)=>(
			<div key={`${item.rawCode || item.code}_${idx}`}>
				<span>{fmtValue(item.code)} · {fmtValue(item.category)}宿</span>
				<strong>{[item.star, item.degree ? `${item.degree}度` : '', item.branch].map(fmtValue).filter((text)=>text && text !== '—').join(' · ') || '—'}</strong>
				<p>{fmtValue(item.verse)}</p>
			</div>
		);
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-chunzi-board" ref={ownedBoxSizeRef(this, 'chunzi', narrowBoardVars)}>
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">蠢子数</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				{this.renderMetaGrid([
					{ label: '命造', value: chunzi.genderLabel },
					{ label: '刻法', value: chunzi.keModeLabel },
					{ label: '刻数', value: chunzi.keValueLabel },
					{ label: '月日匹配', value: chunzi.lunarModeLabel },
					{ label: '农历月日', value: chunzi.lunarText },
					{ label: '候选代码', value: (chunzi.codes || []).length },
					{ label: '显示数量', value: chunzi.resultLimit ? `${chunzi.resultLimit}条` : '' },
					{ label: '条文库', value: chunzi.verseCount },
				])}
				<div className="horosa-kinastro-pillar-grid">
					{(chunzi.pillars || []).map((item)=>(
						<div className="horosa-shenyishu-pillar-card" key={item.key || item.label}>
							<span>{item.label}</span>
							<strong>{fmtValue(item.ganzhi)}</strong>
						</div>
					))}
				</div>
				<div className="horosa-kinastro-chunzi-analysis-grid">
					<div>
						<span>父母</span>
						<strong>{fmtValue({
							父属: parents.father,
							母属: parents.mother,
							父先亡: parents.father_first,
							母先亡: parents.mother_first,
						})}</strong>
					</div>
					<div>
						<span>妻宫</span>
						<strong>{fmtValue({
							属相: spouse.zodiac,
							侧室: spouse.concubine,
							再娶: spouse.remarriage,
						})}</strong>
					</div>
					<div>
						<span>子息</span>
						<strong>{fmtValue({
							数量: children.count,
							带石皮: children.stone_skin,
						})}</strong>
					</div>
					<div>
						<span>事业 / 特记</span>
						<strong>{fmtValue([analysis.career, analysis.conflicts, analysis.flags, analysis.longevity ? `寿元${analysis.longevity}岁` : ''])}</strong>
					</div>
				</div>
				<div className="horosa-kinastro-nanji-entry-grid horosa-kinastro-chunzi-verse-grid">
					{verses.length ? verses.slice(0, 6).map(renderVerse) : (
						<div>
							<span>候选条文</span>
							<strong>未命中</strong>
							<p>可改用手动代码、宿名或关键词检索补查。</p>
						</div>
					)}
				</div>
			</div>
		);
	},

	renderCetianCenter(pan){
		const chart = pan.cetian || {};
		const branchToPalace = {};
		(chart.palaces || []).forEach((palace)=>{
			branchToPalace[palace.branch] = palace;
		});
		const renderCell = (item)=>{
			const palace = branchToPalace[item.branch] || {};
			const isMing = palace.branch === chart.ming_gong_branch;
			const isShen = palace.branch === chart.shen_gong_branch;
			return (
				<div
					className={`horosa-kinastro-cetian-cell${isMing ? ' is-ming' : ''}${isShen ? ' is-shen' : ''}`}
					key={`${palace.name}_${item.branch}`}
					style={{ gridRow: item.row, gridColumn: item.col }}
				>
					<div className="horosa-kinastro-cetian-cell-top">
						<span>{fmtValue(palace.branch_name)}</span>
						<em>{fmtValue(palace.da_xian)}</em>
					</div>
					<strong>{fmtValue(palace.name)}</strong>
					<div className="horosa-kinastro-cetian-starline is-main">{fmtValue(palace.stars)}</div>
					<div className="horosa-kinastro-cetian-starline is-aux">{fmtValue(palace.aux_stars)}</div>
					<small className="horosa-kinastro-cetian-brightness">{Object.keys(palace.brightness || {}).map((s)=>`${s}${palace.brightness[s]}`).join(' ')}</small>
				</div>
			);
		};
		return (
			<div className="horosa-taixuan-board horosa-kinastro-board horosa-kinastro-cetian-board" ref={ownedBoxSizeRef(this, 'cetian', narrowBoardVars)}>
				<div className="horosa-huangji-board-header">
					<div><h2 className="horosa-taixuan-title">策天飞星</h2></div>
					<div className="horosa-huangji-board-time">{fmtValue(pan.dateStr)} {fmtValue(pan.timeStr)}</div>
				</div>
				<div className="horosa-kinastro-cetian-grid">
					{TWELVE_PALACE_LAYOUT.map(renderCell)}
					<div className="horosa-kinastro-cetian-center">
						<h3>策天十八飞星</h3>
						<p>{fmtValue(pan.lunar && pan.lunar.text)}</p>
						<div className="horosa-kinastro-cetian-center-grid">
							<span>命宫<strong>{fmtValue(pan.mingGong)}</strong></span>
							<span>身宫<strong>{fmtValue(pan.shenGong)}</strong></span>
							{pan.wuXingJu ? <span>五行局<strong>{fmtValue(pan.wuXingJu)}</strong></span> : null}
							<span>紫微<strong>{fmtValue(pan.ziwei)}</strong></span>
						</div>
						{chart.sihua && Object.keys(chart.sihua).length ? (
							<div className="horosa-kinastro-cetian-sihua">
								{Object.keys(chart.sihua).map((star)=>(<span key={star}>{star}化{chart.sihua[star]}</span>))}
							</div>
						) : null}
						<small>{fmtValue(chart.solar_term_influence)}</small>
					</div>
				</div>
			</div>
		);
	},

	renderZiWeiCopiedCenter(pan){
		const chart = buildKinAstroZiWeiChart(pan, this.config.serviceKey);
		const rules = buildZiWeiRulesForChart(chart);
		return (
			<div className="horosa-kinastro-ziwei-copy-board">
				<div className="horosa-ziwei-chart-viewport horosa-kinastro-ziwei-viewport">
					<ZiWeiChart
						value={chart}
						height="100%"
						fields={this.props.fields}
						rules={rules}
					/>
				</div>
			</div>
		);
	},
};
