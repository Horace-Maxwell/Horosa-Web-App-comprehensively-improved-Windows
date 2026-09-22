// [压测二轮·D3] MCP 资源面敌意 URI:原型链 kind / 路径穿越 / 超长 id / 坏百分号编码。
// 合同:parseResourceUri 只认自有键的三类(chart/case/material),其余一律 null;readResource 永不抛、永不把 Object.prototype 上的函数当读取器;
// 经桥 resources/read 时坏 URI 一律回 -32602(而不是让整条请求 reject 成 -32603)。
import { parseResourceUri, readResource, resourceUri, RESOURCE_KINDS, RESOURCE_SCHEME } from '../aiTools/resources';
import { handleAgentToolRequest, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { setAgentEnabled } from '../aiAgent/prefs';

const deps = ()=>({
	exportToolManifest: ()=>[],
	runTool: async ()=>({ ok: true }),
	listResources: async ()=>[],
	listResourceTemplates: ()=>[],
	readResource,
});

beforeEach(()=>{
	window.localStorage.clear();
	__resetMcpBridgeForTests();
	setAgentEnabled(true);
});

// 原型链上的键:constructor / toString / hasOwnProperty / valueOf / __proto__ —— 都不是资源类别
const PROTO_KINDS = ['constructor', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', '__proto__'];

describe('R1 原型链 kind', ()=>{
	it('🔴 R1 `horosa://constructor/x` 等原型键 → parseResourceUri 与 readResource 皆 null;经桥回 -32602', async ()=>{
		// 当前代码为何红:resources.js:25 用 `KIND_READERS[kind] === undefined` 判类别 —— 走原型链,
		// KIND_READERS['constructor'] = Object 构造器(函数,非 undefined)→ 判为合法类别;
		// resources.js:74-77 再 `typeof reader === 'function'` 通过 → 真的把 Object('x') 当正文读出来。
		// 正解:Object.prototype.hasOwnProperty.call(KIND_READERS, kind)。
		expect(RESOURCE_KINDS).toEqual(['chart', 'case', 'material']);
		PROTO_KINDS.forEach((kind)=>{
			expect(parseResourceUri(`${RESOURCE_SCHEME}${kind}/x`)).toBe(null);
		});
		for(let i = 0; i < PROTO_KINDS.length; i++){
			// eslint-disable-next-line no-await-in-loop
			const one = await readResource(`${RESOURCE_SCHEME}${PROTO_KINDS[i]}/x`);
			expect(one).toBe(null);
			// eslint-disable-next-line no-await-in-loop
			const viaBridge = await handleAgentToolRequest({ id: i, method: 'resources/read', params: { uri: `${RESOURCE_SCHEME}${PROTO_KINDS[i]}/x` } }, deps());
			expect(viaBridge.ok).toBe(false);
			expect(viaBridge.error.code).toBe(-32602);
		}
		// 合法三类照旧被识别(判别力:上面的 null 不是因为整条链都不认)
		expect(parseResourceUri(resourceUri('chart', 'local-1'))).toEqual({ kind: 'chart', id: 'local-1' });
		expect(parseResourceUri(resourceUri('material', 'm-1'))).toEqual({ kind: 'material', id: 'm-1' });
	});
});

describe('R2 穿越 / 超长 / 坏编码', ()=>{
	it('🔴 R2 坏百分号编码不抛且桥回 -32602;超长 id 拒收;路径穿越不越出本类', async ()=>{
		// 当前代码为何红:
		//  ① resources.js:24 `decodeURIComponent(...)` 无 try —— `horosa://chart/%E0%A4%A` 直接抛 URIError,
		//     parseResourceUri 同步抛、readResource(async)变成 reject,桥的 resources/read 分支(mcpBridge.js:99-105)
		//     没有 try/catch → 整条 handleAgentToolRequest reject(不是 -32602)。
		//  ② id 无长度上限(resources.js:24-26)—— 1e6 字符照收。
		expect(()=>parseResourceUri(`${RESOURCE_SCHEME}chart/%E0%A4%A`)).not.toThrow();
		expect(parseResourceUri(`${RESOURCE_SCHEME}chart/%E0%A4%A`)).toBe(null);
		expect(parseResourceUri(`${RESOURCE_SCHEME}chart/%`)).toBe(null);
		await expect(readResource(`${RESOURCE_SCHEME}chart/%E0%A4%A`)).resolves.toBe(null);
		const bad = await handleAgentToolRequest({ id: 1, method: 'resources/read', params: { uri: `${RESOURCE_SCHEME}chart/%E0%A4%A` } }, deps());
		expect(bad.ok).toBe(false);
		expect(bad.error.code).toBe(-32602);

		// 超长 id:上限 256(再长的 id 不可能对应任何本机记录,只会拖着整条链去扫全表)
		const huge = 'a'.repeat(1000000);
		expect(parseResourceUri(`${RESOURCE_SCHEME}chart/${huge}`)).toBe(null);
		const hugeRsp = await handleAgentToolRequest({ id: 2, method: 'resources/read', params: { uri: `${RESOURCE_SCHEME}chart/${huge}` } }, deps());
		expect(hugeRsp.ok).toBe(false);
		expect(hugeRsp.error.code).toBe(-32602);
	});

	it('R2b 路径穿越 `horosa://chart/../case/x`:kind 不被改写、不抛、桥回 -32602', async ()=>{
		const parsed = parseResourceUri(`${RESOURCE_SCHEME}chart/../case/x`);
		// 允许两种收法:整条拒(null)或收成 chart 类下一个查不到的 id —— 但绝不能变成 case 类
		if(parsed){ expect(parsed.kind).toBe('chart'); }
		await expect(readResource(`${RESOURCE_SCHEME}chart/../case/x`)).resolves.toBe(null);
		const rsp = await handleAgentToolRequest({ id: 3, method: 'resources/read', params: { uri: `${RESOURCE_SCHEME}chart/../case/x` } }, deps());
		expect(rsp.ok).toBe(false);
		expect(rsp.error.code).toBe(-32602);
	});

	it('R2c 非本协议 / 空 id / 无斜杠 一律 null(既有判别力回归)', ()=>{
		expect(parseResourceUri(null)).toBe(null);
		expect(parseResourceUri('')).toBe(null);
		expect(parseResourceUri('http://chart/x')).toBe(null);
		expect(parseResourceUri(`${RESOURCE_SCHEME}chart`)).toBe(null);
		expect(parseResourceUri(`${RESOURCE_SCHEME}chart/`)).toBe(null);
		expect(parseResourceUri(`${RESOURCE_SCHEME}/x`)).toBe(null);
	});
});
