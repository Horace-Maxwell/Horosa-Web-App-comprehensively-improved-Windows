// 挂载齿轮档位的语义证据:八字「年龄」「生肖归属」、皇极轨策「流派预设」、七政「大限年界」。
// 每一档都走 AI 挂载重算的同一条链(齿轮覆盖 → 并进记录 / 存档 → 无头重算 → 快照正文),
// 同一张盘两档必须算出不同的正文,且正文恰是该档所说的口径(岁数口径、岁首、预设开关组、年界);
// 判据里的期望值按定义另算(出生年、岁首日期、预设表),不拿被测函数自己的输出当期望。
// 七政需要后端排盘:这里把 /chart 换成固定盘(规则接口离线 → 走本地规则),只看 [大限] 段。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: null })) }));
jest.mock('../../services/qizheng', () => ({
	fetchKinastroQizheng: jest.fn(), fetchQizhengElection: jest.fn(),
	fetchMoiraQizhengRules: jest.fn(async () => { throw new Error('offline'); }),
}));
import request from '../request';
import { mergeOptionsIntoRecord, mergeOptionsIntoPayload, effectiveMountBaseline, adjustedMountBaseline, pruneOptionsToNonDefault } from '../techniqueMountSettings';
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';
import { regenerateCaseTechniqueSnapshot } from '../aiAnalysisContext/regenCase';
import { BAZI_OPT_STORAGE_KEY } from '../baziStoredOpt';
import { applyPreset, GUICE_PRESETS, DEFAULT_GUICE_SETTINGS } from '../../components/guice/guiceSchools';
import { buildGuicePan } from '../../components/guice/core/guicePan';
import { buildGuiceSnapshotText } from '../../components/guice/guiceSnapshot';
import { setStoredGuolaoDisplay, getStoredGuolaoDisplay } from '../../components/guolao/GuoLaoChartStyle';
import { GL_DIGNITY_RESULT } from '../../components/guolao/__tests__/fixtures/guolaoSnapshotInputs';

const PLACE = { zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63 };
const section = (text, head)=>{
	const t = `${text || ''}`;
	const i = t.indexOf(head);
	if(i < 0){ return ''; }
	const rest = t.slice(i + head.length);
	const j = rest.search(/\n\[[^\]\n]+\]/);
	return j < 0 ? rest : rest.slice(0, j);
};

beforeEach(()=>{ window.localStorage.clear(); });

describe('八字「年龄」:齿轮档盖过页面保存值;虚岁 = 出生即 1 岁,周岁 = 虚岁 − 1', ()=>{
	const rec = { cid: 'b1', name: 'QA', birth: '1990-05-18 10:00:00', ...PLACE, gender: 1 };
	const BIRTH_YEAR = 1990;
	const snap = async (gear, saved)=>{
		if(saved){ window.localStorage.setItem(BAZI_OPT_STORAGE_KEY, JSON.stringify({ ageStyle: saved })); }
		return regenerateChartTechniqueSnapshot(mergeOptionsIntoRecord(rec, 'bazi', { ageStyle: gear }), 'bazi');
	};
	const overviewAges = (text)=>section(text, '[流年行运概略]').split('\n')
		.map((l)=>l.match(/^\| 板块\d+ \| (-?\d+) \| ([^|]+) \|/)).filter(Boolean).map((m)=>[Number(m[1]), m[2].trim()]);
	const smallRows = (text)=>section(text, '[大运]').split('\n')
		.map((l)=>l.match(/^\| (-?\d+) \| (\d+) \| /)).filter(Boolean).map((m)=>[Number(m[1]), Number(m[2])]);
	test('年龄档 虚岁 与 周岁 两档岁数口径', async ()=>{
		const nominal = await snap('nominal', 'real');   // 页面存的是周岁,齿轮拨虚岁
		const real = await snap('real', 'nominal');      // 页面存的是虚岁,齿轮拨周岁
		expect(nominal).not.toBe(real);
		// 小运逐年表:表头随档;出生当年 虚岁 1 / 周岁 0,其后逐年 +1
		expect(section(nominal, '[大运]')).toContain('| 年份 | 虚岁 | 小运 | 流年 |');
		expect(section(real, '[大运]')).toContain('| 年份 | 周岁 | 小运 | 流年 |');
		const sn = smallRows(nominal); const sr = smallRows(real);
		expect(sn.length).toBeGreaterThan(3);
		sn.forEach(([y, a])=>expect([y, a]).toEqual([y, y - BIRTH_YEAR + 1]));
		sr.forEach(([y, a])=>expect([y, a]).toEqual([y, y - BIRTH_YEAR]));
		// 行运概略:每板块起始年龄 = 起始年 − 出生年 + 1(虚岁「N岁」)/ 起始年 − 出生年(周岁「N周岁」)
		const on = overviewAges(nominal); const or = overviewAges(real);
		expect(on.length).toBeGreaterThan(3);
		on.forEach(([y, a])=>expect([y, a]).toEqual([y, `${y - BIRTH_YEAR + 1}岁`]));
		or.forEach(([y, a])=>expect([y, a]).toEqual([y, `${y - BIRTH_YEAR}周岁`]));
		expect(on.map(([y])=>y)).toEqual(or.map(([y])=>y));   // 起运年不随档变,只换岁数口径
	});
});

