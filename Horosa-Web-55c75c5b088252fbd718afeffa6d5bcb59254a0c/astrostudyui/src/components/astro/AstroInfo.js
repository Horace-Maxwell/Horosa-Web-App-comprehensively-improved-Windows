import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { randomStr} from '../../utils/helper'
import styles from '../../css/styles.less';


class AstroInfo extends Component{

	constructor(props) {
		super(props);

		this.planetSet = new Set();
		this.state = {

		};

		this.fieldsToParams = this.fieldsToParams.bind(this);
		this.genReceptionsDom = this.genReceptionsDom.bind(this);
		this.genMutualDom = this.genMutualDom.bind(this);
		this.getRuleShipText = this.getRuleShipText.bind(this);
		this.genSurroundAttacksDom = this.genSurroundAttacksDom.bind(this);
		this.genSurroundHousesDom = this.genSurroundHousesDom.bind(this);
		this.genSurroundPlanetsDom = this.genSurroundPlanetsDom.bind(this);
		this.genAntisciasDom = this.genAntisciasDom.bind(this);
		this.canDisplayPlanet = this.canDisplayPlanet.bind(this);
		this.genDeclParallelDom = this.genDeclParallelDom.bind(this);
		this.initPlanets = this.initPlanets.bind(this);
	}

	fieldsToParams(){
		let fields = this.props.fields;
		if(fields === undefined || fields === null){
			return {
				date: null,
				time: null,
				zone: null,
				lat: null,
				lon: null,
				hsys: null,
				zodiacal: null,
			};
		}
		const params = {
			date: fields.date.value ? fields.date.value.format('YYYY-MM-DD') : null,
			time: fields.time.value ? fields.time.value.format('HH:mm:ss') : null,
			zone: fields.zone.value,
			lat: fields.lat.value,
			lon: fields.lon.value,
			hsys: AstroConst.HouseSys[fields.hsys.value],
			zodiacal: AstroText.AstroMsg[AstroConst.ZODIACAL[fields.zodiacal.value]],
			tradition: fields.tradition.value,
			strongRecption: fields.strongRecption.value,
			simpleAsp: fields.simpleAsp.value,
			virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
			predictive: fields.predictive.value,
			pdaspects: fields.pdaspects.value,
		};
	
		return params;
	
	}

	canDisplayPlanet(planteId){
		if(this.planetSet.size === 0){
			return true;
		}
		return this.planetSet.has(planteId);
	}

	getRuleShipText(ary){
		let res = ary.map((item)=>{
			return AstroText.AstroMsg[item];
		});
		return res.join('+');
	}

	initPlanets(chart){
		if(chart.planets){
			return;
		}
		chart.planets = {};
		for(let i=0; i<chart.objects.length; i++){
			let obj = chart.objects[i];
			chart.planets[obj.id] = obj;
		}
	}

	genDeclParallelDom(chart, declParallel){
		if(chart === undefined || declParallel === undefined){
			return null;
		}
		this.initPlanets(chart);

		let rows = declParallel.parallel.map((item, idx)=>{
			let objs = item.map((obj, oidx)=>{
				let decl = chart.planets[obj].decl;
				let span = (
					<span style={{fontFamily: AstroConst.AstroFont}} key={randomStr(8)}>
						<Popover content={'赤纬：' + Math.round(decl * 1000)/1000 + '度' }>
						{AstroText.AstroMsg[obj]}&emsp;
						</Popover>
					</span>
				);
				return span;
			});
			let row = (
				<Row gutter={6} key={randomStr(8)}>
					<Col span={8}>平行星体{idx+1}</Col>
					<Col span={16}>
						{objs}
					</Col>
				</Row>
			);
			return row;
		});

		let crows = [];
		for(let id in declParallel.contraParallel){
			let planet = declParallel.contraParallel[id];
			let objs = planet.map((obj, idx)=>{
				let decl = chart.planets[obj].decl;
				let span = (
					<span style={{fontFamily: AstroConst.AstroFont}} key={randomStr(8)}>
						<Popover content={'赤纬：' + Math.round(decl * 1000)/1000 + '度' } >
						{AstroText.AstroMsg[obj]}&emsp;
						</Popover>
					</span>
				);
				return span;
			});
			if(objs === null || objs.length === null || objs.length === 0){
				continue;
			}
			let decl = chart.planets[id].decl;
			let row = (
				<Row gutter={6} key={randomStr(8)}>
					<Col span={8}>
						相对
						<span style={{fontFamily: AstroConst.AstroFont}}>
							<Popover content={'赤纬：' + Math.round(decl * 1000)/1000 + '度' } >
							&nbsp;{AstroText.AstroMsg[id]}&nbsp;
							</Popover>
						</span>
						星体
					</Col>
					<Col span={16}>
						{objs}
					</Col>
				</Row>
			);
			crows.push(row);
		}

		let dom = (
			<div>
				{rows}
				<br />
				{crows}
			</div>
		);

		return dom;
	}

