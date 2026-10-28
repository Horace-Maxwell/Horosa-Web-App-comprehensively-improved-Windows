// AI 助手·改设置的中文名与起卦输入锁:
// ① 审批卡标题的技法名:挂载面全部技法、技法页全部页都有中文名(导航表查不到时退回技法中文名表 / 技法页名表);
// ② 上级项 + 它带出的(此刻隐藏的)子项同一次写:子项那一行用中文名与档名;删掉此刻隐藏着的旧键同样;
// ③ 执行后的回包 / 动作条摘要 / 账本与审批卡同一套中文名(不露 facet 英文名;摘要不露键名;回包中文名后附键名);
// ④ 起卦输入只拦写具体值:删掉用户自己的同类默认、写回「自动」那一档放行;拒绝话术按技法给对出路;
// ⑤ 技法页保存的设置(facet=page)按同一张表锁起卦输入(五兆起例、塔罗牌阵 / 牌组 / 起牌方式、地占起卦方式)。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../aiAnalysisContext', ()=>{
	const actual = jest.requireActual('../aiAnalysisContext');
	return { __esModule: true, ...actual, getAnalysisTechniqueContexts: jest.fn(async (src, keys)=>[{ key: keys[0], title: keys[0], module: keys[0], status: 'ok', content: '【课】测试快照' }]) };
});
import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ActionLedgerPanel from '../../components/aianalysis/ActionLedgerPanel';
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, registerWorkspaceUi, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { listActions, appendAction, __resetLedgerForTests } from '../aiTools/ledger';
import { setGlobalStore } from '../storageutil';
import { getAnalysisTechniqueContexts, ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES } from '../aiAnalysisContext';
import { TECHNIQUE_SETTINGS_SCHEMA, hasMountSettingsFields, getTechniqueSettingsSchema, getMountTechniqueDefault, saveMountTechniqueDefaults } from '../techniqueMountSettings';
import { describeFacet, validateFacetValues, sameSettingValue, preparePageFacet, PAGE_FACET_LOADERS, PAGE_FACET_TITLES, __resetPageFacetCacheForTests } from '../aiTools/settingsFacets';
import { settingTechniqueTitle, settingFacetTitle } from '../aiTools/settingNames';
import { CAST_INPUT_KEYS, CAST_INPUT_NEUTRAL, CAST_INPUT_CHART_TECHNIQUES, castInputKeysIn, castInputRejectMessage, pageCastTechnique } from '../aiTools/castInputKeys';
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';
import { upsertLocalChart } from '../localcharts';

const setSettings = require('../aiTools/tools/setSettings').default;
const ctx = ()=>({ origin: 'mcp', requestId: 'names-1', dispatch: jest.fn() });
const timepoint = { kind: 'timepoint', divTime: '2026-03-01 10:00', place: '北京' };
const optsPassed = ()=>{ const calls = getAnalysisTechniqueContexts.mock.calls; const last = calls[calls.length - 1]; return last && last[2] ? last[2].techniqueOptions : undefined; };
// 主导航页表(与页面同一份源码)
const ROUTES = (()=>{
	const src = fs.readFileSync(path.join(__dirname, '../../pages/index.js'), 'utf8');
	const out = [];
	src.replace(/\{ label: '([^']+)', key: '([^']+)', icon:[^}]*group: '([^']+)'/g, (m, label, key)=>{ out.push({ key, label }); return m; });
	return out;
})();
const mountTechs = ()=>Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((t)=>hasMountSettingsFields(t));
const ASCII_KEY_RE = /^[A-Za-z0-9_]+$/;

let store;
beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	store = { app: {}, astro: { fields: { hsys: { value: 1 }, zodiacal: { value: 0 } } } };
	setGlobalStore(store);
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	getAnalysisTechniqueContexts.mockClear();
});

