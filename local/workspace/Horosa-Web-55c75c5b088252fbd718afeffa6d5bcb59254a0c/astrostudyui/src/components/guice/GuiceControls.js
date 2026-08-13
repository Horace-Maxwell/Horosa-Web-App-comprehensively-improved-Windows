// 皇极轨策 · 左栏 —— 起卦法之专属输入（按 schoolNeeds 显隐）+ 流派预设 + 十开关 + 十应之录。
//
// 🔴 死控件一律隐藏、不留「勾了不生效」之惑（schoolNeeds 声明式）。
import React, { Component } from 'react';
import { Input, InputNumber, Select, Collapse, Button, Checkbox } from 'antd';
import { XQSideSection } from '../xq-ui';
import {
	GUICE_OPTION_META, GUICE_SCHOOL_OPTIONS, applyPreset, setOption, schoolNeeds, qiguaFaInputs,
} from './guiceSchools';
import { QI_GUA_FA, WEIREN_QU, JING_WU_BU_KE } from './core/guiceQiGua';
import { SHIYING_SETS } from './core/guiceConst';
import { FANG_WEI } from './core/guiceShiFang';

const { Option } = Select;
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GUA8 = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

class GuiceControls extends Component {
	set(key, value) {
		const next = setOption(this.props.settings, key, value);
		if (this.props.onSettings) this.props.onSettings(next);
	}

	setInput(key, value) {
		if (this.props.onInput) this.props.onInput({ ...(this.props.inputs || {}), [key]: value });
	}

	/**
	 * 一项设置。
	 * 🔴 opts.row=true 走横排两端对齐（照仓内既有之 heluo-switch-field）——
	 *    开关须用之：select-field 本为下拉而设、是 column 向，Switch 塞进去会被拉成一条全宽的杠。
	 */
	field(label, node, hint, opts) {
		const row = opts && opts.row;
		return (
			<label className={`horosa-huangji-select-field${row ? ' horosa-heluo-switch-field' : ' is-wide'}`} key={label}>
				<span>{label}</span>
				{node}
				{hint ? <em className="horosa-guice-hint">{hint}</em> : null}
			</label>
		);
	}

	/** 一组设置 —— 分组成卡(左栏统一:XQSideSection 可折叠,图标按组语义,storageKey 持久化) */
	group(title, children) {
		const kids = (Array.isArray(children) ? children : [children]).filter(Boolean);
		if (!kids.length) return null;
		const icon = { '起卦': 'target', '流派': 'sliders', '演算': 'quickNote' }[title] || 'sliders';
		return (
			<XQSideSection key={title} iconName={icon} title={title} storageKey={`guice.${title}`}
				className="horosa-huangji-input-section horosa-guice-group">
				{kids}
			</XQSideSection>
		);
	}

