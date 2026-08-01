// 结构性哨兵(institutionalize):每个有 snapshot builder 的技法,实跑/源扫其产出段头,
// 断言 ⊆ AI_EXPORT_PRESET_SECTIONS[key]。堵住「builder 产段头未登记 preset → 自定义过导出段的
// 用户被 filterContentByWantedSections 静默删、且导出设置勾不到」这类回归(本批 八字4段/世俗4段/
// 金口诀4段/奇门段名错位/六爻断卦结构 皆此坑)。动态/长注释段头必须先静态化(段头固定、注释移正文行),
// 否则在此红。条件段(按数据/流派才出)由 ⊆ 语义天然豁免(未产出即不检);整篇制(塔罗等无段头)不在此列。
import fs from 'fs';
import path from 'path';
import { getAIExportEffectiveSectionsForTechnique, getAIExportDefaultOffSet, AI_EXPORT_SETTINGS_VERSION, AI_EXPORT_PRESET_SECTIONS } from '../aiExport';
import { buildBaziSnapshotForParams } from '../../components/cntradition/BaZi';
import { buildGuaSnapshotText } from '../../components/guazhan/GuaZhanMain';
import { Gua64, getGua64 } from '../../components/gua/GuaConst';
import { calcDunJia, buildDunJiaSnapshotText } from '../../components/dunjia/DunJiaCalc';
import { buildLocalBaziResult } from '../baziLunarLocal';

// ---- 与 aiExport 同口径的段头归一/抽取(单一真值源:preset 由 getAIExportEffectiveSectionsForTechnique 给) ----
function normTitle(t){
	const s = `${t || ''}`.trim();
	if(!s){ return ''; }
	if(/^基于.+推运$/.test(s)){ return '基于X点推运'; }
	if(/^基于.+起运$/.test(s)){ return '基于X起运'; }
	return s;
}
function presetSet(key){
	const arr = getAIExportEffectiveSectionsForTechnique(key, { version: AI_EXPORT_SETTINGS_VERSION, sections: {} }) || [];
	const set = new Set(arr.map(normTitle).filter(Boolean));
	// [YC] effective(未自定义)会剔「默认关段」——但 builder 恒产这些段头,「段头 ⊆ preset」的口径
	// 应是「已登记可控」而非「默认导出」,把默认关段并回,否则 doctrine 段落地即假红。
	const offSet = getAIExportDefaultOffSet(key);
	if(offSet){ offSet.forEach((s)=>set.add(s)); }
	return set;
}
// 与 parseSectionTitleLine 同:整行 [X] / 【X】 才算段头(行内带其它文字 → 非段头,这正是要靠「段头卫生」堵的反面)
function extractHeaders(text){
	const out = [];
	`${text || ''}`.split('\n').forEach((line)=>{
		const t = `${line || ''}`.trim();
		const m = t.match(/^\[(.+)\]$/) || t.match(/^【(.+)】$/);
		if(m && m[1]){ out.push(normTitle(m[1])); }
	});
	return Array.from(new Set(out));
}

// ---- 本地八字/奇门夹具(复用本地引擎,无需后端;与各技法既有 *.test 同构) ----
function makeFields(dateStr, timeStr){
	return {
		date: { value: { format: ()=>dateStr } },
		time: { value: { format: ()=>timeStr } },
		zone: { value: '+08:00' },
	};
}
function gz(pillar){ return (pillar && (pillar.ganzhi || pillar.ganZhi)) || ''; }
function buildLocalNongli(date, time){
	const local = buildLocalBaziResult({ date, time, zone: '+08:00', lon: '120e00', lat: '0n00', gpsLon: 120, gpsLat: 0, ad: 1, gender: 1, timeAlg: 1, after23NewDay: 0 });
	const four = local.bazi.fourColumns;
	return {
		...local.bazi.nongli,
		bazi: local.bazi,
		yearGanZi: gz(four.year), yearJieqi: gz(four.year),
		monthGanZi: gz(four.month), dayGanZi: gz(four.day),
		time: gz(four.time), timeGanZi: gz(four.time),
	};
}

