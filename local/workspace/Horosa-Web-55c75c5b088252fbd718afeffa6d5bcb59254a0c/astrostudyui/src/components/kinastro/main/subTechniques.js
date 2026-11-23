// 策天页 · 内嵌子技法(河洛 / 大定 / 参评 / 神数正传 / 一掌经)的参数与中栏分发
// 从 KinAstroMain.js 按职责拆出的 KinAstroMain 方法:this 仍是 KinAstroMain 实例,门面里 mixinMethods(KinAstroMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React, { Suspense } from 'react';
import { Collapse, Input } from 'antd';
import CanPingMain from '../../shusuan/CanPingMain';
import HeLuoMain from '../../shusuan/HeLuoMain';
import YiZhangJingMain from '../../yizhangjing/YiZhangJingMain';
import { XQInputNumber, XQSpin } from '../../xq-ui';
import { YZJ_PRESET_LABELS, YZJ_PRESETS, KINASTRO_PAGE_SETTINGS, YZJ_PRESET_STATEMAP } from './settings';
import { ZhengChuanMain } from './lazyPanels';

export const subTechniqueMethods = {
	buildHeluoOpts(){
		return this.memoOpts('heluo', {
			ziShuMode: this.state.heluoZiShu,
			jiGongMode: this.state.heluoJiGong,
			zhiZunEnabled: this.state.heluoZhiZun,
			pureGanKunVariant: this.state.heluoPureGanKun,
			liunianStep2: this.state.heluoLiunianStep2,
			liuYueMode: this.state.heluoLiuYueMode,
			huangdiOffset: Number.isFinite(parseInt(this.state.heluoHuangdiOffset, 10)) ? parseInt(this.state.heluoHuangdiOffset, 10) : 2697,   // 0 可达
			showLiuRi: this.state.heluoShowLiuRi,
		});
	},

	/**
	 * 大定推命之「所推流年」—— 主控一项，余者尽自其派生。
	 *
	 * 🔴 从前此处要用户手填【虚岁 + 大运/小运/岁君三个干支】,而这四者本可自生辰与流年推得:
	 *    用户得自己算虚岁、自己排大运、自己查太岁,方能推一年 —— 换一年又得重来一遍。
	 *    今只取一年,余者由 ZhengChuanMain 自八字既有之推运表派生(与八字盘同出一源,不另造)。
	 *    手填诸格仍在,收于「手订七位」之下:古法偶有特例(如虚岁按他说、大运另取),留其路。
	 */
	renderDadingYearFields(){
		const f = this.props.fields || {};
		const dv = f.date && f.date.value;
		// 🔴 此处 date.value 是【朴素对象】{year,month,date,...},不是 moment ——
		//    而同一字段到了 ZhengChuanMain 那边却是 moment(其调 dv.format())。
		//    两处形状不同,照抄邻居即取空(实测:一度恒报「先定生辰」)。故两种皆吃。
		const birthYear = (() => {
			if (!dv) return null;
			if (typeof dv.year === 'function') return dv.year();       // moment
			return Number.isFinite(Number(dv.year)) ? Number(dv.year) : null;   // 朴素对象
		})();
		const nowYear = new Date().getFullYear();
		const cur = parseInt(this.state.zhengchuanDadingYear, 10);
		const manual = [this.state.zhengchuanAge, this.state.zhengchuanDayun,
			this.state.zhengchuanXiaoyun, this.state.zhengchuanSuijun].filter((x)=>`${x || ''}`.trim()).length;
		return (
			<>
				<label className="horosa-huangji-select-field is-wide">
					<span>所推流年（余者自出）</span>
					<XQInputNumber
						min={birthYear || 1} max={(birthYear || nowYear) + 120}
						value={Number.isFinite(cur) ? cur : undefined}
						placeholder="未择"   /* 未择时虚岁暗取 40,占位不再冒充今年 */
						onChange={(v)=>this.setUserOpt({ zhengchuanDadingYear: v ? `${v}` : '' })} />
				</label>
				<div className="horosa-cetian-settings-hint horosa-heluo-diverge-hint">
					{birthYear ? '择一年，其虚岁·大运·小运·岁君即自本命推运表出（与八字盘同源）；留空则三运取本命月/时/年柱。' : '先定生辰，方可推年。'}
				</div>
				<Collapse ghost className="horosa-huangji-sub-collapse horosa-heluo-diverge-hint">
					<Collapse.Panel key="manual" header={`手订七位${manual ? `（已订 ${manual} 项）` : ''}`}>
						<label className="horosa-huangji-select-field">
							<span>虚岁（留空自出）</span>
							<XQInputNumber min={1} max={120} value={parseInt(this.state.zhengchuanAge, 10) || undefined}
								placeholder="自流年出"
								onChange={(v)=>this.setUserOpt({ zhengchuanAge: v ? `${v}` : '' })} />
						</label>
						<label className="horosa-huangji-select-field">
							<span>大运（干支）</span>
							<Input value={this.state.zhengchuanDayun} maxLength={2} placeholder="自流年出，未起运取月柱"
								onChange={(e)=>this.setUserOpt({ zhengchuanDayun: e.target.value })} />
						</label>
						<label className="horosa-huangji-select-field">
							<span>小运（干支）</span>
							<Input value={this.state.zhengchuanXiaoyun} maxLength={2} placeholder="自流年出"
								onChange={(e)=>this.setUserOpt({ zhengchuanXiaoyun: e.target.value })} />
						</label>
						<label className="horosa-huangji-select-field">
							<span>岁君（干支）</span>
							<Input value={this.state.zhengchuanSuijun} maxLength={2} placeholder="自流年出，即当年太岁"
								onChange={(e)=>this.setUserOpt({ zhengchuanSuijun: e.target.value })} />
						</label>
					</Collapse.Panel>
				</Collapse>
			</>
		);
	},

	// 参评数左栏分歧打包（与 HeLuo/一掌经同范式；组件 memo 签名与快照去重键均含本 opts）
	buildCanpingOpts(){
		return { dayunRule: this.state.canpingDayun || 'mingGongQiyun' };
	},

	// 演算时辰留空 = 取本人时支:天象下拉按实际生效的时支只列那一套(本人时支由正传盘回报;未回报前两套都列)
	onZcOwnHourZhi(z){
		if(!this.unmounted && z && z !== this.state.zcOwnHourZhi){ this.setState({ zcOwnHourZhi: z }); }
	},

	zcEffectiveAskHourZhi(){
		return this.state.zhengchuanAskHourZhi || this.state.zcOwnHourZhi || '';
	},

	buildZhengChuanOpts(){
		// 汇总全部开关 → 单一 opts 下传;任一变则中/右栏重算 + AI 快照刷新(禁止只监听单项)。
		// memoOpts 只稳定【引用】:任一项值变 → 新对象 → 子组件照常重算,契约逐字不变。
		return this.memoOpts('zhengchuan', {
			school: this.state.zhengchuanSchool,
			askGz: this.state.zhengchuanAskGz,
			fatherAge: this.state.zhengchuanFatherAge,
			motherAge: this.state.zhengchuanMotherAge,
			yuan: this.state.zhengchuanYuan,
			dadingYear: this.state.zhengchuanDadingYear,
			age: this.state.zhengchuanAge,
			dayun: this.state.zhengchuanDayun,
			xiaoyun: this.state.zhengchuanXiaoyun,
			suijun: this.state.zhengchuanSuijun,
			askHourZhi: this.state.zhengchuanAskHourZhi,
			env: this.state.zhengchuanEnv,
			item: this.state.zhengchuanItem,
			sound: this.state.zhengchuanSound,
			ke: this.state.zhengchuanKe,
			gong: this.state.zhengchuanGong,
			xqZhi: this.state.zhengchuanXqZhi,
			xqYushu: this.state.zhengchuanXqYushu,
		});
	},

	// 用户亲手改控件的统一入口:落盘(只收 schema 里的键,输入类键自动忽略)+ setState。
	// 程序自己改 state(fields 重同步 / 拉取结果 / 视图态)一律仍用 this.setState,不经这里。
	setUserOpt(patch, cb){
		KINASTRO_PAGE_SETTINGS.save(patch);
		this.setState(patch, cb);
	},

	// 预设批量套用（一次 setState 避免多次重渲）
	applyYzjPreset(key){
		const p = YZJ_PRESETS[key];
		if(!p){ this.setState({ yizhangjingPreset: key }); return; }
		const patch = { yizhangjingPreset: key };
		YZJ_PRESET_STATEMAP.forEach((f) => { patch[`yizhangjing${f}`] = p[f]; });
		KINASTRO_PAGE_SETTINGS.save(patch);   // 套预设 / 还原预设都是用户亲手点的 → 整套落盘
		this.setState(patch);
	},

	// 当前各开关相对所选预设的偏离项数（>0 → 显「自定义·已改N项」+还原）
	yzjDeviationCount(){
		const p = YZJ_PRESETS[this.state.yizhangjingPreset];
		if(!p) return 0;
		return YZJ_PRESET_STATEMAP.filter((f) => this.state[`yizhangjing${f}`] !== p[f]).length;
	},

	buildYizhangjingOpts(){
		return this.memoOpts('yizhangjing', {
			shunniRule: this.state.yizhangjingShunni,
			mingGongMethod: this.state.yizhangjingMingGong,
			dayunLength: parseInt(this.state.yizhangjingDayunLen, 10) || 7,
			dayunStartAge: this.state.yizhangjingStartAge,
			xiaoxianStart: this.state.yizhangjingXiaoStart,
			xiaoxianDir: this.state.yizhangjingXiaoDir,
			annualMethod: this.state.yizhangjingAnnual,
			flowShenSet: this.state.yizhangjingFlowSet,
			chongfanKou: this.state.yizhangjingChongfan,
			dingYue: this.state.yizhangjingDingYue,
			leapRule: this.state.yizhangjingLeapRule,
			zaoZiAdjust: this.state.yizhangjingZaoZi,
			starNaming: this.state.yizhangjingStarNaming,
			daoTerm: this.state.yizhangjingDaoTerm,
			gradeSet: this.state.yizhangjingGradeSet,
			shenshaLayer: this.state.yizhangjingShensha,
			// 显示层：预设名（题头徽）与童限显示开关；供 UI 标注，不改盘算
			yizhangjingPresetName: this.yzjDeviationCount() > 0 ? '自定义' : (YZJ_PRESET_LABELS[this.state.yizhangjingPreset] || '自定义'),
			tongxianShow: this.state.yizhangjingTongxian,
		});
	},

	renderCenter(){
		if(this.config.serviceKey === 'canping'){
			return <CanPingMain slot="center" fields={this.props.fields} gender={this.state.gender} method={this.state.canpingMethod} opts={this.buildCanpingOpts()} />;
		}
		if(this.config.serviceKey === 'heluo'){
			return <HeLuoMain slot="center" fields={this.props.fields} gender={this.state.gender} quHuaGong={this.state.heluoQuHuaGong} opts={this.buildHeluoOpts()} />;
		}
		if(this.config.serviceKey === 'zhengchuan'){
			return <Suspense fallback={<div className="horosa-zhengchuan-loading"><XQSpin size="small" /> 载入中</div>}>
					<ZhengChuanMain slot="center" fields={this.props.fields} gender={this.state.gender} opts={this.buildZhengChuanOpts()} onOwnHourZhi={this.onZcOwnHourZhi} />
				</Suspense>;
		}
		if(this.config.serviceKey === 'yizhangjing'){
			return <YiZhangJingMain slot="center" fields={this.props.fields} gender={this.state.gender} opts={this.buildYizhangjingOpts()} />;
		}
		const pan = this.state.pan;
		if(!pan){
			return <div className="horosa-huangji-empty">暂无{this.config.techniqueLabel}数据</div>;
		}
		if(this.config.serviceKey === 'xianqin'){
			return this.renderZiWeiCopiedCenter(pan);
		}
		if(this.config.serviceKey === 'cetian'){
			return this.renderZiWeiCopiedCenter(pan);
		}
		if(this.config.serviceKey === 'tieban'){
			return this.renderTiebanCenter(pan);
		}
		if(this.config.serviceKey === 'fendjing'){
			return this.renderFendjingCenter(pan);
		}
		if(this.config.serviceKey === 'beiji'){
			return this.renderBeijiCenter(pan);
		}
		if(this.config.serviceKey === 'nanji'){
			return this.renderNanjiCenter(pan);
		}
		if(this.config.serviceKey === 'chunzi'){
			return this.renderChunziCenter(pan);
		}
		return this.renderShaoziCenter(pan);
	},
};
