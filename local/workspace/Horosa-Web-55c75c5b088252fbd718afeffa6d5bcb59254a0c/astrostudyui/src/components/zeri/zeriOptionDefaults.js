// 择日工作台「完整口径」单源:宿主出厂缺省(全键)= 工作台参数表每个字段的出厂值 ∪ 宿主缺省对象。
//
// 构造(工作台初值)、载入存案、载入方案 / 历史三处共用,都以它打底:
//   · 存:工作台初值就是全键,之后的存案 / 方案 / 历史随之存的都是完整口径;
//   · 载:{ ...出厂完整缺省, ...存下的 options } —— 存下的没写的键回出厂值(旧版扫描对缺键就按引擎缺省扫,正是当时的口径),
//     绝不拿本会话现值打底(否则会话里改过、存案里没写的键混进冻结口径:点选 / 详情 / 快照判读与存案的结果列表不是同一口径)。
// 参数表里没有出厂值的字段(报数之类每次输入)出厂即「未设」:载入后该键不存在。

// 参数表 → { key: 出厂值 }(没有出厂值的字段记 undefined,表示出厂未设)
export function fieldDefaultsOf(fields){
	const out = {};
	(fields || []).forEach((f)=>{ if(f && f.key){ out[f.key] = f.dv; } });
	return out;
}

// 去掉值为 undefined 的键(出厂未设 = 不存在)
export function stripUndefinedKeys(obj){
	const out = {};
	Object.keys(obj || {}).forEach((k)=>{ if(obj[k] !== undefined){ out[k] = obj[k]; } });
	return out;
}

// 宿主完整缺省:参数表出厂值打底,宿主缺省对象覆盖(两者应一致;宿主对象另可带不在参数表里的常驻键)
export function buildFullDefaults(fields, hostDefaults){
	return stripUndefinedKeys({ ...fieldDefaultsOf(fields), ...(hostDefaults || {}) });
}

// 载入存下的 options:出厂完整缺省打底(fullDefaults 可为函数或对象;缺省 = 空,仍不取会话值)
export function withFullDefaults(fullDefaults, saved){
	let base = null;
	try{ base = typeof fullDefaults === 'function' ? fullDefaults() : fullDefaults; }catch(e){ base = null; }
	const savedObj = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
	return stripUndefinedKeys({ ...(base && typeof base === 'object' ? base : {}), ...savedObj });
}
