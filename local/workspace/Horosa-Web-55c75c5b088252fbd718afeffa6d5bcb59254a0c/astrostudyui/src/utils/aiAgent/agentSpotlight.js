// [批五]「AI 正在操作」可见反馈:被操作的控件/区域闪一圈金边脉冲 + 一条带「撤销」的提示(antd message)。
// 纪律:只在行动能力总开关开着时才动 DOM(缺省关=零 DOM 改动);样式运行时注入 <style id>(不碰 app.less);
// 目标定位面只认 data-* / id 选择器;找不到目标只出提示不报错。零数据层 import。
import React from 'react';
import { isAgentEnabled } from './prefs';

export const SPOTLIGHT_STYLE_ID = 'horosa-agent-spotlight';
export const SPOTLIGHT_CLASS = 'horosa-agent-spotlight';
export const SPOTLIGHT_MS = 1600;
const CSS = `.${SPOTLIGHT_CLASS}{outline:2px solid var(--horosa-accent,#e7bd75)!important;outline-offset:-2px;animation:${SPOTLIGHT_CLASS}-pulse 0.8s ease-in-out 2}@keyframes ${SPOTLIGHT_CLASS}-pulse{0%,100%{box-shadow:0 0 0 0 var(--horosa-accent-soft,rgba(231,189,117,.25))}50%{box-shadow:0 0 0 8px var(--horosa-accent-soft,rgba(231,189,117,.25))}}`;

function ensureStyle(){
	if(typeof document === 'undefined' || document.getElementById(SPOTLIGHT_STYLE_ID)){ return; }
	const st = document.createElement('style');
	st.id = SPOTLIGHT_STYLE_ID;
	st.textContent = CSS;
	document.head.appendChild(st);
}

let toastImpl = null;   // 测试可注入;缺省惰性取 antd message(utils 层不静态拖 antd)
export function __setSpotlightToastForTests(fn){ toastImpl = fn; }

function toast(label, undo){
	if(toastImpl){ try{ toastImpl(label, undo); }catch(e){ /* noop */ } return; }
	let message = null;
	try{ message = require('antd').message; }catch(e){ message = null; }
	if(!message || typeof message.open !== 'function'){ return; }
	const key = `${SPOTLIGHT_CLASS}-${Date.now()}`;
	const content = React.createElement('span', { 'data-agent-spotlight-toast': '1' }, label,
		typeof undo === 'function' ? React.createElement('a', { style: { marginLeft: 10 }, 'data-agent-spotlight-undo': '1', onClick: ()=>{ try{ undo(); }finally{ try{ message.destroy(key); }catch(e){ /* noop */ } } } }, '撤销') : null);
	try{ message.open({ key, content, duration: 8 }); }catch(e){ /* noop */ }
}

// spotlight({ el?, selector?, label?, undo?, ms? }) → 是否找到目标。总开关关=什么都不做(回 false)。
export function spotlight(opts){
	const o = opts || {};
	if(typeof document === 'undefined' || !isAgentEnabled()){ return false; }
	ensureStyle();
	let target = o.el || null;
	if(!target && o.selector){ try{ target = document.querySelector(o.selector); }catch(e){ target = null; } }
	if(target && target.classList){
		target.classList.add(SPOTLIGHT_CLASS);
		setTimeout(()=>{ try{ target.classList.remove(SPOTLIGHT_CLASS); }catch(e){ /* noop */ } }, o.ms || SPOTLIGHT_MS);
	}
	if(o.label){ toast(`${o.label}`, o.undo); }
	return !!target;
}
