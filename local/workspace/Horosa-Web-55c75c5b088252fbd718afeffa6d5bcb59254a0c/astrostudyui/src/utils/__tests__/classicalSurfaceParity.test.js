// [SURF 战役 2026-08-19] 星盘设置「右栏消费链+全站宿主构参」表面一致性合同。
// 背景:第六轮压测证活的是引擎端点,用户实测抓出「右栏表/盘面徽/全站断链宿主」三层表面断裂:
//   ①Java AstroExtraController 白名单丢古典键(B 链全死) ②Python analyze_chart 未进临界区+
//   行星时表双实现分裂 ③前端行星状态盘硬编码阈值+never 键消费组件无事件监听
//   ④盘面增强(角宫下标取宫/RAMC NaN 判据) ⑤折线/量化盘/主限等 8 组构参零古典键。
// 本合同把五层修复全部机械锚死:回潮即红。判据=源码文本锚(与 preflight [SURF] 段同判据)。
import fs from 'fs';
import path from 'path';
import { CLASSICAL_PARAM_SPEC } from '../classicalParamSpec';

const UI_ROOT = path.resolve(__dirname, '..', '..');
const REPO_WEB = path.resolve(UI_ROOT, '..', '..');
const read = (rel) => fs.readFileSync(path.resolve(UI_ROOT, rel), 'utf8');
const readRepo = (rel) => fs.readFileSync(path.resolve(REPO_WEB, rel), 'utf8');

