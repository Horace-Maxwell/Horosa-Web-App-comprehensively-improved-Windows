// [R5 T0] 响应加解密 v2 金标:① 能力头只在「开关开 + 会话钥复用 + WebCrypto 在场」时声明;② Encrypted:2 的
// 信封(iv||密文||标签,base64)用会话钥经 WebCrypto 解出原文(UTF-8 中文);③ Encrypted:1 仍走旧 RSA 路径;
// ④ 篡改标签必失败(GCM 完整性)。js-rsa 在 jsdom 跑不了 → mock(与 rsaSessionKey.test 同法)。
const mockRsaState = { encCalls: 0 };
jest.mock('js-rsa', ()=>({
	__esModule: true,
	default: {
		RSAKeyPair: function RSAKeyPair(){ this.fake = true; },
		encryptedString: ()=>{ mockRsaState.encCalls += 1; return `RSAENC-${mockRsaState.encCalls}`; },
		decryptedString: ()=>'0000000000000000',
		RSAAPP: { PKCS1Padding: 1, RawEncoding: 2 },
	},
}));
import nodeCrypto from 'crypto';
import { buildSignedFetchOptions, decryptResponse } from '../request';
import { decryptGcmResponse, responseCryptoCapability, __resetRsaSessionKeyForTest, __sessionTxtKeyForTest, __awaitGcmSelfTestForTest, __gcmStateForTest, RESPONSE_CRYPTO_HEADER } from '../rsahelper';

function ensureWebCrypto(){
	if(typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle){
		Object.defineProperty(globalThis, 'crypto', { value: nodeCrypto.webcrypto, configurable: true });
	}
	if(typeof window !== 'undefined' && (!window.crypto || !window.crypto.subtle)){
		Object.defineProperty(window, 'crypto', { value: nodeCrypto.webcrypto, configurable: true });
	}
}
function gcmEnvelope(txtkey, plain){
	const iv = nodeCrypto.randomBytes(12);
	const c = nodeCrypto.createCipheriv('aes-128-gcm', Buffer.from(txtkey, 'latin1'), iv);
	const ct = Buffer.concat([c.update(Buffer.from(plain, 'utf8')), c.final()]);
	return Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64');
}
const fakeResponse = (enc)=>({ headers: { get: (k)=> (k === 'Encrypted' ? enc : null) } });

beforeEach(()=>{
	ensureWebCrypto();
	__resetRsaSessionKeyForTest();
	window.localStorage.removeItem('horosa.perf.cryptoV2');
	window.localStorage.removeItem('horosa.perf.rsaSessionKey');
});

test('① 能力头:自测通过后才声明 gcm1;自测前 / 关 cryptoV2 / 关 rsaSessionKey 都不声明', async ()=>{
	expect(responseCryptoCapability()).toBeNull();          // 自测未完成:不声明(走旧路径)
	expect(await __awaitGcmSelfTestForTest()).toBe('ok');
	expect(responseCryptoCapability()).toBe('gcm1');
	const opts = buildSignedFetchOptions({ body: '{"a":1}' });
	expect(opts.headers[RESPONSE_CRYPTO_HEADER]).toBe('gcm1');
	window.localStorage.setItem('horosa.perf.cryptoV2', '0');
	expect(responseCryptoCapability()).toBeNull();
	expect(buildSignedFetchOptions({ body: '{"a":1}' }).headers[RESPONSE_CRYPTO_HEADER]).toBeUndefined();
	window.localStorage.removeItem('horosa.perf.cryptoV2');
	window.localStorage.setItem('horosa.perf.rsaSessionKey', '0');
	__resetRsaSessionKeyForTest();
	expect(responseCryptoCapability()).toBeNull();
});

test('② Encrypted:2 信封用会话钥经 WebCrypto 解出原文(含中文)', async ()=>{
	await __awaitGcmSelfTestForTest();
	buildSignedFetchOptions({ body: '{"a":1}' });   // 建立会话钥束
	const txtkey = __sessionTxtKeyForTest();
	expect(txtkey).toHaveLength(16);
	const plain = '{"ResultCode":0,"Result":{"名":"星阙","x":1.5}}';
	const env = gcmEnvelope(txtkey, plain);
	expect(await decryptGcmResponse(env)).toBe(plain);
	expect(await decryptResponse(env, fakeResponse('2'))).toBe(plain);
});

test('③ Encrypted:1 / 明文 路径不变', async ()=>{
	expect(await decryptResponse('raw-text', fakeResponse(null))).toBe('raw-text');
	expect(await decryptResponse('', fakeResponse('2'))).toBe('');
});

test('④ 篡改标签 → 解密失败(GCM 完整性)→ 锁死 v2:此后不再声明能力(回旧路径),重置后恢复', async ()=>{
	await __awaitGcmSelfTestForTest();
	buildSignedFetchOptions({ body: '{"a":1}' });
	expect(responseCryptoCapability()).toBe('gcm1');
	const txtkey = __sessionTxtKeyForTest();
	const env = Buffer.from(gcmEnvelope(txtkey, '{"ok":1}'), 'base64');
	env[env.length - 1] ^= 0x01;
	await expect(decryptGcmResponse(env.toString('base64'))).rejects.toMatchObject({ code: 'crypto.v2', message: 'crypto.v2.decrypt' });
	expect(__gcmStateForTest().broken).toBe(true);
	expect(responseCryptoCapability()).toBeNull();
	expect(buildSignedFetchOptions({ body: '{"a":1}' }).headers[RESPONSE_CRYPTO_HEADER]).toBeUndefined();
	__resetRsaSessionKeyForTest();
	expect(__gcmStateForTest().broken).toBe(false);
});

test('④b 信封过短同属 v2 失败:统一 code 并锁死 v2(请求层据此不误报「端口被占用」)', async ()=>{
	await __awaitGcmSelfTestForTest();
	buildSignedFetchOptions({ body: '{"a":1}' });
	await expect(decryptResponse(Buffer.from('short').toString('base64'), fakeResponse('2'))).rejects.toMatchObject({ code: 'crypto.v2', message: 'crypto.v2.envelope' });
	expect(__gcmStateForTest().broken).toBe(true);
	expect(responseCryptoCapability()).toBeNull();
	__resetRsaSessionKeyForTest();
});

test('⑤ 无 WebCrypto(subtle 缺席)→ 自测 fail,永不声明', async ()=>{
	const saved = globalThis.crypto;
	Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
	if(typeof window !== 'undefined'){ Object.defineProperty(window, 'crypto', { value: {}, configurable: true }); }
	__resetRsaSessionKeyForTest();
	expect(await __awaitGcmSelfTestForTest()).toBe('fail');
	expect(responseCryptoCapability()).toBeNull();
	Object.defineProperty(globalThis, 'crypto', { value: saved, configurable: true });
	if(typeof window !== 'undefined'){ Object.defineProperty(window, 'crypto', { value: saved, configurable: true }); }
});
