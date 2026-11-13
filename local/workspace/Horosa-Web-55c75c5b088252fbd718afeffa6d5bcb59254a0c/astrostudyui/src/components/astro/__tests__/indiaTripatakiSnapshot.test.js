// 三旗盘(齿轮 / 页面开启)产出时,印占快照必须照常生成并带「三旗盘逐月净分」段。
// 此前段里用的星座短名助手声明在函数后部(const 被转成 var → 调用时是 undefined),一开三旗盘整份快照抛错:
// 页面导出、挂载、存案全空。
import { buildJyotishSnapshotLines } from '../IndiaChart';

describe('印占快照 × 三旗盘', ()=>{
	it('开三旗盘不抛错,段落带中心星座短名与逐月净分', ()=>{
		const chartObj = { jyotish: { tripataki: { available: true, byCenter: {
			moon: { available: true, centerSign: 'Aries', months: [{ index: 1, score: { net: 2 } }, { index: 2, score: { net: -1 } }] },
			saturn: { available: true, centerSign: 'Libra', months: [{ index: 1, score: null }] },
		} } } };
		const out = buildJyotishSnapshotLines(chartObj);
		const sec = out['Tripataki 三旗盘逐月净分'];
		const text = Array.isArray(sec) ? sec.join('\n') : `${sec}`;
		expect(text).toContain('白羊');
		expect(text).toContain('天秤');
		expect(text).toContain('1:2 2:-1');
		expect(text).toContain('1:-');
	});
});
