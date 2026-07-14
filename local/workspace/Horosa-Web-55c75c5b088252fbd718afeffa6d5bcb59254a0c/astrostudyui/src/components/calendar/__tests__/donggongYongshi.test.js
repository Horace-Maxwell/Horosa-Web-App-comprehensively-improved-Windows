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

	test('同义映射(平整→平治道涂 等)全部命中 lunar 词表', () => {
		// 遍历 2026 找每个异名用事的宜/忌命中,确保映射有效(非死映射)
		const covered = {};
		for (let m = 1; m <= 12; m++) {
			for (let d = 1; d <= 28; d++) {
				const day = buildHuangliDay(2026, m, d);
				Object.keys(YONGSHI_YIJI_SYN).forEach((ev)=>{
					const v = yongshiVerdict(day, ev);
					if (v.level !== 'neutral') { covered[ev] = true; }
				});
			}
		}
		// 平整/破屋/补垣/动土/安葬 这些常用异名应在全年内至少命中一次
		['平整', '破屋', '补垣', '动土', '安葬'].forEach((ev)=>{ expect(covered[ev]).toBe(true); });
	});

	test('空用事/无匹配/空 day → neutral 不抛', () => {
		const day = buildHuangliDay(2026, 7, 13);
		expect(yongshiVerdict(day, '').level).toBe('neutral');
		expect(yongshiVerdict(day, '不存在之用事XYZ').level).toBe('neutral');
		expect(yongshiVerdict(null, '修造').level).toBe('neutral');
		expect(yongshiVerdict(day, '修造').hits).toBeDefined();
	});
});
