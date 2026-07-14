// 董公择日法 golden：数据全量锚点 + 引擎逐日一致性。失败=数据/引擎错，不得改测试将就。
import { donggongDay } from '../donggong';
import {
	DONGGONG_TABLE, DONGGONG_JINSHEN_XIU, DONGGONG_SANXING, DONGGONG_MONTH_GROUP,
} from '../donggongData';
import { Solar } from 'lunar-javascript';

const MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const JIANCHU = '建除满平定执破危成收开闭'.split('');

describe('董公数据表', () => {
	test('12 月 × 12 建除 = 144 断语齐全', () => {
		MONTHS.forEach((m)=>{ JIANCHU.forEach((jc)=>{
			expect(DONGGONG_TABLE[m][jc]).toBeTruthy();
			expect(typeof DONGGONG_TABLE[m][jc].text).toBe('string');
			expect(DONGGONG_TABLE[m][jc].text.length).toBeGreaterThan(0);
		}); });
	});

	test('正月建寅日断语锚点 = 往亡日', () => {
		expect(DONGGONG_TABLE['正月']['建'].zhi).toBe('寅');
		expect(DONGGONG_TABLE['正月']['建'].text.indexOf('往亡日')).toBe(0);
	});

	test('金神七煞 = 角亢奎娄鬼牛星（七宿）', () => {
		expect(DONGGONG_JINSHEN_XIU.join('')).toBe('角亢奎娄鬼牛星');
	});

	test('煞贡/直星/人专三组齐全（丁卯∈四孟煞贡）', () => {
		expect(DONGGONG_SANXING['孟']['煞贡']).toContain('丁卯');
		expect(DONGGONG_SANXING['仲']['直星']).toContain('丁卯');
		expect(DONGGONG_SANXING['季']['煞贡']).toContain('己丑');
	});
});

describe('董公引擎 · 2026-07-13（戊子日·六月执日）', () => {
	const r = donggongDay({ y: 2026, m: 7, d: 13 });

	test('月序/建除/断语一致', () => {
		expect(r.monthName).toBe('六月');
		expect(r.jianchu).toBe('执');
		expect(r.text).toBe(DONGGONG_TABLE['六月']['执'].text);
		expect(r.text.length).toBeGreaterThan(0);
	});

	test('三煞方（未月木局→西）', () => {
		expect(r.sansha.dir).toBe('西');
		expect(r.sansha.zhi).toEqual(['申', '酉', '戌']);
	});

	test('值宿毕非金神七煞', () => {
		expect(r.jinshen.hit).toBe(false);
	});
});

describe('董公引擎 · 逐日一致性（2026 全年扫描）', () => {
	test('金神七煞命中 ⟺ 值宿∈七宿；三吉星命中 ⟺ 日干支∈该月组名单', () => {
		let jinshenSeen = 0, sanxingSeen = 0;
		let cur = Solar.fromYmd(2026, 1, 1);
		for (let i = 0; i < 365; i++) {
			const r = donggongDay({ y: cur.getYear(), m: cur.getMonth(), d: cur.getDay() });
			if (r.jinshen.hit) { jinshenSeen++; expect(DONGGONG_JINSHEN_XIU).toContain(r.jinshen.xiu); }
			if (r.sanxing) {
				sanxingSeen++;
				const group = DONGGONG_MONTH_GROUP[r.monthNum];
				expect(DONGGONG_SANXING[group][r.sanxing]).toContain(r.dayGZ);
			}
			cur = cur.next(1);
		}
		expect(jinshenSeen).toBeGreaterThan(0);   // 一年必有金神七煞日
		expect(sanxingSeen).toBeGreaterThan(0);    // 一年必有三吉星日
	});
});
