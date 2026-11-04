// 决策层 · 随包金标集索引:GOLDEN_SETS[goldenId] = [{ inputs, truth }, …]。数据住同目录 *.json(单一来源:应用内「一键校准」、
// 离线评测、完备性测试 三方同一份)。
// 金标只增不改(改真值 = 改考卷,须在提交说明里写明理由)。
import chat from './chat.json';
import agent from './agent.json';
import memory from './memory.json';
import materials from './materials.json';
import bestof from './bestof.json';

export const GOLDEN_SETS = { ...chat.sets, ...agent.sets, ...memory.sets, ...materials.sets, ...bestof.sets };

export function goldenSizes(){
	const out = {};
	Object.keys(GOLDEN_SETS).forEach((k)=>{ out[k] = GOLDEN_SETS[k].length; });
	return out;
}
