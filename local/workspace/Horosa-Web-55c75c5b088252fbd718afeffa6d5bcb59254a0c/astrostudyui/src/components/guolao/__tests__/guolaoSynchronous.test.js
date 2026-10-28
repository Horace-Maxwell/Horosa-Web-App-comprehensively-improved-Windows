// 七政四余 同步宇宙补全 前端压测:身宫法/命主取法/行运法/流派预设/赤道恒星制 全选项笛卡尔不抛 + 值域 + 默认零回归。
import { deriveGuolaoMasters } from '../GuoLaoMoiraPanel';
import {
	GUOLAO_SCHOOL_PRESETS, GUOLAO_LIFE_MASTER_MODES, GUOLAO_MINOR_LIMIT_TYPES,
	getStoredGuolaoBodyMode, setStoredGuolaoBodyMode, getStoredGuolaoSu28Mode, setStoredGuolaoSu28Mode,
	getStoredGuolaoDisplay, setStoredGuolaoDisplay, GUOLAO_DEFAULT_DISPLAY,
} from '../GuoLaoChartStyle';
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const ZHI = '子丑寅卯辰巳午未申酉戌亥'.split('');

describe('七政四余 同步宇宙 前端压测', () => {
	test('命主取法 × 命/身宫 笛卡尔:不抛 + 三主齐全 + 取法切命主', () => {
		const modes = ['gong', 'du', 'dudegrade'];
		ZHI.forEach((lz)=>{
			ZHI.forEach((sz)=>{
				modes.forEach((mode)=>{
					const ms = deriveGuolaoMasters({ zi: lz }, { zi: sz }, '角', '甲', mode);
					expect(ms.lifeMaster).toBeTruthy();        // 命宫宫主
					expect(ms.bodyMaster).toBeTruthy();        // 身宫宫主
					expect(ms.degMaster).toBeTruthy();         // 度主
					expect(ms.lifeMasterStar).toBeTruthy();    // 当前命主
					// 度主/贬宫主 时命主=度主;宫主时=宫主
					if(mode === 'gong'){ expect(ms.lifeMasterStar).toBe(ms.lifeMaster); }
					else { expect(ms.lifeMasterStar).toBe(ms.degMaster); }
				});
			});
		});
	});

	test('流派预设 4 派:fields/display 完备 + 值在合法域', () => {
		const keys = Object.keys(GUOLAO_SCHOOL_PRESETS);
		expect(keys.sort()).toEqual(['guolao', 'huujiao', 'qintang', 'tianguan']);
		keys.forEach((k)=>{
			const p = GUOLAO_SCHOOL_PRESETS[k];
			expect(p.fields).toBeTruthy();
			expect(p.display).toBeTruthy();
			// 身宫法/命度 合法
			expect(['taiyin', 'youjin']).toContain(p.fields.guolaoBodyMode);
			expect(['asc', 'yumao', 'cotrans', 'sunrise']).toContain(p.fields.guolaoLifeMode);
			expect([0, 1, 2, 3, 4, 5]).toContain(p.fields.doubingSu28);
			if(p.display.lifeMasterMode){ expect(GUOLAO_LIFE_MASTER_MODES).toContain(p.display.lifeMasterMode); }
			if(p.display.minorLimitType !== undefined){ expect(GUOLAO_MINOR_LIMIT_TYPES).toContain(p.display.minorLimitType); }
		});
		// 弧角天星=赤道恒星制(5);果老=洞微+贬宫主
		expect(GUOLAO_SCHOOL_PRESETS.huujiao.fields.doubingSu28).toBe(5);
		expect(GUOLAO_SCHOOL_PRESETS.guolao.display.minorLimitType).toBe('dongwei');
		expect(GUOLAO_SCHOOL_PRESETS.guolao.display.lifeMasterMode).toBe('dudegrade');
		expect(GUOLAO_SCHOOL_PRESETS.qintang.fields.guolaoBodyMode).toBe('youjin');
	});

	test('身宫法/宿度制 存取 round-trip(赤道制 5 不被 clamp)', () => {
		expect(setStoredGuolaoBodyMode('youjin')).toBe('youjin');
		expect(getStoredGuolaoBodyMode()).toBe('youjin');
		expect(setStoredGuolaoBodyMode('taiyin')).toBe('taiyin');
		expect(setStoredGuolaoBodyMode('garbage')).toBe('taiyin');   // 兜底
		// 赤道恒星制 5 必须存得住(曾被 clamp[0-4] 回落)
		expect(setStoredGuolaoSu28Mode(5)).toBe(5);
		expect(getStoredGuolaoSu28Mode()).toBe(5);
		expect(setStoredGuolaoSu28Mode(2)).toBe(2);
		expect(setStoredGuolaoSu28Mode(9)).toBe(0);   // 非法兜底默认(荀爽距星)
	});

	test('guolaoDisplay 新键 round-trip + 默认零回归', () => {
		const d = setStoredGuolaoDisplay({ ...GUOLAO_DEFAULT_DISPLAY, lifeMasterMode: 'du', minorLimitType: 'dongwei' });
		expect(d.lifeMasterMode).toBe('du');
		expect(d.minorLimitType).toBe('dongwei');
		// motionState 显示键已删(留伏迟疾列恒显示,键无消费者);仓里不再留该字段。
		expect(d.motionState).toBeUndefined();
		// 非法值兜底
		const d2 = setStoredGuolaoDisplay({ lifeMasterMode: 'x', minorLimitType: 'y' });
		expect(d2.lifeMasterMode).toBe('gong');
		expect(d2.minorLimitType).toBe('');
		// 默认仍古度/宫主/关(零回归)
		expect(GUOLAO_DEFAULT_DISPLAY.lifeMasterMode).toBe('gong');
		expect(GUOLAO_DEFAULT_DISPLAY.minorLimitType).toBe('');
		expect(GUOLAO_DEFAULT_DISPLAY.motionState).toBeUndefined();
		setStoredGuolaoDisplay(GUOLAO_DEFAULT_DISPLAY);   // 复位
	});
});