describe('八字「生肖归属」:立春 / 正月初一两种岁首', ()=>{
	// 1990-01-27 是庚午年正月初一,1990-02-04 立春:二月一日生人按正月初一已属马,按立春仍属己巳年(蛇)
	const between = { cid: 'b2', name: 'QA', birth: '1990-02-01 10:00:00', ...PLACE, gender: 1 };
	const after = { cid: 'b3', name: 'QA', birth: '1990-05-18 10:00:00', ...PLACE, gender: 1 };
	const zodiacLine = async (rec, gear, saved)=>{
		if(saved){ window.localStorage.setItem(BAZI_OPT_STORAGE_KEY, JSON.stringify({ zodiacBoundary: saved })); }
		const text = await regenerateChartTechniqueSnapshot(mergeOptionsIntoRecord(rec, 'bazi', { zodiacBoundary: gear }), 'bazi');
		return (`${text}`.split('\n').find((l)=>l.startsWith('生肖：')) || '');
	};
	test('生肖档 立春 与 正月初一:春节与立春之间出生差一个生肖', async ()=>{
		expect(await zodiacLine(between, 'lichun', 'lunar')).toBe('生肖：蛇（岁首=立春）');
		expect(await zodiacLine(between, 'lunar', 'lichun')).toBe('生肖：马（岁首=正月初一）');
		// 两个岁首都过了:两档同为马,只差岁首注明
		expect(await zodiacLine(after, 'lichun')).toBe('生肖：马（岁首=立春）');
		expect(await zodiacLine(after, 'lunar')).toBe('生肖：马（岁首=正月初一）');
	});
});

