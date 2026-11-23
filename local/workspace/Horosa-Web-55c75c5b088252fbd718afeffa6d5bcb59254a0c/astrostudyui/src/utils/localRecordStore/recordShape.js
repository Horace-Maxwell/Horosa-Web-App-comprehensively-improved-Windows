// 本地记录存储 · 记录口径:解析哨兵与安全解析、时刻串、标签与载荷规整、管理 / 展示 / 记账 / 关联字段表与「改了要不要重排」判据、副本剥离、记录迁移
// 从 localRecordStore.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。

// 解析失败的哨兵值(区分「键里是坏串」与「键不在 / 空」)
export const CORRUPT = { corrupt: true };

export function safeParseJson(txt, defVal){
	if(!txt){
		return defVal;
	}
	try{
		return JSON.parse(txt);
	}catch(e){
		return defVal;
	}
}

export function nowStr(){
	const dt = new Date();
	const y = dt.getFullYear();
	const m = String(dt.getMonth() + 1).padStart(2, '0');
	const d = String(dt.getDate()).padStart(2, '0');
	const hh = String(dt.getHours()).padStart(2, '0');
	const mm = String(dt.getMinutes()).padStart(2, '0');
	const ss = String(dt.getSeconds()).padStart(2, '0');
	return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

// 标签(group 字段)解析:JSON 数组串 → 数组;裸字符串 → [它];空 → []。与 listTags 聚合同源口径。
export function parseGroupTags(group){
	if(group === undefined || group === null || group === ''){ return []; }
	if(group instanceof Array){ return group.map((t)=>`${t}`.trim()).filter(Boolean); }
	if(typeof group === 'string'){
		const parsed = safeParseJson(group, null);
		if(parsed instanceof Array){ return parsed.map((t)=>`${t}`.trim()).filter(Boolean); }
		return group.trim() ? [group.trim()] : [];
	}
	return [`${group}`];
}

export function normalizeGroup(group){
	if(group === undefined || group === null || group === ''){
		return null;
	}
	if(group instanceof Array){
		return JSON.stringify(group);
	}
	if(typeof group === 'string'){
		const parsed = safeParseJson(group, null);
		if(parsed instanceof Array){
			return JSON.stringify(parsed);
		}
		return group;
	}
	return JSON.stringify([group]);
}

export function normalizePayload(payload){
	if(payload === undefined || payload === null){
		return null;
	}
	if(typeof payload === 'string'){
		return payload;
	}
	try{
		return JSON.stringify(payload);
	}catch(e){
		return `${payload}`;
	}
}

// 记录级 schema 版本 —— 命盘/事盘此前是全仓唯一「有用户数据、无版本、无迁移器」的存储
// (对照:AI 导出设置 v56 normalize 链/AI 工作区 v5)。
// v1 = 历史无 schemaVersion 字段的记录(隐式);v2 = 加盖版本字段,记录形状无其它变化。
// 盖章点在内核 upsert(buildRecord 之后)而非 buildRecord 字面量:①避开 recordFieldsRestore
// 哨兵的两 tab 键扫描面;②charts/cases 一处覆盖;③版本号只升不降:更新版本来的记录保留原版号
// (未知键已原样保全,回到更新的应用时不该被当旧记录再迁移一遍)。读端宽容(缺字段按 v1)、纯读不回写(零写放大),
// 记录随下次 upsert 触碰自然升版(lazy migration)。
export const LOCAL_RECORD_SCHEMA_VERSION = 2;

// 记录的管理字段(置顶 / 排序 / 归档 / 星标 / 使用足迹):属于「这一条在列表里的状态」,不是记录内容。
// AI 工具禁键(aiTools/catalog FORBIDDEN_ARG_KEYS)须覆盖这一组(合同测试锁)。
export const RECORD_MANAGEMENT_KEYS = ['pinTier', 'pinAt', 'orderKey', 'archived', 'starred', 'lastOpenedAt', 'openCount'];

// 「改了不必重排 / 不必按存案重还原」的记录键(命盘与事盘共用这一份,单一出处):
//   展示字段(标题 / 地名 / 备注 / 分组标签 / 研究三字段)+ 管理字段(上表)+ 记账字段(更新时间 / 版本章 / 删除时刻)
//   + 关联字段(断事日志 / 关系边 / 名人库编号 / AI 来源)。
// 界面之外改了当前那条(AI 提案、别的窗口、导入…)只动这些 → 命盘只重设记录态、不重排;事盘不推进载入代次
// (技法页不按存案整页重还原,页上未存的改动、在途择日扫描、左栏亲手改过的日界都留着)。
// 其余任何键(时间 / 时区 / 经纬 / 性别 / 卦盘内容 / 随盘设置 / 进左栏的分技法批注 / 不认识的新键)一律当作影响起盘。
// 记录上的每个已知键都必须归入这两类之一(caseRestoreExplicitLoadOnly.test.js 分类合同,新键不分类即红)。
export const RECORD_DISPLAY_FIELDS = Object.freeze(['name', 'event', 'pos', 'memo', 'group', 'rodden', 'relation', 'sourceNote']);
export const RECORD_BOOKKEEPING_KEYS = Object.freeze(['updateTime', 'schemaVersion', 'deletedAt']);
export const RECORD_LINK_KEYS = Object.freeze(['journal', 'relations', 'celebrityId', 'aiOrigin']);
export const RECORD_NON_CAST_FIELDS = Object.freeze(Array.from(new Set([
	...RECORD_DISPLAY_FIELDS, ...RECORD_MANAGEMENT_KEYS, ...RECORD_BOOKKEEPING_KEYS, ...RECORD_LINK_KEYS,
])));
// fields = 改了哪些键;没给(整条替换 / 并回 / 恢复,拿不到逐键差异)→ 影响
export function recordChangeAffectsCast(fields){
	if(!Array.isArray(fields)){ return true; }
	return fields.some((k)=>RECORD_NON_CAST_FIELDS.indexOf(k) < 0);
}
// 同一条记录两版逐键比:值不同的键(两版键集并集;值按 JSON 文本比)。供跨窗口 / 整条替换的来源产出「改了哪些」
export function recordChangedFields(before, after){
	const a = before && typeof before === 'object' ? before : {};
	const b = after && typeof after === 'object' ? after : {};
	const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
	return keys.filter((k)=>JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}
// 复制(另存副本 / 历史版本恢复为副本)时去掉的键 = 存储身份 + 管理字段 + 外部身份 / 来源 + 双向关系边。
// 代次标记(fieldsCaptureGen / ziweiSettingsGen)与全部随盘设置、批注、分组都保留:副本载入必须与原件一致。
export const RECORD_COPY_STRIP_KEYS = ['cid', 'schemaVersion', 'deletedAt', 'updateTime', 'preserveUpdateTime',
	...RECORD_MANAGEMENT_KEYS, 'celebrityId', 'aiOrigin', 'relations'];
// 单源复制:返回去掉上表键的浅拷贝;titleKey(命盘 name / 事盘 event)加后缀。
export function toRecordCopy(rec, { titleKey = 'name', suffix = '(副本)' } = {}){
	const dup = { ...(rec || {}) };
	RECORD_COPY_STRIP_KEYS.forEach((k)=>{ delete dup[k]; });
	if(suffix){ dup[titleKey] = `${(rec && rec[titleKey]) || ''}${suffix}`; }
	return dup;
}

// 迁移链(法定落点):未来字段改名/格式变更在此登记 { from, migrate }。
// 链空=恒等快路径(零分配零遍历);v1→v2 仅加盖字段、无内容迁移,故链暂空。
const RECORD_MIGRATIONS = [];

export function applyRecordMigrations(list){
	if(!(list instanceof Array) || !RECORD_MIGRATIONS.length){
		return list;
	}
	return list.map((rec)=>{
		let out = rec;
		let v = parseInt(out && out.schemaVersion, 10) || 1;
		RECORD_MIGRATIONS.forEach((m)=>{
			if(v === m.from){
				const migrated = m.migrate({ ...out });
				out = migrated || out;
				v = m.from + 1;
			}
		});
		return out;
	});
}
