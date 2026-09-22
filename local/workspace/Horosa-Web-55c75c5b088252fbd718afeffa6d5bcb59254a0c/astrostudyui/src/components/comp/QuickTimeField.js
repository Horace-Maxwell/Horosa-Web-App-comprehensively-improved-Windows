// 快捷数字时间录入·共享件(单源):
//   TimeFieldTrigger —— 左栏「时间与地点」字段:单击=原样弹时间编辑器(antd Popover 不受控,响应逐字不变);
//                       双击=同一字段变成键入框,连续输入 14 位数字(年月日时分秒),输满/回车即换算提交,Esc 取消。
//   QuickTimeText    —— 任意「单行显示时间」的元素(天文馆时间行等):单击照旧走宿主 onClick,双击同上键入;
//                       宿主自带样式/ref(innerRef)全保留,键入态只把文字换成输入框。
//   QuickTimeInput   —— 「添加星盘 / 添加起课 / 修改参数」表单里的「快捷输入」行:默认空白,输满/回车/失焦即回填上方时间。
// 解析规则见 utils/quickDateTimeDigits.js;提交一律经宿主既有的时间处理器(onQuickCommit / onCommit),时区沿用当前值。
import React, { Component } from 'react';
import { Popover, Row, Col, message } from 'antd';
import { XQInput } from '../xq-ui';
import XQIcon from '../xq-icons';
import { applyQuickDigits, normalizeQuickDigits, formatQuickDigits, QUICK_DIGITS_LEN } from '../../utils/quickDateTimeDigits';
import './QuickTimeField.less';

export const QUICK_TIME_PLACEHOLDER = '键入 14 位数字：年月日时分秒';
export const QUICK_TIME_FORM_PLACEHOLDER = '连续键入数字：年 4 位 + 月日时分秒各 2 位，如 20061004095801（不足补 0，多余丢弃）';
export const QUICK_TIME_TITLE = '单击打开时间编辑器；双击可直接键入 14 位数字（年月日时分秒），输满或回车即生效，Esc 取消';

function defaultInvalid(text){
	try{ message.error(text, 3); }catch(e){ /* 无 antd 上下文时静默 */ }
}

function isEnter(e){ return e && (e.key === 'Enter' || e.key === 'Return' || e.keyCode === 13 || e.which === 13); }
function isEscape(e){ return e && (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27); }

/** 键入态公共内核:state {editing,text};输满自动提交 / 回车提交 / 失焦有字提交无字取消 / Esc 取消 / IME 组合期不提交 */
class QuickTimeEditable extends Component{
	constructor(props){
		super(props);
		this.state = { editing: false, text: '' };
		this.inputRef = React.createRef();
		this._composing = false;
		this._closing = false;
		this.startEdit = this.startEdit.bind(this);
		this.onInput = this.onInput.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onBlur = this.onBlur.bind(this);
		this.onCompositionStart = this.onCompositionStart.bind(this);
		this.onCompositionEnd = this.onCompositionEnd.bind(this);
	}

	componentDidUpdate(prevProps, prevState){
		if(this.state.editing && !prevState.editing && this.inputRef.current){
			try{ this.inputRef.current.focus(); }catch(e){ /* noop */ }
		}
	}

	componentWillUnmount(){
		this._closing = true;
	}

	baseValue(){
		return this.props.value || null;
	}

	startEdit(e){
		if(e && e.preventDefault){ e.preventDefault(); }
		this._closing = false;
		this.setState({ editing: true, text: '' });
	}

	leave(){
		this._closing = true;
		this.setState({ editing: false, text: '' }, ()=>{ this._closing = false; });
	}

	commit(text, { fromBlur } = {}){
		const res = applyQuickDigits(this.baseValue(), text, { zone: this.props.zone });
		if(res.errorCode === 'empty'){
			this.leave();
			return false;
		}
		if(!res.ok){
			const onInvalid = this.props.onInvalid || defaultInvalid;
			onInvalid(res.error, res);
			if(fromBlur){
				this.leave();
			}else if(this.inputRef.current){
				try{ this.inputRef.current.select(); }catch(e){ /* noop */ }
			}
			return false;
		}
		this.leave();
		if(this.props.onQuickCommit){
			this.props.onQuickCommit(res.dt, { digits: res.digits, padded: res.padded, truncated: res.truncated });
		}
		return true;
	}

	onInput(e){
		const raw = e && e.target ? e.target.value : '';
		const { digits } = normalizeQuickDigits(raw);
		this.setState({ text: digits });
		if(digits.length >= QUICK_DIGITS_LEN && !this._composing){
			this.commit(raw);   // 传原文而非已截 14 位的 digits:meta.truncated 才能如实报「多余位已丢弃」
		}
	}

	onKeyDown(e){
		if(isEnter(e)){
			e.preventDefault(); e.stopPropagation();
			this.commit(this.state.text);
		}else if(isEscape(e)){
			e.preventDefault(); e.stopPropagation();
			this.leave();
		}
	}

	onBlur(){
		if(!this.state.editing || this._closing){ return; }
		if(!this.state.text){ this.leave(); return; }
		this.commit(this.state.text, { fromBlur: true });
	}

	onCompositionStart(){ this._composing = true; }
	onCompositionEnd(e){
		this._composing = false;
		this.onInput(e);
	}

	renderInput(){
		return (
			<input
				ref={this.inputRef}
				className="horosa-quick-time-input"
				type="text"
				inputMode="numeric"
				autoComplete="off"
				spellCheck={false}
				value={this.state.text}
				placeholder={this.props.placeholder || QUICK_TIME_PLACEHOLDER}
				onChange={this.onInput}
				onKeyDown={this.onKeyDown}
				onBlur={this.onBlur}
				onCompositionStart={this.onCompositionStart}
				onCompositionEnd={this.onCompositionEnd}
				data-quick-time-input="1"
			/>
		);
	}
}

