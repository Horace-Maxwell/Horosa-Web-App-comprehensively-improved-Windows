// 「进阶」页左侧分区导轨:按钮式(不用 antd Anchor —— 桌面构建走 hash 路由,<a href="#id"> 会改 location.hash 跳走;也不用 Affix,
// 页面在 TabPane 内滚动,Affix 按视口量会脱钩)。滚动监听挂在最近的可滚祖先(Main 的 .paneScroll),rAF 节流做 scroll-spy;
// 点击 = 目标分区 scrollIntoView + 广播 horosa:adv-open(折叠面板据此自开)。不持久化任何状态。
import React from 'react';
import XQIcon from '../../xq-icons';
import styles from './advanced.less';

export function findScrollParent(el){
	let n = el ? el.parentElement : null;
	while(n && n !== document.body){
		let oy = '';
		try{ oy = window.getComputedStyle(n).overflowY; }catch(e){ oy = ''; }
		if(oy === 'auto' || oy === 'scroll'){ return n; }
		n = n.parentElement;
	}
	return null;
}

export const ADV_OPEN_EVENT = 'horosa:adv-open';

export function jumpToSection(rootEl, id){
	const scope = rootEl || document;
	const target = scope.querySelector(`[id="${id}"]`) || document.getElementById(id);
	if(!target){ return false; }
	try{ window.dispatchEvent(new CustomEvent(ADV_OPEN_EVENT, { detail: { id } })); }catch(e){ /* 旧环境无 CustomEvent 构造器:不广播也能跳 */ }
	if(typeof target.scrollIntoView === 'function'){
		try{ target.scrollIntoView({ block: 'start', behavior: 'smooth' }); }catch(e){ target.scrollIntoView(); }
	}
	return true;
}

function flatten(sections){
	const out = [];
	(sections || []).forEach((s)=>{ out.push(s); (s.children || []).forEach((c)=>out.push(c)); });
	return out;
}

export default function AdvSectionNav({ sections, rootRef }){
	const list = sections || [];
	const [active, setActive] = React.useState(()=>(list[0] ? list[0].id : ''));
	React.useEffect(()=>{
		const root = rootRef && rootRef.current;
		const sp = root ? findScrollParent(root) : null;
		if(!root || !sp){ return undefined; }
		let pending = false;
		const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn)=>setTimeout(fn, 16);
		const compute = ()=>{
			pending = false;
			const pr = sp.getBoundingClientRect();
			// 高亮「占据视口上三分之一线」的分区:最后一个顶边越过该线的分区即当前分区(只看 24px 会让下一张卡占满屏时仍亮着上一张)
			const line = pr.top + Math.max(24, pr.height * 0.35);
			let cur = '';
			flatten(list).forEach((s)=>{
				const el = root.querySelector(`[id="${s.id}"]`);
				if(!el){ return; }
				const r = el.getBoundingClientRect();
				if(r.top <= line){ cur = s.id; }
			});
			if(cur){ setActive(cur); }
		};
		const onScroll = ()=>{ if(!pending){ pending = true; raf(compute); } };
		sp.addEventListener('scroll', onScroll, { passive: true });
		compute();
		return ()=>{ sp.removeEventListener('scroll', onScroll); };
	}, [list, rootRef]);
	const go = (id)=>{ jumpToSection(rootRef && rootRef.current, id); setActive(id); };
	return (
		<nav className={styles.rail} data-advanced-nav="1" aria-label="进阶分区">
			<div className={styles.railTitle}>分区</div>
			{list.map((s)=>(
				<React.Fragment key={s.id}>
					<button type="button" className={[styles.railItem, s.danger ? styles.railDanger : '', active === s.id ? styles.railActive : ''].filter(Boolean).join(' ')}
						data-adv-nav={s.id} aria-current={active === s.id ? 'true' : undefined} onClick={()=>go(s.id)}>
						{s.icon ? <XQIcon name={s.icon} /> : null}
						<span>{s.label}</span>
						{s.badge ? <span className={styles.railBadge}>{s.badge}</span> : null}
					</button>
					{(s.children || []).map((c)=>(
						<button key={c.id} type="button" className={[styles.railItem, styles.railSub, active === c.id ? styles.railActive : ''].filter(Boolean).join(' ')}
							data-adv-nav={c.id} aria-current={active === c.id ? 'true' : undefined} onClick={()=>go(c.id)}>
							<span>{c.label}</span>
						</button>
					))}
				</React.Fragment>
			))}
		</nav>
	);
}