	genAntisciasDom(chart){
		if(chart === undefined || chart.antiscias === undefined || chart.antiscias === null){
			return null;
		}
		let anti = chart.antiscias;
		if(anti.antiscia.length === 0 && anti.cantiscia.length === 0){
			return null;
		}

		let divs = [];
		for(let idx=0; idx<anti.antiscia.length; idx++){
			let obj = anti.antiscia[idx];
			if((!this.canDisplayPlanet(obj[0])) || (!this.canDisplayPlanet(obj[1]))){
				continue;
			}
			let dom = (
				<div key={idx} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{AstroText.AstroMsg[obj[0]]}</span>&nbsp;与&nbsp;
					<span>{AstroText.AstroMsg[obj[1]]}</span>&nbsp;成映点&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>误差{Math.round(obj[2] * 1000) / 1000}</span>
				</div>
			);
			divs.push(dom);
		}
		let sz = anti.antiscia.length;
		for(let idx=0; idx<anti.cantiscia.length; idx++){
			let obj = anti.cantiscia[idx];
			if((!this.canDisplayPlanet(obj[0])) || (!this.canDisplayPlanet(obj[1]))){
				continue;
			}
			let dom = (
				<div key={idx+sz} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{AstroText.AstroMsg[obj[0]]}</span>&nbsp;与&nbsp;
					<span>{AstroText.AstroMsg[obj[1]]}</span>&nbsp;成反映点&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>误差{Math.round(obj[2] * 1000) / 1000}</span>
				</div>
			);
			divs.push(dom);
		}

		let dom = (
			<div>
				<Divider orientation="left">映点/反映点</Divider>
				<Row>
					<Col span={24}>{divs}</Col>
				</Row>
			</div>
		);

		return dom;
	}

