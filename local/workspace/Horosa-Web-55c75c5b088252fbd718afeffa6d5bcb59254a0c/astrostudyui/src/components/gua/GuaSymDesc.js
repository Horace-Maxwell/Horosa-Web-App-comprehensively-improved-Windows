import { Component } from 'react';
import { Row, Col, } from 'antd';
import DoubleMeiyiGuaSym from './DoubleMeiyiGuaSym';
import GuaSym from './GuaSym';
import GuaChartDiv from './GuaChartDiv';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../../utils/safeStorage';
import { getLayoutViewportWidth, getLayoutViewportHeight } from '../../utils/shellZoom';

const guaDataKey = 'guaData';

export default class GuaSymDesc extends Component{
    constructor(props) {
		super(props);

        let json = safeLocalStorageGet(guaDataKey);
        let data = null;
        let gua64 = null;
        let gua64Inverse = null;
        if(json && json !== ''){
            // 本地值损坏 → 清掉自愈,按无数据渲染,别在构造期抛错白屏
            try{ data = JSON.parse(json); }catch(e){ data = null; safeLocalStorageRemove(guaDataKey); }
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
            // 🛡 safeStorage:setState callback 内的 setItem 抛 QuotaExceededError 会被 React 上冒到 ErrorBoundary → 八卦类象整面板崩。包 try/catch + 配额满自动清理重试。
            safeLocalStorageSet(guaDataKey, json);
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
        let json = safeLocalStorageGet(guaDataKey);
        let data = null;
        let gua64 = null;
        let gua64Inverse = null;
        if(json && json !== ''){
            try{ data = JSON.parse(json); }catch(e){ data = null; safeLocalStorageRemove(guaDataKey); }
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
		let height = this.props.height ? this.props.height : getLayoutViewportHeight();
        let namedom = this.genGuaNamDom();
        let nameInverseDom = this.genGuaInverseNamDom();
        let meiyiheight = height + 20;

        // fill = 充满父容器(见 GuaSym 注)。列数断点一律看**布局域**宽:documentElement.clientWidth 是物理域,
        // 壳放大档(如 1.8)物理 1728 而布局只有 960,按物理宽判 >1000 会硬排四列把每列挤成 200 出头。z=1 两者相等,零变化。
        const fill = !!this.props.fill;
        let span = 8;
        let width = getLayoutViewportWidth();
        if(width > 1000){
            span = 6;
        }
        const colStyle = fill ? { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined;
        const headStyle = fill ? { flex: 'none' } : undefined;

        return (
            <div style={fill ? { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined}>
                <Row gutter={16} style={fill ? { flex: '1 1 0', minHeight: 0 } : undefined}>
                    <Col span={span*2} style={fill ? { height: '100%', minHeight: 0 } : undefined}>
                        <DoubleMeiyiGuaSym height={meiyiheight} fill={fill}
                            onData={this.onDataChanged}
                            onChange={this.onStatChanged}
                            value={this.state.allData}
                            newValue={this.state.newValue}
                        />
                    </Col>
                    <Col span={span} style={colStyle}>
                        <Row gutter={8} style={headStyle}>
                            <Col span={6}>
                                <GuaChartDiv value={this.state.data} height={30} width={40} />
                            </Col>
                            <Col span={18}>{namedom}</Col>
                        </Row>
                        <GuaSym height={height} value={this.state.data} fill={fill} />
                    </Col>
                    {
                        span == 6 && (
                            <Col span={span} style={colStyle}>
                                <Row gutter={8} style={headStyle}>
                                    <Col span={6}>
                                        <GuaChartDiv value={this.state.dataInverse} height={30} width={40} />
                                    </Col>
                                    <Col span={18}>{nameInverseDom}</Col>
                                </Row>
                                <GuaSym height={height} value={this.state.dataInverse} fill={fill} />
                            </Col>    
                        )
                    }
                </Row>

            </div>
        );
    }

}
