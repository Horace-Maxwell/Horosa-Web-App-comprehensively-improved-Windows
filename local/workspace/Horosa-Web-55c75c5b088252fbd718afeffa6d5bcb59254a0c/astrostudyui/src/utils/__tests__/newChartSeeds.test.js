// 「新盘种子」合同:随盘键(黄道 / 宫制 / 时间算法 / 八字长生·神煞 / 宿法 / 印占 / 主限法口径)的「新命盘缺省 = 上次亲手设的值」。
// 五条语义逐条锁:① 种子表的内建默认 ≡ schema 初值(没存过 = 逐字节零回归)② 亲手改 → 新盘按种子 ③ 载入记录不播(记录优先、缺键回内建默认)
// ④ 存盘捕获按内建默认判非默认(与种子同值也落库)⑤ 各页只在亲手改动入口记种子(源码合同),内嵌宿主不记。
import fs from 'fs';
import path from 'path';
import {
	NEW_CHART_SEED_SPEC, NEW_CHART_SEED_KEYS, NEW_CHART_SEEDS_STORAGE_KEY,
	newChartSeedValue, newChartSeedInternalDefault, newChartSeedExtraEntries, recordNewChartSeeds, recordNewChartSeed,
	resetNewChartSeedKeysToInternalDefaults, subscribeNewChartSeeds, __resetNewChartSeedsForTest,
} from '../newChartSeeds';
import { fieldsSchemaBaseline, applyRecordToFields, captureNonDefaultTechniqueFields, markFieldsCaptured, RECORD_FIELDS_RESTORE_MANIFEST } from '../recordFieldsRestore';
import { DEFAULT_PD_METHOD, DEFAULT_PD_TIME_KEY, DEFAULT_PD_TYPE, DEFAULT_PD_PROJECTION, DEFAULT_PD_FRAME, DEFAULT_PD_FRAMEWORK } from '../primaryDirectionSync';
import '../../models/astro';   // 注册 schema 初值工厂(newEmptyFields)

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

beforeEach(()=>{ window.localStorage.clear(); __resetNewChartSeedsForTest(); });

describe('① 内建默认 ≡ schema 初值(没存过 = 零回归)', ()=>{
	it('schema 本有的种子键:newEmptyFields 初值逐键等于种子表 def;schema 没有的键缺省态不出现', ()=>{
		const base = fieldsSchemaBaseline();
		expect(Object.keys(base).length).toBeGreaterThan(50);
		NEW_CHART_SEED_KEYS.forEach((k)=>{
			const spec = NEW_CHART_SEED_SPEC[k];
			if(spec.inSchema){
				expect(`${k}=${JSON.stringify(base[k] && base[k].value)}`).toBe(`${k}=${JSON.stringify(spec.def)}`);
			}else{
				expect(`${k}:${base[k] === undefined}`).toBe(`${k}:true`);
			}
		});
	});
	it('主限法默认路径不动:pd 种子默认 ≡ primaryDirectionSync 的默认常量(Alcabitius + Ptolemy)', ()=>{
		expect(newChartSeedInternalDefault('pdMethod')).toBe(DEFAULT_PD_METHOD);
		expect(newChartSeedInternalDefault('pdTimeKey')).toBe(DEFAULT_PD_TIME_KEY);
		expect(newChartSeedInternalDefault('pdtype')).toBe(DEFAULT_PD_TYPE);
		expect(newChartSeedInternalDefault('pdProjection')).toBe(DEFAULT_PD_PROJECTION);
		expect(newChartSeedInternalDefault('pdFrame')).toBe(DEFAULT_PD_FRAME);
		expect(newChartSeedInternalDefault('pdFramework')).toBe(DEFAULT_PD_FRAMEWORK);
		expect(newChartSeedInternalDefault('pdParallel')).toBe(0);
		expect(newChartSeedInternalDefault('hsys')).toBe(1);
		expect(newChartSeedInternalDefault('zodiacal')).toBe(0);
		expect(newChartSeedInternalDefault('timeAlg')).toBe(0);
	});
	it('每个种子键都在随盘还原清单里(存得进记录、也还原得回来)', ()=>{
		const manifest = RECORD_FIELDS_RESTORE_MANIFEST.map((m)=>m.key);
		NEW_CHART_SEED_KEYS.forEach((k)=>expect(`${k}:${manifest.indexOf(k) >= 0}`).toBe(`${k}:true`));
	});
	it('每个种子键的内建默认都过自己的合法性检查(null 缺省的除外);默认态存储键不存在', ()=>{
		NEW_CHART_SEED_KEYS.forEach((k)=>{
			const spec = NEW_CHART_SEED_SPEC[k];
			if(spec.def === null){ return; }
			expect(`${k}:${!!spec.check(spec.def)}`).toBe(`${k}:true`);
		});
		expect(window.localStorage.getItem(NEW_CHART_SEEDS_STORAGE_KEY)).toBe(null);
		expect(newChartSeedExtraEntries()).toEqual({});
	});
});

