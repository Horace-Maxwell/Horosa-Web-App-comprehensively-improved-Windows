// 命盘档案的两项元数据档位(档案编辑表单、AI 建档 / 提案工具同一份):生辰可信度(Rodden 评级)与关系。
export const RECORD_RODDEN_OPTIONS = Object.freeze([
	{ value: 'AA', label: 'AA 出生记录' },
	{ value: 'A', label: 'A 本人口述' },
	{ value: 'B', label: 'B 传记资料' },
	{ value: 'C', label: 'C 来源不明' },
	{ value: 'DD', label: 'DD 相互矛盾' },
	{ value: 'X', label: 'X 无出生时间' },
]);
export const RECORD_RELATION_OPTIONS = Object.freeze([
	{ value: 'self', label: '自己' },
	{ value: 'family', label: '家人' },
	{ value: 'friend', label: '朋友' },
	{ value: 'client', label: '客户' },
	{ value: 'other', label: '其他' },
]);
export const RECORD_RODDEN_VALUES = Object.freeze(RECORD_RODDEN_OPTIONS.map((o)=>o.value));
export const RECORD_RELATION_VALUES = Object.freeze(RECORD_RELATION_OPTIONS.map((o)=>o.value));
export const RECORD_SOURCE_NOTE_MAX = 200;
