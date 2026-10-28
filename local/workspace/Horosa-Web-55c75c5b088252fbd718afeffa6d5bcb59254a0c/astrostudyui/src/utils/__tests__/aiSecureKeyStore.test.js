// provider API key 静态加密金标:封装格式 / dev 无桥直通 / 桥+WebCrypto 全链
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

describe('secureKeyStore', ()=>{
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

	describe('无头主密钥钩子(只在没有桌面桥时生效)', ()=>{
		afterEach(()=>{ delete globalThis.__HOROSA_HEADLESS_MASTER_KEY__; });
		test('无桥 + 钩子:封装格式 + roundtrip;主密钥换了 → 解不开', async ()=>{
			globalThis.__HOROSA_HEADLESS_MASTER_KEY__ = jest.fn(async ()=>MASTER_B64);
			const a = freshModule();
			const cipher = await a.encryptSecretText('sk-无头-123');
			expect(cipher.startsWith('aesgcm.v1:')).toBe(true);
			expect(cipher).not.toContain('sk-无头');
			expect(await a.decryptSecretText(cipher)).toBe('sk-无头-123');
			expect(await a.canEncryptSecrets()).toBe(true);
			globalThis.__HOROSA_HEADLESS_MASTER_KEY__ = jest.fn(async ()=>Buffer.alloc(32, 3).toString('base64'));
			const b = freshModule();
			expect(await b.decryptSecretText(cipher)).toBe(null);
		});
		test('桥在 → 钩子不被调用(桌面永远走钥匙串桥)', async ()=>{
			mockBridge();
			const hook = jest.fn(async ()=>Buffer.alloc(32, 5).toString('base64'));
			globalThis.__HOROSA_HEADLESS_MASTER_KEY__ = hook;
			const { encryptSecretText } = freshModule();
			expect((await encryptSecretText('sk-x')).startsWith('aesgcm.v1:')).toBe(true);
			expect(hook).not.toHaveBeenCalled();
		});
		test('🔴 钩子报错 / 给的不是 32 字节 → fail-closed:加密抛错(绝不返回明文让它落盘),预检同样抛', async ()=>{
			globalThis.__HOROSA_HEADLESS_MASTER_KEY__ = async ()=>{ throw new Error('读不到'); };
			const a = freshModule();
			await expect(a.encryptSecretText('sk-y')).rejects.toThrow('绝不明文落盘');
			await expect(a.requireSecretEncryption()).rejects.toThrow('读不到');
			globalThis.__HOROSA_HEADLESS_MASTER_KEY__ = async ()=>Buffer.alloc(16, 1).toString('base64');
			await expect(freshModule().encryptSecretText('sk-z')).rejects.toThrow('绝不明文落盘');
		});
		test('🔴 预检与真加密同一份缓存;无头取主密钥失败不缓存 —— 预检通过之后加密不会退回明文,失败之后恢复了即可用', async ()=>{
			let fail = true;
			globalThis.__HOROSA_HEADLESS_MASTER_KEY__ = jest.fn(async ()=>{ if(fail){ throw new Error('暂时读不到'); } return MASTER_B64; });
			const m = freshModule();
			await expect(m.encryptSecretText('sk-q')).rejects.toThrow();
			fail = false;
			await expect(m.requireSecretEncryption()).resolves.toBe(true);
			const c = await m.encryptSecretText('sk-q');
			expect(c.startsWith('aesgcm.v1:')).toBe(true);
			expect(globalThis.__HOROSA_HEADLESS_MASTER_KEY__).toHaveBeenCalledTimes(2);   // 成功后缓存,不再重取
		});
		test('dev 无桥无钩子 / 桌面桥:旧行为不变(dev 明文直通)', async ()=>{
			expect(await freshModule().encryptSecretText('sk-dev')).toBe('sk-dev');
		});
	});
});

describe('存储层收口(providerProfiles)', ()=>{
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
