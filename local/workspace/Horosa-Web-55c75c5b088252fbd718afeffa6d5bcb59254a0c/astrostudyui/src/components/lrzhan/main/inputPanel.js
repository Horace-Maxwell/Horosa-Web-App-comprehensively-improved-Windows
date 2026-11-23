// 六壬页 · 左栏起课设置面板与底部快捷栏
// 从 LiuRengMain.js 按职责拆出的 LiuRengMain 方法:this 仍是 LiuRengMain 实例,门面里 mixinMethods(LiuRengMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { sideSectionIcon } from '../../../constants/sideSectionIcons';
import { XQButton as Button, XQSelect as Select, XQSideSection, XQInputNumber } from '../../xq-ui';
import * as LRConst from '../../liureng/LRConst';
import { ZSList, ZhangSheng } from '../../liureng/LRZhangSheng';
import { ZHANDUAN_CATEGORIES } from '../../liureng/LRZhanDuanDoc';
import LiuRengInput from '../LiuRengInput';
import LiuRengBirthInput from '../LiuRengBirthInput';
import QuickDockBar from '../../common/QuickDockBar';
import { extractBranch, buildMetaRows } from './birthRunYear';
import { QI_METHODS, YUE_JIANG_METHODS, FEN_ZHOU_YE_METHODS } from './castLayout';
import { getAppliedBirth } from './panData';
import { zeriLockProps } from '../../../divination/zeri/zeriPageCalibre';
import React, { Component } from 'react'; // horosa_liureng_render_slice_v1:模块级 JSX 常量需 React 在作用域(jest classic runtime)
import { wrapperPropsEqual } from '../../../utils/chartUpdateGuard';
const {Option} = Select;

// horosa_liureng_render_slice_v1(L1):十二长生选项 12 个 <Option> 只依赖常量表 LRConst.WuXing,
// 与任何 props/state 无关,原 genWuXingDoms() 每次 render 都从头重建一遍(纯白跑)。提为模块级
// 冻结常量:引用恒稳 → 左栏子面板 sCU 浅比恒等;Select 只读消费列表,零语义差。
const WUXING_OPTION_DOMS = Object.freeze(LRConst.WuXing.map((item, idx)=>(
	<Option key={idx} value={item.elem} label={`${item.elem}（${item.ganzi}）`}>十二长生：{item.elem}--{item.ganzi}</Option>
)));

// horosa_liureng_render_slice_v1(L3):左栏「六壬设置」输入面板(时间地点/出生时间/14 项起课选项,
// 内含十几个 antd Select 重组件)原内联在宿主 render 里 —— 宿主任意 setState(收课盘结果、切右栏
// tab、改任一无关状态)都把整面板 reconcile 一遍。抽成同文件子组件 + wrapperPropsEqual 机械浅比
// sCU(全 props 逐键比较,函数型视为恒等,零手抄 key 清单 —— 详 utils/chartUpdateGuard):消费的
// 标量/引用未变 → 整面板跳过;任一真变(fields/birth 引用、任一选项标量)→ 照常重渲,绝不漏渲。
// kill-switch 同 chartSCU:关(horosa.perf.chartSCU=0)= wrapperPropsEqual 恒 false = 恒重渲旧行为。
// 起课选项回调 prop 名取 onOptionChange(= 宿主 handleCastField(键, 值)):页面设置合同扫描器按 onOptionChange('键', …)
// 认控件(切片里读的是 p.X 而非 this.state.X,换个名字它就认不出这些下拉,aiPageFacetControl 合同会把它们判成「页面上无控件」)。
class LiuRengInputPanel extends Component{
	shouldComponentUpdate(nextProps){
		return !wrapperPropsEqual(this.props, nextProps);
	}

