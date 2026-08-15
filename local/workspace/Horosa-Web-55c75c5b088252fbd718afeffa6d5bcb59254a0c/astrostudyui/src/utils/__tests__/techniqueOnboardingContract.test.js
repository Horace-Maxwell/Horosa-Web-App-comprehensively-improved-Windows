// 🔴 [V5-C1] 技法接入合同总闸 —— 「新增技法必须同步全部数据管理链」的机械强制。
//
// 分母 = navigationPages(fs 解析 src/pages/index.js,技法宇宙单源:进导航即进分母)。
// 判据:①导航键集 ≡ 合同表键集(新技法没交合同=红;僵尸合同=红)
//      ②合同五项逐项机械验:help→TECHNIQUE_HELP_DOCS 必须有键;aiExport 声明键必须
//        ∈ AI_EXPORT_PRESET_SECTIONS;mount='viaPresets'→声明 preset 至少一键
//        ∈ TECHNIQUE_SETTINGS_SCHEMA;archive='case:...'→每类型 ∈ CASE_TYPE_OPTIONS;
//        storageKeys 声明键必须 classifyStorageKey 可分类(防拼错)
//      ③豁免格式闸:'exempt:' 后必须非空理由
//      ④[C12] playbook 机器可读合同表五 id 与本测试合同字段 双向一致(docs-as-tests)
// 判据源全部 fs 正则解析(不 import 页面组件/registry 组件树,防 jest 拉炸)。
import fs from 'fs';
import path from 'path';
import { TECHNIQUE_ONBOARDING_CONTRACT } from '../techniqueOnboardingContract';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';
import { classifyStorageKey } from '../storageKeyRegistry';

const UI_ROOT = path.join(__dirname, '..', '..');
const CONTRACT_FIELDS = ['help', 'aiExport', 'mount', 'archive', 'storageKeys'];

function parseNavigationKeys(){
	const text = fs.readFileSync(path.join(UI_ROOT, 'pages', 'index.js'), 'utf8');
	const block = text.match(/const navigationPages = \[([\s\S]*?)\n\];/);
	expect(block).toBeTruthy();
	const keys = [...block[1].matchAll(/key:\s*'([A-Za-z0-9_]+)'/g)].map((m)=>m[1]);
	expect(keys.length).toBeGreaterThan(20);   // 塌缩守卫
	return keys;
}

function parseHelpRegistryKeys(){
	const text = fs.readFileSync(path.join(UI_ROOT, 'components', 'help', 'techniqueHelpRegistry.js'), 'utf8');
	const block = text.match(/TECHNIQUE_HELP_DOCS = \{([\s\S]*?)\n\};/);
	expect(block).toBeTruthy();
	return new Set([...block[1].matchAll(/^\t([A-Za-z0-9_]+):/gm)].map((m)=>m[1]));
}

function parseMountSchemaKeys(){
	const text = fs.readFileSync(path.join(UI_ROOT, 'utils', 'techniqueMountSettings.js'), 'utf8');
	const block = text.match(/TECHNIQUE_SETTINGS_SCHEMA = \{([\s\S]*?)\n\};/);
	expect(block).toBeTruthy();
	return new Set([...block[1].matchAll(/^\t([A-Za-z0-9_]+):/gm)].map((m)=>m[1]));
}

