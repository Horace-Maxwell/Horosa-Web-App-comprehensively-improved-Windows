/**
 * 三式外圈随时间校正 金标(horosa_sanshi_outer_follow_time_v1)。
 *
 * 病史(用户实测三轮才定位):已起盘后按时间步进(四分钟一档),中栏表头与奇门/太乙盘都跟着走,
 * **唯独外圈星度(顶/升/金/日/月)冻在起盘那一刻** —— 它的唯一数据源是 props.chartObj。
 * 同一时辰内奇门局与太乙局本就不变,于是整盘看上去「完全没动」;跨时辰才「好」,是因为四柱变了、
 * 别的东西动了掩盖了它。差分实证(同一时刻 17:21):点「确定」→ chartId 换、ASC 288.5→289.51、
 * 顶3→4 升18→19 ✅;按步进 ⊕ → chartId/ASC/外圈逐字不动 ❌。
 *
 * 三条护栏(缺一即复发):
 *   ① componentDidUpdate 不得再加 awaitingChartSync 前置条件 —— 实时传导路径下它恒为 false
 *      (onTimeChanged 先 syncFields 写入 state.fields ⇒ clickPlot 里 patchFields 比出「相等」
 *      ⇒ needChartSync=false ⇒ 闸门没置起),/chart 回流时校正整个被跳过。
 *   ② getOuterChartKey 不得含随机 chartId —— 它每次取盘现生成,拿它当「内容变没变」的判据,
 *      同一时刻重复回流也判「变了」⇒ 每次全量重算(含两条 pan 请求)。
 *   ③ mainChainAbort 默认必须关 —— 见 perfFlags 的 mainChainAbortEnabled 注,两个并发请求
 *      会互相残杀导致 chartObj 永不更新。
 */
import fs from 'fs';
import path from 'path';

// 盘面绘制已单源迁至 SanshiUnitedBoard(择日概览共享;2026-08-30)——渲染锚(outerShift 等
// renderLiuRengMarks 体内常量)在 Board;数据/布局纯函数(getOuterLabelLayout 等)仍在 Main。
// SRC=两文件拼接:既有锚不因迁移改语义,新增渲染改动也逃不出扫描面。
const SRC = fs.readFileSync(path.join(__dirname, '..', 'SanShiUnitedMain.js'), 'utf8')
	+ '\n' + fs.readFileSync(path.join(__dirname, '..', 'SanshiUnitedBoard.js'), 'utf8');
const FLAGS = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'utils', 'perfFlags.js'), 'utf8');

