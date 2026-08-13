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
	test('左栏五起卦模式切换渲染不抛', ()=>{
		expect(render('controls')).toMatch(/起\s*卦/);
		expect(render('controls', QI, { qiguaFa: 'number' })).toContain('配数流派');
		expect(render('controls', QI, { qiguaFa: 'stock' })).toContain('开盘价');
		// [XCT-1] 摇钱三变:与大衍共用种子/手录六爻控件,hint 按法别
		const hy = render('controls', QI, { qiguaFa: 'yaoqian' });
		expect(hy).toContain('起卦种子');
		expect(hy).toContain('摇钱手录');
		expect(render('controls', QI, { qiguaFa: 'dayan' })).toContain('蓍草手录');
	});
	test('[XCT-1] 左栏闢卦口径控件:两档皆渲染,hint 随档变', ()=>{
		expect(render('controls')).toContain('闢卦细判');
		expect(render('controls', QI, { piKoujing: 'zheng' })).toContain('得配害');
		expect(render('controls', QI, { piKoujing: 'yiwen' })).toContain('得配利');
	});
	test('[XCT-4] 右栏五页齐备(推导/四象/应期/宫义/起卦);SSR 惰性只出未激活页之头', ()=>{
		const h = render('aux', QI, { yongGong: 3 });
		['tuidao', 'sixiang', 'yingqi', 'gongyi', 'qigua'].forEach((k)=>{
			expect(h).toContain(`data-node-key="${k}"`);
		});
		// 首页(推导)内容实渲:用宫所主行与旁推总则底注
		expect(h).toContain('用宫所主');
		expect(h).toContain('宫主动静迁移');
	});
	test('[XCT-2] 应期/宫义页内容直渲不抛(绕 Tabs 惰性,直取渲染函数产物)', ()=>{
		const inst = new XiaoChengTuMain({ fields: FIELDS, value: {} });
		inst.props = { fields: FIELDS, value: {} };
		inst.state = { ...inst.state, settings: { qiguaFa: 'manual', qiguaShu: 'tiandi', yongGong: 1, piKoujing: 'zheng' }, qi: QI };
		const aux = inst.renderAux(buildPan(QI));
		const panes = aux.props.children.filter(Boolean);
		// horosa_freeze_subtabs_v1:我方 overlay 把每个 TabPane 的内容包进 FreezeSubTab 的
		// render-prop(非激活目连元素都不创建)。本用例刻意「绕 Tabs 惰性」直取 pane 产物,
		// 故必须同样绕过冻结层:children 是函数时求值一次即得原内容。
		// **断言一字未改** —— 只换取内容的方式,不放宽任何判据(跨平台差异,建议上游化 Mac)。
		const paneOf = (k)=>{
			const pane = panes.find((c)=>c && c.key === k);
			const inner = pane && pane.props ? pane.props.children : null;
			if(inner && inner.props && typeof inner.props.children === 'function'){
				return { props: { children: inner.props.children() } };
			}
			return pane;
		};
		const yq = renderToStaticMarkup(<div>{paneOf('yingqi').props.children}</div>);
		expect(yq).toContain('两分·半月(升降)');
		expect(yq).toContain('两分·阴阳(定支)');
		expect(yq).toContain('应期推演');
		const gy = renderToStaticMarkup(<div>{paneOf('gongyi').props.children}</div>);
		expect(gy).toContain('坎宫——坎为陷为水');   // 八宫所主原文
		expect(gy).toContain('← 用宫');
		const sx = renderToStaticMarkup(<div>{paneOf('sixiang').props.children}</div>);
		expect(sx).toContain('细判口径');
		expect(sx).toMatch(/上乾[↑↓]下兑[↑↓]/);      // 升降箭头
		expect(sx).toContain('得配为情');
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
	test('④[XCT-1] 闢口径为活开关:同卦同宫,改口径快照断辞即变(挂载齿轮同源)', ()=>{
		const pan = buildPan(QI);
		const zh = buildXiaoChengTuSnapshotText(pan, QI, { yongGong: 1, piKoujing: 'zheng' });
		const yi = buildXiaoChengTuSnapshotText(pan, QI, { yongGong: 1, piKoujing: 'yiwen' });
		expect(zh).toContain('正传(得配害·失配利)');
		expect(yi).toContain('异文(得配利·失配害)');
		// 履=闢(上乾升下兑降)且乾阳兑阴得配 → 正传为害、异文为利
		expect(zh).toContain('得配为情:害');
		expect(yi).toContain('得配为情:利');
		expect(zh).not.toBe(yi);
		// 缺省(老档无此键)= 正传
		expect(buildXiaoChengTuSnapshotText(pan, QI, { yongGong: 1 })).toBe(zh);
		// 无头重算亦随 options 走
		expect(buildXiaoChengTuSnapshotForCase({ qi: QI, options: { yongGong: 1, piKoujing: 'yiwen' } }, {})).toContain('得配为情:利');
	});
	test('⑤[XCT-2] 应期段折入推演链(段头七段不新增)', ()=>{
		const t = buildXiaoChengTuSnapshotText(buildPan(QI), QI, { yongGong: 1 });
		expect(t).toContain('应期推演(系载例归纳)');
		expect(t).toContain('两分定半月(升降)');
		// 段头集合恒为七(股市模式方出第七段);新内容一律折进既有段
		const heads = (t.match(/^\[[^\]]+\]$/gm) || []);
		expect(heads).toEqual(['[问事]', '[起卦]', '[佈局]', '[推导]', '[四象]', '[应期]']);
	});
	test('⑥[XCT-2] 应期链逐字对读载例(乾之兑问来人 → 农历十月初六)', ()=>{
		const qi = qiGuaManual({ up: '乾', lo: '乾', dongYaos: [3, 6] });
		const t = buildXiaoChengTuSnapshotText(buildPan(qi), qi, { yongGong: 8, askEvent: '问来人' });
		expect(t).toContain('应期推演(系载例归纳):农历十月初六');
		expect(t).toContain('初六、十六、二十六');
	});
});

describe('小成图 · 挂载齿轮与组件默认同源', ()=>{
	test('[XCT-1] techniqueMountSettings 各 field 默认 === DEFAULT_SETTINGS 同键(防双声明漂移)', ()=>{
		// eslint-disable-next-line global-require
		const { TECHNIQUE_SETTINGS_SCHEMA, getTechniqueSettingsDefaults } = require('../../../utils/techniqueMountSettings');
		// eslint-disable-next-line global-require
		const { DEFAULT_SETTINGS } = require('../XiaoChengTuMain');
		const spec = TECHNIQUE_SETTINGS_SCHEMA.xiaochengtu;
		expect(spec).toBeTruthy();
		spec.fields.forEach((f)=>{
			expect(`${f.name}:${f.default}`).toBe(`${f.name}:${DEFAULT_SETTINGS[f.name]}`);
		});
		// 新口径键必须在齿轮上(否则挂载重算恒默认 = 死开关)
		expect(spec.fields.map((f)=>f.name)).toContain('piKoujing');
		expect(getTechniqueSettingsDefaults('xiaochengtu').piKoujing).toBe('zheng');
	});
});
