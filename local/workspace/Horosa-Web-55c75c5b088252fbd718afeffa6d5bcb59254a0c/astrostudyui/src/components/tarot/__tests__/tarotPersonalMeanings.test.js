// TP6 个人牌义层:本机存取 roundtrip / 500 字封顶 / 清除 / 异常静默。jsdom 自带 localStorage。
import { loadPersonalMeanings, personalMeaningOf, savePersonalMeaning, PERSONAL_KEY } from '../decks/personalMeanings';

describe('个人牌义(本机三层模型第三层)', () => {
	beforeEach(() => { window.localStorage.removeItem(PERSONAL_KEY); });
	test('存→取 roundtrip;空串=清除;500 字封顶', () => {
		expect(personalMeaningOf('the_fool')).toBe('');
		expect(savePersonalMeaning('the_fool', '  我的愚者:出发前先系鞋带  ')).toBe(true);
		expect(personalMeaningOf('the_fool')).toBe('我的愚者:出发前先系鞋带');
		expect(loadPersonalMeanings().the_fool).toBeTruthy();
		savePersonalMeaning('the_fool', '');
		expect(personalMeaningOf('the_fool')).toBe('');
		expect(loadPersonalMeanings().the_fool).toBeUndefined();
		savePersonalMeaning('cups_09', 'x'.repeat(800));
		expect(personalMeaningOf('cups_09').length).toBe(500);
	});
	test('坏档静默:非 JSON 存量不抛,当空档', () => {
		window.localStorage.setItem(PERSONAL_KEY, '{{{bad');
		expect(loadPersonalMeanings()).toEqual({});
		expect(personalMeaningOf('the_sun')).toBe('');
	});
});
