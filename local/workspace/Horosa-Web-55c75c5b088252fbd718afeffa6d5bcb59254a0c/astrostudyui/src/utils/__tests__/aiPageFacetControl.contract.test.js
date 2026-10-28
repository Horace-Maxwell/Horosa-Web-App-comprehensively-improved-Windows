// 合同:设置「页面」面(describe_settings / set_settings 的 facet=page)与页面同口径 —— 助手可改的每一项,页面上都有控件改得到。
// 病理:设置件里存着一个页面上没有任何控件的键(旧存储键 / 早已换别的键在用),描述把它列成可改项;助手照写、回「已修改」,
//       页面上一样都没变(写进去的值没人读)。
// 判据:按 AST 读页面源码(含 consumers 与接了「亲手改」上报的盘壳),认出页面上确有入口改它的键(helpers/pageControlKeys)。
// 页面上确实没有控件、但要保留的键 → 登记表该页 noPageControl(写理由):描述不列、助手不可写;登记了的键必须真的没有控件。
import path from 'path';
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';
import { preparePageFacet, describeFacet, validateFacetValues, PAGE_FACET_EXCLUDED, __resetPageFacetCacheForTests } from '../aiTools/settingsFacets';
const { sourceSetFiles } = require('./helpers/sourceSet');
const { controlKeysOf, scanSource } = require('./helpers/pageControlKeys');

const SRC = path.resolve(__dirname, '..', '..');

function pageControlKeys(entry){
	const files = [entry.file].concat(entry.consumers || []).flatMap((r)=>sourceSetFiles(path.join(SRC, r)));
	const alias = entry.keyAliases || {};
	return new Set(Array.from(controlKeysOf(files)).map((k)=>alias[k] || k));
}

const PAGES = PAGE_SETTINGS_REGISTRY.filter((e)=>!PAGE_FACET_EXCLUDED[e.page]);

describe('页面面可改项 ⊆ 页面上有控件的键', ()=>{
	beforeAll(async ()=>{
		__resetPageFacetCacheForTests();
		for(const e of PAGES){
			// eslint-disable-next-line no-await-in-loop
			await preparePageFacet(e.page);
		}
	}, 60000);

	test('每页的可改项都在页面上有控件(列出 页名:键名)', ()=>{
		const miss = [];
		let total = 0;
		PAGES.forEach((e)=>{
			const d = describeFacet('page', e.page);
			expect(`${e.page}:${d.ok}`).toBe(`${e.page}:true`);
			const ctl = pageControlKeys(e);
			d.items.filter((i)=>i.settable).forEach((i)=>{
				total += 1;
				if(!ctl.has(i.key)){ miss.push(`${e.page}:${i.key}`); }
			});
		});
		expect(total).toBeGreaterThan(200);
		expect(miss).toEqual([]);
	});

	test('noPageControl:写了理由、是该页保留键、页面上确实没有控件;描述不列、写入即拒', ()=>{
		PAGES.filter((e)=>e.noPageControl).forEach((e)=>{
			const ctl = pageControlKeys(e);
			const d = describeFacet('page', e.page);
			Object.keys(e.noPageControl).forEach((k)=>{
				const tag = `${e.page}:${k}`;
				expect(`${tag}:${typeof e.noPageControl[k] === 'string' && e.noPageControl[k].trim().length >= 6}`).toBe(`${tag}:true`);
				expect(`${tag}:${e.fields.indexOf(k) >= 0}`).toBe(`${tag}:true`);
				expect(`${tag}:有控件=${ctl.has(k)}`).toBe(`${tag}:有控件=false`);
				expect(`${tag}:列出=${d.items.some((i)=>i.key === k)}`).toBe(`${tag}:列出=false`);
			});
		});
	});

	test('占星地图:只有「振动线 5/7/9」一个开关,旧键 vibration 不再存、不列、不可写', ()=>{
		const acg = PAGES.find((e)=>e.page === 'acg');
		expect(acg.fields).not.toContain('vibration');
		const d = describeFacet('page', 'acg');
		expect(d.items.some((i)=>i.key === 'vibration')).toBe(false);
		expect(d.items.find((i)=>i.key === 'showVibration')).toMatchObject({ settable: true });
		expect(validateFacetValues('page', 'acg', { vibration: true })).toMatchObject({ ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', badKey: 'vibration' });
	});
});

describe('判别力:控件扫描器', ()=>{
	const keys = (code)=>Array.from(scanSource(code)).sort();
	test('控件绑定 / 写入入口 / 转交入口 / 动态键都认', ()=>{
		expect(keys(`class A { render(){ const s = this.state; return <X checked={s.a} value={!!this.state.b} />; } }`)).toEqual(['a', 'b']);
		expect(keys(`class A { render(){ const { c, d: e } = this.state; return <X value={c} checked={e} />; } }`)).toEqual(['c', 'd']);
		expect(keys(`class A { change(patch){ this.setState(patch); } render(){ return <X onChange={(v)=>this.change({ f: v })} />; } }`)).toEqual(['f']);
		expect(keys(`class A { m(){ const patch = { g: 1 }; patch.h = 2; this.setState(patch); } }`)).toEqual(['g', 'h']);
		expect(keys(`class A { t(key){ this.setState({ [key]: !this.state[key] }); } render(){ return <B onClick={()=>this.t('i')} />; } }`)).toEqual(['i']);
		expect(keys(`class A { render(){ return [['j', 'J'], ['k', 'K']].map(([key])=>(<S onChange={(v)=>this.onOptionChange(key, v)} />)); } }`)).toEqual(['j', 'k']);
		expect(keys(`const f = (v)=>STORE.save({ l: v });`)).toEqual(['l']);
		expect(keys(`class A { c(key, val){ const persistAs = { mode: 'm' }[key]; if(persistAs){ STORE.save({ [persistAs]: val }); } } }`)).toEqual(['m']);
	});
	test('只在初值 / 请求参数 / schema 里出现的键不算控件', ()=>{
		expect(keys(`class A extends B { constructor(){ super(); this.state = { n: false }; } gen(){ return { n: this.state.o ? '1' : '0' }; } }`)).toEqual([]);
		expect(keys(`const S = definePageSettings('k', { p: { def: false } });`)).toEqual([]);
	});
});
