// 双盘挂载 · 中式合盘数据(八字合婚 + 紫微合盘)合同:只给可算出的对照事实、不出分数;复用日子馆年命合婚同一口径;
// 紫微四化表按给出四化那一方的流派(记录里存了用记录的,没存跟随当前流派);关系判定(冲合刑害 / 五行生克)逐项可核。
import { buildBaziHehunText, buildZiweiPairText, zhiRelations, wuxingRelation, pairChineseWanted } from '../pairChineseData';
import { ZWSchool, refreshActiveSiHua, getActiveSiHuaGan } from '../../constants/ZWConst';

const baziParams = (date, time, gender)=>({ date, time, zone: '+08:00', lon: '121e28', lat: '31n14', gpsLat: 31.23, gpsLon: 121.47, gender, timeAlg: 0, phaseType: 0, godKeyPos: '年日', after23NewDay: 1, lateZiHourUseNextDay: 1 });
const zwOf = (date, time, gender)=>({ birth: { date, time, zone: '+08:00', lon: '121e28', lat: '31n14', gpsLon: 121.47, gpsLat: 31.23, ad: 1, gender }, opts: { timeAlg: 0, after23NewDay: 1, lateZiHourUseNextDay: 1 } });

describe('关系判定', ()=>{
	test('地支冲合刑害 / 自刑 / 三合;五行生克以前者为主语', ()=>{
		expect(zhiRelations('子', '午')).toEqual(['六冲']);
		expect(zhiRelations('子', '丑')).toEqual(['六合']);
		expect(zhiRelations('申', '子')).toEqual(['三合(水·半合)']);
		expect(zhiRelations('申', '辰')).toEqual(['三合(水·拱合)']);
		expect(zhiRelations('寅', '巳')).toEqual(['相刑', '六害']);
		expect(zhiRelations('午', '午')).toEqual(['自刑']);
		expect(zhiRelations('午', '申')).toEqual([]);
		expect(wuxingRelation('土', '金')).toBe('土生金');
		expect(wuxingRelation('金', '土')).toBe('土生金');
		expect(wuxingRelation('水', '火')).toBe('水克火');
		expect(wuxingRelation('木', '木')).toBe('比和');
		expect(pairChineseWanted(['bazi', 'astrochart'])).toEqual({ bazi: true, ziwei: false });
	});
});

describe('八字合婚', ()=>{
	test('年命 / 日柱夫妻宫 / 喜忌互补三段齐;庚午(路旁土,属马)× 壬申(剑锋金,属猴)= 土生金;不出分数', ()=>{
		const t = buildBaziHehunText(baziParams('1990-05-18', '10:00:00', 1), baziParams('1992-03-07', '08:30:00', 0), { selfName: '张三', otherName: '李四' });
		['[年命]', '[日柱 · 夫妻宫]', '[喜忌互补]', '[说明]'].forEach((h)=>expect(t).toContain(h));
		expect(t).toContain('庚午年(路旁土),属马');
		expect(t).toContain('壬申年(剑锋金),属猴');
		expect(t).toContain('年命纳音:土 与 金,土生金');
		expect(t).toMatch(/日支\(夫妻宫\)/);
		expect(t).toMatch(/属(本人|对方)(喜用|忌神)|不在(本人|对方)喜忌中/);
		expect(t).not.toContain('属其');
		expect(t).not.toMatch(/\d+\s*分/);
	});
});

