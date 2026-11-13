import { Component } from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { XQCheckItem, XQSettingGroup, XQSettingRow, XQSwitch } from '../xq-ui';

// 相位的中文称呼与全站口径一致(相位表 / 星盘详情:合 · 六合 · 刑 · 拱 · 冲);分主 / 次两组。
const ASP_NAME = {
	[AstroConst.ASP0]: '合',
	[AstroConst.ASP60]: '六合',
	[AstroConst.ASP90]: '刑',
	[AstroConst.ASP120]: '拱',
	[AstroConst.ASP180]: '冲',
	[AstroConst.ASP45]: '半刑',
};
const MAJOR_ASP = [AstroConst.ASP0, AstroConst.ASP60, AstroConst.ASP90, AstroConst.ASP120, AstroConst.ASP180];

export function buildAspGroups(){
	const all = AstroConst.LIST_ASP;
	return [
		{ key: 'major', title: '主相位', hint: '托勒密五相位', items: all.filter((x)=>MAJOR_ASP.includes(x)) },
		{ key: 'minor', title: '次相位', items: all.filter((x)=>!MAJOR_ASP.includes(x)) },
	].filter((g)=>g.items.length);
}


class AspSelector extends Component{

	constructor(props) {
		super(props);

		this.onChange = this.onChange.bind(this);
		this.toggleAspect = this.toggleAspect.bind(this);
	}

	onChange(checkedValues){
		let json = JSON.stringify(checkedValues);
		safeLocalStorageSet(AstroConst.AspKey, json);
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload:{ 
					aspects: checkedValues,
				},
			});		

		}
	}

	getCurrentValue(){
		let val = localStorage.getItem(AstroConst.AspKey);
		if(val === undefined || val === null){
			val = AstroConst.DEFAULT_ASPECTS;
			safeLocalStorageSet(AstroConst.AspKey, JSON.stringify(val));
			return val;
		}
		try{
			return JSON.parse(val);
		}catch(err){
			safeLocalStorageSet(AstroConst.AspKey, JSON.stringify(AstroConst.DEFAULT_ASPECTS));
			return AstroConst.DEFAULT_ASPECTS;
		}
	}

	toggleAspect(item){
		const current = this.getCurrentValue();
		const next = Array.isArray(current) ? current.slice(0) : [];
		const idx = next.indexOf(item);
		if(idx >= 0){
			next.splice(idx, 1);
		}else{
			next.push(item);
		}
		this.onChange(next);
	}

	renderGlyph(item){
		return <span className="xq-pick-glyph" style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item]}</span>;
	}

	render(){
		const cur = this.getCurrentValue();
		const val = Array.isArray(cur) ? cur : [];
		const groups = buildAspGroups();

		// 抽屉:一相位一行(符号 · 度数 · 称呼 + 开关),主 / 次分组。
		if(this.props.layout === 'drawer'){
			return (
				<div className="horosa-selector-drawer horosa-pick-panel">
					<div className="horosa-setting-body">
						{groups.map((g)=>(
							<XQSettingGroup key={g.key} title={g.title} hint={g.hint}>
								{g.items.map((item)=>(
									<XQSettingRow
										key={item}
										className="xq-pick-row"
										label={<span className="xq-pick-item">{this.renderGlyph(item)}<span className="xq-pick-name">{AstroText.AstroTxtMsg[item]}</span><span className="xq-pick-sub">{ASP_NAME[item] || ''}</span></span>}
										control={<XQSwitch size="small" checked={val.indexOf(item) >= 0} onChange={()=>this.toggleAspect(item)} />}
									/>
								))}
							</XQSettingGroup>
						))}
					</div>
				</div>
			);
		}

		// 浮层等窄宿主:同一批项排成紧凑勾选格。
		return (
			<div className="horosa-selector-drawer horosa-pick-panel">
				<div className="xq-pick-grid xq-pick-grid-bare">
					{AstroConst.LIST_ASP.map((item)=>(
						<XQCheckItem key={item} checked={val.indexOf(item) >= 0} onClick={()=>this.toggleAspect(item)}>
							<span className="xq-pick-item">
								{this.renderGlyph(item)}
								<span className="xq-pick-name">{AstroText.AstroTxtMsg[item]}</span>
								<span className="xq-pick-sub">{ASP_NAME[item] || ''}</span>
							</span>
						</XQCheckItem>
					))}
				</div>
			</div>
		);
	}
}

export default AspSelector;
