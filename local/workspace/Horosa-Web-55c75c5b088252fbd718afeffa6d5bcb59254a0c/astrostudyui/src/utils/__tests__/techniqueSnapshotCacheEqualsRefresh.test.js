// 合同:命盘技法页「缓存快照 = 刷新结果」+ AI 对话挂载与导出取同一份正文。
// 病形:只重绘、不重取的选项(八字断命流派 / 神煞分组 / 年龄口径 / 生肖归属;紫微小限顺逆 / 流年四化取干 / 流月起法 / 运限点选)
//   改了不重存快照 → 对话挂载读缓存拿到旧口径,导出先刷新拿到新口径,两边不一。
// 三层锁:
//   ① 页面层:按选项表逐个拨每个选项,缓存槽正文必须恒等于刷新应答正文(拨了不重存 = 红);
//   ② 刷新应答写槽必带本盘出生签名(否则刷新一次后挂载认不出命主、改走无头重算);
//   ③ 挂载层:页面在场时挂载先请页面刷新再读槽(缓存是旧的也拿到页面此刻正文),不在场零等待回落缓存;同一页面状态下挂载 = 导出。
// 选项表完整性:八字左栏写进 baziOpt 的每个键都必须在本表里(新增选项不进表 = 红),紫微显示口径键取 ziweiOptions 单源选项表。
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import astroModel from '../../models/astro';
import BaZi from '../../components/cntradition/BaZi';
import ZiWeiMain from '../../components/ziwei/ZiWeiMain';
import { buildDaxianItems, emptyLuckSel, luckSelectDaxian } from '../../components/ziwei/ZWLuckPanel';
import * as ZO from '../../components/ziwei/ziweiOptions';
import { calcZiwei } from '../../components/ziwei/ZiweiCalc';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../moduleAiSnapshot';
import { getAnalysisTechniqueContexts } from '../aiAnalysisContext';
import { extractSimpleModuleContent } from '../aiExport/extractors';

const BIRTH = { date: '1990-01-30', time: '12:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1 };
// 正月初一与立春之间出生:生肖归属两档不同;大运逆顺、神煞组都有内容

function fieldsOf(v){
	const f = {}; Object.keys(astroModel.state.fields).forEach((k)=>{ f[k] = { ...astroModel.state.fields[k] }; });
	const dt = moment(`${v.date} ${v.time}`, 'YYYY-MM-DD HH:mm:ss'); dt.zone = v.zone; dt.ad = 1;
	const mk = ()=>Object.assign(dt.clone(), { zone: v.zone, ad: 1 });
	f.date = { ...f.date, value: mk() }; f.time = { ...f.time, value: mk() }; f.zone = { ...f.zone, value: v.zone }; f.ad = { ...(f.ad || {}), value: 1 };
	f.lon = { ...(f.lon || {}), value: v.lon }; f.lat = { ...(f.lat || {}), value: v.lat };
	f.gpsLon = { ...(f.gpsLon || {}), value: v.gpsLon }; f.gpsLat = { ...(f.gpsLat || {}), value: v.gpsLat };
	f.gender = { ...(f.gender || {}), value: v.gender };
	return f;
}

// 组件实例替身:原型方法 + 与 React 同序的 setState(合并 state → componentDidUpdate → 回调)
function instanceOf(Cls, props, state){
	const inst = Object.create(Cls.prototype);
	inst.props = props;
	inst.state = state;
	inst.unmounted = false;
	inst.setState = function(patch, cb){
		const prev = this.state;
		const p = typeof patch === 'function' ? patch(prev, this.props) : patch;
		this.state = { ...prev, ...(p || {}) };
		if(typeof this.componentDidUpdate === 'function'){ this.componentDidUpdate(this.props, prev); }
		if(typeof cb === 'function'){ cb(); }
	};
	return inst;
}
const flush = async ()=>{ for(let i = 0; i < 5; i += 1){ await new Promise((r)=>setTimeout(r, 0)); } };
function refreshText(inst, moduleName){
	const evt = { detail: { module: moduleName, snapshotText: '' } };
	inst.handleSnapshotRefreshRequest(evt);
	return evt.detail.snapshotText;
}
// 刷新应答也会写槽:先读缓存(= 页面平时留下的那份),再取刷新正文
function cachedThenRefresh(inst, moduleName){
	const cached = (loadModuleAISnapshot(moduleName) || {}).content || '';
	return { cached, fresh: refreshText(inst, moduleName) };
}

// 八字左栏选项表:每键至少两个取值(首值 = 缺省以外的一档,末值回缺省,来回拨两次)
const BAZI_OPT_UNIVERSE = {
	school: ['mangpai', 'nayin', 'tiaohou', 'zonghe'],
	shenshaGroups: [{ ji: false }, { xiong: false }, { yue: false, ri: false }, {}],
	ageStyle: ['real', 'nominal'],
	zodiacBoundary: ['lunar', 'lichun'],
	minggongMethod: ['shufa', 'tongxing'],
	fenyeVersion: ['fajue', 'common'],
	southMonth: ['chong', 'none'],
	dayunPrecision: ['integer', 'precise'],
	cangVersion: ['fenye', 'common'],
	showRelations: [false, true],
	showShenSha: [false, true],
	showSchoolMarks: [false, true],
	showXiaoyun: [false, true],
	onlyZiGanShen: [true, false],
	uiMode: ['legacy', 'modern'],
};

describe('选项表完整性', ()=>{
	test('八字左栏写进 baziOpt 的键全在合同表里', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../../components/cntradition/CnTraditionInput.js'), 'utf8');
		const keys = new Set();
		const re = /\.\.\.this\.props\.baziOpt,\s*\n\s*([A-Za-z_$][\w$]*)\s*:/g;
		let m;
		while((m = re.exec(src))){ keys.add(m[1]); }
		expect(keys.size).toBeGreaterThanOrEqual(12);
		const missing = [...keys].filter((k)=>!Object.prototype.hasOwnProperty.call(BAZI_OPT_UNIVERSE, k));
		expect(missing).toEqual([]);
	});
});

