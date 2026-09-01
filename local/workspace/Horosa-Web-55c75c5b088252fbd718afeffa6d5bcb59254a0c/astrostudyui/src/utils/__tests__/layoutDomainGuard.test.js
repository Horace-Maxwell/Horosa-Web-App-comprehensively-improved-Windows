// [版面域根治] 工作区高度决策 × 三引擎语义真值表。
//
// 事故(2026-08-27):旧机缩放 0.8 时全站底部一大条死带,新机同版正常。
// 根因是把「rect 缩放」当「布局缩放」用了——两者在部分引擎上相等,在另一些上不等。
//
// 🔴 本套件的关键设计:**先断言「按旧写法必然算错」,再断言「新写法三种语义全对」**。
// 只测新写法是没有判别力的——旧写法在 E1/E3 上本来就对,不构造 E2 就永远绿。
// 数值不是编的,是两台真机 + 预览浏览器实测(见下表注释)。
import { resolveWorkspaceHeight } from '../zoomDomain';

// 缩放 0.8、物理视口高 900(真实窗口量级;应用最小窗高 760)时的三种引擎语义。
// 比例关系取自实测:旧机 Safari 26.2 在物理 720 下量得布局 900(=720/0.8)、
// documentElement.clientHeight 仍报 720、1000px 元素 rect 仍为 1000。
//   E1 声明了缩放但画面没缩放   —— 假设态,锁住「没缩放时别乱补偿」
//   E2 画面缩放、rect 不反映     —— 旧 MacBook 实测语义
//   E3 画面缩放、rect 反映       —— 预览浏览器实测,新机 Tahoe 同型
const RESERVED = 72;
const MIN = 660;
const ENGINES = [
	{
		code: 'E1', declared: 0.8,
		layoutViewportHeight: 900,       // 画面没缩放 ⇒ 布局空间等于物理空间
		physicalClientHeight: 900,
		rectScale: 1,
		expect: 828,                     // 900 − 72
	},
	{
		code: 'E2', declared: 0.8,
		layoutViewportHeight: 1125,      // 900 / 0.8
		physicalClientHeight: 900,       // clientHeight 仍报物理值
		rectScale: 1,                    // 探针测不到缩放
		expect: 1053,                    // 1125 − 72
	},
	{
		code: 'E3', declared: 0.8,
		layoutViewportHeight: 1125,
		physicalClientHeight: 900,
		rectScale: 0.8,
		expect: 1053,
	},
];

// 出事的那版写法,原样保留在这里当判别向量。
function legacyFormula(e){
	return Math.round(e.physicalClientHeight / e.rectScale) - RESERVED;
}

describe('T1 判别力自证:旧写法必须在 E2 上算错', () => {
	it('🔴 旧写法在 E1/E3 上碰巧正确 —— 所以不构造 E2 的测试永远是绿的', () => {
		expect(legacyFormula(ENGINES[0])).toBe(ENGINES[0].expect);
		expect(legacyFormula(ENGINES[2])).toBe(ENGINES[2].expect);
	});

	it('🔴 旧写法在 E2 上算短一截,且短的比例正好是缩放值(死带的来源)', () => {
		const e = ENGINES[1];
		const got = legacyFormula(e);
		expect(got).toBe(828);
		expect(got).not.toBe(e.expect);
		// 内容只填满窗口的 z 倍 —— 用户照片量出的填充比 ≈0.8,与此吻合
		const fill = (got + RESERVED) / (e.expect + RESERVED);
		expect(fill).toBeCloseTo(e.declared, 6);
	});
});

describe('T2 新写法:三种引擎语义下全部正确', () => {
	ENGINES.forEach((e) => {
		it(`${e.code}:容器在场 → 直接量容器,与缩放语义无关`, () => {
			// 容器天生是布局域,页头占位已含在其高度里
			const containerHeight = e.layoutViewportHeight - RESERVED;
			expect(resolveWorkspaceHeight({
				containerHeight,
				layoutViewportHeight: e.layoutViewportHeight,
				physicalClientHeight: e.physicalClientHeight,
				reserved: RESERVED, min: MIN,
			})).toBe(e.expect);
		});

		it(`${e.code}:容器未挂载 → 退到布局视口实测,仍然正确`, () => {
			expect(resolveWorkspaceHeight({
				containerHeight: null,
				layoutViewportHeight: e.layoutViewportHeight,
				physicalClientHeight: e.physicalClientHeight,
				reserved: RESERVED, min: MIN,
			})).toBe(e.expect);
		});
	});

	it('🔴 决策全程不接受任何缩放值入参 —— 结构上杜绝「除以缩放」这类缺陷复发', () => {
		expect(resolveWorkspaceHeight.length).toBe(1);
		const src = resolveWorkspaceHeight.toString();
		expect(src).not.toMatch(/scale|zoom/i);
	});
});

describe('T3 兜底与边界', () => {
	it('两种直接量法都不可用 → 退物理读数(偏小可接受,拿错值铺死带不可接受)', () => {
		expect(resolveWorkspaceHeight({
			containerHeight: null, layoutViewportHeight: null,
			physicalClientHeight: 900, reserved: RESERVED, min: MIN,
		})).toBe(828);
	});

	it('容器量得 0(未布局/隐藏)不得当真值,要继续往下回落', () => {
		expect(resolveWorkspaceHeight({
			containerHeight: 0, layoutViewportHeight: 1125,
			physicalClientHeight: 900, reserved: RESERVED, min: MIN,
		})).toBe(1053);
	});

	it('非数/负数/NaN 一律跳过,不产出垃圾高度', () => {
		expect(resolveWorkspaceHeight({
			containerHeight: NaN, layoutViewportHeight: -5,
			physicalClientHeight: 900, reserved: RESERVED, min: MIN,
		})).toBe(828);
		expect(resolveWorkspaceHeight({})).toBe(0);
	});

	it('低于下限时钳到下限', () => {
		expect(resolveWorkspaceHeight({
			containerHeight: 100, reserved: RESERVED, min: MIN,
		})).toBe(MIN);
	});
});
