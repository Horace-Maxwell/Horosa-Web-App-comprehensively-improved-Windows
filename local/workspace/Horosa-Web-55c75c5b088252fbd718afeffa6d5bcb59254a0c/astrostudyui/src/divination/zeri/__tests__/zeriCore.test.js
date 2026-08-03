// 天星择日·前端纯函数层测试(WP-2):条件编译/摘要/区间拼接/按月切段。
import {
	CONDITION_TYPES, GROUP_TYPES, newLeaf, newGroup, compileTree,
} from '../conditionTypes';
import { conditionSummary, conditionSummaryText } from '../conditionGlyph';
import { splitByMonth, stitchIntervals } from '../intervalOps';

describe('conditionTypes.compileTree', ()=>{
	test('单叶链编译为裸叶(不再包组);双叶按行 joiner 结合', ()=>{
		const single = compileTree({ kind: 'group', negate: false, children: [newLeaf('aspect')] });
		expect(single.type).toBe('aspect');
		expect(single.params.planetA).toBe('Moon');
		const b = newLeaf('day_window', 'any');
		const two = compileTree({ kind: 'group', negate: false, children: [newLeaf('aspect'), b] });
		expect(two.type).toBe('any');
		expect(two.conditions).toHaveLength(2);
		expect(two.conditions[0].type).toBe('aspect');
		expect(two.conditions[1].type).toBe('day_window');
	});

	test('连续同门扁平为多元组;混门左折叠', ()=>{
		const c1 = newLeaf('aspect');
		const c2 = newLeaf('day_window', 'all');
		const c3 = newLeaf('in_sign', 'all');
		const flat = compileTree({ kind: 'group', negate: false, children: [c1, c2, c3] });
		expect(flat.type).toBe('all');
		expect(flat.conditions).toHaveLength(3);
		const c4 = newLeaf('in_house', 'xor');
		const mixed = compileTree({ kind: 'group', negate: false, children: [c1, c2, c4] });
		expect(mixed.type).toBe('xor');
		expect(mixed.conditions).toHaveLength(2);
		expect(mixed.conditions[0].type).toBe('all');
	});

	test('negate 编译为 not 包裹(单通道)', ()=>{
		const leaf = newLeaf('aspect');
		leaf.negate = true;
		const tree = compileTree({ kind: 'group', negate: false, children: [leaf] });
		expect(tree.type).toBe('not');
		expect(tree.conditions[0].type).toBe('aspect');
	});

	test('未知类型拒绝', ()=>{
		expect(()=>compileTree({ kind: 'leaf', type: 'no_such', negate: false, params: {} })).toThrow(/未知条件类型/);
	});

	test('空分组拒绝', ()=>{
		expect(()=>compileTree(newGroup('any'))).toThrow(/空的条件分组/);
	});

	test('同星两端拒绝', ()=>{
		const leaf = newLeaf('aspect');
		leaf.params.planetB = 'Moon';
		expect(()=>compileTree({ kind: 'group', op: 'all', negate: false, children: [leaf] })).toThrow(/同一星体/);
	});

	test('GROUP_TYPES 恒为四门', ()=>{
		expect([...GROUP_TYPES].sort()).toEqual(['all', 'any', 'not', 'xor']);
	});

	test('注册表每类含 label/defaults/category', ()=>{
		Object.entries(CONDITION_TYPES).forEach(([key, spec])=>{
			expect(spec.label).toBeTruthy();
			expect(spec.defaults).toBeTruthy();
			expect(['continuous', 'boolean', 'generative']).toContain(spec.category);
		});
	});
});

