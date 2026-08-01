import { Component } from 'react';
import { Row, Col, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import { buildMeaningTipByCategory, } from './AstroMeaningData';
import { termsTableForVariant } from '../../divination/data/hellenisticData';
import { isMeaningEnabled, wrapWithMeaning, } from './AstroMeaningPopover';
import styles from '../../css/styles.less';
import { XQCard as Card } from '../xq-ui';

class AstroLots extends Component{

	constructor(props) {
		super(props);
		this.state = {

		}
		this.genLotsDom = this.genLotsDom.bind(this);
		this.renderTitle = this.renderTitle.bind(this);
		this.showMeaning = this.showMeaning.bind(this);
		this.withLotMeaning = this.withLotMeaning.bind(this);
		this.withPlanetMeaning = this.withPlanetMeaning.bind(this);
		this.withSignMeaning = this.withSignMeaning.bind(this);
		this.withHouseMeaning = this.withHouseMeaning.bind(this);
	}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	withPlanetMeaning(node, objid){
		return wrapWithMeaning(node, this.showMeaning(), buildMeaningTipByCategory('planet', objid));
	}

	withLotMeaning(node, objid){
		return wrapWithMeaning(node, this.showMeaning(), buildMeaningTipByCategory('lot', objid));
	}

	withSignMeaning(node, signid){
		return wrapWithMeaning(node, this.showMeaning(), buildMeaningTipByCategory('sign', signid));
	}

	withHouseMeaning(node, houseid){
		return wrapWithMeaning(node, this.showMeaning(), buildMeaningTipByCategory('house', houseid));
	}

	renderTitle(objid){
		const symbol = AstroText.AstroMsg[objid];
		const hasSymbol = !!symbol && symbol !== '{';
		const label = AstroText.AstroTxtMsg[objid] || AstroText.AstroMsgCN[objid] || objid;
		const titleNode = (
			<span>
				{hasSymbol ? <span style={{fontFamily: AstroConst.AstroFont}}>{symbol}</span> : null}
				<span style={{fontFamily: AstroConst.NormalFont}}>{`(${label})`}</span>
			</span>
		);
		return this.withLotMeaning(titleNode, objid);
	}


	genLotsDom(chartObj){
		let doms = [];
		// 界主按所选界系(含迦勒底,按昼夜;含狮子/双子界内变体),与中间盘界环 / 后端尊贵同口径。
		let _termsTable = termsTableForVariant(
			chartObj.params && chartObj.params.termsVariant,
			chartObj.chart && chartObj.chart.isDiurnal,
			AstroConst.TERMS_TABLES_BY_VARIANT, AstroConst.EGYPTIAN_TERMS,
			chartObj.params);
		for(let i=0; i<AstroConst.LOTS.length; i++){
			let objid = AstroConst.LOTS[i];
			let obj = AstroHelper.getObject(chartObj, objid);
			if(obj === undefined || obj === null){
				continue;
			}

			let titleSpan = 8;
			let ctSpan = 16;

			let stars = AstroHelper.getStars(chartObj, objid);
			let starsDom = null;
			if(stars){
				starsDom = stars.map((item)=>{
					let stardeg = AstroHelper.splitDegree(item[2])
					return (
						<div key={item[0]}>
							{AstroText.AstroMsg[item[0]]}：
							<Popover content={'误差' + Math.round(item[3]*1000) / 1000} >
							<span>{stardeg[0]}</span>
							<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item[1]]}</span>
							<span>{stardeg[1]+"'"}</span>
							</Popover>
						</div>
					);
				});
			}

			let signdeg = AstroHelper.splitDegree(obj.signlon);
			let dom = (
				<Row key={objid}>
					<Col span={24}>
						<Card title={this.renderTitle(objid)}
							bordered={true}
							className="horosa-astro-data-card"
							style={{
								background: 'var(--horosa-astro-panel, transparent)'
							}}>
							<Row gutter={12}>
								<Col span={titleSpan}>落座</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
										<div>
											<span>{signdeg[0] + 'º'}</span>
											{this.withSignMeaning((
												<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[obj.sign]}</span>
											), obj.sign)}
											<span>{signdeg[1]+"'；"}</span>
											{this.withSignMeaning((
												<span style={{fontFamily: AstroConst.AstroFont}}>位于&nbsp;{AstroHelper.whichTerm(obj.sign, signdeg[0], _termsTable)}&nbsp;界</span>
											), obj.sign)}
										</div>
									</Col>
								</Row>
								<Row gutter={12}>
									<Col span={titleSpan}>落宫</Col>
									<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
										{this.withHouseMeaning((
											<span>{AstroText.AstroMsg[obj.house]}</span>
										), obj.house)}
									</Col>
								</Row>
							{
								stars && (
									<Row gutter={12}>
										<Col span={titleSpan}>汇合恒星</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{starsDom}
										</Col>
									</Row>	
								)
							}
						</Card>
					</Col>
				</Row>

			);
			doms.push(dom);
		}
		return doms;
	}


	render(){
		let chart = this.props.value;
		let dom = this.genLotsDom(chart);

		let style;
		if(this.props.fill){
			// fill 模式:占满「希腊点块」的 flex 槽(小而有界),内部自滚;不用内容高(否则希腊点条目一多就会把主星挤没)。
			style = { flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' };
		}else{
			let height = this.props.height ? this.props.height : '100%';
			style = { height: (height-130) + 'px', overflowY:'auto', overflowX:'hidden' };
		}

		return (
			<div className={styles.scrollbar} style={style}>
				{dom}
			</div>
		);
	}
}

export default AstroLots;