	genReceptionsDom(receptions){
		if(receptions === undefined || receptions === null){
			return null;
		}
		let normaldom = receptions.normal.map((item, idx)=>{
			let ruleship = this.getRuleShipText(item.supplierRulerShip);
			if((!this.canDisplayPlanet(item.beneficiary)) || (!this.canDisplayPlanet(item.supplier))){
				return null;
			}

			let refuse = false;
			for(let i=0; i<item.supplierRulerShip.length; i++){
				if(item.supplierRulerShip[i] === 'exile' || item.supplierRulerShip[i] === 'fall'){
					refuse = true;
					break;
				}
			}

			let dom = (
				<div key={idx} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{AstroText.AstroMsg[item.beneficiary]}</span>&nbsp;被&nbsp;
					<span>{AstroText.AstroMsg[item.supplier]}</span>&nbsp;接纳&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>({ruleship})</span>
					{
						refuse && (<span>&nbsp;拒绝</span>)
					}
				</div>
			);
			return dom;
		});
		let abnormaldom = receptions.abnormal.map((item, idx)=>{
			if((!this.canDisplayPlanet(item.beneficiary)) || (!this.canDisplayPlanet(item.supplier))){
				return null;
			}

			let refuse = false;
			for(let i=0; i<item.supplierRulerShip.length; i++){
				if(item.supplierRulerShip[i] === 'exile' || item.supplierRulerShip[i] === 'fall'){
					refuse = true;
					break;
				}
			}

			let ruleship = this.getRuleShipText(item.supplierRulerShip);
			let diginty = this.getRuleShipText(item.beneficiaryDignity);
			let dom = (
				<div key={idx} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{AstroText.AstroMsg[item.beneficiary]}</span>&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>({diginty})</span>&nbsp;被&nbsp;
					<span>{AstroText.AstroMsg[item.supplier]}</span>&nbsp;接纳&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>({ruleship})</span>
					{
						refuse && (<span>&nbsp;拒绝</span>)
					}				
				</div>
			);
			return dom;
		});
		let dom = (
			<div>
				<Row><Col span={24}>正接纳：</Col></Row>
				<Row>
					<Col span={24}>{normaldom}</Col>
				</Row>
				<Row style={{marginTop: 5}}><Col span={24}>邪接纳：</Col></Row>
				<Row>
					<Col span={24}>{abnormaldom}</Col>
				</Row>
			</div>
		);

		return dom;
	}

	genMutualDom(mutual){
		if(mutual === undefined || mutual === null){
			return null;
		}
		let normaldom = mutual.normal.map((item, idx)=>{
			let objA = item.planetA;
			let objB = item.planetB;
			if((!this.canDisplayPlanet(objA.id)) || (!this.canDisplayPlanet(objB.id))){
				return null;
			}
			let rsA = this.getRuleShipText(objA.rulerShip);
			let rsB = this.getRuleShipText(objB.rulerShip);
			let dom = (
				<div key={idx} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{AstroText.AstroMsg[objA.id]}</span>&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>({rsA})</span>&nbsp;与&nbsp;
					<span>{AstroText.AstroMsg[objB.id]}</span>&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>({rsB})</span>&nbsp;互容
				</div>
			);
			return dom;

		});
		let abnormaldom = mutual.abnormal.map((item, idx)=>{
			let objA = item.planetA;
			let objB = item.planetB;
			if((!this.canDisplayPlanet(objA.id)) || (!this.canDisplayPlanet(objB.id))){
				return null;
			}
			let rsA = this.getRuleShipText(objA.rulerShip);
			let rsB = this.getRuleShipText(objB.rulerShip);
			let dom = (
				<div key={idx} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{AstroText.AstroMsg[objA.id]}</span>&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>({rsA})</span>&nbsp;与&nbsp;
					<span>{AstroText.AstroMsg[objB.id]}</span>&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>({rsB})</span>&nbsp;互容
				</div>
			);
			return dom;
		});
		let dom = (
			<div>
				<Row><Col span={24}>正互容：</Col></Row>
				<Row>
					<Col span={24}>{normaldom}</Col>
				</Row>
				<Row style={{marginTop: 5}}><Col span={24}>邪互容：</Col></Row>
				<Row>
					<Col span={24}>{abnormaldom}</Col>
				</Row>
			</div>
		);
		return dom;
	}

