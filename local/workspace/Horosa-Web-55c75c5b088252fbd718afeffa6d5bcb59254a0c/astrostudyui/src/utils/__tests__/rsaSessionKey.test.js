// [A2] RSA 会话密钥复用金标。js-rsa 在 jsdom 下无法真跑(库内依赖浏览器 sloppy 全局),
// 故 mock 之——契约以【modexp 调用次数】钉死:开=每会话 1 次,关=每请求 1 次;
// 复用束的 RSA 段逐字节同、载荷仍随明文变、三段形状不变。
const mockRsaState = { encCalls: 0 };

jest.mock('js-rsa', ()=>({
	__esModule: true,
	default: {
		RSAKeyPair: function RSAKeyPair(){ this.fake = true; },
		encryptedString: ()=>{
			mockRsaState.encCalls += 1;
			return `RSAENC-${mockRsaState.encCalls}-${Math.random()}`;
		},
		RSAAPP: { PKCS1Padding: 1, RawEncoding: 2 },
	},
}));

import { encryptRSA, __resetRsaSessionKeyForTest } from '../rsahelper';

const rsaPart = (blob)=>blob.split(',')[1];
const payloadPart = (blob)=>blob.split(',')[0];

describe('[A2] RSA 会话密钥复用', ()=>{
	beforeEach(()=>{
		__resetRsaSessionKeyForTest();
		mockRsaState.encCalls = 0;
		window.localStorage.removeItem('horosa.perf.rsaSessionKey');
	});
	afterEach(()=>{
		window.localStorage.removeItem('horosa.perf.rsaSessionKey');
		__resetRsaSessionKeyForTest();
	});

	test('默认开:N 次加密只 1 次模幂,RSA 密文段逐字节同,载荷随明文独立', ()=>{
		const a = encryptRSA(JSON.stringify({ q: 'chart', d: '1990-05-18' }));
		const b = encryptRSA(JSON.stringify({ q: 'chart', d: '2001-01-01' }));
		const c = encryptRSA(JSON.stringify({ q: 'chart', d: '1990-05-18' }));
		expect(mockRsaState.encCalls).toBe(1);
		expect(rsaPart(a)).toBe(rsaPart(b));
		expect(payloadPart(a)).not.toBe(payloadPart(b));
		// 同明文在同会话钥下恒同码(AES-ECB 无 IV 的既有性质,非本改动引入)
		expect(payloadPart(c)).toBe(payloadPart(a));
	});

	test('tm 段与主载荷同钥同链(三段形状不变,仍只 1 次模幂)', ()=>{
		const blob = encryptRSA('{"x":1}', 1721390000000);
		expect(blob.split(',').length).toBe(3);
		expect(mockRsaState.encCalls).toBe(1);
	});

	test('kill-switch 关:每请求 1 次模幂、RSA 段互异(逐字节回旧行为)', ()=>{
		window.localStorage.setItem('horosa.perf.rsaSessionKey', '0');
		const a = encryptRSA('{"x":1}');
		const b = encryptRSA('{"x":1}');
		expect(mockRsaState.encCalls).toBe(2);
		expect(rsaPart(a)).not.toBe(rsaPart(b));
	});

	test('会话束跨 关→开 切换不复用陈钥(重开后新束)', ()=>{
		encryptRSA('{"a":1}');
		expect(mockRsaState.encCalls).toBe(1);
		window.localStorage.setItem('horosa.perf.rsaSessionKey', '0');
		encryptRSA('{"a":2}');
		expect(mockRsaState.encCalls).toBe(2);
		window.localStorage.removeItem('horosa.perf.rsaSessionKey');
		// 束仍在(模块态未清)→ 复用,不再新增
		encryptRSA('{"a":3}');
		expect(mockRsaState.encCalls).toBe(2);
	});
});
