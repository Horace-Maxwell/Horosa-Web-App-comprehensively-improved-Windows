/**
 * 金口诀 Batch 3+4 golden：定地分辅助取法 / 二遁人元 / 次客六法 / 移星换将 /
 * 测年月日三式 / 七专题起式 / 专题断诀 / 行年旬法与灾福歌。
 */
import {
	buildJinKouData, jinKouZiByNumber, jinKouZiByColor, jinKouZiByShengXiao, resolveDiFenBySource,
	buildJinKouErDun, buildJinKouCiKe, buildJinKouYiXing, buildJinKouShiJian,
	buildJinKouTopic, buildJinKouTopicJue, buildJinKouXingNian, JINKOU_TOPIC_KEYS,
} from '../JinKouCalc';
import { JINKOU_ZHAI_NEIJING, JINKOU_XINGNIAN_GE } from '../JinKouDoc';
import { buildJinKouSnapshotText, deriveBenMingFromRunYear, deriveXuSuiFromRunYear } from '../JinKouMain';
import { getTechniqueSettingsSchema } from '../../../utils/techniqueMountSettings';
import { AI_EXPORT_PRESET_SECTIONS } from '../../../utils/aiExport';

function mockLR(dayGanZi, monthGanZi, timeZhi){
	return {
		nongli: { dayGanZi: dayGanZi, time: `${timeZhi}时`, monthGanZi: monthGanZi },
		fourColumns: { year: { ganzi: '丙午' }, month: { ganzi: monthGanZi } },
		xun: { '旬空': '', '旬首': '' },
		season: { '金': '囚', '木': '旺', '水': '休', '火': '相', '土': '死' },
		gods: {}, godsGan: {}, godsMonth: {}, godsZi: {}, godsYear: { taisui1: {} },
	};
}

describe('定地分辅助取法', ()=>{
	it('取数法：÷12 取余（余1子…余11戌，整除取亥）', ()=>{
		expect(jinKouZiByNumber(1)).toBe('子');
		expect(jinKouZiByNumber(2)).toBe('丑');
		expect(jinKouZiByNumber(11)).toBe('戌');
		expect(jinKouZiByNumber(12)).toBe('亥');
		expect(jinKouZiByNumber(24)).toBe('亥');
		expect(jinKouZiByNumber(25)).toBe('子');
		expect(jinKouZiByNumber(0)).toBe('');
	});
	it('颜色法与本命法：色 → 五行支、属相 → 支', ()=>{
		expect(jinKouZiByColor('青色上衣')).toBe('寅');
		expect(jinKouZiByColor('大红')).toBe('午');
		expect(jinKouZiByColor('黑')).toBe('亥');
		expect(jinKouZiByShengXiao('属兔')).toBe('卯');
		expect(jinKouZiByShengXiao('午')).toBe('午');
	});
	it('统一入口按取法分派（笔画/翻书走取数法）', ()=>{
		expect(resolveDiFenBySource('number', 7)).toBe('午');
		expect(resolveDiFenBySource('stroke', 13)).toBe('子');
		expect(resolveDiFenBySource('book', 30)).toBe('巳');
		expect(resolveDiFenBySource('color', '白')).toBe('申');
		expect(resolveDiFenBySource('shengxiao', '鼠')).toBe('子');
	});
});

describe('二遁人元法', ()=>{
	it('原人元丙、地分午 → 二遁得甲（古本算例）', ()=>{
		const d = buildJinKouErDun('丙', '午');
		expect(d.gan).toBe('甲');
		expect(d.se).toBe('青');       // 甲＝青
		expect(d.xiang).toBe('树木');   // 甲乙为树木
	});
	it('接入课式：erDun 随人元与地分产出衣色与物象', ()=>{
		const d = buildJinKouData(mockLR('甲辰', '丙申', '申'), { diFen: '午', zhanShi: '申', guirengType: 0 });
		expect(d.erDun).toBeTruthy();
		expect(d.erDun.yuan).toBe(d.renYuanGan);
		expect(typeof d.erDun.se).toBe('string');
	});
});

