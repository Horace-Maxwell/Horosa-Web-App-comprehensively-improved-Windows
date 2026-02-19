import { Component } from 'react';
import { Row, Col, Tabs, DatePicker, Input, Button, Card, Select } from 'antd';
import CnTraditionInput from './CnTraditionInput';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import PaiBaZi from './PaiBaZi';
import Gods from './Gods';
import GanHeCong from './GanHeCong';
import ZiHeCong from './ZiHeCong';
import MainDirection from './MainDirection';
import SmallDirection from './SmallDirection';
import MainDirectionSimple from './MainDirectionSimple';
import BaZiZhangSheng from './BaZiZhangSheng';
import FourZhuGuaDesc from './FourZhuGuaDesc';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';

const TabPane = Tabs.TabPane;

const BaZiOptKey = 'baziopt';

function gzText(zhu){
	if(!zhu){
		return '';
	}
	const gan = zhu.stem && zhu.stem.cell ? zhu.stem.cell : '';
	const zhi = zhu.branch && zhu.branch.cell ? zhu.branch.cell : '';
	const relGan = zhu.stem && zhu.stem.relative ? `，干十神:${zhu.stem.relative}` : '';
	const relZhi = zhu.branch && zhu.branch.relative ? `，支十神:${zhu.branch.relative}` : '';
	return `${gan}${zhi}${relGan}${relZhi}`;
}

