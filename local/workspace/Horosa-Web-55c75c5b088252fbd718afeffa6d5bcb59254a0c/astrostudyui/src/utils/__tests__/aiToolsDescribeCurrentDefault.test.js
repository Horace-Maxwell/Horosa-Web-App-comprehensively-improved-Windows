// 合同:设置描述(describe_settings)回包里的 default = 当前实际生效的缺省(全局改过的键按全局现值),不是 schema 出厂值。
// 病形:挂载面 current 是稀疏模板,没写过就是 undefined,模型只能拿 default 当现状 —— 报出厂值就会告诉用户
//   「现在按 23 点换日」(全局其实是 24 点),或白写一次覆盖。抽屉与剪枝早已改用现值缺省,描述面同口径。
import fs from 'fs';
import path from 'path';
import { describeFacet } from '../aiTools/settingsFacets';
import { TECHNIQUE_SETTINGS_SCHEMA, getTechniqueSettingsSchema, getTechniqueSettingsCurrentDefaults, hasMountSettingsFields } from '../techniqueMountSettings';
import { definePageSettings } from '../pageSettingsStore';

const same = (a, b)=>JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

describe('describe_settings:default 报现值缺省', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });

	test('全局日界改成 24 点换日:八字 / 奇门 / 太乙挂载面 after23NewDay 的 default 跟随', ()=>{
		window.localStorage.setItem('globalSetup', JSON.stringify({ dayBoundary: 'after24' }));
		['bazi', 'qimen', 'taiyi'].forEach((t)=>{
			const d = describeFacet('mount', t);
			const it = (d.items || []).find((x)=>x.key === 'after23NewDay');
			expect(it).toBeTruthy();
			expect(it.default).toBe(getTechniqueSettingsCurrentDefaults(t).after23NewDay);
			expect(it.default).toBe(0);
			expect(it.schemaDefault).toBe(1);   // 出厂值另给
		});
	});

	test('全部技法 × 全部带 globalCurrent 的字段:item.default === 现值缺省', ()=>{
		window.localStorage.setItem('globalSetup', JSON.stringify({ dayBoundary: 'after24' }));
		const bad = [];
		let checked = 0;
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((t)=>hasMountSettingsFields(t)).forEach((t)=>{
			const schema = getTechniqueSettingsSchema(t);
			const curDefaults = getTechniqueSettingsCurrentDefaults(t);
			const facets = ['mount'].concat(schema && schema.kind === 'localStorage' ? ['technique'] : []);
			facets.forEach((facet)=>{
				const d = describeFacet(facet, t);
				(d.items || []).forEach((it)=>{
					const f = schema.fields.find((x)=>x.name === it.key);
					if(!f || typeof f.globalCurrent !== 'function'){ return; }
					checked += 1;
					if(!same(it.default, curDefaults[it.key])){ bad.push(`${facet}:${t}.${it.key}`); }
				});
			});
		});
		expect(checked).toBeGreaterThanOrEqual(20);
		expect(bad).toEqual([]);
	});

	test('源码锁:描述面不许再直接报 default: f.default / default: defs[k] 以外的出厂值', ()=>{
		const src = fs.readFileSync(path.join(__dirname, '../aiTools/settingsFacets.js'), 'utf8');
		expect(src).not.toMatch(/default:\s*f\.default\b/);
	});
});

describe('页面设置件:没存过的键跟随别处时,currentDefaults 报跟随值', ()=>{
	test('塔罗:库里存了另一副牌组、随牌组吸附的项没单独存 → 描述页面面报该牌组的缺省', async ()=>{
		const { preparePageFacet } = require('../aiTools/settingsFacets');
		const { TAROT_PAGE_SETTINGS } = require('../../components/tarot/TarotMain');
		const deck = TAROT_PAGE_SETTINGS.schema.deckId.oneOf.find((id)=>{
			const eff = TAROT_PAGE_SETTINGS.currentDefaults;
			window.localStorage.setItem(TAROT_PAGE_SETTINGS.key, JSON.stringify({ v: 1, values: { deckId: id } }));
			const cd = eff();
			return cd.useReversals !== TAROT_PAGE_SETTINGS.defaults().useReversals || cd.meaningSystem !== TAROT_PAGE_SETTINGS.defaults().meaningSystem;
		});
		expect(deck).toBeTruthy();
		window.localStorage.setItem(TAROT_PAGE_SETTINGS.key, JSON.stringify({ v: 1, values: { deckId: deck } }));
		await preparePageFacet('tarot');
		const d = describeFacet('page', 'tarot');
		const cd = TAROT_PAGE_SETTINGS.currentDefaults();
		['useReversals', 'meaningSystem'].forEach((k)=>{
			const it = d.items.find((x)=>x.key === k);
			expect(it.default).toEqual(cd[k]);
			expect(it.current).toEqual(cd[k]);
		});
		window.localStorage.clear();
	});

	test('effectiveDefaults 盖出厂值;没给 = 出厂值', ()=>{
		window.localStorage.clear();
		const plain = definePageSettings('zz.page.plain', { a: { def: 1 } });
		expect(plain.currentDefaults()).toEqual({ a: 1 });
		const linked = definePageSettings('zz.page.linked', { kind: { def: 'x', oneOf: ['x', 'y'] }, flag: { def: false } }, {
			effectiveDefaults: (sv)=>({ flag: sv.kind === 'y' }),
		});
		expect(linked.currentDefaults().flag).toBe(false);
		window.localStorage.setItem('zz.page.linked', JSON.stringify({ v: 1, values: { kind: 'y' } }));
		expect(linked.currentDefaults().flag).toBe(true);
		expect(linked.defaults().flag).toBe(false);   // 出厂值语义不变
	});
});
