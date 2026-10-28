// 六壬择日:工作台「用事人本命」点结果行时回写内嵌六壬页的卜卦人出生 / 性别 —— 盘头行年、右栏本命 / 行年与快照
// 按的就是扫描判本命组条件的那个人(此前内嵌页用的是打开择日页那一刻出生的人:男、虚岁一岁)。没填本命维持现状。
jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));
jest.mock('../../../utils/request', () => jest.fn(() => new Promise(() => {})));
global.React = require('react');
const LiurengZeriMain = require('../LiurengZeriMain').default;
const { resolveNatal, natalBirthFieldsOf } = require('../LiurengZeriMain');
const LiuRengMain = require('../../lrzhan/LiuRengMain').default;
const { resolveDisplayRunYear } = require('../../lrzhan/LiuRengMain');
const { makeLiurengZeriEvalCtx } = require('../../../divination/zeri/liurengZeriConditionTypes');
const DateTime = require('../../comp/DateTime').default;

const INPUT = { date: '1990-05-18', time: '08:30', zone: '+08:00', gender: 1 };
function mkHost(){
	const h = new LiurengZeriMain({ dispatch: jest.fn() });
	h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
	return h;
}
function guaFields(text){
	const dt = new DateTime();
	dt.setZone('+08:00');
	dt.parse(text, 'YYYY-MM-DD HH:mm:ss');
	return { date: { value: dt }, time: { value: dt.clone() }, zone: { value: '+08:00' }, ad: { value: 1 } };
}

describe('六壬择日 · 用事人本命 × 内嵌页卜卦人', ()=>{
	test('解析本命把所用生辰一并冻结', ()=>{
		const n = resolveNatal(INPUT);
		expect(n.birth).toEqual({ date: '1990-05-18', time: '08:30', zone: '+08:00', gender: 1 });
		expect(n.bornYear).toBe(1990);
	});

	test('点结果行:有本命 → 回写卜卦人出生 / 性别(冻结的本命);盘面行年 = 扫描判的行年', async ()=>{
		const h = mkHost();
		const natal = resolveNatal({ ...INPUT, gender: 0 });
		h.state.natal = { mingZhi: '别人' };   // 扫描之后工作台又换了本命:回写的仍是冻结那位
		h._scanNatal = natal;
		h._scanNatalInput = { ...INPUT, gender: 0 };
		h._scanUiJson = 'frozen';
		const calls = { cast: [], birth: [] };
		h.liurengHook = { applyCastFields: (p)=>{ calls.cast.push(p); return Promise.resolve(); }, applyBirth: (b)=>{ calls.birth.push(b); return Promise.resolve(); } };
		await h.applyWorkbenchCalibre();
		expect(calls.cast).toHaveLength(1);
		expect(calls.birth).toHaveLength(1);
		const b = calls.birth[0];
		expect(b.date.value.format('YYYY-MM-DD')).toBe('1990-05-18');
		expect(b.time.value.format('HH:mm:ss')).toBe('08:30:00');
		expect(b.gender.value).toBe(0);
		// 行年:盘面按卜卦人出生 × 起课年(年差法)= 扫描 ctx.xingnian()(候选年 2026)
		const gua = guaFields('2026-03-01 10:00:00');
		const shown = resolveDisplayRunYear(null, b, gua);
		const judged = makeLiurengZeriEvalCtx({ _natal: natal, _candY: 2026 }).xingnian();
		expect(shown && shown.year ? shown.year.charAt(1) : '').toBe(judged);
	});

	test('没填本命:不回写卜卦人(维持现状)', async ()=>{
		const h = mkHost();
		const calls = [];
		h.liurengHook = { applyCastFields: ()=>Promise.resolve(), applyBirth: (b)=>{ calls.push(b); return Promise.resolve(); } };
		await h.applyWorkbenchCalibre();
		expect(calls).toEqual([]);
	});

	test('早先存下的本命(只有生年 / 性别):用同次冻结的输入框,生年 / 性别对不上就不回写', ()=>{
		const old = { mingZhi: '午', bornYear: 1990, male: true };
		expect(natalBirthFieldsOf(old, INPUT).date.value.format('YYYY-MM-DD')).toBe('1990-05-18');
		expect(natalBirthFieldsOf(old, { ...INPUT, date: '1991-05-18' })).toBe(null);
		expect(natalBirthFieldsOf(old, { ...INPUT, gender: 0 })).toBe(null);
		expect(natalBirthFieldsOf(old, null)).toBe(null);
		expect(natalBirthFieldsOf(null, INPUT)).toBe(null);
	});

	test('内嵌六壬页 applyBirth:出生档即刻生效、旧行年作废、在途行年请求作废', async ()=>{
		const hook = {};
		const page = new LiuRengMain({ hook, techniqueScope: 'liurengzeri' });
		page.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
		page.state.runyear = { year: '丙寅' };
		const seq0 = page._runYearReqSeq || 0;
		await hook.applyBirth(natalBirthFieldsOf(resolveNatal(INPUT), null));
		expect(page.state.birth.date.value.format('YYYY-MM-DD')).toBe('1990-05-18');
		expect(page.state.calcBirth.date.value.format('YYYY-MM-DD')).toBe('1990-05-18');
		expect(page.state.birth.gender.value).toBe(1);
		expect(page.state.runyear).toBe(null);
		expect(page._runYearReqSeq).toBe(seq0 + 1);
	});

	test('存案 / 方案照存冻结的本命输入框(宿主登记了冻结位)', ()=>{
		const h = mkHost();
		expect(Object.prototype.hasOwnProperty.call(h, '_scanNatalInput')).toBe(true);
	});
});
