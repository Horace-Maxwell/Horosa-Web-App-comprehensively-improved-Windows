/**
 * 时间即时传导语义金标(horosa_live_time_propagation_v1;用户定版):
 *   · **尚未起盘**:改时间/选项一律不出盘 —— 首盘必须显式点「确定」/「起盘」;
 *   · **已经起盘**:改时间即刻按新时间重算中栏与右栏(方便连续进退),无需再点确定。
 *
 * 旧病:onTimeChanged 只认 confirmed(点「确定」与内联步进才带 true;Popover 里改
 * 年/月/日/时/分/秒带 false)⇒ 用户实告「时间改了盘不动,只有直接时间那栏变」。
 * 修法不是把 confirmed 一律当 true(那会破坏「首盘须显式」),而是让 **hasPlotted**
 * 决定「算不算」、confirmed 只表示「是不是一次显式提交」。
 */
import fs from 'fs';
import path from 'path';

const SANSHI = fs.readFileSync(path.join(__dirname, '..', 'SanShiUnitedMain.js'), 'utf8');
const DUNJIA = fs.readFileSync(path.join(__dirname, '..', '..', 'dunjia', 'DunJiaMain.js'), 'utf8');

describe('liveTimePropagation(时间即时传导·三式/遁甲同款语义)', () => {
	it('① 三式:非 confirmed 且已起盘 ⇒ 走同一条重算链(liveReplot)', () => {
		expect(SANSHI).toContain('horosa_live_time_propagation_v1');
		// 语义锚:hasPlotted 决定算不算
		expect(SANSHI).toMatch(/const liveReplot = !confirmed && !!this\.state\.hasPlotted;/);
		expect(SANSHI).toMatch(/if\(confirmed \|\| liveReplot\)\{/);
		// 重算链仍是「与起盘按钮同一条」——clickPlot 不得被旁路成别的实现
		expect(SANSHI).toMatch(/if\(confirmed \|\| liveReplot\)\{[\s\S]{0,200}?this\.clickPlot\(\);/);
	});

	it('② 三式:未起盘态绝不自动出盘(首盘必须显式)', () => {
		// 中栏未起盘提示必须在(它是「首盘须显式」的可见证据)
		expect(SANSHI).toMatch(/if\(!this\.state\.hasPlotted\)\{[\s\S]{0,120}?点击左侧.{0,4}起盘/);
		// 反向锚:绝不允许把 confirmed 直接当 true(那等于取消首盘显式门)
		expect(SANSHI).not.toMatch(/const confirmed = true;/);
	});

	it('③ 遁甲:同款语义 —— 已起盘才随时间重算,未起盘只落草稿', () => {
		expect(DUNJIA).toContain('horosa_live_time_propagation_v1');
		expect(DUNJIA).toMatch(/this\.setState\(\{ localFields \}, \(\)=>\{\s*\n\s*if\(this\.state\.hasPlotted\)\{\s*\n\s*this\.requestNongli\(localFields, true\);/);
		// 未起盘提示在位
		expect(DUNJIA).toMatch(/点击左侧.{0,4}起盘.{0,12}显示遁甲盘/);
	});

	it('④ 择日内嵌实例天然隔离:hasPlotted 是实例 state 而非模块级单例', () => {
		// 若哪天把 hasPlotted 挪成模块级变量,独立奇门页与择日页会互相误触发
		expect(DUNJIA).not.toMatch(/^let hasPlotted/m);
		expect(DUNJIA).toMatch(/this\.state\.hasPlotted/);
	});
});
