// 六壬「起课」草稿优先(与三式合一同一口径):时间弹层里改了还没点「确定」的草稿,直接点「起课」按草稿起;
// 没有草稿时才用时间栏下方加减微调控件的值兜底。此前微调控件(值 = 已确认时刻)排在前面,把草稿盖回旧时刻。
import LiuRengMain from '../LiuRengMain';
import DateTime from '../../comp/DateTime';

const at = (s)=>{ const d = new DateTime(); d.setZone('+08:00'); return d.parse(s, 'YYYY-MM-DD HH:mm:ss'); };
const fieldsAt = (s)=>({ date: { value: at(s) }, time: { value: at(s) }, ad: { value: 1 }, zone: { value: '+08:00' }, lon: { value: '120e00' }, lat: { value: '30n00' } });

function run(self){
	const sent = [];
	const ctx = {
		props: { fields: fieldsAt('2026-05-05 10:00:00'), value: {}, dispatch: (a)=>sent.push(a) },
		timeHook: { getValue: ()=>({ value: at('2026-05-05 10:00:00') }) },
		startPaiPanByFields: ()=>sent.push({ type: 'local' }),
		...self,
	};
	ctx.getTimeFieldsFromSelector = LiuRengMain.prototype.getTimeFieldsFromSelector.bind(ctx);
	LiuRengMain.prototype.clickStartPaiPan.call(ctx);
	return { sent, ctx };
}

describe('六壬起课草稿优先', ()=>{
	test('弹层草稿 14:00 未确认、微调控件仍是 10:00 → 按 14:00 起课,草稿随即清空', ()=>{
		const { sent, ctx } = run({ pendingFields: fieldsAt('2026-05-05 14:00:00') });
		expect(sent.length).toBe(1);
		expect(sent[0].type).toBe('astro/fetchByFields');
		expect(sent[0].payload.time.value.format('HH:mm')).toBe('14:00');
		expect(ctx.pendingFields).toBe(null);
	});
	test('没有草稿:微调控件已步进到 10:30(父级还没跟上)→ 按 10:30;与已确认相同 → 原地重起', ()=>{
		const a = run({ pendingFields: null, timeHook: { getValue: ()=>({ value: at('2026-05-05 10:30:00') }) } });
		expect(a.sent[0].payload.time.value.format('HH:mm')).toBe('10:30');
		const b = run({ pendingFields: null });
		expect(b.sent).toEqual([{ type: 'local' }]);
	});
});

describe('没确认的草稿只对当时那张盘有效', ()=>{
	const didUpdate = (Main, prevFields, nextFields)=>{
		const ctx = { props: { fields: nextFields }, pendingFields: fieldsAt('2026-05-05 14:00:00'), restoreFromCurrentCase: ()=>{}, _after23BoundaryUserOverrode: true };
		Main.prototype.componentDidUpdate.call(ctx, { fields: prevFields });
		return ctx.pendingFields;
	};
	test('🔴 外面换了盘(此刻起课 / 载入别的盘 / 择日点选)→ 草稿作废;只是宿主重渲染(新对象、同时刻同地点)→ 草稿保留', ()=>{
		const JinKouMain = require('../../jinkou/JinKouMain').default;
		[LiuRengMain, JinKouMain].forEach((Main)=>{
			expect(didUpdate(Main, fieldsAt('2026-05-05 10:00:00'), fieldsAt('2026-05-05 08:00:00'))).toBe(null);
			expect(didUpdate(Main, fieldsAt('2026-05-05 10:00:00'), { ...fieldsAt('2026-05-05 10:00:00'), lon: { value: '116e28' } })).toBe(null);
			expect(didUpdate(Main, fieldsAt('2026-05-05 10:00:00'), fieldsAt('2026-05-05 10:00:00'))).not.toBe(null);
		});
	});
	test('金口诀「此刻起课」放弃弹层草稿', ()=>{
		const JinKouMain = require('../../jinkou/JinKouMain').default;
		const ctx = { props: { fields: fieldsAt('2026-05-05 10:00:00'), dispatch: ()=>{} }, pendingFields: fieldsAt('2026-05-05 14:00:00') };
		JinKouMain.prototype.clickPlotNow.call(ctx);
		expect(ctx.pendingFields).toBe(null);
	});
});