describe('次客法六法 + 移星换将', ()=>{
	const cike = buildJinKouCiKe({
		yuejiang: '亥', timeZi: '午', diFen: '酉', dayGan: '甲', dayZi: '子',
		guiName: '太常', yongZhi: '寅', yongGan: '丙',
	});
	it('六法齐备且各带派生结果', ()=>{
		const methods = cike.map((c)=>c.method);
		['移神法', '换将法', '换日辰法', '用爻支合法', '用爻干合法', '月将加日'].forEach((m)=>{
			expect(methods).toContain(m);
		});
	});
	it('移神法取十二贵神下一位；用爻支合取六合处为新地分', ()=>{
		const yishen = cike.find((c)=>c.method === '移神法');
		expect(yishen.guiName).toBe('玄武');       // 太常 → 玄武（序内下一位）
		const zhihe = cike.find((c)=>c.method === '用爻支合法');
		expect(zhihe.altDiFen).toBe('亥');          // 寅亥六合
		const ganhe = cike.find((c)=>c.method === '用爻干合法');
		expect(ganhe.heGan).toBe('辛');             // 丙辛合
	});
	it('换将法：阳将后三前五（亥为阴将则前三后五）', ()=>{
		const yin = buildJinKouCiKe({ yuejiang: '亥', timeZi: '午', diFen: '酉', dayGan: '甲', dayZi: '子', guiName: '贵人' });
		const hj = yin.find((c)=>c.method === '换将法');
		expect(hj.note).toContain('阴将前三后五');
		expect(hj.altTimeZi).toEqual(['酉', '丑']);   // 午前三=酉、午后五=丑
		const yang = buildJinKouCiKe({ yuejiang: '子', timeZi: '午', diFen: '申', dayGan: '壬', dayZi: '寅', guiName: '贵人' });
		const hj2 = yang.find((c)=>c.method === '换将法');
		expect(hj2.note).toContain('阳将后三前五');
		expect(hj2.altTimeZi).toEqual(['卯', '亥']);  // 午后三=卯、午前五=亥
	});
	it('移星换将：以前后一日之日干另起贵神', ()=>{
		const yx = buildJinKouYiXing('壬');
		expect(yx.prevDayGan).toBe('辛');
		expect(yx.nextDayGan).toBe('癸');
		expect(yx.note).toContain('参考');
	});
});

describe('测年 / 测月 / 测日三式', ()=>{
	const ctx = { yuejiang: '亥', yearZi: '午', monthZi: '寅', dayZi: '子', benMing: '卯' };
	it('测年：月将加太岁宫、数到属相', ()=>{
		const r = buildJinKouShiJian('year', ctx);
		expect(r.addAt).toBe('午');
		expect(r.diFen).toBe('卯');
		expect(r.jiangZi).toBe('申');      // 亥 +(卯−午)= 亥−3 = 申
	});
	it('测月：月将加月支、数到属相', ()=>{
		const r = buildJinKouShiJian('month', ctx);
		expect(r.addAt).toBe('寅');
		expect(r.jiangZi).toBe('子');      // 亥 +(卯−寅)= 子
	});
	it('测日：月将加属相、以日支为地分', ()=>{
		const r = buildJinKouShiJian('day', ctx);
		expect(r.addAt).toBe('卯');
		expect(r.diFen).toBe('子');
		expect(r.jiangZi).toBe('申');      // 亥 +(子−卯)= 亥−3 = 申
	});
});

