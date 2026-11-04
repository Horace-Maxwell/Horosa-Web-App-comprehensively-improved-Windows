// 起卦 / 起课 / 定局不成 → 盘面清空,AI 快照槽须同清。
// 曾:皇极轨策 / 小六壬 / 飞宫 / 小成图 失败分支只 setState({ error, 结果: null }),快照仍是上一卦 ——
// 屏上「不可起卦」,交给 AI 的却是一卦不在屏上的旧盘(所见非所得)。
import fs from 'fs';
import path from 'path';

const CASES = [
	['guice/GuiceMain.js', 'guice', 'gua'],
	['xiaoliuren/XiaoLiuRenMain.js', 'xiaoliuren', 'ke'],
	['feigong/FeiGongMain.js', 'feigong', 'ju'],
	['xiaochengtu/XiaoChengTuMain.js', 'xiaochengtu', 'qi'],
];

describe('起卦失败分支同清 AI 快照', () => {
	CASES.forEach(([file, mod, field]) => {
		test(file, () => {
			const lines = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').split('\n');
			const fails = lines.filter((l) => new RegExp(`setState\\(\\{ error: '[^']+', ${field}: null`).test(l));
			expect(fails.length).toBeGreaterThan(0);
			fails.forEach((l) => expect(l).toContain(`clearModuleAISnapshot('${mod}')`));
		});
	});
});
