import { Component } from 'react';
import { Typography, } from 'antd';
import {randomStr, } from '../../utils/helper';
import styles from '../../css/styles.less';

const { Title, Paragraph, Text } = Typography;

export default class GuaSym extends Component{
    constructor(props) {
		super(props);

        this.genMeiyiSym = this.genMeiyiSym.bind(this);
        this.genSymList = this.genSymList.bind(this);
	}

    genMeiyiSym(){
        let val = this.props.value;
        if(val === undefined || val === null){
            return null;
        }

        let res = [];
        let meiyi = val['梅易'];
        if(meiyi){
            for(let key in meiyi){
                let list = meiyi[key];
                let title = (<Title level={4} key={randomStr(8)}>{key}</Title>);
                let ul = this.genSymList(list);
                res.push(title);
                res.push(ul);
            }    
        }

        let symbolize = val.symbolize;
        if(symbolize && symbolize.length){
            let title = (<Title level={4} key={randomStr(8)}>未分类</Title>);
            let ul = this.genSymList(symbolize);
            if(meiyi){
                res.push(title);
            }
            res.push(ul);
        }
        if(res.length === 0){
            let notxt = (<Text level={4} key={randomStr(8)}>还未有类象数据，请等待。。。</Text>);
            res.push(notxt);
        }

		let dom = (<Typography>{res}</Typography>);
		return dom;
    }

    genSymList(list){
        let lis = list.map((item, idx)=>{
            return (
                <li key={randomStr(8)}>
                    <Text>{item}</Text>
                </li>
            )
        });

        return (
            <Paragraph key={randomStr(8)}>
                <ul>
                    {lis}
                </ul>
            </Paragraph>
        )
    }

    render(){
        let dom = this.genMeiyiSym();

		let height = this.props.height ? this.props.height : document.documentElement.clientHeight;
		let style = {
			height: (height-150) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};

        return (
            <div className={styles.scrollbar} style={style}>
                {dom}
            </div>
        )
    }
}