// AI 工作区里「带密钥」的店与字段单源(备份/导出剥密穷举依据;新增带密钥的店必须登记,否则 aiSecretStores.test 红)。
// 此前 unifiedBackup 硬写两个店名;新增第三个带密钥的店会按「宁多带不漏」原样进包。
export const AI_SECRET_STORES = ['provider_profiles', 'integration_profiles'];
export const AI_SECRET_FIELDS = ['apiKey', 'token', 'authorization', 'Authorization', 'secret', 'clientSecret', 'headers.Authorization'];
// [Q-059/M-79] 「鉴权定制(额外请求头)」整表都是令牌位(Authorization / x-api-key / 自建网关任意头名),按表整体剥密。
export const AI_SECRET_MAP_FIELDS = ['providerOptions.extraHeaders'];

export function isSecretStore(name){
	return AI_SECRET_STORES.indexOf(`${name || ''}`) >= 0;
}

// 剥密:顶层密钥字段置空并打 <field>Redacted 标记;headers.Authorization 这类点路径也剥。零依赖,永不抛。
export function redactSecretRecord(rec){
	if(!rec || typeof rec !== 'object' || Array.isArray(rec)){ return rec; }
	const out = { ...rec };
	AI_SECRET_FIELDS.forEach((f)=>{
		if(f.indexOf('.') > 0){
			const [a, b] = f.split('.');
			if(out[a] && typeof out[a] === 'object' && Object.prototype.hasOwnProperty.call(out[a], b)){ out[a] = { ...out[a], [b]: '' }; }
			return;
		}
		if(Object.prototype.hasOwnProperty.call(out, f) && out[f] !== '' && out[f] !== undefined && out[f] !== null){ out[f] = ''; out[`${f}Redacted`] = true; }
	});
	// [Q-059/M-79] 额外请求头:每个非空值置空并打 extraHeadersRedacted(恢复时按 id 取本机值)
	AI_SECRET_MAP_FIELDS.forEach((f)=>{
		const [a, b] = f.split('.');
		const parent = out[a];
		const map = parent && typeof parent === 'object' ? parent[b] : null;
		if(map && typeof map === 'object' && !Array.isArray(map)){
			const stripped = {};
			let any = false;
			Object.keys(map).forEach((k)=>{ const v = map[k]; if(v !== '' && v !== undefined && v !== null){ any = true; stripped[k] = ''; }else{ stripped[k] = v; } });
			if(any){ out[a] = { ...parent, [b]: stripped }; out[`${b}Redacted`] = true; }
		}
	});
	// 解密失败标记/内存态留存密文不进包(是本机状态)
	delete out.apiKeyDecryptFailed;
	delete out.apiKeyCipherKept;
	delete out.extraHeadersDecryptFailed;
	delete out.extraHeadersCipherKept;
	if(Object.prototype.hasOwnProperty.call(rec, 'apiKey')){ out.apiKey = ''; out.apiKeyRedacted = true; }
	return out;
}
