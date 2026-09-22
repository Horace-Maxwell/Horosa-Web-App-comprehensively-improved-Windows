import { Component } from 'react';
import { Row, Col, Divider, message} from 'antd';
import { XQButton as Button, XQInputNumber as InputNumber, XQSelect as Select } from '../xq-ui';
import { isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import {BaziMonthTime, SixtyJiaZi} from '../../constants/ZWConst';
import MainDirectionSimple from '../cntradition/MainDirectionSimple';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../utils/safeStorage';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';   // [Q-317/T-304] 全局日界 / 晚子时
import { buildLocalBaziResult } from '../../utils/baziLunarLocal';                              // [Q-317] 候选回代校验(与八字页同引擎)
import { getStore } from '../../utils/storageutil';                                              // [Q-317] 当前盘时区/经纬
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

const { Option } = Select;

const BaziInverseKey = 'baziInverse';

export default class InverseBazi extends Component{
	constructor(props) {
		super(props);

        // 🛡 safeStorage:WKWebView 配额满 / 私有模式 getItem 抛错也不让 constructor 崩 → 整个 commtools 抽屉黑屏。
        let json = safeLocalStorageGet(BaziInverseKey);
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
            desc: 1,
            count: 1,
            fromYear: null,
            gender: 1,
            dates: [],
            paibazi: null,
        }

        this.requestDates = this.requestDates.bind(this);
        this.genDom = this.genDom.bind(this);
        this.changeYear = this.changeYear.bind(this);
        this.changeMonth = this.changeMonth.bind(this);
        this.changeDate = this.changeDate.bind(this);
        this.changeTime = this.changeTime.bind(this);
        this.changeCount = this.changeCount.bind(this);
        this.changeDesc = this.changeDesc.bind(this);
        this.changeFromYear = this.changeFromYear.bind(this);
        this.changeGender = this.changeGender.bind(this);

        this.genMonthOptions = this.genMonthOptions.bind(this);
        this.genTimeOptions = this.genTimeOptions.bind(this);

        this.saveState = this.saveState.bind(this);
    }

    saveState(){
        // 🛡 safeStorage:setItem 在 setState callback 内被调,WKWebView quota 满抛 QuotaExceededError → React 把异常冒到 ErrorBoundary → 组件崩。包 try/catch + 配额满自动清理重试。
        try{
            const json = JSON.stringify(this.state);
            safeLocalStorageSet(BaziInverseKey, json);
        }catch(e){
            // 静默
        }
    }

	async requestDates(){
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
            Year: st.year,
            Month: st.month,
            Date: st.date,
            Time: st.time,
            Count: st.count,
            Desc: st.desc,
            FromYear: st.fromYear,
        }


		const data = await request(`${Constants.ServerRoot}/common/inversebazi`, {
			body: JSON.stringify(params),
		});
		// 🔒 后端不可达/出错 → request 已 toast 提示;此处静默退出避免 data[ResultKey] 崩页(打包 app 内更易触发,WKWebView 弹白屏)
		const result = data && data[Constants.ResultKey];
        // [Q-309/T-315 ②] 反查失败 / 无候选:清掉旧结果并提示,不再让上一次的候选与大运概略留在页上冒充本次结果。
        if(!result || !result.Dates || !result.Dates.length){
            this.setState({ dates: [], dateChecks: [], paibazi: null, ruleNote: '' });
            if(data){ message.info('未找到符合该四柱的日期(可放宽起始年份或改变方向)'); }
            return;
        }
        // [Q-317/T-304] ① 后端反查按固定口径(23 点换日 / 夜子时 23:30 按次日干)出候选;此处按【全局】日界 / 晚子时用八字页同一本地引擎回代校验:
        //    四柱全等才保留;夜子时候选不等时改试同日 00:30 / 次日 00:30(同一子时的另一种换日归属),仍不等则标「按当前口径不成立」。
        // ② 大运概略改用当前盘的时区 / 经纬 + 全局两键(此前钉 +08:00 与福州、走后端缺省 23 点换日)。
        const geo = this.currentGeo();
        const rule = { after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay() };
        const want = { year: st.year, month: st.month, day: st.date, time: st.time };
        const checked = result.Dates.map((dt)=>this.verifyCandidate(dt, want, geo, rule));
        const okList = checked.filter((c)=>c.ok);
        const first = okList.length ? okList[0] : null;
        let paibazi = null;
        if(first){
            let dtparts = first.text.split(' ');
            let bzparams = {
                date: dtparts[0],
                time: dtparts[1],
                gender: this.state.gender,
                zone: geo.zone,
                lon: geo.lon,
                lat: geo.lat,
                after23NewDay: rule.after23NewDay,
                lateZiHourUseNextDay: rule.lateZiHourUseNextDay,
            };
            const pbzres = await request(`${Constants.ServerRoot}/bazi/direct`, {
                body: JSON.stringify(bzparams),
            });
            paibazi = pbzres && pbzres[Constants.ResultKey];
        }
		this.setState({
            dates: checked.map((c)=>c.text),
            dateChecks: checked,
            ruleNote: `按全局口径校验:日界【${rule.after23NewDay === 0 ? '24 点换日' : '23 点换日'}】· 晚子时时柱【${rule.lateZiHourUseNextDay === 0 ? '今日干起' : '次日干起'}】(钟表时,不含真太阳时修正);大运概略按当前盘 ${geo.zone} ${geo.lon} ${geo.lat}`,
            paibazi,
        });
	}

    changeYear(val){
        this.setState({
            year: val,
            month: null,
            paibazi: null,
            dates: [],
        }, ()=>{
            this.saveState();
        });
    }

    changeMonth(val){
        this.setState({
            month: val,
            paibazi: null,
            dates: [],
        }, ()=>{
            this.saveState();
        });
    }

    changeDate(val){
        this.setState({
            date: val,
            time: null,
            paibazi: null,
            dates: [],
        }, ()=>{
            this.saveState();
        });
    }

    changeTime(val){
        this.setState({
            time: val,
        }, ()=>{
            this.saveState();
        });
    }

    changeDesc(val){
        this.setState({
            desc: val,
        });
    }

    changeCount(val){
        this.setState({
            count: val,
        });
    }

    changeFromYear(val){
        this.setState({
            fromYear: val == 0 ? -1 : val,
        });
    }

    changeGender(val){
        this.setState({
            gender: val,
            paibazi: null,
        });
    }

    // [Q-317/T-304] 当前盘时区 / 经纬(astro fields;缺则回落默认)。
    currentGeo(){
        try{
            const st = getStore();
            const f = st && st.astro && st.astro.fields ? st.astro.fields : null;
            const v = (k)=>(f && f[k] && f[k].value !== undefined && f[k].value !== null && f[k].value !== '' ? f[k].value : undefined);
            return { zone: v('zone') || '+08:00', lon: v('lon') || '119e19', lat: v('lat') || '26n04' };
        }catch(e){ return { zone: '+08:00', lon: '119e19', lat: '26n04' }; }
    }
    // [Q-317/T-304] 候选回代:用八字页同一本地引擎按全局口径重排四柱;夜子时候选不等则改试 00:30 归属。
    verifyCandidate(text, want, geo, rule){
        const pillarsOf = (date, time)=>{
            try{
                const r = buildLocalBaziResult({ date: `${date}`.replace(/\//g, '-'), time: `${time}`.length === 5 ? `${time}:00` : time, zone: geo.zone, lon: geo.lon, lat: geo.lat, gender: this.state.gender, timeAlg: 1, ...rule });
                const c = r && r.bazi && r.bazi.fourColumns ? r.bazi.fourColumns : null;
                if(!c) return null;
                return { year: c.year && c.year.ganzi, month: c.month && c.month.ganzi, day: c.day && c.day.ganzi, time: c.time && c.time.ganzi };
            }catch(e){ return null; }
        };
        const eq = (p)=>!!p && p.year === want.year && p.month === want.month && p.day === want.day && p.time === want.time;
        const parts = `${text}`.split(' ');
        const d0 = parts[0]; const t0 = parts[1] || '12:00';
        if(eq(pillarsOf(d0, t0))){ return { text, ok: true }; }
        if(/^23:/.test(t0) || /^00:/.test(t0)){
            const shift = (ymd, days)=>{ const m = `${ymd}`.match(/^(-?\d+)[-/](\d+)[-/](\d+)$/); if(!m) return null; const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`; };
            const alts = /^23:/.test(t0) ? [[shift(d0, 1), '00:30'], [d0, '00:30']] : [[shift(d0, -1), '23:30'], [d0, '23:30']];
            for(let i = 0; i < alts.length; i++){
                const [ad, at] = alts[i];
                if(ad && eq(pillarsOf(ad, at))){ return { text: `${ad} ${at}`, ok: true, adjusted: true, from: text }; }
            }
        }
        return { text, ok: false };
    }

    genDom(){
        const checks = this.state.dateChecks || [];
        let cols = this.state.dates.map((item, idx)=>{
            const c = checks[idx];
            const mark = c ? (c.ok ? (c.adjusted ? `　✓（夜子时按当前口径归 ${c.text.split(' ')[1]}，原 ${c.from}）` : '　✓') : '　✗ 按当前日界 / 晚子时口径不成立') : '';
            return (
                <Col span={24} key={idx}>
                    <span style={c && !c.ok ? { color: 'var(--horosa-muted)', textDecoration: 'line-through' } : undefined}>{item}</span><span style={{ fontSize: 12, color: c && c.ok ? 'var(--horosa-accent-strong)' : 'var(--horosa-danger)' }}>{mark}</span>
                </Col>
            )
        });
        const note = this.state.ruleNote ? <div className="horosa-field-hint" style={{ marginBottom: 6 }}>{this.state.ruleNote}</div> : null;
        let bzdir = null;
        if(this.state.paibazi){
            let dirHeight = 550;
            bzdir = (
                <MainDirectionSimple value={this.state.paibazi.bazi} height={dirHeight} />
            )
        }
        let res = (
            <div>
                {note}
                <Row gutter={6} style={{marginBottom: 10}}>{cols}</Row>
                {bzdir}
            </div>
        );

        return res;
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

        return (
            <div>
                <Row gutter={12}>
                    <Col span={6}>年柱</Col>
                    <Col span={6}>月柱</Col>
                    <Col span={6}>日柱</Col>
                    <Col span={6}>时柱</Col>
                </Row>
                <Row gutter={12}>
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
                <Row gutter={12} style={{marginTop: 20}}>
                    <Col span={6}>启始年份</Col>
                    <Col span={6}>查找方向</Col>
                    <Col span={6}>结果时间数量</Col>
                    <Col span={6}></Col>
                </Row>
                <Row gutter={12} style={{marginBottom: 20}}>
                    <Col span={6}>
                        <InputNumber style={{width: '100%'}} 
                            value={this.state.fromYear} 
                            onChange={this.changeFromYear}
                            placeholder='启始年份'
                            max={5000}
                            min={-5000}
                            step={1}
                        />
                    </Col>
                    <Col span={6}>
                        <Select value={this.state.desc} onChange={this.changeDesc} style={{width: '100%'}}>
                            <Option value={1}>向前查</Option>
                            <Option value={0}>向后查</Option>
                        </Select>
                    </Col>
                    <Col span={6}>
                        <InputNumber style={{width: '100%'}} 
                            value={this.state.count} 
                            onChange={this.changeCount}
                            placeholder='结果时间数量'
                            max={3}
                            min={1}
                            step={1}
                        />
                    </Col>
                    <Col span={3}>
                        <Select value={this.state.gender} onChange={this.changeGender} style={{width: '100%'}}>
                            <Option value={0}>女</Option>
                            <Option value={1}>男</Option>
                        </Select>
                    </Col>
                    <Col span={3}>
                        <Button type='primary' onClick={this.requestDates}>查找</Button>
                    </Col>
                </Row>
                <Divider orientation='left'>结果时间与第一个时间的大运概略：</Divider>
                {dom}
            </div>
        )
    }
}
