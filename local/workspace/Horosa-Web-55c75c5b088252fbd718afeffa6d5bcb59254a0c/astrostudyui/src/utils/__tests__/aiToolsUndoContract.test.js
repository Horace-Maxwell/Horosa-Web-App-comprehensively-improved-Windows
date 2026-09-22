// 「所有写入可一键撤销」合同:additive 工具 undoKind 为 none 必须显式登记 UNDO_EXEMPT(带理由);登记项必须真是 additive 工具;
// 手册与面板文案的「除 … 外」句从登记表派生(agentAbilityCopy.contract 另锁)。
import { registerBuiltinTools, listTools } from '../aiTools';
import { __resetToolsForTests } from '../aiTools/registry';
import { UNDO_EXEMPT } from '../aiTools/catalog';
import { toolLabel } from '../aiTools/labels';
const fs = require('fs');
const path = require('path');

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); registerBuiltinTools(); });

it('🔴 additive 且 undoKind=none 的工具 ⊆ UNDO_EXEMPT;UNDO_EXEMPT ⊆ additive;理由非空', ()=>{
	const adds = listTools().filter((d)=>d.level === 'additive');
	expect(adds.length).toBeGreaterThanOrEqual(9);
	const noUndo = adds.filter((d)=>!d.undoKind || d.undoKind === 'none').map((d)=>d.name).sort();
	expect(noUndo).toEqual(Object.keys(UNDO_EXEMPT).sort());
	Object.keys(UNDO_EXEMPT).forEach((k)=>{
		expect(adds.some((d)=>d.name === k)).toBe(true);
		expect(`${UNDO_EXEMPT[k]}`.length).toBeGreaterThan(4);
	});
});

it('🔴 应用内手册对每个豁免项写明标签与理由,且保留「每个写入都可在对话里一键撤销」承诺句', ()=>{
	const s = fs.readFileSync(path.resolve(__dirname, '..', '..', 'components', 'help', 'AIAnalysisHelpDoc.js'), 'utf8');
	Object.keys(UNDO_EXEMPT).forEach((k)=>{
		expect(s).toContain(`除「${toolLabel(k)}」`);
		expect(s).toContain(UNDO_EXEMPT[k].split(';')[0]);
	});
	expect(s).toContain('每个写入都可在对话里一键撤销');
	['建档', '改设置', '载入工作区', '任务'].forEach((w)=>expect(s).toContain(w));
});
