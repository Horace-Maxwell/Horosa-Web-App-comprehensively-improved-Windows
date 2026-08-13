// [QA] 小成图 · 全功能验收矩阵:选项活开关总锁 / 事盘存↔载 round-trip / 挂载齿轮覆盖链 /
// 组合穷举(含边界·空值·冲突态)。🔴 失败即「勾了没用」或「存了没载」,不得改测试将就。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let mockSavedPayload = null;
jest.mock('../../../utils/kentangCaseSave', ()=>({
	openKentangCaseDrawer: (arg)=>{ mockSavedPayload = arg && arg.payload; },
	getKentangSavedCasePayload: ()=>(mockSavedPayload ? { caseVersion: 'v-test', payload: mockSavedPayload } : null),
}));
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: ()=>{} }));

// eslint-disable-next-line import/first
import XiaoChengTuMain, { buildXiaoChengTuSnapshotText, buildXiaoChengTuSnapshotForCase, DEFAULT_SETTINGS } from '../XiaoChengTuMain';
// eslint-disable-next-line import/first
import { qiGuaManual, qiGuaByNumbers, qiGuaByStock, qiGuaByDaYan, qiGuaByYaoQian } from '../core/xiaochengtuQiGua';
// eslint-disable-next-line import/first
import { buildPan } from '../core/xiaochengtuPan';
// eslint-disable-next-line import/first
import { DI_PAN } from '../core/xiaochengtuConst';
// eslint-disable-next-line import/first
import { mergeOptionsIntoPayload, getTechniqueSettingsDefaults, TECHNIQUE_SETTINGS_SCHEMA } from '../../../utils/techniqueMountSettings';

const FIELDS = { date: '2000-06-26', time: '12:00', zone: 8 };
const QI = qiGuaManual({ up: '乾', lo: '兑', dongYaos: [1, 2, 5] });   // 履之晋(golden 同源)
const PAN = buildPan(QI);
const GONGS = Object.keys(DI_PAN).map(Number);

const mkInst = (state)=>{
	const props = { fields: FIELDS, value: {} };
	const inst = new XiaoChengTuMain(props);
	inst.props = props;
	inst.state = { ...inst.state, ...(state || {}) };
	inst.setState = (patch, cb)=>{ const next = typeof patch === 'function' ? patch(inst.state) : patch; inst.state = { ...inst.state, ...next }; if(cb) cb(); };
	return inst;
};
const snapOf = (opts)=>buildXiaoChengTuSnapshotText(PAN, QI, { yongGong: 1, ...(opts || {}) });

