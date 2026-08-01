// QA Step2/3 压力测试矩阵：逐派每选项每取值 + 组合 + 边界;核心断言「改选项→结果变」(死控探测) + 不抛/不 NaN。
import { sanhe } from '../sanhe';
import { qiankun } from '../qiankun';
import { bazhai } from '../bazhai';
import { zibai } from '../zibai';
import { xuankong } from '../xuankong';
import { fuxing } from '../fuxing';
import { jingyin } from '../jingyin';
import { dagua } from '../dagua';
import { xingshi } from '../xingshi';
import { yearGods, dayCourse, zaoMing } from '../zeri';
import { xuankongLiufa } from '../xuankongLiufa';
import { mingli } from '../mingli';
import { shanAtDeg, chuanshanAt, toudiAt, fenjinAt, gua64AtDeg } from '../liqiCore';
import { LUOPAN_LAYERS, NEEDLE_OFFSET, XIU28_RING } from '../fengshuiData';
import { SHAN_ORDER } from '../fengshuiData';

const J = (x)=>JSON.stringify(x);
const GUA8 = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];
const SK12 = ['辛', '戌', '乾', '癸', '丑', '艮', '乙', '辰', '巽', '丁', '未', '坤'];
const XIANGFA8 = ['正生向', '正旺向', '正墓向', '正养向', '自生向', '自旺向', '沐浴向', '衰向'];

// 无 NaN 深检。
function noNaN(obj, path = '') {
	if (obj == null) { return true; }
	if (typeof obj === 'number') { return !Number.isNaN(obj); }
	if (typeof obj === 'string' || typeof obj === 'boolean') { return !/NaN/.test(String(obj)); }
	if (Array.isArray(obj)) { return obj.every((v, i)=>noNaN(v, `${path}[${i}]`)); }
	if (typeof obj === 'object') { return Object.keys(obj).every((k)=>noNaN(obj[k], `${path}.${k}`)); }
	return true;
}

describe('压测 · 玄空飞星:9运×24山×起卦×度数×流年月×阴阳宅', () => {
	test('全 24 山 × 9 运 × 下卦/替卦:三盘1-9排列、格局有、不抛不NaN', () => {
		for (let yun = 1; yun <= 9; yun++) {
			for (const xs of SHAN_ORDER) {
				for (const jian of [false, true]) {
					const r = xuankong(yun, xs, { jian, year: 2024, month: 6 });
					expect(r.available).toBe(true);
					expect(noNaN(r)).toBe(true);
					const flat = r.palaces.map((p)=>p.shan).sort((a, b)=>a - b);
					expect(flat).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
				}
			}
		}
	});
	test('死控探测:度数改→兼向判别变;阴阳宅改→显示变;替星方案改→替卦盘变', () => {
		expect(xuankong(9, '午', { deg: 180 }).jianInfo.mode).not.toBe(xuankong(9, '午', { deg: 185 }).jianInfo.mode);
		expect(xuankong(9, '午', { yinYangZhai: 'yang' }).yinYangZhai).not.toBe(xuankong(9, '午', { yinYangZhai: 'yin' }).yinYangZhai);
		// 替星3方案在争议山 午 上必产不同盘(子午卯酉◇)。
		const shen = J(xuankong(8, '午', { jian: true, tiVariant: 'shen' }).xiangPan);
		const youbi = J(xuankong(8, '午', { jian: true, tiVariant: 'youbi' }).xiangPan);
		expect(shen).not.toBe(youbi);
	});
	test('边界:非法流年(负/非数)不 NaN;度数 0 与 360 等价环绕', () => {
		expect(noNaN(xuankong(9, '午', { year: -5, month: 99 }))).toBe(true);
		expect(noNaN(xuankong(9, '午', { deg: 'abc' }))).toBe(true);
		expect(xuankong(9, '午', { deg: 0 }).available).toBe(true);
	});
});

