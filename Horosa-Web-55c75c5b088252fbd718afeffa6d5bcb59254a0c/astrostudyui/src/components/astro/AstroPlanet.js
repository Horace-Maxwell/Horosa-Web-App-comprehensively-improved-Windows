import { Component } from 'react';
import { Row, Col, Divider, Popover, Card, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import AstroObjectLabel from './AstroObjectLabel';
import {getAzimuthStr} from '../../utils/helper';
import styles from '../../css/styles.less';

function isEncodedToken(text){
	return /^[A-Za-z0-9${}]$/.test((text || '').trim());
}

function renderObjectListWithMeta(chartObj, ary){
	if(!Array.isArray(ary) || ary.length === 0){
		return null;
	}
	return ary.map((id, idx)=>(
		<span key={`${id || 'obj'}-${idx}`}>
			<AstroObjectLabel id={id} chartSources={chartObj} />
			{
				idx + 1 < ary.length && (
					<span style={{ fontFamily: AstroConst.NormalFont }}>&nbsp;,&nbsp;</span>
				)
			}
		</span>
	));
}

class AstroPlanet extends Component{

	constructor(props) {
		super(props);
		this.state = {

		}

		this.genPlanetsDom = this.genPlanetsDom.bind(this);
	}


	genPlanetsDom(chartObj){
		let doms = [];
		for(let i=0; i<AstroConst.LIST_OBJECTS.length; i++){
			let objid = AstroConst.LIST_OBJECTS[i];
			let obj = AstroHelper.getObject(chartObj, objid);
			if(obj === undefined || obj === null){
				continue;
			}

			let titleSpan = 8;
			let ctSpan = 16;

			let speed = Math.round(obj.lonspeed * 1000) / 1000 + '度';
			if(obj.lonspeed < 0){
				speed = speed + '；逆行';
			}
			let deltaSpeed = Math.abs(obj.lonspeed - obj.meanSpeed);
			if(deltaSpeed > 1){
				if(obj.lonspeed > obj.meanSpeed){
					speed = speed + '; 快速'
				}else{
					speed = speed + '; 慢速'
				}
			}else{
				if(obj.lonspeed < 0.003 && obj.lonspeed > 0){
					speed = speed + '; 停滞'
				}else{
					speed = speed + '; 平均'
				}
			}

			let signdeg = AstroHelper.splitDegree(obj.signlon);
			let antisigndeg = AstroHelper.splitDegree(obj.antisciaPoint.signlon);
			let cantisigndeg = AstroHelper.splitDegree(obj.cantisciaPoint.signlon);

			let dignities = AstroHelper.getDignityText(obj.selfDignity);
			if(dignities){
				if(obj.hayyiz !== 'None'){
					dignities = dignities + ', ' + AstroText.AstroMsg[obj.hayyiz];
				}
				if(obj.isVOC){
					dignities = dignities + ', 空亡' 
				}
			}
			let rulehouses = AstroHelper.getObjectsText(obj.ruleHouses);
			let govern = null;
			if(obj.governSign){
				govern = (
					<span>
						<AstroObjectLabel id={obj.governSign} chartSources={chartObj} />
						{
							Array.isArray(obj.governPlanets) && obj.governPlanets.length > 0 && (
								<span style={{fontFamily: AstroConst.NormalFont}}>&nbsp;,&nbsp;</span>
							)
						}
						{renderObjectListWithMeta(chartObj, obj.governPlanets)}
					</span>
				);
			}
			
			let occiTxt = null;
			let orienTxt = null;
			if(chartObj.chart.orientOccident[objid]){
				let occidental = chartObj.chart.orientOccident[objid].occidental;
				let oriental = chartObj.chart.orientOccident[objid].oriental;
				occiTxt = renderObjectListWithMeta(chartObj, occidental.map((item)=>item.id));
				orienTxt = renderObjectListWithMeta(chartObj, oriental.map((item)=>item.id));	
			}

			let stars = AstroHelper.getStars(chartObj, objid);
			let starsDom = null;
			if(stars){
				starsDom = stars.map((item)=>{
					let stardeg = AstroHelper.splitDegree(item[2])
					let sname = item.length > 4 ? item[4] : AstroText.AstroMsg[item[0]];
					return (
						<div key={item[0]}>
							{
								isEncodedToken(sname) ? (
									<span style={{fontFamily: AstroConst.AstroFont}}>{sname}</span>
								) : (
									<span>{sname}</span>
								)
							}：
							<Popover content={'误差' + Math.round(item[3]*1000) / 1000} >
							<span>{stardeg[0]}</span>
							<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item[1]]}</span>
							<span>{stardeg[1]+"'"}</span>
							</Popover>
						</div>
					);
				});
			}

			let dom = (
				<Row key={objid}>
					<Col span={24}>
						<Card title={(
							<span>
								<AstroObjectLabel id={objid} chartSources={chartObj} />
								<span style={{fontFamily: AstroConst.NormalFont}}>（{AstroText.AstroTxtMsg[objid]}）</span>
							</span>
						)} 
							bordered={true} 
							style={{
								fontFamily: AstroConst.AstroFont,
								background: AstroConst.AstroColor.Backgroud
							}}
						>
							<Row gutter={12}>
								<Col span={titleSpan}>落座</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									<div>
										<span>{signdeg[0] + 'º'}</span>
										<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[obj.sign]}</span>
										<span>{signdeg[1]+"'；"}</span>
										<span style={{fontFamily: AstroConst.AstroFont}}>位于&nbsp;{AstroHelper.whichTerm(obj.sign, signdeg[0])}&nbsp;界</span>
										<span>{signdeg[0] === 29 ? '；位于歧度。' : null}</span>
										{
											obj.isViaCombust && (<span>位于燃烧之路</span>)
										}
										{
											obj.isViaRepression && (<span>位于压抑之路</span>)
										}
									</div>
								</Col>
							</Row>
							<Row gutter={12}>
								<Col span={titleSpan}>落宫</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									{AstroText.AstroMsg[obj.house]}
								</Col>
							</Row>
							<Row gutter={12}>
								<Col span={titleSpan}>映点</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									<div>
										<span>{antisigndeg[0] + 'º'}</span>
										<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[obj.antisciaPoint.sign]}</span>
										<span>{antisigndeg[1]+"'；"}</span>
										<span style={{fontFamily: AstroConst.AstroFont}}>位于&nbsp;{AstroHelper.whichTerm(obj.antisciaPoint.sign, antisigndeg[0])}&nbsp;界</span>
									</div>
								</Col>
							</Row>
							<Row gutter={12}>
								<Col span={titleSpan}>反映点</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									<div>
										<span>{cantisigndeg[0] + 'º'}</span>
										<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[obj.cantisciaPoint.sign]}</span>
										<span>{cantisigndeg[1]+"'；"}</span>
										<span style={{fontFamily: AstroConst.AstroFont}}>位于&nbsp;{AstroHelper.whichTerm(obj.cantisciaPoint.sign, cantisigndeg[0])}&nbsp;界</span>
									</div>
								</Col>
							</Row>
							<Row gutter={12}>
								<Col span={titleSpan}>平均速度</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									{obj.meanSpeed}
								</Col>
							</Row>
							<Row gutter={12}>
								<Col span={titleSpan}>当前速度</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									{speed}
								</Col>
							</Row>
							{
								obj.dignities && (
									<Row gutter={12}>
										<Col span={titleSpan}>禀赋</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{dignities}
										</Col>
									</Row>	
								)
							}
							{
								obj.score !== undefined && (
									<Row gutter={12}>
										<Col span={titleSpan}>分值</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{obj.score}
										</Col>
									</Row>	
								)
							}
							<Row gutter={12}>
								<Col span={titleSpan}>真地平纬度</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									{Math.round(obj.altitudeTrue*1000)/1000}º
								</Col>
							</Row>	
							<Row gutter={12}>
								<Col span={titleSpan}>视地平纬度</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									{Math.round(obj.altitudeAppa*1000)/1000}º
								</Col>
							</Row>	
							<Row gutter={12}>
								<Col span={titleSpan}>地坪经度</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									{getAzimuthStr(obj.azimuth)}
								</Col>
							</Row>	

							<Row gutter={12}>
								<Col span={titleSpan}>黄经</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									{Math.round(obj.lon*1000)/1000}º
								</Col>
							</Row>	
							<Row gutter={12}>
								<Col span={titleSpan}>黄纬</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
									{Math.round(obj.lat*1000)/1000}º
								</Col>
							</Row>	
							{
								obj.ra !== undefined && (
									<Row gutter={12}>
										<Col span={titleSpan}>赤经</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{Math.round(obj.ra*1000)/1000}º
										</Col>
									</Row>	
								)
							}
							{
								obj.decl !== undefined && (
									<Row gutter={12}>
										<Col span={titleSpan}>赤纬</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{Math.round(obj.decl*1000)/1000}º
										</Col>
									</Row>	
								)
							}
							{
								obj.moonPhase !== undefined && (
									<Row gutter={12}>
										<Col span={titleSpan}>月限</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{AstroText.AstroMsg[obj.moonPhase]}
										</Col>
									</Row>	
								)
							}
							{
								obj.sunPos !== undefined && (
									<Row gutter={12}>
										<Col span={titleSpan}>太阳关系</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{AstroText.AstroMsg[obj.sunPos]}
										</Col>
									</Row>	
								)
							}
							{
								obj.ruleHouses && (
									<Row gutter={12}>
										<Col span={titleSpan}>入垣宫</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{rulehouses}
										</Col>
									</Row>	
								)
							}
							{
								obj.exaltHouse && (
									<Row gutter={12}>
										<Col span={titleSpan}>擢升宫</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{AstroText.AstroMsg[obj.exaltHouse]}
										</Col>
									</Row>	
								)
							}
							{
								obj.governSign && (
									<Row gutter={12}>
										<Col span={titleSpan}>宰制星座</Col>
										<Col span={ctSpan}>
											{govern}
										</Col>
									</Row>	
								)
							}
							{
								<div>
									<Row gutter={12}>
										<Col span={titleSpan}>东出星</Col>
										<Col span={ctSpan}>
											{orienTxt}
										</Col>
									</Row>	
									<Row gutter={12}>
										<Col span={titleSpan}>西入星</Col>
										<Col span={ctSpan}>
											{occiTxt}
										</Col>
									</Row>	
								</div>
							}
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
		let dom = this.genPlanetsDom(chart);

		let height = this.props.height ? this.props.height : '100%';
		let style = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		return (
			<div className={styles.scrollbar} style={style}>
				{dom}
			</div>
		);
	}
}

export default AstroPlanet;
