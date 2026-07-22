import { Component } from 'react';
import { Checkbox } from 'antd';
import { XQSelect as Select, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import SpaceTimePanel from '../comp/SpaceTimePanel';
import {convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import { dstAwareZoneAt } from '../../utils/timezone';
import { geoNameFieldPatch } from '../../utils/geoName';
import DateTime from '../comp/DateTime';

const {Option} = Select

class CnTraditionInput extends Component{
	
	constructor(props) {
		super(props);

        this.tmHook = {
            getValue: null,
        }

		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onZoneChanged = this.onZoneChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);

		this.onTimeAlgChange = this.onTimeAlgChange.bind(this);
		this.onPhaseTypeChange = this.onPhaseTypeChange.bind(this);
		this.onGodKeyPosChange = this.onGodKeyPosChange.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.onAfter23NewDayChange = this.onAfter23NewDayChange.bind(this);
		this.onChangeAdjustJieqi = this.onChangeAdjustJieqi.bind(this);

		this.onOnlyZiganChange = this.onOnlyZiganChange.bind(this);
		this.onUiModeChange = this.onUiModeChange.bind(this);
		this.onShowRelationsChange = this.onShowRelationsChange.bind(this);
		this.onMingGongMethodChange = this.onMingGongMethodChange.bind(this);
		this.onShowShenShaChange = this.onShowShenShaChange.bind(this);
		this.onFenyeVersionChange = this.onFenyeVersionChange.bind(this);
		this.onDayunPrecisionChange = this.onDayunPrecisionChange.bind(this);
		this.onShowXiaoyunChange = this.onShowXiaoyunChange.bind(this);
		this.onCangVersionChange = this.onCangVersionChange.bind(this);
		this.onZodiacBoundaryChange = this.onZodiacBoundaryChange.bind(this);
		this.onAgeStyleChange = this.onAgeStyleChange.bind(this);
		this.onSchoolChange = this.onSchoolChange.bind(this);

	}

	onOnlyZiganChange(e){
		let val = e.target.checked;
		let opt = {
			...this.props.baziOpt,
		};
		opt.onlyZiGanShen = val;
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onUiModeChange(val){
		let opt = {
			...this.props.baziOpt,
			uiMode: val,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onShowRelationsChange(val){
		let opt = {
			...this.props.baziOpt,
			showRelations: val === 1,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onMingGongMethodChange(val){
		let opt = {
			...this.props.baziOpt,
			minggongMethod: val,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onShowShenShaChange(val){
		let opt = {
			...this.props.baziOpt,
			showShenSha: val === 1,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onFenyeVersionChange(val){
		let opt = {
			...this.props.baziOpt,
			fenyeVersion: val,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onDayunPrecisionChange(val){
		let opt = {
			...this.props.baziOpt,
			dayunPrecision: val,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onShowXiaoyunChange(val){
		let opt = {
			...this.props.baziOpt,
			showXiaoyun: val === 1,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onCangVersionChange(val){
		let opt = {
			...this.props.baziOpt,
			cangVersion: val,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onZodiacBoundaryChange(val){
		let opt = {
			...this.props.baziOpt,
			zodiacBoundary: val,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onAgeStyleChange(val){
		let opt = {
			...this.props.baziOpt,
			ageStyle: val,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onSchoolChange(val){
		let opt = {
			...this.props.baziOpt,
			school: val,
		};
		if(this.props.onBaziOptChange){
			this.props.onBaziOptChange(opt);
		}
	}

	onGenderChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			
			this.props.onFieldsChange({
				gender: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	onTimeAlgChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				timeAlg: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}		
	}

	onPhaseTypeChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				phaseType: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}				
	}

	onGodKeyPosChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				godKeyPos: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}				
	}

	onTimeChanged(value){
		if(this.props.onFieldsChange){
			let dt = value.time;

			this.props.onFieldsChange({
				__confirmed: !!value.confirmed,
				...(value.step ? { __stepHint: value.step } : {}),
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},
			});
		}
	}

	onZoneChanged(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				zone: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	onAfter23NewDayChange(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				after23NewDay: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

	onChangeAdjustJieqi(val){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			this.props.onFieldsChange({
				adjustJieqi: {
					value: val,
				},
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},
			});
		}

	}

	changeGeo(rec){
		if(this.props.onFieldsChange){
			let dt = this.tmHook.getValue().value;
			// 选新地点时按新坐标自动校正时区(未在 atlas 内手改时区时)。
			// setZone 仅改时区标签、保留出生钟面时刻(见 DateTime.setZone),不移位时间。
			if(dt && dt.setZone){
				try{
					if(rec.zone){
						dt.setZone(rec.zone);
					}else{
						const ds = dt.format ? dt.format('YYYY-MM-DD') : null;
						const z = dstAwareZoneAt(rec.gpsLat, rec.gpsLng, ds);
						if(z && z.offset){ dt.setZone(z.offset); }
					}
				}catch(e){ /* 推断失败保留原时区 */ }
			}
			this.props.onFieldsChange({
				lon: {
					value: convertLonToStr(rec.lng),
				},
				lat: {
					value: convertLatToStr(rec.lat),
				},
				gpsLon: {
					value: rec.gpsLng
				},
				gpsLat: {
					value: rec.gpsLat
				},
				...geoNameFieldPatch(rec),
				date: {
					value: dt.clone(),
				},
				time:{
					value: dt.clone(),
				},
				ad:{
					value: dt.ad,
				},
				zone:{
					value: dt.zone,
				},

			});
		}
	}

		render(){
			let fields = this.props.fields ? this.props.fields : {};
			let datetm = new DateTime();
			if(fields.date && fields.time){
				let str = fields.date.value.format('YYYY-MM-DD') + ' ' + 
							fields.time.value.format('HH:mm:ss');
				datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
				if(fields.zone){
					datetm.setZone(fields.zone.value);
				}
			}

			return (
				<div className="horosa-bazi-input-stack">
					<div className="horosa-side-panel-heading">
						<div>
							<div className="horosa-side-panel-title">八字设置</div>
							<div className="horosa-side-panel-subtitle">时间、地点与排盘选项</div>
						</div>
					</div>
					<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						className="horosa-bazi-time-control"
						fields={fields}
						value={datetm}
						onTimeChange={this.onTimeChanged}
						timeHook={this.tmHook}
						onGeoChange={this.changeGeo}
					/>
					</XQSideSection>
					<XQSideSection iconName={sideSectionIcon('switches')} title="起盘选项" storageKey="bazi.options" className="horosa-side-input-section">
					<div className="horosa-field-grid">
						<div className="horosa-field-block">
							<div className="horosa-field-label">性别</div>
							<Select value={fields.gender.value} onChange={this.onGenderChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value={-1}>未知</Option>
								<Option value={0}>女</Option>
								<Option value={1}>男</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">时间算法</div>
							<Select value={fields.timeAlg.value} onChange={this.onTimeAlgChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value={0}>真太阳时</Option>
								<Option value={3}>平太阳时</Option>
								<Option value={1}>直接时间</Option>
								<Option value={2}>春分定卯时</Option>
							</Select>
						</div>
					</div>
					<div className="horosa-field-grid">
						<div className="horosa-field-block">
							<div className="horosa-field-label">长生</div>
							<Select value={fields.phaseType.value} onChange={this.onPhaseTypeChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value={0}>长生火土同</Option>
								<Option value={1}>长生水土同</Option>
								<Option value={2}>长生阳顺阴逆</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">神煞查法</div>
							<Select value={fields.godKeyPos.value} onChange={this.onGodKeyPosChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value='年'>按年柱查</Option>
								<Option value='日'>按日柱查</Option>
								<Option value='年日'>年柱日柱都查</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">子时换日</div>
							{/* 用户拍板(见 baziLunarLocal:637): after23NewDay=1「23点算第二天」=日柱守今、时柱跨日; =0「24点算第二天」=日柱与时柱整体进位次日。 */}
							<Select value={fields.after23NewDay.value} onChange={this.onAfter23NewDayChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value={1}>23点算第二天</Option>
								<Option value={0}>24点算第二天</Option>
							</Select>
						</div>
						{/* 节气微调（adjustJieqi）：本地引擎尚未实现该算法（Java 后端是把节气 JDN 平移 (|lat|−35)×2 天），
						    选了不生效 → 暂隐藏该控件，避免误导（字段保留 model 默认 0，不删；待本地实现节气纬度平移后再恢复）。
						<div className="horosa-field-block">
							<div className="horosa-field-label">节气</div>
							<Select size='small' style={{width: '100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown" value={fields.adjustJieqi.value} onChange={this.onChangeAdjustJieqi}>
								<Option value={0}>不调整节气</Option>
								<Option value={1}>按纬度调整</Option>
							</Select>
						</div>
						*/}
						<div className="horosa-field-block">
							<div className="horosa-field-label">命宫起法</div>
							<Select value={(this.props.baziOpt && this.props.baziOpt.minggongMethod) || 'tongxing'} onChange={this.onMingGongMethodChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value="tongxing">通行版</Option>
								<Option value="shufa">子平数法</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">月律分野</div>
							<Select value={(this.props.baziOpt && this.props.baziOpt.fenyeVersion) || 'common'} onChange={this.onFenyeVersionChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value="common">通行版</Option>
								<Option value="fajue">法诀版</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">起运精度</div>
							<Select value={(this.props.baziOpt && this.props.baziOpt.dayunPrecision) || 'precise'} onChange={this.onDayunPrecisionChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value="precise">精确(年月日时)</Option>
								<Option value="integer">整数(取整岁)</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">藏干版本</div>
							<Select value={(this.props.baziOpt && this.props.baziOpt.cangVersion) || 'common'} onChange={this.onCangVersionChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value="common">通行版</Option>
								<Option value="fenye">分野加权</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">生肖归属</div>
							<Select value={(this.props.baziOpt && this.props.baziOpt.zodiacBoundary) || 'lichun'} onChange={this.onZodiacBoundaryChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value="lichun">立春</Option>
								<Option value="lunar">正月初一</Option>
							</Select>
						</div>
					</div>
					</XQSideSection>
					<XQSideSection iconName={sideSectionIcon('school')} title="断命流派" storageKey="bazi.school" className="horosa-side-input-section">
					<div className="horosa-bazi-school-field">
						<div className="horosa-field-label">主用流派</div>
						<Select value={(this.props.baziOpt && this.props.baziOpt.school) || 'zonghe'} onChange={this.onSchoolChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
							<Option value="zonghe">传统综合</Option>
							<Option value="fuyi">扶抑派</Option>
							<Option value="geju">格局派</Option>
							<Option value="tiaohou">调候派</Option>
							<Option value="bingyao">病药派</Option>
							<Option value="mangpai">盲派</Option>
							<Option value="nayin">纳音古法</Option>
						</Select>
					</div>
					</XQSideSection>
					<XQSideSection iconName={sideSectionIcon('display')} title="显示" storageKey="bazi.display" className="horosa-side-input-section">
					<div className="horosa-field-grid">
						<div className="horosa-field-block">
							<div className="horosa-field-label">刑冲破害</div>
							<Select value={this.props.baziOpt.showRelations === false ? 0 : 1} onChange={this.onShowRelationsChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value={1}>显示</Option>
								<Option value={0}>隐藏</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">神煞</div>
							<Select value={this.props.baziOpt.showShenSha === false ? 0 : 1} onChange={this.onShowShenShaChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value={1}>显示</Option>
								<Option value={0}>隐藏</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">小运</div>
							<Select value={this.props.baziOpt.showXiaoyun === false ? 0 : 1} onChange={this.onShowXiaoyunChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value={1}>显示</Option>
								<Option value={0}>隐藏</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">年龄</div>
							<Select value={(this.props.baziOpt && this.props.baziOpt.ageStyle) || 'nominal'} onChange={this.onAgeStyleChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value="nominal">虚岁</Option>
								<Option value="real">周岁</Option>
							</Select>
						</div>
						<div className="horosa-field-block">
							<div className="horosa-field-label">界面样式</div>
							<Select value={this.props.baziOpt.uiMode || 'modern'} onChange={this.onUiModeChange} size='small' style={{width:'100%'}} dropdownMatchSelectWidth={false} dropdownClassName="horosa-bazi-field-dropdown">
								<Option value="modern">新星阙UI</Option>
								<Option value="legacy">旧星阙UI</Option>
							</Select>
						</div>
					</div>
					<div className="horosa-bazi-option-card">
						<Checkbox checked={this.props.baziOpt.onlyZiGanShen} onChange={this.onOnlyZiganChange}>只显示地支藏干十神</Checkbox>
					</div>
					</XQSideSection>
				</div>

			);
		}

}

export default CnTraditionInput;
