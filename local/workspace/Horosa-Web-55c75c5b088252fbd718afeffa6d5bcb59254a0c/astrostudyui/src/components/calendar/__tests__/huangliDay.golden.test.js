// 老黄历日课聚合器 golden：锚定 lunar-javascript 真值 + 内部 zeri 与 lunar 双口径交叉一致。
// 失败=聚合器接线错或锚点错，须重查，不得改测试将就。
import { buildHuangliDay, crossCheckDay } from '../huangliDay';
import { Solar } from 'lunar-javascript';

describe('huangliDay Tier0 · lunar 真值锚点', () => {
	const day = buildHuangliDay(2024, 6, 10, 10);

	test('结构完整：全字段就位', () => {
		expect(day.lunar.dayGZ).toBe('乙巳');
		expect(day.lunar.yearGZ).toBe('甲辰');
		expect(day.lunar.monthGZ).toBe('庚午');
		expect(day.solar.week).toBe('一');
		expect(Array.isArray(day.yi)).toBe(true);
		expect(Array.isArray(day.ji)).toBe(true);
		expect(Array.isArray(day.times)).toBe(true);
	});

	test('用事宜忌 = lunar 全列表', () => {
		expect(day.yi).toContain('嫁娶');
		expect(day.yi).toContain('纳采');
		expect(day.ji).toContain('安葬');
	});

	test('彭祖百忌 / 吉神凶煞 / 冲煞', () => {
		expect(day.pengzu.gan).toBe('乙不栽植千株不长');
		expect(day.pengzu.zhi).toBe('巳不远行财物伏藏');
		expect(day.jishen).toContain('王日');
		expect(day.xiongsha).toContain('游祸');
		expect(day.chong.shengxiao).toBe('猪');
		expect(day.chong.sha).toBe('东');
	});

	test('建除 / 黄黑道 / 值宿 / 九星 / 胎神', () => {
		expect(day.jianchu.name).toBe('闭');            // 内部 zeri
		expect(day.tianshen.name).toBe('玄武');         // lunar 黄黑道
		expect(day.tianshen.type).toBe('黑道');
		expect(day.xiu.name).toBe('危');
		expect(day.xiu.animal).toBe('燕');
		expect(day.nineStar.name).toBe('九紫火');
		expect(day.tai).toContain('房内东');
		expect(day.nayin).toBe('覆灯火');
	});

	test('时辰宜忌：13 段（早/晚子时分列）且首段有干支与吉凶', () => {
		expect(day.times.length).toBe(13);
		expect(day.times[0].ganzhi).toBe('丙子');
		expect(['吉', '凶']).toContain(day.times[1].luck);
	});

	test('物候 / 六曜；数九三伏当日不适用则为 null', () => {
		expect(day.hou).toContain('芒种');
		expect(day.liuyao).toBe('先负');
		expect(day.shujiu).toBeNull();
		expect(day.fu).toBeNull();
	});

	test('数九 / 三伏 在适用日有值', () => {
		expect(buildHuangliDay(2024, 1, 5).shujiu).toBe('二九');
		expect(buildHuangliDay(2024, 7, 20).fu).toBe('初伏');
	});

	test('年神方位（内部 zeri.yearGods）就位', () => {
		expect(day.yearGods).toBeTruthy();
		expect(day.yearGods.taisui).toBeTruthy();
		expect(Array.isArray(day.yearGods.twelveGods)).toBe(true);
	});
});

describe('huangliDay Tier0 · 内部 zeri 与 lunar 双口径交叉一致（2024 全年）', () => {
	test('建除十二神：zeri 算法逐日 == lunar getZhiXing()', () => {
		let mism = 0;
		let cur = Solar.fromYmd(2024, 1, 1);
		for (let i = 0; i < 366; i++) {
			const cc = crossCheckDay(cur.getYear(), cur.getMonth(), cur.getDay());
			if (cc.jianchu.zeri !== cc.jianchu.lunar) { mism++; }
			if (cc.xiu.zeri !== cc.xiu.lunar) { mism++; }
			cur = cur.next(1);
		}
		expect(mism).toBe(0);
	});
});
