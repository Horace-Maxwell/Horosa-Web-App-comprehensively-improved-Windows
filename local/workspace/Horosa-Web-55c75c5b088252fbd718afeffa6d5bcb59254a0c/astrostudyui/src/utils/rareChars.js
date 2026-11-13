// 罕见字(CJK 扩展 B 及以后的码位)的文本回退。
// 古籍原文里的这些字,多数系统字体没有字形,界面上会画成带纹方块。数据保持原字(存档 / 文本导出逐字保真);
// 只在「画出来」的地方回退:本机画得出就照原字;画不出时,有通行写法的换成通行写法,没有的写成拆字说明(〔左口右臬〕)。
// PDF 导出的内嵌字体同样没有这些字,走同一张表(见 aiExportPdfVector.pdfSafeText)。
//
// 登记口径:parts = 拆字(左右 / 上下,部件按通行字写);same = 通行写法(字书注明同某字 / 某字异体时才填)。
// 新数据里出现未登记的扩展 B 及以后的字 → rareChars.test.js 红(前端数据)/ test_rare_char_registry.py 红(太玄字典)。
export const RARE_CHARS = {
	// —— 太玄经(首辞 / 赞辞)——
	'𠑩': { parts: '左亻右矍', same: '矍' },
	'𠯒': { parts: '上化下口' },
	'𠹑': { parts: '左口右臬' },
	'𡛖': { parts: '左女右厄' },
	'𡢘': { parts: '左女右黽' },
	'𢙅': { parts: '上合下心' },
	'𤕠': { parts: '左爻右守' },
	'𥅠': { parts: '左目右后' },
	'𥅡': { parts: '左目右而' },
	'𥘩': { parts: '左示右匀' },
	'𥧲': { parts: '上穴下㴆', same: '浸' },
	'𦉑': { parts: '左缶右虖', same: '罅' },
	'𦴑': { parts: '上艹下柑' },
	'𧋈': { parts: '左虫右豸', same: '豸' },
	'𧋒': { parts: '左虫右赤' },
	'𨲞': { parts: '左镸右剔' },
	'𨲠': { parts: '左镸右差' },
	'𪃿': { parts: '左哥右鳥' },
	'𪖣': { parts: '左鼻右至', same: '䶍' },
	// —— 灵棋经(四库本异体字)——
	'𠉀': { same: '候' },
	'𠖇': { same: '冥' },
	'𡛸': { same: '姻' },
	'𡨋': { same: '冥' },
	'𢓺': { same: '徒' },
	'𣺌': { same: '渺' },
	'𤓰': { same: '瓜' },
	'𤣥': { same: '玄' },
	'𥦗': { same: '窗' },
	'𦕈': { same: '眇' },
	'𩔗': { same: '類' },
	'𫎇': { same: '蒙' },
	'𭭕': { same: '歡' },
	// —— 类推简化字(通行写法即其繁体)——
	'𫄨': { parts: '左纟右希', same: '絺' },
	'𫓧': { parts: '左钅右夫', same: '鈇' },
};

// 扩展 B 及以后(辅助平面的表意文字)。
const RARE_RE = /[\u{20000}-\u{3FFFF}]/u;
const RARE_RE_G = /[\u{20000}-\u{3FFFF}]/gu;

export function hasRareChar(text){
	return RARE_RE.test(`${text == null ? '' : text}`);
}

// 该字画不出时用什么顶:通行写法 → 拆字说明 → 原字(未登记的字不乱猜)。
export function rareCharFallback(ch){
	const it = RARE_CHARS[ch];
	if(!it){ return ch; }
	if(it.same){ return it.same; }
	return it.parts ? `〔${it.parts}〕` : ch;
}

// 说明文字(悬浮提示 / 注脚用):「左口右臬」「同「矍」」。
export function rareCharGloss(ch){
	const it = RARE_CHARS[ch];
	if(!it){ return ''; }
	return [it.parts || '', it.same ? `同「${it.same}」` : ''].filter(Boolean).join(',');
}

