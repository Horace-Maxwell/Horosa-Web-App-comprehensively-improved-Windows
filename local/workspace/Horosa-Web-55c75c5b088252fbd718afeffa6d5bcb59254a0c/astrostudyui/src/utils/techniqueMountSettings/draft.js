// 齿轮下拉选项、字段可见性、草稿合成与「只留非默认项」裁剪
// 从 techniqueMountSettings.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { mountContextOf, getTechniqueSettingsSchema, getTechniqueSettingsCurrentDefaults, fieldCurrentDefault, baselineAliasOrDefault } from './baseline';

// 数组型 field 的归一化：排序后 join（顺序无关），空数组 → ''（与默认空数组等价，剪掉）。
function normalizeArrayForCompare(v){
	if(!Array.isArray(v)){
		return v;
	}
	// 对象元素必须 JSON 化:`${x}`='[object Object]' 对 taiSuiRelatives 这类对象数组零判别
	// (不同关系人列表被误判相同而剪空,审查实抓 Issue#76 输入地支不生效的一半病因)。
	return [...v].map((x)=>(x && typeof x === 'object' ? JSON.stringify(x) : `${x}`)).sort().join(',');
}

// 字段可见性单源(挂载抽屉 TechniqueSettingsFields 与剪枝共用):showWhen(函数)/when(对象式 {key:value},草稿缺省回退字段默认)。
// 下拉此刻列哪些档:字段带 optionShown(opt, draft) 时,返回 false 的档不列(与页面同一判据:页面藏起 / 不开放 / 随另一项变的档),
// 但 keepValue(现值)所在的档照列 —— 已选者仍显示,与页面「已选者仍显示」同口径。抽屉渲染与 AI 设置面描述 / 校验共用
// 档位随另一项变的字段可给 optionsFor(draft)(返回此刻那一套档,标签也随之,如奇门起局法随排盘体例);现值不在那套里时
// 从全量 options 补回它所在的档。displayValue(值, draft) 给下拉回显值(如非时家把节气四法显示为「本家默认」)
// 嵌进「随…（档名）」时去掉档名末尾的「（默认）」标记(三层括号难读,里层的「默认」也易误读)
const bareLabel = (label)=>`${label}`.replace(/[（(]默认[）)]$/, '');

// 只记亲手键的宿主(显示草稿带 __unsetKeys;两层宿主另带 __inherited)里,空档一档只能表达一个意思:
// 选它要么删键(不设 / 继承下面那层),要么存空串(宿占郑氏宿法下 = 郑氏历元;两层宿主里 = 随流派 / 随盘、不继承下层)。
// 空档此刻表达不了的那个意思另列一档哨兵,recordHandEditedOption 认到它:UNSET = 删键,BLANK = 存空串。两种宿主同一实现;
// 哨兵值永不落盘(写入前换掉),整张草稿的抽屉(不带 __unsetKeys)不列。
export const MOUNT_OPTION_UNSET = '__horosa_mount_unset__';

export const MOUNT_OPTION_BLANK = '__horosa_mount_blank__';

function blankOptionLabelIn(field, draft){
	const o = mountFieldOptions(field, { ...draft, __noSentinel: true }, '').find((x)=>x.value === '');
	return o ? o.label : '';
}

