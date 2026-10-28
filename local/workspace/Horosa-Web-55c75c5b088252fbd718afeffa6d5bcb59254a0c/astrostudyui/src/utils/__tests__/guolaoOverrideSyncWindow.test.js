// AI 挂载按覆盖重算七政(秒级等后端)期间,同窗口其它读者(七政页新盘播种、左栏缺省回显)读到的是本机真值;
// 重算本身(构参 + 快照正文)仍按覆盖值出结果。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: null })) }));
jest.mock('../../services/qizheng', () => ({
	fetchKinastroQizheng: jest.fn(), fetchQizhengElection: jest.fn(),
	fetchMoiraQizhengRules: jest.fn(async () => { throw new Error('offline'); }),
}));
import request from '../request';
import { buildGuolaoSnapshotForFields } from '../../components/guolao/GuoLaoChartMain';
import { withGuolaoStoredOverrides, getStoredGuolaoNodeMode, getStoredGuolaoTrueSolarTime, GUOLAO_NODE_MODE_NORTH_RAHU, GUOLAO_NODE_MODE_NORTH_KETU, __guolaoStoredOverridesForTests } from '../../components/guolao/GuoLaoChartStyle';
import { GL_DIGNITY_RESULT } from '../../components/guolao/__tests__/fixtures/guolaoSnapshotInputs';

const fieldsOf = ()=>({
	date: { value: { format: ()=>'1990/05/18' } }, time: { value: { format: ()=>'10:00:00' } },
	zone: { value: '+08:00' }, lon: { value: '118e27' }, lat: { value: '31n38' }, gpsLon: { value: 118.45 }, gpsLat: { value: 31.63 },
	gender: { value: 1 }, ad: { value: 1 }, hsys: { value: 1 }, zodiacal: { value: 0 }, doubingSu28: { value: 2 },
	name: { value: 'QA' }, pos: { value: '' }, tradition: { value: 1 }, simpleAsp: { value: 0 }, strongRecption: { value: 0 }, virtualPointReceiveAsp: { value: 0 },
});

beforeEach(()=>{ window.localStorage.clear(); request.mockReset(); });

it('等后端期间:同窗口读者读本机真值;重算结果(请求体 + 快照正文)按覆盖值', async ()=>{
	window.localStorage.setItem('horosaGuolaoNodeMode', GUOLAO_NODE_MODE_NORTH_KETU);
	window.localStorage.setItem('horosaGuolaoTrueSolarTime', 'true');
	let release;
	const bodies = [];
	request.mockImplementation((url, opt)=>{
		bodies.push(JSON.parse(opt.body));
		return new Promise((r)=>{ release = ()=>r({ Result: JSON.parse(JSON.stringify(GL_DIGNITY_RESULT)) }); });
	});
	const p = withGuolaoStoredOverrides({ horosaGuolaoNodeMode: GUOLAO_NODE_MODE_NORTH_RAHU, horosaGuolaoTrueSolarTime: 'mean' },
		()=>buildGuolaoSnapshotForFields(fieldsOf()));
	// 等请求发出(作用域链 then 若干拍)
	for(let i = 0; i < 50 && !release; i++){ await Promise.resolve(); }
	let windowSeen;
	try{
		expect(typeof release).toBe('function');
		// 窗口内:其它读者看到的是本机真值,覆盖层不外泄
		windowSeen = { node: getStoredGuolaoNodeMode(), tst: getStoredGuolaoTrueSolarTime(), scope: __guolaoStoredOverridesForTests() };
	}finally{
		if(release){ release(); }   // 无论断言如何都放行,免得作用域链挂住后面的用例
	}
	expect(windowSeen).toEqual({ node: GUOLAO_NODE_MODE_NORTH_KETU, tst: 'true', scope: null });
	const text = await p;
	// 构参(第一个 await 前)按覆盖;快照正文(await 后重入作用域)按覆盖
	expect(bodies[0]).toBeTruthy();
	expect(text).toContain('罗计：北罗南计');
	expect(getStoredGuolaoNodeMode()).toBe(GUOLAO_NODE_MODE_NORTH_KETU);
});

it('无覆盖(页面 / 普通导出路径):与原先一致按本机值', async ()=>{
	window.localStorage.setItem('horosaGuolaoNodeMode', GUOLAO_NODE_MODE_NORTH_RAHU);
	request.mockImplementation(async ()=>({ Result: JSON.parse(JSON.stringify(GL_DIGNITY_RESULT)) }));
	const text = await buildGuolaoSnapshotForFields(fieldsOf());
	expect(text).toContain('罗计：北罗南计');
});

it('AI 挂载重算入口(记录 → 七政快照)整链:覆盖在构参与快照正文里生效', async ()=>{
	window.localStorage.setItem('horosaGuolaoNodeMode', GUOLAO_NODE_MODE_NORTH_KETU);
	request.mockImplementation(async ()=>({ Result: JSON.parse(JSON.stringify(GL_DIGNITY_RESULT)) }));
	const { regenerateChartTechniqueSnapshot } = require('../aiAnalysisContext');
	const record = { cid: 'r1', name: 'QA', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1 };
	const text = await withGuolaoStoredOverrides({ horosaGuolaoNodeMode: GUOLAO_NODE_MODE_NORTH_RAHU },
		()=>regenerateChartTechniqueSnapshot(record, 'guolao'));
	expect(text).toContain('罗计：北罗南计');
	const plain = await regenerateChartTechniqueSnapshot(record, 'guolao');
	expect(plain).toContain('罗计：北计南罗');
});
