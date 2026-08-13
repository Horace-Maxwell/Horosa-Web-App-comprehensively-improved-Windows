// 室内凶局几何自动检测 golden。
// 🔴 本套测试的第一职责不是「检得出」，而是「检不出时诚实」：
//   缺标记之项必须落在 skipped 且写明缺什么，绝不能被当成「无此凶局」而静默为绿。
import { neijuDetect } from '../neijuGeometry';
import { NEIJU_XINGXING_10 } from '../fengshuiZhaiduanData';
import { SECTORS } from '../fengshuiEngine';

const RECT = { w: 300, h: 300 };
const M = (type, x, y, gong)=>({ type, x, y, gong });

// 🔴 测试用 gongAt 逐字照抄画布 getSectorForPoint 之算法（北在上、减盘面转角），
//    以证本模块不自铺方位、且随盘转而动。
const makeGongAt = (cx, cy, rotation = 0)=>(x, y)=>{
	const ang = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
	let compass = ang + 90; if (compass < 0) { compass += 360; }
	let rot = compass - rotation; if (rot < 0) { rot += 360; } rot %= 360;
	const s = SECTORS.find((sec)=>(sec.start > sec.end
		? (rot >= sec.start || rot < sec.end) : (rot >= sec.start && rot < sec.end)));
	return s ? s.num : null;
};
const GONG_AT = makeGongAt(150, 150);
// 300×300 正方缺去右下 100×100。
const L_SHAPE = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 },
	{ x: 200, y: 200 }, { x: 200, y: 300 }, { x: 0, y: 300 }];
const labelsOf = (r)=>r.hits.map((h)=>h.label);
const skipNames = (r)=>r.skipped.map((s)=>s.name);

describe('三层诚实防线', ()=>{
	it('① 空输入不抛、不虚报，且把全部条目列入未判', ()=>{
		const r = neijuDetect({});
		expect(r.hits).toEqual([]);
		expect(r.suggested).toEqual({});
		expect(r.skipped.length).toBeGreaterThan(10);
		r.skipped.forEach((s)=>{ expect(s.missing.length).toBeGreaterThan(0); });
	});
	it('🔴 ②「未检出」的措辞必须写明不等于「无此凶局」', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('bed', 10, 10)] });
		expect(r.verdict.text).toMatch(/不等于/);
		expect(r.note).toMatch(/建议/);
		expect(r.note).toMatch(/不覆盖人工勾选/);
	});
	it('③ 每条命中都带证据串（可逐条复核）', ()=>{
		const r = neijuDetect({ rect: { w: 400, h: 100 } });
		expect(r.hits.length).toBeGreaterThan(0);
		r.hits.forEach((h)=>{
			expect(typeof h.evidence).toBe('string');
			expect(h.evidence.length).toBeGreaterThan(5);
			expect(['high', 'medium', 'low']).toContain(h.confidence);
		});
	});
	it('脏入参一律不抛', ()=>{
		[undefined, null, {}, { rect: 0 }, { markers: null }, { markers: [null, {}, { type: 'bed' }] },
			{ outline: [] }, { outline: [{ x: 0, y: 0 }] }, { rect: { w: 0, h: 0 } }]
			.forEach((p)=>{ expect(()=>neijuDetect(p || undefined)).not.toThrow(); });
	});
});

describe('宅形狭长横阔', ()=>{
	it('长宽比 ≥2.5 才报，横竖分辨正确', ()=>{
		expect(labelsOf(neijuDetect({ rect: { w: 400, h: 100 } }))).toContain('左右横阔（如一字）');
		expect(labelsOf(neijuDetect({ rect: { w: 100, h: 400 } }))).toContain('前后狭长（如竖尺）');
	});
	it('🔴 2:1 常见户型不报（保守阈值，宁漏不误）', ()=>{
		const r = neijuDetect({ rect: { w: 200, h: 100 } });
		expect(labelsOf(r).some((x)=>x.indexOf('狭长') >= 0 || x.indexOf('横阔') >= 0)).toBe(false);
	});
	it('缺房屋框时列入未判而非判为无', ()=>{
		expect(skipNames(neijuDetect({}))).toContain('宅形狭长横阔');
	});
});