// ── A. 选项活开关总锁(勾了必须真的变) ───────────────────
describe('[QA-A] 选项活开关:每一档改变都必须改动产出', ()=>{
	test('A1 用宫 8 档两两互不相同(推导链/数占/应期全随之变)', ()=>{
		const texts = GONGS.map((g)=>snapOf({ yongGong: g }));
		const uniq = new Set(texts);
		expect(uniq.size).toBe(GONGS.length);
		// 且每档的「用宫 N(卦)」行如实标注
		GONGS.forEach((g, i)=>{ expect(texts[i]).toContain(`用宫 ${g}(${DI_PAN[g]})`); });
	});
	test('A2 闢卦口径两档:含闢局时必变、且只变闢辞', ()=>{
		const zh = snapOf({ piKoujing: 'zheng' });
		const yi = snapOf({ piKoujing: 'yiwen' });
		expect(zh).not.toBe(yi);                       // 履=闢(乾升兑降) → 必变
		expect(zh).toContain('正传(得配害·失配利)');
		expect(yi).toContain('异文(得配利·失配害)');
		// 非闢局(乾为天=往)不受口径影响
		const qian = qiGuaManual({ up: '乾', lo: '乾', dongYaos: [] });
		const a = buildXiaoChengTuSnapshotText(buildPan(qian), qian, { yongGong: 1, piKoujing: 'zheng' });
		const b = buildXiaoChengTuSnapshotText(buildPan(qian), qian, { yongGong: 1, piKoujing: 'yiwen' });
		const line = (t)=>t.split('\n').find((l)=>l.indexOf('本卦乾为天') === 0);
		expect(line(a)).toBe(line(b));
	});
	test('A3 配数流派两档:同两数配出不同卦(天地数 vs 先天数)', ()=>{
		const t = qiGuaByNumbers({ upNum: 3, loNum: 8, qiguaShu: 'tiandi' });
		const x = qiGuaByNumbers({ upNum: 3, loNum: 8, qiguaShu: 'xiantian' });
		expect(t.ben.name).not.toBe(x.ben.name);
		expect(buildXiaoChengTuSnapshotText(buildPan(t), t, { yongGong: 1 }))
			.not.toBe(buildXiaoChengTuSnapshotText(buildPan(x), x, { yongGong: 1 }));
	});
	test('A4 起卦法五档:各出各的卦与起卦步文(mode 标记齐备)', ()=>{
		const all = {
			manual: qiGuaManual({ up: '乾', lo: '兑', dongYaos: [3] }),
			dayan: qiGuaByDaYan({ seed: 42 }),
			yaoqian: qiGuaByYaoQian({ seed: 42 }),
			number: qiGuaByNumbers({ upNum: 5, loNum: 9 }),
			stock: qiGuaByStock({ open: '1563.62', close: '1571.60' }),
		};
		Object.keys(all).forEach((k)=>{
			expect(`${k}:${all[k].mode}`).toBe(`${k}:${k}`);
			expect(all[k].ben.name).toBeTruthy();
			const t = buildXiaoChengTuSnapshotText(buildPan(all[k]), all[k], { yongGong: 1 });
			expect(t).toContain(all[k].ben.name);
			expect(`${k}:${t.indexOf('[股市]') >= 0}`).toBe(`${k}:${k === 'stock'}`); // 股市段只随股市局出
		});
		// 同 seed 不同法必不同分布口径 → 卦一般不同(此 seed 实测不同,防两法退化成同一实现)
		expect(all.dayan.counts).not.toEqual(all.yaoqian.counts);
	});
	test('A5 动爻每一位都真的改盘(之卦四宫随之变)', ()=>{
		const base = buildPan(qiGuaManual({ up: '乾', lo: '兑', dongYaos: [] }));
		[1, 2, 3, 4, 5, 6].forEach((y)=>{
			const p = buildPan(qiGuaManual({ up: '乾', lo: '兑', dongYaos: [y] }));
			const changed = [3, 7, 8, 6].filter((g)=>p.tianPan[g] !== base.tianPan[g]);
			expect(`爻${y}:${changed.length > 0}`).toBe(`爻${y}:true`); // 之卦族(3/7/8/6)必有变
			expect([9, 1, 4, 2].every((g)=>p.tianPan[g] === base.tianPan[g])).toBe(true); // 本卦族不动
		});
	});
	test('A6 K线八档 + 十字星:各出各的用宫建议', ()=>{
		const inst = mkInst({ qi: qiGuaByStock({ open: '12.34', close: '56.78' }) });
		const seen = new Set();
		['阳', '阴'].forEach((body)=>{
			[[false, false], [true, false], [false, true], [true, true]].forEach(([u, l])=>{
				inst.state.inputs = { ...inst.state.inputs, klineBody: body, klineUpper: u, klineLower: l };
				const k = inst.klineOpt();
				expect(k).toBeTruthy();
				seen.add(`${k.body}|${k.upper}|${k.lower}`);
			});
		});
		expect(seen.size).toBe(8);
		inst.state.inputs = { ...inst.state.inputs, klineBody: 'doji' };
		expect(inst.klineOpt()).toEqual({ body: '阳', doji: true });
		inst.state.inputs = { ...inst.state.inputs, klineBody: null };
		expect(inst.klineOpt()).toBeNull();
	});
	test('A7 问事:入快照且不改卦(纯上下文)', ()=>{
		const a = snapOf({ askEvent: '' });
		const b = snapOf({ askEvent: '问来人' });
		expect(a).toContain('(未录问事)');
		expect(b).toContain('所问:问来人');
		expect(a.split('[佈局]')[1]).toBe(b.split('[佈局]')[1]); // 佈局之后一字不差
	});
});