function handKeySentinelOptions(field, d, all){
	if(!field || d.__noSentinel || !Array.isArray(d.__unsetKeys) || !all.some((o)=>o.value === '')){ return []; }
	if(!field.blankMeansFollowSchool && !field.blankFollowsBaseline){ return []; }
	const unsetHere = d.__unsetKeys.indexOf(field.name) >= 0;
	const inhCtx = d.__inherited && typeof d.__inherited === 'object' ? d.__inherited : null;
	const inh = inhCtx && inhCtx.values && typeof inhCtx.values === 'object' ? inhCtx.values : null;
	const inhVal = inh && Object.prototype.hasOwnProperty.call(inh, field.name) ? inh[field.name] : undefined;
	const inhSet = inhVal !== undefined && inhVal !== null && `${inhVal}` !== '';
	const from = (inhCtx && inhCtx.from) || '下层设置';
	const inhLabel = ()=>{
		let v = inhVal;
		if(typeof field.normalize === 'function'){ try{ v = field.normalize(inhVal); }catch(_e){ v = inhVal; } }
		const hit = all.find((o)=>`${o.value}` === `${v}`);
		return `随${from}（${bareLabel(hit ? hit.label : `${v}`)}）`;
	};
	const blankDeletes = !!(field.blankMeansFollowSchool || fieldBlankFollowsBaseline(field, d));
	if(blankDeletes){
		if(!inhSet){ return []; }
		// 下面那层存了具体值:空档 = 删本层(继承它);本层存了空串 → 另列「随下层」删键,否则另列「不继承下层」存空串
		if(`${d[field.name]}` === '' && !unsetHere){ return [{ value: MOUNT_OPTION_UNSET, label: inhLabel() }]; }
		return [{ value: MOUNT_OPTION_BLANK, label: `${field.blankMeansFollowSchool ? '随流派' : '随盘'}（不继承${from}）` }];
	}
	// 空档 = 存空串(宿占郑氏宿法下 = 郑氏历元):没存时另列「存空串」那一档;存了(空串或别的档)另列「不设」删键
	if(unsetHere){
		const label = blankOptionLabelIn(field, { ...d, [field.name]: '', __unsetKeys: d.__unsetKeys.filter((k)=>k !== field.name), __inherited: undefined });
		return label ? [{ value: MOUNT_OPTION_BLANK, label }] : [];
	}
	if(inhSet){ return [{ value: MOUNT_OPTION_UNSET, label: inhLabel() }]; }
	const label = blankOptionLabelIn(field, { ...d, __unsetKeys: [...d.__unsetKeys, field.name], __inherited: undefined });
	return label ? [{ value: MOUNT_OPTION_UNSET, label }] : [];
}

