// 立即派发型页面「改了时间立刻点起盘」:取时刻优先用最新改动;页面收到新的盘面字段即清掉(不盖外部改动)。
import { notePendingTime, pendingTimePatch, clearPendingTimeOnFieldsChange } from '../pendingTimeDraft';
import DateTime from '../../components/comp/DateTime';

const at = (s)=>{ const d = new DateTime(); d.setZone('+08:00'); return d.parse(s, 'YYYY-MM-DD HH:mm:ss'); };

describe('改时间的最新时刻', ()=>{
	test('记下 → 取时刻优先用它;盘面字段换了(全局追上 / 外部改动)→ 清掉', ()=>{
		const f0 = { a: 1 };
		const host = { props: { fields: f0 } };
		notePendingTime(host, at('2026-05-05 14:00:00'));
		expect(pendingTimePatch(host).time.value.format('HH:mm')).toBe('14:00');
		clearPendingTimeOnFieldsChange(host, { fields: f0 });
		expect(pendingTimePatch(host)).not.toBe(null);
		host.props = { fields: { a: 2 } };
		clearPendingTimeOnFieldsChange(host, { fields: f0 });
		expect(pendingTimePatch(host)).toBe(null);
	});
	test('七个立即派发型页面都接上(取时刻函数开头优先最新改动;改时间时记;字段换了清)', ()=>{
		const fs = require('fs');
		const path = require('path');
		['taiyi/TaiYiMain', 'huangji/HuangJiMain', 'wuzhao/WuZhaoMain', 'shenyishu/ShenYiShuMain', 'jingjue/JingJueMain', 'taixuan/TaiXuanMain', 'kinastro/KinAstroMain'].forEach((f)=>{
			const src = fs.readFileSync(path.resolve(__dirname, '../../components', `${f}.js`), 'utf8');
			const g = src.indexOf('getTimeFieldsFromSelector(baseFields){');
			expect([f, g > 0]).toEqual([f, true]);
			expect([f, src.slice(g, g + 200).indexOf('pendingTimePatch(this)') > 0]).toEqual([f, true]);
			expect([f, /onTimeChanged\(value\)\s*\{\n\t\tnotePendingTime\(this,/.test(src)]).toEqual([f, true]);
			expect([f, src.indexOf('clearPendingTimeOnFieldsChange(this, prevProps);') > 0]).toEqual([f, true]);
		});
	});
	test('太乙:改时间后(全局还没追上)点起盘按新时刻', ()=>{
		const TaiYiMain = require('../../components/taiyi/TaiYiMain').default;
		const sent = [];
		const ctx = {
			props: { fields: { date: { value: at('2026-05-05 10:00:00') }, time: { value: at('2026-05-05 10:00:00') }, zone: { value: '+08:00' } } },
			timeHook: { getValue: ()=>({ value: at('2026-05-05 10:00:00') }) },
			onFieldsChange: (p)=>sent.push(p),
			requestNongli: (f)=>sent.push({ req: f }),
		};
		ctx.getTimeFieldsFromSelector = TaiYiMain.prototype.getTimeFieldsFromSelector.bind(ctx);
		notePendingTime(ctx, at('2026-05-05 14:00:00'));
		TaiYiMain.prototype.clickPlot.call(ctx);
		expect(sent[sent.length - 1].req.time.value.format('HH:mm')).toBe('14:00');
	});
});
