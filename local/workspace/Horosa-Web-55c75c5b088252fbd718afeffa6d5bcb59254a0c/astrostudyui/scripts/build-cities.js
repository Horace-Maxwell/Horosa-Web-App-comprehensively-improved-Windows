/* eslint-disable no-console */
// 地点选择器全量城市库 builder（专业级：简体显示 + 拼音/首字母可搜 + 繁简折叠）。
// 两个数据源 → 合并去重 → 输出短键数组到 src/data/citiesFull.json(动态懒加载,不进主 bundle)。
//   1) vendor/kinastro/tools/cities/cities.json   世界城市(英文),筛 pop 阈值;字段 {name,country,admin1,admin2,lat,lon,pop}
//   2) vendor/kinastro/tools/cities/china_cities.json 中国省/市/区中文层级树(**繁体**);字段 {name, center{longitude,latitude}, districts[]}
// 输出条目短键:{ n: 显示名(简体), e: 英文名(中国城市为''), r: 上级/国家(简体), p: 拼音空格分隔(仅中文，世界城市为''), y: lat, x: lon }
//   - n  统一转**简体**(opencc 繁→简),解决「只能繁体搜/显示繁体」。
//   - p  由简体名生成的无声调拼音(空格分隔音节),运行时可拼成全拼"beijing"或首字母"bj"两种检索。
// 另输出 src/data/cityTradSimpMap.json：城市名里出现过的「繁→简」单字映射(极小),供运行时把繁体查询折叠成简体再匹配。
// 运行:cd Horosa-Web/astrostudyui && node scripts/build-cities.js
const fs = require('fs');
const path = require('path');
const { pinyin } = require('pinyin-pro');
const OpenCC = require('opencc-js');

// 繁(台/通用)→简 转换器。城市名里 臺灣→台湾、廣州→广州、烏魯木齊→乌鲁木齐 等均正确。
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

const CITIES_DIR = path.join(__dirname, '..', '..', 'vendor', 'kinastro', 'tools', 'cities');
const WORLD_SRC = path.join(CITIES_DIR, 'cities.json');
const CHINA_SRC = path.join(CITIES_DIR, 'china_cities.json');
const OUT = path.join(__dirname, '..', 'src', 'data', 'citiesFull.json');
const OUT_MAP = path.join(__dirname, '..', 'src', 'data', 'cityTradSimpMap.json');

// 体积上限(字节);超过则把世界城市阈值升到 POP_THRESHOLD_HI 重新构建。
// 加入拼音字段后体积上升,放宽到 5MB(懒加载分块,gzip 后约 1MB,不进主 bundle)。
const SIZE_LIMIT = 5 * 1024 * 1024;
// 为更全：世界城市 pop 阈值下探到 8000(原 15000),覆盖更多中小城市。
const POP_THRESHOLD_LO = 8000;
const POP_THRESHOLD_HI = 18000;

// 繁→简 单字映射收集(只收城市名里真正出现、且繁≠简的字)。运行时查询折叠用,体积极小。
const tradSimpMap = {};
function recordTradChars(str){
	for(const ch of `${str || ''}`){
		if(tradSimpMap[ch] !== undefined){
			continue;
		}
		const s = toSimplified(ch);
		// 单字一一对应且确有差异才记;多字/无差异不记(运行时 fold 用不到)。
		if(s && s.length === 1 && s !== ch){
			tradSimpMap[ch] = s;
		}
	}
}

