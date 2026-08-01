// components/babylon/BabylonHemerology.js —— P8 吉日历(时间占卜体系)。
// 中栏:本盘出生月历网格(30 格 + 生日高亮 + 理想满月 14 日/凶日 13·15·16 标注);
// 右栏:月宜忌/逐日吉凶两体系结构 + 诞生月吉凶链 + 医疗吉日链。忠实呈现体系,不虚构逐日条目。
import { Component } from 'react';
import { HEMEROLOGY, EAE } from '../../divination/data/babylonianData';
import { MONTHS } from '../../divination/babylon/calendar';

class BabylonHemerology extends Component{
	renderMonthGrid(){
		const dark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-horosa-appearance') === 'dark');
		const ink = dark ? '#cabb92' : '#5b4423';
		const gold = dark ? '#b6934a' : '#9a6a25';
		const bad = dark ? '#c4574f' : '#bf3c36';
		const bab = this.props.bab;
		const day = bab ? bab.babylonianDate.day : null;
		const monthLen = bab ? bab.monthLen : 30;
		const W = 560, cell = 66, gap = 8, cols = 6;
		const H = 90 + Math.ceil(30 / cols) * (cell + gap);
		return (
			<svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
				<text x={W / 2} y={24} fontSize="13" fontWeight="600" fill={ink} textAnchor="middle">
					{bab ? `出生月:${bab.babylonianDate.month.akk}(${bab.babylonianDate.month.cn})· ${monthLen} 日` : '月历(30 日图式)'}
				</text>
				<text x={W / 2} y={42} fontSize="9.5" fill={ink} opacity="0.7" textAnchor="middle">月始于日落后新月牙首见;日始于日落;昼夜各三更。</text>
				{Array.from({ length: 30 }, (_, i) => {
					const d = i + 1;
					const cx = 24 + (i % cols) * (cell + gap);
					const cy = 58 + Math.floor(i / cols) * (cell + gap);
					const isBirth = day === d;
					const ideal14 = d === 14;
					const badFull = d === 13 || d === 15 || d === 16;
					const beyond = d === 30 && monthLen === 29;
					return (
						<g key={d} opacity={beyond ? 0.35 : 1}>
							<rect x={cx} y={cy} width={cell} height={cell} rx={8}
								fill={isBirth ? (dark ? 'rgba(182,147,74,0.25)' : 'rgba(154,106,37,0.14)') : 'transparent'}
								stroke={isBirth ? gold : 'rgba(122,94,48,0.3)'} strokeWidth={isBirth ? 1.6 : 0.7} />
							<text x={cx + cell / 2} y={cy + 24} fontSize="15" fill={ink} textAnchor="middle" fontWeight={isBirth ? 700 : 500}>{d}</text>
							{ideal14 ? <text x={cx + cell / 2} y={cy + 42} fontSize="8.5" fill={gold} textAnchor="middle">理想满月</text> : null}
							{badFull ? <text x={cx + cell / 2} y={cy + 42} fontSize="8.5" fill={bad} textAnchor="middle">满月落此凶</text> : null}
							{isBirth ? <text x={cx + cell / 2} y={cy + 56} fontSize="8.5" fill={gold} textAnchor="middle">出生日</text> : null}
							{beyond ? <text x={cx + cell / 2} y={cy + 56} fontSize="8" fill={ink} opacity="0.7" textAnchor="middle">该月缺</text> : null}
						</g>
					);
				})}
			</svg>
		);
	}

	render(){
		const bab = this.props.bab;
		return (
			<div className="horosa-babylon-body" style={{ height: this.props.height }}>
				<div className="horosa-babylon-stage">
					<div className="horosa-babylon-svgwrap">{this.renderMonthGrid()}</div>
					<div style={{ width: '100%', maxWidth: 620, padding: '0 12px 12px' }}>
						<div className="horosa-babylon-card">
							<div className="horosa-babylon-card-title">十二月序</div>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
								{MONTHS.map((m) => (
									<span key={m.n} className="horosa-babylon-badge" style={bab && Math.floor(bab.babylonianDate.month.n) === m.n ? { fontWeight: 700 } : null}>
										{m.n}·{m.akk}
									</span>
								))}
							</div>
							<div className="horosa-babylon-caveat">19 年 7 闰:周期第 3,6,8,11,14,17,19 年;第 17 年闰六月,其余闰十二月。</div>
						</div>
					</div>
				</div>
				<div className="horosa-babylon-readout">
					{this.props.schemePanel}
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">月宜忌汇编(「他拆毁、他建造」)</div>
						<div>{HEMEROLOGY.iqqurIpus}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">逐日吉凶历</div>
						<div>{HEMEROLOGY.babylonianAlmanac}</div>
						<div className="horosa-babylon-caveat">{HEMEROLOGY.caveat}</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">诞生月吉凶(诞生预兆链)</div>
						{EAE.examples.filter((e) => e.type.indexOf('满月') >= 0).map((e, i) => <div key={i}>· {e.text}</div>)}
						<div>· 「生于某月」之吉凶底料出自月宜忌传统;个人星盘之后件(其寿将长/将有子嗣)与之同源。</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">医疗吉日链</div>
						<div>{HEMEROLOGY.links}</div>
					</div>
				</div>
			</div>
		);
	}
}

export default BabylonHemerology;
