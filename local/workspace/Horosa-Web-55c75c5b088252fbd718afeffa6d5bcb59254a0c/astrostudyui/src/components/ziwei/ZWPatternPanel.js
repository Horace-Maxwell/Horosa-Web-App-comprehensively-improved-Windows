import { Component } from 'react';
import { chartSCUEnabled } from '../../utils/perfFlags';

const CAT_ORDER = ['富贵', '文贵', '武贵', '破格'];
const CAT_CLASS = { 富贵: 'fugui', 文贵: 'wengui', 武贵: 'wugui', 破格: 'poge' };

const HUA_NAMES = { '禄': '化禄', '权': '化权', '科': '化科', '忌': '化忌' };

function joinStars(arr) {
	return (arr || []).join('、');
}

// 把后端格局条件原语（与 ZiWeiPattern.java 的 op 一一对应）翻成人话。
// 覆盖全部 17 个 op；未知 op 返回空串（不展示，绝不抛错）。
export function opToText(cond) {
	if (!cond || !cond.op) {
		return '';
	}
	const op = cond.op;
	switch (op) {
		case 'and':
			return (cond.conditions || []).map(opToText).filter(Boolean).join('；且 ');
		case 'or':
			return (cond.conditions || []).map(opToText).filter(Boolean).join('；或 ');
		case 'inMing':
			return `${cond.star}坐命宫`;
		case 'inTrine':
			return `${cond.star}会照命宫三方四正`;
		case 'inTrineAny':
			return `${joinStars(cond.stars)} 至少 ${cond.atLeast || 1} 颗会命三方`;
		case 'same':
			return `${joinStars(cond.stars)}同宫`;
		case 'sameAnyOf':
			return `${cond.star}与 ${joinStars(cond.others)} 任一同宫`;
		case 'mingZhi':
			return `命宫坐 ${joinStars(cond.branches)} 宫`;
		case 'inZhi':
			return `${cond.star}落 ${joinStars(cond.branches)} 宫`;
		case 'sandwichMing':
			return `${joinStars(cond.stars)}夹命宫`;
		case 'sandwichStarMix':
			return `${cond.star}与生年${HUA_NAMES[cond.hua] || ('化' + cond.hua)}夹${cond.target}`;
		case 'bright':
			return `${cond.star}入庙旺（${joinStars(cond.levels)}）`;
		case 'mingNoMainStar':
			return '命宫无正曜（借对宫安星）';
		case 'huaMing':
			return `生年${HUA_NAMES[cond.hua] || ('化' + cond.hua)}星坐命宫`;
		case 'huaTrineAll':
			return `生年 ${(cond.huas || []).map((h) => HUA_NAMES[h] || ('化' + h)).join('、')} 皆会命三方`;
		case 'huaWithStar':
			return `${cond.star}生年${HUA_NAMES[cond.hua] || ('化' + cond.hua)}`;
		case 'breakBy':
			return `命宫或对宫逢 ${joinStars(cond.stars)}`;
		case 'inOpp':
			return `迁移宫（对宫）有 ${joinStars(cond.stars)}`;
		case 'sandwichHua':
			return `命宫被生年${HUA_NAMES[cond.hua] || ('化' + cond.hua)}相夹`;
		default:
			return '';
	}
}

class ZWPatternPanel extends Component {
	constructor(props) {
		super(props);
		this.state = { expanded: {} };
		this.toggle = this.toggle.bind(this);
	}

	toggle(name) {
		this.setState((s) => ({ expanded: { ...s.expanded, [name]: !s.expanded[name] } }));
	}

