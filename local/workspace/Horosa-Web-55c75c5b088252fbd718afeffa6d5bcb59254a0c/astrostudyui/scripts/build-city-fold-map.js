/* eslint-disable no-console */
// 地点检索「繁→简单字折叠表」(src/data/cityTradSimpMap.json)补全。
//
// 城市库(cities.json 小库 + citiesFull.json 大库)全是简体;检索时把查询里的繁体字逐字折回简体再比(cityMatch.foldTrad)。
// 折叠表要同时认两种繁体:
//   ① 源库原文的繁体(build-cities.js 收集:臺北 / 澳門 …);
//   ② 界面切到繁体后**屏幕上显示的字**(显示层规则 scriptConvert/hantConverter.toHant:紐約 / 華盛頓 / 雲巖區 / 鍾祥 …)——
//      用户照屏幕输入,必须折回库里的简体名。
// 并且绝不折叠库里本来就用作简体的字(「乾县」的「乾」不能折成「干」,否则直接输入简体反而搜不到)。
//
// 运行:cd Horosa-Web/astrostudyui && node scripts/build-city-fold-map.js(build-cities.js 末尾也会调用)
// 一致性由 src/components/amap/__tests__/cityFoldMapConsistency.test.js 锁:任一城市名 / 地区名的显示写法折不回原名即红。
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const MAP_PATH = path.join(SRC, 'data', 'cityTradSimpMap.json');
const LISTS = [path.join(SRC, 'data', 'cities.json'), path.join(SRC, 'data', 'citiesFull.json')];

// 显示层转换器(与界面同一份代码):esbuild 打成 CommonJS 在内存里加载。
// 词典包没有在 package exports 里导出 dist/umd 路径,按文件路径直接解析(插件只能用异步 API)。
async function loadDisplayConverter(){
	const esbuild = require('esbuild');
	const entry = path.join(SRC, 'utils', 'scriptConvert', 'hantConverter.js');
	const res = await esbuild.build({
		entryPoints: [entry], bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent',
		plugins: [{
			name: 'opencc-umd',
			setup(b){
				b.onResolve({ filter: /^opencc-js\/dist\/umd\// }, (a)=>({ path: path.join(ROOT, 'node_modules', `${a.path}`) }));
			},
		}],
	});
	const m = new Module(entry);
	m.filename = entry;
	m.paths = Module._nodeModulePaths(path.dirname(entry));
	m._compile(res.outputFiles[0].text, entry);
	return m.exports.toHant;
}

function entryTexts(c){
	const name = c.n !== undefined ? c.n : c.name;
	const region = c.r !== undefined ? c.r : c.region;
	return [`${name || ''}`, `${region || ''}`].filter(Boolean);
}

// 纯函数:baseMap(源库繁体单字映射)+ 城市条目 + 显示转换 → { map, dropped, conflicts, added }
function completeCityFoldMap(baseMap, lists, toHant){
	const simpChars = new Set();
	lists.forEach((list)=>(list || []).forEach((c)=>entryTexts(c).forEach((s)=>{ for(const ch of s){ simpChars.add(ch); } })));
	const map = {};
	const dropped = [];
	Object.keys(baseMap || {}).forEach((k)=>{
		if(simpChars.has(k)){ dropped.push(`${k}→${baseMap[k]}`); return; }
		map[k] = baseMap[k];
	});
	const conflicts = new Set();
	const added = [];
	lists.forEach((list)=>(list || []).forEach((c)=>entryTexts(c).forEach((s)=>{
		const a = Array.from(s);
		const d = Array.from(toHant(s));
		if(a.length !== d.length){ conflicts.add(`${s}:显示写法长度不等`); return; }
		for(let i = 0; i < a.length; i++){
			if(d[i] === a[i]){ continue; }
			if(simpChars.has(d[i])){ conflicts.add(`${s}:「${d[i]}」也是库里的简体字`); continue; }
			if(map[d[i]] !== undefined){
				if(map[d[i]] !== a[i]){ conflicts.add(`${s}:「${d[i]}」已折成「${map[d[i]]}」`); }
				continue;
			}
			map[d[i]] = a[i];
			added.push(`${d[i]}→${a[i]}`);
		}
	})));
	return { map, dropped, conflicts: Array.from(conflicts), added };
}

async function writeCompletedMap(baseMap, lists){
	const res = completeCityFoldMap(baseMap, lists, await loadDisplayConverter());
	fs.writeFileSync(MAP_PATH, JSON.stringify(res.map));
	console.log(`[city-fold-map] 折叠表 ${Object.keys(res.map).length} 字(补显示写法 ${res.added.length} 字,去掉误折简体字 ${res.dropped.length}:${res.dropped.join(' ')})`);
	if(res.conflicts.length){
		console.log(`[city-fold-map] 折不回原名 ${res.conflicts.length} 处(一致性测试会红):\n  ${res.conflicts.join('\n  ')}`);
	}
	return res;
}

module.exports = { completeCityFoldMap, loadDisplayConverter, writeCompletedMap, MAP_PATH };

if(require.main === module){
	const base = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
	const lists = LISTS.map((p)=>JSON.parse(fs.readFileSync(p, 'utf8')));
	writeCompletedMap(base, lists).then((res)=>process.exit(res.conflicts.length ? 1 : 0), (e)=>{ console.error(e); process.exit(2); });
}
