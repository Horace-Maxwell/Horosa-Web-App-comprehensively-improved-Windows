// 命盘储存→载入 全字段透传 · 永久制度化哨兵。
//
// 防的 bug 类：buildLocalChartRecord(保存)/fieldsToParams(消费)/fetchByChartData(载入还原) 三张清单
// 手工各自维护、多年逐键漂移 → 「存了、发了、载入漏了」——载入命例后 hsys/zodiacal/guolao*/gender 等
// 静默沿用上一张盘的值。本哨兵机械推导三集合并做集合运算：未来任何人新增「保存+消费」键而漏登记
// 还原清单，此处立即红——该 bug 类不可复发的机关。
import fs from 'fs';
import path from 'path';
import { RECORD_FIELDS_RESTORE_MANIFEST, applyRecordToFields } from '../recordFieldsRestore';

const SRC_ROOT = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC_ROOT, rel), 'utf8');

// 从 from 起、至其后第一个 until 止的源码切片；找不到直接抛（防标记漂移静默放行）。
function sliceBetween(source, from, until){
	const i = source.indexOf(from);
	if(i < 0){ throw new Error(`源码切片起点丢失: ${from}`); }
	const j = source.indexOf(until, i + from.length);
	if(j < 0){ throw new Error(`源码切片终点丢失: ${until}`); }
	return source.slice(i, j);
}

function extractAll(text, regex){
	const out = new Set();
	let m;
	while((m = regex.exec(text)) !== null){ out.add(m[1]); }
	return out;
}

// ── 三集合机械推导（带最小数量守卫：regex 漂移导致集合塌缩时必红，不静默放行）──────────
const savedKeys = (()=>{
	const slice = sliceBetween(read('utils/localcharts.js'), 'export function buildLocalChartRecord', 'return record;');
	const keys = extractAll(slice, /^\t\t(\w+):/gm);
	expect(keys.size).toBeGreaterThan(70);
	return keys;
})();

const paramsConsumedKeys = (()=>{
	const slice = sliceBetween(read('models/astro.js'), 'function fieldsToParams(fields){', 'function shouldIncludePrimaryDirection');
	const keys = extractAll(slice, /fields\.(\w+)/g);
	expect(keys.size).toBeGreaterThan(30);
	return keys;
})();

