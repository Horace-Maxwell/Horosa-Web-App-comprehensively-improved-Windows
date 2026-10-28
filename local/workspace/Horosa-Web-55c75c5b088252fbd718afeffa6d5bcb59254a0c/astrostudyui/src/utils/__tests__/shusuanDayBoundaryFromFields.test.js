// 数算四页(河洛/参评/正传/一掌经)日界与晚子时读盘面 fields(与八字页、AI 挂载同源),缺席才回退全局;此前恒读全局。
// 取值一律经单源 chartDayBoundary(utils/dayBoundaryResolve),行为锁见 chartDayBoundarySingleSource。
import fs from 'fs';
import path from 'path';

const FILES = [
	'../../components/shusuan/HeLuoMain.js',
	'../../components/shusuan/CanPingMain.js',
	'../../components/shusuan/ZhengChuanMain.js',
	'../../components/yizhangjing/YiZhangJingMain.js',
];

describe('数算四页日界来源', () => {
	test.each(FILES)('%s:after23NewDay / lateZiHourUseNextDay 先读 fields,再回退全局', (rel) => {
		const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
		expect(src).toMatch(/\.\.\.chartDayBoundary\(f\)/);
		expect(src).not.toMatch(/after23NewDay:\s*defaultAfter23NewDay\(\)/);
	});
});
