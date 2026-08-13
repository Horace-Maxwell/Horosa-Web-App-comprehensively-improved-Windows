// 改造化煞 golden —— 形煞二十 / 气煞二十三 / 补偏救弊五法 / 化解用品。
// 🔴 三条口径在此机器钉死：
//   ① 气煞所临之方安静无动象则一般不出灾 —— 「有动象/恶山恶水」才是发灾的闸，不可省。
//   ② 传本未给判据者（力士 / 戊己都天 / 暗建煞）只在用户登记宫位时才判，绝不自造规则。
//   ③ 本派不改任何既有引擎之判：飞星盘照 xuankong 取，只据盘出化解方案。
import { huasha } from '../huasha';
import {
	BUPIAN_5, XINGSHA_20, QISHA_RIKE, QISHA_LIQI, LINGXING_SHA,
	HUAJIE_WUPIN, QISHA_TRIGGER, XINGSHA_LEIBIE, XINGSHA_WEIHAI_3,
} from '../fengshuiHuashaData';
import { xuankong } from '../xuankong';

const H = (o)=>huasha({ xiangShan: '午', yun: 8, year: null, ...o });

describe('数据完整性（传本枚举）', ()=>{
	it('补偏救弊五法 / 形煞二十 / 气煞日课七 / 气煞理气十五 / 形煞四类 / 危害三等', ()=>{
		expect(BUPIAN_5).toHaveLength(5);
		expect(XINGSHA_20).toHaveLength(20);
		expect(QISHA_RIKE).toHaveLength(7);
		expect(QISHA_LIQI).toHaveLength(15);
		expect(XINGSHA_LEIBIE).toHaveLength(4);
		expect(XINGSHA_WEIHAI_3).toHaveLength(3);
		expect(QISHA_TRIGGER).toHaveLength(3);
	});
	it('气煞合计二十三（日课七 + 理气十五 + 令星煞一）', ()=>{
		expect(QISHA_RIKE.length + QISHA_LIQI.length + 1).toBe(23);
		expect(LINGXING_SHA.key).toBe('lingxing');
	});
	it('每条形煞都有释义/危害/化解，键不重复', ()=>{
		const keys = new Set();
		XINGSHA_20.forEach((x)=>{
			expect(x.def).toBeTruthy(); expect(x.harm).toBeTruthy();
			expect(Array.isArray(x.fix) && x.fix.length).toBeTruthy();
			expect(keys.has(x.key)).toBe(false); keys.add(x.key);
		});
	});
	it('形煞与气煞各有一个「穿心煞」，同名异实必须两存并标出', ()=>{
		expect(XINGSHA_20.find((x)=>x.key === 'chuanxin').name).toBe('穿心煞（形煞）');
		expect(QISHA_LIQI.find((x)=>x.key === 'chuanxinQi').name).toBe('穿心煞（气煞）');
	});
	it('化解用品三十枚，各有用途', ()=>{
		expect(HUAJIE_WUPIN).toHaveLength(30);
		HUAJIE_WUPIN.forEach((w)=>{ expect(w.name).toBeTruthy(); expect(w.use).toBeTruthy(); });
	});
	it('🔴 259 合局煞：标题与释义不一致处已存疑标注，判据取释义正文 2·5·9', ()=>{
		const s = QISHA_LIQI.find((x)=>x.key === 'he259');
		expect(s.combo).toEqual([2, 5, 9]);
		expect(s.conflict).toMatch(/标题作「257 合局煞」/);
		expect(s.conflict).toMatch(/正文为唯一权威/);
	});
});

describe('形煞', ()=>{
	it('勾一煞出释义/危害/化解；未勾不出', ()=>{
		expect(H({}).xingSha).toHaveLength(0);
		const r = H({ xingSha: [{ key: 'qiang', gong: 1 }] });
		expect(r.xingSha).toHaveLength(1);
		expect(r.xingSha[0].name).toBe('枪煞');
		expect(r.xingSha[0].dir).toBeTruthy();
		expect(r.xingSha[0].fixList.length).toBeGreaterThan(0);
	});
	it('🔴「冲入何卦宫多应此宫所主之人」只在登记受煞方时给出，未登记不臆断', ()=>{
		expect(H({ xingSha: [{ key: 'qiang', gong: 0 }] }).xingSha[0].ying).toBeNull();
		const y = H({ xingSha: [{ key: 'qiang', gong: 3 }] }).xingSha[0].ying;
		expect(y).toMatch(/冲入震宫/);
		expect(y).toMatch(/飞星组合/);            // 有盘时并带该宫星气
	});
	it('无「冲宫应人」属性之煞不给应人（如反光煞）', ()=>{
		expect(H({ xingSha: [{ key: 'fanguang', gong: 1 }] }).xingSha[0].ying).toBeNull();
	});
	it('fixSameAs 型的化解正确取到源条（三煞同岁破）', ()=>{
		const r = huasha({ xiangShan: '午', yun: 8, year: 2013 });
		const ss = r.qiShaRike.find((x)=>x.key === 'sansha');
		const sp = r.qiShaRike.find((x)=>x.key === 'suipo');
		expect(ss.fixList).toEqual(sp.fixList);
		expect(ss.fixList[0]).toMatch(/退出地母/);
	});
	it('非法 key 被滤，脏入参不抛', ()=>{
		expect(H({ xingSha: [{ key: 'X', gong: 1 }, null, 5] }).xingSha).toHaveLength(0);
		[{ xingSha: 'x' }, { env: null }, { xingSha: [{ key: 'qiang', gong: 'x' }] }].forEach((o)=>{
			expect(()=>H(o)).not.toThrow();
		});
	});
});

