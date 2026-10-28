// 双盘挂载时技法快照不互相挤占:技法快照的页面槽是「每技法一个」,本人与对方轮流取同一技法会互相覆盖,
// 此前每次发送两人都要重算。现在重算入口前有按(技法, 整份记录, 星盘口径)的内存小缓存:各算一次之后两人都直接命中。
jest.mock('../moduleAiSnapshot', ()=>{
	const actual = jest.requireActual('../moduleAiSnapshot');
	return { ...actual, saveModuleAISnapshot: jest.fn((...a)=>actual.saveModuleAISnapshot(...a)) };
});
import { getAnalysisTechniqueContexts, __resetRegeneratedSnapshotCacheForTests } from '../aiAnalysisContext';
import { saveModuleAISnapshot } from '../moduleAiSnapshot';

const rec = (name, birth)=>({ cid: `local-${name}`, name, birth, zone: '+08:00', lon: '121e28', lat: '31n14', gender: 1 });
const self = { id: 'local-a', sourceType: 'chart', title: '张三', record: rec('张三', '1990-05-18 10:00:00') };
const other = { id: 'local-b', sourceType: 'chart', title: '李四', record: rec('李四', '1992-03-07 08:30:00') };

beforeEach(()=>{ window.localStorage.clear(); saveModuleAISnapshot.mockClear(); __resetRegeneratedSnapshotCacheForTests(); });

test('本人 / 对方轮流取八字:各自只重算一次,内容各是各的;换了记录(改生辰)就重算', async ()=>{
	const a1 = await getAnalysisTechniqueContexts(self, ['bazi']);
	const b1 = await getAnalysisTechniqueContexts(other, ['bazi']);
	const a2 = await getAnalysisTechniqueContexts(self, ['bazi']);
	const b2 = await getAnalysisTechniqueContexts(other, ['bazi']);
	expect(a1[0].content).toBeTruthy();
	expect(b1[0].content).toBeTruthy();
	expect(a1[0].content).not.toBe(b1[0].content);
	expect(a2[0].content).toBe(a1[0].content);
	expect(b2[0].content).toBe(b1[0].content);
	expect(saveModuleAISnapshot).toHaveBeenCalledTimes(2);
	const changed = { ...self, record: { ...self.record, birth: '1990-05-18 12:00:00' } };
	const a3 = await getAnalysisTechniqueContexts(changed, ['bazi']);
	expect(a3[0].content).not.toBe(a1[0].content);
	expect(saveModuleAISnapshot).toHaveBeenCalledTimes(3);
});
