// 三式杂项确证子项(SS-18/19/21/22/23/24)源码哨兵 + 标签金标。
import fs from 'fs';
import path from 'path';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../techniqueMountSettings';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const R = (f)=>readSource(path.resolve(__dirname, '../../', f));

describe('三式杂项', ()=>{
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
	test('手册与界面同说法:六壬「起课」与弹层「确定」两处不打架;遁甲不记住的项列全;一掌经手册指向页头「帮助」', ()=>{
		const lh = R('components/help/LiurengHelpDoc.js');
		expect(lh).toContain('或直接点「起课」，按弹层里改到的时刻起课');
		expect(lh).toContain('时间弹层里改了还没点「确定」的，按弹层里改到的时刻起课');
		expect(lh).not.toContain('时刻微调后未确认者亦按微调值起课');
		// 手册所说有据:起课草稿优先的行为由 lrzhan/__tests__/liurengStartDraftFirst.test.js 锁住
		expect(R('components/help/DunjiaHelpDoc.js')).toContain('盘类、性别、报数、相关人员、移星、封局每盘单设，不记住');
		const yz = R('components/help/YizhangjingHelpDoc.js');
		expect(yz).not.toContain('点操作手册');
		expect(yz.split('点页面右上角「帮助」').length - 1).toBe(2);
	});
	test('SS-23 方盘/圆盘不再写全局 lrchart(不触发 /chart 重取)', ()=>{
		const src = R('components/lrzhan/LiuRengInput.js');
		expect(src).not.toMatch(/lrchart:\s*\{/);
		expect(src).toContain("safeLocalStorageSet('liurengPanView', val);");
	});
	test('置闰天数只在「置闰」起局法 × 时家 / 刻家时显示,奇门页与合一页同一判据', ()=>{
		const cond = "opt.qijuMethod === 'zhirun' && qijuMethodUsesJieqiFa(opt.paiPanType === undefined || opt.paiPanType === null || opt.paiPanType === '' ? 3 : opt.paiPanType) ? (";
		for (const [f, label] of [['components/dunjia/DunJiaMain.js', '<span style={{ fontSize: 12, color: \'var(--horosa-muted, #8c8c8c)\' }}>置闰天数(超神接气置闰法·传本差异)</span>'], ['components/sanshi/SanShiUnitedMain.js', '<span>置闰天数</span>']]) {
			const src = R(f);
			const i = src.indexOf(label);
			expect(i).toBeGreaterThan(0);
			const head = src.slice(Math.max(0, i - 600), i);
			expect(head).toContain(cond);
			expect(src).not.toContain('[3, 4].indexOf(Number(opt.paiPanType');
		}
		const { qijuMethodUsesJieqiFa, PAIPAN_OPTIONS } = require('../../components/dunjia/DunJiaCalc');
		// 判据覆盖排盘体例的全部真实取值(年 0 / 月 1 / 日 2 / 时 3 / 刻 4 / 金函 6),字符串形态同判
		expect(PAIPAN_OPTIONS.map((o)=>o.value)).toEqual([0, 1, 2, 3, 4, 6]);
		expect(PAIPAN_OPTIONS.map((o)=>qijuMethodUsesJieqiFa(o.value))).toEqual([false, false, false, true, true, false]);
		expect(qijuMethodUsesJieqiFa('3')).toBe(true);
		// 奇门择日 / 三式择日工作台(参数区 + 快照参数行)同一判据:两工作台同一份描述(qimenWorkbenchFields),
		// 对排盘体例全部取值 × 起局法与页面判据逐一相同(缺省 = 时家 · 置闰,与引擎缺省同)
		const wb = R('components/zeri/QimenZeriWorkbench.js');
		expect(wb).toContain('QIMEN_ZHIRUN_LEAP_FIELD,');
		const { QIMEN_ZHIRUN_LEAP_FIELD } = require('../../components/zeri/qimenWorkbenchFields');
		PAIPAN_OPTIONS.forEach((pp)=>{ ['zhirun', 'chaibu', 'maoshan', 'shuzi'].forEach((qm)=>{
			expect([pp.value, qm, QIMEN_ZHIRUN_LEAP_FIELD.when({ paiPanType: pp.value, qijuMethod: qm })]).toEqual([pp.value, qm, qm === 'zhirun' && qijuMethodUsesJieqiFa(pp.value)]);
		}); });
		const { buildQimenZeriSnapshotExtra } = require('../../divination/zeri/qimenZeriSnapshot');
		const { ZHIRUN_LEAP_OPTIONS } = require('../../components/dunjia/DunJiaCalc');
		const leapLabel = ZHIRUN_LEAP_OPTIONS.find((o)=>o.value === 9).label;
		const snap = (paiPanType)=>buildQimenZeriSnapshotExtra({ cfg: {}, geo: {}, options: { paiPanType, qijuMethod: 'zhirun', zhirunLeapDays: 9, timeAlg: 0, after23NewDay: 0 }, tree: null, results: [] });
		expect(`${snap(3)}`).toContain(leapLabel);
		expect(`${snap(0)}`).not.toContain(leapLabel);
	});
	test('SS-24 合一页 移星值符 / 中宫门位显示 照独立页门控', ()=>{
		const sm = R('components/sanshi/SanShiUnitedMain.js');
		expect(sm).toMatch(/\{opt\.shiftPalace \? \(\s*<label className="horosa-sanshi-select-field">\s*<span>移星值符<\/span>/);
		expect(sm).toMatch(/\{opt\.feiMenZhongCan === false \? \(\s*<label className="horosa-sanshi-select-field">\s*<span>中宫门位显示<\/span>/);
	});
});