	render(){
		const p = this.props;
		// 择日锁定项(起课法):宿主的 zeriLocked / _zeriRestoredLocks 经 props 进入(切片内 this 不是宿主);
		// 两者都是整体换引用的值(zeriRestoredLockMarks / clearZeriLockMarks 恒返新对象或 null),浅比 sCU 照常感知。
		const castLock = zeriLockProps(p.zeriLocked, 'castMethod', p.castMethod, p.zeriRestoredLocks);
		return (
			<div className="horosa-liureng-input-stack">
				<div className="horosa-side-panel-heading">
					<div>
						<div className="horosa-side-panel-title">六壬设置</div>
						<div className="horosa-side-panel-subtitle">时间、地点与起课选项</div>
					</div>
				</div>
				{/* [择日宿主] 左栏插槽(主六壬页不传=零渲染;prop 经 renderInputPanel 铺入切片) */}
				{typeof p.renderLeftExtra === 'function' ? p.renderLeftExtra() : null}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<LiuRengInput
						fields={p.fields}
						onFieldsChange={p.onFieldsChange}
						onStepSelect={p.onStepSelect}
						timeHook={p.timeHook}
						chartType={p.chartType}
						onChartTypeChange={p.onChartTypeChange}
					/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('time')} title="卜卦人出生时间" storageKey="liureng.s1" className="horosa-liureng-input-section">
					<LiuRengBirthInput
						fields={p.birth}
						onFieldsChange={p.onBirthChange}
						requireConfirm={true}
					/>
				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('switches')} title="选项" storageKey="liureng.s2" className="horosa-liureng-input-section">
					<div className="horosa-liureng-select-grid">
							<label className="horosa-liureng-select-field">
								<span>十二长生</span>
								<Select value={p.wuxing} optionLabelProp="label" onChange={p.onWuXingChange} dropdownMatchSelectWidth={false}>
									{WUXING_OPTION_DOMS}
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>贵人体系</span>
								<Select value={p.guireng} onChange={p.onGuiRengChange} dropdownMatchSelectWidth={false}>
									<Option value={0}>六壬法贵人</Option>
									<Option value={1}>遁甲法贵人</Option>
									<Option value={2}>星占法贵人</Option>
									<Option value={3}>甲戊兼牛羊</Option>
									<Option value={4}>干合阳阴贵</Option>
								</Select>
							</label>
							{/* 起课时间算法:缺省真太阳时=后端历来口径(字节零回归);
							    选「直接时间」即与三式合一六壬层(时柱取自吃 timeAlg 的奇门)同口径。
							    择日里内嵌的这份不出:扫描引擎恒按真太阳时判,内嵌盘改了只会「所见≠所判」。
							    (切片子组件:宿主 usesSavedSettings() 经 p.showTimeAlg 传入) */}
							{p.showTimeAlg ? (
								<label className="horosa-liureng-select-field">
									<span>时间算法</span>
									<Select value={p.timeAlg} onChange={p.onTimeAlgChange} dropdownMatchSelectWidth={false}>
										<Option value={0}>真太阳时（默认）</Option>
										<Option value={1}>直接时间</Option>
									</Select>
								</label>
							) : null}
							<label className="horosa-liureng-select-field" title={castLock.title}>
								<span>起课法</span>
								{/* 择日内嵌:扫描只按正时正将起课,宿主传 zeriLocked 置灰(点结果行时回写锁定值) */}
								<Select value={p.castMethod} optionLabelProp="label" onChange={p.onCastMethodChange} dropdownMatchSelectWidth={false} disabled={!!castLock.disabled}>
									{QI_METHODS.map((m)=>(<Option key={m.key} value={m.key} label={m.short || m.name}>{m.name}</Option>))}
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>换将</span>
								<Select value={p.yueJiangMethod} optionLabelProp="label" onChange={(v)=>p.onOptionChange('yueJiangMethod', v)} dropdownMatchSelectWidth={false}>
									{YUE_JIANG_METHODS.map((m)=>(<Option key={m.key} value={m.key} label={m.short || m.name}>{m.name}</Option>))}
								</Select>
							</label>
							{p.castMethod === 'xuanshi' ? (
							<label className="horosa-liureng-select-field horosa-liureng-select-field-wide">
								<span>选时·时辰</span>
								<Select value={p.xuanShiZhi || ''} onChange={(v)=>p.onOptionChange('xuanShiZhi', v)} dropdownMatchSelectWidth={false}>
									<Option value=''>用正时</Option>
									{LRConst.ZiList.map((z)=>(<Option key={z} value={z}>{z}时</Option>))}
								</Select>
							</label>
							) : null}
							{(p.castMethod === 'yanshu' || p.castMethod === 'baoshu') ? (
							<label className="horosa-liureng-select-field horosa-liureng-select-field-wide">
								<span>{p.castMethod === 'baoshu' ? '报数/字数/笔画' : '演数·随感之数'}</span>
								<XQInputNumber value={p.yanShuNum === '' || p.yanShuNum === null || p.yanShuNum === undefined ? null : Number(p.yanShuNum)} onChange={(v)=>p.onOptionChange('yanShuNum', v === null || v === undefined ? '' : String(v))} placeholder='输入数字' style={{ width: '100%' }} />
							</label>
							) : null}
							<label className="horosa-liureng-select-field">
								<span>分昼夜</span>
								<Select value={p.fenZhouYe} onChange={(v)=>p.onOptionChange('fenZhouYe', v)} dropdownMatchSelectWidth={false}>
									{FEN_ZHOU_YE_METHODS.map((m)=>(<Option key={m.key} value={m.key}>{m.name}</Option>))}
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>涉害取舍</span>
								<Select value={p.seHaiMethod} onChange={(v)=>p.onOptionChange('seHaiMethod', v)} dropdownMatchSelectWidth={false}>
									<Option value="app">仅下贼上(默认)</Option>
									<Option value="standard">标准深浅两向</Option>
									<Option value="mengzhongji">直取孟仲季</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>涉害起讫</span>
								<Select value={p.seHaiBoundary} onChange={(v)=>p.onOptionChange('seHaiBoundary', v)} dropdownMatchSelectWidth={false}>
									<Option value="app">计起点不计本家(默认)</Option>
									<Option value="both">两端皆计</Option>
									<Option value="neither">皆不计</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>始入课</span>
								<Select value={p.shiRuKe ? '1' : '0'} onChange={(v)=>p.onOptionChange('shiRuKe', v === '1')} dropdownMatchSelectWidth={false}>
									<Option value='0'>并入重审(默认)</Option>
									<Option value='1'>单列·九法变十法</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>取象</span>
								<Select value={p.xiangOn ? '1' : '0'} onChange={(v)=>p.onToggleXiang(v === '1')} dropdownMatchSelectWidth={false}>
									<Option value='0'>关闭</Option>
									<Option value='1'>开启</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>占事类型</span>
								<Select value={p.zhanCategory} onChange={p.onZhanCategoryChange} dropdownMatchSelectWidth={false}>
									{ZHANDUAN_CATEGORIES.map((c)=>(<Option key={c.key} value={c.key}>{c.name}</Option>))}
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>年神排序</span>
								<Select value={p.yearShenShaSort} onChange={(v)=>p.onOptionChange('yearShenShaSort', v)} dropdownMatchSelectWidth={false}>
									<Option value="sanyuan">四利三元序(默认)</Option>
									<Option value="suigui">太岁排轮(太阴异)</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field" title={p.guireng !== 0 ? '星历阳阴系只在贵人体系=六壬法贵人时生效(甲乙丙辛壬癸昼夜互换);当前贵人体系下两档恒同' : undefined}>
								<span>昼夜阳阴归属</span>
								{/* 贵人≠六壬法时置灰:LRConst 只在 guirengType===0 时按此键互换昼夜 */}
								<Select value={p.yinyangSystem} disabled={p.guireng !== 0} onChange={(v)=>p.onOptionChange('yinyangSystem', v)} dropdownMatchSelectWidth={false}>
									<Option value="danmu">旦暮系(默认)</Option>
									<Option value="yinyang">星历阳阴系</Option>
								</Select>
							</label>
							<label className="horosa-liureng-select-field">
								<span>土旺衰</span>
								<Select value={p.tuWangShuai} onChange={(v)=>p.onOptionChange('tuWangShuai', v)} dropdownMatchSelectWidth={false}>
									<Option value="siji">四季月土旺(默认)</Option>
									<Option value="huotu">火土同宫(土随火)</Option>
								</Select>
							</label>
						</div>
						<div className="horosa-liureng-action-row">
						<Button type='primary' onClick={p.onStartPaiPan}>起课</Button>
						<Button onClick={p.onSaveCase}>保存</Button>
					</div>
				</XQSideSection>
			</div>
		);
	}
}

