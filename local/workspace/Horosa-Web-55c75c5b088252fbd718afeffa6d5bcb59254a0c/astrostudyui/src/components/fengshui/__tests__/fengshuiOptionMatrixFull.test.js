// 风水 · 全功能穷举矩阵（十六项 · 每选项每取值 × 组合 × 边界 × 冲突）。
//
// 与既有 fengshuiOptionMatrix.test.js 的分工：那份锁「盘面数值合法性」，这份锁
// **每个左栏选项是否真影响输出（防死开关）+ 选项间组合/边界/冲突不炸**。
// 🔴 判据取「该选项独立变动时，引擎返回体是否随之变化」——单一变量法，避免拿组合结果
//    冒充单项生效（既往地占栽过：差分预言机证不了接线）。
import { xuankong } from '../xuankong';
import { sanhe } from '../sanhe';
import { zibai } from '../zibai';
import { qiankun } from '../qiankun';
import { bazhai } from '../bazhai';
import { jinsuo } from '../jinsuo';
import { fuxing } from '../fuxing';
import { jingyin } from '../jingyin';
import { dagua } from '../dagua';
import { xingshi } from '../xingshi';
import { yearGods, dayCourse, zaoMing } from '../zeri';
import { xuankongLiufa } from '../xuankongLiufa';
import { mingli } from '../mingli';
import { SHAN_ORDER, SANHE_XIANGFA_LIST, TIXING_VARIANTS, XUANKONG_SCHOOLS, DINGXUE_9, DAOZHANG_12, XINGSHI_9STAR, SHUICHENG_5, XUE_4TYPE } from '../fengshuiData';

const J = (o)=>JSON.stringify(o);
const GUA8 = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];
const noNaN = (o)=>!/NaN|Infinity/.test(J(o));

// 单一变量法：固定其余入参，只动 key，收集不同输出的种数。
function variance(fn, base, key, values) {
	const set = new Set();
	values.forEach((v)=>{ set.add(J(fn({ ...base, [key]: v }))); });
	return set.size;
}

