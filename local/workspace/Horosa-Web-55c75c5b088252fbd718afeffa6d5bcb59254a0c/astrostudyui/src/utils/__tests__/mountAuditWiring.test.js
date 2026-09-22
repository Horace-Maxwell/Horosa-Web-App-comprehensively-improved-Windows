// [挂载自检] 只能源码级锁的接线项(每条对应 findings 编号;字面锚为「判据面」而非注释——见各行说明)。
import fs from 'fs';
import path from 'path';
const UI = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(UI, rel), 'utf8');

it('F-19 数算三页构参带 zone(此前缺 → 真太阳时按 +08:00 校正)', ()=>{
	['components/shusuan/HeLuoMain.js', 'components/shusuan/CanPingMain.js', 'components/shusuan/ZhengChuanMain.js'].forEach((f)=>{
		const src = read(f);
		expect(src).toContain("zone: fieldVal(f, 'zone', '') || (f && f.date && f.date.value && f.date.value.zone) || '',");
	});
});

it('F-23 太玄/荆诀 seed=0 合法(不再当未设改走时间派生)', ()=>{
	['components/taixuan/TaiXuanMain.js', 'components/jingjue/JingJueMain.js'].forEach((f)=>{
		const src = read(f);
		expect(src).toContain('const seed = (Number.isFinite(optSeed) && optSeed >= 0)');
		expect(src).not.toContain('const seed = (Number.isFinite(optSeed) && optSeed > 0)');
	});
});

it('F-20 正传心易性别按记录归一(0/1/女/Female 皆认)', ()=>{
	const src = read('utils/aiAnalysisContext.js');
	expect(src).toContain("gender: kinGenderOverride(record).gender === '0' ? 0 : 1,");
	expect(src).not.toContain("gender: (record && record.gender === 'Female') ? 0 : 1,");
});

it('F-14 七政无头先换位再出快照;F-08 宿度制缺席回退全局', ()=>{
	const gl = read('components/guolao/GuoLaoChartMain.js');
	const i = gl.indexOf('const display = applyGuolaoNodeMode(result, fields) || result;');
	const j = gl.indexOf('return buildGuolaoSnapshotTextV2(params, display, null, fields, rules);');
	expect(i).toBeGreaterThan(0);
	expect(j).toBeGreaterThan(i);
	const ctx = read('utils/aiAnalysisContext.js');
	expect(ctx).toContain("return await buildGuolaoSnapshotForFields(resolveGuolaoFields(record));");
});

it('F-40 演禽:演法五段段头独占一行(段头正则只认整行);calendarMode 值与页面/后端同键', ()=>{
	const yq = read('components/yanqin/yanqinSnapshot.js');
	['[演法·流派]', '[演法·起禽]', '[演法·择日]', '[演法·占卜]', '[演法·投胎]'].forEach((h)=>{
		expect(yq).toContain('`' + h + '\\n');
	});
	const tms = read('utils/techniqueMountSettings.js');
	expect(tms).toContain("{ value: 'solarAsLunar', label: '公历数值入式' }");
	expect(tms).not.toContain("value: 'solarNumeric'");
});

it('F-41 一掌经页构参带 zone', ()=>{
	expect(read('components/yizhangjing/YiZhangJingMain.js')).toContain("zone: fieldVal(f, 'zone', '') || (f && f.date && f.date.value && f.date.value.zone) || '',");
});