export function mountFieldOptions(field, draft, keepValue){
	const all = Array.isArray(field && field.options) ? field.options : [];
	if(!field){ return all; }
	const d = draft && typeof draft === 'object' ? draft : {};
	const keep = keepValue !== undefined ? keepValue : (d[field.name] !== undefined ? d[field.name] : field.default);
	let keepNorm = keep;
	if(typeof field.normalize === 'function' && keep !== undefined && keep !== null){
		try{ keepNorm = field.normalize(keep); }catch(_e){ keepNorm = keep; }
	}
	if(typeof field.displayValue === 'function'){
		try{ keepNorm = field.displayValue(keepNorm, d); }catch(_e){ /* 回显值取不到:按原值 */ }
	}
	const same = (o)=>`${o.value}` === `${keepNorm}`;
	let out = all;
	// 「随流派」空档在只记亲手键的宿主里(显示草稿带 __unsetKeys)= 不设:选它恒删键,生成时保留案例存档里的逐项覆盖(案例没设才按流派)。
	// 只有导入 / 手写的数据里确实存了空串,当前态才是真按流派;字段可给 unsetBlankLabel(草稿) 换更细的说法(卜卦选了流派时)
	const handKeyHost = Array.isArray(d.__unsetKeys);
	const unsetHere = handKeyHost && d.__unsetKeys.indexOf(field.name) >= 0;
	const followSchoolUnset = field.blankMeansFollowSchool && handKeyHost && !(!unsetHere && d[field.name] === '');
	if(typeof field.optionShown === 'function' || typeof field.optionsFor === 'function'){
		let base = all;
		if(typeof field.optionsFor === 'function'){
			try{ const o = field.optionsFor(d); base = Array.isArray(o) ? o : all; }catch(_e){ base = all; }
		}
		out = base.filter((o)=>{
			if(same(o)){ return true; }
			if(typeof field.optionShown !== 'function'){ return true; }
			try{ return field.optionShown(o, d) !== false; }catch(_e){ return true; }
		});
		if(keepNorm !== undefined && keepNorm !== null && !out.some(same)){
			const hit = all.find(same);
			if(hit){ out.push(hit); }
		}
	}
	// 现值不在任何一档(旧版存的值、档位后来改过,如旧的自由填数):照列一档「值（旧档）」——下拉不露裸值,也看得出它已不在档位里
	if(all.length && ['string', 'number'].indexOf(typeof keepNorm) >= 0 && `${keepNorm}` !== '' && !out.some(same) && !all.some(same)){
		out = [...out, { value: keepNorm, label: `${keepNorm}（旧档）` }];
	}
	if(followSchoolUnset){
		let label = '不设（随案例存档；案例没设 = 随流派）';
		if(typeof field.unsetBlankLabel === 'function'){ try{ label = field.unsetBlankLabel(d) || label; }catch(_e){ /* 取不到:用通用说法 */ } }
		out = out.map((o)=>(o.value === '' ? { ...o, label } : o));
	}
	// 两层宿主(显示草稿带 __inherited = { from: 下面那层的名称, values: 它存的值 },只读上下文):本层选空档会删键的字段,
	// 删完生成时取下面那层的值 —— 下面那层存了具体值、本层没存空串时,空档写明随哪一层与档名;下面那层存的是空串、本层存了具体值时,
	// 写明随哪一层与空串的含义(本层存了空串 = 当前态确实是空档的本义,照旧)
	const inhCtx = handKeyHost && d.__inherited && typeof d.__inherited === 'object' ? d.__inherited : null;
	const inh = inhCtx && inhCtx.values && typeof inhCtx.values === 'object' ? inhCtx.values : null;
	const inhVal = inh && Object.prototype.hasOwnProperty.call(inh, field.name) ? inh[field.name] : undefined;
	const blankDeletes = !!(field.blankMeansFollowSchool || (field.blankFollowsBaseline && fieldBlankFollowsBaseline(field, d)));
	if(blankDeletes && inhVal !== undefined && inhVal !== null && `${inhVal}` !== '' && `${d[field.name]}` !== ''){
		let inhNorm = inhVal;
		if(typeof field.normalize === 'function'){ try{ inhNorm = field.normalize(inhVal); }catch(_e){ inhNorm = inhVal; } }
		const hit = all.find((o)=>`${o.value}` === `${inhNorm}`);
		const label = `随${inhCtx.from || '下层设置'}（${bareLabel(hit ? hit.label : `${inhNorm}`)}）`;
		out = out.map((o)=>(o.value === '' ? { ...o, label } : o));
	}else if(blankDeletes && inhVal === '' && `${d[field.name]}` !== ''){
		// 下面那层存的就是空串(导入 / 手写的数据),本层存了具体值:选空档删本层 → 生成时取下面那层的空串 ——
		// 空档写「随下层(空串在这一层的含义)」,含义按「本层存了空串」那一态的单层标签
		const asStoredBlank = { ...d, [field.name]: '', __unsetKeys: d.__unsetKeys.filter((k)=>k !== field.name), __inherited: undefined };
		const blankOpt = mountFieldOptions(field, asStoredBlank, '').find((o)=>o.value === '');
		if(blankOpt){
			const label = `随${inhCtx.from || '下层设置'}（${bareLabel(blankOpt.label)}）`;
			out = out.map((o)=>(o.value === '' ? { ...o, label } : o));
		}
	}
	const sentinels = handKeySentinelOptions(field, d, all);
	if(sentinels.length){
		const at = out.findIndex((o)=>o.value === '');
		out = at >= 0 ? [...out.slice(0, at + 1), ...sentinels, ...out.slice(at + 1)] : [...out, ...sentinels];
	}
	return out;
}

// blankFollowsBaseline 可以是布尔,也可以是 (草稿)=>布尔(随另一项变:宿占郑氏恒星制下岁差空档 = 郑氏,不是随盘)
export function fieldBlankFollowsBaseline(field, draft){
	if(!field || !field.blankFollowsBaseline){ return false; }
	if(typeof field.blankFollowsBaseline === 'function'){
		try{ return !!field.blankFollowsBaseline(draft && typeof draft === 'object' ? draft : {}); }catch(_e){ return true; }
	}
	return true;
}

