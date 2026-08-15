// [制度化·T3 ratchet] 内容完备性审计注册表覆盖率总锁:
//   ① preset 每键必在注册表(新增技法漏审当场红);② 注册表无僵尸键(键除名同步除表);
//   ③ 每键至少 t1/t2/t3/t5 四税则结论齐全;④ gap/exempt 结论必带说明(冒号后非空)。
// 逐键结论内容为人工 attestation(五税则定义见 docs/AI_REPORT_PLAYBOOK.md),本锁只机械保覆盖与格式。
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';
import { AI_EXPORT_CONTENT_AUDIT } from '../aiExportContentAudit';

const RULE_KEYS = ['t1', 't2', 't3', 't5'];

describe('[制度化] 内容完备性审计注册表覆盖率', ()=>{
	const presetKeys = Object.keys(AI_EXPORT_PRESET_SECTIONS);
	const auditKeys = Object.keys(AI_EXPORT_CONTENT_AUDIT);

	test('🔴 preset 每键必在注册表(新技法漏审=红)', ()=>{
		const missing = presetKeys.filter((k)=>!AI_EXPORT_CONTENT_AUDIT[k]);
		expect(missing).toEqual([]);
	});

	test('🔴 注册表无僵尸键(键除名同步除表)', ()=>{
		const zombie = auditKeys.filter((k)=>presetKeys.indexOf(k) < 0);
		expect(zombie).toEqual([]);
	});

	test('每键四税则结论齐全,值型合法(ok/fixed:/gap:/exempt:)', ()=>{
		const bad = [];
		auditKeys.forEach((k)=>{
			const entry = AI_EXPORT_CONTENT_AUDIT[k];
			RULE_KEYS.forEach((r)=>{
				const v = entry[r];
				if(typeof v !== 'string' || !v){
					bad.push(`${k}.${r}:missing`);
					return;
				}
				if(!(v === 'ok' || v.startsWith('ok:') || v.startsWith('fixed:') || v.startsWith('gap:') || v.startsWith('exempt:'))){
					bad.push(`${k}.${r}:${v.slice(0, 20)}`);
				}
			});
		});
		expect(bad).toEqual([]);
	});

	test('gap/exempt/fixed 必带说明(冒号后非空——不自证的结论不作数)', ()=>{
		const bad = [];
		auditKeys.forEach((k)=>{
			const entry = AI_EXPORT_CONTENT_AUDIT[k];
			RULE_KEYS.forEach((r)=>{
				const v = `${entry[r] || ''}`;
				const i = v.indexOf(':');
				if(i >= 0 && !v.slice(i + 1).trim()){
					bad.push(`${k}.${r}`);
				}
			});
		});
		expect(bad).toEqual([]);
	});

	test('审计轮标记在位(at 字段)', ()=>{
		const missing = auditKeys.filter((k)=>!AI_EXPORT_CONTENT_AUDIT[k].at);
		expect(missing).toEqual([]);
	});
});
