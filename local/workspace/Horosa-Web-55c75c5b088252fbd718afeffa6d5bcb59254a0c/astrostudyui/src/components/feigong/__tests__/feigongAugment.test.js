// 飞宫小奇门 · 补齐层金标:河魁双口径 / 流年 / 流月 / 应期 / 事项路由 / 6 实例结构。
// 纯新增派生 + 断语口径,零改既有布局引擎(buildJu/mingGong 逐字不变,feigongGolden 另守)。
import { buildJu, liuNian, liuYue } from '../core/feigongJu';
import { zhuKe, yingQi, shiXiangKey, xingDuan } from '../core/feigongDuan';

// 6 实例(附录 B,逐案复算与原文断语字节吻合):主(日干宫)/ 客(日支宫·神·星·门)
const CASES = [
	{ name: '求财', zhi: '未', dayGan: '壬', dayZhi: '辰', zhuGong: '中', keGong: 4, keShen: '玄武', keXing: '破', keMen: '生' },
	{ name: '婚姻', zhi: '午', dayGan: '癸', dayZhi: '卯', zhuGong: 8, keGong: 3, keShen: '玄武', keXing: '危', keMen: '伤' },
	{ name: '测病', zhi: '子', dayGan: '甲', dayZhi: '辰', zhuGong: 1, keGong: 4, keShen: '金匮', keXing: '成', keMen: '惊' },
	{ name: '出行', zhi: '申', dayGan: '己', dayZhi: '亥', zhuGong: 7, keGong: 6, keShen: '朱雀', keXing: '闭', keMen: '死' },
	{ name: '其他a', zhi: '亥', dayGan: '戊', dayZhi: '辰', zhuGong: '中', keGong: 4, keShen: '天德', keXing: '开', keMen: '死' },
	{ name: '其他b', zhi: '亥', dayGan: '丁', dayZhi: '酉', zhuGong: 9, keGong: 7, keShen: '司命', keXing: '平', keMen: '休' },
];

describe('3F · 6 实例主客结构(附录 B 金标)', () => {
	CASES.forEach((c) => {
		test(`${c.name}局(时${c.zhi}·${c.dayGan}${c.dayZhi}):主${c.zhuGong}/客${c.keGong}·${c.keShen}·${c.keXing}·${c.keMen}门`, () => {
			const ju = buildJu({ zhi: c.zhi, dayGan: c.dayGan, dayZhi: c.dayZhi });
			expect(ju).toBeTruthy();
			const zk = zhuKe(ju);
			expect(zk.zhuGong).toBe(c.zhuGong);
			expect(zk.keGong).toBe(c.keGong);
			expect(ju.yuanShen[c.dayZhi]).toBe(c.keShen);
			expect(ju.tianXing[c.dayZhi]).toBe(c.keXing);
			expect(ju.baMen.gongMen[c.keGong]).toBe(c.keMen);
		});
	});
});

describe('3B · 流年(从日支起,男顺女逆,一支一岁)', () => {
	const ju = buildJu({ zhi: '未', dayGan: '壬', dayZhi: '辰' });
	test('求财局 男顺:1岁辰/2岁巳/3岁午/4岁未/5岁申', () => {
		const ln = liuNian({ dayZhi: '辰', gender: 'male', maxAge: 5, ju });
		expect(ln.map((x) => x.zhi)).toEqual(['辰', '巳', '午', '未', '申']);
		expect(ln[0].gong).toBe(4); // 辰宫4
		expect(ln[0].shen).toBe(ju.yuanShen['辰']);
		expect(ln[0].xing).toBe(ju.tianXing['辰']);
	});
	test('女逆:1岁辰/2岁卯/3岁寅', () => {
		const ln = liuNian({ dayZhi: '辰', gender: 'female', maxAge: 3, ju });
		expect(ln.map((x) => x.zhi)).toEqual(['辰', '卯', '寅']);
	});
	test('边界:无 ju/非法支 → 空数组', () => {
		expect(liuNian({ dayZhi: '辰', ju: null })).toEqual([]);
		expect(liuNian({ dayZhi: 'X', ju })).toEqual([]);
	});
});

describe('3C · 流月(月建定月位:正月寅…十二月丑)', () => {
	const ju = buildJu({ zhi: '未', dayGan: '壬', dayZhi: '辰' });
	test('月建支:正月寅/六月未/十一月子/十二月丑', () => {
		expect(liuYue({ ju, monthNum: 1 }).zhi).toBe('寅');
		expect(liuYue({ ju, monthNum: 6 }).zhi).toBe('未');
		expect(liuYue({ ju, monthNum: 11 }).zhi).toBe('子');
		expect(liuYue({ ju, monthNum: 12 }).zhi).toBe('丑');
	});
	test('落宫/神/星取自定局', () => {
		const ly = liuYue({ ju, monthNum: 1 });
		expect(ly.gong).toBeGreaterThanOrEqual(1);
		expect(ly.shen).toBe(ju.yuanShen['寅']);
	});
	test('边界:非法月 → null', () => {
		expect(liuYue({ ju, monthNum: 0 })).toBeNull();
		expect(liuYue({ ju, monthNum: 13 })).toBeNull();
	});
});

describe('3D · 应期(中宫二干定时/驿马/冲 + 日支冲合)', () => {
	test('求财局(中宫丁壬)→驿马;日支辰→冲戌合酉', () => {
		const ju = buildJu({ zhi: '未', dayGan: '壬', dayZhi: '辰' });
		const yq = yingQi(ju);
		expect(ju.tianGan.zhongGong.sort()).toEqual(['壬', '丁'].sort());
		expect(yq.shi).toBe('驿马');
		expect(yq.yiMa).toBe(true);
		expect(yq.chongZhi).toBe('戌'); // 辰戌冲
		expect(yq.heZhi).toBe('酉');    // 辰酉合
	});
	test('子局(中宫戊癸)→定时', () => {
		const ju = buildJu({ zhi: '子', dayGan: '甲', dayZhi: '辰' });
		expect(ju.tianGan.zhongGong.sort()).toEqual(['戊', '癸'].sort());
		expect(yingQi(ju).shi).toBe('定时');
	});
});

describe('3E · 事项路由(关键词→关键星神;女事随河魁口径)', () => {
	test('求财→金匮 / 官非→白虎 / 失物→玄武 / 男→危', () => {
		expect(shiXiangKey('求财买房').shen).toBe('金匮');
		expect(shiXiangKey('官司词讼').shen).toBe('白虎');
		expect(shiXiangKey('丢失手机寻物').shen).toBe('玄武');
		expect(shiXiangKey('问男人前程').xing).toBe('危');
	});
	test('女事:正传看收(河魁)/异文看开', () => {
		expect(shiXiangKey('婚姻嫁娶').xing).toBe('收');
		expect(shiXiangKey('婚姻嫁娶', { heKuiKoujing: 'yi' }).xing).toBe('开');
	});
	test('空/无关键词 → null', () => {
		expect(shiXiangKey('')).toBeNull();
		expect(shiXiangKey('随便问问')).toBeNull();
	});
});

describe('3A · 河魁口径(默认正传)', () => {
	test('xingDuan 默认正传:收=河魁女星、开=贵人', () => {
		expect(xingDuan('收').alias).toBe('河魁(女星)');
		expect(xingDuan('开').alias).toBe('贵人');
	});
	test('异文口径互换', () => {
		expect(xingDuan('收', 'yi').alias).toBe('贵人');
		expect(xingDuan('开', 'yi').alias).toBe('河魁(女星)');
	});
});