/** 左栏时间字段:Popover+按钮(单击弹窗)⇄ 键入态(双击) */
export class TimeFieldTrigger extends QuickTimeEditable{
	render(){
		const { timeText, popoverContent, placement, overlayClassName, showIcon, iconName, className, style, title } = this.props;
		const cls = `horosa-unified-field horosa-quick-time-field ${className || ''}`.trim();
		const icon = showIcon === false ? null : <XQIcon name={iconName || 'clock'} />;
		if(this.state.editing){
			return (
				<div className={`${cls} is-editing`} style={style} data-quick-time-editing="1">
					{icon}
					{this.renderInput()}
				</div>
			);
		}
		return (
			<Popover content={popoverContent} trigger="click" placement={placement || 'rightTop'} overlayClassName={overlayClassName || 'horosa-time-adjust-popover'}>
				<button type="button" className={cls} style={style} title={title || QUICK_TIME_TITLE} onDoubleClick={this.startEdit} data-quick-time-trigger="1">
					{icon}
					<span>{timeText}</span>
				</button>
			</Popover>
		);
	}
}

/** 任意单行时间文本(天文馆时间行等):单击走宿主 onClick 不变,双击键入;宿主 className/style/role/innerRef 原样保留 */
export class QuickTimeText extends QuickTimeEditable{
	render(){
		const { as, className, style, title, role, onClick, innerRef, children, text } = this.props;
		const Tag = as || 'div';
		const cls = `horosa-quick-time-text ${className || ''}`.trim();
		if(this.state.editing){
			return (
				<Tag ref={innerRef} className={`${cls} is-editing`} style={style} data-quick-time-editing="1">
					{this.renderInput()}
				</Tag>
			);
		}
		return (
			<Tag ref={innerRef} className={cls} style={style} role={role} title={title || QUICK_TIME_TITLE} onClick={onClick} onDoubleClick={this.startEdit} data-quick-time-trigger="1">
				{children !== undefined ? children : text}
			</Tag>
		);
	}
}

/** 表单「快捷输入」行:选择器行与时区栏之间;输满 / 回车 / 失焦即回填,Esc 只清空(不冒泡到 Drawer) */
export class QuickTimeInput extends Component{
	constructor(props){
		super(props);
		this.state = { text: '', committedKey: null };
		this._composing = false;
		this._focused = false;
		this.onChange = this.onChange.bind(this);
		this.onKeyDown = this.onKeyDown.bind(this);
		this.onBlur = this.onBlur.bind(this);
		this.onFocus = this.onFocus.bind(this);
		this.onCompositionStart = this.onCompositionStart.bind(this);
		this.onCompositionEnd = this.onCompositionEnd.bind(this);
	}

	componentDidUpdate(prevProps){
		// 上方选择器被人工改成别的时间 → 已录入的数字不再代表当前值,清空(输入中不打扰)
		if(prevProps.value !== this.props.value && this.state.committedKey && !this._focused){
			const nowKey = formatQuickDigits(this.props.value);
			if(nowKey !== this.state.committedKey){
				this.setState({ text: '', committedKey: null });
			}
		}
	}

	commit(text){
		const res = applyQuickDigits(this.props.value || null, text, { zone: this.props.zone });
		if(res.errorCode === 'empty'){ return false; }
		if(!res.ok){
			(this.props.onInvalid || defaultInvalid)(res.error, res);
			return false;
		}
		if(res.padded === this.state.committedKey){ return true; }   // 输满自动提交 + 回车 + 失焦 三重触发去重
		this.setState({ committedKey: res.padded });
		if(this.props.onCommit){
			this.props.onCommit(res.dt, { digits: res.digits, padded: res.padded, truncated: res.truncated });
		}
		return true;
	}

	onChange(e){
		const raw = e && e.target ? e.target.value : '';
		const { digits } = normalizeQuickDigits(raw);
		this.setState({ text: digits, ...(digits ? {} : { committedKey: null }) });
		if(digits.length >= QUICK_DIGITS_LEN && !this._composing){
			this.commit(raw);
		}
	}

	onKeyDown(e){
		if(isEnter(e)){
			e.preventDefault(); e.stopPropagation();
			this.commit(this.state.text);
		}else if(isEscape(e)){
			e.preventDefault(); e.stopPropagation();   // 不让 antd Drawer 收到 Esc
			this.setState({ text: '', committedKey: null });
		}
	}

	onFocus(){ this._focused = true; }
	onBlur(){
		this._focused = false;
		if(this.state.text){ this.commit(this.state.text); }
	}
	onCompositionStart(){ this._composing = true; }
	onCompositionEnd(e){ this._composing = false; this.onChange(e); }

	render(){
		const { label, placeholder, marginTop } = this.props;
		return (
			<Row gutter={12} style={{ marginTop: marginTop === undefined ? 10 : marginTop }} className="horosa-quick-time-row" data-quick-time-form="1">
				<Col span={24}>{label || '快捷输入：'}</Col>
				<Col span={24}>
					<XQInput
						value={this.state.text}
						placeholder={placeholder || QUICK_TIME_FORM_PLACEHOLDER}
						inputMode="numeric"
						autoComplete="off"
						allowClear
						onChange={this.onChange}
						onKeyDown={this.onKeyDown}
						onFocus={this.onFocus}
						onBlur={this.onBlur}
						onCompositionStart={this.onCompositionStart}
						onCompositionEnd={this.onCompositionEnd}
						data-quick-time-input="1"
					/>
				</Col>
			</Row>
		);
	}
}

export default TimeFieldTrigger;