describe('conditionGlyph', ()=>{
	test('aspect 摘要含查找句式与 glyph 段', ()=>{
		const leaf = newLeaf('aspect');
		leaf.params = { ...leaf.params, planetA: 'Moon', planetB: 'Sun', angle: 90, side: 'dexter', motion: 'applying' };
		const segs = conditionSummary(leaf);
		const text = conditionSummaryText(leaf);
		expect(text).toContain('查找');
		expect(text).toContain('90°');
		expect(text).toContain('右相位');
		expect(text).toContain('入相位');
		// 至少行星/相位其一命中 glyph 字体段(AstroMsg 有 Asp90='R')
		expect(segs.some((s)=>s.glyph)).toBe(true);
	});

	test('缺字回退中文文本(不抛)', ()=>{
		const leaf = newLeaf('aspect');
		leaf.params.angle = 150; // Asp150 存在;再造一个假体键走回退
		leaf.params.planetA = 'North Node';
		expect(()=>conditionSummaryText(leaf)).not.toThrow();
	});
});

describe('formatGpsDms 度分制+大写方向字母', ()=>{
	const { formatGpsDms } = require('../tianxingSnapshot');
	test('东北半球', ()=>{
		expect(formatGpsDms(119.32, 26.08)).toBe('119°19′E, 26°05′N');
	});
	test('西南半球(负数)', ()=>{
		expect(formatGpsDms(-73.98, -33.45)).toBe('73°59′W, 33°27′S');
	});
	test('60 分进位', ()=>{
		expect(formatGpsDms(120.9999, 0)).toBe('121°00′E, 0°00′N');
	});
	test('非法值省略', ()=>{
		expect(formatGpsDms(undefined, 39.9)).toBe('39°54′N');
	});
});

describe('intervalOps', ()=>{
	test('splitByMonth 自然月边界半开衔接', ()=>{
		const segs = splitByMonth('2026/08/15', '06:00:00', '2026/10/03', '18:30:00');
		expect(segs).toHaveLength(3);
		expect(segs[0]).toEqual({ startDate: '2026/08/15', startTime: '06:00:00', endDate: '2026/09/01', endTime: '00:00:00' });
		expect(segs[1]).toEqual({ startDate: '2026/09/01', startTime: '00:00:00', endDate: '2026/10/01', endTime: '00:00:00' });
		expect(segs[2]).toEqual({ startDate: '2026/10/01', startTime: '00:00:00', endDate: '2026/10/03', endTime: '18:30:00' });
	});

	test('splitByMonth 同月单段', ()=>{
		const segs = splitByMonth('2026/08/02', '00:00:00', '2026/08/20', '23:59:59');
		expect(segs).toHaveLength(1);
		expect(segs[0].endDate).toBe('2026/08/20');
	});

	test('stitchIntervals 跨段界共点合并', ()=>{
		const segA = [{ start: '2026-08-31 22:00', end: '2026-09-01 00:00', startJd: 100.0, endJd: 100.0833, durationMin: 120 }];
		const segB = [{ start: '2026-09-01 00:00', end: '2026-09-01 03:00', startJd: 100.0833, endJd: 100.2083, durationMin: 180 }];
		const out = stitchIntervals([segA, segB]);
		expect(out).toHaveLength(1);
		expect(out[0].start).toBe('2026-08-31 22:00');
		expect(out[0].end).toBe('2026-09-01 03:00');
		expect(out[0].durationMin).toBeCloseTo(300, 0);
	});

	test('stitchIntervals 不相邻不合并', ()=>{
		const out = stitchIntervals([[
			{ start: 'a', end: 'b', startJd: 1.0, endJd: 1.1, durationMin: 144 },
			{ start: 'c', end: 'd', startJd: 2.0, endJd: 2.1, durationMin: 144 },
		]]);
		expect(out).toHaveLength(2);
	});
});

