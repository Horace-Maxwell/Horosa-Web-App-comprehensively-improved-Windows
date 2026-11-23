// 读源码的样式测试用:把 var(--horosa-…) 尺度令牌(层级 / 字号 / 间距 / 圆角)解析回数值,再按原来的几何口径算。
// 令牌单源 = layouts/app/01-base.less 的尺度令牌块(与主题无关的那个 :root;主题块只放颜色)。
const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '../../../layouts/app/01-base.less');

function scaleTokens(){
	const src = fs.readFileSync(BASE, 'utf8');
	const at = src.indexOf('尺度令牌块');
	if(at < 0){ throw new Error('01-base.less 里没找到尺度令牌块'); }
	const open = src.indexOf(':root {', at);
	const close = src.indexOf('\n    }', open);
	const body = src.slice(open, close).replace(/\/\*[\s\S]*?\*\//g, '');
	const out = {};
	const re = /(--horosa-[\w-]+)\s*:\s*([^;]+);/g;
	let m = re.exec(body);
	while(m){ out[m[1]] = m[2].trim(); m = re.exec(body); }
	return out;
}

// 文本里的 var(--horosa-x) / var(--horosa-x, 兜底) 换成令牌值(不认识的变量原样留着)
function resolveTokens(text){
	const t = scaleTokens();
	return `${text}`.replace(/var\(\s*(--horosa-[\w-]+)\s*(?:,[^)]*)?\)/g, (all, name)=>(t[name] !== undefined ? t[name] : all));
}

module.exports = { scaleTokens, resolveTokens };
