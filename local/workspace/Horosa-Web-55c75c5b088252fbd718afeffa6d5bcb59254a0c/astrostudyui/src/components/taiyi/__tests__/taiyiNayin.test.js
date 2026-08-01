import { nayinOf, jiaziIndexOf, nayinElement, computeTaiyiNayin } from '../core/taiyiNayin';

describe('太乙 六十甲子纳音(表C)', () => {
	test('六十甲子序:甲子=0、壬申=8、癸亥=59', () => {
		expect(jiaziIndexOf('甲子')).toBe(0);
		expect(jiaziIndexOf('壬申')).toBe(8);
		expect(jiaziIndexOf('癸亥')).toBe(59);
		expect(jiaziIndexOf('甲丑')).toBe(-1);   // 干支阴阳不配
		expect(jiaziIndexOf('')).toBe(-1);
	});
	test('纳音锚点:甲子/乙丑=海中金、丙寅/丁卯=炉中火、壬申/癸酉=剑锋金、壬戌/癸亥=大海水', () => {
		expect(nayinOf('甲子')).toBe('海中金');
		expect(nayinOf('乙丑')).toBe('海中金');
		expect(nayinOf('丙寅')).toBe('炉中火');
		expect(nayinOf('丁卯')).toBe('炉中火');
		expect(nayinOf('壬申')).toBe('剑锋金');
		expect(nayinOf('壬戌')).toBe('大海水');
		expect(nayinOf('癸亥')).toBe('大海水');
		expect(nayinOf('丙午')).toBe('天河水');   // 2026 丙午年
	});
	test('全 60 位每组 2 支同纳音、共 30 组', () => {
		const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
		const set = new Set();
		for(let i = 0; i < 60; i++){
			const gz = GAN[i % 10] + ZHI[i % 12];
			const ny = nayinOf(gz);
			expect(ny).not.toBe('');
			set.add(ny);
			// 每组相邻 2 位同纳音
			if(i % 2 === 1){ const prev = GAN[(i - 1) % 10] + ZHI[(i - 1) % 12]; expect(nayinOf(gz)).toBe(nayinOf(prev)); }
		}
		expect(set.size).toBe(30);
	});
	test('纳音五行:末字取 金木水火土', () => {
		expect(nayinElement('海中金')).toBe('金');
		expect(nayinElement('天河水')).toBe('水');
		expect(nayinElement('')).toBe('');
	});
	test('computeTaiyiNayin 按盘式取主柱:時計(3)→时柱、年計(0)→年柱、命法(5)→年柱', () => {
		const gz = { year: '丙午', month: '甲午', day: '丁酉', time: '丙午', minute: '' };
		expect(computeTaiyiNayin({ ganzhi: gz, options: { style: 3 } }).pillar).toBe('时');
		expect(computeTaiyiNayin({ ganzhi: gz, options: { style: 0 } }).pillar).toBe('年');
		expect(computeTaiyiNayin({ ganzhi: gz, options: { style: 5 } })).toMatchObject({ pillar: '年', ganzhi: '丙午', nayin: '天河水', element: '水' });
		// 分柱空→回退年柱
		expect(computeTaiyiNayin({ ganzhi: gz, options: { style: 4 } }).pillar).toBe('年');
		expect(computeTaiyiNayin(null)).toBeNull();
	});
});
