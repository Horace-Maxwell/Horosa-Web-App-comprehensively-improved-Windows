import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import { bodyPartsOf, degreePosition, } from '../../divination/data/bodyParts';
import AstroLifespan from './AstroLifespan';
import AstroDodeca from './AstroDodeca';
import AstroDispositor from './AstroDispositor';
import { astroSymbol } from './AstroExtraCommon';
import { buildPatternOverview, toOverviewRows, connectionPurityById } from '../../utils/astroPatternOverview';
import { buildMeaningTipByCategory, } from './AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from './AstroMeaningPopover';
import * as Constants from '../../utils/constants';
import { XQSegmented } from '../xq-ui';
import { monomoiriaTriplicity } from '../../divination/data/monomoiriaTriplicity';
import { CLASSICAL_GLOBALS_EVENT } from '../../utils/classicalChartGlobals';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

// G16 单度主星体系:迦勒底连续序(默认,后端算)/ 三分序(保罗式,前端派生)。
const MONOMOIRIA_SYSTEM_OPTIONS = [
	{ value: 'chaldean', label: '迦勒底序' },
	{ value: 'triplicity', label: '三分序' },
];

// WI-02 偕日相 / WI-04 宗派 中文口径(中性词)。
const PHASE_LABEL = { cazimi: '核心', combust: '焦伤', underBeams: '日光束下', free: '自由光' };
const PHASIS_EVENT_LABEL = { morningRising: '晨星初现', eveningSetting: '昏星初没' };
const STATUS_PLANET_IDS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export function resolveAstroDisplayMode(perchart, fields){
	let zodiacal = perchart && perchart.zodiacal ? perchart.zodiacal : null;
	if(zodiacal){
		zodiacal = AstroText.AstroMsg[zodiacal] || zodiacal;
	}else{
		zodiacal = fields ? fields.zodiacal : null;
	}

	let hsys = perchart && perchart.hsys ? perchart.hsys : null;
	if(hsys){
		hsys = AstroText.AstroMsg[hsys] || hsys;
	}else{
		hsys = fields ? fields.hsys : null;
	}

	return {
		zodiacal,
		hsys,
	};
}


class AstroInfo extends Component{

