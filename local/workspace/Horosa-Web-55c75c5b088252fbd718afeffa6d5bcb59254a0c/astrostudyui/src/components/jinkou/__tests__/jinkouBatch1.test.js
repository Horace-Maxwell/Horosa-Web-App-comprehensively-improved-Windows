/**
 * 金口诀 Batch 1（断法完善）golden：
 * 四象所属图 / 四象五行图 / 新增神煞起例 / 格局朝元四丘 / 太岁三项 / 合占扣题 / 课分内外，
 * 并复算古籍三则起课算例与测近运例（四位逐位比对，防「月将加时方向」错算）。
 */
import { buildJinKouData } from '../JinKouCalc';
import {
	JINKOU_SIXIANG_SHU, JINKOU_SIXIANG_SHU_COLS, JINKOU_SIXIANG_WUXING, JINKOU_SHENSHA_DOC, JINKOU_GEJU_DOC,
} from '../JinKouDoc';

// 起课算例复算用 fixture：日干支/月支/占时/地分可控（月将由月支六合自动取）。
function mockLR(dayGanZi, monthGanZi, timeZhi, extra){
	const e = extra || {};
	return {
		nongli: { dayGanZi: dayGanZi, time: `${timeZhi}时`, monthGanZi: monthGanZi, ...(e.nongli || {}) },
		fourColumns: { month: { ganzi: monthGanZi }, ...(e.fourColumns || {}) },
		xun: { '旬空': '', '旬首': '', ...(e.xun || {}) },
		season: { '金': '囚', '木': '旺', '水': '休', '火': '相', '土': '死' },
		gods: {}, godsGan: {}, godsMonth: {}, godsZi: {}, godsYear: { taisui1: {} },
	};
}
function cast(dayGanZi, monthGanZi, timeZhi, diFen, opts){
	return buildJinKouData(mockLR(dayGanZi, monthGanZi, timeZhi), { diFen: diFen, zhanShi: timeZhi, guirengType: 0, ...(opts || {}) });
}

describe('起课算例复算（四位逐位比对）', ()=>{
	// 例一 戊子日·庚申时·子月·地分寅（昼占）→ 将神未(小吉)/己未、贵神螣蛇(巳)/丁巳、人元甲
	it('例一：戊子日 申时 子月 地分寅 → 将神未·贵神螣蛇·人元甲', ()=>{
		const d = cast('戊子', '庚子', '申', '寅');
		expect(d.jiangZi).toBe('未');
		expect(d.jiangName).toBe('小吉');
		expect(d.jiangGan).toBe('己');
		expect(d.guiName).toBe('螣蛇');
		expect(d.guiZi).toBe('巳');
		expect(d.guiGan).toBe('丁');
		expect(d.renYuanGan).toBe('甲');
	});

	// 例二 甲子日·庚午时·寅月·地分酉 → 将神寅(功曹)/丙寅、贵神太常(未)/辛未、人元癸
	it('例二：甲子日 午时 寅月 地分酉 → 将神寅·贵神太常·人元癸', ()=>{
		const d = cast('甲子', '丙寅', '午', '酉');
		expect(d.jiangZi).toBe('寅');
		expect(d.jiangName).toBe('功曹');
		expect(d.jiangGan).toBe('丙');
		expect(d.guiName).toBe('太常');
		expect(d.guiZi).toBe('未');
		expect(d.guiGan).toBe('辛');
		expect(d.renYuanGan).toBe('癸');
	});

	// 例三（自检要害）：己丑日·己巳时·子月·地分午 → 将神须为功曹寅，非小吉未（加时方向易错处）
	it('例三：己丑日 巳时 子月 地分午 → 将神功曹寅（非小吉未）+ 贵神天空·人元庚', ()=>{
		const d = cast('己丑', '庚子', '巳', '午');
		expect(d.jiangZi).toBe('寅');
		expect(d.jiangName).toBe('功曹');
		expect(d.jiangGan).toBe('丙');
		expect(d.guiName).toBe('天空');
		expect(d.guiZi).toBe('戌');
		expect(d.guiGan).toBe('甲');
		expect(d.renYuanGan).toBe('庚');
	});

	// 测近运例：甲子日·甲戌时(夜)·酉月·地分午 → 将神子(神后)/甲子、贵神螣蛇(巳)/己巳、人元庚
	it('测近运例：甲子日 戌时 酉月 地分午 → 将神神后子·贵神螣蛇·人元庚', ()=>{
		const d = cast('甲子', '辛酉', '戌', '午');
		expect(d.jiangZi).toBe('子');
		expect(d.jiangName).toBe('神后');
		expect(d.jiangGan).toBe('甲');
		expect(d.guiName).toBe('螣蛇');
		expect(d.guiZi).toBe('巳');
		expect(d.guiGan).toBe('己');
		expect(d.renYuanGan).toBe('庚');
	});
});

