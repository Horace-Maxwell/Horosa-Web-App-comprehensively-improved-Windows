// 主限法表 · 方法 / 钥匙 / 类型缺省、可选列、列 / 影响期 / 页长的本机存储与读取、数组设置按内容比较
// 从 AstroPrimaryDirection.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。

// 🔴 PD_SYNC_REV 只能 import,绝不在此另写字面量。
// 病史:这里曾手抄一份常量,漏跟着 utils/primaryDirectionSync.js 升版 —— 后端响应里的
// pdSyncRev 与本地字面量永不相等 → hasCompleteParams 恒 false → 表格「始终重算」、
// 从不复用已算好的持久化结果。v8→v9 漏改过一次(注释里留了案底),而后又漂到本地 v13
// vs 共享 v15,同一个坑踩了第二次。改成 import 后物理上不可能再漂移。
export const DEFAULT_PD_METHOD = 'core_alchabitius';
export const DEFAULT_PD_TIME_KEY = 'Ptolemy';
const DEFAULT_PD_TYPE = 0;
// 🔴 方位法白名单同样只 import,不在此另写一份 —— 与上面 PD_SYNC_REV 同型的坑:
// 这里曾手抄一份 13 项数组,与 utils/primaryDirectionSync.js 的 export 并行存在。两份"目前
// 内容一致"只是因为改名时恰好两处都改到了,下一次就未必。白名单的语义(全收以免旧存盘
// 静默回退;下拉另有更窄的已核验集)属于共享真值源那一侧,不该在消费端复制。

// ── 报表字段:列可配置(localStorage 持久化;默认只显核心列避免过宽) ──
export const PD_COLUMNS_STORE_KEY = 'horosa.pd.columns.v1';
export const PD_ORB_STORE_KEY = 'horosa.pd.orb.v1';
// key → 标题;core=默认可见。Pole(应星极点)为行级引擎输出,行 shape 5 元锁死不含极点 → 留待后续(不占位)。
// 类型语义已融合进迫星列(glyph+语义文本+相位筛选);黄道世界/钥匙/投影×定局为全局设置
// (工具条与快照已示),不再单列。
export const PD_OPTIONAL_COLUMNS = [
	{ key: 'dc', title: '顺/逆', core: true },
	{ key: 'age', title: '年龄', core: true },
	{ key: 'orb', title: '影响期', core: false },
	{ key: 'pole', title: '极点 Pole', core: false },
];
const PD_DEFAULT_VISIBLE_COLS = PD_OPTIONAL_COLUMNS.filter((c)=>c.core).map((c)=>c.key);

export const PD_PAGE_SIZE_KEY = 'horosa.pd.pageSize';
export const PD_PAGE_SIZE_OPTIONS = ['20', '50', '100', '200'];

export function readPdVisibleCols(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const raw = window.localStorage.getItem(PD_COLUMNS_STORE_KEY);
			if(raw){
				const arr = JSON.parse(raw);
				if(Array.isArray(arr)){
					const allow = PD_OPTIONAL_COLUMNS.map((c)=>c.key);
					const picked = arr.filter((k)=>allow.indexOf(k) >= 0);
					return picked;
				}
			}
		}
	}catch(e){ /* 坏值回默认 */ }
	return PD_DEFAULT_VISIBLE_COLS.slice();
}

export function readPdOrbYears(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const v = Number(window.localStorage.getItem(PD_ORB_STORE_KEY));
			if(Number.isFinite(v) && v > 0 && v <= 10){
				return v;
			}
		}
	}catch(e){ /* 坏值回默认 */ }
	return 0.25;   // 默认前后三个月
}

export function readPdPageSize(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const v = parseInt(window.localStorage.getItem(PD_PAGE_SIZE_KEY), 10);
			if(Number.isFinite(v) && PD_PAGE_SIZE_OPTIONS.indexOf(`${v}`) >= 0){
				return v;
			}
		}
	}catch(e){
		// localStorage 不可用回默认
	}
	return 50;
}

// 数组型设置(应星 / 迫星扩展)按内容比较:同内容的新数组不算变化
export const arrKey = (v)=>(Array.isArray(v) ? v.join('|') : '');