	/** 起卦法之专属输入 —— 切法只显该法所需 */
	renderQiGuaInputs() {
		const s = this.props.settings;
		const inp = this.props.inputs || {};
		const need = qiguaFaInputs(s.qiguaFa);
		const out = [];
		if (need.indexOf('nums') >= 0) {
			out.push(this.field('所报之数（一数或两数，逗号分）',
				<Input value={inp.numsText || ''} placeholder="如 35　或　3,2"
					onChange={(e) => this.setInput('numsText', e.target.value)} />,
				'报一数：其数为上卦、时数为下卦；报二数：先数为上、后数为下'));
		}
		if (need.indexOf('wuShu') >= 0) {
			out.push(this.field('物数', <InputNumber min={1} max={9999} value={inp.wuShu} onChange={(v) => this.setInput('wuShu', v)} />));
		}
		if (need.indexOf('shengShu') >= 0) {
			out.push(this.field('声数', <InputNumber min={1} max={9999} value={inp.shengShu} onChange={(v) => this.setInput('shengShu', v)} />));
		}
		if (need.indexOf('text') >= 0) {
			out.push(this.field('所占之字',
				<Input value={inp.text || ''} placeholder="一字至百字" onChange={(e) => this.setInput('text', e.target.value)} />,
				'一字：太极未判（草书不可得卦，楷书取字画）；四至十字：以平仄声调；十一字以上：止用字数'));
			out.push(this.field('书体',
				<Select value={inp.shu || 'kai'} onChange={(v) => this.setInput('shu', v)}>
					<Option value="kai">楷书</Option><Option value="cao">草书（一字则不可得卦）</Option>
				</Select>));
			const n = `${inp.text || ''}`.replace(/\s/g, '').length;
			if (n === 1 && (inp.shu || 'kai') === 'kai') {
				out.push(this.field('左之阳画', <InputNumber min={1} max={99} value={(inp.tones || {}).leftStrokes} onChange={(v) => this.setInput('tones', { ...(inp.tones || {}), leftStrokes: v })} />, '彳、丿之属为左'));
				out.push(this.field('右之阴画', <InputNumber min={1} max={99} value={(inp.tones || {}).rightStrokes} onChange={(v) => this.setInput('tones', { ...(inp.tones || {}), rightStrokes: v })} />, '一、乙、丶之属为右'));
			} else if (n >= 4 && n <= 10) {
				out.push(this.field(`平仄声调（${n} 字，逗号分）`,
					<Input value={inp.tonesText || ''} placeholder="如 平,去,平,上"
						onChange={(e) => this.setInput('tonesText', e.target.value)} />,
					'平1 上2 去3 入4 —— 四字以上不数画数'));
			}
		}
		if (need.indexOf('zhang') >= 0) {
			out.push(this.field('丈数', <InputNumber min={1} max={999} value={inp.zhang} onChange={(v) => this.setInput('zhang', v)} />));
			out.push(this.field('尺数', <InputNumber min={1} max={999} value={inp.chi} onChange={(v) => this.setInput('chi', v)} />, '本法不加时；寸数不用'));
		} else if (need.indexOf('chi') >= 0) {
			out.push(this.field('尺数', <InputNumber min={1} max={999} value={inp.chi} onChange={(v) => this.setInput('chi', v)} />));
			out.push(this.field('寸数', <InputNumber min={1} max={999} value={inp.cun} onChange={(v) => this.setInput('cun', v)} />, '本法加时；分数不用'));
		}
		if (need.indexOf('wuGuaNum') >= 0) {
			out.push(this.field('物之卦',
				<Select value={inp.wuGuaNum} onChange={(v) => this.setInput('wuGuaNum', v)} placeholder="择物象所属之卦">
					{GUA8.map((g, i) => <Option key={g} value={i + 1}>{`${g}（${i + 1}）`}</Option>)}
				</Select>));
			out.push(this.field('所来之方位',
				<Select value={inp.fangGuaNum} onChange={(v) => this.setInput('fangGuaNum', v)} placeholder="择方位所属之卦">
					{GUA8.map((g, i) => <Option key={g} value={i + 1}>{`${g}（${i + 1}）`}</Option>)}
				</Select>));
		}
		if (need.indexOf('kind') >= 0) {
			out.push(this.field('静物之属',
				<Select value={inp.kind || '屋宅初创'} onChange={(v) => this.setInput('kind', v)}>
					{['屋宅初创', '树木初置', '器置成'].map((k) => <Option key={k} value={k}>{k}</Option>)}
					{JING_WU_BU_KE.map((k) => <Option key={k} value={k}>{`${k}（不可起卦）`}</Option>)}
				</Select>,
				'「群物之动」「江河山石」无初创之时可稽 → 本法不可起卦'));
		}
		if (need.indexOf('qu') >= 0) {
			out.push(this.field('所取之端',
				<Select value={inp.qu || 'yusheng'} onChange={(v) => this.setInput('qu', v)}>
					{WEIREN_QU.map((q) => <Option key={q.key} value={q.key}>{q.label}</Option>)}
				</Select>, '语多则只用初听一句或末后一句'));
			out.push(this.field('其数', <InputNumber min={1} max={9999} value={inp.shu2} onChange={(v) => this.setInput('shu2', v)} />));
		}
		return out;
	}