describe('八字页:缓存快照 = 刷新结果(逐个拨选项)', ()=>{
	test('每个选项拨完,缓存槽正文与刷新应答逐字相同,且槽带出生签名', async ()=>{
		const fields = fieldsOf(BIRTH);
		const inst = instanceOf(BaZi, { fields }, { baziOpt: {}, result: null, currentBaziKey: '', chartStyle: 'modern' });
		inst.baziReqSeq = 0;
		await inst.requestBazi(inst.effFields());
		expect(inst.state.result).toBeTruthy();
		const checked = [];
		for(const key of Object.keys(BAZI_OPT_UNIVERSE)){
			for(const val of BAZI_OPT_UNIVERSE[key]){
				// 先让槽物化一次(相当于空闲落盘已发生),再拨选项
				loadModuleAISnapshot('bazi');
				const next = { ...(inst.state.baziOpt || {}), [key]: key === 'shenshaGroups' ? { ...val } : val };
				inst.onBaziOptChange(next);
				// eslint-disable-next-line no-await-in-loop
				await flush();
				const { cached, fresh } = cachedThenRefresh(inst, 'bazi');
				expect(fresh).toBeTruthy();
				if(cached !== fresh){ checked.push(`${key}=${JSON.stringify(val)}`); }
				const meta = (loadModuleAISnapshot('bazi') || {}).meta || {};
				expect(meta.date).toBe(BIRTH.date);
				expect(meta.lon).toBe(BIRTH.lon);
			}
		}
		expect(checked).toEqual([]);
	});
});

describe('紫微页:缓存快照 = 刷新结果(显示口径改档 / 运限点选)', ()=>{
	const snapshot = JSON.parse(JSON.stringify(ZO.ZWEngineOptions));
	afterEach(()=>{
		Object.keys(snapshot).forEach((k)=>{ ZO.ZWEngineOptions[k] = snapshot[k]; });
		Object.keys(ZO.ZWEngineOptions).forEach((k)=>{ if(!(k in snapshot)){ delete ZO.ZWEngineOptions[k]; } });
	});
	test('小限顺逆 / 流年四化取干 / 流月起法 / 亮度来源逐档 + 选一个大限,缓存与刷新逐字相同且带出生签名', ()=>{
		const fields = fieldsOf(BIRTH);
		const params = ZiWeiMain.prototype.genParams.call({ props: { fields } }, fields);
		const chart = calcZiwei({ ...params, ad: 1 }, { timeAlg: params.timeAlg, after23NewDay: params.after23NewDay, lateZiHourUseNextDay: params.lateZiHourUseNextDay });
		const result = { chart };
		const inst = instanceOf(ZiWeiMain, { fields }, { result, luckSel: emptyLuckSel(), zwDisplayRev: 0 });
		inst.saveZiweiSnapshot(params, result, inst.state.luckSel);
		const lists = { xiaoxianMode: ['1', '0'], liunianSihuaGan: ZO.LIUNIAN_SIHUA_GAN_OPTIONS, liuYueBasis: ZO.LIU_YUE_BASIS_OPTIONS, brightnessSource: ZO.BRIGHTNESS_SOURCE_OPTIONS };
		const bad = [];
		// 选一个大限:快照多出 [运限] 段(此前惰性存的那份没有,只有导出带)
		loadModuleAISnapshot('ziwei');
		const dx = buildDaxianItems(chart)[2];
		inst.setState({ luckSel: luckSelectDaxian(chart, dx, emptyLuckSel()) });
		let r = cachedThenRefresh(inst, 'ziwei');
		expect(r.fresh).toMatch(/大限/);
		if(r.cached !== r.fresh){ bad.push('luckSel.daxian'); }
		Object.keys(lists).forEach((k)=>{
			(lists[k] || []).map((o)=>(o && typeof o === 'object' && 'value' in o ? o.value : o)).forEach((v)=>{
				loadModuleAISnapshot('ziwei');
				ZO.ZWEngineOptions[k] = v;
				inst.setState((s)=>({ zwDisplayRev: (s.zwDisplayRev || 0) + 1 }));   // 与 _zwDisplayListener 同一通道
				r = cachedThenRefresh(inst, 'ziwei');
				if(r.cached !== r.fresh){ bad.push(`${k}=${v}`); }
				const meta = (loadModuleAISnapshot('ziwei') || {}).meta || {};
				if(meta.date !== BIRTH.date){ bad.push(`${k}=${v}:meta`); }
			});
		});
		expect(bad).toEqual([]);
	});
});