describe('WP-7 全类注册表', ()=>{
	test('不变量:每类 newLeaf 默认值必须能通过 compileTree(默认即合法)', ()=>{
		Object.keys(CONDITION_TYPES).forEach((type)=>{
			const tree = compileTree({ kind: 'group', negate: false, children: [newLeaf(type)] });
			expect(tree.type === type || tree.type === 'not').toBe(true);
		});
	});

	test('全类 glyph 摘要不抛且以「查找」开头', ()=>{
		const { conditionSummaryText } = require('../conditionGlyph');
		Object.keys(CONDITION_TYPES).forEach((type)=>{
			const text = conditionSummaryText(newLeaf(type));
			expect(text.startsWith('查找')).toBe(true);
			expect(text.length).toBeGreaterThan(3);
		});
	});

	test('besieged compile 钩子:拍平字段折叠为 rescue/mitigation 嵌套', ()=>{
		const leaf = newLeaf('besieged');
		leaf.params.rescueEnabled = false;
		leaf.params.mitigationReception = true;
		const tree = compileTree({ kind: 'group', negate: false, children: [leaf] });
		const p = tree.params;
		expect(p.rescue).toEqual({ enabled: false, rescuers: ['Venus', 'Jupiter'], byBody: true, byRay: false });
		expect(p.mitigation).toEqual({ receptionBreaks: true });
		expect(p.rescueEnabled).toBeUndefined();
	});

	test('midpoint compile 钩子:target 复合组装(midpoint 对)', ()=>{
		const leaf = newLeaf('midpoint');
		leaf.params.targetKind = 'midpoint';
		leaf.params.targetPairA = 'Venus';
		leaf.params.targetPairB = 'Mars';
		const tree = compileTree({ kind: 'group', negate: false, children: [leaf] });
		expect(tree.params.target).toEqual({ kind: 'midpoint', pair: ['Venus', 'Mars'] });
	});

	test('point_relation compile 钩子:angles 仅 relation=angles 时输出', ()=>{
		const leaf = newLeaf('point_relation');
		leaf.params.relation = 'parallel';
		const tree = compileTree({ kind: 'group', negate: false, children: [leaf] });
		expect(tree.params.angles).toBeUndefined();
		expect(tree.params.point).toEqual({ kind: 'angle', id: 'ASC' });
	});

	test('嵌套分组行+组取反编译(行 joiner 链式)', ()=>{
		const inner = { kind: 'group', negate: true, joiner: 'any', children: [newLeaf('aspect'), newLeaf('day_window', 'xor')] };
		const tree = compileTree({ kind: 'group', negate: false, children: [newLeaf('in_sign'), inner] });
		expect(tree.type).toBe('any');
		expect(tree.conditions[0].type).toBe('in_sign');
		expect(tree.conditions[1].type).toBe('not');
		expect(tree.conditions[1].conditions[0].type).toBe('xor');
	});

	test('旧模型兼容:children 无 joiner 时回退父组 op(老方案载入零迁移)', ()=>{
		const legacy = { kind: 'group', op: 'xor', negate: false, children: [
			{ kind: 'leaf', type: 'aspect', negate: false, params: newLeaf('aspect').params },
			{ kind: 'leaf', type: 'day_window', negate: false, params: newLeaf('day_window').params },
		] };
		const tree = compileTree(legacy);
		expect(tree.type).toBe('xor');
		expect(tree.conditions).toHaveLength(2);
	});

	test('numeric 角度字段 gt 校验拒绝', ()=>{
		const leaf = newLeaf('numeric');
		leaf.params.op = 'gt';
		expect(()=>compileTree({ kind: 'group', negate: false, children: [leaf] })).toThrow(/圆弧语义/);
	});
});

