import { Component } from 'react';
import { Row, Col, Select} from 'antd';
import DoubleMeiyiGuaSym from './DoubleMeiyiGuaSym';
import GuaSym from './GuaSym';
import GuaChartDiv from './GuaChartDiv';

const guaDataKey = 'guaData';

export default class GuaSymDesc extends Component{
    constructor(props) {
		super(props);

        let json = localStorage.getItem(guaDataKey);
        let data = null;
        let gua64 = null;
        let gua64Inverse = null;
        if(json && json !== ''){
            data = JSON.parse(json);
        }
        if(data){
            let type = data.guaType;
            gua64 = data.gua64;
            gua64Inverse = data.gua64Inverse;
            if(type === 1){
                gua64 = data.huGua;
                gua64Inverse = data.huGuaInverse;
            }else if(type === 2){
                gua64 = data.up1Gua;
                gua64Inverse = data.up1GuaInverse;
            }else if(type === 3){
                gua64 = data.up2Gua;
                gua64Inverse = data.up2GuaInverse;
            }else if(type === 4){
                gua64 = data.down1Gua;
                gua64Inverse = data.down1GuaInverse;
            }else if(type === 5){
                gua64 = data.down2Gua;
                gua64Inverse = data.down2GuaInverse;
            }else if(type === 6){
                gua64 = data.tongGua;
                gua64Inverse = data.tongGuaInverse;
            }else if(type === 7){
                gua64 = data.fuGua;
                gua64Inverse = data.fuGuaInverse;
            }     
        }

        this.state = {
            data: gua64,
            dataInverse: gua64Inverse,
            allData: data,
            newValue: false,
        }

        this.onDataChanged = this.onDataChanged.bind(this);
        this.onStatChanged = this.onStatChanged.bind(this);
        this.genGuaNamDom = this.genGuaNamDom.bind(this);
        this.genGuaInverseNamDom = this.genGuaInverseNamDom.bind(this);
    }

    onStatChanged(value){
        this.setState({
            newValue: false,
        });
    }

    onDataChanged(data){
        if(data === undefined || data === null){
            return;
        }

        let type = data.guaType;
        let gua64 = data.gua64;
        let gua64Inverse = data.gua64Inverse;
        if(type === 1){
            gua64 = data.huGua;
            gua64Inverse = data.huGuaInverse;
        }else if(type === 2){
            gua64 = data.up1Gua;
            gua64Inverse = data.up1GuaInverse;
        }else if(type === 3){
            gua64 = data.up2Gua;
            gua64Inverse = data.up2GuaInverse;
        }else if(type === 4){
            gua64 = data.down1Gua;
            gua64Inverse = data.down1GuaInverse;
        }else if(type === 5){
            gua64 = data.down2Gua;
            gua64Inverse = data.down2GuaInverse;
        }else if(type === 6){
            gua64 = data.tongGua;
            gua64Inverse = data.tongGuaInverse;
        }else if(type === 7){
            gua64 = data.fuGua;
            gua64Inverse = data.fuGuaInverse;
        }    

        this.setState({
            data: gua64,
            dataInverse: gua64Inverse,
            allData: data,
        }, ()=>{
            let json = JSON.stringify(data);
            localStorage.setItem(guaDataKey, json);
        });
    }

    genGuaNamDom(){
        let data = this.state.data;
        if(data === undefined || data === null){
            return null;
        }

        let dom = (
            <a href={data.url} target='_blank'>{data.desc}</a>
        );

        return dom;
    }

    genGuaInverseNamDom(){
        let data = this.state.dataInverse;
        if(data === undefined || data === null){
            return null;
        }

        let dom = (
            <a href={data.url} target='_blank'>{data.desc}</a>
        );

        return dom;
    }

    componentDidMount(){
        let json = localStorage.getItem(guaDataKey);
        let data = null;
        let gua64 = null;
        let gua64Inverse = null;
        if(json && json !== ''){
            data = JSON.parse(json);
        }
        if(data){
            let type = data.guaType;
            gua64 = data.gua64;
            gua64Inverse = data.gua64Inverse;
            if(type === 1){
                gua64 = data.huGua;
                gua64Inverse = data.huGuaInverse;
            }else if(type === 2){
                gua64 = data.up1Gua;
                gua64Inverse = data.up1GuaInverse;
            }else if(type === 3){
                gua64 = data.up2Gua;
                gua64Inverse = data.up2GuaInverse;
            }else if(type === 4){
                gua64 = data.down1Gua;
                gua64Inverse = data.down1GuaInverse;
            }else if(type === 5){
                gua64 = data.down2Gua;
                gua64Inverse = data.down2GuaInverse;
            }else if(type === 6){
                gua64 = data.tongGua;
                gua64Inverse = data.tongGuaInverse;
            }else if(type === 7){
                gua64 = data.fuGua;
                gua64Inverse = data.fuGuaInverse;
            }    
        }
        this.setState({
            data: gua64,
            dataInverse: gua64Inverse,
            allData: data,
            newValue: true,
        });
    }

    render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight;
        let namedom = this.genGuaNamDom();
        let nameInverseDom = this.genGuaInverseNamDom();
        let meiyiheight = height + 20;

        let span = 8;
        let width = document.documentElement.clientWidth;
        if(width > 1000){
            span = 6;
        }

        return (
            <div>
                <Row gutter={16}>
                    <Col span={span*2}>
                        <DoubleMeiyiGuaSym height={meiyiheight} 
                            onData={this.onDataChanged}
                            onChange={this.onStatChanged}
                            value={this.state.allData}
                            newValue={this.state.newValue}
                        />
                    </Col>
                    <Col span={span}>
                        <Row gutter={8}>
                            <Col span={6}>
                                <GuaChartDiv value={this.state.data} height={30} width={40} />
                            </Col>
                            <Col span={18}>{namedom}</Col>
                        </Row>
                        <GuaSym height={height} value={this.state.data} />
                    </Col>
                    {
                        span == 6 && (
                            <Col span={span}>
                                <Row gutter={8}>
                                    <Col span={6}>
                                        <GuaChartDiv value={this.state.dataInverse} height={30} width={40} />
                                    </Col>
                                    <Col span={18}>{nameInverseDom}</Col>
                                </Row>
                                <GuaSym height={height} value={this.state.dataInverse} />
                            </Col>    
                        )
                    }
                </Row>

            </div>
        );
    }

}
