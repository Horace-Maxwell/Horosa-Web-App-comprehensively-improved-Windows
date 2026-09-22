// [Q-161/T-79、Q-162/T-80、Q-161/T-81] 三式合一与独立奇门页的「起局」同源 + 右栏隐藏旧控件块不得复辟。
// 病灶范式:
//   ① 同一档在两页各写各的(合一页恒 5 档 + 非时家整个禁用)→ 年/月/日/刻家选不到阴盘、选了阴盘退不出去;
//   ② 控件只活在 display:none 块里 = 用户不可达,却照样进存档与重算指纹(并污染死开关审计指纹);
//   ③ 外圈坐标不进重算签名、快照缓存不按坐标校验 → 存档/导出的「星盘:」行停在旧坐标。
import fs from 'fs';
import path from 'path';
import { qijuMethodOptionsFor, qijuMethodSelectValue, QIJU_METHOD_OPTIONS, QIJU_METHOD_NONSHI_OPTIONS } from '../../dunjia/DunJiaCalc';

const SANSHI = fs.readFileSync(path.resolve(__dirname, '..', 'SanShiUnitedMain.js'), 'utf8');
const DUNJIA = fs.readFileSync(path.resolve(__dirname, '..', '..', 'dunjia', 'DunJiaMain.js'), 'utf8');

describe('起局下拉单一真值源(时家/刻家 5 档,其余 2 档)', () => {
	it('刻家(4)与时家(3)同给完整节气四法 + 阴盘', () => {
		[3, 4].forEach((t) => {
			expect(qijuMethodOptionsFor(t)).toBe(QIJU_METHOD_OPTIONS);
			expect(qijuMethodOptionsFor(t).map((o) => o.value)).toEqual(['zhirun', 'chaibu', 'maoshan', 'wurun', 'shuzi']);
		});
	});

	it('年/月/日家与金函系只给「本家默认 / 阴盘」', () => {
		[0, 1, 2, 6].forEach((t) => {
			expect(qijuMethodOptionsFor(t)).toBe(QIJU_METHOD_NONSHI_OPTIONS);
			expect(qijuMethodOptionsFor(t).map((o) => o.value)).toEqual(['zhirun', 'shuzi']);
		});
	});

	it('回显值:非时家非刻家时,除阴盘外一律显示「本家默认」;时家/刻家如实回显', () => {
		expect(qijuMethodSelectValue(0, 'chaibu')).toBe('zhirun');
		expect(qijuMethodSelectValue(1, 'maoshan')).toBe('zhirun');
		expect(qijuMethodSelectValue(2, 'shuzi')).toBe('shuzi');
		expect(qijuMethodSelectValue(3, 'chaibu')).toBe('chaibu');
		expect(qijuMethodSelectValue(4, 'wurun')).toBe('wurun');   // 刻家初局沿时家链,必须如实回显
	});

	it('两页都走共享件,且合一页不再无条件禁用起局', () => {
		[SANSHI, DUNJIA].forEach((src) => {
			expect(src).toContain('qijuMethodOptionsFor(opt.paiPanType)');
			expect(src).toContain('qijuMethodSelectValue(opt.paiPanType, opt.qijuMethod)');
		});
		expect(SANSHI).not.toContain("disabled={opt.paiPanType !== 3}");
		expect(DUNJIA).not.toContain('QIJU_METHOD_NONSHI_OPTIONS = [');   // 本地手抄副本不得复辟
	});
});

describe('三式合一右栏隐藏旧控件块已删(不得复辟)', () => {
	it("源码不再出现 display:none 的右栏控件块", () => {
		expect(SANSHI).not.toContain("ref={this.captureRightTop}");
		expect(SANSHI).not.toContain("captureRightTop");
		expect(/display:\s*'none'/.test(SANSHI)).toBe(false);
	});

	it('太乙盘式 / 积年法 / 宫制 改由左栏可见控件承接', () => {
		// horosa_win_slice_form_v1:太乙盘式/古法公式两控件在我方切片子组件里绑到 props 处理器(`this.props.onOptionChange`);
		// 子组件自身没有 onOptionChange,上游 `this.onOptionChange` 形在这里是 TypeError —— 两形皆认,但**同一文件内两形只能出现其一**
		// (切片子组件里绝不允许残留 `this.onOptionChange('taiyi…')`,见 check-this-member-binding 门)。
		const _sliceForm = SANSHI.includes("onChange={(v)=>this.props.onOptionChange('taiyiStyle', v)}");
		expect(_sliceForm || SANSHI.includes("onChange={(v)=>this.onOptionChange('taiyiStyle', v)}")).toBe(true);
		expect(SANSHI).toContain(_sliceForm ? "onChange={(v)=>this.props.onOptionChange('taiyiAccum', v)}" : "onChange={(v)=>this.onOptionChange('taiyiAccum', v)}");
		// horosa_win_slice_form_v1(Windows 侧移植适配):合一页左栏在我方渲染切片里是子组件(SanShiInputPanel,见 SanShiUnitedMain 的 render-slice 注记),
		// 处理器经 props 进入,同一控件的代码形是 `this.props.onAstroFieldOptionChange('hsys', v)`;两形皆认(判据零放宽:控件仍必须在且接到同一处理器)。
		expect(
			SANSHI.includes("onChange={(v)=>this.onAstroFieldOptionChange('hsys', v)}")
			|| SANSHI.includes("onChange={(v)=>this.props.onAstroFieldOptionChange('hsys', v)}")
		).toBe(true);
		// 三者都在可见的 XQSideSection 里(隐藏块里的写法带 style={{ width: '100%' }},已随块删除)
		expect(SANSHI).not.toContain("onChange={(v)=>this.onOptionChange('taiyiStyle', v)} style={{ width: '100%' }}");
	});
});

describe('外圈坐标进重算签名并被快照跟随', () => {
	it('recalcSignature 含 outerCoord', () => {
		const at = SANSHI.indexOf('const recalcSignature = [');
		expect(at).toBeGreaterThan(0);
		const block = SANSHI.slice(at, SANSHI.indexOf("].join('|')", at));
		expect(block).toContain('this.state.outerCoord');
	});

	it('三条快照路径统一走 currentOuterData(按当前坐标校验缓存)', () => {
		expect(SANSHI).toContain('currentOuterData(astroChart){');
		expect(SANSHI).toContain('this.outerDataCache.coord === coord');
		// 旧的「只看 data 在不在」写法不得残留
		expect(SANSHI).not.toContain('this.outerDataCache && this.outerDataCache.data\n\t\t\t? this.outerDataCache.data');
		// horosa_win_slice_form_v1:切片子组件里外圈坐标 Select 的写法是 `onChange={(v)=>this.props.onOuterCoordChange(v)}`(同一处理器)。
		expect(
			SANSHI.includes('onChange={this.onOuterCoordChange}')
			|| SANSHI.includes('onChange={(v)=>this.props.onOuterCoordChange(v)}')
		).toBe(true);
	});
});
