// 择日条件参数的通用字段校验(与具体注册表无关,按 fields 元数据工作)。
// [Q-478/T-440] 单独成模块:十处工作台/弹窗都要用它,若挂在天星 conditionTypes(1000+ 行、自带全套选项表)
// 上,奇门/黄历/六壬等页面只为一个纯函数就把整张天星注册表拖进自己的分包。
//
// 数字框清空后静默取值:表单清空写 `''`,而各求值器普遍 `Number(p.x) || 0` /
// `float(params.get('orb') or 3.0)` —— 清空即被当成 0 或内置默认,用户看着空框、引擎按别的数在扫。
// 统一成「清空即校验提示」:表单(红框 + 行内提示)与各工作台的 draftError(禁用「加入 / 替换」)共用本判据。
export function emptyNumberFieldError(spec, params){
	const fields = (spec && Array.isArray(spec.fields)) ? spec.fields : [];
	const p = params || {};
	for(let i = 0; i < fields.length; i++){
		const f = fields[i];
		if(!f || f.kind !== 'number'){ continue; }
		if(typeof f.showIf === 'function' && !f.showIf(p)){ continue; }
		const v = p[f.key];
		if(v === '' || v === null || v === undefined || !Number.isFinite(Number(v))){
			return `「${f.label || f.key}」不能留空:留空会按 0 或内置默认值求值,请填入数字`;
		}
	}
	return '';
}

export default emptyNumberFieldError;