describe('① Java analysis 白名单 ⊇ spec send:nonDefault 全集(丢键=右栏 B 链全死)', ()=>{
	it('AstroExtraController.OPTIONAL_KEYS 含每个 send:nonDefault 键的 backendKey', ()=>{
		const src = readRepo('astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java');
		const m = src.match(/OPTIONAL_KEYS = new String\[\] \{([\s\S]*?)\};/);
		expect(m).toBeTruthy();
		const listed = new Set((m[1].match(/"([^"]+)"/g) || []).map((s)=>s.slice(1, -1)));
		const missing = CLASSICAL_PARAM_SPEC
			.filter((d)=>d.send === 'nonDefault')
			.map((d)=>d.backendKey || d.key)
			.filter((k)=>!listed.has(k));
		expect(missing).toEqual([]);
	});
	it('getAstroExtraAnalysis 带 _v 代次盐(白名单扩键后旧 paramhash 缓存必须整体失效)', ()=>{
		const src = readRepo('astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/AstroHelper.java');
		const seg = src.slice(src.indexOf('getAstroExtraAnalysis'));
		expect(seg.slice(0, 400).includes('params.put("_v"')).toBe(true);
	});
});

describe('② Python analysis 临界区+行星时三档(第二实现分裂已收口)', ()=>{
	const py = readRepo('astropy/astrostudy/astroextra.py');
	it('analyze_chart 进 push/pop_classical_request 临界区(否则 almuten/逐题主星恒默认表)', ()=>{
		const seg = py.slice(py.indexOf('def analyze_chart(data):'), py.indexOf('def analyze_chart(data):') + 900);
		expect(seg.includes('push_classical_request(')).toBe(true);
		expect(seg.includes('pop_classical_request(')).toBe(true);
	});
	it('compute_planetary_hours 读 planetaryHourMethod 三档并回显 hourMode(旧版硬写死不等时)', ()=>{
		const seg = py.slice(py.indexOf('def compute_planetary_hours(params):'));
		expect(seg.slice(0, 5000).includes("params.get('planetaryHourMethod')")).toBe(true);
		expect(seg.slice(0, 5000).includes("'hourMode': hour_mode")).toBe(true);
		expect(seg.slice(0, 5000).includes("== 'equal24'")).toBe(true);
		expect(seg.slice(0, 5000).includes("== 'unequal'")).toBe(true);
	});
});

describe('③ 全站断链宿主构参接单源(默认态零新键=零回归;非默认即透传)', ()=>{
	const SPREAD_SITES = [
		// [量化盘四副本+库盘人]
		['components/germany/AstroMidpoint.js', 1],
		['components/germany/UranianDialMain.js', 2],
		['components/germany/UranianHouseFrames.js', 1],
		// UranianGraphicEphemeris 已回滚出 spread 名单([SURF-R3g]:唯一去处 /astroextra/ephemeris
		// 图形星历腿零消费=死 spread;豁免注记锚在⑥段看守,防再误接)。
		// [巴比伦]
		['utils/babylonAiSnapshot.js', 1],
		// [骰子盘]
		['components/dice/DiceMain.js', 1],
		// [主限法两构参]
		['components/direction/AstroDirectMain.js', 1],
		['components/astro/AstroPrimaryDirectionChart.js', 1],
	];
	SPREAD_SITES.forEach(([rel, minCount])=>{
		it(`${rel} 含 ≥${minCount} 处 classicalBackendOverrides 单源 spread`, ()=>{
			// 个别构参域文件不随所有发行形态存在——缺文件即跳过(存在则必须达标)。
			if(!fs.existsSync(path.resolve(UI_ROOT, rel))){ return; }
			const src = read(rel);
			const n = (src.match(/classicalBackendOverrides(FromFields|FromPlain)?\(/g) || []).length;
			expect(n).toBeGreaterThanOrEqual(minCount);
		});
	});
	it('豁免宿主注记存在(接了后端不消费=制造新死链,豁免必须留案可查)', ()=>{
		// ACG:页面自有 nodeType/lilithType 等档全覆盖线口径;3D 多中心:纯几何端点零古典消费;
		// aiExport [古典格局]:reqBody spread params=回显全带(实核已活)。
		const acg = read('components/acg/AstroAcg.js');
		expect(acg.includes('nodeType')).toBe(true);
		const exp = read('utils/aiExport.js');
		expect(exp.includes("const reqBody = { _v: 'cls1', ...params,")).toBe(true);
	});
	it('analysis 前端请求体四处带缓存代次盐(升级后 L1/L2/L3 旧响应整体失效)', ()=>{
		['components/astro/AstroAnalysisLab.js', 'components/astro/AstroEgypt.js', 'utils/aiExport.js', 'utils/aiAnalysisContext.js'].forEach((rel)=>{
			expect(read(rel).includes("_v: 'cls1'")).toBe(true);
		});
	});
});

describe('④ 前端 C 链:行星状态盘阈值随设置+never 键消费组件监听', ()=>{
	it('AstroLifespan buildFacts 带太阳三态 opts(硬编码 17′/8.5°/17° 已废)', ()=>{
		const src = read('components/astro/AstroLifespan.js');
		expect(src.includes('solarOrbOpts')).toBe(true);
		expect(src.match(/buildFacts\(ensureMaps\(chartObj\), this\.solarOrbOpts\(chartObj\)\)/)).toBeTruthy();
	});
	it('astroAiSnapshot 寿命段 buildFacts 同带 opts(快照与页面同口径)', ()=>{
		const src = read('utils/astroAiSnapshot.js');
		const seg = src.slice(src.indexOf('function buildLifespanSection'), src.indexOf('function buildLifespanSection') + 1200);
		expect(seg.includes('cazimiOrb: _pick(')).toBe(true);
	});
	['components/astro/AstroInfo.js', 'components/astro/AstroLifespan.js', 'components/astro/AstroEminence.js'].forEach((rel)=>{
		it(`${rel} 监听 CLASSICAL_GLOBALS_EVENT(never 键改档即时重渲)`, ()=>{
			const src = read(rel);
			expect(src.includes('CLASSICAL_GLOBALS_EVENT')).toBe(true);
			expect(src.includes('addEventListener(CLASSICAL_GLOBALS_EVENT')).toBe(true);
			expect(src.includes('removeEventListener(CLASSICAL_GLOBALS_EVENT')).toBe(true);
		});
	});
	it('AstroAnalysisLab failedKey 泊车带 30s 过期(一次 500 不再永卡)', ()=>{
		const src = read('components/astro/AstroAnalysisLab.js');
		expect(src.includes('_failedAt')).toBe(true);
		expect(src.includes('30000')).toBe(true);
	});
});

describe('⑤ [SURF-T1] 推运组件古典键增量 merge 粘滞根除', ()=>{
	// 病理:hook/didUpdate 的 {...state.params, ...fresh} 增量 merge 下,send:nonDefault 键
	// 改回默认后 fresh 不再携带,旧非默认值被 merge 永久保留 → 请求持续发已废档
	// (返照法拨回「精确回归」后仍按希腊式取盘;真机 fiber 三证)。修法=pruneStaleClassicalParams。
	it('classicalChartGlobals 导出 pruneStaleClassicalParams(spec 键 fresh 缺席即删)', ()=>{
		const src = read('utils/classicalChartGlobals.js');
		expect(src.includes('export function pruneStaleClassicalParams')).toBe(true);
		expect(src.match(/pruneStaleClassicalParams[\s\S]{0,600}CLASSICAL_PARAM_SPEC\.forEach/)).toBeTruthy();
	});
	[
		'components/astro/AstroSolarReturn.js',
		'components/astro/AstroLunarReturn.js',
		'components/astro/AstroGivenYear.js',
		'components/astro/AstroSolarArc.js',
		'components/astro/AstroProfection.js',
		'components/astro/AstroZR.js',
		'components/astro/AstroPersianDirected.js',
		'components/astro/AstroPlanetaryArc.js',
	].forEach((rel)=>{
		it(`${rel} 增量 merge 处调用 pruneStaleClassicalParams`, ()=>{
			const src = read(rel);
			expect(src.includes('pruneStaleClassicalParams(')).toBe(true);
		});
	});
	// [SURF-T2] 星历页食时刻口径为纯全局键:改档不触发组件更新,须监听全局事件补重拉。
	it('AstroEphemeris 监听 CLASSICAL_GLOBALS_EVENT(食时刻改档即重拉)', ()=>{
		const src = read('components/astro/AstroEphemeris.js');
		expect(src.includes('addEventListener(CLASSICAL_GLOBALS_EVENT')).toBe(true);
		expect(src.includes('removeEventListener(CLASSICAL_GLOBALS_EVENT')).toBe(true);
	});
	// [SURF-T3] 择日判读页 render 现取双 store 全局键(peregrineScore/judge 键)但改档零重渲。
	it('ElectionJudgment 双事件监听(classical+judge 仓改档即重渲)', ()=>{
		const src = read('components/election/ElectionJudgment.js');
		expect(src.includes('addEventListener(CLASSICAL_GLOBALS_EVENT')).toBe(true);
		expect(src.includes('addEventListener(DIVINATION_JUDGE_EVENT')).toBe(true);
		expect(src.includes('removeEventListener(DIVINATION_JUDGE_EVENT')).toBe(true);
	});
});

describe('⑥ [SURF-R] 第二轮全面审查修复的机械看守', ()=>{
	it('事盘设置键三方单源:保存/页面还原/AI 挂载共用 DIVINATION_CASE_SETTING_KEYS', ()=>{
		const save = read('utils/divinationCaseSave.js');
		expect(save.includes('export const DIVINATION_CASE_SETTING_KEYS')).toBe(true);
		expect(save.includes('DIVINATION_CASE_SETTING_KEYS.forEach')).toBe(true);
		const ctx = read('utils/aiAnalysisContext.js');
		expect(ctx.includes("import { DIVINATION_CASE_SETTING_KEYS } from './divinationCaseSave'")).toBe(true);
		expect(ctx.match(/DIVINATION_SETTINGS_KEYS = \['zodiacal', 'siderealAyanamsa', 'hsys', 'tradition',\s*\n\s*\.\.\.DIVINATION_CASE_SETTING_KEYS\]/)).toBeTruthy();
		const shell = read('components/divination/DivinationChartShell.js');
		expect(shell.includes("import { DIVINATION_CASE_SETTING_KEYS } from '../../utils/divinationCaseSave'")).toBe(true);
		expect(shell.includes('DIVINATION_CASE_SETTING_KEYS.forEach')).toBe(true);
		expect(shell.includes('patch.siderealAyanamsa = settings.siderealAyanamsa')).toBe(true);
	});
	it('事盘设置常量 = spec send:nonDefault 全集 + 表体/历元伴生四键(机械全等,防再漂)', ()=>{
		jest.resetModules();
		const { DIVINATION_CASE_SETTING_KEYS } = require('../divinationCaseSave');
		const { CLASSICAL_PARAM_SPEC } = require('../classicalParamSpec');
		const specKeys = CLASSICAL_PARAM_SPEC.filter((s)=> s.send === 'nonDefault').map((s)=> s.key);
		const expected = new Set([...specKeys, 'customTermsDay', 'customTermsNight', 'userAyanT0', 'userAyanDeg']);
		expect(new Set(DIVINATION_CASE_SETTING_KEYS)).toEqual(expected);
	});
	it('主限页显式界系胜出:spread 产物 delete termsVariant(fields 值不得覆盖 desired)', ()=>{
		const src = read('components/direction/AstroDirectMain.js');
		expect(src.match(/const cls = classicalBackendOverridesFromFields\(nextFields \|\| \{\}\);\s*\n\s*delete cls\.termsVariant;/)).toBeTruthy();
	});
	it('缓存代次盐前后端同值(cls1 两层字面量全等)', ()=>{
		const fe = read('components/astro/AstroAnalysisLab.js');
		const feSalt = (fe.match(/_v:\s*'([^']+)'/) || [])[1];
		const javaPath = path.join(UI_ROOT, '../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/AstroHelper.java');
		if(!fs.existsSync(javaPath)){ return; }
		const java = fs.readFileSync(javaPath, 'utf8');
		const jSalt = (java.match(/params\.put\("_v",\s*"([^"]+)"\)/) || [])[1];
		expect(feSalt).toBeTruthy();
		expect(jSalt).toBe(feSalt);
	});
	it('germany 中点腿古典键透传在位(Java classicalKeys 段 + Python midpoint 临界区)', ()=>{
		const javaPath = path.join(UI_ROOT, '../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/GermanyTechController.java');
		if(fs.existsSync(javaPath)){
			const java = fs.readFileSync(javaPath, 'utf8');
			expect(java.includes('classicalKeys')).toBe(true);
			expect(java.includes('"termsVariant"')).toBe(true);
		}
		const pyPath = path.join(UI_ROOT, '../astropy/websrv/webgermanysrv.py');
		if(fs.existsSync(pyPath)){
			const py = fs.readFileSync(pyPath, 'utf8');
			expect(py.includes('push_classical_request(data)')).toBe(true);
			expect(py.includes('pop_classical_request(_cls_tokens)')).toBe(true);
		}
	});
	it('图形星历有意不带古典键(端点零消费豁免注记在位,防再误接)', ()=>{
		const src = read('components/germany/UranianGraphicEphemeris.js');
		expect(src.includes('[SURF-R3g]')).toBe(true);
		expect(src.includes('...classicalBackendOverridesFromFields')).toBe(false);
	});
	it('行星时渲染按 diurnal 真值分组(index-12 假标签已废),快照同口径', ()=>{
		const lab = read('components/astro/AstroAnalysisLab.js');
		expect(lab.includes('rows.filter((h)=> h.diurnal)')).toBe(true);
		expect(lab.match(/h\.diurnal \? h\.index : h\.index - 12/)).toBeFalsy();
		const snap = read('utils/astroAiSnapshot.js');
		expect(snap.match(/h\.index - 12\)\}/)).toBeFalsy();
		expect(snap.includes('行星时制式')).toBe(true);
	});
	it('RAMC 恒星制回落不显(伪 ra 不上屏)', ()=>{
		const src = read('components/astro/AstroChartCircle.js');
		expect(src.match(/const h10 = _sid \? null : this\.getHouse\(chartObj, AstroConst\.HOUSE10\)/)).toBeTruthy();
	});
	it('classicalBackendOverrides 双名回退(回显形 plain 的 starOrb 两键不再失明)', ()=>{
		const src = read('utils/classicalChartGlobals.js');
		expect(src.includes('raw = getVal(s.backendKey)')).toBe(true);
	});
	it('pruneStaleClassicalParams 连删表体伴生键', ()=>{
		const src = read('utils/classicalChartGlobals.js');
		expect(src.match(/\['customTermsDay', 'customTermsNight'\]\.forEach/)).toBeTruthy();
	});
});

describe('⑦ [SURF-R5] 第三轮审查修复的机械看守(竞态代际/恢复自愈/user 岁差全链)', ()=>{
	it('user 岁差三元段:natalClassicalParams/AI 推运构参/ZR 无头 builder/germany 构参四处在位', ()=>{
		expect(read('components/astro/AstroExtraCommon.js').match(/natalClassicalParams[\s\S]{0,700}userAyanParamsFrom/)).toBeTruthy();
		expect(read('utils/aiAnalysisContext.js').includes('[SURF-R5ai]')).toBe(true);
		const zr = read('components/astro/AstroZR.js');
		expect(zr.match(/zodiacal: qp\.zodiacal[\s\S]{0,400}\.\.\.natalClassicalParams\(qp\)/)).toBeTruthy();
		expect(read('components/germany/AstroMidpoint.js').includes('userAyanParamsFrom')).toBe(true);
		expect(read('components/zeri/TianxingElectionMain.js').includes("siderealAyanamsa: cfg.siderealAyanamsa })")).toBe(true);
	});
	it('pd 表行响应代际+同代基座(乱序不再把旧盘 dispatch 回全局)', ()=>{
		const src = read('components/astro/AstroPrimaryDirectionChart.js');
		const seg = src.slice(src.indexOf('async requestChartRefresh'), src.indexOf('async requestChartRefresh') + 3000);
		expect(seg.includes('const seq = ++this.requestSeq')).toBe(true);
		expect(seg.includes('seq !== this.requestSeq')).toBe(true);
		expect(seg.includes('const liveChart = this.props.value')).toBe(true);
	});
	['AstroSolarReturn', 'AstroLunarReturn', 'AstroGivenYear', 'AstroSolarArc', 'AstroProfection'].forEach((f)=>{
		it(`${f} requestDirection 代际+请求时捕获 chartValue(快照与响应同代)`, ()=>{
			const src = read(`components/astro/${f}.js`);
			expect(src.includes('this._reqSeq')).toBe(true);
			expect(src.includes('chartValueAtRequest')).toBe(true);
		});
	});
	it('ZR 深取/Dice 连掷/Midpoint 各自代际在位', ()=>{
		expect(read('components/astro/AstroZR.js').includes('this._zrSeq')).toBe(true);
		expect(read('components/dice/DiceMain.js').includes('this._diceSeq')).toBe(true);
		expect(read('components/germany/AstroMidpoint.js').includes('this._mpSeq')).toBe(true);
	});
	it('两全局仓读侧自愈(备份恢复直写后不再热 cache 旧值/整包回写覆盖)', ()=>{
		['utils/classicalChartGlobals.js', 'utils/divinationJudgeGlobals.js'].forEach((rel)=>{
			const src = read(rel);
			expect(src.includes('rawSelfHealCheck')).toBe(true);
			expect(src.includes('cacheRawStr')).toBe(true);
		});
		expect(read('components/user/ChartList.js').includes('window.location.reload')).toBe(true);
	});
	it('主限页选自定义界(4)而 fields≠4:随盘/编辑器仓补表,无表降级不发 4', ()=>{
		const src = read('components/direction/AstroDirectMain.js');
		expect(src.includes('[SURF-R5a]')).toBe(true);
		expect(src.match(/else if\(!cls\.customTermsDay\)\{/)).toBeTruthy();
		expect(src.includes('cls.termsVariant = 0')).toBe(true);
	});
	it('帮助文档 RAMC 行与恒星制回落实现一致(不再宣称恒星可显)', ()=>{
		const src = read('components/help/AstroHelpDoc.js');
		expect(src.includes('恒星黄道同样可显')).toBe(false);
		expect(src.includes('恒星黄道制暂不显示')).toBe(true);
	});
});
