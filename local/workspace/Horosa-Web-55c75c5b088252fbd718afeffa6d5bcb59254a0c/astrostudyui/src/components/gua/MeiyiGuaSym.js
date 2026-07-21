import { Component } from 'react';
import { Row, Col } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomNum, littleEndian,} from '../../utils/helper';
import { Gua8, getGua8, } from '../gua/GuaConst';
import GuaSym from './GuaSym';
import GuaChartDiv from './GuaChartDiv';
import { XQSelect as Select } from '../xq-ui';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

const { Option } = Select;

export default class MeiyiGuaSym extends Component{
    constructor(props) {
		super(props);

        this.state = {
            gua: null,
            guaMap: null,
        }

        this.genGua8Dom = this.genGua8Dom.bind(this);
        this.changeGua = this.changeGua.bind(this);

        this.requestGuaDescReturn = this.requestGuaDescReturn.bind(this);
		this.requestGuaDesc = this.requestGuaDesc.bind(this);

    }

	async requestGuaDescReturn(){
		let desc = null;
		let gua = this.state.gua;

		if(gua){
			let params = {
				name: [gua],
			};
			
			const descdata = await request(`${Constants.ServerRoot}/gua/meiyi`, {
				body: JSON.stringify(params),
			});
	
			const descresult = descdata && descdata[Constants.ResultKey];

			desc = descresult ? descresult[gua] : null;
 		}

		return desc;
	}

	async requestGuaDesc(){
		let desc = await this.requestGuaDescReturn();
		this.setState({
			guaMap: desc,
		}, ()=>{
           if(this.props.onChange){
                this.props.onChange(desc);
            }
        });
	}

    changeGua(val, options){
        let rec = options.props.record;
        let st = this.state;
        if(st.gua && st.gua === rec.name){
            if(this.props.onChange){
                this.props.onChange(rec);
            }            
        }else{
            this.setState({
                gua: val,
            }, ()=>{
                this.requestGuaDesc();
            });    
        }
    }

    genGua8Dom(){
        let ops = Gua8.map((item, idx)=>{
            return (
                <Option key={item.name} value={item.name} record={item}>{item.name}&nbsp;--&nbsp;{item.abrname}</Option>
            )
        });
        let dom = (
            <Select style={{width: '100%'}} onChange={this.changeGua} value={this.state.gua} size='small'>
                {ops}
            </Select>
        );
        return dom;
    }

    componentDidMount(){
        let val = this.props.value;
        let st = this.state;
        if(val && st.gua === null){
            this.setState({
                gua: val.name,
                guaMap: val,
            });
        }
    }

    render(){
        let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 50;

        let gua8dom = this.genGua8Dom();


        let val = this.state.guaMap;
        if(this.props.newValue && this.props.value){
            val = this.props.value;
            setTimeout(() => {
                let gua = null;
                let guamap = null;
                if(val){
                    guamap = val;
                    gua = getGua8(guamap.name);
                }
                // 🔒 防崩:getGua8 对未登记名返 undefined → gua.name 抛 TypeError(setTimeout 内,React 边界捕不到)。缺即跳过。
                if(!gua){ return; }
                let st = this.state;
                st.gua = gua.name;
                st.guaMap = guamap;
                if(this.props.onChange){
                    this.props.onChange(guamap);
                }
            }, 100);
        }

        return (
            <div>
                <Row gutter={8}>
                    <Col span={18}>
                        {gua8dom}
                    </Col>
                    <Col span={6}>
                        <GuaChartDiv value={val} height={30} width={40} />
                    </Col>
                </Row>
                <div>
                    <GuaSym value={val} height={height} />
                </div>
            </div>
        )
    }

}
