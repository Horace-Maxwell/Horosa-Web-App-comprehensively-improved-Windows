// 推运族「行运星与本命星交角容许度」档位表:页面(AstroDirectionForm)与 AI 挂载齿轮同一份。
// 双星容许度相加除以 2(-1)只在返照 / 小限那条取相位路径上成立;太阳弧 / 行星弧 <0 直接按 1° 处理,
// 与「1度」逐字同结果 —— 弧类页面与弧类齿轮都不列这一档。5 度与全局「行运相位容许度」的档位对齐
// (此前页面没有 5 度,全局选 5° 时页面露原始值)。
export const DIRECTION_ASPORB_MEAN = -1;

export const DIRECTION_ASPORB_OPTIONS = [
	{ value: DIRECTION_ASPORB_MEAN, label: '双星容许度相加除以2' },
	{ value: 0.5, label: '0.5度' },
	{ value: 1, label: '1度' },
	{ value: 1.5, label: '1.5度' },
	{ value: 2, label: '2度' },
	{ value: 2.5, label: '2.5度' },
	{ value: 3, label: '3度' },
	{ value: 4, label: '4度' },
	{ value: 5, label: '5度' },
];

export function directionAsporbOptions(arc){
	return arc ? DIRECTION_ASPORB_OPTIONS.filter((o)=>o.value !== DIRECTION_ASPORB_MEAN) : DIRECTION_ASPORB_OPTIONS;
}