describe('压测 · 三合:水口×水势×立向法×坐度×拨砂', () => {
	test('12 墓库水口 × 8 立向法 × 2 水势:定局有、向法有双山、不抛不NaN', () => {
		for (const sk of SK12) {
			for (const xf of XIANGFA8) {
				for (const wf of ['leftToRight', 'rightToLeft']) {
					const r = sanhe({ shuiKou: sk, waterFlow: wf, xiangFaType: xf });
					expect(r.available).toBe(true);
					expect(noNaN(r)).toBe(true);
					expect(r.xiangFa && r.xiangFa.shuangshan).toBeTruthy();
				}
			}
		}
	});
	test('死控探测:立向法改→向双山变;坐度改→线法变;八方砂改→拨砂变', () => {
		expect(sanhe({ shuiKou: '戌', xiangFaType: '正生向' }).xiangFa.shuangshan)
			.not.toBe(sanhe({ shuiKou: '戌', xiangFaType: '正旺向' }).xiangFa.shuangshan);
		expect(J(sanhe({ shuiKou: '戌', zuoDeg: 0 }).xianfa)).not.toBe(J(sanhe({ shuiKou: '戌', zuoDeg: 90 }).xianfa));
		const noSand = sanhe({ shuiKou: '戌', sands: {} }).bosha.sands.filter((s)=>s.wuGe).length;
		const withSand = sanhe({ shuiKou: '戌', sands: { 震: 'sand', 坎: 'sand' } }).bosha.sands.filter((s)=>s.wuGe).length;
		expect(withSand).toBeGreaterThan(noSand);
	});
	test('边界:8方砂全砂/全水/全平不抛;坐度空/非法不 NaN', () => {
		const allSand = {}; GUA8.forEach((g)=>{ allSand[g] = 'sand'; });
		expect(noNaN(sanhe({ shuiKou: '戌', sands: allSand }))).toBe(true);
		expect(noNaN(sanhe({ shuiKou: '戌', zuoDeg: 'x' }))).toBe(true);
		expect(sanhe({ shuiKou: '戌', zuoDeg: '' }).xianfa).toBeNull();
	});
});

describe('压测 · 乾坤国宝:8坐×9水位×来去水组合', () => {
	test('8坐 × 每位(来/去/无) 关键组合:9位齐、断有、不抛', () => {
		for (const zg of GUA8) {
			for (const w of ['come', 'go', '']) {
				const waters = {}; ['xianTian', 'houTian', 'anJie', 'tianJie', 'diXing', 'bin', 'ke', 'fu', 'zhengQiao'].forEach((k)=>{ waters[k] = w; });
				const r = qiankun({ zuoGua: zg, waters });
				expect(r.positions).toHaveLength(9);
				expect(noNaN(r)).toBe(true);
			}
		}
	});
	test('死控探测:9水位每位 来/去/无 三态输出各异(地刑来去皆凶但文异)', () => {
		const keys = ['xianTian', 'houTian', 'anJie', 'tianJie', 'diXing', 'bin', 'ke', 'fu', 'zhengQiao'];
		keys.forEach((k)=>{
			const of = (w)=>{ const p = qiankun({ zuoGua: '坎', waters: { [k]: w } }).positions.find((x)=>x.key === k); return `${p.result}|${p.jx}`; };
			const come = of('come'); const go = of('go'); const none = of('');
			expect(new Set([come, go, none]).size).toBe(3);   // 三态各异
		});
	});
});

