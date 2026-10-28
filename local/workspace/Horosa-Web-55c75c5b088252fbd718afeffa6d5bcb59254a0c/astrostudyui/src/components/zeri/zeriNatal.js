// 择日工作台「用事人本命」两件的单一出处:本命输入框的构造缺省 + 存案 / 方案里记的本命是否可用。
// 载入存案 / 方案库载入时,没有可用本命 → 本命清空、输入框回构造缺省(不留会话里上一位的出生信息挂在这条下面)。

// 本命输入框的构造缺省(八字 / 紫微 / 六壬 / 三式择日宿主构造函数与载入复位同一份)
export function zeriNatalInputDefault(){
	return { date: '', time: '12:00', zone: '+08:00', gender: 1 };
}

// 存下的本命可用 = 非空的普通对象;null / 数组 / 字符串 / 数字 / {} 一律当没有(外来 / 手写数据)
export function normalizeSavedNatal(natal){
	return natal && typeof natal === 'object' && !Array.isArray(natal) && Object.keys(natal).length ? natal : null;
}

// 存下的输入框 → 叠在构造缺省上(缺的项回缺省,不留会话里的);不是普通对象 → 构造缺省
export function restoredNatalInput(saved){
	const ok = saved && typeof saved === 'object' && !Array.isArray(saved);
	return { ...zeriNatalInputDefault(), ...(ok ? saved : {}) };
}
