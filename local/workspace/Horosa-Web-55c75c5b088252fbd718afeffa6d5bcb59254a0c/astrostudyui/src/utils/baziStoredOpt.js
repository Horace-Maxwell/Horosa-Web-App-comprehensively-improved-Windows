// 八字页保存的选项(localStorage 'baziopt',八字页左栏写):断命流派 / 盘法四项 / 南半球月令 / 年龄口径 / 生肖归属。
// 页面起盘、出快照都读它;AI 挂载按记录重算时,齿轮没设的项回落这一份(与页面同源),齿轮的「现值缺省」也读它。
// 只认各项的合法档(值域与八字页左栏 / 挂载齿轮同表),坏值、别的技法写进来的同名值一律当没设。
export const BAZI_OPT_STORAGE_KEY = 'baziopt';

export const BAZI_OPT_DOMAINS = {
	school: ['zonghe', 'fuyi', 'geju', 'tiaohou', 'bingyao', 'tongguan', 'mangpai', 'nayin'],
	minggongMethod: ['tongxing', 'shufa'],
	fenyeVersion: ['common', 'fajue'],
	southMonth: ['none', 'chong'],
	dayunPrecision: ['precise', 'integer'],
	cangVersion: ['common', 'fenye'],
	ageStyle: ['nominal', 'real'],
	zodiacBoundary: ['lichun', 'lunar'],
};

export function baziOptValueValid(key, value){
	const dom = BAZI_OPT_DOMAINS[key];
	return !!dom && value !== undefined && value !== null && dom.indexOf(`${value}`) >= 0;
}

export function readStoredBaziOpt(){
	try{
		const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(BAZI_OPT_STORAGE_KEY) : null;
		const o = raw ? JSON.parse(raw) : null;
		return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
	}catch(e){
		return {};
	}
}

// 页面保存值(合法才算);没存 / 坏值 → undefined
export function storedBaziOptValue(key){
	const v = readStoredBaziOpt()[key];
	return baziOptValueValid(key, v) ? `${v}` : undefined;
}

// 记录(挂载覆盖并进来的平铺键)优先 → 页面保存值 → 缺省
export function baziOptFromRecord(record, key, def){
	const rv = record && typeof record === 'object' ? record[key] : undefined;
	if(baziOptValueValid(key, rv)){ return `${rv}`; }
	const sv = storedBaziOptValue(key);
	return sv !== undefined ? sv : def;
}
