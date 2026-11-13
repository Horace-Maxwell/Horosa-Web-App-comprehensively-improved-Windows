// 操作手册外壳:左边是本页全部技法的「父级菜单」(按类分组),右边只显示一个技法的完整手册。
// 打开帮助时直接停在你当前所在的那个技法(PageHeader 每次打开都重新挂载本件;没来得及卸载时,页签一变本件也自己落回当前章)。
//
// book 形状(各 *HelpDoc 导出,帮助弹窗与给 AI 的纯文本同一份):
//   { title, groups: [{ key, label, chapters: [{ key, label, aliases?: [...], render: ()=>JSX }] }],
//     resolveActive?: (ctx)=>chapterKey }      ctx = { currentTab, currentSubTab, hostTechnique }
// 章节键 = 页面上该技法子页签的运行时键(currentSubTab / 宿主页技法键);aliases 收别名(如数算按中文标签记)。
// 🔴 正文惰性构建:只调用当前章的 render(百来章全建一遍白费);给 AI 的纯文本由 utils/aiTools/helpText 逐章展开。
import React, { Component } from 'react';
import { XQSelect as Select } from '../xq-ui';
import { pointerLocalRatio } from '../../utils/zoomDomain';

const NAV_W = 212;

export function bookChapters(book){
	const out = [];
	((book && book.groups) || []).forEach((g)=>((g && g.chapters) || []).forEach((c)=>{ if(c && c.key){ out.push({ ...c, groupKey: g.key, groupLabel: g.label, groupHint: g.hint }); } }));
	return out;
}

// 运行时键 → 章节键:先问本书自己的 resolveActive,再按章节键 / 别名直接匹配;都不中回首章
export function resolveChapterKey(book, ctx){
	const chapters = bookChapters(book);
	if(!chapters.length){ return null; }
	const tryKey = (k)=>{
		if(k === undefined || k === null || k === ''){ return null; }
		const hit = chapters.find((c)=>c.key === k || (c.aliases || []).indexOf(k) >= 0);
		return hit ? hit.key : null;
	};
	const c = ctx || {};
	let picked = null;
	if(book && typeof book.resolveActive === 'function'){
		try{ picked = tryKey(book.resolveActive(c)); }catch(e){ picked = null; }
	}
	return picked || tryKey(c.currentSubTab) || tryKey(c.hostTechnique) || chapters[0].key;
}

class HelpBook extends Component{
	constructor(props){
		super(props);
		const here = resolveChapterKey(props.book, props.ctx);
		this.state = { key: here, here };
		this.mainRef = React.createRef();
		this.navRef = React.createRef();
	}

	// 打开时左栏菜单把「当前」那一项滚进视野(星运三十多章,当前技法常在菜单下半截)
	// 弹窗入场动画期间菜单还没有布局高度,挂载后隔几十毫秒再量(不用 rAF:窗格隐藏时 rAF 停摆)
	componentDidMount(){
		this._navTimers = [60, 320].map((ms)=>setTimeout(()=>this.revealActive(), ms));
	}

	// 弹窗收起后要等收起动画的回调(afterClose)才卸载本件;窗口在后台 / 动画回调没赶上时,下一次打开仍是上一次那个实例。
	// 所以「当前技法」不能只在构造时定:页签 / 子页签 / 宿主技法一变就重新落到当前章(同一页签内再开,仍停在你翻到的那章)。
	componentDidUpdate(prevProps){
		const a = prevProps.ctx || {};
		const b = this.props.ctx || {};
		if(prevProps.book === this.props.book && a.currentTab === b.currentTab && a.currentSubTab === b.currentSubTab && a.hostTechnique === b.hostTechnique){ return; }
		const here = resolveChapterKey(this.props.book, this.props.ctx);
		if(here === this.state.here){ return; }
		this.setState({ key: here, here }, ()=>{
			if(this.mainRef.current){ this.mainRef.current.scrollTop = 0; }
			this.revealActive();
		});
	}

	componentWillUnmount(){
		(this._navTimers || []).forEach((t)=>clearTimeout(t));
	}

