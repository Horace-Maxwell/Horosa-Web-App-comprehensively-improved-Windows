// 印占算法变体表 × AI 挂载合同(前端侧):流派开关 23 键、分盘变体、卡拉卡方案、星曜战判据。
// 夹具 fixtures/indiaVariantMountContract.json 由 astropy/tests/test_india_variant_mount_contract.py 生成并锁成
// 「现行引擎真输出」:每个开关的每个非缺省档,各记一张该档真有变化的样例盘 —— 缺省回包与该档回包里有差异的子树。
// 本测试逐档把两份回包各拼一次快照数据段(与挂载同一函数 buildIndiaSnapshotDataSections),断言两者不同:
// 开关只进页面、不进挂载(AI 收到「已自定义」的口径声明却拿不到受它影响的数据)即红。
import moment from 'moment';
import astroModel from '../../models/astro';
import * as AC from '../../constants/AstroConst';
import { buildIndiaSnapshotDataSections } from '../../components/astro/IndiaChart';

const FX = require('./fixtures/indiaVariantMountContract.json');

function setPath(obj, path, value){
	const parts = path.split('/');
	let cur = obj;
	parts.slice(0, -1).forEach((p)=>{ if(!cur[p] || typeof cur[p] !== 'object'){ cur[p] = {}; } cur = cur[p]; });
	const last = parts[parts.length - 1];
	if(value === null || value === undefined){ delete cur[last]; }else{ cur[last] = value; }
}

// 夹具里同形子树只记改了的叶子({ $patch: [[相对路径, 新值], …]}),其余记整棵。
function applyAlt(baseTree, alt){
	if(!alt || !Array.isArray(alt.$patch)){ return alt; }
	const tree = JSON.parse(JSON.stringify(baseTree));
	alt.$patch.forEach(([rel, value])=>{
		const parts = rel.split('/');
		let cur = tree;
		parts.slice(0, -1).forEach((p)=>{ cur = cur[p]; });
		cur[parts[parts.length - 1]] = value;
	});
	return tree;
}

function chartObjOf(base, alt){
	const jyotish = {};
	Object.keys(base.jyotish).forEach((p)=>setPath(jyotish, p, JSON.parse(JSON.stringify(base.jyotish[p]))));
	if(alt){ Object.keys(alt).forEach((p)=>setPath(jyotish, p, JSON.parse(JSON.stringify(applyAlt(base.jyotish[p], alt[p]))))); }
	return { jyotish };
}

function fieldsOf(base, extra){
	const f = {};
	Object.keys(astroModel.state.fields).forEach((k)=>{ f[k] = { ...astroModel.state.fields[k] }; });
	const req = base.request;
	const mk = ()=>Object.assign(moment(`${req.date} ${req.time}`, 'YYYY/MM/DD HH:mm:ss'), { zone: req.zone, ad: 1 });
	f.date = { ...f.date, value: mk() };
	f.time = { ...f.time, value: mk() };
	f.zone = { ...f.zone, value: req.zone };
	if(base.dashaSystem){ f.indiaDashaSystem = { name: ['indiaDashaSystem'], value: base.dashaSystem }; }
	Object.keys(extra || {}).forEach((k)=>{ f[k] = { name: [k], value: extra[k] }; });
	return f;
}

const text = (secs)=>Object.keys(secs).map((t)=>`[${t}]\n${secs[t].join('\n')}`).join('\n\n');

function snapshotPair(entry){
	const base = FX.bases[entry.base];
	const a = text(buildIndiaSnapshotDataSections(chartObjOf(base, null), fieldsOf(base, null)));
	const b = text(buildIndiaSnapshotDataSections(chartObjOf(base, entry.alt), fieldsOf(base, entry.fields)));
	return [a, b];
}

// 前端各变体表的全部非缺省档(键名与夹具同形)。
function frontendSwitches(){
	const out = [];
	AC.INDIA_DASHA_VARIANT_SPECS.forEach((s)=>s.options.forEach((o)=>{ if(o.value !== s.default){ out.push({ key: s.key, value: o.value }); } }));
	AC.INDIA_KARAKA_SCHEME_OPTIONS.forEach((o)=>{ if(o.value !== AC.INDIA_KARAKA_SCHEME_DEFAULT){ out.push({ key: 'karakaScheme', value: o.value }); } });
	AC.INDIA_YUDDHA_CRITERION_OPTIONS.forEach((o)=>{ if(o.value !== AC.INDIA_YUDDHA_CRITERION_DEFAULT){ out.push({ key: 'yuddhaCriterion', value: o.value }); } });
	AC.INDIA_VARGA_VARIANT_CHARTS.forEach((c)=>c.options.forEach((o)=>{ if(o.value !== 'standard'){ out.push({ key: `vargaVariant.${c.chartnum}`, value: o.value }); } }));
	return out;
}

describe('印占算法变体表 × AI 挂载合同', ()=>{
	it('夹具与前端变体表逐档一致(新增开关 / 档位必须重生成夹具)', ()=>{
		const want = frontendSwitches().map((s)=>`${s.key}=${s.value}`);
		const have = FX.entries.map((e)=>`${e.key}=${e.value}`);
		expect(have.slice().sort()).toEqual(want.slice().sort());
	});

	frontendSwitches().forEach((sw)=>{
		it(`${sw.key}=${sw.value}:快照数据段随档变化`, ()=>{
			const entry = FX.entries.find((e)=>e.key === sw.key && e.value === sw.value);
			expect(entry).toBeTruthy();
			const [a, b] = snapshotPair(entry);
			expect(a.length).toBeGreaterThan(0);
			expect(b).not.toBe(a);
		});
	});

	it('Dīptādi 归属换档:情态改判的那颗曜,快照「星曜状态」行里写的是新情态', ()=>{
		const entry = FX.entries.find((e)=>e.key === 'deeptadiKhala' && e.value === 'debilitation');
		const before = FX.bases[entry.base].jyotish['strengths/planetaryStates'];
		const after = applyAlt(before, entry.alt['strengths/planetaryStates']);
		const changed = after.filter((p, i)=>p.deeptadi && before[i].deeptadi && p.deeptadi.key !== before[i].deeptadi.key);
		expect(changed.length).toBeGreaterThan(0);
		const [a, b] = snapshotPair(entry);
		changed.forEach((p)=>{
			const row = b.split('\n').find((l)=>l.startsWith(`| ${p.label} |`));
			expect(row).toContain(`/情${p.deeptadi.label}`);
			expect(a).toContain(`/情${before[after.indexOf(p)].deeptadi.label}`);
		});
	});
});
