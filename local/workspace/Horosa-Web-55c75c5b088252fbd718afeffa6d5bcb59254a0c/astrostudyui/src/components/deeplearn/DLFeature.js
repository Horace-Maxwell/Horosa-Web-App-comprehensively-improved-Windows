import { Component } from 'react';
import { Row, Col, Tabs, Popconfirm, Button,  Input, Select,InputNumber, Divider } from 'antd';
import * as AstroText from '../../constants/AstroText';
import { randomStr, isNumber} from '../../utils/helper';
import styles from '../../css/styles.less';


const { Option }=Select;
const TabPane = Tabs.TabPane;

class DLFeature extends Component{

	constructor(props) {
		super(props);
		this.state = {
			type: 0,
		};

		this.returnToList = this.returnToList.bind(this);
		this.submit = this.submit.bind(this);
		this.genEventDom = this.genEventDom.bind(this);
		this.changeEvt = this.changeEvt.bind(this);
	}

	returnToList(){
		if(this.props.dispatch){
			this.props.dispatch({
                type: 'astro/openDrawer',
                payload: {
					key: 'chartlist'
				},
			});
		}
	}

	submit(){
		if(this.props.dispatch){
			this.props.dispatch({
                type: 'astro/deeplearn',
                payload: {},
			});
		}
	}

	changeEvt(valsmap, key, val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		if(typeof val === 'string' && !isNumber(val)){
			return;
		}

		if(this.props.dispatch && this.props.deeplearn){
			valsmap[key] = val;
			let dl = {
				...this.props.deeplearn,
			};

			this.props.dispatch({
                type: 'astro/save',
                payload: {
					deeplearn: dl,
				},
			});
		}
	}

	genEventDom(evts, vals){
		let cols = [];
		let lblspan = 8;
		let ctxspan = 4;
		for(let key in evts){
			let rec = evts[key];
			let lbldom = (
				<Col span={lblspan} key={randomStr(8)}>{rec.label}</Col>
			);
			cols.push(lbldom);
			if(rec.type === 0){
				let ctxdom = (
					<Col span={ctxspan} key={randomStr(8)}>
						<Select value={vals[key]} size='small' style={{width: '80%'}} onChange={(val)=>{ this.changeEvt(vals, key, val); }}>
							<Option value={0}>否</Option>
							<Option value={1}>是</Option>
						</Select>
					</Col>
				);
				cols.push(ctxdom);
			}else if(rec.type === 1){
				let ctxdom = (
					<Col span={ctxspan} key={randomStr(8)}>
						<InputNumber min={0} step={1} value={vals[key]} size='small' style={{width: '80%'}} onChange={(val)=>{ this.changeEvt(vals, key, val); }}/>
					</Col>
				);
				cols.push(ctxdom);
			}
		}

		let dom = (
			<Row key={randomStr(8)} gutter={6}>
				{cols}
			</Row>
		);

		return dom;
	}

	render(){
		let dtstr = this.props.birth.value.format('yyyy-MM-dd HH:mm:ss');
		let txt = `${AstroText.Gender[this.props.gender.value+'']}，经度：${this.props.lon.value}，纬度：${this.props.lat.value}，时区：${this.props.zone.value}，出生时间：${dtstr}`
		
		let height = this.props.height ? this.props.height : 760;
		height = height - 80;
		let divstyle = {
			height: (height-70)+'px',
			overflowY: 'auto', 
			overflowX: 'hidden',
		};

		let familyDom = null;
		let richesDom = null;
		let careerDom = null;
		let deathDom = null;
		if(this.props.deeplearn){
			let dl = this.props.deeplearn;
			familyDom = this.genEventDom(dl.Evt10000, dl.Val10000);
			richesDom = this.genEventDom(dl.Evt20000, dl.Val20000);
			careerDom = this.genEventDom(dl.Evt30000, dl.Val30000);
			deathDom = this.genEventDom(dl.Evt40000, dl.Val40000);
		}

		return (
			<div>
				<div>
					<span style={{fontWeight: 'bolder'}}>{txt}</span>
				</div>

				<div style={{marginBottom: 20}}>
				<Tabs 
					defaultActiveKey='riches' tabPosition='top'
					style={{ height: height }}
				>
					<TabPane tab="六亲" key="family">
						<div style={divstyle} className={styles.scrollbar} >
							{familyDom}
						</div>
					</TabPane>
					<TabPane tab="富贵程度" key="riches">
						<div style={divstyle} className={styles.scrollbar} >
							{richesDom}
						</div>
					</TabPane>
					<TabPane tab="职业" key="career">
						<div style={divstyle} className={styles.scrollbar} >
							{careerDom}
						</div>
					</TabPane>
					<TabPane tab="死亡方式" key="death">
						<div style={divstyle} className={styles.scrollbar} >
							{deathDom}
						</div>
					</TabPane>
				</Tabs>

				</div>

				<Row>
					<Col span={4}>
						<Button onClick={this.returnToList}>返回列表</Button>
					</Col>
					<Col offset={16} span={4}>
						<Button type='primary' onClick={this.submit}>提交</Button>
					</Col>
				</Row>

			</div>
		)
	}
}

export default DLFeature;