	componentDidMount(){
		// [SURF-3] 古典全局(含 never 键)改档即时重渲右栏:子卡(显赫/寿命/状态盘)自身也各挂监听,
		// 本层监听兜住直接消费面与容器级派生,防「改档右栏恒旧值」。
		this._onClassicalGlobals = () => this.forceUpdate();
		if(typeof window !== 'undefined'){ window.addEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined' && this._onClassicalGlobals){ window.removeEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
	}

	constructor(props) {
		super(props);

		this.planetSet = new Set();
		this.state = {
			monomoiriaSystem: 'chaldean',   // 单度主星体系:默认迦勒底序(与后端字节一致)
		};

		this.fieldsToParams = this.fieldsToParams.bind(this);
		this.genReceptionsDom = this.genReceptionsDom.bind(this);
		this.genMutualDom = this.genMutualDom.bind(this);
		this.getRuleShipText = this.getRuleShipText.bind(this);
		this.genSurroundAttacksDom = this.genSurroundAttacksDom.bind(this);
		this.genSurroundHousesDom = this.genSurroundHousesDom.bind(this);
		this.genSurroundPlanetsDom = this.genSurroundPlanetsDom.bind(this);
		this.genAntisciasDom = this.genAntisciasDom.bind(this);
		this.genOutOfBoundsDom = this.genOutOfBoundsDom.bind(this);
		this.genPhasisDom = this.genPhasisDom.bind(this);
		this.genJoyDom = this.genJoyDom.bind(this);
		this.genSectDom = this.genSectDom.bind(this);
		this.genMansionDom = this.genMansionDom.bind(this);
		this.genDegreeGenderDom = this.genDegreeGenderDom.bind(this);
		this.genDegreeLordsDom = this.genDegreeLordsDom.bind(this);
		this.handleMonomoiriaSystemChange = this.handleMonomoiriaSystemChange.bind(this);
		this.genFeralDom = this.genFeralDom.bind(this);
		this.canDisplayPlanet = this.canDisplayPlanet.bind(this);
		this.genDeclParallelDom = this.genDeclParallelDom.bind(this);
			this.initPlanets = this.initPlanets.bind(this);
			this.planetLabel = this.planetLabel.bind(this);
			this.showMeaning = this.showMeaning.bind(this);
			this.getOnlyRulerExaltReceptionEnabled = this.getOnlyRulerExaltReceptionEnabled.bind(this);
			this.hasRulerOrExalt = this.hasRulerOrExalt.bind(this);
			this.keepReceptionLine = this.keepReceptionLine.bind(this);
			this.keepMutualLine = this.keepMutualLine.bind(this);
		}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	planetLabel(id, chartWrap){
		const text = appendPlanetHouseInfoById(
			AstroText.AstroMsg[id],
			chartWrap,
			id,
			this.props.showPlanetHouseInfo
		);
		const one = splitPlanetHouseInfoText(text);
		const labelNode = (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
				{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
			</span>
		);
		return wrapWithMeaning(labelNode, this.showMeaning(), buildMeaningTipByCategory('planet', id));
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

	getOnlyRulerExaltReceptionEnabled(){
		if(this.props.showOnlyRulExaltReception !== undefined && this.props.showOnlyRulExaltReception !== null){
			return this.props.showOnlyRulExaltReception === 1 || this.props.showOnlyRulExaltReception === true;
		}
		try{
			if(typeof window === 'undefined' || !window.localStorage){
				return false;
			}
			const raw = window.localStorage.getItem(Constants.GlobalSetupKey);
			if(!raw){
				return false;
			}
			const setup = JSON.parse(raw);
			return !!(setup && (setup.showOnlyRulExaltReception === 1 || setup.showOnlyRulExaltReception === true));
		}catch(e){
			return false;
		}
	}

	hasRulerOrExalt(ary){
		if(!ary || !Array.isArray(ary) || ary.length === 0){
			return false;
		}
		for(let i=0; i<ary.length; i++){
			if(ary[i] === 'ruler' || ary[i] === 'exalt'){
				return true;
			}
		}
		return false;
	}

	keepReceptionLine(item, abnormal = false){
		if(!this.getOnlyRulerExaltReceptionEnabled()){
			return true;
		}
		if(!item){
			return false;
		}
		const supplierOk = this.hasRulerOrExalt(item.supplierRulerShip);
		if(!abnormal){
			return supplierOk;
		}
		const beneficiaryOk = this.hasRulerOrExalt(item.beneficiaryDignity);
		return supplierOk || beneficiaryOk;
	}

	keepMutualLine(item){
		if(!this.getOnlyRulerExaltReceptionEnabled()){
			return true;
		}
		if(!item || !item.planetA || !item.planetB){
			return false;
		}
		return this.hasRulerOrExalt(item.planetA.rulerShip) && this.hasRulerOrExalt(item.planetB.rulerShip);
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
					<span style={{fontFamily: AstroConst.AstroFont}} key={obj}>
						<Popover content={'赤纬：' + Math.round(decl * 1000)/1000 + '度' }>
						{this.planetLabel(obj, chart)}&emsp;
						</Popover>
					</span>
				);
				return span;
			});
			let row = (
				<Row gutter={6} key={idx}>
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
					<span style={{fontFamily: AstroConst.AstroFont}} key={obj}>
						<Popover content={'赤纬：' + Math.round(decl * 1000)/1000 + '度' } >
						{this.planetLabel(obj, chart)}&emsp;
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
				<Row gutter={6} key={id}>
					<Col span={8}>
						相对
						<span style={{fontFamily: AstroConst.AstroFont}}>
							<Popover content={'赤纬：' + Math.round(decl * 1000)/1000 + '度' } >
							&nbsp;{this.planetLabel(id, chart)}&nbsp;
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
					<span>{this.planetLabel(obj[0], chart)}</span>&nbsp;与&nbsp;
					<span>{this.planetLabel(obj[1], chart)}</span>&nbsp;成映点&nbsp;
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
					<span>{this.planetLabel(obj[0], chart)}</span>&nbsp;与&nbsp;
					<span>{this.planetLabel(obj[1], chart)}</span>&nbsp;成反映点&nbsp;
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

	// 联结纯粹度标(有情/无情·互换)：据双方「主宰宫∪落宫」是否同属世俗/反世俗({8,12})界。
	purityTag(idA, idB){
		const objs = (this.props.value && this.props.value.chart && this.props.value.chart.objects) || [];
		const p = connectionPurityById(idA, idB, objs);
		if(!p){ return null; }
		const col = p.pure ? 'var(--horosa-jade, #3a9a6a)' : 'var(--horosa-danger, #cf1322)';
		return <span style={{ fontFamily: AstroConst.NormalFont, color: col }}>&nbsp;{p.label}{p.swap ? '·互换' : ''}</span>;
	}

	genReceptionsDom(receptions){
		if(receptions === undefined || receptions === null){
			return null;
		}
		const normal = (receptions.normal || []).filter((item)=>this.keepReceptionLine(item, false));
		const abnormal = (receptions.abnormal || []).filter((item)=>this.keepReceptionLine(item, true));
		if(normal.length === 0 && abnormal.length === 0){
			return null;
		}
		let normaldom = normal.map((item, idx)=>{
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
					<span>{this.planetLabel(item.beneficiary, this.props.value)}</span>&nbsp;被&nbsp;
					<span>{this.planetLabel(item.supplier, this.props.value)}</span>&nbsp;接纳&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>({ruleship})</span>{this.purityTag(item.beneficiary, item.supplier)}
					{
						refuse && (<span>&nbsp;拒绝</span>)
					}
				</div>
			);
			return dom;
		});
		let abnormaldom = abnormal.map((item, idx)=>{
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
					<span>{this.planetLabel(item.beneficiary, this.props.value)}</span>&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>({diginty})</span>&nbsp;被&nbsp;
					<span>{this.planetLabel(item.supplier, this.props.value)}</span>&nbsp;接纳&nbsp;
					<span style={{fontFamily: AstroConst.NormalFont}}>({ruleship})</span>{this.purityTag(item.beneficiary, item.supplier)}
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
		const normal = (mutual.normal || []).filter((item)=>this.keepMutualLine(item));
		const abnormal = (mutual.abnormal || []).filter((item)=>this.keepMutualLine(item));
		if(normal.length === 0 && abnormal.length === 0){
			return null;
		}
		let normaldom = normal.map((item, idx)=>{
			let objA = item.planetA;
			let objB = item.planetB;
			if((!this.canDisplayPlanet(objA.id)) || (!this.canDisplayPlanet(objB.id))){
				return null;
			}
			let rsA = this.getRuleShipText(objA.rulerShip);
			let rsB = this.getRuleShipText(objB.rulerShip);
			let dom = (
				<div key={idx} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{this.planetLabel(objA.id, this.props.value)}</span>&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>({rsA})</span>&nbsp;与&nbsp;
					<span>{this.planetLabel(objB.id, this.props.value)}</span>&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>({rsB})</span>&nbsp;互容{this.purityTag(objA.id, objB.id)}
				</div>
			);
			return dom;

		});
		let abnormaldom = abnormal.map((item, idx)=>{
			let objA = item.planetA;
			let objB = item.planetB;
			if((!this.canDisplayPlanet(objA.id)) || (!this.canDisplayPlanet(objB.id))){
				return null;
			}
			let rsA = this.getRuleShipText(objA.rulerShip);
			let rsB = this.getRuleShipText(objB.rulerShip);
			let dom = (
				<div key={idx} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{this.planetLabel(objA.id, this.props.value)}</span>&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>({rsA})</span>&nbsp;与&nbsp;
					<span>{this.planetLabel(objB.id, this.props.value)}</span>&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>({rsB})</span>&nbsp;互容{this.purityTag(objA.id, objB.id)}
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

	// 围攻详断(《围攻》十六式):三种围 + 春秋势 + 宰执夏冬 + 协防 + 围魏救赵 + 日木互容制约 + 逆行 + 释义。
	genBesiegementDom(list){
		const items = list || [];
		if(!items.length){ return null; }
		const DANGER = 'var(--horosa-danger, #cf1322)';
		const JADE = 'var(--horosa-jade, #3a9a6a)';
		const GOLD = 'var(--horosa-gold, #b8860b)';
		const ACCENT = 'var(--horosa-accent, #6c5ce7)';
		const MUTED = 'var(--horosa-muted, #999)';
		const TYPE_COL = { '围攻': DANGER, '围荣': GOLD, '围耀': ACCENT };
		const SEASON_T = { '春': '春·主宰', '夏': '夏·宰执', '秋': '秋·受制', '冬': '冬·被执', '中': '中' };
		const MEAN_ATK = { Sun: '精神阴暗·心灵扭曲', Moon: '凶死夭折·绝症残疾', Mercury: '智力特异·语言障碍', Venus: '欲望混乱·专断残暴', Jupiter: '世俗无成·离经叛道', Mars: '自身受困崩坏', Saturn: '自身受困崩坏' };
		const badge = (txt, col) => <span style={{ fontSize: 10, color: col, border: `1px solid ${col}`, borderRadius: 4, padding: '0 4px', marginLeft: 4, opacity: 0.92 }}>{txt}</span>;
		return items.map((b, i)=>{
			const col = TYPE_COL[b.kind] || MUTED;
			const mean = b.kind === '围攻' ? (MEAN_ATK[b.target] || '') : (b.kind === '围荣' ? '致富·舒适自由·财帛丰盈' : '致贵·领袖魅力·载众载民');
			// 四季只标围攻者:春/夏(主宰侧,用本围类型色;夏=峰极加粗)、秋/冬(受制侧,玉/灰)。被围星之冬夏由组间关系自明,不另标。
			const seasonStyle = (s)=> (s === '夏' ? { color: col, fontWeight: 700 } : (s === '春' ? { color: col } : (s === '秋' ? { color: JADE } : { color: MUTED })));
			return (
				<div key={`bsg-${i}`} style={{ borderLeft: `3px solid ${col}`, paddingLeft: 9, marginBottom: 9, lineHeight: 1.95 }}>
					<div>
						<strong style={{ color: col }}>{b.kind}</strong><span style={{ color: MUTED, fontSize: 11 }}>（{b.nature}）</span>
						&emsp;{this.planetLabel(b.target, this.props.value)}
						{b.targetRetro ? badge('逆', DANGER) : null}
						{b.severe ? badge('凶剧·见血', DANGER) : null}
					</div>
					<div style={{ fontSize: 12.5 }}>
						{b.besiegers.map((x, j)=>(
							<span key={`b-${i}-${j}`} style={{ marginRight: 12 }}>
								{this.planetLabel(x.id, this.props.value)}
								<span style={{ ...seasonStyle(x.season), marginLeft: 2 }}>{SEASON_T[x.season] || x.season}</span>
								{x.retro ? badge('逆', MUTED) : null}
								{x.restrained && x.restrained.length ? badge('日木制约·凶减半', JADE) : null}
								{x.counterBesieged ? badge('围魏救赵', JADE) : null}
							</span>
						))}
					</div>
					{b.defense && b.defense.length ? (
						<div style={{ fontSize: 12, color: MUTED }}>协防：{b.defense.map((y, k)=>(
							<span key={`d-${i}-${k}`} style={{ marginRight: 10, color: y.strong ? JADE : MUTED }}>{this.planetLabel(y.id, this.props.value)} {y.byBody ? '以身作盾' : '遥光'}·护{y.against ? this.planetLabel(y.against, this.props.value) : y.side}侧{y.strong ? '·强' : '·弱'}{y.selfTrap ? '·自陷' : ''}</span>
						))}</div>
					) : null}
					{mean ? <div style={{ fontSize: 11, color: MUTED, fontStyle: 'italic' }}>{mean}</div> : null}
				</div>
			);
		});
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
				// 被围星 key 在 attacks 内唯一,四类围攻块每星最多各出现一次 → 「星-类别」组合即稳定唯一键。
				let dom = (
					<div key={`${key}-minDelta`} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{this.planetLabel(key, this.props.value)}</span>&nbsp;被&nbsp;
						<span>
							{this.planetLabel(MinDelta[0].id, this.props.value)}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + MinDelta[0].delta} >
								(通过{MinDelta[0].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;与&nbsp;
						<span>
							{this.planetLabel(MinDelta[1].id, this.props.value)}&nbsp;
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
				let dom = (
					<div key={`${key}-marsSaturn`} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{this.planetLabel(key, this.props.value)}</span>&nbsp;被&nbsp;
						<span>
							{this.planetLabel(MarsSaturn[0].id, this.props.value)}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + MarsSaturn[0].delta} >
								(通过{MarsSaturn[0].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;与&nbsp;
						<span>
							{this.planetLabel(MarsSaturn[1].id, this.props.value)}&nbsp;
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
				let dom = (
					<div key={`${key}-sunMoon`} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{this.planetLabel(key, this.props.value)}</span>&nbsp;被&nbsp;
						<span>
							{this.planetLabel(SunMoon[0].id, this.props.value)}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>							
								<Popover content={'误差' + SunMoon[0].delta} >
								(通过{SunMoon[0].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;与&nbsp;
						<span>
							{this.planetLabel(SunMoon[1].id, this.props.value)}&nbsp;
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
				let dom = (
					<div key={`${key}-venusJupiter`} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{this.planetLabel(key, this.props.value)}</span>&nbsp;被&nbsp;
						<span>
							{this.planetLabel(VenusJupiter[0].id, this.props.value)}&nbsp;
							<span style={{fontFamily: AstroConst.NormalFont}}>
								<Popover content={'误差' + VenusJupiter[0].delta} >
								(通过{VenusJupiter[0].aspect}相位)
								</Popover>
							</span>
						</span>&nbsp;与&nbsp;
						<span>
							{this.planetLabel(VenusJupiter[1].id, this.props.value)}&nbsp;
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
				<div key={key} style={{fontFamily: AstroConst.AstroFont}}>
					<span>{this.planetLabel(obj[0].id, this.props.value)}</span>&nbsp;与&nbsp;
					<span>{this.planetLabel(obj[1].id, this.props.value)}</span>&nbsp;夹&nbsp;
					<span>{this.planetLabel(key, this.props.value)}</span>
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
					<div key={key} style={{fontFamily: AstroConst.AstroFont}}>
						<span>{this.planetLabel(AstroConst.SUN, this.props.value)}</span>&nbsp;与&nbsp;
						<span>{this.planetLabel(AstroConst.MOON, this.props.value)}</span>&nbsp;夹&nbsp;
						<span>{this.planetLabel(obj.id, this.props.value)}</span>
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
						<div key={key} style={{fontFamily: AstroConst.AstroFont}}>
							<span>{this.planetLabel(obj.SunMoon[0].id, this.props.value)}</span>&nbsp;与&nbsp;
							<span>{this.planetLabel(obj.SunMoon[1].id, this.props.value)}</span>&nbsp;夹&nbsp;
							<span>{this.planetLabel(key, this.props.value)}</span>
						</div>
					);	
					divs.push(dom);
				}
				if(dom === null && this.canDisplayPlanet(obj[0].id) && this.canDisplayPlanet(obj[1].id)){
					dom = (
						<div key={key} style={{fontFamily: AstroConst.AstroFont}}>
							<span>{this.planetLabel(obj[0].id, this.props.value)}</span>&nbsp;与&nbsp;
							<span>{this.planetLabel(obj[1].id, this.props.value)}</span>&nbsp;夹&nbsp;
							<span>{this.planetLabel(key, this.props.value)}</span>
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

	// 围绕:某星 C 被「紧邻两侧」两星体 A、B 夹持——A、B 分处 C 两侧、过 C 的黄道弧 < 90°、
	// 且 A-C、B-C 间无他星体(取紧邻即自然满足「之间无他星」)。星体取古典七政(日月水金火木土),
	// 与夹星(旧引擎 surround.planets,亦七政)同源,不含外行星/交点/虚点/四角。纯本盘黄经判定。
	genSurroundEncircleDom(perchart){
		let objs = (perchart && perchart.objects) || [];
		const BODY = [AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS,
			AstroConst.JUPITER, AstroConst.SATURN];
		// 几何须用「全七政」,勿先按显示过滤——否则隐藏某传统行星会破坏「A-C/B-C 间无他星」,伪造围绕。
		let bodies = objs.filter((o)=> o && BODY.indexOf(o.id) >= 0 && typeof o.lon === 'number');
		if(bodies.length < 3){ return null; }
		let sorted = bodies.slice().sort((a, b)=> a.lon - b.lon);
		let n = sorted.length;
		let norm = (x)=> ((x % 360) + 360) % 360;
		let rows = [];
		for(let i=0; i<n; i++){
			let mid = sorted[i];
			let left = sorted[(i - 1 + n) % n];   // 紧邻·低黄经侧(环形回绕)
			let right = sorted[(i + 1) % n];        // 紧邻·高黄经侧
			let span = norm(mid.lon - left.lon) + norm(right.lon - mid.lon);   // 过 C 总弧 = A、B 黄道距离
			if(span < 90){
				if(!this.canDisplayPlanet(left.id) || !this.canDisplayPlanet(right.id) || !this.canDisplayPlanet(mid.id)){ continue; }   // 仅渲染层隐藏,不改几何
				rows.push(
					<div key={mid.id} className="horosa-classical-line">
						{this.planetLabel(left.id, this.props.value)}&nbsp;与&nbsp;{this.planetLabel(right.id, this.props.value)}&nbsp;围绕&nbsp;{this.planetLabel(mid.id, this.props.value)}
						<span style={{color: 'var(--horosa-muted, #999)', marginLeft: 6}}>（跨 {span.toFixed(1)}°）</span>
					</div>
				);
			}
		}
		return rows.length ? rows : null;
	}

	// WI-02 偕日相:列星-日关系(核心/焦伤/日光束下/自由光)+ 偕日升没事件。
	genPhasisDom(perchart){
		if(!perchart || !Array.isArray(perchart.objects)){ return null; }
		let rows = [];
		perchart.objects.forEach((obj)=>{
			if(!obj || obj.phase === undefined || obj.phase === null){ return; }
			if(!this.canDisplayPlanet(obj.id)){ return; }
			let ev = obj.phasisEvent ? `（${PHASIS_EVENT_LABEL[obj.phasisEvent] || obj.phasisEvent}）` : '';
			rows.push(
				<div key={obj.id} className="horosa-classical-line">
					{this.planetLabel(obj.id, this.props.value)}&nbsp;{PHASE_LABEL[obj.phase] || obj.phase}
					{obj.phasisElong != null ? <span style={{color:'var(--horosa-muted, #999)'}}>&nbsp;(距日 {Number(obj.phasisElong).toFixed(1)}°)</span> : null}
					{ev}
				</div>
			);
		});
		return rows.length ? rows : null;
	}

	// WI-03 喜乐:列处喜乐宫的行星。
	genJoyDom(perchart){
		if(!perchart || !Array.isArray(perchart.objects)){ return null; }
		let rows = [];
		perchart.objects.forEach((obj)=>{
			if(!obj || !obj.joy){ return; }
			if(!this.canDisplayPlanet(obj.id)){ return; }
			rows.push(
				<div key={obj.id} className="horosa-classical-line">
					{this.planetLabel(obj.id, this.props.value)}&nbsp;喜乐&nbsp;（{obj.joyHouse}宫）
				</div>
			);
		});
		return rows.length ? rows : null;
	}

	// WI-04 宗派:宗派光 + 同宗吉/凶星 + 每星同宗/异宗。
	genSectDom(perchart){
		if(!perchart || !Array.isArray(perchart.objects)){ return null; }
		let day = !!perchart.isDiurnal;
		let lightId = day ? 'Sun' : 'Moon';
		let beneficId = day ? 'Jupiter' : 'Venus';
		let maleficId = day ? 'Saturn' : 'Mars';
		let ofSect = [], contra = [];
		perchart.objects.forEach((obj)=>{
			if(!obj || obj.ofSect === undefined || !this.canDisplayPlanet(obj.id)){ return; }
			(obj.ofSect ? ofSect : contra).push(obj.id);
		});
		const lbl = (id) => <span key={id}>{this.planetLabel(id, this.props.value)}</span>;
		const muted = { color: 'var(--horosa-muted, #999)' };
		const line = (title, ids) => (
			<div key={title} className="horosa-classical-line">
				<span style={muted}>{title}：</span>{ids.length ? ids.map((id)=> <span key={id}>{lbl(id)}&nbsp;</span>) : <span>—</span>}
			</div>
		);
		// 返回数组的前两项各只渲染一次(宗派光 / 同宗吉凶星),字面量键即稳定唯一;后两项由 line() 以标题为键。
		return [
			<div key="sectLight" className="horosa-classical-line"><span style={muted}>宗派光：</span>{lbl(lightId)}&nbsp;（{day ? '日盘' : '夜盘'}）</div>,
			<div key="sectBenefic" className="horosa-classical-line"><span style={muted}>同宗吉/凶星：</span>{lbl(beneficId)}&nbsp;/&nbsp;{lbl(maleficId)}</div>,
			line('同宗', ofSect),
			line('异宗', contra),
		];
	}

	// WI-19 野逸:与七政皆不成托勒密相位的行星。
	genFeralDom(perchart){
		let objs = (perchart && perchart.objects) || [];
		let rows = [];
		STATUS_PLANET_IDS.forEach((id)=>{
			let o = objs.find((x)=> x && x.id === id);
			if(!o || !o.feral || !this.canDisplayPlanet(id)){ return; }
			rows.push(
				<div key={id} className="horosa-classical-line">
					{this.planetLabel(id, this.props.value)}&nbsp;野逸
				</div>
			);
		});
		return rows.length ? rows : null;
	}

	// WI-07 月站:月亮宿 + 上升宿(回归制,0°白羊起;与恒星制 nakshatra 并存勿混)。
	genMansionDom(perchart){
		let objs = (perchart && perchart.objects) || [];
		let find = (id) => objs.find((o)=> o && o.id === id);
		let line = (label, o) => (o && o.mansion) ? (
			<div key={label} style={{marginBottom:2}}>
				<span style={{color:'#999'}}>{label}：</span>第{o.mansion.idx}宿 {o.mansion.cn}<span style={{color:'#999'}}>（{o.mansion.nature} · {o.mansion.use}）</span>
			</div>
		) : null;
		let rows = [line('月亮宿', find('Moon')), line('上升宿', find('Asc'))].filter(Boolean);
		return rows.length ? rows : null;
	}

	handleMonomoiriaSystemChange(e){
		const v = e && e.target ? e.target.value : e;
		this.setState({ monomoiriaSystem: v });
	}

	// WI-14/15/17 度数主星:单度主星(迦勒底序/三分序可切)/ 九分 / 面 / Darijan,逐星一行。
	genDegreeLordsDom(perchart){
		let objs = (perchart && perchart.objects) || [];
		let g = (id) => id ? <span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[id] || id}</span> : <span>—</span>;
		let m = { color: 'var(--horosa-muted, #999)' };
		// 单度主星体系:默认迦勒底序直接用后端算好的 o.monomoiria(字节不变);三分序则前端按昼/夜派生。
		let useTriplicity = this.state.monomoiriaSystem === 'triplicity';
		let isDiurnal = !!(perchart && perchart.isDiurnal);
		let monoOf = (o) => {
			if(useTriplicity && typeof o.lon === 'number'){
				return monomoiriaTriplicity(o.lon, isDiurnal);
			}
			return o.monomoiria;
		};
		let rows = [];
		STATUS_PLANET_IDS.forEach((id)=>{
			let o = objs.find((x)=> x && x.id === id);
			if(!o || !this.canDisplayPlanet(id) || (!o.monomoiria && !o.ninthPart && !o.darijan)){ return; }
			rows.push(
				<div key={id} className="horosa-classical-line">
					{this.planetLabel(id, this.props.value)}&emsp;
					<span style={m}>单度</span>&nbsp;{g(monoOf(o))}&ensp;
					<span style={m}>九分</span>&nbsp;{g(o.ninthPart)}&ensp;
					<span style={m}>面</span>&nbsp;{g(o.dignities && o.dignities.face)}&ensp;
					<span style={m}>Darijan</span>&nbsp;{g(o.darijan)}
				</div>
			);
		});
		return rows.length ? rows : null;
	}

	// WI-09 阳/阴度数:每星所落度的阴阳(男命落阳/女命落阴 增力)。
	genDegreeGenderDom(perchart){
		let objs = (perchart && perchart.objects) || [];
		let rows = [];
		STATUS_PLANET_IDS.forEach((id)=>{
			let o = objs.find((x)=> x && x.id === id);
			if(!o || !o.degreeGender || !this.canDisplayPlanet(id)){ return; }
			rows.push(
				<div key={id} className="horosa-classical-line">
					{this.planetLabel(id, this.props.value)}&nbsp;{o.degreeGender === 'masculine' ? '阳性度' : '阴性度'}
				</div>
			);
		});
		return rows.length ? rows : null;
	}

	// WI-05 度数性质:每星所落度的 明/暗/空/烟(al-Qabisi 录本)。
	genDegreeQualityDom(perchart){
		let objs = (perchart && perchart.objects) || [];
		const Q = { B: '明', D: '暗', E: '空', S: '烟' };
		const TIP = { B: '光明·增吉', D: '黑暗·减力', E: '空虚·中性', S: '烟雾·微凶' };
		const COL = { B: 'var(--horosa-jade, #3a9a6a)', D: 'var(--horosa-danger, #cf1322)', E: 'var(--horosa-muted, #999)', S: 'var(--horosa-gold, #b8860b)' };
		let rows = [];
		STATUS_PLANET_IDS.forEach((id)=>{
			let o = objs.find((x)=> x && x.id === id);
			if(!o || !o.degreeQuality || !this.canDisplayPlanet(id)){ return; }
			let gender = o.degreeGender === 'masculine' ? '阳性度' : (o.degreeGender === 'feminine' ? '阴性度' : '');
			rows.push(
				<div key={id} className="horosa-classical-line">
					{this.planetLabel(id, this.props.value)}&nbsp;<span style={{color: COL[o.degreeQuality]}}>{Q[o.degreeQuality] || o.degreeQuality}</span>
					<span style={{color: 'var(--horosa-muted, #999)', marginLeft: 6}}>{TIP[o.degreeQuality] || ''}</span>
					{gender ? <span style={{color: 'var(--horosa-muted, #999)', marginLeft: 8}}>· {gender}</span> : null}
				</div>
			);
		});
		return rows.length ? rows : null;
	}

	// WI-09 特殊度数:陷度 well / 慢病 azemene / 增福度(行星正落该度)。
	genSpecialDegreeDom(perchart){
		let objs = (perchart && perchart.objects) || [];
		const LBL = { pitted: '陷度', azemene: '慢病度', fortune: '增福度' };
		const TIP = { pitted: '落此度力弱受损', azemene: '主残疾·慢性病', fortune: '吉力增益' };
		const COL = { pitted: 'var(--horosa-danger, #cf1322)', azemene: 'var(--horosa-danger, #cf1322)', fortune: 'var(--horosa-jade, #3a9a6a)' };
		let rows = [];
		STATUS_PLANET_IDS.forEach((id)=>{
			let o = objs.find((x)=> x && x.id === id);
			if(!o || !o.specialDegree || !this.canDisplayPlanet(id)){ return; }
			let tags = Object.keys(o.specialDegree).filter((k)=> o.specialDegree[k]);
			if(!tags.length){ return; }
			rows.push(
				<div key={id} className="horosa-classical-line">
					{this.planetLabel(id, this.props.value)}&nbsp;
					{tags.map((k)=> <span key={k} style={{color: COL[k], marginRight: 8}}>{LBL[k] || k}<span style={{opacity: 0.6, fontSize: 11}}>（{TIP[k]}）</span></span>)}
				</div>
			);
		});
		return rows.length ? rows : null;
	}

	// WI-25/25b 远地点 apogee 升降 + 数增数减 +(月)光增光减:距地渐增=升·趋远地点+数减,渐减=降·趋近地点+数增。
	genApogeeDom(perchart){
		let objs = (perchart && perchart.objects) || [];
		const DIR = { rising: '升·趋远地点', falling: '降·趋近地点' };
		const NUM = { increasing: '数增·渐疾', decreasing: '数减·渐迟' };
		const LIGHT = { waxing: '光增·渐盈', waning: '光减·渐亏' };
		let rows = [];
		STATUS_PLANET_IDS.forEach((id)=>{
			let o = objs.find((x)=> x && x.id === id);
			if(!o || !o.apogeeDir || !this.canDisplayPlanet(id)){ return; }
			let m = { color: 'var(--horosa-muted, #999)' };
			rows.push(
				<div key={id} className="horosa-classical-line">
					{this.planetLabel(id, this.props.value)}&nbsp;
					<span style={{color: o.apogeeDir === 'rising' ? 'var(--horosa-gold, #b8860b)' : 'var(--horosa-jade, #3a9a6a)'}}>{DIR[o.apogeeDir] || o.apogeeDir}</span>
					<span style={{...m, marginLeft: 8}}>{NUM[o.numberTrend] || ''}</span>
					{o.lightTrend ? <span style={{...m, marginLeft: 8}}>{LIGHT[o.lightTrend]}</span> : null}
				</div>
			);
		});
		return rows.length ? rows : null;
	}

	// WI-21 全身部位 melothesia:每星所落星座主管部位 + 度数上中下细分(早度=上/中度=中/晚度=下)。
	genMelothesiaDom(perchart){
		let objs = (perchart && perchart.objects) || [];
		let rows = [];
		STATUS_PLANET_IDS.forEach((id)=>{
			let o = objs.find((x)=> x && x.id === id);
			if(!o || !o.sign || !this.canDisplayPlanet(id)){ return; }
			let parts = bodyPartsOf(String(o.sign).toLowerCase());
			if(!parts || !parts.length){ return; }
			let pos = (o.signlon != null) ? degreePosition(o.signlon) : '';
			rows.push(
				<div key={id} className="horosa-classical-line">
					{this.planetLabel(id, this.props.value)}&emsp;
					{pos ? <span style={{color:'var(--horosa-muted, #999)'}}>{pos}</span> : null}&nbsp;{parts.join('、')}
				</div>
			);
		});
		return rows.length ? rows : null;
	}

	// WI-01 出界:列出 |赤纬|>黄赤交角 的行星(月亮另标远行/回归)。
	genOutOfBoundsDom(perchart){
		if(!perchart || !Array.isArray(perchart.objects)){ return null; }
		let rows = [];
		perchart.objects.forEach((obj)=>{
			if(!obj || !obj.outOfBounds){ return; }
			if(!this.canDisplayPlanet(obj.id)){ return; }
			let modeTxt = (obj.id === 'Moon' && obj.oobMode) ? (obj.oobMode === 'going' ? '（远行）' : '（回归）') : '';
			rows.push(
				<div key={obj.id} className="horosa-classical-line">
					{this.planetLabel(obj.id, this.props.value)}&nbsp;出界&nbsp;+{Number(obj.oobDelta).toFixed(2)}°{modeTxt}
				</div>
			);
		});
		return rows.length ? rows : null;
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
		let besiegeDom = this.genBesiegementDom(chart.surround ? chart.surround.besiegement : []);
		let surhouses = this.genSurroundHousesDom(chart.surround ? chart.surround.houses : {});
		let surplanets = this.genSurroundPlanetsDom(chart.surround ? chart.surround.planets : {});
		let surencircle = this.genSurroundEncircleDom(perchart);

		let height = this.props.height ? this.props.height : '100%';
		let astyle = {
			height: (height-130) + 'px',
			overflowY:'auto', 
			overflowX:'auto',
		};

		const displayMode = resolveAstroDisplayMode(perchart, fields);
		const zodiacal = displayMode.zodiacal;
		const hsys = displayMode.hsys;
		const mode = this.props.mode || 'full';

		if(mode === 'summary'){
			const rows = [
				['名称', chart.params && chart.params.name ? chart.params.name : '本命盘'],
				['出生时间', chart.params ? chart.params.birth : ''],
				['地点', chart.params && chart.params.pos ? chart.params.pos : '未命名地点'],
				['时区', chart.params ? chart.params.zone : fields.zone],
				['黄道', zodiacal],
				['宫位制', hsys],
			];
			// [0j] 极区宫制回退徽记:极圈内象限制(Placidus/Koch 等)数学无解时后端兜底 Porphyry,
			// houses 元素带 hsysFallback(此前静默回退,响应仍标请求宫制,高纬用户看不出宫顶已非所选制)。
			const hFallback = (perchart.houses && perchart.houses[0] && perchart.houses[0].hsysFallback) || null;
			if(hFallback){
				rows.push(['宫制回退', <span key="hfb" style={{ color: 'var(--horosa-warn, #b8860b)', fontFamily: AstroConst.NormalFont }}>⚠ 极区该制无解 · 已回退 {hFallback}</span>]);
			}
			// B3 格局速览(纯本盘数据,无需分析请求):命主星(1R) + 三围(围攻/围荣/围耀) + 互容 + 接纳。
			const SIGN_RULER = { Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon', Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars', Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter' };
			const objs = perchart.objects || [];
			// 🔴 houses 数组按黄经升序排,houses[0] 只在上升落白羊时才是 House1
			// (约 11/12 的盘取错 → 命主星/落宫/落座整行皆错);按 Asc 对象取座,
			// 与 AstroEminence.deriveAlmuten / AstroDispositor 的正确范式对齐。
			const ascObj = objs.find((o)=>o && o.id === 'Asc');
			const ascSign = ascObj ? ascObj.sign
				: ((perchart.houses || []).find((h)=>h && h.id === 'House1') || {}).sign || null;
			const ruler1 = ascSign ? SIGN_RULER[ascSign] : null;
			const ruler1Obj = ruler1 ? objs.find((o)=> o && o.id === ruler1) : null;
			const cn = (id)=> (id ? (AstroText.AstroMsgCN[id] || id) : '--');
			const besg = (chart.surround && chart.surround.besiegement) ? chart.surround.besiegement : [];
			const KIND_COL = { '围攻': 'var(--horosa-danger, #cf1322)', '围荣': 'var(--horosa-gold, #b8860b)', '围耀': 'var(--horosa-accent, #6c5ce7)' };
			// 互容/接纳/先验权力/龙脉/孤月/心性智识/职业/强吉木/主宰循环/后天凶星 —— 均出自 buildPatternOverview(单字符雕文)。
			const ovRows = toOverviewRows(buildPatternOverview(perchart, chart, { onlyRulExalt: this.getOnlyRulerExaltReceptionEnabled() }));
			const TONE_COL = { good: 'var(--horosa-jade, #3a9a6a)', bad: 'var(--horosa-danger, #cf1322)' };
			// 每条目=不折行整体单元;flex-wrap 容器按列间距对齐(消「长接纳串乱折」)。note 按吉凶染色。
			const ovValStyle = { display: 'flex', flexWrap: 'wrap', gap: '3px 13px', fontWeight: 'normal', alignItems: 'baseline' };
			// 一条目=glyph 簇(不折)+ note(长可折):整体 maxWidth 100% + 内部 flex-wrap,长接纳串(如「庙·拒绝·有情·
			// 玄谋世俗·互换」)超出值列时 note 折到下一行,绝不溢出卡片遮挡相邻内容。
			const renderOvItem = (it, i)=> (
				<span key={`ovi-${i}`} style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', maxWidth: '100%' }}>
					<span style={{ whiteSpace: 'nowrap' }}>{(it.parts || []).map((p, j)=> p.g ? <span key={j}>{astroSymbol(p.g)}</span> : <span key={j} style={{ fontFamily: AstroConst.NormalFont, margin: '0 1px' }}>{p.t}</span>)}</span>
					{it.note ? <span style={{ fontFamily: AstroConst.NormalFont, color: TONE_COL[it.tone] || 'var(--horosa-muted, #999)', marginLeft: 3, fontSize: 11, overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{it.note}</span> : null}
				</span>
			);
			const ovEmpty = (txt)=> <span style={{ fontFamily: AstroConst.NormalFont, opacity: 0.5 }}>{txt}</span>;
			return (
				<div className={`horosa-astro-info-scroll horosa-astro-content-scroll ${styles.scrollbar}`} style={astyle}>
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">基本信息</div>
						{rows.map((row)=>(
							<div className="horosa-info-row" key={row[0]}>
								<span>{row[0]}</span>
								<strong>{row[1] || '--'}</strong>
							</div>
						))}
					</div>
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">主星</div>
						<div className="horosa-info-row">
							<span>日主星</span>
							<strong>{perchart.dayerStar ? (AstroText.AstroMsgCN[perchart.dayerStar] || perchart.dayerStar) : '--'}</strong>
						</div>
						<div className="horosa-info-row">
							<span>时主星</span>
							<strong>{perchart.timerStar ? (AstroText.AstroMsgCN[perchart.timerStar] || perchart.timerStar) : '--'}</strong>
						</div>
					</div>
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">格局速览</div>
						<div className="horosa-info-row">
							<span>命主星 1R</span>
							<strong>{ruler1Obj ? <span>{astroSymbol(ruler1)}<span style={{ fontFamily: AstroConst.NormalFont }}> · 落{ruler1Obj.house ? (AstroText.AstroMsgCN[ruler1Obj.house] || AstroText.AstroMsg[ruler1Obj.house] || ruler1Obj.house) : '?'} · {cn(ruler1Obj.sign)}座</span></span> : (ruler1 ? astroSymbol(ruler1) : '--')}</strong>
						</div>
						<div className="horosa-info-row">
							<span>三围</span>
							<div style={ovValStyle}>{besg.length ? besg.map((b, i)=>(
								<span key={`sg-${i}`} style={{ whiteSpace: 'nowrap', color: KIND_COL[b.kind] || 'inherit', fontWeight: 600 }}>{b.kind}{astroSymbol(b.target)}{b.kind === '围攻' && b.severe ? '·凶剧' : ''}</span>
							)) : ovEmpty('无围攻 / 围荣 / 围耀')}</div>
						</div>
						{ovRows.map((row)=>(
							<div className="horosa-info-row" key={`ov-${row.key}`}>
								<span>{row.label}</span>
								<div style={ovValStyle}>{(row.items && row.items.length) ? row.items.map(renderOvItem) : ovEmpty(row.empty || '无')}</div>
							</div>
						))}
					</div>
				</div>
			);
		}

		if(mode === 'classical'){
			const surr = chart.surround || {};
			const declP = chart.declParallel || {};
			// 「有内容」判据:部分 gen* 空数据仍返回空 div(非 null),故按源数据判,空则显示占位。
			const has = {
				anti: !!antiDom,
				decl: !!((declP.parallel || []).length || Object.keys(declP.contraParallel || {}).length),
				recp: !!recpDom,
				mut: !!mutDom,
				attacks: Object.keys((surr && surr.attacks) || {}).length > 0,   // 按源数据判(gen* 空数据仍返空 div,!! 恒真)
				houses: Object.keys(surr.houses || {}).some((k) => (surr.houses[k] || []).length >= 2),
				planets: Object.keys(surr.planets || {}).some((k) => (function(v){ return Array.isArray(v) ? v.length >= 2 : !!(v && (v.SunMoon || v.id)); })(surr.planets[k])),
			};
			const empty = (txt) => <div className="horosa-empty-line">{txt || '暂无'}</div>;
			// 卡片标题双语(中文 + 英文小字):有的人看不懂中文术语。无 subtab,所有卡片依次排列。
			const card = (zh, en, dom, ok, emptyTxt) => (
				<div className="horosa-info-card horosa-classical-card">
					<div className="horosa-classical-card-title">
						<span className="horosa-classical-zh">{zh}</span>
						<span className="horosa-classical-en">{en}</span>
					</div>
					{ok ? dom : empty(emptyTxt)}
				</div>
			);
			// 轻量分节标题(非交互,仅组织视觉)。
			const section = (zh, en) => (
				<div className="horosa-classical-section" key={`sec-${en}`}>
					<span className="horosa-classical-section-zh">{zh}</span>
					<span className="horosa-classical-section-en">{en}</span>
				</div>
			);
			const oobDom = this.genOutOfBoundsDom(perchart);
			const phasisDom = this.genPhasisDom(perchart);
			const joyDom = this.genJoyDom(perchart);
			const sectDom = this.genSectDom(perchart);
			const feralDom = this.genFeralDom(perchart);
			const apogeeDom = this.genApogeeDom(perchart);
			const mansionDom = this.genMansionDom(perchart);
			const degreeQualityDom = this.genDegreeQualityDom(perchart);
			const specialDegreeDom = this.genSpecialDegreeDom(perchart);
			const degreeLordsRows = this.genDegreeLordsDom(perchart);
			// 单度体系切换器 + 逐星行:切换器常驻(便于空数据时也能切),三分序为前端按昼/夜派生。
			const degreeLordsDom = (
				<div>
					<div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
						<span style={{ color: 'var(--horosa-muted, #999)', marginRight: 6 }}>单度体系</span>
						<XQSegmented
							value={this.state.monomoiriaSystem}
							options={MONOMOIRIA_SYSTEM_OPTIONS}
							onChange={this.handleMonomoiriaSystemChange}
						/>
					</div>
					{degreeLordsRows || <div className="horosa-empty-line">暂无</div>}
				</div>
			);
			const melothesiaDom = this.genMelothesiaDom(perchart);
			// 不自带滚动:由外层 AstroChartMain 古典 TabPane 的单一滚动容器统管(避免双层滚动条),
			// 古典卡片与下方寿命/十二分部/定位星同处一条滚动栏。
			return (
				<div className={`horosa-astro-info-scroll horosa-classical-scroll ${styles.scrollbar}`}>
					{/* 既有的关系/配置卡(接纳/互容/围攻/夹宫/夹星/纬照)置顶;映点/反映点已在别处展示,此处不重复。 */}
					{section('格局补充', 'Configurations')}
					{card('接纳', 'Reception', recpDom, has.recp, '暂无接纳信息')}
					{card('互容', 'Mutual Reception', mutDom, has.mut, '暂无互容信息')}
					{card('光线围攻', 'Besiegement by Rays', surattacks, has.attacks, '暂无围攻信息')}
					{card('围攻详断', 'Besiegement Analysis · 三围 / 势 / 极 / 救', besiegeDom, !!besiegeDom, '无围攻/围荣/围耀')}
					{card('夹宫', 'Enclosure by Houses', surhouses, has.houses, '暂无夹宫信息')}
					{card('夹星', 'Enclosure by Planets', surplanets, has.planets, '暂无夹星信息')}
					{card('围绕', 'Encircled by Bodies', surencircle, !!surencircle, '无围绕（紧邻两侧星体跨度 ≥ 90°）')}
					{/* 主宰星链 与 宫神星 归入格局补充 */}
					<AstroDispositor value={this.props.value} />
					{section('相位动态', 'Aspect Dynamics')}
					{card('纬照', 'Declination Parallel', declParaDom, has.decl, '暂无纬照（同/反赤纬）')}
					{/* 以下为本次新增的古典参数(逐行星状态 / 度数),按要求置于最后。 */}
					{section('状态', 'Conditions')}
					{card('出界', 'Out of Bounds', oobDom, !!oobDom, '无行星出界（赤纬皆在黄赤交角内）')}
					{card('偕日相', 'Phasis', phasisDom, !!phasisDom, '暂无（星历未含日月五星）')}
					{card('喜乐', 'Joy', joyDom, !!joyDom, '无行星处其喜乐宫')}
					{card('宗派', 'Sect', sectDom, !!sectDom, '暂无宗派信息')}
					{card('野逸', 'Feral', feralDom, !!feralDom, '无野逸行星（七政皆有相）')}
					{card('远地点', 'Apogee · Number · Light', apogeeDom, !!apogeeDom, '暂无')}
					{/* 行星状态盘 归入状态 */}
					<AstroLifespan value={this.props.value} parts={['status']} />
					{section('度数', 'Degrees')}
					{card('月站', 'Lunar Mansions', mansionDom, !!mansionDom, '暂无月站（回归制，与恒星制 Nakshatra 并存）')}
					{card('度数性质', 'Light / Dark / Empty / Smoky · Gender Degrees', degreeQualityDom, !!degreeQualityDom, '暂无')}
					{card('特殊度数', 'Pitted / Azemene / Fortune Degrees', specialDegreeDom, !!specialDegreeDom, '无行星落陷度/慢病/增福度')}
					{card('度数主星', 'Degree Lords · Monomoiria / Ninth / Face / Darijan', degreeLordsDom, !!degreeLordsDom, '暂无')}
					{/* 十二分度 归入度数 */}
					<AstroDodeca value={this.props.value} />
					{section('医疗', 'Medical')}
					{card('身体部位', 'Melothesia', melothesiaDom, !!melothesiaDom, '暂无')}
					{section('寿命', 'Lifespan')}
					<AstroLifespan value={this.props.value} parts={['method', 'life', 'medical', 'timeline']} />
				</div>
			);
		}

		return (
			<div className={`horosa-astro-info-scroll ${styles.scrollbar}`} style={astyle}>
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
						<span>{zodiacal}，{hsys}</span>&nbsp;
					</Col>
				</Row>
				{perchart.dayerStar || perchart.timerStar ? (
					<Row gutter={12}>
						<Col span={24}>
							{perchart.dayerStar ? <span>日主星：{AstroText.AstroMsgCN[perchart.dayerStar] || perchart.dayerStar}</span> : null}
							{perchart.dayerStar && perchart.timerStar ? <span>&emsp;</span> : null}
							{perchart.timerStar ? <span>时主星：{AstroText.AstroMsgCN[perchart.timerStar] || perchart.timerStar}</span> : null}
						</Col>
					</Row>
				) : null}
				{antiDom}
				{recpDom ? <Divider orientation="left">接纳</Divider> : null}
				{recpDom}
				{mutDom ? <Divider orientation="left">互容</Divider> : null}
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