describe('宅形缺角（八宫）', ()=>{
	it('🔴 L 形缺右下 → 巽宫缺角（画布是北在上，右下＝东南巽；非风水盘惯用的南在上）', ()=>{
		const r = neijuDetect({ rect: RECT, outline: L_SHAPE, gongAt: GONG_AT });
		const que = labelsOf(r).filter((x)=>x.indexOf('缺角') >= 0);
		expect(que).toEqual(['巽宫缺角']);
	});
	it('矩形轮廓八宫俱全，一个缺角都不报', ()=>{
		const full = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }];
		expect(labelsOf(neijuDetect({ rect: RECT, outline: full, gongAt: GONG_AT })).some((x)=>x.indexOf('缺角') >= 0)).toBe(false);
	});
	it('🔴 只有矩形框而无轮廓时不判缺角，并说明缘由', ()=>{
		const r = neijuDetect({ rect: RECT });
		const s = r.skipped.find((x)=>x.name === '宅形缺角');
		expect(s).toBeTruthy();
		expect(s.missing).toMatch(/轮廓/);
	});
	it('🔴 有轮廓但未传 gongAt → 不判，并说明方位不在本模块自行推定', ()=>{
		const r = neijuDetect({ rect: RECT, outline: L_SHAPE });
		expect(labelsOf(r).some((x)=>x.indexOf('缺角') >= 0)).toBe(false);
		expect(r.skipped.find((x)=>x.name === '宅形缺角').missing).toMatch(/八宫定位|不在本模块自行推定/);
	});
	it('缺左上 → 乾宫缺角', ()=>{
		const nw = [{ x: 100, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }, { x: 0, y: 100 }, { x: 100, y: 100 }];
		expect(labelsOf(neijuDetect({ rect: RECT, outline: nw, gongAt: GONG_AT })).filter((x)=>x.indexOf('缺角') >= 0)).toEqual(['乾宫缺角']);
	});
	it('🔴 盘面转 90° 后同一缺口改报他宫——证方位随画布而动，未被写死', ()=>{
		const plain = neijuDetect({ rect: RECT, outline: L_SHAPE, gongAt: GONG_AT });
		const turned = neijuDetect({ rect: RECT, outline: L_SHAPE, gongAt: makeGongAt(150, 150, 90) });
		const q = (r)=>labelsOf(r).filter((x)=>x.indexOf('缺角') >= 0);
		expect(q(plain)).toEqual(['巽宫缺角']);
		expect(q(turned)).toEqual(['艮宫缺角']);     // 东南退 90° → 东北
	});
});

describe('卫生间在中宫或坐山方', ()=>{
	it('落中宫 → 报中宫', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('bathroom', 150, 150, 5)] });
		expect(labelsOf(r)).toContain('卫生间在中宫');
	});
	it('落坐山宫 → 报坐山方', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('toilet', 20, 280, 1)], zuoGong: 1 });
		expect(labelsOf(r)).toContain('卫生间在坐山方');
	});
	it('落他宫 → 两项皆不报', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('toilet', 280, 20, 4)], zuoGong: 1 });
		expect(labelsOf(r).some((x)=>x.indexOf('卫生间') >= 0)).toBe(false);
	});
	it('🔴 有标记但未定八宫线（无 gong）→ 未判，且说明缺的是宫而非标记', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('toilet', 150, 150)] });
		const s = r.skipped.find((x)=>x.name === '卫生间在中宫或坐山方');
		expect(s.missing).toMatch(/八宫线/);
	});
});

describe('开门见灶／见厕／见镜 与 穿堂', ()=>{
	it('门灶横向正对 → 开门见灶', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('entryDoor', 10, 150), M('stove', 250, 152)] });
		expect(labelsOf(r)).toContain('开门见灶');
	});
	it('🔴 偏角超阈值不报（15° 保守闸）', ()=>{
		// dx=240, dy=100 → 约 22.6°，超阈值
		const r = neijuDetect({ rect: RECT, markers: [M('entryDoor', 10, 50), M('stove', 250, 150)] });
		expect(labelsOf(r)).not.toContain('开门见灶');
	});
	it('门厕正对 → 开门见厕', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('entryDoor', 150, 290), M('toilet', 150, 60)] });
		expect(labelsOf(r)).toContain('开门见厕');
	});
	it('🔴 开门见镜恒列未判——标记体系无镜子', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('entryDoor', 10, 150), M('stove', 250, 150)] });
		const s = r.skipped.find((x)=>x.name === '开门见镜');
		expect(s).toBeTruthy();
		expect(s.missing).toMatch(/镜子/);
	});
	it('门对阳台且贯穿大半屋 → 穿堂', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('entryDoor', 10, 150), M('balcony', 290, 150)] });
		expect(labelsOf(r)).toContain('大门直通到底（穿堂）');
		expect(r.hits.find((h)=>h.label.indexOf('穿堂') >= 0).evidence).toMatch(/阳台/);
	});
	it('🔴 门与近窗相对但未贯穿（距 <60% 对角线）→ 不报穿堂', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('entryDoor', 10, 150), M('window', 120, 150)] });
		expect(labelsOf(r)).not.toContain('大门直通到底（穿堂）');
	});
	it('客厅狭窄恒列未判（点标记无房间范围）', ()=>{
		expect(skipNames(neijuDetect({ rect: RECT }))).toContain('客厅过于狭窄');
	});
});