describe('紫微合盘', ()=>{
	test('双向四化入宫(按当前流派四化表)+ 命宫 / 夫妻宫主星;切流派即跟随', ()=>{
		const prev = ZWSchool.school;
		try{
			ZWSchool.school = 'beipai'; refreshActiveSiHua();
			const t = buildZiweiPairText(zwOf('1990-05-18', '10:00:00', 1), zwOf('1992-03-07', '08:30:00', 0), { selfName: '张三', otherName: '李四' });
			['[对方生年四化入本人宫位]', '[本人生年四化入对方宫位]', '[命宫 / 夫妻宫主星对照]', '[说明]'].forEach((h)=>expect(t).toContain(h));
			const ren = getActiveSiHuaGan()['壬'];
			ren.forEach((star, i)=>expect(t).toContain(`${star}化${['禄', '权', '科', '忌'][i]} → `));
			expect(t).toMatch(/本人:命宫 \S+/);
			// 宫名归一:夫妻宫有主星时必须列出(此前按「夫妻」找带「宫」字的宫名,恒报无主星)
			const a = require('../../components/ziwei/ZiweiCalc').calcZiwei(zwOf('1990-05-18', '10:00:00', 1).birth, zwOf('1990-05-18', '10:00:00', 1).opts);
			const fq = a.houses.find((h)=>`${h.name}`.replace(/宫$/, '') === '夫妻');
			const fqMain = (fq.starsMain || []).map((s)=>s.name).join(' ');
			expect(t).toContain(`夫妻宫 ${fqMain || '无主星(借对宫)'}`);
			ZWSchool.school = 'zhongzhou'; refreshActiveSiHua();
			const t2 = buildZiweiPairText(zwOf('1990-05-18', '10:00:00', 1), zwOf('1992-03-07', '08:30:00', 0));
			expect(t2).toContain('四化表:中州');
			expect(t2).toContain(`${getActiveSiHuaGan()['壬'][2]}化科`);
		}finally{
			ZWSchool.school = prev; refreshActiveSiHua();
		}
	});
});

describe('紫微合盘 · 两人各按自己的四化流派', ()=>{
	const { SiHuaTables, sihuaTableFor } = require('../../constants/ZWConst');
	test('一方记录存了流派 → 该方给出的四化按它的表;没存的一方按当前设置;标题各写各的', ()=>{
		const prev = ZWSchool.school;
		try{
			ZWSchool.school = 'beipai'; refreshActiveSiHua();
			const self = { ...zwOf('1990-05-18', '10:00:00', 1), sihua: { school: 'zhongzhou' } };   // 庚年:中州与通用化科不同
			const other = zwOf('1992-03-07', '08:30:00', 0);
			expect(SiHuaTables.zhongzhou['庚'][2]).not.toBe(SiHuaTables.beipai['庚'][2]);
			const t = buildZiweiPairText(self, other, { selfName: '张三', otherName: '李四' });
			expect(t).toContain('[本人生年四化入对方宫位](四化表:中州派,按本人记录的流派)');
			expect(t).toContain('[对方生年四化入本人宫位](四化表:通用·飞星,对方记录没存流派,按当前设置)');
			const selfLine = t.split('\n').find((l)=>l.indexOf('本人「张三」生年') === 0);
			expect(selfLine).toContain(`${SiHuaTables.zhongzhou['庚'][2]}化科`);
			const otherLine = t.split('\n').find((l)=>l.indexOf('对方「李四」生年') === 0);
			SiHuaTables.beipai['壬'].forEach((star, i)=>expect(otherLine).toContain(`${star}化${['禄', '权', '科', '忌'][i]}`));
			expect(ZWSchool.school).toBe('beipai');   // 不动当前流派单例
		}finally{
			ZWSchool.school = prev; refreshActiveSiHua();
		}
	});
	test('自定义档:随盘的表优先;表不合法回落本机取法', ()=>{
		const own = { ...SiHuaTables.beipai, 庚: ['太阳', '武曲', '天府', '天同'] };
		expect(sihuaTableFor('custom', JSON.stringify(own))['庚']).toEqual(['太阳', '武曲', '天府', '天同']);
		expect(sihuaTableFor('custom', 'not json')['庚']).toEqual(SiHuaTables.beipai['庚']);
		expect(sihuaTableFor('zhongzhou')).toBe(SiHuaTables.zhongzhou);
	});
	test('从记录取:记录里的四化流派进合盘(拼上下文那一路)', ()=>{
		const { getPairChineseTexts, __resetPairChineseCacheForTests } = require('../aiAnalysisContext');
		__resetPairChineseCacheForTests();
		const rec = (name, birth, gender, extra)=>({ cid: `local-${name}`, name, birth, zone: '+08:00', lon: '121e28', lat: '31n14', gpsLat: 31.23, gpsLon: 121.47, gender, ...(extra || {}) });
		const A = rec('张三', '1990-05-18 10:00:00', 1, { sihuaSchool: 'zhongzhou' });
		const B = rec('李四', '1992-03-07 08:30:00', 0);
		const z = getPairChineseTexts(A, B, ['ziwei'], { selfName: '张三', otherName: '李四' }).ziwei;
		expect(z).toContain('(四化表:中州派,按本人记录的流派)');
		// 换成另一流派 → 不命中旧缓存
		const z2 = getPairChineseTexts({ ...A, sihuaSchool: 'beipai' }, B, ['ziwei'], { selfName: '张三', otherName: '李四' }).ziwei;
		expect(z2).toContain('(四化表:通用·飞星,按本人记录的流派)');
	});
});

