// 合盘各子页(比较 / 组合 / 时空中点 / 马克斯)共用:把一方的出生参数叠到当前全局 fields 上。
// record / 返回的 params 只提供出生数据 date/time/ad/zone/lat/lon;hsys / zodiacal / siderealAyanamsa 等
// 必须保留左栏当前选择的全局 flds 值,否则左栏 Select 会被 record 老快照覆盖回原值,显示与刚改的不一致。
export function paramsToFields(param, flds){
	let fields = {
		...flds,
		date:{
			value: param.date
		},
		time:{
			value: param.time
		},
		ad: {
			value: param.ad ? param.ad : flds.ad.value,
		},
		zone:{
			value: param.zone
		},
		lat:{
			value: param.lat
		},
		lon:{
			value: param.lon
		},
	}
	return fields;
}
