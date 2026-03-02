import { Component } from 'react';
import { Row, Col, Button, Divider, Select, } from 'antd';
import { randomStr, isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import styles from '../../css/styles.less';

const { Option } = Select;

export default class CuanGong12Desc extends Component{
	constructor(props) {
		super(props);

        this.state = {
            starSu: [],
            stars: [],
            typeSu: null,
        }

        this.requestData = this.requestData.bind(this);
        this.genDom = this.genDom.bind(this);
        this.genSuDom = this.genSuDom.bind(this);
    }

	async requestData(){
		let params = {}

		const data = await request(`${Constants.ServerRoot}/common/gong12gods`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			stars: result.stars,
            starSu: result.starSu,
            typeSu: result.starTypeSu,
		};

		this.setState(st);
	}

    genSuDom(){
        if(this.state.starSu === undefined || this.state.starSu === null){
            return null;
        }
        let lis = this.state.starSu.map((item, idx)=>{
            return (
                <li key={randomStr(8)}>
                    <h4>{item.name}：</h4>{item.event}
                    <div>{item.mind}</div>
                </li>
            )
        });

        let typelis = [];
        if(this.state.typeSu){
            for(let key in this.state.typeSu){
                let val = this.state.typeSu[key];
                let li = (
                    <li key={randomStr(8)}>
                        <h4>{key}：</h4>{val}
                    </li>
                );
                typelis.push(li);
            }
        }

        let res = (
            <div>
                <ul>
                    {lis}
                </ul>
                <hr />
                <ul>
                    {typelis}
                </ul>
            </div>
        );

        return res;
    }

    genDom(){
        if(this.state.stars === undefined || this.state.stars === null){
            return null;
        }
        let lis = this.state.stars.map((item, idx)=>{
            return (
                <li key={randomStr(8)}>
                    <h4>{item.name}：</h4>{item.event}
                </li>
            )
        });

        let res = (
            <ul>
                {lis}
            </ul>
        );

        return res;
    }

    componentDidMount(){
        this.requestData();
    }

    render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight;
		let style = {
			height: (height-200) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

        let sudom = this.genSuDom();
        let dom = this.genDom();

        return (
            <div className={styles.scrollbar} style={style}>
                <Row>
                    <Col span={12}>
                        <Divider orientation='left'>苏国圣十二串宫</Divider>
                        {sudom}
                    </Col>
                    <Col span={12}>
                        <Divider orientation='left'>金镖门十二串宫</Divider>
                        {dom}                        
                    </Col>
                </Row>
            </div>
        )
    }
}
