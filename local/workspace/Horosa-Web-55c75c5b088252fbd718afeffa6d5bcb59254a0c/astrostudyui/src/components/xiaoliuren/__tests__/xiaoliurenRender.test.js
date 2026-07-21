// 小六壬 · 组件渲染冒烟(SSR,捕获运行时 JSX 错)+快照段头金标(AI 段表三处镜像的真值源)。
// 🔴 VALUE 形状照 guiceRender 实测范式:农历在 props.value.chart.nongli,时柱在 bazi.time。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import XiaoLiuRenMain, { buildXiaoLiuRenSnapshotText, buildXiaoLiuRenSnapshotForCase } from '../XiaoLiuRenMain';
import { qiKe } from '../core/xiaoliurenKe';

const zhu = (ganzi)=>({ ganzi, stem: { cell: ganzi[0] }, branch: { cell: ganzi[1] } });
const VALUE = { chart: { nongli: {
	date: '2000-06-26', year: '庚辰', monthInt: 5, dayInt: 23, leap: false,
	bazi: { year: zhu('庚辰'), month: zhu('壬午'), day: zhu('丙申'), time: zhu('甲戌') },
} } };
const FIELDS = { date: '2000-06-26', time: '12:00', zone: 8 };

const render = (slot, school, ke)=>{
	const props = { slot, fields: FIELDS, value: VALUE };
	const inst = new XiaoLiuRenMain(props);
	inst.state = { ...inst.state, settings: { school: school || 'main' }, ke: ke || qiKe({ m: 5, d: 23, h: 11, school: school || 'main' }), inputs: { useTime: true, askEvent: '' } };
	inst.props = props;
	return renderToStaticMarkup(inst.render());
};

describe('小六壬 · 渲染冒烟', ()=>{
	test('中栏渲染:载例三传高亮(小吉/速喜/大安),零拟人手(无 svg 手形)', ()=>{
		const h = render('center');
		expect(h).toContain('小吉');
		expect(h).toContain('一传');
		expect(h).not.toMatch(/hand|palm|finger-svg/i); // 结构图非手形
	});
	test('右栏渲染不抛(直断/生克/化解/九神/法诀五目)', ()=>{
		const h = render('aux', 'dao');
		expect(h).toContain('直断');
		expect(h).toContain('化解');
	});
	test('左栏渲染含起课钮与流派选择', ()=>{
		const h = render('controls');
		expect(h).toMatch(/起\s*课/); // antd 两字钮自动内空格
		expect(h).toContain('道门九宫');
	});
	test('自出三栏(无 slot):三栏骨架齐;未起课空态不抛', ()=>{
		const h = render(undefined);
		expect(h).toContain('horosa-astro-redesign-grid');
		expect(h).toContain('课传判读');
		const inst = new XiaoLiuRenMain({ fields: FIELDS, value: VALUE });
		inst.props = { fields: FIELDS, value: VALUE };
		expect(renderToStaticMarkup(inst.render())).toContain('horosa-huangji-empty');
	});
	test('ctx 真源:农历 5月23日·戌时 → 三数 5,23,11', ()=>{
		const inst = new XiaoLiuRenMain({ fields: FIELDS, value: VALUE });
		inst.props = { fields: FIELDS, value: VALUE };
		const c = inst.ctx();
		expect(c.lunarMonth).toBe(5);
		expect(c.lunarDay).toBe(23);
		expect(c.hourNum).toBe(11); // 戌=第11支
	});
});

describe('小六壬 · AI 快照段头金标(段表 ask/qike/sanchuan/shengke/jiushen/huajie 镜像真值)', ()=>{
	const HEADS = ['[问事]', '[起课]', '[三传]', '[生克]', '[九神]', '[化解]'];
	test('①六段头逐字在位且有序(主流)', ()=>{
		const t = buildXiaoLiuRenSnapshotText(qiKe({ m: 5, d: 23, h: 11, school: 'main' }), '问考试');
		let last = -1;
		HEADS.forEach((h)=>{ const i = t.indexOf(h); expect(i).toBeGreaterThan(last); last = i; });
		expect(t).toContain('所问:问考试');
		expect(t).toContain('主流六宫不调取五行生克');
	});
	test('②道门载例:三传坎水乾金震木+生克断语+拜解入 [化解]', ()=>{
		const t = buildXiaoLiuRenSnapshotText(qiKe({ m: 5, d: 23, h: 11, school: 'dao' }), '');
		expect(t).toContain('小吉(坎水)');
		expect(t).toContain('天德金生小吉水(2生1)');
		expect(t).toContain('拜紫微化解');
		expect(t).toContain('(未录问事)');
	});
	test('③无头重算(冻结三数,绝不重起):payload 缺数返空;流派 opts 可换', ()=>{
		expect(buildXiaoLiuRenSnapshotForCase({}, {})).toBe('');
		const t = buildXiaoLiuRenSnapshotForCase({ nums: [5, 23, 11], askEvent: 'x', options: { school: 'main' } }, { school: 'dao' });
		expect(t).toContain('道门九宫');
		expect(t).toContain('小吉(坎水)');
	});
});
