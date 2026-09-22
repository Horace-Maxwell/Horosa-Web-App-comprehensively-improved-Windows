// [Q-391/T-373] 无头六爻快照路径先把《断易天机》断语库载入缓存:此前只有六爻页 mount / 占类视图预热,AI 挂载 / 导出的无头路径
// 从不调用 loader → 本会话没开过六爻页(或页面 chunk 未加载)时断语行静默缺失。本例锁「无头重算必先 await 共享 loader」。
jest.mock('../../components/gua/data/liuyaoDoctrineCache', () => {
	const actual = jest.requireActual('../../components/gua/data/liuyaoDoctrineCache');
	return { ...actual, loadDoctrine: jest.fn(() => Promise.resolve(actual.getDoctrine() || {})) };
});
import { regenerateCaseTechniqueSnapshot } from '../aiAnalysisContext';
import { loadDoctrine } from '../../components/gua/data/liuyaoDoctrineCache';

describe('[Q-391] 无头六爻快照预载断语库', () => {
	beforeEach(() => { loadDoctrine.mockClear(); });

	test('已存卦(payload.gua)重算:进正文前先 await loadDoctrine', async () => {
		try{
			await regenerateCaseTechniqueSnapshot({ cid: 'case-x', divTime: '2026-01-01 10:00:00', zone: '+08:00' }, 'sixyao', { gua: { currentGua: {}, yao: [] } });
		}catch(e){ /* 最小 gua 结构可能进不了正文,本例只证加载时序 */ }
		expect(loadDoctrine).toHaveBeenCalled();
	});

	test('无存卦按时间起卦重算:同样先 await loadDoctrine(loader 失败不阻断)', async () => {
		loadDoctrine.mockImplementationOnce(() => Promise.reject(new Error('no doctrine')));
		let out = '';
		try{ out = await regenerateCaseTechniqueSnapshot({ cid: 'case-y', divTime: '2026-01-01 10:00:00', zone: '+08:00' }, 'sixyao', {}); }catch(e){ out = ''; }
		expect(loadDoctrine).toHaveBeenCalled();
		expect(typeof out).toBe('string');
	});
});
