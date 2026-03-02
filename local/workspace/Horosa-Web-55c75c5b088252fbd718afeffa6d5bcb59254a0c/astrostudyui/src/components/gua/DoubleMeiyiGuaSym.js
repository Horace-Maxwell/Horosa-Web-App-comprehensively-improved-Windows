import { Component } from 'react';
import { Row, Col, Select} from 'antd';
import MeiyiGuaSym from './MeiyiGuaSym';
import GuaChartDiv from './GuaChartDiv';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';

const { Option } = Select;

export default class DoubleMeiyiGuaSym extends Component{
    constructor(props) {
		super(props);

        this.state = {
            upChanged: null,
            downChanged: null,

            huGuaUp: null,
            huGuaDown: null,

            gua64: null,
            huGua: null,
            up1Gua: null,
            up2Gua: null,
            down1Gua: null,
            down2Gua: null,
            tongGua: null,
            fuGua: null,

            gua64Inverse: null,
            huGuaInverse: null,
            up1GuaInverse: null,
            up2GuaInverse: null,
            down1GuaInverse: null,
            down2GuaInverse: null,
            tongGuaInverse: null,
            fuGuaInverse: null,

            guaType: 0,
        }

        this.changeUpValue = this.changeUpValue.bind(this);
        this.changeDownValue = this.changeDownValue.bind(this);

        this.requestGuaDesc = this.requestGuaDesc.bind(this);

        this.genHuGuaDom = this.genHuGuaDom.bind(this);
        this.changeGuaType = this.changeGuaType.bind(this);
    }