describe('皇极轨策「流派预设」:换派 = 套该派开关组,自定义 = 不套预设、保留逐项', ()=>{
	const GUA = { up: '离', lo: '兑', dongYao: 6, fa: 'baoshu', name: '火泽睽' };
	const CTX = { yearZhi: '辰', monthZhi: '午', year: 2000, hourZhi: '午', pillars: ['庚辰', '壬午', '丙申', '甲午'], dayGan: '丙', askEvent: '问行止' };
	// 存档时的开关(故意与各预设都不同:轨数 / 后天正数 / 日辰秘文版十应)
	const SAVED = { ...DEFAULT_GUICE_SETTINGS, school: 'custom', yanshuFa: 'gui', qiguaShu: 'houtian', shiyingSet: 'rizhen' };
	const payloadOf = (options)=>({ gua: GUA, ctx: CTX, options });
	const gearSnap = async (options, gear)=>{
		const payload = payloadOf(options);
		const rec = { cid: 'g1', payload: JSON.stringify(payload) };
		const base = effectiveMountBaseline('guice', rec);
		const pruned = pruneOptionsToNonDefault('guice', gear, adjustedMountBaseline('guice', gear, base));
		const merged = mergeOptionsIntoPayload(payload, 'guice', pruned);
		return { text: await regenerateCaseTechniqueSnapshot({ ...rec, payload: JSON.stringify(merged) }, 'guice', merged), settings: merged.options };
	};
	// 期望:引擎直接按该派预设表起盘(不经齿轮)
	const engineSnap = (settings)=>(buildGuiceSnapshotText(buildGuicePan({ gua: GUA, ctx: CTX, settings, shiyingInputs: {} })) || '').trim();
	const schoolLine = (text)=>(`${text}`.split('\n').find((l)=>/^\| 流派 \|/.test(l)) || '');
	test('流派档 通用 / 梅花 / 周易数 / 大定:各套各派开关组,正文 = 按预设直接起盘', async ()=>{
		const out = {};
		for(const school of ['default', 'meihua', 'zhouyishu', 'dading']){
			const { text, settings } = await gearSnap(SAVED, { school });
			const preset = applyPreset(school);
			Object.keys(GUICE_PRESETS[school].overrides).forEach((k)=>expect([school, k, settings[k]]).toEqual([school, k, preset[k]]));
			expect(text).toBe(engineSnap(preset));
			expect(schoolLine(text)).toBe(`| 流派 | ${GUICE_PRESETS[school].label} |`);
			out[school] = text;
		}
		const saved = await gearSnap(SAVED, {});
		Object.values(out).forEach((t)=>expect(t).not.toBe(saved.text));   // 存档是轨数 / 后天正数:套任一派都改了演算
		// 梅花:十应名目换梅花原书版 → 十应段与通用不同;大定:九畴数出 [大定起数] 段
		expect(section(out.meihua, '[三要十应]')).not.toBe(section(out.default, '[三要十应]'));
		expect(out.dading).toContain('[大定起数]');
		expect(out.default).not.toContain('[大定起数]');
		// 周易数与通用的开关组本就相同(周易数、策数、五行生成数):演算各段逐字相同,只差流派名
		expect(out.zhouyishu.replace(schoolLine(out.zhouyishu), '')).toBe(out.default.replace(schoolLine(out.default), ''));
		expect(schoolLine(out.zhouyishu)).not.toBe(schoolLine(out.default));
	});
	test('流派档 自定义:不套任何预设,存档的逐项开关原样保留,再叠齿轮改的单项', async ()=>{
		const dadingSaved = applyPreset('dading');   // 存档是大定(九畴数)
		const custom = await gearSnap(dadingSaved, { school: 'custom', yanshuFa: 'gui' });
		expect(custom.settings).toMatchObject({ school: 'custom', qiguaShu: 'jiuchou', dadingTable: dadingSaved.dadingTable, yanshuFa: 'gui' });
		expect(custom.text).toBe(engineSnap({ ...dadingSaved, school: 'custom', yanshuFa: 'gui' }));
		expect(custom.text).toContain('[大定起数]');   // 九畴数没被预设冲掉
		expect(schoolLine(custom.text)).toBe('| 流派 | 自定义 |');
		// 同一改项改拨「通用」:先套通用预设(回五行生成数)再改演数 → 没有大定段
		const viaDefault = await gearSnap(dadingSaved, { school: 'default', yanshuFa: 'gui' });
		expect(viaDefault.settings.qiguaShu).toBe('xiantian');
		expect(viaDefault.text).not.toContain('[大定起数]');
		expect(custom.text).not.toBe(viaDefault.text);
	});
});

