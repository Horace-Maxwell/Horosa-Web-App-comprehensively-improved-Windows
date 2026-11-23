// 塔罗页 · 左栏牌局设置面板
// 从 TarotMain.js 按职责拆出的 TarotMain 方法:this 仍是 TarotMain 实例,门面里 mixinMethods(TarotMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { Input } from 'antd';
import { XQButton as Button, XQSelect as Select, XQSegmented, XQSideSection, XQCheckbox, XQInputNumber } from '../../xq-ui';
import { sideSectionIcon } from '../../../constants/sideSectionIcons';
import SpaceTimePanel, { buildDateTimeFromFields } from '../../comp/SpaceTimePanel';
import { listDeckGroups } from '../engine/deckRegistry';
import { SPREADS, SPREAD_GROUPS } from '../engine/spreads';
import { deckHasRealArt, deckArtIsMajorsOnly } from '../engine/cardArt';
import { SIGN_CN, SUIT_CN, COURT_CN, COURT_ORDER, SUITS } from '../decks/correspondences';
import { DUMMETT_ORDERS } from '../decks/visconti';
import { REVERSAL_MODE_GROUPS, REVERSAL_TEMPLATES } from '../engine/reversalModes';
import { SIGN_KEYS } from './layout';
import { TAROT_PAGE_SETTINGS } from './settings';
import { seedDisplayText } from '../../../utils/trueRandom';
const { Option, OptGroup } = Select;