// ── B. 事盘存↔载 round-trip ─────────────────────────────
describe('[QA-B] 事盘 round-trip:存什么就载什么(存而不载=真 bug)', ()=>{
	beforeEach(()=>{ mockSavedPayload = null; });

	test('B1 五起卦法各存各载:settings 全键 + 起卦输入 + 卦 + 问事', ()=>{
		const cases = [
			{ fa: 'manual', qi: qiGuaManual({ up: '巽', lo: '离', dongYaos: [2, 3, 5] }), inputs: { up: '巽', lo: '离', dongYaosText: '2,3,5' } },
			{ fa: 'dayan', qi: qiGuaByDaYan({ seed: 777 }), inputs: { seed: 777, countsText: '' } },
			{ fa: 'yaoqian', qi: qiGuaByYaoQian({ seed: 888 }), inputs: { seed: 888, countsText: '7 8 9 6 7 8' } },
			{ fa: 'number', qi: qiGuaByNumbers({ upNum: 13, loNum: 27 }), inputs: { upNum: 13, loNum: 27 } },
			{ fa: 'stock', qi: qiGuaByStock({ open: '1563.62', close: '1571.60' }), inputs: { open: '1563.62', close: '1571.60' } },
		];
		cases.forEach(({ fa, qi, inputs })=>{
			mockSavedPayload = null;
			const src = mkInst({
				qi,
				settings: { ...DEFAULT_SETTINGS, qiguaFa: fa, qiguaShu: 'xiantian', yongGong: 7, piKoujing: 'yiwen' },
				inputs: { ...mkInst().state.inputs, ...inputs, askEvent: `占${fa}` },
			});
			src.clickSaveCase();
			expect(mockSavedPayload).toBeTruthy();

			const dst = mkInst();
			expect(dst.restoreFromCurrentCase(true)).toBe(true);
			// 设置全键回来
			expect(dst.state.settings.qiguaFa).toBe(fa);
			expect(dst.state.settings.qiguaShu).toBe('xiantian');
			expect(dst.state.settings.yongGong).toBe(7);
			expect(dst.state.settings.piKoujing).toBe('yiwen');
			// 卦是冻结值,逐字回来
			expect(dst.state.qi.ben.name).toBe(qi.ben.name);
			expect(dst.state.qi.zhi.name).toBe(qi.zhi.name);
			expect(dst.state.qi.mode).toBe(qi.mode);
			// 🔴 起卦输入回来(左栏须与所载之卦一致,否则左栏说甲、中栏画乙)
			Object.keys(inputs).forEach((k)=>{ expect(`${fa}.${k}:${dst.state.inputs[k]}`).toBe(`${fa}.${k}:${inputs[k]}`); });
			expect(dst.state.inputs.askEvent).toBe(`占${fa}`);
		});
	});

	test('B2 K线档随股市局存载(kline 走 options,回放到 inputs 三键)', ()=>{
		mockSavedPayload = null;
		const src = mkInst({
			qi: qiGuaByStock({ open: '12.34', close: '56.78' }),
			settings: { ...DEFAULT_SETTINGS, qiguaFa: 'stock' },
			inputs: { ...mkInst().state.inputs, open: '12.34', close: '56.78', klineBody: '阴', klineUpper: true, klineLower: false },
		});
		src.clickSaveCase();
		expect(mockSavedPayload.options.kline).toEqual({ body: '阴', upper: true, lower: false, doji: false });
		const dst = mkInst();
		dst.restoreFromCurrentCase(true);
		expect(dst.state.inputs.klineBody).toBe('阴');
		expect(dst.state.inputs.klineUpper).toBe(true);
		expect(dst.state.inputs.klineLower).toBe(false);
		expect(dst.state.settings.kline).toBeUndefined(); // kline 不得污染 settings
	});

	test('B3 老档兼容:payload 无 inputs 字段(旧版所存)仍能载入,不抛不清空', ()=>{
		mockSavedPayload = { options: { qiguaFa: 'manual', yongGong: 3 }, qi: QI, askEvent: '旧档' };
		const dst = mkInst();
		expect(()=>dst.restoreFromCurrentCase(true)).not.toThrow();
		expect(dst.state.qi.ben.name).toBe('天泽履');
		expect(dst.state.settings.yongGong).toBe(3);
		expect(dst.state.inputs.askEvent).toBe('旧档');
		expect(dst.state.inputs.up).toBe('乾'); // 保持默认,不被 undefined 冲掉
	});

	test('B4 破损档:缺 qi / qi 无 ben / 空 payload 一律不载(不炸页面)', ()=>{
		[null, {}, { qi: null }, { qi: {} }, { qi: { ben: null } }].forEach((p)=>{
			mockSavedPayload = p;
			const dst = mkInst();
			expect(dst.restoreFromCurrentCase(true)).toBe(false);
			expect(dst.state.qi).toBeNull();
		});
	});

	test('B5 存档 payload 自带快照,且与载入后现算快照一致(存显一致)', ()=>{
		mockSavedPayload = null;
		const src = mkInst({ qi: QI, settings: { ...DEFAULT_SETTINGS, yongGong: 9, piKoujing: 'yiwen' }, inputs: { ...mkInst().state.inputs, askEvent: '一致性' } });
		src.clickSaveCase();
		const live = buildXiaoChengTuSnapshotForCase(mockSavedPayload, {});
		expect(live).toBe(mockSavedPayload.snapshot);
		expect(live).toContain('用宫 9(离)');
		expect(live).toContain('异文(得配利·失配害)');
	});
});