describe('AI 导出 roundtrip 哨兵:builder 实跑段头 ⊆ AI_EXPORT_PRESET_SECTIONS', ()=>{
	test('八字(本地引擎):快照段头全部登记进 bazi preset(含静态化后的 五行力量/格局·用神/盲派结构/月令司令（分野）)', async ()=>{
		const BASE = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: 118.45, gpsLon: 118.45, lat: 31.63, gpsLat: 31.63, gender: 1, timeAlg: 1, after23NewDay: 1 };
		const text = await buildBaziSnapshotForParams({ ...BASE, school: 'mangpai', period: { liunian: [2020], liuyue: [], liuri: [], liushi: [] } });
		const headers = extractHeaders(text);
		const preset = presetSet('bazi');
		const orphan = headers.filter((h)=>!preset.has(h));
		expect(orphan).toEqual([]);
		// 静态化锚:不得回潮成动态段头(否则自定义用户被静默删)
		expect(headers).toEqual(expect.arrayContaining(['五行力量', '格局·用神', '盲派结构', '月令司令（分野）']));
	});

	test('六爻断卦:快照段头全部登记进 sixyao preset(含静态化后的 断卦结构)', ()=>{
		getGua64(0);
		const g = Gua64.find((x)=>x.name === '火水未济');
		const yao = g.value.map((v, i)=>({ value: v, change: i === 2, god: null, name: g.yaoname[i] }));
		const st = { currentGua: Gua64.indexOf(g), yao, nongli: { dayGanZi: '甲子', monthGanZi: '丙午', yearGanZi: '丙午', time: '子' }, guaDesc: {}, liuyaoSettings: null };
		const text = buildGuaSnapshotText({}, st);
		const headers = extractHeaders(text);
		const preset = presetSet('sixyao');
		expect(headers.filter((h)=>!preset.has(h))).toEqual([]);
		expect(headers).toContain('断卦结构');
	});

	test('奇门(本地日家盘):快照段头全部登记进 qimen preset(含真实段 旺相休囚死·月令能量,非旧幽灵)', ()=>{
		const fields = makeFields('2026-05-15', '00:12:00');
		const nongli = buildLocalNongli('2026-05-15', '00:12:00');
		const pan = calcDunJia(fields, nongli, { paiPanType: 2, qijuMethod: 'chaibu', zhiShiType: 0, yueJiaQiJuType: 1, kongMode: 'day', yimaMode: 'day', shiftPalace: 0, fengJu: false, timeAlg: 1 }, {});
		const text = buildDunJiaSnapshotText(pan);
		const headers = extractHeaders(text);
		const preset = presetSet('qimen');
		expect(headers.filter((h)=>!preset.has(h))).toEqual([]);
		expect(headers).toContain('旺相休囚死·月令能量');
	});
});

