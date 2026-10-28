// 合同:计算层 / 工具层不依赖界面简繁(显示层档位)。
// 病形:计算引擎、助手工具里调了显示层的比对(scriptMode.matchesUserQuery 一类)——同一套参数 / 同一条工具调用,
//   结果随用户此刻的界面简繁档位变(无头与 Worker 里显示层恒为简体,桌面繁体界面另一个结果)。
// 规则:① 计算层(utils 下名字带 Engine 的引擎件、src/divination/**)与工具层(utils/aiTools/**)不许导入 scriptMode,
//   也不许绕过它直接导入 scriptConvert 的比对算法 / 转换器(scriptMatch / hantConverter / hantRules);
//   需要繁简都认的比对经 scriptNeutralMatch(只用 anyScript 档 = 与界面档位无关,不另写算法);
//   ② 远端检索写法的两处直调方(名人库 utils/astrodata/**、玄史 services/xuanshi.js)只许从 scriptMode 取
//   与界面档位无关的两件(ensureScriptConverter / scriptQueryVariants),且每次调 scriptQueryVariants 都带 anyScript: true;
//   ③ 全 src 里只有 scriptMode 与 scriptConvert 自身导入 scriptConvert 的算法件(其余一律经 scriptMode / scriptNeutralMatch);
//   ④ 同一份档案、同一个查询词,list_records 在简体界面、繁体界面给出同一结果。
import fs from 'fs';
import path from 'path';
import { upsertLocalChart } from '../localcharts';
import listRecords from '../aiTools/tools/listRecords';
import { applyScriptMode, SCRIPT_HANT, SCRIPT_HANS, __resetScriptModeForTest, __setConverterForTest } from '../scriptMode';
import { containsNeutral } from '../scriptNeutralMatch';

const SRC = path.join(__dirname, '../..');
function walk(dir, out){
	if(!fs.existsSync(dir)){ return out; }
	fs.readdirSync(dir).forEach((n)=>{
		const p = path.join(dir, n);
		if(fs.statSync(p).isDirectory()){ if(n !== '__tests__' && n !== 'node_modules'){ walk(p, out); } }
		else if(/\.js$/.test(n)){ out.push(p); }
	});
	return out;
}
const IMPORT_HEAD = String.raw`(?:from\s*|require\(\s*|import\(\s*)['"][./]*(?:utils\/)?`;
const IMPORTS_SCRIPT_MODE = new RegExp(`${IMPORT_HEAD}scriptMode['"]`);
const IMPORTS_SCRIPT_CONVERT = new RegExp(`${IMPORT_HEAD}(?:scriptConvert\/)?(?:scriptMatch|hantConverter|hantRules)(?:\.js)?['"]`);
const IMPORTS_SCRIPT_LAYER = new RegExp(`${IMPORTS_SCRIPT_MODE.source}|${IMPORTS_SCRIPT_CONVERT.source}`);
// 远端检索写法的直调方(不对着屏幕检索):只许取这两件,且 scriptQueryVariants 恒带 anyScript: true
const REMOTE_VARIANT_CALLERS = ['utils/astrodata', 'services/xuanshi.js'];
const REMOTE_ALLOWED = ['ensureScriptConverter', 'scriptQueryVariants'];

