// 计算层 / 工具层的文本比对入口:结果只由数据与查询词决定,不随用户此刻的界面简繁变。
// 计算层 / 工具层不直接导入显示层 scriptMode(合同 scriptLayerBoundary.test.js),一律经本件;
// 本件不另写简繁算法:繁简都认的比对 = scriptMode.matchesUserQuery(…, { anyScript: true })(逐位算法 + 放宽一档,与名人库 / 玄史同口径),
// 只用与界面档位无关的入口(anyScript 恒 true;不读 currentScriptMode / isHantActive)。
import { ensureScriptConverter, matchesUserQuery, scriptMatchKey, scriptMatchIndex, scriptTextEquals } from './scriptMode';

// 先按需载入转换器(没载入 = 两边按原文比;载入失败照常回)
export function ensureNeutralMatcher(){
	try{ return Promise.resolve(ensureScriptConverter()).catch(()=>false); }catch(e){ return Promise.resolve(false); }
}

// hay 里是否含 query。raw:true = 两边按原文比(计算引擎用:主线程 / Worker、转换器载没载入都同一结果);ci:不分大小写(缺省是)
export function containsNeutral(hay, query, { raw = false, ci = true } = {}){
	const h = hay === undefined || hay === null ? '' : `${hay}`;
	const q = query === undefined || query === null ? '' : `${query}`;
	if(raw){
		if(!q){ return true; }
		return ci ? h.toLowerCase().indexOf(q.toLowerCase()) >= 0 : h.indexOf(q) >= 0;
	}
	return matchesUserQuery(h, q, { ci, anyScript: true });
}

// 与界面档位无关的折回键(存检索条件用:存时把繁体写法折回简体,之后按原文比)
export function neutralFoldKey(s){
	return scriptMatchKey(s, { anyScript: true });
}

// query 在 hay 里第一次出现的位置(找不到 = -1;繁简都认,与界面档位无关)—— 排序要分「开头命中 / 中间命中」的检索用
export function indexNeutral(hay, query, { ci = true } = {}){
	return scriptMatchIndex(hay, query, { ci, anyScript: true });
}

// 两段文字是否「同一个写法」(繁简都认,与界面档位无关)—— 同名去重用
export function equalsNeutral(a, b, { ci = false } = {}){
	return scriptTextEquals(a, b, { ci, anyScript: true });
}