describe('② 亲手改 → 新盘按种子', ()=>{
	it('记一笔后 newEmptyFields 的初值随之变;不合法的值当没存过;改回内建默认即撤键', ()=>{
		expect(recordNewChartSeeds({ hsys: 3, zodiacal: 1, siderealAyanamsa: 'lahiri', timeAlg: 1, phaseType: 2, godKeyPos: '日', doubingSu28: 6 }).sort())
			.toEqual(['doubingSu28', 'godKeyPos', 'hsys', 'phaseType', 'siderealAyanamsa', 'timeAlg', 'zodiacal']);
		const base = fieldsSchemaBaseline();
		expect(base.hsys.value).toBe(3);
		expect(base.zodiacal.value).toBe(1);
		expect(base.siderealAyanamsa.value).toBe('lahiri');
		expect(base.timeAlg.value).toBe(1);
		expect(base.phaseType.value).toBe(2);
		expect(base.godKeyPos.value).toBe('日');
		expect(base.doubingSu28.value).toBe(6);
		// 不合法:忽略(仍按上次合法值)
		expect(recordNewChartSeeds({ hsys: 999, zodiacal: 'x', timeAlg: 9, phaseType: -1, godKeyPos: '月', pdMethod: 'nope' })).toEqual([]);
		expect(fieldsSchemaBaseline().hsys.value).toBe(3);
		// 改回内建默认 = 撤键(与从未改过同形)
		recordNewChartSeeds({ hsys: 1, zodiacal: 0, siderealAyanamsa: '', timeAlg: 0, phaseType: 0, godKeyPos: '年', doubingSu28: 0 });
		expect(newChartSeedValue('hsys')).toBe(1);
		expect(window.localStorage.getItem(NEW_CHART_SEEDS_STORAGE_KEY)).toBe(null);
	});
	it('既收裸值也收 fields entry 形态;非种子键(逐盘输入)自动忽略', ()=>{
		expect(recordNewChartSeeds({ hsys: { value: 2, name: ['hsys'] }, indiaTransitDate: '2026-01-01', indiaTajakaYear: 2026, date: { value: 'x', name: ['date'] } })).toEqual(['hsys']);
		expect(newChartSeedValue('hsys')).toBe(2);
		expect(newChartSeedValue('indiaTransitDate')).toBeUndefined();
	});
	it('schema 本没有的键(印占选项):种子非缺省才新建 entry;缺省态键集逐字节不变', ()=>{
		const before = Object.keys(fieldsSchemaBaseline()).sort();
		recordNewChartSeeds({ indiaNodeType: 'true', indiaSchool: 'jaimini', indiaVargaSet: '1,9', indiaDashaVariants: { a: 1 } });
		const base = fieldsSchemaBaseline();
		expect(base.indiaNodeType).toEqual({ value: 'true', name: ['indiaNodeType'] });
		expect(base.indiaSchool.value).toBe('jaimini');
		expect(base.indiaVargaSet.value).toBe('1,9');
		expect(base.indiaDashaVariants.value).toEqual({ a: 1 });
		recordNewChartSeeds({ indiaNodeType: 'mean', indiaSchool: 'parashari', indiaVargaSet: '1,9,10,12', indiaDashaVariants: null });
		expect(Object.keys(fieldsSchemaBaseline()).sort()).toEqual(before);
	});
	it('主限法:改过的口径只作用于新盘;pd 种子合法性按 primaryDirectionSync 白名单', ()=>{
		expect(recordNewChartSeeds({ pdMethod: 'nope', pdProjection: 'nope', pdFrame: 'nope', pdFramework: 'nope' })).toEqual([]);
		expect(recordNewChartSeeds({ pdtype: 1, pdTimeKey: 'Naibod', pdFrame: 'wholesign', pdParallel: 1 }).sort()).toEqual(['pdFrame', 'pdParallel', 'pdTimeKey', 'pdtype']);
		const base = fieldsSchemaBaseline();
		expect(base.pdtype.value).toBe(1);
		expect(base.pdTimeKey.value).toBe('Naibod');
		expect(base.pdFrame.value).toBe('wholesign');
		expect(base.pdParallel.value).toBe(1);
		expect(base.pdMethod.value).toBe(DEFAULT_PD_METHOD);
	});
	it('订阅:记一笔即广播被改的键', ()=>{
		const seen = [];
		const off = subscribeNewChartSeeds((d)=>seen.push(d.keys.join(',')));
		recordNewChartSeed('hsys', 5);
		recordNewChartSeed('hsys', 5);   // 同值不再广播
		off();
		recordNewChartSeed('hsys', 6);
		expect(seen).toEqual(['hsys']);
	});
});

