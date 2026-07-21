import { Component } from 'react';
import { Divider } from 'antd';
import styles from '../../css/styles.less';
import { XQCard } from '../xq-ui';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。


export default class TipsBoard extends Component{
	constructor(props) {
		super(props);
		this.state = {
        }

        this.genTipsDom = this.genTipsDom.bind(this);
    }

    genTipsDom(){
        if(this.props.value === undefined || this.props.value === null ||
            this.props.value.tips === undefined || this.props.value.tips === null){
            return null;
        }
        let tipobj = this.props.value;
        let tips = tipobj.tips;
        let title = tipobj.title;
        let itemdoms = null;
        if(tips instanceof Array){
            itemdoms = tips.map((item, idx)=>{
                if(item instanceof Array){
                    let lis = item.map((li, idx)=>{
                        if(li === '=='){
                            return (<Divider dashed={true} key={idx} />)
                        }
                        return (
                            <li key={idx}>{li}</li>
                        )
                    });
                    let res = (
                        // 此处 idx 为外层 tips.map 的下标(内层同名参数已出作用域)
                        <ul key={idx}>
                            {lis}
                        </ul>                        
                    )
                    return res;
                }else{
                    if(item === '=='){
                        return (<Divider dashed={true} key={idx}/>)
                    }
                    return (<li key={idx}>{item}</li>)
                }
            });
        }else{
            itemdoms = (
                <li key='tips-single'>{tips}</li>
            )
        }

        let dom = (
            <div title={title} style={{width: '100%'}}>
                <ul>
                {itemdoms}
                </ul>
            </div>
        );
        return dom;
    }

    render(){
        let height = this.props.height ? this.props.height : 270;
        let width = this.props.width ? this.props.width : '100%';

        let dom = this.genTipsDom();
        let title = null;
        if(this.props.value && this.props.value.title){
            title = this.props.value.title;
        }

        let res = (
            <XQCard title={title} size='small' style={{width: '100%'}}>
                <div className={styles.scrollbar} style={{
                    height: height, 
                    width: width,
                    overflowY:'auto', 
                    overflowX:'hidden',    
                }}>
                    {dom}
                </div>
            </XQCard>
        )
        if(dom === null){
            res = null;
        }
        return res;
    }
}