// 宿法缺省全站统一为荀爽距星(19年测)= 0:七政页首开播种 / 左栏流派反查兜底 / 推运取数兜底 / 挂载齿轮缺省 / 新盘种子 / 后端缺省同值。
describe('宿度制缺省统一 = 荀爽距星(0)', () => {
	const path = require('path');
	const R = (f) => readSource(path.resolve(__dirname, '../../../', f));
	test('什么都没动 = 荀爽:全局未设读出 0,与新盘种子、挂载齿轮缺省、后端缺省一致', () => {
		window.localStorage.removeItem('horosaGuolaoSu28Mode');
		const { GUOLAO_DEFAULT_SU28_MODE } = require('../GuoLaoChartStyle');
		expect(GUOLAO_DEFAULT_SU28_MODE).toBe(0);
		expect(getStoredGuolaoSu28Mode()).toBe(0);
		expect(require('../../../utils/newChartSeeds').newChartSeedValue('doubingSu28')).toBe(0);
		const { getTechniqueSettingsSchema } = require('../../../utils/techniqueMountSettings');
		const su = getTechniqueSettingsSchema('guolao').fields.find((f) => f.name === 'su28Mode');
		expect(su.default).toBe(0);
		// 档名照七政页常量:页面没写「默认」标记,齿轮也不加(缺省档由 default 表达)
		expect(su.options[0]).toEqual({ value: 0, label: '荀爽距星(19年测)' });
		expect(su.options.filter((o) => /默认/.test(o.label)).length).toBe(0);
		expect(readSource(path.resolve(__dirname, '../../../../../astropy/astrostudy/perchart.py'))).toMatch(/^SU28_MODE_REAL = 0$/m);   // 门面 + 子模块全集(宿度口径编号在 perchart_parts/su28_moira.py)
		expect(R('components/guolao/GuoLaoInput.js')).toContain("doubingSu28: fv('doubingSu28', GUOLAO_DEFAULT_SU28_MODE),");
	});
});

