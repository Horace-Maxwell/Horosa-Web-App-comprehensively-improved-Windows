// 命盘 record → astro.fields 载入还原清单（单一真值源）。
//
// 背景：buildLocalChartRecord(localcharts.js) 保存的排盘选项键，多年来「保存面/参数面(fieldsToParams)
// 加了、载入面(fetchByChartData) 漏了」逐键漂移 → 载入命例后 hsys/zodiacal/termsVariant/guolao*/india*/
// gender 等静默沿用上一张盘的值（透传断链）。本清单被 fetchByChartData 迭代消费，同时被制度化哨兵
// (recordFieldsRestore.test.js) 直接 import 做集合运算：
//   保存键 ∩ fieldsToParams 消费键 ⊆ 本清单 ∪ 手工还原核心键 —— 未来新增「保存+消费」键漏登记即红。
// 新增可还原键 = 此处加一行（parse 与保存侧强转一致）。
//
// 显式不入清单（哨兵按豁免表核对）：
// - AI-builder 直读 record.* 的键（紫微传本族/八字 school/pdDirect 等页面自有 options 直读键）——
//   不在 astro.fields 消费面，走 buildFieldObject/挂载链，已有 aiExportRoundtrip 哨兵。
// - 元数据信封（isPub/creator/updateTime/payload/sourceModule/chartType）。
// - 手工还原核心（cid/birth→date/time/ad/zone/lat/lon/name/pos + memo×8）：无条件覆盖语义，留在 saga。
// 另注：guolaoZiqiMode 在 fields schema 但功能冻结（恒 'real'，不下发不保存）。
// ad(公元前=-1)自全年份域工程起显式保存并在此还原:旧记录无 ad 键→跳过(零回归),
// 新记录与 birth 串前导负号一致(幂等双保险)。

// parse: 'int'|'num'|'str'|'raw'|'object' —— 与 buildLocalChartRecord 保存侧强转一一对应。
export const RECORD_FIELDS_RESTORE_MANIFEST = [
	// ── 既有手写条件块迁入（行为等价）─────────────────────────────
	{ key: 'ad', parse: 'int' },
	{ key: 'gender', parse: 'int' },
	{ key: 'group', parse: 'raw' },
	{ key: 'after23NewDay', parse: 'int' },
	{ key: 'lateZiHourUseNextDay', parse: 'int' },
	{ key: 'timeAlg', parse: 'int' },
	{ key: 'orbs', parse: 'object' },
	{ key: 'orbScale', parse: 'raw' },
	// ── 占星核心排盘选项（fields schema + fieldsToParams 消费）──────
	{ key: 'hsys', parse: 'raw' },
	{ key: 'zodiacal', parse: 'int' },
	{ key: 'siderealAyanamsa', parse: 'str' },
	{ key: 'tradition', parse: 'int' },
	{ key: 'termsVariant', parse: 'int' },        // schema 无此键 → 还原时新建 entry
	{ key: 'doubingSu28', parse: 'num' },
	{ key: 'houseStartMode', parse: 'num' },       // 宿占人事十二宫起宫(ASC/八字):存盘后须还原,否则载入回退默认
	{ key: 'southchart', parse: 'int' },
	{ key: 'strongRecption', parse: 'int' },
	{ key: 'simpleAsp', parse: 'int' },
	{ key: 'virtualPointReceiveAsp', parse: 'int' },
	{ key: 'westNodeType', parse: 'str' },
	{ key: 'sectBuffer', parse: 'str' },
	{ key: 'leoBoundFirst', parse: 'int' },
	{ key: 'triplicity', parse: 'str' },
	{ key: 'lotReversal', parse: 'int' },
	{ key: 'gpsLat', parse: 'raw' },
	{ key: 'gpsLon', parse: 'raw' },
	// ── 主限法视图键（schema + fieldsToParams）───────────────────
	{ key: 'pdMethod', parse: 'raw' },
	{ key: 'pdTimeKey', parse: 'raw' },
	{ key: 'pdtype', parse: 'int' },
	// ── 八字 UI 键（CnTraditionInput 从 fields 消费）───────────────
	{ key: 'phaseType', parse: 'int' },
	{ key: 'godKeyPos', parse: 'raw' },
	{ key: 'adjustJieqi', parse: 'int' },
	// ── 七政四余起盘设置（GuoLaoChartMain guolaoFieldValue/fieldsToParams）─
	{ key: 'guolaoLifeMode', parse: 'raw' },
	{ key: 'guolaoBodyMode', parse: 'raw' },
	{ key: 'guolaoNodeMode', parse: 'raw' },
	{ key: 'guolaoTrueSolarTime', parse: 'raw' },
	{ key: 'guolaoNodeType', parse: 'raw' },
	{ key: 'guolaoLilithType', parse: 'raw' },
	{ key: 'guolaoTuibianMethod', parse: 'raw' },
	{ key: 'guolaoEqTropicalAnchor', parse: 'raw' },
	{ key: 'guolaoAyanamsa', parse: 'str' },
	{ key: 'guolaoGufaPrecess', parse: 'int' },
	// ── 印占（IndiaChartMain 从 fields.* 读，缺键回退默认）─────────
	{ key: 'indiaHsys', parse: 'raw' },
	{ key: 'indiaAyanamsa', parse: 'str' },
	{ key: 'indiaNodeType', parse: 'str' },       // schema 无 → 新建 entry（下同）
	{ key: 'indiaDashaSystem', parse: 'str' },
	{ key: 'indiaSthiraStart', parse: 'str' },
	{ key: 'indiaDashaSeed', parse: 'raw' },
	{ key: 'indiaTransitDate', parse: 'raw' },
	{ key: 'indiaTajakaYear', parse: 'raw' },
	{ key: 'indiaVargaSet', parse: 'raw' },
];

function parseValue(parse, raw){
	if(parse === 'int'){
		const n = parseInt(`${raw}`, 10);
		return Number.isNaN(n) ? undefined : n;
	}
	if(parse === 'num'){
		const n = Number(raw);
		return Number.isNaN(n) ? undefined : n;
	}
	if(parse === 'str'){
		return `${raw}`;
	}
	if(parse === 'object'){
		return raw && typeof raw === 'object' ? raw : undefined;
	}
	return raw; // raw：原样（保存侧亦原样，避免破坏非字符串类型如 vargaSet 数组）
}

// 把 record 里存在的清单键条件还原进 fields —— 纯函数、不可变：
// - 返回新 fields 对象；命中键写入「新 entry」{...旧entry, value}（schema 缺键则新建 {name:[key], value}），
//   使下游 prevProps/值比对能看见变化（旧实现就地改共享 entry → prev 与 next 同对象，比对失明）。
// - record 缺键/null/解析失败(NaN) 一律跳过 → legacy 记录零冲击（保持当前 fields 现值）。
// - 绝不改 baseFields 及其 entry；未命中键保持 entry 同一性。
export function applyRecordToFields(baseFields, record){
	const fields = { ...(baseFields || {}) };
	if(!record || typeof record !== 'object'){
		return fields;
	}
	RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key, parse })=>{
		const raw = record[key];
		if(raw === undefined || raw === null){
			return;
		}
		const value = parseValue(parse, raw);
		if(value === undefined){
			return;
		}
		fields[key] = { ...(fields[key] || { name: [key] }), value };
	});
	return fields;
}

export default { RECORD_FIELDS_RESTORE_MANIFEST, applyRecordToFields };
