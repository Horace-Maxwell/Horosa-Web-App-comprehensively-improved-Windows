import { Component } from 'react';
import { Row, Col, Button, Divider, Select, } from 'antd';
import { randomStr, isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import {NaYin, SixtyJiaZi} from '../../constants/ZWConst';

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
                style.backgroundColor = '#33CCFF';
            }
            let col = (
                <Col span={24} key={randomStr(8)}><div style={style}>{ganzi}--{wx}</div></Col>
            )
            cols.push(col);
            if(i % 10 === 9){
                let topcol = (
                    <Col key={randomStr(8)} span={4}>
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
                <Option key={randomStr(8)} value={item}>{item}</Option>
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