describe('七政「大限年界」:公历元旦 / 立春 / 冬至起算岁次;空档随七政页的设置', ()=>{
	const DAY = 24 * 3600 * 1000; const YEAR = 365.25 * DAY;
	// 1990-01-15 生:在 1990 立春(2/4)之前 → 立春界属 1989 年,已过该岁约 0.94 年;元旦界才过约 0.04 年。
	// 1990-12-25 生:在 1990 冬至(12/22)之后 → 冬至界天正岁次属 1991 年,只过约 0.01 年;元旦界已过约 0.98 年。
	const JAN = { cid: 'q1', name: 'QA', birth: '1990-01-15 12:00:00', ...PLACE, gender: 1 };
	const DEC = { cid: 'q2', name: 'QA', birth: '1990-12-25 12:00:00', ...PLACE, gender: 1 };
	// 第 1 限起岁 = round(1 + 该年界下出生时已过的岁份);起讫年 = 该年界的岁次年 + 起岁 − 1(按定义另算)
	const expectFirst = (birthMs, boundaryMs, yearLabel)=>{
		const fromAge = Math.round(1 + (birthMs - boundaryMs) / YEAR);
		return { fromAge, fromYear: yearLabel + fromAge - 1 };
	};
	const firstLimit = (text)=>{
		const m = section(text, '[大限]').match(/\| 第1限 \| [^|]+ \| (\d+)-\d+岁 \| (-?\d+)-(-?\d+)年 \|/);
		return m ? { fromAge: Number(m[1]), fromYear: Number(m[2]) } : null;
	};
	// noJd:盘里不带出生时刻(chart.date 缺),年界只能按出生字段自行补算
	const snap = async (rec, gear, saved, noJd)=>{
		setStoredGuolaoDisplay({ ...getStoredGuolaoDisplay(), limitYearBoundary: saved || 'gregorian' });
		// 固定盘带上该出生时刻(与后端排盘产出同形:chart.date.jd 为世界时儒略日 + 时区),年界据它取出生日
		const [d, t] = rec.birth.split(' ');
		const [Y, M, D] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number);
		const jd = (Date.UTC(Y, M - 1, D, h, mi) - 8 * 3600 * 1000) / DAY + 2440587.5;
		const result = JSON.parse(JSON.stringify(GL_DIGNITY_RESULT));
		if(noJd){ delete result.chart.date; delete result.chart.params; }
		else{ result.chart.date = { jd, utcoffset: { value: 8 } }; }
		request.mockImplementation(async ()=>({ Result: JSON.parse(JSON.stringify(result)) }));
		return regenerateChartTechniqueSnapshot(mergeOptionsIntoRecord(rec, 'guolao', { guolaoLimitYearBoundary: gear }), 'guolao');
	};
	const jan = Date.UTC(1990, 0, 15, 12); const dec = Date.UTC(1990, 11, 25, 12);
	test('年界档 公历元旦 / 立春起 / 冬至起:同一出生按各自年界起算岁次', async ()=>{
		// 页面存的是别的年界,齿轮显式拨的档盖过它
		const gJan = await snap(JAN, 'gregorian', 'lichun');
		const lJan = await snap(JAN, 'lichun', 'gregorian');
		const gDec = await snap(DEC, 'gregorian', 'dongzhi');
		const dDec = await snap(DEC, 'dongzhi', 'gregorian');
		expect(firstLimit(gJan)).toEqual(expectFirst(jan, Date.UTC(1990, 0, 1), 1990));
		expect(firstLimit(lJan)).toEqual(expectFirst(jan, Date.UTC(1989, 1, 4, 12), 1989));
		expect(firstLimit(gDec)).toEqual(expectFirst(dec, Date.UTC(1990, 0, 1), 1990));
		expect(firstLimit(dDec)).toEqual(expectFirst(dec, Date.UTC(1990, 11, 22, 12), 1991));
		expect(firstLimit(gJan).fromAge).not.toBe(firstLimit(lJan).fromAge);
		expect(firstLimit(gDec).fromAge).not.toBe(firstLimit(dDec).fromAge);
		expect(section(gJan, '[大限]')).not.toBe(section(lJan, '[大限]'));
		expect(section(gDec, '[大限]')).not.toBe(section(dDec, '[大限]'));
		// 立春界只看立春:年末(立春已过、冬至已过)与元旦界同一岁次年
		expect(firstLimit(await snap(DEC, 'lichun', 'gregorian')).fromYear).toBe(firstLimit(gDec).fromYear);
	});
	test('盘里缺出生时刻:按出生字段补算,与带 jd 逐字相同,三种年界照样分得开', async ()=>{
		for(const [rec, modes] of [[JAN, ['gregorian', 'lichun', 'dongzhi']], [DEC, ['gregorian', 'lichun', 'dongzhi']]]){
			const got = {};
			for(const m of modes){
				const withJdText = await snap(rec, m, 'gregorian');
				const noJdText = await snap(rec, m, 'gregorian', true);
				const noJd = section(noJdText, '[大限]');
				expect(noJd).toContain('| 第1限 |');
				expect(`${rec.birth}:${m}:${noJd}`).toBe(`${rec.birth}:${m}:${section(withJdText, '[大限]')}`);
				got[m] = firstLimit(noJdText);
			}
			// 按定义另算的期望(与带 jd 用例同一份):元旦 / 立春 / 冬至
			if(rec === JAN){
				expect(got.gregorian).toEqual(expectFirst(jan, Date.UTC(1990, 0, 1), 1990));
				expect(got.lichun).toEqual(expectFirst(jan, Date.UTC(1989, 1, 4, 12), 1989));
				expect(got.lichun.fromAge).not.toBe(got.gregorian.fromAge);
			}else{
				expect(got.gregorian).toEqual(expectFirst(dec, Date.UTC(1990, 0, 1), 1990));
				expect(got.dongzhi).toEqual(expectFirst(dec, Date.UTC(1990, 11, 22, 12), 1991));
				expect(got.dongzhi.fromAge).not.toBe(got.gregorian.fromAge);
			}
		}
	});
	// 公元前 / 1582 年前的生日:补算的儒略日按民用历法(1582-10-15 前儒略历)取,与后端排盘给的 jd 同值
	test('盘里缺出生时刻:1582 年前与公元前生日补算的儒略日与民用历法同值', async ()=>{
		// 后端口径:astropy civil_calendar.civil_julday_display(年, 月, 日, 时) − 时区 / 24(1582-10-15 前儒略历)
		const civilJd = (y, m, d, hour)=>{
			const ay = y < 0 ? y + 1 : y;
			const a = Math.floor((14 - m) / 12); const yy = ay + 4800 - a; const mm = m + 12 * a - 3;
			const greg = (y > 1582) || (y === 1582 && (m > 10 || (m === 10 && d >= 15)));
			const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
				+ (greg ? -Math.floor(yy / 100) + Math.floor(yy / 400) - 32045 : -32083);
			return jdn - 0.5 + hour / 24;
		};
		// 两个生日都选在「年中」附近:儒略历与外推格里历差的那几天恰好跨过半岁,历法取错第 1 限起岁就变
		// (1200-06-28 儒略 = 格里 07-05,已过半岁;公元前 300-07-05 儒略 = 格里 07-01,未过半岁)
		for(const [birth, y, m, d] of [['1200-06-28 12:00:00', 1200, 6, 28], ['-0300-07-05 12:00:00', -300, 7, 5]]){
			const rec = { cid: `old${y}`, name: 'QA', birth, ...PLACE, gender: 1 };
			const jd = civilJd(y, m, d, 12) - 8 / 24;
			for(const mode of ['gregorian', 'lichun', 'dongzhi']){
				setStoredGuolaoDisplay({ ...getStoredGuolaoDisplay(), limitYearBoundary: 'gregorian' });
				const withJdResult = JSON.parse(JSON.stringify(GL_DIGNITY_RESULT));
				withJdResult.chart.date = { jd, utcoffset: { value: 8 } };
				request.mockImplementation(async ()=>({ Result: JSON.parse(JSON.stringify(withJdResult)) }));
				const withJd = section(await regenerateChartTechniqueSnapshot(mergeOptionsIntoRecord(rec, 'guolao', { guolaoLimitYearBoundary: mode }), 'guolao'), '[大限]');
				const noJd = section(await snap(rec, mode, 'gregorian', true), '[大限]');
				expect(noJd).toContain('| 第1限 |');
				expect(`${birth}:${mode}:${noJd}`).toBe(`${birth}:${mode}:${withJd}`);
			}
		}
	});
	test('年界档 随全局:齿轮留空 = 七政页保存的年界', async ()=>{
		const lJan = section(await snap(JAN, 'lichun', 'gregorian'), '[大限]');
		const gJan = section(await snap(JAN, 'gregorian', 'gregorian'), '[大限]');
		const dDec = section(await snap(DEC, 'dongzhi', 'gregorian'), '[大限]');
		expect(section(await snap(JAN, '', 'lichun'), '[大限]')).toBe(lJan);
		expect(section(await snap(JAN, '', 'gregorian'), '[大限]')).toBe(gJan);
		expect(section(await snap(DEC, '', 'dongzhi'), '[大限]')).toBe(dDec);
		expect(lJan).not.toBe(gJan);
	});
});
