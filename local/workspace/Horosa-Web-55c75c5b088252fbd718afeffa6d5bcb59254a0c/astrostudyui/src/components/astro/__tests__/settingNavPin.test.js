// 星盘设置抽屉:点左侧导航的某组后,高亮钉在点的那组,直到用户自己滚离。
// 否则:点「灵学扩展」(靠末尾、滚不到顶)→ 抽屉见底 →「见底取最后一组」把高亮改成「解释与计算」;平滑滚动途中经过的组也会抢高亮。
import fs from 'fs';
import path from 'path';
import { resolveNavPin, NAV_PIN_SETTLE_MS } from '../ChartDisplaySelector';

describe('resolveNavPin(纯逻辑)', ()=>{
	const pin = { id: 'esoteric', target: 4000, arrived: false, until: 1000 };
	test('还没点过 → 不钉', ()=>{
		expect(resolveNavPin(null, 0, 100, 0)).toEqual({ keep: false, pin: null });
	});
	test('平滑滚动途中仍按点的那组;到了(目标超出可滚上限时按上限算)记为已到达', ()=>{
		expect(resolveNavPin(pin, 1200, 3284, 500)).toEqual({ keep: true, pin });
		const r = resolveNavPin(pin, 3284, 3284, 600);
		expect(r.keep).toBe(true);
		expect(r.pin.arrived).toBe(true);
	});
	test('到达后在原位(±4)继续钉;用户滚离即解除', ()=>{
		const arrived = { ...pin, arrived: true };
		expect(resolveNavPin(arrived, 3281, 3284, 5000).keep).toBe(true);
		expect(resolveNavPin(arrived, 3200, 3284, 5000)).toEqual({ keep: false, pin: null });
	});
	test('迟迟到不了(途中被用户打断)→ 超时解除', ()=>{
		expect(resolveNavPin(pin, 1200, 3284, 1001)).toEqual({ keep: false, pin: null });
		expect(NAV_PIN_SETTLE_MS).toBeGreaterThanOrEqual(1000);
	});
});

describe('接线', ()=>{
	const src = fs.readFileSync(path.resolve(__dirname, '..', 'ChartDisplaySelector.js'), 'utf8');
	test('点导航时记下钉住的组与目标位置;滚动跟随先问 resolveNavPin', ()=>{
		expect(src).toMatch(/this\.navPin = \{ id, target: top, arrived: false, until: Date\.now\(\) \+ NAV_PIN_SETTLE_MS \};\n\t\tthis\.setState\(\{ activeNav: id \}\);/);
		expect(src).toMatch(/syncActiveNav\(\)\{[\s\S]{0,200}if\(this\.navPin\)\{\s*\n\s*const r = resolveNavPin\(this\.navPin, host\.scrollTop, host\.scrollHeight - host\.clientHeight, Date\.now\(\)\);/);
	});
});