describe('七专题起式', ()=>{
	const ctx = { yuejiang: '亥', timeZi: '亥', diFen: '巳', yearZi: '午', benMing: '卯', renYuanGan: '戊', dayGan: '甲' };
	it('全部专题键可产出且结构完整', ()=>{
		JINKOU_TOPIC_KEYS.forEach((k)=>{
			const r = buildJinKouTopic(k, ctx);
			expect(r).toBeTruthy();
			expect(r.title).toBeTruthy();
			expect(r.note).toBeTruthy();
		});
	});
	it('孕育：太乙巳将加孕妇属相，将神阴阳定男女', ()=>{
		// 属兔(卯)、地分巳：巳 +(巳−卯)= 未（阴支）→ 主女，与古籍算例一致
		const r = buildJinKouTopic('yunyu', { ...ctx, benMing: '卯', diFen: '巳' });
		expect(r.ready).toBe(true);
		expect(r.jiangZi).toBe('未');
		expect(r.result).toContain('女');
	});
	it('寻天罡：天罡辰将落地盘位为新地分（甲寅月亥将亥时 → 辰）', ()=>{
		const r = buildJinKouTopic('xuntiangang', { ...ctx, yuejiang: '亥', timeZi: '亥' });
		expect(r.ready).toBe(true);
		expect(r.newDiFen).toBe('辰');
	});
	it('家宅：岁前五辰为宅神（午年 → 亥）', ()=>{
		const r = buildJinKouTopic('jiazhai', ctx);
		expect(r.newDiFen).toBe('亥');
	});
	it('瘢痣：人元二遁至命宫（戊日遁卯 → 乙）', ()=>{
		const r = buildJinKouTopic('banzhi', { ...ctx, renYuanGan: '戊', benMing: '卯' });
		expect(r.erDunGan).toBe('乙');
	});
	it('复加时：沿十二方位各立一课', ()=>{
		const r = buildJinKouTopic('fujiashi', ctx);
		expect(r.rows.length).toBe(12);
		r.rows.forEach((row)=>{ expect(row.jiangZi).toBeTruthy(); });
	});
	it('缺参数时给出 needText 而非抛错', ()=>{
		const r = buildJinKouTopic('yunyu', { ...ctx, benMing: '' });
		expect(r.ready).toBe(false);
		expect(r.needText).toBeTruthy();
	});
});

describe('专题断诀', ()=>{
	it('宅内景：逐位地支取室内物象', ()=>{
		const rows = [{ label: '人元', content: '庚' }, { label: '贵神', branch: '寅' }, { label: '将神', branch: '午' }, { label: '地分', branch: '子' }];
		const j = buildJinKouTopicJue('jiazhai', { rows: rows });
		expect(j.kind).toBe('宅内景');
		const byZhi = {};
		j.items.forEach((it)=>{ byZhi[it.zhi] = it.xiang; });
		expect(byZhi['寅']).toBe(JINKOU_ZHAI_NEIJING['寅']);
		expect(byZhi['子']).toBe(JINKOU_ZHAI_NEIJING['子']);
	});
	it('打井：孟咸仲甘四季泉少', ()=>{
		expect(buildJinKouTopicJue('dajing', { diFen: '寅' }).items[0].xiang).toContain('咸');
		expect(buildJinKouTopicJue('dajing', { diFen: '子' }).items[0].xiang).toContain('甘');
		expect(buildJinKouTopicJue('dajing', { diFen: '辰' }).items[0].xiang).toContain('泉少');
	});
	it('瘢痣与贵贱：部位痕质、贵神诀各按当前课取值', ()=>{
		const b = buildJinKouTopicJue('banzhi', { erDunGan: '丙', diFen: '午' });
		expect(b.items.some((it)=>`${it.xiang}`.indexOf('火烧') >= 0)).toBe(true);
		expect(b.items.some((it)=>it.xiang === '面')).toBe(true);
		const g = buildJinKouTopicJue('guijian', { guiName: '青龙' });
		expect(g.items[0].xiang).toContain('田宅');
	});
});