describe('③ 载入命盘 / 事盘不播:记录优先,缺键回内建默认', ()=>{
	it('种子键在载入记录前复位到内建默认(schema 没有的撤掉);记录里有的键照旧覆盖;不带记录标记的旧记录同样复位', ()=>{
		recordNewChartSeeds({ hsys: 3, zodiacal: 1, timeAlg: 1, pdtype: 1, indiaNodeType: 'true', indiaSchool: 'jaimini' });
		const seeded = fieldsSchemaBaseline();
		expect(seeded.hsys.value).toBe(3);
		expect(seeded.indiaNodeType.value).toBe('true');
		// 旧记录(无捕获标记):缺键 = 复位到内建默认,不是保留种子
		const loadedLegacy = applyRecordToFields(seeded, { cid: 'rec-legacy', hsys: 5 });
		expect(loadedLegacy.hsys.value).toBe(5);        // 记录里有 → 记录优先
		expect(loadedLegacy.zodiacal.value).toBe(0);    // 记录里没有 → 内建默认,不是种子 1
		expect(loadedLegacy.timeAlg.value).toBe(0);
		expect(loadedLegacy.pdtype.value).toBe(0);
		expect(loadedLegacy.indiaNodeType).toBeUndefined();
		expect(loadedLegacy.indiaSchool).toBeUndefined();
		// 带捕获标记的记录:同样;记录里的显式值优先
		const marked = markFieldsCaptured({ cid: 'rec-marked', zodiacal: 1, indiaNodeType: 'true' });
		const loaded = applyRecordToFields(seeded, marked);
		expect(loaded.hsys.value).toBe(1);
		expect(loaded.zodiacal.value).toBe(1);
		expect(loaded.timeAlg.value).toBe(0);
		expect(loaded.indiaNodeType.value).toBe('true');
		expect(loaded.indiaSchool).toBeUndefined();
	});
	it('resetNewChartSeedKeysToInternalDefaults 只动 fields 里已有的种子键;空对象不变', ()=>{
		expect(resetNewChartSeedKeysToInternalDefaults({})).toEqual({});
		const out = resetNewChartSeedKeysToInternalDefaults({ hsys: { value: 4, name: ['hsys'] }, indiaSchool: { value: 'x', name: ['indiaSchool'] }, foo: { value: 1 } });
		expect(out).toEqual({ hsys: { value: 1, name: ['hsys'] }, foo: { value: 1 } });
	});
});

