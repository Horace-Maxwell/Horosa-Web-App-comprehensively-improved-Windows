// [G1] provider API key 静态加密金标:封装格式 / dev 无桥直通 / 桥+WebCrypto 全链
// 加解密 roundtrip / 篡改判 null / 存储层收口(落库密文·内存态明文·解密失败置空标记)。
import { webcrypto } from 'crypto';

// jsdom 无 crypto.subtle → 换 node webcrypto(带 getRandomValues + subtle)。
beforeAll(()=>{
	if(typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle){
		Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
	}
});

const MASTER_B64 = Buffer.alloc(32, 7).toString('base64');

function mockBridge(){
	window.__TAURI__ = {
		core: {
			invoke: jest.fn(async (cmd)=>{
				if(cmd === 'ai_master_key_command'){ return MASTER_B64; }
				throw new Error(`unexpected ${cmd}`);
			}),
		},
	};
}

function unmockBridge(){
	delete window.__TAURI__;
}

/* eslint-disable global-require */
function freshModule(){
	let mod;
	jest.isolateModules(()=>{ mod = require('../secureKeyStore'); });
	return mod;
}

afterEach(()=>{ unmockBridge(); });

describe('[G1] secureKeyStore', ()=>{
	test('isEncryptedSecret 只认封装前缀', ()=>{
		const { isEncryptedSecret } = freshModule();
		expect(isEncryptedSecret('aesgcm.v1:aa:bb')).toBe(true);
		expect(isEncryptedSecret('sk-plain-key')).toBe(false);
		expect(isEncryptedSecret('')).toBe(false);
		expect(isEncryptedSecret(null)).toBe(false);
	});

	test('dev 无桥:加密直通明文,密文解不开返 null', async ()=>{
		const { encryptSecretText, decryptSecretText } = freshModule();
		expect(await encryptSecretText('sk-abc')).toBe('sk-abc');
		expect(await decryptSecretText('sk-abc')).toBe('sk-abc');
		expect(await decryptSecretText('aesgcm.v1:AAAA:BBBB')).toBe(null);
	});

	test('桥可用:封装格式 + roundtrip + 篡改判 null + 已密文不重包', async ()=>{
		mockBridge();
		const { encryptSecretText, decryptSecretText } = freshModule();
		const cipher = await encryptSecretText('sk-真密钥-0123456789');
		expect(cipher.startsWith('aesgcm.v1:')).toBe(true);
		expect(cipher).not.toContain('sk-真密钥');
		expect(await decryptSecretText(cipher)).toBe('sk-真密钥-0123456789');
		// 已是密文 → 原样(不双重加密)
		expect(await encryptSecretText(cipher)).toBe(cipher);
		// 篡改密文尾部 → GCM 校验失败 → null
		const tampered = cipher.slice(0, -4) + (cipher.endsWith('AAAA') ? 'BBBB' : 'AAAA');
		expect(await decryptSecretText(tampered)).toBe(null);
	});
});

describe('[G1] 存储层收口(providerProfiles)', ()=>{
	test('桥可用:落库密文 / 返回与读出为明文;换机器解不开 → 置空+标记', async ()=>{
		mockBridge();
		let store;
		let secure;
		jest.isolateModules(()=>{
			secure = require('../secureKeyStore');
			store = require('../aiAnalysisStore');
		});
		const saved = await store.putStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, {
			id: 'provider-test-g1',
			name: 'T',
			providerType: 'anthropic',
			apiKey: 'sk-live-plain',
		}, 'provider');
		expect(saved.apiKey).toBe('sk-live-plain');   // 调用方内存态=明文
		// 读出:解密回明文
		const loaded = await store.getStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, 'provider-test-g1');
		expect(loaded.apiKey).toBe('sk-live-plain');
		expect(loaded.apiKeyDecryptFailed).toBeUndefined();
		// 主密钥变化(换机器)→ 解密失败 → 置空 + 标记
		window.__TAURI__.core.invoke = jest.fn(async ()=>Buffer.alloc(32, 9).toString('base64'));
		secure.__resetSecureKeyStoreForTest();
		const broken = await store.getStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, 'provider-test-g1');
		expect(broken.apiKey).toBe('');
		expect(broken.apiKeyDecryptFailed).toBe(true);
	});

	test('dev 无桥:全链明文零变(旧行为逐字节保持)', async ()=>{
		let store;
		jest.isolateModules(()=>{ store = require('../aiAnalysisStore'); });
		await store.putStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, {
			id: 'provider-test-dev',
			name: 'D',
			providerType: 'openai',
			apiKey: 'sk-dev-plain',
		}, 'provider');
		const loaded = await store.getStoreRecord(store.AI_ANALYSIS_STORES.providerProfiles, 'provider-test-dev');
		expect(loaded.apiKey).toBe('sk-dev-plain');
		const all = await store.listStoreRecords(store.AI_ANALYSIS_STORES.providerProfiles);
		const rec = all.find((r)=>r.id === 'provider-test-dev');
		expect(rec.apiKey).toBe('sk-dev-plain');
	});
});