// 给某项挑一个与现值 / 缺省都不同的合法值
function pickValue(it){
	if(it.type === 'switch'){ return Number(it.current) ? 0 : 1; }
	if(it.type === 'number'){ const b = typeof it.current === 'number' ? it.current : (typeof it.default === 'number' ? it.default : 0); let n = b + 1; if(typeof it.max === 'number' && n > it.max){ n = b - 1; } return n; }
	if(it.type === 'text'){ return 'x'; }
	const opts = (it.options || []).filter((o)=>o && !sameSettingValue(o.value, it.current) && !sameSettingValue(o.value, it.default));
	return opts.length ? opts[0].value : undefined;
}
// 全部「上级 + 此刻隐藏的子项」组合(上级取某一档后子项显示且可写,同写校验通过)
function hiddenChildCombos(){
	const out = [];
	mountTechs().forEach((t)=>{
		const sch = getTechniqueSettingsSchema(t);
		const d0 = describeFacet('mount', t);
		if(!d0.ok){ return; }
		const vis = new Set(d0.items.map((x)=>x.key));
		sch.fields.forEach((f)=>{
			if(vis.has(f.name)){ return; }
			let found = null;
			for(const p of d0.items.filter((x)=>x.settable && Array.isArray(x.options) && x.options.length)){
				for(const o of p.options){
					const d1 = describeFacet('mount', t, { [p.key]: o.value });
					const ch = d1.ok ? d1.items.find((x)=>x.key === f.name && x.settable) : null;
					if(ch){ found = { p, o, ch }; break; }
				}
				if(found){ break; }
			}
			if(!found){ return; }
			const cv = pickValue(found.ch);
			if(cv === undefined){ return; }
			const values = { [found.p.key]: found.o.value, [f.name]: cv };
			if(!validateFacetValues('mount', t, values).ok){ return; }
			out.push({ t, parent: found.p, child: f, values });
		});
	});
	return out;
}

describe('① 审批卡标题的技法名', ()=>{
	it('🔴 挂载面全部技法、技法本地面全部技法:有导航表或没有(无头)都写中文名,不退回英文键', async ()=>{
		for(const withRoutes of [false, true]){
			__resetWorkspaceBridgeForTests();
			registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
			if(withRoutes){ registerWorkspaceUi({ listRoutes: ()=>ROUTES }); }
			const raw = [];
			mountTechs().forEach((t)=>{ if(ASCII_KEY_RE.test(settingTechniqueTitle('mount', t))){ raw.push(`mount/${t}`); } });
			Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((t)=>TECHNIQUE_SETTINGS_SCHEMA[t].kind === 'localStorage' && hasMountSettingsFields(t)).forEach((t)=>{ if(ASCII_KEY_RE.test(settingTechniqueTitle('technique', t))){ raw.push(`technique/${t}`); } });
			expect(`${withRoutes}:${raw.join(',')}`).toBe(`${withRoutes}:`);
		}
		// 与挂载卡 / 导出页同名;主导航有的页仍按导航页名(零回归)
		expect(settingTechniqueTitle('mount', 'zodialrelease')).toBe('星运-黄道星释');
		expect(settingTechniqueTitle('mount', 'qimen')).toBe('奇门遁甲');
		expect(settingTechniqueTitle('mount', 'jinkou')).toBe('金口诀');
		registerWorkspaceUi({ listRoutes: ()=>ROUTES });
		expect(settingTechniqueTitle('mount', 'bazi')).toBe('八字');
		const pv = await setSettings.preview({ facet: 'mount', technique: 'zodialrelease', values: { [describeFacet('mount', 'zodialrelease').items.find((x)=>x.settable && pickValue(x) !== undefined).key]: pickValue(describeFacet('mount', 'zodialrelease').items.find((x)=>x.settable && pickValue(x) !== undefined)) } });
		expect(pv.title).toBe('修改AI 挂载·星运-黄道星释设置');
	});
	it('🔴 技法页面面:每一页都有中文页名(含导航表里没有的地占 / 数算其他命术 / 卜卦盘 / 占星地图),页名表与载入表逐页对齐', ()=>{
		registerWorkspaceUi({ listRoutes: ()=>ROUTES });
		expect(Object.keys(PAGE_FACET_TITLES).sort()).toEqual(Object.keys(PAGE_FACET_LOADERS).sort());
		Object.keys(PAGE_FACET_LOADERS).forEach((p)=>{
			const title = settingTechniqueTitle('page', p);
			expect(`${p}:${/[A-Za-z]/.test(title)}`).toBe(`${p}:false`);
		});
		// 导航表里有的页:页名与导航一致(零回归)
		['liureng', 'dunjia', 'taiyi', 'sanshiunited', 'tarot', 'fengshui', 'direction', 'guazhan'].forEach((p)=>{
			expect(settingTechniqueTitle('page', p)).toBe(ROUTES.find((r)=>r.key === p).label);
		});
		expect(settingFacetTitle('page', 'acg')).toBe('技法页·辅盘·占星地图');
		// 不分技法的面:多给的 technique 不写进标题
		expect(settingFacetTitle('chart', 'bazi')).toBe('当前盘');
	});
	it('页面面审批卡标题(地占 / 卜卦盘)走页名表', async ()=>{
		for(const p of ['geomancy', 'horary']){
			await preparePageFacet(p);   // eslint-disable-line no-await-in-loop
			const it = describeFacet('page', p).items.find((x)=>x.settable && x.type === 'boolean');
			const pv = await setSettings.preview({ facet: 'page', technique: p, values: { [it.key]: !it.current } });   // eslint-disable-line no-await-in-loop
			expect(pv.title).toBe(`修改技法页·${PAGE_FACET_TITLES[p]}设置`);
		}
	});
});

