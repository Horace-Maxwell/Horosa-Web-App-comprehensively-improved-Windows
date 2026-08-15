// G7 七气候带 Klimata + 斜升时间表(希腊化古典占星):折叠展示卡,嵌本命「古典」tab。
// 纯前端派生,零后端,零回归:只读现成 chartObj 出生纬度(params.lat / fields.lat 的 "NNnMM" 串)。
// 计算层(七带表/纬度解析/归带/斜升闭式)住 utils/astroClassicalDerived 单源(AI 快照 [古典·气候带] 段同引)。
// ① 7 气候带固定常量(带/城/纬度/最长昼),高亮当前纬度所在带;② 当前纬度 12 座斜升时度(闭式,座和=360);
// ③ Valens 上升时度半圆累计级数标当前带。气候带为地理/术语固定值;中性表述。
import { Component } from 'react';
import { SmallTable } from './AstroExtraCommon';
import { SIGN_CN } from '../../divination/data/hellenisticData';
import { buildBands, readLatDeg, currentBandIndex, obliqueAscensions, toSiderealHour, OBLIQUITY } from '../../utils/astroClassicalDerived';

const MUTED = 'var(--horosa-muted, #999)';
const BORDER = 'var(--horosa-border, rgba(120,120,120,0.28))';
const GOLD = 'var(--horosa-gold, #b8860b)';
const HILITE = 'rgba(184,134,11,.12)';

class AstroKlimata extends Component{
	constructor(props){
		super(props);
		this.state = { open: false };
	}
	render(){
		const chartObj = this.props.value;
		const fields = this.props.fields;
		const { open } = this.state;
		const bands = buildBands();
		const latDeg = readLatDeg(chartObj, fields);
		const curIdx = currentBandIndex(bands, latDeg);
		const hasLat = latDeg !== null;
		const ascs = hasLat ? obliqueAscensions(latDeg) : [];

		const bandRows = bands.map((b, i)=>({ ...b, _cur: i === curIdx }));
		const signRows = ascs.map((asc, i)=>({
			idx: i,
			sign: SIGN_CN[i],
			asc,
			hour: toSiderealHour(asc),
		}));

		return (
			<div className="horosa-info-card horosa-classical-card">
				<div className="horosa-classical-card-title" style={{ cursor: 'pointer', justifyContent: 'space-between' }}
					onClick={()=>this.setState({ open: !open })}>
					<span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
						<span className="horosa-classical-zh">七气候带</span>
						<span className="horosa-classical-en">Klimata · 斜升时间</span>
					</span>
					<span style={{ color: MUTED, fontSize: 12, flex: '0 0 auto' }}>{open ? '收起 ▲' : '展开 ▼'}</span>
				</div>
				{open ? (
					<div style={{ marginTop: 8 }}>
						<div style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>
							古典占星以七条标志性纬线(气候带)划分可居地带,每带最长昼递增半小时。下表标志带为地理固定值;
							{hasLat
								? <span>　当前出生纬度 <b style={{ color: GOLD }}>{Math.abs(latDeg).toFixed(2)}°{latDeg < 0 ? 'S' : 'N'}</b>,归入第 <b style={{ color: GOLD }}>{bands[curIdx] ? bands[curIdx].n : '-'}</b> 带({bands[curIdx] ? bands[curIdx].cityCn : '-'})。</span>
								: <span style={{ color: GOLD }}>　需出生纬度方可定带与斜升时度。</span>}
						</div>

						<div style={{ fontSize: 12, fontWeight: 600, margin: '8px 0 2px' }}>七气候带表</div>
						<SmallTable
							rowKey={(r)=>r.n}
							rows={bandRows}
							rowStyle={(r)=>(r._cur ? { background: HILITE } : undefined)}
							columns={[
								{ key: 'n', title: '带', render: (v, r)=>(<span style={{ color: r._cur ? GOLD : 'inherit', fontWeight: r._cur ? 700 : 400 }}>{v}</span>) },
								{ key: 'cityCn', title: '标志地', render: (v, r)=>(<span>{v}<span style={{ color: MUTED }}> · {r.cityEn}</span></span>) },
								{ key: 'latStr', title: '纬度', render: (v)=>v },
								{ key: 'longestDay', title: '最长昼', render: (v)=>`${v}h` },
								{ key: 'valens', title: '半圆级数', render: (v, r)=>(<span style={{ color: r._cur ? GOLD : 'inherit' }}>{v}</span>) },
							]}
						/>
						<div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
							半圆级数:自上升起半周(180°方向)上升时度的累计基准值,每带递增 4(210 → 234)。
						</div>

						<div style={{ fontSize: 12, fontWeight: 600, margin: '12px 0 2px' }}>当前纬度 · 十二座斜升时度</div>
						{hasLat ? (
							<div>
								<SmallTable
									rowKey={(r)=>r.idx}
									rows={signRows}
									columns={[
										{ key: 'sign', title: '星座', render: (v)=>v },
										{ key: 'asc', title: '上升时度', render: (v)=>`${v.toFixed(2)}°` },
										{ key: 'hour', title: '折恒星时', render: (v)=>`${v.toFixed(2)}h` },
									]}
								/>
								<div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
									斜升时度按 δ=asin(sinε·sinλ)、α=atan2(cosε·sinλ,cosλ)、AD=asin(tanδ·tanφ)、OA=α−AD 闭式,
									ε≈{OBLIQUITY}°;各座之和恒为 360 时度(全黄道升起一周),15 时度折 1 恒星小时。
								</div>
							</div>
						) : (
							<div style={{ color: GOLD, fontSize: 12 }}>需出生纬度。</div>
						)}
					</div>
				) : null}
			</div>
		);
	}
}

export default AstroKlimata;