describe('窗户失度', ()=>{
	it('≥8 处报过多、≤1 处报过少', ()=>{
		const many = Array.from({ length: 8 }, (_, i)=>M('window', 20 + i * 30, 20));
		expect(labelsOf(neijuDetect({ rect: RECT, markers: many }))).toContain('窗户过多过大');
		expect(labelsOf(neijuDetect({ rect: RECT, markers: [M('window', 20, 20)] }))).toContain('窗户过少过小');
	});
	it('🔴 中间档（4 窗）两项皆不报', ()=>{
		const mid = Array.from({ length: 4 }, (_, i)=>M('window', 20 + i * 60, 20));
		expect(labelsOf(neijuDetect({ rect: RECT, markers: mid })).some((x)=>x.indexOf('窗户过') >= 0)).toBe(false);
	});
	it('窗形三角恒列未判（点标记无形状）', ()=>{
		expect(skipNames(neijuDetect({ rect: RECT }))).toContain('窗形三角');
	});
});

describe('炉灶失位', ()=>{
	it('灶对门 → 灶正对大门（与「开门见灶」同源可并出，去重后各计一项）', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('entryDoor', 10, 150), M('stove', 250, 150)] });
		expect(labelsOf(r)).toContain('灶正对大门');
		expect(labelsOf(r)).toContain('开门见灶');
	});
	it('灶水槽近距正对 → 灶正对水槽', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('stove', 100, 60), M('sink', 190, 60)] });
		expect(labelsOf(r)).toContain('灶正对水槽');
	});
	it('🔴 灶水槽虽正对但相隔太远（>35% 对角线）→ 不报（非同一厨房）', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('stove', 20, 60), M('sink', 280, 60)] });
		expect(labelsOf(r)).not.toContain('灶正对水槽');
	});
	it('🔴 五项无标记者恒列未判', ()=>{
		const names = skipNames(neijuDetect({ rect: RECT, markers: [M('stove', 100, 60)] }));
		['灶正对卧室门', '灶正对厨房门', '灶正对厕所门', '灶正对过道尽头', '灶正对冰箱', '厨房地面高于客厅或房间']
			.forEach((a)=>expect(names).toContain(a));
	});
});

describe('横梁压顶与床位', ()=>{
	it('🔴 横梁四项恒列未判——标记体系无梁', ()=>{
		const names = skipNames(neijuDetect({ rect: RECT, markers: [M('bed', 100, 100)] }));
		['梁压门', '梁压床', '梁压书桌', '梁压餐桌'].forEach((a)=>expect(names).toContain(a));
	});
	it('床头正对浴厕', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('bed', 80, 100), M('bathroom', 80, 240)] });
		expect(labelsOf(r)).toContain('床头正对浴厕');
	});
	it('🔴 床紧邻窗只给 low 且措辞留人工确认（无朝向不能断「床头」侧）', ()=>{
		const r = neijuDetect({ rect: RECT, markers: [M('bed', 100, 100), M('window', 120, 110)] });
		const h = r.hits.find((x)=>x.label === '床头开大窗');
		expect(h.confidence).toBe('low');
		expect(h.evidence).toMatch(/人工确认/);
	});
	it('柱角与镜子恒列未判', ()=>{
		const names = skipNames(neijuDetect({ rect: RECT, markers: [M('bed', 100, 100)] }));
		expect(names).toContain('床有柱角冲射');
		expect(names).toContain('床侧安大镜');
	});
});

