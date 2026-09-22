// [Q-164/T-86…T-92] 三式杂项确证子项(SS-18/19/21/22/23/24)源码哨兵 + 标签金标。
import fs from 'fs';
import path from 'path';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../techniqueMountSettings';

const R = (f)=>fs.readFileSync(path.resolve(__dirname, '../../', f), 'utf8');

describe('[Q-164] 三式杂项', ()=>{
	test('SS-18 奇门化解页选题与用神页同源(state → localStorage 已存选题)', ()=>{
		const dm = R('components/dunjia/DunJiaMain.js');
		expect(dm).toContain("computeProtect(pan, { topic: this.state.faAskTopic || loadFaAskTopic(), chartCategory: this.state.chartCategory })");
		expect(dm).not.toContain("topic: this.state.faAskTopic || 'shexin'");
	});
	test('SS-19 昼夜阳阴 只在六壬法贵人时可改:六壬页与合一页都置灰', ()=>{
		// horosa_win_slice_form_v1(Windows 侧移植适配):六壬左栏在我方渲染切片里是独立组件,state 经 props(p)进入,
		// 同一判据的代码形是 `disabled={p.guireng !== 0}`;两形皆认(判据零放宽:仍必须是「贵人≠六壬法 ⇒ 置灰」)。
		const lrSrc = R('components/lrzhan/LiuRengMain.js');
		expect(lrSrc.includes('disabled={this.state.guireng !== 0}') || lrSrc.includes('disabled={p.guireng !== 0}')).toBe(true);
		expect(R('components/sanshi/SanShiUnitedMain.js')).toContain('disabled={Number(opt.guireng) !== 0}');
	});
	test('SS-21 挂载齿轮标签与页面同文:直接时间 / 23点算第二天 / 24点算第二天', ()=>{
		const q = TECHNIQUE_SETTINGS_SCHEMA.qimen.fields;
		const ta = q.find((f)=>f.name === 'timeAlg');
		expect(ta.options.map((o)=>o.label)).toEqual(['真太阳时', '直接时间']);
		const a23 = q.find((f)=>f.name === 'after23NewDay');
		expect(a23.options).toEqual([{ value: 0, label: '24点算第二天' }, { value: 1, label: '23点算第二天' }]);
		expect(TECHNIQUE_SETTINGS_SCHEMA.taiyi.fields.find((f)=>f.name === 'after23NewDay').options[0].label).toBe('24点算第二天');
	});
	test('SS-22 文案漂移六处改真话', ()=>{
		const sh = R('components/help/SanshiHelpDoc.js');
		expect(sh).not.toContain('本页不设此控件');
		expect(sh).not.toContain("'本页不设（固定年符头）");
		expect(sh).toContain('本页无占事类型控件');
		const lh = R('components/help/LiurengHelpDoc.js');
		expect(lh).not.toContain('决定土行长生随四季月或随火行起例');
		expect(lh).toContain('十二长生表本身固定按水土同宫');
		expect(R('components/taiyi/TaiYiMain.js')).not.toContain('改则前端古法重算</div>');
		expect(R('components/dunjia/DunJiaMain.js')).toContain('本项（置闰天数）仅影响「置闰」起局法');
		expect(R('components/sanshi/SanShiUnitedMain.js')).toContain('mode(命局/事局)只管保存去向');
	});
	test('SS-23 方盘/圆盘不再写全局 lrchart(不触发 /chart 重取)', ()=>{
		const src = R('components/lrzhan/LiuRengInput.js');
		expect(src).not.toMatch(/lrchart:\s*\{/);
		expect(src).toContain("safeLocalStorageSet('liurengPanView', val);");
	});
	test('SS-24 合一页 移星值符 / 中宫门位显示 照独立页门控', ()=>{
		const sm = R('components/sanshi/SanShiUnitedMain.js');
		expect(sm).toMatch(/\{opt\.shiftPalace \? \(\s*<label className="horosa-sanshi-select-field">\s*<span>移星值符<\/span>/);
		expect(sm).toMatch(/\{opt\.feiMenZhongCan === false \? \(\s*<label className="horosa-sanshi-select-field">\s*<span>中宫门位显示<\/span>/);
	});
});
