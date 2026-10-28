// 八字旧版柱细览(FourZhu 及只被它引用的 Zhu / ZhuMing12)全仓零 import,已删;
// BaZiAppInfoPanel 里未调用的 collectGods 已删(在用的同名函数在旧版界面 / 细盘各自文件里)。
import fs from 'fs';
import path from 'path';

const DIR = path.resolve(__dirname, '..');

describe('八字死代码', () => {
	test('FourZhu / Zhu / ZhuMing12 已删', () => {
		['FourZhu.js', 'Zhu.js', 'ZhuMing12.js'].forEach((f) => {
			expect(`${f}:${fs.existsSync(path.join(DIR, f))}`).toBe(`${f}:false`);
		});
	});
	test('BaZiAppInfoPanel 不再有未调用的 collectGods;旧版界面里在用的那份还在', () => {
		expect(fs.readFileSync(path.join(DIR, 'BaZiAppInfoPanel.js'), 'utf8')).not.toMatch(/\bcollectGods\b/);
		expect(fs.readFileSync(path.join(DIR, 'BaZiLegacyView.js'), 'utf8')).toMatch(/\bcollectGods\(/);
	});
});
