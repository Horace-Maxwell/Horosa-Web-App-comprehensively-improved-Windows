// 排盘设置跨会话保留 · 与「载入旧案 / 择日宿主 / 没有控件的页 / 离不开输入的起法」相交处的语义。
//
// 单页、全新会话的行为检查看不见这一层:保存值本身留得住,出事的是它与别的东西相交的地方 ——
//   ① 旧案里没有的键,还原时沿用了本机保存的偏好(应当回出厂值:旧案是按出厂口径存下的);
//   ② 覆盖层 / 子开关表整张落盘,把刚载入的旧案里别的子项也存成了缺省(应当只落亲手改的那一个子键);
//   ③ 择日宿主里内嵌的六壬 / 太乙 / 三式继承了独立页的保存值,而扫描引擎另有钉死口径(点选所见 ≠ 扫描所判);
//   ④ 没有该控件的页也读了共享保存值(看不见的设置暗中改结果);
//   ⑤ 「需要逐课输入」的起法被保留,输入却不保留(重开后是一个带空输入的起法)。
import fs from 'fs';
import path from 'path';
import { definePageSettings } from '../pageSettingsStore';
import { seedShellFromSaved, shellFieldSchema } from '../divinationShellSettings';

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');
const stripComments = (code)=>code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('① 载入旧案:记录里没有的设置键回出厂值', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });

	it('盘壳播种件给出还原基线:字段 = 出厂值、extra 设置键 = 出厂值(出厂不存在的键显式清成 undefined)', ()=>{
		const store = definePageSettings('horosa.horary.settings.v1', { horarySchool: { def: 'classical', oneOf: ['classical', 'modern'] }, horaryOverrides: { type: 'map', sparse: true, keys: { k: { def: '', oneOf: ['a', 'b'] } } }, ...shellFieldSchema(2) });
		store.save({ horarySchool: 'modern', horaryOverrides: { k: 'b' }, hsys: 3, zodiacal: 1, siderealAyanamsa: 'lahiri' });
		const seed = seedShellFromSaved(store, { zodiacal: 0, hsys: 0, termsVariant: 9 }, { questionCategory: 'general' }, ['horarySchool', 'horaryOverrides'], { zodiacal: 0, hsys: 2, termsVariant: 2 });
		// 播种 = 保存值(页面一打开就是你的偏好)
		expect(seed.defaults.hsys).toBe(3);
		expect(seed.initialExtra.horarySchool).toBe('modern');
		// 还原基线 = 出厂值,与保存值无关
		expect(seed.restoreBaseline.fields).toEqual({ zodiacal: 0, hsys: 2, termsVariant: 2, siderealAyanamsa: '' });
		expect(Object.keys(seed.restoreBaseline.extra).sort()).toEqual(['horaryOverrides', 'horarySchool']);
		expect(seed.restoreBaseline.extra.horarySchool).toBeUndefined();
		expect(seed.restoreBaseline.extra.horaryOverrides).toBeUndefined();
	});

	it('没给出厂字段表的页:基线只含盘面三键,取该页 baseDefaults', ()=>{
		const store = definePageSettings('horosa.election.settings.v1', { ...shellFieldSchema(0) });
		const seed = seedShellFromSaved(store, { tradition: 1, zodiacal: 0, hsys: 0 }, { topicId: 'marriage' }, ['westSchool']);
		expect(seed.restoreBaseline.fields).toEqual({ zodiacal: 0, siderealAyanamsa: '', hsys: 0 });
		expect(seed.restoreBaseline.extra).toEqual({ westSchool: undefined });
	});

	it('盘壳的事盘还原用了基线;四个宿主页都把基线传给了壳', ()=>{
		const shell = stripComments(read('components/divination/DivinationChartShell.js'));
		expect(shell).toMatch(/this\.props\.restoreBaseline/);
		expect(shell).toMatch(/if\(patch\[k\] === undefined\)\{ patch\[k\] = baseline\.fields\[k\]; \}/);
		expect(shell).toMatch(/\{ \.\.\.baseline\.extra, \.\.\.ex \}/);
		['components/horary/HoraryMain.js', 'components/election/ElectionMain.js', 'components/mundane/MundaneMain.js', 'components/zeri/TianxingElectionMain.js'].forEach((f)=>{
			expect(stripComments(read(f))).toMatch(/restoreBaseline=\{this\._(?:seed|shellSeed)\.restoreBaseline\}/);
		});
		// 卜卦盘的出厂字段表 = 经典主流那一档(播种用的是「保存的流派」那一档,二者不能混)
		expect(stripComments(read('components/horary/HoraryMain.js'))).toMatch(/\{ zodiacal: 0, \.\.\.horaryBackendFields\('classical'\) \}\)/);
	});

	it('各技法页的事盘还原:缺键回出厂值(fillMissing / defaults),不沿用 state 里的保存值', ()=>{
		expect(stripComments(read('components/lrzhan/LiuRengMain.js'))).toMatch(/Object\.assign\(next, LIURENG_PAGE_SETTINGS\.fillMissing\(next\)\)/);
		expect(stripComments(read('components/jinkou/JinKouMain.js'))).toMatch(/Object\.assign\(next, JINKOU_PAGE_SETTINGS\.fillMissing\(next\)\)/);
		expect(stripComments(read('components/wuzhao/WuZhaoMain.js'))).toMatch(/\.\.\.WUZHAO_PAGE_SETTINGS\.fillMissing\(restored\)/);
		expect(stripComments(read('components/taiyi/TaiYiMain.js'))).toMatch(/\.\.\.this\.state\.options,\s*\.\.\.TAIYI_PAGE_SETTINGS\.defaults\(\),\s*\.\.\.options,/);
		const dj = stripComments(read('components/dunjia/DunJiaMain.js'));
		expect((dj.match(/\.\.\.DUNJIA_PAGE_SETTINGS\.defaults\(\)/g) || []).length).toBe(2);   // 事盘 + 带奇门设置的命盘,两条还原链
		expect((dj.match(/let changed = this\.persistedKeysChanged\(nextOptions\)/g) || []).length).toBe(2);
		expect(stripComments(read('components/sanshi/SanShiUnitedMain.js'))).toMatch(/\.\.\.\(this\.state\.options \|\| \{\}\),\s*\.\.\.factoryOptionKeys,/);
		expect(stripComments(read('components/huangji/HuangJiMain.js'))).toMatch(/method: HUANGJI_PAGE_SETTINGS\.defaults\(\)\.xinyiMethod/);
		const geo = stripComments(read('components/geomancy/GeomancyMain.js'));
		['options', 'entry'].forEach((src)=>{   // 事盘还原 + 历史条目回放,两条链
			['tradition', 'readingScope', 'zodiacSystem', 'planetaryChartZodiac'].forEach((k)=>{
				expect(geo).toContain(`${k}: ${src}.${k} || factory.${k},`);
			});
		});
		expect(geo).not.toMatch(/: \(this\.state\.granular \|\| \{\}\)/);
	});
});

