// 后端请求头集合与签名不变量:
//   ① 签名请求头恰为六键(Token / Content-Type / ClientChannel / ClientApp / ClientVer / Signature),
//      不再携带任何本机地址探测结果(WebRTC 探测已整体移除);
//   ② Signature 算法不变:sha256(token + SignatureKey + ClientChannel + ClientApp + ClientVer + body) hex,
//      用 Node 内建 crypto 独立复算与 request.js(node-forge)对拍;
//   ③ 源码负锚:request.js / helper.js 剥去单行注释后零命中 LocalIp / getUserIP / RTCPeerConnection。
// 注:RSA 加密层(js-rsa)在 jest 沙箱内不可执行(库内隐式全局变量在严格模式下 ReferenceError),
// 而签名在加密前算、与密文无关 —— 此处只桩加密,签名与头集合走真实 request.js 代码路径。
jest.mock('../rsahelper', ()=>({
	encryptRSA: (s)=>`enc:${s}`,
	decryptRSA: (s)=>s,
}));

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { buildSignedFetchOptions, signRequest } from '../request';
import * as Constants from '../constants';

const TOKEN = 'tok-fixed-0001';
const BODY = '{"a":1}';

function sha256Hex(txt){
	return crypto.createHash('sha256').update(txt, 'utf8').digest('hex');
}

// 只剥「行首或空白后」的 // 单行注释;URL 里的 :// 前面是冒号,不受影响。
function stripLineComments(src){
	return src.replace(/(^|[ \t])\/\/.*$/gm, '$1');
}

describe('签名请求头集合(无本机地址头)', ()=>{
	beforeEach(()=>{
		window.localStorage.setItem(Constants.TokenKey, TOKEN);
	});
	afterEach(()=>{
		window.localStorage.removeItem(Constants.TokenKey);
	});

	it('① buildSignedFetchOptions 的 headers 键集(排序)恰为六键', ()=>{
		const opts = buildSignedFetchOptions({ body: BODY });
		expect(Object.keys(opts.headers).sort()).toEqual([
			'ClientApp', 'ClientChannel', 'ClientVer', 'Content-Type', 'Signature', 'Token',
		]);
		expect(opts.method).toBe('POST');
		expect(opts.headers.Token).toBe(TOKEN);
		expect(opts.headers['Content-Type']).toBe('application/json; charset=UTF-8');
	});

	it('② 签名不变:Signature 与 Node crypto 独立复算值逐字节相等(有 token / 无 token 两档)', ()=>{
		const hd = `${Constants.ClientChannel}${Constants.ClientApp}${Constants.ClientVer}`;
		const withToken = buildSignedFetchOptions({ body: BODY });
		expect(withToken.headers.Signature).toBe(sha256Hex(`${TOKEN}${Constants.SignatureKey}${hd}${BODY}`));
		expect(signRequest(BODY)).toBe(withToken.headers.Signature);
		// 签名在加密前算(密文 body 不参与):同 body 两次构造签名恒等,且 body 已进入加密层
		expect(buildSignedFetchOptions({ body: BODY }).headers.Signature).toBe(withToken.headers.Signature);
		expect(withToken.body).toBe(`enc:${BODY}`);
		window.localStorage.removeItem(Constants.TokenKey);
		const noToken = buildSignedFetchOptions({ body: BODY });
		expect(noToken.headers.Signature).toBe(sha256Hex(`${Constants.SignatureKey}${hd}${BODY}`));
		expect(noToken.headers.Token).toBe('');
	});

	it('③ 源码负锚:request.js / helper.js 剥单行注释后零命中 LocalIp / getUserIP / RTCPeerConnection', ()=>{
		const re = /\bLocalIp\b|getUserIP|RTCPeerConnection/;
		['request.js', 'helper.js'].forEach((name)=>{
			const src = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
			const m = stripLineComments(src).match(re);
			expect(m ? `${name} 命中: ${m[0]}` : 'clean').toBe('clean');
		});
	});
});
