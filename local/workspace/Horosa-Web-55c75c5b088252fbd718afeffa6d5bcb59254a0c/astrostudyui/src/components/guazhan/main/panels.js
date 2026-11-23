// 六爻页 · 左栏输入、断卦设置、神煞弹窗、右栏信息与底部快捷栏的渲染
// 从 GuaZhanMain.js 按职责拆出的 GuaZhanMain 方法:this 仍是 GuaZhanMain 实例,门面里 mixinMethods(GuaZhanMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { sideSectionIcon } from '../../../constants/sideSectionIcons';
import { Modal } from 'antd';
import { XQButton as Button, XQInputNumber as InputNumber, XQSelect as Select, XQTabs as Tabs, XQSideSection, XQModal, XQCheckbox } from '../../xq-ui';
import QuickDockBar from '../../common/QuickDockBar';
import GuaZhanInput from '../GuaZhanInput';
import GuaDesc from '../GuaDesc';
import { Gua64, Gua8, ZiList } from '../../gua/GuaConst';
import { normalizeLiuyaoSettings, factoryLiuyaoSettings, LIUYAO_SCHOOL_OPTIONS, LIUYAO_PRESETS } from '../../gua/liuyaoSchools';
import { SHENSHA_EX, yueLingNames } from '../../gua/liuyaoShenShaEx';
import LiuYaoDuanJueView from '../LiuYaoDuanJueView';
import LiuYaoZhanLeiView from '../LiuYaoZhanLeiView';
import LiuYaoCastPad from '../LiuYaoCastPad';
import { YONGSHEN_CATEGORIES } from '../../gua/liuyaoYongShen';
import { SHENSHA_META, DEFAULT_SHENSHA_SET } from '../../gua/liuyaoShenSha';
import { LiuYaoZhuangTable, LiuYaoYongShenView, LiuYaoDongBianView, LiuYaoRelatedCards, LiuYaoShenShaView, LiuYaoReference, LiuYaoXunKong, LiuYaoManualCards, LiuYaoRiYueView, LiuYaoShenShaExView, LiuYaoYueLiuShenView, LiuYaoTianshiView } from '../LiuYaoBoard';
import { visualFloorPx } from '../../../utils/zoomDomain';
import { pressable } from '../../../utils/pressable';
import { guaText } from './gua';
import { yearGzByBoundary } from './snapshot';
import { FreezeSubTab } from '../../comp/FreezeInactive';
const {Option} = Select;
const { TabPane } = Tabs;