describe('② 覆盖层 / 子开关表只落亲手改的那一个子键', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });

	it('页面里不再有「整张覆盖层落盘」的写法', ()=>{
		expect(stripComments(read('components/horary/HoraryMain.js'))).not.toMatch(/save\(\{ horaryOverrides: next \}\)/);
		expect(stripComments(read('components/election/ElectionMain.js'))).not.toMatch(/save\(\{ electionParams: next \}\)/);
		expect(stripComments(read('components/geomancy/GeomancyMain.js'))).not.toMatch(/save\(\{ granular: next \}\)/);
		expect(stripComments(read('components/taiyi/TaiYiMain.js'))).toMatch(/saveMapEntry\('school', opts\.subKey/);
		expect(stripComments(read('components/sanshi/SanShiUnitedMain.js'))).toMatch(/saveMapEntry\('taiyiSchool', opts\.subKey/);
	});

	it('卜卦判读参数:以库里的覆盖层为底、按库里那个流派的预设判「与预设相同 = 撤销」', ()=>{
		const { HORARY_PAGE_SETTINGS, persistHoraryOverride } = require('../../components/horary/HoraryMain');
		const { HORARY_PARAM_SPEC, schoolOf } = require('../../divination/horary/horarySchools');
		const spec = HORARY_PARAM_SPEC.find((p)=>p.scope === 'horary' && p.type !== 'switch' && Array.isArray(p.options) && p.options.length >= 2 && ['personScope', 'querentGender'].indexOf(p.key) < 0);
		expect(spec).toBeTruthy();
		const sc = schoolOf('classical');
		const preset = sc.backend[spec.key] !== undefined ? sc.backend[spec.key] : sc.judge[spec.key];
		const other = spec.options.map((o)=>o.value).find((v)=>v !== preset);
		// 库里另有一条亲手设的覆盖;此刻界面 state 是别的样子(比如刚载入一份旧案)—— 与落盘无关
		const another = HORARY_PARAM_SPEC.find((p)=>p.scope === 'horary' && p.key !== spec.key && p.type === 'switch' && ['personScope', 'querentGender'].indexOf(p.key) < 0);
		if(another){ HORARY_PAGE_SETTINGS.saveMapEntry('horaryOverrides', another.key, true); }
		persistHoraryOverride(spec.key, other);
		const saved1 = HORARY_PAGE_SETTINGS.loadSaved().horaryOverrides;
		expect(saved1[spec.key]).toBe(other);
		if(another){ expect(saved1[another.key]).toBe(true); }               // 库里原有的那条还在
		persistHoraryOverride(spec.key, preset);                               // 改回预设值 = 撤销该覆盖
		expect(Object.prototype.hasOwnProperty.call(HORARY_PAGE_SETTINGS.loadSaved().horaryOverrides, spec.key)).toBe(false);
		persistHoraryOverride('querentGender', 1);                             // 每一问的输入:不在 schema 子键里 → 不落
		expect(Object.keys(HORARY_PAGE_SETTINGS.loadSaved().horaryOverrides)).not.toContain('querentGender');
	});

	it('卜卦「恢复本档默认」把库里的宫制一并拨回库里那个流派的宫制;塔罗换牌组不把 state 里的牌阵落盘', ()=>{
		expect(stripComments(read('components/horary/HoraryMain.js'))).toMatch(/save\(\{ horaryOverrides: \{\}, hsys: horaryBackendFields\(savedHorarySchoolId\(\)\)\.hsys \}\)/);
		const tarot = stripComments(read('components/tarot/TarotMain.js'));
		expect(tarot).toMatch(/const \{ spreadType: _omitSpread, \.\.\.persistPatch \} = patch;/);
		expect(tarot).toMatch(/TAROT_PAGE_SETTINGS\.save\(persistPatch\)/);
	});
});

