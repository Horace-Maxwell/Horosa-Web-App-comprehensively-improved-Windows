// 七政四余 同步宇宙补全 前端压测:身宫法/命主取法/行运法/流派预设/赤道恒星制 全选项笛卡尔不抛 + 值域 + 默认零回归。
import { deriveGuolaoMasters } from '../GuoLaoMoiraPanel';
import {
	GUOLAO_SCHOOL_PRESETS, GUOLAO_LIFE_MASTER_MODES, GUOLAO_MINOR_LIMIT_TYPES,
	getStoredGuolaoBodyMode, setStoredGuolaoBodyMode, getStoredGuolaoSu28Mode, setStoredGuolaoSu28Mode,
	getStoredGuolaoDisplay, setStoredGuolaoDisplay, GUOLAO_DEFAULT_DISPLAY,
} from '../GuoLaoChartStyle';

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
		expect(setStoredGuolaoSu28Mode(9)).toBe(2);   // 非法兜底默认
	});

	test('guolaoDisplay 新键 round-trip + 默认零回归', () => {
		const d = setStoredGuolaoDisplay({ ...GUOLAO_DEFAULT_DISPLAY, lifeMasterMode: 'du', minorLimitType: 'dongwei' });
		expect(d.lifeMasterMode).toBe('du');
		expect(d.minorLimitType).toBe('dongwei');
		// [Q-193/T-137] motionState 显示键已删(留伏迟疾列恒显示,键无消费者);仓里不再留该字段。
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
