// 三式合一页 · 右栏(用神 / 解化 / 六壬神煞旺衰 / 各页签)与底部快捷栏
// 从 SanShiUnitedMain.js 按职责拆出的 SanShiUnitedMain 方法:this 仍是 SanShiUnitedMain 实例,门面里 mixinMethods(SanShiUnitedMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Tag } from 'antd';
import { XQButton as Button, XQCard as Card, XQTabs as Tabs } from '../../xq-ui';
import * as LRConst from '../../liureng/LRConst';
import SanShiZiWeiSihua from '../SanShiZiWeiSihua';
import DateTime from '../../comp/DateTime';
import QuickDockBar from '../../common/QuickDockBar';
import { computeTaiyiShuli, shuliTone } from '../../taiyi/core/taiyiShuli';
import { computeGeju } from '../../taiyi/core/taiyiGeju';
import { computeVictory, computeFenye, computeShenSuan, computeTaisuiAlias, activeDoorJixiong, computeEhui, computeLimitYun, computeSanyuan, computeShiJing, computeWuziyuan } from '../../taiyi/core/taiyiDuanfa';
import { computeTaiyiNayin } from '../../taiyi/core/taiyiNayin';
import { computeYearShenSha } from '../../liureng/LRShenShaDoc';
import { liurengWangXiang, judgeKongWang } from '../../liureng/LRZhangSheng';
import { matchBiFa, BIFA_LIST } from '../../liureng/LRBiFaDoc';
import { kvInfoCard as sanshiKvCard, splitLabelText as splitSanshiLabelText, KvInfoNote } from '../../common/KvInfoCard';
import { qimenOverlayCards, jianChuCard } from '../../dunjia/QimenOverlayControls';
import { LiuRengRefCard, LiuRengRefEmpty, LiuRengRefFacts, LiuRengRefGroupTitle } from '../../lrzhan/LiuRengRefCard';
import { buildReferenceDocumentText, buildOverviewReferenceText, XIAO_JU_REFERENCE_TAB_KEYS, buildQiZhengItems, QIZHENG_PLANET_COLOR, QIZHENG_WUXING_COLOR } from '../../lrzhan/LiuRengMain';
import { BAGONG_PALACE_ORDER, BAGONG_PALACE_NAME, buildQimenBaGongPanelData } from '../../dunjia/DunJiaBaGongRules';
import { computeYongShen, computeGuGua, buildJieHua, computeDangers, computeProtect } from '../../dunjia/DunJiaFaCalc';
import { SAN_FA_TEXT, BU_ZHEN_TIPS, DANGER_BRIEF, GAN_XIANG, ZHI_ZODIAC, LUOSHU_NUM } from '../../dunjia/DunJiaFaDoc';
import { QIMEN_YONGSHEN_BASIC, QIMEN_YONGSHEN_LOOKUP, QIMEN_YONGSHEN_SHENGKE } from '../../dunjia/main/options';
import { visualFloorPx } from '../../../utils/zoomDomain';
import { QIMEN_HARM_COLOR, tint } from '../../dunjia/qimenHarmColors';
import { getTimeAlgLabel } from './format';
import { SANSHI_TRUE_SOLAR_FALLBACK_NOTE, computeSanshiXun } from './liureng';
import { FreezeSubTab } from '../../comp/FreezeInactive';
const TabPane = Tabs.TabPane;

