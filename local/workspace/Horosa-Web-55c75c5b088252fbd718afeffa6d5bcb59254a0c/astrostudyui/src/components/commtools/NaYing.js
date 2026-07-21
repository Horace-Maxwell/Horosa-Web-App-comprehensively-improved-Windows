import { Component } from 'react';
import { Row, Col, Divider } from 'antd';
import { XQSelect as Select } from '../xq-ui';
import { isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import {NaYin, SixtyJiaZi} from '../../constants/ZWConst';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

const { Option } = Select;

export default class NaYing extends Component{
	constructor(props) {
		super(props);

        this.state = {
            naying: {},
            sixty: [],
            ganzi: null,
        }

        this.requestNaying = this.requestNaying.bind(this);
        this.genDom = this.genDom.bind(this);
        this.changeGanzi = this.changeGanzi.bind(this);
    }

	async requestNaying(){
		let params = {}

		const data = await request(`${Constants.ServerRoot}/common/naying`, {
			body: JSON.stringify(params),
		});
		if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
		const result = data[Constants.ResultKey]

		const st = {
			naying: result.naying,
            sixty: result.sixty,
		};

		this.setState(st);
	}

    changeGanzi(val){
        this.setState({
            ganzi: val,
        });
    }

    genDom(){
        let toprols = [];
        let cols = [];
        for(let i in SixtyJiaZi){
            let ganzi = SixtyJiaZi[i];
            let wx = NaYin[ganzi];
            let style = {
                padding: 5,
            }
            if(this.state.ganzi && ganzi === this.state.ganzi){
                style.backgroundColor = 'var(--horosa-accent-soft, #33CCFF)';
            }
            let col = (
                <Col span={24} key={ganzi}><div style={style}>{ganzi}--{wx}</div></Col>
            )
            cols.push(col);
            if(i % 10 === 9){
                let topcol = (
                    <Col key={`group-${i}`} span={4}>
                        <Row>{cols}</Row>
                    </Col>
                );
                toprols.push(topcol);
                cols = [];
            }
        }

        let res = (
            <Row gutter={6}>{toprols}</Row>
        );

        return res;
    }

    componentDidMount(){
 
    }

    render(){
        let dom = this.genDom();
        let opts = SixtyJiaZi.map((item, idx)=>{
            return (
                <Option key={item} value={item}>{item}</Option>
            )
        });

        return (
            <div>
                <Row gutter={12}>
                    <Col offset={12} span={12}>
                        <Select 
                            style={{width: '100%'}}
                            showSearch
                            allowClear
                            value={this.state.ganzi}
                            placeholder='输入干支进行过滤'
                            onChange={this.changeGanzi}
                            filterOption={(input, option) => {
                                return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }}
                        >
                            {opts}
                        </Select>
                    </Col>
                </Row>
                <Divider></Divider>
                {dom}
            </div>
        )
    }
}