describe('② 上级 + 此刻隐藏的子项同一次写', ()=>{
	it('🔴 全部组合:审批卡里子项那一行写中文名(不再是「键名: 原值」),档位有档名的写档名', async ()=>{
		const combos = hiddenChildCombos();
		expect(combos.length).toBeGreaterThan(50);
		const bad = [];
		for(const c of combos){
			const pv = await setSettings.preview({ facet: 'mount', technique: c.t, values: c.values });   // eslint-disable-line no-await-in-loop
			const lines = `${pv && pv.after}`.split('\n');
			const line = lines.find((l)=>l.indexOf(`${c.child.label}: `) === 0);
			if(!line || lines.some((l)=>l.indexOf(`${c.child.name}: `) === 0)){ bad.push(`${c.t}.${c.child.name}`); continue; }
			const opts = Array.isArray(c.child.options) ? c.child.options : [];
			const opt = opts.find((o)=>sameSettingValue(o.value, c.values[c.child.name]));
			if(opt && opt.label && line !== `${c.child.label}: ${opt.label}`){ bad.push(`${c.t}.${c.child.name}=${line}`); }
		}
		expect(bad).toEqual([]);
		// 典型:恒星黄道 + 岁差同写
		const sid = combos.find((c)=>c.child.name === 'siderealAyanamsa');
		expect(sid).toBeTruthy();
	});
	it('🔴 删掉此刻隐藏着的旧键(传 null):审批卡写中文名', async ()=>{
		const combos = hiddenChildCombos();
		let checked = 0;
		const bad = [];
		for(const c of combos){
			window.localStorage.clear();
			saveMountTechniqueDefaults(c.t, { [c.child.name]: c.values[c.child.name] });
			const d = describeFacet('mount', c.t);
			if(!d.ok || d.items.some((x)=>x.key === c.child.name)){ continue; }   // 只看删键时仍隐藏的
			checked += 1;
			const pv = await setSettings.preview({ facet: 'mount', technique: c.t, values: { [c.child.name]: null } });   // eslint-disable-line no-await-in-loop
			// 同类默认里只有这一项时删完会变空,预览另起一行写「执行会被拒」;这里只看设置项那一行
			if(`${pv && pv.after}`.split('\n')[0] !== `${c.child.label}: (删除,回到不设)`){ bad.push(`${c.t}.${c.child.name}:${pv && pv.after}`); }
		}
		expect(checked).toBeGreaterThan(20);
		expect(bad).toEqual([]);
	});
});

