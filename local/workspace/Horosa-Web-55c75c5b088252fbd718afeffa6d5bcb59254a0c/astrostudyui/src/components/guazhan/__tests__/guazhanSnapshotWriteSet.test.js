// 六爻页盘面变化后只写本技法的 AI 快照(guazhan,延迟构建);不再另写任何旁路快照槽。
jest.mock('../../../utils/moduleAiSnapshot', ()=>({
	saveModuleAISnapshot: jest.fn(),
	saveModuleAISnapshotLazy: jest.fn(),
	loadModuleAISnapshot: jest.fn(()=>null),
}));

import GuaZhanMain from '../GuaZhanMain';
import { Gua64, getGua64 } from '../../gua/GuaConst';
import { buildSnapshotAnalysis } from '../liuyaoSnapshotEx';

const snap = require('../../../utils/moduleAiSnapshot');

function mkState(){
	getGua64(0);
	const g = Gua64.find((x)=>x.name === '火水未济');
	const yao = g.value.map((v, i)=>({ value: v, change: i === 2, god: null, name: g.yaoname[i] }));
	return {
		currentGua: Gua64.indexOf(g),
		yao,
		nongli: { dayGanZi: '癸巳', monthGanZi: '乙未', yearGanZi: '丙午', timeGanZi: '壬子', time: '子' },
		guaDesc: {},
		liuyaoSettings: null,
	};
}

describe('六爻页快照写入面', ()=>{
	beforeEach(()=>{ jest.clearAllMocks(); });

	test('卦已定、盘面变化:只延迟写 guazhan 一个槽,不写其它模块名', ()=>{
		const state = mkState();
		// 前提:这一卦能产出断卦分析(旁路写端当年就是拿它写的)
		expect(buildSnapshotAnalysis(state)).toBeTruthy();
		const self = {
			props: { fields: { a: 1 } },
			state,
			restoreFromCurrentCase: ()=>{},
			isFlipping: ()=>false,
		};
		GuaZhanMain.prototype.componentDidUpdate.call(self, { fields: null }, { ...state, currentGua: null });
		expect(snap.saveModuleAISnapshotLazy).toHaveBeenCalledTimes(1);
		expect(snap.saveModuleAISnapshotLazy.mock.calls[0][0]).toBe('guazhan');
		expect(snap.saveModuleAISnapshot).not.toHaveBeenCalled();
	});

	test('翻动中不写', ()=>{
		const state = mkState();
		const self = { props: { fields: {} }, state, restoreFromCurrentCase: ()=>{}, isFlipping: ()=>true };
		GuaZhanMain.prototype.componentDidUpdate.call(self, { fields: null }, { ...state, currentGua: null });
		expect(snap.saveModuleAISnapshotLazy).not.toHaveBeenCalled();
		expect(snap.saveModuleAISnapshot).not.toHaveBeenCalled();
	});
});
