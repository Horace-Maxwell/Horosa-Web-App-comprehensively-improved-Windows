// 演法 AI 快照:含起禽四禽/择日/占卜/投胎 + 流派;随 store 流派变化(供 AI 挂载/导出)。
import { buildYanqinYanfaSnapshot } from '../yanqinSnapshot';
import { setYanqinSchool } from '../yanqinStore';

describe('演法 AI 快照', () => {
	test('含 流派/起禽/择日/占卜/投胎 五段 + 具体禽名', () => {
		setYanqinSchool('chibenli');
		const snap = buildYanqinYanfaSnapshot({ year: 2008, month: 1, day: 1, hour: 12 });
		['[演法·流派]', '[演法·起禽]', '[演法·择日]', '[演法·占卜]', '[演法·投胎]'].forEach((h) => expect(snap).toContain(h));
		expect(snap).toContain('日禽');
		expect(snap).toContain('翻禽');
	});
	test('随流派变化:池本理(翻禽=我) vs 凤凰(时禽=我) → 占卜段我彼不同', () => {
		setYanqinSchool('chibenli');
		const a = buildYanqinYanfaSnapshot({ year: 2008, month: 1, day: 1, hour: 12 });
		setYanqinSchool('fenghuang');
		const b = buildYanqinYanfaSnapshot({ year: 2008, month: 1, day: 1, hour: 12 });
		setYanqinSchool('chibenli'); // 复位
		const lineA = a.split('\n').find((l) => l.indexOf('[演法·占卜]') === 0);
		const lineB = b.split('\n').find((l) => l.indexOf('[演法·占卜]') === 0);
		expect(lineA).not.toBe(lineB); // 我彼反转 → 占卜段不同
	});
	test('边界:空/非法 payload 不抛、返空串', () => {
		expect(buildYanqinYanfaSnapshot(null)).toBe('');
		expect(buildYanqinYanfaSnapshot({})).toBe('');
		expect(() => buildYanqinYanfaSnapshot({ year: 2008, month: 1, day: 1, hour: 25 })).not.toThrow();
	});

	// 🔴 全年份域:BC(负年,无 0 年)演法快照必生成(旧 `year > 0` 吞成空);农历月经调用方注入
	// payload.lunarMonth(远程桥权威,lunar-js 域外静默错),投胎段取注入月而非公历月。
	test('🔴 BC 演法快照生成 + 用注入的桥农历月(月禽/投胎)', () => {
		setYanqinSchool('chibenli');
		// BC12026-07-20:公历月 7,桥权威农历月 3(三月)。注入 lunarMonth=3。
		const snap = buildYanqinYanfaSnapshot({ year: -12026, month: 7, day: 20, hour: 12, lunarMonth: 3 });
		expect(snap).not.toBe('');                       // 不再被 year>0 吞空
		['[演法·流派]', '[演法·起禽]', '[演法·择日]', '[演法·占卜]', '[演法·投胎]'].forEach((h) => expect(snap).toContain(h));
		expect(snap).toContain('日禽');                  // 日禽走 dayNumber(JDN)BC 安全
		expect(snap).toContain('农历3月');               // 投胎段=注入的桥农历月(三月),非公历 7 月
		expect(snap).not.toContain('农历7月');
	});

	test('BC 未注入桥月:退公历月兜底、绝不抛/空', () => {
		setYanqinSchool('chibenli');
		const snap = buildYanqinYanfaSnapshot({ year: -12026, month: 7, day: 20, hour: 12 }); // 无 lunarMonth
		expect(snap).not.toBe('');
		expect(snap).toContain('[演法·投胎]');
	});
});
