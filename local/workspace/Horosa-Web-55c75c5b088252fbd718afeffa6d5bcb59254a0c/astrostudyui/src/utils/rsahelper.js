import RSA from 'js-rsa';
import * as forge from 'node-forge';
import { rsaSessionKeyEnabled, cryptoV2Enabled } from './perfFlags';

let modulus="902563E4F9348E8366C0939BAB48D4403AA7CCD933EECF899265228512C4B72F2E30084B7CADF97132D0882A51FB814E5ADD82D676CFCFBC22ECDDCFACE8D4444BC60B5B30A53EB933321BA2FB9AA69727C03A5E6A90BDAB5895A8E179FF24CF9B0F66A4061E028EAB86FCE733254B5ED2D0CE47AF7A4CD1BB987702237F2A89FE8D86938ACD9D125CC6A1094AA291418D088D355A139E00C406045D38BD215F23F3D222352FD74AC914798FE3160B10A93C7F15319D5B44840850DF6A504E0299CD994F0A3133C7D58054AB19C43B6FEAA71AC0F61904665F345C2D99A25BD56D1CBFFFD08BE699D6FA53E1AD2ED812B8710DBA86D4CC43FF6389DEDD2888B9";
let publicexp='10001';

let keypair = null;

function getKeypair(){
	if(!keypair){
		keypair = new RSA.RSAKeyPair(publicexp, publicexp, modulus, 2048);
	}
	return keypair;
}


function randomKeyStr(len){
	const txt = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
		'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 
		'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_'];
	let length = len ? len : 8;
	const res= [];
	for(let i=0; i<length; i++){
		let idx = Math.floor(Math.random()*1000) % txt.length;
		res.push(txt[idx]);
	}
	return res.join('');
}

function hex2Bytes(str){
    var pos = 0;
    var len = str.length;
    if(len %2 != 0){
       return null; 
    }

    len /= 2;
    var hexA = new Array();
    for(var i=0; i<len; i++){
       var s = str.substr(pos, 2);
       var v = parseInt(s, 16);
       hexA.push(v);
       pos += 2;
    }

    return hexA;
}

const KeyLen = 16;

// [A2] 会话级密钥束:AES 传输钥 + 它的 RSA-2048 密文,每【页面会话】只算一次 modexp。
// 背景:RSA.encryptedString 是纯 JS 2048 位模幂、跑在主线程,旧式每请求现算一次——
// 它是 B/C 型「改选项→往返」路径里恒定的固定税。复用后 Java 零改动(后端本就逐请求
// 解 RSA 块,同一密文解出同一钥)。仅存内存、绝不落盘;kill-switch horosa.perf.rsaSessionKey
// (关=恢复逐请求随机钥,字节行为回旧)。本机回环场景密钥复用的密码学代价可忽略
// (AES-ECB 本就无 IV,同钥同文恒同码,与旧式单请求内多段共钥同性质)。
let sessionKeyBundle = null;

function getSessionKeyBundle(){
	if(!rsaSessionKeyEnabled()){
		return null;
	}
	if(!sessionKeyBundle){
		const txtkey = randomKeyStr(KeyLen);
		const rsakeyraw = RSA.encryptedString(getKeypair(), txtkey, RSA.RSAAPP.PKCS1Padding, RSA.RSAAPP.RawEncoding);
		sessionKeyBundle = { txtkey, rsakey: forge.util.encode64(rsakeyraw) };
	}
	return sessionKeyBundle;
}

/** 测试用:清会话密钥束(生产勿调)。 */
export function __resetRsaSessionKeyForTest(){
	sessionKeyBundle = null;
	gcmKeyPromise = null;
	gcmKeyForTxt = null;
	gcmSelfTest = null;
	gcmBroken = false;
}