export const inputPanelMethods = {
	// 左栏口径项的统一渲染:一个带标签的下拉,放进 .horosa-tarot-field-grid 即自动一行两个。
	// options[].note 挂到该选项的 title(悬停即见),不再在控件下方另起一行说明
	//(那种说明只在选中某档时才出现,位置飘忽且吃高度;正文详解在帮助文档「塔罗」章)。
	renderPickField({ label, value, onChange, options }){
		return (
			<div className="horosa-tarot-field" key={label}>
				<label>{label}</label>
				<Select value={value} onChange={onChange} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false}>
					{(options || []).map((opt)=>(
						<Option value={opt.value} key={opt.value} title={opt.note || opt.label}>{opt.label}</Option>
					))}
				</Select>
			</div>
		);
	},

	// 当前牌阵张数 < 4 → 「大牌加盖」引擎门槛不可达,置灰并说明
	isSmallSpread(){
		const sp = SPREADS[this.state.spreadType];
		return !!(sp && Array.isArray(sp.positions) && sp.positions.length < 4);
	},

	renderInputPanel(){
		const s = this.state;
		const caps = this.caps();
		const deck = this.currentDeck();
		const groups = listDeckGroups();
		const allowedSpreads = (caps.spreads || Object.keys(SPREADS)).filter((k) => SPREADS[k]);
		// 「牌阵细则」三项的门控:整节是否出现由这三项决定(全不适用即整节不渲染,不留空态卡)。
		// 单一来源 —— 节的显示条件与各项的显示条件必须同源,否则加第四项时会漏改其一。
		const spreadDetailShow = {
			crossing: ['celtic', 'celtic6', 'celtic11'].includes(s.spreadType) && caps.reversals !== false,
			ook: !!(caps.ook && s.spreadType === 'opening_of_key'),
			dummett: !!caps.dummett,
		};
		return (
			<div className="horosa-huangji-input-stack horosa-tarot-input-stack">
				{/* 原「⤢ 展开为全宽」按钮已按用户定案移除(连同 sideExpanded 视图态与 is-side-expanded 样式)。
				    它当初是为了缓解窄栏下控件被挤压;判读口径六项改成一行两个的下拉后,左栏本身已不挤,
				    这颗按钮只剩占位。窄窗的兜底改由 .horosa-tarot-field-grid 的媒体查询单独负责。 */}
				<div className="horosa-tarot-side-toolbar">
					<span className="horosa-tarot-side-toolbar-title">起卦设置</span>
				</div>
				{/* [自由起盘] 时间与地点:「出生信息」种子按此时地算(可复现);亦作占问时刻·地点入事盘(不写主命盘) */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						fields={this.activeFields()}
						value={buildDateTimeFromFields(this.activeFields())}
						onTimeChange={this.onTimeChanged}
						onGeoChange={this.changeGeo}
					/>
				</XQSideSection>
				{/* tarot 左栏四段式:牌组牌阵(不折叠)/高级/指示牌/种子所问(折叠记忆) */}
				<XQSideSection iconName={sideSectionIcon('school')} title="流派与牌阵" collapsible={false}>
				<div className="horosa-tarot-field">
					<label>流派 / 牌组</label>
					<Select value={s.deckId} onChange={this.changeDeck} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false} dropdownClassName="horosa-tarot-deck-dropdown" listHeight={420}>
						{groups.map((g) => (
							<OptGroup label={g.group} key={g.group}>
								{g.items.map((it) => (<Option value={it.value} key={it.value}>{it.label}</Option>))}
							</OptGroup>
						))}
					</Select>
				</div>
				<div className="horosa-tarot-field">
					<label>牌阵</label>
					<Select value={allowedSpreads.indexOf(s.spreadType) >= 0 ? s.spreadType : allowedSpreads[0]} onChange={this.changeSpread} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false} listHeight={440} showSearch optionFilterProp="children">
						{(() => {
							// TP5 分组下拉:按 SPREAD_GROUPS 分组显示(仅列本牌组允许的);遗漏项兜底入「其他」。
							const allowedSet = new Set(allowedSpreads);
							const grouped = new Set();
							const nodes = SPREAD_GROUPS.map((g) => {
								const items = g.items.filter((k) => allowedSet.has(k) && SPREADS[k]);
								items.forEach((k) => grouped.add(k));
								if(!items.length){ return null; }
								return (
									<OptGroup label={g.group} key={g.group}>
										{items.map((k) => (<Option value={k} key={k}>{SPREADS[k].label}</Option>))}
									</OptGroup>
								);
							}).filter(Boolean);
							const rest = allowedSpreads.filter((k) => !grouped.has(k));
							if(rest.length){
								nodes.push(
									<OptGroup label="其他" key="__rest">
										{rest.map((k) => (<Option value={k} key={k}>{SPREADS[k].label}</Option>))}
									</OptGroup>
								);
							}
							return nodes;
						})()}
					</Select>
				</div>

				</XQSideSection>
				{/* 「流派简介」整节已移出左栏 —— 左栏不放大段解释(铁律),十四个牌组的
				    身份/历史/图义/小牌读法/与他派差异,以及四花色对照,改在右上角「帮助」
				    手册的塔罗页里看(那边直接读同一份数据源,不另抄一份)。 */}
				<XQSideSection iconName={sideSectionIcon('advanced')} title="盘面与开关" storageKey="tarot.advanced" className="horosa-side-input-section">
				{deckHasRealArt(s.deckId) ? (
					<div className="horosa-tarot-field">
						<label>牌面样式</label>
						<XQSegmented value={s.artStyle} onChange={(e) => { TAROT_PAGE_SETTINGS.save({ artStyle: e.target.value }); this.setState({ artStyle: e.target.value }); }} options={[{ label: '简约符号', value: 'symbol' }, { label: '真实牌面', value: 'image' }]} />
						{s.artStyle === 'image' && deckArtIsMajorsOnly(s.deckId) && deck && deck.size > 22 ? (
							<div style={{ fontSize: 11, lineHeight: 1.45, marginTop: 4, color: 'var(--horosa-astro-muted, #8fa0b9)' }}>真实牌面仅 22 大牌;花色小牌无公有领域单卡图,以符号呈现。需全 78 张真实牌面请用 RWS。</div>
						) : null}
					</div>
				) : null}
				{/* [塔罗开关=六爻同款芯片] 逆位/元素尊位/进阶对应/牌底牌改 Checkbox 芯片网格(与六爻/紫微显示项统一);caps 决定各芯片是否出现。 */}
				<div className="horosa-guazhan-toggle-grid horosa-tarot-toggle-grid">
					{caps.reversals !== false ? (
						<XQCheckbox checked={!!s.useReversals} onChange={(e) => this.changeSetting({ useReversals: e.target.checked })}>逆位</XQCheckbox>
					) : null}
					{caps.dignities ? (
						<XQCheckbox checked={!!s.useDignities} onChange={(e) => this.changeSetting({ useDignities: e.target.checked })}>元素尊位</XQCheckbox>
					) : null}
					{caps.variant ? (
						<XQCheckbox checked={!!s.showCorrespondences} onChange={(e) => this.changeSetting({ showCorrespondences: e.target.checked })}>显示进阶对应</XQCheckbox>
					) : null}
					{caps.readingMethod === 'tarot' ? (
						<XQCheckbox checked={!!s.showBottomCard} onChange={(e) => this.changeSetting({ showBottomCard: e.target.checked })}>牌底牌(基调)</XQCheckbox>
					) : null}
					{caps.readingMethod === 'tarot' ? (
						<XQCheckbox checked={!!s.showCutCard} onChange={(e) => this.changeSetting({ showCutCard: e.target.checked })}>切牌(心态)</XQCheckbox>
					) : null}
					{caps.readingMethod === 'tarot' ? (
						/* 引擎门槛:仅四张及以上牌阵(达四张大牌或过半)才加盖 → 1–3 张牌阵置灰并说明,不再默默无效 */
						<XQCheckbox checked={!!s.majorsOverlay} disabled={!!this.isSmallSpread()}
							title={this.isSmallSpread() ? '仅四张及以上牌阵可用(大牌达四张或过半时加盖)' : '大牌达四张或过半时,每张大牌自余牌加盖一张小牌'}
							onChange={(e) => this.changeSetting({ majorsOverlay: e.target.checked })}>大牌加盖{this.isSmallSpread() ? '（四张以上牌阵）' : ''}</XQCheckbox>
					) : null}
					{caps.blank ? (
						<XQCheckbox checked={!!s.includeBlank} onChange={(e) => this.changeSetting({ includeBlank: e.target.checked })}>空白牌(79张)</XQCheckbox>
					) : null}
				</div>
				</XQSideSection>
				{/* 判读口径类(牌义/逆位读法/对应与宫廷体系/尊位版本)集中一节,与上方「盘面与开关」
				    (决定牌面与流程的项)分开——两类语义不同:前者只改判读文本,后者改盘面本身。 */}
				<XQSideSection iconName={sideSectionIcon('school')} title="读法体系" storageKey="tarot.reading" className="horosa-side-input-section">
				{/* 🔴 判读口径六项原为横排分段控件(XQSegmented),每项自成一行、选项一多就换行,
				    整节吃掉左栏近半高度。改为**一行两个的下拉**:同样的信息密度只占三行。
				    各档原挂在控件下方的说明改走选项 title(悬停即见),正文详解在帮助文档「塔罗」章
				    ——「左边栏不放大段解释」铁律,且那些说明本就只在选中某一档时才出现、位置飘忽。 */}
				<div className="horosa-tarot-field-grid">
				{caps.variant && s.showCorrespondences ? this.renderPickField({
					label: '字母/路径变体',
					value: s.variant,
					onChange: (v) => this.changeSetting({ variant: v }),
					options: [{ label: 'A 金色黎明', value: 'A' }, { label: 'B 托特', value: 'B' }, { label: 'C 大陆', value: 'C' }],
				}) : null}
				{caps.readingMethod === 'tarot' && s.showCorrespondences ? this.renderPickField({
					label: '宫廷元素体系',
					value: s.courtElementSystem || 'gd',
					onChange: (v) => this.changeSetting({ courtElementSystem: v }),
					options: [
						{ label: '元素中元素', value: 'gd' },
						{ label: '位阶制', value: 'alt', note: '位阶制:王=土·后=水·骑=火·侍=风(另一派通行口径)。' },
					],
				}) : null}
				{caps.readingMethod === 'tarot' && s.showCorrespondences ? this.renderPickField({
					label: '宫廷星座体系',
					value: s.courtZodiacSystem || 'gd_span',
					onChange: (v) => this.changeSetting({ courtZodiacSystem: v }),
					options: [
						{ label: '跨段', value: 'gd_span' },
						{ label: '单座制', value: 'simple', note: '单座制:每宫廷守一座(后本位/王固定/骑变动),侍从不配星座。' },
					],
				}) : null}
				{caps.dignities && s.useDignities ? this.renderPickField({
					label: '尊位版本',
					value: s.edVersion || 'modern',
					onChange: (v) => this.changeSetting({ edVersion: v }),
					options: [
						{ label: '现行三档', value: 'modern' },
						{ label: '原典四档', value: 'mathers', note: '原典口径:火+土/风+水亦算「稍微支持」,不再有中立对。' },
					],
				}) : null}
				{caps.readingMethod === 'tarot' ? this.renderPickField({
					label: '牌义体系',
					value: s.meaningSystem || 'manual',
					onChange: (v) => this.changeSetting({ meaningSystem: v }),
					options: [
						{ label: '逐牌义', value: 'manual' },
						{ label: 'Waite 1911', value: 'waite' },
						{ label: '数字度', value: 'degrees', note: '马赛口径:小牌按十度周期×四中心推演(剑=智力·杯=情感·杖=创造·币=物质),宫廷四阶(侍→后→王→骑)。' },
					],
				}) : null}
				{caps.readingMethod === 'tarot' && caps.reversals !== false && s.useReversals ? (
					<div className="horosa-tarot-field">
						<label>逆位读法</label>
						<Select value={s.reversalMode || 'stored'} onChange={(v) => this.changeSetting({ reversalMode: v })} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false} listHeight={360}>
							{REVERSAL_MODE_GROUPS.map((g) => (
								<OptGroup label={g.group} key={g.group}>
									{g.items.map((m) => (
										<Option value={m} key={m} title={(REVERSAL_TEMPLATES[m] && REVERSAL_TEMPLATES[m].note) || ''}>{m === 'stored' ? '预存逆位义' : (REVERSAL_TEMPLATES[m] && REVERSAL_TEMPLATES[m].label) || m}</Option>
									))}
								</OptGroup>
							))}
						</Select>
					</div>
				) : null}
				{caps.readingMethod === 'tarot' && caps.reversals !== false && s.useReversals ? this.renderPickField({
					label: '逆位产生',
					value: s.reversalGen || 'shuffle',
					onChange: (v) => this.changeSetting({ reversalGen: v }),
					options: [
						{ label: '洗牌', value: 'shuffle' },
						{ label: '三指定牌', value: 'fingers3', note: '古法:全副转正,占前定意逆转三张;它们若现身阵中,权重大增。' },
						{ label: '全逆', value: 'all', note: '全逆位阵:整局以「受阻/内在/待突破」视角解读。' },
					],
				}) : null}
				</div>
				{caps.variant && s.showCorrespondences && caps.readingMethod === 'tarot' ? (
					<div className="horosa-guazhan-toggle-grid horosa-tarot-toggle-grid" style={{ marginTop: 6, gridTemplateColumns: 'minmax(0, 1fr)' }}>
						<XQCheckbox checked={!!s.astroModern} onChange={(e) => this.changeSetting({ astroModern: e.target.checked })}>三元素大牌附现代行星注</XQCheckbox>
					</div>
				) : null}
				{caps.readingMethod === 'tarot' ? (
					// 孤芯片整行铺满(用户定案:半宽会把「火/风互换(少数派)」挤成两行,全宽反省空间)。
					<div className="horosa-guazhan-toggle-grid horosa-tarot-toggle-grid" style={{ marginTop: 6, gridTemplateColumns: 'minmax(0, 1fr)' }}>
						<XQCheckbox checked={!!s.suitElementSwap} onChange={(e) => this.changeSetting({ suitElementSwap: e.target.checked })}>火/风互换(少数派)</XQCheckbox>
					</div>
				) : null}
				{/* 判读口径里另有四项(定局法/精华牌口径/计时法与单位)贴着结果放在右栏,左栏给一行指路,
				    免得在此翻找不到而以为缺失。一行导航提示,非解释文字。 */}
				{caps.readingMethod !== 'lenormand' ? (
					<div className="horosa-tarot-deckinfo-row" style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>定局法 · 精华牌口径 · 计时法在右栏「定局」页内调。</div>
				) : null}
				</XQSideSection>
				{/* 第三节「牌阵细则」:只在特定牌阵/牌组出现的项(交叉牌横置、开钥计数表、历史牌序),
				    与通用读法口径分开,避免长表淹没常用项。三项皆 caps 门控。
				    🔴 三项皆不适用时**整节不出现** —— 原先出一张「当前牌阵与牌组无专属细则可调」的空态卡,
				    那是纯噪音:占着左栏一格高度,却没有任何可操作项。判据与三项的显示条件同源,
				    不另写一份(否则新增第四项时必忘同步,空态卡会在有项可调时错误出现)。 */}
				{(spreadDetailShow.crossing || spreadDetailShow.ook || spreadDetailShow.dummett) ? (
				<XQSideSection iconName={sideSectionIcon('advanced')} title="牌阵细则" storageKey="tarot.spreadopt" className="horosa-side-input-section">
				{spreadDetailShow.crossing ? (
					<div className="horosa-guazhan-toggle-grid horosa-tarot-toggle-grid" style={{ marginTop: 6, gridTemplateColumns: 'minmax(0, 1fr)' }}>
						<XQCheckbox checked={s.crossingUpright !== false} onChange={(e) => this.changeSetting({ crossingUpright: e.target.checked })}>交叉牌横置(恒正读)</XQCheckbox>
					</div>
				) : null}
				{spreadDetailShow.ook ? (
					<div className="horosa-tarot-field">
						<label>开钥计数表</label>
						<XQSegmented value={s.ookTable || 'standard'} onChange={(e) => this.changeSetting({ ookTable: e.target.value })} options={[{ label: '通行', value: 'standard' }, { label: '质点', value: 'sephira' }]} />
						<div className="horosa-tarot-deckinfo-row" style={{ marginTop: 4, fontSize: 11 }}>{s.ookTable === 'sephira' ? '宫廷按生命树质点计数:王2·后3·骑6·侍9' : '数字=面值·Ace 5·宫廷 4(侍 7)·大牌 3/9/12(三母/行星/星座)'}</div>
					</div>
				) : null}
				{spreadDetailShow.dummett ? (
					<div className="horosa-tarot-field">
						<label>大牌顺序(Dummett 区域序)</label>
						<XQSegmented value={s.dummettOrder || 'C'} onChange={(e) => this.changeSetting({ dummettOrder: e.target.value })} options={[{ label: 'A 南', value: 'A' }, { label: 'B 东', value: 'B' }, { label: 'C 西', value: 'C' }]} />
						<div className="horosa-tarot-deckinfo-row" style={{ marginTop: 4, fontSize: 11 }}>{(DUMMETT_ORDERS[s.dummettOrder || 'C'] || {}).note || ''}</div>
					</div>
				) : null}

				</XQSideSection>
				) : null}
				{caps.significator ? (
					<XQSideSection iconName={sideSectionIcon('target')} title="指示牌" storageKey="tarot.sig" className="horosa-side-input-section">
					<>
						<div className="horosa-tarot-field">
							<label>选取方式</label>
							<Select value={s.sig.mode} onChange={(v) => this.changeSetting({ sig: { ...s.sig, mode: v } })} size="small" style={{ width: '100%' }}>
								<Option value="none">不使用</Option>
								<Option value="auto">自动(性别·年龄·星座)</Option>
								<Option value="manual">手动指定</Option>
								{caps.etteillaDual ? <Option value="etteilla">双指示牌(此制:男=牌一/女=牌八)</Option> : null}
							</Select>
						</div>
						{s.sig.mode === 'auto' ? (
							<>
								<div className="horosa-tarot-field"><label>性别</label>
									<XQSegmented value={s.sig.gender} onChange={(e) => this.changeSetting({ sig: { ...s.sig, gender: e.target.value } })} options={[{ label: '男', value: 'male' }, { label: '女', value: 'female' }]} />
								</div>
								<div className="horosa-tarot-field"><label>年龄</label>
									<XQInputNumber value={s.sig.age} min={0} max={120} onChange={(v) => this.changeSetting({ sig: { ...s.sig, age: v } })} size="small" style={{ width: '100%' }} />
								</div>
								<div className="horosa-tarot-field"><label>星座</label>
									<Select value={s.sig.sign} onChange={(v) => this.changeSetting({ sig: { ...s.sig, sign: v } })} size="small" style={{ width: '100%' }} placeholder="选择星座">
										{SIGN_KEYS.map((k) => (<Option value={k} key={k}>{SIGN_CN[k]}</Option>))}
									</Select>
									{/* 自动指示牌以星座定元素/宫廷牌:未选星座时引擎回 null(等同「不使用」),此前无任何提示 */}
									{!s.sig.sign ? <div className="horosa-tarot-line" style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>未选星座时「自动」无法定指示牌，等同「不使用」——请选星座或改「手动指定」</div> : null}
								</div>
							</>
						) : null}
						{s.sig.mode === 'etteilla' ? (
							<div className="horosa-tarot-field"><label>问者</label>
								<XQSegmented value={s.sig.gender} onChange={(e) => this.changeSetting({ sig: { ...s.sig, gender: e.target.value } })} options={[{ label: '男(牌一)', value: 'male' }, { label: '女(牌八)', value: 'female' }]} />
							</div>
						) : null}
						{s.sig.mode === 'manual' ? (
							<div className="horosa-tarot-field"><label>宫廷牌</label>
								<Select value={s.sig.manualId} onChange={(v) => this.changeSetting({ sig: { ...s.sig, manualId: v } })} size="small" style={{ width: '100%' }}>
									{SUITS.map((suit) => COURT_ORDER.map((court) => (
										<Option value={`${suit}_${court}`} key={`${suit}_${court}`}>{SUIT_CN[suit]}{COURT_CN.rws[court]}</Option>
									)))}
								</Select>
							</div>
						) : null}
					</>
					</XQSideSection>
				) : null}
				<XQSideSection iconName={sideSectionIcon('input')} title="种子与所问" storageKey="tarot.seed" className="horosa-side-input-section">
				<div className="horosa-tarot-field">
					<label>种子来源</label>
					<Select value={s.seedMode} onChange={(v) => { TAROT_PAGE_SETTINGS.save({ seedMode: v }); this.setState({ seedMode: v }); }} size="small" style={{ width: '100%' }}>
						<Option value="random">随机</Option>
						<Option value="birth">出生信息(可复现)</Option>
						<Option value="manual">手动种子</Option>
					</Select>
				</div>
				{s.seedMode === 'manual' ? (
					<div className="horosa-tarot-field"><label>手动种子</label>
						{/* 文本框:锁定复现带来的种子可能是真随机记录(tr1-…)、旧随机种子(rnd-…)或出生信息串,数字框装不下、一碰就改;原样存原样显 */}
						<Input value={s.manualSeed === undefined || s.manualSeed === null ? '' : `${s.manualSeed}`} onChange={(e) => this.setState({ manualSeed: e.target.value })} size="small" style={{ width: '100%' }} placeholder="任意数字或文字" />
					</div>
				) : null}
				<div className="horosa-tarot-field">
					<label>所问之事(可选)</label>
					<Input value={s.question} onChange={(e) => this.setState({ question: e.target.value })} onBlur={() => this.applyRecompute()} size="small" placeholder="如:这段关系的走向" />
				</div>
				</XQSideSection>
				<div className="horosa-tarot-actions">
					<Button type="primary" size="small" iconName="quickPrimary" onClick={this.drawCards}>抽牌</Button>
					<Button size="small" iconName="quickFirdaria" onClick={this.clickReproduce}>锁定复现</Button>
					<Button size="small" iconName="quickNote" onClick={this.clickSaveCase}>保存</Button>
				</div>
				{s.lastSeed ? <div className="horosa-tarot-seed-hint" title={`${s.lastSeed}`}>当前种子：{seedDisplayText(s.lastSeed)}</div> : null}
			</div>
		);
	},
};
