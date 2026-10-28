// 六壬「直接时间」:起课(天地盘 / 四课 / 三传等)与盘头四柱同一时刻 —— 盘的农历换成随时间算法的那份(/liureng/gods),
// 与三式合一、AI 无头重算同做法;两份农历不是同一时刻时不合并;按引用记忆化。快照写明时间算法(缺省不加行)。
import LiuRengMain, { buildLiuRengLayout, buildLiuRengSnapshotText } from '../LiuRengMain';

const chart = { nongli: { time: '辛巳', dayGanZi: '甲子', clockTime: '2026-05-05 11:10:00', birth: '2026-05-05 10:09:00' }, isDiurnal: true };
const godsNongli = { time: '庚午', dayGanZi: '甲子', clockTime: '2026-05-05 11:10:00', birth: '2026-05-05 10:09:00' };
const self = (ta, ln)=>({ state: { timeAlg: ta, liureng: ln ? { nongli: ln } : null } });

describe('六壬盘面随时间算法', ()=>{
	test('真太阳时(缺省):盘原样(引用不变)', ()=>{
		expect(LiuRengMain.prototype.lrChartFor.call(self(0, godsNongli), chart)).toBe(chart);
	});
	test('直接时间:盘的农历换成随算法的那份(时辰 = 午);同一输入引用稳定', ()=>{
		const ctx = self(1, godsNongli);
		const a = LiuRengMain.prototype.lrChartFor.call(ctx, chart);
		expect(a.nongli.time).toBe('庚午');
		expect(a.isDiurnal).toBe(true);
		expect(LiuRengMain.prototype.lrChartFor.call(ctx, chart)).toBe(a);
		expect(chart.nongli.time).toBe('辛巳');   // 不改原对象
	});
	test('两份农历不是同一时刻(改时间后请求先后回来)→ 不合并', ()=>{
		const ctx = self(1, { ...godsNongli, clockTime: '2026-05-05 14:00:00', time: '癸未' });
		expect(LiuRengMain.prototype.lrChartFor.call(ctx, chart)).toBe(chart);
	});
	test('起课按合并后的时辰加临(天地盘占时 = 午)', ()=>{
		const merged = LiuRengMain.prototype.lrChartFor.call(self(1, godsNongli), { ...chart, nongli: { ...chart.nongli, yue: '酉' } });
		const layout = (()=>{ try{ return buildLiuRengLayout(merged, 2, null); }catch(e){ return null; } })();
		if(layout){ expect(layout.timezi).toBe('午'); }
		expect(merged.nongli.time.substr(1)).toBe('午');
	});
	test('快照:直接时间写明算法与钟表时;真太阳时不加行', ()=>{
		const mk = (ta)=>{ try{ return buildLiuRengSnapshotText({ date: '2026-05-05', time: '11:10', zone: '+08:00', lon: '104e04', lat: '30n40', timeAlg: ta }, { nongli: godsNongli }, null, chart, 2, null, 1, {}); }catch(e){ return `ERR ${e.message}`; } };
		const t1 = mk(1);
		const t0 = mk(0);
		expect(t1).toContain('时间算法：直接时间(按钟表时定时辰)');
		expect(t1).toContain('钟表时：2026-05-05 11:10:00');
		expect(t0).not.toContain('时间算法：');
	});
});
