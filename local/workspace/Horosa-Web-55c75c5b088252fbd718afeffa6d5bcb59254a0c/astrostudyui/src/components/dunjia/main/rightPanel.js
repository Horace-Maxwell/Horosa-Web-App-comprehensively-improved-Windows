// 奇门页 · 右栏(解化 / 用神 / 各页签)与底部快捷栏
// 从 DunJiaMain.js 按职责拆出的 DunJiaMain 方法:this 仍是 DunJiaMain 实例,门面里 mixinMethods(DunJiaMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Tag, Popover } from 'antd';
import { XQButton as Button, XQCard as Card, XQTabs as Tabs } from '../../xq-ui';
import DateTime from '../../comp/DateTime';
import { FreezeSubTab } from '../../comp/FreezeInactive';
import QuickDockBar from '../../common/QuickDockBar';
import { kvInfoCard, splitLabelText, KvInfoNote } from '../../common/KvInfoCard';
import { qimenOverlayCards, jianChuCard } from '../QimenOverlayControls';
import { buildQimenWangShuai, computeShuziYongShenGong } from '../DunJiaCalc';
import { BAGONG_PALACE_ORDER, BAGONG_PALACE_NAME, buildQimenBaGongPanelData, buildQimenFuShiYiGua, buildQimenOverviewSummary } from '../DunJiaBaGongRules';
import { computeDangers, buildJieHua, computeProtect, computeYongShen, computeWealth, computeCareer, computeRomance, computeGuGua } from '../DunJiaFaCalc';
import { SAN_FA_TEXT, BU_ZHEN_TIPS, DANGER_BRIEF, GAN_XIANG, ZHI_ZODIAC, SHENSHA_DOC, LUOSHU_NUM } from '../DunJiaFaDoc';
import { getBoardTimeInfo } from '../DunJiaBoard';
import { QIMEN_HARM_COLOR, tint } from '../qimenHarmColors';
import { QIMEN_YONGSHEN_BASIC, QIMEN_YONGSHEN_LOOKUP, QIMEN_YONGSHEN_SHENGKE } from './options';
import { getTimeAlgLabel, FA_ASK_TOPICS, loadFaAskTopic, saveFaAskTopic } from './pageState';
const TabPane = Tabs.TabPane;