describe('紫微合盘 · 排盘口径与单盘一致', ()=>{
	const { getPairChineseTexts, __resetPairChineseCacheForTests } = require('../aiAnalysisContext');
	const { ZWEngineOptions } = require('../../components/ziwei/ziweiOptions');
	const rec = (name, birth, gender, extra)=>({ cid: `local-${name}`, name, birth, zone: '+08:00', lon: '121e28', lat: '31n14', gpsLat: 31.23, gpsLon: 121.47, gender, ...(extra || {}) });
	test('生在立春之后、正月初一之前(2024-02-06):按紫微缺省「正月初一」定年 = 癸年四化(此前按立春 = 甲年)', ()=>{
		__resetPairChineseCacheForTests();
		expect(ZWEngineOptions.yearBoundary).toBe('lunar_1_1');
		const z = getPairChineseTexts(rec('甲', '2024-02-06 10:00:00', 1), rec('乙', '1992-03-07 08:30:00', 0), ['ziwei'], { selfName: '甲', otherName: '乙' }).ziwei;
		expect(z).toContain('本人「甲」生年 癸');
		const z2 = getPairChineseTexts(rec('甲', '2024-02-06 10:00:00', 1, { yearBoundary: 'lichun' }), rec('乙', '1992-03-07 08:30:00', 0), ['ziwei'], { selfName: '甲', otherName: '乙' }).ziwei;
		expect(z2).toContain('本人「甲」生年 甲');   // 记录显式存了立春定年 → 按记录
	});
	test('记录改了时间算法 → 不命中旧缓存', ()=>{
		__resetPairChineseCacheForTests();
		const A = rec('甲', '2023-11-03 10:56:00', 1);
		const B = rec('乙', '1992-03-07 08:30:00', 0);
		const a0 = getPairChineseTexts({ ...A, timeAlg: 0 }, B, ['ziwei', 'bazi'], { selfName: '甲', otherName: '乙' });
		const a1 = getPairChineseTexts({ ...A, timeAlg: 1 }, B, ['ziwei', 'bazi'], { selfName: '甲', otherName: '乙' });
		__resetPairChineseCacheForTests();
		const fresh1 = getPairChineseTexts({ ...A, timeAlg: 1 }, B, ['ziwei', 'bazi'], { selfName: '甲', otherName: '乙' });
		expect(a1).toEqual(fresh1);
		expect(a0.ziwei === a1.ziwei && a0.bazi === a1.bazi).toBe(false);
	});
});