// baseline(可选):留空 = 随存档的父档(blankFollowsBaseline)此刻是空,子项按存档里父档的实值判显隐 —— 空档的实际效果就是存档值,
// 父档存的是手动档时,生效着的手动子项不能藏起来(藏了看不见、改了也被剪)。不传 = 只看草稿(只记亲手键的宿主不知道是哪张盘)
export function isMountFieldVisible(field, draft, schema, baseline){
	if(!field){ return false; }
	let d = draft && typeof draft === 'object' ? draft : {};
	if(baseline && typeof baseline === 'object' && schema && Array.isArray(schema.fields)){
		let filled = null;
		const ctx = mountContextOf(baseline);   // 基线带的只读上下文键:草稿自带的优先
		Object.keys(ctx).forEach((k)=>{
			if(d[k] === undefined || d[k] === null){
				if(!filled){ filled = { ...d }; }
				filled[k] = ctx[k];
			}
		});
		const raw = d;
		schema.fields.forEach((f)=>{
			if(!fieldBlankFollowsBaseline(f, raw)){ return; }
			const v = d[f.name];
			const b = baseline[f.name];
			if((v === '' || v === undefined || v === null) && b !== '' && b !== undefined && b !== null){
				if(!filled){ filled = { ...d }; }
				filled[f.name] = b;
			}
		});
		if(filled){ d = filled; }
	}
	if(typeof field.showWhen === 'function'){
		try{ if(!field.showWhen(d)){ return false; } }catch(_e){ return false; }
	}
	if(field.when && typeof field.when === 'object'){
		const fields = schema && Array.isArray(schema.fields) ? schema.fields : [];
		const draftOrDefault = (name)=>{
			if(d[name] !== undefined && d[name] !== null && d[name] !== ''){ return d[name]; }
			return (fields.find((f)=>f.name === name) || {}).default;
		};
		if(!Object.keys(field.when).every((k)=>`${draftOrDefault(k)}` === `${field.when[k]}`)){ return false; }
	}
	return true;
}

// 整张草稿的宿主(AI 挂载抽屉)改一项时经此:schema.onDraftChange 可按联动规则改写其余字段(六爻换派套预设)。
// 只记亲手改动键的宿主不要用它(联动写回的键会被当成亲手改)。
export function applyTechniqueDraftChange(key, draft, name, value){
	const next = { ...(draft && typeof draft === 'object' ? draft : {}), [name]: value };
	const schema = getTechniqueSettingsSchema(key);
	if(schema && typeof schema.onDraftChange === 'function'){
		try{
			const r = schema.onDraftChange(next, name, value);
			if(r && typeof r === 'object'){ return r; }
		}catch(_e){ /* 联动失败:只改这一项 */ }
	}
	return next;
}

// 整张草稿的初值 = 底稿(缺省 + 盘现状)叠覆盖(会话覆盖 / 同类默认 / 换案例沿用的覆盖)。覆盖里带了联动键(六爻流派 / 卜卦流派)
// 且与底稿不同时,先按联动规则在底稿上改这一项(与在抽屉里亲手改同一条路),再叠覆盖 —— 直接摊在存档旧细项上,
// 草稿就是「新派 + 旧派细项」,与剪枝基准(已换成新派)一比全成了覆盖,再点应用结果就变了(应用不幂等)。
// 同值不联动(免得把存档细项误当覆盖改掉);没有联动钩子的技法 = 原样叠加
export function composeTechniqueDraft(key, baseDraft, overrides){
	const base = baseDraft && typeof baseDraft === 'object' ? { ...baseDraft } : {};
	const ov = overrides && typeof overrides === 'object' ? overrides : {};
	const schema = getTechniqueSettingsSchema(key);
	let draft = base;
	if(schema && typeof schema.onDraftChange === 'function' && Array.isArray(schema.fields)){
		schema.fields.forEach((f)=>{
			const v = ov[f.name];
			if(v === undefined || Array.isArray(v) || `${v}` === `${base[f.name]}`){ return; }
			draft = applyTechniqueDraftChange(key, draft, f.name, v);
		});
	}
	return { ...draft, ...ov };
}

