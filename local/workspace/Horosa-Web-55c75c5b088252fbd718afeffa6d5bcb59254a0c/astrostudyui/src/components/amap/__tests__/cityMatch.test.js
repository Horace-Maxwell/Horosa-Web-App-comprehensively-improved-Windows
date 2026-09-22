// 城市检索自检(用真实城市库 + 繁→简折叠表),覆盖用户反馈的三类痛点:简繁、拼音、完整/排序。
import CITIES from '../../../data/cities.json';
import CITIES_FULL from '../../../data/citiesFull.json';
import FOLD from '../../../data/cityTradSimpMap.json';
import { searchCities, foldTrad } from '../cityMatch';

const lists = [CITIES, CITIES_FULL];
const search = (q) => searchCities(q, lists, FOLD, 80);
const names = (q) => search(q).map((c) => c.name);

describe('城市检索 cityMatch(真实库)', () => {
	test('简体直接命中(数据已转简体)', () => {
		expect(names('北京')).toContain('北京');
		expect(names('上海')).toContain('上海');
	});

	test('繁体查询折叠为简体后命中(用户痛点:只能繁体搜)', () => {
		// 繁体输入与对应简体输入结果一致。
		expect(search('澳門')[0].name).toBe(search('澳门')[0].name);
		expect(names('臺北')).toEqual(names('台北'));
		expect(names('烏魯木齊')).toEqual(names('乌鲁木齐'));
	});

	test('全拼命中(用户痛点:拼音搜不出)', () => {
		expect(names('beijing')).toContain('北京');
		expect(names('shanghai').some((n) => /shanghai|上海/i.test(n))).toBe(true);
		expect(names('wulumuqi').some((n) => n.indexOf('乌鲁木齐') >= 0)).toBe(true);
	});

	test('首字母命中', () => {
		expect(names('bj')).toContain('北京');
		expect(names('wlmq').some((n) => n.indexOf('乌鲁木齐') >= 0)).toBe(true);
	});

	test('外文城市:中文别名 / 拼音 / 去空格英文 三路都命中(小库)', () => {
		expect(names('纽约')).toContain('纽约');
		expect(names('niuyue')).toContain('纽约');
		expect(names('newyork')).toContain('纽约');
		expect(names('伦敦')).toContain('伦敦');
		expect(names('london')).toContain('伦敦');
	});

	test('排序:精确拼音的 西安 排在模糊匹配(翔安)之前', () => {
		const ns = names('xian');
		expect(ns).toContain('西安');
		expect(ns.indexOf('西安')).toBe(0);
	});

	test('地区可搜(省/国家)', () => {
		expect(names('广东').length).toBeGreaterThan(0);
	});

	test('空查询返回空;结果有上限且无重复', () => {
		expect(search('')).toEqual([]);
		expect(search('   ')).toEqual([]);
		const r = search('北京');
		expect(r.length).toBeLessThanOrEqual(80);
		const keys = r.map((c) => `${c.name}|${c.lat}|${c.lng}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	test('foldTrad 只折叠映射内的繁体字,简体与拉丁原样', () => {
		expect(foldTrad('澳門', FOLD)).toBe('澳门');
		expect(foldTrad('北京', FOLD)).toBe('北京');
		expect(foldTrad('beijing', FOLD)).toBe('beijing');
	});

	test('返回条目坐标可用(回填经纬度不为空)', () => {
		const c = search('北京')[0];
		expect(Number.isFinite(c.lat)).toBe(true);
		expect(Number.isFinite(c.lng)).toBe(true);
	});
});

describe('城市检索 · 拉丁重音折叠 + 外国城市中文别名(大库)', () => {
	test('Reykjavík / reykjavik / REYKJAVIK 同命中', () => {
		['Reykjavík', 'reykjavik', 'REYKJAVIK'].forEach((q) => {
			expect(search(q).some((c) => /Reykjav/i.test(c.en) || c.name === '雷克雅未克')).toBe(true);
		});
	});
	test('São Paulo / Sao Paulo 同命中', () => {
		['São Paulo', 'Sao Paulo', 'saopaulo'].forEach((q) => {
			expect(search(q).some((c) => /S[ãa]o Paulo/i.test(c.en))).toBe(true);
		});
	});
	test('中文别名:利马→Lima(PE)、惠灵顿→Wellington(NZ)、雷克雅未克→Reykjavík(IS)', () => {
		expect(search('利马').some((c) => c.en === 'Lima' && c.region === 'PE')).toBe(true);
		expect(search('惠灵顿').some((c) => c.en === 'Wellington' && c.region === 'NZ')).toBe(true);
		expect(search('雷克雅未克').some((c) => c.en === 'Reykjavík' && c.region === 'IS')).toBe(true);
	});
	test('别名条目的拼音同样可查(leikeyaweike)', () => {
		expect(search('leikeyaweike').some((c) => c.name === '雷克雅未克')).toBe(true);
	});
});