describe('穷举 · 玄空飞星（10 选项）', ()=>{
	const B = { year: 2026, month: 5 };
	const call = (o)=>xuankong(o.yun !== undefined ? o.yun : 9, o.xiangShan || '午', o);
	it('每个选项独立变动都改变输出（无死开关）', ()=>{
		expect(variance((o)=>call(o), B, 'yun', [1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(9);
		expect(variance((o)=>call(o), B, 'xiangShan', SHAN_ORDER)).toBeGreaterThan(1);
		expect(variance((o)=>call(o), B, 'deg', ['', 176, 199.7, 345.5])).toBeGreaterThan(1);
		expect(variance((o)=>call(o), B, 'jian', [false, true])).toBe(2);
		expect(variance((o)=>call({ ...o, jian: true }), B, 'tiVariant', TIXING_VARIANTS.map((t)=>t.value))).toBeGreaterThan(1);
		expect(variance((o)=>call({ ...o, deg: 176 }), B, 'jianBoundary', [3, 4.5, 6])).toBeGreaterThan(1);
		expect(variance((o)=>call({ ...o, yun: 5 }), B, 'wuHuangSplit', ['xiagua', 'liangyuan'])).toBe(2);
		expect(variance((o)=>call(o), B, 'yinYangZhai', ['yang', 'yin'])).toBe(2);
		expect(variance((o)=>call(o), B, 'school', XUANKONG_SCHOOLS.map((s)=>s.key))).toBe(4);
		expect(variance((o)=>call(o), B, 'year', [1984, 2026, 2043])).toBe(3);
		expect(variance((o)=>call(o), B, 'month', [0, 5, 12])).toBe(3);
	});
	it('9运×24山×2起卦×3替星×3度界×2分运×4门派 组合不炸、盘面合法', ()=>{
		let n = 0;
		for (let yun = 1; yun <= 9; yun++) {
			SHAN_ORDER.forEach((s, i)=>{
				if ((i + yun) % 4) { return; }   // 抽样步进，仍覆盖全部山与全部运
				[false, true].forEach((jian)=>{
					TIXING_VARIANTS.forEach((tv)=>{
						[3, 4.5, 6].forEach((jb)=>{
							['xiagua', 'liangyuan'].forEach((wh)=>{
								XUANKONG_SCHOOLS.forEach((sc)=>{
									const r = xuankong(yun, s, { year: 2026, month: 7, jian, tiVariant: tv.value, jianBoundary: jb, wuHuangSplit: wh, school: sc.key, deg: 176 });
									expect(r.available).toBe(true);
									expect(noNaN(r)).toBe(true);
									[1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((g)=>{
										[r.yunPan[g], r.shanPan[g], r.xiangPan[g]].forEach((v)=>{ expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(9); });
									});
									n++;
								});
							});
						});
					});
				});
			});
		}
		expect(n).toBeGreaterThan(500);
	});
	it('边界/冲突：非法运、非法山、非法度、非法度界、五运+两元八运+替卦 同开', ()=>{
		// 🔴 非法元运必须整盘拒绝：此前只守山不守运 → 算出 0/−1 越界星值，非数入参更直接抛异常。
		[0, 10, -1, 5.5, 'abc', '', null, undefined, NaN, {}, []].forEach((y)=>{
			expect(()=>xuankong(y, '午')).not.toThrow();
			expect(xuankong(y, '午').available).toBe(false);
			expect(()=>xuankong(y, '午', { jian: true })).not.toThrow();
			expect(xuankong(y, '午', { jian: true }).available).toBe(false);
		});
		// 合法运 1-9 一律成盘、星值全在 1-9
		for (let y = 1; y <= 9; y++) {
			const r = xuankong(y, '午');
			expect(r.available).toBe(true);
			[1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((g)=>{
				[r.yunPan[g], r.shanPan[g], r.xiangPan[g]].forEach((v)=>{
					expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(9);
				});
			});
		}
		expect(xuankong(9, '不存在').available).toBe(false);
		[-1, 0, 360, 720, 'abc', '', null, undefined, NaN].forEach((d)=>{
			const r = xuankong(9, '午', { deg: d });
			expect(r.available).toBe(true);
			expect(noNaN(r)).toBe(true);
		});
		[0, -3, 99, 'x', null].forEach((b)=>{ expect(xuankong(9, '午', { deg: 176, jianBoundary: b }).jianBoundary).toBe(3); });
		const conflict = xuankong(5, '午', { jian: true, tiVariant: 'bengong', jianBoundary: 6, wuHuangSplit: 'liangyuan', school: 'zhongzhou', deg: 186, year: -500, month: 99 });
		expect(conflict.available).toBe(true);
		expect(noNaN(conflict)).toBe(true);
	});
});

describe('穷举 · 三合（5 选项 + 八方砂）', ()=>{
	const MUKU = ['辛', '戌', '乾', '癸', '丑', '艮', '乙', '辰', '巽', '丁', '未', '坤'];
	it('🔴 水势必须真生效——立向法留空(按水势自动)时左右水各定其向', ()=>{
		// 这是曾经的死开关：UI 若恒传显式 xiangFaType，waterFlow 永远被覆盖。
		const l = sanhe({ shuiKou: '戌', waterFlow: 'leftToRight', xiangFaType: '' });
		const r = sanhe({ shuiKou: '戌', waterFlow: 'rightToLeft', xiangFaType: '' });
		expect(l.xiangFa.type).toBe('正旺向');
		expect(r.xiangFa.type).toBe('正生向');
		expect(J(l)).not.toBe(J(r));
		// 显式指定则覆盖水势（此乃设计正解）
		const a = sanhe({ shuiKou: '戌', waterFlow: 'leftToRight', xiangFaType: '正墓向' });
		const b = sanhe({ shuiKou: '戌', waterFlow: 'rightToLeft', xiangFaType: '正墓向' });
		expect(J(a)).toBe(J(b));
		expect(a.xiangFa.type).toBe('正墓向');
		// 零回归：旧的写死初值 '正旺向' ≡ 新的 ''+默认左水倒右
		expect(J(sanhe({ shuiKou: '戌', waterFlow: 'leftToRight', xiangFaType: '正旺向' })))
			.toBe(J(sanhe({ shuiKou: '戌', waterFlow: 'leftToRight', xiangFaType: '' })));
	});
	it('每选项独立变动都改变输出', ()=>{
		const B = { shuiKou: '戌', waterFlow: 'leftToRight', xiangFaType: '', zuoDeg: '', sands: {} };
		expect(variance(sanhe, B, 'shuiKou', MUKU)).toBeGreaterThan(1);
		expect(variance(sanhe, B, 'waterFlow', ['leftToRight', 'rightToLeft'])).toBe(2);
		expect(variance(sanhe, B, 'xiangFaType', ['', ...SANHE_XIANGFA_LIST])).toBe(1 + SANHE_XIANGFA_LIST.length - 1);
		expect(variance(sanhe, B, 'zuoDeg', ['', 0, 120, 345.5])).toBe(4);
		expect(variance(sanhe, B, 'sands', [{}, { 坎: 'sand' }, { 坎: 'water' }, { 坎: 'sand', 离: 'sand' }])).toBeGreaterThan(1);
		// 消砂取「我」：须在有砂时才见差别（无砂时两档都无 wuGe 条目）
		const withSand = { ...B, sands: { 坎: 'sand', 离: 'sand', 震: 'sand' } };
		expect(J(sanhe({ ...withSand, boshaVariant: 'shuangshan' }))).not.toBe(J(sanhe({ ...withSand, boshaVariant: 'zuo' })));
	});
	it('12 墓库山 × 2 水势 × 9 立向法 × 3 坐度 × 消砂两档 组合不炸', ()=>{
		let n = 0;
		MUKU.forEach((sk)=>{
			['leftToRight', 'rightToLeft'].forEach((wf)=>{
				['', ...SANHE_XIANGFA_LIST].forEach((xf)=>{
					['', 0, 345.5].forEach((zd)=>{
						['shuangshan', 'zuo'].forEach((bv)=>{
							const r = sanhe({ shuiKou: sk, waterFlow: wf, xiangFaType: xf, zuoDeg: zd, boshaVariant: bv, sands: { 坎: 'sand', 兑: 'water' } });
							expect(noNaN(r)).toBe(true);
							expect(r.ring.length).toBe(12);
							n++;
						});
					});
				});
			});
		});
		expect(n).toBe(12 * 2 * 9 * 3 * 2);
	});
	it('边界：非墓库山不定局、空水口、坐度越界', ()=>{
		expect(sanhe({ shuiKou: '子' }).ju).toBeNull();
		expect(noNaN(sanhe({}))).toBe(true);
		[-90, 361, 1080, 'abc', null].forEach((d)=>{ expect(noNaN(sanhe({ shuiKou: '戌', zuoDeg: d }))).toBe(true); });
	});
});

describe('穷举 · 八宅 / 乾坤国宝 / 金锁玉关 / 辅星 / 净阴净阳', ()=>{
	it('八宅：8坐山×男女×进深4×三要全组合(含只设一两个) 不炸；三要齐备才出 sanYao', ()=>{
		let n = 0;
		GUA8.forEach((z)=>{
			[true, false].forEach((male)=>{
				['jing', 'dong', 'bian', 'hua'].forEach((zt)=>{
					['zhai', 'ming'].forEach((mode)=>{
						const base = { zuoGua: z, ming: { year: 1990, isMale: male }, mode, zhaiType: zt };
						expect(noNaN(bazhai(base))).toBe(true);
						expect(bazhai(base).sanYao).toBeFalsy();
						expect(bazhai({ ...base, doorGua: '乾' }).sanYao).toBeFalsy();
						expect(bazhai({ ...base, doorGua: '乾', mainGua: '坎' }).sanYao).toBeFalsy();
						expect(bazhai({ ...base, doorGua: '乾', mainGua: '坎', stoveGua: '离' }).sanYao).toBeTruthy();
						n++;
					});
				});
			});
		});
		expect(n).toBe(8 * 2 * 4 * 2);
		// 三要三键各自独立生效（固定另两键）
		const B = { zuoGua: '坎', ming: { year: 1990, isMale: true }, mainGua: '坎', stoveGua: '离' };
		expect(variance(bazhai, B, 'doorGua', GUA8)).toBeGreaterThan(1);
		expect(variance(bazhai, { ...B, doorGua: '乾', mainGua: undefined }, 'mainGua', GUA8)).toBeGreaterThan(1);
		expect(variance(bazhai, { zuoGua: '坎', ming: { year: 1990, isMale: true }, doorGua: '乾', mainGua: '坎' }, 'stoveGua', GUA8)).toBeGreaterThan(1);
		expect(bazhai({ zuoGua: '中' }).available).toBe(false);
	});
	it('乾坤国宝：8坐山 × 九水位各 3 态 逐位独立生效', ()=>{
		const KEYS = ['xianTian', 'houTian', 'anJie', 'tianJie', 'diXing', 'bin', 'ke', 'fu', 'zhengQiao'];
		KEYS.forEach((k)=>{
			const set = new Set(['', 'come', 'go'].map((v)=>J(qiankun({ zuoGua: '坎', waters: { [k]: v } }))));
			expect(set.size).toBeGreaterThan(1);
		});
		GUA8.forEach((z)=>{
			const all = {}; KEYS.forEach((k, i)=>{ all[k] = ['', 'come', 'go'][i % 3]; });
			expect(noNaN(qiankun({ zuoGua: z, waters: all }))).toBe(true);
			expect(qiankun({ zuoGua: z }).positions.length).toBe(9);
		});
	});
	it('金锁玉关：八方各 3 态逐方独立生效 + 元运/流年独立生效 + 256 组合不炸', ()=>{
		GUA8.forEach((g)=>{
			const set = new Set(['sand', 'water', 'flat'].map((v)=>J(jinsuo({ sectors: { [g]: v }, yun: 9, year: 2026 }))));
			expect(set.size).toBe(3);
		});
		const S = { 坎: 'sand', 坤: 'sand', 震: 'sand', 巽: 'sand', 乾: 'water', 兑: 'water', 艮: 'water', 离: 'water' };
		expect(variance((o)=>jinsuo(o), { sectors: S, year: 2026 }, 'yun', [1, 2, 3, 4, 5, 6, 7, 8, 9]).valueOf()).toBeGreaterThan(1);
		expect(variance((o)=>jinsuo(o), { sectors: S, yun: 9 }, 'year', [1984, 2026, 2043])).toBe(3);
		for (let mask = 0; mask < 256; mask++) {
			const sectors = {}; GUA8.forEach((g, i)=>{ sectors[g] = (mask >> i) & 1 ? 'sand' : 'water'; });
			const r = jinsuo({ sectors, yun: 9, year: 2026 });
			expect(r.palaces.length).toBe(8);
			expect(noNaN(r)).toBe(true);
		}
	});
	it('辅星水法：本卦 8 × 起卦来源 3 × 八方来去水 逐项独立生效', ()=>{
		expect(variance(fuxing, { qiFrom: 'xiang', waters: {} }, 'benGua', GUA8)).toBe(8);
		expect(variance(fuxing, { benGua: '坎', waters: {} }, 'qiFrom', ['xiang', 'zuo', 'shuikou'])).toBeGreaterThan(1);
		GUA8.forEach((g)=>{
			const set = new Set(['', 'come', 'go'].map((v)=>J(fuxing({ benGua: '坎', waters: { [g]: v } }))));
			expect(set.size).toBe(3);
		});
	});
	it('净阴净阳：龙/向/水 三键各自独立生效，24×24×24 抽样不炸', ()=>{
		expect(variance(jingyin, { xiang: '甲', water: '坤' }, 'long', SHAN_ORDER)).toBeGreaterThan(1);
		expect(variance(jingyin, { long: '乾', water: '坤' }, 'xiang', SHAN_ORDER)).toBeGreaterThan(1);
		expect(variance(jingyin, { long: '乾', xiang: '甲' }, 'water', SHAN_ORDER)).toBeGreaterThan(1);
		SHAN_ORDER.forEach((a, i)=>{ const r = jingyin({ long: a, xiang: SHAN_ORDER[(i + 7) % 24], water: SHAN_ORDER[(i + 13) % 24] }); expect(noNaN(r)).toBe(true); });
	});
});

describe('穷举 · 紫白 / 大卦 / 形势 / 择日 / 六法 / 命理', ()=>{
	it('紫白：年/月/日/时四层逐项独立生效 + 1864-2043 全年不炸', ()=>{
		expect(variance(zibai, {}, 'year', [1900, 1990, 2026, 2043])).toBe(4);
		expect(variance(zibai, { year: 2026 }, 'month', [undefined, 1, 6, 12])).toBe(4);
		const d = (m, dd, h)=>({ y: 2026, m, d: dd, hour: h });
		expect(new Set([d(3, 20, undefined), d(3, 21, undefined), d(4, 20, undefined)].map((x)=>J(zibai({ year: 2026, date: x })))).size).toBe(3);
		expect(new Set([0, 6, 13, 23].map((h)=>J(zibai({ year: 2026, date: d(3, 20, h) })))).size).toBeGreaterThan(1);
		for (let y = 1864; y <= 2043; y++) { expect(noNaN(zibai({ year: y }))).toBe(true); }
	});
	it('大卦：上下卦各 8 × 元运 9 × 卦运方案 2 × 度数 逐项独立生效', ()=>{
		expect(variance(dagua, { xiangUpper: '乾', yun: 9 }, 'xiangLower', GUA8)).toBe(8);
		expect(variance(dagua, { xiangLower: '乾', yun: 9 }, 'xiangUpper', GUA8)).toBe(8);
		expect(variance(dagua, { xiangLower: '乾', xiangUpper: '乾' }, 'yun', [1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(9);
		expect(variance(dagua, { xiangLower: '乾', xiangUpper: '乾', yun: 9 }, 'deg', ['', 0, 90, 199.7, 345.5])).toBeGreaterThan(1);
		expect(J(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, yunScheme: 'input', xiangYunInput: 3, zuoYunInput: 7 })))
			.not.toBe(J(dagua({ xiangLower: '乾', xiangUpper: '乾', yun: 9, yunScheme: 'struct' })));
		GUA8.forEach((a)=>GUA8.forEach((b)=>{ expect(noNaN(dagua({ xiangLower: a, xiangUpper: b, yun: 5 }))).toBe(true); }));
	});
	it('形势：18 个判定项逐项独立影响评分', ()=>{
		const B = { longSheng: true, longStar: '', boHuan: false, guoXiaGood: false, xueType: '', dingXue: '', zhengXue: [], daoZhang: '', shaYouQing: null, guiSha: [], xiongSha: [], shuiCheng: '', laiShuiKai: false, quShuiGuan: false, xiangChaoJi: false, xiangChongSha: false };
		expect(variance(xingshi, B, 'longSheng', [true, false])).toBe(2);
		expect(variance(xingshi, B, 'longStar', ['', ...XINGSHI_9STAR.map((s)=>s.name)])).toBeGreaterThan(2);
		expect(variance(xingshi, B, 'boHuan', [false, true])).toBe(2);
		expect(variance(xingshi, B, 'guoXiaGood', [false, true])).toBe(2);
		// 穴形/定穴：分值同权（各 +1），但选中项回显在 xue.type / xue.dingXue → 每个取值都应是不同输出
		expect(variance(xingshi, B, 'xueType', ['', ...XUE_4TYPE.map((x)=>x.name)])).toBe(1 + XUE_4TYPE.length);
		expect(variance(xingshi, B, 'dingXue', ['', ...DINGXUE_9])).toBe(1 + DINGXUE_9.length);
		expect(xingshi({ ...B, xueType: '窝穴' }).xue.score).toBe(xingshi({ ...B, xueType: '突穴' }).xue.score);
		expect(variance(xingshi, B, 'daoZhang', ['', ...DAOZHANG_12.map((d)=>d.name)])).toBeGreaterThan(1);
		expect(variance(xingshi, B, 'zhengXue', [[], ['朝山证'], ['朝山证', '龙虎证'], ['朝山证', '龙虎证', '明堂证']])).toBe(4);
		expect(variance(xingshi, B, 'shaYouQing', [null, true, false])).toBe(3);
		expect(variance(xingshi, B, 'guiSha', [[], ['贵砂']])).toBe(2);
		expect(variance(xingshi, B, 'xiongSha', [[], ['凶砂']])).toBe(2);
		expect(variance(xingshi, B, 'shuiCheng', ['', ...SHUICHENG_5.map((s)=>s.name)])).toBeGreaterThan(2);
		['laiShuiKai', 'quShuiGuan', 'xiangChaoJi', 'xiangChongSha'].forEach((k)=>{ expect(variance(xingshi, B, k, [false, true])).toBe(2); });
	});
	it('择日：流年/坐山/来龙/主命/月日 逐项独立生效 + 全年份不炸', ()=>{
		const B = { zuoShan: '子', y: 2026, m: 3, d: 20 };
		expect(variance(zaoMing, B, 'zuoShan', SHAN_ORDER)).toBeGreaterThan(1);
		expect(variance(zaoMing, B, 'laiLong', [undefined, ...SHAN_ORDER])).toBeGreaterThan(1);
		expect(variance(zaoMing, B, 'zhuMing', [undefined, { year: 1975, isMale: true }, { year: 1990, isMale: true }, { year: 1990, isMale: false }])).toBeGreaterThan(2);
		expect(variance(zaoMing, B, 'm', [1, 6, 12])).toBe(3);
		expect(variance(zaoMing, B, 'd', [1, 15, 28])).toBe(3);
		expect(new Set([2024, 2025, 2026].map((y)=>J(yearGods(y)))).size).toBe(3);
		for (let y = 1900; y <= 2100; y += 7) { expect(noNaN(yearGods(y))).toBe(true); }
		[[2026, 2, 28], [2024, 2, 29], [2026, 12, 31], [2026, 1, 1]].forEach(([y, m, d])=>{ expect(noNaN(dayCourse(y, m, d))).toBe(true); });
	});
	it('六法：元运/坐山/向首/流年 逐项独立生效', ()=>{
		const B = { yun: 9, zuoShan: '子', xiangShan: '午', year: 2026 };
		expect(variance(xuankongLiufa, B, 'yun', [1, 2, 3, 4, 5, 6, 7, 8, 9])).toBeGreaterThan(4);
		expect(variance(xuankongLiufa, B, 'zuoShan', SHAN_ORDER)).toBeGreaterThan(1);
		expect(variance(xuankongLiufa, B, 'xiangShan', SHAN_ORDER)).toBeGreaterThan(1);
		expect(variance(xuankongLiufa, B, 'year', [2024, 2025, 2026])).toBe(3);
	});
	it('命理派：命年/性别/宅坐卦 逐项独立生效', ()=>{
		const B = { mingYear: 1990, isMale: true, zhaiZuoGua: '坎' };
		expect(variance(mingli, B, 'mingYear', [1975, 1985, 1990, 2000])).toBeGreaterThan(2);
		expect(variance(mingli, B, 'isMale', [true, false])).toBe(2);
		expect(variance(mingli, B, 'zhaiZuoGua', GUA8)).toBe(8);
	});
});

describe('跨派冲突/极端组合 不炸', ()=>{
	it('全极值同开', ()=>{
		const cases = [
			()=>xuankong(5, '壬', { deg: 337.5, jian: true, tiVariant: 'bengong', jianBoundary: 6, wuHuangSplit: 'liangyuan', school: 'zhongzhou', year: 1864, month: 12, yinYangZhai: 'yin' }),
			()=>sanhe({ shuiKou: '坤', waterFlow: 'rightToLeft', xiangFaType: '沐浴向', zuoDeg: 359.99, boshaVariant: 'zuo', sands: { 坎: 'sand', 坤: 'sand', 震: 'sand', 巽: 'sand', 乾: 'sand', 兑: 'sand', 艮: 'sand', 离: 'sand' } }),
			()=>bazhai({ zuoGua: '离', ming: { year: 2043, isMale: false }, mode: 'ming', zhaiType: 'hua', doorGua: '离', mainGua: '离', stoveGua: '离' }),
			()=>jinsuo({ sectors: { 坎: 'water', 坤: 'water', 震: 'water', 巽: 'water', 乾: 'sand', 兑: 'sand', 艮: 'sand', 离: 'sand' }, yun: 5, year: 1864 }),
			()=>qiankun({ zuoGua: '兑', waters: { xianTian: 'go', houTian: 'go', anJie: 'come', tianJie: 'come', diXing: 'come', bin: 'go', ke: 'go', fu: 'come', zhengQiao: 'come' } }),
			()=>dagua({ yun: 5, deg: 359.9999, yunScheme: 'input', xiangYunInput: 9, zuoYunInput: 1 }),
			()=>xingshi({ longSheng: false, longStar: '破军', boHuan: false, guoXiaGood: false, xueType: '窝穴', dingXue: '界水（合襟）定穴', daoZhang: '犯杖', zhengXue: ['朝山证', '龙虎证', '明堂证'], shaYouQing: false, guiSha: ['贵砂'], xiongSha: ['凶砂'], shuiCheng: '火城', laiShuiKai: false, quShuiGuan: false, xiangChaoJi: false, xiangChongSha: true }),
			()=>zaoMing({ zuoShan: '午', y: 1900, m: 2, d: 29, laiLong: '子', zhuMing: { year: 1900, isMale: false } }),
			()=>xuankongLiufa({ yun: 5, zuoShan: '壬', xiangShan: '壬', year: 1864 }),
			()=>mingli({ mingYear: 2100, isMale: false, zhaiZuoGua: '坤' }),
			()=>fuxing({ benGua: '坤', qiFrom: 'shuikou', waters: { 坎: 'come', 坤: 'go', 震: 'come', 巽: 'go', 乾: 'come', 兑: 'go', 艮: 'come', 离: 'go' } }),
			()=>jingyin({ long: '壬', xiang: '壬', water: '壬' }),
			()=>zibai({ year: 1864, month: 12, date: { y: 1864, m: 12, d: 31, hour: 23 } }),
		];
		cases.forEach((f, i)=>{ const r = f(); expect(noNaN(r)).toBe(true); expect(r).toBeTruthy(); expect(i).toBeGreaterThanOrEqual(0); });
	});
	it('空/脏入参一律不抛', ()=>{
		const dirty = [undefined, null, '', 0, NaN, -1, 'abc', {}, []];
		dirty.forEach((v)=>{
			expect(()=>xuankong(v, v, { deg: v, jianBoundary: v, wuHuangSplit: v, school: v, year: v, month: v })).not.toThrow();
			expect(()=>sanhe({ shuiKou: v, waterFlow: v, xiangFaType: v, zuoDeg: v, sands: {}, boshaVariant: v })).not.toThrow();
			expect(()=>bazhai({ zuoGua: v, ming: { year: v, isMale: v } })).not.toThrow();
			expect(()=>jinsuo({ sectors: {}, yun: v, year: v })).not.toThrow();
			expect(()=>qiankun({ zuoGua: v, waters: {} })).not.toThrow();
			expect(()=>dagua({ xiangLower: v, xiangUpper: v, yun: v, deg: v })).not.toThrow();
			expect(()=>xingshi({ longStar: v, xueType: v, dingXue: v, shuiCheng: v })).not.toThrow();
			expect(()=>xuankongLiufa({ yun: v, zuoShan: v, xiangShan: v, year: v })).not.toThrow();
			expect(()=>mingli({ mingYear: v, isMale: v, zhaiZuoGua: v })).not.toThrow();
			expect(()=>fuxing({ benGua: v, qiFrom: v, waters: {} })).not.toThrow();
			expect(()=>jingyin({ long: v, xiang: v, water: v })).not.toThrow();
			expect(()=>zibai({ year: v, month: v })).not.toThrow();
		});
	});
});
