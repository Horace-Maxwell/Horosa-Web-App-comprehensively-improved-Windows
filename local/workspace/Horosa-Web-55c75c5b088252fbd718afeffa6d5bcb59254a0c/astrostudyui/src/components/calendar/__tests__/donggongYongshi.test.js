// 董公「用事」真值驱动守卫：修复「选择用事后中/右栏永远没反应」。
// 病根曾是 DonggongDetail 仅在 event 字面出现于董公断语 text 时才高亮 → 多数用事词不在断语中=永远无反应。
// 修为以当日通书宜/忌(lunar 权威)判用事宜/忌;此守卫锁死其「真会因用事变化」。
import { buildHuangliDay } from '../huangliDay';
import { yongshiVerdict, YONGSHI_YIJI_SYN } from '../tongshuData';

describe('董公用事 yongshiVerdict · 真值驱动(非永远无反应)', () => {
	test('常见用事「修造」全年有宜有忌(选择真生效)', () => {
		let yi = 0; let ji = 0;
		for (let m = 1; m <= 12; m++) {
			for (let d = 1; d <= 28; d++) {
				const v = yongshiVerdict(buildHuangliDay(2026, m, d), '修造');
				if (v.level === 'yi') { yi++; }
				if (v.level === 'ji') { ji++; }
			}
		}
		expect(yi).toBeGreaterThan(10);
		expect(ji).toBeGreaterThan(0);
	});

	test('不同用事产生不同宜忌分布(嫁娶≠安葬≠修造)', () => {
		const dist = (ev)=>{
			let yi = 0;
			for (let m = 1; m <= 12; m++) { for (let d = 1; d <= 28; d++) { if (yongshiVerdict(buildHuangliDay(2026, m, d), ev).level === 'yi') { yi++; } } }
			return yi;
		};
		const marry = dist('嫁娶'); const bury = dist('安葬'); const build = dist('修造');
		// 三者宜日数彼此不同 → 证明用事真参与判定,非恒定
		expect(new Set([marry, bury, build]).size).toBeGreaterThanOrEqual(2);
		expect(marry).toBeGreaterThan(0);
	});

	const daysInMonth = (y, m)=> new Date(y, m, 0).getDate();

	test('同义映射全表逐键命中 lunar 词表(全年扫描,零死映射)', () => {
		// 🔴 白名单必须 = Object.keys(YONGSHI_YIJI_SYN) 全集:曾只锁 5 个老键,
		// 为修「恒无明确宜忌」新加的 立契/造舟船/设醮/迁徙 四条映射反而零守卫
		// (映射错一个字就退回恒 neutral,不红)。扫描域也须全年整月(28 日截断漏 29-31)。
		const covered = {};
		for (let m = 1; m <= 12; m++) {
			for (let d = 1; d <= daysInMonth(2026, m); d++) {
				const day = buildHuangliDay(2026, m, d);
				Object.keys(YONGSHI_YIJI_SYN).forEach((ev)=>{
					const v = yongshiVerdict(day, ev);
					if (v.level !== 'neutral') { covered[ev] = true; }
				});
			}
		}
		Object.keys(YONGSHI_YIJI_SYN).forEach((ev)=>{ expect({ ev, hit: !!covered[ev] }).toEqual({ ev, hit: true }); });
	});

	test('🔴 P0 不变量:通书忌安葬之日绝不渲染宜(全年 2026,非空扫描)', () => {
		// 病灶史:破土/成服/除服 曾被收进安葬同义 + 宜优先 → 135/1800 组合「忌安葬」显示「宜安葬」。
		// 本守卫直接锁用户可见不变量:凡 lunar 忌栏含安葬,verdict 恒非 yi(实测 2026 有 150 天,断言>100 防空转)。
		let jiDays = 0;
		for (let m = 1; m <= 12; m++) {
			for (let d = 1; d <= daysInMonth(2026, m); d++) {
				const day = buildHuangliDay(2026, m, d);
				if ((day.ji || []).includes('安葬')) {
					jiDays++;
					expect(yongshiVerdict(day, '安葬').level).not.toBe('yi');
				}
			}
		}
		expect(jiDays).toBeGreaterThan(100);
	});

	test('🔴 同义表铁律锁:安葬组只收真同名(收「相关不同」即红)', () => {
		expect(YONGSHI_YIJI_SYN['安葬']).toEqual(['安葬']);
		expect(YONGSHI_YIJI_SYN['启攒']).toEqual(['启钻']);
	});

	test('conflict 语义:同义组一宜一忌 → 判冲突凶不被吃(合成日+全年可达)', () => {
		// 合成日直锁纯函数语义:立向组 竖柱∈宜 + 修造∈忌 → conflict 且两侧命中都在 hits。
		const v = yongshiVerdict({ yi: ['竖柱'], ji: ['修造'] }, '立向');
		expect(v.level).toBe('conflict');
		expect(v.hits).toEqual(expect.arrayContaining(['竖柱', '修造']));
		expect(yongshiVerdict({ yi: [], ji: ['修造'] }, '立向').level).toBe('ji');
		// 真实数据可达性:2026 全年至少出现一次 conflict(实测 10 次)。
		let conflicts = 0;
		for (let m = 1; m <= 12; m++) {
			for (let d = 1; d <= daysInMonth(2026, m); d++) {
				const day = buildHuangliDay(2026, m, d);
				Object.keys(YONGSHI_YIJI_SYN).forEach((ev)=>{
					if (yongshiVerdict(day, ev).level === 'conflict') { conflicts++; }
				});
			}
		}
		expect(conflicts).toBeGreaterThan(0);
	});

	test('空用事/无匹配/空 day → neutral 不抛', () => {
		const day = buildHuangliDay(2026, 7, 13);
		expect(yongshiVerdict(day, '').level).toBe('neutral');
		expect(yongshiVerdict(day, '不存在之用事XYZ').level).toBe('neutral');
		expect(yongshiVerdict(null, '修造').level).toBe('neutral');
		expect(yongshiVerdict(day, '修造').hits).toBeDefined();
	});
});