	async requestGuaDesc(){
		let up = this.state.upChanged;
		let down = this.state.downChanged;

        let val = this.props.value;
        if(up === null && val){
            up = val.up ? val.up : val.upChanged ;
        }
        if(down === null && val){
            down = val.down ? val.down : val.downChanged;
        }

        if(up === null || down === null){
            return;
        }

        let upyao = up.yao;
        let downyao = down.yao;

        let huUpYao = [downyao[2], upyao[0], upyao[1]];
        let huDownYao = [downyao[1], downyao[2], upyao[0]];

        let orgyao = [downyao[0], downyao[1], downyao[2], upyao[0], upyao[1], upyao[2]];
        let huYao = [downyao[1], downyao[2], upyao[0], downyao[2], upyao[0], upyao[1]];
        let up1Yao = [downyao[2], upyao[0], upyao[1], upyao[0], upyao[1], upyao[2]];
        let up2Yao = [downyao[1], downyao[2], upyao[0], upyao[0], upyao[1], upyao[2]];
        let down1Yao = [downyao[0], downyao[1], downyao[2], downyao[2], upyao[0], upyao[1]];
        let down2Yao = [downyao[0], downyao[1], downyao[2], downyao[1], downyao[2], upyao[0]];
        let fuyao = [upyao[2], upyao[1], upyao[0], downyao[2], downyao[1], downyao[0]];
        let tongYao = orgyao.map((item, idx)=>{
            if(item === 1){
                return 0;
            }
            return 1;
        });

        let orgyaoInverse = [upyao[0], upyao[1], upyao[2], downyao[0], downyao[1], downyao[2]];
        let huYaoInverse = [downyao[2], upyao[0], upyao[1], downyao[1], downyao[2], upyao[0]];
        let up1YaoInverse = [upyao[0], upyao[1], upyao[2], downyao[2], upyao[0], upyao[1]];
        let up2YaoInverse = [upyao[0], upyao[1], upyao[2], downyao[1], downyao[2], upyao[0]];
        let down1YaoInverse = [downyao[2], upyao[0], upyao[1], downyao[0], downyao[1], downyao[2]];
        let down2YaoInverse = [downyao[1], downyao[2], upyao[0], downyao[0], downyao[1], downyao[2]];
        let tongYaoInverse = [tongYao[3], tongYao[4], tongYao[5], tongYao[0], tongYao[1], tongYao[2]];
        let fuyaoInverse = [downyao[2], downyao[1], downyao[0], upyao[2], upyao[1], upyao[0]];

        let params = {
            name: [orgyao.join(''), huYao.join(''), up1Yao.join(''), up2Yao.join(''), 
                down1Yao.join(''), down2Yao.join(''), tongYao.join(''),fuyao.join(''),
                orgyaoInverse.join(''), huYaoInverse.join(''), up1YaoInverse.join(''), up2YaoInverse.join(''), 
                down1YaoInverse.join(''), down2YaoInverse.join(''), tongYaoInverse.join(''), fuyaoInverse.join('')
            ],
        };
        
        const descdata = await request(`${Constants.ServerRoot}/gua/desc`, {
            body: JSON.stringify(params),
        });

        const descresult = descdata[Constants.ResultKey];

        let st = {
            gua64: descresult[orgyao.join('')],
            huGua: descresult[huYao.join('')],
            up1Gua: descresult[up1Yao.join('')],
            up2Gua: descresult[up2Yao.join('')],
            down1Gua: descresult[down1Yao.join('')],
            down2Gua: descresult[down2Yao.join('')],
            tongGua: descresult[tongYao.join('')],
            fuGua: descresult[fuyao.join('')],
            gua64Inverse: descresult[orgyaoInverse.join('')],
            huGuaInverse: descresult[huYaoInverse.join('')],
            up1GuaInverse: descresult[up1YaoInverse.join('')],
            up2GuaInverse: descresult[up2YaoInverse.join('')],
            down1GuaInverse: descresult[down1YaoInverse.join('')],
            down2GuaInverse: descresult[down2YaoInverse.join('')],
            tongGuaInverse: descresult[tongYaoInverse.join('')],
            fuGuaInverse: descresult[fuyaoInverse.join('')],
        }

        let meiyiparam = {
            name: [huUpYao.join(''), huDownYao.join('')],
        }
        const meiyidata = await request(`${Constants.ServerRoot}/gua/meiyi`, {
            body: JSON.stringify(meiyiparam),
        });
        const meiyires = meiyidata[Constants.ResultKey];

        st.huGuaUp = meiyires[huUpYao.join('')];
        st.huGuaDown = meiyires[huDownYao.join('')];

        this.setState({
            ...st,
        }, ()=>{
            if(this.props.onData){
                let obj = {
                    ...this.state,
                };
                this.props.onData(obj);
            }
        });

	}


    changeUpValue(value){
        if(this.props.onChange){
            this.props.onChange(value);
        }    

        let st = this.state; 
        
        if(st.upChanged && value && st.upChanged.name === value.name && st.gua64){
            if(this.props.onData){
                let obj = {
                    ...this.state,
                };
                this.props.onData(obj);
            }
            return;
        }
    
        setTimeout(() => {
            this.setState({
                upChanged: value,
            }, ()=>{
                this.requestGuaDesc();
            });        
        }, 100);

    }

    changeDownValue(value){
        if(this.props.onChange){
            this.props.onChange(value);
        }    
    
        let st = this.state; 
        if(st.downChanged && value && st.downChanged.name === value.name && st.gua64){
            if(this.props.onData){
                let obj = {
                    ...this.state,
                };
                this.props.onData(obj);
            }
            return;
        }

        setTimeout(() => {
            this.setState({
                downChanged: value,
            }, ()=>{
                this.requestGuaDesc();
            });    
        }, 100);

    }

    changeGuaType(val){
        this.setState({
            guaType: val,
        }, ()=>{
            let st = this.state;
            if(st.up1Gua === null){
                this.requestGuaDesc();
            }else{
                if(this.props.onData){
                    let obj = {
                        ...this.state,
                    };
                    this.props.onData(obj);    
                }
            }
        });
    }