describe('四象所属图 / 四象五行图', ()=>{
	const d = cast('甲辰', '丙申', '申', '午');

	it('四象所属：四位各带 6 列静态所属 + 当前干支实况', ()=>{
		expect(Array.isArray(d.sixiangShu)).toBe(true);
		expect(d.sixiangShu.map((r)=>r.label)).toEqual(['人元', '贵神', '将神', '地分']);
		d.sixiangShu.forEach((r)=>{
			const attr = JINKOU_SIXIANG_SHU[r.label];
			JINKOU_SIXIANG_SHU_COLS.forEach((c)=>{ expect(r[c.key]).toBe(attr[c.key]); });
		});
		// 定位取用要害：人元头·贵神胸·将神腹·地分腿足；将神主财、贵神主官禄。
		const byLabel = {};
		d.sixiangShu.forEach((r)=>{ byLabel[r.label] = r; });
		expect(byLabel['人元'].shenti).toBe('头');
		expect(byLabel['贵神'].shenti).toBe('胸');
		expect(byLabel['将神'].shenti).toBe('腹');
		expect(byLabel['地分'].shenti).toBe('腿足');
		expect(byLabel['将神'].guanlucai).toBe('财');
		expect(byLabel['贵神'].guanlucai).toBe('官·禄');
	});

	it('四象五行：逐位取象 + 主象取课中旺之五行 + 天时判语随主象', ()=>{
		const sw = d.sixiangWuxing;
		expect(sw && Array.isArray(sw.rows)).toBe(true);
		expect(sw.rows.length).toBe(4);
		sw.rows.forEach((r)=>{
			if(!r.elem){ return; }
			const doc = JINKOU_SIXIANG_WUXING[r.elem];
			expect(r.tianshi).toBe(doc.tianshi);
			expect(r.bingyuan).toBe(doc.bingyuan);
		});
		expect(sw.mainElem).toBe(d.wangElem);
		if(sw.mainElem === '水'){ expect(sw.tianqiText).toContain('雨'); }
		if(sw.mainElem === '火'){ expect(sw.tianqiText).toContain('晴'); }
	});
});

describe('神煞起例补全', ()=>{
	const namesAt = (d, label)=>{
		const row = (d.shenshaRows || []).find((r)=>`${r.label}`.indexOf(label) === 0);
		return row ? `${row.value}`.split(/[、，,\s]+/) : [];
	};
	const allNames = (d)=>(d.shenshaRows || []).reduce((acc, r)=>acc.concat(`${r.value}`.split(/[、，,\s]+/)), []);

	it('牢禁关锁：卯申同见起「锁」，寅辰同见起「毁隔」', ()=>{
		// 甲日申时子月地分卯：地分卯 + 贵神/将神含申 → 锁
		const lock = cast('甲子', '庚子', '申', '卯');
		const zhis = lock.rows.map((r)=>r.branch || r.content);
		if(zhis.indexOf('卯') >= 0 && zhis.indexOf('申') >= 0){
			expect(allNames(lock)).toContain('锁');
		}
		// 构造寅辰并见：例二盘(地分酉/将神寅)无辰；改用地分寅、令贵神落辰
		const hui = cast('丙辰', '壬辰', '午', '寅');
		const hz = hui.rows.map((r)=>r.branch || r.content);
		if(hz.indexOf('寅') >= 0 && hz.indexOf('辰') >= 0){
			expect(allNames(hui)).toContain('毁隔');
		}
	});

	it('天罗地网：日支前一辰为天罗、其对冲为地网', ()=>{
		const d = cast('甲辰', '丙申', '申', '巳');
		// 日支辰 → 天罗巳、地网亥
		const rows = d.rows.map((r)=>r.branch || r.content);
		if(rows.indexOf('巳') >= 0){ expect(allNames(d)).toContain('天罗'); }
		if(rows.indexOf('亥') >= 0){ expect(allNames(d)).toContain('地网'); }
	});

	it('四绝：寅酉/卯申/午亥/子巳 同见成煞', ()=>{
		const d = cast('甲子', '丙寅', '午', '酉');   // 地分酉 + 将神寅 → 四绝
		expect(allNames(d)).toContain('四绝');
		expect(namesAt(d, '地分')).toContain('四绝');
	});

	it('新起例判语键与起例名一致（可 join 到判语库）', ()=>{
		['关', '隔', '锁', '斩关', '毁隔', '破锁', '天罗', '地网', '四绝', '三奇'].forEach((n)=>{
			expect(JINKOU_SHENSHA_DOC[n]).toBeTruthy();
			expect(typeof JINKOU_SHENSHA_DOC[n].desc).toBe('string');
		});
		// 咸池/四败为桃花异名，判语已互指
		expect(JINKOU_SHENSHA_DOC['桃花'].desc).toContain('咸池');
		expect(JINKOU_SHENSHA_DOC['咸池'].desc).toContain('桃花');
	});

	it('方位神煞：飞天五鬼 / 喜神按日干取八卦之位，且不入四位行', ()=>{
		const d = cast('甲辰', '丙申', '申', '午');
		expect(Array.isArray(d.fangWeiShensha)).toBe(true);
		const wu = d.fangWeiShensha.find((x)=>x.name === '飞天五鬼');
		const xi = d.fangWeiShensha.find((x)=>x.name === '喜神');
		expect(wu.gua).toBe('巽');      // 甲己巽
		expect(xi.gua).toBe('艮');      // 甲己艮
		expect(wu.fang).toBe('东南');
		expect(xi.fang).toBe('东北');
		expect(allNames(d)).not.toContain('飞天五鬼');
	});
});