describe('接入 zhaiduan：只作建议，绝不代人下判', ()=>{
	const { zhaiduan } = require('../zhaiduan');
	const BASE = { xiangShan: '午', yun: 9, year: 2026,      // 入参是「向」之山名（向午＝坐子）
		neiJu: { menhu: 1, wofang: 3, chufang: 9, keting: 4, yuce: 7 },
		waiJu: { 1: 'shui', 9: 'shan' }, xiongGe: ['tianzhan'] };
	const GEO = { rect: RECT, outline: L_SHAPE, markers: [M('entryDoor', 10, 150), M('stove', 250, 150),
		M('bathroom', 150, 150, 5), M('bed', 60, 60)], gongAt: GONG_AT };

	it('🔴 不传 geo → 返回值与未加此功能之前逐字节相同（geoScan 恒 null）', ()=>{
		const r = zhaiduan(BASE);
		expect(r.geoScan).toBe(null);
		// 同一入参两次调用结果恒等，且 geo:null / geo:undefined 与不传三者全等
		const a = JSON.stringify(zhaiduan(BASE));
		expect(JSON.stringify(zhaiduan({ ...BASE, geo: null }))).toBe(a);
		expect(JSON.stringify(zhaiduan({ ...BASE, geo: undefined }))).toBe(a);
	});
	it('🔴 传 geo 后 neiXiongN／neiBad／总断三者一字不动（自动检测不计入判词）', ()=>{
		const off = zhaiduan(BASE);
		const on = zhaiduan({ ...BASE, geo: GEO });
		expect(on.geoScan).toBeTruthy();
		expect(on.geoScan.hits.length).toBeGreaterThan(0);      // 确有检出，否则本测退化为空断言
		expect(on.neiXiongN).toBe(off.neiXiongN);
		expect(on.neiBad).toBe(off.neiBad);
		expect(on.quad).toEqual(off.quad);
		expect(on.verdict).toEqual(off.verdict);
		expect(on.neiXiongRows).toEqual(off.neiXiongRows);
	});
	it('人工已勾之项标 taken，未勾者计入 newN', ()=>{
		const on = zhaiduan({ ...BASE, geo: GEO, neiXiong: { kaimenjian: [0] } });
		const kmj = on.geoScan.rows.find((x)=>x.label === '开门见灶');
		expect(kmj.taken).toBe(true);
		expect(on.geoScan.takenN).toBeGreaterThanOrEqual(1);
		expect(on.geoScan.newN).toBe(on.geoScan.rows.length - on.geoScan.takenN);
	});
	it('用户采纳（勾上）后才计入 neiBad——证「一键采纳」确有作用而非死开关', ()=>{
		const off = zhaiduan({ ...BASE, geo: GEO });
		const took = zhaiduan({ ...BASE, geo: GEO, neiXiong: { kaimenjian: [0], luzao: [0] } });
		expect(took.neiBad).toBe(off.neiBad + 2);
	});
	it('🔴 坐山宫未显式给出时取排盘之 gZuo（向午→坐子＝坎1）', ()=>{
		const on = zhaiduan({ ...BASE, geo: GEO });
		expect(on.geoScan.zuoGong).toBe(1);
	});
	it('每行都带条名，便于右栏直接列示', ()=>{
		zhaiduan({ ...BASE, geo: GEO }).geoScan.rows.forEach((x)=>{
			expect(typeof x.name).toBe('string');
			expect(x.name.length).toBeGreaterThan(1);
		});
	});
	it('脏 geo 不抛', ()=>{
		[{}, { rect: null }, { markers: 'x' }, { outline: 3 }, { gongAt: 'no' }]
			.forEach((g)=>{ expect(()=>zhaiduan({ ...BASE, geo: g })).not.toThrow(); });
	});
});

