// 地占排盘设置:逐项覆盖层里布尔型的项,state 存的是真布尔值(下拉键是字符串 'true' / 'false')——
// schema 必须按 state 的形态收(首版按下拉键的字符串候选校验 → 三个布尔项保存被拒,行为普查实抓)。
import { GEOMANCY_PAGE_SETTINGS } from '../GeomancyMain';

describe('地占排盘设置 · 逐项覆盖层', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });

	it('布尔型覆盖项按真布尔值保存与读回;字符串型照旧;缺席 = 跟随流派预设', ()=>{
		expect(GEOMANCY_PAGE_SETTINGS.save({ granular: { wrapHouses: true, reconciler: false, haltEnabled: true, direction: 'RTL' } })).toEqual(['granular']);
		expect(GEOMANCY_PAGE_SETTINGS.load().granular).toEqual({ wrapHouses: true, reconciler: false, haltEnabled: true, direction: 'RTL' });
	});

	it('形态不对的不收:布尔项给字符串、字符串项给候选外的值', ()=>{
		GEOMANCY_PAGE_SETTINGS.save({ granular: { wrapHouses: 'true', direction: 'UP', markStyle: 'lines' } });
		expect(GEOMANCY_PAGE_SETTINGS.load().granular).toEqual({ markStyle: 'lines' });
	});

	it('换流派预设 = 清空覆盖层', ()=>{
		GEOMANCY_PAGE_SETTINGS.save({ granular: { markStyle: 'lines' } });
		GEOMANCY_PAGE_SETTINGS.save({ tradition: 'european_classical', granular: {} });
		expect(GEOMANCY_PAGE_SETTINGS.load().granular).toEqual({});
	});
});
