// 世运盘 · 右栏周期卡(大年 / 合相纪元 / 大合 / 周期指数)与右栏页签分发
// 从 MundaneMain.js 按职责拆出的 MundaneMain 方法:this 仍是 MundaneMain 实例,门面里 mixinMethods(MundaneMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Fragment } from 'react';
import { XQSelect, XQButton, XQTabs, XQInputNumber, XQSpin } from '../../xq-ui';
import { SIGNS } from '../../../divination/data/signs';
import { GREAT_CONJ_TABLE } from '../../../divination/mundane/greatConjTable';
import { CONJUNCTION_LAYERS, PARALLEL_TRIADS, computeConjunctionEras } from '../../../divination/mundane/conjunctionEras';
import { GREAT_YEAR_CONST, AGE_BOUNDARY_METHODS, AGE_CLAIMS, AGE_CLAIMS_RANGE, AGE_SEQUENCE_NOTE, TIDAL_NOTE, computeCurrentAge } from '../../../divination/mundane/greatYear';
import { rulesetConfig } from '../../../divination/mundane/ruleset';
import MundaneCycleTables from '../MundaneCycleTables';
import { pressable } from '../../../utils/pressable';
import { SIGN_KEYS, ELEMENT_COLOR, pGlyph, sGlyph, CYCLE_PAIRS, CYCLE_ASPECTS, BARBAULT_SETS, BARBAULT_HARMONICS, currentYear, clampYear, yearLabel, computeAges } from './tables';
import { CARD, CARD_TITLE, MUNDANE_PAGE_SETTINGS } from './cards';
import { FreezeSubTab } from '../../comp/FreezeInactive';
import { markPanelReady } from '../../../utils/perfMark';
const Option = XQSelect.Option;
const TabPane = XQTabs.TabPane;

