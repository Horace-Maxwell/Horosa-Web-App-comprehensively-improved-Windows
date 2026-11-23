#!/usr/bin/env node
/*
 * build-pdf-glyph-fallback.js —— 生成「矢量 PDF 内嵌字体没有的汉字 → 字体里有的通行写法」对照表(src/data/pdfGlyphFallback.json)。
 *
 * 内嵌的中文子集字体收的是通行字;古籍原文与引擎回文里的繁体 / 异体字(「尅」「隂」「齡」…)它没有,PDF 里会画成方框,
 * 而 TXT / Word 用系统字体显示正常。这张表只在 PDF 里用:字体缺这个字时换成同一个字的通行写法(仍缺才落成方框)。
 *   · 繁 → 简:取简繁词典(与界面简繁切换同一份)逐字折回的结果,目标字必须在字体里;
 *   · 异体字:词典不收的常见异体(下面 VARIANTS,逐条手列),目标字同样必须在字体里。
 * 字体换了 / 词典升级后重跑:npm run build:pdf-glyph-fallback(合同测试锁「表 ≡ 重算」)。
 */
const fs = require('fs');
const path = require('path');

const UI_ROOT = path.resolve(__dirname, '..');
const OUT = path.join(UI_ROOT, 'src', 'data', 'pdfGlyphFallback.json');
const FONT = path.join(UI_ROOT, 'public', 'fonts', 'HorosaCJK-subset.ttf');
const BOLD = path.join(UI_ROOT, 'public', 'fonts', 'HorosaCJK-Bold-subset.ttf');

// 词典不收的异体字 → 通行写法(古籍原文 / 引擎回文里实际出现过的)
const VARIANTS = {
	尅: '克', 隂: '阴', 炤: '照', 觧: '解', 逺: '远', 髙: '高', 闗: '关', 咲: '笑', 徃: '往', 㑹: '会', 懽: '欢', 塲: '场', 鬬: '斗', 㓙: '凶', 㐫: '凶',
	寳: '宝', 逹: '达', 聀: '职', 㣲: '微', 寕: '宁', 踈: '疏', 宻: '密', 蠺: '蚕', 䝉: '蒙', 隣: '邻', 栢: '柏', 淸: '清', 冦: '寇', 滛: '淫', 逰: '游',
	㨗: '捷', 㓜: '幼', 頥: '颐', 閠: '闰', 坵: '丘', 彊: '强', 舖: '铺', 籐: '藤', 煖: '暖', 勗: '勖',
};

function build(){
	// eslint-disable-next-line global-require
	const fontkit = require('@pdf-lib/fontkit');
	// eslint-disable-next-line global-require, import/no-dynamic-require
	const mod = require(path.join(UI_ROOT, 'node_modules', 'opencc-js', 'dist', 'umd', 't2cn.js'));
	const OpenCC = mod.ConverterFactory ? mod : mod.default;
	const regular = new Set(fontkit.create(fs.readFileSync(FONT)).characterSet);
	const bold = new Set(fontkit.create(fs.readFileSync(BOLD)).characterSet);
	const inBoth = (s)=>[...s].every((c)=>regular.has(c.codePointAt(0)) && bold.has(c.codePointAt(0)));
	const backs = ['tw', 'hk', 'twp', 'jp'].filter((k)=>OpenCC.Locale.from[k]).map((k)=>OpenCC.ConverterFactory(...OpenCC.Locale.from[k], ...OpenCC.Locale.to.cn));
	const table = {};
	for(let cp = 0x3400; cp <= 0x9fff; cp += 1){
		if(regular.has(cp)){ continue; }
		const ch = String.fromCodePoint(cp);
		let to = '';
		if(VARIANTS[ch] && inBoth(VARIANTS[ch])){ to = VARIANTS[ch]; }
		for(let i = 0; !to && i < backs.length; i += 1){
			const s = backs[i](ch);
			if(s && s !== ch && [...s].length === 1 && inBoth(s)){ to = s; }
		}
		if(to){ table[ch] = to; }
	}
	return table;
}

function render(table){
	const keys = Object.keys(table).sort((a, b)=>a.codePointAt(0) - b.codePointAt(0));
	return `{\n${keys.map((k)=>`\t${JSON.stringify(k)}: ${JSON.stringify(table[k])}`).join(',\n')}\n}\n`;
}

module.exports = { build, render, VARIANTS, OUT };

if(require.main === module){
	const table = build();
	fs.writeFileSync(OUT, render(table));
	console.log(`pdfGlyphFallback.json: ${Object.keys(table).length} 字 → ${OUT}`);
}