describe('行年旬法 + 灾福歌', ()=>{
	it('甲午旬男：一岁丙申，逐岁顺行（10 岁乙巳）', ()=>{
		const r1 = buildJinKouXingNian('甲午', 1, 1);
		expect(r1.xunHead).toBe('甲午');
		expect(r1.startGanZi).toBe('丙申');
		expect(r1.ganZhi).toBe('丙申');
		const r10 = buildJinKouXingNian('甲午', 1, 10);
		expect(r10.ganZhi).toBe('乙巳');
	});
	it('女逆行：甲子旬女一岁壬申、二岁辛未', ()=>{
		expect(buildJinKouXingNian('甲子', 0, 1).ganZhi).toBe('壬申');
		expect(buildJinKouXingNian('甲子', 0, 2).ganZhi).toBe('辛未');
	});
	it('旬首归属正确（乙丑属甲子旬、癸酉亦属甲子旬）', ()=>{
		expect(buildJinKouXingNian('乙丑', 1, 1).xunHead).toBe('甲子');
		expect(buildJinKouXingNian('癸酉', 1, 1).xunHead).toBe('甲子');
		expect(buildJinKouXingNian('甲戌', 1, 1).xunHead).toBe('甲戌');
	});
	it('灾福歌随行年支给出运限节要', ()=>{
		const r = buildJinKouXingNian('甲午', 1, 1);   // 丙申 → 申
		expect(r.zhi).toBe('申');
		expect(r.ge).toBe(JINKOU_XINGNIAN_GE['申']);
	});
	it('接入课式：仅在传生年干支与虚岁时产出', ()=>{
		const plain = buildJinKouData(mockLR('甲辰', '丙申', '申'), { diFen: '午', guirengType: 0 });
		expect(plain.xingNian).toBeNull();
		const withXn = buildJinKouData(mockLR('甲辰', '丙申', '申'), { diFen: '午', guirengType: 0, birthGanZi: '甲午', gender: 1, age: 10 });
		expect(withXn.xingNian.ganZhi).toBe('乙巳');
	});
});

// ── 四链同步：AI 快照段 / AI 挂载设置 schema / 事盘储存键 ──
describe('专题起式四链同步', ()=>{
	const snapArgs = (opt)=>{
		const lr = mockLR('庚午', '丙申', '申');
		const data = buildJinKouData(lr, { diFen: '午', zhanShi: '申', guirengType: 0, ...opt });
		return { lr, data };
	};

	it('未选专题：快照逐字不含 [专题起式] 段（既有快照零回归）', ()=>{
		const { lr, data } = snapArgs({});
		const txt = buildJinKouSnapshotText({}, lr, null, data, '土', 0, 1);
		expect(txt).not.toContain('[专题起式]');
	});

	it('选定专题：快照追加 [专题起式] 段，含派生课表与断诀', ()=>{
		const { lr, data } = snapArgs({ topicKey: 'fujiashi' });
		const txt = buildJinKouSnapshotText({}, lr, null, data, '土', 0, 1);
		expect(txt).toContain('[专题起式]');
		expect(txt).toContain('复加时');
		expect(txt).toContain('| 方位 | 将神 | 将名 | 将干 |');
		// 十二方位各一行 —— 只数 [专题起式] 段内的表（[金口诀三盘] 也以地支起行，须限定段落）
		const seg = txt.split('\n\n').find((p)=>p.indexOf('[专题起式]') === 0) || '';
		const rows = seg.split('\n').filter((l)=>/^\| [子丑寅卯辰巳午未申酉戌亥] \|/.test(l));
		expect(rows.length).toBe(12);
	});

	it('测年月日与行年旬法各自单独入快照（互不依赖专题）', ()=>{
		const { lr, data } = snapArgs({ shiJianKind: 'year', benMing: '卯', birthGanZi: '丙午', gender: 1, age: 32 });
		const txt = buildJinKouSnapshotText({}, lr, null, data, '土', 0, 1);
		expect(txt).toContain('[专题起式]');
		expect(txt).toContain('测一年吉凶');
		expect(txt).toContain('金口诀行年（旬法）');
		expect(txt).toContain('行年 丁丑');
		expect(txt).toContain('灾福歌');
	});

	it('AI 挂载 schema：专题两键齐备且默认＝不选；属相/虚岁不入 schema（派生值不可手填）', ()=>{
		const schema = getTechniqueSettingsSchema('jinkou');
		const fields = (schema && schema.fields) || [];
		const by = {};
		fields.forEach((f)=>{ by[f.name] = f; });
		['topicKey', 'shiJianKind'].forEach((k)=>{
			expect(by[k]).toBeTruthy();
			expect(by[k].default).toBe('');
			expect(by[k].group).toBe('专题');
		});
		// 属相/虚岁单一真值源＝问测人出生档，放成可手填即出现「设置填兔、出生档是龙」的分叉
		expect(by.benMing).toBeUndefined();
		expect(by.xingNianAge).toBeUndefined();
		// 专题选项与引擎 key 集合一一对应（多写/漏写即失败）
		const optKeys = by.topicKey.options.map((o)=>o.value).filter(Boolean);
		expect(optKeys.slice().sort()).toEqual(JINKOU_TOPIC_KEYS.slice().sort());
		// 盘式档同步开放阴盘（Batch 2 已放开 UI，schema 此前只列阳盘）
		expect(by.panShi.options.map((o)=>o.value)).toEqual(['yang', 'yin']);
	});

	it('AI 导出段表登记全部新段（勾选面可见，未产段时为空不报错）', ()=>{
		['专题起式', '阴盘·六亲六神旺衰', '四象所属', '四象五行', '方位神煞', '合占扣题与内外', '二遁与次客'].forEach((seg)=>{
			expect(AI_EXPORT_PRESET_SECTIONS.jinkou).toContain(seg);
		});
	});

	it('快照段头与导出段表一一对得上（有段无登记＝用户勾不到，有登记无段＝勾了永远空）', ()=>{
		const lr = mockLR('庚午', '丙申', '申');
		const data = buildJinKouData(lr, { diFen: '午', zhanShi: '申', guirengType: 0, panShi: 'yin', topicKey: 'fujiashi' });
		const txt = buildJinKouSnapshotText({}, lr, null, data, '土', 0, 1);
		const heads = (txt.match(/^\[[^\]]+\]$/gm) || []).map((h)=>h.slice(1, -1));
		const listed = AI_EXPORT_PRESET_SECTIONS.jinkou;
		heads.forEach((h)=>{ expect(listed).toContain(h); });
	});
});

