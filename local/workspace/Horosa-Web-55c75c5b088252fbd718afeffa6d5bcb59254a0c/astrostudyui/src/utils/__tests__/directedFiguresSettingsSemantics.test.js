// 推运图类四技法(演进推运 / Bezza 推运图 / 周日小限 / 双黄道)页面设置的语义链:
// 页面保存键 → 技法设置 → 请求字段 → 后端按同名字段读 → 后端定义级测试(test_directed_figures.py)证含义。
// 任何一环改名 / 漏传 = 这一档「点了不算」或算成别的(选项宇宙登记网的语义证锚在这里)。
import fs from 'fs';
import path from 'path';
import { directedFigureOptsFromSettings } from '../../components/astro/AstroDirectedFigures';
import { directedFigureRequestFields } from '../directedFigures';

const ASTROPY = path.resolve(__dirname, '../../../../astropy');
const ENGINE = fs.readFileSync(path.join(ASTROPY, 'astrostudy/directed_figures.py'), 'utf8');
const PYTEST = fs.readFileSync(path.join(ASTROPY, 'tests/test_directed_figures.py'), 'utf8');

function pyFunc(src, name){
	const i = src.indexOf(`def ${name}(`);
	if(i < 0){ return ''; }
	const j = src.indexOf('\ndef ', i + 4);
	return src.slice(i, j < 0 ? src.length : j);
}
const reqFor = (key, page)=>directedFigureRequestFields(key, directedFigureOptsFromSettings(key, page));

describe('推运图类四技法 · 页面设置 → 请求 → 引擎', ()=>{
	it('演进推运:弧常数 K / 出生前年数 t0 / 推进方式 / 容许度 原值进请求,引擎按同名读', ()=>{
		const req = reqFor('neroman', { nerK: 300, nerT0: 0.5, nerKeepDec: true, nerOrb: 2 });
		expect(req).toEqual({ nerK: 300, nerT0: 0.5, nerKeepDec: 1, orb: 2 });
		const fn = pyFunc(ENGINE, 'build_neroman');
		['nerK', 'nerT0', 'nerKeepDec', 'orb'].forEach((k)=>expect(fn).toContain(`data.get('${k}')`));
		// 含义:K / t0 闭式与回本位年龄、两种推进方式(按黄经度数 / 保留本命赤纬)由定义级测试证
		expect(PYTEST).toContain('def test_neroman_arc_closed_form_and_fatum_returns(');
		expect(PYTEST).toContain('def test_neroman_two_modes(');
	});
	it('Bezza 推运图:容许度原值进请求,引擎按同名读', ()=>{
		expect(reqFor('bezzafigure', { bezzaOrb: 3 })).toEqual({ orb: 3 });
		expect(pyFunc(ENGINE, 'build_bezza')).toContain("data.get('orb')");
		expect(PYTEST).toContain('def test_bezza_contacts_satisfy_their_definitions(');
	});
	it('周日小限:「当前所在的一轮 / 指定起始年龄」原值进请求,引擎按同名读', ()=>{
		expect(reqFor('jayprofection', { jayFrom: 24 })).toEqual({ jayFrom: 24 });
		expect(reqFor('jayprofection', { jayFrom: -1 })).toEqual({ jayFrom: -1 });
		const fn = pyFunc(ENGINE, 'build_jay');
		expect(fn).toContain("data.get('jayFrom')");
		expect(fn).toMatch(/if start < 0:\s*\n\s*start = int\(math\.floor\(max\(age, 0\.0\) \/ 12\.0\)\) \* 12/);   // 负值 = 当前所在的一轮
		expect(PYTEST).toContain('def test_jay_twelve_year_cycle_returns_to_natal(');
	});
	it('双黄道:容许度 / 守护(互换)/ 宫制(等宫)原值进请求,引擎按同名读;「只看有族 / 全部」只管显示不进请求', ()=>{
		const req = reqFor('michon', { michonOrb: 2, michonSwap: true, michonEqual: true, michonAll: true });
		expect(req).toEqual({ orb: 2, mzSwap: 1, mzEqual: 1 });
		const fn = pyFunc(ENGINE, 'build_michon');
		["data.get('orb')", "data.get('mzSwap')", "data.get('mzEqual')"].forEach((k)=>expect(fn).toContain(k));
		expect(fn).toContain('equal_cusps_centered(');
		expect(PYTEST).toContain('def test_michon_origin_and_families(');
		expect(PYTEST).toContain('def test_michon_superposition_layout_and_swap(');
	});
});
