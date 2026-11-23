// AI 工具·挂载齿轮显隐判据(轻量件:只依赖挂载设置表)。
// cast_technique 的 ignoredOptions 分拣与报数起卦的「须配哪一档」共用;报数起卦的格式目录在工具首包里同步取它,
// 故不许依赖 tools/castTechnique(那一件连着整套重算链 —— 同步引入曾把它拖进别的 chunk,构建后自检报模块回灌)。
import { getTechniqueSettingsSchema, effectiveMountBaseline, adjustedMountBaseline, fieldBlankFollowsBaseline, fieldCurrentDefault, isMountFieldVisible, mountContextOf } from '../techniqueMountSettings';

// 显隐判据与重算入口的剪枝(pruneOptionsToNonDefault)同一份上下文:覆盖 > 盘现状基线 > 全局现值 / 缺省,基线 = effectiveMountBaseline
export const hasOwnKey = (o, k)=>!!o && Object.prototype.hasOwnProperty.call(o, k);
export function visibilityContext(schema, key, options, baseline){
	const base = adjustedMountBaseline(key, options, baseline);
	const ctx = { ...mountContextOf(base) };   // 基线带的只读上下文键(塔罗进阶对应门控),与抽屉 / 剪枝同一份
	schema.fields.forEach((f)=>{
		const own = hasOwnKey(options, f.name) ? options[f.name] : undefined;
		const blankToBase = fieldBlankFollowsBaseline(f, { ...(base || {}), ...options }) && (own === '' || own === null) && base && base[f.name] !== undefined && base[f.name] !== null && base[f.name] !== '';
		if(own !== undefined && !blankToBase){ ctx[f.name] = own; return; }
		if(base && base[f.name] !== undefined && base[f.name] !== null){ ctx[f.name] = base[f.name]; return; }
		ctx[f.name] = fieldCurrentDefault(f);
	});
	return ctx;
}
// 决定一项显隐的那几项:showWhen 读了哪些键(按真实调用记下,不手写)+ when 对象的键
export function visibilityControllers(field, ctx, names){
	const seen = new Set();
	if(field.when && typeof field.when === 'object'){ Object.keys(field.when).forEach((k)=>seen.add(k)); }
	if(typeof field.showWhen === 'function' && typeof Proxy === 'function'){
		const probe = new Proxy(ctx, { get(t, k){ if(typeof k === 'string'){ seen.add(k); } return t[k]; } });
		try{ field.showWhen(probe); }catch(_e){ /* 判据抛错:只记已读到的键 */ }
	}
	// 基线带的只读上下文键(以 __ 开头,齿轮改不了的本盘事实)也算决定项
	return names.filter((n)=>n !== field.name && seen.has(n)).concat([...seen].filter((k)=>k.indexOf('__') === 0 && names.indexOf(k) < 0 && ctx[k] !== undefined && ctx[k] !== null));
}

// 一项此刻不显示时,把它的上级项改成哪一档它才生效:[{ key, value, label }](只看单个上级项的各档;档位随上下文的按 optionsFor 取)。
// 报数起卦用:六壬「演数/报数」要配起课法 = 演数或报数,奇门「报数」要配起局 = 数字起局
export function castKeyEnablers(technique, key, merged, record){
	const schema = getTechniqueSettingsSchema(technique);
	if(!schema || schema.kind === 'sectionsOnly' || !Array.isArray(schema.fields)){ return []; }
	const f = schema.fields.find((x)=>x.name === key);
	if(!f){ return []; }
	const names = schema.fields.map((x)=>x.name);
	const baseline = effectiveMountBaseline(technique, record || {});
	const opts = merged || {};
	const ctx = visibilityContext(schema, technique, opts, baseline);
	if(isMountFieldVisible(f, ctx, schema)){ return []; }
	const out = [];
	visibilityControllers(f, ctx, names).forEach((c)=>{
		const cf = schema.fields.find((x)=>x.name === c);
		if(!cf){ return; }
		let sets = [];
		if(typeof cf.optionsFor === 'function'){ try{ const o = cf.optionsFor(ctx); if(Array.isArray(o)){ sets = o; } }catch(_e){ sets = []; } }
		if(!sets.length && Array.isArray(cf.options)){ sets = cf.options; }
		sets.forEach((o)=>{
			if(!o || o.value === undefined){ return; }
			const ctx2 = visibilityContext(schema, technique, { ...opts, [c]: o.value }, baseline);
			if(isMountFieldVisible(f, ctx2, schema)){ out.push({ key: c, value: o.value, label: `${o.label || o.value}` }); }
		});
	});
	return out;
}
