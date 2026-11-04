// 数算六门 + 演禽 + 策天:后端 web<门>srv.py 产出的每一段都要在右栏页签映射(getTabSections / CETIAN_TAB_SECTIONS)或 INTERNAL 名单里有着落。
// 曾漏:铁板「六亲佐证」(左栏六亲四项的回显)与「紫微安星」(名不以「宫」收尾);演禽后端「三星」改名「三星·元辰」并新增
// 「大限」「流年小限」「神煞·待校」后页签映射没跟上 → 只进 AI 快照,屏上不见。
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../../..');
const SRC = fs.readFileSync(path.join(ROOT, 'astrostudyui/src/components/kinastro/KinAstroMain.js'), 'utf8');
const start = SRC.indexOf('getTabSections(tabKey){');
const TAB_BLOCK = SRC.slice(start, SRC.indexOf('\n\t}\n', start))
	+ SRC.slice(SRC.indexOf('const CETIAN_TAB_SECTIONS'), SRC.indexOf('function normalizeGanzhiInput'));
const INTERNAL = new Set(SRC.match(/const INTERNAL_SECTION_TITLES = new Set\(\[([\s\S]*?)\]\)/)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1)));
// 门名是盘的顶层标题,不是段
const TECH_TITLE = { shaozi: '邵子神数', tieban: '铁板神数', fendjing: '鬼谷分定经', beiji: '北极神数', nanji: '南极神数', chunzi: '蠢子数', xianqin: '万化仙禽', cetian: '策天飞星' };
// 只靠「概览」取前四段收的段(段序固定在最前);宫名段走宫位页「以宫收尾」规则;「来源」是 classics 结构归典籍页
const HEAD_OR_RULE = { cetian: ['农历与命身', '四化', '来源'], xianqin: [] };
const byRule = (t) => /[宫宮]$/.test(t);

function tabListOf(key){
	const m = TAB_BLOCK.match(new RegExp(`tabKey === '${key}'\\)\\{\\s*(?:\\/\\/[^\\n]*\\n\\s*)?return sectionByTitle\\(sections, \\[([^\\]]*)\\]`));
	return m ? m[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1)) : [];
}

describe('数算各门后端段名都有页签收', () => {
	Object.keys(TECH_TITLE).forEach((svc) => {
		test(svc, () => {
			const py = fs.readFileSync(path.join(ROOT, `astropy/websrv/web${svc}srv.py`), 'utf8');
			const titles = [...new Set([...py.matchAll(/"title": *f?"([^"{]+)"/g)].map((m) => m[1]))];
			expect(titles.length).toBeGreaterThan(0);
			const allow = HEAD_OR_RULE[svc] || [];
			const orphan = titles.filter((t) => t !== TECH_TITLE[svc] && !INTERNAL.has(t) && allow.indexOf(t) < 0 && !byRule(t) && TAB_BLOCK.indexOf(`'${t}'`) < 0);
			expect(orphan).toEqual([]);
		});
	});
	test('铁板:六亲佐证进「核心」、紫微安星进「宫位」', () => {
		expect(tabListOf('core')).toContain('六亲佐证');
		expect(tabListOf('palaces')).toContain('紫微安星');
	});
	test('演禽:星禽页收「三星·元辰」、运限页收大限 / 流年小限 / 神煞', () => {
		expect(tabListOf('stars')).toContain('三星·元辰');
		expect(tabListOf('xqYunxian')).toEqual(['大限', '流年小限', '神煞·待校']);
		expect(SRC).toMatch(/\{ key: 'xqYunxian', label: '运限' \}/);
	});
});
