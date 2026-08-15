// 🔴 端到端「存 → 落库 → 读回 → 还原」闭环总锁 —— 顶层字段断链与口径快照形态断链的永久闸。
//
// 立闸由来(本轮实锤两条,全是「各段单测绿、链路整体断」型 —— 现有测试只验各段,无一条走通全链):
//   ① 事盘 gender 三段断链:存案入口一直送 caseGenderValue(fields),但 newEmptyCaseFields 无槽/
//      newCurrentCase 不透传/buildLocalCaseRecord 不落键 → applyCase 的还原读取永远落空,
//      占婚存女命载回按男命取用神、AI 挂载恒退默认男。
//   ② applyCase 的 fieldSnapshot 读取只认对象,而落库 payload 恒为 JSON 串(normalizePayload)、
//      事盘列表「选择」把原样 record 派发进来 → 日界点/晚子时/卦日界/时间算法四口径键
//      从列表载入从不还原(X1 修复在主路径上失效)。
//
// 🔴 判据纪律:必须照「前端真实形态」跑 —— 真 localStorage 落库、applyCase 吃列表原样记录
// (payload=串)。把对象形态直接喂 saga 正是 ①② 能长期存活的测试写法(单测喂想要的形状、
// 前端发手上的形状 → 单测全绿功能全死,仓内已成文教训),本文件禁止。
import { upsertLocalCase, listLocalCases } from '../localcases';
import { upsertLocalChart, listLocalCharts } from '../localcharts';
import { applyRecordToFields } from '../recordFieldsRestore';
import userModel from '../../models/user';

// dva effect 生成器驱动:注入 marker 版 {select, put, call},按 yield 逐步喂回,
// 收集全部 put 供断言。saga 只消费注入的三件,无需起 dva 运行时。
function runEffect(effectFn, action, stubState){
	const puts = [];
	const io = {
		select: (sel)=>({ __SELECT__: sel }),
		put: (a)=>({ __PUT__: a }),
		call: ()=>({ __CALL__: true }),
	};
	const gen = effectFn.call(userModel, action, io);
	let input;
	for(let guard = 0; guard < 200; guard += 1){
		const step = gen.next(input);
		if(step.done){ break; }
		input = undefined;
		const v = step.value;
		if(v && v.__SELECT__){ input = v.__SELECT__(stubState); }
		else if(v && v.__PUT__){ puts.push(v.__PUT__); }
	}
	return puts;
}

function applyCaseFields(rec, caseApplySeq = 0){
	const puts = runEffect(userModel.effects.applyCase, { payload: rec }, {
		user: { caseApplySeq },
		astro: { fields: {} },
	});
	const fetchPut = puts.find((p)=>p.type === 'astro/fetchByFields');
	expect(fetchPut).toBeTruthy();
	return { puts, flds: fetchPut.payload };
}

describe('闭环总锁 · 事盘 存→落库→列表原样→applyCase 还原', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('🔴 gender 全链保真:存 0(女) → 落库 → 还原进 fields(0 是合法值,禁真值判断的活证)', ()=>{
		upsertLocalCase({
			event: '闭环·占婚女命',
			caseType: 'guazhan',
			divTime: '2026-08-13 10:30:00',
			zone: '+08:00',
			lat: '31n12',
			lon: '121e30',
			gender: 0,
			payload: { module: 'guazhan', version: 1, fieldSnapshot: { after23NewDay: 1, timeAlg: 1 }, gua: [1, 2] },
		});
		const rec = listLocalCases().find((r)=>r.event === '闭环·占婚女命');
		expect(rec).toBeTruthy();
		expect(rec.gender).toBe(0);                        // ① 落库(此前 buildLocalCaseRecord 不枚举=丢)
		expect(typeof rec.payload).toBe('string');         // 判据纪律本体:真实形态=JSON 串

		const { puts, flds } = applyCaseFields(rec, 3);
		expect(flds.gender).toBeTruthy();
		expect(flds.gender.value).toBe(0);                 // ① 还原(此前永远 undefined)
		// ② 口径快照必须从「串形态 payload」里还原(此前只认对象 → 主路径全死)
		expect(flds.after23NewDay && flds.after23NewDay.value).toBe(1);
		expect(flds.timeAlg && flds.timeAlg.value).toBe(1);
		// 载入代次自增(存案保真根治的既有契约,闭环里一并钉住)
		const seqPut = puts.find((p)=>p.type === 'save' && p.payload && p.payload.caseApplySeq !== undefined);
		expect(seqPut && seqPut.payload.caseApplySeq).toBe(4);
	});

	it('未指定性别:不落键(JSON 省键,旧档体积语义零变),还原不新建 entry、不改现状', ()=>{
		upsertLocalCase({
			event: '闭环·未指定性别',
			caseType: 'lingqi',
			divTime: '2026-08-13 11:00:00',
			zone: '+08:00',
			payload: { module: 'lingqi', counts: [2, 3, 3] },
		});
		const rec = listLocalCases().find((r)=>r.event === '闭环·未指定性别');
		expect(rec).toBeTruthy();
		expect('gender' in rec).toBe(false);
		const { flds } = applyCaseFields(rec);
		expect(flds.gender).toBeUndefined();
	});

	it('[R4] 事盘备注 memo 全链:落库(present 才落)→读回;未填零落键', ()=>{
		upsertLocalCase({
			event: '闭环·带备注',
			caseType: 'taiyi',
			divTime: '2026-08-13 13:00:00',
			zone: '+08:00',
			memo: '应期:秋后验',
		});
		upsertLocalCase({
			event: '闭环·无备注',
			caseType: 'taiyi',
			divTime: '2026-08-13 13:30:00',
			zone: '+08:00',
		});
		const withMemo = listLocalCases().find((r)=>r.event === '闭环·带备注');
		const without = listLocalCases().find((r)=>r.event === '闭环·无备注');
		expect(withMemo.memo).toBe('应期:秋后验');
		expect('memo' in without).toBe(false);
	});

	it('坏 payload 串:解析失败回退、还原不抛(时间/地点仍还原)', ()=>{
		upsertLocalCase({
			event: '闭环·坏payload',
			caseType: 'taiyi',
			divTime: '2026-08-13 12:00:00',
			zone: '+08:00',
			payload: '{oops-not-json',
		});
		const rec = listLocalCases().find((r)=>r.event === '闭环·坏payload');
		const { flds } = applyCaseFields(rec);
		expect(flds.date && flds.date.value).toBeTruthy();
		expect(flds.zone && flds.zone.value).toBe('+08:00');
	});
});

describe('闭环总锁 · 命盘 存→落库→applyRecordToFields 还原', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('技法键经真落库后仍逐键可还原(termsVariant 去重复枚举后唯一落库)', ()=>{
		upsertLocalChart({
			name: '闭环命盘',
			birth: '1990-02-01 12:30:00',
			zone: '+08:00',
			lat: '31n12',
			lon: '121e30',
			gender: 0,
			hsys: 3,
			zodiacal: 1,
			termsVariant: 2,
		});
		const rec = listLocalCharts().find((r)=>r.name === '闭环命盘');
		expect(rec).toBeTruthy();
		expect(rec.gender).toBe(0);
		expect(rec.hsys).toBe(3);
		expect(rec.termsVariant).toBe(2);
		const out = applyRecordToFields({}, rec);
		expect(out.hsys && out.hsys.value).toBe(3);
		expect(out.zodiacal && out.zodiacal.value).toBe(1);
		expect(out.termsVariant && out.termsVariant.value).toBe(2);
	});
});