describe('气煞 · 日课类', ()=>{
	it('不给年份 → 日课煞整组不出（零臆断）', ()=>{
		expect(H({ year: null }).qiShaRike).toHaveLength(0);
		expect(H({ year: null }).yearGods).toBeNull();
	});
	it('岁破逐年随太岁对冲；癸巳年岁破在亥', ()=>{
		const r = huasha({ xiangShan: '午', yun: 8, year: 2013, zuoShanForRike: '亥' });
		const sp = r.qiShaRike.find((x)=>x.key === 'suipo');
		expect(sp.detail).toMatch(/癸巳年太岁在巳，岁破在亥/);
		expect(sp.zuoHit).toBe(true);
		// 坐山不犯时如实说不犯
		const r2 = huasha({ xiangShan: '午', yun: 8, year: 2013, zuoShanForRike: '子' });
		expect(r2.qiShaRike.find((x)=>x.key === 'suipo').zuoHit).toBe(false);
		expect(r2.qiShaRike.find((x)=>x.key === 'suipo').detail).toMatch(/不犯岁破/);
	});
	it('三煞出三方（劫煞/灾煞/岁煞各一），癸巳年三煞在东', ()=>{
		const r = huasha({ xiangShan: '午', yun: 8, year: 2013 });
		const ss = r.qiShaRike.filter((x)=>x.key === 'sansha');
		expect(ss).toHaveLength(3);
		expect(ss.map((x)=>x.detail).join('')).toMatch(/劫煞/);
		expect(ss.map((x)=>x.detail).join('')).toMatch(/金局|巳酉丑/);   // 巳年属金局
	});
	it('🔴 力士/戊己都天/暗建：不登记宫位则整条不出；登记后才判，且口径注明未载', ()=>{
		const off = huasha({ xiangShan: '午', yun: 8, year: 2013 });
		['wuhuangLishi', 'duTianWuhuang', 'anjian'].forEach((k)=>{
			expect(off.qiShaRike.find((x)=>x.key === k)).toBeUndefined();
		});
		const on = huasha({ xiangShan: '午', yun: 8, year: 2013, lishiGong: 3, duTianGong: 4, anJianGong: 6 });
		['wuhuangLishi', 'duTianWuhuang', 'anjian'].forEach((k)=>{
			const hit = on.qiShaRike.find((x)=>x.key === k);
			expect(hit).toBeTruthy();
			expect(hit.note).toMatch(/传本未给表|传本未载/);
		});
	});
	it('登记之宫与年五黄不同宫 → 如实报「不成此煞」，不硬判成立', ()=>{
		const r = huasha({ xiangShan: '午', yun: 8, year: 2013, lishiGong: 1 });
		const li = r.qiShaRike.find((x)=>x.key === 'wuhuangLishi');
		expect(typeof li.hit).toBe('boolean');
		if (!li.hit) { expect(li.detail).toMatch(/不成此煞/); }
	});
	it('🔴 动静闸：所临之方安静 → fires 为 false；有动象或恶山恶水 → true', ()=>{
		const y = 2013;
		const quiet = huasha({ xiangShan: '午', yun: 8, year: y, env: {} });
		expect(quiet.qiShaRike.every((x)=>x.fires === false)).toBe(true);
		const sp = quiet.qiShaRike.find((x)=>x.key === 'suipo');
		const loud = huasha({ xiangShan: '午', yun: 8, year: y, env: { [sp.gong]: 'dong' } });
		expect(loud.qiShaRike.find((x)=>x.key === 'suipo').fires).toBe(true);
		const bad = huasha({ xiangShan: '午', yun: 8, year: y, env: { [sp.gong]: 'eshan' } });
		expect(bad.qiShaRike.find((x)=>x.key === 'suipo').fires).toBe(true);
	});
});