export function encryptRSA(txt, tm){
	const bundle = getSessionKeyBundle();
	let txtkey = bundle ? bundle.txtkey : randomKeyStr(KeyLen);
	let cipher = forge.cipher.createCipher("AES-ECB", txtkey);
	cipher.start();
	cipher.update(forge.util.createBuffer(txt, "utf8"));
	cipher.finish();
	let bytes = cipher.output.bytes();
	let encoded = forge.util.encode64(bytes);

	let rsakey = bundle ? bundle.rsakey : null;
	if(!rsakey){
		let rsakeyraw = RSA.encryptedString(getKeypair(), txtkey, RSA.RSAAPP.PKCS1Padding, RSA.RSAAPP.RawEncoding);
		rsakey = forge.util.encode64(rsakeyraw);
	}

	let res = encoded + ',' + rsakey;
	
	if(tm){
		let tmcipher = forge.cipher.createCipher("AES-ECB", txtkey);
		tmcipher.start();
		tmcipher.update(forge.util.createBuffer(tm+'', "utf8"));
		tmcipher.finish();
		let tmbytes = tmcipher.output.bytes();
		let tmencoded = forge.util.encode64(tmbytes);
		res = `${res},${tmencoded}`
	}

	return res;
}

export function decryptRSA(txt){
	let parts = txt.split(',');
	let keyWordAry = forge.util.decode64(parts[1]);
	let keycoded = forge.util.createBuffer(keyWordAry).toHex();
	let txtkeyStr = RSA.decryptedString(getKeypair(), keycoded);
	let txtkey = extractKey(txtkeyStr);

	let coded = forge.util.decode64(parts[0])
	let decipher = forge.cipher.createDecipher("AES-ECB", txtkey);
	decipher.start();
	decipher.update(forge.util.createBuffer(coded));
	decipher.finish();
	let plainraw = decipher.output.bytes();
	let plain = forge.util.decodeUtf8(plainraw);
	return plain;
}

function extractKey(data){
	let key = '';
	for(let i=KeyLen - 1; i>=0; i--){
		key += data[i];
	}
	return key;
}

// ── [R5 T0] 响应 v2:会话钥 AES-128-GCM + WebCrypto ─────────────────────────────────────────
// 线协议:服务端见请求头 X-Horosa-Crypto: gcm1 且本请求带会话钥 → 响应体 = base64(iv(12) || 密文 || 标签(16)),
// 响应头 Encrypted: 2;否则照旧 Encrypted: 1(RSA 信封,decryptRSA)。密钥 = 请求里那把 16 字节 AES 传输钥
// (ASCII),同会话恒同;CryptoKey 只导入一次。任何一环不在场(无会话钥 / 无 crypto.subtle / 开关关)都不声明能力。
export const RESPONSE_CRYPTO_HEADER = 'X-Horosa-Crypto';
export const RESPONSE_CRYPTO_GCM1 = 'gcm1';
let gcmKeyPromise = null;
let gcmKeyForTxt = null;
// 失效安全(不允许任何功能降级):① 声明能力前先用已知向量自测一次 WebCrypto AES-GCM(importKey + decrypt);
// 自测未过 / 未完成时一律不声明(走旧路径);② 真响应解密失败即锁死 v2(gcmBroken),后续请求回旧路径。
let gcmSelfTest = null;      // null=未起 / 'pending' / 'ok' / 'fail'
let gcmBroken = false;
// 已知向量:key=16×'a',iv=12×0,明文 "ok" 的 AES-128-GCM(iv||ct||tag,base64)
const GCM_SELFTEST_VECTOR = 'AAAAAAAAAAAAAAAAJcgIcCQGfhvtBcz5o5nx2iw2';

function webSubtle(){
	try{
		if(typeof crypto !== 'undefined' && crypto && crypto.subtle && typeof crypto.subtle.decrypt === 'function'){
			return crypto.subtle;
		}
	}catch(e){ /* 无 WebCrypto */ }
	return null;
}

function runGcmSelfTest(){
	const subtle = webSubtle();
	if(!subtle){ gcmSelfTest = 'fail'; return; }
	gcmSelfTest = 'pending';
	try{
		const all = base64ToBytes(GCM_SELFTEST_VECTOR);
		subtle.importKey('raw', asciiKeyBytes('aaaaaaaaaaaaaaaa'), { name: 'AES-GCM' }, false, ['decrypt'])
			.then((key)=>subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12), tagLength: 128 }, key, all.slice(12)))
			.then((plain)=>{ gcmSelfTest = bytesToUtf8(new Uint8Array(plain)) === 'ok' ? 'ok' : 'fail'; })
			.catch(()=>{ gcmSelfTest = 'fail'; });
	}catch(e){
		gcmSelfTest = 'fail';
	}
}