// 七政首开「补空」播宿度制:只在七政仓真存过宿度制时才播;宿盘里亲手选过的宿法(新盘种子)不被当成「没表态」冲掉。
describe('宿度制「最后一次亲手选择」两页一致(新盘种子单源;七政仓只作镜像)', () => {
	require('../../../models/astro');   // 登记「新盘基准」工厂(fieldsSchemaBaseline 依赖它)
	const { computeGuolaoSeedPatch } = require('../GuoLaoChartMain');
	const { fieldsSchemaBaseline } = require('../../../utils/recordFieldsRestore');
	const { recordNewChartSeeds, newChartSeedValue, __resetNewChartSeedsForTest } = require('../../../utils/newChartSeeds');
	const fieldsWith = (v) => ({ ...fieldsSchemaBaseline(), doubingSu28: { value: v, name: ['doubingSu28'] } });
	beforeEach(() => { window.localStorage.clear(); __resetNewChartSeedsForTest(); });
	test('首开不再按七政仓补宿度制(新命盘直接按种子起)', () => {
		setStoredGuolaoSu28Mode(6);
		recordNewChartSeeds({ doubingSu28: 2 });
		expect(computeGuolaoSeedPatch(fieldsWith(2)).doubingSu28).toBeUndefined();
		expect(computeGuolaoSeedPatch(fieldsWith(0)).doubingSu28).toBeUndefined();
	});
	test('七政页主页亲手改宿度制 → 记种子 + 写七政仓;择日内嵌实例不记', () => {
		const GuoLaoChartMain = require('../GuoLaoChartMain').default;
		const sent = [];
		const mk = (scope)=>({ props: { dispatch: (a)=>sent.push(a), fields: fieldsWith(0), techniqueScope: scope } });
		GuoLaoChartMain.prototype.onFieldsChange.call(mk(undefined), { doubingSu28: { value: 3 } });
		expect(newChartSeedValue('doubingSu28')).toBe(3);
		expect(window.localStorage.getItem('horosaGuolaoSu28Mode')).toBe('3');
		GuoLaoChartMain.prototype.onFieldsChange.call(mk('qizhengzeri'), { doubingSu28: { value: 6 } });
		expect(newChartSeedValue('doubingSu28')).toBe(3);
	});
	test('宿盘亲手改 → 记种子 + 同步七政仓;只读内嵌宿盘(分至页)两样都不写', () => {
		const SuZhanInput = require('../../suzhan/SuZhanInput').default;
		const mk = (embeddedReadOnly)=>({ props: { onFieldsChange: ()=>{}, embeddedReadOnly } });
		SuZhanInput.prototype.onDoubingSu28Change.call(mk(false), 1);
		expect(newChartSeedValue('doubingSu28')).toBe(1);
		expect(window.localStorage.getItem('horosaGuolaoSu28Mode')).toBe('1');
		SuZhanInput.prototype.onDoubingSu28Change.call(mk(true), 7);
		expect(newChartSeedValue('doubingSu28')).toBe(1);
		expect(window.localStorage.getItem('horosaGuolaoSu28Mode')).toBe('1');
	});
	test('旧版只存在七政仓的宿度制一次性并入种子(老用户维持现状);并入只做一次', () => {
		window.localStorage.setItem('horosaGuolaoSu28Mode', '2');
		expect(newChartSeedValue('doubingSu28')).toBe(2);
		// 之后在宿盘亲手选回荀爽(0 = 内建默认,种子删键):不再被七政仓并回
		recordNewChartSeeds({ doubingSu28: 0 });
		window.localStorage.setItem('horosaGuolaoSu28Mode', '2');
		expect(newChartSeedValue('doubingSu28')).toBe(0);
	});
});