describe('对话挂载:页面在场先刷新再读槽;挂载 = 导出', ()=>{
	const source = { sourceType: 'chart', record: { cid: 'c1', name: 't', birth: `${BIRTH.date} ${BIRTH.time}`, zone: BIRTH.zone, lon: BIRTH.lon, lat: BIRTH.lat, gender: 1 } };
	const meta = { date: BIRTH.date, time: BIRTH.time, zone: BIRTH.zone, lon: BIRTH.lon, lat: BIRTH.lat };

	test('槽里是旧正文、页面在场 → 挂载拿到页面此刻正文', async ()=>{
		const seen = [];
		const onRefresh = (ev)=>{
			const m = ev.detail.module; seen.push(m);
			if(m !== 'bazi' && m !== 'ziwei'){ return; }
			const text = `[起盘信息]\nFRESH-${m}`;
			saveModuleAISnapshot(m, text, meta);
			ev.detail.snapshotText = text;
		};
		saveModuleAISnapshot('bazi', '[起盘信息]\nSTALE-bazi', meta);
		saveModuleAISnapshot('ziwei', '[起盘信息]\nSTALE-ziwei', meta);
		window.addEventListener('horosa:refresh-module-snapshot', onRefresh);
		try{
			const out = await getAnalysisTechniqueContexts(source, ['bazi', 'ziwei']);
			expect(out.map((c)=>c.content)).toEqual(['[起盘信息]\nFRESH-bazi', '[起盘信息]\nFRESH-ziwei']);
			expect(seen).toEqual(expect.arrayContaining(['bazi', 'ziwei']));
		}finally{
			window.removeEventListener('horosa:refresh-module-snapshot', onRefresh);
		}
	});

	test('页面不在场 → 不等待,直接回落缓存', async ()=>{
		saveModuleAISnapshot('bazi', '[起盘信息]\nCACHED-bazi', meta);
		const t0 = Date.now();
		const out = await getAnalysisTechniqueContexts(source, ['bazi']);
		expect(out[0].content).toBe('[起盘信息]\nCACHED-bazi');
		expect(Date.now() - t0).toBeLessThan(400);
	});

	test('真八字页在场(非缺省流派):导出之后再挂载,挂载正文 = 导出正文 = 页面所见', async ()=>{
		const fields = fieldsOf(BIRTH);
		const inst = instanceOf(BaZi, { fields }, { baziOpt: { school: 'mangpai', ageStyle: 'real' }, result: null, currentBaziKey: '', chartStyle: 'modern' });
		inst.baziReqSeq = 0;
		await inst.requestBazi(inst.effFields());
		const listener = (ev)=>inst.handleSnapshotRefreshRequest(ev);
		window.addEventListener('horosa:refresh-module-snapshot', listener);
		try{
			inst.onBaziOptChange({ ...inst.state.baziOpt, zodiacBoundary: 'lunar' });
			const exported = await extractSimpleModuleContent('bazi');
			const mounted = (await getAnalysisTechniqueContexts(source, ['bazi']))[0];
			expect(exported).toMatch(/盲派/);
			expect(mounted.content).toBe(exported);
			expect(mounted.content).toBe(refreshText(inst, 'bazi'));
		}finally{
			window.removeEventListener('horosa:refresh-module-snapshot', listener);
		}
	});
});