function buildBaziSnapshotText(params, result){
	const bazi = result && result.bazi ? result.bazi : {};
	const four = bazi.fourColumns || {};
	const lines = [];
	const labelMap = {
		gender: {
			'-1': '未知',
			'0': '女',
			'1': '男',
		},
		timeAlg: {
			'0': '真太阳时',
			'1': '直接时间',
			'2': '春分定卯时',
		},
		adjustJieqi: {
			'0': '不调整节气',
			'1': '节气按纬度调整',
		},
	};
	const getGz = (item)=>{
		if(!item){
			return '';
		}
		return item.ganzhi || item.ganzi || item.ganZhi || '';
	};
	const formatLabel = (dictName, value)=>{
		const dict = labelMap[dictName] || {};
		const key = `${value}`;
		if(dict[key] !== undefined){
			return dict[key];
		}
		return value;
	};
	const getNongliLine = (nongli)=>{
		if(!nongli){
			return '';
		}
		const leap = nongli.leap ? '闰' : '';
		return `${nongli.year || ''}年${leap}${nongli.month || ''}${nongli.day || ''}`;
	};
	const appendIf = (label, value)=>{
		if(value === undefined || value === null || value === ''){
			return;
		}
		lines.push(`${label}：${value}`);
	};
	const collectGodNames = (node)=>{
		if(!node){
			return [];
		}
		const all = [];
		if(Array.isArray(node.goodGods)){
			all.push(...node.goodGods);
		}
		if(Array.isArray(node.neutralGods)){
			all.push(...node.neutralGods);
		}
		if(Array.isArray(node.badGods)){
			all.push(...node.badGods);
		}
		return all.filter(Boolean);
	};
	const gzGodText = (zhu)=>{
		if(!zhu){
			return '无';
		}
		const whole = collectGodNames(zhu);
		const stem = collectGodNames(zhu.stem);
		const branch = collectGodNames(zhu.branch);
		const taiSui = zhu.branch && Array.isArray(zhu.branch.taisuiGods) ? zhu.branch.taisuiGods.filter(Boolean) : [];
		const wholeTxt = whole.length ? whole.join('、') : '无';
		const stemTxt = stem.length ? stem.join('、') : '无';
		const branchTxt = branch.length ? branch.join('、') : '无';
		const taiSuiTxt = taiSui.length ? taiSui.join('、') : '无';
		return `整柱=${wholeTxt}；天干=${stemTxt}；地支=${branchTxt}；太岁=${taiSuiTxt}`;
	};
	let baziGender = bazi && bazi.gender === 'Female' ? '坤造' : (bazi && bazi.gender === 'Male' ? '乾造' : '');
	if(!baziGender){
		if(Number(params.gender) === 0){
			baziGender = '坤造';
		}else if(Number(params.gender) === 1){
			baziGender = '乾造';
		}
	}

	lines.push('[起盘信息]');
	appendIf('日期', `${params.date} ${params.time}`);
	appendIf('时区', params.zone);
	appendIf('经纬度', `${params.lon} ${params.lat}`);
	appendIf('性别', formatLabel('gender', params.gender));
	appendIf('时间算法', formatLabel('timeAlg', params.timeAlg));
	appendIf('节气修正', formatLabel('adjustJieqi', params.adjustJieqi));
	appendIf('命造', baziGender);
	const nongli = bazi && bazi.nongli ? bazi.nongli : {};
	const nltxt = getNongliLine(nongli);
	const realtm = nongli.birth || `${params.date} ${params.time}`;
	lines.push(`农历：${nltxt || '未知'} 真太阳时：${realtm || '未知'}`);
	const jiedelta = nongli.jiedelta || '';
	const chef = nongli.chef || '';
	const tiaohou = Array.isArray(bazi.tiaohou) ? bazi.tiaohou.join('，') : '';
	const fixedLine = [jiedelta, chef].filter(Boolean).join('，');
	const fixedBase = (fixedLine || '立春后信息：无').replace(/[；，\s]+$/g, '');
	lines.push(`${fixedBase}； 调候：${tiaohou || '无'}`);

	lines.push('');
	lines.push('[四柱与三元]');
	lines.push(`年柱：${gzText(four.year)}`);
	lines.push(`月柱：${gzText(four.month)}`);
	lines.push(`日柱：${gzText(four.day)}`);
	lines.push(`时柱：${gzText(four.time)}`);
	lines.push(`胎元：${gzText(four.tai)}`);
	lines.push(`命宫：${gzText(four.ming)}`);
	lines.push(`身宫：${gzText(four.shen)}`);

	lines.push('');
	lines.push('[神煞（四柱与三元）]');
	lines.push(`年柱：${gzGodText(four.year)}`);
	lines.push(`月柱：${gzGodText(four.month)}`);
	lines.push(`日柱：${gzGodText(four.day)}`);
	lines.push(`时柱：${gzGodText(four.time)}`);
	lines.push(`胎元：${gzGodText(four.tai)}`);
	lines.push(`命宫：${gzGodText(four.ming)}`);
	lines.push(`身宫：${gzGodText(four.shen)}`);

	if(bazi.mainDirection && bazi.mainDirection.length){
		lines.push('');
		lines.push('[大运]');
		bazi.mainDirection.forEach((item, idx)=>{
			const y = item.year !== undefined ? `${item.year}` : '';
			const gz = getGz(item);
			lines.push(`第${idx + 1}步：${y} ${gz}`);
		});
	}

	if(bazi.direction && bazi.direction.length){
		lines.push('');
		lines.push('[流年行运概略]');
		bazi.direction.forEach((block, idx)=>{
			const startYear = block && block.startYear !== undefined ? `${block.startYear}` : '';
			const startAge = block && block.age !== undefined ? `${block.age}` : '';
			const dayunGz = getGz(block ? block.mainDirect : null);
			const startYearNum = block && block.startYear !== undefined ? Number(block.startYear) : null;
			const yearGzs = (block && block.subDirect && block.subDirect.length ? block.subDirect : [])
				.map((sub, subIdx)=>{
					const gz = getGz(sub);
					if(!gz){
						return '';
					}
					const yearNum = Number.isFinite(startYearNum) ? startYearNum + subIdx : null;
					if(Number.isFinite(yearNum)){
						return `${yearNum}-${gz}`;
					}
					return gz;
				})
				.filter(Boolean);
			lines.push(`板块${idx + 1}：起始年${startYear}，起始年龄${startAge}岁，大运${dayunGz}`);
			if(yearGzs.length){
				lines.push(`流年：${yearGzs.join(' ')}`);
			}
		});
	}
	return lines.join('\n');
}

