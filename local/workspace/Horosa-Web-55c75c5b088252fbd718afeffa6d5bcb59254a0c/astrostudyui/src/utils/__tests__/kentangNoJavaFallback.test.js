// kentang 技法模块(卜类 / 数算 / 玄史 …)只打本机计算服务,不「失败就改走 ServerRoot 同名路径」:
// Java 后端没有任何 kentang 模块的路由,那一跳只会拿到 404 / 拦截页,还把本机服务回的真实报错(参数错 / 计算错)
// 换成「Unexpected token <」一类解析错。这里锁两件事:① 全部调用方走单源 postKentang 或只打 buildKentangEndpoint;
// ② 源码里没有任何「ServerRoot + kentang 模块路径」的请求地址。另带玄史检索的报错原文与无屏幕检索的简繁归一。
import fs from 'fs';
import path from 'path';

jest.mock('../kentangCache', ()=>({ cachedKentangFetch: jest.fn() }));

import { cachedKentangFetch } from '../kentangCache';
import { KENTANG_SERVICE_CONFIG } from '../../integrations/kentang/serviceRoot';
import { postXuanShi } from '../../services/xuanshi';
import { matchesUserQuery, scriptMatchKey, scriptMatchIndex, scriptTextEquals, applyScriptMode, SCRIPT_HANT, __setConverterForTest, __resetScriptModeForTest } from '../scriptMode';
import * as hantConv from '../scriptConvert/hantConverter';

const SRC = path.join(__dirname, '..', '..');
function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		if(e.name === 'node_modules' || e.name === '__tests__' || e.name.startsWith('.')){ return; }
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ walk(p, out); }else if(/\.jsx?$/.test(e.name)){ out.push(p); }
	});
	return out;
}
const MODULES = Object.keys(KENTANG_SERVICE_CONFIG).map((k)=>KENTANG_SERVICE_CONFIG[k].path || k);
const JAVA_KENTANG_RE = new RegExp(`\\$\\{ServerRoot\\}/(?:${MODULES.join('|')})\\b|\\$\\{ServerRoot\\}/\\$\\{(?:serviceKey|module|moduleKey)\\}`);

function findJavaKentangUrls(files){
	const hits = [];
	files.forEach(([file, code])=>{
		code.split('\n').forEach((line, i)=>{
			if(/^\s*(\/\/|\*)/.test(line)){ return; }
			if(JAVA_KENTANG_RE.test(line)){ hits.push(`${file}:${i + 1}`); }
		});
	});
	return hits;
}

describe('源码里没有「ServerRoot + kentang 模块路径」的请求地址', ()=>{
	test('全仓前端源码零命中', ()=>{
		const files = walk(SRC, []).map((f)=>[path.relative(SRC, f), fs.readFileSync(f, 'utf8')]);
		expect(MODULES.length).toBeGreaterThan(10);
		expect(findJavaKentangUrls(files)).toEqual([]);
	});
	test('判别力:旧写法(失败回落 ServerRoot 同名路径)判红,注释行与 Java 自有路由不算', ()=>{
		expect(findJavaKentangUrls([['a.js', "\t\tconst r = await cachedKentangFetch(`${ServerRoot}/taiyi/pan`, {"]])).toEqual(['a.js:1']);
		expect(findJavaKentangUrls([['b.js', "\t\tconst r = await cachedKentangFetch(`${ServerRoot}/${serviceKey}/pan`, {"]])).toEqual(['b.js:1']);
		expect(findJavaKentangUrls([['c.js', "\t// 以前会改打 `${ServerRoot}/xuanshi/search`"]])).toEqual([]);
		expect(findJavaKentangUrls([['d.js', "\treturn cachedPost(`${ServerRoot}/qizheng/moira`, values);"]])).toEqual([]);
	});
});

describe('玄史检索:本机服务回 {err} 时抛出原文、只发一次', ()=>{
	const resp = (obj)=>({ text: ()=>Promise.resolve(JSON.stringify(obj)) });
	beforeEach(()=>{ cachedKentangFetch.mockReset(); });
	test('{err:"X"} → 错误信息含 X,不再改打 Java', async ()=>{
		cachedKentangFetch.mockResolvedValueOnce(resp({ err: '参数 page_size 不是整数' }));
		await expect(postXuanShi('events', { page_size: 'x' })).rejects.toThrow('参数 page_size 不是整数');
		expect(cachedKentangFetch).toHaveBeenCalledTimes(1);
		expect(cachedKentangFetch.mock.calls[0][0]).toMatch(/\/xuanshi\/events$/);
	});
});

