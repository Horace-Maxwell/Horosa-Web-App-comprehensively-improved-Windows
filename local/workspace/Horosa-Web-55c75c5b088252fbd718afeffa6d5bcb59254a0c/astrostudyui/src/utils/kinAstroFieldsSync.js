// KinAstroMain（数算/其他 11 技法宿主）fields→state 同步层。
//
// 背景：宿主在 didMount 把 props.fields 的性别与农历锚点拷进 state（性别下拉兼作「技法内临时切换」
// 控件、锚点供 演禽/南极/蠢子 编辑），但载入命例使 fields 变化时 didUpdate 原先只重取盘、不重同步
// 这些拷贝 → 一掌经/策天等载入命例后性别/锚点停留旧值（透传断链 L2）。
// 🔴 值变化检测必须基于「上次同步来源标记 prevSyncSrc」，不能用 prevProps —— dva saga 历史上就地改
// 共享 entry（prevProps.fields.gender 与 props.fields.gender 同对象），prevProps 值比对天然失明；
// 标记式对任何来源（命盘载入/事盘还原/表单编辑）一律成立。

// 性别归一：命类技法只用二元性别（男/女）；载入的命盘可能带未知性别（-1 等），而性别下拉只有
// 男/女两项 → antd 会把无匹配原始值「-1」直接显示出来。一律归「女=0，其余（含未知/-1/缺失)=男=1」，
// 与算法引擎口径一致（未知作男），杜绝显示层出现「-1」。
import { parseDateParts } from './dateStrSafe';

export function normBinaryGender(g){
	const s = `${g === undefined || g === null ? '' : g}`.trim();
	return (s === '0' || s === '女' || s === 'Female' || s === 'female' || s === 'F') ? '0' : '1';
}

export function parseFieldsDateTime(fields){
	if(!fields || !fields.date || !fields.time || !fields.date.value || !fields.time.value){
		return null;
	}
	const dateStr = fields.date.value.format('YYYY-MM-DD');
	const timeStr = fields.time.value.format('HH:mm:ss');
	// 🔴 BC 串('-12026-07-19')裸 split('-') 会撕成 year=NaN/month=12026 —— NaN 还会让
	// resync 的相等检测(NaN!==NaN)永真,didUpdate→fetchPan 无限风暴;统一走带符号安全解析。
	const dp = parseDateParts(dateStr);
	const t = timeStr.split(':').map((item)=>parseInt(item, 10));
	if(!dp || !Number.isFinite(dp.year) || t.length < 2){
		return null;
	}
	return {
		year: dp.year,
		month: dp.month,
		day: dp.day,
		hour: t[0],
		minute: t[1],
		second: t[2] || 0,
		date: dateStr,
		time: timeStr,
		zone: fields.zone && fields.zone.value ? fields.zone.value : '',
		lat: fields.lat && fields.lat.value ? fields.lat.value : '',
		lon: fields.lon && fields.lon.value ? fields.lon.value : '',
		gender: fields.gender && fields.gender.value !== undefined ? fields.gender.value : 1,
	};
}

// 计算 fields→state 重同步补丁。返回 null（无需变更）或 setState patch（恒含 fieldsSyncSrc 标记）：
// - 性别：仅当 fields 侧归一值相对上次同步真变了才覆盖 state.gender —— 技法内手动切换（只动 state、
//   不动 fields）不更新标记，因此无关的 fields 变化（时间微调等）绝不冲掉手动选择。
// - 农历锚点（演禽 lunar×3 / 南极 nanji×3 / 蠢子 chunzi×2）：仅生辰年月日变了才重排；钳位 30/31/30
//   与 didMount 原逻辑逐字一致。
// - prevSyncSrc=null（首次挂载）→ 全量同步，与原 didMount 手写块值等价。
export function computeKinFieldsResync(fields, prevSyncSrc){
	const dt = parseFieldsDateTime(fields);
	if(!dt){
		return null;
	}
	const src = { gender: normBinaryGender(dt.gender), year: dt.year, month: dt.month, day: dt.day };
	const genderChanged = !prevSyncSrc || prevSyncSrc.gender !== src.gender;
	const dateChanged = !prevSyncSrc || prevSyncSrc.year !== src.year || prevSyncSrc.month !== src.month || prevSyncSrc.day !== src.day;
	if(!genderChanged && !dateChanged){
		return null;
	}
	const next = { fieldsSyncSrc: src };
	if(genderChanged){
		next.gender = src.gender;
	}
	if(dateChanged){
		next.lunarYear = src.year;
		next.lunarMonth = src.month;
		next.lunarDay = Math.min(30, src.day);
		next.nanjiLunarYear = src.year;
		next.nanjiSolarMonth = src.month;
		next.nanjiDay = Math.min(31, src.day);
		next.chunziLunarMonth = src.month;
		next.chunziLunarDay = Math.min(30, src.day);
	}
	return next;
}

export default { normBinaryGender, parseFieldsDateTime, computeKinFieldsResync };