export const cycleCardMethods = {
	// 大年时代卡:当前春分点恒星位置(实时算)+三法边界+各家定年表(折叠)+潮汐渐变注。
	renderGreatYear(){
		const model = this.state.gyModel || 'fagan';
		const nowYear = currentYear();
		const r = computeCurrentAge(nowYear, model);
		const claimsOpen = !!this.state.gyClaimsOpen;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#5e548e', borderRadius: 2, display: 'inline-block' }} />大年与时代</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8, lineHeight: '17px' }}>
					岁差周期(大年)≈ {GREAT_YEAR_CONST.precessionYears.toLocaleString()} 年(常圆整 {GREAT_YEAR_CONST.roundedYears.toLocaleString()});柏拉图月(一个时代)≈ {GREAT_YEAR_CONST.platonicMonthYears.join('–')} 年;春分点以约 {GREAT_YEAR_CONST.rateArcsecPerYear}″/年西退。{AGE_SEQUENCE_NOTE}
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
					<span style={{ fontSize: 11.5, color: 'var(--horosa-text-secondary)' }}>差值体系</span>
					<XQSelect size="small" style={{ width: 140 }} value={model} onChange={(v) => this.setState({ gyModel: v })}>
						<Option value="fagan">Fagan/Bradley</Option>
						<Option value="lahiri">Lahiri</Option>
					</XQSelect>
				</div>
				<div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--horosa-hue-purple)', marginBottom: 2 }}>
					{nowYear} 年春分点 · 恒星{r.signCn} {r.degInSign.toFixed(2)}° → 当前为{r.currentAgeCn}
				</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8 }}>差值 {r.ayanamsa.toFixed(3)}°(锚点线性近似);{r.equalBoundaryYear ? `按等分 30° 口径,春分点退入宝瓶约在 ${r.equalBoundaryYear} 年。` : '春分点已入宝瓶区间。'}</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '4px 0 4px' }}>时代边界三法</div>
				{AGE_BOUNDARY_METHODS.map((m) => (
					<div key={m.key} style={{ padding: '6px 9px', marginBottom: 5, borderRadius: 7, background: 'rgba(94,84,142,0.06)', borderLeft: '3px solid #5e548e' }}>
						<div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
							<span style={{ fontSize: 12, fontWeight: 700 }}>{m.cn}</span>
							<span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: 'var(--horosa-hue-purple)', textAlign: 'right' }}>{m.boundary}</span>
						</div>
						<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', lineHeight: '15px', marginTop: 2 }}>{m.how}</div>
					</div>
				))}
				<div style={{ marginTop: 8 }}>
					<div style={{ fontSize: 11.5, cursor: 'pointer', color: 'var(--horosa-hue-purple)', userSelect: 'none' }}
						{...pressable(() => this.setState({ gyClaimsOpen: !claimsOpen }))}>{claimsOpen ? '▾' : '▸'} 宝瓶座时代各家定年（统计区间 {AGE_CLAIMS_RANGE}）</div>
					{claimsOpen ? (
						<div style={{ marginTop: 4 }}>
							{AGE_CLAIMS.map((c) => (
								<div key={c.key} style={{ display: 'flex', gap: 8, fontSize: 11.5, padding: '2px 0', borderTop: '1px solid rgba(128,128,128,0.05)' }}>
									<span style={{ width: 96, fontWeight: 600 }}>{c.year}</span>
									<span style={{ flex: 1, opacity: 0.7 }}>{c.basis}</span>
								</div>
							))}
						</div>
					) : null}
				</div>
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '15px' }}>{TIDAL_NOTE}</div>
			</div>
		);
	},

	// 历史会合分期卡:元素时间轴条 + 变迁点四态 + 三层周期表(名义/天文并列)+
	// 平行三元 + 土火合巨蟹。全部由已算 gcResults 派生(零新后端;土火合走既有 planetcycles)。
	renderConjunctionEras(){
		const isAges = this.state.gcMode !== 'flat' && this.state.gcResults && this.state.gcResults.length;
		const eras = isAges ? computeConjunctionEras(this.state.gcResults) : null;
		const KIND_META = {
			stable_shift: { cn: '变迁', color: 'var(--horosa-accent-strong)' },
			precursor: { cn: '变迁前奏', color: 'var(--horosa-hue-orange)' },
			oscillation: { cn: '过渡振荡', color: 'var(--horosa-text-secondary)' },
			greatest: { cn: '大变迁·回火', color: 'var(--horosa-jx-xiong, #c0392b)' },
		};
		const span = eras && eras.segments.length ? (eras.segments[eras.segments.length - 1].to - eras.segments[0].from) || 1 : 1;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#b8860b', borderRadius: 2, display: 'inline-block' }} />历史会合分期</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8, lineHeight: '17px' }}>木土会合按尺度三层为历史分期:约 20 年一会(君王兴替)、约 240 年换元素(变迁——教派律法王朝转移)、约 960 年走遍四元素回火(帝国兴亡级)。元素轮转 火→土→风→水。</div>
				{eras && eras.segments.length ? (
					<Fragment>
						<div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
							{eras.segments.map((s, i) => (
								<div key={i} title={`${s.elementCn}象 ${yearLabel(s.from)}–${yearLabel(s.to)}`}
									style={{ flex: `${Math.max(s.to - s.from, span * 0.02)} 0 0`, background: ELEMENT_COLOR[s.element], opacity: 0.82, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9.5, whiteSpace: 'nowrap' }}>
									{(s.to - s.from) / span > 0.12 ? `${s.elementCn} ${yearLabel(s.from)}–` : ''}
								</div>
							))}
						</div>
						<div style={{ fontSize: 11.5, lineHeight: '19px', marginBottom: 8 }}>
							{eras.marks.map((m) => (
								<div key={m.year} style={{ display: 'flex', gap: 6 }}>
									<span style={{ width: 44, color: 'var(--horosa-text-secondary)' }}>{yearLabel(m.year)}</span>
									<span style={{ color: ELEMENT_COLOR[m.element] }}>→ {m.elementCn}象</span>
									<span style={{ color: KIND_META[m.kind].color, fontWeight: m.kind === 'greatest' ? 700 : 500 }}>{KIND_META[m.kind].cn}</span>
								</div>
							))}
						</div>
					</Fragment>
				) : <div style={{ fontSize: 11.5, color: 'var(--horosa-text-secondary)', marginBottom: 8 }}>先在上方「木土纪元」计算一段年区间,此处自动按元素分期并标变迁点(变迁期两元素间振荡数十年属正常,以稳定进入新元素为标志)。</div>}
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '4px 0 2px' }}>三层周期（名义 ↔ 天文实测并列）</div>
				{CONJUNCTION_LAYERS.map((l) => (
					<div key={l.key} style={{ display: 'flex', gap: 6, fontSize: 11.5, padding: '2px 0', borderTop: '1px solid rgba(128,128,128,0.05)' }}>
						<span style={{ width: 106, fontWeight: 600 }}>{l.cn}</span>
						<span style={{ width: 106, color: 'var(--horosa-text-secondary)' }}>名义 {l.nominalYears} 年 / 实 {l.observedYears}</span>
						<span style={{ flex: 1, opacity: 0.75 }}>{l.meaning}</span>
					</div>
				))}
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '8px 0 2px' }}>平行三元</div>
				{PARALLEL_TRIADS.map((t) => (
					<div key={t.key} style={{ display: 'flex', gap: 6, fontSize: 11.5, padding: '2px 0' }}>
						<span style={{ width: 72, fontWeight: 600 }}>{t.cn}</span>
						<span style={{ width: 64 }}>{pGlyph(t.p1)}×{pGlyph(t.p2)}</span>
						<span style={{ flex: 1, opacity: 0.7 }}>{t.note}</span>
					</div>
				))}
				<div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed rgba(128,128,128,0.15)' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
						<span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7 }}>土火合于巨蟹（约 30 年一遇 · 主大灾/战）</span>
						<XQButton size="small" disabled={this.state.msLoading} onClick={() => this.computeMarsSaturnCancer()}>{this.state.msLoading ? '计算中…' : '计算命中年'}</XQButton>
					</div>
					{this.state.msErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)' }}>{this.state.msErr}</div> : null}
					{this.state.msCancerRows ? (
						this.state.msCancerRows.length ? (
							<div style={{ fontSize: 11.5, lineHeight: '18px' }}>
								{this.state.msCancerRows.map((r, i) => (<span key={i} style={{ marginRight: 10 }}>{yearLabel(r.year)}{r.month ? `-${String(r.month).padStart(2, '0')}` : ''}</span>))}
								<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 2 }}>命中年之前的白羊入境盘列高级主管盘(与主管盘层级联动)。</div>
							</div>
						) : <div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>该年段内无土火合于巨蟹。</div>
					) : null}
				</div>
			</div>
		);
	},

	// 木土会合参考纪年表(1603–2100 静态对照,与实时精算并列;点行起事件盘不适用——纯参考)。
	renderGreatConjRefTable(){
		const open = !!this.state.gcRefOpen;
		return (
			<div style={{ marginTop: 8, borderTop: '1px dashed rgba(128,128,128,0.15)', paddingTop: 6 }}>
				<div style={{ fontSize: 11.5, cursor: 'pointer', color: '#2c7fb8', userSelect: 'none' }}
					{...pressable(() => this.setState({ gcRefOpen: !open }))}>{open ? '▾' : '▸'} 参考纪年表（1603–2100 · 静态对照）</div>
				{open ? (
					<div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 4 }}>
						{GREAT_CONJ_TABLE.map((r) => {
							const sg = SIGNS[r.sign] || {};
							return (
								<div key={r.year} style={{ display: 'flex', gap: 6, fontSize: 11.5, padding: '2px 0', borderTop: '1px solid rgba(128,128,128,0.05)' }}>
									<span style={{ width: 40, color: 'var(--horosa-text-secondary)' }}>{r.year}</span>
									<span style={{ width: 70 }}>{r.deg}° <span style={{ color: ELEMENT_COLOR[r.element] }}>{sGlyph(r.sign)}</span> {sg.cn || ''}</span>
									<span style={{ flex: 1, color: 'var(--horosa-text-secondary)' }}>{r.note}</span>
								</div>
							);
						})}
						<div style={{ fontSize: 10, color: 'var(--horosa-text-secondary)', marginTop: 3 }}>静态参考,以上方实时星历精算为准;变迁期两元素间振荡属正常,以稳定进入新元素为标志。</div>
					</div>
				) : null}
			</div>
		);
	},

	renderGreatConj(fill, extra){
		const isFlat = this.state.gcMode === 'flat';
		const ages = (!isFlat && this.state.gcResults) ? computeAges(this.state.gcResults) : null;
		const flatList = isFlat ? (this.state.gcResults || []) : null;
		const total = this.state.gcResults ? this.state.gcResults.length : 0;
		const cardStyle = fill ? { ...CARD, marginBottom: 0, minHeight: '100%', boxSizing: 'border-box' } : CARD;
		const listStyle = fill ? { paddingRight: 4 } : { maxHeight: 460, overflowY: 'auto', paddingRight: 4 };
		// 流派门控(G3):古典/中世纪派外行星周期非其体系,仅留七曜内星对(木土/火土);
		// 若当前选中对被隐则回落木土。modern/barbault 全列(默认档零回归)。
		const cfgGc = rulesetConfig((extra || {}).mundaneRuleset);
		const visPairs = cfgGc.showOuterCycles === false
			? CYCLE_PAIRS.filter((p) => ['jupiter-saturn', 'mars-saturn'].indexOf(p.key) >= 0)
			: CYCLE_PAIRS;
		const pairHidden = !visPairs.some((p) => p.key === this.state.gcPair);
		const effPair = pairHidden ? 'jupiter-saturn' : this.state.gcPair;
		const pairCn = (CYCLE_PAIRS.find((p) => p.key === effPair) || {}).cn || '木土';
		const aspCn = this.state.gcAspect === 180 ? '对分' : '合相';
		return (
			<div style={cardStyle}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#2c7fb8', borderRadius: 2, display: 'inline-block' }} />行星周期 · {isFlat ? `${pairCn}` : '木土大合相·时代纪元'}</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 10, lineHeight: '17px' }}>慢星周期标记时代脉动。木土合每约 20 年一会、约 200 年轮转一象（大三合）；其余慢星对的合/冲亦为重大历史节点（如土冥、天海循环）。</div>
				<div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
					<XQSelect size="small" style={{ width: 158 }} value={effPair} onChange={(v) => this.setState({ gcPair: v })}>
						{visPairs.map((p) => (<Option key={p.key} value={p.key}>{p.cn}</Option>))}
					</XQSelect>
					{cfgGc.showOuterCycles === false ? (
						<span style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', alignSelf: 'center' }}>古典体系仅列七曜内星对;外行星周期见现代/Barbault 规则集</span>
					) : null}
					<XQSelect size="small" style={{ width: 104 }} value={this.state.gcAspect} onChange={(v) => this.setState({ gcAspect: v })}>
						{CYCLE_ASPECTS.map((a) => (<Option key={a.v} value={a.v}>{a.cn}</Option>))}
					</XQSelect>
					<XQSelect size="small" style={{ width: 88 }} value={this.state.gcCenter || 'geo'} onChange={(v) => this.setState({ gcCenter: v })}>
						<Option value="geo">地心</Option>
						<Option value="helio">日心</Option>
					</XQSelect>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
					<XQInputNumber size="small" style={{ width: 80 }} value={this.state.gcStart} min={-3000} max={3000}
						onChange={(v) => this.setState({ gcStart: clampYear(v, 1300) })} />
					<span style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>至</span>
					<XQInputNumber size="small" style={{ width: 80 }} value={this.state.gcEnd} min={-3000} max={3000}
						onChange={(v) => this.setState({ gcEnd: clampYear(v, 2200) })} />
					<XQButton size="small" disabled={this.state.gcLoading} onClick={this.computeGreatConj}>{this.state.gcLoading ? '计算中…' : '计算'}</XQButton>
					<span style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>前3000–3000</span>
				</div>
				{this.state.gcErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)', marginBottom: 8 }}>{this.state.gcErr}</div> : null}
				<XQSpin spinning={this.state.gcLoading}>
					{isFlat ? (
						flatList && flatList.length ? (
							<div style={listStyle}>
								{flatList.map((c, i) => {
									const sk = SIGN_KEYS[c.sign];
									const sg = SIGNS[sk] || {};
									return (
										<div key={i} {...pressable(() => this.castConjunction(c))} title="点击按此会合精确时刻起事件盘" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5, borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none', cursor: 'pointer' }}>
											<span style={{ color: 'var(--horosa-text-secondary)', width: 86, whiteSpace: 'nowrap' }}>{yearLabel(c.year)}-{String(c.month).padStart(2, '0')}</span>
											<span style={{ flex: 1, whiteSpace: 'nowrap' }}><span style={{ color: ELEMENT_COLOR[sg.element], marginRight: 4 }}>{sGlyph(sk)}</span>{sg.cn || ''}</span>
											<span style={{ width: 46, textAlign: 'right', color: 'var(--horosa-text-secondary)' }}>{c.lon != null ? `${(c.lon % 30).toFixed(1)}°` : ''}<span style={{ marginLeft: 5, color: 'var(--horosa-text-secondary)' }}>›</span></span>
										</div>
									);
								})}
								<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 4 }}>{pairCn} · {total} 次{aspCn}（swisseph 精算）· 点击任一行按其精确时刻起会合事件盘。</div>
							</div>
						) : (<div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)', padding: '6px 0' }}>设定年段与星对、相位后点「计算」，列出该区间全部{aspCn}时刻。</div>)
					) : (
						ages && ages.length ? (
							<div style={listStyle}>
								{ages.map((a, i) => this.renderAge(a, i))}
								<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 4 }}>{ages.length} 个时代 · {total} 次合相（swisseph 精算，含三重合相分列；「过渡」= 该次合相落入下一象，预示大转换）· 点击任一会合行起其事件盘。</div>
								{this.renderGreatConjRefTable()}
							</div>
						) : (
							<div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)', padding: '6px 0' }}>设定年段后点「计算」，按星历精算木土合相并归入各时代（座 / 度 / 象 / 主强落）。{this.renderGreatConjRefTable()}</div>
						)
					)}
				</XQSpin>
			</div>
		);
	},

	// Barbault 行星周期指数曲线(§9.3):曲线图 + 极小/极大标注。古典/中世纪规则集无外行星 → 提示切换。
	renderBarbault(extra){
		const cfg = rulesetConfig((extra || {}).mundaneRuleset);
		const ACC = '#8e44ad';
		const head = (
			<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />Barbault 行星周期指数</div>
		);
		if(!cfg.showBarbault){
			return (
				<div style={{ ...CARD, marginTop: 10 }}>
					{head}
					<div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)', lineHeight: 1.7 }}>Barbault 指数依赖外行星（♅♆♇），当前「{cfg.label}」为古典体系（七曜，无外行星）。切换至「现代」或「Barbault 周期」规则集即可启用。</div>
				</div>
			);
		}
		const d = this.state.bbData;
		// 图下的组合名与满刻度跟着已画出的那条曲线走(改了下拉、还没点「绘制」时不跟着变)
		const set = BARBAULT_SETS.find((s) => s.key === ((d && d.setKey) || this.state.bbSet)) || BARBAULT_SETS[0];
		const pts = (d && Array.isArray(d.points)) ? d.points : [];
		const maxIndex = (d && d.maxIndex) || (set.planets.length * (set.planets.length - 1) / 2 * 180);
		const controls = (
			<div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 10, lineHeight: '17px' }}>取慢星两两黄经角距之和成「聚散」曲线：<b style={{ color: 'var(--horosa-jx-xiong, #c0392b)' }}>低谷</b>（行星聚集，→0）多应危机、战乱；<b style={{ color: 'var(--horosa-jx-ji)' }}>高峰</b>（行星四散，→{Math.round(maxIndex)}°）多应扩张、繁荣。史上 1914、1939–45 两次大战即与深谷吻合。</div>
				<div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
					<XQSelect size="small" style={{ width: 196 }} value={this.state.bbSet} onChange={(v) => { MUNDANE_PAGE_SETTINGS.save({ bbSet: v }); this.setState({ bbSet: v }); }}>
						{BARBAULT_SETS.map((s) => (<Option key={s.key} value={s.key}>{s.cn}</Option>))}
					</XQSelect>
					<XQSelect size="small" style={{ width: 104 }} value={this.state.bbHarm} onChange={(v) => { MUNDANE_PAGE_SETTINGS.save({ bbHarm: v }); this.setState({ bbHarm: v }); }}>
						{BARBAULT_HARMONICS.map((h) => (<Option key={h.v} value={h.v}>{h.cn}</Option>))}
					</XQSelect>
					<XQInputNumber size="small" style={{ width: 78 }} value={this.state.bbStart} min={-2000} max={3000}
						onChange={(v) => this.setState({ bbStart: clampYear(v, 1900) })} />
					<span style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>至</span>
					<XQInputNumber size="small" style={{ width: 78 }} value={this.state.bbEnd} min={-2000} max={3000}
						onChange={(v) => this.setState({ bbEnd: clampYear(v, 2050) })} />
					<XQButton size="small" disabled={this.state.bbLoading} onClick={this.computeBarbault}>{this.state.bbLoading ? '计算中…' : '绘制'}</XQButton>
				</div>
				{this.state.bbErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)', marginBottom: 8 }}>{this.state.bbErr}</div> : null}
			</div>
		);
		let body;
		if(!pts.length){
			body = <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)', padding: '6px 0' }}>设定慢星组合与年段后点「绘制」，生成行星聚散指数曲线（跨度 ≤160 年逐季、更长逐年；上限 300 年）。</div>;
		}else{
			const W = 640, H = 226, padL = 46, padR = 14, padT = 14, padB = 28;
			const plotW = W - padL - padR, plotH = H - padT - padB;
			const tVal = (p) => p.year + (p.month - 1) / 12;
			const t0 = tVal(pts[0]), t1 = tVal(pts[pts.length - 1]);
			const xAt = (p) => padL + (t1 > t0 ? (tVal(p) - t0) / (t1 - t0) : 0) * plotW;
			const yAt = (v) => padT + (1 - v / maxIndex) * plotH;
			const line = pts.map((p) => `${xAt(p).toFixed(1)},${yAt(p.index).toFixed(1)}`).join(' ');
			const area = `${padL},${(padT + plotH).toFixed(1)} ${line} ${(padL + plotW).toFixed(1)},${(padT + plotH).toFixed(1)}`;
			let gmin = pts[0], gmax = pts[0];
			pts.forEach((p) => { if(p.index < gmin.index) gmin = p; if(p.index > gmax.index) gmax = p; });
			const span = t1 - t0;
			const stepY = span > 200 ? 50 : (span > 100 ? 25 : (span > 40 ? 20 : 10));
			const yearTicks = [];
			for(let yr = Math.ceil(t0 / stepY) * stepY; yr <= t1 + 0.001; yr += stepY){ yearTicks.push(yr); }
			const yTicks = [0, maxIndex / 2, maxIndex];
			const gridC = 'rgba(128,128,128,0.18)', axC = 'var(--horosa-text-secondary)';   // 轴刻度字:次级字色(旧半透明灰在两种底上都 < 2.1:1)
			const tickLabel = (p) => `${p.year}-${String(p.month).padStart(2, '0')}（${Math.round(p.index)}°）`;
			body = (
				<div>
					<div style={{ width: '100%', overflow: 'hidden' }}>
						<svg className="horosa-plain-text-board" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
							<defs>
								<linearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={ACC} stopOpacity="0.26" />
									<stop offset="100%" stopColor={ACC} stopOpacity="0.02" />
								</linearGradient>
							</defs>
							{yTicks.map((v, i) => (
								<g key={`y${i}`}>
									<line x1={padL} y1={yAt(v)} x2={padL + plotW} y2={yAt(v)} stroke={gridC} strokeWidth="1" strokeDasharray={i === 0 ? '' : '3 3'} />
									<text x={padL - 6} y={yAt(v) + 3.5} textAnchor="end" fontSize="10" fill={axC}>{Math.round(v)}</text>
								</g>
							))}
							{yearTicks.map((yr, i) => (
								<g key={`x${i}`}>
									<line x1={padL + (t1 > t0 ? (yr - t0) / (t1 - t0) : 0) * plotW} y1={padT + plotH} x2={padL + (t1 > t0 ? (yr - t0) / (t1 - t0) : 0) * plotW} y2={padT + plotH + 4} stroke={axC} strokeWidth="1" />
									<text x={padL + (t1 > t0 ? (yr - t0) / (t1 - t0) : 0) * plotW} y={padT + plotH + 16} textAnchor="middle" fontSize="10" fill={axC}>{yr}</text>
								</g>
							))}
							<polygon points={area} fill="url(#bbFill)" stroke="none" />
							<polyline points={line} fill="none" stroke={ACC} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
							<circle cx={xAt(gmin)} cy={yAt(gmin.index)} r="3.6" fill="#c0392b" stroke="#fff" strokeWidth="1" />
							<circle cx={xAt(gmax)} cy={yAt(gmax.index)} r="3.6" fill="#27ae60" stroke="#fff" strokeWidth="1" />
						</svg>
					</div>
					<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, fontSize: 11.5 }}>
						<span><span style={{ color: 'var(--horosa-jx-xiong, #c0392b)', fontWeight: 700 }}>最深谷</span> {tickLabel(gmin)} · 聚集</span>
						<span><span style={{ color: 'var(--horosa-jx-ji)', fontWeight: 700 }}>最高峰</span> {tickLabel(gmax)} · 四散</span>
					</div>
					<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 4 }}>{set.cn.replace(/（[^）]*）/g, '')} · {pts.length} 点 · 满刻度 {Math.round(maxIndex)}°（swisseph 精算，地心黄经）。</div>
				</div>
			);
		}
		return (
			<div style={{ ...CARD, marginTop: 10 }}>
				{head}
				{controls}
				<XQSpin spinning={this.state.bbLoading}>{body}</XQSpin>
			</div>
		);
	},

	// 右栏分页:按盘型给不同 tab,避免卡片堆叠拥挤。
	mundaneRightTabList(type){
		if(type === 'cycles'){
			return [{ value: 'cycles', label: '木土纪元' }, { value: 'barbault', label: 'Barbault' }, { value: 'greatyear', label: '大年时代' }, { value: 'cycletables', label: '周期表' }];
		}
		if(type === 'solunar'){
			return [{ value: 'overview', label: '概览' }, { value: 'angularity', label: '角化' }, { value: 'judge', label: '判读' }, { value: 'stars', label: '恒星' }];
		}
		if(type === 'vedicmundane'){
			return [{ value: 'overview', label: '年度盘' }, { value: 'navanayaka', label: '九主' }, { value: 'dasha', label: '大运' }, { value: 'kp', label: 'KP' }, { value: 'weather', label: '天气农业' }, { value: 'transit', label: '过境分野' }];
		}
		if(type === 'mundanehorary'){
			return [{ value: 'question', label: '问判' }, { value: 'judge', label: '判读' }, { value: 'stars', label: '恒星' }];
		}
		const tabs = [{ value: 'overview', label: '概览' }, { value: 'judge', label: '判读' }, { value: 'stars', label: '恒星' }];
		if(type === 'ingress' || type === 'region'){ tabs.push({ value: 'choro', label: '分野' }); }
		if(type === 'region'){ tabs.push({ value: 'prog', label: '推运' }); }
		return tabs;
	},

	// 单个 tab 的内容(按盘型 + tab key 组卡)。
	mundaneTabContent(key, chart, extra, type){
		if(type === 'cycles'){
			if(key === 'barbault'){ return this.renderBarbault(extra); }
			if(key === 'greatyear'){ return this.renderGreatYear(); }
			if(key === 'cycletables'){ return <MundaneCycleTables value={chart} onText={(text, chartKey)=>this.setState({ cycleTableText: text, cycleTableKey: chartKey })} />; }
			return (<Fragment>{this.renderGreatConj(false, extra)}{this.renderConjunctionEras()}</Fragment>);
		}
		if(type === 'solunar' && key === 'overview'){ return this.renderSolunarOverview(chart, extra); }
		if(type === 'solunar' && key === 'angularity'){ return this.renderSolunarAngularity(chart, extra); }
		if(type === 'mundanehorary' && key === 'question'){ return this.renderMundaneHoraryQuestion(chart, extra); }
		if(type === 'vedicmundane'){
			if(key === 'overview'){ return this.renderVedicOverview(chart, extra); }
			if(key === 'navanayaka'){ return this.renderVedicNavanayaka(extra); }
			if(key === 'dasha'){ return this.renderVedicDasha(chart, extra); }
			if(key === 'kp'){ return this.renderVedicKp(chart); }
			if(key === 'weather'){ return this.renderVedicWeather(extra); }
			if(key === 'transit'){ return this.renderVedicTransit(); }
		}
		if(key === 'overview'){
			return (
				<Fragment>
					{type === 'ingress' ? this.renderYearChart(chart, extra) : null}
					{type === 'ingress' ? this.renderIngressSkeleton(chart) : null}
					{type === 'ingress' ? this.renderSeasonalCard(extra) : null}
					{(type === 'newmoon' || type === 'fullmoon') ? this.renderLunationCard(chart, extra, type) : null}
					{(type === 'solecl' || type === 'lunecl') ? this.renderEclipseCard(chart, extra, type) : null}
					{(type === 'solecl' || type === 'lunecl') ? this.renderSarosCard(chart) : null}
					{(type === 'solecl' || type === 'lunecl') ? this.renderOmenologyCard(chart) : null}
					{type === 'region' ? this.renderRegionCard(chart, extra) : null}
					{type === 'region' ? this.renderRectificationCard(chart) : null}
					{(type === 'ingress' || type === 'newmoon' || type === 'fullmoon') ? this.renderWeatherCard(chart, extra) : null}
					{this.renderSpecialAxesCard(chart)}
				</Fragment>
			);
		}
		if(key === 'judge'){ return (<Fragment>{this.renderConjunctionIndicator(chart)}{this.renderVictorCard(chart, extra)}{this.renderDistributionCard(chart, extra)}{this.renderJudgmentCards(chart)}</Fragment>); }
		if(key === 'choro'){ return this.renderChorographyCard(chart, extra); }
		if(key === 'prog'){ return (<Fragment>{this.renderProgressionCard(chart, extra)}{this.renderPrimaryDirectionNote()}</Fragment>); }
		return (<Fragment>{this.renderFixedStarCard(chart, extra)}{this.renderDeclParallelCard(chart)}</Fragment>); // stars
	},

	renderRight({ chart, extra }){
		const type = extra.mundaneType || 'ingress';
		const tabs = this.mundaneRightTabList(type);
		let active = this.state.mundaneRightTab || tabs[0].value;
		if(!tabs.some((t) => t.value === active)){ active = tabs[0].value; }
		// horosa_panel_ready_v1:世俗盘中栏(壳画的盘)+右栏卡片同源于 chart;本组件的
		// 事件扫描/大合相/Barbault/返照/次限/重定位都是用户另点按钮的后台批算,不属于
		// 「点击→画完」路径,故不在那 8 处 setState 上打点(会把几十秒的批算配到上一次交互起点上)。
		if(chart && chart !== this._readyChart){
			this._readyChart = chart;
			markPanelReady('auxchart');
		}
		return (
			<XQTabs activeKey={active} className="horosa-inspector-tabs horosa-content-tabs"
				onChange={(k) => this.setState({ mundaneRightTab: k })}>
				{/* horosa_freeze_subtabs_v1:右栏各组改【函数式】children —— 原先每次渲染都把
				    全部 tab 的卡片组算一遍(每组各自 buildFacts + describeXXX + 恒星扫描),
				    现在只有当前激活组求值;非激活组冻结保留已渲染 DOM,切回时用最新 chart 立刻重算。 */}
				{tabs.map((t) => (
					<TabPane tab={t.label} key={t.value}>
						<FreezeSubTab active={active === t.value}>{()=>{
							const content = this.mundaneTabContent(t.value, chart, extra, type);
							return <div style={{ fontSize: 13 }}>{content || <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)', padding: '8px 2px' }}>暂无内容,请先排盘。</div>}</div>;
						}}</FreezeSubTab>
					</TabPane>
				))}
			</XQTabs>
		);
	},
};