describe('④ 存盘捕获按内建默认判非默认', ()=>{
	it('与种子同值的口径也落库(换机 / 改种子后旧盘不漂);内建默认不落;schema 没有的种子键出现即落', ()=>{
		recordNewChartSeeds({ hsys: 3, timeAlg: 1, indiaNodeType: 'true' });
		const fields = fieldsSchemaBaseline();   // 新盘 = 种子值
		const out = captureNonDefaultTechniqueFields(fields);
		expect(out.hsys).toBe(3);
		expect(out.timeAlg).toBe(1);
		expect(out.indiaNodeType).toBe('true');
		expect(out.zodiacal).toBeUndefined();
		expect(out.pdMethod).toBeUndefined();
		// 存 → 载:往返保真(载入后与存前逐键相同)
		const loaded = applyRecordToFields(fieldsSchemaBaseline(), markFieldsCaptured({ cid: 'r', ...out }));
		expect(loaded.hsys.value).toBe(3);
		expect(loaded.timeAlg.value).toBe(1);
		expect(loaded.indiaNodeType.value).toBe('true');
	});
});

describe('⑤ 源码合同:各页只在亲手改动入口记种子;内嵌宿主不记', ()=>{
	it('模型 / 还原件接线在位', ()=>{
		const model = read('models/astro.js');
		NEW_CHART_SEED_KEYS.filter((k)=>NEW_CHART_SEED_SPEC[k].inSchema).forEach((k)=>expect(model).toContain(`value: newChartSeedValue('${k}')`));
		expect(model).toContain('...newChartSeedExtraEntries(),');
		const app = read('models/app.js');
		expect(app).toContain("pdMethod: newChartSeedValue('pdMethod')");
		expect(app).toContain("appst.pdTimeKey || newChartSeedValue('pdTimeKey')");
		const restore = read('utils/recordFieldsRestore.js');
		expect(restore).toContain('fields = resetNewChartSeedKeysToInternalDefaults(fields);');
		expect(restore).toContain("isNewChartSeedKey(key) ? newChartSeedInternalDefault(key)");
	});
	it('七处亲手改动入口都记种子,且都在「非内嵌 / 独立页」门后', ()=>{
		expect(read('pages/index.js')).toContain('seedNewCharts /*');
		const chart = read('components/astro/AstroChartMain.js');
		expect(chart).toContain('if(this.props.seedNewCharts){ recordNewChartSeeds(patch); }');
		expect((chart.match(/this\.noteSeeds\(/g) || []).length).toBe(3);   // 黄道 / 宫制 / 流派预设
		const bazi = read('components/cntradition/BaZi.js');
		expect(bazi).toMatch(/if\(!this\.props\.techniqueScope\)\{[\s\S]{0,400}recordNewChartSeeds\(/);
		const ziwei = read('components/ziwei/ZiWeiMain.js');
		expect(ziwei).toContain("if(!this.props.techniqueScope && patch.timeAlg !== undefined){");
		const sanshi = read('components/sanshi/SanShiUnitedMain.js');
		expect((sanshi.match(/if\(this\.usesSavedSettings\(\)\)\{ recordNewChartSeeds\(/g) || []).length).toBe(2);
		expect(read('components/suzhan/SuZhanInput.js')).toContain('recordNewChartSeeds({ doubingSu28: val });');
		const india = read('components/astro/IndiaChartMain.js');
		expect(india).toContain('recordNewChartSeeds(patch);');
		// 载入记录 / 新命盘(cid 变)时 fields 里缺席的印占键回出厂值:否则 schema 本没有的种子键在载入记录后仍留着种子值(普查实抓)
		expect(india).toContain('if(cidOf(this.props.fields) !== cidOf(prevProps.fields) && this._indiaOptionStateDefaults){');
		expect(india).toContain('this._indiaOptionStateDefaults[state] = Array.isArray(v) ? v.slice()');
		expect(read('components/direction/AstroDirectMain.js')).toContain('pdMethod, pdTimeKey, pdtype: opt.pdtype === 1 ? 1 : 0,');
		// 八字左栏的「时间算法」仍是本页覆盖层:BaZi 不把 timeAlg 记成种子
		expect(bazi).not.toMatch(/recordNewChartSeeds\(\{[^}]*timeAlg/);
	});
	it('全局设置弹窗有「时间算法」缺省项,读写同一仓', ()=>{
		const header = read('components/homepage/PageHeader.js');
		expect(header).toContain('时间算法（新命盘的缺省）');
		expect(header).toContain("recordNewChartSeeds({ timeAlg:");
		expect(header).toContain("newChartSeedValue('timeAlg')");
	});
});
