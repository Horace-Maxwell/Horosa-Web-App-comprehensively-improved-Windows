// 奇门六害 / 门迫 / 空亡的语义色(遁甲页、三式合一、奇门择日小盘共用一份)。
// 取值是主题变量:亮 / 暗各一份定义在 layouts/app/01-base.less,文字在各自底色上 ≥ 4.5:1(合同 utils/__tests__/themeContrastContract.test.js)。
// 此前三处各抄一份固定十六进制(门迫 #fa8c16 在宣纸底 2.1:1、空亡 #2f54eb / 击刑+入墓 #722ed1 在暗底 3.4 / 2.8:1)。
// 浅底色一律用 tint() 现算(color-mix),不再拼「十六进制 + 透明度两位」—— 变量拼不出来。
// 系统内核不认 color-mix(Safari 16.2 以前,桌面包下限 macOS 12.0 = Safari 15.0)时,整条行内声明作废、浅底整个消失:
// 那时改用 rgba(三元组变量, 透明度) —— 每个语义色在 01-base.less 亮 / 暗两块各配一个 `-rgb` 三元组(合同 themeRgbTokenParity)。
// 认 color-mix 的内核照旧拿 color-mix 原串(观感逐像素不变)。下限表:scripts/legacy-engine-floor.js。

export const QIMEN_HARM_COLOR = {
	击刑: 'var(--horosa-qimen-jixing, #cf1322)',
	入墓: 'var(--horosa-qimen-rumu, #8b5e3c)',
	击刑入墓: 'var(--horosa-qimen-both, #722ed1)',
	庚: 'var(--horosa-qimen-geng, #d4380d)',
	庚虎: 'var(--horosa-qimen-geng, #d4380d)',
	白虎: 'var(--horosa-qimen-baihu, #a8071a)',
	门迫: 'var(--horosa-qimen-menpo, #fa8c16)',
	空亡: 'var(--horosa-qimen-kongwang, #2f54eb)',
};

let colorMixSupported = null;
export function supportsColorMix(){
	if(colorMixSupported === null){
		try{
			colorMixSupported = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
				&& CSS.supports('color', 'color-mix(in srgb, red 50%, transparent)');
		}catch(e){
			colorMixSupported = false;
		}
	}
	return colorMixSupported;
}

const hexTriplet = (hex)=>{
	const h = hex.length === 3 ? hex.split('').map((c)=>c + c).join('') : hex;
	return [0, 2, 4].map((i)=>parseInt(h.slice(i, i + 2), 16)).join(', ');
};

/** 不认 color-mix 的内核用的等值写法:color-mix(in srgb, C p%, transparent) ≡ C 的 rgb 配透明度 p。 */
export function tintFallback(color, pct){
	const a = Math.round(Number(pct) * 100) / 10000;
	const c = `${color}`.trim();
	const v = /^var\(\s*(--[\w-]+)\s*(?:,\s*#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\s*)?\)$/.exec(c);
	if(v){ return `rgba(var(${v[1]}-rgb${v[2] ? `, ${hexTriplet(v[2])}` : ''}), ${a})`; }
	const h = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(c);
	if(h){ return `rgba(${hexTriplet(h[1])}, ${a})`; }
	return 'transparent';
}

/** 语义色的浅底(pct = 0–100,色占比) */
export function tint(color, pct){
	return supportsColorMix() ? `color-mix(in srgb, ${color} ${pct}%, transparent)` : tintFallback(color, pct);
}