// 只记亲手改动键的宿主改一项:只滤字段 + 归一,不比默认值;
// 「随流派」空档(blankMeansFollowSchool)选回时删掉这个键 = 回到「不设」(与没动过同显同值,也同义)
// 「随档 / 随盘」空档(blankFollowsBaseline)选回时同样删键:它本就不算覆盖;函数形的(宿占岁差随宿法变)按这里显示的那份合成草稿判 ——
// 显示「随盘」就删(否则存下的空串到了宿法为郑氏恒星制的盘上被当成郑氏覆盖,与显示不符),显示「郑氏历元」照存空串
// lower(可选):生成时叠在 prev 下面的那一层(两层宿主)。空档随另一项变的字段按两层合成判
// (宿法存在下面那层时,本层选空档 = 郑氏历元得存空串,删键就继承了下面那层的岁差);写入仍只写 prev 这一层
export function recordHandEditedOption(key, prev, name, value, lower){
	const schema = getTechniqueSettingsSchema(key);
	const field = schema && Array.isArray(schema.fields) ? schema.fields.find((f)=>f.name === name) : null;
	// 哨兵档(见 MOUNT_OPTION_UNSET):不设 = 删键;存空串 = 原样存空串(不按空档规则删)
	if(value === MOUNT_OPTION_UNSET || value === MOUNT_OPTION_BLANK){
		const out = { ...(prev && typeof prev === 'object' ? prev : {}) };
		if(value === MOUNT_OPTION_UNSET){ delete out[name]; }else{ out[name] = ''; }
		return sanitizeOptionsToSchema(key, out);
	}
	const next = { ...(prev && typeof prev === 'object' ? prev : {}), [name]: value };
	const blank = value === '' || value === undefined || value === null;
	if(field && blank){
		const judge = { ...(lower && typeof lower === 'object' ? lower : {}), ...next };
		if(field.blankMeansFollowSchool){
			delete next[name];
		}else if(field.blankFollowsBaseline && fieldBlankFollowsBaseline(field, composeTechniqueDraft(key, getTechniqueSettingsCurrentDefaults(key), judge))){
			delete next[name];
		}
	}
	return sanitizeOptionsToSchema(key, next);
}

// 剪枝与抽屉显隐共用的基准:原基线经 schema.adjustPruneBaseline(换派时联动键取目标预设)调整后的那份。
// 抽屉渲染字段显隐(isMountFieldVisible 第四参)必须用它,与剪枝同口径(否则同时带联动钩子与随档父档的技法,显示与计数分叉)
export function adjustedMountBaseline(key, options, baseline){
	const schema = getTechniqueSettingsSchema(key);
	let base = baseline && typeof baseline === 'object' ? baseline : null;
	if(schema && Array.isArray(schema.fields) && typeof schema.adjustPruneBaseline === 'function'){
		// 存档段缺席(旧事盘没存判读设置 / 无 payload 的源):先按字段缺省补成对象再调钩子 ——
		// 外层抽屉的基线本就是补齐缺省的对象,两层必须同锚,否则外层计覆盖、合并时内层又剪掉
		if(!base){
			base = {};
			schema.fields.forEach((f)=>{ base[f.name] = fieldCurrentDefault(f); });
		}
		try{ base = schema.adjustPruneBaseline(base, options && typeof options === 'object' ? options : {}) || base; }catch(_e){ /* 取不到:按原基线 */ }
	}
	return base;
}

