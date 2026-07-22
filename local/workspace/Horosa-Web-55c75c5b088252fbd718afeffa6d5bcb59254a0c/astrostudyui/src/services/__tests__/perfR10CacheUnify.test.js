// PERF-R10 Ship5 缓存统一金标(v3.5.1 收敛后 = moira 稳定键专辑):
//   horosa_moira_stable_key_v1:同 (params,transitParams) 不同 chartObj.chartId → 稳定键相等、
//   第二次命中(网络只走一次)—— 旧键含随机 chartId 时同参永不命中的退化在此钉死;
//   cachedPost cfg.key 显式键覆盖生效;空键 = fail-open 不缓存。
// (kt L3 金标已随 _kentangResultCache 退役 —— 上游 utils/kentangCache.js 自带
//  kentangCache.test.js 覆盖三层/rev/在途去重;wuzhao 随机守卫金标见 kentangCacheWuzhaoGuard.test.js。)
jest.mock('../../utils/request', () => ({
	__esModule: true,
	default: jest.fn(async () => ({ Result: 'net', ResultCode: 0 })),
}));

import { cachedPost } from '../_requestCache';
import { stableMoiraKey } from '../qizheng';
import request from '../../utils/request';

beforeEach(() => {
	window.localStorage.removeItem('horosa.perf.techniqueResultCache');
	request.mockClear();
});

describe('horosa_moira_stable_key_v1', () => {
	test('同 (params,transitParams) 不同 chartId → 稳定键相等;不同过运参数 → 键不等', () => {
		const mk = (cid, tp) => ({
			chartObj: { chartId: cid, params: { date: '1990/06/15', hsys: 1 } },
			params: { date: '1990/06/15', hsys: 1 },
			transitParams: tp,
		});
		const k1 = stableMoiraKey(mk('aaaa1111', { y: 2026 }));
		const k2 = stableMoiraKey(mk('bbbb2222', { y: 2026 }));
		const k3 = stableMoiraKey(mk('aaaa1111', { y: 2027 }));
		expect(k1).toBeTruthy();
		expect(k1).toBe(k2);
		expect(k1).not.toBe(k3);
	});

	test('cachedPost cfg.key 显式键:同 key 第二次零网络(不受 body 里随机 chartId 干扰)', async () => {
		const r1 = await cachedPost('/qizheng/moira', { chartObj: { chartId: 'x1' }, p: 1 }, {}, { key: 'stable-K' });
		const r2 = await cachedPost('/qizheng/moira', { chartObj: { chartId: 'x2' }, p: 1 }, {}, { key: 'stable-K' });
		expect(request).toHaveBeenCalledTimes(1);
		expect(r2).toEqual(r1);
	});

	test('cfg.key 为空串(构键失败 fail-open)→ 不缓存,两次都走网络', async () => {
		await cachedPost('/qizheng/moira', { chartObj: { chartId: 'x1' }, p: 2 }, {}, { key: '' });
		await cachedPost('/qizheng/moira', { chartObj: { chartId: 'x2' }, p: 2 }, {}, { key: '' });
		expect(request).toHaveBeenCalledTimes(2);
	});
});
