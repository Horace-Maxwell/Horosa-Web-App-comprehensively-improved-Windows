// 择日条件参数表单:每种字段形态都真渲染一遍(元数据驱动的表单,某个形态的控件漏了引用,只有渲染到那个形态才炸 ——
// 曾有数字框换成统一件时漏了 import,选到带数字参数的条件整块表单 ReferenceError)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ConditionParamsForm from '../ConditionParamsForm';

let host = null;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ ReactDOM.unmountComponentAtNode(host); host.remove(); });

const TYPES = {
	numberish: { label: '数字', fields: [{ key: 'min', kind: 'number', label: '≥第几天', min: 1, max: 17, step: 1 }] },
};

it('🔴 数字字段:渲染出数字框(统一件)且值在框里;清空后出「不能留空」提示', ()=>{
	const onChange = jest.fn();
	act(()=>{ ReactDOM.render(<ConditionParamsForm types={TYPES} type="numberish" params={{ min: 3 }} onChange={onChange} />, host); });
	const input = host.querySelector('input');
	expect(input).toBeTruthy();
	expect(host.querySelector('.ant-input-number')).toBeTruthy();
	expect(input.value).toBe('3');
	act(()=>{ ReactDOM.render(<ConditionParamsForm types={TYPES} type="numberish" params={{ min: '' }} onChange={onChange} />, host); });
	expect(host.textContent).toContain('不能留空');
});

it('🔴 各条件注册表里出现过的每种字段形态都能渲染(不抛)', ()=>{
	const regs = [
		require('../../../divination/zeri/conditionTypes').CONDITION_TYPES,
		require('../../../divination/zeri/baziZeriConditionTypes').BAZI_CONDITION_TYPES,
		require('../../../divination/zeri/huangliZeriConditionTypes').HUANGLI_CONDITION_TYPES,
	].filter(Boolean);
	const seenKinds = new Set();
	regs.forEach((types)=>{
		Object.keys(types).forEach((type)=>{
			const kinds = ((types[type] || {}).fields || []).map((f)=>f.kind);
			if(!kinds.some((k)=>!seenKinds.has(k))){ return; }
			kinds.forEach((k)=>seenKinds.add(k));
			const defaults = {};
			((types[type] || {}).fields || []).forEach((f)=>{ defaults[f.key] = f.default !== undefined ? f.default : (f.kind === 'number' ? 1 : undefined); });
			expect(()=>act(()=>{ ReactDOM.render(<ConditionParamsForm types={types} type={type} params={defaults} onChange={()=>{}} />, host); })).not.toThrow();
		});
	});
	expect(seenKinds.has('number')).toBe(true);
	expect(seenKinds.size).toBeGreaterThan(2);
});
