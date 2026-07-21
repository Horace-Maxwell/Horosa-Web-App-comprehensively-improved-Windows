// 小成图 · 组件渲染冒烟(SSR)+快照段头金标(AI 段表 ask/qigua/butu/tuidao/sixiang/yingqi/stock 真值源)。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import XiaoChengTuMain, { buildXiaoChengTuSnapshotText, buildXiaoChengTuSnapshotForCase } from '../XiaoChengTuMain';
import { qiGuaManual, qiGuaByStock } from '../core/xiaochengtuQiGua';
import { buildPan } from '../core/xiaochengtuPan';

const FIELDS = { date: '2000-06-26', time: '12:00', zone: 8 };
// 履之晋载例(golden 同源):乾/兑 动 1,2,5
const QI = qiGuaManual({ up: '乾', lo: '兑', dongYaos: [1, 2, 5] });

const render = (slot, qi, settings)=>{
	const props = { slot, fields: FIELDS, value: {} };
	const inst = new XiaoChengTuMain(props);
	inst.state = { ...inst.state, settings: { qiguaFa: 'manual', qiguaShu: 'tiandi', yongGong: 1, ...(settings || {}) }, qi: qi || QI, inputs: { ...inst.state.inputs } };
	inst.props = props;
	return renderToStaticMarkup(inst.render());
};

describe('小成图 · 渲染冒烟', ()=>{
	test('中栏九宫佈局:履之晋 9乾 1兑(golden 同源)+用宫/推序标注+中宫无卦', ()=>{
		const h = render('center');
		expect(h).toContain('天泽履');
		expect(h).toContain('火地晋');
		expect(h).toContain('中宫无卦');
		expect(h).toContain('用宫');
	});
	test('右栏五目渲染不抛(推导/四象/应期/起卦;股市目仅股市模式)', ()=>{
		const h = render('aux');
		expect(h).toContain('推导');
		expect(h).toContain('四象');
		expect(h).not.toContain('data-node-key="stock"'); // 非股市模式无股市目(SSR 惰性只出 tab 头,以头判有无)
		const hs = render('aux', qiGuaByStock({ open: '1563.62', close: '1571.60' }));
		expect(hs).toContain('data-node-key="stock"');
	});
	test('左栏三起卦模式切换渲染不抛', ()=>{
		expect(render('controls')).toMatch(/起\s*卦/);
		expect(render('controls', QI, { qiguaFa: 'number' })).toContain('配数流派');
		expect(render('controls', QI, { qiguaFa: 'stock' })).toContain('开盘价');
	});
	test('自出三栏+未起卦空态', ()=>{
		const h = render(undefined);
		expect(h).toContain('推演判读');
		const inst = new XiaoChengTuMain({ fields: FIELDS, value: {} });
		inst.props = { fields: FIELDS, value: {} };
		expect(renderToStaticMarkup(inst.render())).toContain('horosa-huangji-empty');
	});
});

describe('小成图 · AI 快照段头金标', ()=>{
	const HEADS = ['[问事]', '[起卦]', '[佈局]', '[推导]', '[四象]', '[应期]'];
	test('①六段头有序;股市模式追加 [股市] 段', ()=>{
		const t = buildXiaoChengTuSnapshotText(buildPan(QI), QI, { yongGong: 1, askEvent: '问功名' });
		let last = -1;
		HEADS.forEach((hd)=>{ const i = t.indexOf(hd); expect(i).toBeGreaterThan(last); last = i; });
		expect(t).not.toContain('[股市]');
		const sq = qiGuaByStock({ open: '1563.62', close: '1571.60' });
		const ts = buildXiaoChengTuSnapshotText(buildPan(sq), sq, { yongGong: 1 });
		expect(ts).toContain('[股市]');
		expect(ts).toContain('涨跌两分:上卦艮 → 涨');
	});
	test('②佈局段=golden 天盘(9乾 1兑 3离 7坤);推导段带用宫链', ()=>{
		const t = buildXiaoChengTuSnapshotText(buildPan(QI), QI, { yongGong: 1 });
		expect(t).toContain('9乾');
		expect(t).toContain('1兑');
		expect(t).toContain('用宫 1(坎)');
	});
	test('③无头重算:冻结卦自 payload 取;缺卦返空;yongGong opts 可换', ()=>{
		expect(buildXiaoChengTuSnapshotForCase({}, {})).toBe('');
		const t = buildXiaoChengTuSnapshotForCase({ qi: QI, askEvent: 'x', options: { yongGong: 1 } }, { yongGong: 9 });
		expect(t).toContain('用宫 9(离)');
	});
});
