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
	// 点了导轨之后,平滑滚动途中不许 scroll-spy 把高亮改回去(同排右卡 / 到不了线的末节都会被改错);用户自己再滚 / 再点 / 按键才放开
	const lockRef = React.useRef(false);
	React.useEffect(()=>{
		const root = rootRef && rootRef.current;
		const sp = root ? findScrollParent(root) : null;
		if(!root || !sp){ return undefined; }
		let pending = false;
		const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn)=>setTimeout(fn, 16);
		const compute = ()=>{
			pending = false;
			const pr = sp.getBoundingClientRect();
			if(lockRef.current){ return; }
			// 高亮「占据视口上三分之一线」的分区:最后一个顶边越过该线的分区即当前分区(只看 24px 会让下一张卡占满屏时仍亮着上一张)。
			// 同排两张卡顶边相等:取先出现的那张(左卡),不让右卡凭顺序靠后白赢;滚到底时末节够不到那条线,直接认最后一节。
			const line = pr.top + Math.max(24, pr.height * 0.35);
			const atEnd = sp.scrollHeight > sp.clientHeight + 2 && sp.scrollTop + sp.clientHeight >= sp.scrollHeight - 2;
			let cur = '';
			let last = '';
			let lastTop = -Infinity;
			flatten(list).forEach((s)=>{
				const el = root.querySelector(`[id="${s.id}"]`);
				if(!el){ return; }
				last = s.id;
				const r = el.getBoundingClientRect();
				if(r.top <= line && (!cur || r.top > lastTop + 4)){ cur = s.id; lastTop = r.top; }
			});
			if(atEnd && last){ cur = last; }
			if(cur){ setActive(cur); }
		};
		const onScroll = ()=>{ if(!pending){ pending = true; raf(compute); } };
		const unlock = ()=>{ lockRef.current = false; };
		const UNLOCK_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
		sp.addEventListener('scroll', onScroll, { passive: true });
		UNLOCK_EVENTS.forEach((n)=>sp.addEventListener(n, unlock, { passive: true }));
		compute();
		return ()=>{
			sp.removeEventListener('scroll', onScroll);
			UNLOCK_EVENTS.forEach((n)=>sp.removeEventListener(n, unlock));
		};
	}, [list, rootRef]);
	// 锁在 click 里上(晚于 pointerdown 的解锁),所以点导轨本身不会把自己刚上的锁解掉
	const go = (id)=>{ jumpToSection(rootRef && rootRef.current, id); lockRef.current = true; setActive(id); };
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
