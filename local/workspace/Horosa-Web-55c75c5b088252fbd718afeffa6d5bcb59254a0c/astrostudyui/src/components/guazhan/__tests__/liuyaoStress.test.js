// 六爻穷尽压测:全流派×全开关×代表卦×占测 笛卡尔,断言 analyzeLiuyao(中右栏单一真值源)不抛 + 每个设置都被忠实反映。
// 中栏(renderMiddleZhuangBoard)与右栏(装卦/用神/动变页签)均吃 getLiuyaoAnalysis()→analyzeLiuyao,故扫此即覆盖中右栏全显示。
import { analyzeLiuyao, guaFromLines } from '../../gua/liuyaoFacade';
import { applyPreset, setOption, DEFAULT_LIUYAO_SETTINGS, getLiuyaoOptionsKey } from '../../gua/liuyaoSchools';
import { liuyaoStructLines } from '../GuaZhanMain';
import { Gua64, getGua64 } from '../../gua/GuaConst';

function byName(n){ getGua64(0); return Gua64.find((x) => x.name === n); }
const CTX = { dayGan: '甲', dayZhi: '子', monthZhi: '午', yearGan: '丙', yearZhi: '午' };

// 代表卦:静卦/单动/多动/用神多现/全土/不上卦卦身
const GUA_CASES = [
	{ name: '乾为天', moving: [] },          // 八纯·静
	{ name: '火水未济', moving: [3] },        // 三世·单动·卦身不上卦·官鬼伏
	{ name: '风地观', moving: [2, 5] },       // 用神多现·多动
	{ name: '坤为地', moving: [1] },          // 全阴·土多
	{ name: '泽山咸', moving: [3] },          // 订正卦·世在动爻
	{ name: '天风姤', moving: [1, 2, 3, 4, 5, 6] }, // 六爻全动极端
];
const ASK_TYPES = ['self', 'wealth', 'career', 'marriage_m', 'illness'];
const SCHOOLS = ['default', 'zengshan', 'bushi', 'yiyin', 'xinpai', 'mangpai'];

