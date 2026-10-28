// 二十八宿:零消费的 getSu28Sign(及其懒建的 suToSignMap)已删;在用的宿色取值照旧。
import * as Su28Helper from '../Su28Helper';

describe('Su28Helper 导出', () => {
	test('getSu28Sign 已删;getSu28Color 等在用导出照旧', () => {
		expect('getSu28Sign' in Su28Helper).toBe(false);
		expect(typeof Su28Helper.getSu28Color).toBe('function');
		expect(typeof Su28Helper.getSu28FillColorCircle).toBe('function');
	});
});