describe('③ 择日宿主里内嵌的六壬 / 太乙 / 三式:不读不写独立页的保存值', ()=>{
	it('三页各有 usesSavedSettings(按 techniqueScope 判),读与写都过它', ()=>{
		[['components/lrzhan/LiuRengMain.js', 'liureng', 'LIURENG_PAGE_SETTINGS'], ['components/taiyi/TaiYiMain.js', 'taiyi', 'TAIYI_PAGE_SETTINGS'], ['components/sanshi/SanShiUnitedMain.js', 'sanshiunited', 'SANSHI_PAGE_SETTINGS']].forEach(([f, scope, store])=>{
			const code = stripComments(read(f));
			expect(code).toContain(`return (this.props.techniqueScope || '${scope}') === '${scope}';`);
			// 读:构造函数里取保存值的那一句必须带 usesSavedSettings 判断
			const reads = code.match(new RegExp(`${store}\\.(?:load|loadSaved)\\(\\)`, 'g')) || [];
			const guardedReads = code.match(new RegExp(`this\\.usesSavedSettings\\(\\) \\? ${store}\\.(?:load|loadSaved)\\(\\)`, 'g')) || [];
			expect(reads.length).toBeGreaterThan(0);
			expect(guardedReads.length).toBe(reads.length);
			// 写:每一处 save / saveMapEntry 都在 usesSavedSettings 判断之后
			const lines = code.split('\n');
			lines.forEach((ln, i)=>{
				if(new RegExp(`${store}\\.(?:save|saveMapEntry)\\(`).test(ln)){
					const ctx = lines.slice(Math.max(0, i - 6), i + 1).join('\n');
					expect(ctx).toMatch(/usesSavedSettings\(\)/);
				}
			});
		});
	});
});

describe('④ 没有该控件的页不读共享保存值', ()=>{
	it('南北交逆移:只有真渲染该控件的三页播种;流年法 / 两个返照页 / 波斯向运恒出厂值', ()=>{
		['AstroProfection', 'AstroSolarArc', 'AstroPlanetaryArc'].forEach((n)=>{
			expect(stripComments(read(`components/astro/${n}.js`))).toMatch(/nodeRetrograde: DIRECTION_PAGE_SETTINGS\.load\(\)\.nodeRetrograde/);
		});
		['AstroGivenYear', 'AstroLunarReturn', 'AstroSolarReturn', 'AstroPersianDirected'].forEach((n)=>{
			const code = stripComments(read(`components/astro/${n}.js`));
			expect(code).not.toMatch(/load\(\)\.nodeRetrograde/);
			expect(code).toMatch(/nodeRetrograde: false/);
		});
	});
});