describe('输出契约', ()=>{
	it('🔴 suggested 的下标必须落在 NEIJU_XINGXING_10 各条 atoms 的合法范围（序错即判错项）', ()=>{
		const r = neijuDetect({ rect: { w: 400, h: 120 },
			outline: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 80 }, { x: 280, y: 80 }, { x: 280, y: 120 }, { x: 0, y: 120 }],
			markers: [M('entryDoor', 10, 60), M('stove', 380, 60), M('bathroom', 200, 60, 5), M('bed', 100, 30),
				M('window', 110, 35), M('sink', 340, 60)],
			zuoGong: 1 });
		expect(Object.keys(r.suggested).length).toBeGreaterThan(3);
		Object.keys(r.suggested).forEach((k)=>{
			const conf = NEIJU_XINGXING_10.find((c)=>c.key === k);
			expect(conf).toBeTruthy();
			r.suggested[k].forEach((i)=>{
				expect(i).toBeGreaterThanOrEqual(0);
				expect(i).toBeLessThan(conf.atoms.length);
			});
			// 同条内下标升序且不重
			expect(r.suggested[k]).toEqual([...new Set(r.suggested[k])].sort((a, b)=>a - b));
		});
	});
	it('🔴 每个命中的 label 必等于 atoms[idx]（防标签与下标错位）', ()=>{
		const r = neijuDetect({ rect: { w: 400, h: 100 },
			markers: [M('entryDoor', 10, 50), M('stove', 380, 50), M('toilet', 200, 50, 5)] });
		r.hits.forEach((h)=>{
			const conf = NEIJU_XINGXING_10.find((c)=>c.key === h.key);
			expect(conf.atoms[h.idx]).toBe(h.label);
		});
	});
	it('hasRect/hasOutline/markerCount 如实反映输入', ()=>{
		const r = neijuDetect({ rect: RECT, outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
			markers: [M('bed', 1, 1), null, { type: 'stove' }] });
		expect(r.hasRect).toBe(true);
		expect(r.hasOutline).toBe(true);
		expect(r.markerCount).toBe(1);      // 脏项被滤
	});
});

