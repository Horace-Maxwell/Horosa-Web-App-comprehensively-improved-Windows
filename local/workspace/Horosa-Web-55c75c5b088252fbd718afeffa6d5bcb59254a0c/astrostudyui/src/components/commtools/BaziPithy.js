import { Component } from 'react';
import { Row, Col, Divider } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import {Gan, Zi} from '../../msg/bazimsg';
import { twoTextOneLine } from '../../utils/helper';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

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
		if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
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

        // 「从格」子项与 pithy 顶层段两处循环共用同一个 cols 数组,两组段名互不重叠 → 段名即兄弟唯一 key
        let col = (
            <Col span={8} key={key}>
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
                <li key={gan}>{pithy['三字诀'][gan]}</li>
            );
            colword3.push(li);

            let li4 = (
                <li key={gan}>{pithy['四字诀'][gan]}</li>
            )
            colword4.push(li4);
        }

        let colword3zi = [];
        for(let i=0; i<12; i++){
            let zi = Zi[i];
            let li = (
                <li key={zi}>{pithy['三字诀'][zi]}</li>
            );
            colword3zi.push(li);
        }

        let nayin = [];
        for(let key in pithy['纳音断运']){
            let li = (
                <li key={key}>{pithy['纳音断运'][key]}</li>
            )
            nayin.push(li);
        }

        let wxdom = [];
        for(let key in pithy['五行颠倒']){
            let ary = pithy['五行颠倒'][key];

            let li = (
                <li key={key}>{ary.join('，')}</li>
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