	genSurroundAttacksDom(attacks){
		let divs = [];
		let idx = 0;
		for(let key in attacks){
			let planet = attacks[key];
			let MarsSaturn = planet.MarsSaturn;
			let SunMoon = planet.SunMoon;
			let VenusJupiter = planet.VenusJupiter;
			let MinDelta = planet.MinDelta;
			if(!this.canDisplayPlanet(key)){
				continue;
			}
			if(this.canDisplayPlanet(MinDelta[0].id) && this.canDisplayPlanet(MinDelta[1].id)){
				let dom = (
					<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{AstroText.AstroMsg[key]}</span>&nbsp;被&nbsp;
						<span>
							{AstroText.AstroMsg[MinDelta[0].id]}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + MinDelta[0].delta} >
								(通过{MinDelta[0].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;与&nbsp;
						<span>
							{AstroText.AstroMsg[MinDelta[1].id]}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + MinDelta[1].delta} >
								(通过{MinDelta[1].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;围攻&nbsp;
					</div>
				);
				divs.push(dom);	
			}

			if(MarsSaturn.length > 0 && this.canDisplayPlanet(MarsSaturn[0].id) && this.canDisplayPlanet(MarsSaturn[1].id)){
				dom = (
					<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{AstroText.AstroMsg[key]}</span>&nbsp;被&nbsp;
						<span>
							{AstroText.AstroMsg[MarsSaturn[0].id]}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + MarsSaturn[0].delta} >
								(通过{MarsSaturn[0].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;与&nbsp;
						<span>
							{AstroText.AstroMsg[MarsSaturn[1].id]}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + MarsSaturn[1].delta} >
								(通过{MarsSaturn[1].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;围攻&nbsp;
					</div>
				);
				divs.push(dom);
			}
			if(SunMoon.length > 0 && this.canDisplayPlanet(SunMoon[0].id) && this.canDisplayPlanet(SunMoon[1].id)){
				dom = (
					<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{AstroText.AstroMsg[key]}</span>&nbsp;被&nbsp;
						<span>
							{AstroText.AstroMsg[SunMoon[0].id]}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>							
								<Popover content={'误差' + SunMoon[0].delta} >
								(通过{SunMoon[0].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;与&nbsp;
						<span>
							{AstroText.AstroMsg[SunMoon[1].id]}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + SunMoon[1].delta} >
								(通过{SunMoon[1].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;围攻&nbsp;
					</div>
				);
				divs.push(dom);
			}
			if(VenusJupiter.length > 0 && this.canDisplayPlanet(VenusJupiter[0].id) && this.canDisplayPlanet(VenusJupiter[1].id)){
				dom = (
					<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{AstroText.AstroMsg[key]}</span>&nbsp;被&nbsp;
						<span>
							{AstroText.AstroMsg[VenusJupiter[0].id]}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + VenusJupiter[0].delta} >
								(通过{VenusJupiter[0].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;与&nbsp;
						<span>
							{AstroText.AstroMsg[VenusJupiter[1].id]}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + VenusJupiter[1].delta} >
								(通过{VenusJupiter[1].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;围攻&nbsp;
					</div>
				);
				divs.push(dom);
			}
		}

		let dom = (
			<div>
				<Row>
					<Col span={24}>{divs}</Col>
				</Row>
			</div>
		);
		return dom;
	}

	genSurroundHousesDom(houses){
		let divs = [];
		for(let key in houses){
			let obj = houses[key];
			if(obj === null || obj.length === 0){
				continue;
			}
			if(!this.canDisplayPlanet(obj[0].id) || !this.canDisplayPlanet(obj[1].id)){
				continue;
			}
			let dom = (
				<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{AstroText.AstroMsg[obj[0].id]}</span>&nbsp;与&nbsp;
					<span>{AstroText.AstroMsg[obj[1].id]}</span>&nbsp;夹&nbsp;
					<span>{AstroText.AstroMsg[key]}</span>
				</div>
			);
			divs.push(dom);
		}
		let dom = (
			<div>
				<Row>
					<Col span={24}>{divs}</Col>
				</Row>
			</div>
		);
		return dom;
	}

	genSurroundPlanetsDom(planets){
		let divs = [];
		for(let key in planets){
			let obj = planets[key];
			if(obj === null || obj.length === 0){
				continue;
			}
			if(key === 'BySunMoon' && this.canDisplayPlanet(obj.id)){
				let dom = (
					<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{AstroText.AstroMsg[AstroConst.SUN]}</span>&nbsp;与&nbsp;
						<span>{AstroText.AstroMsg[AstroConst.MOON]}</span>&nbsp;夹&nbsp;
						<span>{AstroText.AstroMsg[obj.id]}</span>
					</div>
				);
				divs.push(dom);
			}else{
				if(!this.canDisplayPlanet(key)){
					continue;
				}
				let dom = null;
				if(obj.SunMoon){
					dom = (
						<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
							<span>{AstroText.AstroMsg[obj.SunMoon[0].id]}</span>&nbsp;与&nbsp;
							<span>{AstroText.AstroMsg[obj.SunMoon[1].id]}</span>&nbsp;夹&nbsp;
							<span>{AstroText.AstroMsg[key]}</span>
						</div>
					);	
					divs.push(dom);
				}
				if(dom === null && this.canDisplayPlanet(obj[0].id) && this.canDisplayPlanet(obj[1].id)){
					dom = (
						<div key={randomStr(8)} style={{fontFamily: AstroConst.AstroFont}}>
							<span>{AstroText.AstroMsg[obj[0].id]}</span>&nbsp;与&nbsp;
							<span>{AstroText.AstroMsg[obj[1].id]}</span>&nbsp;夹&nbsp;
							<span>{AstroText.AstroMsg[key]}</span>
						</div>
					);	
					divs.push(dom);
				}
			}
		}
		let dom = (
			<div>
				<Row>
					<Col span={24}>{divs}</Col>
				</Row>
			</div>
		);
		return dom;
	}

	render(){
		this.planetSet = new Set();
		if(this.props.planetDisplay){
			for(let i=0; i<this.props.planetDisplay.length; i++){
				this.planetSet.add(this.props.planetDisplay[i]);
			}
		}

		let fields = this.fieldsToParams();
		let chart = this.props.value ? this.props.value : {};
		let perchart = chart.chart ? chart.chart : {};

		let declParaDom = this.genDeclParallelDom(chart.chart, chart.declParallel);
		let antiDom = this.genAntisciasDom(chart.chart)
		let recpDom = this.genReceptionsDom(chart.receptions);
		let mutDom = this.genMutualDom(chart.mutuals);
		let surattacks = this.genSurroundAttacksDom(chart.surround ? chart.surround.attacks : {});
		let surhouses = this.genSurroundHousesDom(chart.surround ? chart.surround.houses : {});
		let surplanets = this.genSurroundPlanetsDom(chart.surround ? chart.surround.planets : {});

		let height = this.props.height ? this.props.height : '100%';
		let astyle = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		let zodiacal = perchart.zodiacal;
		if(zodiacal){
			zodiacal = AstroText.AstroMsg[zodiacal];
		}else{
			zodiacal = fields.zodiacal;
		}

		let hsys = perchart.hsys;
		if(hsys){
			hsys = AstroText.AstroMsg[hsys];
		}else{
			hsys = fields.hsys
		}

		return (
			<div className={styles.scrollbar} style={astyle}>
				<Row gutter={12}>
					<Col span={24}>
						<span>{perchart.isDiurnal ? '日生盘' : '夜生盘'}</span>&nbsp;
					</Col>
				</Row>
				<Row gutter={12}>
					<Col span={24}>
						<span>{chart.params ? chart.params.birth : ''}</span>&nbsp;
					</Col>
				</Row>
				<Row gutter={12}>
					<Col span={24}>
						<span>经度：{fields.lon}</span>&emsp;
						<span>纬度：{fields.lat}</span>
					</Col>
				</Row>
				<Row gutter={12}>
					<Col span={24}>
						<span>{zodiacal}，{fields.hsys}</span>&nbsp;
					</Col>
				</Row>
				{antiDom}
				<Divider orientation="left">接纳</Divider>
				{recpDom}
				<Divider orientation="left">互容</Divider>
				{mutDom}
				<Divider orientation="left">光线围攻</Divider>
				{surattacks}
				<Divider orientation="left">夹宫</Divider>
				{surhouses}
				<Divider orientation="left">夹星</Divider>
				{surplanets}
				<Divider orientation="left">纬照</Divider>
				{declParaDom}

			</div>
		);
	}
}

export default AstroInfo;
