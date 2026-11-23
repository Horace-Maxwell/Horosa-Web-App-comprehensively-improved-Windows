// 六壬页 · 右栏页签:类象、神煞、毕法、占断、参考
// 从 LiuRengMain.js 按职责拆出的 LiuRengMain 方法:this 仍是 LiuRengMain 实例,门面里 mixinMethods(LiuRengMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { safeLocalStorageSet } from '../../../utils/safeStorage';
import { Tag } from 'antd';
import { XQCard as Card, XQTabs as Tabs } from '../../xq-ui';
import * as LRConst from '../../liureng/LRConst';
import { liurengWangXiang, judgeKongWang } from '../../liureng/LRZhangSheng';
import { buildXiangContext } from '../../liureng/LRXiangDoc';
import { computeFrontendShenSha, computeYearShenSha, computeMonthShenSha } from '../../liureng/LRShenShaDoc';
import { detectJianChuan } from '../../liureng/LRJianChuanDoc';
import { analyzeKongLocations, analyzeDunGan, analyzeNianMing } from '../../liureng/LRKongDunNianDoc';
import { ZHANDUAN_DOC, RELATED_BIFA } from '../../liureng/LRZhanDuanDoc';
import { matchBiFa, BIFA_LIST } from '../../liureng/LRBiFaDoc';
import LRSanChuanRelationMini from '../../liureng/LRSanChuanRelationMini';
import { detectGuiSpecials } from '../../liureng/LRBiFa';
import { computeYingQi } from '../../liureng/LRYingQiDoc';
import { FreezeSubTab } from '../../comp/FreezeInactive';
import { QIZHENG_PLANET_COLOR, QIZHENG_WUXING_COLOR } from './ganzhiHelpers';
import { buildReferenceDocumentText, buildOverviewReferenceText, filterBiFaListByQuery } from './referenceOverview';
import { LiuRengRefCard, LiuRengRefEmpty, LiuRengRefFacts, LiuRengRefGroupTitle } from '../LiuRengRefCard';
import { buildQiZhengItems } from './ganzhiHelpers';
const TabPane = Tabs.TabPane;