describe('③ 执行后的回包 / 动作条摘要 / 账本', ()=>{
	it('🔴 上级 + 子项同写:摘要与账本只写中文面名、技法名、设置项名;回包中文名后附键名;都不露 facet 英文名', async ()=>{
		const c = hiddenChildCombos().find((x)=>x.child.name === 'siderealAyanamsa');
		const r = await runTool('set_settings', { facet: 'mount', technique: c.t, values: c.values }, ctx());
		expect(r.ok).toBe(true);
		const where = settingFacetTitle('mount', c.t);
		expect(r.summary).toBe(`改设置 ${where}:${c.parent.label}、${c.child.label}`);
		expect(r.summary).not.toMatch(/mount|siderealAyanamsa/);
		expect(r.message).toContain(`${c.child.label}[siderealAyanamsa]`);
		expect(r.message).not.toMatch(/^已修改 mount/);
		const led = listActions().find((a)=>a.tool === 'set_settings');
		expect(led.summary).toBe(r.summary);
	});
	it('读设置的摘要写中文面名与技法名', async ()=>{
		const d = await runTool('describe_settings', { facet: 'mount', technique: 'zodialrelease' }, ctx());
		expect(d.summary).toMatch(/^设置面 AI 挂载·星运-黄道星释 \d+ 项$/);
		const g = await runTool('get_settings', { facet: 'app' }, ctx());
		expect(g.summary).toBe('设置面 全局显示 当前值');
	});
	it('🔴 载入工作区并切页:动作条摘要 / 账本写中文页名(与审批卡同),回包附页键', async ()=>{
		let tab = 'astrochart';
		registerWorkspaceUi({ listRoutes: ()=>ROUTES, currentRoute: ()=>({ tab }), navigate: (k)=>{ tab = k; return { ok: true }; } });
		const chart = upsertLocalChart({ cid: 'local-names-c', name: '甲', birth: '1990-01-01 12:00:00' });
		const tool = require('../aiTools/tools/loadRecordIntoWorkspace').default;
		const pv = tool.preview({ cid: chart.cid, technique: 'bazi' });
		expect(pv.after).toContain('并切到八字');
		const r = await runTool('load_record_into_workspace', { cid: chart.cid, technique: 'bazi' }, ctx());
		expect(r.ok).toBe(true);
		expect(r.summary).toBe('载入命盘 甲 → 八字');
		expect(r.message).toBe('已载入命盘「甲」,已切到八字[bazi]');
		expect(r.data.tab).toBe('bazi');   // 回包 data 不变
		expect(listActions().find((a)=>a.tool === 'load_record_into_workspace').summary).toBe('载入命盘 甲 → 八字');
	});
	it('动作账本面板的工具列写中文工具名(工具名放悬停提示)', async ()=>{
		if(!window.matchMedia){ window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false }); }
		appendAction({ id: 'act-names-1', tool: 'set_settings', level: 'additive', args: {}, summary: '改设置 AI 挂载·八字:长生', result: { ok: true }, undo: { kind: 'none' } });
		const host = document.createElement('div');
		document.body.appendChild(host);
		await act(async ()=>{ ReactDOM.render(<ActionLedgerPanel />, host); await new Promise((r)=>setTimeout(r, 0)); });
		const cell = host.querySelector('[data-ledger-tool="set_settings"]');
		expect([cell && cell.textContent, cell && cell.getAttribute('title')]).toEqual(['修改设置', 'set_settings']);
		expect(host.querySelector('[data-ledger-row]').textContent).not.toContain('set_settings');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		host.remove();
	});
});