describe('接进拼上下文', ()=>{
	const { buildContextLayers, getPairChineseTexts, __resetPairChineseCacheForTests } = require('../aiAnalysisContext');
	const rec = (name, birth, gender)=>({ cid: `local-${name}`, name, birth, zone: '+08:00', lon: '121e28', lat: '31n14', gpsLat: 31.23, gpsLon: 121.47, gender });
	const A = rec('张三', '1990-05-18 10:00:00', 1);
	const B = rec('李四', '1992-03-07 08:30:00', 0);
	test('只算挂了的那门;没记录 / 都没挂 = 空;同一对按缓存返回同一份', ()=>{
		__resetPairChineseCacheForTests();
		expect(getPairChineseTexts(A, B, ['astrochart'])).toEqual({ bazi: '', ziwei: '' });
		expect(getPairChineseTexts(null, B, ['bazi'])).toEqual({ bazi: '', ziwei: '' });
		const onlyBazi = getPairChineseTexts(A, B, ['bazi'], { selfName: '张三', otherName: '李四' });
		expect(onlyBazi.bazi).toContain('[年命]');
		expect(onlyBazi.ziwei).toBe('');
		const both = getPairChineseTexts(A, B, ['ziwei', 'bazi'], { selfName: '张三', otherName: '李四' });
		expect(both.bazi).toBe(onlyBazi.bazi);
		expect(both.ziwei).toContain('[对方生年四化入本人宫位]');
		expect(getPairChineseTexts(A, B, ['ziwei', 'bazi'], { selfName: '张三', otherName: '李四' })).toEqual(both);
	});
	test('buildContextLayers:给了中式对照才出 pair: 层(紧跟案例前提、在技法层之前);说明层点名;不给 = 双盘原样', ()=>{
		const base = { sourceContext: { title: '张三', content: '[起盘信息]\n张三' }, techniqueContexts: [{ key: 'bazi', title: '八字', content: '[四柱]\n庚午' }], systemPrompt: '系统', materials: [], bundles: [], templates: [], retrievedChunks: [], conversationMessages: [] };
		const partner = { title: '李四', sourceContext: { title: '李四', content: '[起盘信息]\n李四' }, techniqueContexts: [{ key: 'bazi', title: '八字', content: '[四柱]\n壬申' }] };
		const plain = buildContextLayers({ ...base, partner });
		expect(plain.some((l)=>l.key.indexOf('pair:') === 0)).toBe(false);
		const withCn = buildContextLayers({ ...base, partner: { ...partner, chinese: { bazi: '[年命]\n…', ziwei: '[对方生年四化入本人宫位]\n…' } } });
		const keys = withCn.slice(0).sort((a, b)=>b.priority - a.priority).map((l)=>l.key);
		expect(keys.indexOf('pair:bazi-hehun')).toBeGreaterThan(keys.indexOf('dayBoundaryRule'));
		expect(keys.indexOf('pair:ziwei')).toBeLessThan(keys.indexOf('technique:bazi'));
		expect(withCn.find((l)=>l.key === 'pair:bazi-hehun').title).toBe('八字合婚对照：张三 × 李四');
		expect(withCn.find((l)=>l.key === 'pair-rule').content).toContain('八字合婚对照、紫微合盘对照');
	});
});