// ---- 源扫:夹具偏重的 builder(世俗盘为实例方法 / 金口诀依赖后端四位数据),静态段头字面量 ⊆ preset ----
function readSrc(rel){ return fs.readFileSync(path.resolve(__dirname, rel), 'utf8'); }
function sliceFrom(src, marker, span){
	const i = src.indexOf(marker);
	return i < 0 ? src : src.slice(i, i + (span || 14000));
}
// 抽 '[X]' / `[X]` / "[X]" 字面量段头(动态 ${...} 前缀截断后为空则跳过)
function sourceBracketHeaders(region){
	const names = new Set();
	const re = /(['"`])\[([^\]\n'"`]+?)\]/g;
	let m;
	while((m = re.exec(region))){
		let n = m[2];
		const d = n.indexOf('${');
		if(d >= 0){ n = n.slice(0, d); }
		n = normTitle(n);
		if(n){ names.add(n); }
	}
	return names;
}

describe('AI 导出 roundtrip 哨兵:源扫静态段头 ⊆ AI_EXPORT_PRESET_SECTIONS', ()=>{
	test('金口诀 buildJinKouSnapshotText:源内字面量段头全部登记进 jinkou preset(含 发用·五动三动/格局/太岁月建/贵神月将象意/分类用神)', ()=>{
		const src = readSrc('../../components/jinkou/JinKouMain.js');
		const region = sliceFrom(src, 'export function buildJinKouSnapshotText', 16000);
		const headers = Array.from(sourceBracketHeaders(region));
		const preset = presetSet('jinkou');
		expect(headers.length).toBeGreaterThan(8);
		expect(headers.filter((h)=>!preset.has(h))).toEqual([]);
		expect(headers).toEqual(expect.arrayContaining(['发用·五动三动', '格局', '太岁月建', '贵神月将象意', '分类用神']));
	});

	test('世俗盘 buildAiSnapshot:派生分析段头(定局/入境骨架/地理分野/地区盘推运/世俗宫义)全部登记进 mundane preset', ()=>{
		const src = readSrc('../../components/mundane/MundaneMain.js');
		const region = sliceFrom(src, 'const extraSecs = [];', 4000);
		const headers = Array.from(sourceBracketHeaders(region));
		const preset = presetSet('mundane');
		expect(headers.filter((h)=>!preset.has(h))).toEqual([]);
		expect(headers).toEqual(expect.arrayContaining(['世俗宫义', '定局·年主/盘主', '入境骨架', '地理分野', '地区盘推运']));
	});

	test('印度占星 buildJyotishSnapshotLines:源内 out[段名] 派生段头全部登记进 indiachart preset(约40段,防 Jyotish 块整体漏登记)', ()=>{
		const src = readSrc('../../components/astro/IndiaChart.js');
		const region = sliceFrom(src, 'buildJyotishSnapshotLines', 28000);   // 新增 Nadi/三对法/宿距段 → 扩窗防座运族滑出
		// Jyotish 段头由 out['X'] 键 → ensureSection(lines, X) 产 [X];抽 out['...'] 键。
		const names = new Set();
		const re = /out\['([^']+)'\]/g;
		let m;
		while((m = re.exec(region))){ const n = normTitle(m[1]); if(n){ names.add(n); } }
		// v39 补:反引号模板键 out[`座运·${...}`](Rasi Dasha 每宫一段,段名嵌运行期值)——
		// 单引号正则结构上扫不到,曾致「座运·X」整族漏登记(第 2 轮 checker 才捕)。
		// 把 ${...} 换成占位符 X 再 normTitle 折叠 → 与 preset 静态占位「座运·X」对齐。
		const reTpl = /out\[`([^`]*)`\]/g;
		while((m = reTpl.exec(region))){
			const folded = normTitle(m[1].replace(/\$\{[^}]*\}/g, 'X'));
			if(folded){ names.add(folded); }
		}
		const headers = Array.from(names);
		const preset = presetSet('indiachart');
		expect(headers.length).toBeGreaterThan(30);
		expect(headers.filter((h)=>!preset.has(h))).toEqual([]);
		expect(headers).toEqual(expect.arrayContaining(['Shadbala 六力', 'Panchanga 五要素', '宫位力（Bhava Bala）', 'Āyurdāya 寿命基础', 'KP 意义者 Significators', '座运·X']));
	});

	test('节气盘 buildJieQiSnapshot/CurrentSnapshot:季节×盘型 派生段头(四分点 × 星盘/宿盘/3D盘)全部登记进节气分点子盘 preset', ()=>{
		// 段头由模板插值产出:`[${title}星盘]` / `[${title}宿盘]` / panelName=`${info.title}3D盘` → `[${panelName}]`。
		// 季节 title/info.title 来自四分点数据(与四子盘 preset 键 chunfen/xiazhi/qiufen/dongzhi 一一对应);
		// 「盘型后缀」从源派生(新增盘型如 3D盘 会自动进集合,防再漏登记——正是第 3 轮 checker 捕到 3D盘的类)。
		const src = readSrc('../../components/jieqi/JieQiChartsMain.js');
		const region = sliceFrom(src, 'function buildJieQiSnapshotText', 4200); // 覆盖 Snapshot + CurrentSnapshot 两 builder
		const suffixes = new Set();
		const re = /\$\{[^}]*\btitle\b[^}]*\}([一-鿿0-9A-Za-z]+)/g;
		let m;
		while((m = re.exec(region))){ if(m[1]){ suffixes.add(m[1]); } }
		const tails = Array.from(suffixes);
		expect(tails).toEqual(expect.arrayContaining(['星盘', '宿盘', '3D盘'])); // 扫描确实抓到三种盘型
		const splitPreset = new Set([
			...presetSet('jieqi_chunfen'),
			...presetSet('jieqi_xiazhi'),
			...presetSet('jieqi_qiufen'),
			...presetSet('jieqi_dongzhi'),
		]);
		const expected = [];
		['春分', '夏至', '秋分', '冬至'].forEach((s)=>tails.forEach((t)=>expected.push(`${s}${t}`)));
		expect(expected.filter((h)=>!splitPreset.has(h))).toEqual([]);
	});

	test('塔罗 buildReadingText:源内字面量段头(牌阵综览/逐牌详解/综合断语/定局/生命牌)全部登记进 tarot preset', ()=>{
		const src = readSrc('../../components/tarot/engine/reportText.js');
		const region = sliceFrom(src, 'export function buildReadingText', 4000);
		const headers = Array.from(sourceBracketHeaders(region));
		const preset = presetSet('tarot');
		expect(headers.length).toBeGreaterThanOrEqual(5);
		expect(headers.filter((h)=>!preset.has(h))).toEqual([]);
		expect(headers).toEqual(expect.arrayContaining(['牌阵综览', '逐牌详解', '综合断语', '定局', '生命牌']));
	});

	// 大六壬全流派补齐:buildLiuRengSnapshotText 的断卦层段头(年月神煞/课体结构/三传旺衰/空亡真假/旬空落点/陷空/遁干特殊/
	// 年命上神/占断向导)条件产出(每盘几乎必出)。源扫(builder 依赖后端 gods+chartObj,夹具偏重)→ 字面量段头 ⊆ liureng preset。
	// 此 builder 段头全为字面量(无 ${} 动态段头),源扫无假失败之虞;v29 已把这 9 段补进 preset。
	test('大六壬 buildLiuRengSnapshotText:源内字面量段头全部登记进 liureng preset(含 年月神煞/课体结构/三传旺衰/空亡真假/旬空落点/陷空/遁干特殊/年命上神/占断向导)', ()=>{
		const src = readSrc('../../components/lrzhan/LiuRengMain.js');
		const region = sliceFrom(src, 'export function buildLiuRengSnapshotText', 12000);
		const headers = Array.from(sourceBracketHeaders(region));
		const preset = presetSet('liureng');
		expect(headers.length).toBeGreaterThan(10);
		expect(headers.filter((h)=>!preset.has(h))).toEqual([]);
		expect(headers).toEqual(expect.arrayContaining(['年月神煞', '课体结构', '三传旺衰', '空亡真假', '旬空落点', '陷空', '遁干特殊', '年命上神', '占断向导']));
	});

	// 西洋卜卦 horary:buildHorarySnapshot 在 src/divination/horary/(非 components/)——历轮源扫都只扫 components/,
	// 漏了此目录,致「专题深化·${topic.title}」(诉讼/买房/怀孕 3 变体)动态段头未登记 preset 被第 4 轮 checker 才捕。
	// 本守卫直扫 divination/ builder 的 `push(`[前缀${...}]`)` 模板段头:静态前缀 + ${} → 占位,断言 ⊆ preset。
	test('西洋卜卦 horary buildHorarySnapshot(divination/):动态专题段头(专题深化·X)已登记 horary preset', ()=>{
		const src = readSrc('../../divination/horary/horarySnapshot.js');
		const re = /push\(`\[([^`$]*)\$\{[^}]*\}\]`\)/g; // `[前缀${...}]` → 前缀 + 'X' 占位
		const names = new Set();
		let m;
		while((m = re.exec(src))){ if(m[1]){ names.add(`${m[1]}X`); } }
		expect(names.has('专题深化·X')).toBe(true); // 确实扫到该动态段头
		const preset = presetSet('horary');
		expect(Array.from(names).filter((h)=>!preset.has(h))).toEqual([]);
	});

	// 前瞻加固(Round-5 提示):上一守卫只硬编码 horary 一个文件路径,未来在 src/divination/ 新增带动态段头的
	// builder 不会被自动扫到——正是「只扫 components/ 漏 divination/」那类目录盲区的翻版。此守卫递归扫 divination/
	// 全树 *.js,任何 `push(`[…${…}…]`)` 动态段头的折叠占位都必须已登记进「全 preset 并集」(不需知道属哪个技法,
	// 只要在某个 preset 里 → 该动态段族有开关可控)。当前 divination/ 仅 horary 有此类产出,故此刻是超集自洽。
	test('divination/ 全树前瞻守卫:任何 builder 的动态段头占位 ⊆ 全 preset 并集(防未来新增子目录 builder 漏登记)', ()=>{
		const root = path.resolve(__dirname, '../../divination');
		const files = [];
		(function walk(dir){
			fs.readdirSync(dir, { withFileTypes: true }).forEach((ent)=>{
				const p = path.join(dir, ent.name);
				if(ent.isDirectory()){ if(ent.name !== '__tests__'){ walk(p); } }
				else if(ent.name.endsWith('.js')){ files.push(p); }
			});
		})(root);
		const allPreset = new Set();
		Object.keys(AI_EXPORT_PRESET_SECTIONS).forEach((k)=>{
			(AI_EXPORT_PRESET_SECTIONS[k] || []).forEach((s)=>{ const n = normTitle(s); if(n){ allPreset.add(n); } });
		});
		const placeholders = new Set();
		const re = /push\(`\[([^`]*\$\{[^}]*\}[^`]*)\]`\)/g; // `[…${…}…]` 段头(${}在任意位置)
		files.forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			let m;
			while((m = re.exec(src))){
				const ph = normTitle(m[1].replace(/\$\{[^}]*\}/g, 'X'));
				if(ph){ placeholders.add(ph); }
			}
		});
		expect(placeholders.has('专题深化·X')).toBe(true); // 扫描确实生效(至少抓到 horary)
		expect(Array.from(placeholders).filter((h)=>!allPreset.has(h))).toEqual([]);
	});

	// [同类自检 v42·全树版] 逐技法硬编码守卫的目录盲区根治:src/ 全树扫「静态字面量段头」
	// push('[X]') / = '[X]',断言 ⊆ 全 preset 并集 ∪ 声明白名单。曾实弹抓获若干段漏登与
	// guolao V1 / jieqi withHeaders 两处死码段头(已注释标记)。新增 builder 段头忘登 preset → 此处红。
	test('src/ 全树前瞻守卫:静态字面量段头 ⊆ 全 preset 并集 ∪ 白名单(防任何技法再漏登)', ()=>{
		const root = path.resolve(__dirname, '../..');
		const files = [];
		(function walk(dir){
			fs.readdirSync(dir, { withFileTypes: true }).forEach((ent)=>{
				const p = path.join(dir, ent.name);
				if(ent.isDirectory()){ if(!['__tests__', 'node_modules'].includes(ent.name)){ walk(p); } }
				else if(ent.name.endsWith('.js') && !ent.name.includes('.test.')){ files.push(p); }
			});
		})(root);
		const allPreset = new Set();
		Object.keys(AI_EXPORT_PRESET_SECTIONS).forEach((k)=>{
			(AI_EXPORT_PRESET_SECTIONS[k] || []).forEach((s)=>{ const n = normTitle(s); if(n){ allPreset.add(n); } });
		});
		// 白名单(每项必须带理由;新增白名单=显式决策,勿顺手扩):
		const WHITELIST = new Set([
			'图形标注文本',      // aiExport ENABLE_SVG_TEXT_EXPORT=false 死代码 + isNoiseLine 明确剔除
			'九宫与宫内星体',    // 旧版段名,mapLegacySectionTitle 归一桥在册(aiExport)
			'宫位与星体',        // guolao V1 buildGuolaoSnapshotText 死代码(零调用,已注释标记)
			'宫位二十八宿',      // 同上 guolao V1 死代码
			'行星与点',          // jieqi buildJieQiAstroLightSection withHeaders=true 死分支(唯一调用传 false,已标记)
			// 释义附录块族(全角守卫扩面后新入):buildQimenMeaningLines/buildLiurengMeaningLines/
			// buildMeaningLinesForAspects 产出,拼在 applyUserSectionFilter 之后、由「占星注释」开关控制,
			// 按设计不进 preset(登了反而变成假可勾段)。
			'十天干释义', '八门释义', '九星释义', '八神释义',   // 奇门释义附录
			'十二神释义', '天将释义',                           // 六壬释义附录
			'相位释义',                                         // 占星相位释义附录
		]);
		const norm = (t)=>{
			if(/^座运·/.test(t)){ return '座运·X'; }
			if(/^专题深化·/.test(t)){ return '专题深化·X'; }
			return normTitle(t);
		};
		const offenders = [];
		// 半角 [X] 与全角 【X】 双 regex:parseSectionTitleLine 两种都认作段头(统摄法/一掌经全用全角),
		// 守卫只扫半角=全角族可无声漏登(独立复核咬出的盲区)。
		const res = [
			/(?:push\(|= ?)['`]\[([^[\]$'`]{2,30})\]['`]/g,
			/(?:push\(|= ?)['`]【([^【】$'`]{2,30})】['`]/g,
		];
		files.forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			res.forEach((re)=>{
				let m;
				re.lastIndex = 0;
				while((m = re.exec(src))){
					const n = norm(m[1]);
					if(!n || n.includes('object')){ continue; } // 模板拼接噪声(如 '['+obj+']')
					if(!allPreset.has(n) && !WHITELIST.has(n)){
						offenders.push(`${n}  <-  ${path.relative(root, f)}`);
					}
				}
			});
		});
		expect(Array.from(new Set(offenders)).sort()).toEqual([]);
	});
});