// ── 本命属相 / 行年虚岁：单一真值源＝问测人出生档 ──
describe('属相与虚岁派生（不再手填）', ()=>{
	it('属相＝生年干支之地支；虚岁＝年份差+1', ()=>{
		expect(deriveBenMingFromRunYear({ birthGanZi: '丙午', age: 31 })).toBe('午');
		expect(deriveXuSuiFromRunYear({ birthGanZi: '丙午', age: 31 })).toBe(32);
		// 出生当年占（年份差 0）＝虚岁 1，非 0 岁
		expect(deriveXuSuiFromRunYear({ birthGanZi: '甲子', age: 0 })).toBe(1);
	});

	it('缺档/坏档一律返回空而非乱算（缺参不臆造）', ()=>{
		[null, undefined, {}, { birthGanZi: '' }, { birthGanZi: 'XX' }, { birthGanZi: '甲' }].forEach((rv)=>{
			expect(deriveBenMingFromRunYear(rv)).toBe('');
		});
		[null, undefined, {}, { age: null }, { age: 'abc' }, { age: -1 }].forEach((rv)=>{
			expect(deriveXuSuiFromRunYear(rv)).toBe('');
		});
	});

	it('十二支逐支复算：属相取的确是生年地支', ()=>{
		const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
		['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].forEach((zhi, i)=>{
			expect(deriveBenMingFromRunYear({ birthGanZi: `${GAN[i % 10]}${zhi}` })).toBe(zhi);
		});
	});

	it('派生值喂进引擎：专题与行年据此产出，未取到生年则照实提示而非乱起课', ()=>{
		const lr = mockLR('庚午', '丙申', '申');
		const rv = { birthGanZi: '丙午', age: 31 };
		const withBirth = buildJinKouData(lr, {
			diFen: '午', zhanShi: '申', guirengType: 0,
			topicKey: 'yunyu', benMing: deriveBenMingFromRunYear(rv),
			birthGanZi: rv.birthGanZi, gender: 1, age: deriveXuSuiFromRunYear(rv),
		});
		expect(withBirth.topic.ready).toBe(true);
		expect(withBirth.topic.addAt).toBe('午');
		expect(withBirth.xingNian.age).toBe(32);
		expect(withBirth.xingNian.ganZhi).toBe('丁丑');

		const noBirth = buildJinKouData(lr, {
			diFen: '午', zhanShi: '申', guirengType: 0,
			topicKey: 'yunyu', benMing: deriveBenMingFromRunYear(null),
			birthGanZi: '', gender: 1, age: deriveXuSuiFromRunYear(null),
		});
		expect(noBirth.topic.ready).toBe(false);
		expect(noBirth.topic.needText).toContain('属相');
		expect(noBirth.xingNian).toBeNull();
	});
});
