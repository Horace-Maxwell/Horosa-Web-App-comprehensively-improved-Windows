// [B15b] 流派·传本设置面板 全 handler 接线完备性哨兵(2026-08-08 小限顺逆不同步事故的制度化产物)。
// 事故形态:改档只写单例/LS,重绘·广播·重派生任一环漏接 → 部分消费点跟随、部分冻旧值,同屏自相矛盾。
// 本文件把「写入必有动作」「键账本三表完备」锁成机械断言 —— 新增设置键漏接线时在此变红,不用等真机。
import { ZWEngineOptions, ZW_ENGINE_FORWARD_KEYS } from '../ziweiOptions';
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'ZiWeiInput.js'), 'utf8');
const MAIN = fs.readFileSync(path.resolve(__dirname, '..', 'ZiWeiMain.js'), 'utf8');
const strip = (s)=>s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// 类方法窗口法提取(缩进恰一层 \t;嵌套回调缩进更深不误配)。
function handlerBodies(src){
	const starts = [...src.matchAll(/\n\t((?:on|apply)[A-Z]\w*)\s*\(/g)];
	const bounds = [...src.matchAll(/\n\t[a-zA-Z_]\w*\s*\([^)]*\)\s*\{/g)].map((m)=>m.index);
	return starts.map((m)=>{
		const next = bounds.find((b)=>b > m.index);
		return { name: m[1], body: strip(src.slice(m.index, next === undefined ? src.length : next)) };
	});
}

describe('[B15b] 设置面板 handler 接线完备性(机械提取,非手抄清单)', ()=>{
	test('🔴 凡写单例/LS 的 handler 必有 重绘|广播|转发 动作;「写而不动作」豁免账本恰等两项', ()=>{
		const WRITE_RE = /(ZWEngineOptions\.\w+\s*=|safeLocalStorageSet\(|ZWCont\.ZWSchool\.school\s*=)/;
		const ACT_RE = /(this\.redrawChart\(\)|ZiWeiHelper\.bumpZwDisplayRev\(|this\.props\.onFieldsChange|this\.applySihuaSchool\(|this\.onTaiSuiRelativesChange\(|this\.applyDisplayPreset\(|this\.onDisplayFlagToggle\()/;
		const bad = handlerBodies(SRC).filter((h)=>WRITE_RE.test(h.body) && !ACT_RE.test(h.body)).map((h)=>h.name).sort();
		// 豁免理由(逐项,新增豁免必须在此落账):
		//   applySihuaSchool —— 内部写单例方法,重绘责任在 5 个调用方(每处窗口内必有 redrawChart,
		//     由 ziweiSchoolBrightnessWiring.test.js 金标逐调用点锁);
		//   onTipsChange —— showTips 悬浮提示开关,消费在 hover 事件期现读(2026-07-31 运行时审计定性
		//     「hover 行为类,接线完整」),无盘面静态差异,无需重绘/广播。
		expect(bad).toEqual(['applySihuaSchool', 'onTipsChange']);
	});
	test('🔴 preset 键账本完备:lsMap ∪ boolMap ∪ {taiSuiRelatives} ⊇ ZWEngineOptions 全键(漏登=preset 套不动该键)', ()=>{
		const body = handlerBodies(SRC).find((h)=>h.name === 'onPresetChange').body;
		const lsMapSeg = body.slice(body.indexOf('const lsMap'), body.indexOf('};', body.indexOf('const lsMap')));
		const boolMapSeg = body.slice(body.indexOf('const boolMap'), body.indexOf('};', body.indexOf('const boolMap')));
		const keysOf = (seg)=>[...seg.matchAll(/(\w+):\s*'/g)].map((m)=>m[1]);
		const covered = new Set([...keysOf(lsMapSeg), ...keysOf(boolMapSeg), 'taiSuiRelatives']);   // 关系人列表随盘存,preset 不套(设计豁免)
		const missing = Object.keys(ZWEngineOptions).filter((k)=>!covered.has(k));
		expect(missing).toEqual([]);
	});
	test('🔴 构造器 LS 读入完备:lsMap 每个 LS 键在构造器段有读入(否则 preset 写了 LS 重进页面不生效)', ()=>{
		const body = handlerBodies(SRC).find((h)=>h.name === 'onPresetChange').body;
		const lsMapSeg = body.slice(body.indexOf('const lsMap'), body.indexOf('};', body.indexOf('const lsMap')));
		const lsKeys = [...lsMapSeg.matchAll(/'(ziwei\w+)'/g)].map((m)=>m[1]);
		const ctorSeg = strip(SRC.slice(SRC.indexOf('constructor(props)'), SRC.indexOf('this.state = {')));
		const miss = lsKeys.filter((k)=>!ctorSeg.includes(`'${k}'`));
		expect(miss).toEqual([]);
	});
	test('🔴 挂载覆盖表 SWITCH_KEYS ≡ ZWEngineOptions 全键(漏键=事盘/挂载载入该档死,三式 23 键前科)', ()=>{
		const seg = MAIN.slice(MAIN.indexOf('ZW_ENGINE_SWITCH_KEYS = ['), MAIN.indexOf('];', MAIN.indexOf('ZW_ENGINE_SWITCH_KEYS = [')));
		const listed = [...strip(seg).matchAll(/'(\w+)'/g)].map((m)=>m[1]);
		expect([...listed].sort()).toEqual(Object.keys(ZWEngineOptions).sort());
	});
	test('FORWARD 表 ⊆ 全键 且含 xiaoxianMode(本地引擎 smallDirection 口径经此进 ctx)', ()=>{
		ZW_ENGINE_FORWARD_KEYS.forEach((k)=>{ expect(Object.keys(ZWEngineOptions)).toContain(k); });
		expect(ZW_ENGINE_FORWARD_KEYS).toContain('xiaoxianMode');
	});
});