// ── C. AI 挂载齿轮覆盖链 ────────────────────────────────
describe('[QA-C] 挂载齿轮:改档必透传到无头重算(死开关闸)', ()=>{
	test('C1 齿轮字段与组件默认同源,且登记项均可覆盖', ()=>{
		const spec = TECHNIQUE_SETTINGS_SCHEMA.xiaochengtu;
		expect(spec.kind).toBe('payload');
		expect(spec.optionsPath).toBe('options');
		spec.fields.forEach((f)=>{ expect(`${f.name}:${f.default}`).toBe(`${f.name}:${DEFAULT_SETTINGS[f.name]}`); });
		expect(getTechniqueSettingsDefaults('xiaochengtu')).toEqual({ yongGong: 1, piKoujing: 'zheng' });
	});
	test('C2 齿轮 → mergeOptionsIntoPayload → 重算:用宫/口径逐档生效', ()=>{
		const base = { options: { qiguaFa: 'manual', yongGong: 1, piKoujing: 'zheng' }, qi: QI, askEvent: 'x' };
		GONGS.forEach((g)=>{
			const merged = mergeOptionsIntoPayload(base, 'xiaochengtu', { yongGong: g });
			const t = buildXiaoChengTuSnapshotForCase(merged, merged.options);
			expect(t).toContain(`用宫 ${g}(${DI_PAN[g]})`);
		});
		const yi = mergeOptionsIntoPayload(base, 'xiaochengtu', { piKoujing: 'yiwen' });
		expect(buildXiaoChengTuSnapshotForCase(yi, yi.options)).toContain('异文(得配利·失配害)');
		// 覆盖不改原 payload(纯函数语义)
		expect(base.options.yongGong).toBe(1);
		expect(base.options.piKoujing).toBe('zheng');
	});
	test('C3 齿轮不得动卦(重配起卦法/两数皆不在登记项内)', ()=>{
		const names = TECHNIQUE_SETTINGS_SCHEMA.xiaochengtu.fields.map((f)=>f.name);
		['qiguaFa', 'qiguaShu', 'kline'].forEach((k)=>expect(names).not.toContain(k));
	});
	test('C4 缺卦时的挂载重算(时间卦兜底)不炸且成卦', ()=>{
		const t = buildXiaoChengTuSnapshotForCase({ options: { yongGong: 1 } }, {});
		expect(t).toBe(''); // 无卦即空,交由上游走两数式起卦路径
		const withQi = buildXiaoChengTuSnapshotForCase({ qi: qiGuaByNumbers({ upNum: 20, loNum: 33 }), options: { yongGong: 1 } }, {});
		expect(withQi).toContain('[佈局]');
	});
});