	/** 十开关 —— needs 控显隐、disabled 出其由 */
	renderOptions() {
		const s = this.props.settings;
		const need = schoolNeeds(s);
		const entries = GUICE_OPTION_META.map((m) => {
			if (m.needs) {
				const k = Object.keys(m.needs)[0];
				if (!need[k]) return null;   // 死控件隐藏
			}
			// [P3 压测实爆] 神煞附于时方(guicePan 只在 shiFang 开时携带 shenSha)——时方关则单开
			// 神煞全无可视效果=「勾了没反应」。诚实呈现:禁用+说明,开「参时方」即随之生效。
			const dis = (m.key === 'shenSha' && !s.shiFang)
				? '神煞附于时方而行(古籍同体),先开「参时方」即随之生效'
				: (need.disabled && need.disabled[m.key]);
			if (m.type === 'switch') {
				return { isSwitch: true, chip: (
					<Checkbox key={m.key} checked={!!s[m.key]} disabled={!!dis}
						title={typeof dis === 'string' && dis ? dis : m.label}
						onChange={(e) => this.set(m.key, e.target.checked)}>{m.label}</Checkbox>
				) };
			}
			return { isSwitch: false, node: this.field(m.label,
				<Select value={s[m.key]} disabled={!!dis} dropdownMatchSelectWidth={false} onChange={(v) => this.set(m.key, v)}>
					{m.options.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
				</Select>, dis || '') };
		}).filter(Boolean);
		// 一行两个(用户三轮定案):下拉全数集中一张两列网格(十应名目等后位下拉上移补空隙,
		// 杜绝半宽孤行);开关(神煞/时方)改双列描金芯片(house 风格同六爻/塔罗显示项),
		// 注解不再占正文 —— 禁用缘由挪进芯片 title 提示。
		const selects = entries.filter((e) => !e.isSwitch).map((e) => e.node);
		const switches = entries.filter((e) => e.isSwitch);
		const out = [];
		if (selects.length) {
			out.push(<div className="horosa-huangji-select-grid horosa-guice-pair-grid" key="pair-selects">{selects}</div>);
		}
		if (switches.length) {
			out.push(
				<div className="horosa-guazhan-toggle-grid horosa-guice-toggle-grid" key="pair-switches">
					{switches.map((e) => e.chip)}
				</div>
			);
		}
		return out;
	}

	/** 时方之输入 —— 方应须知「来占之人所坐立之方位」，非机可代 */
	renderShiFangInput() {
		const s = this.props.settings;
		if (!s.shiFang || s.shuXi === 'meihua') return null;   // 梅花不用时方 → 并此输入亦不出
		const inp = this.props.inputs || {};
		return this.field('占者所坐立之方',
			<Select value={inp.fangKey} allowClear placeholder="未录则方应标缺，不臆断"
				onChange={(v) => this.setInput('fangKey', v)}>
				{FANG_WEI.map((f) => <Option key={f.key} value={f.key}>{`${f.label}（${f.gua}）`}</Option>)}
			</Select>,
			'古籍：以体为主，看来占之人在何方位；生体或比和则吉，克体则凶，体生之亦不吉');
	}

	/** 十应之录（按所选之套换名目；正应/互应/变应由卦自出，不列于此） */
	renderShiYing() {
		const s = this.props.settings;
		const inp = (this.props.shiyingInputs || {});
		const S = SHIYING_SETS[s.shiyingSet] || SHIYING_SETS.xinyifawei;
		const manual = S.items.filter((i) => !i.auto);
		// 🔴 默认收起（不给 defaultActiveKey）：十应是选填，且多至七项输入 ——
		//    展开则把「起卦」这个主操作顶出首屏之外（实测其时落在 1554px，而左栏可视仅 1068px）。
		return (
			<Collapse ghost className="horosa-guice-shiying">
				<Collapse.Panel header={`三要十应 · ${S.label}（${manual.length} 项须录）`} key="1">
					{S.note ? <div className="horosa-cetian-settings-hint">{S.note}</div> : null}
					{manual.map((i) => (
						<label className="horosa-huangji-select-field is-wide" key={i.key}>
							<span>{i.label}</span>
							<Input value={inp[i.key] || ''} placeholder="据所见所闻而录"
								onChange={(e) => { if (this.props.onShiYing) this.props.onShiYing({ ...inp, [i.key]: e.target.value }); }} />
						</label>
					))}
					<div className="horosa-cetian-settings-hint">
						正应／互应／变应由卦自出，不须录。未录者显式标缺 —— 此古籍重人之审量，机不能代。
					</div>
				</Collapse.Panel>
			</Collapse>
		);
	}

	render() {
		const s = this.props.settings;
		return (
			<>
				{this.group('起卦', [
					this.field('起卦法',
						<Select value={s.qiguaFa} dropdownMatchSelectWidth={false} onChange={(v) => this.set('qiguaFa', v)}>
							{QI_GUA_FA.map((f) => <Option key={f.key} value={f.key}>{f.label}</Option>)}
						</Select>,
						// 加时非可选 —— 由法自定，故此处照实说，不做成开关（做了也不生效 = 死控件）
						schoolNeeds(s).addHour ? '本法加时' : '本法不加时（丈尺占：寸数亦不用）'),
					...this.renderQiGuaInputs(),
					this.field('占事',
						<Input.TextArea rows={2} value={(this.props.inputs || {}).askEvent || ''}
							placeholder="所占何事" onChange={(e) => this.setInput('askEvent', e.target.value)} />),
				])}
				{this.group('流派', [
					this.field('流派预设',
						<Select value={s.school} dropdownMatchSelectWidth={false}
							onChange={(v) => { if (this.props.onSettings) this.props.onSettings(applyPreset(v)); }}>
							{GUICE_SCHOOL_OPTIONS.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
							{s.school === 'custom' ? <Option value="custom">自定义</Option> : null}
						</Select>),
				])}
				{this.group('演算', [
					...this.renderOptions(),
					this.renderShiFangInput(),
				])}
				{/* [左栏精简] 三要十应手录面板移除(用户指示清理):七项选填输入把吸底「起卦」顶出/致其浮遮
				    滚动内容。正应/互应/变应仍由卦自出、于中右栏照显;renderShiYing() 方法保留待恢复。 */}
				<Button className="horosa-guice-qigua-btn" type="primary" block size="large"
					onClick={() => { if (this.props.onQiGua) this.props.onQiGua(); }}>起卦</Button>
				{/* 「分歧做成可切换、未载之格显式标缺」的处置原则详见帮助文档「卜·其他 · 象数推演 · 皇极轨策」
				    ——「左边栏永不放大段解释」铁律。 */}
			</>
		);
	}
}

export default GuiceControls;
export { ZHI, GUA8 };
