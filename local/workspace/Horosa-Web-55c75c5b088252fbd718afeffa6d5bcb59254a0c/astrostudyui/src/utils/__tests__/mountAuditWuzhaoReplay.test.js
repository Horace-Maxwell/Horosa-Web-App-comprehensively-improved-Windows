// [挂载自检 F-29] 五兆随机揲筮存档的忠实复现:存档 pan 带六位兆数/逐掷阳面 → 无头按模式选配方复现(后端三日期×五模式实测位位同盘),
// 判读齿轮按当前挂载设置重算;此前一律回落干支起例 = 拨任一判读齿轮兆就变(张冠李戴)。
// 判别向量:去掉 storedPan 透传或复现配方 → 第 1/2/3 例请求体 mode 变回 'ganzhi' 即红。
var mockCaptured = [];
var mockFakePan = {
	positions: [1, 2, 3, 4, 5, 1].map((n, i) => ({ key: `p${i}`, label: `p${i}`, number: n, element: '木', palace: '巽', beast: '青龙', flags: [] })),
	sections: [
		{ title: '起盘', rows: [{ label: '起盘时间', value: '2026-05-15 10:12:00' }, { label: '起盘方式', value: '直输五兆数' }] },
		{ title: '揲筮', rows: [{ label: '揲筮模式', value: '手动复现' }, { label: '手动六数', value: '1、2、3、4、5、1' }] },
		{ title: '兆', rows: [{ label: '宫位', value: '巽' }] },
	],
};
jest.mock('../../utils/kentangCache', () => ({
	cachedKentangFetch: jest.fn(async (url, init) => {
		mockCaptured.push(JSON.parse(init.body));
		return { text: async () => JSON.stringify({ ResultCode: 0, Result: mockFakePan }) };
	}),
}));
jest.mock('../../utils/perfFlags', () => ({ stepPrefetchEnabled: () => false, kentangCacheEnabled: () => false }));
const captured = mockCaptured;
import DateTime from '../../components/comp/DateTime';
import { buildWuZhaoSnapshotForFields, wuzhaoReplayOptionsFromPan } from '../../components/wuzhao/WuZhaoMain';

function fields(){
	const dt = new DateTime();
	const t = dt.parse ? dt.parse('2026-05-15 10:12:00', 'YYYY-MM-DD HH:mm:ss') : dt;
	return { date: { value: t }, time: { value: t.clone ? t.clone() : t }, zone: { value: '+08:00' }, lat: { value: '30n00' }, lon: { value: '120e00' }, gender: { value: 1 } };
}
const NUMS = [2, 3, 3, 2, 1, 3];
const pan = (mode, extra) => ({ mode, positions: NUMS.map((n) => ({ number: n })), ...(extra || {}) });

beforeEach(() => { captured.length = 0; });

describe('wuzhaoReplayOptionsFromPan 配方', () => {
	it('day/hour/minute/tang → manual+manualSplits=兆数;dunhuang → zhushu+zhaoNums;qian 自动掷 → qianAuto=false+逐掷阳面', () => {
		['day', 'hour', 'minute', 'tang'].forEach((m) => {
			expect(wuzhaoReplayOptionsFromPan(pan(m), m)).toMatchObject({ manual: true, manualSplits: NUMS });
		});
		expect(wuzhaoReplayOptionsFromPan(pan('dunhuang'), 'dunhuang')).toMatchObject({ mode: 'zhushu', zhaoNums: NUMS });
		const q = pan('qian', { shifaDetail: { kind: 'qian', rows: [3, 2, 2, 3, 2, 4].map((y) => ({ yang: y })) } });
		expect(wuzhaoReplayOptionsFromPan(q, 'qian')).toMatchObject({ qianAuto: false, qianThrows: [3, 2, 2, 3, 2, 4] });
		// 掷钱明细缺席 → 退回五兆数直输(仍忠实于兆)
		expect(wuzhaoReplayOptionsFromPan(pan('qian'), 'qian')).toMatchObject({ mode: 'zhushu', zhaoNums: NUMS });
	});
	it('材料坏/缺 → null(调用方回落干支起例)', () => {
		expect(wuzhaoReplayOptionsFromPan(null, 'tang')).toBeNull();
		expect(wuzhaoReplayOptionsFromPan({ positions: [{ number: 9 }, {}, {}, {}, {}, {}] }, 'tang')).toBeNull();
		expect(wuzhaoReplayOptionsFromPan({ positions: [{ number: 1 }] }, 'tang')).toBeNull();
		expect(wuzhaoReplayOptionsFromPan(pan('ganzhi'), 'ganzhi')).toBeNull();
	});
});

