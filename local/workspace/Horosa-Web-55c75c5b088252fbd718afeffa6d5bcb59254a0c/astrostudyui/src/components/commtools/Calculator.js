import { Component } from 'react';
import { Row, Col, Button, Divider, Statistic, Select, Input, Modal, Tooltip } from 'antd';
import { randomStr, isNumber } from '../../utils/helper';
import { splitDegree, } from '../astro/AstroHelper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import styles from '../../css/styles.less';

const Option = Select.Option;
const { TextArea } = Input;

export default class Calculator extends Component{
	constructor(props) {
		super(props);

        this.state = {
            expression: '',
            vars: null,

            value: '',
            valueDeg: [0, 0, 0],
            valueDeg360: [0, 0, 0],
            formula: [],

            option: [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        };

        this.requestFormula = this.requestFormula.bind(this);
        this.requestCalc = this.requestCalc.bind(this);
        this.requestCalcDEG = this.requestCalcDEG.bind(this);

        this.genOptionDom = this.genOptionDom.bind(this);
        this.changeExpress = this.changeExpress.bind(this);
        this.changeVars = this.changeVars.bind(this);
        this.changeOption = this.changeOption.bind(this);
        this.addExpression = this.addExpression.bind(this);
        this.clearExpr = this.clearExpr.bind(this);
        this.clearVars = this.clearVars.bind(this);
    }

	async requestCalc(){
		let params = {
			expression: this.state.expression,
            vars: this.state.vars,
		}

        if(params.expression === undefined || params.expression === null || params.expression === ''){
            Modal.error({
                title: '表达式不能为空'
            });
            return;
        }

		const data = await request(`${Constants.ServerRoot}/calc/calculate`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];
        let val = result.value;

        let valdeg = val * (180 / Math.PI);
        let deg = splitDegree(valdeg);
        let deg360 = splitDegree(((valdeg % 360) + 360) % 360);

        val = Math.round(val * 1000000)/1000000;
		const st = {
			value: val,
            valueDeg: deg,
            valueDeg360: deg360,
		};

		this.setState(st);
	}

	async requestCalcDEG(){
		let params = {
			expression: this.state.expression,
            vars: this.state.vars,
		}

        if(params.expression === undefined || params.expression === null || params.expression === ''){
            Modal.error({
                title: '表达式不能为空'
            });
            return;
        }

		const data = await request(`${Constants.ServerRoot}/calc/calculate`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];
        let val = result.value;

        let deg = splitDegree(val);
        let deg360 = splitDegree(((val % 360) + 360) % 360);

        // let proxval = Math.round(val * 1000000)/1000000;
		const st = {
			value: val,
            valueDeg: deg,
            valueDeg360: deg360,
		};

		this.setState(st);
	}

	async requestFormula(){
		let params = {}

		const data = await request(`${Constants.ServerRoot}/calc/formula`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			formula: result.formula,
		};

        let now = new Date();
        let formulajson = {
            formula: result.formula,
            time: now.getTime(),
        }
        localStorage.setItem("CalculatorFormula", JSON.stringify(formulajson));

		this.setState(st);
	}

    clearExpr(){
        this.setState({
            expression: '',
        });
    }

    clearVars(){
        this.setState({
            vars: null,
        });
    }

    changeExpress(e){
        let val = e.target.value;
        this.setState({
            expression: val,
        });
    }

    changeVars(e){
        let val = e.target.value;
        this.setState({
            vars: val,
        });
    }

    changeOption(idx, val){
        let opt = this.state.option;
        opt[idx] = val;

        this.setState({
            option: opt,
        });
    }

    addExpression(idx){
        let opt = this.state.option;
        let fun = opt[idx];
        if(fun === undefined || fun === null || fun === ''){
            return;
        }

        let expr = this.state.expression;
        if(expr){
            expr = expr + fun;
        }else{
            expr = fun;
        }

        this.setState({
            expression: expr,
        });
    }

    genOptionDom(){
        let opdom = [];
        let boolopdom = [];
        let binreladom = [];
        let unifundom = [];
        let binfundom = [];
        let trifundom = [];
        let varfundom = [];
        let calfundom = [];
        let bitwisedom = [];
        let iterdom = [];
        let constdom = [];
        let unitdom = [];
        for(let i=0; i<this.state.formula.length; i++){
            let item = this.state.formula[i];
            if(item.type === '<Operator>'){
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                opdom.push(opt);
            }else if(item.type === '<Boolean Operator>'){
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                boolopdom.push(opt);
            }else if(item.type === '<Binary Relation>'){
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                binreladom.push(opt);
            }else if(item.type === '<Unary Function>'){
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                unifundom.push(opt);
            }else if(item.type === '<Binary Function>' && item.syntax !== 'EulerPol'){
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                binfundom.push(opt);
            }else if(item.type === '<3-args Function>'){
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                trifundom.push(opt);
            }else if(item.type === '<Variadic Function>'){
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                varfundom.push(opt);
            }else if(item.type === '<Calculus Operator>'){
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                calfundom.push(opt);
            }else if(item.type === '<Random Variable>'){
                let prefix = 'Random variable - ';
                let idx = prefix.length;
                let desc = item.desc.substr(idx);
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {desc}
                    </Option>
                )    
                iterdom.push(opt);
            }else if(item.type === '<Bitwise Operator>'){
                let opt = (
                    <Option key={randomStr(8)} value={item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                bitwisedom.push(opt);
            }else if(item.type === '<Constant Value>'){
                let opt = (
                    <Option key={randomStr(8)} value={'*' + item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                constdom.push(opt);
            }else if(item.type === '<Unit>'){
                let opt = (
                    <Option key={randomStr(8)} value={'*' + item.syntax}>
                        {item.syntax} -- {item.desc}
                    </Option>
                )    
                unitdom.push(opt);
            }
        }

        let res = {
            operator: opdom,
            boolOperator: boolopdom,
            binRela: binreladom,
            unaryFun: unifundom,
            binFun: binfundom,
            triFun: trifundom,
            varFun: varfundom,
            calFun: calfundom,
            bitwise: bitwisedom,
            iterator: iterdom,
            constant: constdom,
            unit: unitdom,
        }
        return res;
    }

 
    componentDidMount(){
        let formula = null;
        try{
            formula = localStorage.getItem("CalculatorFormula")
            if(formula){
                let obj = JSON.parse(formula);
                let now = new Date();
                let tm = now.getTime();
                if(obj.time === undefined || obj.time === null || tm - obj.time > 3600000 * 24 *7){
                    this.requestFormula();
                }else{
                    this.setState({
                        formula: obj.formula,
                    });    
                }
            }else{
                this.requestFormula();
            }
        }catch(e){
            this.requestFormula();
        }
    }

    render(){
        let opt = this.genOptionDom();
        let deg = this.state.valueDeg;
        let deg360 = this.state.valueDeg360;
        let degstr = deg360[0]+ 'º' + deg360[1] + "'" + deg360[2] + "''"; 
        let degstrExpr = '(' + deg[0]+ '*[deg]+' + deg[1] + "*[']+" + deg[2] + "*[''])"; 
        if(deg.length > 3){
            if(deg[0] === 0){
                degstrExpr = '-1*(' + deg[1] + "*[']+" + deg[2] + "*[''])";
            }else{
                degstrExpr = '-1*(' + Math.abs(deg[0])+ '*[deg]+' + deg[1] + "*[']+" + deg[2] + "*[''])"; 
            }
        }
 
        let in360 = deg360[0] % 360;
        let sigdeg = in360 / 30;
        let sigidx = Math.floor(sigdeg);
        let sig = AstroConst.LIST_SIGNS[sigidx];
        let zi = AstroText.AstroMsgCN[sig];
        let deginsig = Math.floor(in360 % 30);
        let sigdegstr = zi + deginsig + 'º' + deg360[1] + "'" + deg360[2] + "''";

        let tooltipdom = (
            <ul>
                <li>
                    <span>二进制结果值：</span>
                    <span>{this.state.value.toString('2')}</span>
                </li>
                <li>
                    <span>十六进制结果值：</span>
                    <span>{'0x' + this.state.value.toString('16')}</span>
                </li>
            </ul>
        );


        let gutter = 6;
        let formulaspan = 24;
        let selspan = 20;
        let addspan = 4;

        let formulaH = 250;

        return (
            <div>
                <Row gutter={6}>
                    <Col span={18}>
                        <div>表达式</div>
                        <TextArea autoSize={{ minRows: 6, maxRows: 6 }} style={{width: '100%'}} 
                            onChange={this.changeExpress}
                            value={this.state.expression}
                        />
                    </Col>
                    <Col span={6}>
                        <div>变量值</div>
                        <TextArea autoSize={{ minRows: 6, maxRows: 6 }} style={{width: '100%'}} 
                            onChange={this.changeVars}
                            value={this.state.vars}
                        />
                    </Col>
                </Row>

                <div className={styles.scrollbar} style={{marginTop:5, height: formulaH, overflowY:'auto', overflowX:'hidden',}} >
                <Row gutter={6}>
                <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='常用常量'
                                value={this.state.option[10]} allowClear
                                onChange={(val)=>{ this.changeOption(10, val);}}>
                                <Option value='b2.'>b2. -- 二进制数前缀</Option>
                                <Option value='h.'>h. -- 十六进制数前缀</Option>
                                <Option value='*180/pi'>180/pi -- 弧度转角度</Option>
                                <Option value='*pi/180'>pi/180 -- 角度转弧度</Option>
                                <Option value='*pi'>pi -- 圆周率</Option>
                                <Option value='*e'>e -- 自然对数常量(Napier's constant, or Euler's number, base of Natural logarithm)</Option>
                                <Option value='*[true]'>[true] -- Boolean True represented as double, [true] = 1</Option>
                                <Option value='*[false]'>[false] -- Boolean False represented as double, [false] = 0</Option>
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(10);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}}  placeholder='算术运算操作符'
                                value={this.state.option[0]} allowClear
                                onChange={(val)=>{ this.changeOption(0, val);}}>
                                {opt.operator}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(0);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}}  placeholder='逻辑运算操作符'
                                value={this.state.option[1]} allowClear
                                onChange={(val)=>{ this.changeOption(1, val);}}>
                                {opt.boolOperator}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(1);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}}  placeholder='位运算操作符'
                                value={this.state.option[2]} allowClear
                                onChange={(val)=>{ this.changeOption(2, val);}}>
                                {opt.bitwise}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(2);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='比较运算符'
                                value={this.state.option[3]} allowClear
                                onChange={(val)=>{ this.changeOption(3, val);}}>
                                {opt.binRela}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(3);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='单参数函数'
                                value={this.state.option[4]} allowClear
                                onChange={(val)=>{ this.changeOption(4, val);}}>
                                {opt.unaryFun}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(4);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='双参数函数'
                                value={this.state.option[5]} allowClear
                                onChange={(val)=>{ this.changeOption(5, val);}}>
                                {opt.binFun}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(5);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='三参数函数'
                                value={this.state.option[6]} allowClear
                                onChange={(val)=>{ this.changeOption(6, val);}}>
                                {opt.triFun}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(6);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='可变参数函数'
                                value={this.state.option[7]} allowClear
                                onChange={(val)=>{ this.changeOption(7, val);}}>
                                {opt.varFun}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(7);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='微积分/迭代函数'
                                value={this.state.option[8]} allowClear
                                onChange={(val)=>{ this.changeOption(8, val);}}>
                                {opt.calFun}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(8);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='随机变量'
                                value={this.state.option[9]} allowClear
                                onChange={(val)=>{ this.changeOption(9, val);}}>
                                {opt.iterator}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(9);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='角度单位'
                                value={this.state.option[11]} allowClear
                                onChange={(val)=>{ this.changeOption(11, val);}}>
                                <Option value='*[deg]'>[deg] -- 度(Degree of arc)</Option>
                                <Option value="*[']">['] -- 分(Minute of arc)</Option>
                                <Option value="*['']">[''] -- 秒(Second of arc)</Option>
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(11);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='常量'
                                value={this.state.option[12]} allowClear
                                onChange={(val)=>{ this.changeOption(12, val);}}>
                                {opt.constant}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(12);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                    <Col span={formulaspan}>
                    <Row gutter={gutter}>
                        <Col span={selspan}>
                            <Select style={{width: '100%'}} placeholder='单位'
                                value={this.state.option[13]} allowClear
                                onChange={(val)=>{ this.changeOption(13, val);}}>
                                {opt.unit}
                            </Select>
                        </Col>
                        <Col span={addspan}>
                            <Button onClick={()=>{this.addExpression(13);}} style={{width: '100%'}}>添加</Button>
                        </Col>
                    </Row>
                    </Col>

                </Row>
                </div>

                <Row style={{marginTop: 10}} gutter={6}>
                    <Col span={6}>
                        <Tooltip title='结果值不转化为度数(不做转化处理)，直接显示在度分秒中'>
                            <Button type='primary' onClick={()=>{this.requestCalcDEG();}}>标准计算</Button>
                        </Tooltip>
                    </Col>
                    <Col span={6}>
                        <Button onClick={()=>{this.clearExpr();}}>清除表达式</Button>
                    </Col>
                    <Col span={6}>
                        <Button onClick={()=>{this.clearVars();}}>清除变量值</Button>
                    </Col>
                    <Col span={6}>
                        <Tooltip title='结果值为弧度，先转化为度数（乘以(180/pi)）后，才显示在度分秒中'>
                            <Button type='primary' shape='round' onClick={()=>{this.requestCalc();}}>弧度计算</Button>
                        </Tooltip>
                    </Col>
                </Row>

                <Divider orientation='left'>计算结果</Divider>
                <Row gutter={12}>
                    <Col span={8}>
                        <Tooltip title={tooltipdom}>
                            <Statistic title='结果值(十进制)' value={this.state.value} valueStyle={{wordBreak:'break-all', wordWrap: 'break-word'}} />
                        </Tooltip>
                    </Col>
                    <Col span={8}>
                        <Statistic title='度分秒形式' value={degstr} valueStyle={{wordBreak:'break-all', wordWrap: 'break-word'}} />
                    </Col>
                    <Col span={8}>
                        <Statistic title='星盘位置' value={sigdegstr} valueStyle={{wordBreak:'break-all', wordWrap: 'break-word'}} />
                    </Col>
                </Row>
                <Row style={{marginTop: 10}} gutter={6}>
                    <Col span={24}>
                        <Statistic title='表达式中度分秒以弧度方式参与计算的写法' value={degstrExpr} />
                    </Col>
                </Row>
            </div>
        )
    }
}