describe('气煞 · 理气类（飞星组合）', ()=>{
	it('无盘（不给向首也不给 palaces）→ 理气类整组不出', ()=>{
		const r = huasha({ xiangShan: '', yun: 8 });
		expect(r.hasPan).toBe(false);
		expect(r.qiShaLiqi).toHaveLength(0);
	});
	it('自造盘：5·2 同宫 → 黄黑煞；6·7 同宫 → 交剑煞', ()=>{
		const pal = [{ gong: 1, shan: 5, xiang: 2, yun: 3 }];
		expect(huasha({ palaces: pal, yun: 8 }).qiShaLiqi.map((x)=>x.key)).toContain('huangheisha');
		const pal2 = [{ gong: 1, shan: 6, xiang: 7, yun: 3 }];
		expect(huasha({ palaces: pal2, yun: 8 }).qiShaLiqi.map((x)=>x.key)).toContain('jiaojian');
	});
	it('三星组合须三星俱见（957/259/345/824/369/379）', ()=>{
		const mk = (a, b, c)=>[{ gong: 1, shan: a, xiang: b, yun: c }];
		expect(huasha({ palaces: mk(9, 5, 7), yun: 8 }).qiShaLiqi.map((x)=>x.key)).toContain('he957');
		expect(huasha({ palaces: mk(2, 5, 9), yun: 8 }).qiShaLiqi.map((x)=>x.key)).toContain('he259');
		expect(huasha({ palaces: mk(3, 4, 5), yun: 8 }).qiShaLiqi.map((x)=>x.key)).toContain('he345');
		expect(huasha({ palaces: mk(8, 2, 4), yun: 8 }).qiShaLiqi.map((x)=>x.key)).toContain('he824');
		expect(huasha({ palaces: mk(3, 6, 9), yun: 8 }).qiShaLiqi.map((x)=>x.key)).toContain('he369');
		expect(huasha({ palaces: mk(3, 7, 9), yun: 8 }).qiShaLiqi.map((x)=>x.key)).toContain('he369');
		// 少一星即不成
		expect(huasha({ palaces: mk(9, 5, 1), yun: 8 }).qiShaLiqi.map((x)=>x.key)).not.toContain('he957');
	});
	it('阴神满地：二四七九中两颗以上同宫方成', ()=>{
		const k = (a, b, c)=>huasha({ palaces: [{ gong: 1, shan: a, xiang: b, yun: c }], yun: 8 }).qiShaLiqi.map((x)=>x.key);
		expect(k(2, 4, 1)).toContain('yinshen');
		expect(k(7, 9, 1)).toContain('yinshen');
		expect(k(2, 1, 3)).not.toContain('yinshen');       // 只一颗阴星
		// 🔴 同一颗阴星重复出现不作两颗（传本所列化解全是相异两星之配：4-2/2-7/4-7/2-9/4-9）
		expect(k(9, 9, 5)).not.toContain('yinshen');
		expect(k(2, 2, 1)).not.toContain('yinshen');
		expect(k(9, 9, 2)).toContain('yinshen');           // 另有一颗相异阴星则成
	});
	it('🔴 木煞须失令：三碧四绿在当运或生气运时不成煞', ()=>{
		const at = (yun)=>huasha({ palaces: [{ gong: 1, shan: 3, xiang: 4, yun: 1 }], yun }).qiShaLiqi.map((x)=>x.key);
		expect(at(3)).not.toContain('musha');              // 3 当运
		expect(at(2)).not.toContain('musha');              // 生气＝3
		expect(at(8)).toContain('musha');                  // 失令
	});
	it('斗牛煞两式（2·3 或 8·3）皆成', ()=>{
		const k = (a, b)=>huasha({ palaces: [{ gong: 1, shan: a, xiang: b, yun: 1 }], yun: 8 }).qiShaLiqi.map((x)=>x.key);
		expect(k(2, 3)).toContain('douniu');
		expect(k(8, 3)).toContain('douniu');
	});
	it('先后天火煞两式（2·7 或 7·9）皆成', ()=>{
		const k = (a, b)=>huasha({ palaces: [{ gong: 1, shan: a, xiang: b, yun: 1 }], yun: 8 }).qiShaLiqi.map((x)=>x.key);
		expect(k(2, 7)).toContain('xianhouhuo');
		expect(k(7, 9)).toContain('xianhouhuo');
	});
	it('🔴 动静闸同样管理气类：静则 fires 假、动/恶山恶水则真', ()=>{
		const pal = [{ gong: 1, shan: 5, xiang: 2, yun: 3 }];
		expect(huasha({ palaces: pal, yun: 8 }).qiShaLiqi[0].fires).toBe(false);
		expect(huasha({ palaces: pal, yun: 8, env: { 1: 'dong' } }).qiShaLiqi[0].fires).toBe(true);
		expect(huasha({ palaces: pal, yun: 8, env: { 1: 'jing' } }).qiShaLiqi[0].fires).toBe(false);
	});
	it('中宫不参与理气类扫描', ()=>{
		expect(huasha({ palaces: [{ gong: 5, shan: 5, xiang: 2, yun: 3 }], yun: 8 }).qiShaLiqi).toHaveLength(0);
	});
	it('真盘接入：xuankong 八运向午之盘可直接扫出组合煞（不改其本判）', ()=>{
		const xk = xuankong(8, '午', {});
		const r = huasha({ xiangShan: '午', yun: 8 });
		expect(r.hasPan).toBe(true);
		expect(xuankong(8, '午', {}).ge).toBe(xk.ge);        // 本派不动玄空之判
		r.qiShaLiqi.forEach((x)=>{ expect([1, 2, 3, 4, 6, 7, 8, 9]).toContain(x.gong); });
	});
});