describe('格局 / 太岁月建补齐', ()=>{
	it('四丘按季取支（秋未）：课中见之即成格', ()=>{
		// 丙申月＝秋，四丘取未；地分未
		const d = cast('甲辰', '丙申', '申', '未');
		const siqiu = (d.geju || []).find((g)=>g.name === '四丘');
		expect(siqiu).toBeTruthy();
		expect(siqiu.zhi).toBe('未');
		expect(siqiu.text).toBe(JINKOU_GEJU_DOC['四丘']);
	});

	it('太岁月建九项：新增真太岁/岁宅/日建，岁宅＝岁前五辰', ()=>{
		const d = buildJinKouData({
			...mockLR('甲辰', '丙申', '申'),
			fourColumns: { year: { ganzi: '丙午' }, month: { ganzi: '丙申' } },
			nongli: { dayGanZi: '甲辰', time: '申时', monthGanZi: '丙申', yearGanZi: '丙午' },
		}, { diFen: '午', guirengType: 0 });
		const byName = {};
		(d.nianYueRi || []).forEach((it)=>{ byName[it.name] = it; });
		expect(byName['真太岁']).toBeTruthy();
		expect(byName['岁宅']).toBeTruthy();
		expect(byName['日建']).toBeTruthy();
		expect(byName['岁宅'].zhi).toBe('亥');      // 午前五辰＝亥
		expect(byName['日建'].zhi).toBe('辰');      // 日支辰；hit 取决于将神是否也为辰
		expect(byName['日建'].hit).toBe(d.jiangZi === '辰');
	});
});

describe('合占扣题直断 + 课分内外', ()=>{
	it('问财取将神、问官取贵神；未限定则回落用爻', ()=>{
		const base = { diFen: '午', guirengType: 0 };
		const lr = mockLR('甲辰', '丙申', '申');
		const cai = buildJinKouData(lr, { ...base, askKey: 'qiucai' });
		const guan = buildJinKouData(lr, { ...base, askKey: 'guantu' });
		const plain = buildJinKouData(lr, base);
		expect(cai.hezhan.usePosition).toBe('将神');
		expect(cai.hezhan.askLabel).toBe('财');
		expect(guan.hezhan.usePosition).toBe('贵神');
		expect(plain.hezhan.usePosition).toBe(plain.yongYao.label);
		expect(plain.hezhan.chain.length).toBeGreaterThanOrEqual(4);
	});

	it('时段扣题：问日以日时为参、问年以太岁为参', ()=>{
		const lr = mockLR('甲辰', '丙申', '申');
		const day = buildJinKouData(lr, { diFen: '午', guirengType: 0, timeScope: 'day' });
		const year = buildJinKouData(lr, { diFen: '午', guirengType: 0, timeScope: 'year' });
		expect(day.hezhan.timeLabel).toBe('日内');
		expect(day.hezhan.chain.join('')).toContain('日、时干支');
		expect(year.hezhan.timeLabel).toBe('一年');
		expect(year.hezhan.chain.join('')).toContain('太岁');
	});

	it('课分内外：贴地分侧为内、贴人元侧为外，用爻位标记随之', ()=>{
		const d = cast('甲辰', '丙申', '申', '午');
		const nw = d.neiwai;
		expect(nw.rows.map((r)=>`${r.label}${r.side}`)).toEqual(['人元外', '贵神外', '将神内', '地分内']);
		const yongRow = nw.rows.find((r)=>r.yong);
		expect(yongRow.label).toBe(d.yongYao.label);
		expect(nw.yongSide).toBe(yongRow.side);
		expect(nw.text).toContain(nw.yongSide === '内' ? '宜主' : '宜客');
	});
});
