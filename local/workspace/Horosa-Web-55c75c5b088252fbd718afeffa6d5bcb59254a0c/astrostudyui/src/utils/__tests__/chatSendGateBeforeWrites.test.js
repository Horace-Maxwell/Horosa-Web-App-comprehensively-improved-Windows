// AI 对话:发送 / 重新生成 / 编辑并分支共用一道重入闸(sendingRef)。闸必须在改动任何对话数据之前占 ——
// 此前「重新生成」先删掉末条回复、再查闸:读库的这几毫秒里回车发送了新问题,发送先过闸,重答这一路接着把上一条回答删掉,
// 然后在闸前静默退出:回答被删了,却没有重答。
// 源码合同:每个会发流式回复(streamReply)的函数里,`sendingRef.current = true` 出现在第一个改库调用之前。
import fs from 'fs';
import path from 'path';

const { parseModule } = require('./helpers/importSpecs');
const { sourceSetFiles } = require('./helpers/sourceSet');   // 门面 + 子模块全集,逐个文件解析
const traverse = require('@babel/traverse').default;
const MAIN_FILES = sourceSetFiles(path.resolve(__dirname, '../../components/aianalysis/AIAnalysisMain.js'));
const WRITES = ['deleteStoreRecord', 'deleteWhere', 'replaceConversationMessages', 'putStoreRecord', 'updateStoreRecordIf', 'bulkPutStoreRecords', 'saveConversationMessage', 'deleteStoreRecords'];

const fnName = (p)=>(p.node.id ? p.node.id.name : (p.parentPath.isVariableDeclarator() ? p.parentPath.node.id.name : (p.parentPath.isObjectProperty() ? (p.parentPath.node.key.name || '') : '')));
function problems(src){
	const ast = parseModule(src);
	const hosts = new Set();
	traverse(ast, {
		CallExpression(q){
			const c = q.node.callee;
			if(c.type !== 'Identifier' || c.name !== 'streamReply'){ return; }
			let h = q.getFunctionParent();
			while(h && !fnName(h)){ h = h.parentPath && h.parentPath.getFunctionParent(); }
			if(h){ hosts.add(h); }
		},
	});
	const bad = [];
	hosts.forEach((h)=>{
		let gateAt = Infinity;
		let writeAt = Infinity;
		let writeName = '';
		h.traverse({
			AssignmentExpression(q){
				const l = q.node.left;
				if(l.type === 'MemberExpression' && l.object && l.object.name === 'sendingRef' && l.property && l.property.name === 'current'
					&& q.node.right.type === 'BooleanLiteral' && q.node.right.value === true && q.node.start < gateAt){ gateAt = q.node.start; }
			},
			CallExpression(q){
				const c = q.node.callee;
				const n = c.type === 'Identifier' ? c.name : '';
				if(WRITES.indexOf(n) >= 0 && q.node.start < writeAt){ writeAt = q.node.start; writeName = n; }
			},
		});
		if(gateAt === Infinity){ bad.push(`${fnName(h)}:没有占重入闸`); return; }
		if(writeAt < gateAt){ bad.push(`${fnName(h)}:${writeName} 在占闸之前`); }
	});
	return { hosts: Array.from(hosts).map(fnName).sort(), bad };
}

describe('源码合同:对话重入闸先于改库', ()=>{
	test('AI 分析页:发送 / 重新生成 / 编辑并分支都先占闸再改对话', ()=>{
		const hosts = [];
		const bad = [];
		MAIN_FILES.forEach((f)=>{ const r = problems(fs.readFileSync(f, 'utf8')); hosts.push(...r.hosts); bad.push(...r.bad); });
		expect(hosts).toEqual(expect.arrayContaining(['handleRegenerateLastReply', 'handleRegenerateMessage', 'handleSend', 'handleEditMessageAndBranch']));
		expect(bad).toEqual([]);
	});
	test('判别力:先删后查闸即红', ()=>{
		const before = "async function handleRegenerateLastReply(){ const l = await list(); await deleteStoreRecord(S, l.id); if(sendingRef.current){ return; } sendingRef.current = true; await streamReply({}); }";
		const after = "async function handleRegenerateLastReply(){ if(sendingRef.current){ return; } sendingRef.current = true; const l = await list(); await deleteStoreRecord(S, l.id); await streamReply({}); }";
		expect(problems(before).bad.length).toBe(1);
		expect(problems(after).bad).toEqual([]);
	});
});