describe('④ 起卦输入锁只拦写具体值', ()=>{
	it('清单自洽:「回到自动」那一档都在起卦输入键上、等于该字段的挂载缺省;命盘类技法表 = 起卦输入表里只能挂命盘(没有事盘)的技法', ()=>{
		Object.keys(CAST_INPUT_NEUTRAL).forEach((t)=>{
			const fields = (getTechniqueSettingsSchema(t) || {}).fields || [];
			Object.keys(CAST_INPUT_NEUTRAL[t]).forEach((k)=>{
				expect(`${t}.${k}:${CAST_INPUT_KEYS[t].indexOf(k) >= 0}`).toBe(`${t}.${k}:true`);
				const f = fields.find((x)=>x.name === k);
				expect(`${t}.${k}:${!!f}`).toBe(`${t}.${k}:true`);
				expect(`${t}.${k}:${sameSettingValue(f.default, CAST_INPUT_NEUTRAL[t][k])}`).toBe(`${t}.${k}:true`);
			});
		});
		expect(CAST_INPUT_CHART_TECHNIQUES.slice().sort()).toEqual(Object.keys(CAST_INPUT_KEYS).filter((t)=>ANALYSIS_CHART_TECHNIQUES.indexOf(t) >= 0 && ANALYSIS_CASE_TECHNIQUES.indexOf(t) < 0).sort());
	});
	it('🔴 印占:用户自己设的问事起卦时刻,助手传 null 删得掉(此前一律拒);写具体时刻照拒;describe 提示写明可传 null', async ()=>{
		saveMountTechniqueDefaults('indiachart', { indiaPrashnaTime: '2026/03/01 10:00:00', indiaSthiraStart: 'lagna' });
		const d = describeFacet('mount', 'indiachart').items.find((x)=>x.key === 'indiaPrashnaTime');
		expect([d.settable, /起卦输入/.test(d.hint), /传 null/.test(d.hint)]).toEqual([false, true, true]);
		const bad = await runTool('set_settings', { facet: 'mount', technique: 'indiachart', values: { indiaPrashnaTime: '2026/05/01 10:00:00' } }, ctx());
		expect(bad.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
		expect(bad.message).not.toContain('cast_divination_case');   // 印占不能按结果建事盘:不指错路
		expect(bad.message).toContain('挂载设置');
		const r = await runTool('set_settings', { facet: 'mount', technique: 'indiachart', values: { indiaPrashnaTime: null } }, ctx());
		expect(r.ok).toBe(true);
		expect(getMountTechniqueDefault('indiachart')).toEqual({ indiaSthiraStart: 'lagna' });
	});
	it('🔴 金口诀地分:写回「自动」/ 删掉放行,写具体地支照拒;拒绝话术不指 cast_divination_case', async ()=>{
		saveMountTechniqueDefaults('jinkou', { diFen: '午' });
		const bad = await runTool('set_settings', { facet: 'mount', technique: 'jinkou', values: { diFen: '子' } }, ctx());
		expect([bad.code, /起卦输入/.test(bad.message), /cast_divination_case/.test(bad.message), /传 null/.test(bad.message), /diFen 写 "auto"/.test(bad.message)]).toEqual(['E_SETTING_KEY_NOT_ALLOWED', true, false, true, true]);
		expect(getMountTechniqueDefault('jinkou')).toEqual({ diFen: '午' });
		const auto = await runTool('set_settings', { facet: 'mount', technique: 'jinkou', values: { diFen: 'auto' } }, ctx());
		expect(auto.ok).toBe(true);
		expect(getMountTechniqueDefault('jinkou').diFen).toBe('auto');
		saveMountTechniqueDefaults('jinkou', { diFen: '午' });
		const byLabel = await runTool('set_settings', { facet: 'mount', technique: 'jinkou', values: { diFen: '自动（按占时支）' } }, ctx());   // 按档名写同样认
		expect(byLabel.ok).toBe(true);
		saveMountTechniqueDefaults('jinkou', { diFen: '午', guireng: 2 });
		const del = await runTool('set_settings', { facet: 'mount', technique: 'jinkou', values: { diFen: null } }, ctx());
		expect(del.ok).toBe(true);
		expect(Object.prototype.hasOwnProperty.call(getMountTechniqueDefault('jinkou'), 'diFen')).toBe(false);
		const dh = describeFacet('mount', 'jinkou').items.find((x)=>x.key === 'diFen');
		expect(dh.hint).toMatch(/写回「自动（按占时支）」\("auto"\)= 回到自动/);
	});
	it('🔴 cast_technique:金口诀覆盖写「auto」= 不覆盖,照常起盘;写具体地支照拒', async ()=>{
		saveMountTechniqueDefaults('jinkou', { diFen: '午' });
		const ok = await runTool('cast_technique', { technique: 'jinkou', source: timepoint, options: { diFen: 'auto' } }, ctx());
		expect(ok.ok).toBe(true);
		expect(optsPassed()).toEqual({ jinkou: { diFen: 'auto' } });
		getAnalysisTechniqueContexts.mockClear();
		const bad = await runTool('cast_technique', { technique: 'jinkou', source: timepoint, options: { diFen: '子' } }, ctx());
		expect([bad.code, bad.data.castInputKeys]).toEqual(['E_ARGS_INVALID', ['diFen']]);
		expect(bad.message).toMatch(/^「金口诀\(jinkou\)」的 diFen 属起卦输入/);
		expect(bad.message).not.toContain('cast_divination_case');
		expect(getAnalysisTechniqueContexts).not.toHaveBeenCalled();
		expect(castInputKeysIn('wuzhao', { mode: 'ganzhi', number: 0, manual: 0, qianAuto: 1 })).toEqual([]);
		expect(castInputKeysIn('wuzhao', { mode: 'qian', number: 3 })).toEqual(['mode', 'number']);
	});
	it('拒绝话术按技法给出路:能按结果建事盘的(六爻等)才指 cast_divination_case;其余指向亲手起课 / 挂载设置', ()=>{
		expect(castInputRejectMessage('sixyao', ['gua'])).toContain('cast_divination_case');
		expect(castInputRejectMessage('lingqi', ['counts'])).toContain('cast_divination_case');
		['jinkou', 'liureng', 'qimen', 'taixuan', 'wuzhao', 'tarot', 'geomancy', 'indiachart'].forEach((t)=>{
			expect(`${t}:${castInputRejectMessage(t, [CAST_INPUT_KEYS[t][0]]).indexOf('cast_divination_case') >= 0}`).toBe(`${t}:false`);
		});
		expect(castInputRejectMessage('wuzhao', ['mode'], { facet: 'page', label: '五兆' })).toMatch(/^「五兆\(wuzhao\)」.*技法页亲手选.*mode 写 "ganzhi"/);
	});
	it('🔴 其余起卦输入:心易起卦法写回按时间起放行、写报数照拒;五兆「每次起盘重掷」按开关写 true 也认;此刻隐藏的子项写回自动档按隐藏项拒(提示上级)', async ()=>{
		expect((await runTool('set_settings', { facet: 'mount', technique: 'huangji', values: { xinyiMethod: 'datetime' } }, ctx())).ok).toBe(true);
		expect((await runTool('set_settings', { facet: 'mount', technique: 'huangji', values: { xinyiMethod: 'number' } }, ctx())).code).toBe('E_SETTING_KEY_NOT_ALLOWED');
		const v = validateFacetValues('mount', 'wuzhao', { mode: 'qian', qianAuto: true });
		expect([v.ok, v.badKey]).toEqual([false, 'mode']);   // mode 写具体起例(以钱代筮)照拒
		saveMountTechniqueDefaults('wuzhao', { mode: 'qian', qianAuto: 0 });   // 用户自己选了以钱代筮、关了重掷
		expect(validateFacetValues('mount', 'wuzhao', { qianAuto: true })).toEqual({ ok: true, values: { qianAuto: 1 } });   // 开回「每次起盘重掷」(自动)
		expect(validateFacetValues('mount', 'wuzhao', { qianThrows: '1,2,3,3,3,4' }).castInput).toBe(true);   // 填六掷 = 具体值,照拒
		const v2 = validateFacetValues('mount', 'liureng', { xuanShiZhi: '' });
		expect([v2.ok, !!v2.castInput, /此项此刻不显示/.test(v2.hint || '')]).toEqual([false, false, true]);
		expect(validateFacetValues('mount', 'liureng', { xuanShiZhi: '子' }).castInput).toBe(true);
		saveMountTechniqueDefaults('wuzhao', { mode: 'qian' });
		const q = validateFacetValues('mount', 'wuzhao', { mode: 'ganzhi' });
		expect(q).toEqual({ ok: true, values: { mode: 'ganzhi' } });
	});
});

describe('⑤ 技法页保存的设置(facet=page)同样锁起卦输入', ()=>{
	beforeEach(()=>{ __resetPageFacetCacheForTests(); });
	it('🔴 五兆起例模式、塔罗牌阵 / 牌组 / 起牌方式、地占起卦方式:describe 标只读并说明;写具体值整次拒、一项不写', async ()=>{
		const cases = [['wuzhao', ['mode', 'shifaVariant']], ['tarot', ['deckId', 'spreadType', 'seedMode']], ['geomancy', ['seedMode']]];
		for(const [page, keys] of cases){
			await preparePageFacet(page);   // eslint-disable-line no-await-in-loop
			const items = describeFacet('page', page).items;
			keys.forEach((k)=>{
				const it = items.find((x)=>x.key === k);
				expect(`${page}.${k}:${it.settable}:${/起卦输入/.test(it.hint || '')}`).toBe(`${page}.${k}:false:true`);
			});
			const entry = PAGE_SETTINGS_REGISTRY.find((p)=>p.page === page);
			for(const k of keys){
				const it = items.find((x)=>x.key === k);
				const other = it.options.find((o)=>!sameSettingValue(o.value, it.default) && !sameSettingValue(o.value, (CAST_INPUT_NEUTRAL[pageCastTechnique(page)] || {})[k]));
				const r = await runTool('set_settings', { facet: 'page', technique: page, values: { [k]: other.value } }, ctx());   // eslint-disable-line no-await-in-loop
				expect(`${page}.${k}:${r.code}:${/技法页亲手选/.test(r.message)}`).toBe(`${page}.${k}:E_SETTING_KEY_NOT_ALLOWED:true`);
				expect(window.localStorage.getItem(entry.storageKey)).toBe(null);
				expect(await setSettings.preview({ facet: 'page', technique: page, values: { [k]: other.value } })).toBe(null);   // eslint-disable-line no-await-in-loop
			}
		}
		// 判读 / 显示类键照常可改(判别向量:不是整页一刀切)
		await preparePageFacet('tarot');
		const rv = await runTool('set_settings', { facet: 'page', technique: 'tarot', values: { useReversals: false } }, ctx());
		expect(rv.ok).toBe(true);
	});
	it('五兆起例写回缺省那一档(干支起盘,按时间)放行', async ()=>{
		await preparePageFacet('wuzhao');
		const r = await runTool('set_settings', { facet: 'page', technique: 'wuzhao', values: { mode: 'ganzhi' } }, ctx());
		expect(r.ok).toBe(true);
		expect(r.summary).toBe('改设置 技法页·五兆:起盘方式');   // 页面面设置项显示中文名(同名齿轮字段标签)
	});
});