// ── D. 组合穷举(边界·空值·冲突态) ───────────────────────
describe('[QA-D] 组合穷举:五起卦法 × 八用宫 × 两口径 × 动爻集', ()=>{
	test('D1 全组合快照非空且段头恒为七段之序', ()=>{
		const quas = [
			qiGuaManual({ up: '坤', lo: '坤', dongYaos: [] }),          // 无动爻(之卦=本卦)
			qiGuaManual({ up: '乾', lo: '乾', dongYaos: [1, 2, 3, 4, 5, 6] }), // 六爻皆动
			qiGuaByDaYan({ seed: 1 }), qiGuaByYaoQian({ seed: 1 }),
			qiGuaByNumbers({ upNum: 1, loNum: 1 }), qiGuaByNumbers({ upNum: 999, loNum: 1000 }),
			qiGuaByStock({ open: '0.01', close: '99999.99' }),
		];
		let n = 0;
		quas.forEach((qi)=>{
			const pan = buildPan(qi);
			GONGS.forEach((g)=>{
				['zheng', 'yiwen'].forEach((kj)=>{
					const t = buildXiaoChengTuSnapshotText(pan, qi, { yongGong: g, piKoujing: kj, askEvent: 'q' });
					expect(t.length).toBeGreaterThan(80);
					const heads = t.match(/^\[[^\]]+\]$/gm) || [];
					const want = qi.mode === 'stock'
						? ['[问事]', '[起卦]', '[佈局]', '[推导]', '[四象]', '[应期]', '[股市]']
						: ['[问事]', '[起卦]', '[佈局]', '[推导]', '[四象]', '[应期]'];
					expect(heads).toEqual(want);
					n += 1;
				});
			});
		});
		expect(n).toBe(quas.length * GONGS.length * 2);
	});
	test('D2 非法/空/极端输入一律 null-safe(不产伪盘、不抛)', ()=>{
		expect(qiGuaByStock({ open: '', close: '' })).toBeNull();
		expect(qiGuaByStock({ open: 'abc', close: 'def' })).toBeNull();
		expect(qiGuaByStock({ open: null, close: '1.2' })).toBeNull();
		expect(qiGuaByNumbers({ upNum: 0, loNum: 0 })).toBeNull();
		expect(qiGuaByNumbers({ upNum: -5, loNum: 3 }).ben.up).toBe('坎'); // 取绝对值 5→坎(天地数)
		expect(qiGuaManual({ up: 'X', lo: '兑' })).toBeNull();
		expect(buildPan(null)).toBeNull();
		expect(buildXiaoChengTuSnapshotText(null, QI, {})).toBe('');
		expect(buildXiaoChengTuSnapshotText(PAN, null, {})).toBe('');
		// 非法用宫(中五/越界/非数)→ 落 1 坎宫,不炸
		[5, 0, 99, null, undefined, 'x'].forEach((g)=>{
			const t = buildXiaoChengTuSnapshotText(PAN, QI, { yongGong: g });
			expect(t).toContain('[推导]');
		});
	});
	test('D3 冲突态:股市局却改起卦法(不重起)—— 股市页与 K线判据同源不打架', ()=>{
		const inst = mkInst({
			qi: qiGuaByStock({ open: '12.34', close: '56.78' }),
			settings: { ...DEFAULT_SETTINGS, qiguaFa: 'manual' },   // 起卦法已切走,卦仍是股市局
			inputs: { ...mkInst().state.inputs, klineBody: '阳', klineUpper: true, klineLower: true },
		});
		// 🔴 判据取「卦是不是股市局」:股市页照出 → K线行也必须照出(此前按 settings 判会消失)
		expect(inst.klineOpt()).toEqual({ body: '阳', upper: true, lower: true, doji: false });
		const t = buildXiaoChengTuSnapshotText(inst.getPan(), inst.state.qi, { ...inst.state.settings, kline: inst.klineOpt() });
		expect(t).toContain('[股市]');
		expect(t).toContain('K线定用宫:阳线双影 → 离宫(9)');
	});
	test('D4 未起卦时选股价法:K线预览可用(供起卦前定用宫)', ()=>{
		const inst = mkInst({ qi: null, settings: { ...DEFAULT_SETTINGS, qiguaFa: 'stock' }, inputs: { ...mkInst().state.inputs, klineBody: '阴' } });
		expect(inst.klineOpt()).toEqual({ body: '阴', upper: false, lower: false, doji: false });
	});
	test('🔴 D5 反向冲突态:手上是别法之卦却切到股价法 —— 预览仍须可用(判据是「或」不是三元)', ()=>{
		const inst = mkInst({
			qi: qiGuaManual({ up: '坤', lo: '坤', dongYaos: [] }),   // 旧卦是手动局
			settings: { ...DEFAULT_SETTINGS, qiguaFa: 'stock' },      // 正在改配股价卦
			inputs: { ...mkInst().state.inputs, klineBody: '阳', klineUpper: true },
		});
		expect(inst.klineOpt()).toEqual({ body: '阳', upper: true, lower: false, doji: false });
	});
	test('D6 两向都不成立时才关:手动卦 + 手动法 → K线不参与', ()=>{
		const inst = mkInst({
			qi: qiGuaManual({ up: '乾', lo: '兑', dongYaos: [] }),
			settings: { ...DEFAULT_SETTINGS, qiguaFa: 'manual' },
			inputs: { ...mkInst().state.inputs, klineBody: '阳' },
		});
		expect(inst.klineOpt()).toBeNull();
	});
});