export const rightPanelMethods = {
	renderJieHuaPanel(pan){
		if(!pan){
			return <Card size='small'><div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>请先起盘后查看化解。</div></Card>;
		}
		const DANGER_DOT = QIMEN_HARM_COLOR;
		const soft = 'var(--horosa-text-soft, #595959)';
		const muted = 'var(--horosa-muted, #8c8c8c)';
		const border = 'var(--horosa-border, #f0f0f0)';
		const dangers = computeDangers(pan);
		const jieHua = buildJieHua(pan);
		// 与用神页同源(state → localStorage 已存选题):此前化解页兜底 'shexin',刷新后两页签选题不一致
		const protect = computeProtect(pan, { topic: this.state.faAskTopic || loadFaAskTopic(), chartCategory: this.state.chartCategory });
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
						<div key={`hz_${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderTop: i ? `1px solid ${border}` : 'none' }}>
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
						<Card size='small' style={{ marginBottom: 10, borderRadius: 8, borderLeft: `3px solid ${col}` }} key={`jh_${i}`}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
								<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
									{c.dangers.map((d, k)=>(<span key={`db_${k}`} style={{ display: 'inline-flex' }}>{badge(d.oneChar, DANGER_DOT[d.type])}</span>))}
									<span style={{ fontWeight: 600, color: col }}>{c.palaceName}{LUOSHU_NUM[c.palaceName]}宫<span style={{ color: muted, fontWeight: 400, fontSize: 12 }}> · {c.direction} · {c.deg}</span></span>
								</span>
								<Tag style={{ marginRight: 0, flex: '0 0 auto' }}>天盘干「{c.tianGan}」</Tag>
							</div>
							<div style={{ color: soft, lineHeight: '22px' }}>
								{c.mie.length ? (
									<div style={{ marginBottom: 4 }}><span style={{ color: muted }}>① 灭象（先移走）</span>
										{c.mie.map((m, k)=>(<div key={`mie_${k}`} style={{ paddingLeft: 20 }}>· {m}</div>))}
									</div>
								) : null}
								{c.placements.length ? (
									<div style={{ marginBottom: 4 }}><span style={{ color: muted }}>② 布阵（再放上）</span>
										{c.placements.map((p, k)=>(<div key={`pl_${k}`} style={{ paddingLeft: 20 }}><span style={{ color: 'var(--horosa-jx-ji)', fontWeight: 600 }}>{p.where}</span>　{p.text}</div>))}
									</div>
								) : null}
								<div style={{ display: 'flex', alignItems: 'flex-start' }}><span style={{ color: muted, flex: '0 0 auto' }}>③ 时机　</span><span>本宫 {c.benZhi}日 / {c.ben}<br />对宫 {c.duiZhi}日 / {c.dui}</span></div>
								{c.notes.map((n, k)=>(<div key={`nt_${k}`} style={{ color: muted, fontSize: 12, marginTop: 2 }}>※ {n}</div>))}
							</div>
						</Card>
					);
				})}
				<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>解局三法（逆天程度递增）</div>
					<div style={{ color: soft, lineHeight: '22px' }}>
						{SAN_FA_TEXT.map((f, i)=>(<div key={`sf_${i}`}><span style={{ fontWeight: 600 }}>{f.name}</span><span style={{ color: muted }}>（{f.scope}）</span>　{f.desc}</div>))}
					</div>
				</Card>
				<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
						<span style={{ fontWeight: 600 }}>八门化气大阵 · 必护天干</span>
						<Tag color='geekblue' style={{ marginRight: 0 }}>{protect.filter((r)=>r.palaceNum && !r.ok).length} 处需护</Tag>
					</div>
					<div style={{ color: muted, fontSize: 12, marginBottom: 6 }}>先离刑墓庚（主），再离虎迫空（次）；天干往高处放、地支往低处放。下列天干勿落六害宫、勿受克。</div>
					{protect.map((r, i)=>(
						<div key={`pr_${i}`} style={{ lineHeight: '22px', padding: '3px 0', borderTop: i ? `1px solid ${border}` : 'none' }}>
							<span style={{ fontWeight: 600 }}>{r.label}{r.gan ? `「${r.gan}」` : ''}</span>
							<span style={{ color: soft }}>：{r.palaceNum ? `${r.palaceName}${LUOSHU_NUM[r.palaceName]}宫·${r.direction}` : '局中未现'}</span>
							{r.hazards.length ? <Tag color='red' style={{ marginLeft: 6 }}>{r.hazards.join('/')}</Tag> : (r.palaceNum ? <Tag color='green' style={{ marginLeft: 6 }}>平稳</Tag> : null)}
							<div style={{ color: muted, fontSize: 12, paddingLeft: 2 }}>{r.advice}</div>
						</div>
					))}
					<div style={{ color: muted, fontSize: 12, marginTop: 8, paddingTop: 6, borderTop: `1px solid ${border}` }}>
						<div style={{ marginBottom: 2 }}>※「生年干」指<strong>局中所有相关人</strong>（本人 / 家人 / 牵涉者）的出生年天干，都不能落刑墓——此处仅按本盘年干示例，其余请按各人属相或八字年干自行加护。</div>
						{BU_ZHEN_TIPS.map((t, i)=>(<div key={`bz_${i}`}>· {t}</div>))}
					</div>
				</Card>
				<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>干支形象表（造象参考）</div>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12, rowGap: 2, color: soft, lineHeight: '22px', fontSize: 13 }}>
						{Object.keys(GAN_XIANG).map((g)=>(<span key={`gx_${g}`}><span style={{ fontWeight: 600 }}>{g}</span>　{GAN_XIANG[g].color}·{GAN_XIANG[g].material}（{GAN_XIANG[g].branch}{ZHI_ZODIAC[GAN_XIANG[g].branch]}）</span>))}
					</div>
				</Card>
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>换局 / 移星</div>
					<div style={{ color: soft, lineHeight: '22px' }}>局太差、改不动时可整盘换局＝左栏「移星」顺转宫位（移即催）。转两三个重点宫为宜，勿全转。</div>
				</Card>
			</div>
		);
	},

	renderYongShenPanel(pan){
		const soft = 'var(--horosa-text-soft, #595959)';
		const muted = 'var(--horosa-muted, #8c8c8c)';
		const topic = this.state.faAskTopic || loadFaAskTopic();
		const setTopic = (k)=>{ this.setState({ faAskTopic: k }); saveFaAskTopic(k); };
		const hazardTag = (it)=>{
			if(!it || !it.palaceNum){ return <Tag color='default' style={{ marginRight: 0 }}>未现</Tag>; }
			return it.hazards && it.hazards.length ? <Tag color='red' style={{ marginRight: 0 }}>{it.hazards.join('/')}</Tag> : <Tag color='green' style={{ marginRight: 0 }}>平稳</Tag>;
		};
		const locLine = (label, it, extra)=>(
			<div key={`loc_${label}`} style={{ lineHeight: '24px' }}>
				<span style={{ fontWeight: 600 }}>{label}</span>
				{it && it.symbol ? <span style={{ color: soft }}>（{it.symbol}）</span> : null}
				<span style={{ color: soft }}>：{it && it.palaceNum ? `${it.palaceName}${LUOSHU_NUM[it.palaceName]}宫·${it.direction}` : '局中未现'}</span>
				{' '}{hazardTag(it)}
				{extra ? <span style={{ color: muted }}> {extra}</span> : null}
			</div>
		);
		const topicBtns = (
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
				{FA_ASK_TOPICS.map((t)=>(
					<Button key={`ft_${t.key}`} size='small' shape='round' type={topic === t.key ? 'primary' : 'default'} onClick={()=>setTopic(t.key)}>{t.label}</Button>
				))}
			</div>
		);
		const shuzi = computeShuziYongShenGong(this.state.shuziInput);
		const shuziCard = (
			<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
					<span style={{ fontWeight: 600 }}>数字报数</span>
					<input
						value={this.state.shuziInput}
						onChange={(e)=>this.setState({ shuziInput: e.target.value })}
						placeholder="报数(可多位/手机号)"
						inputMode="numeric"
						style={{ flex: 1, minWidth: 120, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--horosa-border, #d9d9d9)', background: 'var(--horosa-surface-solid, #fff)', color: 'var(--horosa-text, #262626)' }}
					/>
				</div>
				{shuzi ? (
					<div style={{ marginTop: 6, color: soft, lineHeight: '22px' }}>
						数字和 {shuzi.sum} ÷9 余 → 用神宫 <span style={{ fontWeight: 700, color: 'var(--horosa-text, #262626)' }}>{shuzi.gong}宫</span>
						{this.renderQimenHoverInline('palace', shuzi.gua, <span style={{ fontWeight: 600, margin: '0 4px' }}>{shuzi.gua}</span>, 'shuzi_gua')}
						<span style={{ color: muted }}>{shuzi.direction}</span>
						<div style={{ color: muted, fontSize: 12, marginTop: 2 }}>除9取余(余0作9)定用神宫,再看该宫卦象/方位/类象断事。各家规则有别(通则),精确依所宗课本。</div>
					</div>
				) : (
					<div style={{ marginTop: 6, color: muted, fontSize: 12 }}>输入所报之数 → 除9取余(余0作9)定用神宫。各家规则有别,此为通则。</div>
				)}
			</Card>
		);
		if(!pan){
			return <div>{topicBtns}{shuziCard}<Card size='small'><div style={{ color: muted }}>请先起盘后查看用神分论。</div></Card></div>;
		}
		const ys = computeYongShen(pan, { faceToFace: true, chartCategory: this.state.chartCategory });
		const guGua = computeGuGua(pan);
		const cellOf = (p)=>(pan.cells || []).find((c)=>c.palaceNum === p) || {};
		const yongShenCard = (
			<Card size='small' style={{ marginBottom: 10, borderRadius: 8 }}>
				<div style={{ fontWeight: 600, marginBottom: 6 }}>用神定位</div>
				<div style={{ color: soft, lineHeight: '22px', marginBottom: 6 }}>{ys.yongShenText}</div>
				{locLine(`日干·${ys.dayRole}`, ys.dayGan)}
				{locLine(`时干·${ys.timeRole}`, ys.timeGan)}
				{ys.ganHe ? locLine('干合·配偶/理想型', ys.ganHe) : null}
				{locLine('值符·话语权', ys.zhiFu)}
				{locLine('值使·用武之地', ys.zhiShi)}
				<div style={{ color: muted, marginTop: 4 }}>六亲：{ys.liuQin.map((r)=>`${r.rel.split('·')[1]}(${r.symbol}${r.palaceNum ? r.palaceName + LUOSHU_NUM[r.palaceName] + '宫' : '未现'})`).join('　')}</div>
			</Card>
		);
		let topicCard = null;
		if(topic === 'shexin'){
			const renderCellSymbols = (p)=>{
				const c = cellOf(p);
				if(!c.palaceNum){ return <span style={{ color: muted }}>未现</span>; }
				return (
					<span>
						{this.renderQimenHoverInline('stem', c.tianGan, <span style={{ color: 'var(--horosa-text, #262626)', fontWeight: 600 }}>{c.tianGan}</span>, `sx_t_${p}`)}{' '}
						{this.renderQimenHoverInline('god', c.god, <span>{c.god}</span>, `sx_g_${p}`)}{' '}
						{this.renderQimenHoverInline('door', c.door, <span>{c.door}门</span>, `sx_d_${p}`)}{' '}
						{this.renderQimenHoverInline('star', c.tianXing, <span>{c.tianXing}</span>, `sx_s_${p}`)}{' '}
						{this.renderQimenHoverInline('stem', c.diGan, <span style={{ color: muted }}>{c.diGan}(地)</span>, `sx_dg_${p}`)}
					</span>
				);
			};
			topicCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>识破人心（日干{ys.dayRole} / 时干{ys.timeRole}）</div>
					<div style={{ color: soft, lineHeight: '24px' }}>
						<div>{ys.dayRole}·日干宫（{ys.dayGan.palaceName}{ys.dayGan.palaceNum}）：{renderCellSymbols(ys.dayGan.palaceNum)}</div>
						<div style={{ marginTop: 4 }}>{ys.timeRole}·时干宫（{ys.timeGan.palaceName}{ys.timeGan.palaceNum}）：{renderCellSymbols(ys.timeGan.palaceNum)}</div>
						<div style={{ color: muted, marginTop: 6 }}>悬浮各符号看取象，叠加成性格画像。</div>
					</div>
				</Card>
			);
		}else if(topic === 'wealth'){
			const w = computeWealth(pan);
			topicCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>财富七要</div>
					<div style={{ color: soft }}>
						{w.items.map((it)=>locLine(it.name, it, it.note))}
						<div style={{ lineHeight: '24px' }}><span style={{ fontWeight: 600 }}>月令</span>：{w.month.zhi}（{w.month.wuxing}）{w.month.relation ? <Tag color='gold' style={{ marginLeft: 4 }}>{w.month.relation}</Tag> : null}</div>
						<div style={{ lineHeight: '24px' }}><span style={{ fontWeight: 600 }}>干财</span>：{w.ganCai.length ? w.ganCai.map((c)=>`${c.src}${c.symbol}(${c.palaceNum ? c.palaceName + LUOSHU_NUM[c.palaceName] + '宫' : '未现'}${c.hazards && c.hazards.length ? '·' + c.hazards.join('/') : ''})`).join('　') : '—'}</div>
						<div style={{ color: muted, marginTop: 4, fontSize: 12 }}>{w.industryHint}</div>
					</div>
				</Card>
			);
		}else if(topic === 'career'){
			const c = computeCareer(pan);
			topicCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>事业七要</div>
					<div style={{ color: soft }}>
						{c.items.map((it)=>locLine(it.name, it, it.note))}
						{c.fuShi.map((r)=>locLine(r.rel, r))}
						<div style={{ color: muted, marginTop: 4 }}>诸干：{c.zhuGan.map((r)=>`${r.rel.split('·')[1]}(${r.symbol}${r.palaceNum ? r.palaceName + LUOSHU_NUM[r.palaceName] + '宫' : '未现'})`).join('　')}</div>
						<div style={{ color: muted, marginTop: 4, fontSize: 12 }}>{c.industryHint}</div>
					</div>
				</Card>
			);
		}else if(topic === 'romance'){
			const r = computeRomance(pan);
			topicCard = (
				<Card size='small' style={{ borderRadius: 8 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>恋爱姻缘</div>
					<div style={{ color: soft }}>
						{r.zhengYuan.map((z)=>locLine(z.name, z))}
						<div style={{ lineHeight: '24px' }}><span style={{ fontWeight: 600 }}>三奇·桃花</span>：{r.taoHua.sanQi.map((s)=>`${s.gan}(${s.palaceNum ? s.palaceName + LUOSHU_NUM[s.palaceName] + '宫' : '未现'})`).join('　')}</div>
						<div style={{ lineHeight: '24px' }}><span style={{ fontWeight: 600 }}>沐浴位</span>：{r.taoHua.muYu.zhi}（{r.taoHua.muYu.palaceNum ? r.taoHua.muYu.palaceName + LUOSHU_NUM[r.taoHua.muYu.palaceName] + '宫·' + r.taoHua.muYu.direction : '—'}）</div>
						<div style={{ marginTop: 6, color: muted, fontSize: 12 }}>{r.zhanTaoHua}</div>
						<div style={{ marginTop: 6 }}><span style={{ fontWeight: 600 }}>情感不顺</span>：{r.trouble.length ? r.trouble.map((t, i)=>(<div key={`tr_${i}`} style={{ color: muted }}>· {t}</div>)) : <span style={{ color: muted }}>无明显凶象</span>}</div>
					</div>
				</Card>
			);
		}
		const guGuaCard = guGua.length ? (
			<Card size='small' style={{ marginTop: 8, borderRadius: 8 }}>
				<div style={{ fontWeight: 600, marginBottom: 6 }}>解孤辰寡宿</div>
				<div style={{ color: soft, lineHeight: '24px' }}>
					{guGua.map((g, i)=>(<div key={`gg_${i}`}>{g.name}（{g.zhi}）：{g.jie}</div>))}
				</div>
			</Card>
		) : null;
		const yongShenRefCard = (
			<Card size='small' style={{ marginTop: 8, borderRadius: 8 }}>
				<details>
					<summary style={{ cursor: 'pointer', fontWeight: 600, listStyle: 'revert' }}>用神取用速查<span style={{ color: muted, fontWeight: 400, marginLeft: 6, fontSize: 12 }}>一事一测·先定用神(参考字典)</span></summary>
					<div style={{ marginTop: 8 }}>
						<div style={{ fontWeight: 600, color: soft, marginBottom: 4 }}>基本用神</div>
						{QIMEN_YONGSHEN_BASIC.map((r, i)=>(
							<div key={`ysb_${i}`} style={{ lineHeight: '22px' }}><span style={{ fontWeight: 600 }}>{r[0]}</span><span style={{ color: muted }}>：{r[1]}</span></div>
						))}
						<div style={{ fontWeight: 600, color: soft, margin: '8px 0 4px' }}>分类取用</div>
						<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, lineHeight: '18px' }}>
							<thead><tr style={{ color: muted }}><th style={{ textAlign: 'left', padding: '2px 4px' }}>所测</th><th style={{ textAlign: 'left', padding: '2px 4px' }}>主用神</th><th style={{ textAlign: 'left', padding: '2px 4px' }}>辅看</th></tr></thead>
							<tbody>
								{QIMEN_YONGSHEN_LOOKUP.map((r, i)=>(
									<tr key={`ysl_${i}`} style={{ borderTop: '1px solid var(--horosa-border, #f0f0f0)' }}>
										<td style={{ padding: '2px 4px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r[0]}</td>
										<td style={{ padding: '2px 4px' }}>{r[1]}</td>
										<td style={{ padding: '2px 4px', color: muted }}>{r[2]}</td>
									</tr>
								))}
							</tbody>
						</table>
						<div style={{ fontWeight: 600, color: soft, margin: '8px 0 4px' }}>取用生克(断成败)</div>
						{QIMEN_YONGSHEN_SHENGKE.map((r, i)=>(
							<div key={`yss_${i}`} style={{ lineHeight: '22px' }}><span style={{ fontWeight: 600 }}>{r[0]}</span><span style={{ color: muted }}>：{r[1]}</span></div>
						))}
						<div style={{ color: muted, fontSize: 12, marginTop: 6 }}>断成败核心:看用神之间(日干vs时干、日干vs用事门)生克——生我合我者成、克我冲我者败,再叠旺衰格局。</div>
					</div>
				</details>
			</Card>
		);
		return <div>{topicBtns}{shuziCard}{yongShenCard}{topicCard}{guGuaCard}{yongShenRefCard}</div>;
	},

	renderRight(){
		const pan = this.state.pan;
		const opt = this.state.options;
		const validPanelTabs = ['overview', 'shensha', 'bagong', 'jiehua', 'yongshen'];
		const panelTab = validPanelTabs.indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		const bagongPalace = BAGONG_PALACE_NAME[this.state.bagongPalace] ? this.state.bagongPalace : BAGONG_PALACE_ORDER[0];
		const bagongData = buildQimenBaGongPanelData(pan, bagongPalace);
		const fushiYiGua = (pan && pan.isJinhan) ? { text: '' } : buildQimenFuShiYiGua(pan);   // 金函盘无三盘结构,演卦不适用
		const timeInfo = getBoardTimeInfo(pan);
		const showPatternInterpretation = this.state.showPatternInterpretation !== false;
		const fields = this.state.localFields || this.props.fields || {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		return (
			<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
				{/* 旧版重复设置面板(display:none 死代码,缺 school/盘类/传本/相关人员/报数)已删——现行左栏为唯一设置面 */}

				<Tabs
					className="horosa-dunjia-tabs"
					activeKey={panelTab}
					onChange={(key)=>this.setState({ rightPanelTab: key })}
					style={{ marginTop: 8 }}
				>
					<TabPane tab="概览" key="overview">
						<FreezeSubTab active={panelTab === 'overview'}>{()=>(
						<div className="horosa-taiyi-overview-stack horosa-kv-narrow horosa-dunjia-overview">
						{(()=>{
							// 全局速览：一眼看出 值符值使落宫 / 贵格(三奇得使·九遁) / 六害源头 / 吉凶格品级。
							const sum = (pan && !pan.isJinhan) ? buildQimenOverviewSummary(pan) : null;   // 金函盘走专卡
							if(!sum){ return null; }
							const HARM_TONE = QIMEN_HARM_COLOR;
							const chip = (text, color, k)=>(
								<span key={k || text} className="horosa-sanshi-kv-chip" style={{ background: tint(color, 9), color, borderColor: tint(color, 33) }}>{text}</span>
							);
							const harmRows = [
								{ key: '击刑', items: sum.sixHarm.jiXing },
								{ key: '入墓', items: sum.sixHarm.ruMu },
								{ key: '庚虎', items: sum.sixHarm.gengHu.map((g)=>`${g.label}·${g.palaceName}${g.dir}`) },
								{ key: '门迫', items: sum.sixHarm.menPo },
								{ key: '空亡', items: sum.sixHarm.kongWang },
							].filter((r)=>r.items && r.items.length);
							const goodCount = sum.ji.length + sum.dun.length + (sum.sanQiDeshi ? 1 : 0);
							const gejuChips = [
								...sum.ji.slice(0, 5).map((g)=>chip(`${g.name}·${g.palaceName}`, 'var(--horosa-jade)', `ji_${g.name}_${g.palace}`)),
								...sum.xiong.slice(0, 5).map((g)=>chip(`${g.name}·${g.palaceName}`, 'var(--horosa-jx-other)', `xi_${g.name}_${g.palace}`)),
							];
							return kvInfoCard('全局速览', [
								['值符', `${sum.zhiFu.star}·${sum.zhiFu.palaceName}${sum.zhiFu.dir}`],
								['值使', `${sum.zhiShi.door}·${sum.zhiShi.palaceName}${sum.zhiShi.dir}`],
								(sum.dun.length || sum.sanQiDeshi) ? ['贵格', (
									<span className="horosa-sanshi-kv-chips">
										{sum.sanQiDeshi ? chip(`三奇得使·${sum.sanQiDeshi.palaceName}${sum.sanQiDeshi.dir}`, 'var(--horosa-jx-ji)', 'sqds') : null}
										{sum.dun.map((d)=>chip(`${d.name}·${d.palaceName}${d.dir}`, 'var(--horosa-jx-ji)', `dun_${d.name}_${d.palace}`))}
									</span>
								)] : null,
								['六害', harmRows.length ? (
									<span className="horosa-kv-taglines">
										{harmRows.map((r)=>(
											<span className="horosa-kv-tagline" key={`harm_${r.key}`}>
												{chip(r.key, HARM_TONE[r.key], `harm_chip_${r.key}`)}
												<span>{r.items.join('、')}</span>
											</span>
										))}
									</span>
								) : (<span style={{ color: 'var(--horosa-jx-ji)' }}>无（全局清和）</span>)],
								['格局', (
									<span>
										<span>吉 {goodCount} · 凶 {sum.xiong.length}</span>
										{gejuChips.length ? (<span className="horosa-sanshi-kv-chips" style={{ marginTop: 4 }}>{gejuChips}</span>) : null}
									</span>
								)],
							], null, pan.juText);
						})()}
						{qimenOverlayCards(pan, kvInfoCard, KvInfoNote)}
						{pan && pan.jianChu ? jianChuCard(pan, kvInfoCard, KvInfoNote) : null}
						{pan && pan.isJinhan && pan.jinhan ? (<>
							{kvInfoCard('金函盘', [
								['起盘方式', '日家·古籍金函系（查表占方，独立体系）'],
								['日干支', `${pan.jinhan.dayGz}（${pan.jinhan.pantype}盘·冬至后为阳/夏至后为阴）`],
								['八门排法', pan.options.jinhanMenPaiLabel || '书表直录'],
								['中宫星', pan.jinhan.center],
							])}
							{kvInfoCard('吉方 · 吉时', [
								['喜神方', pan.jinhan.xiShen],
								['大吉方', pan.jinhan.daJiFang || '—'],
								['大吉时', pan.jinhan.jiShi],
							])}
							{kvInfoCard('时间', [
								['农历', pan.lunarText || '—'],
								['干支', `年${pan.ganzhi.year} 月${pan.ganzhi.month} 日${pan.ganzhi.day} 时${pan.ganzhi.time}`],
							])}
							{kvInfoCard('十二时辰黄黑道', [], (<>
								<KvInfoNote soft>{pan.jinhan.shiText}</KvInfoNote>
								<KvInfoNote>吉凶判则（书定）：门重于星；开休生为吉门，杜景为平，死惊伤为凶门；天乙太乙太阴青龙为吉星，轩辕招摇为平，摄提咸池天符为凶星。</KvInfoNote>
							</>))}
						</>) : (<>
							{kvInfoCard('局与旬', [
								['局数', pan ? pan.juText : '—'],
								['节气', pan ? pan.jieqiText : '—'],
								['符头', pan ? pan.fuTou : '—'],
								['旬首', pan ? pan.xunShou : '—'],
								...(pan && pan.options.kongMarkBoth && pan.xunKong
									? [['日空', pan.xunKong.日空 || '—'], ['时空', pan.xunKong.时空 || '—']]
									: [[(pan && pan.options.kongModeLabel) || '空亡', pan ? pan.kongWang : '—']]),
								pan && pan.allKong ? ['四柱空亡', `年${pan.allKong.年空} 月${pan.allKong.月空} 日${pan.allKong.日空} 时${pan.allKong.时空}`] : null,
								splitLabelText(pan && pan.yiMa ? pan.yiMa.text : '日马：无'),
							])}
							{kvInfoCard('值符 · 值使 · 演卦', [
								['值符', pan ? pan.zhiFu : '—'],
								['值使', pan ? pan.zhiShi : '—'],
								['奇门演卦', pan ? (fushiYiGua.text || '无') : '—'],
							])}
							{kvInfoCard('刑 · 墓 · 迫 · 空', [
								['六仪击刑', pan && pan.liuYiJiXing.length ? pan.liuYiJiXing.join('；') : '无'],
								['奇仪入墓', pan && pan.qiYiRuMu.length ? pan.qiYiRuMu.join('；') : '无'],
								['门迫', pan && pan.menPo && pan.menPo.list.length ? pan.menPo.list.join('；') : '无'],
								['空亡宫', pan && pan.kongWangDesc && pan.kongWangDesc.length ? pan.kongWangDesc.join('；') : '无'],
							])}
							{kvInfoCard('时间', [
								['农历', pan ? pan.lunarText : '—'],
								['直接时间', timeInfo.clockHm],
								['真太阳时', timeInfo.solarHm],
								['干支', pan ? `年${pan.ganzhi.year} 月${pan.ganzhi.month} 日${pan.ganzhi.day} 时${pan.ganzhi.time}` : '—'],
								['节气段', pan ? (pan.jiedelta || '—') : '—'],
							])}
							{kvInfoCard('起盘口径', [
								['命式', pan ? pan.options.sexLabel : '—'],
								['起盘方式', pan ? (pan.qimenModeLabel || pan.options.paiPanLabel || '—') : '—'],
								['盘式', pan ? (pan.options.schoolLabel || '—') : '—'],
								['定局法', pan ? (pan.options.dingFaLabel || pan.options.qijuMethodLabel || '—') : '—'],
								pan && pan.shuziInfo ? ['报数', `${pan.shuziInfo.digits}（和 ${pan.shuziInfo.sum} → 用神宫 ${pan.shuziInfo.gong}·${pan.shuziInfo.gua}${pan.shuziInfo.direction}）`] : null,
								['移星', pan ? (pan.options.shiftLabel || '原宫') : '原宫'],
								['换日', pan ? (pan.options.daySwitchLabel || '23点算第二天') : (opt.after23NewDay === 1 ? '23点算第二天' : '24点算第二天')],
								['时间算法', pan ? (pan.options.timeAlgLabel || getTimeAlgLabel(opt.timeAlg)) : getTimeAlgLabel(opt.timeAlg)],
								['奇门封局', pan ? (pan.options.fengJuLabel || '未封局') : (opt.fengJu ? '已封局' : '未封局')],
							])}
						</>)}
						{(()=>{
							const ws = (pan && !pan.isJinhan) ? buildQimenWangShuai(pan) : null;
							if(!ws || !ws.monthElem){ return null; }
							const tone = { 旺: 'var(--horosa-jx-ji)', 相: 'var(--horosa-jade)', 休: 'var(--horosa-text-soft, #8c8c8c)', 囚: 'var(--horosa-jx-other)', 死: 'var(--horosa-jx-xiong)' };   // 明暗成对语义色(旧定色 #b71c1c 暗底 3.0、#2e7d32 暗底 3.6)
							return kvInfoCard('旺相休囚死', [], (<>
								<div className="horosa-kv-pair-grid">
									{ws.palaces.map((p)=>(
										<div key={`ws_${p.palaceNum}`}>
											<span className="horosa-kv-pair-key">{p.palaceName}{p.palaceNum}</span>
											<span>星{p.star}</span>
											<strong style={{ color: tone[p.starWangShuai] || 'inherit' }}>{p.starWangShuai || '—'}</strong>
											<span className="horosa-kv-pair-sep">·</span>
											<span>门{p.door}</span>
											<strong style={{ color: tone[p.doorWangShuai] || 'inherit' }}>{p.doorWangShuai || '—'}</strong>
										</div>
									))}
								</div>
								<KvInfoNote>当令旺 · 我生相 · 生我休 · 克我囚 · 我克死</KvInfoNote>
							</>), `月令 ${ws.monthBranch}（${ws.monthElem}令）`);
						})()}
						</div>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="神煞" key="shensha">
						<FreezeSubTab active={panelTab === 'shensha'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: 0 }} className="horosa-dunjia-tab-host">
							<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: 14, rowGap: 6, lineHeight: '24px' }}>
								{pan && pan.shenSha && pan.shenSha.allItems && pan.shenSha.allItems.length
									? pan.shenSha.allItems.map((item)=>{
										const doc = SHENSHA_DOC[item.name];
										const luckColor = doc && doc.luck === '吉' ? 'var(--horosa-jx-ji)' : (doc && doc.luck === '凶' ? 'var(--horosa-jx-xiong)' : 'var(--horosa-text, #262626)');
										const node = (<div key={`ss_item_${item.name}`}><span style={{ color: luckColor, cursor: doc ? 'help' : 'default' }}>{item.name}-</span><span style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>{item.value}</span></div>);
										if(!doc){ return node; }
										return (
											<Popover key={`ss_pop_${item.name}`} trigger="hover" placement="bottomLeft" content={<div style={{ maxWidth: 240 }}><div style={{ fontWeight: 600 }}>{item.name}（{doc.luck}）</div><div style={{ color: 'var(--horosa-text-soft, #595959)' }}>{doc.brief}</div></div>}>
												{node}
											</Popover>
										);
									})
									: <div>暂无神煞</div>}
							</div>
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="八宫" key="bagong">
						<FreezeSubTab active={panelTab === 'bagong'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: 0 }} className="horosa-dunjia-tab-host">
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
								{BAGONG_PALACE_ORDER.map((num)=>(
									<Button
										key={`bagong_btn_${num}`}
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
								<div>
									<Card size='small' style={{ marginBottom: 10 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
											<span style={{ fontWeight: 600 }}>奇门吉格</span>
											<Tag color='green'>{bagongData.jiPatterns.length}项</Tag>
										</div>
										<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
											{showPatternInterpretation
												? (bagongData.jiPatternDetails && bagongData.jiPatternDetails.length
													? bagongData.jiPatternDetails.map((text)=>`• ${text}`).join('\n')
													: '未命中')
												: (bagongData.jiPatterns.length ? bagongData.jiPatterns.join('、') : '未命中')}
										</div>
									</Card>
									<Card size='small' style={{ marginBottom: 10 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
											<span style={{ fontWeight: 600 }}>奇门凶格</span>
											<Tag color='volcano'>{bagongData.xiongPatterns.length}项</Tag>
										</div>
										<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
											{showPatternInterpretation
												? (bagongData.xiongPatternDetails && bagongData.xiongPatternDetails.length
													? bagongData.xiongPatternDetails.map((text)=>`• ${text}`).join('\n')
													: '未命中')
												: (bagongData.xiongPatterns.length ? bagongData.xiongPatterns.join('、') : '未命中')}
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
									<Card size='small'>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
											<span style={{ fontWeight: 600 }}>八神加八门</span>
											<Tag color='geekblue'>{bagongData.godFull || '—'}</Tag>
										</div>
										<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
											{bagongData.godFull || '—'}加{bagongData.renDoor || '—'}门：{bagongData.godDoorText}
										</div>
									</Card>
									<Card size='small' style={{ marginTop: 8 }}>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
											<span style={{ fontWeight: 600 }}>奇门演卦</span>
											<Tag color='cyan'>{bagongData.menFangYiGua || '无'}</Tag>
										</div>
										<div style={{ color: 'var(--horosa-text-soft, #595959)', lineHeight: '22px', whiteSpace: 'pre-wrap' }}>
											{bagongData.menFangYiGuaText || '无'}
										</div>
									</Card>
								</div>
							) : (
								<Card size='small'>
									<div style={{ color: 'var(--horosa-muted, #8c8c8c)' }}>请先起盘后查看八宫信息。</div>
								</Card>
							)}
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="化解" key="jiehua">
						<FreezeSubTab active={panelTab === 'jiehua'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: 0 }} className="horosa-dunjia-tab-host">
							{this.renderJieHuaPanel(pan)}
						</Card>
						)}</FreezeSubTab>
					</TabPane>
					<TabPane tab="用神" key="yongshen">
						<FreezeSubTab active={panelTab === 'yongshen'}>{()=>(
						<Card bordered={false} bodyStyle={{ padding: 0 }} className="horosa-dunjia-tab-host">
							{this.renderYongShenPanel(pan)}
						</Card>
						)}</FreezeSubTab>
					</TabPane>
				</Tabs>
			</div>
		);
	},

	// 快捷栏契约:右栏 tab 镜像(概览/神煞/八宫)与释义开关(左栏已有)撤除,只留页面没有的动词。
	renderQuickDock(){
		// 宿主可传 showQuickDock={false} 关掉底栏(现无宿主在用:奇门择日与其余择日页签一样带本技法的快捷栏)。
		if(this.props.showQuickDock === false){
			return null;
		}
		return (
			<QuickDockBar
				page="dunjia"
				className="horosa-dunjia-quick-dock"
				hasResult={!!this.state.pan}
				primary={{ key: 'plot', label: '起局', disabled: this.state.loading, onClick: this.clickPlot }}
				extras={[
					{ key: 'nowPlot', label: '此刻起局', icon: 'quickTransit', needsResult: false, disabled: this.state.loading, onClick: ()=>this.clickPlotNow() },
				]}
				save={this.clickSaveCase}
				dispatch={this.props.dispatch}
			/>
		);
	},
};
