/**
 * 前端可维护性棘轮(判据单源 scripts/ui-ratchet.js;基线 scripts/ui-ratchet.baseline.json)。
 *   ① 任何文件的九项计数(!important / 写死层级 / 写死字号 / 写死颜色 / 原生基础控件 / 行内颜色 / 行内字号 / 键盘不可达的可点元素 / 超长文件行数)只许减少
 *   ② 每个检测器一红一绿自证(判据改坏了不会悄悄变成全绿)
 *   ③ 基线形态:路径真实存在、计数为正整数
 * 改好一处后跑 `npm run ratchet:ui -- --write` 把基线收紧;发布前自检要求基线恰等于当前值(--check-tight)。
 */
const fs = require('fs');
const path = require('path');

const UI_ROOT = path.resolve(__dirname, '..', '..', '..');
const R = require(path.join(UI_ROOT, 'scripts', 'ui-ratchet.js'));

const SIDES = [['主', 'shared', R.BASE_SHARED]];

describe('可维护性棘轮:只许减少', ()=>{
	const cur = R.measureAll();
	SIDES.forEach(([name, key, file])=>{
		test(`🔴 ${name}源码各项计数不超过基线(新文件按 0 起算)`, ()=>{
			const { increases } = R.compare(cur[key], R.loadBase(file));
			const msg = increases.map((x)=>`${x.metric} ${x.file}: ${x.base} → ${x.cur}(${R.METRIC_HINT[x.metric]})`);
			expect(msg).toEqual([]);
		});
		test(`${name}基线形态:文件真实存在、计数为正整数`, ()=>{
			const base = R.loadBase(file);
			const SRC = path.join(UI_ROOT, 'src');
			const bad = [];
			Object.entries(base.metrics).forEach(([k, o])=>Object.entries(o).forEach(([f, n])=>{
				if(R.METRICS.indexOf(k) < 0){ bad.push(`未知计数项 ${k}`); }
				if(!Number.isInteger(n) || n <= 0){ bad.push(`${k} ${f}: ${n}`); }
				if(!fs.existsSync(path.join(SRC, f))){ bad.push(`${k} ${f}: 文件已不存在(跑 --write 收掉)`); }
			}));
			Object.entries(base.lines).forEach(([f, n])=>{ if(!(n > R.LINE_LIMIT)){ bad.push(`lines ${f}: ${n} 不超过 ${R.LINE_LIMIT},不该在表里`); } });
			expect(bad).toEqual([]);
		});
	});
	test('计数汇总(只减不增;改好了跑 npm run ratchet:ui -- --write 收紧)', ()=>{
		const sum = (side)=>R.METRICS.map((k)=>`${k}=${Object.values(side.metrics[k] || {}).reduce((a, b)=>a + b, 0)}`).join(' ');
		// eslint-disable-next-line no-console
		console.info(`[ui-ratchet] ${sum(cur.shared)} 超长文件=${Object.keys(cur.shared.lines).length}`);
		expect(Object.keys(cur.shared.metrics).sort()).toEqual(R.METRICS.slice().sort());
	});
});

describe('检测器一红一绿', ()=>{
	test('样式四项:变量定义 / var 兜底 / 局部层级(< 100)不计,写死的计', ()=>{
		const red = R.measureLess(`
			.a { color: #fff; background: rgba(0,0,0,.2) !important; z-index: 1200; font-size: 12.5px; }
			.z { z-index: 30; }
			.b { border: 1px solid #333; }`);
		expect(red).toEqual({ important: 1, zIndexLiteral: 1, fontLiteral: 1, colorLiteral: 3 });
		const green = R.measureLess(`
			:root { --horosa-bg: #f6f2e9; --horosa-x: rgba(0,0,0,.1); }
			@gold: #d7ad69;
			.a { color: var(--horosa-text, #fff); z-index: 2; font-size: var(--horosa-fs-12); }
			// .c { color: #000 !important; }
			/* .d { z-index: 9999; } */`);
		expect(green).toEqual({ important: 0, zIndexLiteral: 0, fontLiteral: 0, colorLiteral: 0 });
	});
	test('原生基础控件:antd 直引计,xq-ui 自身不计,别的 antd 组件不计', ()=>{
		expect(R.measureJs("import { Switch, Button, Spin as S } from 'antd';\nimport Empty from 'antd/lib/empty';", 'components/x/A.js').rawAntd).toBe(3);
		expect(R.measureJs("import { Switch } from 'antd';", 'components/xq-ui/index.js').rawAntd).toBe(0);
		expect(R.measureJs("import { Button, Modal } from 'antd';", 'components/x/A.js').rawAntd).toBe(0);
	});
	test('原生表单输入:数字 / 复选 / 单选 / 滑块计,日期 / 时间 / 文本不计', ()=>{
		const js = (s)=>R.measureJs(s, 'components/x/A.js').nativeInput;
		expect(js('<input type="number" min="1" /><input className="a" type="checkbox" /><input type=\'range\' />')).toBe(3);
		expect(js('<input type="time" className="horosa-native-date" /><input type="date" /><input type="text" /><XQCheckbox />')).toBe(0);
	});
	test('行内颜色 / 字号:写死的计,变量不计', ()=>{
		const red = R.measureJs("const s = { color: '#fff', background: 'rgba(1,2,3,.4)', fontSize: 12, zIndex: 2000 };", 'components/x/A.js');
		expect([red.inlineColor, red.inlineFont, red.zIndexLiteral]).toEqual([2, 1, 1]);
		const green = R.measureJs("const s = { color: 'var(--horosa-text)', fontSize: 'var(--horosa-fs-small)', zIndex: 'var(--horosa-z-notice)', top: 5, z: { zIndex: 20 } };", 'components/x/A.js');
		expect([green.inlineColor, green.inlineFont, green.zIndexLiteral]).toEqual([0, 0, 0]);
	});
	test('键盘入口:div onClick 无键盘计;pressable / onKeyDown / button / aria-hidden 不计', ()=>{
		const js = (s)=>R.measureJs(s, 'components/x/A.js').kbUnreachable;
		expect(js('<div className="a" onClick={()=>go({ a: 1 })}>x</div>')).toBe(1);
		expect(js('<span onClick={go} title="t">x</span>')).toBe(1);
		expect(js('<div {...pressable(go)}>x</div>')).toBe(0);
		expect(js('<div onClick={go} onKeyDown={key}>x</div>')).toBe(0);
		expect(js('<button onClick={go}>x</button>')).toBe(0);
		expect(js('<div onClick={stop} aria-hidden="true" />')).toBe(0);
		expect(js('<div className="mask" onClick={onClose} role="presentation" />')).toBe(0);
	});
	test('超长文件:新文件超过上限、登记文件长过基线 + 宽限即红;变短算未收紧', ()=>{
		const base = { metrics: {}, lines: { 'components/big.js': 2000 } };
		const cur = { metrics: {}, lines: { 'components/big.js': 2000 + R.LINE_SLACK + 1, 'components/new.js': R.LINE_LIMIT + 1 } };
		expect(R.compare(cur, base).increases.map((x)=>x.file).sort()).toEqual(['components/big.js', 'components/new.js']);
		expect(R.compare({ metrics: {}, lines: { 'components/big.js': 1900 } }, base).loose.map((x)=>x.file)).toEqual(['components/big.js']);
	});
});
