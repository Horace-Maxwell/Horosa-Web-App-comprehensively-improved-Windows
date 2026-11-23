// 世运盘 · 左栏各技法的附加设置(日月 / 吠陀 / 入宫 / 扫描 / 地区)
// 从 MundaneMain.js 按职责拆出的 MundaneMain 方法:this 仍是 MundaneMain 实例,门面里 mixinMethods(MundaneMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Input } from 'antd';
import { XQSelect, XQButton, XQSideSection, XQInputNumber } from '../../xq-ui';
import { SIGNS } from '../../../divination/data/signs';
import { SOLUNAR_TYPES, SOLUNAR_WEIGHTS, ANGULARITY_ORBS } from '../../../divination/mundane/solunar';
import { MUNDANE_HORARY_KINDS } from '../../../divination/mundane/mundaneHorary';
import { MUNDANE_RULESETS } from '../../../divination/mundane/ruleset';
import { allRegions, MUNDANE_CAPITALS, regionCandidates } from '../../../divination/data/regionCharts';
import { pressable } from '../../../utils/pressable';
import { MUNDANE_TYPES, INGRESSES, SIGN_KEYS, ELEMENT_COLOR, sGlyph, currentYear, clampYear } from './tables';
import { userSetExtra } from './cards';
const Option = XQSelect.Option;