// —— 本机画不画得出 ——
// 系统给画不出的字画一个兜底图(带纹方块):有的系统所有缺字同一个图,有的按区段各一个图,也可能干脆不画。
// 两个不同的字真有字形时,画出来不可能逐像素相同 —— 所以拿这个字与几个「别的码位」各画一遍比像素:
// 与其中任何一个相同(或没墨)= 画出来的是兜底图 = 画不出。对照码位:辅助平面里没有收字的位置、本区段的末位与首位。
const BLOCK_ENDS = [0x2A6DF, 0x2B73F, 0x2B81F, 0x2CEAF, 0x2EBEF, 0x2EE5F, 0x2FA1F, 0x3134F, 0x323AF, 0x3FFFF];
const BLOCK_STARTS = [0x20000, 0x2A700, 0x2B740, 0x2B820, 0x2CEB0, 0x2EBF0, 0x2F800, 0x30000, 0x31350, 0x323B0];
const UNASSIGNED_REFS = [0x3FFFD, 0x2FFFD, 0x2FA20];
function referenceCodePoints(cp){
	const k = BLOCK_ENDS.findIndex((e)=>cp <= e);
	const refs = UNASSIGNED_REFS.slice();
	if(k >= 0){ refs.push(BLOCK_ENDS[k], BLOCK_STARTS[k] + 1); }
	return refs.filter((r, idx)=>r !== cp && refs.indexOf(r) === idx);
}
let _probeOverride = null;
const _renderable = new Map();
let _ctx;

function inkSignature(ch){
	if(_ctx === undefined){
		_ctx = null;
		try{
			// 单测环境的画布是空壳(调用即报「未实现」):不碰,按量不了处理
			if(typeof navigator !== 'undefined' && /jsdom/i.test(`${navigator.userAgent || ''}`)){ return null; }
			const cv = document.createElement('canvas');
			cv.width = 40; cv.height = 40;
			const c = cv.getContext && cv.getContext('2d');
			if(c && c.getImageData){ c.font = '28px sans-serif'; c.textBaseline = 'alphabetic'; _ctx = c; }
		}catch(e){ _ctx = null; }
	}
	if(!_ctx){ return null; }
	_ctx.clearRect(0, 0, 40, 40);
	_ctx.fillText(ch, 4, 32);
	const d = _ctx.getImageData(0, 0, 40, 40).data;
	let ink = 0; let h = 0;
	for(let i = 3; i < d.length; i += 4){
		if(d[i]){ ink += 1; h = (h * 31 + d[i] + i) | 0; }
	}
	return { ink, h };
}

// 测试 / 无画布环境可注入判定;传 null 还原。
export function setRareGlyphProbe(fn){
	_probeOverride = typeof fn === 'function' ? fn : null;
	_renderable.clear();
}

// 画得出返回 true。量不了(没有画布:单测、无头环境)一律当画得出 —— 保持原字,不凭空改文本。
export function canRenderRareChar(ch){
	if(_renderable.has(ch)){ return _renderable.get(ch); }
	let ok = true;
	try{
		if(_probeOverride){
			ok = !!_probeOverride(ch);
		}else{
			const a = inkSignature(ch);
			if(a){
				if(!a.ink){
					ok = false;
				}else{
					ok = !referenceCodePoints(ch.codePointAt(0)).some((r)=>{
						const b = inkSignature(String.fromCodePoint(r));
						return !!b && b.ink === a.ink && b.h === a.h;
					});
				}
			}
		}
	}catch(e){ ok = true; }
	_renderable.set(ch, ok);
	return ok;
}

// 显示用:本机画不出的登记字换成回退写法;其余原样。不含罕见字的文本零开销原样返回。
export function rareSafeText(text){
	if(text == null){ return text; }
	const src = `${text}`;
	if(!RARE_RE.test(src)){ return text; }
	return src.replace(RARE_RE_G, (ch)=>(RARE_CHARS[ch] && !canRenderRareChar(ch) ? rareCharFallback(ch) : ch));
}

// 整个对象里的字符串都过一遍(只读拷贝;没有罕见字的子树原样复用,不新建)。
export function rareSafeDeep(value){
	if(typeof value === 'string'){ return rareSafeText(value); }
	if(Array.isArray(value)){
		let changed = false;
		const out = value.map((v)=>{ const n = rareSafeDeep(v); if(n !== v){ changed = true; } return n; });
		return changed ? out : value;
	}
	if(value && typeof value === 'object'){
		let changed = false;
		const out = {};
		Object.keys(value).forEach((k)=>{
			const nk = rareSafeText(k);
			const n = rareSafeDeep(value[k]);
			if(n !== value[k] || nk !== k){ changed = true; }
			out[nk] = n;
		});
		return changed ? out : value;
	}
	return value;
}