describe('buildWuZhaoSnapshotForFields 无头复现', () => {
	it('🔴 存档唐法揲筮 + 拨行神月制 → 请求体 mode 仍 tang、manual+manualSplits=存档兆数、xingshenMonth=jieqi;快照带复现说明', async () => {
		const text = await buildWuZhaoSnapshotForFields(fields(), { mode: 'tang', xingshenMonth: 'jieqi', storedPan: pan('tang') });
		expect(captured).toHaveLength(1);
		expect(captured[0]).toMatchObject({ mode: 'tang', manual: true, manualSplits: NUMS, xingshenMonth: 'jieqi' });
		expect(text).toContain('复现说明：兆数取自存档原盘(唐代正法揲筮)');
		expect(text.indexOf('[揲筮]')).toBeLessThan(text.indexOf('复现说明'));
	});
	it('🔴 存档敦煌法 → zhushu+zhaoNums;存档以钱代筮(自动) → qianAuto=false+qianThrows', async () => {
		await buildWuZhaoSnapshotForFields(fields(), { mode: 'dunhuang', storedPan: pan('dunhuang') });
		expect(captured[0]).toMatchObject({ mode: 'zhushu', zhaoNums: NUMS });
		await buildWuZhaoSnapshotForFields(fields(), { mode: 'qian', qianAuto: true, storedPan: pan('qian', { shifaDetail: { kind: 'qian', rows: [3, 2, 2, 3, 2, 4].map((y) => ({ yang: y })) } }) });
		expect(captured[1]).toMatchObject({ mode: 'qian', qianAuto: false, qianThrows: [3, 2, 2, 3, 2, 4] });
	});
	it('无存档兆数 / 存档模式≠当前模式 → 仍回落干支起例,[Q-020/M-27] 快照明写回落原因(此前静默);确定性模式不受影响', async () => {
		const t1 = await buildWuZhaoSnapshotForFields(fields(), { mode: 'tang' });
		expect(captured[0].mode).toBe('ganzhi');
		expect(t1).toContain('复现说明：挂载无法复现随机起兆');
		expect(t1).toContain('已按干支起例');
		const t2 = await buildWuZhaoSnapshotForFields(fields(), { mode: 'hour', storedPan: pan('tang') });
		expect(captured[1].mode).toBe('ganzhi');
		expect(t2).toContain('已按干支起例');
		const text = await buildWuZhaoSnapshotForFields(fields(), { mode: 'zhushu', zhaoNums: [5, 5, 5, 5, 5, 5], storedPan: pan('tang') });
		expect(captured[2]).toMatchObject({ mode: 'zhushu', zhaoNums: [5, 5, 5, 5, 5, 5] });
		expect(text).not.toContain('复现说明');
	});
	it('源码锚:ctx 五兆分支把 payload.pan 作 storedPan 透传', () => {
		const fs = require('fs'); const path = require('path');
		const src = fs.readFileSync(path.join(__dirname, '..', 'aiAnalysisContext.js'), 'utf8');
		const i = src.indexOf("case 'wuzhao': {");
		expect(src.slice(i, i + 1200)).toContain("if(p.pan && typeof p.pan === 'object'){ opts.storedPan = p.pan; }");
	});
});