function parseCaseTypeValues(){
	const text = fs.readFileSync(path.join(UI_ROOT, 'utils', 'localcases.js'), 'utf8');
	const block = text.match(/CASE_TYPE_OPTIONS\s*=\s*\[([\s\S]*?)\];/);
	expect(block).toBeTruthy();
	return new Set([...block[1].matchAll(/value:\s*'([^']+)'/g)].map((m)=>m[1]));
}

function isExempt(v){
	return typeof v === 'string' && v.indexOf('exempt:') === 0;
}

describe('[V5-C1] 技法接入合同总闸', ()=>{
	const navKeys = parseNavigationKeys();
	const contractKeys = Object.keys(TECHNIQUE_ONBOARDING_CONTRACT);

	it('🔴 导航键集 ≡ 合同表键集(新技法进导航必须交数据管理合同;僵尸合同必须清)', ()=>{
		const missing = navKeys.filter((k)=>!TECHNIQUE_ONBOARDING_CONTRACT[k]);
		const zombie = contractKeys.filter((k)=>navKeys.indexOf(k) < 0);
		expect(missing.length ? `未交合同的技法(去 techniqueOnboardingContract.js 登记五项,豁免必须带理由):\n${missing.join('\n')}` : 'ok').toBe('ok');
		expect(zombie.length ? `僵尸合同(导航已无此技法):\n${zombie.join('\n')}` : 'ok').toBe('ok');
	});

	it('🔴 help 合同:声明 registry 的技法必须真的在 TECHNIQUE_HELP_DOCS(帮助文档漏接=红)', ()=>{
		const helpKeys = parseHelpRegistryKeys();
		const bad = [];
		contractKeys.forEach((k)=>{
			const v = TECHNIQUE_ONBOARDING_CONTRACT[k].help;
			if(v === 'registry'){
				if(!helpKeys.has(k)){
					bad.push(k);
				}
			}else if(!isExempt(v)){
				bad.push(`${k}:非法值(${v})`);
			}
		});
		expect(bad.length ? `help 合同失守:\n${bad.join('\n')}` : 'ok').toBe('ok');
	});

	it('🔴 aiExport 合同:声明的每个 preset 键必须 ∈ AI_EXPORT_PRESET_SECTIONS(自动进内容审计分母)', ()=>{
		const presetKeys = new Set(Object.keys(AI_EXPORT_PRESET_SECTIONS));
		const bad = [];
		contractKeys.forEach((k)=>{
			const v = TECHNIQUE_ONBOARDING_CONTRACT[k].aiExport;
			if(Array.isArray(v)){
				if(!v.length){
					bad.push(`${k}:空数组(要么列键要么显式豁免)`);
				}
				v.forEach((p)=>{
					if(!presetKeys.has(p)){
						bad.push(`${k}:${p} 不在 AI_EXPORT_PRESET_SECTIONS`);
					}
				});
			}else if(!isExempt(v)){
				bad.push(`${k}:非法值`);
			}
		});
		expect(bad.length ? `aiExport 合同失守:\n${bad.join('\n')}` : 'ok').toBe('ok');
	});

	it('mount 合同:viaPresets 的技法其 preset 至少一键有挂载设置面', ()=>{
		const mountKeys = parseMountSchemaKeys();
		const bad = [];
		contractKeys.forEach((k)=>{
			const c = TECHNIQUE_ONBOARDING_CONTRACT[k];
			if(c.mount === 'viaPresets'){
				const presets = Array.isArray(c.aiExport) ? c.aiExport : [];
				if(!presets.some((p)=>mountKeys.has(p))){
					bad.push(k);
				}
			}else if(!isExempt(c.mount)){
				bad.push(`${k}:非法值`);
			}
		});
		expect(bad.length ? `mount 合同失守:\n${bad.join('\n')}` : 'ok').toBe('ok');
	});

	it('🔴 archive 合同:chart/case:类型/豁免 三态;case 类型必须 ∈ CASE_TYPE_OPTIONS', ()=>{
		const caseTypes = parseCaseTypeValues();
		const bad = [];
		contractKeys.forEach((k)=>{
			const v = TECHNIQUE_ONBOARDING_CONTRACT[k].archive;
			if(v === 'chart'){
				return;
			}
			if(typeof v === 'string' && v.indexOf('case:') === 0){
				const types = v.slice(5).split(',').map((s)=>s.trim()).filter(Boolean);
				if(!types.length){
					bad.push(`${k}:case: 后空`);
				}
				types.forEach((t)=>{
					if(!caseTypes.has(t)){
						bad.push(`${k}:${t} 不在 CASE_TYPE_OPTIONS`);
					}
				});
				return;
			}
			if(!isExempt(v)){
				bad.push(`${k}:非法值(${v})`);
			}
		});
		expect(bad.length ? `archive 合同失守:\n${bad.join('\n')}` : 'ok').toBe('ok');
	});

	it('storageKeys 合同:声明键必须能被注册表分类(防拼错);none 合法', ()=>{
		const bad = [];
		contractKeys.forEach((k)=>{
			const v = TECHNIQUE_ONBOARDING_CONTRACT[k].storageKeys;
			if(v === 'none'){
				return;
			}
			if(Array.isArray(v)){
				v.forEach((sk)=>{
					if(!classifyStorageKey(sk)){
						bad.push(`${k}:${sk} 注册表不识别(拼错或未登记)`);
					}
				});
				return;
			}
			bad.push(`${k}:非法值`);
		});
		expect(bad.length ? `storageKeys 合同失守:\n${bad.join('\n')}` : 'ok').toBe('ok');
	});

	it('豁免格式闸:exempt: 后必须非空理由(无由豁免=红)', ()=>{
		const bad = [];
		contractKeys.forEach((k)=>{
			CONTRACT_FIELDS.forEach((f)=>{
				const v = TECHNIQUE_ONBOARDING_CONTRACT[k][f];
				if(typeof v === 'string' && v.indexOf('exempt:') === 0 && v.slice(7).trim().length < 2){
					bad.push(`${k}.${f}`);
				}
				if(v === undefined || v === null){
					bad.push(`${k}.${f}:缺项`);
				}
			});
		});
		expect(bad.length ? `豁免/缺项:\n${bad.join('\n')}` : 'ok').toBe('ok');
	});

});
