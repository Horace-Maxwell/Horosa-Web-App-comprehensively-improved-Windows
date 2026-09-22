// [Q-340/T-321] /astroextra/analysis 三处请求(格局页/AI 挂载/导出)的恒星轨参数:随盘优先(starOrb/starOrbMode),缺则全局仓;档位下发。
import { fixedStarOrbParamsFor, classicalGlobalValue } from '../classicalChartGlobals';

describe('fixedStarOrbParamsFor(Q-340)', () => {
	it('随盘 starOrb/starOrbMode 优先;缺则全局仓;非按星等不带 mode 键(默认请求体不变)', () => {
		expect(fixedStarOrbParamsFor({ starOrb: 3, starOrbMode: 'byMagnitude' })).toEqual({ fixedStarOrb: 3, fixedStarOrbMode: 'byMagnitude' });
		expect(fixedStarOrbParamsFor({ starOrb: 2 })).toEqual({ fixedStarOrb: 2 });
		expect(fixedStarOrbParamsFor({ fixedStarOrb: 1.5, fixedStarOrbMode: 'school' })).toEqual({ fixedStarOrb: 1.5 });
		const g = fixedStarOrbParamsFor({});
		expect(g.fixedStarOrb).toBe(classicalGlobalValue('fixedStarOrb'));
		expect(Object.keys(g)).toEqual(classicalGlobalValue('fixedStarOrbMode') === 'byMagnitude' ? ['fixedStarOrb', 'fixedStarOrbMode'] : ['fixedStarOrb']);
	});
});
