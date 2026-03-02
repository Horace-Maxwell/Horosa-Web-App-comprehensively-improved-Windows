import { Component } from 'react';
import { Row, Col, Select, Divider} from 'antd';
import DoubleMeiyiGuaSym from '../gua/DoubleMeiyiGuaSym';
import GuaChartDiv from '../gua/GuaChartDiv';
import styles from '../../css/styles.less';

const { Option } = Select;

export default class FourZhuGuaDesc extends Component{
    constructor(props) {
		super(props);

        this.state={
            zhuGua: null,
            guaMap: null,
            zhu: null,
            newValue: false,
            fourZhu: null,
            guaType: 0,
        }

        this.genZhuDom = this.genZhuDom.bind(this);
        this.changeZhu = this.changeZhu.bind(this);
        this.changeGuaType = this.changeGuaType.bind(this);

        this.changeValue = this.changeValue.bind(this);
        this.isSameFourZhu = this.isSameFourZhu.bind(this);
        this.checkNewValue = this.checkNewValue.bind(this);
    }

    changeValue(value){
        this.setState({
            newValue: false,
        });
    }

    changeGuaType(val){
        this.setState({
            guaType: val,
        });
    }

    changeZhu(val, option){
        let rec = option.props.record;
        this.setState({
            zhuGua: val,
            zhu: rec,
            newValue: true,
        });
    }

    genZhuDom(){
        let val = this.props.value;
        if(val === undefined || val === null){
            return null;
        }

        let year = val.year.gua64;
        let month = val.month.gua64;
        let date = val.day.gua64;
        let time = val.time.gua64;
        let tai = val.tai.gua64;

        return (
            <Select value={this.state.zhuGua} onChange={this.changeZhu} style={{width: '100%'}} size='small'>
                <Option value={tai.name} record={val.tai}>胎元-{val.tai.ganzi}-{tai.abrname}-{tai.name}</Option>
                <Option value={year.name} record={val.year}>年柱-{val.year.ganzi}-{year.abrname}-{year.name}</Option>
                <Option value={month.name} record={val.month}>月柱-{val.month.ganzi}-{month.abrname}-{month.name}</Option>
                <Option value={date.name} record={val.day}>日柱-{val.day.ganzi}-{date.abrname}-{date.name}</Option>
                <Option value={time.name} record={val.time}>时柱-{val.time.ganzi}-{time.abrname}-{time.name}</Option>
            </Select>
        )
    }

    isSameFourZhu(){
        let fourzhu = this.state.fourZhu;
        let fzhu = this.props.value;
        if(((fourzhu === null) && fzhu) || (fourzhu && (fzhu === null))){
            return false;
        }else if(fourzhu == fzhu){
            return true;
        }

        let flag = fourzhu.year.ganzi === fzhu.year.ganzi && fourzhu.month.ganzi === fzhu.month.ganzi &&
                    fourzhu.day.ganzi === fzhu.day.ganzi && fourzhu.time.ganzi === fzhu.time.ganzi;
        return flag;
    }

    checkNewValue(){
        let flag = this.isSameFourZhu();
        if(!flag){
            let st = this.state;
            st.fourZhu = this.props.value;
            if(this.props.value){
                let date = this.props.value.day;
                st.zhu = date;
                st.zhuGua = date.gua64.name;
                st.guaMap = date.gua64;
            }
            setTimeout(() => {
                this.setState({
                    newValue: true,
                });
            }, 200);
        }
    }

    componentDidMount(){

    }

    render(){
		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 50;

        let zhudom = this.genZhuDom();

        let zhu = this.state.zhu;
        let gua = null;
        let gua64descDom = null;
        let gua64 = null;
        if(zhu){
            gua = {
                up: zhu.stem.gua,
                down: zhu.branch.gua,
                gua64: zhu.gua64,
                huGua: zhu.huGua,
                huGuaUp: zhu.huGuaUp,
                huGuaDown: zhu.huGuaDown,
            };
            if(this.state.guaType === 0){
                gua64 = zhu.gua64;
            }else if(this.state.guaType === 1){
                gua64 = zhu.huGua;
            }else {
                gua64 = zhu.tongGua;
            }
            gua64descDom = (
                <a href={gua64.url} target='_blank'>{gua64.desc}</a>
            )
        }

        this.checkNewValue();

        return (
            <div>
                <Row gutter={6}>
                    <Col span={10}>
                        {zhudom}
                    </Col>
                    <Col span={4}>
                        <Select value={this.state.guaType} onChange={this.changeGuaType} size='small' style={{width: '100%'}}>
                            <Option value={0}>本卦</Option>
                            <Option value={1}>互卦</Option>
                            <Option value={2}>旁通卦</Option>
                        </Select>
                    </Col>
                    <Col span={3}>
                        <GuaChartDiv value={gua64} height={30} width={40} />
                    </Col>
                    <Col span={7}>{gua64descDom}</Col>
                </Row>
                <hr />
                <DoubleMeiyiGuaSym height={height} value={gua} newValue={this.state.newValue} 
                    onChange={this.changeValue}
                />
            </div>
        )
    }

}