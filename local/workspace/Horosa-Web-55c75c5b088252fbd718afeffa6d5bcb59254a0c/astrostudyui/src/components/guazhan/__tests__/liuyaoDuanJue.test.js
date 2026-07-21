import { sanCengEnv, anDongOf, jueChuFengSheng, heChuFengChong, suiGuanRuMu, zhuGuiShangShen, wuGuiOf,
	suiJinFuChain, feiFuShengKe, chengGangOf, chuanHaiExplain, zhenKongJueOf, mieMoOf, wangShuaiWithYuqi,
	jinShenBy, tuiShenBy, xinpaiScoreOf, liuheHuaOf, riYueYinDong } from '../../gua/liuyaoDuanJue';

describe('六爻断诀判定层', () => {
	it('日月生克(5.4):巳火爻/癸巳日/乙未月 → 日临建·比和,月泄气;亥水爻遇巳日=日冲;金爻遇丑日=得生+入日墓', () => {
		const r = riYueYinDong([{ pos: 1, zhi: '巳', wuxing: '火', liuqin: '兄弟' }], ['丙'], { dayGan: '癸', dayZhi: '巳', monthGan: '乙', monthZhi: '未' });
		const p = r.perYao[0];
		expect(p.day.tags.map((t) => t.t)).toEqual(expect.arrayContaining(['临日建', '比和']));
		expect(p.month.tags.map((t) => t.t)).toContain('泄气');   // 火生未土=泄气
		expect(p.gan).toBe('丙'); expect(p.zhi).toBe('巳');
		// 亥水爻 vs 巳日:六冲(巳↔亥)
		const r2 = riYueYinDong([{ pos: 1, zhi: '亥', wuxing: '水', liuqin: '父母' }], [''], { dayZhi: '巳', monthZhi: '子' });
		expect(r2.perYao[0].day.tags.map((t) => t.t)).toContain('日冲');
		// 金爻 vs 丑日:丑土生金(得生)且丑=金墓库(入日墓);铁律:爻克月日不记
		const r3 = riYueYinDong([{ pos: 1, zhi: '申', wuxing: '金', liuqin: '兄弟' }], [''], { dayZhi: '丑', monthZhi: '午' });
		const d3 = r3.perYao[0].day.tags.map((t) => t.t);
		expect(d3).toEqual(expect.arrayContaining(['得生', '入日墓']));
	});
	it('三层环境:酉年酉月未日 → 岁破卯/月破卯/日破丑', () => {
		const e = sanCengEnv({ yearZhi: '酉', monthZhi: '酉', dayZhi: '未' });
		expect(e.suiPo).toBe('卯'); expect(e.yuePo).toBe('卯'); expect(e.riPo).toBe('丑');
	});
	it('暗动:静爻旺相被日冲=暗动;休囚=冲散', () => {
		expect(anDongOf({ moving: false, wangShuai: '旺', dayRel: { chong: true } })).toBe('暗动');
		expect(anDongOf({ moving: false, wangShuai: '休', dayRel: { chong: true } })).toBe('冲散(日破)');
	});
	it('随官入墓:未日世临寅木官鬼(木墓未)=世随鬼入墓;戊戌日为杀墓', () => {
		const yaos = [null, { pos: 2, liuqin: '官鬼', wuxing: '木', zhi: '寅' }].map((y, i) => y || { pos: i + 1, liuqin: '兄弟', wuxing: '土', zhi: '辰' });
		const r = suiGuanRuMu(yaos, { dayZhi: '未', dayGan: '乙', shiPos: 2, tuMode: 'water' });
		expect(r.hits[0].kind).toBe('世随鬼入墓');
		const r2 = suiGuanRuMu(yaos.map((y) => ({ ...y, wuxing: '火', zhi: '午' })), { dayZhi: '戌', dayGan: '戊', shiPos: 2, tuMode: 'water' });
		expect(r2 && r2.shaMu).toBe(true); // 火墓戌+戊戌日
	});
	it('碎金赋:忌神动克用+忌神所生同动=贪生忘克', () => {
		const yaos = [
			{ pos: 1, liuqin: '兄弟', wuxing: '木', zhi: '寅' },  // 忌神(克财)
			{ pos: 2, liuqin: '子孙', wuxing: '火', zhi: '午' },  // 兄所生=原神
			{ pos: 3, liuqin: '妻财', wuxing: '土', zhi: '辰' },
			{ pos: 4, liuqin: '父母', wuxing: '水', zhi: '子' },
			{ pos: 5, liuqin: '官鬼', wuxing: '金', zhi: '申' },
			{ pos: 6, liuqin: '兄弟', wuxing: '木', zhi: '卯' },
		];
		const chains = suiJinFuChain(yaos, new Set([1, 2]), '妻财', {});
		const ji = chains.find((ch) => ch.kind === '忌神动克用');
		expect(ji.notes.join()).toContain('贪生忘克');
		const yuan = chains.find((ch) => ch.kind === '原神动生用');
		expect(yuan).toBeTruthy();
	});
	it('飞伏生克四断 + 承刚 + 穿害推导 + 六合化行', () => {
		expect(feiFuShengKe({ wuxing: '木' }, { wuxing: '火' }).rel).toBe('飞来生伏');
		expect(chengGangOf([{ pos: 1, yin: true }, { pos: 2, yin: false }])).toEqual([1]);
		expect(chuanHaiExplain('丑')).toEqual({ zhi: '丑', he: '子', chuan: '午' }); // 午穿丑
		expect(liuheHuaOf('子', '丑')).toBe('土');
	});
	it('真空口诀:春月土爻旬空无日生=真空口诀命中', () => {
		expect(zhenKongJueOf('土', '寅', false).hit).toBe(true);
		expect(zhenKongJueOf('土', '寅', true).hit).toBe(false); // 日辰生助不为空
	});
	it('灭没卦:春蒙=灭、冬临=没', () => {
		expect(mieMoOf('山水蒙', '卯').kind).toBe('灭');
		expect(mieMoOf('地泽临', '子').kind).toBe('没');
	});
	it('余气:辰月木余气强;进退神土路径 break 时戌不进丑', () => {
		expect(wangShuaiWithYuqi('木', '辰', true).strongByYuqi).toBe(true);
		expect(jinShenBy('戌', '丑', 'chain')).toBe(true);
		expect(jinShenBy('戌', '丑', 'break')).toBe(false);
		expect(tuiShenBy('丑', '戌', 'break')).toBe(false);
	});
	it('新派量化:月旺+日生-月破 → 得分与档位', () => {
		const r = xinpaiScoreOf({ wangShuai: '旺', dayRel: { sheng: true }, yuePo: false, xunKong: false }, null);
		expect(r.score).toBe(3); expect(r.grade).toBe('旺');
	});
});
