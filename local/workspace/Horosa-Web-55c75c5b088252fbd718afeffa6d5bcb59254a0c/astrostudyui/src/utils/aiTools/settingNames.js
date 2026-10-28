// AI 助手·改设置的中文名单源:审批卡(写前预览)、执行后的回包 / 动作条摘要 / 动作账本、读设置的摘要用同一套名字。
// 技法名:技法页面面先查中文页名表;再查主导航页名;查不到退回技法中文名表(与 AI 分析挂载卡 / 导出页同名);都没有才写键名。
// 设置项名:取字段中文名 —— 按本次要写的值判显隐(上级改档才显示出来的子项也在列,与校验同一份),
// 仍不在列的(此刻隐藏着要删的旧键)按技法设置表的字段兜底;档位同样换成档名,找不到才写原值。
import { analysisTechniqueLabelMap } from '../aiAnalysisContext';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';
import { getWorkspaceUi } from './workspaceBridge';
import { describeFacet, sameSettingValue, PAGE_FACET_TITLES } from './settingsFacets';

export const FACET_TITLE = { chart: '当前盘', mount: 'AI 挂载', app: '全局显示', classical: '古典全局', technique: '技法本地', page: '技法页' };
const SWITCH_LABELS = [{ value: 0, label: '关' }, { value: 1, label: '开' }];

function routeLabelOf(key){
	try{
		const ui = getWorkspaceUi();
		const routes = ui && typeof ui.listRoutes === 'function' ? (ui.listRoutes() || []) : [];
		const hit = routes.find((r)=>r && r.key === key);
		if(hit && hit.label){ return `${hit.label}`; }
	}catch(e){ /* 读不到导航表:往下退 */ }
	return '';
}

// 技法(或技法页)的中文名
export function settingTechniqueTitle(facet, technique){
	const t = `${technique || ''}`;
	if(!t){ return ''; }
	if(facet === 'page' && Object.prototype.hasOwnProperty.call(PAGE_FACET_TITLES, t)){ return PAGE_FACET_TITLES[t]; }
	const route = routeLabelOf(t);
	if(route){ return route; }
	try{
		const m = analysisTechniqueLabelMap([t]);
		if(m && m[t] && `${m[t]}` !== t){ return `${m[t]}`; }
	}catch(e){ /* 名表读不到:写键名 */ }
	if(facet !== 'page' && Object.prototype.hasOwnProperty.call(PAGE_FACET_TITLES, t)){ return PAGE_FACET_TITLES[t]; }
	return t;
}

// 「AI 挂载·八字」这类面 + 技法的合称(不分技法的面只写面名,多给的 technique 不写)
const TECHNIQUE_FACETS = ['mount', 'technique', 'page'];
export function settingFacetTitle(facet, technique){
	const f = FACET_TITLE[facet] || `${facet || ''}`;
	return technique && TECHNIQUE_FACETS.indexOf(facet) >= 0 ? `${f}·${settingTechniqueTitle(facet, technique)}` : f;
}

// 设置项名 / 档名:values 为本次要写的值(已校验归一;mount / technique 面据此判显隐)
export function settingItemNamer(facet, technique, values){
	const byKey = {};
	const put = (d)=>{ (d && d.ok && Array.isArray(d.items) ? d.items : []).forEach((it)=>{ if(it && it.key !== undefined){ byKey[it.key] = it; } }); };
	try{ put(describeFacet(facet, technique)); }catch(e){ /* 读不到:往下兜底 */ }
	const linked = facet === 'mount' || facet === 'technique';
	if(linked && values && typeof values === 'object'){
		try{ put(describeFacet(facet, technique, values)); }catch(e){ /* 同上 */ }
	}
	let fields = null;
	const fieldOf = (k)=>{
		if(!linked){ return null; }
		if(fields === null){
			try{ const sch = getTechniqueSettingsSchema(technique); fields = sch && Array.isArray(sch.fields) ? sch.fields : []; }catch(e){ fields = []; }
		}
		return fields.find((f)=>f && f.name === k) || null;
	};
	const itemOf = (k)=>{
		if(Object.prototype.hasOwnProperty.call(byKey, k)){ return byKey[k]; }
		const f = fieldOf(k);
		if(!f){ return null; }
		return { key: k, label: f.label, options: Array.isArray(f.options) ? f.options : (f.type === 'switch' ? SWITCH_LABELS : []) };
	};
	const nameOf = (k)=>{ const it = itemOf(k); return it && it.label ? `${it.label}` : `${k}`; };
	const valueOf = (k, x)=>{
		const it = itemOf(k);
		const opt = it && Array.isArray(it.options) ? it.options.find((o)=>o && sameSettingValue(o.value, x)) : null;
		return opt && opt.label !== undefined && opt.label !== '' ? `${opt.label}` : JSON.stringify(x);
	};
	// 回包给模型看:中文名后附键名(下一步调用要用键名);名字就是键名时只写一次
	const nameWithKey = (k)=>{ const n = nameOf(k); return n === `${k}` ? n : `${n}[${k}]`; };
	return { itemOf, nameOf, valueOf, nameWithKey };
}
