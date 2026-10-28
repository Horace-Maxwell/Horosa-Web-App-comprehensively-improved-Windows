// 八字本地引擎「真太阳时档缺经度」提示只在调用方真选了真太阳时 / 平太阳时档时才报;
// 只为显示「真太阳时」那一行而算(每次排盘都算)时不报 —— 此前日子馆等不传经度的调用方每次都触发这条误导性提示。
import { buildLocalBaziResult } from '../baziLunarLocal';

describe('真太阳时缺经度提示', () => {
	let warn;
	beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
	afterEach(() => { warn.mockRestore(); });

	const noLonWarned = () => warn.mock.calls.some((c) => `${c[0]}`.indexOf('真太阳时档缺经度') >= 0);

	it('未选真太阳时档、不传经度:不报(显示行照常算)', () => {
		const r = buildLocalBaziResult({ date: '1990-06-15', time: '08:30:00', zone: '+08:00', gender: 1, timeAlg: 1 });
		expect(r.bazi.nongli.solarTime).toBeTruthy();
		expect(noLonWarned()).toBe(false);
	});

	it('选了真太阳时档却缺经度:报', () => {
		buildLocalBaziResult({ date: '1990-06-15', time: '08:30:00', zone: '+08:00', gender: 1, timeAlg: 0 });
		expect(noLonWarned()).toBe(true);
	});
});