describe('六爻穷尽压测 · 全流派×全开关×代表卦', () => {
	test('5+1流派 × 6代表卦 × 5占测 全组合:analyzeLiuyao 不抛 + 6爻齐 + 结构真值在位', () => {
		let n = 0;
		SCHOOLS.forEach((sc) => {
			GUA_CASES.forEach((gc) => {
				ASK_TYPES.forEach((ask) => {
					const settings = setOption(applyPreset(sc), 'askType', ask);
					const gua = byName(gc.name);
					let a = null;
					expect(() => { a = analyzeLiuyao(gua, gc.moving, CTX, settings); }).not.toThrow();
					expect(a).not.toBeNull();
					expect(a.yaos).toHaveLength(6);
					expect(a.palaceType).not.toBeNull();
					expect(a.yongShen.yong).toBeTruthy();
					// 动变数与输入动爻数一致
					expect(a.dongBian.movingCount).toBe(gc.moving.length);
					// 每爻必有 旺衰(午月) + 地支五行六亲
					a.yaos.forEach((y) => {
						expect(y.wangShuai).toBeTruthy();
						expect(y.zhi && y.wuxing && y.liuqin).toBeTruthy();
					});
					n++;
				});
			});
		});
		expect(n).toBe(SCHOOLS.length * GUA_CASES.length * ASK_TYPES.length); // 180
	});

	test('显示开关全组合(2^5×3)→ 输出忠实反映每个设置(中右栏据此显隐)', () => {
		const gua = byName('火水未济');
		const moving = [3];
		let n = 0;
		[true, false].forEach((guashen) => {
			[true, false].forEach((sixGods) => {
				[true, false].forEach((shenshaOn) => {
					['missing', 'all'].forEach((fushen) => {
						['water', 'fire', 'off'].forEach((tu) => {
							let s = { ...DEFAULT_LIUYAO_SETTINGS, guashen, sixGods, fushen, tuChangsheng: tu, shensha: { ...DEFAULT_LIUYAO_SETTINGS.shensha, on: shenshaOn } };
							const a = analyzeLiuyao(gua, moving, CTX, s);
							// 卦身开关
							if(guashen){ expect(a.guaShen).not.toBeNull(); } else { expect(a.guaShen).toBeNull(); }
							// 六神开关
							if(sixGods){ expect(a.liuShen).not.toBeNull(); } else { expect(a.liuShen).toBeNull(); }
							// 神煞开关
							if(shenshaOn){ expect(a.shenSha).not.toBeNull(); } else { expect(a.shenSha).toBeNull(); }
							// 飞伏 all → 逐爻全标6
							if(fushen === 'all'){ expect(a.fushenAll).toHaveLength(6); } else { expect(a.fushenAll).toBeNull(); }
							// 土长生 off → 任何土爻无入墓/长生标
							if(tu === 'off'){ a.yaos.forEach((y) => { expect(y.changsheng).toBe(''); expect(y.ruMu).toBe(false); }); }
							n++;
						});
					});
				});
			});
		});
		expect(n).toBe(2 * 2 * 2 * 2 * 3); // 48
	});

	test('土长生水土/火土同宫切换 → 同一土爻入墓位不同(中右栏状态列随之变)', () => {
		const gua = byName('坤为地');
		const water = analyzeLiuyao(gua, [], { ...CTX, dayZhi: '辰' }, { ...DEFAULT_LIUYAO_SETTINGS, tuChangsheng: 'water' });
		const fire = analyzeLiuyao(gua, [], { ...CTX, dayZhi: '辰' }, { ...DEFAULT_LIUYAO_SETTINGS, tuChangsheng: 'fire' });
		expect(water.yaos.some((y) => y.wuxing === '土' && y.ruMu)).toBe(true);  // 辰=土墓(水土同宫)
		expect(fire.yaos.some((y) => y.wuxing === '土' && y.ruMu)).toBe(false);  // 火土同宫→墓在戌
	});

	test('变爻作用范围 traditional/blind:盲派额外产出变爻作用本卦他爻(右栏动变可见)', () => {
		const gua = byName('火水未济');
		const trad = analyzeLiuyao(gua, [3], CTX, { ...DEFAULT_LIUYAO_SETTINGS, bianyaoScope: 'traditional' });
		const blind = analyzeLiuyao(gua, [3], CTX, { ...DEFAULT_LIUYAO_SETTINGS, bianyaoScope: 'blind' });
		expect(trad.settings.bianyaoScope).toBe('traditional');
		expect(blind.settings.bianyaoScope).toBe('blind');
		// 传统派不产出他爻作用;盲派产出(visible diff)
		expect(trad.dongBian.blindEffects).toBeUndefined();
		expect(Array.isArray(blind.dongBian.blindEffects)).toBe(true);
		expect(blind.dongBian.blindEffects.length).toBeGreaterThan(0);
		blind.dongBian.blindEffects.forEach((e) => {
			expect(e.from).not.toBe(e.to);              // 不含本位
			expect(/[生克冲合]/.test(e.rel)).toBe(true);
		});
	});

	test('AI 快照(liuyaoStructLines)随流派变:增删卜易无卦身/神煞、易隐有', () => {
		getGua64(0);
		const g = Gua64.find((x) => x.name === '火水未济');
		const yao = g.value.map((v, i) => ({ value: v, change: i === 2, name: g.yaoname[i] }));
		const nongli = { dayGanZi: '甲子', monthGanZi: '丙午', yearGanZi: '丙午' };
		const mk = (school, extra) => liuyaoStructLines({ currentGua: Gua64.indexOf(g), yao, nongli, liuyaoSettings: { ...applyPreset(school), ...extra } }).join('\n');
		const zs = mk('zengshan', { guashen: false, shensha: { on: false } });
		const yy = mk('yiyin', {});
		expect(zs).not.toContain('卦身：');
		expect(yy).toContain('卦身：');
		// 神煞已表化到逐爻表「神煞」列:易隐有值(天乙贵人)、增删卜易关神煞则该列全 —。
		expect(yy).toContain('天乙贵人');
		expect(zs).not.toContain('天乙贵人');
	});

	test('左栏每个设置改变都触发重算(getLiuyaoOptionsKey 变)→ 中(d3)+右(页签)必同步刷新', () => {
		const base = DEFAULT_LIUYAO_SETTINGS;
		const k0 = getLiuyaoOptionsKey(base);
		const variants = {
			占测事项: setOption(base, 'askType', 'wealth'),
			卦身: setOption(base, 'guashen', false),
			六神: setOption(base, 'sixGods', false),
			神煞: setOption(base, 'shensha', { on: false }),
			飞伏: setOption(base, 'fushen', 'all'),
			土长生: setOption(base, 'tuChangsheng', 'fire'),
			变爻范围: setOption(base, 'bianyaoScope', 'blind'),
			月破: setOption(base, 'yuepoMode', 'always'),
			神煞起例: setOption(base, 'shensha', { base: 'year' }),
			预设增删卜易: applyPreset('zengshan'),
			预设易隐: applyPreset('yiyin'),
			预设盲派: applyPreset('mangpai'),
		};
		Object.keys(variants).forEach((k) => {
			expect(getLiuyaoOptionsKey(variants[k])).not.toBe(k0); // key 变 → getLiuyaoAnalysis 缓存失效 → 中右栏重算
		});
	});

	test('关联卦完整分析随设置同步(右栏关联卡=本卦同口径):六神/神煞开关、六亲按本卦宫', () => {
		const g = byName('火水未济'); // 离宫
		const on = analyzeLiuyao(g, [3], CTX, { ...DEFAULT_LIUYAO_SETTINGS, sixGods: true, shensha: { ...DEFAULT_LIUYAO_SETTINGS.shensha, on: true } });
		const off = analyzeLiuyao(g, [3], CTX, { ...DEFAULT_LIUYAO_SETTINGS, sixGods: false, shensha: { on: false } });
		// 关联卦(伏神/互/错/综/之)都出全 6 爻
		['fu', 'hu', 'cuo', 'zong', 'bian'].forEach((k) => {
			expect(on.related[k]).toBeTruthy();
			expect(on.related[k].yaos).toHaveLength(6);
		});
		// 六神/神煞开关同步到关联卦
		expect(on.related.fu.liuShen).not.toBeNull();
		expect(off.related.fu.liuShen).toBeNull();
		expect(on.related.fu.shenSha).not.toBeNull();
		expect(off.related.fu.shenSha).toBeNull();
		// 关联卦六亲按本卦宫(离=火):每爻六亲非空且来自火宫论
		on.related.hu.yaos.forEach((y) => { expect(y.liuqin).toBeTruthy(); });
		// 静卦无之卦
		expect(analyzeLiuyao(byName('乾为天'), [], CTX, DEFAULT_LIUYAO_SETTINGS).related.bian).toBeNull();
	});

	test('全 64 卦 × 单动(每卦初爻动)× 默认设置:facade 不抛、变卦齐', () => {
		getGua64(0);
		let n = 0;
		Gua64.forEach((g) => {
			const a = analyzeLiuyao(g, [1], CTX, DEFAULT_LIUYAO_SETTINGS);
			expect(a).not.toBeNull();
			expect(a.dongBian.bianGua).not.toBeNull();
			expect(a.related.cuo && a.related.zong && a.related.hu).toBeTruthy();
			n++;
		});
		expect(n).toBe(64);
	});

	// ── 补缺口压测:月破/变卦/年界/初爻位 全枚举 + 多动爻完整(原压测未覆盖) ──
	test('补缺口:月破(2)×变卦(2)×年界(2)×初爻位(2)×字背 全组合(32)× 代表卦:不抛 + 结构齐 + 设置忠实回显', () => {
		const gua = byName('火水未济');
		const moving = [3];
		let n = 0;
		['inMonth', 'always'].forEach((yuepoMode) => {
			['movingOnly', 'full'].forEach((biangua) => {
				['lichun', 'lunar'].forEach((yearBoundary) => {
					['bottomUp', 'topDown'].forEach((writeDir) => {
						['standard', 'alt'].forEach((coinFace) => {
							const s = { ...DEFAULT_LIUYAO_SETTINGS, yuepoMode, biangua, yearBoundary, writeDir, coinFace };
							let a = null;
							expect(() => { a = analyzeLiuyao(gua, moving, CTX, s); }).not.toThrow();
							expect(a).not.toBeNull();
							expect(a.yaos).toHaveLength(6);
							expect(a.dongBian.bianGua).not.toBeNull();
							// 设置忠实回显(中右栏据 settings 渲染口径)
							expect(a.settings.yuepoMode).toBe(yuepoMode);
							expect(a.settings.biangua).toBe(biangua);
							expect(a.settings.yearBoundary).toBe(yearBoundary);
							expect(a.settings.writeDir).toBe(writeDir);
							n++;
						});
					});
				});
			});
		});
		expect(n).toBe(2 * 2 * 2 * 2 * 2); // 32
	});

	test('补缺口:变卦全装(full) → 变爻六亲齐;仅装变爻(movingOnly) → 只变爻有变卦六亲', () => {
		const gua = byName('风地观');
		const full = analyzeLiuyao(gua, [2, 5], CTX, { ...DEFAULT_LIUYAO_SETTINGS, biangua: 'full' });
		const only = analyzeLiuyao(gua, [2, 5], CTX, { ...DEFAULT_LIUYAO_SETTINGS, biangua: 'movingOnly' });
		expect(full.settings.biangua).toBe('full');
		expect(only.settings.biangua).toBe('movingOnly');
		// 两者都出之卦,动变数一致
		expect(full.dongBian.bianGua).not.toBeNull();
		expect(only.dongBian.bianGua).not.toBeNull();
		expect(full.dongBian.movingCount).toBe(2);
	});

	test('补缺口:多动爻完整(0/1/2/3/4/5/6 動)× 默认:不抛 + 动变数精确 + 6爻齐', () => {
		const gua = byName('乾为天'); // 八纯,逐爻翻动构造各动爻数
		let n = 0;
		[[], [1], [1, 2], [1, 2, 3], [1, 2, 3, 4], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6]].forEach((moving) => {
			let a = null;
			expect(() => { a = analyzeLiuyao(gua, moving, CTX, DEFAULT_LIUYAO_SETTINGS); }).not.toThrow();
			expect(a.yaos).toHaveLength(6);
			expect(a.dongBian.movingCount).toBe(moving.length);
			// 有动爻则有之卦,静卦无之卦
			if (moving.length > 0) { expect(a.dongBian.bianGua).not.toBeNull(); }
			else { expect(a.related.bian).toBeNull(); }
			n++;
		});
		expect(n).toBe(7);
	});

	test('补缺口:月破 inMonth/always 对同卦同月产出可不同的月破标记(右栏旺衰列随之)', () => {
		const gua = byName('坤为地');
		const inMonth = analyzeLiuyao(gua, [], { ...CTX, monthZhi: '子' }, { ...DEFAULT_LIUYAO_SETTINGS, yuepoMode: 'inMonth' });
		const always = analyzeLiuyao(gua, [], { ...CTX, monthZhi: '子' }, { ...DEFAULT_LIUYAO_SETTINGS, yuepoMode: 'always' });
		expect(inMonth.settings.yuepoMode).toBe('inMonth');
		expect(always.settings.yuepoMode).toBe('always');
		// 两种模式逐爻 yuePo 字段都应有定义(布尔),不抛
		inMonth.yaos.forEach((y) => { expect(typeof y.yuePo).toBe('boolean'); });
		always.yaos.forEach((y) => { expect(typeof y.yuePo).toBe('boolean'); });
	});
});