// ---- AI 挂载 round-trip 哨兵:大六壬多流派入参(涉害取舍/年神/旺衰系)从 schema → payload → regenerate 全程透传 ----
// 坑:LIURENG_FIELDS(techniqueMountSettings)已暴露 seHaiMethod/seHaiBoundary/shiRuKe/yearShenShaSort/yinyangSystem/
// tuWangShuai 这 6 项、LiuRengMain.clickSaveCase 也存进 payload 顶层、buildLiuRengSnapshotText 据 _castOpts 据此切「涉害取舍/
// 年神/三传旺衰/旬空旺衰」正文行——但 aiAnalysisContext 的两处 castOpts/liurengOpts 重提取曾漏枚举 → 齿轮调或存档选的设置在
// 挂载快照里被静默丢、回退默认(与独立页不符)。源扫这两处 forwarding 区域,断言 6 键全在(防再次漏接)。
describe('AI 挂载 round-trip 哨兵:大六壬多流派入参透传(涉害/年神/旺衰)', ()=>{
	// 这 6 键全在 LIURENG_FIELDS(techniqueMountSettings)schema + LiuRengMain.clickSaveCase payload;buildLiuRengSnapshotText
	// 据 _castOpts 据此(seHai*/shiRuKe/yearShenShaSort/tuWangShuai 直读;yinyangSystem 经 buildLiuRengCastOverride(chartObj,_castOpts))
	// 切「涉害取舍/年神/三传旺衰/旬空旺衰/昼夜归属」正文。aiAnalysisContext 两处重提取须全转发,否则齿轮/存档选的设置在挂载里被静默丢。
	const LIURENG_CAST_SCHOOL_KEYS = ['seHaiMethod', 'seHaiBoundary', 'shiRuKe', 'yearShenShaSort', 'yinyangSystem', 'tuWangShuai'];
	test('regenerateLiurengSnapshot 的 castOpts 转发全部 6 键(o.<key>)', ()=>{
		const src = readSrc('../aiAnalysisContext.js');
		const region = sliceFrom(src, 'async function regenerateLiurengSnapshot', 1400);
		LIURENG_CAST_SCHOOL_KEYS.forEach((k)=>{
			expect(region.indexOf(`${k}: o.${k}`)).toBeGreaterThanOrEqual(0);
		});
	});
	test('regenerateCaseTechniqueSnapshot 的 liurengOpts 转发全部 6 键(p.<key>)', ()=>{
		const src = readSrc('../aiAnalysisContext.js');
		const region = sliceFrom(src, 'const liurengOpts = {', 900);
		LIURENG_CAST_SCHOOL_KEYS.forEach((k)=>{
			expect(region.indexOf(`${k}: p.${k}`)).toBeGreaterThanOrEqual(0);
		});
	});
});

