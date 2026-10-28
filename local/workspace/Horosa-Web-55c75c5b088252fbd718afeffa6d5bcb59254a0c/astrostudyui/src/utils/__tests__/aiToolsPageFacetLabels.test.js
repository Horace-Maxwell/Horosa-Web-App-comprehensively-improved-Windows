// 合同:设置「页面」面(审批卡 / 描述)的设置项名是中文,不是键名。
// 来源链:设置件 spec.label → 同名挂载齿轮字段的标签(页面与齿轮同键同义)→ 键名(只作最后回落)。
// 可改项一律不许回落到键名:新加的页面设置项要么写 spec.label(取页面上这一项的显示名),要么与齿轮同键。
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';
import { preparePageFacet, describeFacet, PAGE_FACET_EXCLUDED, pageFieldLabel } from '../aiTools/settingsFacets';

const ascii = (s)=>!/[^\x00-\x7f]/.test(`${s || ''}`);

async function loadedPages(){
	const out = [];
	for(const e of PAGE_SETTINGS_REGISTRY){
		if(PAGE_FACET_EXCLUDED[e.page]){ continue; }
		// eslint-disable-next-line no-await-in-loop
		const api = await preparePageFacet(e.page);
		out.push({ entry: e, api });
	}
	return out;
}

test('页面面可改项:没有一项回落到键名(列出 页名:键名)', async ()=>{
	let total = 0;
	const fallback = [];
	for(const { entry } of await loadedPages()){
		const d = describeFacet('page', entry.page);
		if(!d.ok){ continue; }
		d.items.filter((i)=>i.settable).forEach((i)=>{
			total += 1;
			if(ascii(i.label)){ fallback.push(`${entry.page}:${i.key}`); }
		});
	}
	expect(total).toBeGreaterThan(100);
	expect(fallback).toEqual([]);
}, 60000);

test('设置件里写了 label 的项:label 必须是中文显示名(不是又抄一遍键名 / 英文)', async ()=>{
	const bad = [];
	const visit = (page, key, spec)=>{
		if(!spec || typeof spec !== 'object'){ return; }
		if(Object.prototype.hasOwnProperty.call(spec, 'label') && (typeof spec.label !== 'string' || !spec.label.trim() || ascii(spec.label))){
			bad.push(`${page}:${key}=${JSON.stringify(spec.label)}`);
		}
		if(spec.type === 'map' && spec.keys){ Object.keys(spec.keys).forEach((k)=>visit(page, `${key}.${k}`, spec.keys[k])); }
	};
	let labelled = 0;
	for(const { entry, api } of await loadedPages()){
		if(!api){ continue; }
		Object.keys(api.schema).forEach((k)=>{
			if(api.schema[k] && api.schema[k].label !== undefined){ labelled += 1; }
			visit(entry.page, k, api.schema[k]);
		});
	}
	expect(labelled).toBeGreaterThan(100);
	expect(bad).toEqual([]);
}, 60000);

test('来源链:spec.label 优先;没有取同名齿轮字段标签;都没有才是键名', ()=>{
	expect(pageFieldLabel('zz', 'k', { label: '某项' })).toBe('某项');
	expect(pageFieldLabel('liureng', 'guireng', {}, 'liureng')).not.toBe('guireng');
	expect(ascii(pageFieldLabel('liureng', 'guireng', {}, 'liureng'))).toBe(false);
	expect(pageFieldLabel('zz', 'zz_no_such_key', {})).toBe('zz_no_such_key');
});
