import { Component } from 'react';
import { Row, Col, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import {getAzimuthStr} from '../../utils/helper';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import { buildMeaningTipByCategory, } from './AstroMeaningData';
import { termsTableForVariant } from '../../divination/data/hellenisticData';
import { isMeaningEnabled, wrapWithMeaning, } from './AstroMeaningPopover';
import styles from '../../css/styles.less';
import { XQCard as Card } from '../xq-ui';
import * as Constants from '../../utils/constants';   // [WP-9] planetListStyle 读 globalSetup

// WI-02 偕日相中文口径(中性词)。
const PLANET_PHASE_LABEL = { cazimi: '核心', combust: '焦伤', underBeams: '日光束下', free: '自由光' };
const PLANET_PHASIS_EVENT_LABEL = { morningRising: '晨星初现', eveningSetting: '昏星初没' };

class AstroPlanet extends Component{

	constructor(props) {
		super(props);
		this.state = {

		}

		this.genPlanetsDom = this.genPlanetsDom.bind(this);
		this.renderTitle = this.renderTitle.bind(this);
		this.showMeaning = this.showMeaning.bind(this);
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

	withSignMeaning(node, signid){
		return wrapWithMeaning(node, this.showMeaning(), buildMeaningTipByCategory('sign', signid));
	}

	withHouseMeaning(node, houseid){
		return wrapWithMeaning(node, this.showMeaning(), buildMeaningTipByCategory('house', houseid));
	}

	renderTitle(objid, chartObj){
		const text = appendPlanetHouseInfoById(
			AstroText.AstroMsg[objid],
			chartObj,
			objid,
			this.props.showPlanetHouseInfo
		);
		const one = splitPlanetHouseInfoText(text);
		const titleNode = (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
				{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
				<span style={{fontFamily: AstroConst.NormalFont}}>{`(${AstroText.AstroTxtMsg[objid] || objid})`}</span>
			</span>
		);
		return this.withPlanetMeaning(titleNode, objid);
	}


	genPlanetsDom(chartObj){
		let doms = [];
		// [WP-9] 行星列表密度(planetListStyle,globalSetup 持久化;默认 full=现状零回归):
		// degreeOnly=每星一行「符号 名 度数」;glyphOnly=符号 chips 横排。读法照 AstroInfo GlobalSetupKey 先例。
		let listStyle = 'full';
		if(this.props.planetListStyle === 'degreeOnly' || this.props.planetListStyle === 'glyphOnly'){
			listStyle = this.props.planetListStyle;   // 首选 prop(app model 单源,变更即重渲染)
		}else if(this.props.planetListStyle === undefined){
			// 未接 prop 的宿主兜底读 globalSetup(功能可用但不即时);接 prop 的宿主恒走上支。
			try{
				if(typeof window !== 'undefined' && window.localStorage){
					const setup = JSON.parse(window.localStorage.getItem(Constants.GlobalSetupKey) || '{}');
					if(setup && (setup.planetListStyle === 'degreeOnly' || setup.planetListStyle === 'glyphOnly')){
						listStyle = setup.planetListStyle;
					}
				}
			}catch(e){ listStyle = 'full'; }
		}
		if(listStyle === 'glyphOnly'){
			const chips = [];
			for(let i=0; i<AstroConst.LIST_OBJECTS.length; i++){
				const objid = AstroConst.LIST_OBJECTS[i];
				const obj = AstroHelper.getObject(chartObj, objid);
				if(!obj){ continue; }
				chips.push(
					<span key={`pls_${objid}`} title={`${AstroText.AstroTxtMsg[objid] || objid}`}
						style={{ fontFamily: AstroConst.AstroFont, fontSize: 18, padding: '4px 7px' }}>
						{AstroText.AstroMsg[objid]}{AstroText.AstroMsg[obj.sign]}
					</span>
				);
			}
			return [<div key="pls_glyphrow" style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 8 }}>{chips}</div>];
		}
		// 界主显示按所选界系(含迦勒底,按昼夜;含狮子土星优先/双子校勘两界内变体);与中间盘界环、后端尊贵同口径。
		let _termsTable = termsTableForVariant(
			chartObj.params && chartObj.params.termsVariant,
			chartObj.chart && chartObj.chart.isDiurnal,
			AstroConst.TERMS_TABLES_BY_VARIANT, AstroConst.EGYPTIAN_TERMS,
			chartObj.params);
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
			// [WP-9] degreeOnly 档:每星一行(符号+名+星座度数),跳过富卡余下全部行。
			if(listStyle === 'degreeOnly'){
				doms.push(
					<div key={`pls_deg_${objid}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 10px', borderBottom: '1px solid rgba(148,163,184,.14)' }}>
						<span style={{ fontFamily: AstroConst.AstroFont, fontSize: 16 }}>{AstroText.AstroMsg[objid]}</span>
						<span style={{ fontFamily: AstroConst.NormalFont, fontSize: 12.5 }}>{AstroText.AstroTxtMsg[objid] || objid}</span>
						<span style={{ marginLeft: 'auto', fontFamily: AstroConst.NormalFont, fontSize: 12.5 }}>
							{AstroText.AstroMsgCN[obj.sign] || obj.sign} {signdeg[0]}˚{signdeg[1]}′{obj.lonspeed < 0 ? ' ℞' : ''}
						</span>
					</div>
				);
				continue;
			}
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
				govern = AstroText.AstroMsg[obj.governSign];
				if(obj.governPlanets.length > 0){
					govern = govern + ' , ' + AstroHelper.getObjectsText(obj.governPlanets);
				}
			}
			
			let occiTxt = null;
			let orienTxt = null;
			if(chartObj.chart.orientOccident[objid]){
				let occidental = chartObj.chart.orientOccident[objid].occidental;
				let oriental = chartObj.chart.orientOccident[objid].oriental;
				occiTxt = occidental.map((item)=>{
					return item.id;
				});
				orienTxt = oriental.map((item)=>{
					return item.id;
				});
				occiTxt = AstroHelper.getObjectsText(occiTxt);
				orienTxt = AstroHelper.getObjectsText(orienTxt);	
			}

			let stars = AstroHelper.getStars(chartObj, objid);
			let starsDom = null;
			if(stars){
				starsDom = stars.map((item)=>{
					let stardeg = AstroHelper.splitDegree(item[2])
					let sname = item.length > 4 ? item[4] : AstroText.AstroMsg[item[0]];
					return (
						<div key={item[0]}>
							{sname}：
							<Popover content={'误差' + Math.round(item[3]*1000) / 1000} >
							<span>{stardeg[0]}</span>
							<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item[1]]}</span>
							<span>{stardeg[1]+"'"}</span>
							</Popover>
						</div>
					);
				});
			}

			let naksMap = (chartObj.chart && chartObj.chart.nakshatras) || chartObj.nakshatras || null;
			let nak = naksMap ? naksMap[objid] : null;

			let dom = (
				<Row key={objid}>
					<Col span={24}>
						<Card title={this.renderTitle(objid, chartObj)} 
							bordered={true} 
							className="horosa-astro-data-card"
							style={{
								fontFamily: AstroConst.AstroFont,
								background: 'var(--horosa-astro-panel, transparent)'
							}}
						>
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
										{this.withHouseMeaning((
											<span>{AstroText.AstroMsg[obj.house]}</span>
										), obj.house)}
									</Col>
								</Row>
								{
									nak && (
										<Row gutter={12}>
											<Col span={titleSpan}>月宿</Col>
											<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
												{nak.index}. {nak.name}（{nak.label}）P{nak.pada}
												{' · 宿主'}{AstroConst.NAK_LORD_CN[nak.lord] || nak.lord}
											</Col>
										</Row>
									)
								}
							<Row gutter={12}>
								<Col span={titleSpan}>映点</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
										<div>
											<span>{antisigndeg[0] + 'º'}</span>
											{this.withSignMeaning((
												<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[obj.antisciaPoint.sign]}</span>
											), obj.antisciaPoint.sign)}
											<span>{antisigndeg[1]+"'；"}</span>
											{this.withSignMeaning((
												<span style={{fontFamily: AstroConst.AstroFont}}>位于&nbsp;{AstroHelper.whichTerm(obj.antisciaPoint.sign, antisigndeg[0], _termsTable)}&nbsp;界</span>
											), obj.antisciaPoint.sign)}
										</div>
									</Col>
								</Row>
							<Row gutter={12}>
								<Col span={titleSpan}>反映点</Col>
								<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
										<div>
											<span>{cantisigndeg[0] + 'º'}</span>
											{this.withSignMeaning((
												<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[obj.cantisciaPoint.sign]}</span>
											), obj.cantisciaPoint.sign)}
											<span>{cantisigndeg[1]+"'；"}</span>
											{this.withSignMeaning((
												<span style={{fontFamily: AstroConst.AstroFont}}>位于&nbsp;{AstroHelper.whichTerm(obj.cantisciaPoint.sign, cantisigndeg[0], _termsTable)}&nbsp;界</span>
											), obj.cantisciaPoint.sign)}
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
								obj.outOfBounds && (
									<Row gutter={12}>
										<Col span={titleSpan}>出界</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											+{Number(obj.oobDelta).toFixed(2)}°{obj.id === 'Moon' && obj.oobMode ? (obj.oobMode === 'going' ? '（远行）' : '（回归）') : ''}
										</Col>
									</Row>
								)
							}
							{
								obj.phase && (
									<Row gutter={12}>
										<Col span={titleSpan}>偕日相</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{PLANET_PHASE_LABEL[obj.phase] || obj.phase}
											{obj.phasisElong != null ? ` (距日 ${Number(obj.phasisElong).toFixed(1)}°)` : ''}
											{obj.phasisEvent ? `（${PLANET_PHASIS_EVENT_LABEL[obj.phasisEvent] || obj.phasisEvent}）` : ''}
										</Col>
									</Row>
								)
							}
							{
								obj.joy && (
									<Row gutter={12}>
										<Col span={titleSpan}>喜乐</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{obj.joyHouse}宫
										</Col>
									</Row>
								)
							}
							{
								obj.ofSect !== undefined && (
									<Row gutter={12}>
										<Col span={titleSpan}>宗派</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											{obj.ofSect ? '同宗' : '异宗'}
										</Col>
									</Row>
								)
							}
							{
								obj.feral && (
									<Row gutter={12}>
										<Col span={titleSpan}>野逸</Col>
										<Col span={ctSpan} style={{fontFamily: AstroConst.NormalFont}}>
											无相
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

		let style;
		if(this.props.fill){
			// fill 模式:在 flex column 容器里占满「剩余」空间(七政/主星卡片大且可滚),flex-basis:0 让它吃掉希腊点块以外的全部高度。
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

export default AstroPlanet;