describe('右栏渲染与「采纳此条」', ()=>{
	const React = require('react');
	const { renderToStaticMarkup } = require('react-dom/server');
	const zdSchool = require('../liqi/zhaiduanSchool');
	const { zhaiduan } = require('../zhaiduan');
	const ui = {
		card: (title, body)=>React.createElement('section', { key: title },
			React.createElement('h4', null, title), body),
		row: (k, v, cls, key)=>React.createElement('div', { key: key || k },
			React.createElement('span', null, k), React.createElement('strong', { className: cls }, v)),
	};
	const GEO = { rect: RECT, markers: [M('entryDoor', 10, 150), M('stove', 250, 150),
		M('bathroom', 150, 150, 5)], gongAt: GONG_AT };
	const resultOf = (neiXiong)=>zhaiduan({ xiangShan: '午', yun: 9, year: 2026, geo: GEO, neiXiong: neiXiong || {} });

	it('🔴 面板渲染不抛，且检出项之条名、凭据、未判之项皆真上屏（非空壳）', ()=>{
		const html = renderToStaticMarkup(React.createElement(zdSchool.Panel,
			{ result: resultOf(), ui, p: {}, patch: ()=>{} }));
		expect(html).toMatch(/户型图几何自动检测/);
		expect(html).toMatch(/开门见灶/);
		expect(html).toMatch(/偏角/);              // 凭据串确已上屏
		expect(html).toMatch(/未判之项/);
		expect(html).toMatch(/不等于/);            // 诚实措辞上屏
		expect(html).toMatch(/采纳此条/);
	});
	it('🔴 采纳按钮所用类名必须真有 CSS 定义（自造裸类名是踩过的坑）', ()=>{
		const fs = require('fs'); const path = require('path');
		const less = fs.readFileSync(path.join(__dirname, '../../../layouts/app.less'), 'utf8');
		expect(less).toMatch(/\.horosa-fengshui-liqi-adopt\s*\{/);
		const src = fs.readFileSync(path.join(__dirname, '../liqi/zhaiduanSchool.js'), 'utf8');
		expect(src).toMatch(/horosa-fengshui-liqi-adopt/);
	});
	it('🔴 点「采纳」确实回写 neiXiong（不是死按钮）', ()=>{
		const r = resultOf();
		const pending = r.geoScan.rows.filter((x)=>!x.taken);
		expect(pending.length).toBeGreaterThan(0);
		let got = null;
		const el = React.createElement(zdSchool.Panel,
			{ result: r, ui, p: { neiXiong: {} }, patch: (x)=>{ got = x; } });
		// 直接取渲染树里的 onClick 调用之（renderToStaticMarkup 不留事件）
		const inst = zdSchool.Panel(el.props);
		const found = [];
		const walk = (n)=>{
			if (!n || typeof n !== 'object') { return; }
			if (Array.isArray(n)) { n.forEach(walk); return; }
			if (n.props) {
				if (n.props.className === 'horosa-fengshui-liqi-adopt' && n.props.onClick) { found.push(n.props.onClick); }
				walk(n.props.children);
			}
		};
		walk(inst);
		expect(found.length).toBe(pending.length);      // 每条待核各一个按钮
		found[0]();
		expect(got).toBeTruthy();
		const key = Object.keys(got.neiXiong)[0];
		expect(Array.isArray(got.neiXiong[key])).toBe(true);
		expect(got.neiXiong[key].length).toBeGreaterThan(0);
	});
	it('🔴 已采纳者不再出按钮，且标「已采纳」', ()=>{
		const r = resultOf({ kaimenjian: [0] });
		const html = renderToStaticMarkup(React.createElement(zdSchool.Panel,
			{ result: r, ui, p: { neiXiong: { kaimenjian: [0] } }, patch: ()=>{} }));
		expect(html).toMatch(/已采纳/);
		const kmj = r.geoScan.rows.find((x)=>x.label === '开门见灶');
		expect(kmj.taken).toBe(true);
	});
	it('AI 快照把「待核」与「已确认」分行，且待核行明标未经人工确认', ()=>{
		const lines = zdSchool.snapshotLines(resultOf());
		const pend = lines.find((l)=>l.indexOf('待核') >= 0);
		expect(pend).toBeTruthy();
		expect(pend).toMatch(/未经人工确认/);
		expect(lines.some((l)=>l.indexOf('不等于') >= 0)).toBe(true);
	});
});

describe('🔴 中宫必须可达（扇区表只有外八方，不补则「卫生间在中宫」永不命中）', ()=>{
	const FengShuiEngine = require('../fengshuiEngine').default;
	// 不造画布：直接以桩 this 调用原型方法，只验几何。
	const call = (rect, pt)=>FengShuiEngine.prototype.inCenterPalace.call({
		rect, getRectCenter: ()=>({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }),
	}, pt);
	const R = { x: 100, y: 100, w: 300, h: 300, rotation: 0 };

	it('SECTORS 本身确无中宫（本修之前提；若哪天补了 5，本条会提醒重估）', ()=>{
		expect(SECTORS.map((s)=>s.num).sort((a, b)=>a - b)).toEqual([1, 2, 3, 4, 6, 7, 8, 9]);
	});
	it('居中九分之一之内判中宫，之外不判', ()=>{
		expect(call(R, { x: 250, y: 250 })).toBe(true);        // 正中
		expect(call(R, { x: 299, y: 299 })).toBe(true);        // 边界内（半宽 300/6=50）
		expect(call(R, { x: 301, y: 250 })).toBe(false);       // 越界
		expect(call(R, { x: 250, y: 195 })).toBe(false);
		expect(call(R, { x: 120, y: 120 })).toBe(false);       // 角落
	});
	it('🔴 中宫随房屋框旋转而动：同一距离、不同方向，判定相反（证走本地坐标而非屏幕坐标）', ()=>{
		const { rotatePoint } = require('../fengshuiGeom');
		const T = { ...R, rotation: 45 };
		const c = { x: 250, y: 250 };
		// 在框的**本地**坐标里取 (+60, 0)：越过半宽 50 → 必在中宫外
		const outLocal = rotatePoint({ x: c.x + 60, y: c.y }, c, T.rotation);
		expect(call(T, outLocal)).toBe(false);
		// 屏幕上同样距中心 60、但方向不同之点：本地约 (42, -42)，两轴皆未越界 → 在中宫内
		expect(call(T, { x: c.x + 60, y: c.y })).toBe(true);
		expect(call(T, c)).toBe(true);
		// 不转时，前一点（屏幕 +60）就该在外——同一点因框转与否而判定相反，即「随框而动」之铁证
		expect(call(R, { x: c.x + 60, y: c.y })).toBe(false);
	});
	it('🔴 供给口必须经 inCenterPalace（否则中宫判据是死的）', ()=>{
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '../fengshuiEngine.js'), 'utf8');
		const body = src.slice(src.indexOf('buildNeijuGeoInput()'), src.indexOf('buildNeijuGeoInput()') + 700);
		expect(body).toMatch(/inCenterPalace/);
		expect(body).toMatch(/return 5;/);
	});
});
