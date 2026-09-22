// AI 助手·性别归一:模型侧枚举 male/female/unknown → 存档整数 1/0/-1。
// 事盘落库层「present 才落」且 0=女为合法值,故事盘的 unknown 必须返回 undefined(不传键)。
export const GENDER_ENUM = ['male', 'female', 'unknown'];

export function normalizeGender(value, { forCase = false } = {}){
	const v = `${value === undefined || value === null ? 'unknown' : value}`.trim().toLowerCase();
	if(v === 'male' || v === '男' || v === '1'){ return 1; }
	if(v === 'female' || v === '女' || v === '0'){ return 0; }
	return forCase ? undefined : -1;
}
