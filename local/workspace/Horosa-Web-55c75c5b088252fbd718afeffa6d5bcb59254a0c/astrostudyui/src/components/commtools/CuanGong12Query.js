import { Component } from 'react';
import { Row, Col, Divider, Popover} from 'antd';
import { XQSelect as Select } from '../xq-ui';
import { isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

const { Option } = Select;

const GZConst = [
    '子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥',
    '甲','乙','丙','丁','戊','己','庚','辛','壬','癸'
];

export default class CuanGong12Query extends Component{
	constructor(props) {
		super(props);

        this.state = {
            ganSu: [],
            ziSu: [],
            gan: [],
            zi: [],

            gz: null,
        }

        this.requestData = this.requestData.bind(this);
        this.changeGanzi = this.changeGanzi.bind(this);
        this.genOptions = this.genOptions.bind(this);
        this.genZiSuDom = this.genZiSuDom.bind(this);
        this.genGanSuDom = this.genGanSuDom.bind(this);
        this.genZiDom = this.genZiDom.bind(this);
        this.genGanDom = this.genGanDom.bind(this);
    }

	async requestData(){
        if(this.state.gz === null){
            return;
        }
		let params = {
            "干支": this.state.gz,
        }

		const data = await request(`${Constants.ServerRoot}/common/gong12`, {
			body: JSON.stringify(params),
		});
		if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
		const result = data[Constants.ResultKey]

        let gong12 = result.gong12;

		const st = {
			ganSu: gong12['干苏'],
            ziSu: gong12['支苏'],
            gan: gong12['干'],
            zi: gong12['支'],
		};

		this.setState(st);
	}

    changeGanzi(val){
        this.setState({
            gz: val,
        }, ()=>{
            this.requestData();
        });
    }

    genOptions(){
        let opts = GZConst.map((item, idx)=>{
            return (
                <Option key={item} value={item}>{item}</Option>
            )
        });
        return opts;
    }

    genGanSuDom(){
        let cols = this.state.ganSu.map((item, idx)=>{
            let tip = (
                <div style={{width: 200}}>
                    {item.event}
                    <div>{item.mind}</div>
                </div>
            )
            return (
                <Col key={idx} span={5}>
                    <span style={{fontWeight: 'bold'}}>{GZConst[idx+12]}：</span>
                    <Popover content={tip}>
                        {item.name}
                    </Popover>
                </Col>
            )
        });
        return (
            <Row gutter={8}>
                {cols}
            </Row>
        )
    }

    genZiSuDom(){
        let cols = this.state.ziSu.map((item, idx)=>{
            let tip = (
                <div style={{width: 200}}>
                    {item.event}
                    <div>{item.mind}</div>
                </div>
            )
            return (
                <Col key={idx} span={5}>
                    <span style={{fontWeight: 'bold'}}>{GZConst[idx]}：</span>
                    <Popover content={tip}>
                        {item.name}
                    </Popover>
                </Col>
            )
        });
        return (
            <Row gutter={8}>
                {cols}
            </Row>
        )
    }

    genGanDom(){
        let cols = this.state.gan.map((item, idx)=>{
            let tip = (
                <div style={{width: 200}}>
                    {item.event}
                </div>
            )
            return (
                <Col key={idx} span={5}>
                    <span style={{fontWeight: 'bold'}}>{GZConst[idx+12]}：</span>
                    <Popover content={tip}>
                        {item.name}
                    </Popover>
                </Col>
            )
        });
        return (
            <Row gutter={8}>
                {cols}
            </Row>
        )
    }

    genZiDom(){
        let cols = this.state.zi.map((item, idx)=>{
            let tip = (
                <div style={{width: 200}}>
                    {item.event}
                </div>
            )
            return (
                <Col key={idx} span={5}>
                    <span style={{fontWeight: 'bold'}}>{GZConst[idx]}：</span>
                    <Popover content={tip}>
                        {item.name}
                    </Popover>
                </Col>
            )
        });
        return (
            <Row gutter={8}>
                {cols}
            </Row>
        )
    }

    render(){
        let opts = this.genOptions();
        let ganSuDom = this.genGanSuDom();
        let ziSuDom = this.genZiSuDom();
        let ganDom = this.genGanDom();
        let ziDom = this.genZiDom();

        return (
            <div>
                <Row gutter={16}>
                    <Col span={4}>太岁基点：</Col>
                    <Col span={4}>
                        <Select value={this.state.gz} onChange={this.changeGanzi} size='small' style={{width: '100%'}}>
                            {opts}
                        </Select>
                    </Col>
                </Row>
                <Row gutter={6}>
                    <Col span={12}>
                        <Divider orientation='left'>苏国圣十二串宫</Divider>
                        {ganSuDom}
                        <Divider />
                        {ziSuDom}
                    </Col>
                    <Col span={12}>
                        <Divider orientation='left'>金镖门十二串宫</Divider>
                        {ganDom}
                        <Divider />
                        {ziDom}
                    </Col>
                </Row>
            </div>
        )
    }

}