	// horosa_ziwei_pattern_scu_v1:本面板输出只由 props.patterns(后端/本地引擎每次产新数组)与
	// 本地展开态 state.expanded 决定。父级因无关 state 重渲时,原先会连带重跑数十条格局的
	// sort + map + opToText 全量翻译。任一真正变化即照常渲染;未知/新增 props 由键数比兜底。
	// kill-switch 同 chartSCU。
	shouldComponentUpdate(nextProps, nextState) {
		if (!chartSCUEnabled()) {
			return true;
		}
		if (nextState !== this.state) {
			return true;
		}
		const prev = this.props;
		if (prev === nextProps) {
			return false;
		}
		if (!prev || !nextProps) {
			return true;
		}
		const pk = Object.keys(prev);
		const nk = Object.keys(nextProps);
		if (pk.length !== nk.length) {
			return true;
		}
		for (let i = 0; i < nk.length; i += 1) {
			if (prev[nk[i]] !== nextProps[nk[i]]) {
				return true;
			}
		}
		return false;
	}

	renderDetail(p) {
		const conds = Array.isArray(p.conditions) ? p.conditions : [];
		const breakers = Array.isArray(p.breakers) ? p.breakers : [];
		const condTexts = conds.map(opToText).filter(Boolean);
		const breakerTexts = breakers.map(opToText).filter(Boolean);
		const logicTip = `${p.logic === 'OR' ? '满足其一即可' : '需同时满足'}`;
		return (
			<div className="horosa-ziwei-pattern-detail">
				{condTexts.length > 0 ? (
					<div className="horosa-ziwei-pattern-conds">
						<div className="horosa-ziwei-pattern-detail-title">成局条件（{logicTip}）</div>
						<ul>
							{condTexts.map((t, i) => (
								<li key={i}>{t}</li>
							))}
						</ul>
					</div>
				) : (
					<div className="horosa-ziwei-pattern-detail-note">{p.duanyi || '已命中本格局。'}</div>
				)}
				{breakerTexts.length > 0 && (
					<div className="horosa-ziwei-pattern-breakers">
						<div className="horosa-ziwei-pattern-detail-title">破格条件{p.broken ? '（已触发）' : '（未触发）'}</div>
						<ul>
							{breakerTexts.map((t, i) => (
								<li key={i} className={p.broken ? 'is-broken' : ''}>{t}</li>
							))}
						</ul>
					</div>
				)}
				{p.source_ref && <div className="horosa-ziwei-pattern-detail-src">出处：{p.source_ref}</div>}
			</div>
		);
	}

	render() {
		const patterns = this.props.patterns || [];
		if (!patterns.length) {
			return <div className="horosa-empty-hint">起盘后显示命中格局；本盘暂未命中所收录格局。</div>;
		}
		const sorted = patterns.slice().sort((a, b) => {
			const ca = CAT_ORDER.indexOf(a.category);
			const cb = CAT_ORDER.indexOf(b.category);
			return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
		});
		return (
			<div className="horosa-ziwei-pattern-scroll">
				<div className="horosa-ziwei-pattern-count">命中格局 · {patterns.length}</div>
				<div className="horosa-ziwei-pattern-list">
					{sorted.map((p) => {
						const cls = CAT_CLASS[p.category] || 'fugui';
						const open = !!this.state.expanded[p.name];
						return (
							<div className={`horosa-ziwei-pattern-item cat-${cls} ${open ? 'is-open' : ''}`} key={p.name}>
								<div
									className="horosa-ziwei-pattern-head"
									onClick={() => this.toggle(p.name)}
									role="button"
								>
									<span className="horosa-ziwei-pattern-name">{p.name}</span>
									<span className={`horosa-ziwei-pattern-cat cat-${cls}`}>{p.category}</span>
									{p.broken && <span className="horosa-ziwei-pattern-broken">破格</span>}
									<span className="horosa-ziwei-pattern-toggle">{open ? '收起' : '详情'}</span>
								</div>
								<div className="horosa-ziwei-pattern-duanyi">{p.duanyi}</div>
								{open && this.renderDetail(p)}
								{!open && p.source_ref && <div className="horosa-ziwei-pattern-src">— {p.source_ref}</div>}
							</div>
						);
					})}
				</div>
			</div>
		);
	}
}

export default ZWPatternPanel;