// 简体名 → 无声调拼音(空格分隔音节)。非汉字(数字/英文/标点)pinyin-pro 原样返回,join 仍安全。
function pinyinSyllables(simp){
	try{
		const arr = pinyin(simp, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
		return arr.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
	}catch(e){
		return '';
	}
}

function num(v){
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

// 世界城市 → 短键条目数组(按 pop 阈值过滤)。英文名,无拼音(本就拉丁字母可直接搜)。
// 世界城市中文别名种子(人工核验;键 = 源库英文名|ISO2 国码 → 简体中文名)。命中的条目 n=中文、e=英文、p=中文拼音,
// 中文用户键入「利马/惠灵顿/雷克雅未克」才能命中;未命中的条目保持英文形状不变。
const WORLD_ZH_SRC = path.join(__dirname, 'data', 'world_cities_zh.json');
function loadWorldZh(){
	try{
		const m = JSON.parse(fs.readFileSync(WORLD_ZH_SRC, 'utf8'));
		delete m._doc;
		return m;
	}catch(e){
		return {};
	}
}

function buildWorld(popThreshold){
	const raw = JSON.parse(fs.readFileSync(WORLD_SRC, 'utf8'));
	const zh = loadWorldZh();
	const out = [];
	let zhHits = 0;
	for(const c of raw){
		const pop = num(c.pop);
		if(pop === null || pop < popThreshold){
			continue;
		}
		const lat = num(c.lat);
		const lon = num(c.lon);
		const name = `${c.name || ''}`.trim();
		if(lat === null || lon === null || !name){
			continue;
		}
		const country = `${c.country || ''}`.trim();
		const cn = zh[`${name}|${country}`];
		if(cn){
			zhHits += 1;
			out.push({ n: cn, e: name, r: country, p: pinyinSyllables(cn), y: lat, x: lon });
		}else{
			out.push({ n: name, e: name, r: country, p: '', y: lat, x: lon });
		}
	}
	// 种子里有而源库(按人口阈值)没有的首都/小城:直接从源库全量里补(不受人口阈值限制)
	const present = new Set(out.map((o)=>`${o.e}|${o.r}`));
	for(const key of Object.keys(zh)){
		if(present.has(key)){ continue; }
		const [name, country] = key.split('|');
		const src = raw.find((c)=>`${c.name || ''}`.trim() === name && `${c.country || ''}`.trim() === country);
		if(!src){ continue; }
		const lat = num(src.lat); const lon = num(src.lon);
		if(lat === null || lon === null){ continue; }
		zhHits += 1;
		out.push({ n: zh[key], e: name, r: country, p: pinyinSyllables(zh[key]), y: lat, x: lon });
	}
	console.log(`world zh aliases matched: ${zhHits}/${Object.keys(zh).length}`);
	return out;
}

// 中国层级树(繁体) → 扁平短键条目。统一转简体 + 生成拼音;r = 上级名(简体)。
function buildChina(){
	const root = JSON.parse(fs.readFileSync(CHINA_SRC, 'utf8'));
	const out = [];
	const walk = (node, parentSimp)=>{
		const rawName = `${node.name || ''}`.trim();
		recordTradChars(rawName);
		const name = rawName ? toSimplified(rawName) : '';
		const center = node.center || {};
		const lat = num(center.latitude);
		const lon = num(center.longitude);
		// 根国家节点不收(parentSimp 为空 = 根);其余有名+有坐标即收。
		if(parentSimp && name && lat !== null && lon !== null){
			out.push({ n: name, e: '', r: parentSimp, p: pinyinSyllables(name), y: lat, x: lon });
		}
		const kids = Array.isArray(node.districts) ? node.districts : [];
		for(const k of kids){
			walk(k, name || parentSimp);
		}
	};
	walk(root, '');
	return out;
}

// 合并去重:key = 显示名 + 四舍五入坐标(2 位)。中国(简体)优先保留。
function merge(china, world){
	const map = new Map();
	const keyOf = (it)=>`${it.n}|${it.y.toFixed(2)}|${it.x.toFixed(2)}`;
	for(const it of china){
		map.set(keyOf(it), it);
	}
	for(const it of world){
		const k = keyOf(it);
		if(!map.has(k)){
			map.set(k, it);
		}
	}
	return Array.from(map.values());
}

function build(popThreshold){
	const china = buildChina();
	const world = buildWorld(popThreshold);
	const merged = merge(china, world);
	// 坐标保留 5 位小数控体积(约 1m 精度,远超城市选点所需)。
	for(const it of merged){
		it.y = Number(it.y.toFixed(5));
		it.x = Number(it.x.toFixed(5));
	}
	return { merged, chinaCount: china.length, worldCount: world.length };
}

function main(){
	let popThreshold = POP_THRESHOLD_LO;
	let res = build(popThreshold);
	let json = JSON.stringify(res.merged);
	if(Buffer.byteLength(json, 'utf8') > SIZE_LIMIT){
		console.log(`[build-cities] 体积超限(${(Buffer.byteLength(json, 'utf8') / 1024 / 1024).toFixed(2)}MB),世界城市阈值升至 pop>=${POP_THRESHOLD_HI} 重建`);
		popThreshold = POP_THRESHOLD_HI;
		res = build(popThreshold);
		json = JSON.stringify(res.merged);
	}
	fs.writeFileSync(OUT, json);
	const mapJson = JSON.stringify(tradSimpMap);
	fs.writeFileSync(OUT_MAP, mapJson);
	const sizeMB = (Buffer.byteLength(json, 'utf8') / 1024 / 1024).toFixed(2);
	console.log('[build-cities] 完成');
	console.log(`  世界城市(pop>=${popThreshold}):${res.worldCount} 条`);
	console.log(`  中国省/市/区(简体+拼音):${res.chinaCount} 条`);
	console.log(`  合并去重后:${res.merged.length} 条`);
	console.log(`  繁→简 字映射:${Object.keys(tradSimpMap).length} 字 (${(Buffer.byteLength(mapJson, 'utf8') / 1024).toFixed(1)}KB)`);
	console.log(`  输出:${OUT}`);
	console.log(`  体积:${sizeMB}MB`);
}

main();