	revealActive(){
		const nav = this.navRef.current;
		const item = nav && nav.querySelector('.horosa-help-book-item.is-active');
		if(!nav || !item || !nav.clientHeight){ return; }
		// 矩形是整页缩放后的尺寸,scrollTop / clientHeight 是缩放前的:先折回同一单位
		const navBox = nav.getBoundingClientRect();
		const ky = pointerLocalRatio(nav, navBox).ky;
		const r = item.getBoundingClientRect();
		const top = (r.top - navBox.top) * ky + nav.scrollTop;
		if(top < nav.scrollTop || top + r.height * ky > nav.scrollTop + nav.clientHeight){
			nav.scrollTop = Math.max(0, top - nav.clientHeight / 3);
		}
	}

	select(key){
		this.setState({ key }, ()=>{ if(this.mainRef.current){ this.mainRef.current.scrollTop = 0; } });
	}

	renderNav(chapters, groups){
		const { key, here } = this.state;
		if(this.props.compact){
			return (
				<div className="horosa-help-book-select">
					<Select value={key} onChange={(v)=>this.select(v)} style={{ width: '100%' }}
						options={groups.map((g)=>({ label: g.label, options: (g.chapters || []).map((c)=>({ value: c.key, label: `${c.label}${c.key === here ? '(当前)' : ''}` })) }))} />
				</div>
			);
		}
		return (
			<nav ref={this.navRef} className="horosa-help-book-nav" style={{ flex: `0 0 ${NAV_W}px` }}>
				{groups.map((g)=>(
					<div key={g.key} className="horosa-help-book-group">
						{g.label ? <div className="horosa-help-book-group-label">{g.label}</div> : null}
						{(g.chapters || []).map((c)=>(
							<button type="button" key={c.key}
								className={`horosa-help-book-item${c.key === key ? ' is-active' : ''}`}
								onClick={()=>this.select(c.key)}>
								<span className="horosa-help-book-item-label">{c.label}</span>
								{c.key === here ? <span className="horosa-help-book-here">当前</span> : null}
							</button>
						))}
					</div>
				))}
			</nav>
		);
	}

	render(){
		const { book, height } = this.props;
		const groups = ((book && book.groups) || []).filter((g)=>g && (g.chapters || []).length);
		const chapters = bookChapters(book);
		if(!chapters.length){ return null; }
		const idx = Math.max(0, chapters.findIndex((c)=>c.key === this.state.key));
		const chapter = chapters[idx];
		const prev = idx > 0 ? chapters[idx - 1] : null;
		const next = idx < chapters.length - 1 ? chapters[idx + 1] : null;
		let content = null;
		try{ content = typeof chapter.render === 'function' ? chapter.render() : null; }catch(e){ content = null; }
		return (
			<div className={`horosa-help-book${this.props.compact ? ' is-compact' : ''}`} style={{ height: height || 'calc(72 * var(--horosa-lvh, 1vh))' }}>
				{this.renderNav(chapters, groups)}
				<main ref={this.mainRef} className="horosa-help-book-main">
					<div className="horosa-help-book-crumb">
						{book.title ? <span>{book.title}</span> : null}
						{chapter.groupLabel ? <span className="horosa-help-book-crumb-sep">›</span> : null}
						{chapter.groupLabel ? <span>{chapter.groupLabel}</span> : null}
					</div>
					<h2 className="horosa-help-book-title">{chapter.label}</h2>
					{chapter.groupHint ? <div className="horosa-help-book-hint">{chapter.groupHint}</div> : null}
					<div className="horosa-help-book-body">{content}</div>
					{prev || next ? (
						<div className="horosa-help-book-pager">
							{prev ? <button type="button" onClick={()=>this.select(prev.key)}>‹ {prev.label}</button> : <span />}
							{next ? <button type="button" onClick={()=>this.select(next.key)}>{next.label} ›</button> : <span />}
						</div>
					) : null}
				</main>
			</div>
		);
	}
}

export default HelpBook;
