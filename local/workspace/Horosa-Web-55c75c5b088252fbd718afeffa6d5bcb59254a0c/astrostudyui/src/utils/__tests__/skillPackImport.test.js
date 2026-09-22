// 技能包「导入」链合同(批四):Upload.beforeUpload → FileReader → onImportText 这段此前只有纯函数测试。
// 触发词撞内置命令的包必须被拒(零落库 + message.error);正常包落库一次并回调 reloadBundles。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { message } from 'antd';
import SkillPackPanel from '../../components/aianalysis/chat/SkillPackPanel';
import * as store from '../aiAnalysisStore';
import { SKILL_FILE_FORMAT } from '../aiChat/skills';

jest.mock('../aiAnalysisStore', ()=>{
	const actual = jest.requireActual('../aiAnalysisStore');
	return { __esModule: true, ...actual, putStoreRecord: jest.fn(async (s, r)=>({ ...r, id: r.id || 'b-new' })) };
});
if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 10)); }); };
function packJson(trigger){
	return JSON.stringify({ format: SKILL_FILE_FORMAT, version: 1, pack: { name: `技能${trigger}`, skill: { version: 1, triggers: [trigger], requires: 'chart', techniqueKeys: [], promptTemplate: '分析{{source}}', argsSpec: [], outputFormat: '', schoolNote: '', description: '' }, defaultTechniqueKeys: [] } });
}
async function importFile(host, text){
	const input = host.querySelector('input[type="file"]');
	expect(input).toBeTruthy();
	const file = new File([text], 'x.horosa-skill.json', { type: 'application/json' });
	Object.defineProperty(input, 'files', { value: [file], configurable: true });
	await act(async ()=>{ input.dispatchEvent(new Event('change', { bubbles: true })); });
	await flush(); await flush(); await flush();
}

describe('技能包导入链', ()=>{
	let host; let errSpy; let okSpy;
	beforeEach(()=>{ window.localStorage.clear(); store.putStoreRecord.mockClear(); errSpy = jest.spyOn(message, 'error').mockImplementation(()=>{}); okSpy = jest.spyOn(message, 'success').mockImplementation(()=>{}); host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); errSpy.mockRestore(); okSpy.mockRestore(); });

	test('🔴 触发词撞内置命令(/compact)→ 拒导入:零落库 + 报错', async ()=>{
		const reload = jest.fn();
		act(()=>{ ReactDOM.render(<SkillPackPanel bundles={[]} materials={[]} reloadBundles={reload} />, host); });
		await importFile(host, packJson('compact'));
		expect(store.putStoreRecord).not.toHaveBeenCalled();
		expect(errSpy).toHaveBeenCalled();
		expect(`${errSpy.mock.calls[0][0]}`).toContain('内置命令冲突');
		expect(reload).not.toHaveBeenCalled();
	});

	test('正常包 → 落库一次(bundles store)并回调 reloadBundles', async ()=>{
		const reload = jest.fn();
		act(()=>{ ReactDOM.render(<SkillPackPanel bundles={[]} materials={[]} reloadBundles={reload} />, host); });
		await importFile(host, packJson('测试技能甲'));
		expect(store.putStoreRecord).toHaveBeenCalledTimes(1);
		expect(store.putStoreRecord.mock.calls[0][0]).toBe(store.AI_ANALYSIS_STORES.bundles);
		expect(store.putStoreRecord.mock.calls[0][1].name).toBe('技能测试技能甲');
		expect(store.putStoreRecord.mock.calls[0][1].skill.triggers).toEqual(['测试技能甲']);
		expect(reload).toHaveBeenCalledTimes(1);
		expect(errSpy).not.toHaveBeenCalled();
	});

	test('不是技能包文件 → 报错零落库', async ()=>{
		act(()=>{ ReactDOM.render(<SkillPackPanel bundles={[]} materials={[]} reloadBundles={()=>{}} />, host); });
		await importFile(host, '{"hello":1}');
		expect(store.putStoreRecord).not.toHaveBeenCalled();
		expect(errSpy).toHaveBeenCalled();
	});
});
