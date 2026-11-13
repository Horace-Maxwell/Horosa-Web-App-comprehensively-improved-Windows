// 卜·其他一组左栏主按钮同高:与本组输入框同为 36,切页签时不再 36 / 40 忽高忽低;轨策起卦钮不被弹性收缩压扁。
// 真引擎量过(1728x1043 / 1280x720):不统一时 小六壬 / 小成图 / 飞宫 / 灵棋经 40,皇极经世 / 五兆 / 太玄 / 荆诀 / 神易数 / 地占 36,
// 轨策 40 被收缩到 36;根因是 17-divination-cards 为卜卦 / 择日 / 世俗写的「左栏小号钮 40px」漏进本组。
import fs from 'fs';
import path from 'path';

const read = (f)=>fs.readFileSync(path.resolve(__dirname, '..', '..', f), 'utf8');
const { jsxNodes } = require('./helpers/jsxProps');          // 按 AST 认元素 / 属性 / 子节点
const { importsName } = require('./helpers/importSpecs');   // 按 AST 认 import

describe('卜·其他一组左栏主按钮高度', ()=>{
	test('本组内全宽主按钮收回到 36 且不收缩(规则在本组 :global 嵌套里)', ()=>{
		const cnx = read('layouts/app/19-cnx-divination.less');
		const rule = '.horosa-astro-input-panel .ant-btn.ant-btn-primary.ant-btn-block.ant-btn-sm { height: 36px !important; min-height: 36px; flex-shrink: 0; }';
		expect(cnx).toContain(rule);
		// 在 .horosa-workspace-shell { .horosa-huangji-redesign { … } } 里(特异度压过 17 号分片那条 40px)
		const head = cnx.slice(0, cnx.indexOf(rule));
		expect(head).toMatch(/:global \{\s*\n\.horosa-workspace-shell \{\s*\n\s*\.horosa-huangji-redesign \{/);
		expect((head.match(/\{/g) || []).length - (head.match(/\}/g) || []).length).toBe(3);
	});

	test('卜卦 / 择日 / 世俗的 40px 原规则不动(只在本组内收回)', ()=>{
		const cards = read('layouts/app/17-divination-cards.less');
		expect(cards).toMatch(/\.horosa-astro-input-panel \.ant-btn\.ant-btn-sm \{\s*\n\s*height: 40px !important;/);
	});

	test('本组主按钮都是 XQButton 全宽小号主按钮(规则才认得到)', ()=>{
		[
			['components/guice/GuiceControls.js', '起卦'],
			['components/xiaoliuren/XiaoLiuRenMain.js', '起课'],
			['components/feigong/FeiGongMain.js', '定局'],
		].forEach(([f, txt])=>{
			const src = read(f);
			expect([f, importsName(src, { name: 'XQButton', from: '../xq-ui', as: 'Button' })]).toEqual([f, true]);
			const b = jsxNodes(src, 'Button').filter((n)=>n.children === txt);
			expect([f, b.length]).toEqual([f, 1]);
			expect([f, b[0].attrs.type, b[0].attrs.size, b[0].attrs.block]).toEqual([f, 'primary', 'small', true]);
		});
	});
});
