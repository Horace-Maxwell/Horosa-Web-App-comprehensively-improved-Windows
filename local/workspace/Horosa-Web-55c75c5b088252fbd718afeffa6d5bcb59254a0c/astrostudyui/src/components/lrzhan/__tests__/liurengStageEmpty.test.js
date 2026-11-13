// 六壬未起课:中栏不能是一片空白,提示落在舞台正中(与遁甲 / 三式 / 六爻同一个空态组件)。
// 盘组件照常挂着(起课后原地画),空态只是盖在空 svg 上的一层、不接指针。
import fs from 'fs';
import path from 'path';

const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');
const SRC = readSource(path.resolve(__dirname, '..', 'LiuRengMain.js'));
const LESS = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'layouts', 'app', '22-tail-fixes.less'), 'utf8');

describe('六壬中栏空态', ()=>{
	test('未起课显示居中提示,用全站统一的空态组件', ()=>{
		expect(SRC).toMatch(/import \{[^}]*\bXQStageEmpty\b[^}]*\} from '\.\.\/xq-ui';/);
		expect(SRC).toMatch(/\{!chart && !this\.state\.liureng \? \(\s*<div className="horosa-liureng-stage-empty">\s*<XQStageEmpty>点击左侧“起课”后显示六壬盘<\/XQStageEmpty>\s*<\/div>\s*\) : null\}/);
	});

	test('盘组件不随空态卸载(起课后原地画)', ()=>{
		const host = SRC.slice(SRC.indexOf('<div className="horosa-liureng-chart-host">'));
		const chartAt = host.indexOf('<LiuRengChart');
		const emptyAt = host.indexOf('horosa-liureng-stage-empty');
		expect(chartAt).toBeGreaterThan(0);
		expect(emptyAt).toBeGreaterThan(chartAt);
		// 盘组件前面没有条件包裹
		expect(host.slice(0, chartAt)).not.toMatch(/\?\s*\(?\s*$/);
	});

	// 切回本页的刷新(主页面按「盘变了才刷新」调 hook.fun(fields),不带底盘):没起过课就不替用户起。
	// 此前首次进页留空、切走再回来却自己起出一课(懒加载后首次进页时钩子还没挂上)。
	test('没起过课时,切回本页不自动起课;带底盘的调用(点「起课」后取盘回来)照常起', ()=>{
		const at = SRC.indexOf('this.props.hook.fun = (fields, chartObj)=>{');
		expect(at).toBeGreaterThan(0);
		const body = SRC.slice(at, SRC.indexOf('};', at));
		expect(body).toMatch(/if\(\(chartObj === undefined \|\| chartObj === null\) && !this\.state\.liureng\)\{\s*return;\s*\}/);
		expect(body.indexOf('!this.state.liureng')).toBeLessThan(body.indexOf('this.startPaiPanByFields('));
	});

	test('空态层铺满宿主、不接指针', ()=>{
		const at = LESS.indexOf('.horosa-liureng-chart-host > .horosa-liureng-stage-empty');
		expect(at).toBeGreaterThan(0);
		const rule = LESS.slice(at, LESS.indexOf('}', at));
		expect(rule).toMatch(/position: absolute;/);
		expect(rule).toMatch(/display: flex;/);
		expect(rule).toMatch(/pointer-events: none;/);
		expect(LESS).toMatch(/\.horosa-workspace-shell \.horosa-liureng-chart-host \{\s*position: relative;\s*\}/);
	});
});