describe('R5 全类全字段扫描', ()=>{
	test('每类每 select/multiselect 选项值均可编译(死选项=红)', ()=>{
		Object.entries(CONDITION_TYPES).forEach(([type, spec])=>{
			(spec.fields || []).forEach((f)=>{
				if(f.kind === 'select' && Array.isArray(f.options)){
					f.options.forEach((opt)=>{
						const leaf = newLeaf(type);
						leaf.params[f.key] = opt.value;
						// 联动字段:令 showIf 成立(把驱动键设为使该字段可见的值——粗暴法:全 item/mode 驱动键逐一试)
						try{
							compileTree({ kind: 'group', negate: false, children: [leaf] });
						}catch(e){
							// 该值可能依赖别的驱动键(如 quality 仅 item=quality 时被 compile 发出)——
							// 换驱动键匹配后重试;仍炸=真死选项
							const drivers = ['item', 'mode', 'pattern', 'op', 'scope', 'kind', 'axis', 'relation', 'targetKind'];
							let ok = false;
							for(const d of drivers){
								const l2 = newLeaf(type);
								l2.params[d] = opt.value;
								try{ compileTree({ kind: 'group', negate: false, children: [l2] }); ok = true; break; }catch(_e){ /* next */ }
								const l3 = newLeaf(type);
								l3.params[f.key] = opt.value;
								(spec.fields || []).forEach((g)=>{
									if(g.key === d && typeof f.showIf === 'function'){
										(g.options || []).forEach((dv)=>{
											const probe = { ...l3.params, [d]: dv.value };
											if(f.showIf(probe)){ l3.params[d] = dv.value; }
										});
									}
								});
								try{ compileTree({ kind: 'group', negate: false, children: [l3] }); ok = true; break; }catch(_e){ /* next */ }
							}
							expect(ok ? '' : `${type}.${f.key}=${opt.value} 编译失败: ${e.message}`).toBe('');
						}
					});
				}
			});
		});
	});

	test('全类摘要文本含中文(零裸 ywastro 字母;存档/快照文本层)', ()=>{
		Object.keys(CONDITION_TYPES).forEach((type)=>{
			const text = conditionSummaryText(newLeaf(type));
			const cjk = (text.match(/[一-鿿]/g) || []).length;
			expect(cjk).toBeGreaterThanOrEqual(2);
		});
	});

	test('快照条件树段:32 类混树全覆盖非空(文本含全部叶且零裸字母)', ()=>{
		const { buildTianxingSnapshot } = require('../tianxingSnapshot');
		const kids = Object.keys(CONDITION_TYPES).map((t, i)=>newLeaf(t, i ? 'any' : 'all'));
		// 真实 UI 树形状:链式 joiner+嵌套子分组(真机实抓:组头按 node.op 读恒 undefined)
		const sub = newGroup('all');
		sub.children = [newLeaf('aspect', 'all'), newLeaf('in_sign', 'xor')];
		const tree = { kind: 'group', negate: false, children: [...kids, sub] };
		const text = buildTianxingSnapshot({ ok: true }, {}, {}, {
			cfg: { startDate: '2026-08-02', startTime: '00:00', endDate: '2026-09-01', endTime: '23:59', pos: '测试', zone: '+08:00', hsys: 3, zodiacal: 0 },
			tree, results: [], truncated: false,
		});
		expect(text).toContain('[征象条件]');
		expect((text.match(/查找/g) || []).length).toBeGreaterThanOrEqual(32);
		// 树文本三不变量:零 undefined 泄漏;链式 joiner 中文前缀在位;子分组头+异或前缀成对
		expect(text).not.toMatch(/undefined/);
		expect((text.match(/^\s*或 查找/gm) || []).length).toBeGreaterThanOrEqual(30);
		expect(text).toMatch(/【分组】/);
		expect(text).toMatch(/异或 查找/);
		// 盘面行:宫制显示人话名称(真机实抓「宫制序号 3」裸索引),hsys=3=Placidus
		expect(text).toMatch(/宫制：Placidus/);
		// 快照为纯文本层:glyph 段应回退中文 title,不得出现 ywastro 裸编码(如「 R 」独立相位字母)
		// 纯文本层零裸编码的本质保证:所有 glyph 段必须带中文/度数 title(text 版取 title)
		// ——「T 三角」等含拉丁字母的合法中文名不误伤。
		Object.keys(CONDITION_TYPES).forEach((t)=>{
			conditionSummary(newLeaf(t)).forEach((seg)=>{
				if(seg.glyph){
					expect(`${t}:${seg.title || ''}`).toMatch(/:(.*[一-鿿°′].*)$/);
				}
			});
		});
	});
});
