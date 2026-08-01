// components/astro/AstroDodeca.js
// 十二分度（Dodecatemoria / 12th-parts）：座内度数 ×12 自座首前进。纯前端派生，嵌于本命「古典」tab。
import { Component } from 'react';
import { astroSymbol, fmtNum, cardStyle, SmallTable } from './AstroExtraCommon';
import { SIGNS, SIGN_ORDER } from '../../divination/data/signs';

function norm360(x){ return ((x % 360) + 360) % 360; }
function dodecaLon(lon){ const L = norm360(lon); return norm360(Math.floor(L / 30) * 30 + (L % 30) * 12); }
function signOf(lon){ return SIGN_ORDER[Math.floor(norm360(lon) / 30)]; }
const sn = (s) => (SIGNS[s] && SIGNS[s].cn) || s || '-';

const BODY_IDS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'Pars Fortuna', 'Asc', 'MC'];

class AstroDodeca extends Component {
	render(){
		const chartObj = this.props.value;
		if(!chartObj || !chartObj.chart) return null;
		const byId = {};
		(chartObj.chart.objects || []).forEach((o) => { if(o && o.id) byId[o.id] = o; });
		(chartObj.chart.angles || []).forEach((a) => { if(a && a.id) byId[a.id] = a; });
		const rows = [];
		BODY_IDS.forEach((id) => {
			const o = byId[id];
			if(!o || o.lon == null) return;
			const dl = dodecaLon(o.lon);
			const dl2 = dodecaLon(dl);   // 十二分度之十二分度(双重×12);古典用于区分近乎相同的两盘
			rows.push({
				id,
				natalSign: o.sign ? String(o.sign).toLowerCase() : signOf(o.lon),
				natalSignlon: o.signlon != null ? o.signlon : (norm360(o.lon) % 30),
				sign: signOf(dl),
				signlon: dl % 30,
				sign2: signOf(dl2),
				signlon2: dl2 % 30,
			});
		});
		return (
			<div style={cardStyle}>
				<div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>十二分度（Dodecatemoria）</div>
				<SmallTable
					rowKey={(r) => r.id}
					rows={rows}
					columns={[
						{ key: 'id', title: '星体', render: (v) => astroSymbol(v) },
						{ key: 'natalSign', title: '本命', render: (_v, r) => `${sn(r.natalSign)} ${fmtNum(r.natalSignlon, 1)}°` },
						{ key: 'sign', title: '12分度', render: (_v, r) => `${sn(r.sign)} ${fmtNum(r.signlon, 1)}°` },
						{ key: 'sign2', title: '再12分度', render: (_v, r) => `${sn(r.sign2)} ${fmtNum(r.signlon2, 1)}°` },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>座内度数×12 自该座 0° 起前进取得；古典用于细察星体精微落点。「再12分度」= 对 12 分度再取一次 12 分度（双重细分），用于区分出生时刻极为接近的两盘。</div>
			</div>
		);
	}
}

export default AstroDodeca;
