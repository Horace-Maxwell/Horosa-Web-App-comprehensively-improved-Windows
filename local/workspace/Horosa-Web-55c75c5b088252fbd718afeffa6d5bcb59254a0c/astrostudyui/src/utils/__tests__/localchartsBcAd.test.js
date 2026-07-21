import { buildLocalChartRecord } from '../localcharts';

// 🔴 全年份域·命盘保存链回归金标(真机根因):BC 命盘 birth 串带前导负号,但调用方 fields.ad
// 未随 date.value.ad 更新 → values.ad 误传 1。旧式 `ad: values.ad !== undefined ? values.ad : ...`
// 会存 ad:1,载入端 setAd(1) 把 BC 强转 AD 12026(与当前显示相同)→ "点击选择排盘无反应/时间不变"。
// 修复:birth 串负号=ad 唯一权威(birth 由 date.value.format 产出,必然反映真实公元前后)。
describe('localcharts · BC 命盘 ad 权威 = birth 负号', () => {
	test('birth 带负号 + values.ad 误传 1 → 存 ad:-1(负号纠正错误 ad)', () => {
		const rec = buildLocalChartRecord({
			birth: '-12026-07-19 22:06:01', ad: 1, zone: '+08:00', lat: '26n04', lon: '119e19',
		});
		expect(rec.birth).toBe('-12026-07-19 22:06:01');
		expect(rec.ad).toBe(-1);
	});

	test('birth 带负号 + values.ad 缺失 → 存 ad:-1', () => {
		const rec = buildLocalChartRecord({ birth: '-722-03-05 10:00:00', zone: '+08:00' });
		expect(rec.ad).toBe(-1);
	});

	test('公元后 birth 无负号 → ad:1(现代域零回归)', () => {
		const rec = buildLocalChartRecord({ birth: '2026-07-19 22:06:01', ad: 1, zone: '+08:00' });
		expect(rec.ad).toBe(1);
	});

	test('公元后 birth 无负号 + values.ad 缺失 → 回退 ad:1', () => {
		const rec = buildLocalChartRecord({ birth: '1984-02-02 10:00:00', zone: '+08:00' });
		expect(rec.ad).toBe(1);
	});
});
