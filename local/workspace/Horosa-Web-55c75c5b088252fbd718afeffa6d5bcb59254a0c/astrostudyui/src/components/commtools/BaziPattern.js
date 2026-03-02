import { Component } from 'react';
import { Row, Col, Button, Divider, Select, Input, Popconfirm, InputNumber, message} from 'antd';
import { randomStr, isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import {BaziMonthTime, SixtyJiaZi} from '../../constants/ZWConst';
import RichEditor from '../RichEditor';

const { Option } = Select;

const BaziPatternKey = 'baziPattern';

export default class BaziPattern extends Component{
	constructor(props) {
		super(props);

        let json = localStorage.getItem(BaziPatternKey);
        let st = {};
        if(json){
            try{
                st = JSON.parse(json);
            }catch(e){

            }
        }

        this.state = {
            year: st.year,
            month: st.month,
            date: st.date,
            time: st.time,
            gender: st.gender,

            '描述': st['描述'],
            '格局': st['格局'],
            '格局码': st['格局码'],
            '格局级别': st['格局级别'],
            '格局成立': st['格局成立'],

            readonly: false,
            female: st.female,
            male: st.male,
            attrs: st.attrs ? st.attrs : [],
        }
        if(st.gender === undefined || st.gender === null){
            this.state.gender = -1;
        }

        if(st.attrs){
            st.attrs.map((item, idx)=>{
                this.state[item.key] = st[item.key];
            });
        }

        this.newval = false;

        this.requestPattern = this.requestPattern.bind(this);
        this.updatePattern = this.updatePattern.bind(this);

        this.genDom = this.genDom.bind(this);
        this.changeYear = this.changeYear.bind(this);
        this.changeMonth = this.changeMonth.bind(this);
        this.changeDate = this.changeDate.bind(this);
        this.changeTime = this.changeTime.bind(this);
        this.changeGender = this.changeGender.bind(this);

        this.changePattern = this.changePattern.bind(this);
        this.changePatternCode = this.changePatternCode.bind(this);
        this.changeDesc = this.changeDesc.bind(this);
        this.changeSuccess = this.changeSuccess.bind(this);
        this.changeLevel = this.changeLevel.bind(this);
        this.changeAttribute = this.changeAttribute.bind(this);

        this.genMonthOptions = this.genMonthOptions.bind(this);
        this.genTimeOptions = this.genTimeOptions.bind(this);

        this.saveState = this.saveState.bind(this);
        this.clearPatternAttrs = this.clearPatternAttrs.bind(this);
    }

    saveState(){
        let json = JSON.stringify(this.state);
        localStorage.setItem(BaziPatternKey, json);
        this.newval = false;
    }

	async updatePattern(){
        let st = this.state;
        if(st.year === undefined || st.year === null){
            message.error('年柱不能为空');
            return;
        }
        if(st.month === undefined || st.month === null){
            message.error('月柱不能为空');
            return;
        }
        if(st.date === undefined || st.date === null){
            message.error('日柱不能为空');
            return;
        }
        if(st.time === undefined || st.time === null){
            message.error('时柱不能为空');
            return;
        }

        let params = {
            year: st.year,
            month: st.month,
            date: st.date,
            time: st.time,
            '格局': st['格局'],
            '格局码': st['格局码'],
            '格局成立': st['格局成立'],
            '格局级别': st['格局级别'],
            '描述': st['描述'],
        }

        st.attrs.map((item, idx)=>{
            params[item.key] = st[item.key];
        });

        if(st.gender !== -1){
            params['性别'] = st.gender;
        }

		const data = await request(`${Constants.ServerRoot}/bazi/pattern/update`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];
        message.info('八字格局说明提交成功');
	}

	async requestPattern(){
        let st = this.state;
        if(st.year === undefined || st.year === null){
            message.error('年柱不能为空');
            return;
        }
        if(st.month === undefined || st.month === null){
            message.error('月柱不能为空');
            return;
        }
        if(st.date === undefined || st.date === null){
            message.error('日柱不能为空');
            return;
        }
        if(st.time === undefined || st.time === null){
            message.error('时柱不能为空');
            return;
        }

        let params = {
            year: st.year,
            month: st.month,
            date: st.date,
            time: st.time,
        }

		const data = await request(`${Constants.ServerRoot}/bazi/pattern`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];
        let female = result.Female;
        let male = result.Male;
        let attrs = result.Attributes;

        let resst = {
            female: female,
            male: male,
            attrs: attrs,
            readonly: result.readonly === 1 ? true : false,
        }
        let pat = male;
        if(st.gender === 0){
            pat = female;
        }
        if(pat){
            resst['格局'] = pat['格局'];
            resst['格局码'] = pat['格局码'];
            resst['格局级别'] = pat['格局级别'];
            resst['格局成立'] = pat['格局成立'];
            resst['描述'] = pat['描述'];

            attrs.map((item, idx)=>{
                resst[item.key] = pat[item.key];
            });  
        }

        this.newval = true;

        this.setState(resst, ()=>{
            this.saveState();
        });
	}

    clearPatternAttrs(st){
        st.male = null;
        st.female = null;
        st['格局'] = null;
        st['格局码'] = -1;
        st['格局成立'] = -1;
        st['格局级别'] = -1;
        st['描述'] = null;

        this.state.attrs.map((item, idx)=>{
            st[item.key] = -1;
        })

        this.newval = true;
    }

    changeYear(val){
        let st = {
            year: val,
            month: null,
        };  
        this.clearPatternAttrs(st); 

        this.setState(st, ()=>{
            this.saveState();
        });
    }

    changeMonth(val){
        let st = {
            month: val,
        };
        this.clearPatternAttrs(st); 

        this.setState(st, ()=>{
            this.saveState();
        });
    }

    changeDate(val){
        let st = {
            date: val,
            time: null,
        };
        this.clearPatternAttrs(st); 

        this.setState(st, ()=>{
            this.saveState();
        });
    }

    changeTime(val){
        let st = {
            time: val,
        };
        this.clearPatternAttrs(st); 

        this.setState(st, ()=>{
            this.saveState();
        });
    }

    changeGender(val){
        let pat = this.state.male;
        if(val === 0){
            pat = this.state.female;
        }
        let st = {
            gender: val,
        };

        if(pat){
            st['格局'] = pat['格局'];
            st['格局码'] = pat['格局码'];
            st['格局级别'] = pat['格局级别'];
            st['格局成立'] = pat['格局成立'];
            st['描述'] = pat['描述'];
            this.state.attrs.map((item, idx)=>{
                st[item.key] = pat[item.key];
            });
        }

        this.newval = true;
        this.setState(st, ()=>{
            this.saveState();
        });
    }

    changeDesc(val){
        this.setState({
            '描述': val,
        }, ()=>{
            this.saveState();
        });
    }

    changePattern(e){
        let val = e.target.value;

        this.setState({
            '格局': val,
        }, ()=>{
            this.saveState();
        });
    }

    changePatternCode(val){
        this.setState({
            '格局码': val,
        }, ()=>{
            this.saveState();
        });
    }

    changeLevel(val){
        this.setState({
            '格局级别': val,
        }, ()=>{
            this.saveState();
        });
    }

    changeSuccess(val){
        this.setState({
            '格局成立': val,
        }, ()=>{
            this.saveState();
        });
    }

    changeAttribute(key, val){
        let st = this.state;
        st[key] = val;
        this.setState(st, ()=>{
            this.saveState();
        });
       
    }

    genDom(){
        if(this.state.attrs === undefined || this.state.attrs === null){
            return null;
        }

        let selDisabled = this.state.readonly ? 'disabled' : '';
        let cols = [];
        this.state.attrs.map((item, idx)=>{
            let key = item.key;
            let type = item.type;
            if(type === 0){
                let col = (
                    <Col span={6} key={randomStr(8)}>
                        {key}：
                        <Select size='small' style={{width: '50%'}} value={this.state[key]}
                            onChange={(val)=>{this.changeAttribute(key, val);}}
                            disabled={selDisabled}
                        >
                            <Option value={-1}>未知</Option>
                            <Option value={0}>没有</Option>
                            <Option value={1}>一个</Option>
                            <Option value={2}>多个</Option>
                        </Select>
                    </Col>
                );
                cols.push(col);
            }else if(type === 1){
                let col = (
                    <Col span={6} key={randomStr(8)}>
                        {key}：
                        <Select size='small' style={{width: '50%'}} value={this.state[key]}
                            onChange={(val)=>{this.changeAttribute(key, val);}}
                            disabled={selDisabled}
                        >
                            <Option value={-1}>未知</Option>
                            <Option value={0}>否</Option>
                            <Option value={1}>是</Option>
                        </Select>
                    </Col>
                );
                cols.push(col);
            }
        });

        let dom = (
            <Row gutter={6} style={{marginBottom: 10}}>
                {cols}
            </Row>
        )

        return dom;
    }

    genMonthOptions(){
        let year = this.state.year;
        if(year === undefined || year === null){
            return null;
        }
        let gan = year.substr(0, 1);
        let monthes = BaziMonthTime.month[gan];
        let opts = monthes.map((item, idx)=>{
            return (
                <Option key={randomStr(8)} value={item}>{item}</Option>
            );
        })
        return opts;
    }

    genTimeOptions(){
        let date = this.state.date;
        if(date === undefined || date === null){
            return null;
        }
        let gan = date.substr(0, 1);
        let times = BaziMonthTime.time[gan];
        let opts = times.map((item, idx)=>{
            return (
                <Option key={randomStr(8)} value={item}>{item}</Option>
            );
        })
        return opts;
    }

    componentDidMount(){
        let dt = new Date();
        this.setState({
            fromYear: dt.getFullYear(),
        })
    }

    render(){
        let dom = this.genDom();
        let yopts = SixtyJiaZi.map((item, idx)=>{
            return (
                <Option key={randomStr(8)} value={item}>{item}</Option>
            )
        });
        let dopts = SixtyJiaZi.map((item, idx)=>{
            return (
                <Option key={randomStr(8)} value={item}>{item}</Option>
            )
        });
        let mopts = this.genMonthOptions();
        let topts = this.genTimeOptions();

        let editheight = 400;
        let selDisabled = this.state.readonly ? 'disabled' : '';

        return (
            <div>
                <Row gutter={12}>
                    <Col span={6}>年柱</Col>
                    <Col span={6}>月柱</Col>
                    <Col span={6}>日柱</Col>
                    <Col span={6}>时柱</Col>
                </Row>
                <Row gutter={12} style={{marginBottom: 10}}>
                    <Col span={6}>
                        <Select 
                            style={{width: '100%'}}
                            showSearch
                            allowClear
                            value={this.state.year}
                            placeholder='年柱'
                            onChange={this.changeYear}
                            filterOption={(input, option) => {
                                return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }}
                        >
                            {yopts}
                        </Select>
                    </Col>
                    <Col span={6}>
                        <Select 
                            style={{width: '100%'}}
                            showSearch
                            allowClear
                            value={this.state.month}
                            placeholder='月柱'
                            onChange={this.changeMonth}
                            filterOption={(input, option) => {
                                return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }}
                        >
                            {mopts}
                        </Select>
                    </Col>
                    <Col span={6}>
                        <Select 
                            style={{width: '100%'}}
                            showSearch
                            allowClear
                            value={this.state.date}
                            placeholder='日柱'
                            onChange={this.changeDate}
                            filterOption={(input, option) => {
                                return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }}
                        >
                            {dopts}
                        </Select>
                    </Col>
                    <Col span={6}>
                        <Select 
                            style={{width: '100%'}}
                            showSearch
                            allowClear
                            value={this.state.time}
                            placeholder='时柱'
                            onChange={this.changeTime}
                            filterOption={(input, option) => {
                                return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }}
                        >
                            {topts}
                        </Select>
                    </Col>
                </Row>
                <Row gutter={12} style={{marginBottom: 20}}>
                     <Col span={6}>
                        <Select value={this.state.gender} onChange={this.changeGender} style={{width: '100%'}}>
                            <Option value={-1}>不区分</Option>
                            <Option value={0}>女</Option>
                            <Option value={1}>男</Option>
                        </Select>
                    </Col>
                    <Col span={4}>
                        <Button type='primary' onClick={this.requestPattern}>查找</Button>
                    </Col>
                    {
                        !this.state.readonly && (
                            <Col offset={10} span={4}>
                                <Popconfirm title={`确定提交此八字格局说明吗?`} onConfirm={this.updatePattern}>
                                    <Button type='primary'>提交</Button>
                                </Popconfirm>
                            </Col>    
                        )
                    }
                </Row>

                <Divider orientation='left'>格局：</Divider>
                <Row gutter={6} style={{marginBottom: 10}}>
                    <Col span={4}>
                        <Select value={this.state['格局码']} onChange={this.changePatternCode} 
                            style={{width: '100%'}} disabled={selDisabled}
                        >
                            <Option value={-1}>未知</Option>
                            <Option value={0}>官格</Option>
                            <Option value={1}>煞格</Option>
                            <Option value={2}>印格</Option>
                            <Option value={3}>财格</Option>
                            <Option value={4}>食神格</Option>
                            <Option value={5}>伤官格</Option>
                            <Option value={6}>比劫格</Option>
                            <Option value={7}>阳刃格</Option>
                            <Option value={8}>从旺</Option>
                            <Option value={9}>从弱</Option>
                            <Option value={10}>杂格</Option>
                        </Select>
                    </Col>
                    <Col span={12}>
                        <Input 
                            value={this.state['格局']} onChange={this.changePattern}
                            style={{width: '100%'}} 
                            placeholder='格局简要说明'
                            readOnly={this.state.readonly}
                        />
                    </Col>
                    <Col span={4}>
                        <Select value={this.state['格局成立']} onChange={this.changeSuccess} 
                            style={{width: '100%'}} disabled={selDisabled}
                        >
                            <Option value={-1}>未知</Option>
                            <Option value={0}>破格</Option>
                            <Option value={1}>格局成立</Option>
                        </Select>
                    </Col>
                    <Col span={4}>
                        <Select value={this.state['格局级别']} onChange={this.changeLevel} 
                            style={{width: '100%'}} disabled={selDisabled}
                        >
                            <Option value={-1}>未知</Option>
                            <Option value={0}>贫困户</Option>
                            <Option value={1}>低保户</Option>
                            <Option value={2}>普通人</Option>
                            <Option value={3}>小福贵</Option>
                            <Option value={4}>中福贵</Option>
                            <Option value={5}>大福贵</Option>
                            <Option value={6}>金字塔尖</Option>
                        </Select>
                    </Col>
                </Row>

                {dom}
                <Divider orientation='left'>描述：</Divider>
                <div>
                    <RichEditor 
                        height={editheight} 
                        readOnly={this.state.readonly}
                        value={this.state['描述']}  
                        newValue={this.newval}
                        onChange={this.changeDesc}                    
                    />
                </div>
            </div>
        )
    }
}