describe('三式外圈随时间校正(horosa_sanshi_outer_follow_time_v1)', () => {
	test('① componentDidUpdate 的 chartObj 校正不带 awaitingChartSync 前置条件', () => {
		const i = SRC.indexOf('componentDidUpdate(prevProps){');
		expect(i).toBeGreaterThan(-1);
		const body = SRC.slice(i, i + 2600);
		// 必须有「chartObj 变了 + 已起盘 ⇒ refreshAll(force)」这条
		expect(body).toMatch(/if\(this\.state\.hasPlotted && chartChanged\)\{/);
		// 反向锚:绝不允许回潮成「awaitingChartSync &&」把校正闸死
		expect(body).not.toMatch(/if\(this\.awaitingChartSync && this\.state\.hasPlotted && chartChanged\)/);
	});

	test('② getOuterChartKey 不得把随机 chartId 纳入判据', () => {
		const i = SRC.indexOf('function getOuterChartKey(');
		expect(i).toBeGreaterThan(-1);
		const body = SRC.slice(i, SRC.indexOf('\n}', i));
		const ret = body.slice(body.lastIndexOf('return ['));
		// 返回数组里不得有裸 chartId 项(注释里提到不算)
		const retCode = ret.split('\n').filter((ln) => !ln.trim().startsWith('//')).join('\n');
		expect(retCode).not.toMatch(/^\s*chartId,\s*$/m);
		// 内容判据必须仍在:ASC/SUN + 日干支 + 时辰 + 天体数
		expect(retCode).toMatch(/ascKey/);
		expect(retCode).toMatch(/sunKey/);
		expect(retCode).toMatch(/dayGanZi/);
	});

	test('③ mainChainAbort 默认关(=== \'1\' 才开,不是 !== \'0\')', () => {
		const i = FLAGS.indexOf('export function mainChainAbortEnabled(');
		expect(i).toBeGreaterThan(-1);
		const body = FLAGS.slice(i, i + 500);
		expect(body).toMatch(/=== '1'/);
		// 反向锚:回潮成默认开的写法即红
		expect(body).not.toMatch(/return flagEnabled\('horosa\.perf\.mainChainAbort'\)/);
	});

	test('外圈数据仍由 props.chartObj 驱动(病灶前提不变,注释不得漂)', () => {
		expect(SRC).toMatch(/outerData = buildOuterData\(astroChart/);
		expect(SRC).toMatch(/const astroChart = chartWrap && chartWrap\.chart \? chartWrap\.chart : null;/);
	});
});

describe('六壬环角宫排版(用户三轮点单定版)', () => {
	test('角宫地支落点回到三角形重心(不是内心——内心叠加外推后会压框)', () => {
		expect(SRC).toMatch(/巳: \{ left: '29\.6%', top: '25\.9%'/);
		expect(SRC).toMatch(/辰: \{ left: '25\.9%', top: '29\.6%'/);
		// 八点两两关于主/副对角线镜像
		expect(SRC).toMatch(/未: \{ left: '70\.4%', top: '25\.9%'/);
		expect(SRC).toMatch(/申: \{ left: '74\.1%', top: '29\.6%'/);
	});

	test('角宫径向外推已调小到 2.0(原 3.1 会把字压出外框)', () => {
		const m = SRC.match(/const outerShift = ([\d.]+);/);
		expect(m).toBeTruthy();
		expect(parseFloat(m[1])).toBeLessThanOrEqual(2.2);
		// 与神将的分离仍要够(否则叠字)
		const m2 = SRC.match(/const innerShift = ([\d.]+);/);
		expect(parseFloat(m[1]) + parseFloat(m2[1])).toBeGreaterThanOrEqual(4.0);
	});

	test('外圈角标:地支去掉贴角位移、宫位数字保留(用户明令「数字位置别变」)', () => {
		const i = SRC.indexOf('function getOuterLabelLayout(');
		const body = SRC.slice(i, SRC.indexOf('\n}\n', i));
		// 四个纵向角宫(辰/申/戌/寅)的 house 仍带 oneGridShift、branch 不带
		const houseHits = (body.match(/house: \{ (?:left|right): px, (?:top|bottom): `calc\([^`]*oneGridShift[^`]*\)` \}/g) || []).length;
		expect(houseHits).toBe(4);
		const branchHits = (body.match(/branch: \{ (?:left|right): px, (?:top|bottom): `calc\([^`]*oneGridShift[^`]*\)` \}/g) || []).length;
		expect(branchHits).toBe(0);
	});
});

describe('遁甲/择日 全屏遮罩已撤为中栏小徽标(用户明令)', () => {
	const DJ = fs.readFileSync(path.join(__dirname, '..', '..', 'dunjia', 'DunJiaMain.js'), 'utf8');
	const LESS = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'layouts', 'app.less'), 'utf8');

	test('DunJiaMain 不再用 <Spin> 包裹整个三栏', () => {
		expect(DJ).not.toMatch(/<Spin spinning=\{this\.state\.loading\}>/);
		expect(DJ).not.toMatch(/^import \{ Spin[,}]/m);
	});

	test('中栏右上角小徽标在位', () => {
		expect(DJ).toMatch(/horosa-workspace-updating horosa-dunjia-updating/);
		expect(LESS).toMatch(/\.horosa-workspace-shell \.horosa-dunjia-updating/);
	});

	test('中栏是定位父(否则 absolute 徽标会飞到窗口角)', () => {
		// ⚠️ 该选择器在媒体查询里另有一份,不能用 indexOf 取第一处(初版即栽在这);
		// 认我们加 position:relative 那一处独有的注释锚。
		const i = LESS.indexOf('中栏内 absolute 小转圈徽标的定位父(见 .horosa-dunjia-updating)');
		expect(i).toBeGreaterThan(-1);
		expect(LESS.slice(i, i + 120)).toMatch(/position: relative;/);
	});
});
