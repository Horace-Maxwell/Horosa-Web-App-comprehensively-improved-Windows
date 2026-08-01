import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { getAllLines, getAsteroidLines } from './AcgHelper';
import { XQButton, XQCheckItem, XQCheckList, XQToolbar } from '../xq-ui';



class AstroLinesSelector extends Component{

	constructor(props) {
		super(props);

		this.lines = getAllLines();
		this.asteroidLines = getAsteroidLines();

		this.onChange = this.onChange.bind(this);
		this.removeAll = this.removeAll.bind(this);
		this.selectAll = this.selectAll.bind(this);
		this.toggleLine = this.toggleLine.bind(this);

	}

	selectAll(){
		if(this.props.onChange){
			this.props.onChange(this.lines);
		}
	}

	removeAll(){
		if(this.props.onChange){
			this.props.onChange([]);
		}
	}

	onChange(checkedValues){
		if(this.props.onChange){
			this.props.onChange(checkedValues);
		}
	}

	toggleLine(line){
		const current = Array.isArray(this.props.value) ? this.props.value.slice(0) : [];
		const idx = current.indexOf(line);
		if(idx >= 0){
			current.splice(idx, 1);
		}else{
			current.push(line);
		}
		this.onChange(current);
	}

	renderItem(itm, activeLines, withCn){
		let parts = itm.split(':');
		let planet = parts[0];
		let ang = parts[1];
		return (
			<XQCheckItem
				key={itm}
				checked={activeLines.includes(itm)}
				onClick={()=>this.toggleLine(itm)}
			>
				<span style={{fontFamily: AstroConst.AstroFont, fontSize:'135%'}}>
					{AstroText.AstroMsg[planet]}&nbsp;
					{AstroText.AstroMsg['Asp0']}&nbsp;
					{AstroText.AstroMsg[ang]}
				</span>
				{withCn ? <span style={{fontSize:'11px', opacity:0.7, marginLeft:6}}>{AstroText.AstroMsgCN[planet]}</span> : null}
			</XQCheckItem>
		);
	}

	render(){
		const activeLines = Array.isArray(this.props.value) ? this.props.value : [];

		return (
			<div className="horosa-selector-drawer horosa-acg-lines-selector">
				<XQToolbar className="horosa-acg-lines-toolbar">
					<XQButton size="small" onClick={this.selectAll}>全选</XQButton>
					<XQButton size="small" onClick={this.removeAll}>全部清除</XQButton>
				</XQToolbar>
				<XQCheckList columns={2}>
					{this.lines.map((itm)=> this.renderItem(itm, activeLines, false))}
				</XQCheckList>
				<div style={{ fontSize: 12, opacity: 0.6, fontWeight: 600, letterSpacing: '0.03em', margin: '14px 0 6px', paddingTop: 10, borderTop: '1px solid rgba(215,173,105,0.18)' }}>小行星（勾选即启用）</div>
				<XQCheckList columns={2}>
					{this.asteroidLines.map((itm)=> this.renderItem(itm, activeLines, true))}
				</XQCheckList>
			</div>
		);
	}

}

export default AstroLinesSelector;