export const leftPanelMethods = {
	// ---------- 左栏 ----------
	renderLeftExtra({ extra, setExtra, fields, setTime, patchFields }){
		const type = extra.mundaneType || 'ingress';
		const ruleset = extra.mundaneRuleset || 'modern';
		// 两个条件档的真消费面(见各自控件旁注):判读容许度=日/月食盘;入境主管制=入宫盘。
		const orbSchemeLive = type === 'solecl' || type === 'lunecl';
		const ingressRuleLive = type === 'ingress';
		this._setTime = setTime; this._fields = fields; this._setExtra = setExtra;   // 供右栏校正/会合起盘用
		return (
			<XQSideSection iconName="sliders" title="世俗盘设置" storageKey="mundane.opts" className="horosa-side-input-section">
			<div className="horosa-field-block horosa-mundane-left">
				{/* 四个下拉走 .horosa-field-grid 两两成对(用户 2026-07-31 指定,节省左栏纵向空间)。
				   收起态半宽会 ellipsis 长选项文本,但 XQSelect 组件层已全局 dropdownMatchSelectWidth={false}
				   ——展开面板按内容全宽,选值时看得全,故不影响可用性。 */}
				<div className="horosa-field-grid">
					<div className="horosa-field-block">
						<div className="horosa-field-label">世运规则集</div>
						<XQSelect style={{ width: '100%' }} size="small" value={ruleset} optionLabelProp="label"
							onChange={(v) => userSetExtra(setExtra, { mundaneRuleset: v })}>
							{MUNDANE_RULESETS.map((r) => (<Option key={r.key} value={r.key} label={r.short || r.label}>{r.label}</Option>))}
						</XQSelect>
					</div>
					{/* 本档全仓唯一消费点是日/月食盘的「受冲行星」判定(renderEclipseCard);
					    其余盘型选了什么都不读 —— 按盘型置灰并说明,别让人以为它全页生效。
					    标签勘误:实现是固定 2° 上限,不是逐星半距和。 */}
					<div className="horosa-field-block" title={orbSchemeLive ? undefined : '只作用于日食 / 月食盘的受冲行星判定;当前盘型不读此档'}>
						<div className="horosa-field-label">判读容许度</div>
						<XQSelect style={{ width: '100%' }} size="small" value={(extra.mundaneOrbScheme) || 'auto'} optionLabelProp="label"
							disabled={!orbSchemeLive}
							onChange={(v) => userSetExtra(setExtra, { mundaneOrbScheme: v })}>
							<Option value="auto" label="随流派">随流派（默认）</Option>
							<Option value="moiety" label="≤2°收紧">受冲容许 ≤2°（古典收紧）</Option>
							<Option value="by_aspect" label="按相位">按相位（现代 ≤3°）</Option>
						</XQSelect>
					</div>
				</div>
				<div className="horosa-field-grid">
					{/* 本档唯一消费点是入宫盘的「年盘概要」(主管月数/是否须再起分季盘);
					    其余盘型不读 → 置灰;入宫盘未排时可先选,结果排盘后出现。 */}
					<div className="horosa-field-block" title={ingressRuleLive ? (extra.ingressMoment ? undefined : '选定后在「排入宫盘」出盘的『年盘概要』里生效') : '只作用于入宫盘的年盘概要;当前盘型不读此档'}>
						<div className="horosa-field-label">入境主管制</div>
						<XQSelect style={{ width: '100%' }} size="small" value={(extra.mundaneIngressRule) || 'auto'} optionLabelProp="label"
							disabled={!ingressRuleLive}
							onChange={(v) => userSetExtra(setExtra, { mundaneIngressRule: v })}>
							<Option value="auto" label="随流派">随流派（默认）</Option>
							<Option value="quarterly" label="季度制">季度制（按四轴模式递归）</Option>
							<Option value="aries_annual" label="全年制">全年制（白羊盘主全年）</Option>
							<Option value="capricorn_year" label="摩羯优先">摩羯优先（冬至为年首）</Option>
						</XQSelect>
					</div>
					<div className="horosa-field-block">
						<div className="horosa-field-label">世俗盘类型</div>
						<XQSelect style={{ width: '100%' }} size="small" value={type}
							onChange={(v) => setExtra({ mundaneType: v })}>
							{MUNDANE_TYPES.map((t) => (<Option key={t.key} value={t.key}>{t.label}</Option>))}
						</XQSelect>
					</div>
				</div>
				<div className="horosa-mundane-controls">
					{type === 'ingress' ? this.renderIngressLeft(extra, setExtra, fields, setTime, patchFields) : null}
					{(type === 'newmoon' || type === 'fullmoon' || type === 'solecl' || type === 'lunecl') ? this.renderScanLeft(type, extra, setExtra, fields, setTime) : null}
					{type === 'region' ? this.renderRegionLeft(extra, setExtra, patchFields, fields) : null}
					{type === 'cycles' ? (<div className="horosa-mundane-hint">「行星周期」在右栏设定年段，计算木土大合相时代纪元。</div>) : null}
					{type === 'solunar' ? this.renderSolunarLeft(extra, setExtra, fields, setTime, patchFields) : null}
					{type === 'vedicmundane' ? this.renderVedicLeft(extra, setExtra, fields, setTime, patchFields) : null}
					{type === 'mundanehorary' ? (
						<div>
							<div className="horosa-field-label sub">问题类型</div>
							<XQSelect style={{ width: '100%' }} size="small" value={extra.mhKind || 'war'}
								onChange={(v) => setExtra({ mhKind: v })}>
								{MUNDANE_HORARY_KINDS.map((k) => (<Option key={k.key} value={k.key}>{k.cn}</Option>))}
							</XQSelect>
							<div className="horosa-mundane-hint">提问时刻=上方时间(默认此刻,可改);地点=上方地点。机制同卜卦,问主=公众/国家。</div>
						</div>
					) : null}
				</div>
			</div>
			</XQSideSection>
		);
	},

	renderSolunarLeft(extra, setExtra, fields, setTime, patchFields){
		const typeKey = extra.solunarType || 'capsolar';
		const year = extra.solunarYear != null ? extra.solunarYear : currentYear();
		return (
			<div>
				<div className="horosa-field-label sub">盘种（8 种日/月恒星入境）</div>
				<XQSelect style={{ width: '100%' }} size="small" value={typeKey}
					dropdownMatchSelectWidth={false}
					onChange={(v) => setExtra({ solunarType: v })}>
					{SOLUNAR_TYPES.map((t) => (<Option key={t.key} value={t.key}>{t.cn}</Option>))}
				</XQSelect>
				<div className="horosa-field-label sub">年份</div>
				<XQInputNumber size="small" style={{ width: '100%' }} value={year} min={1800} max={2400}
					onChange={(v) => setExtra({ solunarYear: clampYear(v, currentYear()) })} />
				<div className="horosa-field-label sub">强度口径</div>
				<XQSelect style={{ width: '100%' }} size="small" value={extra.solunarWeights || 'scheme_a'}
					onChange={(v) => userSetExtra(setExtra, { solunarWeights: v })}>
					{Object.keys(SOLUNAR_WEIGHTS).map((k) => (<Option key={k} value={k}>{SOLUNAR_WEIGHTS[k].cn}</Option>))}
				</XQSelect>
				<div className="horosa-field-label sub">角化容许</div>
				<XQSelect style={{ width: '100%' }} size="small" value={extra.solunarOrb || 3}
					onChange={(v) => userSetExtra(setExtra, { solunarOrb: v })}>
					{ANGULARITY_ORBS.map((o) => (<Option key={o.key} value={o.orb}>{o.cn}</Option>))}
				</XQSelect>
				<XQButton size="small" style={{ width: '100%', marginTop: 10 }} disabled={this.state.solunarCasting}
					onClick={() => this.castSolunar(extra, setExtra, fields, setTime, patchFields)}>{this.state.solunarCasting ? '求根中…' : '排恒星入境盘'}</XQButton>
				{this.state.solunarErr ? (<div className="horosa-mundane-err">{this.state.solunarErr}</div>) : null}
				{this.state.solunarMoment ? (<div className="horosa-mundane-hint">入境时刻 {this.state.solunarMoment}（恒星黄道 Fagan/Bradley · Campanus 宫制,已写入主盘）</div>) : null}
			</div>
		);
	},

	renderVedicLeft(extra, setExtra, fields, setTime, patchFields){
		const year = extra.vedicYear != null ? extra.vedicYear : currentYear();
		return (
			<div>
				<div className="horosa-field-label sub">年份</div>
				<XQInputNumber size="small" style={{ width: '100%' }} value={year} min={1800} max={2400}
					onChange={(v) => setExtra({ vedicYear: clampYear(v, currentYear()) })} />
				<div className="horosa-field-label sub">年度盘（恒星黄道 Lahiri · 整宫）</div>
				<XQButton size="small" style={{ width: '100%' }} disabled={this.state.vedicCasting}
					onClick={() => this.castVedicIngress('ingress_0', extra, fields, setTime, patchFields)}>{this.state.vedicCasting ? '求根中…' : '排梅沙入境（年度主盘）'}</XQButton>
				<div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
					<XQButton size="small" style={{ flex: 1 }} disabled={this.state.vedicCasting} onClick={() => this.castVedicIngress('ingress_90', extra, fields, setTime, patchFields)}>夏季盘</XQButton>
					<XQButton size="small" style={{ flex: 1 }} disabled={this.state.vedicCasting} onClick={() => this.castVedicIngress('ingress_180', extra, fields, setTime, patchFields)}>秋季盘</XQButton>
					<XQButton size="small" style={{ flex: 1 }} disabled={this.state.vedicCasting} onClick={() => this.castVedicIngress('ingress_270', extra, fields, setTime, patchFields)}>冬季盘</XQButton>
				</div>
				{this.state.vedicErr ? (<div className="horosa-mundane-err">{this.state.vedicErr}</div>) : null}
				{this.state.vedicMoment ? (<div className="horosa-mundane-hint">入境时刻 {this.state.vedicMoment}（已写入主盘）</div>) : null}
				<div className="horosa-field-label sub" style={{ marginTop: 10 }}>年之九主</div>
				<XQButton size="small" style={{ width: '100%' }} disabled={this.state.nvLoading}
					onClick={() => this.computeVedicNavanayaka(extra, fields)}>{this.state.nvLoading ? '计算九主中…' : '计算年之九主'}</XQButton>
				{this.state.nvErr ? (<div className="horosa-mundane-err">{this.state.nvErr}</div>) : null}
				<div className="horosa-field-label sub" style={{ marginTop: 10 }}>返照敏感点（建国盘辅助）</div>
				<div style={{ display: 'flex', gap: 6 }}>
					<XQInputNumber size="small" style={{ flex: 1 }} placeholder="建国年" value={extra.vedicFoundingYear}
						onChange={(v) => setExtra({ vedicFoundingYear: v })} />
					<XQSelect size="small" style={{ flex: 1 }} placeholder="建国上升座" value={extra.vedicNatalAsc || undefined}
						onChange={(v) => setExtra({ vedicNatalAsc: v })}>
						{SIGN_KEYS.map((k) => (<Option key={k} value={k}>{(SIGNS[k] || {}).cn || k}</Option>))}
					</XQSelect>
				</div>
			</div>
		);
	},

	renderIngressLeft(extra, setExtra, fields, setTime, patchFields){
		const term = extra.ingressTerm || '春分';
		const year = extra.ingressYear != null ? extra.ingressYear : currentYear();
		return (
			<div>
				<div className="horosa-field-label sub">入宫节气</div>
				<XQSelect style={{ width: '100%' }} size="small" value={term}
					onChange={(v) => setExtra({ ingressTerm: v })}>
					{INGRESSES.map((it) => (<Option key={it.term} value={it.term}>{it.label}</Option>))}
				</XQSelect>
				<div className="horosa-field-label sub">年份</div>
				<XQInputNumber size="small" style={{ width: '100%' }} value={year} min={-3000} max={3000}
					onChange={(v) => setExtra({ ingressYear: clampYear(v, currentYear()) })} />
				<XQButton size="small" style={{ width: '100%', marginTop: 10 }} disabled={this.state.casting}
					onClick={() => this.castIngress(extra, setExtra, fields, setTime, patchFields)}>{this.state.casting ? '排盘中…' : '排入宫盘'}</XQButton>
				{this.state.err ? (<div className="horosa-mundane-err">{this.state.err}</div>) : null}
			</div>
		);
	},

	renderScanLeft(type, extra, setExtra, fields, setTime){
		const year = extra.scanYear != null ? extra.scanYear : currentYear();
		const isEcl = (type === 'solecl' || type === 'lunecl');
		const rows = (this.state.scanType === type) ? this.state.scanRows : null;
		const evName = type === 'newmoon' ? '新月' : (type === 'fullmoon' ? '满月' : '食相');
		return (
			<div>
				<div className="horosa-field-label sub">年份</div>
				<XQInputNumber size="small" style={{ width: '100%' }} value={year} min={-3000} max={3000}
					onChange={(v) => setExtra({ scanYear: clampYear(v, currentYear()) })} />
				<XQButton size="small" style={{ width: '100%', marginTop: 10 }} disabled={this.state.scanLoading}
					onClick={() => this.scanEvents(type, extra, fields)}>{this.state.scanLoading ? '扫描中…' : `扫描当年${evName}`}</XQButton>
				{this.state.scanErr ? (<div className="horosa-mundane-err">{this.state.scanErr}</div>) : null}
				{rows ? (
					<div className="horosa-mundane-scanlist">
						{rows.length === 0 ? (<div className="empty">该年无{evName}。</div>) : rows.map((row, i) => {
							const sg = row.sign ? SIGNS[row.sign] : null;
							const active = extra.selectedMoment === row.localTime;
							return (
								<div key={i} className={'row' + (active ? ' active' : '')} {...pressable(() => this.useMoment(row, type, setExtra, fields, setTime))}>
									<span className="t">{row.localTime}</span>
									<span className="s">
										{sg ? <span style={{ color: ELEMENT_COLOR[sg.element] }}>{sGlyph(row.sign)} {sg.cn}</span> : ''}
										{isEcl && row.eclipseType ? <em>{row.eclipseType}</em> : null}
									</span>
								</div>
							);
						})}
					</div>
				) : (<div className="horosa-mundane-hint">点「扫描」列出该年事件，再点选某条按精确时刻起盘。</div>)}
			</div>
		);
	},

	renderRegionLeft(extra, setExtra, patchFields, fields){
		const regions = allRegions();
		const keys = Object.keys(regions);
		const f = this.state.regionForm;
		const setF = (k, v) => this.setState({ regionForm: { ...this.state.regionForm, [k]: v } });
		return (
			<div>
				<div className="horosa-field-label sub">选择地区盘</div>
				<XQSelect style={{ width: '100%' }} size="small" value={extra.regionKey || undefined} placeholder="选择地区盘"
					onChange={(v) => this.applyRegion(v, setExtra, patchFields)}>
					{keys.map((k) => (<Option key={k} value={k}>{regions[k].cn}</Option>))}
				</XQSelect>
				{(() => {
					const cands = extra.regionKey ? regionCandidates(extra.regionKey) : null;
					if(!cands || cands.length < 2){ return null; }
					const curKey = this.state.regionCandKey || cands[0].key;
					const curNote = (cands.find((c) => c.key === curKey) || cands[0]).note;
					return (
						<div style={{ marginTop: 10 }}>
							<div className="horosa-field-label sub">建置时刻候选 · 多盘对比</div>
							<XQSelect style={{ width: '100%' }} size="small" value={curKey}
								onChange={(v) => { const c = cands.find((x) => x.key === v); this.applyRegion(extra.regionKey, setExtra, patchFields, c); }}>
								{cands.map((c) => (<Option key={c.key} value={c.key}>{c.label}</Option>))}
							</XQSelect>
							<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 5, lineHeight: 1.5 }}>{curNote}　该盘例史上对确切时刻有不同主张，切换对比哪个更合事件走势。</div>
						</div>
					);
				})()}
				<XQButton size="small" style={{ width: '100%', marginTop: 10 }} onClick={() => this.setState({ regionAddOpen: !this.state.regionAddOpen })}>{this.state.regionAddOpen ? '收起' : '＋ 存当前盘为地区盘'}</XQButton>
				{this.state.regionAddOpen ? (
					<div className="horosa-mundane-regionform">
						<ol className="horosa-mundane-steps">
							<li>用上方「<b>时间</b>」设定历史建置日期时刻</li>
							<li>用上方「<b>地点</b>」选取坐标(可用下方首都速填)</li>
							<li>下方命名后保存</li>
						</ol>
						<div className="horosa-field-label sub">首都速填坐标（中性地理·选填）</div>
						<XQSelect style={{ width: '100%' }} size="small" placeholder="选首都自动填坐标" allowClear
							onChange={(v) => { const c = MUNDANE_CAPITALS.find((x) => x.cn === v); if(c){ patchFields({ lon: c.lon, lat: c.lat, gpsLon: c.gpsLon, gpsLat: c.gpsLat, pos: c.cn }); if(!f.name){ setF('name', c.cn); } } }}>
							{MUNDANE_CAPITALS.map((c) => (<Option key={c.cn} value={c.cn}>{c.cn}</Option>))}
						</XQSelect>
						<Input size="small" style={{ marginTop: 8 }} placeholder="地区 / 事件名称" value={f.name} onChange={(e) => setF('name', e.target.value)} onPressEnter={() => this.addRegion(setExtra, patchFields, fields)} />
						<XQButton size="small" style={{ width: '100%' }} onClick={() => this.addRegion(setExtra, patchFields, fields)}>保存当前盘为地区盘</XQButton>
						{this.state.scanErr ? (<div className="horosa-mundane-err">{this.state.scanErr}</div>) : null}
					</div>
				) : null}
			</div>
		);
	},
};