export const inputPanelMethods = {
	// horosa_liureng_render_slice_v1(L3):面板本体已抽为同文件子组件 LiuRengInputPanel(sCU 见类上注释),
	// 此处只把其消费的 state 标量/引用与回调铺成 props —— 比较由 wrapperPropsEqual 机械全覆盖,零手抄清单。
	renderInputPanel(){
		return (
			<LiuRengInputPanel
				renderLeftExtra={this.props.renderLeftExtra}
				fields={this.props.fields}
				onFieldsChange={this.onFieldsChange}
				onStepSelect={this.prefetchStepSelect}
				timeHook={this.timeHook}
				chartType={this.state.chartType}
				onChartTypeChange={this.onChartTypeChange}
				birth={this.state.birth}
				onBirthChange={this.onBirthChange}
				wuxing={this.state.wuxing}
				guireng={this.state.guireng}
				timeAlg={this.state.timeAlg}
				onTimeAlgChange={this.onTimeAlgChange}
				showTimeAlg={this.usesSavedSettings()}
				castMethod={this.state.castMethod}
				zeriLocked={this.props.zeriLocked}
				zeriRestoredLocks={this._zeriRestoredLocks}
				yueJiangMethod={this.state.yueJiangMethod}
				xuanShiZhi={this.state.xuanShiZhi}
				yanShuNum={this.state.yanShuNum}
				fenZhouYe={this.state.fenZhouYe}
				seHaiMethod={this.state.seHaiMethod}
				seHaiBoundary={this.state.seHaiBoundary}
				shiRuKe={this.state.shiRuKe}
				xiangOn={this.state.xiangOn}
				zhanCategory={this.state.zhanCategory}
				yearShenShaSort={this.state.yearShenShaSort}
				yinyangSystem={this.state.yinyangSystem}
				tuWangShuai={this.state.tuWangShuai}
				onWuXingChange={this.onWuXingChange}
				onGuiRengChange={this.onGuiRengChange}
				onCastMethodChange={this.onCastMethodChange}
				onOptionChange={this.handleCastField}
				onToggleXiang={this.onToggleXiang}
				onZhanCategoryChange={this.onZhanCategoryChange}
				onStartPaiPan={this.clickStartPaiPan}
				onSaveCase={this.clickSaveCase}
			/>
		);
	},

	buildQuickMetaItems(displayRunYear){
		const liureng = this.state.liureng;
		if(!liureng){
			return [];
		}
		const appliedBirth = getAppliedBirth(this.state);
		const genderVal = appliedBirth && appliedBirth.gender
			? appliedBirth.gender.value
			: -1;
		const genderText = genderVal === 0 || genderVal === '0' ? '女' : '男';
		const runyear = displayRunYear || {};
		const dunDing = liureng.xun ? (liureng.xun['遁丁'] || extractBranch(liureng.xun['旬丁'])) : '';
		const yearGods = [];
		const taisui1 = liureng.godsYear ? liureng.godsYear.taisui1 : null;
		for(let i=0; i<LRConst.TaiSui.length; i++){
			const key = LRConst.TaiSui[i];
			yearGods.push({
				key,
				value: taisui1 && taisui1[key] ? taisui1[key] : '—',
			});
		}
		const zhangsheng = ZSList.map((item)=>({
			key: item,
			value: ZhangSheng.wxphase[`${this.state.wuxing}_${item}`],
		}));
		return [{
			title: '行年',
			rows: [{
				key: '行年',
				value: runyear.year ? runyear.year : '—',
			}, {
				key: '年龄',
				value: runyear.age !== undefined && runyear.age !== null ? `${runyear.age}岁` : '—',
			}, {
				key: '性别',
				value: genderText,
			}],
		}, {
			title: '旬日',
			rows: [{
				key: '旬空',
				value: liureng.xun ? liureng.xun['旬空'] : '—',
			}, {
				key: '旬首',
				value: liureng.xun ? liureng.xun['旬首'] : '—',
			}, {
				key: '旬尾',
				value: liureng.xun ? liureng.xun['旬尾'] : '—',
			}, {
				key: '遁丁',
				value: dunDing || '—',
			}],
		}, {
			title: '旺衰',
			rows: buildMetaRows(liureng.season),
		}, {
			title: '基础神煞',
			rows: buildMetaRows(liureng.gods),
		}, {
			title: '干煞',
			rows: buildMetaRows(liureng.godsGan),
		}, {
			title: '月煞',
			rows: buildMetaRows(liureng.godsMonth),
		}, {
			title: '支煞',
			rows: buildMetaRows(liureng.godsZi),
		}, {
			title: '年煞',
			rows: yearGods,
		}, {
			title: `${this.state.wuxing}十二长生`,
			rows: zhangsheng,
		}];
	},

	// 神煞/旬空/长生等信息不再走栏内速查弹层——全部常驻右栏「信息」tab(信息不得仅在快捷栏可见)。
	renderQuickDock(){
		return (
			<QuickDockBar
				page="lrzhan"
				className="horosa-liureng-quick-dock"
				hasResult={!!this.state.liureng}
				primary={{ key: 'paipan', label: '起课', onClick: ()=>this.clickStartPaiPan() }}
				extras={[
					{ key: 'nowCast', label: '此刻起课', icon: 'quickTransit', needsResult: false, onClick: ()=>this.clickStartNowPaiPan() },
				]}
				save={()=>this.clickSaveCase()}
				dispatch={this.props.dispatch}
			/>
		);
	},
};
