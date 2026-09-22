// [用户实报 2026-09-17] 天文馆骨架高度不得用 vh:壳缩放(html{zoom})下 vh 与布局域劈叉 → 缩小出底部白边、放大左栏滚不到底。
// 与 layouts/app.js contentStyle「勿用 100vh」同一铁律;骨架高度一律 100%(根壳链定高)或直接量容器。
import fs from 'fs';
import path from 'path';

function stripComments(src){ return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); }

describe('天文馆骨架高度来源', () => {
	test('planetarium.less 零 vh 单位;页面根与占位页高度 = 100%', () => {
		const src = stripComments(fs.readFileSync(path.join(__dirname, '../planetarium.less'), 'utf8'));
		expect(src).not.toMatch(/\d+vh\b/);
		const page = src.match(/\.horosa-planetarium-page \{[^}]*\}/);
		const loading = src.match(/\.horosa-planetarium-loading \{[^}]*\}/);
		expect(page && page[0]).toMatch(/height:\s*100%/);
		expect(page && page[0]).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/);   // 单行钉死容器高,不随左栏内容长
		expect(loading && loading[0]).toMatch(/height:\s*100%/);
		const side = src.match(/\.planetarium-side \{[^}]*\}/);
		expect(side && side[0]).toMatch(/min-height:\s*0/);
	});
});
