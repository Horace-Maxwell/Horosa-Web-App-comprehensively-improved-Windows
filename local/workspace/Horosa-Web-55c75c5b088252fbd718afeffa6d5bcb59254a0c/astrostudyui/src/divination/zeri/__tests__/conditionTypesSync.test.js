// 征象条件类型 前↔后端一致性哨兵(preflight 锚点)。
// 后端真值源:astropy/astrostudy/election_scan.py 的 CONDITION_TYPES(一键一行,文件头有格式契约注记)
// 前端真值源:src/divination/zeri/conditionTypes.js 的 CONDITION_TYPES
// 断言双向差空:前端多键=用户可选而后端 invalid_conditions(死开关);后端多键=功能藏而不露。
// 注错自证:对解析产物人为删键,断言差集检测必然报警——防哨兵本身死掉(regex 抓空/比较器恒真)。
import fs from 'fs';
import path from 'path';
import { CONDITION_TYPES, GROUP_TYPES } from '../conditionTypes';

const PY_PATH = path.join(__dirname, '..', '..', '..', '..', '..', 'astropy', 'astrostudy', 'election_scan.py');

function parsePythonRegistry(){
	const src = fs.readFileSync(PY_PATH, 'utf8');
	const block = src.match(/CONDITION_TYPES = \{([\s\S]*?)\n\}/);
	if(!block){
		return { types: [], groups: [] };
	}
	const types = [];
	const lineRe = /^\s*'([a-z_]+)':\s*\{/gm;
	let m;
	while((m = lineRe.exec(block[1]))){
		types.push(m[1]);
	}
	const groups = [];
	const gBlock = src.match(/GROUP_TYPES = \(([^)]*)\)/);
	if(gBlock){
		const gRe = /'([a-z_]+)'/g;
		while((m = gRe.exec(gBlock[1]))){
			groups.push(m[1]);
		}
	}
	return { types, groups };
}

function diffSets(a, b){
	const sa = new Set(a);
	const sb = new Set(b);
	return {
		onlyA: [...sa].filter((x) => !sb.has(x)),
		onlyB: [...sb].filter((x) => !sa.has(x)),
	};
}

describe('[哨兵] 条件类型注册表 前↔后端 双向差空', ()=>{
	const py = parsePythonRegistry();
	const feTypes = Object.keys(CONDITION_TYPES);

	test('后端解析非空(regex 契约:一键一行;抓空=哨兵自身死亡,先于比对报警)', ()=>{
		expect(py.types.length).toBeGreaterThanOrEqual(10);
		expect(py.groups.length).toBe(4);
	});

	test('条件类型键集恒等(前端多=死开关;后端多=藏功能)', ()=>{
		const d = diffSets(feTypes, py.types);
		expect(d).toEqual({ onlyA: [], onlyB: [] });
	});

	test('逻辑门键集恒等', ()=>{
		const d = diffSets([...GROUP_TYPES], py.groups);
		expect(d).toEqual({ onlyA: [], onlyB: [] });
	});

	test('注错自证:删一键必被差集检测咬住(防比较器恒真)', ()=>{
		const mutilated = py.types.slice(1);
		const d = diffSets(feTypes, mutilated);
		expect(d.onlyA.length).toBeGreaterThan(0);
		const d2 = diffSets(mutilated, feTypes);
		expect(d2.onlyB.length).toBeGreaterThan(0);
	});
});
