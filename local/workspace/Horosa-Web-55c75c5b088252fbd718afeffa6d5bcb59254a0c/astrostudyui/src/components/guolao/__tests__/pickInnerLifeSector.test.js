// 天星择日「立命时刻」定内静盘命宫(此前回包 lifeDeg 从不读 = 死开关)。
jest.mock('d3', () => ({}));
import { pickInnerLifeSector, eclipticLonToRa } from '../GuoLaoMoiraPickWheel';

const ZHI = '子丑寅卯辰巳午未申酉戌亥';

describe('pickInnerLifeSector', () => {
	test('有立命黄经就用它,不再用静盘上升点(白羊=戌、金牛=酉 … 镜像)', () => {
		expect(ZHI[pickInnerLifeSector(5, 200, true)]).toBe('戌');     // 白羊 5°
		expect(ZHI[pickInnerLifeSector(35, 200, true)]).toBe('酉');    // 金牛 5°
		expect(ZHI[pickInnerLifeSector(305, 5, true)]).toBe('子');     // 宝瓶 5°
	});
	test('日出 / 正午 / 日落三种立命黄经落三个不同的宫(左栏三档必然动盘)', () => {
		const sunrise = pickInnerLifeSector(58, 10, true);
		const noon = pickInnerLifeSector(148, 10, true);
		const sunset = pickInnerLifeSector(238, 10, true);
		expect(new Set([sunrise, noon, sunset]).size).toBe(3);
	});
	test('回包缺 lifeDeg → 回退静盘上升点;两者都缺 → null', () => {
		expect(ZHI[pickInnerLifeSector(undefined, 95, true)]).toBe('未');   // 巨蟹
		expect(pickInnerLifeSector(undefined, undefined, true)).toBe(null);
	});
	test('赤仪显示:立命黄经先换赤经再定宫(二分二至点不变,中间度数按黄赤交角挪)', () => {
		expect(eclipticLonToRa(0)).toBeCloseTo(0, 6);
		expect(eclipticLonToRa(90)).toBeCloseTo(90, 6);
		expect(eclipticLonToRa(180)).toBeCloseTo(180, 6);
		expect(eclipticLonToRa(270)).toBeCloseTo(270, 6);
		expect(eclipticLonToRa(30)).toBeCloseTo(27.91, 1);
		// 黄经 31° → 赤经约 28.9°:黄仪落金牛(酉)、赤仪落白羊(戌)
		expect(ZHI[pickInnerLifeSector(31, 0, true)]).toBe('酉');
		expect(ZHI[pickInnerLifeSector(31, 0, false)]).toBe('戌');
	});
});
