import { Component } from 'react';
import { Select, Row, Col } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomStr, randomNum, littleEndian,} from '../../utils/helper';
import { Gua8, getGua8, } from '../gua/GuaConst';
import GuaSym from './GuaSym';
import GuaChartDiv from './GuaChartDiv';

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
	
			const descresult = descdata[Constants.ResultKey];
	
			desc = descresult[gua];
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
                <Option key={randomStr(8)} value={item.name} record={item}>{item.name}&nbsp;--&nbsp;{item.abrname}</Option>
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