/** 本请求可声明的响应加密能力;null = 不声明(走旧路径)。自测未过 / 曾解密失败 / 开关关 / 无会话钥 → 不声明。 */
export function responseCryptoCapability(){
	if(gcmBroken || !cryptoV2Enabled() || !webSubtle()){
		return null;
	}
	if(gcmSelfTest === null){ runGcmSelfTest(); }
	if(gcmSelfTest !== 'ok'){
		return null;
	}
	const bundle = getSessionKeyBundle();
	return bundle ? RESPONSE_CRYPTO_GCM1 : null;
}

/** 测试用:等自测结束;生产勿调。 */
export async function __awaitGcmSelfTestForTest(){
	if(gcmSelfTest === null){ runGcmSelfTest(); }
	for(let i = 0; i < 200 && gcmSelfTest === 'pending'; i += 1){
		// eslint-disable-next-line no-await-in-loop
		await new Promise((r)=>setTimeout(r, 5));
	}
	return gcmSelfTest;
}
export function __gcmStateForTest(){ return { selfTest: gcmSelfTest, broken: gcmBroken }; }

function base64ToBytes(b64){
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for(let i = 0; i < bin.length; i += 1){
		out[i] = bin.charCodeAt(i);
	}
	return out;
}

function asciiKeyBytes(txt){
	const out = new Uint8Array(txt.length);
	for(let i = 0; i < txt.length; i += 1){
		out[i] = txt.charCodeAt(i) & 0xff;
	}
	return out;
}

function bytesToUtf8(bytes){
	if(typeof TextDecoder !== 'undefined'){
		return new TextDecoder('utf-8').decode(bytes);
	}
	let bin = '';
	for(let i = 0; i < bytes.length; i += 1){
		bin += String.fromCharCode(bytes[i]);
	}
	return forge.util.decodeUtf8(bin);
}

function gcmKey(txtkey){
	if(!gcmKeyPromise || gcmKeyForTxt !== txtkey){
		gcmKeyForTxt = txtkey;
		gcmKeyPromise = webSubtle().importKey('raw', asciiKeyBytes(txtkey), { name: 'AES-GCM' }, false, ['decrypt']);
	}
	return gcmKeyPromise;
}

// v2 解密失败统一成一类错误(code = 'crypto.v2'):请求层据此报「解密失败、已切兼容模式」,
// 不再当成「端口被占用」去再协商服务地址(那是另一类故障)。
function cryptoV2Failure(reason, cause){
	gcmBroken = true;   // 这一响应已无法解;此后所有请求不再声明能力(回旧路径),绝不反复失败
	const err = new Error(`crypto.v2.${reason}`);
	err.code = 'crypto.v2';
	if(cause !== undefined){ err.cause = cause; }
	return err;
}

/** Encrypted: 2 的响应体解密(异步,WebCrypto 在主线程之外做 AES)。 */
export async function decryptGcmResponse(b64){
	const subtle = webSubtle();
	const bundle = getSessionKeyBundle();
	if(!subtle || !bundle){
		throw cryptoV2Failure('unavailable');
	}
	const all = base64ToBytes(b64);
	if(all.length <= 12){
		throw cryptoV2Failure('envelope');
	}
	const iv = all.slice(0, 12);
	const ct = all.slice(12);
	try{
		const key = await gcmKey(bundle.txtkey);
		const plain = await subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ct);
		return bytesToUtf8(new Uint8Array(plain));
	}catch(e){
		throw cryptoV2Failure('decrypt', e);
	}
}

/** 测试用:当前会话传输钥(生产勿调)。 */
export function __sessionTxtKeyForTest(){
	const bundle = getSessionKeyBundle();
	return bundle ? bundle.txtkey : null;
}