describe('令星煞', ()=>{
	it('阳宅未登记错位之用 → 不成煞，据实说明', ()=>{
		const r = H({ zhaiType: 'yang' });
		expect(r.lingXing.hit).toBe(false);
		expect(r.lingXing.verdict.jx).toBe('neutral');
		expect(r.lingXing.verdict.text).toMatch(/未登记/);
	});
	it('阳宅当令向星之宫作厨灶/卫生间/储藏间 → 成煞，并给阳宅化解', ()=>{
		['zao', 'wei', 'chu'].forEach((u)=>{
			const r = H({ zhaiType: 'yang', lingXingUse: u });
			expect(r.lingXing.hit).toBe(true);
			expect(r.lingXing.verdict.jx).toBe('bad');
			expect(r.lingXing.fixList).toBe(LINGXING_SHA.fixYang);
		});
	});
	it('阴宅当令向星上山 → 成煞，并给阴宅化解（山龙几乎无法化解）', ()=>{
		const r = H({ zhaiType: 'yin', lingXingShangShan: true });
		expect(r.lingXing.hit).toBe(true);
		expect(r.lingXing.fixList).toBe(LINGXING_SHA.fixYin);
		expect(r.lingXing.fixList[0]).toMatch(/迁移坟墓/);
	});
	it('当令向星所居之宫由盘算出（非中宫）', ()=>{
		const r = H({});
		expect(r.lingXing.wangXiangStar).toBe(8);
		expect([1, 2, 3, 4, 6, 7, 8, 9]).toContain(r.lingXing.gong);
	});
});

describe('总断与化解用品归并', ()=>{
	it('一项未登记 → 中性结论并指路', ()=>{
		const r = huasha({ xiangShan: '', yun: 8 });
		expect(r.total).toBe(0);
		expect(r.verdict.jx).toBe('neutral');
		expect(r.verdict.text).toMatch(/未登记任何煞/);
	});
	it('有煞但全静 → 中性（仍宜预备）；有动象 → 判凶须即化解', ()=>{
		const pal = [{ gong: 1, shan: 5, xiang: 2, yun: 3 }];
		const quiet = huasha({ palaces: pal, yun: 8 });
		expect(quiet.verdict.jx).toBe('neutral');
		expect(quiet.verdict.text).toMatch(/一般不会出灾/);
		const loud = huasha({ palaces: pal, yun: 8, env: { 1: 'dong' } });
		expect(loud.verdict.jx).toBe('bad');
		expect(loud.verdict.text).toMatch(/须即化解/);
	});
	it('化解用品按所出化解法归并（用到葫芦即列葫芦）', ()=>{
		const r = H({ xingSha: [{ key: 'tianqiao', gong: 9 }] });
		expect(r.wupin.map((w)=>w.key)).toContain('hulu');
		expect(r.wupin.map((w)=>w.key)).toContain('qilin');
		expect(H({}).wupin.length).toBeLessThan(r.wupin.length);
	});
	it('补偏救弊五法常驻输出', ()=>{
		expect(H({}).buPian).toHaveLength(5);
		expect(H({}).buPian.map((b)=>b.key)).toEqual(['yinshui', 'peilong', 'xiubu', 'zhenwu', 'zhongzhi']);
	});
	it('远近之限与危害三等随判输出', ()=>{
		expect(H({}).yuanJin).toMatch(/200 米以外/);
		expect(H({}).yuanJin).toMatch(/天堑煞、辐射煞/);
		expect(H({}).weiHai3.map((w)=>w.level)).toEqual(['轻', '重', '更重']);
	});
	it('脏入参一律不抛且不 NaN', ()=>{
		[{}, { zhaiType: 'X' }, { yun: 'x' }, { palaces: 'x' }, { env: 'x' }, { year: 'x' },
			{ lishiGong: 'x', duTianGong: null, anJianGong: [] }].forEach((o)=>{
			const r = huasha(o);
			expect(r.available).toBe(true);
			expect(Number.isFinite(r.total)).toBe(true);
		});
	});
});
