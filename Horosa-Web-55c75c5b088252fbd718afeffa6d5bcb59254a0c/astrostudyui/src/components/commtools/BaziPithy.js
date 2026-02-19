import { Component } from 'react';
import { Row, Col, Button, Divider, Select, } from 'antd';
import { randomStr, isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import {Gan, Zi} from '../../msg/bazimsg';
import { twoTextOneLine } from '../../utils/helper';
import styles from '../../css/styles.less';

const { Option } = Select;

export default class BaziPithy extends Component{
	constructor(props) {
		super(props);

        this.state = {
            pithy: null,
        }

        this.requestPithy = this.requestPithy.bind(this);
        this.genDom = this.genDom.bind(this);
        this.genCol = this.genCol.bind(this);
    }

	async requestPithy(){
		let params = {}

		const data = await request(`${Constants.ServerRoot}/common/pithy`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			pithy: result.pithy,
		};

		this.setState(st);
	}

    genCol(key, ary, howmanylines){
        if(ary === undefined || ary === null || ary.length === 0){
            return null;
        }
        let lines = twoTextOneLine(ary, howmanylines);
        let lis = lines.map((line, idx)=>{
            return (<li key={idx}>{line}</li>)
        })

        let col = (
            <Col span={8} key={randomStr(8)}>
                <Divider orientation='left'>{key}</Divider>
                <ul>
                    {lis}
                </ul>
            </Col>
        )

        return col;
    }

    genDom(){
        let res = null;
        if(this.state.pithy === null){
            return res;
        }

        let pithy = this.state.pithy;
        let colword3 = [];
        let colword4 = [];
        for(let i=0; i<10; i++){
            let gan = Gan[i];
            let li = (
                <li key={randomStr(8)}>{pithy['三字诀'][gan]}</li>
            );
            colword3.push(li);

            let li4 = (
                <li key={randomStr(8)}>{pithy['四字诀'][gan]}</li>
            )
            colword4.push(li4);
        }

        let colword3zi = [];
        for(let i=0; i<12; i++){
            let zi = Zi[i];
            let li = (
                <li key={randomStr(8)}>{pithy['三字诀'][zi]}</li>
            );
            colword3zi.push(li);
        }

        let nayin = [];
        for(let key in pithy['纳音断运']){
            let li = (
                <li key={randomStr(8)}>{pithy['纳音断运'][key]}</li>
            )
            nayin.push(li);
        }

        let wxdom = [];
        for(let key in pithy['五行颠倒']){
            let ary = pithy['五行颠倒'][key];

            let li = (
                <li key={randomStr(8)}>{ary.join('，')}</li>
            )
            wxdom.push(li);
        }

        let cols = [];
        for(let key in pithy['从格']){
            let ary = pithy['从格'][key];
            let col = this.genCol(key, ary);
            if(col){
                cols.push(col);
            }
        } 

        
        for(let key in pithy){
            if(key === '三字诀' || key === '四字诀' || key === '纳音断运' || key === '五行颠倒' || key === '从格'){
                continue;
            }

            let col = null;
            if(key === '子息' || key === '格局' || key === '顺逆' || key === '清浊'){
                col = this.genCol(key, pithy[key], 2);
            }else{
                col = this.genCol(key, pithy[key], 1);
            }
            cols.push(col);
        }

        res = (
            <Row gutter={6}>
                <Col span={8}>
                    <Divider orientation='left'>四柱加三垣</Divider>
                    <ul>{colword3}</ul>
                </Col>
                <Col span={5}>
                    <Divider orientation='left'>四柱加三垣</Divider>
                    <ul>{colword3zi}</ul>
                </Col>
                <Col span={5}>
                    <Divider orientation='left'>四柱加三垣</Divider>
                    <ul>{colword4}</ul>
                </Col>
                <Col span={6}>
                    <Divider orientation='left'>日柱纳音见大运地支</Divider>
                    <ul>{nayin}</ul>
                </Col>
                <Col span={24}>
                    <Divider orientation='left'>五行颠倒</Divider>
                    <ul>{wxdom}</ul>
                </Col>
                {cols}
            </Row>
        )

        return res;
    }

    componentDidMount(){
        this.requestPithy();
    }

    render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight;
		let style = {
			height: (height-200) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

        let dom = this.genDom();

        return (
            <div className={styles.scrollbar} style={style}>
                {dom}
            </div>
        )
    }
}