// ───────── 两人逐柱对照 / 合局 / 命身互落:数值合同(样例逐项人工核过:四柱按节气月与六十甲子日序、紫微按命身起法与四化表) ─────────
describe('干支关系 · 与八字引擎同一套规则表(全表对拍独立手写的古法表)', ()=>{
	const { ganRelations, zhiRelations: zr } = require('../pairChineseData');
	const { pairBranchRelations, crossBranchFormations } = require('../baziLunarLocal');
	const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');
	const GAN = '甲乙丙丁戊己庚辛壬癸'.split('');
	const pairIn = (list, a, b)=>list.some((p)=>(p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
	const CHONG = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
	const HE6 = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
	const SANHE = [['申子辰', '水'], ['亥卯未', '木'], ['寅午戌', '火'], ['巳酉丑', '金']];
	const XING = ['寅巳', '巳申', '申寅', '丑戌', '戌未', '未丑', '子卯'];
	const SELF_XING = '辰午酉亥';
	const HAI = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
	test('地支 12×12 逐对:六冲 / 六合 / 三合 / 相刑 / 自刑 / 六害 与古法表一致', ()=>{
		ZHI.forEach((a)=>ZHI.forEach((b)=>{
			const want = [];
			if(pairIn(CHONG, a, b)){ want.push('六冲'); }
			if(pairIn(HE6, a, b)){ want.push('六合'); }
			const sh = SANHE.find(([g])=>a !== b && g.indexOf(a) >= 0 && g.indexOf(b) >= 0);
			if(sh){ want.push(`三合(${sh[1]}·${a === sh[0][1] || b === sh[0][1] ? '半合' : '拱合'})`); }
			if(a !== b && pairIn(XING, a, b)){ want.push('相刑'); }
			if(a === b && SELF_XING.indexOf(a) >= 0){ want.push('自刑'); }
			if(pairIn(HAI, a, b)){ want.push('六害'); }
			expect(`${a}${b}:${zr(a, b).join('、')}`).toBe(`${a}${b}:${want.join('、')}`);
		}));
		// 寅申既冲又刑(申刑寅),丑未既冲又刑
		expect(pairBranchRelations('寅', '申').map((h)=>h.kind)).toEqual(['ziCong', 'ziXing']);
		expect(zr('丑', '未')).toEqual(['六冲', '相刑']);
	});
	test('天干 10×10 逐对:五合(合化)/ 相冲(甲庚 乙辛 丙壬 丁癸)', ()=>{
		const HE = [['甲己', '土'], ['乙庚', '金'], ['丙辛', '水'], ['丁壬', '木'], ['戊癸', '火']];
		const CHONG_G = ['甲庚', '乙辛', '丙壬', '丁癸'];
		GAN.forEach((a)=>GAN.forEach((b)=>{
			const want = [];
			const he = HE.find(([p])=>pairIn([p], a, b));
			if(he){ want.push(`五合(合化${he[1]})`); }
			if(pairIn(CHONG_G, a, b)){ want.push('相冲'); }
			expect(`${a}${b}:${ganRelations(a, b).join('、')}`).toBe(`${a}${b}:${want.join('、')}`);
		}));
	});
	test('两人合局:三支齐、两人各出至少一支才算;一方自己已齐的不算两人合局', ()=>{
		const L = (s, tag)=>s.split('').map((c, i)=>({ cell: c, label: `${tag}${i}` }));
		expect(crossBranchFormations(L('申辰', 'a'), L('子', 'b')).map((f)=>f.key)).toEqual(['申子辰合水']);
		expect(crossBranchFormations(L('申子辰', 'a'), L('子', 'b'))).toEqual([]);   // 本人自己已齐
		expect(crossBranchFormations(L('申午', 'a'), L('子', 'b'))).toEqual([]);     // 缺辰
		expect(crossBranchFormations(L('寅卯', 'a'), L('辰酉', 'b')).map((f)=>f.key)).toEqual(['寅卯辰会木']);
		const x = crossBranchFormations(L('丑', 'a'), L('戌未', 'b'));
		expect(x.map((f)=>f.key)).toEqual(['丑戌未三刑']);
		expect(x[0].fromA.map((i)=>i.cell)).toEqual(['丑']);
		expect(x[0].fromB.map((i)=>i.cell)).toEqual(['戌', '未']);
	});
});

describe('八字合婚 · 四柱逐柱对照与两人合局(人工核过的样例)', ()=>{
	const line = (t, head)=>t.split('\n').find((l)=>l.indexOf(head) === 0);
	const block = (t, header)=>{ const ls = t.split('\n'); const i = ls.findIndex((l)=>l.indexOf(header) === 0); const out = []; for(let k = i + 1; k < ls.length && ls[k].charAt(0) !== '['; k++){ out.push(ls[k]); } return out; };
	test('样例一 庚午 辛巳 癸未 丁巳 × 壬申 癸卯 壬午 甲辰:日支未午六合;巳午未是本人自己齐的三会、不算两人合局', ()=>{
		const t = buildBaziHehunText(baziParams('1990-05-18', '10:00:00', 1), baziParams('1992-03-07', '08:30:00', 0));
		expect(block(t, '[四柱逐柱对照]')).toEqual([
			'年柱 庚午 × 壬申:天干 庚壬 无合冲;地支 午申 无冲合刑害',
			'月柱 辛巳 × 癸卯:天干 辛癸 无合冲;地支 巳卯 无冲合刑害',
			'日柱 癸未 × 壬午:天干 癸壬 无合冲;地支 未午 六合',
			'时柱 丁巳 × 甲辰:天干 丁甲 无合冲;地支 巳辰 无冲合刑害',
		]);
		expect(block(t, '[两人地支合局]')).toEqual(['无(两人地支合起来没有新齐的三合局 / 三会局 / 三刑)']);
		expect(line(t, '日干 ')).toBe('日干 癸壬:无合冲;日主五行 水 与 水,比和');
		expect(line(t, '日支(夫妻宫)')).toBe('日支(夫妻宫)未午:六合');
	});
	test('样例二 甲子 己巳 丙寅 癸巳 × 己卯 丁丑 壬申 壬寅:甲己五合 / 子卯相刑 / 丙壬相冲 / 寅申六冲且相刑 / 巳寅刑害 / 寅巳申两人凑成三刑', ()=>{
		const t = buildBaziHehunText(baziParams('1984-06-01', '10:00:00', 1), baziParams('2000-01-15', '04:00:00', 1));
		expect(block(t, '[四柱逐柱对照]')).toEqual([
			'年柱 甲子 × 己卯:天干 甲己 五合(合化土);地支 子卯 相刑',
			'月柱 己巳 × 丁丑:天干 己丁 无合冲;地支 巳丑 三合(金·拱合)',
			'日柱 丙寅 × 壬申:天干 丙壬 相冲;地支 寅申 六冲、相刑',
			'时柱 癸巳 × 壬寅:天干 癸壬 无合冲;地支 巳寅 相刑、六害',
		]);
		expect(block(t, '[两人地支合局]')).toEqual(['寅巳申三刑:本人 月支巳、日支寅、时支巳;对方 日支申、时支寅']);
		expect(line(t, '生肖(年支')).toBe('生肖(年支 子卯):相刑');
		expect(line(t, '日干 ')).toBe('日干 丙壬:天干相冲;日主五行 火 与 水,水克火');
		expect(line(t, '日支(夫妻宫)')).toBe('日支(夫妻宫)寅申:六冲、相刑');
		// 互换两人:本人 / 对方随之互换,关系不变
		const r = buildBaziHehunText(baziParams('2000-01-15', '04:00:00', 1), baziParams('1984-06-01', '10:00:00', 1));
		expect(block(r, '[两人地支合局]')).toEqual(['寅巳申三刑:本人 日支申、时支寅;对方 月支巳、日支寅、时支巳']);
		expect(line(r, '日柱 ')).toBe('日柱 壬申 × 丙寅:天干 壬丙 相冲;地支 申寅 六冲、相刑');
	});
	test('样例三 壬申 癸卯 壬午 甲辰 × 丙子 庚子 壬午 庚子(23:30 子初换日):申子辰两人凑齐三合水局 / 子卯刑 / 午午自刑且日柱相同 / 甲庚 壬丙相冲', ()=>{
		const t = buildBaziHehunText(baziParams('1992-03-07', '08:30:00', 0), baziParams('1996-12-10', '23:30:00', 0));
		expect(block(t, '[四柱逐柱对照]')).toEqual([
			'年柱 壬申 × 丙子:天干 壬丙 相冲;地支 申子 三合(水·半合)',
			'月柱 癸卯 × 庚子:天干 癸庚 无合冲;地支 卯子 相刑',
			'日柱 壬午 × 壬午:天干 壬壬 无合冲;地支 午午 自刑(两人此柱干支相同)',
			'时柱 甲辰 × 庚子:天干 甲庚 相冲;地支 辰子 三合(水·半合)',
		]);
		expect(block(t, '[两人地支合局]')).toEqual(['申子辰三合水局:本人 年支申、时支辰;对方 年支子、月支子、时支子']);
		expect(line(t, '生肖(年支')).toBe('生肖(年支 申子):三合(水·半合)');
		expect(line(t, '日支(夫妻宫)')).toBe('日支(夫妻宫)午午:自刑');
	});
	test('样例四 庚午 × 丙子:年支子午六冲(生肖相冲),年命合婚口径照列;只列事实不出分数', ()=>{
		const t = buildBaziHehunText(baziParams('1990-05-18', '10:00:00', 1), baziParams('1996-12-10', '23:30:00', 0));
		expect(line(t, '生肖(年支')).toBe('生肖(年支 午子):六冲');
		expect(line(t, '年柱 ')).toBe('年柱 庚午 × 丙子:天干 庚丙 无合冲;地支 午子 六冲');
		expect(line(t, '年命纳音')).toContain('土 与 水,土克水');
		expect(t).not.toMatch(/\d+\s*分|大吉|大凶|不宜婚配/);
	});
});

describe('紫微合盘 · 命宫 / 身宫互落与四化入宫带地支(人工核过的样例)', ()=>{
	const line = (t, head)=>t.split('\n').find((l)=>l.indexOf(head) === 0);
	const withSchool = (school, fn)=>{ const prev = ZWSchool.school; try{ ZWSchool.school = school; refreshActiveSiHua(); return fn(); }finally{ ZWSchool.school = prev; refreshActiveSiHua(); } };
	test('样例一 庚午年 命子身戌 × 壬申年 命亥身未(通用·飞星;中州派化科随之改天府)', ()=>{
		const t = withSchool('beipai', ()=>buildZiweiPairText(zwOf('1990-05-18', '10:00:00', 1), zwOf('1992-03-07', '08:30:00', 0), { selfName: '张三', otherName: '李四' }));
		expect(line(t, '对方「李四」生年')).toBe('对方「李四」生年 壬:天梁化禄 → 官禄宫(辰);紫微化权 → 交友宫(巳);左辅化科 → 疾厄宫(未);武曲化忌 → 父母宫(丑)');
		expect(line(t, '本人「张三」生年')).toBe('本人「张三」生年 庚:太阳化禄 → 命宫(亥);武曲化权 → 兄弟宫(戌);太阴化科 → 官禄宫(卯);天同化忌 → 夫妻宫(酉)');
		expect(t).toContain('[对方命宫 / 身宫落入本人宫位]\n对方命宫在亥 → 本人兄弟宫;对方身宫在未 → 本人疾厄宫');
		expect(t).toContain('[本人命宫 / 身宫落入对方宫位]\n本人命宫在子 → 对方父母宫;本人身宫在戌 → 对方兄弟宫');
		const z = withSchool('zhongzhou', ()=>buildZiweiPairText(zwOf('1990-05-18', '10:00:00', 1), zwOf('1992-03-07', '08:30:00', 0), { selfName: '张三', otherName: '李四' }));
		expect(line(z, '对方「李四」生年')).toContain('天府化科 → 兄弟宫(亥)');
		expect(line(z, '本人「张三」生年')).toContain('天府化科 → 田宅宫(寅)');
	});
	test('样例二 甲子年 命丑身亥 × 丙子年 午时命身同宫于午', ()=>{
		const t = withSchool('beipai', ()=>buildZiweiPairText(zwOf('1984-06-01', '10:00:00', 1), zwOf('1996-12-20', '12:00:00', 0)));
		expect(line(t, '对方「对方」生年')).toBe('对方「对方」生年 丙:天同化禄 → 财帛宫(酉);天机化权 → 命宫(丑);文昌化科 → 官禄宫(巳);廉贞化忌 → 交友宫(午)');
		expect(line(t, '本人「本人」生年')).toBe('本人「本人」生年 甲:廉贞化禄 → 官禄宫(戌);破军化权 → 福德宫(申);武曲化科 → 财帛宫(寅);太阳化忌 → 子女宫(卯)');
		expect(line(t, '对方命宫在')).toBe('对方命宫在午 → 本人交友宫;对方身宫在午 → 本人交友宫(命身同宫)');
		expect(line(t, '本人命宫在')).toBe('本人命宫在丑 → 对方疾厄宫;本人身宫在亥 → 对方交友宫');
	});
	test('选了地盘的一方:命宫按地盘(= 身宫所在),标题注明', ()=>{
		const t = withSchool('beipai', ()=>buildZiweiPairText({ ...zwOf('1990-05-18', '10:00:00', 1), sanPan: 'di' }, zwOf('1992-03-07', '08:30:00', 0)));
		expect(t).toContain('[本人命宫 / 身宫落入对方宫位](本人按地盘)');
		expect(t).toContain('[对方命宫 / 身宫落入本人宫位](本人按地盘)');
		expect(line(t, '本人命宫在')).toBe('本人命宫在戌 → 对方兄弟宫;本人身宫在戌 → 对方兄弟宫(命身同宫)');
	});
});

describe('单盘挂载不受影响', ()=>{
	const { buildContextLayers } = require('../aiAnalysisContext');
	const base = { sourceContext: { title: '张三', content: '[起盘信息]\n张三' }, techniqueContexts: [{ key: 'bazi', title: '八字', content: '[四柱]\n庚午' }, { key: 'ziwei', title: '紫微', content: '[宫位总览]\n命宫' }], systemPrompt: '系统', materials: [], bundles: [], templates: [], retrievedChunks: [], conversationMessages: [] };
	test('没有合盘对方:不出任何两人数据层;给 null / 不给 partner 逐字节相同', ()=>{
		const a = JSON.stringify(buildContextLayers(base));
		expect(JSON.stringify(buildContextLayers({ ...base, partner: null }))).toBe(a);
		expect(JSON.stringify(buildContextLayers({ ...base, partner: undefined }))).toBe(a);
		['pair:', 'pair-rule', '四柱逐柱对照', '两人地支合局', '命宫 / 身宫落入'].forEach((s)=>expect(a).not.toContain(s));
	});
});
