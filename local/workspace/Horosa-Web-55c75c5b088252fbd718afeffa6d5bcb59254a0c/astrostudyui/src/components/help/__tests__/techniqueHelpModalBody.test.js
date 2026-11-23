// 帮助弹窗正文独立件:书形态的手册直接出书(不套正文框);没有手册的页出默认说明(在可滚正文框里)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import TechniqueHelpModalBody from '../TechniqueHelpModalBody';
import { TECHNIQUE_HELP_DOCS } from '../techniqueHelpRegistry';

global.React = React;   // 手册组件按构建的自动 JSX 运行时写(不显式引 React),同目录其余测试同此约定

let host = null;
beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
afterEach(()=>{ ReactDOM.unmountComponentAtNode(host); host.remove(); window.__horosaKinAstroCurrent = undefined; });

it('没有手册的页:默认说明放在正文框里', ()=>{
	act(()=>{ ReactDOM.render(<TechniqueHelpModalBody currentTab="nope-not-a-tab" bodyClassName="help-body-x" />, host); });
	const box = host.querySelector('.help-body-x');
	expect(box).toBeTruthy();
	expect(box.textContent).toContain('左侧为排盘输入与显示设置');
	expect(box.style.overflowY).toBe('auto');
});

it('书形态的手册:直接出书,不套正文框', ()=>{
	const key = Object.keys(TECHNIQUE_HELP_DOCS).find((k)=>TECHNIQUE_HELP_DOCS[k] && TECHNIQUE_HELP_DOCS[k].book);
	expect(key).toBeTruthy();
	act(()=>{ ReactDOM.render(<TechniqueHelpModalBody currentTab={key} bodyClassName="help-body-x" compact />, host); });
	expect(host.querySelector('.help-body-x')).toBeNull();
	expect(host.textContent.length).toBeGreaterThan(20);
});