export const rightTabMethods = {
	// 取象：左栏开关（localStorage 持久化），默认关 → 零回归。
	onToggleXiang(checked){
		const on = !!checked;
		safeLocalStorageSet('liurengXiangOn', on ? '1' : '0');
		this.setState({ xiangOn: on });
	},

	// 占断向导：切换占事类型 → 重建 AI 快照（令 AI 针对性解读）。
	onZhanCategoryChange(val){
		this.setState({ zhanCategory: val }, ()=>{
			if(this.state.liureng){
				this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng);
			}
		});
	},

	// 取象：接收盘面点击事件 → 钉住该元素的类象卡；再次点同一元素则取消。仅在「取象」开启时响应。
	handleXiangPick(evt){
		if(!this.state.xiangOn){
			return;
		}
		const detail = evt && evt.detail ? evt.detail : null;
		if(!detail || !detail.branch){
			return;
		}
		const cur = this.state.pinnedXiang;
		if(cur && cur.branch === detail.branch && cur.role === (detail.role || '') && (cur.jiang || '') === (detail.jiang || '')){
			this.setState({ pinnedXiang: null });
			return;
		}
		this.setState({
			pinnedXiang: {
				branch: detail.branch,
				secondBranch: detail.secondBranch || '',
				jiang: detail.jiang || '',
				role: detail.role || '',
				dayGan: detail.dayGan || '',
			},
			rightPanelTab: 'xiang',
		});
	},

	renderXiangTab(refCtx){
		const xiangOn = this.state.xiangOn;
		const pin = this.state.pinnedXiang;
		const muted = { color: 'var(--horosa-muted, #8c8c8c)' };
		const sectionTitle = { fontWeight: 600, margin: '8px 0 4px' };
		const sectionBody = { color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px' };
		const sanChuanData = (refCtx && Array.isArray(refCtx.sanChuanBranches) && refCtx.sanChuanBranches.length >= 3) ? {
			branches: refCtx.sanChuanBranches,
			gans: refCtx.sanChuanGans || [],
			dayGan: refCtx.dayGan || '',
			dayZhi: refCtx.dayZhi || '',
			xunKong: refCtx.xunKongBranches || [],
		} : null;
		const sanChuanCard = sanChuanData ? (
			<Card size='small' style={{ marginBottom: 8 }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
					<span style={{ fontWeight: 600 }}>三传关系{refCtx && refCtx.courseName ? `　${refCtx.courseName}` : ''}</span>
					<Tag color='geekblue'>初→中→末</Tag>
				</div>
				<LRSanChuanRelationMini data={sanChuanData} />
			</Card>
		) : null;
		let xiangBody;
		if(!xiangOn){
			xiangBody = (<Card size='small'><div style={muted}>在左栏开启「取象」后，点击盘中地支 / 天将，即可查看其类象、五行、六亲、刑冲合害与旺衰。</div></Card>);
		}else if(!pin){
			xiangBody = (<Card size='small'><div style={muted}>点击盘中地支 / 天将以钉住其类象。</div></Card>);
		}else{
			const cx2 = buildXiangContext(pin.branch, pin.dayGan, this.state.wuxing);
			if(!cx2){
				xiangBody = (<Card size='small'><div style={muted}>暂无「{pin.branch}」的类象数据。</div></Card>);
			}else{
				const rows = [];
				if(cx2.wuxing){ rows.push(['五行', cx2.wuxing + (cx2.wuxingXiang ? `（${cx2.wuxingXiang.keyword}）` : '')]); }
				if(cx2.direction){ rows.push(['方位', cx2.direction]); }
				if(cx2.liuqin){ rows.push(['六亲', cx2.liuqin]); }
				if(cx2.zhangsheng){ rows.push([`${cx2.zhangshengElem}·长生`, cx2.zhangsheng]); }
				if(cx2.yima){ rows.push(['驿马', cx2.yima]); }
				if(pin.jiang){ rows.push(['天将', pin.jiang]); }
				const labelStyle = { color: 'var(--horosa-muted, #8c8c8c)', minWidth: 64, display: 'inline-block' };
				xiangBody = (
					<Card size='small'>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600, fontSize: 15 }}>{cx2.branch}{cx2.shenName ? `　${cx2.shenName}` : ''}</span>
							<Tag color='gold'>取象</Tag>
						</div>
						{rows.map(([k, v], i)=>(<div key={i} style={{ lineHeight: '24px' }}><span style={labelStyle}>{k}</span><span>{v}</span></div>))}
						{cx2.symbol ? (<><div style={sectionTitle}>类象</div><div style={sectionBody}>{cx2.symbol}</div></>) : null}
						{cx2.relations && cx2.relations.length ? (<><div style={sectionTitle}>刑冲合害</div><div style={sectionBody}>{cx2.relations.join('　')}</div></>) : null}
						{cx2.relationNotes && cx2.relationNotes.length ? (<><div style={sectionTitle}>刑冲破害合·断用</div><div style={sectionBody}>{cx2.relationNotes.map((r, i)=>(<div key={i} style={{ lineHeight: '20px' }}><span style={{ color: r.type === '蜜中砒霜' ? 'var(--horosa-jx-xiong, #e2574c)' : 'var(--horosa-accent, #d4a017)', fontWeight: 600 }}>{r.type}</span>：{r.note}</div>))}</div></>) : null}
						{cx2.wuxingXiang ? (<><div style={sectionTitle}>五行取象</div><div style={sectionBody}>{`人物：${cx2.wuxingXiang.person}；身体：${cx2.wuxingXiang.body}；事：${cx2.wuxingXiang.affair}`}</div></>) : null}
						<div style={{ ...muted, fontSize: 12, marginTop: 8 }}>再次点击同一元素可取消钉住。类象供参考，须合盘断之。</div>
					</Card>
				);
			}
		}
		return (<div className="horosa-liureng-reference-tab-body">{sanChuanCard}{xiangBody}</div>);
	},

	// 常用神煞小节（并入「概览」tab 顶部）：后端未直接给出、按日干支可确定的常用神煞 + 吉凶色 + 入课传高亮。
	renderShenShaSection(refCtx){
		if(!refCtx || !refCtx.dayGan){ return null; }
		const gui = detectGuiSpecials(refCtx);
		const list = computeFrontendShenSha(refCtx.dayGan, refCtx.dayZhi, refCtx.courseBranches);
		// 年神(§19.2 四利三元/太岁排轮 by 左栏开关)+ 月神(§19.3),并入概览神煞区。
		const ymList = computeYearShenSha(refCtx.yearBranch, this.state.yearShenShaSort || 'sanyuan', refCtx.courseBranches)
			.concat(computeMonthShenSha(refCtx.monthBranch, refCtx.courseBranches));
		const jc = detectJianChuan(refCtx.sanChuanBranches); // 间传24格/三合全局5局/三会方(§17)
		// 三传旺相休囚死(§20.1,土旺衰 by 左栏开关)
		const WS_COLOR = { '旺': 'var(--horosa-jx-ji, #3fa45b)', '相': 'var(--horosa-jx-he, #5fae6f)', '休': 'var(--horosa-muted,#9a8f7d)', '囚': 'var(--horosa-jx-other, #d08a3a)', '死': 'var(--horosa-jx-xiong, #e2574c)' };
		const wsList = (refCtx.sanChuanBranches || []).map((z, i) => {
			const wx = LRConst.GanZiWuXing[`${z || ''}`.trim().substring(0, 1)] || '';
			return { pos: ['初传', '中传', '末传'][i] || '', zhi: z, wx, ws: liurengWangXiang(wx, refCtx.monthBranch, this.state.tuWangShuai) };
		}).filter((x) => x.ws);
		// 空亡真假(§22.1):旬空二支按旺衰判真/假空(旺空假空·衰空真空)。
		const kongList = (refCtx.xunKongBranches || []).map((z) => {
			const wx = LRConst.GanZiWuXing[`${z || ''}`.trim().substring(0, 1)] || '';
			const j = judgeKongWang(wx, refCtx.monthBranch, this.state.tuWangShuai);
			return j ? { zhi: z, wx, kind: j.kind, ws: j.ws, basis: j.basis, inSanChuan: (refCtx.sanChuanBranches || []).indexOf(z) >= 0 } : null;
		}).filter(Boolean);
			const kongLoc = analyzeKongLocations(refCtx); // 旬空落点六处 + 陷空(§7.1/§22)
			const dunList = analyzeDunGan(refCtx); // 三传遁干特殊:遁鬼/遁甲/遁癸/遁丁(§7.2)
			const nmList = analyzeNianMing(refCtx); // 年命上神断(§7.3)
			if(!gui.length && !list.length && !ymList.length && !jc && !wsList.length && !kongList.length && !(kongLoc.hits.length || kongLoc.xianKong.length) && !dunList.length && !nmList.length){ return null; }
		const shenShaGrid = (items)=>(
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
				{items.map((s)=>(
					<div key={s.name} title={`${s.brief}（起例所临：${s.branch}）`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 2px', borderRadius: 8, background: s.inCourse ? 'rgba(212,160,23,0.12)' : 'var(--horosa-panel-soft, rgba(255,255,255,0.03))', border: s.inCourse ? '1px solid var(--horosa-accent, #d4a017)' : '1px solid var(--horosa-border, rgba(255,255,255,0.08))' }}>
						<span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.name}</span>
						<span style={{ fontSize: 16, fontWeight: 700, color: 'var(--horosa-text, #d8d2c7)' }}>{s.branch}</span>
					</div>
				))}
			</div>
		);
		return (
			<>
				{jc ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>课体结构 · {jc.name}</span>
							<Tag color={jc.luck === 'good' ? 'green' : (jc.luck === 'bad' ? 'red' : 'gold')}>{jc.kind}{jc.wuxing ? `·${jc.wuxing}` : ''}{jc.dir ? `·${jc.dir}间` : ''}</Tag>
						</div>
						<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '20px' }}>{jc.text}</div>
					</Card>
				) : null}
				{wsList.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>三传旺衰</span>
							<Tag color='gold'>以月令</Tag>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
							{wsList.map((w) => (
								<div key={w.pos} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 2px', borderRadius: 8, background: 'var(--horosa-panel-soft, rgba(255,255,255,0.03))', border: '1px solid var(--horosa-border, rgba(255,255,255,0.08))' }}>
									<span style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)' }}>{w.pos}·{w.zhi}{w.wx}</span>
									<span style={{ fontSize: 16, fontWeight: 700, color: WS_COLOR[w.ws] || 'var(--horosa-text,#d8d2c7)' }}>{w.ws}</span>
								</div>
							))}
						</div>
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>旺相=得令、休囚死=失令；土旺衰按左栏开关。</div>
					</Card>
				) : null}
				{kongList.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>空亡真假</span>
							<Tag color='gold'>旬空{kongList.map((k) => k.zhi).join('')}</Tag>
						</div>
						{kongList.map((k) => (
							<div key={k.zhi} style={{ lineHeight: '20px' }}>
								<span style={{ color: k.kind === '真空' ? 'var(--horosa-jx-xiong, #e2574c)' : 'var(--horosa-jx-ji, #3fa45b)', fontWeight: 600 }}>{k.zhi}{k.wx}·{k.kind}</span>
								<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>（{k.ws}{k.inSanChuan ? '·入传' : ''}）</span>
								<span style={{ color: 'var(--horosa-text-soft, #595959)' }}>　{k.basis}</span>
							</div>
						))}
						{kongLoc.hits.length ? (
							<div style={{ borderTop: '1px dashed var(--horosa-border, rgba(255,255,255,0.12))', marginTop: 6, paddingTop: 6 }}>
								<div style={{ fontSize: 12, color: 'var(--horosa-muted, #8c8c8c)', marginBottom: 2 }}>落空之处（六处）</div>
								{kongLoc.hits.map((h) => (
									<div key={h.pos} style={{ lineHeight: '20px' }}><span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', fontWeight: 600 }}>{h.pos}{h.branch}空</span><span style={{ color: 'var(--horosa-text-soft, #595959)' }}>　{h.note}</span></div>
								))}
							</div>
						) : null}
						{kongLoc.xianKong.length ? (
							<div style={{ fontSize: 12, color: 'var(--horosa-muted, #8c8c8c)', marginTop: 4 }}>陷空：{kongLoc.xianKong.map((x) => `${x.god}（临地盘${x.seat}）`).join('、')} 落于空地、虚而不实。</div>
						) : null}
						{kongLoc.allSanChuanKong ? (
							<div style={{ fontSize: 12, color: 'var(--horosa-jx-xiong, #e2574c)', marginTop: 4 }}>三传全空——守干上旺禄、勿轻动。</div>
						) : null}
					</Card>
				) : null}
					{dunList.length ? (
						<Card size='small' style={{ marginBottom: 8 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
								<span style={{ fontWeight: 600 }}>遁干特殊</span>
								<Tag color='volcano'>暗神</Tag>
							</div>
							{dunList.map((d) => (
								<div key={d.pos} style={{ lineHeight: '22px' }}>
									<span style={{ fontWeight: 600, color: 'var(--horosa-text, #d8d2c7)' }}>{d.pos}{d.branch}</span>
									{d.gan ? (<span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>　遁{d.gan}{d.liuqin ? `·${d.liuqin}` : ''}</span>) : null}
									{d.flags.map((f) => (<Tag key={f} color={f === '遁鬼' ? 'red' : 'orange'} style={{ marginLeft: 6, transform: 'scale(0.82)' }}>{f}</Tag>))}
									<div style={{ color: 'var(--horosa-text-soft, #595959)', fontSize: 13 }}>{d.note}</div>
								</div>
							))}
							<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 4 }}>遁干藏支下不显（暗）；遁鬼防隐险、遁甲主端绪、遁癸主闭塞、遁丁主动。</div>
						</Card>
					) : null}
					{nmList.length ? (
						<Card size='small' style={{ marginBottom: 8 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
								<span style={{ fontWeight: 600 }}>年命上神</span>
								<Tag color='gold'>行年·本命</Tag>
							</div>
							{nmList.map((n) => (
								<div key={n.label} style={{ lineHeight: '22px' }}>
									<span style={{ fontWeight: 600, color: n.isKong ? 'var(--horosa-jx-xiong, #e2574c)' : 'var(--horosa-text, #d8d2c7)' }}>{n.label}{n.branch}</span>
									<span style={{ color: 'var(--horosa-text-soft, #595959)' }}>　{n.note}</span>
								</div>
							))}
						</Card>
					) : null}
				{gui.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>贵神特殊态</span>
							<Tag color='red'>留意</Tag>
						</div>
						{gui.map((g)=>(<div key={g.type} style={{ lineHeight: '22px' }}><span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', fontWeight: 600 }}>{g.type}</span>　<span style={{ color: 'var(--horosa-text-soft, #595959)' }}>{g.note}</span></div>))}
					</Card>
				) : null}
				{list.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>常用神煞</span>
							<Tag color='gold'>按日干支</Tag>
						</div>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
							{list.map((s)=>(
								<div key={s.name} title={`${s.brief}（起例所临：${s.branch}）`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 2px', borderRadius: 8, background: s.inCourse ? 'rgba(212,160,23,0.12)' : 'var(--horosa-panel-soft, rgba(255,255,255,0.03))', border: s.inCourse ? '1px solid var(--horosa-accent, #d4a017)' : '1px solid var(--horosa-border, rgba(255,255,255,0.08))' }}>
									<span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.name}</span>
									<span style={{ fontSize: 16, fontWeight: 700, color: 'var(--horosa-text, #d8d2c7)' }}>{s.branch}</span>
								</div>
							))}
						</div>
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>金色边框＝该神煞所临之支已入课传。神煞仅供参考，须合盘断之。</div>
					</Card>
				) : null}
				{ymList.length ? (
					<Card size='small' style={{ marginBottom: 8 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
							<span style={{ fontWeight: 600 }}>年月神煞</span>
							<Tag color='gold'>按年支·月建</Tag>
						</div>
						{shenShaGrid(ymList)}
						<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 6 }}>年神＝四利三元序（左栏可切太岁排轮）；月神＝以月建起。天德值或为天干。</div>
					</Card>
				) : null}
			</>
		);
	},

	// 毕法 tab：已命中（仅高置信 A 档自动命中）+ 全部毕法可检索浏览。
	renderBiFaTab(refCtx){
		const hits = refCtx ? matchBiFa(refCtx) : [];
		const all = filterBiFaListByQuery(BIFA_LIST, this.state.bifaQuery);
		const muted = { color: 'var(--horosa-muted, #8c8c8c)' };
		const XINJUE_NOS = [93, 94, 96, 97, 98, 99, 100]; // 断法通则 / 占则，无单课盘面成局条件，仅浏览
		return (
			<div className="horosa-liureng-reference-tab-body">
				<LiuRengRefGroupTitle extra={hits.length ? `${hits.length} 条` : ''}>已命中</LiuRengRefGroupTitle>
				{hits.length ? hits.map((item)=>(
					<LiuRengRefCard
						key={`bf_hit_${item.no}`}
						name={`${item.no}. ${item.name}`}
						tag="毕法"
						text={item.explain}
						evidence={item.evidence}
					/>
				)) : (<LiuRengRefEmpty>本盘暂未机械命中可判定之毕法（仅高置信条目自动命中）。</LiuRengRefEmpty>)}
				<LiuRengRefGroupTitle extra={`${BIFA_LIST.length} 条`}>全部毕法</LiuRengRefGroupTitle>
				<input value={this.state.bifaQuery} onChange={(e)=>this.setState({ bifaQuery: e.target.value })} placeholder='检索法名 / 关键词' style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--horosa-border, rgba(255,255,255,0.18))', background: 'transparent', color: 'var(--horosa-text, inherit)', marginBottom: 8 }} />
					<Card size='small' style={{ marginBottom: 8, background: 'var(--horosa-panel-soft, rgba(255,255,255,0.03))' }}>
						<div style={{ fontWeight: 600, marginBottom: 4 }}>异文校勘<Tag color='gold' style={{ marginLeft: 6, transform: 'scale(0.82)' }}>百法</Tag></div>
						<div style={{ color: 'var(--horosa-text-soft, #595959)', fontSize: 13, lineHeight: '20px' }}>
							各本于条数（一百）、次第、绝大多数文字高度一致，惟数处异文：<br />
							· 第 8 法「不正」或作「不专」；<br />
							· 第 37 法「三等论」或作「三等讼」（以「论」为正）；<br />
							· 第 38 法「卦体」或作「课体」；<br />
							· 第 51／52 法各本常误编，正为 51「魁度天门」、52「罡塞鬼户」。
						</div>
					</Card>
				{all.map((item)=>(
					<div key={`bf_${item.no}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--horosa-border, rgba(255,255,255,0.06))' }}>
						<div style={{ fontWeight: 600 }}>{`${item.no}. ${item.name}`}{XINJUE_NOS.indexOf(item.no) >= 0 ? (<span style={{ ...muted, fontSize: 11, marginInlineStart: 6 }}>（读法心诀·通则）</span>) : (item.tier !== 'A' ? (<span style={{ ...muted, fontSize: 11, marginInlineStart: 6 }}>（须人工核）</span>) : null)}</div>
						<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '20px', fontSize: 13 }}>{item.explain}</div>
					</div>
				))}
				<div style={{ ...muted, fontSize: 12, marginTop: 8 }}>断诀烈度须合时令旺衰、年命制化，非定数。</div>
			</div>
		);
	},

	// 占断 tab：按左栏所选占事类型，给主用神 / 用神落点 / 关键神将 / 宜忌 / 三传提示。
	renderZhanDuanTab(refCtx){
		const key = this.state.zhanCategory;
		const muted = { color: 'var(--horosa-muted, #8c8c8c)' };
		const yq = computeYingQi(refCtx);
		const yingQiCard = yq.length ? (
			<Card size='small' style={{ marginTop: 8 }}>
				<div style={{ fontWeight: 600, marginBottom: 4 }}>应期（参考方向，非定论）</div>
				{yq.map((m)=>(<div key={m.method} style={{ lineHeight: '22px' }}><span style={{ color: 'var(--horosa-accent, #d4a017)', fontWeight: 600 }}>{m.method}</span>：{m.dirs.join('、')}　<span style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12 }}>{m.note}</span></div>))}
				<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 4 }}>应期为六壬难点，仅供参考，以实际盘综合为准。</div>
			</Card>
		) : null;
		if(!key || key === 'general'){
			return (<div className="horosa-liureng-reference-tab-body"><Card size='small'><div style={muted}>在左栏「占事类型」选择具体占事（婚姻 / 疾病 / 财运 / 官讼…），此处显示该类主用神、关键神将与宜忌。</div></Card>{yingQiCard}</div>);
		}
		const zd = ZHANDUAN_DOC[key];
		if(!zd){ return (<div className="horosa-liureng-reference-tab-body"><Card size='small'><div style={muted}>暂无该占类资料。</div></Card>{yingQiCard}</div>); }
		const relBifa = (RELATED_BIFA[key] || []).map((no)=>BIFA_LIST.find((b)=>b.no === no)).filter(Boolean);
		const godValues = refCtx && refCtx.branchGodMap ? Object.keys(refCtx.branchGodMap).map((k)=>refCtx.branchGodMap[k]) : [];
		const sectionTitle = { fontWeight: 600, margin: '8px 0 4px' };
		const sectionBody = { color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px' };
		const yongLuo = [];
		if(refCtx){
			if(refCtx.ke1Up){ yongLuo.push(`日干上神 ${refCtx.ke1Up}`); }
			if(refCtx.ke3Up){ yongLuo.push(`日支上神 ${refCtx.ke3Up}`); }
			if(refCtx.runYearBranch){ yongLuo.push(`年命 ${refCtx.runYearBranch}`); }
		}
		return (
			<div className="horosa-liureng-reference-tab-body">
				<Card size='small' style={{ marginBottom: 8 }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
						<span style={{ fontWeight: 600, fontSize: 15 }}>{zd.name}</span>
						<Tag color='cyan'>占断向导</Tag>
					</div>
					<div style={sectionTitle}>主用神</div>
					<div style={sectionBody}>{(zd.mainYong || []).map((y)=>`${y.role}：${y.mean}`).join('　')}</div>
					{yongLuo.length ? (<><div style={sectionTitle}>用神落点（本盘）</div><div style={sectionBody}>{yongLuo.join('　')}</div></>) : null}
					<div style={sectionTitle}>关键神将</div>
					<div style={sectionBody}>{(zd.keyJiang || []).map((j)=>{ const present = godValues.indexOf(j) >= 0; return (<Tag key={j} color={present ? 'green' : 'default'} style={{ marginBottom: 4 }}>{present ? `${j} ✓` : j}</Tag>); })}</div>
					<div style={sectionTitle}>宜见</div>
					<div style={sectionBody}>{(zd.favor || []).map((f, i)=>(<div key={i}>· {f}</div>))}</div>
					<div style={sectionTitle}>忌见</div>
					<div style={sectionBody}>{(zd.avoid || []).map((f, i)=>(<div key={i}>· {f}</div>))}</div>
					<div style={sectionTitle}>三传提示</div>
					<div style={sectionBody}>{zd.sanChuanTip}</div>
					{relBifa.length ? (<><div style={sectionTitle}>相关毕法</div>{relBifa.map((b)=>(<div key={b.no} style={{ ...sectionBody, marginBottom: 2 }}><span style={{ fontWeight: 600 }}>{`${b.no}. ${b.name}`}</span>　{b.explain}</div>))}</>) : null}
				</Card>
				<Card size='small'><div style={{ ...muted, fontSize: 12 }}>用神落点为确定性指引，吉凶须合全盘与三传旺衰判之。</div></Card>
				{yingQiCard}
			</div>
		);
	},

	renderReferenceTabs(refData){
		const {
			refSummary,
			refBundle,
			xiaojuMainItems,
			xiaojuReferenceItems,
			overviewItems,
			chart,
			displayRunYear,
		} = refData;
		const ctx = refBundle && refBundle.context ? refBundle.context : null;
		// 「小局」已并入「格局」tab(旧 key 'xiaoju' 归一到 'dage',免旧状态落空白页)
		const activeTabKey = this.state.rightPanelTab === 'xiaoju' ? 'dage' : this.state.rightPanelTab;
		return (
			<Tabs
				className="horosa-liureng-tabs"
				activeKey={activeTabKey}
				onChange={(key)=>this.setState({ rightPanelTab: key })}
				animated={false}
			>
				{/* horosa_freeze_subtabs_v1:右栏 8 面板 keep-alive(无 destroyInactiveTabPane),
				    改前每次父重渲(切时间/改 13 项设置/换页签)都把 格局/信息/毕法(百余条条文 map)/
				    参考/概览/占断/取象/七政 八个面板【全部】重跑一遍,而用户只看得见其中一个。
				    函数式 FreezeSubTab:未激活过 → 连元素都不建;激活过但当前非激活 → sCU 跳过
				    (DOM/实例/滚动位置/展开态全部保留,不卸载);切回 → 拿本轮最新 children 立刻渲一帧,
				    不重发请求、不闪烁、无陈旧。kill-switch horosa.perf.freezeSubTabs=0 即回旧行为。 */}
				<TabPane tab="格局" key="dage">
					<FreezeSubTab active={activeTabKey === 'dage'}>{() => (
					<div className="horosa-liureng-reference-tab-body">
						{refSummary ? <LiuRengRefFacts text={refSummary} /> : null}
						<LiuRengRefGroupTitle extra={refBundle.dage && refBundle.dage.length ? `${refBundle.dage.length} 条` : ''}>大格</LiuRengRefGroupTitle>
						{refBundle.dage && refBundle.dage.length ? refBundle.dage.map((item)=>(
							<LiuRengRefCard
								key={`dage_${item.key}`}
								name={item.name}
								tag={item.source || '课式命中'}
								text={buildReferenceDocumentText(item, 'dage')}
								evidence={item.evidence}
							/>
						)) : (
							<LiuRengRefEmpty>当前盘暂未命中可判定的大格。</LiuRengRefEmpty>
						)}
						<LiuRengRefGroupTitle extra={xiaojuMainItems.length ? `${xiaojuMainItems.length} 条` : ''}>小局</LiuRengRefGroupTitle>
						{xiaojuMainItems.length ? xiaojuMainItems.map((item)=>(
							<LiuRengRefCard
								key={`xiaoju_${item.key}`}
								name={item.name}
								tag={item.categoryName || '小局'}
								text={buildReferenceDocumentText(item, 'xiaoju')}
								evidence={item.evidence}
							/>
						)) : (
							<LiuRengRefEmpty>当前盘暂未命中已收录的小局条件。</LiuRengRefEmpty>
						)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="信息" key="meta">
					<FreezeSubTab active={activeTabKey === 'meta'}>{()=>{
					// horosa_liureng_render_slice_v1(L2):9 组神煞/旬空/长生 meta 卡的数据在 thunk 内现算 ——
					// 仅本面板激活时执行(FreezeSubTab 函数式 children 语义),输入取同一 commit 的 state,零陈旧。
					const metaItems = this.buildQuickMetaItems(displayRunYear);
					return (
					<div className="horosa-liureng-reference-tab-body">
						{metaItems && metaItems.length ? metaItems.map((group)=>(
							<Card key={`meta_${group.title}`} size='small' style={{ marginBottom: 8 }} title={group.title}>
								<div className="horosa-liureng-meta-list">
									{(group.rows || []).map((item, idx)=>(
										<div className="horosa-liureng-meta-row" key={`${item.key}_${idx}`}>
											<span>{item.key}</span>
											<strong>{item.value}</strong>
										</div>
									))}
								</div>
							</Card>
						)) : (
							<Card size='small'>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>起课后显示旬空/神煞/长生等信息。</div>
							</Card>
						)}
					</div>
					);
					}}</FreezeSubTab>
				</TabPane>
				<TabPane tab="毕法" key="bifa">
					<FreezeSubTab active={activeTabKey === 'bifa'}>{() => this.renderBiFaTab(ctx)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="参考" key="reference">
					<FreezeSubTab active={activeTabKey === 'reference'}>{() => (
					<div className="horosa-liureng-reference-tab-body">
						{xiaojuReferenceItems.length ? xiaojuReferenceItems.map((item)=>(
							<LiuRengRefCard
								key={`ref_${item.key}`}
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
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="概览" key="overview">
					<FreezeSubTab active={activeTabKey === 'overview'}>{() => (
					<div className="horosa-liureng-reference-tab-body">
						{this.renderShenShaSection(ctx)}
						{overviewItems.length ? overviewItems.map((item, idx)=>(
							<LiuRengRefCard
								key={`overview_${item.key}_${idx}`}
								name={item.name}
								tag={item.group === 'laiyi' ? '天将发用来意诀' : '天将杂主吉凶'}
								text={buildOverviewReferenceText(item)}
								evidence={item.evidence}
							/>
						)) : (
							<LiuRengRefEmpty>当前盘未命中“天将发用来意诀/天将杂主吉凶”条目。</LiuRengRefEmpty>
						)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="占断" key="zhanduan">
					<FreezeSubTab active={activeTabKey === 'zhanduan'}>{() => this.renderZhanDuanTab(ctx)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="取象" key="xiang">
					<FreezeSubTab active={activeTabKey === 'xiang'}>{() => this.renderXiangTab(ctx)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="七政" key="qizheng">
					<FreezeSubTab active={activeTabKey === 'qizheng'}>{()=>{
					// horosa_liureng_render_slice_v1(L2):七政条目在 thunk 内现算,仅本面板激活时执行;
					// AI 快照的 [七政] 段由 buildLiuRengSnapshotText 自行调 buildQiZhengItems,与此无涉。
					const qizhengItems = buildQiZhengItems(chart);
					return (
					<div className="horosa-liureng-reference-tab-body">
						{qizhengItems && qizhengItems.length ? (
							<Card size='small'>
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(74px, 1fr))', gap: 8 }}>
									{qizhengItems.map((item)=>{
										const wxColor = QIZHENG_WUXING_COLOR[item.wx] || 'var(--horosa-text, #d8d2c7)';
										const pColor = QIZHENG_PLANET_COLOR[item.name] || 'var(--horosa-text, #d8d2c7)';
										return (
											<div
												key={`qz_${item.key}`}
												style={{
													position: 'relative',
													display: 'flex',
													flexDirection: 'column',
													alignItems: 'center',
													gap: 1,
													padding: '9px 4px 7px',
													borderRadius: 10,
													background: item.isYue
														? 'linear-gradient(180deg, rgba(212,160,23,0.18), rgba(212,160,23,0.04))'
														: 'var(--horosa-panel-soft, rgba(255,255,255,0.035))',
													border: item.isYue
														? '1px solid var(--horosa-accent, #d4a017)'
														: '1px solid var(--horosa-border, rgba(255,255,255,0.08))',
													boxShadow: item.isYue ? 'inset 0 0 0 2px rgba(212,160,23,0.12)' : 'none',
												}}
											>
												{item.isYue ? (
													<span style={{ position: 'absolute', top: -7, right: -5, fontSize: 10, lineHeight: '15px', padding: '0 5px', borderRadius: 7, background: 'var(--horosa-accent, #d4a017)', color: 'var(--horosa-on-accent, #1a1206)', fontWeight: 700, whiteSpace: 'nowrap' }}>月将</span>
												) : null}
												<span style={{ fontSize: 12, fontWeight: 700, color: pColor, letterSpacing: 1 }}>
													{item.name}
													{item.retro ? <span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', marginInlineStart: 2, fontWeight: 800 }}>℞</span> : null}
												</span>
												<span style={{ fontSize: 21, fontWeight: 800, color: wxColor, lineHeight: '26px' }}>{item.branch || '—'}</span>
												<span style={{ fontSize: 11, color: 'var(--horosa-muted, #8c8c8c)' }}>
													{item.wx || ''}{item.deg != null ? ` ${item.deg.toFixed(0)}°` : ''}
												</span>
											</div>
										);
									})}
								</div>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)', fontSize: 12, marginTop: 10, lineHeight: '18px' }}>
									七政所临之宫，色按五行。<span style={{ color: 'var(--horosa-jx-xiong, #e2574c)', fontWeight: 700 }}>℞</span> 为逆行；
									<span style={{ color: 'var(--horosa-accent, #d4a017)', fontWeight: 700 }}>月将</span>即太阳过宫之神。
								</div>
							</Card>
						) : (
							<Card size='small'>
								<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>当前盘暂无七政数据（需含日月五星之星历）。</div>
							</Card>
						)}
					</div>
					);
					}}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	},
};