describe('导入边界', ()=>{
	test('计算层 / 工具层不导入 scriptMode', ()=>{
		const files = [];
		fs.readdirSync(path.join(SRC, 'utils')).filter((n)=>/Engine.*\.js$/.test(n)).forEach((n)=>files.push(path.join(SRC, 'utils', n)));
		walk(path.join(SRC, 'divination'), files);
		walk(path.join(SRC, 'utils/aiTools'), files);
		expect(files.length).toBeGreaterThan(20);
		const bad = files.filter((f)=>IMPORTS_SCRIPT_LAYER.test(fs.readFileSync(f, 'utf8'))).map((f)=>path.relative(SRC, f));
		expect(bad).toEqual([]);
	});
	test('远端检索写法的直调方只取与界面档位无关的两件,scriptQueryVariants 恒带 anyScript', ()=>{
		const files = [];
		REMOTE_VARIANT_CALLERS.forEach((rel)=>{
			const p = path.join(SRC, rel);
			if(/\.js$/.test(rel)){ files.push(p); }else{ walk(p, files); }
		});
		expect(files.length).toBeGreaterThanOrEqual(2);
		const bad = [];
		let calls = 0;
		files.forEach((f)=>{
			const rel = path.relative(SRC, f);
			const src = fs.readFileSync(f, 'utf8');
			if(IMPORTS_SCRIPT_CONVERT.test(src)){ bad.push(`${rel}: 直接导入 scriptConvert 算法件`); }
			const re = /import\s*\{([^}]*)\}\s*from\s*['"][./]*(?:utils\/)?scriptMode['"]/g;
			let m;
			while((m = re.exec(src))){
				m[1].split(',').map((x)=>x.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach((name)=>{
					if(REMOTE_ALLOWED.indexOf(name) < 0){ bad.push(`${rel}: 从 scriptMode 取了 ${name}(随界面档位变)`); }
				});
			}
			if(/import\s+\*\s+as\s+\w+\s+from\s*['"][./]*(?:utils\/)?scriptMode['"]|require\(\s*['"][./]*(?:utils\/)?scriptMode['"]/.test(src)){ bad.push(`${rel}: 整体导入 scriptMode`); }
			const cre = /scriptQueryVariants\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
			while((m = cre.exec(src))){
				calls += 1;
				if(!/anyScript:\s*true/.test(m[1])){ bad.push(`${rel}: scriptQueryVariants(${m[1]}) 没带 anyScript: true`); }
			}
		});
		expect(calls).toBeGreaterThanOrEqual(2);
		expect(bad).toEqual([]);
	});
	test('全 src 只有 scriptMode 与 scriptConvert 自身导入 scriptConvert 的算法件', ()=>{
		const files = walk(SRC, []).filter((f)=>!/\.umi/.test(f));
		const own = (f)=>f === path.join(SRC, 'utils/scriptMode.js') || f.indexOf(path.join(SRC, 'utils/scriptConvert') + path.sep) === 0;
		const bad = files.filter((f)=>!own(f) && IMPORTS_SCRIPT_CONVERT.test(fs.readFileSync(f, 'utf8'))).map((f)=>path.relative(SRC, f));
		expect(bad).toEqual([]);
	});
	test('判别力:正则认得出各种导入写法', ()=>{
		["import { matchesUserQuery } from './scriptMode';", "import { x } from '../../utils/scriptMode';", "const s = require('../scriptMode');"].forEach((line)=>{
			expect(IMPORTS_SCRIPT_MODE.test(line)).toBe(true);
			expect(IMPORTS_SCRIPT_LAYER.test(line)).toBe(true);
		});
		["import { matchAcrossScripts } from '../scriptConvert/scriptMatch';", "import * as h from './scriptConvert/hantConverter';",
			"const m = require('../../utils/scriptConvert/scriptMatch.js');", "const c = import('./scriptConvert/hantConverter');", "import { applyHantDomainRules } from './hantRules';"].forEach((line)=>{
			expect([line, IMPORTS_SCRIPT_CONVERT.test(line)]).toEqual([line, true]);
			expect(IMPORTS_SCRIPT_LAYER.test(line)).toBe(true);
		});
		expect(IMPORTS_SCRIPT_LAYER.test("import { containsNeutral } from './scriptNeutralMatch';")).toBe(false);
	});
});

// AI 内容构建层(挂载快照 / AI 导出 等):喂给模型、写进导出物的内容不随界面简繁档位变。
// 只许从 scriptMode 取与档位无关的几件:读原文(readOriginalText)、导出期原文持有(withOriginalScript)、原样显示区类名(SCRIPT_KEEP_CLASS);
// 不许取检索比对 / 档位读数(matchesUserQuery / isHantActive / currentScriptMode …),也不许直接导入 scriptConvert 的算法件。
const AI_CONTENT_ALLOWED = ['readOriginalText', 'withOriginalScript', 'SCRIPT_KEEP_CLASS'];
function aiContentLayerFiles(){
	const files = [];
	walk(path.join(SRC, 'utils/aiAnalysisContext'), files);
	walk(path.join(SRC, 'utils/aiExport'), files);
	['utils/aiAnalysisContext.js', 'utils/aiExport.js'].forEach((rel)=>files.push(path.join(SRC, rel)));
	fs.readdirSync(path.join(SRC, 'utils')).filter((n)=>/^report.*\.js$/.test(n)).forEach((n)=>files.push(path.join(SRC, 'utils', n)));
	return files.filter((f)=>fs.existsSync(f));
}
function aiContentViolations(rel, src){
	const bad = [];
	if(IMPORTS_SCRIPT_CONVERT.test(src)){ bad.push(`${rel}: 直接导入 scriptConvert 算法件`); }
	if(/import\s+\*\s+as\s+\w+\s+from\s*['"][./]*(?:utils\/)?scriptMode['"]|require\(\s*['"][./]*(?:utils\/)?scriptMode['"]|import\(\s*['"][./]*(?:utils\/)?scriptMode['"]/.test(src)){ bad.push(`${rel}: 整体导入 scriptMode`); }
	const re = /import\s*\{([^}]*)\}\s*from\s*['"][./]*(?:utils\/)?scriptMode['"]/g;
	let m;
	while((m = re.exec(src))){
		m[1].split(',').map((x)=>x.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach((name)=>{
			if(AI_CONTENT_ALLOWED.indexOf(name) < 0){ bad.push(`${rel}: 从 scriptMode 取了 ${name}(随界面档位变)`); }
		});
	}
	return bad;
}
// 工具层的文本检索 / 去重一律经 scriptNeutralMatch(繁简都认、与界面档位无关;与 list_records 同一 anyScript 口径):
// aiTools/** 里不许对检索词直接写 .indexOf(q / .includes(q / .toLowerCase().indexOf( 一类原文比对(登记豁免除外,须写理由)
const TOOL_RAW_MATCH_RE = /\.(?:indexOf|includes|startsWith)\(\s*(?:q|query|kw|keyword|needle|term|args\.query|args\.q)\b|toLowerCase\(\)\.(?:indexOf|includes)\(/;
const TOOL_RAW_MATCH_EXEMPT = {};
describe('工具层检索 / 去重经 scriptNeutralMatch', ()=>{
	test('🔴 aiTools 里没有对检索词的原文比对', ()=>{
		const files = walk(path.join(SRC, 'utils/aiTools'), []);
		const bad = [];
		files.forEach((f)=>{
			const rel = path.relative(SRC, f);
			fs.readFileSync(f, 'utf8').split('\n').forEach((line, i)=>{
				if(/^\s*\/\//.test(line) || !TOOL_RAW_MATCH_RE.test(line)){ return; }
				if(TOOL_RAW_MATCH_EXEMPT[`${rel}:${line.trim()}`]){ return; }
				bad.push(`${rel}:${i + 1}`);
			});
		});
		expect(bad).toEqual([]);
	});
	test('判别力:各写法认得出', ()=>{
		['x.indexOf(q) >= 0', 'hay.toLowerCase().indexOf(term)', 'label.includes(query)', 's.startsWith(kw)'].forEach((l)=>{ expect([l, TOOL_RAW_MATCH_RE.test(l)]).toEqual([l, true]); });
		expect(TOOL_RAW_MATCH_RE.test('containsNeutral(hay, q)')).toBe(false);
	});
	test('🔴 同一个查询词:四处检索 / 去重在简体、繁体界面同一结果,繁体词命中简体档', async ()=>{
		const { rankCandidates } = require('../aiTools/completions');
		const { findDuplicateChart } = require('../aiTools/tools/createChartRecord');
		const MAP = { '张': '張', '丰': '豐' };
		__resetScriptModeForTest();
		__setConverterForTest((s)=>Array.from(`${s}`).map((c)=>MAP[c] || c).join(''), (s)=>`${s}`.replace(/張/g, '张').replace(/豐/g, '丰'));
		window.localStorage.clear();
		upsertLocalChart({ cid: 'nm-1', name: '张三丰', birth: '1990-01-01 12:00:00', zone: '+08:00', lon: '120e00', lat: '30n00', gender: 1 });
		const rows = [{ id: 'nm-1', label: '张三丰' }, { id: 'nm-2', label: '李四' }];
		const out = [];
		for(const mode of [SCRIPT_HANS, SCRIPT_HANT]){
			await applyScriptMode(mode);   // eslint-disable-line no-await-in-loop
			out.push([rankCandidates(rows, '張三').values, !!findDuplicateChart('張三豐', '1990-01-01 12:00:00')]);
		}
		expect(out[0]).toEqual(out[1]);
		expect(out[0]).toEqual([['nm-1'], true]);
		await applyScriptMode(SCRIPT_HANS);
		__resetScriptModeForTest();
	});
});

describe('AI 内容构建层不读界面简繁档位', ()=>{
	test('🔴 AI 内容构建层只取与档位无关的三件', ()=>{
		const files = aiContentLayerFiles();
		expect(files.length).toBeGreaterThan(20);
		const bad = [];
		files.forEach((f)=>{ bad.push(...aiContentViolations(path.relative(SRC, f), fs.readFileSync(f, 'utf8'))); });
		expect(bad).toEqual([]);
	});
	test('判别力:取了比对 / 档位读数、整体导入、直取算法件都判红;三件放行', ()=>{
		expect(aiContentViolations('x', "import { matchesUserQuery } from '../scriptMode';").length).toBe(1);
		expect(aiContentViolations('x', "import { readOriginalText, isHantActive } from './scriptMode';").length).toBe(1);
		expect(aiContentViolations('x', "import * as sm from '../scriptMode';").length).toBe(1);
		expect(aiContentViolations('x', "import { toMatchKey } from './scriptConvert/hantConverter';").length).toBe(1);
		expect(aiContentViolations('x', "import { withOriginalScript, SCRIPT_KEEP_CLASS } from '../scriptMode';\nimport { readOriginalText } from './scriptMode';").length).toBe(0);
	});
});

describe('scriptNeutralMatch:只用与界面档位无关的入口', ()=>{
	test('入口件只从 scriptMode 取与档位无关的几件、繁简比对恒 anyScript,不读界面档位、不另写算法', ()=>{
		const src = fs.readFileSync(path.join(SRC, 'utils/scriptNeutralMatch.js'), 'utf8');
		const imp = (src.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/scriptMode'/) || [])[1] || '';
		expect(imp.split(',').map((x)=>x.trim()).filter(Boolean).sort()).toEqual(['ensureScriptConverter', 'matchesUserQuery', 'scriptMatchIndex', 'scriptMatchKey', 'scriptTextEquals']);
		expect(src).toMatch(/matchesUserQuery\(h, q, \{ ci, anyScript: true \}\)/);
		expect(src).toMatch(/scriptMatchKey\(s, \{ anyScript: true \}\)/);
		expect(src).toMatch(/scriptMatchIndex\(hay, query, \{ ci, anyScript: true \}\)/);
		expect(src).toMatch(/scriptTextEquals\(a, b, \{ ci, anyScript: true \}\)/);
		// 比对调用逐个都带 anyScript: true(改成跟界面档位走即红)
		const codeOnly = src.split('\n').filter((l)=>!/^\s*\/\//.test(l)).join('\n');
		const calls = codeOnly.match(/(?:matchesUserQuery|scriptMatchKey|scriptMatchIndex|scriptTextEquals)\([^)]*\)/g) || [];
		expect(calls.length).toBeGreaterThanOrEqual(4);
		calls.forEach((c)=>{ expect([c, /anyScript: true/.test(c)]).toEqual([c, true]); });
		const code = src.split('\n').filter((l)=>!/^\s*\/\//.test(l)).join('\n');
		expect(code).not.toMatch(/currentScriptMode|isHantActive|toMatchKey|hantConverter/);
	});
	test('raw 档按原文比(计算引擎用)', ()=>{
		expect(containsNeutral('張三', '张三', { raw: true })).toBe(false);
		expect(containsNeutral('张三', '张', { raw: true })).toBe(true);
		expect(containsNeutral('abc', 'B', { raw: true })).toBe(true);
		expect(containsNeutral('abc', 'B', { raw: true, ci: false })).toBe(false);
	});
});

describe('list_records:简体 / 繁体界面同一结果', ()=>{
	const MAP = { '张': '張' };
	const toHant = (s)=>Array.from(`${s}`).map((c)=>MAP[c] || c).join('');
	const toKey = (s)=>`${s}`.replace(/張/g, '张');
	beforeAll(()=>{
		window.localStorage.clear();
		upsertLocalChart({ cid: 'zz-c1', name: '張三', birth: '1990-01-01 12:00:00', zone: '+08:00', lon: '120e00', lat: '30n00', gender: 1 });
	});
	afterAll(()=>{ __resetScriptModeForTest(); });
	test('档案名是繁体、查询词是简体:两种界面都命中', async ()=>{
		__resetScriptModeForTest();
		__setConverterForTest(toHant, toKey);
		await applyScriptMode(SCRIPT_HANS);
		const hans = await listRecords.run({ kind: 'chart', query: '张三' });
		await applyScriptMode(SCRIPT_HANT);
		const hant = await listRecords.run({ kind: 'chart', query: '张三' });
		expect(hans.data.items.map((i)=>i.cid)).toEqual(['zz-c1']);
		expect(hant.data.items.map((i)=>i.cid)).toEqual(hans.data.items.map((i)=>i.cid));
	});
});