// ---- 命盘储存 round-trip 哨兵:buildLocalChartRecord 枚举紫微传本/八字流派 等设置(present 才落、缺省 undefined) ----
// 坑:紫微/八字 据 record.<key> 重算供快照,且 techniqueMountSettings 暴露为
// 「每技法设置」可调项,但 buildLocalChartRecord 曾漏枚举 → 存盘即丢、重开/挂载回退默认(同印占 4 键/termsVariant 旧坑)。
describe('命盘储存 round-trip 哨兵:紫微传本/八字流派落库(缺省 undefined=零回归)', ()=>{
	// 延迟 require,避免与上方 import 顺序耦合(localcharts 纯 util,无副作用)。
	const { buildLocalChartRecord } = require('../localcharts');
	const ZIWEI_TRADITION_KEYS = ['sihuaSchool', 'daxianSpan', 'tianmaBasis', 'starSet', 'sanPan', 'shangShi', 'leapMonth', 'lateZi', 'yearBoundary', 'huoling', 'kongNaming'];
	test('提供值即落库(紫微 11 传本键 + 八字 school)', ()=>{
		const rec = buildLocalChartRecord({
			sihuaSchool: 'zhongzhou', daxianSpan: 5, tianmaBasis: 'year', starSet: 'full', sanPan: 'tian',
			shangShi: 'book', leapMonth: 'split', lateZi: 'next', yearBoundary: 'lichun', huoling: 'nanpai', kongNaming: 'book',
			school: 'mangpai',
		});
		ZIWEI_TRADITION_KEYS.forEach((k)=>{ expect(rec[k]).not.toBeUndefined(); });
		expect(rec.school).toBe('mangpai');
	});
	test('缺省 → 全部 undefined(不破坏既有命盘、缺键后端/builder 回退默认=零回归)', ()=>{
		const rec = buildLocalChartRecord({});
		[...ZIWEI_TRADITION_KEYS, 'school'].forEach((k)=>{
			expect(rec[k]).toBeUndefined();
		});
	});
});