    genHuGuaDom(){
        let st = this.state;
        let val = this.props.value;
        if((val === undefined || val === null) && (st.gua64 === undefined || st.gua64 === null)){
            return null;
        }

        let valUp = null;
        let valDown = null;
        if(val){
            valUp = val.up ? val.up : val.upChanged;
            valDown = val.down ? val.down : val.downChanged;
        }

        let gua64 = st.gua64 ? st.gua64 : val.gua64;
        let huGua = st.huGua ? st.huGua : val.huGua;
        let huGuaUp = st.huGuaUp ? st.huGuaUp : val.huGuaUp;
        let huGuaDown = st.huGuaDown ? st.huGuaDown : val.huGuaDown;

        let upGua = st.upChanged ? st.upChanged : valUp;
        let downGua = st.downChanged ? st.downChanged : valDown;

        let gua64descDom = null;
        let type = st.guaType;
        if(type === 1){
            gua64 = huGua;
        }else if(type === 2){
            gua64 = st.up1Gua ? st.up1Gua : val.up1Gua;
        }else if(type === 3){
            gua64 = st.up2Gua ? st.up2Gua : val.up2Gua;
        }else if(type === 4){
            gua64 = st.down1Gua ? st.down1Gua : val.down1Gua;
        }else if(type === 5){
            gua64 = st.down2Gua ? st.down2Gua : val.down2Gua;
        }else if(type === 6){
            gua64 = st.tongGua ? st.tongGua : val.tongGua;
        }else if(type === 7){
            gua64 = st.fuGua ? st.fuGua : val.fuGua;
        }
        if(gua64){
            gua64descDom = (
                <a href={gua64.url} target='_blank'>{gua64.desc}</a>
            );
        }

        let dom = (
            <Row gutter={6}>
                <Col span={8}>
                    <Select value={this.state.guaType} onChange={this.changeGuaType} size='small' style={{width: '100%'}}>
                        <Option value={0}>本卦</Option>
                        <Option value={1}>互卦</Option>
                        <Option value={2}>{upGua.name}与上互卦</Option>
                        <Option value={3}>{upGua.name}与下互卦</Option>
                        <Option value={4}>{downGua.name}与上互卦</Option>
                        <Option value={5}>{downGua.name}与下互卦</Option>
                        <Option value={6}>旁通卦</Option>
                        <Option value={7}>覆卦</Option>
                    </Select>                
                </Col>
                <Col span={4}>
                    <GuaChartDiv value={gua64} height={30} width={40} />
                </Col>
                <Col span={12}>{gua64descDom}</Col>   

                <Col span={3}>上互卦</Col>
                <Col span={2}>
                    <GuaChartDiv value={huGuaUp} height={20} width={30} />
                </Col>
                <Col span={7}>{huGuaUp.name}--{huGuaUp.abrname}</Col>
                <Col span={3}>下互卦</Col>
                <Col span={2}>
                    <GuaChartDiv value={huGuaDown} height={20} width={30} />
                </Col>
                <Col span={7}>{huGuaDown.name}--{huGuaDown.abrname}</Col>
            </Row>
        );

        return dom;
    }

    componentDidMount(){
        let val  = this.props.value;
        let st = this.state;
        if(st.upChanged === null && val && val.upChanged){
            st = {
                ...val,
            };
            this.setState(st);
        }
    }

    render(){
        let val = this.props.value;
        let guaup = null;
        let guadown = null;
        if(val){
            guaup = val.up ? val.up : val.upChanged;
            guadown = val.down ? val.down : val.downChanged;
        }
 
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 50;
        height = height - 100;
        
        let huguadom = this.genHuGuaDom();

        return (
            <div>
                { huguadom }
                <Row gutter={6}>
                    <Col span={12}>
                        <MeiyiGuaSym value={guaup} height={height} newValue={this.props.newValue} 
                            onChange={this.changeUpValue}
                        />
                    </Col>
                    <Col span={12}>
                        <MeiyiGuaSym value={guadown} height={height} newValue={this.props.newValue} 
                            onChange={this.changeDownValue}
                        />
                    </Col>
                </Row>
            </div>
        )
    }

}