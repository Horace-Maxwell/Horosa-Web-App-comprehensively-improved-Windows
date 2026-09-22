/* eslint-disable no-console */
// AI 助手 @ 引用·技法拼音表 builder(构建期,pinyin-pro 只在 devDependencies:preflight [36] 铁律「不得进运行时 bundle」,
// 与 build-cities.js 同一做法:构建期算好写成静态 JSON,运行时只读表)。
// 来源:src/utils/aiAnalysisContext.js 的 ANALYSIS_TECHNIQUE_LABELS(正则抽 key: '中文标签');
// 输出:src/data/techniquePinyin.json → { key: "quanpin shouzimu" }(无声调;全拼与首字母空格分隔,运行时子串/前缀匹配)。
// 运行:cd Horosa-Web/astrostudyui && node scripts/build-technique-pinyin.js;合同测试 aiChatMentionPinyin.contract.test.js 锁「表 ≡ 当前标签重算」。
const fs = require('fs');
const path = require('path');
const { pinyin } = require('pinyin-pro');

const SRC = path.join(__dirname, '..', 'src', 'utils', 'aiAnalysisContext.js');
const OUT = path.join(__dirname, '..', 'src', 'data', 'techniquePinyin.json');

function extractLabels(src){
	const m = /export const ANALYSIS_TECHNIQUE_LABELS\s*=\s*\{([\s\S]*?)\n\};/.exec(src);
	if(!m){ throw new Error('ANALYSIS_TECHNIQUE_LABELS 未找到'); }
	const out = {};
	// 一行可能写多个键(如 huangli/tongshu/rizi/jieqipan 同行),故不锚行首;键后紧跟 : '标签'
	const re = /(?:^|[\s{,])([A-Za-z_][A-Za-z0-9_]*):\s*'([^']*)'/g;
	let x;
	while((x = re.exec(m[1]))){ out[x[1]] = x[2]; }
	return out;
}

// 多音字:pinyin-pro 按词典默认读音,术数语境另有一读的标签把另一读也并进表(两读都能搜到,不替换默认读音以免其它人按默认读音搜不到)
//   重置盘(chóng zhì 迁居重置,默认读成 zhòng)· 宿占(二十八宿 xiù,默认读成 sù)
const EXTRA_READINGS = { 重置盘: 'chongzhipan czp', 宿占: 'xiuzhan xz' };

// 标签按非汉字分隔成段(「十三分盘 / 占星地图」→ 两段),每段各出全拼 + 首字母,空格分隔 → 运行时按词子串/前缀匹配
function pinyinOf(label){
	const segs = `${label || ''}`.split(/[^一-鿿]+/).filter(Boolean);
	if(!segs.length){ return ''; }
	const fulls = segs.map((zh)=>(pinyin(zh, { toneType: 'none', type: 'array' }) || []).join(''));
	const firsts = segs.map((zh)=>(pinyin(zh, { pattern: 'first', toneType: 'none', type: 'array' }) || []).join(''));
	const extra = EXTRA_READINGS[`${label || ''}`.trim()] || '';
	return fulls.concat(firsts).concat(extra ? [extra] : []).filter(Boolean).join(' ').toLowerCase();
}

function build(){
	const labels = extractLabels(fs.readFileSync(SRC, 'utf8'));
	const table = {};
	Object.keys(labels).sort().forEach((k)=>{ table[k] = pinyinOf(labels[k]); });
	return table;
}

if(require.main === module){
	const table = build();
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, `${JSON.stringify(table, null, '\t')}\n`);
	console.log(`techniquePinyin.json: ${Object.keys(table).length} 键 → ${OUT}`);
}

module.exports = { build, extractLabels, pinyinOf };
