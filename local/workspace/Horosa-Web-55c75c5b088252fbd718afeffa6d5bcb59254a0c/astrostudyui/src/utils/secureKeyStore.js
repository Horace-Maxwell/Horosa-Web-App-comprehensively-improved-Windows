// AI 接口 API key 静态加密(AES-256-GCM):主密钥由桌面壳保管(macOS 钥匙串),前端
// 每次会话经桥取回、仅驻内存。密文封装格式 `aesgcm.v1:<iv b64>:<密文 b64>`。
// 兼容纪律:
//  · 浏览器 dev / 桥不可用 → encrypt 原样返回明文、decrypt 遇密文返回 null(调用方置空并提示重填);
//  · 旧明文记录永远原样可用(decrypt 非密文直通),升级由存储层写入时透明完成;
//  · 主密钥/明文 key 绝不落日志。
import { isDesktopBridgeAvailable, invokeDesktopCommand } from './aiAnalysisDesktop';

const ENC_PREFIX = 'aesgcm.v1:';

let masterKeyPromise = null;

function getSubtle(){
	try{
		if(typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.getRandomValues === 'function'){
			return crypto.subtle;
		}
	}catch(_){ /* fallthrough */ }
	return null;
}

function b64ToBytes(b64){
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for(let i = 0; i < bin.length; i++){ out[i] = bin.charCodeAt(i); }
	return out;
}

function bytesToB64(bytes){
	let bin = '';
	const u8 = new Uint8Array(bytes);
	for(let i = 0; i < u8.length; i++){ bin += String.fromCharCode(u8[i]); }
	return btoa(bin);
}

// UTF-8 编解码走 escape/unescape 组合(零依赖,WKWebView 与 jsdom 皆有;避免 jsdom 缺 TextEncoder)。
function utf8ToBytes(str){
	const bin = unescape(encodeURIComponent(str));
	const out = new Uint8Array(bin.length);
	for(let i = 0; i < bin.length; i++){ out[i] = bin.charCodeAt(i); }
	return out;
}

function bytesToUtf8(bytes){
	let bin = '';
	const u8 = new Uint8Array(bytes);
	for(let i = 0; i < u8.length; i++){ bin += String.fromCharCode(u8[i]); }
	return decodeURIComponent(escape(bin));
}

export function isEncryptedSecret(value){
	return typeof value === 'string' && value.indexOf(ENC_PREFIX) === 0;
}

// 主密钥 CryptoKey(缓存单飞;失败缓存 null 且本会话不再重试——桥不可用不是瞬态)。
async function getMasterCryptoKey(){
	if(masterKeyPromise){ return masterKeyPromise; }
	masterKeyPromise = (async ()=>{
		const subtle = getSubtle();
		if(!subtle || !isDesktopBridgeAvailable()){ return null; }
		try{
			const b64 = await invokeDesktopCommand('ai_master_key_command');
			const raw = b64ToBytes(`${b64 || ''}`.trim());
			if(raw.length !== 32){ return null; }
			return await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
		}catch(_){
			return null;
		}
	})();
	return masterKeyPromise;
}

// 加密:桥可用 → 密文封装;不可用 → 原样明文(dev 兼容,格式即开关)。
export async function encryptSecretText(plain){
	const text = `${plain || ''}`;
	if(!text || isEncryptedSecret(text)){ return text; }
	const key = await getMasterCryptoKey();
	if(!key){ return text; }
	try{
		const subtle = getSubtle();
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8ToBytes(text));
		return `${ENC_PREFIX}${bytesToB64(iv)}:${bytesToB64(ct)}`;
	}catch(_){
		return text;   // 加密失败不阻断保存(维持旧行为),下次写入再试
	}
}

// 解密:非密文直通;密文而无主密钥/解密失败 → null(调用方置空 + 标记提示重填)。
export async function decryptSecretText(stored){
	const text = `${stored || ''}`;
	if(!isEncryptedSecret(text)){ return text; }
	const key = await getMasterCryptoKey();
	if(!key){ return null; }
	try{
		const parts = text.slice(ENC_PREFIX.length).split(':');
		if(parts.length !== 2){ return null; }
		const iv = b64ToBytes(parts[0]);
		const ct = b64ToBytes(parts[1]);
		const subtle = getSubtle();
		const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
		return bytesToUtf8(plain);
	}catch(_){
		return null;
	}
}

// 是否具备加密条件(桥+WebCrypto)——存储层用它决定要不要做明文→密文透明升级。
export async function canEncryptSecrets(){
	return !!(await getMasterCryptoKey());
}

// 仅供 jest:重置主密钥缓存。
export function __resetSecureKeyStoreForTest(){
	masterKeyPromise = null;
}