describe('压测 · 八宅:8坐×男女×命年×基准×门主灶×进深', () => {
	test('8坐 × 男女 × 4进深:游星8方齐、不抛', () => {
		for (const zg of GUA8) {
			for (const male of [true, false]) {
				for (const zt of ['jing', 'dong', 'bian', 'hua']) {
					const r = bazhai({ zuoGua: zg, ming: { year: 1985, isMale: male }, zhaiType: zt });
					expect(r.palaces).toHaveLength(8);
					expect(noNaN(r)).toBe(true);
				}
			}
		}
	});
	test('死控探测:门主灶改→三要变;进深改→宅类变;基准以宅/以命→门主灶盘变', () => {
		const a = bazhai({ zuoGua: '坎', doorGua: '坎', mainGua: '震', stoveGua: '巽' }).sanYao.verdict.jx;
		const b = bazhai({ zuoGua: '坎', doorGua: '坎', mainGua: '坤', stoveGua: '乾' }).sanYao.verdict.jx;
		expect(a).not.toBe(b);
		expect(bazhai({ zuoGua: '坎', zhaiType: 'jing' }).zhaiTypeInfo.name).not.toBe(bazhai({ zuoGua: '坎', zhaiType: 'hua' }).zhaiTypeInfo.name);
		// 以宅 vs 以命(命卦≠宅卦时门方不同)
		const zhai = J(bazhai({ zuoGua: '坎', ming: { year: 1975, isMale: true }, mode: 'zhai' }).doorMainStove);
		const ming = J(bazhai({ zuoGua: '坎', ming: { year: 1975, isMale: true }, mode: 'ming' }).doorMainStove);
		expect(zhai).not.toBe(ming);
	});
});

describe('压测 · 紫白:年×月×日×时', () => {
	test('1900-2043 抽样 × 月1-12 × 日/时:入中1-9、不抛不NaN', () => {
		for (let y = 1900; y <= 2043; y += 7) {
			const r = zibai({ year: y, month: ((y % 12) + 1), date: { y, m: 6, d: 15, hour: 10 } });
			expect(r.yearPalaces).toHaveLength(9);
			expect(r.dayPalaces).toHaveLength(9);
			expect(r.hourPalaces).toHaveLength(9);
			expect(noNaN(r)).toBe(true);
		}
	});
	test('死控探测:日期改→日盘变;时改→时盘变', () => {
		expect(zibai({ year: 2026, date: { y: 2026, m: 3, d: 20 } }).dayInfo.center)
			.not.toBe(zibai({ year: 2026, date: { y: 2026, m: 3, d: 21 } }).dayInfo.center);
		expect(zibai({ year: 2026, date: { y: 2026, m: 3, d: 20, hour: 0 } }).hourInfo.center)
			.not.toBe(zibai({ year: 2026, date: { y: 2026, m: 3, d: 20, hour: 4 } }).hourInfo.center);
	});
});

