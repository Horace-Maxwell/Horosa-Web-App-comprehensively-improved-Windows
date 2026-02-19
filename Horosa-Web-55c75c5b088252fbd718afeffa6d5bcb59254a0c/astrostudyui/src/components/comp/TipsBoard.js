import { Component } from 'react';
import { Row, Col, Button, Divider, Card,} from 'antd';
import * as Constants from '../../utils/constants';
import {randomStr,} from '../../utils/helper';
import styles from '../../css/styles.less';


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
                            return (<Divider dashed={true} key={randomStr(8)} />)
                        }
                        return (
                            <li key={randomStr(8)}>{li}</li>
                        )
                    });
                    let res = (
                        <ul key={randomStr(8)}>
                            {lis}
                        </ul>                        
                    )
                    return res;
                }else{
                    if(item === '=='){
                        return (<Divider dashed={true} key={randomStr(8)}/>)
                    }
                    return (<li key={randomStr(8)}>{item}</li>)
                }
            });
        }else{
            itemdoms = (
                <li key={randomStr(8)}>{tips}</li>
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
            <Card title={title} size='small' style={{width: '100%'}}>
                <div className={styles.scrollbar} style={{
                    height: height, 
                    width: width,
                    overflowY:'auto', 
                    overflowX:'hidden',    
                }}>
                    {dom}
                </div>
            </Card>
        )
        if(dom === null){
            res = null;
        }
        return res;
    }
}