const schemaKeys = (()=>{
	const slice = sliceBetween(read('models/astro.js'), 'function newEmptyFields(){', 'return fields;');
	const keys = extractAll(slice, /^\s+(\w+):\s*\{/gm);
	expect(keys.size).toBeGreaterThan(50);
	return keys;
})();

const manifestKeys = new Set(RECORD_FIELDS_RESTORE_MANIFEST.map((item)=>item.key));

// ── 分类登记（与 recordFieldsRestore.js 头注对应；豁免必须给理由，僵尸豁免必红）───────────
// 手工还原核心：无条件覆盖语义（birth 拆 date/time/ad；record 无备注=清空），留在 saga 手工块。
const HAND_RESTORED = ['cid', 'birth', 'zone', 'lat', 'lon', 'name', 'pos',
	'memoAstro', 'memoBaZi', 'memoZiWei', 'memo74', 'memoGua', 'memoLiuReng', 'memoQiMeng', 'memoSuZhan'];
// fieldsToParams 消费键 → record 保存键 的别名（params 读 fields.date/time/ad，保存侧合为 birth）。
const PARAM_TO_RECORD_ALIAS = { date: 'birth', time: 'birth', ad: 'birth' };
// AI-builder 直读 record.* 的键：不在 astro.fields 消费面，走 buildFieldObject/挂载链
// （已有 aiExportRoundtrip.test.js 哨兵守其保存侧枚举与 builder 消费）。
const AI_BUILDER_EXEMPT = {
	sihuaSchool: '紫微四化流派：builder 临时切 ZWSchool 全局单例，页面不走 fields',
	daxianSpan: '紫微传本键（同上）', tianmaBasis: '紫微传本键', starSet: '紫微传本键',
	sanPan: '紫微传本键', shangShi: '紫微传本键', leapMonth: '紫微传本键', lateZi: '紫微传本键',
	yearBoundary: '紫微传本键', huoling: '紫微传本键', kongNaming: '紫微传本键',
	// 星曜亮度 + 六个流派叠层 + 太岁关系人:与上面 11 个传本键同一去向 —— buildChartZiweiParams
	// 据 record.<key> 重算供快照,页面侧由 ziweiOptions 自持,不走 fields。
	brightnessSource: '紫微星曜亮度(同传本键去向)', childLimit: '紫微叠层·童限', zhongxian: '紫微叠层·沈氏三限',
	huoPan: '紫微叠层·活盘(太极点)', qishuWei: '紫微叠层·河洛气数位', borrowPalace: '紫微叠层·中州借宫',
	taiSuiRuGua: '紫微叠层·紫云太岁入卦', taiSuiRelatives: '紫微叠层·太岁关系人生肖(文本,builder 侧归一为数组)',
	school: '八字断命流派：builder 据 record.school 切主标注，页面选择器自持',
	coordSystem: 'AI-builder 从 record 直读组 opts，页面自持（非 fields 消费面）', windowMonths: '同 coordSystem',
	marketPreset: '同 coordSystem',
	pdDirect: '主限法顺逆：星运页自有 options 驱动（buildPrimaryDirectionFetchFields），仅 buildFieldObject 从 record 读',
	pdConverse: '主限法逆向（同上）', pdAntiscia: '主限法映点（同上）', pdTerms: '主限法界（同上）',
};
// 元数据信封：非排盘计算输入，由 user/setCurrentChart 镜像进 user.currentChart。
const METADATA_EXEMPT = {
	isPub: '公开标记', creator: '创建者', updateTime: '更新时间戳',
	payload: '事盘负载信封', sourceModule: '来源技法键', chartType: '盘族标记',
	memo: '通用备注(表单直填,setCurrentChart 镜像,非排盘输入)',
};

describe('命盘储存→载入 全字段透传哨兵（保存/消费/还原 三清单防漂移）', ()=>{
	it('🔴 最强不变量：保存 ∧ fieldsToParams消费 ⇒ 必在还原清单（manifest∪手工核心）', ()=>{
		const consumedAsRecordKeys = new Set([...paramsConsumedKeys].map((k)=>PARAM_TO_RECORD_ALIAS[k] || k));
		const missing = [...savedKeys]
			.filter((k)=>consumedAsRecordKeys.has(k))
			.filter((k)=>!manifestKeys.has(k) && HAND_RESTORED.indexOf(k) < 0);
		expect(missing).toEqual([]); // 红=有键「存了、发了、载入漏还原」——正是本次修的 bug 类
	});

	it('保存 ∧ fields schema 存在 ⇒ 必在还原清单（组件从 fields 直读的键同样不许漏）', ()=>{
		const missing = [...savedKeys]
			.filter((k)=>schemaKeys.has(k))
			.filter((k)=>!manifestKeys.has(k) && HAND_RESTORED.indexOf(k) < 0);
		expect(missing).toEqual([]);
	});

	it('全枚举：每个保存键必有归类（manifest / 手工核心 / AI-builder豁免 / 元数据豁免），零漏网', ()=>{
		const unclassified = [...savedKeys].filter((k)=>
			!manifestKeys.has(k)
			&& HAND_RESTORED.indexOf(k) < 0
			&& !Object.prototype.hasOwnProperty.call(AI_BUILDER_EXEMPT, k)
			&& !Object.prototype.hasOwnProperty.call(METADATA_EXEMPT, k));
		expect(unclassified).toEqual([]); // 红=新增保存键没交代去向（要么进 manifest 要么显式豁免）
	});

	it('僵尸豁免/清单检查：登记键必须仍在保存面；manifest 与豁免互斥', ()=>{
		const allRegistered = [
			...manifestKeys,
			...HAND_RESTORED.filter((k)=>k !== 'cid'), // cid 由 upsert 生成，恒在
			...Object.keys(AI_BUILDER_EXEMPT),
			...Object.keys(METADATA_EXEMPT),
		];
		expect(allRegistered.filter((k)=>!savedKeys.has(k))).toEqual([]); // 红=保存面删键但登记表没跟着删
		const overlap = [...manifestKeys].filter((k)=>
			Object.prototype.hasOwnProperty.call(AI_BUILDER_EXEMPT, k)
			|| Object.prototype.hasOwnProperty.call(METADATA_EXEMPT, k)
			|| HAND_RESTORED.indexOf(k) >= 0);
		expect(overlap).toEqual([]);
	});

	it('接线哨兵：fetchByChartData 走 applyRecordToFields + setF 新entry写，旧就地改型灭绝', ()=>{
		const slice = sliceBetween(read('models/astro.js'), '*fetchByChartData', '*fetchByFields');
		expect(slice).toContain('applyRecordToFields(state.fields, values)');
		expect(slice).toContain('const setF');
		// 就地改共享 entry 的旧型（fields.X.value = ...）不许回潮：① prevProps 值比对失明 ② 失败脏写
		expect(slice).not.toMatch(/fields\.\w+\.value\s*=/);
		// 事盘还原 saga 同款不可变
		const userSlice = sliceBetween(read('models/user.js'), '储存全字段保真', 'getCaseTypeMeta');
		expect(userSlice).toContain('setF(');
		expect(userSlice).not.toMatch(/flds\.\w+\.value\s*=/);
	});
});

describe('applyRecordToFields 行为矩阵（纯函数）', ()=>{
	const base = ()=>({
		gender: { name: ['gender'], value: 1 },
		hsys: { name: ['hsys'], value: 1 },
		zodiacal: { name: ['zodiacal'], value: 0 },
		doubingSu28: { name: ['doubingSu28'], value: 0 },
		guolaoLifeMode: { name: ['guolaoLifeMode'], value: 'asc' },
	});

	it('命中键写「新 entry」（不可变），未命中键保持 entry 同一性，入参不被改', ()=>{
		const b = base();
		const out = applyRecordToFields(b, { gender: 0, hsys: 3 });
		expect(out).not.toBe(b);
		expect(out.gender.value).toBe(0);
		expect(out.hsys.value).toBe(3);
		expect(out.gender).not.toBe(b.gender);       // 新 entry：下游 prev/next 比对可见
		expect(out.zodiacal).toBe(b.zodiacal);        // 未命中：同一性保持
		expect(b.gender.value).toBe(1);               // 入参零污染
	});

	it('record 缺键 / null → 保持现值（legacy 记录零冲击）；空 record 恒等', ()=>{
		const b = base();
		const out = applyRecordToFields(b, { gender: null });
		expect(out.gender.value).toBe(1);
		expect(out.gender).toBe(b.gender);
		const out2 = applyRecordToFields(b, {});
		RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key })=>{
			if(b[key]){ expect(out2[key]).toBe(b[key]); }
		});
	});

	it('schema 缺键（termsVariant/geminiBoundEmended/india*）→ 新建 entry，命例载入即达技法', ()=>{
		const out = applyRecordToFields(base(), { termsVariant: 2, geminiBoundEmended: 1, indiaDashaSystem: 'yogini', indiaVargaSet: [1, 9, 10] });
		expect(out.termsVariant).toEqual({ name: ['termsVariant'], value: 2 });
		expect(out.geminiBoundEmended).toEqual({ name: ['geminiBoundEmended'], value: 1 });
		expect(out.indiaDashaSystem.value).toBe('yogini');
		expect(out.indiaVargaSet.value).toEqual([1, 9, 10]); // raw：数组原样，不被字符串化
	});

	it('解析口径与保存侧一致：int/num 强转、NaN 跳过、str 字符串化、object 拒非对象', ()=>{
		const out = applyRecordToFields(base(), {
			gender: '0', zodiacal: '1', doubingSu28: '2', siderealAyanamsa: 251, orbs: 'not-an-object',
		});
		expect(out.gender.value).toBe(0);
		expect(out.zodiacal.value).toBe(1);
		expect(out.doubingSu28.value).toBe(2);
		expect(out.siderealAyanamsa.value).toBe('251');
		expect(out.orbs).toBeUndefined();             // 非对象 orbs 拒收（保存侧同口径）
		const bad = applyRecordToFields(base(), { gender: 'garbage' });
		expect(bad.gender.value).toBe(1);             // NaN 跳过 → 保持现值
	});

	it('manifest 全键实测：极端 record 每键都被还原（防清单成员写错 key 名）', ()=>{
		const record = {};
		RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key, parse })=>{
			record[key] = parse === 'object' ? { Sun: 8 } : (parse === 'int' || parse === 'num' ? 1 : 'x');
		});
		const out = applyRecordToFields({}, record);
		RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key })=>{
			expect(out[key]).toBeDefined();
			expect(out[key].value).not.toBeUndefined();
		});
	});
});
