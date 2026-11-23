import React from 'react';
import { isBookmarked, toggleBookmark, subscribeBookmarks } from './xuanshiBookmarks';
import { pressable } from '../../utils/pressable';

// 收藏星 ☆/★ —— 详情页右上角;点击切换 localStorage 私藏,跨案头实时同步。
export default class XuanShiStar extends React.Component {
	constructor(props) { super(props); this.state = { on: false }; }
	componentDidMount() { this.sync(); this._unsub = subscribeBookmarks(() => this.sync()); }
	componentWillUnmount() { if (this._unsub) { this._unsub(); } }
	componentDidUpdate(prev) {
		const a = prev.item || {}, b = this.props.item || {};
		if (a.ref !== b.ref || a.kind !== b.kind) { this.sync(); }
	}
	sync() { const it = this.props.item || {}; this.setState({ on: isBookmarked(it.kind, it.ref) }); }
	toggle(e) { if (e) { e.stopPropagation(); } this.setState({ on: toggleBookmark(this.props.item) }); }
	render() {
		if (!this.props.item || !this.props.item.ref) { return null; }
		return (
			<span className={`xuanshi-star${this.state.on ? ' is-on' : ''}`} role="button"
				title={this.state.on ? '已收藏 · 点击取消' : '收藏到案头'} {...pressable((e) => this.toggle(e), { role: false })}>{this.state.on ? '★' : '☆'}</span>
		);
	}
}
