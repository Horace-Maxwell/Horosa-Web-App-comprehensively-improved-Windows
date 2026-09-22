// [Q-059/M-79·M-82] 鉴权定制(额外请求头)令牌与 apiKey 同走静态加密/剥密;解密失败态写库保留原密文(不用空串覆盖)。
import { webcrypto } from 'crypto';
import { redactSecretRecord } from '../aiSecretStores';
import { mergeLocalSecrets } from '../aiWorkspaceRestore';

beforeAll(()=>{
	if(typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle){
		Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
	}
});
const MASTER_B64 = Buffer.alloc(32, 7).toString('base64');
function mockBridge(){
	window.__TAURI__ = { core: { invoke: jest.fn(async (cmd)=>{ if(cmd === 'ai_master_key_command'){ return MASTER_B64; } throw new Error(`unexpected ${cmd}`); }) } };
}
afterEach(()=>{ delete window.__TAURI__; });

const REC = { id: 'provider-q059', name: 'GW', providerType: 'openai', apiKey: 'sk-live-q059',
	providerOptions: { extraHeaders: { Authorization: 'Bearer gw-token-q059', 'x-api-key': 'xk-q059', Accept: 'application/json' }, requestTimeoutMs: 1000 } };

describe('[Q-059/M-79] 额外请求头静态加密', ()=>{
	test('桥可用:落库密文(非空字符串值逐个加密)/ 读出解回明文;备份剥密置空并打 extraHeadersRedacted;检索不含令牌', async ()=>{
		mockBridge();
		let store; let secure;
		jest.isolateModules(()=>{ secure = require('../secureKeyStore'); store = require('../aiAnalysisStore'); });
		const saved = await store.putStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, REC, 'provider');
		expect(saved.providerOptions.extraHeaders.Authorization).toBe('Bearer gw-token-q059');   // 内存态=明文
		const raw = await store.__rawStoreRecordForTests(store.AI_ANALYSIS_STORES.providerProfiles, REC.id);
		expect(secure.isEncryptedSecret(raw.providerOptions.extraHeaders.Authorization)).toBe(true);
		expect(secure.isEncryptedSecret(raw.providerOptions.extraHeaders['x-api-key'])).toBe(true);
		expect(secure.isEncryptedSecret(raw.providerOptions.extraHeaders.Accept)).toBe(true);   // 头表整体视作令牌位
		expect(raw.providerOptions.requestTimeoutMs).toBe(1000);
		expect(JSON.stringify(raw)).not.toContain('gw-token-q059');
		const loaded = await store.getStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, REC.id);
		expect(loaded.providerOptions.extraHeaders).toEqual(REC.providerOptions.extraHeaders);
		expect(loaded.extraHeadersDecryptFailed).toBeUndefined();
		// 剥密
		const r = redactSecretRecord(loaded);
		expect(r.providerOptions.extraHeaders).toEqual({ Authorization: '', 'x-api-key': '', Accept: '' });
		expect(r.extraHeadersRedacted).toBe(true);
		expect(r.apiKeyRedacted).toBe(true);
		expect(JSON.stringify(r)).not.toMatch(/gw-token-q059|xk-q059|sk-live-q059/);
	});
	test('恢复:包内剥空的头值按头名回填本机值', ()=>{
		const incoming = [{ id: 'p', providerOptions: { extraHeaders: { Authorization: '', 'x-new': 'n' } }, extraHeadersRedacted: true, apiKey: '', apiKeyRedacted: true }];
		const local = [{ id: 'p', apiKey: 'sk-mine', providerOptions: { extraHeaders: { Authorization: 'Bearer mine' } } }];
		const out = mergeLocalSecrets('provider_profiles', incoming, local);
		expect(out[0].providerOptions.extraHeaders).toEqual({ Authorization: 'Bearer mine', 'x-new': 'n' });
		expect(out[0].extraHeadersRedacted).toBeUndefined();
		expect(out[0].apiKey).toBe('sk-mine');
	});
	test('dev 无桥:全链明文零变', async ()=>{
		let store;
		jest.isolateModules(()=>{ store = require('../aiAnalysisStore'); });
		await store.putStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, { ...REC, id: 'provider-q059-dev' }, 'provider');
		const raw = await store.__rawStoreRecordForTests(store.AI_ANALYSIS_STORES.providerProfiles, 'provider-q059-dev');
		expect(raw.providerOptions.extraHeaders).toEqual(REC.providerOptions.extraHeaders);
	});
});

describe('[Q-059/M-82] 解密失败态写库保留原密文', ()=>{
	test('换主密钥后读出置空+标记;未重填直接写回 → 库内密文原样;重填新值 → 覆盖', async ()=>{
		mockBridge();
		let store; let secure;
		jest.isolateModules(()=>{ secure = require('../secureKeyStore'); store = require('../aiAnalysisStore'); });
		const id = 'provider-q059-m82';
		await store.putStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, { ...REC, id }, 'provider');
		const before = await store.__rawStoreRecordForTests(store.AI_ANALYSIS_STORES.providerProfiles, id);
		// 换机器:主密钥不同 → 解密失败
		window.__TAURI__.core.invoke = jest.fn(async ()=>Buffer.alloc(32, 9).toString('base64'));
		secure.__resetSecureKeyStoreForTest();
		const broken = await store.getStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, id);
		expect(broken.apiKey).toBe('');
		expect(broken.apiKeyDecryptFailed).toBe(true);
		expect(broken.apiKeyCipherKept).toBe(before.apiKey);
		expect(broken.providerOptions.extraHeaders.Authorization).toBe('');
		expect(broken.extraHeadersDecryptFailed).toBe(true);
		// 连通性诊断式的写(不改 Key)→ 原密文原样保留,内存态标记不落库
		await store.putStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, { ...broken, lastDiagnostics: { ok: false } }, 'provider');
		const after = await store.__rawStoreRecordForTests(store.AI_ANALYSIS_STORES.providerProfiles, id);
		expect(after.apiKey).toBe(before.apiKey);
		expect(after.providerOptions.extraHeaders.Authorization).toBe(before.providerOptions.extraHeaders.Authorization);
		expect(after.providerOptions.extraHeaders['x-api-key']).toBe(before.providerOptions.extraHeaders['x-api-key']);
		expect(after.lastDiagnostics).toEqual({ ok: false });
		expect(after.apiKeyDecryptFailed).toBeUndefined();
		expect(after.apiKeyCipherKept).toBeUndefined();
		expect(after.extraHeadersCipherKept).toBeUndefined();
		// 重填新 Key / 新头值 → 以新主密钥加密覆盖
		await store.putStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, { ...broken, apiKey: 'sk-new', providerOptions: { ...broken.providerOptions, extraHeaders: { ...broken.providerOptions.extraHeaders, Authorization: 'Bearer new' } } }, 'provider');
		const renewed = await store.getStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, id);
		expect(renewed.apiKey).toBe('sk-new');
		expect(renewed.apiKeyDecryptFailed).toBeUndefined();
		expect(renewed.providerOptions.extraHeaders.Authorization).toBe('Bearer new');
		// x-api-key 未重填:仍是旧主密钥密文 → 仍解不开(标记仍在),但没有被空串覆盖
		const raw2 = await store.__rawStoreRecordForTests(store.AI_ANALYSIS_STORES.providerProfiles, id);
		expect(raw2.providerOptions.extraHeaders['x-api-key']).toBe(before.providerOptions.extraHeaders['x-api-key']);
		expect(renewed.extraHeadersDecryptFailed).toBe(true);
	});
});