export const panelMethods = {
	genGua64OptDom(){
		let doms = Gua64.map((item, idx)=>{
			let txt = item.name+'-'+item.house.name+'宫'+item.house.elem;
			return (
				<Option value={idx} key={idx} rec={item}>{txt}</Option>
			);
		});

		return doms;
	},

	genGua8Doms(){
		let doms = Gua8.map((item, idx)=>{
			return (
				<Option key={idx} value={idx}>{item.name+item.elem}</Option>
			);
		});
		return doms;
	},

	renderInputPanel(opts, upopts, downopts, dyvalues){
		return (
			<div className="horosa-guazhan-input-stack">
				<div>
					<div className="horosa-side-panel-title">六爻设置</div>
					<div className="horosa-side-panel-subtitle">时间、地点与起卦方式</div>
				</div>

				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<div className="horosa-guazhan-time-control">
						<GuaZhanInput
							fields={this.props.fields}
							hook={this.timeHook}
							onFieldsChange={this.onFieldsChange}
						/>
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="卦象与动爻" storageKey="guazhan.s1" className="horosa-guazhan-input-section">
					<Select
						allowClear={true}
						showSearch={true}
						showArrow={true}
						placeholder='64卦'
						filterOption={this.filterGua}
						value={this.state.currentGua}
						onChange={this.changeGua}
					>
						{opts}
					</Select>
					<XQCheckbox.Group className="horosa-guazhan-yao-checks" onChange={this.dongyaoChanged} value={dyvalues} disabled={this.isFlipping()}>
						<XQCheckbox value={0}>初爻动</XQCheckbox>
						<XQCheckbox value={1}>二爻动</XQCheckbox>
						<XQCheckbox value={2}>三爻动</XQCheckbox>
						<XQCheckbox value={3}>四爻动</XQCheckbox>
						<XQCheckbox value={4}>五爻动</XQCheckbox>
						<XQCheckbox value={5}>上爻动</XQCheckbox>
					</XQCheckbox.Group>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="快捷起卦" storageKey="guazhan.s2" className="horosa-guazhan-input-section">
					<div className="horosa-guazhan-action-grid">
						<Button onClick={()=>{this.clickTimeGua()}}>时间起卦</Button>
						<Button onClick={this.genGua}>{this.state.btnGenGua}</Button>
						<Button onClick={this.clickYarrowGua}>蓍草起卦</Button>
						{this.state.btnName.map((name, idx)=>(
							<Button key={idx} disabled={this.state.btnDisabled[idx]} onClick={()=>{this.genYao(idx);}}>{name}</Button>
						))}
					</div>
				</XQSideSection>

				<XQSideSection iconName={sideSectionIcon('switches')} title="自定义起卦" storageKey="guazhan.s4" className="horosa-guazhan-input-section">
					<div className="horosa-guazhan-select-grid">
						<label className="horosa-guazhan-select-field">
							<span>上卦</span>
							<Select dropdownMatchSelectWidth={false} allowClear={true} value={this.state.upGuaIdx} onChange={this.upGuaIdxChanged}>
								{upopts}
							</Select>
						</label>
						<label className="horosa-guazhan-select-field">
							<span>下卦</span>
							<Select dropdownMatchSelectWidth={false} allowClear={true} value={this.state.downGuaIdx} onChange={this.downGuaIdxChanged}>
								{downopts}
							</Select>
						</label>
					</div>
					<Select dropdownMatchSelectWidth={false} onChange={this.custGuaDongYaoChanged} value={this.state.custGuaDongYao}>
						<Option value={-3}>先天卦数直接决定动爻</Option>
						<Option value={-2}>附加一个随机数决定动爻</Option>
						<Option value={-1}>附加时辰决定动爻</Option>
						<Option value={0}>第一动爻</Option>
						<Option value={1}>第二动爻</Option>
						<Option value={2}>第三动爻</Option>
						<Option value={3}>第四动爻</Option>
						<Option value={4}>第五动爻</Option>
						<Option value={5}>第六动爻</Option>
					</Select>
					<Button onClick={this.clickCustGua}>自定义起卦</Button>
				</XQSideSection>

				<LiuYaoCastPad coinFace={normalizeLiuyaoSettings(this.state.liuyaoSettings).coinFace} defaultYaoState={normalizeLiuyaoSettings(this.state.liuyaoSettings).defaultYaoState} key={normalizeLiuyaoSettings(this.state.liuyaoSettings).defaultYaoState} onCast={this.onManualCast}
					numGuaSlot={(<>
						<div className="horosa-guazhan-inline-row">
							<InputNumber value={this.state.number} onChange={this.numberChanged} min={0} />
							<Button onClick={this.clickNumGua}>数字起卦</Button>
						</div>
						<Select dropdownMatchSelectWidth={false} onChange={this.numGuaDongYaoChanged} value={this.state.numGuaDongYao}>
							<Option value={-3}>数字直接决定动爻</Option>
							<Option value={-2}>附加一个随机数决定动爻</Option>
							<Option value={-1}>附加时辰决定动爻</Option>
							<Option value={0}>第一动爻</Option>
							<Option value={1}>第二动爻</Option>
							<Option value={2}>第三动爻</Option>
							<Option value={3}>第四动爻</Option>
							<Option value={4}>第五动爻</Option>
							<Option value={5}>第六动爻</Option>
						</Select>
					</>)}
				/>
				{this.renderLiuyaoSettings()}

				<div className="horosa-guazhan-action-row">
					<Button onClick={this.clickSaveCase}>保存</Button>
				</div>
			</div>
		);
	},

	renderLiuyaoSettings(){
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		const schoolVal = s.school;
		const schoolOpts = LIUYAO_SCHOOL_OPTIONS.slice();
		if(schoolVal === 'custom'){ schoolOpts.push({ value: 'custom', label: '自定义' }); }
		// 不单列的流派(如旧事盘的「卜筮正宗」,与通用逐项相同)被选中时补一项显示名,下拉不露内部键名。
		if(schoolVal && schoolVal !== 'custom' && !schoolOpts.some((o)=>o.value === schoolVal) && LIUYAO_PRESETS[schoolVal]){
			schoolOpts.push({ value: schoolVal, label: LIUYAO_PRESETS[schoolVal].label });
		}
		const sel = (label, key, opts, extra) => (
			<label className="horosa-guazhan-select-field" key={key} title={extra && extra.title ? extra.title : undefined}>
				<span>{label}</span>
				<Select dropdownMatchSelectWidth={false} value={s[key]} onChange={(v)=>this.changeLiuyaoOption(key, v)} disabled={!!(extra && extra.disabled)}>
					{opts.map((o)=>(<Option key={String(o.v)} value={o.v}>{o.l}</Option>))}
				</Select>
			</label>
		);
		// 条件依赖无载体即置灰(照本页「进退神土路」既有先例:disabled + title 说明):
		// ·长生用法 / 生旺墓阴阳 —— 土长生选「不标长生」时 changshengOf 对一切五行恒返空,长生列与开局卡生旺墓整体不出;
		// ·之卦简显 / 关联卦「之卦」 —— 之卦卡在「无动爻」或「变卦装法=仅装变爻」时本就不渲染。
		const _csOff = s.tuChangsheng === 'off';
		const _csOffHint = '土长生选「不标长生」时十二长生对一切五行都不标,本项无可作用对象,故置灰。';
		const _hasMovingYao = Array.isArray(this.state.yao) && this.state.yao.some((y)=>y && y.change);
		const _bianCardOff = !_hasMovingYao || s.biangua === 'movingOnly';
		const _bianCardHint = !_hasMovingYao ? '本卦无动爻,不成之卦,本项无可作用对象。' : '「变卦装法」选「仅装变爻」时不渲染之卦卡,本项无可作用对象。';
		// [L·断卦设置重排] 三分组:①流派与用神 ②显示项(九勾选,神煞归入独立弹窗按钮)③流派取法(细则下拉)。
		const shenshaOn = !!(s.shensha && s.shensha.on);
		const shenshaExOn = !!(s.shenshaEx && s.shenshaEx.on);
		const shenshaCnt = shenshaOn ? (s.shensha.set || []).length : 0;
		return (
			<>
			<XQSideSection iconName={sideSectionIcon('school')} title="断卦设置(流派)" storageKey="guazhan.s5" className="horosa-guazhan-input-section">
				<div className="horosa-guazhan-set-group">
					<div className="horosa-guazhan-set-subhead">流派取法</div>
					<div className="horosa-guazhan-select-grid">
						<label className="horosa-guazhan-select-field">
							<span>流派</span>
							<Select dropdownMatchSelectWidth={false} value={schoolVal} onChange={(v)=>this.changeLiuyaoPreset(v === 'custom' ? s.school : v)}>
								{schoolOpts.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-guazhan-select-field">
							<span>占测事项</span>
							<Select dropdownMatchSelectWidth={false} value={s.askType} onChange={(v)=>this.changeLiuyaoOption('askType', v)} showSearch optionFilterProp="children">
								{YONGSHEN_CATEGORIES.map((c)=>(<Option key={c.key} value={c.key}>{c.label}</Option>))}
							</Select>
						</label>
						<label className="horosa-guazhan-select-field">
							<span>用神(手选)</span>
							<Select dropdownMatchSelectWidth={false} value={s.yongOverride || ''} onChange={(v)=>this.changeLiuyaoOption('yongOverride', v)}>
								<Option value="">自动(跟占测事项)</Option>
								{['父母', '兄弟', '子孙', '妻财', '官鬼', '世', '应'].map((k)=>(<Option key={k} value={k}>{k}</Option>))}
							</Select>
						</label>
						{sel('土长生', 'tuChangsheng', [{ v: 'water', l: '水土同宫' }, { v: 'fire', l: '火土同宫' }, { v: 'off', l: '不标长生' }])}
						{sel('变爻范围', 'bianyaoScope', [{ v: 'traditional', l: '传统(回头本位)' }, { v: 'blind', l: '盲派(作用他爻)' }])}
						{sel('飞伏', 'fushen', [{ v: 'missing', l: '仅缺用神取' }, { v: 'all', l: '逐爻全标' }])}
						{sel('月破', 'yuepoMode', [{ v: 'inMonth', l: '当月有效' }, { v: 'always', l: '不论出月' }])}
						{sel('世身', 'shishen', [{ v: 'off', l: '不用' }, { v: 'standard', l: '子午持世身居初' }, { v: 'lichunfeng', l: '亥子持世身居初' }])}
						{sel('贵人歌诀', 'guirenFa', [{ v: 'standard', l: '甲戊庚牛羊(庚丑未)' }, { v: 'geng_ma_hu', l: '庚辛逢马虎(庚寅午)' }])}
						{/* 结构性空载置灰:64 卦×全部动爻组合(含多爻齐动)枚举,纳甲动变不存在
						    戌↔丑 本变对 → 两口径输出恒同(金标 liuyaoOptionMatrixAudit 锁事实;若未来体系引入该
						    载荷,金标红了再解除置灰)。照 PlanetSelector/八字流派标记「置灰+说明」先例。 */}
						{sel('进退神土路', 'jinTuiTu', [{ v: 'chain', l: '丑辰未戌连环' }, { v: 'break', l: '戌丑断开' }],
							{ disabled: true, title: '考据声明项:纳甲动变结构中不存在戌↔丑的本变对,两口径在一切实卦中输出恒同,故置灰。详见帮助。' })}
						{sel('长生用法', 'changshengUse', [{ v: 'full12', l: '十二宫全用' }, { v: 'four', l: '只取生旺墓绝' }], { disabled: _csOff, title: _csOff ? _csOffHint : undefined })}
						{sel('天时占法', 'tianshiSchool', [{ v: 'fumu', l: '通行(父母雨子孙晴)' }, { v: 'ancient', l: '古法多套(五家分列)' }])}
						{sel('生旺墓阴阳', 'changshengYinYang', [{ v: 'ziping', l: '分阴阳' }, { v: 'classic', l: '古法不分' }], { disabled: _csOff, title: _csOff ? _csOffHint : undefined })}
						{sel('字背口径', 'coinFace', [{ v: 'standard', l: '背为阳(火珠林系)' }, { v: 'alt', l: '字为阳(卜筮正宗系)' }])}
						{sel('随机概率源', 'randomAlgo', [{ v: 'coins', l: '三钱(动爻各1/8)' }, { v: 'yarrow', l: '大衍蓍草(3/16·1/16)' }])}
						{sel('录入默认爻', 'defaultYaoState', [{ v: 'shaoyang', l: '少阳' }, { v: 'shaoyin', l: '少阴' }])}
						{sel('变卦装法', 'biangua', [{ v: 'movingOnly', l: '仅装变爻' }, { v: 'full', l: '全装变卦' }])}
						{sel('定年界线', 'yearBoundary', [{ v: 'lichun', l: '立春换岁' }, { v: 'lunar', l: '正月初一' }])}
						{sel('书写方向', 'writeDir', [{ v: 'bottomUp', l: '上爻在上' }, { v: 'topDown', l: '初爻在上' }])}
						{sel('盘顶信息对齐', 'titleAlign', [{ v: 'center', l: '居中' }, { v: 'right', l: '靠右' }])}
						{sel('本命(年支)', 'benming', [{ v: '', l: '不用' }].concat(ZiList.map((z)=>({ v: z, l: z }))))}
					</div>
				</div>

				<div className="horosa-guazhan-set-group">
					<div className="horosa-guazhan-set-subhead">显示项</div>
					<div className="horosa-guazhan-toggle-grid">
						<XQCheckbox checked={s.guashen} onChange={(e)=>this.changeLiuyaoOption('guashen', e.target.checked)}>卦身</XQCheckbox>
						<XQCheckbox checked={s.sixGods} onChange={(e)=>this.changeLiuyaoOption('sixGods', e.target.checked)}>六神</XQCheckbox>
						<XQCheckbox checked={s.yuqi} onChange={(e)=>this.changeLiuyaoOption('yuqi', e.target.checked)}>余气</XQCheckbox>
						<XQCheckbox checked={s.doctrine} onChange={(e)=>this.changeLiuyaoOption('doctrine', e.target.checked)}>断诀</XQCheckbox>
						<XQCheckbox checked={s.yingqi} onChange={(e)=>this.changeLiuyaoOption('yingqi', e.target.checked)}>应期</XQCheckbox>
					</div>
					<div className="horosa-guazhan-toggle-grid horosa-guazhan-toggle-grid-2">
						<XQCheckbox checked={s.yueLiushen} onChange={(e)=>this.changeLiuyaoOption('yueLiushen', e.target.checked)}>月建六神</XQCheckbox>
						<XQCheckbox checked={s.gufa} onChange={(e)=>this.changeLiuyaoOption('gufa', e.target.checked)}>古法进阶</XQCheckbox>
						<XQCheckbox checked={s.randomConfirm} onChange={(e)=>this.changeLiuyaoOption('randomConfirm', e.target.checked)}>随机前确认</XQCheckbox>
						<XQCheckbox checked={s.wangShuaiCol !== false} onChange={(e)=>this.changeLiuyaoOption('wangShuaiCol', e.target.checked)}>旺衰列</XQCheckbox>
						<XQCheckbox checked={s.showTips !== false} onChange={(e)=>this.changeLiuyaoOption('showTips', e.target.checked)}>悬停提示</XQCheckbox>
						<XQCheckbox checked={s.bianguaSimplify} disabled={_bianCardOff} title={_bianCardOff ? _bianCardHint : undefined} onChange={(e)=>this.changeLiuyaoOption('bianguaSimplify', e.target.checked)}>之卦简显</XQCheckbox>
						<XQCheckbox checked={s.yaoHotkeys} onChange={(e)=>this.changeLiuyaoOption('yaoHotkeys', e.target.checked)}>改爻快捷键(1-6)</XQCheckbox>
					</div>
					<div className="horosa-guazhan-set-subhead" style={{ marginTop: 8 }}>关联卦显示</div>
					<div className="horosa-guazhan-toggle-grid">
						{[['bian', '之卦'], ['hu', '互卦'], ['fu', '伏神'], ['zong', '综卦'], ['cuo', '错卦']].map(([k, l])=>{
							const selArr = Array.isArray(s.relatedCards) ? s.relatedCards : null;
							const on = !selArr || selArr.indexOf(k) >= 0;
							return (
								<XQCheckbox key={k} checked={on} disabled={k === 'bian' && _bianCardOff} title={(k === 'bian' && _bianCardOff) ? _bianCardHint : undefined}
									onChange={(e)=>this.changeLiuyaoRelatedCard(k, e.target.checked)}>{l}</XQCheckbox>
							);
						})}
					</div>
					<div className="horosa-guazhan-shensha-entry">
						<Button size="small" className="horosa-guazhan-shensha-btn" onClick={()=>this.setState({ shenshaModalOpen: true })}>
							<i className="xq-icon">✦</i> 神煞选项…
						</Button>
						<span className="horosa-guazhan-shensha-summary">
							{shenshaOn ? `基础神煞 · 已选 ${shenshaCnt}` : '基础神煞 · 关'}
							<em>／</em>
							{shenshaExOn ? '扩展 · 开' : '扩展 · 关'}
						</span>
					</div>
				</div>

				{LIUYAO_PRESETS[schoolVal] && LIUYAO_PRESETS[schoolVal].note ? (
					<div className="horosa-guazhan-set-note">{LIUYAO_PRESETS[schoolVal].note}</div>
				) : null}
				{/* 一键恢复出厂断卦设置:全部键回出厂默认(不经切派的「保留输入 / 体验键」规则),流派回「通用」并持久化 */}
				<div style={{ marginTop: 8 }}>
					<Button size="small" onClick={()=>{
						Modal.confirm({
							title: '恢复默认断卦设置?',
							content: '全部断卦设置将重置为出厂默认:流派、取法、神煞、显示与起卦习惯,连同占测事项、用神手选、本命年支一并清回。当前卦象不变。',
							okText: '恢复默认', cancelText: '取消',
							onOk: ()=>{ this.setLiuyaoSettingsByUser(()=>factoryLiuyaoSettings()); },
						});
					}}>恢复默认设置</Button>
				</div>
			</XQSideSection>
			{this.renderShenshaModal()}
			</>
		);
	},

	// [L·神煞独立弹窗] 基础神煞(SHENSHA_META)+ 扩展神煞(SHENSHA_EX∪月令) 全部集中于一个弹窗;每组配 全选/清空/恢复默认。
	renderShenshaModal(){
		if(!this.state.shenshaModalOpen){ return null; }
		const s = normalizeLiuyaoSettings(this.state.liuyaoSettings);
		const exAll = Array.from(new Set(SHENSHA_EX.map((m)=>m.name).concat(yueLingNames()))); // 起例集与月令表同名四例去重
		const baseAll = SHENSHA_META.map((m)=>m.name);
		const baseOn = !!(s.shensha && s.shensha.on);
		const exOn = !!(s.shenshaEx && s.shenshaEx.on);
		// 全选 / 清空 / 恢复默认是绝对值(不随盘面那一组),照旧整组设置;逐项勾选走增量(changeLiuyaoSelection)
		const setBase = (set)=>this.changeLiuyaoOption('shensha', { set });
		const setEx = (set)=>this.changeLiuyaoOption('shenshaEx', { set });
		const tool = (fn, label, disabled)=>(
			<span className={`horosa-guazhan-shensha-tool${disabled ? ' is-disabled' : ''}`}
				{...pressable(disabled ? undefined : fn)}>{label}</span>
		);
		return (
			<XQModal visible title="神煞选项" width={640} footer={null} className="horosa-guazhan-shensha-modal"
				bodyStyle={{ maxHeight: 'calc(68 * var(--horosa-lvh, 1vh))', overflowY: 'auto' }}
				onCancel={()=>this.setState({ shenshaModalOpen: false })}>
				<div className="horosa-guazhan-shensha-block">
					<div className="horosa-guazhan-shensha-head">
						<XQCheckbox checked={baseOn} onChange={(e)=>this.changeLiuyaoOption('shensha', { on: e.target.checked })}><strong>基础神煞</strong></XQCheckbox>
						<span className="horosa-guazhan-shensha-tools">
							{tool(()=>setBase(baseAll.slice()), '全选', !baseOn)}
							{tool(()=>setBase([]), '清空', !baseOn)}
							{tool(()=>setBase(DEFAULT_SHENSHA_SET.slice()), '恢复默认', !baseOn)}
						</span>
					</div>
					<XQCheckbox.Group value={s.shensha.set} disabled={!baseOn}
						options={SHENSHA_META.map((m)=>({ label: m.name, value: m.name }))}
						onChange={(set)=>this.changeLiuyaoSelection('shensha', s.shensha.set, set, baseAll)} className="horosa-guazhan-yao-checks" />
					<label className="horosa-guazhan-select-field horosa-guazhan-shensha-base">
						<span>神煞起例</span>
						<Select dropdownMatchSelectWidth={false} disabled={!baseOn} value={s.shensha.base} onChange={(v)=>this.changeLiuyaoOption('shensha', { base: v })}>
							<Option value="day">以日干支起</Option>
							<Option value="year">以年干支起</Option>
						</Select>
					</label>
				</div>
				<div className="horosa-guazhan-shensha-block">
					<div className="horosa-guazhan-shensha-head">
						<XQCheckbox checked={exOn} onChange={(e)=>this.changeLiuyaoOption('shenshaEx', { on: e.target.checked })}><strong>扩展神煞</strong></XQCheckbox>
						<span className="horosa-guazhan-shensha-tools">
							{tool(()=>setEx(exAll.slice()), '全选', !exOn)}
							{tool(()=>setEx([]), '清空', !exOn)}
							{tool(()=>setEx(null), '恢复默认', !exOn)}
						</span>
					</div>
					<div className="horosa-guazhan-shensha-hint">默认全选;取消勾选即剔除。</div>
					<XQCheckbox.Group value={s.shenshaEx.set || exAll} disabled={!exOn}
						options={exAll.map((n)=>({ label: n, value: n }))}
						onChange={(set)=>this.changeLiuyaoSelection('shenshaEx', s.shenshaEx.set || exAll, set, exAll)} className="horosa-guazhan-yao-checks" />
				</div>
			</XQModal>
		);
	},

	renderInfoRows(){
		const fields = this.props.fields || {};
		const nongli = this.state.nongli || {};
		const gua = this.state.currentGua !== null && Gua64[this.state.currentGua] ? Gua64[this.state.currentGua] : null;
		const dyvalues = this.getDongYaos();
		const fieldTime = fields.date && fields.time
			? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`
			: '—';
		const geo = fields.lon && fields.lat ? `${fields.lon.value} ${fields.lat.value}` : '—';
		const gz = [yearGzByBoundary(nongli, this.state.liuyaoSettings), nongli.monthGanZi, nongli.dayGanZi, nongli.time || nongli.timeGanZi]
			.filter(Boolean)
			.join(' / ');

		return [
			['起卦时间', fieldTime],
			['地点', geo],
			['干支', gz || '—'],
			['当前本卦', gua ? guaText(gua) : '未生成'],
			['动爻', dyvalues.length ? dyvalues.map(idx=>`第${idx + 1}爻`).join('、') : '无'],
			['数字', this.state.number !== null && this.state.number !== undefined && this.state.number !== '' ? this.state.number : '—'],
		].map(([label, value])=>(
			<div className="horosa-guazhan-info-row" key={label}>
				<span>{label}</span>
				<strong>{value}</strong>
			</div>
		));
	},

	renderRightPanel(height, guadesc){
		const infoHeight = Math.max(visualFloorPx(420), height - 170);
		const allowed = ['overview', 'zhuang', 'duanjue', 'zhanlei', 'ref', 'gua'];
		const activeKey = allowed.indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		const analysis = this.getLiuyaoAnalysis();
		const movingSet = new Set();
		(this.state.yao || []).forEach((y, i)=>{ if(y && y.change){ movingSet.add(i + 1); } });
		const scrollStyle = { maxHeight: infoHeight, overflowY: 'auto', paddingRight: 4 };
		const muted = { color: 'var(--horosa-astro-muted, #928b82)', fontSize: 13 };
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-guazhan-tabs">
				{/* horosa_freeze_subtabs_v1:右栏 6 个子面板此前全内联 —— 首次激活后永久挂载,
				    之后每次改时间/点爻/切流派都把另外 5 个看不见的面板(装卦大表、断诀、占类、
				    参考典籍)一并 reconcile。函数式 children:未激活过的面板连元素都不建;
				    已激活过的切回时拿本轮最新 analysis 立即渲一帧,不卸载、不重取、不丢滚动位置。 */}
				<TabPane tab="概览" key="overview">
					<FreezeSubTab active={activeKey === 'overview'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						{analysis ? <LiuYaoXunKong analysis={analysis} /> : null}
						{this.renderInfoRows()}
						{analysis ? (
							<div style={{ marginTop: 12 }}>
								<div style={{ fontSize: 12, fontWeight: 600, color: 'var(--horosa-astro-label, #d6c7b0)', margin: '4px 0 6px' }}>用神 · 原忌仇</div>
								<LiuYaoYongShenView analysis={analysis} />
								{/* [典籍补齐] 世应关系/卦变吉凶/动态四态/间爻 提到概览显要位置 */}
								<div style={{ marginTop: 12 }}><LiuYaoManualCards analysis={analysis} /></div>
								<div style={{ fontSize: 12, fontWeight: 600, color: 'var(--horosa-astro-label, #d6c7b0)', margin: '12px 0 6px' }}>动变</div>
								<LiuYaoDongBianView analysis={analysis} />
								{/* 日辰月建引动/扩展神煞/月建六神 概览与断诀同源(受各自开关 gating) */}
								<div style={{ marginTop: 12 }}>
									<LiuYaoRiYueView analysis={analysis} />
									<LiuYaoShenShaExView analysis={analysis} />
									<LiuYaoYueLiuShenView analysis={analysis} />
								</div>
								{analysis.shenSha ? (
									<div>
										<div style={{ fontSize: 12, fontWeight: 600, color: 'var(--horosa-astro-label, #d6c7b0)', margin: '12px 0 6px' }}>神煞</div>
										<LiuYaoShenShaView analysis={analysis} />
									</div>
								) : null}
							</div>
						) : null}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="装卦" key="zhuang">
					<FreezeSubTab active={activeKey === 'zhuang'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						{analysis ? (<div><LiuYaoZhuangTable analysis={analysis} movingSet={movingSet} hideXunKong /><LiuYaoRelatedCards analysis={analysis} /></div>) : <div style={muted}>请先起卦。</div>}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="断诀" key="duanjue">
					<FreezeSubTab active={activeKey === 'duanjue'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						{analysis ? <LiuYaoDuanJueView analysis={analysis} ctx={this.getDuanJueCtx()} /> : <div style={muted}>请先起卦。</div>}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="占类" key="zhanlei">
					<FreezeSubTab active={activeKey === 'zhanlei'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						<LiuYaoZhanLeiView analysis={analysis} currentGuaName={this.state.currentGua !== null && Gua64[this.state.currentGua] ? Gua64[this.state.currentGua].name : ''} castLines={(this.state.yao || []).map((y)=>y && y.value)} />
						{/* 天时(晴雨)本就是一个占类 —— 「天时占法」设为古法档时在此列出各家判据;
						    通行档(父母主雨/子孙晴)时 analysis.tianshi 为 null,该卡自身返回 null 不占位。 */}
						<LiuYaoTianshiView analysis={analysis} />
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="参考" key="ref">
					<FreezeSubTab active={activeKey === 'ref'}>{()=>(
					<div className="horosa-guazhan-info-card" style={scrollStyle}>
						<LiuYaoReference analysis={analysis} />
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="卦辞" key="gua">
					<FreezeSubTab active={activeKey === 'gua'}>{()=>(
					<div className="horosa-guazhan-desc-panel">
						<GuaDesc height={infoHeight} value={guadesc} />
					</div>
					)}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	},

	// 快捷栏契约:起卦动词=本页主键群(主键豁免——左栏长表单下会滚出视野);概览/卦辞=右栏
	// tab 镜像,撤。蓍草为第五种起卦收进 extras;「再摇一卦」语义比「随机卦」更贴复摇场景。
	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="guazhan"
				className="horosa-guazhan-quick-dock"
				hasResult={this.isGuaComplete()}
				primary={[
					{ key: 'timeGua', label: '时间卦', onClick: ()=>this.clickTimeGua() },
					{ key: 'redoGua', label: `${this.state.btnGenGua || ''}`.indexOf('停止') === 0 ? '停止随机' : '再摇一卦', icon: 'quickFirdaria', onClick: this.genGua },
					{ key: 'numGua', label: '数字卦', icon: 'quickProfection', onClick: this.clickNumGua },
					{ key: 'custGua', label: '自定义', icon: 'quickReturn', onClick: this.clickCustGua },
				]}
				extras={[
					{ key: 'yarrowGua', label: '蓍草起卦', icon: 'quickTransit', needsResult: false, onClick: this.clickYarrowGua },
				]}
				save={this.clickSaveCase}
				dispatch={this.props.dispatch}
			/>
		);
	},
};
