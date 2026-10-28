// 写入类幂等键的口径(单源):去首尾空白;空串 = 没带键;长度按 Unicode 码点计(与桌面壳 chars().count() 同口径,
// emoji / 扩展区汉字算一个字),上限 200;超长不静默丢 —— 调用方据 error 回明确的参数错。
// 共用用例表 __tests__/fixtures/idempotencyKeyCases.tsv(页面、无头协议层、桌面壳三边对拍)。
export const IDEMPOTENCY_KEY_MAX = 200;
export function normalizeIdempotencyKey(raw){
	if(raw === undefined || raw === null){ return { key: '' }; }
	if(typeof raw !== 'string'){ return { key: '', error: 'not-string' }; }
	const k = raw.trim();
	if(!k){ return { key: '' }; }
	if(Array.from(k).length > IDEMPOTENCY_KEY_MAX){ return { key: '', error: 'too-long' }; }
	return { key: k };
}
export const IDEMPOTENCY_KEY_ERROR_MESSAGE = `幂等键要 1..${IDEMPOTENCY_KEY_MAX} 个字(按字计,去首尾空白)`;
