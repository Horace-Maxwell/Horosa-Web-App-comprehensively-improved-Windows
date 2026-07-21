import { Component } from 'react';
import { Row, Col, Divider, Popconfirm, message} from 'antd';
import { XQButton as Button, XQInput as Input, XQSelect as Select } from '../xq-ui';
import { isNumber } from '../../utils/helper';
// 八字格局完全本地化(localStorage 存读),不再依赖后端 → 删除 request/Constants 引用
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/safeStorage';
import {BaziMonthTime, SixtyJiaZi} from '../../constants/ZWConst';
import RichEditor from '../RichEditor';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

const { Option } = Select;

const BaziPatternKey = 'baziPattern';
// 🆕 本地八字格局模板:6 个属性维度,在 UI 中以下拉显示;type 0=三选数量(没有/一个/多个),type 1=是否(否/是)。
// 用户填写后存到 localStorage(按「年月日时柱+性别」作 key)→ 永久本地可用,完全脱离后端登录依赖。
const LOCAL_BAZI_PATTERN_ATTRS = [
    { key: '配偶数', type: 0 },
    { key: '有孩子', type: 0 },
    { key: '有儿子', type: 0 },
    { key: '易受伤', type: 1 },
    { key: '易生病', type: 1 },
    { key: '易牢狱', type: 1 },
];
function localPatternStorageKey(year, month, date, time, gender){
    return `baziPattern_local::${year}_${month}_${date}_${time}::g${gender}`;
}
function loadLocalPattern(year, month, date, time, gender){
    const raw = safeLocalStorageGet(localPatternStorageKey(year, month, date, time, gender));
    if(!raw) return null;
    try{
        return JSON.parse(raw);
    }catch(e){
        return null;
    }
}
function saveLocalPattern(year, month, date, time, gender, data){
    try{
        return safeLocalStorageSet(localPatternStorageKey(year, month, date, time, gender), JSON.stringify(data));
    }catch(e){
        return false;
    }
}

export default class BaziPattern extends Component{
	constructor(props) {
		super(props);

        // 🛡 safeStorage(下同):WKWebView 配额满 / 私有模式不抛错让组件崩。
        let json = safeLocalStorageGet(BaziPatternKey);
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
        try{
            const json = JSON.stringify(this.state);
            safeLocalStorageSet(BaziPatternKey, json);
        }catch(e){ /* 静默,绝不让 setState callback 抛 quota 错给 ErrorBoundary */ }
        this.newval = false;
    }

	updatePattern(){
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

        // 🆕 完全本地化:存 localStorage(按「年月日时柱+性别」作 key)。
        // 男女各存一份,gender=-1(不区分) 时同时存男女两份。永久本地可用,完全脱离后端登录依赖。
        const data = {
            '格局': st['格局'],
            '格局码': st['格局码'],
            '格局成立': st['格局成立'],
            '格局级别': st['格局级别'],
            '描述': st['描述'],
        };
        (st.attrs || LOCAL_BAZI_PATTERN_ATTRS).forEach((item)=>{
            data[item.key] = st[item.key];
        });
        const genders = (st.gender === -1) ? [0, 1] : [st.gender];
        let okCount = 0;
        genders.forEach((g)=>{
            if(saveLocalPattern(st.year, st.month, st.date, st.time, g, data)){
                okCount++;
            }
        });
        // 🛡 即便 safeLocalStorageSet 返回 false(WKWebView quota 满 / 隐私模式 SecurityError),
        //   组件 saveState 在每次输入 setState callback 里已经写过当前 state 快照(baziPattern 主 key),
        //   本会话 React state 也仍保有用户填写的全部内容 → 不该弹「失败」让用户以为白填了。
        //   持久化失败给 warning 友好提示告知"下次启动可能需重填"即可,不再阻塞使用。
        if(okCount > 0){
            message.success('八字格局已保存到本机');
        }else{
            message.warning('八字格局已暂存当前会话(浏览器存储空间满,下次启动可能需重填)');
        }
	}

	requestPattern(){
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

        // 🆕 完全本地化:用固定 attrs 模板 + 从 localStorage 读已存数据(按「年月日时柱+性别」)。
        // 男女各读一份;未存过时给空白默认值,让用户填表后提交保存。永久本地可用,完全脱离后端。
        const attrs = LOCAL_BAZI_PATTERN_ATTRS;
        const male = loadLocalPattern(st.year, st.month, st.date, st.time, 1);
        const female = loadLocalPattern(st.year, st.month, st.date, st.time, 0);
        const resst = {
            female: female,
            male: male,
            attrs: attrs,
            readonly: false,
        };
        let pat = (st.gender === 0) ? female : male;
        if(pat){
            resst['格局'] = pat['格局'];
            resst['格局码'] = pat['格局码'];
            resst['格局级别'] = pat['格局级别'];
            resst['格局成立'] = pat['格局成立'];
            resst['描述'] = pat['描述'];
            attrs.forEach((item)=>{
                resst[item.key] = pat[item.key];
            });
        }else{
            // 没读到 → 给空白默认让用户填
            resst['格局'] = null;
            resst['格局码'] = -1;
            resst['格局级别'] = -1;
            resst['格局成立'] = -1;
            resst['描述'] = null;
            attrs.forEach((item)=>{
                resst[item.key] = -1;
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
        // horosa_no_state_mutation_v1:原实现是 `let st = this.state; st[key] = val; this.setState(st)`
        // —— 直接**就地改写 this.state**。三重害处:① 当前 state 在 setState 之前就已被改掉,
        // sCU/componentDidUpdate 拿到的 prevState 与 nextState 是同一个对象,任何「引用变了吗」
        // 的比较(本仓 sCU 的通用范式)一律判「没变」→ 该更新时不更新;② 把整份 state 当补丁回传,
        // 未来新增的瞬态字段会被无意义地重写一遍;③ React 严格模式下属未定义行为。
        // 改为只提交单键补丁,值语义完全不变(setState 浅合并结果与原来逐字一致)。
        this.setState({ [key]: val }, ()=>{
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
                    <Col span={6} key={key}>
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
                    <Col span={6} key={key}>
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
                <Option key={item} value={item}>{item}</Option>
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
                <Option key={item} value={item}>{item}</Option>
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
                <Option key={item} value={item}>{item}</Option>
            )
        });
        let dopts = SixtyJiaZi.map((item, idx)=>{
            return (
                <Option key={item} value={item}>{item}</Option>
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
