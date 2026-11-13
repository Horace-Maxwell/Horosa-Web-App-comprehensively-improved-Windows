// 六壬导出设置里的「注释」开关:勾上后在[十二地盘/十二天盘/十二贵神对应]段后面追加一段注释。
// 该段正文改成表格(| 序 | 地盘 | 天盘 | 贵神 |)之后,注释的取数仍只认旧的行式写法 → 取不到任何一项 → 勾了没反应。
// 这里用真的段落生成函数出正文,锁住「开 ⇒ 出注释段、关 ⇒ 原样」。
import { applyAstroMeaningFilterByContext } from '../aiExport/meaning';
import { AI_EXPORT_SETTINGS_KEY } from '../aiExport/presets';
import { buildLiuRengPanRows } from '../../components/lrzhan/main/panData';

const BR = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const JIANG = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];
const layout = { downZi: BR, upZi: BR.map((_, i)=>BR[(i + 6) % 12]), houseTianJiang: JIANG };
const content = ['[起盘信息]', '日期：2024-03-15 10:30:00', '', '[十二地盘/十二天盘/十二贵神对应]', ...buildLiuRengPanRows(layout), '', '[四课]', '无'].join('\n');
const setMeaning = (on)=>window.localStorage.setItem(AI_EXPORT_SETTINGS_KEY, JSON.stringify({ version: 999, sections: {}, planetInfo: {}, astroMeaning: on ? { liureng: { enabled: 1 } } : {}, prefs: {} }));

describe('六壬导出 · 注释开关', ()=>{
	afterEach(()=>window.localStorage.removeItem(AI_EXPORT_SETTINGS_KEY));

	it('正文确实是表格形态(本测试的前提)', ()=>{
		expect(content).toContain('| 序 | 地盘 | 天盘 | 贵神 |');
		expect(content).toContain('| 1 | 子 | 午 | 贵人 |');
	});

	it('关:原样返回', ()=>{
		setMeaning(false);
		expect(applyAstroMeaningFilterByContext(content, 'liureng')).toBe(content);
	});

	it('开:紧跟该段追加注释段,且注释里有天将与地支的内容', ()=>{
		setMeaning(true);
		const out = applyAstroMeaningFilterByContext(content, 'liureng');
		expect(out).not.toBe(content);
		expect(out).toContain('[十二地盘/十二天盘/十二贵神对应注释]');
		const note = out.slice(out.indexOf('[十二地盘/十二天盘/十二贵神对应注释]'), out.indexOf('[四课]'));
		expect(note.length).toBeGreaterThan(200);
		expect(note).toMatch(/贵人|螣蛇|青龙/);
		// 原段不动
		expect(out).toContain('| 12 | 亥 | 巳 | 天后 |');
	});
});
