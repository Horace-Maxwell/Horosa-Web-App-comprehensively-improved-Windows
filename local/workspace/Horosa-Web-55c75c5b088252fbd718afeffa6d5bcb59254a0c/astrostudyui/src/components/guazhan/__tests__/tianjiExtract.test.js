// 抽取管线产物契约:月令神煞大表注入 + 断语库结构。数据照录古籍,断言只锁契约与守卫,不锁全文。
import { YUELING_TABLE, YUELING_NOTES } from '../../gua/data/tianjiShenSha';
import { DOCTRINE } from '../../gua/data/tianjiDoctrine';
import { yueLingNames, computeShenShaEx } from '../../gua/liuyaoShenShaEx';

describe('月令神煞大表(抽取件)', () => {
	it('75 条全量注入,吉凶两组,逐条 12 值', () => {
		expect(YUELING_TABLE.length).toBe(75);
		expect(YUELING_TABLE.filter((r) => r.jixiong === '吉').length).toBe(21);
		expect(YUELING_TABLE.filter((r) => r.jixiong === '凶').length).toBe(54);
		YUELING_TABLE.forEach((r) => expect(r.months.length).toBe(12));
		expect(YUELING_NOTES.length).toBeGreaterThanOrEqual(5);
	});
	it('模块加载即注入:yueLingNames 同步可用', () => {
		const names = yueLingNames();
		expect(names.length).toBe(75);
		['天德', '月德', '天贼', '岁刑'].forEach((n) => expect(names).toContain(n));
	});
	it('正月天德=亥(原书首条逐字):computeShenShaEx 月令命中', () => {
		const res = computeShenShaEx({ monthNum: 1 }, ['天德']);
		expect(res['天德']).toEqual({ zhis: ['亥'], group: 'yueling', duan: '救祸，夫妇合，百事皆吉', variant: '吉' });
	});
	it('卦名守卫:天月(德)值列乾艮巽保真未误转', () => {
		const ty = YUELING_TABLE.find((r) => r.name === '天月');
		expect(ty.months).toEqual(['丁', '坤', '壬', '辛', '乾', '甲', '癸', '艮', '丙', '乙', '巽', '庚']);
	});
	it('同名四例(天医/生气/天刑/天贼):既有起例版优先,月令表版不覆盖', () => {
		// 天医起例版(SHENSHA_EX)按月支起,月令表版按月序——同选时保留起例版 group
		const res = computeShenShaEx({ monthNum: 1, monthZhi: '寅' }, ['天医']);
		if (res['天医']) { expect(res['天医'].group).not.toBe('yueling'); }
	});
	it('合并名单去重:concat 后无重复名', () => {
		const { SHENSHA_EX } = require('../../gua/liuyaoShenShaEx');
		const all = SHENSHA_EX.map((m) => m.name).concat(yueLingNames());
		const dedup = Array.from(new Set(all));
		expect(all.length - dedup.length).toBe(4);
	});
	it('注入不扰基础集:未选月令名时零出现', () => {
		const res = computeShenShaEx({ monthNum: 3, dayGan: '甲', dayZhi: '子', yearZhi: '寅', monthZhi: '卯' }, ['天乙贵人']);
		Object.values(res).forEach((v) => expect(v.group).not.toBe('yueling'));
	});
});

describe('断语库(抽取件)', () => {
	it('40 门结构契约:{门:[{source,text}]}', () => {
		const keys = Object.keys(DOCTRINE);
		expect(keys.length).toBe(40);
		expect(keys).toContain('总断门第一');
		expect(keys).toContain('占天时第二');
		keys.forEach((k) => DOCTRINE[k].forEach((r) => {
			expect(typeof r.source).toBe('string');
			expect(typeof r.text).toBe('string');
		}));
	});
	it('总断门首行=孙膑总断歌(源标注正确)', () => {
		expect(DOCTRINE['总断门第一'][0]).toEqual({ source: '孙膑', text: '孙膑总断歌' });
	});
	it('整理者化名零残留+今注在位', () => {
		let hu = 0, jin = 0;
		Object.values(DOCTRINE).forEach((rows) => rows.forEach((r) => {
			if (r.text.indexOf('虎易') >= 0) { hu++; }
			if (r.text.indexOf('今注') >= 0) { jin++; }
		}));
		expect(hu).toBe(0);
		expect(jin).toBeGreaterThan(20);
	});
	it('螣蛇规范字零回潮(腾蛇/妻才不出现)', () => {
		Object.values(DOCTRINE).forEach((rows) => rows.forEach((r) => {
			expect(r.text.indexOf('腾蛇')).toBe(-1);
			expect(r.text.indexOf('妻才')).toBe(-1);
		}));
	});
});