export function pruneOptionsToNonDefault(key, options, baseline){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields) || !options || typeof options !== 'object'){
		return out;
	}
	const base = adjustedMountBaseline(key, options, baseline);
	// 可见性上下文=有效草稿(options 覆盖 > 基线/盘现状 > globalCurrent/默认):merge 入口只带覆盖键
	// (父开关等于全局现值时已被剪掉),只看 options 会把「全局已开太岁入卦、仅覆盖关系人」误判为隐藏而剪空。
	// 留空 = 随存档的父档取空时按基线实值判子项显隐(与抽屉 isMountFieldVisible 传基线同口径)
	const visCtx = { ...mountContextOf(base) };   // 基线带的只读上下文键(塔罗进阶对应门控)与抽屉同一份
	schema.fields.forEach((f)=>{
		const own = Object.prototype.hasOwnProperty.call(options, f.name) ? options[f.name] : undefined;
		const blankToBase = fieldBlankFollowsBaseline(f, { ...(base || {}), ...options }) && (own === '' || own === null) && base && base[f.name] !== undefined && base[f.name] !== null && base[f.name] !== '';
		if(own !== undefined && !blankToBase){ visCtx[f.name] = own; return; }
		if(base && base[f.name] !== undefined && base[f.name] !== null){ visCtx[f.name] = base[f.name]; return; }
		visCtx[f.name] = fieldCurrentDefault(f);
	});
	schema.fields.forEach((field)=>{
		if(!Object.prototype.hasOwnProperty.call(options, field.name)){
			return;
		}
		// 当前不可见的条件字段不计入覆盖也不下发(此前抽屉只在渲染层过滤:策天先拨原法改「农历算法」再拨回书法,
		// 隐藏的 lunarMode 仍计「已自定义」并随请求下发)。
		if(!isMountFieldVisible(field, visCtx, schema)){
			return;
		}
		let v = options[field.name];
		if(typeof field.normalize === 'function'){
			v = field.normalize(v);
		}
		// 留空 = 随存档的字段:空值不是覆盖;文本框归一后为空(没填 / 填得不成形)同样不是覆盖(重算回落存档)
		if(fieldBlankFollowsBaseline(field, visCtx) && (v === '' || v === undefined || v === null)){
			return;
		}
		if(typeof field.normalize === 'function' && v === undefined){
			return;
		}
		let def = (base && base[field.name] !== undefined && base[field.name] !== null)
			? base[field.name]
			: baselineAliasOrDefault(field, base);
		if(typeof field.normalize === 'function'){
			def = field.normalize(def);
		}
		// 数组型（multiselect）：先排序再比较，杜绝顺序漂移误判；空数组 === 默认空数组 → 剪掉。
		// 透传时给原数组的浅拷贝，避免外部继续改动影响已剪结果。
		if(Array.isArray(v) || Array.isArray(def)){
			if(normalizeArrayForCompare(v) !== normalizeArrayForCompare(def)){
				out[field.name] = Array.isArray(v) ? [...v] : v;
			}
			return;
		}
		if(`${v}` !== `${def}`){
			out[field.name] = v;
		}
	});
	return out;
}

// ---- localStorage 持久化（per-技法默认；独立版本号，与 aiExport 设置互不迁移）----

// 🔴 模板店存/读只做「schema 字段过滤 + 值域归一」,绝不比默认值——
// 「同类默认」的键值语义=保存时的用户显式改动集(外层已按盘现状剪过),其中「恰=schema 默认」
// 是合法内容(对存非默认的盘=真改动;消费端原样透传,由重算入口按各盘现状终判)。此前店内
// 二参 prune(锚裸 schema 默认)把这类值二次剪掉:盘存整宫制拨 Alcabitius 点「设为同类默认」
// → 店里删键、UI 却报「已设为持久」—— 双层锚不同构的模板店翻版。
export function sanitizeOptionsToSchema(key, options){
	const schema = getTechniqueSettingsSchema(key);
	const out = {};
	if(!schema || !Array.isArray(schema.fields) || !options || typeof options !== 'object'){
		return out;
	}
	schema.fields.forEach((field)=>{
		if(!Object.prototype.hasOwnProperty.call(options, field.name)){
			return;
		}
		let v = options[field.name];
		if(v === MOUNT_OPTION_UNSET || v === MOUNT_OPTION_BLANK){
			return;   // 哨兵档只在只记亲手键的宿主里列、写入前换掉;漏到这里的一律不落盘
		}
		if(typeof field.normalize === 'function'){
			v = field.normalize(v);
		}
		if(v === undefined){
			return;
		}
		out[field.name] = Array.isArray(v) ? [...v] : v;
	});
	return out;
}
