import { Component } from 'react';
import { XQSelect, XQSideSection } from '../xq-ui';
import DivinationChartShell from '../divination/DivinationChartShell';
import HoraryJudgment from './HoraryJudgment';
import { HORARY_SCHOOLS, HORARY_SCHOOL_ORDER, horaryBackendFields, presetOf, schoolOf } from '../../divination/horary/horarySchools';
import { markPanelReady } from '../../utils/perfMark';

const Option = XQSelect.Option;

// 卜卦问题类别（按宫位/转宫归类）。完整规则库于 M3 接入；此处先用于左栏选择 + 右栏占位。
export const HORARY_CATEGORIES = [
	{ value: 'general', label: '综合 · 能否成事' },
	{ value: 'wealth', label: '财物 · 借贷（二宫）' },
	{ value: 'family', label: '兄弟 · 亲属（三宫）' },
	{ value: 'property', label: '房产 · 田宅（四宫）' },
	{ value: 'pregnancy', label: '子嗣 · 怀孕（五宫）' },
	{ value: 'health', label: '疾病 · 健康（六宫）' },
	{ value: 'marriage', label: '婚姻 · 感情（七宫）' },
	{ value: 'lawsuit', label: '诉讼 · 合伙 · 战争（七宫）' },
	{ value: 'theft', label: '盗窃 · 失物 · 走失（七宫/转宫）' },
	{ value: 'death', label: '死生 · 遗产（八宫）' },
	{ value: 'travel', label: '旅行 · 远行 · 学问（九宫）' },
	{ value: 'career', label: '职位 · 事业（十宫）' },
	{ value: 'hope', label: '愿望 · 朋友（十一宫）' },
	{ value: 'enemy', label: '私敌 · 囚禁（十二宫）' },
];

// 当前生效流派：优先用户显式所选(extra.horarySchool)；否则据当前宫制反推(老盘 hsys:0 → 希腊化，不误标)。
function activeSchoolId(extra, fields){
	if(extra && extra.horarySchool && HORARY_SCHOOLS[extra.horarySchool]){ return extra.horarySchool; }
	return presetOf(fields);
}

class HoraryMain extends Component{

	renderLeftExtra({ extra, setExtra, fields, patchFields }){
		const schoolId = activeSchoolId(extra, fields);
		const sch = schoolOf(schoolId);
		return (
			<XQSideSection iconName="target" title="卜卦设置" storageKey="horary.opts" className="horosa-side-input-section">
				<div className="horosa-field-block">
					<div className="horosa-field-label">流派</div>
					<XQSelect style={{ width: '100%' }} size="small"
						value={schoolId}
						onChange={(val)=>{
							setExtra({ horarySchool: val });
							// 后端字段联动:换宫制/界/星历口径 → patchFields 自动重排盘;
							// 仅当与当前值不同才 patch(避免无谓重取)。tripSystem 前端判读消费,不下发。
							const bf = horaryBackendFields(val);
							const patch = {};
							Object.keys(bf).forEach((k) => {
								const cur = fields && fields[k] && fields[k].value !== undefined ? fields[k].value : undefined;
								if(cur !== bf[k]){ patch[k] = bf[k]; }
							});
							if(Object.keys(patch).length){ patchFields(patch); }
						}}>
						{HORARY_SCHOOL_ORDER.map((id)=>(<Option key={id} value={id}>{HORARY_SCHOOLS[id].cn}</Option>))}
					</XQSelect>
					{sch.desc ? <div className="horosa-field-hint" style={{ marginTop: 4, opacity: 0.72, fontSize: 12, lineHeight: 1.5 }}>{sch.desc}</div> : null}
				</div>
				<div className="horosa-field-block">
					<div className="horosa-field-label">问题类别</div>
					<XQSelect style={{ width: '100%' }} size="small"
						value={extra.questionCategory || 'general'}
						onChange={(val)=>setExtra({ questionCategory: val })}>
						{HORARY_CATEGORIES.map((c)=>(<Option key={c.value} value={c.value}>{c.label}</Option>))}
					</XQSelect>
				</div>
			</XQSideSection>
		);
	}

	renderRight({ chart, extra, fields }){
		// horosa_panel_ready_v1:卜卦盘的中栏(DivinationChartShell 画的盘)与右栏(判读)同源于 chart。
		// 本组件自身不发请求(壳负责),故「面板数据落定」= 拿到新 chart 的这一轮渲染;
		// markPanelReady 内部双 rAF 后才记账,量到的是本帧已绘。只在 chart 真换了时打一次。
		if(chart && chart !== this._readyChart){
			this._readyChart = chart;
			markPanelReady('auxchart');
		}
		return <HoraryJudgment chart={chart} category={extra.questionCategory || 'general'}
			schoolId={activeSchoolId(extra, fields)} />;
	}

	render(){
		return (
			<DivinationChartShell
				title="卜卦盘"
				kicker="起卦设置"
				pageClass="horosa-horary-page"
				castNowLabel="此刻起卦"
				defaults={{ tradition: 1, zodiacal: 0, hsys: 2 }}
				initialExtra={{ questionCategory: 'general' }}
				fields={this.props.fields}
				height={this.props.height}
				chartDisplay={this.props.chartDisplay}
				planetDisplay={this.props.planetDisplay}
				lotsDisplay={this.props.lotsDisplay}
				showAstroMeaning={this.props.showAstroMeaning}
				dispatch={this.props.dispatch}
				saveModule="horary"
				renderLeftExtra={(args)=>this.renderLeftExtra(args)}
				renderRight={(args)=>this.renderRight(args)}
			/>
		);
	}
}

export default HoraryMain;
