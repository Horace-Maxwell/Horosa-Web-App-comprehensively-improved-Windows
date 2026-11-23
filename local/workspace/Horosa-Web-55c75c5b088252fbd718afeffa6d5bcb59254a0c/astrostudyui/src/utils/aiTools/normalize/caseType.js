// AI 助手·事盘类型严格归一:中文/别名 → CASE_TYPE_OPTIONS 内的合法值;fallback 造出的未登记类型一律拒。
// 「可凭时间无头起盘」集合镜像自 aiAnalysisContext.TIME_CASTABLE_DIVINATION(jest toEqual 锁),
// 不在集内的随机起卦类(六爻/塔罗/灵棋/报数…)必须由用户在技法页手动起卦后保存。
import { CASE_TYPE_OPTIONS, getCaseTypeMeta } from '../../localcases';

export const TIME_CASTABLE_MIRROR = ['liureng', 'jinkou', 'qimen', 'taiyi', 'sanshiunited', 'horary', 'election'];
// 另有这几类同样只凭起课时间就能确定地起出来(挂载按起课时间现算、口径冻结在建档时;cast_technique 时点源同一批)。
// 六爻不在内:时间卦要「起出即冻结」卦本身,只凭时间建档会随起卦法设置变 —— 走 cast_divination_case 带卦建档。
export const TIME_CASTABLE_CASE_EXTRA = ['huangji', 'wuzhao', 'taixuan', 'jingjue', 'shenyishu', 'guice', 'xiaoliuren', 'xiaochengtu', 'feigong', 'mundane'];


// 返回 { ok, meta?, code? }:meta = CASE_TYPE_OPTIONS 条目(value/label/subTab/tab/module)
export function normalizeCaseTypeStrict(type){
	const meta = getCaseTypeMeta(type);
	const registered = CASE_TYPE_OPTIONS.some((o)=>o.value === meta.value);
	if(!registered){
		return { ok: false, code: 'E_CASE_TYPE_UNKNOWN' };
	}
	return { ok: true, meta, castable: TIME_CASTABLE_MIRROR.indexOf(meta.module) >= 0 || TIME_CASTABLE_CASE_EXTRA.indexOf(meta.module) >= 0, castAtCreate: TIME_CASTABLE_CASE_EXTRA.indexOf(meta.module) >= 0 };
}
