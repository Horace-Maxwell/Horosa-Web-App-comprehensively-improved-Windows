/**
 * 黄历/农历月历自适应金标(horosa_calendar_cell_fit_v1;用户六轮实告迭代定版):
 * 版式契约——
 *  · 宽不足:字号/间距按 --hl-cell-scale 等比缩(0.55..1,格宽/150);
 *  · 高不足(用户定版「字号绝不因高度缩小」+「随高度缩窄逐渐往上一行收」):
 *    渐进收行 m1→m4(等级叠加):m1 农历并入日号行 → m2 干支与建除·黄黑章·值宿合行
 *    → m3 乌兔并入横流 → m4 宜忌并入(全横流);全量显示、字号原大;
 *  · 等级=「能放下的最浅级」,各级自然高按当前内容+格宽离屏克隆现场实测(零硬编码
 *    阈值表——硬编码 178 链曾致农历板放得下仍被过早合并,用户实告「高度够的时候
 *    也没有正常显示」;横流级自然高又随格宽折行数漂移,唯实测恒准);
 *  · 任何行都不隐藏(display:none 于内容行=违约);overflow:hidden 仅作极端兜底防叠印。
 */
import fs from 'fs';
import path from 'path';

const NL = fs.readFileSync(path.join(__dirname, '..', 'NongLi.js'), 'utf8');
const LESS = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'layouts', 'app.less'), 'utf8');

describe('calendarCellFit(月历自适应·渐进收行定版)', () => {
	it('① NongLi:宽向等比+高向渐进等级(自然高现场实测,选能放下的最浅级)', () => {
		expect(NL).toContain('horosa_calendar_cell_fit_v1');
		expect(NL).toMatch(/Math\.min\(1, cellW \/ 150\)/);
		// 高向绝不缩字:scale 只由宽决定,cellH 只驱动收行等级
		expect(NL).not.toMatch(/cellH.*\/ 150\)|cellH - 57/);
		// 等级=能放下的最浅级(实测链);测量台复刻 class 链+按格宽桶缓存
		expect(NL).toMatch(/measureLevelNaturalHeights\(cellW, cellScale, cellDensity\)/);
		expect(NL).toMatch(/while\(cellVLevel < 4 && hs\[cellVLevel\] > cellH\)/);
		expect(NL).toMatch(/shell\.className = 'horosa-workspace-shell';/);
		expect(NL).toMatch(/Math\.round\(cellW \/ 4\)/);
		// 缓存键必含内容维(同天数不同月宜忌长短≠自然高,只按天数缓存会沿用上月判级)
		expect(NL).toMatch(/lvKey = [\s\S]{0,160}?this\.contentSignature\(\)/);
		expect(NL).toMatch(/contentSignature\(\)\{/);
		// 测量台三重安全:递归守卫 + finally 拆除 + parentNode 守卫(抛错不滞留累积节点)
		expect(NL).toMatch(/if\(this\._measuring\)\{\s*\n\s*return null;/);
		expect(NL).toMatch(/\}finally\{\s*\n\s*this\._measuring = false;/);
		expect(NL).toMatch(/shell\.parentNode\.removeChild\(shell\)/);
		expect(NL).toMatch(/' horosa-cal-m1 horosa-cal-m2 horosa-cal-m3 horosa-cal-m4'/);
		// 等级叠加输出 m1..mN class(m3 态必同时带 m1/m2/m3)
		expect(NL).toMatch(/\[1,2,3,4\]\.filter\(\(n\)=>this\.state\.cellVLevel >= n\)\.map\(\(n\)=>` horosa-cal-m\$\{n\}`\)/);
		expect(NL).toContain('new ResizeObserver');
		expect(NL).toContain("window.addEventListener('resize', this.fitOnWinResize)");
		expect(NL).toContain("window.removeEventListener('resize', this.fitOnWinResize)");
		expect(NL).toMatch(/prevProps\.days !== this\.props\.days/);
		expect(NL).toMatch(/if\(!width \|\| width <= 0\)\{\s*\n\s*return;/);
	});

	it('② less:m1-m4 渐进规则在位(逐级合行)+四类特异度+居中,且不隐藏任何内容行', () => {
		// m1:card 转 row wrap 居中,日号+农历合行;富信息行独占整行居中(cellrich 仍纵排)
		expect(LESS).toMatch(/\.horosa-lunar-calendar\.horosa-cal-m1 \.horosa-lunar-date-card \{[\s\S]{0,200}?flex-direction: row;[\s\S]{0,200}?flex-wrap: wrap;/);
		expect(LESS).toMatch(/horosa-cal-m1 \.horosa-lunar-date-card \{[\s\S]{0,300}?justify-content: center;/);
		expect(LESS).toMatch(/horosa-cal-m1 \.horosa-lunar-date-card \{[\s\S]{0,300}?align-content: center;/);
		expect(LESS).toMatch(/horosa-cal-m1 \.horosa-lunar-date-card > \.ant-row \{[\s\S]{0,120}?width: auto;/);
		expect(LESS).toMatch(/horosa-cal-m1 \.horosa-lunar-date-card > \.ant-row:nth-of-type\(3\) \{[\s\S]{0,120}?width: 100%;/);
		// m2:cellrich 转横流,乌兔/宜忌 basis 100% 各自独行(渐进,非一步全横流)
		expect(LESS).toMatch(/horosa-cal-m2 \.horosa-huangli-cellrich,[\s\S]{0,120}?horosa-cal-m2 \.horosa-nongli-cellrich \{[\s\S]{0,300}?flex-wrap: wrap;/);
		expect(LESS).toMatch(/horosa-cal-m2 \.horosa-hl-cell-wutu,[\s\S]{0,240}?\{[\s\S]{0,80}?flex-basis: 100%;/);
		// m3/m4:乌兔、宜忌逐级并入(basis 回 auto)
		expect(LESS).toMatch(/horosa-cal-m3 \.horosa-hl-cell-wutu \{[\s\S]{0,60}?flex-basis: auto;/);
		expect(LESS).toMatch(/horosa-cal-m4 \.horosa-hl-cell-yi,[\s\S]{0,120}?\{[\s\S]{0,80}?flex-basis: auto;/);
		// 内容行零隐藏契约:密度/渐进规则里不得对内容行下 display:none
		const hideRules = LESS.match(/horosa-cal-(density|m\d)[^{]*\{[^}]*display: none;[^}]*\}/g) || [];
		expect(hideRules.length).toBe(0);
	});

	it('③ less:字号 calc 等比≥11 处+溢出硬兜底', () => {
		const calcCount = (LESS.match(/calc\(\d+px \* var\(--hl-cell-scale, 1\)\)/g) || []).length;
		expect(calcCount).toBeGreaterThanOrEqual(11);
		expect(LESS).toMatch(/horosa-lunar-date-card \{[\s\S]{0,400}?overflow: hidden;/);
	});
});
