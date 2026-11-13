import fs from 'fs';
import path from 'path';
import DateTime from '../DateTime';

// 时刻字段带秒:输入面板把时间重组后会提交回全局,请求把时间发给排盘,任一处降到「分」都会丢秒,
// 丢了秒的时刻离时辰界不到一分钟时,同一张盘在不同页面会落到不同时辰。
const ROOT = path.resolve(__dirname, '../..');
const SOURCES = [
	'lrzhan/LiuRengInput.js', 'lrzhan/LiuRengBirthInput.js', 'lrzhan/LiuRengMain.js',
	'jinkou/JinKouMain.js', 'ziwei/ZiWeiInput.js', 'germany/MidpointMain.js',
	'../utils/aiAnalysisContext/regenDivination.js',
];

describe('时刻字段不降到分钟', ()=>{
	it.each(SOURCES)('%s', (rel)=>{
		const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		expect(src).not.toMatch(/\.time\.value\.format\('HH:mm'\)/);
		expect(src).not.toMatch(/parse\([^)]*'YYYY-MM-DD HH:mm'\)/);
	});

	it('带秒的串原样解析,不带秒的旧串秒取 0', ()=>{
		const a = new DateTime().parse('1990-05-18 10:30:47', 'YYYY-MM-DD HH:mm:ss');
		expect(a.format('HH:mm:ss')).toBe('10:30:47');
		const b = new DateTime().parse('1990-05-18 10:30', 'YYYY-MM-DD HH:mm:ss');
		expect(b.format('HH:mm:ss')).toBe('10:30:00');
	});
});
