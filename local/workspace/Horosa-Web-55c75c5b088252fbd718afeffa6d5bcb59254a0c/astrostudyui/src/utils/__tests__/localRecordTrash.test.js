// [R3] 回收站行为锁:删除进栈/先恢复后出栈(quota 零丢失)/30 天惰性清理/上限 FIFO/
// trash 写失败不阻断删除主流程/主列表读端零波及。
import {
	upsertLocalChart, listLocalCharts, removeLocalChart,
	listLocalChartsTrash, restoreLocalChartFromTrash, purgeLocalChartTrashItem, clearLocalChartsTrash,
} from '../localcharts';
import { upsertLocalCase, removeLocalCase, listLocalCasesTrash } from '../localcases';

const TRASH_KEY = 'horosa.localCharts.trash.v1';
const CHARTS_KEY = 'horosa.localCharts.v1';

function seedChart(cid, name, updateTime){
	upsertLocalChart({ cid, name, birth: '1990-01-01 08:00:00', zone: '+08:00', updateTime, preserveUpdateTime: true });
}

describe('[R3] 回收站', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
		jest.restoreAllMocks();
	});

	it('🔴 删除进回收站(带 deletedAt),主列表消失、读端零波及', ()=>{
		seedChart('local-t-1', '回收甲', '2026-08-01 10:00:00');
		removeLocalChart('local-t-1');
		expect(listLocalCharts().length).toBe(0);
		const trash = listLocalChartsTrash();
		expect(trash.length).toBe(1);
		expect(trash[0].cid).toBe('local-t-1');
		expect(trash[0].name).toBe('回收甲');
		expect(trash[0].deletedAt).toBeTruthy();
	});

	it('🔴 恢复:回到主列表(updateTime 刷新浮到最前)、trash 出栈', ()=>{
		seedChart('local-t-1', '回收甲', '2026-08-01 10:00:00');
		seedChart('local-t-2', '常驻乙', '2026-08-09 10:00:00');
		removeLocalChart('local-t-1');
		const restored = restoreLocalChartFromTrash('local-t-1');
		expect(restored && restored.cid).toBe('local-t-1');
		expect(restored.deletedAt).toBeUndefined();
		const names = listLocalCharts().map((r)=>r.name);
		expect(names[0]).toBe('回收甲');           // updateTime 刷新 → 最前
		expect(names).toContain('常驻乙');
		expect(listLocalChartsTrash().length).toBe(0);
	});

	it('先恢复后出栈:恢复撞 quota 抛错时,该条仍在回收站(零丢失)', ()=>{
		seedChart('local-t-1', '回收甲', '2026-08-01 10:00:00');
		removeLocalChart('local-t-1');
		const real = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
			if(key === CHARTS_KEY){
				const e = new Error('quota exceeded');
				e.name = 'QuotaExceededError';
				throw e;
			}
			return real.call(this, key, val);
		});
		expect(()=>restoreLocalChartFromTrash('local-t-1')).toThrow('local.chart.save.failed');
		jest.restoreAllMocks();
		expect(listLocalChartsTrash().length).toBe(1);
	});

	it('彻底删除单条/清空(返回条数);30 天过期惰性清理;上限 FIFO 挤掉最旧', ()=>{
		seedChart('local-t-1', '回收甲', '2026-08-01 10:00:00');
		seedChart('local-t-2', '回收乙', '2026-08-02 10:00:00');
		removeLocalChart('local-t-1');
		removeLocalChart('local-t-2');
		purgeLocalChartTrashItem('local-t-1');
		expect(listLocalChartsTrash().map((r)=>r.cid)).toEqual(['local-t-2']);
		expect(clearLocalChartsTrash()).toBe(1);
		expect(listLocalChartsTrash().length).toBe(0);
		// 过期清理:手工注入 31 天前删除的条目
		const old = new Date(Date.now() - 31 * 24 * 3600 * 1000);
		const pad = (n)=>String(n).padStart(2, '0');
		const oldStr = `${old.getFullYear()}-${pad(old.getMonth() + 1)}-${pad(old.getDate())} 00:00:00`;
		window.localStorage.setItem(TRASH_KEY, JSON.stringify([
			{ cid: 'local-expired', name: '过期', deletedAt: oldStr },
			{ cid: 'local-fresh', name: '新鲜', deletedAt: '2026-08-13 00:00:00' },
		]));
		expect(listLocalChartsTrash().map((r)=>r.cid)).toEqual(['local-fresh']);
	});

	it('trash 写失败绝不阻断删除主流程(注错打在 trash 键)', ()=>{
		seedChart('local-t-1', '回收甲', '2026-08-01 10:00:00');
		const real = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, val){
			if(key === TRASH_KEY){
				throw new Error('boom');
			}
			return real.call(this, key, val);
		});
		expect(()=>removeLocalChart('local-t-1')).not.toThrow();
		expect(listLocalCharts().length).toBe(0);   // 删除本体照常生效
	});

	it('事盘侧同款接线(内核一份实现)', ()=>{
		upsertLocalCase({ cid: 'local-case-t-1', event: '回收课', caseType: 'liuyao', divTime: '2026-01-01 10:00:00', zone: '+08:00', updateTime: '2026-08-01 09:00:00', preserveUpdateTime: true });
		removeLocalCase('local-case-t-1');
		const trash = listLocalCasesTrash();
		expect(trash.length).toBe(1);
		expect(trash[0].event).toBe('回收课');
	});
});
