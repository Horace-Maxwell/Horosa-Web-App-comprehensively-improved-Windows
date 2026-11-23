/**
 * 基础控件统一入口(复选 / 单选 / 滑块 / 加载 / 空态 / 开关 / 数字框)合同:
 *   ① 与 antd 原件同 API —— 静态成员照挂(Checkbox.Group / Radio.Group / Radio.Button / Empty 两张预设图)、属性透传、类名合并
 *   ② 能转 ref 的转 ref(取焦点等)
 *   ③ 页面里不再直接从 antd 引入这几件(由可维护性棘轮 rawAntd 计数,这里再锁死为 0,免得基线被 --accept-increase 放宽)
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Empty } from 'antd';
import { XQCheckbox, XQRadio, XQSlider, XQSpin, XQEmpty, XQSwitch, XQInputNumber, XQState, XQ_STATE_OFFLINE_TEXT } from '..';

const html = (el)=>renderToStaticMarkup(el);

describe('与 antd 原件同 API', ()=>{
	it('静态成员照挂', ()=>{
		// 两个组件组是转 ref 的件(页面会往组上挂 ref 量宽度;见 xqRefForwarding)
		expect(XQCheckbox.Group.$$typeof).toBe(Symbol.for('react.forward_ref'));
		expect(XQRadio.Group.$$typeof).toBe(Symbol.for('react.forward_ref'));
		expect(XQRadio.Button).toBeTruthy();
		expect(XQEmpty.PRESENTED_IMAGE_SIMPLE).toBe(Empty.PRESENTED_IMAGE_SIMPLE);
		expect(XQEmpty.PRESENTED_IMAGE_DEFAULT).toBe(Empty.PRESENTED_IMAGE_DEFAULT);
	});
	it('属性透传 + 统一类名与调用方类名合并', ()=>{
		expect(html(<XQCheckbox className="mine" checked>甲</XQCheckbox>)).toMatch(/xq-checkbox mine/);
		expect(html(<XQCheckbox checked>甲</XQCheckbox>)).toMatch(/ant-checkbox-checked/);
		expect(html(<XQCheckbox.Group options={['甲', '乙']} value={['乙']} />)).toMatch(/xq-checkbox-group/);
		const radios = html(<XQRadio.Group value="b"><XQRadio value="a">A</XQRadio><XQRadio.Button value="b">B</XQRadio.Button></XQRadio.Group>);
		['xq-radio-group', 'ant-radio-wrapper xq-radio', 'ant-radio-button-wrapper-checked xq-radio-button'].forEach((c)=>expect(radios).toContain(c));
		expect(html(<XQSlider value={30} />)).toMatch(/xq-slider/);
		expect(html(<XQSpin spinning><div>内容</div></XQSpin>)).toMatch(/xq-spin[\s\S]*内容/);
		expect(html(<XQEmpty description="暂无" />)).toMatch(/xq-empty[\s\S]*暂无/);
		expect(html(<XQSwitch checked />)).toMatch(/xq-switch/);
		expect(html(<XQInputNumber value={3} />)).toMatch(/xq-input-number/);
	});
	it('能转 ref 的转 ref', ()=>{
		['XQCheckbox', 'XQRadio', 'XQSlider', 'XQInputNumber'].forEach((n)=>{
			const C = { XQCheckbox, XQRadio, XQSlider, XQInputNumber }[n];
			expect([n, C.$$typeof === Symbol.for('react.forward_ref')]).toEqual([n, true]);
		});
	});
});

describe('三态件 XQState', ()=>{
	it('默认文案按对象名拼;出错带原因', ()=>{
		expect(html(<XQState status="loading" subject="龙盘" />)).toMatch(/龙盘计算中…/);
		expect(html(<XQState status="empty" subject="龙盘" />)).toMatch(/暂无龙盘数据/);
		const err = html(<XQState status="error" subject="龙盘" error="超时" />);
		expect(err).toMatch(/龙盘计算失败/);
		expect(err).toMatch(/超时/);
		expect(html(<XQState status="offline" />)).toContain(XQ_STATE_OFFLINE_TEXT);
	});
	it('重试钮只在出错 / 计算服务没回时出,且要给 onRetry', ()=>{
		const retry = ()=>{};
		expect(html(<XQState status="error" onRetry={retry} />)).toMatch(/重\s?试/);   // antd 两字按钮中间自动加空格
		expect(html(<XQState status="offline" onRetry={retry} retryLabel="再算一次" />)).toMatch(/再算一次/);
		expect(html(<XQState status="error" />)).not.toMatch(/xq-state-retry/);
		expect(html(<XQState status="loading" onRetry={retry} />)).not.toMatch(/xq-state-retry/);
		expect(html(<XQState status="empty" onRetry={retry} />)).not.toMatch(/xq-state-retry/);
	});
	it('一行布局把原因并进标题;占满布局分两行;出错与没回结果是 alert,其余是 status', ()=>{
		expect(html(<XQState layout="inline" status="error" subject="龙盘" error="超时" />)).toMatch(/龙盘计算失败：超时/);
		const fill = html(<XQState status="error" subject="龙盘" error="超时" />);
		expect(fill).toMatch(/xq-state-fill/);
		expect(fill).toMatch(/xq-state-desc[^>]*>超时/);
		expect(fill).toMatch(/role="alert"/);
		expect(html(<XQState status="loading" />)).toMatch(/role="status"/);
	});
});

describe('页面不再直引 antd 基础控件', ()=>{
	it('🔴 rawAntd 计数恒为 0', ()=>{
		const R = require('../../../../scripts/ui-ratchet.js');
		const cur = R.measureAll().shared.metrics.rawAntd;
		expect(cur).toEqual({});
	});
});
