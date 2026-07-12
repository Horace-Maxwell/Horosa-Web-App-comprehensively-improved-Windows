import { Component } from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { XQCheckItem, XQCheckList } from '../xq-ui';


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

	render(){
		let val = this.getCurrentValue();
		let allobjs = AstroConst.LIST_ASP.map((item)=>{
			const checked = Array.isArray(val) && val.indexOf(item) >= 0;
			return (
				<XQCheckItem key={item} checked={checked} onClick={()=>this.toggleAspect(item)}>
						<span>{AstroText.AstroTxtMsg[item]}</span>
						<span style={{fontFamily: AstroConst.AstroFont}}>{'（' + AstroText.AstroMsg[item] + '）'}</span>
				</XQCheckItem>
			);
		});

		return (
			<div className="horosa-selector-drawer">
				<XQCheckList>
					{allobjs}
				</XQCheckList>
			</div>
		);
	}
}

export default AspSelector;