describe('⑤ 离不开逐课输入的起法不保留', ()=>{
	it('六壬起课法候选不含选时 / 演数 / 报数;地占起卦法不含手工种子 / 报数;塔罗种子来源不含手动', ()=>{
		const { LIURENG_PAGE_SETTINGS } = require('../../components/lrzhan/LiuRengMain');
		const lr = LIURENG_PAGE_SETTINGS.schema.castMethod.oneOf;
		['xuanshi', 'yanshu', 'baoshu'].forEach((k)=>expect(lr).not.toContain(k));
		['zheng', 'bake2', 'bmjs', 'alys'].forEach((k)=>expect(lr).toContain(k));
		const { GEOMANCY_PAGE_SETTINGS } = require('../../components/geomancy/GeomancyMain');
		const geo = GEOMANCY_PAGE_SETTINGS.schema.seedMode.oneOf;
		expect(geo).not.toContain('manual'); expect(geo).not.toContain('numbers');
		['random', 'time_seed', 'dice'].forEach((k)=>expect(geo).toContain(k));
		const { TAROT_PAGE_SETTINGS } = require('../../components/tarot/TarotMain');
		expect(TAROT_PAGE_SETTINGS.schema.seedMode.oneOf).toEqual(['birth', 'random']);
		// 选了这些法:本次运行照常用,只是不记 —— 库里仍是上一次选的独立起法
		window.localStorage.clear();
		LIURENG_PAGE_SETTINGS.save({ castMethod: 'bake2' });
		expect(LIURENG_PAGE_SETTINGS.save({ castMethod: 'yanshu' })).toEqual([]);
		expect(LIURENG_PAGE_SETTINGS.load().castMethod).toBe('bake2');
	});
});

describe('七政首开补空:载入了记录不播 / 自定身宫不播 / 择日内嵌实例不播', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });

	it('computeGuolaoSeedPatch', ()=>{
		require('../../models/astro');   // 注册 schema 初值工厂(判「仍是初值」要用)
		const { computeGuolaoSeedPatch } = require('../../components/guolao/GuoLaoChartMain');
		const { setStoredGuolaoNodeType, setStoredGuolaoBodyMode } = require('../../components/guolao/GuoLaoChartStyle');
		const { fieldsSchemaBaseline } = require('../recordFieldsRestore');
		const base = fieldsSchemaBaseline();
		const mk = (over)=>({ ...base, ...(over || {}) });
		setStoredGuolaoNodeType('true');
		// 新盘(没有记录):补
		expect(computeGuolaoSeedPatch(mk()).guolaoNodeType).toEqual({ value: 'true' });
		// 载入了记录(cid 有值):记录说是默认就是默认,不补
		expect(computeGuolaoSeedPatch(mk({ cid: { value: 'rec-1', name: ['cid'] } })).guolaoNodeType).toBeUndefined();
		// 择日宿主里内嵌的那份:不补
		expect(computeGuolaoSeedPatch(mk(), { embedded: true }).guolaoNodeType).toBeUndefined();
		// 已经不是初值(本会话手改 / 记录还原):不动
		expect(computeGuolaoSeedPatch(mk({ guolaoNodeType: { value: 'true', name: ['guolaoNodeType'] } })).guolaoNodeType).toBeUndefined();
		// 自定身宫(某个地支)是给某一位命主手工指定的,不播;太阴 / 酉金这类口径照播
		setStoredGuolaoBodyMode('午');
		expect(computeGuolaoSeedPatch(mk()).guolaoBodyMode).toBeUndefined();
		setStoredGuolaoBodyMode('youjin');
		expect(computeGuolaoSeedPatch(mk()).guolaoBodyMode).toEqual({ value: 'youjin' });
	});

	it('既有三键(宿度制 / 命度 / 罗计)同律:择日内嵌实例整个不播、载入了记录不播(此前内嵌仍会播 → 拿择日时刻改主应用的盘、内嵌盘不出)', ()=>{
		require('../../models/astro');
		const { computeGuolaoSeedPatch } = require('../../components/guolao/GuoLaoChartMain');
		const { setStoredGuolaoSu28Mode, setStoredGuolaoNodeMode, GUOLAO_NODE_MODE_NORTH_RAHU } = require('../../components/guolao/GuoLaoChartStyle');
		const { fieldsSchemaBaseline } = require('../recordFieldsRestore');
		const base = fieldsSchemaBaseline();
		const mk = (over)=>({ ...base, ...(over || {}) });
		setStoredGuolaoSu28Mode(6);
		setStoredGuolaoNodeMode(GUOLAO_NODE_MODE_NORTH_RAHU);
		// 独立页新盘:照播(Q-190 只补空)
		const seeded = computeGuolaoSeedPatch(mk());
		expect(seeded.doubingSu28).toEqual({ value: 6 });
		expect(seeded.guolaoNodeMode).toEqual({ value: GUOLAO_NODE_MODE_NORTH_RAHU });
		// 择日宿主里内嵌:一个键都不播(无头复现:去掉 embedded 早退就会播出 doubingSu28=6)
		expect(computeGuolaoSeedPatch(mk(), { embedded: true })).toEqual({});
		// 载入了记录:既有三键也不播
		const loaded = computeGuolaoSeedPatch(mk({ cid: { value: 'rec-1', name: ['cid'] } }));
		expect(loaded.doubingSu28).toBeUndefined();
		expect(loaded.guolaoLifeMode).toBeUndefined();
		expect(loaded.guolaoNodeMode).toBeUndefined();
	});
});
