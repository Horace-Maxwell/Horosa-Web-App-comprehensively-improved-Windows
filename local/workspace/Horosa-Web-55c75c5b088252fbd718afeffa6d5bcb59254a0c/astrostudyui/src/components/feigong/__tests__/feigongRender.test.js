// 飞宫小奇门 · 组件渲染冒烟(SSR)+快照段头金标(段表 ask/qiju/ganzhi/minggong/gongwei/yunqi/yingqi 真值源)。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FeiGongMain, { buildFeiGongSnapshotText, buildFeiGongSnapshotForCase } from '../FeiGongMain';
import { buildJu } from '../core/feigongJu';

const zhu = (ganzi)=>({ ganzi, stem: { cell: ganzi[0] }, branch: { cell: ganzi[1] } });
const VALUE = { chart: { nongli: {
	date: '2000-06-26', year: '庚辰', monthInt: 5, dayInt: 25, leap: false,
	bazi: { year: zhu('庚辰'), month: zhu('壬午'), day: zhu('丙申'), time: zhu('甲午') },
} } };
const FIELDS = { date: '2000-06-26', time: '12:00', zone: 8 };
const JU = buildJu({ zhi: '子', dayGan: '丙', dayZhi: '申' }); // 子局(golden:甲落1宫,中宫戊癸,休门2)

const render = (slot, ju)=>{
	const props = { slot, fields: FIELDS, value: VALUE };
	const inst = new FeiGongMain(props);
	inst.state = { ...inst.state, ju: ju || JU, inputs: { ...inst.state.inputs, mingAge: 35 } };
	inst.props = props;
	return renderToStaticMarkup(inst.render());
};

describe('飞宫 · 渲染冒烟', ()=>{
	test('中栏 SVG 同心盘:子局中宫戊癸+青龙宫+十二支环', ()=>{
		const h = render('center');
		expect(h).toContain('<svg');
		expect(h).toContain('戊癸');
		expect(h).toContain('青龙落');
	});
	test('右栏五目:主客(丙申随盘)/宫面/命宫/断语/推断', ()=>{
		const h = render('aux');
		expect(h).toContain('主客');
		expect(h).toContain('推断');
	});
	test('左栏三起支模式+定局钮', ()=>{
		const h = render('controls');
		expect(h).toMatch(/定\s*局/);
		expect(h).toContain('按占时');
	});
	test('自出三栏+未定局空态;ctx 真源(午时丙申日)', ()=>{
		expect(render(undefined)).toContain('局面判读');
		const inst = new FeiGongMain({ fields: FIELDS, value: VALUE });
		inst.props = { fields: FIELDS, value: VALUE };
		expect(renderToStaticMarkup(inst.render())).toContain('horosa-huangji-empty');
		const c = inst.ctx();
		expect(c.hourZhi).toBe('午');
		expect(c.dayGan).toBe('丙');
		expect(c.dayZhi).toBe('申');
	});
});

describe('飞宫 · AI 快照段头金标', ()=>{
	const HEADS = ['[问事]', '[起局]', '[干支]', '[命宫]', '[宫位]', '[运气]', '[应期]'];
	test('①七段头有序;子局 golden 锚(甲落1/中宫戊癸/休门起2)', ()=>{
		const t = buildFeiGongSnapshotText(JU, { askEvent: '问出行', mingAge: 35, mingGender: 'male' });
		let last = -1;
		HEADS.forEach((hd)=>{ const i = t.indexOf(hd); expect(i).toBeGreaterThan(last); last = i; });
		expect(t).toContain('青龙(甲)落 1 宫');
		expect(t).toContain('中宫双干:戊癸');
		expect(t).toContain('休门起 2 宫');
		expect(t).toContain('所问:问出行');
	});
	test('②命宫段:35 岁调整数 35(三十不动),命宫 5→值五宫看戊;主客段丙申', ()=>{
		const t = buildFeiGongSnapshotText(JU, { mingAge: 35, mingGender: 'male' });
		expect(t).toMatch(/命宫/);
		expect(t).toContain('主(日干丙)');
		expect(t).toContain('客(日支申)');
	});
	test('③无头重算:冻结起支自 payload;缺支返空', ()=>{
		expect(buildFeiGongSnapshotForCase({}, {})).toBe('');
		const t = buildFeiGongSnapshotForCase({ qiZhi: '子', dayGan: '丙', dayZhi: '申', askEvent: 'x' }, {});
		expect(t).toContain('起支:子');
		expect(t).toContain('中宫双干:戊癸');
	});
});
