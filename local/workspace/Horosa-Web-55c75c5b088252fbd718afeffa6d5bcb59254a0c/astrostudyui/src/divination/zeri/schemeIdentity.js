// 择日方案库的「同一条」口径(单一出处,零依赖叶子):方案库自己按它去重(同名再存 = 更新这条,每次换新 id),
// 存储键注册表的全量恢复并集规格引用同一份 —— 此前注册表手写 id:['id'],与方案库「同名覆盖」口径不一,
// 备份之后同名再存过的方案,恢复后同名两份、旧条件回来了。
export const SCHEME_MAX = 60;
export const SCHEME_HISTORY_MAX = 20;

// 方案:名字(去首尾空白)是身份;最近计算历史:每条一个时刻
export const SCHEME_IDENTITY_FIELDS = ['name'];
export const SCHEME_HISTORY_IDENTITY_FIELDS = ['at'];

export function schemeIdentityName(name){
	return String(name === undefined || name === null ? '' : name).trim();
}

export function sameSchemeIdentity(a, b){
	return !!a && !!b && schemeIdentityName(a.name) === schemeIdentityName(b.name);
}

// 全量恢复按条目并集的规格(storageKeyRegistry 十把择日方案键引用这一份)
export const SCHEME_RESTORE_MERGE = Object.freeze({
	shape: 'fields',
	fields: Object.freeze({
		// id 相同(改过名的同一条)或名字相同(同名再存换了新 id)都算同一条
		schemes: Object.freeze({ id: [['id'], SCHEME_IDENTITY_FIELDS], time: 'savedAt', order: 'newest-first', cap: SCHEME_MAX }),
		history: Object.freeze({ id: SCHEME_HISTORY_IDENTITY_FIELDS, time: 'at', order: 'newest-first', cap: SCHEME_HISTORY_MAX }),
	}),
});
