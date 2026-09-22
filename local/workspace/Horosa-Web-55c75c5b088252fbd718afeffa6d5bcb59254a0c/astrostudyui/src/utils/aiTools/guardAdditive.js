// AI 助手·只增不删运行层守卫(纯函数):参数里出现记录身份/生命周期类禁键一律拒绝——
// 带 cid 走 upsert 即覆盖已有记录;deletedAt/archived 等改的是别人的生命周期。
// 在 runTool 入口对「原始 args」(先于 Ajv 剥未声明键,否则禁键被静默剥掉=零判别力)、
// 在 create_* 内对即将传 upsert 的 values 各跑一次(防实现 bug 而非只防模型)。
// referenceKeys:工具定义里**显式**声明的引用键(如载入工具以 cid 指认要打开的记录)——只有
// def.referenceKeys 放行,schema 里声明不算(目录合同测试锁死:仅 load_record_into_workspace 可声明)。
import { FORBIDDEN_ARG_KEYS, DENIED_TOOL_NAME_RE } from './catalog';

export function findForbiddenKeys(obj, referenceKeys){
	if(!obj || typeof obj !== 'object'){ return []; }
	const refs = Array.isArray(referenceKeys) ? referenceKeys : [];
	return Object.keys(obj).filter((k)=>FORBIDDEN_ARG_KEYS.indexOf(k) >= 0 && refs.indexOf(k) < 0);
}

// 返回 { ok, code?, keys? }
export function guardAdditive(toolName, args, referenceKeys){
	if(DENIED_TOOL_NAME_RE.test(`${toolName || ''}`)){
		return { ok: false, code: 'E_TOOL_NOT_FOUND' };
	}
	const keys = findForbiddenKeys(args, referenceKeys);
	if(keys.length){
		return { ok: false, code: 'E_FORBIDDEN_KEY', keys };
	}
	return { ok: true };
}
