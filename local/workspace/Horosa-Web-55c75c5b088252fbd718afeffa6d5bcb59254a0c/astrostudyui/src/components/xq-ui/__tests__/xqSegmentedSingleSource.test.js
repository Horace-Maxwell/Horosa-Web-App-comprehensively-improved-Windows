// 分段钮(XQSegmented)选中观感单一来源合同。
// 选中态的底色 / 字色 / 描边只许在 xq-ui/styles.less 的 .xq-segmented 基础样式里定(读 --horosa-tab-seg-* 一族);
// 各页样式只许改版式(宽度 / 折行 / 字号 / 字重)。历史上各页各自给选中态上色,出过两种事故:
// 弹层在壳外漏出组件库默认主色;选中项实底盖在滑块上,暗色主题下成了「金底金字」。
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../..');
const BASE = path.join(SRC, 'components/xq-ui/styles.less');

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((ent)=>{
		if(ent.name === 'node_modules' || ent.name.startsWith('.umi')){ return; }
		const full = path.join(dir, ent.name);
		if(ent.isDirectory()){ walk(full, out); }
		else if(/\.less$/.test(ent.name)){ out.push(full); }
	});
	return out;
}

function stripComments(text){
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// 取「选择器 { 声明 }」叶子块:选择器里不含花括号,声明里不含花括号
function leafRules(text){
	const rules = [];
	const re = /([^{}]+)\{([^{}]*)\}/g;
	let m = re.exec(text);
	while(m){
		rules.push({ selector: m[1].trim(), body: m[2] });
		m = re.exec(text);
	}
	return rules;
}

const PAINT = /(^|[;\s])(background(-color|-image)?|color|border-color|box-shadow)\s*:/;

describe('XQSegmented 选中观感单一来源', ()=>{
	const base = fs.readFileSync(BASE, 'utf8');

	test('基础样式:滑块在位时选中项自己不上底、不描边', ()=>{
		const m = /\.xq-segmented\.xq-segmented-sliding \.ant-radio-button-wrapper\.ant-radio-button-wrapper-checked\s*\{([^}]*)\}/.exec(base);
		expect(m).toBeTruthy();
		expect(m[1]).toMatch(/background:\s*transparent\s*!important/);
		expect(m[1]).toMatch(/border-color:\s*transparent\s*!important/);
	});

	test('基础样式:选中字色、滑块底色都读 tab-seg 一族变量', ()=>{
		expect(base).toMatch(/\.xq-segmented \.ant-radio-button-wrapper-checked\s*\{\s*color:\s*var\(--horosa-tab-on-thumb/);
		const thumb = /\.xq-segmented-thumb\s*\{([^}]*)\}/.exec(base);
		expect(thumb).toBeTruthy();
		expect(thumb[1]).toContain('var(--horosa-tab-seg-thumb');
		expect(thumb[1]).toContain('var(--horosa-tab-seg-ring');
	});

	test('基础样式之外,没有任何规则给分段钮的选中项或滑块上色', ()=>{
		const offenders = [];
		walk(SRC, []).forEach((file)=>{
			const text = stripComments(fs.readFileSync(file, 'utf8'));
			leafRules(text).forEach((rule)=>{
				const hits = rule.selector.split(',').some((sel)=>{
					if(!/xq-segmented/.test(sel)){ return false; }
					return /wrapper-checked/.test(sel) || /xq-segmented-thumb/.test(sel);
				});
				if(!hits || !PAINT.test(rule.body)){ return; }
				if(file === BASE && /^\s*(\.xq-segmented|:is\(\.horosa-workspace-shell, body\) \.xq-segmented)/.test(rule.selector.split(',')[0])){ return; }
				offenders.push(`${path.relative(SRC, file)} :: ${rule.selector.replace(/\s+/g, ' ').slice(0, 140)}`);
			});
		});
		expect(offenders).toEqual([]);
	});
});