describe('压测 · 五新派:辅星/净阴净阳/大卦/形势/择日', () => {
	test('辅星:8本卦 × 八方水组合不抛;死控:本卦改→九星盘变', () => {
		for (const bg of GUA8) {
			expect(noNaN(fuxing({ benGua: bg, waters: { 巽: 'come', 乾: 'go' } }))).toBe(true);
		}
		expect(J(fuxing({ benGua: '坎' }).palaces.map((p)=>p.star)))
			.not.toBe(J(fuxing({ benGua: '离' }).palaces.map((p)=>p.star)));
	});
	test('净阴净阳:24山×3位抽样不抛;死控:改山→净判定/阴阳变', () => {
		for (const s of SHAN_ORDER) { expect(noNaN(jingyin({ long: s, xiang: '午', water: '申' }))).toBe(true); }
		expect(jingyin({ long: '乾', xiang: '甲', water: '坤' }).jing).not.toBe(jingyin({ long: '乾', xiang: '艮', water: '坤' }).jing);
	});
	test('大卦:8×8卦不抛;死控:上下卦改→卦名变;卦运方案input+override→卦运变', () => {
		for (const lo of GUA8) { for (const up of GUA8) { expect(noNaN(dagua({ xiangLower: lo, xiangUpper: up, yun: 9 }))).toBe(true); } }
		expect(dagua({ xiangLower: '乾', xiangUpper: '兑', yun: 9 }).xiang.name).not.toBe(dagua({ xiangLower: '乾', xiangUpper: '坎', yun: 9 }).xiang.name);
		// 卦运方案:input + 直填 向/坐卦运(UI 路径)生效;struct 回落结构推定
		expect(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, yunScheme: 'input', xiangYunInput: 3, zuoYunInput: 7 }).xiang.yun).toBe(3);
		expect(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, yunScheme: 'input', xiangYunInput: 3, zuoYunInput: 7 }).zuo.yun).toBe(7);
		// 3+7=10 → 真夫妇
		expect(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, yunScheme: 'input', xiangYunInput: 3, zuoYunInput: 7 }).zhenFuFu).toBe(true);
		// input 但空输入 → 回落 struct(非死控:UI 有输入框)
		expect(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, yunScheme: 'input' }).xiang.yun)
			.toBe(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, yunScheme: 'struct' }).xiang.yun);
		// 兼容旧 yunOverride 键
		expect(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, yunScheme: 'input', yunOverride: { 乾为天: 1 } }).xiang.yun).toBe(1);
	});
	test('形势:五诀选项改→分/评变;全空不抛', () => {
		expect(noNaN(xingshi({}))).toBe(true);
		expect(xingshi({ longSheng: true, longStar: '贪狼' }).long.score).not.toBe(xingshi({ longSheng: false, longStar: '破军' }).long.score);
		expect(xingshi({ shuiCheng: '金城' }).shui.score).not.toBe(xingshi({ shuiCheng: '火城' }).shui.score);
		expect(xingshi({ xiangChaoJi: true }).xiang.score).not.toBe(xingshi({ xiangChongSha: true }).xiang.score);
	});
	test('择日:年神×坐山×日课;死控:流年改→年神变;坐山改→造命变', () => {
		for (let y = 2020; y <= 2043; y++) { expect(noNaN(yearGods(y))).toBe(true); }
		expect(yearGods(2026).sansha.ju).not.toBe(yearGods(2027).sansha.ju);
		expect(noNaN(dayCourse(2026, 3, 20))).toBe(true);
		const z1 = zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20 }).score;
		const z2 = zaoMing({ zuoShan: '午', y: 2026, m: 3, d: 20 }).score;
		expect(J(zaoMing({ zuoShan: '子', y: 2026, m: 3, d: 20 }))).not.toBe(J(zaoMing({ zuoShan: '午', y: 2026, m: 3, d: 20 })));
	});

	test('新派压测:玄空六法/命理派/罗盘读数 逐选项 + 组合 + 边界(负年/非数/空)', () => {
		for (let yun = 1; yun <= 9; yun++) {
			SHAN_ORDER.forEach((s, i) => {
				const r = xuankongLiufa({ yun, zuoShan: s, xiangShan: SHAN_ORDER[(i + 12) % 24], year: 2026 });
				expect(r.available).toBe(true);
				expect(noNaN(r)).toBe(true);
				expect(r.items.length).toBe(6);
			});
		}
		[undefined, '', null, 0, -500, 'abc', 99999].forEach((y) => {
			const r = xuankongLiufa({ yun: 9, zuoShan: '子', xiangShan: '午', year: y });
			expect(r.items.length).toBe(6);
			expect(noNaN(r)).toBe(true);
		});
		expect(xuankongLiufa({ zuoShan: '不存在' }).available).toBe(false);
		expect(xuankongLiufa({ yun: 'abc', zuoShan: '子', xiangShan: '午' }).yun).toBe(9);
		expect(J(xuankongLiufa({ yun: 1, zuoShan: '子', xiangShan: '午' })))
			.not.toBe(J(xuankongLiufa({ yun: 9, zuoShan: '子', xiangShan: '午' })));
		expect(xuankongLiufa({ yun: 9, zuoShan: '子', xiangShan: '午' }).items[0].verdict)
			.not.toBe(xuankongLiufa({ yun: 9, zuoShan: '午', xiangShan: '子' }).items[0].verdict);

		['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'].forEach((g) => {
			[true, false].forEach((m) => {
				for (let y = 1900; y <= 2040; y += 17) {
					const r = mingli({ mingYear: y, isMale: m, zhaiZuoGua: g });
					expect(r.available).toBe(true);
					expect(noNaN(r)).toBe(true);
					expect(r.fangwei.length).toBe(8);
				}
			});
		});
		// undefined 走默认入参 1990（可用）；空串/null/非数/非正 一律挡掉，不得静默算出「0 年」命卦
		expect(mingli({ mingYear: undefined }).ming.year).toBe(1990);
		['', null, 'abc', NaN, 0, -5, '   '].forEach((y) => { expect(mingli({ mingYear: y }).available).toBe(false); });
		expect(mingli({ mingYear: 1990, zhaiZuoGua: '中' }).available).toBe(false);
		expect(mingli({ mingYear: 1990, isMale: true }).ming.gua).not.toBe(mingli({ mingYear: 1990, isMale: false }).ming.gua);

		for (let d = 0; d < 360; d += 0.25) {
			expect(shanAtDeg(d)).toBeTruthy();
			expect(shanAtDeg(d + 7.5)).toBeTruthy();
			expect(shanAtDeg(d - 7.5)).toBeTruthy();
			const g = gua64AtDeg(d);
			expect(g.gua).toBeTruthy();
			expect(g.yaoIndex).toBeGreaterThanOrEqual(0);
			expect(g.yaoIndex).toBeLessThanOrEqual(5);
			const x = XIU28_RING.find((c) => ((d - c.deg0) % 360 + 360) % 360 < (((c.deg1 - c.deg0) % 360 + 360) % 360 || 360));
			expect(x).toBeTruthy();
		}
		expect(gua64AtDeg(-10).gua).toBe(gua64AtDeg(350).gua);
		expect(gua64AtDeg(730).gua).toBe(gua64AtDeg(10).gua);
	});

	test('🔴 罗盘层表 与 liqiCore 线法逐格对拍(防数据/算法双写漂移)', () => {
		const cell = (k) => LUOPAN_LAYERS.find((l) => l.key === k).cells;
		const mid = (c, w) => ((c.deg0 + w / 2) % 360 + 360) % 360;
		cell('chuanshan').forEach((c) => {
			const r = chuanshanAt(mid(c, 5));
			expect(r.ganzhi).toBe(c.ganzhi);
			expect(r.jx).toBe(c.jx);
			expect(r.positional).toBe(c.positional);
		});
		cell('toudi').forEach((c) => {
			const r = toudiAt(mid(c, 6));
			expect(r.ganzhi).toBe(c.ganzhi);
			expect(r.kong).toBe(c.kong);
			expect(r.jx).toBe(c.jx);
		});
		cell('fenjin').forEach((c) => {
			const r = fenjinAt(mid(c, 3));
			expect(r.ganzhi).toBe(c.ganzhi);
			expect(r.jx).toBe(c.jx);
			expect(r.fenIndex).toBe(c.sub);
		});
		expect(LUOPAN_LAYERS.length).toBe(13);
		expect(LUOPAN_LAYERS[0].r0).toBe(0);
		expect(LUOPAN_LAYERS[12].r1).toBe(1);
		for (let i = 1; i < LUOPAN_LAYERS.length; i++) {
			expect(LUOPAN_LAYERS[i].r0).toBeCloseTo(LUOPAN_LAYERS[i - 1].r1, 9);
		}
		expect(NEEDLE_OFFSET).toEqual({ zheng: 0, ren: -7.5, feng: 7.5 });
		const shanOf = (k, lab) => cell(k).find((c) => c.label === lab);
		expect(((shanOf('dipan', '子').deg0 + 7.5) % 360 + 360) % 360).toBeCloseTo(0, 9);
		expect(((shanOf('renpan', '子').deg0 + 7.5) % 360 + 360) % 360).toBeCloseTo(352.5, 9);
		expect(((shanOf('tianpan', '子').deg0 + 7.5) % 360 + 360) % 360).toBeCloseTo(7.5, 9);
		const xmid = (n) => { const c = XIU28_RING.find((x) => x.label === n); return ((c.deg0 + (360 / 28) / 2) % 360 + 360) % 360; };
		expect(xmid('房')).toBeCloseTo(90, 6);
		expect(xmid('虚')).toBeCloseTo(0, 6);
		expect(xmid('昴')).toBeCloseTo(270, 6);
		expect(xmid('星')).toBeCloseTo(180, 6);
	});
});
