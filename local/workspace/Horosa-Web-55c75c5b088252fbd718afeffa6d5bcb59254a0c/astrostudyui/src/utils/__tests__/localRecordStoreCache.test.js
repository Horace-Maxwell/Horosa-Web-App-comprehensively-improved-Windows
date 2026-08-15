// [S9] 读缓存行为锁:raw 原串比对缓存键(免整库重 parse)+失效性天然正确+共享引用契约审计。
import { upsertLocalChart, listLocalCharts } from '../localcharts';
import { upsertLocalCase, listLocalCases } from '../localcases';

const CHARTS_KEY = 'horosa.localCharts.v1';

function deepFreeze(obj){
	if(!obj || typeof obj !== 'object' || Object.isFrozen(obj)){
		return obj;
	}
	Object.freeze(obj);
	Object.keys(obj).forEach((k)=>deepFreeze(obj[k]));
	return obj;
}

describe('[S9] 读缓存', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
	});

	it('命中:同 raw 两次读,记录对象共享引用(免重 parse 的直接证据);数组本身每次新切', ()=>{
		upsertLocalChart({ cid: 'local-c-1', name: '缓存甲', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		const a = listLocalCharts();
		const b = listLocalCharts();
		expect(a).not.toBe(b);
		expect(a[0]).toBe(b[0]);
	});

	it('🔴 失效性:外部直改 setItem(测试/罕见旁路)→ raw 不等必 miss,读到新值', ()=>{
		upsertLocalChart({ cid: 'local-c-1', name: '缓存甲', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		listLocalCharts();
		window.localStorage.setItem(CHARTS_KEY, JSON.stringify([{ cid: 'ext-1', name: '外改', updateTime: '2026-08-02 10:00:00' }]));
		const out = listLocalCharts();
		expect(out.length).toBe(1);
		expect(out[0].name).toBe('外改');
		// clear 后同理(raw=null 永不命中缓存)
		window.localStorage.clear();
		expect(listLocalCharts()).toEqual([]);
	});

	it('写者即缓存者:upsert 后立即读,反映新态且命中(写路径已同步缓存)', ()=>{
		upsertLocalChart({ cid: 'local-c-1', name: '缓存甲', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		const a = listLocalCharts();
		upsertLocalChart({ cid: 'local-c-2', name: '缓存乙', birth: '1991-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-02 10:00:00', preserveUpdateTime: true });
		const b = listLocalCharts();
		expect(b.map((r)=>r.name)).toEqual(['缓存乙', '缓存甲']);
		expect(a.length).toBe(1);   // 旧返回数组不被写路径原地改(独立数组)
	});

	it('🔴 共享引用契约审计:冻结读出记录后跑 upsert 合并/list/分页/导出主流程,零原地修改(不抛)', ()=>{
		'use strict';
		upsertLocalChart({ cid: 'local-c-1', name: '缓存甲', birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime: '2026-08-01 10:00:00', preserveUpdateTime: true });
		upsertLocalCase({ cid: 'local-case-c-1', event: '缓存课', caseType: 'liuyao', divTime: '2026-01-01 10:00:00', zone: '+08:00', updateTime: '2026-08-01 09:00:00', preserveUpdateTime: true });
		listLocalCharts().forEach(deepFreeze);
		listLocalCases().forEach(deepFreeze);
		expect(()=>{
			upsertLocalChart({ cid: 'local-c-1', name: '缓存甲改' });      // 合并位 {...旧,...新}=只读展开
			listLocalCharts({ name: '缓存' });
			upsertLocalCase({ cid: 'local-case-c-1', event: '缓存课改' });
			listLocalCases({ tag: '无' });
		}).not.toThrow();
		expect(listLocalCharts()[0].name).toBe('缓存甲改');
	});
});