describe('快照槽读取:本窗口刚写的一份不被 localStorage 里的上一份盖掉', ()=>{
	const KEY = 'horosa.ai.snapshot.module.v1.zz_probe_slot';
	test('落盘前读到新写的;localStorage 更新(别的窗口刚写)时以它为准', ()=>{
		window.localStorage.setItem(KEY, JSON.stringify({ module: 'zz_probe_slot', version: 1, createdAt: '2000-01-01T00:00:00.000Z', meta: {}, content: 'OLD-on-disk' }));
		saveModuleAISnapshot('zz_probe_slot', 'NEW-in-window', {});
		expect(loadModuleAISnapshot('zz_probe_slot').content).toBe('NEW-in-window');
		window.localStorage.setItem(KEY, JSON.stringify({ module: 'zz_probe_slot', version: 1, createdAt: '2999-01-01T00:00:00.000Z', meta: {}, content: 'NEWER-other-window' }));
		expect(loadModuleAISnapshot('zz_probe_slot').content).toBe('NEWER-other-window');
		window.localStorage.removeItem(KEY);
	});
});

// 静态锁:命盘技法页凡平时写槽带出生签名(meta 有 date),刷新应答写槽也必须带 meta ——
// 否则导出 / 挂载刷新一次,槽就失去签名,对话挂载认不出这位命主,改走无头重算(页面所见的显示口径丢失)。
describe('刷新应答写槽带出生签名(全站命盘技法页)', ()=>{
	test('凡平时写槽带 date 的命盘技法页,刷新应答里的写槽调用都带第三参', ()=>{
		const parser = require('@babel/parser');
		const traverse = require('@babel/traverse').default;
		const { ANALYSIS_CHART_TECHNIQUES } = require('../aiAnalysisContext/catalog');
		const chartSet = new Set(ANALYSIS_CHART_TECHNIQUES);
		const root = path.join(__dirname, '../../components');
		const files = [];
		const walk = (d)=>fs.readdirSync(d).forEach((n)=>{
			const p = path.join(d, n);
			if(fs.statSync(p).isDirectory()){ if(n !== '__tests__'){ walk(p); } }
			else if(/\.js$/.test(n)){ files.push(p); }
		});
		walk(root);
		const isSave = (c)=>{
			const n = c.type === 'Identifier' ? c.name : (c.property && c.property.name);
			return n === 'saveModuleAISnapshot' || n === 'saveModuleAISnapshotLazy';
		};
		const moduleLiteral = (a)=>{
			if(!a){ return ''; }
			if(a.type === 'StringLiteral'){ return a.value; }
			if(a.type === 'LogicalExpression' && a.right && a.right.type === 'StringLiteral'){ return a.right.value; }
			return '';
		};
		const metaHasBirth = (a, src)=>!!a && (/\bdate\s*:/.test(src.slice(a.start, a.end)) || (a.type === 'CallExpression' && /SnapshotMeta$/.test((a.callee && a.callee.name) || '')));
		const offenders = [];
		let guarded = 0;
		files.forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			if(src.indexOf("'horosa:refresh-module-snapshot'") < 0 || src.indexOf('saveModuleAISnapshot') < 0){ return; }
			let ast;
			try{ ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport'] }); }catch(e){ return; }
			const saves = [];
			traverse(ast, { CallExpression(p){
				if(!isSave(p.node.callee)){ return; }
				let fn = p.getFunctionParent(); let owner = '';
				while(fn){
					const k = fn.node.key;
					if(k && k.name){ owner = k.name; break; }
					fn = fn.parentPath && fn.parentPath.getFunctionParent();
				}
				saves.push({ node: p.node, owner });
			} });
			const birthSaved = saves.some((s)=>chartSet.has(moduleLiteral(s.node.arguments[0])) && metaHasBirth(s.node.arguments[2], src));
			if(!birthSaved){ return; }
			saves.filter((s)=>/^handleSnapshotRefreshRequest$|^_?onSnap(shot)?Refresh/.test(s.owner)).forEach((s)=>{
				guarded += 1;
				if(s.node.arguments.length < 3){ offenders.push(`${path.relative(root, f)}:${s.node.loc.start.line}`); }
			});
		});
		expect(guarded).toBeGreaterThanOrEqual(3);   // 至少八字 / 紫微 / 七政三页在锁内
		expect(offenders).toEqual([]);
	});
});
