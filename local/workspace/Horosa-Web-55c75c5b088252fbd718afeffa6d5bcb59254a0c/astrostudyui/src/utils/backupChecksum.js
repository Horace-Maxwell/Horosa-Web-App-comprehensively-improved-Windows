// [V5-B5] 备份校验和基元:纯 JS 同步 SHA-256(标准 FIPS 180-4 实现)。
// 用途=备份完整性/损坏检测(U盘/网盘搬运咬坏、云同步截断在恢复前就能指认具体坏段),
// 非密码学签名。选择纯 JS 同步实现的原因:Web Crypto subtle 是 async 且 jsdom/老 WebView
// 兼容参差;本实现零依赖、双端(mac/Win)/三环境(浏览器/jest/WebView)同一代码同一结果。
/* eslint-disable no-bitwise */
const K = [
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function utf8Bytes(str){
	if(typeof TextEncoder !== 'undefined'){
		return new TextEncoder().encode(str);
	}
	const out = [];
	for(let i = 0; i < str.length; i++){
		let c = str.codePointAt(i);
		if(c > 0xffff){
			i++;
		}
		if(c < 0x80){
			out.push(c);
		}else if(c < 0x800){
			out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
		}else if(c < 0x10000){
			out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
		}else{
			out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
		}
	}
	return Uint8Array.from(out);
}

function rotr(x, n){
	return (x >>> n) | (x << (32 - n));
}

export function sha256Hex(text){
	const data = utf8Bytes(`${text}`);
	const len = data.length;
	const bitLen = len * 8;
	const padded = new Uint8Array((((len + 8) >> 6) + 1) << 6);
	padded.set(data);
	padded[len] = 0x80;
	const dv = new DataView(padded.buffer);
	dv.setUint32(padded.length - 4, bitLen >>> 0, false);
	dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);
	const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
	const w = new Int32Array(64);
	for(let off = 0; off < padded.length; off += 64){
		for(let i = 0; i < 16; i++){
			w[i] = dv.getUint32(off + i * 4, false);
		}
		for(let i = 16; i < 64; i++){
			const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
			const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
			w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
		}
		let [a, b, c, d, e, f, g, h] = H;
		for(let i = 0; i < 64; i++){
			const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
			const ch = (e & f) ^ (~e & g);
			const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
			const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
			const maj = (a & b) ^ (a & c) ^ (b & c);
			const t2 = (S0 + maj) | 0;
			h = g; g = f; f = e; e = (d + t1) | 0;
			d = c; c = b; b = a; a = (t1 + t2) | 0;
		}
		H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
		H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
	}
	return H.map((x)=>(x >>> 0).toString(16).padStart(8, '0')).join('');
}

// manifest 分段校验和:整体 + 逐段(charts/cases/trash/raw 逐键/aiWorkspace)。
// 恢复前逐段复核 → 坏了指认具体段而非整包拒收。
export function buildManifestChecksums(manifest){
	const sections = {};
	if(manifest.charts !== undefined){
		sections.charts = sha256Hex(JSON.stringify(manifest.charts));
	}
	if(manifest.cases !== undefined){
		sections.cases = sha256Hex(JSON.stringify(manifest.cases));
	}
	if(manifest.trash !== undefined){
		sections.trash = sha256Hex(JSON.stringify(manifest.trash));
	}
	if(manifest.raw && typeof manifest.raw === 'object'){
		sections.raw = {};
		Object.keys(manifest.raw).sort().forEach((k)=>{
			sections.raw[k] = sha256Hex(`${manifest.raw[k]}`);
		});
	}
	if(manifest.aiWorkspace !== undefined && manifest.aiWorkspace !== null){
		sections.aiWorkspace = sha256Hex(JSON.stringify(manifest.aiWorkspace));
	}
	return sections;
}

// 校验:返回 {ok, badSections:[...]};manifest 无 checksums(v2 老包)=ok 宽容。
export function verifyManifestChecksums(manifest){
	if(!manifest || !manifest.checksums || typeof manifest.checksums !== 'object'){
		return { ok: true, badSections: [], legacy: true };
	}
	const expect = manifest.checksums;
	const actual = buildManifestChecksums(manifest);
	const bad = [];
	['charts', 'cases', 'trash', 'aiWorkspace'].forEach((s)=>{
		if(expect[s] !== undefined && expect[s] !== actual[s]){
			bad.push(s);
		}
	});
	if(expect.raw && typeof expect.raw === 'object'){
		Object.keys(expect.raw).forEach((k)=>{
			if(!actual.raw || actual.raw[k] !== expect.raw[k]){
				bad.push(`raw.${k}`);
			}
		});
	}
	return { ok: !bad.length, badSections: bad, legacy: false };
}