class BaZi extends Component{
	constructor(props) {
		super(props);

		let bzopt = localStorage.getItem(BaZiOptKey);
		if(bzopt){
			bzopt = JSON.parse(bzopt);
		}else{
			bzopt = {
				onlyZiGanShen: true,
			};
		}	

		this.state = {
			result: null,
			baziOpt: bzopt,
		};

		this.unmounted = false;

		this.requestBazi = this.requestBazi.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onBaziOptChange = this.onBaziOptChange.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.requestBazi(fields);
			};
		}

	}

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			let flds = {
				fields: {
					...this.props.fields,
					...field,
				}
			};
			this.props.dispatch({
				type: 'astro/save',
				payload: flds
			});
			this.requestBazi(flds.fields);
		}
	}
	
	onBaziOptChange(opt){
		this.setState({
			baziOpt: opt,
		}, ()=>{
			localStorage.setItem(BaZiOptKey, JSON.stringify(opt));
		});
	}

	genParams(fields){
		let flds = fields ? fields : this.props.fields;
		const params = {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			gender: flds.gender.value,
			timeAlg: flds.timeAlg.value,
			phaseType: flds.phaseType.value,
			godKeyPos: flds.godKeyPos.value,
			after23NewDay: flds.after23NewDay.value,
			adjustJieqi: flds.adjustJieqi.value,
		}
		return params;
	}

	async requestBazi(fields){
		if(fields === undefined || fields === null){
			return;
		}
		const params = this.genParams(fields);

		const data = await request(`${Constants.ServerRoot}/bazi/direct`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			result: result,
		};

		this.setState(st);
		saveModuleAISnapshot('bazi', buildBaziSnapshotText(params, result), {
			date: params.date,
			time: params.time,
			zone: params.zone,
			lon: params.lon,
			lat: params.lat,
		});
	}


	componentDidMount(){
		this.unmounted = false;
		if(this.props.fields){
			this.requestBazi(this.props.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 80px)'
		}else{
			height = height - 80;
		}
		let tabHeight = height - 20;

		let bazi = this.state.result ? this.state.result.bazi : {};

		return (
			<div>
				<Row gutter={6}>
					<Col span={13}>
						<PaiBaZi value={bazi} height={height+140} fields={this.props.fields} baziOpt={this.state.baziOpt} />
					</Col>
					<Col span={11}>
						<Row>
							<Col span={24}>
								<CnTraditionInput 
									fields={this.props.fields} 
									baziOpt={this.state.baziOpt}
									onFieldsChange={this.onFieldsChange}
									onBaziOptChange={this.onBaziOptChange}
								/>
							</Col>
							<Col span={24}>
								<Tabs defaultActiveKey="0" tabPosition='top'>
									<TabPane tab="行运概略" key="0">
										<MainDirectionSimple value={bazi} height={tabHeight} />
									</TabPane>
									<TabPane tab="卦释" key="1">
										<FourZhuGuaDesc value={bazi.fourColumns} height={tabHeight} />
									</TabPane>
									<TabPane tab="十二长生" key="2">
										<BaZiZhangSheng value={bazi} height={tabHeight} />
									</TabPane>
									<TabPane tab="神煞" key="3">
										<Gods value={bazi.fourColumns} height={tabHeight} />
									</TabPane>
									<TabPane tab="大运" key="4">
										<MainDirection value={bazi} height={tabHeight} />
									</TabPane>
									<TabPane tab="小运" key="5">
										<SmallDirection value={bazi} height={tabHeight} />
									</TabPane>
									<TabPane tab="天干" key="6">
										<GanHeCong value={bazi.fourColumns} height={tabHeight} />
									</TabPane>
									<TabPane tab="地支" key="7">
										<ZiHeCong value={bazi.fourColumns} height={tabHeight} />
									</TabPane>
								</Tabs>
							</Col>
						</Row>
					</Col>
				</Row>
			</div>
		);
	}

}

export default BaZi;