describe('不对着屏幕检索(AI / 无头):anyScript 不看界面简繁也两边归一', ()=>{
	afterEach(()=>{ __resetScriptModeForTest(); __setConverterForTest(null, null); });
	test('界面简体 + anyScript:繁体检索词命中简体文字;不带 anyScript 与原先逐字节相同', ()=>{
		__setConverterForTest(hantConv.toHant, hantConv.toMatchKey, hantConv);   // 真转换器(逐位比对要完整转换器)
		expect(matchesUserQuery('张三丰', '張三豐', { anyScript: true })).toBe(true);
		expect(matchesUserQuery('张三丰', '張三豐')).toBe(false);
		expect(scriptMatchKey('張三豐')).toBe('張三豐');
		expect(scriptMatchKey('張三豐', { anyScript: true })).toBe('张三丰');
		// 放宽只折繁体专用字:「乾」本身也是简体字,不折 → 仍不命中「天干地支」;屏幕检索(不带 anyScript)不放宽
		expect(matchesUserQuery('天干地支', '乾', { anyScript: true })).toBe(false);
		expect(matchesUserQuery('乾卦', '乾', { anyScript: true })).toBe(true);
		expect(matchesUserQuery('天干', '幹')).toBe(false);
	});
	test('anyScript 下三个入口同口径:含 ⇔ 命中位置 ≥ 0,整名相等 ⇒ 含,命中位置落在原文上', ()=>{
		__setConverterForTest(hantConv.toHant, hantConv.toMatchKey, hantConv);
		const HAYS = ['张三丰', '張三豐', '天干地支', '后土', '神后', '乾卦', '歷法与曆書', '钟馗', '鍾馗', 'Abc 张三', '後土'];
		const QS = ['張三豐', '张三丰', '张三', '張三', '幹', '乾', '後', '后', '歷', '历', '鍾', '钟', 'abc', '三', '後土', '后土'];
		const bad = [];
		HAYS.forEach((h)=>QS.forEach((q)=>{
			const m = matchesUserQuery(h, q, { anyScript: true });
			const i = scriptMatchIndex(h, q, { anyScript: true });
			const e = scriptTextEquals(h, q, { anyScript: true });
			if(m !== (i >= 0)){ bad.push(`${h} / ${q}: matches=${m} index=${i}`); }
			if(e && !m){ bad.push(`${h} / ${q}: equals 真而 matches 假`); }
			if(i >= 0 && i + q.length > h.length){ bad.push(`${h} / ${q}: index=${i} 越界`); }
			if(matchesUserQuery(h, q, { anyScript: true, prefix: true }) && i !== 0){ bad.push(`${h} / ${q}: prefix 命中但 index=${i}`); }
		}));
		expect(bad).toEqual([]);
		// 报告里的两例:放宽一档后三个入口一致
		expect(scriptMatchIndex('张三丰', '張三豐', { anyScript: true })).toBe(0);
		expect(scriptTextEquals('张三丰', '張三豐', { anyScript: true })).toBe(true);
		expect(scriptMatchIndex('后土', '後', { anyScript: true })).toBe(0);
		// 不带 anyScript(简体界面)与原先逐字节相同:原样比
		expect(scriptMatchIndex('张三丰', '張三豐')).toBe(-1);
		expect(scriptTextEquals('张三丰', '張三豐')).toBe(false);
	});
	test('放宽一档偏召回(设计口径,锁住防误改):繁体专用字检索词折回后命中另一义的简体字;「乾」不折;屏幕检索不放宽', async ()=>{
		__setConverterForTest(hantConv.toHant, hantConv.toMatchKey, hantConv);
		// 接受:「幹」折成「干」命中「天干」、「後」折成「后」命中「神后」(AI / 无头 / 命令行检索,宁可多召回)
		expect(matchesUserQuery('天干地支', '幹', { anyScript: true })).toBe(true);
		expect(scriptMatchIndex('天干地支', '幹', { anyScript: true })).toBe(1);
		expect(matchesUserQuery('神后', '後', { anyScript: true })).toBe(true);
		// 「乾」本身也是简体字,不折 → 不命中「天干地支」
		expect(matchesUserQuery('天干地支', '乾', { anyScript: true })).toBe(false);
		expect(scriptMatchIndex('天干地支', '乾', { anyScript: true })).toBe(-1);
		// 屏幕检索(繁体界面、不带 anyScript)只认看到的字:「天干」显示仍是「干」,「幹」不命中
		await applyScriptMode(SCRIPT_HANT);
		expect(matchesUserQuery('天干地支', '幹')).toBe(false);
		expect(scriptMatchIndex('天干地支', '幹')).toBe(-1);
		expect(matchesUserQuery('天干地支', '乾')).toBe(false);
	});
	test('转换器没加载:anyScript 也按原词比(不抛)', ()=>{
		expect(matchesUserQuery('张三丰', '张三', { anyScript: true })).toBe(true);
		expect(matchesUserQuery('张三丰', '張三', { anyScript: true })).toBe(false);
	});
});