// ---- 段头卫生:段头字面量必须独占一行(行内不得带正文),否则 parseSectionTitleLine 认不出 → 整段挂到上一段 ----
describe('AI 导出 roundtrip 哨兵:段头卫生(段头字面量独占一行)', ()=>{
	const FILES = [
		'../../components/cntradition/BaZi.js',
		'../../components/guazhan/GuaZhanMain.js',
		'../../components/mundane/MundaneMain.js',
		'../../components/jinkou/JinKouMain.js',
		'../../components/dunjia/DunJiaCalc.js',
		'../../components/sanshi/SanShiUnitedMain.js',
	];
	test('各 builder 文件无「[段头] + 同行正文」反模式(如 [地区盘推运] 盘龄…)', ()=>{
		const offenders = [];
		// 中文段头字面量后紧跟(空格/制表/全角空格)+ 正文 → 段头行内带文字 → 反模式。
		// 仅认真正段头:内容含中文、不含 ${...}(动态拼接段头非反模式)、非英文日志前缀(如 [SanShiUnited])。
		const re = /(['"`])\[([^\]\n'"`]+)\]([ \t　]+\S[^\n'"`]*)/g;
		FILES.forEach((rel)=>{
			const src = readSrc(rel);
			let m;
			while((m = re.exec(src))){
				const content = m[2];
				if(content.indexOf('${') >= 0){ continue; }
				if(!/[一-鿿]/.test(content)){ continue; }
				offenders.push(`${rel}: …${src.slice(Math.max(0, m.index), m.index + 30).replace(/\n/g, ' ')}…`);
			}
		});
		expect(offenders).toEqual([]);
	});
});
