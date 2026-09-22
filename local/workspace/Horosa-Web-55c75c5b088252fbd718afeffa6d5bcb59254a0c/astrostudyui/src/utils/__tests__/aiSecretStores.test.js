// [G7] 备份剥密穷举:带密钥的店/字段单源;任何记录形状里出现密钥字段的店必须在 AI_SECRET_STORES;备份产物零明文。
import fs from 'fs';
import path from 'path';
import { AI_SECRET_STORES, AI_SECRET_FIELDS, isSecretStore, redactSecretRecord } from '../aiSecretStores';
import { AI_ANALYSIS_STORES, putStoreRecord, clearStore } from '../aiAnalysisStore';
import { collectAiWorkspaceDump } from '../unifiedBackup';

const SRC = path.resolve(__dirname, '..', '..');

describe('[G7] 密钥店单源', ()=>{
	it('店名都在 AI_ANALYSIS_STORES 里;profile 类店必登记;剥密函数逐字段清空并打标记', ()=>{
		const all = Object.values(AI_ANALYSIS_STORES);
		AI_SECRET_STORES.forEach((s)=>expect(all.indexOf(s)).toBeGreaterThanOrEqual(0));
		all.filter((s)=>/profile/.test(s)).forEach((s)=>expect(isSecretStore(s)).toBe(true));
		const r = redactSecretRecord({ id: 'p1', apiKey: 'sk-abcdefghijklmnop', token: 'tok', headers: { Authorization: 'Bearer x', Accept: 'a' }, apiKeyDecryptFailed: true, name: 'n' });
		expect(r.apiKey).toBe(''); expect(r.apiKeyRedacted).toBe(true); expect(r.token).toBe(''); expect(r.headers.Authorization).toBe(''); expect(r.headers.Accept).toBe('a');
		expect(r.apiKeyDecryptFailed).toBeUndefined(); expect(r.name).toBe('n');
		expect(JSON.stringify(r).indexOf('sk-abc')).toBe(-1);
	});
	it('unifiedBackup 走单源剥密(源码锁:不再硬写店名)', ()=>{
		const src = fs.readFileSync(path.join(SRC, 'utils', 'unifiedBackup.js'), 'utf8').replace(/\/\/[^\n]*/g, '');
		expect(src).toContain("from './aiSecretStores'");
		expect(src).toContain('isSecretStore(name)');
		expect(src.indexOf("name === AI_ANALYSIS_STORES.providerProfiles || name === AI_ANALYSIS_STORES.integrationProfiles")).toBe(-1);
	});
	it('种一把假 Key 到两个店 ⇒ 备份产物零明文', async ()=>{
		await clearStore(AI_ANALYSIS_STORES.providerProfiles); await clearStore(AI_ANALYSIS_STORES.integrationProfiles);
		await putStoreRecord(AI_ANALYSIS_STORES.providerProfiles, { id: 'p1', name: 'P', providerType: 'openai', apiKey: 'sk-ZZZZZZZZZZZZZZZZZZZZ' }, 'prof');
		await putStoreRecord(AI_ANALYSIS_STORES.integrationProfiles, { id: 'i1', kind: 'websearch', apiKey: 'tvly-ZZZZZZZZZZZZ', token: 'tok-ZZZZZZZZ' }, 'int');
		const out = await collectAiWorkspaceDump();
		const text = JSON.stringify(out);
		expect(text.indexOf('ZZZZZZZZ')).toBe(-1);
		expect(text.indexOf('apiKeyRedacted')).toBeGreaterThan(0);
	});
});
