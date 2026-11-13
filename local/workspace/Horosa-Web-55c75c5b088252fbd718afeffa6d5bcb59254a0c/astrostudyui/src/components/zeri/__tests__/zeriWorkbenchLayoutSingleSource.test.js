// 十个择日工作台左列的版式只有一个源头(zeriWorkbenchLayout.js):
// 参数区内容多了自己滚,条件正文始终留得出一行类型 + 一行参数,底部动作排不被挤出框。
// 曾真机可见的三处毛病锁在这里:① 三式 / 奇门展开全部参数后条件正文被压成 0、动作排溢出框外;
// ② 长标签(「Tithi(1-30;16-30=下弦)」)定宽 52px,溢进右边的输入框压字;
// ③ 暗色下没填值的日期框占位是一片青绿(引擎按字色的色相压暗画占位,暗色字色带青)。
const fs = require('fs');
const path = require('path');
const { ZERI_WB_TOP_STYLE, ZERI_WB_COND_BODY_STYLE } = require('../zeriWorkbenchLayout');

const ZERI_DIR = path.join(__dirname, '..');
const read = (name)=>fs.readFileSync(path.join(ZERI_DIR, name), 'utf8');

const WORKBENCHES = [
	'BaziZeriWorkbench.js',
	'HuangliZeriWorkbench.js',
	'IndiaZeriWorkbench.js',
	'LiurengZeriWorkbench.js',
	'QimenZeriWorkbench.js',
	'QizhengZeriWorkbench.js',
	'SanshiZeriWorkbench.js',
	'TaiyiZeriWorkbench.js',
	'ZiweiZeriWorkbench.js',
	'ConditionBuilderModal.js',
];

describe('择日工作台左列版式单一源头', ()=>{
	test('清单覆盖目录里全部工作台', ()=>{
		const onDisk = fs.readdirSync(ZERI_DIR).filter((n)=>/ZeriWorkbench\.js$/.test(n)).sort();
		expect(onDisk).toEqual(WORKBENCHES.filter((n)=>/ZeriWorkbench\.js$/.test(n)).sort());
	});

	test.each(WORKBENCHES)('%s 的参数区与条件正文都取公用版式', (name)=>{
		const src = read(name);
		expect(src).toMatch(/import \{[^}]*ZERI_WB_TOP_STYLE[^}]*\} from '\.\/zeriWorkbenchLayout'/);
		expect(src).toMatch(/className="horosa-zeri-wb-top" style=\{ZERI_WB_TOP_STYLE\}/);
		expect(src).toMatch(/className="horosa-zeri-wb-cond" style=\{ZERI_WB_COND_BODY_STYLE\}/);
	});

	test('参数区可让步、自己滚;条件正文吃剩余高度且有底线', ()=>{
		expect(ZERI_WB_TOP_STYLE.flex).toBe('0 1 auto');
		expect(ZERI_WB_TOP_STYLE.minHeight).toBe(0);
		expect(ZERI_WB_TOP_STYLE.overflowY).toBe('auto');
		expect(ZERI_WB_COND_BODY_STYLE.flex).toBe('1 1 0');
		expect(ZERI_WB_COND_BODY_STYLE.minHeight).toBeGreaterThanOrEqual(120);
		expect(ZERI_WB_COND_BODY_STYLE.overflowY).toBe('auto');
	});

	test('条件参数表的标签列按内容撑开、超长省略,不回到定宽', ()=>{
		const src = read('ConditionParamsForm.js');
		expect(src).toContain("const LABEL_COL = 'minmax(52px, max-content)';");
		expect(src).not.toMatch(/gridTemplateColumns:\s*'52px /);
		expect(src).toMatch(/textOverflow: 'ellipsis'/);
		expect(src).toMatch(/title=\{f\.hint \|\| f\.label \|\| undefined\}/);
	});

	test('暗色下日期框字色换成暖白(占位不再发青),且压得过工作区输入框的通用规则', ()=>{
		const less = fs.readFileSync(path.join(__dirname, '../../../layouts/app/17-divination-cards.less'), 'utf8');
		expect(less).toMatch(/:root:not\(\[data-horosa-appearance='light'\]\) \.horosa-native-date\.horosa-native-date \{ color: #[0-9a-f]{6} !important; \}/);
	});
});