export const rightPanelMethods = {
	// 快捷栏契约:右栏 tab 镜像(概览/太乙/六壬/遁甲)撤除,只留本页没有的动词。
	renderQuickDock(){
		return (
			<QuickDockBar
				page="sanshi"
				className="horosa-sanshi-quick-dock"
				hasResult={!!(this.state.hasPlotted && this.state.dunjia)}
				primary={{ key: 'plot', label: '起盘', disabled: this.state.loading, onClick: this.clickPlot }}
				extras={[
					{ key: 'nowPlot', label: '此刻起盘', icon: 'quickTransit', needsResult: false, disabled: this.state.loading, onClick: ()=>this.clickPlotNow() },
				]}
				save={this.clickSave}
				dispatch={this.props.dispatch}
			/>
		);
	},

	// 六壬层「年神排序 / 土旺衰」的页面落点(与独立六壬页同源函数:computeYearShenSha /
	// liurengWangXiang / judgeKongWang)。此前两档只进 AI 快照断卦层,页面拨了 DOM 一个字节都不变。
	renderLiuRengShenShaWangShuai(refContext){
		const ctx = refContext || {};
		if(!ctx.dayGan){ return null; }
		const opt = this.state.options || {};
		const sort = opt.yearShenShaSort || 'sanyuan';
		const tuWs = opt.tuWangShuai || 'siji';
		const wxOf = (z)=>(LRConst.GanZiWuXing[`${z || ''}`.trim().substring(0, 1)] || '');
		const yearList = ctx.yearBranch ? computeYearShenSha(ctx.yearBranch, sort, ctx.courseBranches || []) : [];
		const wsList = (ctx.sanChuanBranches || []).map((z, i)=>{
			const wx = wxOf(z);
			return { pos: ['初传', '中传', '末传'][i] || '', zhi: z, wx, ws: liurengWangXiang(wx, ctx.monthBranch, tuWs) };
		}).filter((x)=>x.ws);
		const kongList = (ctx.xunKongBranches || []).map((z)=>{
			const wx = wxOf(z);
			const j = judgeKongWang(wx, ctx.monthBranch, tuWs);
			return j ? { zhi: z, wx, kind: j.kind, ws: j.ws, basis: j.basis, inSanChuan: (ctx.sanChuanBranches || []).indexOf(z) >= 0 } : null;
		}).filter(Boolean);
		if(!yearList.length && !wsList.length && !kongList.length){ return null; }
		const WS_COLOR = { 旺: 'var(--horosa-jx-ji, #3fa45b)', 相: 'var(--horosa-jx-he, #5fae6f)', 休: 'var(--horosa-muted,#9a8f7d)', 囚: 'var(--horosa-jx-other, #d08a3a)', 死: 'var(--horosa-jx-xiong, #e2574c)' };
		const cellBase = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 2px', borderRadius: 8, background: 'var(--horosa-panel-soft, rgba(255,255,255,0.03))', border: '1px solid var(--horosa-border, rgba(255,255,255,0.08))' };
		return (
			<>
				{yearList.length ? (
					<Card size='small' style={{ marginBottom: 10 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>年神</span>
							<Tag color='gold'>{sort === 'suigui' ? '太岁排轮' : '四利三元序'}</Tag>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
							{yearList.map((sInfo)=>(
								<div key={sInfo.name} title={`${sInfo.brief || ''}（起例所临：${sInfo.branch}）`}
									style={{ ...cellBase, background: sInfo.inCourse ? 'rgba(212,160,23,0.12)' : cellBase.background, border: sInfo.inCourse ? '1px solid var(--horosa-accent, #d4a017)' : cellBase.border }}>
									<span style={{ fontSize: 12, color: sInfo.color, fontWeight: 600 }}>{sInfo.name}</span>
									<span style={{ fontSize: 16, fontWeight: 700, color: 'var(--horosa-text, #d8d2c7)' }}>{sInfo.branch}</span>
								</div>
							))}
						</div>
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>排列起点按左栏「年神排序」;入课传者高亮。</div>
					</Card>
				) : null}
				{wsList.length ? (
					<Card size='small' style={{ marginBottom: 10 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>三传旺衰</span>
							<Tag color='gold'>以月令</Tag>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
							{wsList.map((w)=>(
								<div key={w.pos} style={cellBase}>
									<span style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)' }}>{w.pos}·{w.zhi}{w.wx}</span>
									<span style={{ fontSize: 16, fontWeight: 700, color: WS_COLOR[w.ws] || 'var(--horosa-text,#d8d2c7)' }}>{w.ws}</span>
								</div>
							))}
						</div>
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>旺相=得令、休囚死=失令;土旺衰按左栏「土旺衰」。</div>
					</Card>
				) : null}
				{kongList.length ? (
					<Card size='small' style={{ marginBottom: 10 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>空亡真假</span>
							<Tag color='gold'>旬空{kongList.map((k)=>k.zhi).join('')}</Tag>
						</div>
						{kongList.map((k)=>(
							<div key={k.zhi} style={{ lineHeight: '20px' }}>
								<span style={{ color: k.kind === '真空' ? 'var(--horosa-jx-xiong, #e2574c)' : 'var(--horosa-jx-ji, #3fa45b)', fontWeight: 600 }}>{k.zhi}{k.wx}·{k.kind}</span>
								<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>（{k.ws}{k.inSanChuan ? '·入传' : ''}）</span>
								<span style={{ color: 'var(--horosa-text-soft, #595959)' }}>　{k.basis}</span>
							</div>
						))}
					</Card>
				) : null}
			</>
		);
	},

		// 遁甲「用神」子tab(静态显示,跳过求测事项/报数/悬浮等交互):用神定位 + 解孤辰寡宿 + 用神取用速查表。
		// 与独立遁甲页同源(computeYongShen / computeGuGua),仅去掉交互层。
		renderSanshiYongShenStatic(pan){
			const soft = 'var(--horosa-text-soft, #595959)';
			const muted = 'var(--horosa-muted, #8c8c8c)';
			const hazardTag = (it)=>{
				if(!it || !it.palaceNum){ return <Tag color='default' style={{ marginRight: 0 }}>未现</Tag>; }
				return it.hazards && it.hazards.length ? <Tag color='red' style={{ marginRight: 0 }}>{it.hazards.join('/')}</Tag> : <Tag color='green' style={{ marginRight: 0 }}>平稳</Tag>;
			};
			const locLine = (label, it, extra)=>(
				<div key={`ssu_ys_loc_${label}`} style={{ lineHeight: '24px' }}>
					<span style={{ fontWeight: 600 }}>{label}</span>
					{it && it.symbol ? <span style={{ color: soft }}>（{it.symbol}）</span> : null}
					<span style={{ color: soft }}>：{it && it.palaceNum ? `${it.palaceName}${LUOSHU_NUM[it.palaceName]}宫·${it.direction}` : '局中未现'}</span>
					{' '}{hazardTag(it)}
					{extra ? <span style={{ color: muted }}> {extra}</span> : null}
				</div>
			);
			if(!pan){
				return <Card size='small'><div style={{ color: muted }}>请先起盘后查看用神分论。</div></Card>;
			}
			const ys = computeYongShen(pan, { faceToFace: true });
			const guGua = computeGuGua(pan);
			if(!ys){
				return <Card size='small'><div style={{ color: muted }}>当前盘暂无用神数据。</div></Card>;
			}
			const yongShenCard = (
				<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>用神定位</div>
					<div style={{ color: soft, lineHeight: '22px', marginBottom: 6 }}>{ys.yongShenText}</div>
					{locLine('日干·内心/实质', ys.dayGan)}
					{locLine('时干·外在/表象', ys.timeGan)}
					{ys.ganHe ? locLine('干合·配偶/理想型', ys.ganHe) : null}
					{locLine('值符·话语权', ys.zhiFu)}
					{locLine('值使·用武之地', ys.zhiShi)}
					<div style={{ color: muted, marginTop: 4 }}>六亲：{ys.liuQin.map((r)=>`${r.rel.split('·')[1]}(${r.symbol}${r.palaceNum ? r.palaceName + LUOSHU_NUM[r.palaceName] + '宫' : '未现'})`).join('　')}</div>
				</Card>
			);
			const guGuaCard = guGua.length ? (
				<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>解孤辰寡宿</div>
					<div style={{ color: soft, lineHeight: '24px' }}>
						{guGua.map((g, i)=>(<div key={`ssu_gg_${i}`}>{g.name}（{g.zhi}）：{g.jie}</div>))}
					</div>
				</Card>
			) : null;
			const yongShenRefCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, color: soft, marginBottom: 4 }}>基本用神</div>
					{QIMEN_YONGSHEN_BASIC.map((r, i)=>(
						<div key={`ssu_ysb_${i}`} style={{ lineHeight: '22px' }}><span style={{ fontWeight: 600 }}>{r[0]}</span><span style={{ color: muted }}>：{r[1]}</span></div>
					))}
					<div style={{ fontWeight: 600, color: soft, margin: '8px 0 4px' }}>分类取用</div>
					<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, lineHeight: '18px' }}>
						<thead><tr style={{ color: muted }}><th style={{ textAlign: 'left', padding: '2px 4px' }}>所测</th><th style={{ textAlign: 'left', padding: '2px 4px' }}>主用神</th><th style={{ textAlign: 'left', padding: '2px 4px' }}>辅看</th></tr></thead>
						<tbody>
							{QIMEN_YONGSHEN_LOOKUP.map((r, i)=>(
								<tr key={`ssu_ysl_${i}`} style={{ borderTop: '1px solid var(--horosa-border, #f0f0f0)' }}>
									<td style={{ padding: '2px 4px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r[0]}</td>
									<td style={{ padding: '2px 4px' }}>{r[1]}</td>
									<td style={{ padding: '2px 4px', color: muted }}>{r[2]}</td>
								</tr>
							))}
						</tbody>
					</table>
					<div style={{ fontWeight: 600, color: soft, margin: '8px 0 4px' }}>取用生克(断成败)</div>
					{QIMEN_YONGSHEN_SHENGKE.map((r, i)=>(
						<div key={`ssu_yss_${i}`} style={{ lineHeight: '22px' }}><span style={{ fontWeight: 600 }}>{r[0]}</span><span style={{ color: muted }}>：{r[1]}</span></div>
					))}
					<div style={{ color: muted, fontSize: 12, marginTop: 6 }}>断成败核心:看用神之间(日干vs时干、日干vs用事门)生克——生我合我者成、克我冲我者败,再叠旺衰格局。</div>
				</Card>
			);
			return <div>{yongShenCard}{guGuaCard}{yongShenRefCard}</div>;
		},

		// 遁甲「化解」子tab(静态显示,跳过求测事项/悬浮等交互):六害总览 + 逐宫化解 + 解局三法 + 八门化气大阵 + 干支形象 + 换局移星。
		// 与独立遁甲页同源(computeDangers / buildJieHua / computeProtect)。
		renderSanshiJieHuaStatic(pan){
			if(!pan){
				return <Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>请先起盘后查看化解。</div></Card>;
			}
			const DANGER_DOT = QIMEN_HARM_COLOR;
			const soft = 'var(--horosa-text-soft, #595959)';
			const muted = 'var(--horosa-muted, #8c8c8c)';
			const border = 'var(--horosa-border, #f0f0f0)';
			const dangers = computeDangers(pan);
			const jieHua = buildJieHua(pan);
			const protect = computeProtect(pan, { topic: 'shexin' });
			const badge = (ch, color, size)=>(
				<span style={{ flex: '0 0 auto', width: size || 22, height: size || 22, borderRadius: '50%', background: tint(color, 10), color, fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{ch}</span>
			);
			return (
				<div>
					<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>六害总览</span>
							<Tag color={dangers.length ? 'volcano' : 'green'} style={{ marginRight: 0 }}>{dangers.length ? `${dangers.length} 处` : '无六害'}</Tag>
						</div>
						<div style={{ color: muted, fontSize: 12, marginBottom: 8 }}>危害递减：刑＞墓＞庚＞虎＞迫＞空；天干＞一切，先解击刑天干。</div>
						{dangers.length ? dangers.map((d, i)=>(
							<div key={`ssu_hz_${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderTop: i ? `1px solid ${border}` : 'none' }}>
								{badge(d.oneChar, DANGER_DOT[d.type])}
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ lineHeight: '20px' }}><span style={{ color: DANGER_DOT[d.type], fontWeight: 600 }}>{d.type}</span><span style={{ color: soft }}> · {d.palaceName}{LUOSHU_NUM[d.palaceName]}宫 · {d.direction} · {d.symbol}</span></div>
									<div style={{ color: muted, fontSize: 12, lineHeight: '18px' }}>{DANGER_BRIEF[d.type] || d.note}</div>
								</div>
							</div>
						)) : <div style={{ color: soft }}>本局四纲八宫未现六害，吉。</div>}
					</Card>
					{jieHua.map((c, i)=>{
						const worst = (c.dangers[0] && c.dangers[0].type) || '';
						const col = DANGER_DOT[worst] || 'var(--horosa-border-strong, #d9d9d9)';
						return (
							<Card size='small' style={{ marginBottom: 10, borderRadius: 8, borderLeft: `3px solid ${col}` }} key={`ssu_jh_${i}`}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
									<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
										{c.dangers.map((d, k)=>(<span key={`ssu_db_${k}`} style={{ display: 'inline-flex' }}>{badge(d.oneChar, DANGER_DOT[d.type])}</span>))}
										<span style={{ fontWeight: 600, color: col }}>{c.palaceName}{LUOSHU_NUM[c.palaceName]}宫<span style={{ color: muted, fontWeight: 400, fontSize: 12 }}> · {c.direction} · {c.deg}</span></span>
									</span>
									<Tag style={{ marginRight: 0, flex: '0 0 auto' }}>天盘干「{c.tianGan}」</Tag>
								</div>
								<div style={{ color: soft, lineHeight: '22px' }}>
									{c.mie.length ? (
										<div style={{ marginBottom: 4 }}><span style={{ color: muted }}>① 灭象（先移走）</span>
											{c.mie.map((m, k)=>(<div key={`ssu_mie_${k}`} style={{ paddingLeft: 20 }}>· {m}</div>))}
										</div>
									) : null}
									{c.placements.length ? (
										<div style={{ marginBottom: 4 }}><span style={{ color: muted }}>② 布阵（再放上）</span>
											{c.placements.map((p, k)=>(<div key={`ssu_pl_${k}`} style={{ paddingLeft: 20 }}><span style={{ color: 'var(--horosa-jx-ji)', fontWeight: 600 }}>{p.where}</span>　{p.text}</div>))}
										</div>
									) : null}
									<div style={{ display: 'flex', alignItems: 'flex-start' }}><span style={{ color: muted, flex: '0 0 auto' }}>③ 时机　</span><span>本宫 {c.benZhi}日 / {c.ben}<br />对宫 {c.duiZhi}日 / {c.dui}</span></div>
									{c.notes.map((n, k)=>(<div key={`ssu_nt_${k}`} style={{ color: muted, fontSize: 12, marginTop: 2 }}>※ {n}</div>))}
								</div>
							</Card>
						);
					})}
					<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
						<div style={{ fontWeight: 600, marginBottom: 6 }}>解局三法（逆天程度递增）</div>
						<div style={{ color: soft, lineHeight: '22px' }}>
							{SAN_FA_TEXT.map((f, i)=>(<div key={`ssu_sf_${i}`}><span style={{ fontWeight: 600 }}>{f.name}</span><span style={{ color: muted }}>（{f.scope}）</span>　{f.desc}</div>))}
						</div>
					</Card>
					<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>八门化气大阵 · 必护天干</span>
							<Tag color='geekblue' style={{ marginRight: 0 }}>{protect.filter((r)=>r.palaceNum && !r.ok).length} 处需护</Tag>
						</div>
						<div style={{ color: muted, fontSize: 12, marginBottom: 6 }}>先离刑墓庚（主），再离虎迫空（次）；天干往高处放、地支往低处放。下列天干勿落六害宫、勿受克。</div>
						{protect.map((r, i)=>(
							<div key={`ssu_pr_${i}`} style={{ lineHeight: '22px', padding: '3px 0', borderTop: i ? `1px solid ${border}` : 'none' }}>
								<span style={{ fontWeight: 600 }}>{r.label}{r.gan ? `「${r.gan}」` : ''}</span>
								<span style={{ color: soft }}>：{r.palaceNum ? `${r.palaceName}${LUOSHU_NUM[r.palaceName]}宫·${r.direction}` : '局中未现'}</span>
								{r.hazards.length ? <Tag color='red' style={{ marginLeft: 6 }}>{r.hazards.join('/')}</Tag> : (r.palaceNum ? <Tag color='green' style={{ marginLeft: 6 }}>平稳</Tag> : null)}
								<div style={{ color: muted, fontSize: 12, paddingLeft: 2 }}>{r.advice}</div>
							</div>
						))}
						<div style={{ color: muted, fontSize: 12, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${border}` }}>
							<div style={{ marginBottom: 2 }}>※「生年干」指<strong>局中所有相关人</strong>（本人 / 家人 / 牵涉者）的出生年天干，都不能落刑墓——此处仅按本盘年干示例，其余请按各人属相或八字年干自行加护。</div>
							{BU_ZHEN_TIPS.map((t, i)=>(<div key={`ssu_bz_${i}`}>· {t}</div>))}
						</div>
					</Card>
					<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
						<div style={{ fontWeight: 600, marginBottom: 6 }}>干支形象表（造象参考）</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12, rowGap: 2, color: soft, lineHeight: '22px', fontSize: 13 }}>
							{Object.keys(GAN_XIANG).map((g)=>(<span key={`ssu_gx_${g}`}><span style={{ fontWeight: 600 }}>{g}</span>　{GAN_XIANG[g].color}·{GAN_XIANG[g].material}（{GAN_XIANG[g].branch}{ZHI_ZODIAC[GAN_XIANG[g].branch]}）</span>))}
						</div>
					</Card>
					<Card size='small' style={{ borderRadius: 8 }}>
						<div style={{ fontWeight: 600, marginBottom: 6 }}>换局 / 移星</div>
						<div style={{ color: soft, lineHeight: '22px' }}>局太差、改不动时可整盘换局＝顺转宫位（移即催）。转两三个重点宫为宜，勿全转。</div>
					</Card>
				</div>
			);
		},

		renderRight(){
			const fields = this.getActiveFields();
			const pan = this.state.dunjia;
			const opt = this.state.options || {};
		const ovXun = computeSanshiXun(pan);
		const rightPanelTab = this.state.rightPanelTab === 'status' ? 'overview' : this.state.rightPanelTab;
		const refBundle = this.state.liurengRefBundle || {};
		const refContext = refBundle.context || {};
		const xiaojuAllItems = Array.isArray(refBundle.xiaoju) ? refBundle.xiaoju : [];
		const xiaojuMainItems = xiaojuAllItems.filter((item)=>!XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
		const xiaojuReferenceItems = xiaojuAllItems.filter((item)=>XIAO_JU_REFERENCE_TAB_KEYS.has(item.key));
		const overviewItems = Array.isArray(refBundle.overview) ? refBundle.overview : [];
		const refSummary = [
			refContext.courseName ? `课式：${refContext.courseName}` : '',
			refContext.sanChuanText ? `三传：${refContext.sanChuanText}` : '',
			refContext.dayGanZi ? `日干支：${refContext.dayGanZi}` : '',
		].filter(Boolean).join('；');
		const bagongPalace = BAGONG_PALACE_NAME[this.state.bagongPalace] ? this.state.bagongPalace : BAGONG_PALACE_ORDER[0];
		const bagongData = buildQimenBaGongPanelData(pan, bagongPalace);
		const panelHeight = this.state.rightPanelHeight || Math.max(visualFloorPx(420), (this.state.viewportHeight || 900) - 120);
		return (
			<div ref={this.captureRightPanel} className="horosa-sanshi-right-shell" style={{ display: 'flex', flexDirection: 'column', height: panelHeight, overflow: 'hidden' }}>
				{/* 原此处有一整块 display:none 的旧右栏控件(模式/时间算法/性别/贵人/排盘/日界/值使/月家/
				    移星/起局/空亡/驿马/太乙盘式/积年法/黄道/宫制 + 经纬度/起盘/保存)。它对用户完全不可达,却
				    ① 让「太乙盘式 / 积年法 / 宫制」只活在不可见处(左栏没有对应控件=这三档实际改不了);
				    ② 与左栏共用 this.timeHook,隐藏实例把左栏实例的注册顶掉,起盘读到的是隐藏控件的旧时刻;
				    ③ 污染死开关审计指纹(取 innerHTML,隐藏子树照样计入)→ 快轮「有反应」全是这块的假活。
				    整块已删;三档改由左栏可见控件承接(太乙流派节的「盘式 / 古法公式」、选项节的「宫制」)。 */}

				<Tabs
					activeKey={rightPanelTab}
					onChange={(key)=>this.setState({ rightPanelTab: key })}
					destroyInactiveTabPane
					animated={false}
					className="horosa-sanshi-right-tabs"
					style={{ marginTop: 8, flex: 1, minHeight: 0, overflow: 'hidden' }}
				>
					{/* horosa_freeze_subtabs_v1:外层 5 页签。注意本组的 Tabs 已带 destroyInactiveTabPane —— 那
					    只让 antd 不【挂载】非激活面板,但 children 是父 render 里的内联 JSX,**求值照跑**:
					    「太乙」页那段 computeTaiyiShuli/computeGeju/computeVictory/computeFenye/computeShenSuan
					    的 IIFE、「六壬」页 6 个内层面板、「遁甲」页 8 宫 buildQimenBaGongPanelData,以前每次父
					    重渲(切时间/改选项/换任一页签)全部白跑一遍。函数式 FreezeSubTab 把求值推到「本面板
					    真被渲染」那一刻:非激活 → 函数不调用 = 真零成本;激活 → 拿本轮最新 children 立刻渲,
					    内容与旧行为逐字一致(冻结≠卸载,与 destroyInactiveTabPane 的既有卸载语义互不干涉)。 */}
					<TabPane tab="概览" key="overview">
						<FreezeSubTab active={rightPanelTab === 'overview'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: '16px 3px 12px 0' }} className="horosa-sanshi-kv-host">
							<div className="horosa-taiyi-overview-stack">
								{sanshiKvCard('局与旬', [
									['局数', pan ? pan.juText : '—'],
									['阴阳遁', pan ? pan.yinYangDun : '—'],
									['旬首', pan ? ovXun.xunShou : '—'],
									['旬仪', pan ? ovXun.xunYi : '—'],
									['本旬', pan ? ovXun.benXun : '—'],
									['旬空', pan ? ovXun.riKong : '—'],
									['时空', pan ? ovXun.shiKong : '—'],
									splitSanshiLabelText(pan && pan.yiMa ? pan.yiMa.text : '日马：无'),
								])}
								{sanshiKvCard('值符 · 值使 · 月将', [
									['值符', pan ? pan.zhiFu : '—'],
									['值使', pan ? pan.zhiShi : '—'],
									['月将', this.state.lrLayout ? this.state.lrLayout.yue : '—'],
								])}
								{sanshiKvCard('起盘口径', [
									['时间算法', `${getTimeAlgLabel(opt.timeAlg)}${this.state.nongli && this.state.nongli.__trueSolarFallback ? SANSHI_TRUE_SOLAR_FALLBACK_NOTE : ''}`],
									['换日', opt.after23NewDay === 1 ? '23点算第二天' : '24点算第二天'],
								])}
								{qimenOverlayCards(pan, sanshiKvCard, KvInfoNote)}
								{opt.showJianChu && pan ? jianChuCard(pan, sanshiKvCard, KvInfoNote) : null}
								{pan && pan.shenSha && pan.shenSha.allItems && pan.shenSha.allItems.length ? sanshiKvCard('神煞', [], (
									<div className="horosa-sanshi-kv-grid">
										{pan.shenSha.allItems.map((item)=>(<div key={`ss_item_${item.name}`}><span>{item.name}</span><strong>{item.value}</strong></div>))}
									</div>
								)) : null}
							</div>
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="太乙" key="taiyi">
						<FreezeSubTab active={rightPanelTab === 'taiyi'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: 0 }} className="horosa-sanshi-subtabs-card">
								{this.state.taiyi ? (()=>{
									// 太乙数理/格局/胜负/分野/诸神之算 纯派生(据 kintaiyi pan,零碰后端 golden;与独立 TaiYiMain 同款 compute*)。
									const tpan = this.state.taiyi;
									const shuli = computeTaiyiShuli(tpan);
									const geju = computeGeju(tpan);
									const victory = computeVictory(tpan, geju);
									const fenye = computeFenye(tpan);
									const shenSuan = computeShenSuan(tpan);
									const taisuiAlias = computeTaisuiAlias(tpan);
									const doorJx = activeDoorJixiong(tpan);
									const ehui = computeEhui(tpan);
									const limitYun = computeLimitYun(tpan);
									const sanyuan = computeSanyuan(tpan);
									const nayin = computeTaiyiNayin(tpan);
									const shijing = computeShiJing(tpan);
									const wuziyuan = computeWuziyuan(tpan);
									const dash = (v)=>(v === undefined || v === null || v === '' ? '—' : v);
									const calTags = (tags)=>(tags || []).map((t, i)=>{
										const tone = shuliTone(t);
										const color = tone === 'bad' ? 'var(--horosa-danger, #c0563a)' : tone === 'good' ? 'var(--horosa-accent, #d7ad69)' : 'var(--horosa-muted, #8c8c8c)';
										return <span key={i} className="horosa-sanshi-kv-chip" style={{ borderColor: color, color }}>{t}</span>;
									});
									const calCell = (num, tags)=>(<span><span style={{ marginRight: 6 }}>{dash(num)}</span>{calTags(tags)}</span>);
									const tagsOnly = (tags)=>((tags || []).length ? <span>{calTags(tags)}</span> : '—');
									return (
									<Tabs
										activeKey={this.state.taiyiSubTab}
										onChange={(key)=>this.setState({ taiyiSubTab: key })}
										destroyInactiveTabPane
										animated={false}
										className="horosa-sanshi-liureng-tabs"
									>
										<TabPane tab="概览" key="overview">
											<div className="horosa-taiyi-overview-stack">
												{sanshiKvCard('起局', [
													['盘式', tpan.options ? tpan.options.styleLabel : '—'],
													['古法公式', tpan.options ? tpan.options.accumLabel : '—'],
													['流派', tpan._schoolNote ? (<span style={{ color: 'var(--horosa-accent-strong, #d7ad69)' }} title="左栏「太乙流派」非默认;被覆盖神煞与主客算据古法重算">{tpan._schoolNote}</span>) : '默认(从盘)'],
													['博弈', tpan.options ? tpan.options.gameTheoryLabel : '—'],
													['局式', tpan.kook ? tpan.kook.text : '—'],
													['积数', `${dash(tpan.accNum)}${sanyuan ? `（${sanyuan}）` : ''}${wuziyuan ? ` · ${wuziyuan}` : ''}`],
												])}
												{sanshiKvCard('三算', [
													['主算', calCell(tpan.homeCal, shuli && shuli.home)],
													['客算', calCell(tpan.awayCal, shuli && shuli.away)],
													['定算', calCell(tpan.setCal, shuli && shuli.set)],
												])}
												{sanshiKvCard('盘面要素', [
													['太乙', `${dash(tpan.taiyiPalace)}宫（数${dash(tpan.taiyiNum)}）`],
													['文昌', tpan.skyeyes],
													['始击', tpan.sf],
													nayin ? ['纳音', `${nayin.ganzhi}·${nayin.nayin}`] : null,
													['太岁', `${dash(tpan.taishui)}${taisuiAlias ? `（${taisuiAlias}）` : ''}`],
													['合神', tpan.hegod],
													['计神', tpan.jigod],
													['定目', tpan.se],
												])}
												{shijing && shijing.length ? sanshiKvCard('十精（二目 · 八将）', [], (
													<div className="horosa-sanshi-kv-chips">
														{shijing.map((it, i)=>(<span key={i} className={`horosa-sanshi-kv-chip${it.role === '目' ? ' is-key' : it.role === '将' ? '' : ' is-weak'}`}>{it.name}·{it.at}</span>))}
													</div>
												)) : null}
												{sanshiKvCard('将神与基', [
													['君基/臣基/民基', `${dash(tpan.kingbase)}/${dash(tpan.officerbase)}/${dash(tpan.pplbase)}`],
													['四神/天乙/地乙', `${dash(tpan.fgd)}/${dash(tpan.skyyi)}/${dash(tpan.earthyi)}`],
													['直符/飞符', `${dash(tpan.zhifu)}/${dash(tpan.flyfu)}`],
													['五福/帝符/太尊', `${dash(tpan.wufuPalace)}/${dash(tpan.kingfu)}/${dash(tpan.taijun)}`],
												])}
												{sanshiKvCard('风游', [
													['飞鸟', tpan.flybird],
													['三风/五风/八风', `${dash(tpan.threewindPalace)}/${dash(tpan.fivewindPalace)}/${dash(tpan.eightwindPalace)}`],
													['大游/小游', `${dash(tpan.bigyoPalace)}/${dash(tpan.smyoPalace)}`],
												])}
											</div>
										</TabPane>
										<TabPane tab="十六宫" key="palace16">
											<div className="horosa-taiyi-palace-list">
												{tpan.palace16 && tpan.palace16.length ? tpan.palace16.map((item)=>(
													<div className="horosa-taiyi-palace-row" key={`ty_p16_${item.palace}`}>
														<strong>{item.palace}</strong>
														<span>{item.items && item.items.length ? item.items.join('、') : '—'}</span>
													</div>
												)) : (<div className="horosa-taiyi-empty">暂无十六宫数据</div>)}
											</div>
										</TabPane>
										<TabPane tab="八门" key="bamen">
											<div className="horosa-taiyi-overview-stack">
												{sanshiKvCard('八门', [
													['值使门', doorJx ? `${doorJx.door}门·${doorJx.jixiong}` : '—'],
													['厄会', ehui.length ? (<span style={{ color: 'var(--horosa-danger, #c0563a)' }}>{ehui.join('、')}</span>) : '无'],
												])}
											</div>
										</TabPane>
										<TabPane tab="断法" key="duanfa">
											<div className="horosa-taiyi-overview-stack">
												{sanshiKvCard('胜负 · 格局', [
													['胜负', victory ? (<span style={{ fontWeight: 640, color: victory.side === '主胜' ? 'var(--horosa-accent, #d7ad69)' : victory.side === '客胜' ? 'var(--horosa-danger, #c0563a)' : 'var(--horosa-muted, #8c8c8c)' }} title={(victory.reasons || []).join('\n')}>{victory.side}</span>) : '—'],
													['格局', geju.length ? (<span>{geju.map((g, i)=>(<span key={i} title={g.text} className="horosa-sanshi-kv-chip" style={{ borderColor: 'var(--horosa-danger, #c0563a)', color: 'var(--horosa-danger, #c0563a)' }}>{g.name}</span>))}</span>) : '无显著掩迫囚格对'],
												])}
												{sanshiKvCard('数理', [
													['主算', tagsOnly(shuli && shuli.home)],
													['客算', tagsOnly(shuli && shuli.away)],
													['定算', tagsOnly(shuli && shuli.set)],
												])}
												{sanshiKvCard('分野 · 诸神 · 限运', [
													['分野', fenye && fenye.taiyi ? `太乙临${fenye.taiyi.gong}${fenye.taiyi.gua}·${fenye.taiyi.zhou}(${fenye.taiyi.men}·${fenye.taiyi.qi})·${fenye.taiyi.omen}${fenye.shiji ? `；始击临${fenye.shiji.gong}${fenye.shiji.gua}·${fenye.shiji.zhou}` : ''}` : '—'],
													['诸神之算', shenSuan ? (<span>{Object.keys(shenSuan).map((k, i)=>(shenSuan[k] ? (<span key={i} title={(shenSuan[k].tags || []).join('、')} style={{ display: 'inline-block', marginRight: 8 }}>{k}<b style={{ color: 'var(--horosa-accent, #d7ad69)', marginLeft: 2 }}>{shenSuan[k].value}</b></span>) : null))}</span>) : '—'],
													['限运', limitYun ? `大限太乙临${limitYun.daxian.at}(${limitYun.daxian.span})·小限文昌临${limitYun.xiaoxian.at}(${limitYun.xiaoxian.span})` : '—'],
												])}
											</div>
										</TabPane>
									</Tabs>
									);
								})() : (
									<div className="horosa-taiyi-empty">暂无太乙数据</div>
								)}
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="六壬" key="liureng">
						<FreezeSubTab active={rightPanelTab === 'liureng'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: 0 }} className="horosa-sanshi-subtabs-card">
							<Tabs
								activeKey={this.state.liurengRefTab}
								onChange={(key)=>this.setState({ liurengRefTab: key })}
								destroyInactiveTabPane
								animated={false}
								className="horosa-sanshi-liureng-tabs"
							>
								<TabPane tab="大格" key="dage">
									<div className="horosa-liureng-reference-tab-body">
										{refSummary ? <LiuRengRefFacts text={refSummary} /> : null}
										{refBundle.dage && refBundle.dage.length ? refBundle.dage.map((item)=>(
											<LiuRengRefCard
												key={`ssu_lr_dage_${item.key}`}
												name={item.name}
												tag={item.categoryName || '大格'}
												text={buildReferenceDocumentText(item, 'dage')}
												evidence={item.evidence}
											/>
										)) : (
											<LiuRengRefEmpty>当前盘未命中已收录的大格条件。</LiuRengRefEmpty>
										)}
									</div>
								</TabPane>
								<TabPane tab="小局" key="xiaoju">
									<div className="horosa-liureng-reference-tab-body">
										{xiaojuMainItems.length ? xiaojuMainItems.map((item)=>(
											<LiuRengRefCard
												key={`ssu_lr_xiaoju_${item.key}`}
												name={item.name}
												tag={item.categoryName || '小局'}
												text={buildReferenceDocumentText(item, 'xiaoju')}
												evidence={item.evidence}
											/>
										)) : (
											<LiuRengRefEmpty>当前盘暂未命中已收录的小局条件。</LiuRengRefEmpty>
										)}
									</div>
								</TabPane>
								<TabPane tab="毕法" key="bifa">
									<div className="horosa-liureng-reference-tab-body">
										{(()=>{ const hits = matchBiFa(refContext); return (
											<>
												<LiuRengRefGroupTitle extra={hits.length ? `${hits.length} 条` : ''}>已命中</LiuRengRefGroupTitle>
												{hits.length ? hits.map((item)=>(
													<LiuRengRefCard
														key={`ssu_bf_hit_${item.no}`}
														name={`${item.no}. ${item.name}`}
														tag="毕法"
														text={item.explain}
														evidence={item.evidence}
													/>
												)) : (<LiuRengRefEmpty>本盘暂未机械命中可判定之毕法（仅高置信条目自动命中）。</LiuRengRefEmpty>)}
												<div className="horosa-divi-note" data-sanshi-bifa-benming-note="1">本页不录问事人生年：涉及「年命 / 本命」的毕法条目只按本局行年判，不计问事人本命；要按本人本命判，请到大六壬页填卜卦人生年后起课。</div>
											</>
										); })()}
										<LiuRengRefGroupTitle extra={`${BIFA_LIST.length} 条`}>全部毕法</LiuRengRefGroupTitle>
										{BIFA_LIST.map((item)=>(
											<div key={`ssu_bf_${item.no}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--horosa-border, rgba(255,255,255,0.06))' }}>
												<div style={{ fontWeight: 600 }}>{`${item.no}. ${item.name}`}</div>
												<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '20px', fontSize: 13 }}>{item.explain}</div>
											</div>
										))}
									</div>
								</TabPane>
								<TabPane tab="参考" key="reference">
									<div className="horosa-liureng-reference-tab-body">
										{xiaojuReferenceItems.length ? xiaojuReferenceItems.map((item)=>(
											<LiuRengRefCard
												key={`ssu_lr_ref_${item.key}`}
												name={item.name}
												tag="参考"
												tone="weak"
												text={buildReferenceDocumentText(item, 'xiaoju')}
												evidence={item.evidence}
											/>
										)) : (
											<LiuRengRefEmpty>当前盘暂无可展示的参考条目。</LiuRengRefEmpty>
										)}
									</div>
								</TabPane>
								<TabPane tab="概览" key="overview">
									<div className="horosa-liureng-reference-tab-body">
										{this.renderLiuRengShenShaWangShuai(refContext)}
										{overviewItems.length ? overviewItems.map((item, idx)=>(
											<LiuRengRefCard
												key={`ssu_lr_overview_${item.key}_${idx}`}
												name={item.name}
												tag={item.group === 'laiyi' ? '天将发用来意诀' : '天将杂主吉凶'}
												text={buildOverviewReferenceText(item)}
												evidence={item.evidence}
											/>
										)) : (
											<LiuRengRefEmpty>当前盘未命中“天将发用来意诀/天将杂主吉凶”条目。</LiuRengRefEmpty>
										)}
									</div>
								</TabPane>
								<TabPane tab="七政" key="qizheng">
									<div>
										{(()=>{ const cw = this.state.castChart; const ac = cw && cw.chart ? cw.chart : cw; const qz = buildQiZhengItems(ac); return qz && qz.length ? (
											<Card size='small'>
												<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
													{qz.map((item)=>{
														const wxColor = QIZHENG_WUXING_COLOR[item.wx] || 'var(--horosa-text, #d8d2c7)';
														const pColor = QIZHENG_PLANET_COLOR[item.name] || 'var(--horosa-text, #d8d2c7)';
														return (
															<div key={`ssu_qz_${item.key}`} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '9px 4px 7px', borderRadius: 10, background: item.isYue ? 'linear-gradient(180deg, rgba(212,160,23,0.18), rgba(212,160,23,0.04))' : 'var(--horosa-panel-soft, rgba(255,255,255,0.035))', border: item.isYue ? '1px solid var(--horosa-accent, #d4a017)' : '1px solid var(--horosa-border, rgba(255,255,255,0.08))' }}>
																{item.isYue ? (<span style={{ position: 'absolute', top: -7, right: -5, fontSize: 10, lineHeight: '15px', padding: '0 5px', borderRadius: 7, background: 'var(--horosa-accent, #d4a017)', color: 'var(--horosa-on-accent, #1a1206)', fontWeight: 700, whiteSpace: 'nowrap' }}>月将</span>) : null}
																<span style={{ fontSize: 12, fontWeight: 700, color: pColor, letterSpacing: 1 }}>{item.name}{item.retro ? <span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', marginInlineStart: 2, fontWeight: 800 }}>℞</span> : null}</span>
																<span style={{ fontSize: 21, fontWeight: 800, color: wxColor, lineHeight: '26px' }}>{item.branch || '—'}</span>
																<span style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)' }}>{item.wx || ''}{item.deg != null ? ` ${item.deg.toFixed(0)}°` : ''}</span>
															</div>
														);
													})}
												</div>
												<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 10, lineHeight: '18px' }}>七政所临之宫，色按五行。<span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', fontWeight: 700 }}>℞</span> 为逆行；<span style={{ color: 'var(--horosa-accent, #d4a017)', fontWeight: 700 }}>月将</span>即太阳过宫之神。</div>
											</Card>
										) : (<Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘暂无七政数据（需含日月五星之星历）。</div></Card>); })()}
									</div>
								</TabPane>
							</Tabs>
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="遁甲" key="bagong">
						<FreezeSubTab active={rightPanelTab === 'bagong'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: 0 }} className="horosa-sanshi-subtabs-card">
							<Tabs
								activeKey={this.state.bagongSubTab}
								onChange={(key)=>this.setState({ bagongSubTab: key })}
								destroyInactiveTabPane
								animated={false}
								className="horosa-sanshi-liureng-tabs"
							>
								<TabPane tab="八宫" key="bagong">
							<div>
								<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
									{BAGONG_PALACE_ORDER.map((num)=>(
										<Button
											key={`ssu_bagong_btn_${num}`}
											size="small"
											shape="round"
											type={bagongPalace === num ? 'primary' : 'default'}
											style={bagongPalace === num ? { minWidth: 42 } : { minWidth: 42, background: 'var(--horosa-panel-soft, #fafafa)' }}
											onClick={()=>this.setState({ bagongPalace: num })}
										>
											{BAGONG_PALACE_NAME[num]}
										</Button>
									))}
								</div>
								{pan ? (
									<>
										<Card size='small' style={{ marginBottom: 10 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>奇门吉格</span>
												<Tag color='green'>{bagongData.jiPatterns.length}项</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												{bagongData.jiPatternDetails && bagongData.jiPatternDetails.length
													? bagongData.jiPatternDetails.map((text)=>`• ${text}`).join('\n')
													: '未命中'}
											</div>
										</Card>
										<Card size='small' style={{ marginBottom: 10 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>奇门凶格</span>
												<Tag color='volcano'>{bagongData.xiongPatterns.length}项</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												{bagongData.xiongPatternDetails && bagongData.xiongPatternDetails.length
													? bagongData.xiongPatternDetails.map((text)=>`• ${text}`).join('\n')
													: '未命中'}
											</div>
										</Card>
										<Card size='small' style={{ marginBottom: 10 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>十干克应</span>
												<Tag color='blue'>天{bagongData.tianGan || '—'} / 地{bagongData.diGan || '—'}</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												天{bagongData.tianGan || '—'}加地{bagongData.diGan || '—'}：{bagongData.tenGanText}
											</div>
										</Card>
										<Card size='small' style={{ marginBottom: 10 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>八门克应和奇仪主应</span>
												<Tag color='purple'>人{bagongData.renDoor || '—'}</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												<div>人{bagongData.renDoor || '—'}加地{bagongData.baseDoor || '—'}：{bagongData.doorBaseText}</div>
												<div style={{ marginTop: 4 }}>人{bagongData.renDoor || '—'}加天{bagongData.tianGan || '—'}：{bagongData.doorTianText}</div>
											</div>
										</Card>
										<Card size='small' style={{ marginBottom: 10 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>八神加八门</span>
												<Tag color='geekblue'>{bagongData.godFull || '—'}</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												{bagongData.godFull || '—'}加{bagongData.renDoor || '—'}门：{bagongData.godDoorText}
											</div>
										</Card>
										<Card size='small'>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
												<span style={{ fontWeight: 600 }}>奇门演卦</span>
												<Tag color='cyan'>{bagongData.menFangYiGua || '无'}</Tag>
											</div>
											<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
												{bagongData.menFangYiGuaText || '无'}
											</div>
										</Card>
									</>
								) : (
									<Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>请先起盘后查看八宫信息。</div></Card>
								)}
							</div>
								</TabPane>
								<TabPane tab="用神" key="yongshen">
									<div>
										{this.renderSanshiYongShenStatic(pan)}
									</div>
								</TabPane>
								<TabPane tab="化解" key="jiehua">
									<div>
										{this.renderSanshiJieHuaStatic(pan)}
									</div>
								</TabPane>
							</Tabs>
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="紫微四化" key="ziweisihua">
						{/* onSnapshotState:上报盘+大运/流年选中态 → 快照产 [紫微四化] 段 */}
						{/* eager:本面板 componentDidMount 会发紫微盘请求并经 onSnapshotState 回报快照段,
						    绝不由本 wrapper 再加一层「延迟首渲」(挂载时机仍完全由外层 destroyInactiveTabPane
						    决定,与改动前一字不差);只取「冻结非激活期重渲」这一项收益。 */}
						<FreezeSubTab active={rightPanelTab === 'ziweisihua'} eager>
							<SanShiZiWeiSihua fields={this.getZiweiSihuaFields()} onSnapshotState={this.handleZiweiSihuaSnapshotState} />
						</FreezeSubTab>
					</TabPane>
				</Tabs>
			</div>
		);
	},
};