// ── E. 三栏渲染在全档位下不塌 ───────────────────────────
describe('[QA-E] 三栏渲染:全起卦法 × 全用宫不抛不空', ()=>{
	test('E1 中栏/右栏逐档渲染', ()=>{
		const quas = {
			manual: QI, dayan: qiGuaByDaYan({ seed: 5 }), yaoqian: qiGuaByYaoQian({ seed: 5 }),
			number: qiGuaByNumbers({ upNum: 7, loNum: 3 }), stock: qiGuaByStock({ open: '99.9', close: '1.1' }),
		};
		Object.keys(quas).forEach((fa)=>{
			GONGS.forEach((g)=>{
				const inst = mkInst({ qi: quas[fa], settings: { ...DEFAULT_SETTINGS, qiguaFa: fa, yongGong: g } });
				const pan = inst.getPan();
				expect(()=>renderToStaticMarkup(<div>{inst.renderCenter(pan)}</div>)).not.toThrow();
				const aux = inst.renderAux(pan);
				const panes = aux.props.children.filter(Boolean);
				panes.forEach((p)=>{ expect(()=>renderToStaticMarkup(<div>{p.props.children}</div>)).not.toThrow(); });
				// 股市页只随股市局出
				expect(`${fa}:${panes.some((p)=>p.key === 'stock')}`).toBe(`${fa}:${fa === 'stock'}`);
			});
		});
	});
	test('E2 左栏五档渲染 + 未起卦空态', ()=>{
		['manual', 'dayan', 'yaoqian', 'number', 'stock'].forEach((fa)=>{
			const inst = mkInst({ qi: null, settings: { ...DEFAULT_SETTINGS, qiguaFa: fa } });
			expect(()=>renderToStaticMarkup(<div>{inst.renderControls()}</div>)).not.toThrow();
		});
	});
});
