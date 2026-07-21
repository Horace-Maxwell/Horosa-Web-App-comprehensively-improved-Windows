import { Component } from 'react';
import { Typography, } from 'antd';
import styles from '../../css/styles.less';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

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
                let title = (<Title level={4} key={`meiyi-title-${key}`}>{key}</Title>);
                // 标题与列表并列推进同一个 res 数组，故用不同前缀 + 分类名保证兄弟唯一
                let ul = this.genSymList(list, `meiyi-list-${key}`);
                res.push(title);
                res.push(ul);
            }    
        }

        let symbolize = val.symbolize;
        if(symbolize && symbolize.length){
            let title = (<Title level={4} key='sym-title'>未分类</Title>);
            let ul = this.genSymList(symbolize, 'sym-list');
            if(meiyi){
                res.push(title);
            }
            res.push(ul);
        }
        if(res.length === 0){
            let notxt = (<Text level={4} key='sym-empty'>还未有类象数据，请等待。。。</Text>);
            res.push(notxt);
        }

		let dom = (<Typography>{res}</Typography>);
		return dom;
    }

    genSymList(list, listKey){
        // 🔒 防黑屏:类象某分类值非数组(数据缺/半成品)时 list.map 抛 TypeError → 无边界即整页空白。
        if(!Array.isArray(list)){ return null; }
        let lis = list.map((item, idx)=>{
            return (
                <li key={idx}>
                    <Text>{item}</Text>
                </li>
            )
        });

        return (
            <Paragraph key={listKey}>
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