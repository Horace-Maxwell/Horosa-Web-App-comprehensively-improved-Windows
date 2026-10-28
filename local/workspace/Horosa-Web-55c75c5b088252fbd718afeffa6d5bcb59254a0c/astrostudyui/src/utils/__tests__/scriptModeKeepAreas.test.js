// 界面简繁 · 必须原样显示的区域(挂 .horosa-script-keep,界面繁体时不转换)。
// 审批前的「将写入的内容 / 改动预览」与工具调用的参数 / 结果详情:显示的必须就是将写入的原值 ——
// 否则把「张三」改成「張三」这类只差简繁的改动,预览里两行一模一样,用户看不出改了什么。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import AgentDiffPreview from '../../components/aianalysis/AgentDiffPreview';
import { applyScriptMode, SCRIPT_HANT, SCRIPT_KEEP_CLASS, __resetScriptModeForTest, __setConverterForTest } from '../scriptMode';

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../..');
// 文件 → 必须出现的「原样显示」标记(改名 / 删掉标记即红)
const MUST_KEEP = {
	'components/aianalysis/AgentDiffPreview.js': /className=\{SCRIPT_KEEP_CLASS\}/,
	'components/aianalysis/AgentActionBar.js': /styles\.detail\}\s*\$\{SCRIPT_KEEP_CLASS\}/,
};
// 规则:凡渲染文本差异的组件(引了差异引擎 utils/aiChat/textDiff 或它的展示件)默认都要原样显示
// (模版 / 原始请求 / 工具参数的差异:界面繁体时若转换,只差简繁的改动看不出来、看到的也不是将发出去的字);
// 比的是显示内容本身(报告正文)的,登记在下表写理由。
const DIFF_ENGINE_SOURCES = ['aiChat\\/textDiff'];
const DIFF_ENGINE_RE = new RegExp(`from\\s+['"][^'"]*(?:${DIFF_ENGINE_SOURCES.join('|')})['"]`);
const DIFF_DISPLAY_OK = {
};

const MAP = { '张': '張', '设': '設', '置': '置' };
const fake = (s)=>Array.from(`${s}`).map((c)=>MAP[c] || c).join('');

beforeEach(() => {
	__resetScriptModeForTest();
	__setConverterForTest(fake);
	document.body.innerHTML = '';
});
afterAll(() => { __resetScriptModeForTest(); });

describe('必须原样显示的区域', () => {
	it('🔴 渲染文本差异的组件都已挂原样显示标记或登记理由', () => {
		const walk = (dir, out)=>{ fs.readdirSync(dir).forEach((f)=>{ const p = path.join(dir, f); const st = fs.statSync(p); if(st.isDirectory()){ if(f !== '__tests__' && !f.startsWith('.umi')){ walk(p, out); } }else if(/\.(js|jsx)$/.test(f)){ out.push(p); } }); return out; };
		const users = walk(SRC, []).map((f)=>path.relative(SRC, f).split(path.sep).join('/'))
			.filter((rel)=>DIFF_ENGINE_RE.test(fs.readFileSync(path.join(SRC, rel), 'utf8')));
		expect(users.length).toBeGreaterThan(0);
		expect(users.filter((rel)=>!MUST_KEEP[rel] && !DIFF_DISPLAY_OK[rel])).toEqual([]);
		expect(Object.keys(DIFF_DISPLAY_OK).filter((rel)=>fs.existsSync(path.join(SRC, rel)) && !`${DIFF_DISPLAY_OK[rel] || ''}`.trim())).toEqual([]);
	});

	it('登记的文件里都挂着原样显示标记', () => {
		Object.keys(MUST_KEEP).filter((f)=>fs.existsSync(path.join(SRC, f))).forEach((f)=>{
			expect([f, MUST_KEEP[f].test(fs.readFileSync(path.join(SRC, f), 'utf8'))]).toEqual([f, true]);
		});
	});

	it('界面繁体:改动预览里的「张三 → 張三」两行原样可辨,标题照常转换', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		act(() => { ReactDOM.render(<AgentDiffPreview preview={{ title: '设置', before: '张三', after: '張三' }} />, host); });
		await applyScriptMode(SCRIPT_HANT);
		await new Promise((r)=>setTimeout(r, 0));
		const box = host.querySelector(`[data-agent-diff] .${SCRIPT_KEEP_CLASS}`);
		expect(box).not.toBeNull();
		expect(box.textContent).toContain('张三');
		expect(box.textContent).toContain('張三');
		expect(host.querySelector('[data-agent-diff]').firstChild.textContent).toContain('設置');
		act(() => { ReactDOM.unmountComponentAtNode(host); });
	});
});
