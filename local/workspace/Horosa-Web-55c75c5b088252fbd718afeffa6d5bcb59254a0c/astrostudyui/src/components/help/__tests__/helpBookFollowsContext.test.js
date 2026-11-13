// 帮助书「当前技法」随页签上下文走:弹窗收起后要等动画回调才卸载,来不及卸载时下一次打开仍是同一实例 ——
// 换了子页签再开,必须落到新的当前章(否则:地占页打开仍停在上次的灵棋经,「当前」标记也在灵棋经)。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import HelpBook from '../HelpBook';

const BOOK = {
	title: '测试手册',
	groups: [{ key: 'g', label: '组', chapters: [
		{ key: 'geomancy', label: '天文地占', render: ()=><p>地占正文</p> },
		{ key: 'lingqi', label: '灵棋经', render: ()=><p>灵棋正文</p> },
		{ key: 'xiaoliuren', label: '小六壬', render: ()=><p>小六壬正文</p> },
	] }],
};

function mount(ctx){
	const host = document.createElement('div');
	document.body.appendChild(host);
	act(()=>{ ReactDOM.render(<HelpBook book={BOOK} ctx={ctx} />, host); });
	return host;
}
const active = (host)=>{ const el = host.querySelector('.horosa-help-book-item.is-active .horosa-help-book-item-label'); return el ? el.textContent : null; };
const here = (host)=>{ const el = host.querySelector('.horosa-help-book-here'); return el ? el.parentElement.querySelector('.horosa-help-book-item-label').textContent : null; };
const title = (host)=>host.querySelector('.horosa-help-book-title').textContent;

describe('HelpBook 当前章随上下文', ()=>{
	test('换子页签 → 落到新当前章,「当前」标记跟着走', ()=>{
		const host = mount({ currentTab: 'cnyibu', currentSubTab: 'lingqi' });
		expect([active(host), here(host), title(host)]).toEqual(['灵棋经', '灵棋经', '灵棋经']);
		act(()=>{ ReactDOM.render(<HelpBook book={BOOK} ctx={{ currentTab: 'cnyibu', currentSubTab: 'geomancy' }} />, host); });
		expect([active(host), here(host), title(host)]).toEqual(['天文地占', '天文地占', '天文地占']);
		ReactDOM.unmountComponentAtNode(host);
	});

	test('上下文没变(只是父级重渲染、ctx 是新对象)→ 停在用户自己翻到的那章', ()=>{
		const host = mount({ currentTab: 'cnyibu', currentSubTab: 'lingqi' });
		const btn = Array.from(host.querySelectorAll('.horosa-help-book-item')).find((b)=>b.textContent.indexOf('小六壬') === 0);
		act(()=>{ btn.click(); });
		expect(active(host)).toBe('小六壬');
		act(()=>{ ReactDOM.render(<HelpBook book={BOOK} ctx={{ currentTab: 'cnyibu', currentSubTab: 'lingqi' }} />, host); });
		expect([active(host), here(host)]).toEqual(['小六壬', '灵棋经']);
		ReactDOM.unmountComponentAtNode(host);
	});
});
