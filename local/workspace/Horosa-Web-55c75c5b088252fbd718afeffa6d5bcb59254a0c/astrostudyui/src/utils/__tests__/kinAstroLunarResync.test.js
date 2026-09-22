// [挂载自检 F-21] 演禽/蠢子数农历锚点:auto 档真换算,不再拿公历月日冒充农历。
import { solarToLunarYmd, computeKinFieldsResync } from '../kinAstroFieldsSync';

describe('农历锚点真换算', ()=>{
	it('🔴 2026-05-15 → 农历三月廿九;2026-02-10 → 乙巳年十二月廿三(跨年)', ()=>{
		expect(solarToLunarYmd(2026, 5, 15)).toEqual({ year: 2026, month: 3, day: 29 });
		expect(solarToLunarYmd(2026, 2, 10)).toEqual({ year: 2025, month: 12, day: 23 });
		expect(solarToLunarYmd(-500, 1, 1)).toBeNull();
	});
	it('resync 补丁把 chunziLunar*/lunar* 写成真农历(此前 = 公历数字)', ()=>{
		const mk = (v)=>({ value: v });
		const moment = require('moment');
		const fields = { date: mk(moment('2026-05-15')), time: mk(moment('2026-05-15 10:12:00')), zone: mk('+08:00'), lon: mk('120e00'), lat: mk('30n00'), gender: mk(1) };
		const patch = computeKinFieldsResync(fields, { fieldsSyncSrc: null, gender: 1 });
		expect(patch).toBeTruthy();
		expect(patch.chunziLunarMonth).toBe(3);
		expect(patch.chunziLunarDay).toBe(29);
		expect(patch.lunarYear).toBe(2026);
		expect(patch.lunarMonth).toBe(3);
		expect(patch.lunarDay).toBe(29);
	});
});
