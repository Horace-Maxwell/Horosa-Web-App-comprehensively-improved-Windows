import { Component } from 'react';
import { XQDrawer } from '../xq-ui';
import * as AstroConst from '../../constants/AstroConst';
import {
	PLANET_ANGLE, ANGLE_NAME, LS_DIRECTION, PARAN_STAGE, STAR_MEANING,
	ANGLE_EXTRA, SENSITIVE_MEANING, SPECIAL_MEANING, ZONE_MEANING,
} from './interpretations.zh';

// 含义速查抽屉(P4):行星×四角 / 本地空间方向 / paran人生阶段 / 固定星 / 附加角 / 敏感点 / 影响带
// 全量原创中文,与右侧「落点分析」并列(同 placement=right)。传 activeLines 时先列"当前盘已激活线"的定向解读。
const PLANET_CN = {
	[AstroConst.SUN]: '太阳', [AstroConst.MOON]: '月亮', [AstroConst.MERCURY]: '水星', [AstroConst.VENUS]: '金星',
	[AstroConst.MARS]: '火星', [AstroConst.JUPITER]: '木星', [AstroConst.SATURN]: '土星', [AstroConst.URANUS]: '天王星',
	[AstroConst.NEPTUNE]: '海王星', [AstroConst.PLUTO]: '冥王星', [AstroConst.NORTH_NODE]: '北交点', [AstroConst.SOUTH_NODE]: '南交点',
	[AstroConst.CHIRON]: '凯龙星', [AstroConst.DARKMOON]: '莉莉丝', [AstroConst.PURPLE_CLOUDS]: '紫炁',
	[AstroConst.CERES]: '谷神星', [AstroConst.PALLAS]: '智神星', [AstroConst.JUNO]: '婚神星', [AstroConst.VESTA]: '灶神星', [AstroConst.ERIS]: '阋神星',
};
const ANGLE_ORDER = ['MC', 'IC', 'Asc', 'Desc'];
const EXTRA_CN = { vertex: '宿命点线', antivertex: '反宿命点线', eastpoint: '东点线', cusp: '宫尖线', oob: '超界 OOB', antiscia: '映点线' };
const SENS_CN = { vertex: '宿命点', eastpoint: '东点', coasc_koch: '副上升(Koch)', coasc_munkasey: '副上升(Munkasey)', polarasc: '极地上升' };
const SPECIAL_CN = { davison: 'Davison 合盘地点', eclipse: '食点角化' };
const ZONE_CN = { core: '核心带 0–1°', strong: '强影响 1–3°', wide: '余韵 3–5°', paran: 'paran 纬带 ~1°' };

const H = (t) => ({ fontWeight: 600, fontSize: 13.5, margin: '14px 0 6px', color: 'var(--horosa-astro-gold, #d7ad69)' });
const ROW = { fontSize: 12, lineHeight: 1.6, padding: '3px 0', borderBottom: '1px solid rgba(128,128,128,0.12)' };

class AcgReferencePanel extends Component {
	render() {
		const active = Array.isArray(this.props.activeLines) ? this.props.activeLines : [];
		// 当前盘已激活线的定向解读(planet:angle 选集 → 逐条富义)
		const activeInterps = active.map((l) => {
			const [p, a] = l.split(':');
			const angKey = { asc: 'Asc', desc: 'Desc', mc: 'MC', ic: 'IC' }[a] || a;
			const txt = PLANET_ANGLE[p] && PLANET_ANGLE[p][angKey];
			return txt ? { p, angKey, txt } : null;
		}).filter(Boolean);
		return (
			<XQDrawer title="含义速查" width={420} placement="right" open={!!this.props.open}
				onClose={this.props.onClose} maskClosable={true}
				style={{ height: 'calc(100% - 0px)', overflow: 'auto', paddingBottom: 40, backgroundColor: 'transparent' }}>
				<div style={{ padding: '4px 4px 20px' }}>
					{activeInterps.length ? (
						<>
							<div style={H()}>当前盘已激活线</div>
							{activeInterps.slice(0, 40).map((x, i) => (
								<div key={i} style={ROW}>
									<b>{PLANET_CN[x.p] || x.p} {ANGLE_NAME[x.angKey]}</b>：{x.txt}
								</div>
							))}
						</>
					) : null}

					{this.props.planets ? (
						<>
							<div style={H()}>天顶点 · 天底点（此星直落头顶处）</div>
							<div style={{ fontSize: 11, opacity: 0.55, margin: '0 0 4px' }}>天顶=行星正当头顶的地点(纬=赤纬);天底=其对跖点。OOB=赤纬超黄赤交角(越回归线,能量出格)。</div>
							{Object.keys(this.props.planets).map((pk) => {
								const z = this.props.planets[pk].zenith;
								if (!z) return null;
								const fmtLat = (v) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'N' : 'S'}`;
								const fmtLon = (v) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'E' : 'W'}`;
								return (
									<div key={pk} style={{ ...ROW, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
										<span>{PLANET_CN[pk] || pk}{this.props.planets[pk].oob ? <span style={{ color: '#e0793f', fontSize: 10, marginLeft: 5 }}>OOB</span> : null}</span>
										<span style={{ opacity: 0.8, fontSize: 11 }}>天顶 {fmtLat(z.lat)} {fmtLon(z.lon)} · 天底 {fmtLat(-z.lat)} {fmtLon(z.lon > 0 ? z.lon - 180 : z.lon + 180)}</span>
									</div>
								);
							})}
						</>
					) : null}

					<div style={H()}>行星 × 四角(落地含义)</div>
					{Object.keys(PLANET_ANGLE).map((p) => (
						<div key={p} style={{ padding: '6px 0', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
							<div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 2 }}>{PLANET_CN[p] || p}</div>
							{ANGLE_ORDER.map((a) => (
								<div key={a} style={{ fontSize: 11.5, lineHeight: 1.55, opacity: 0.82, padding: '1px 0' }}>
									<span style={{ opacity: 0.6 }}>{ANGLE_NAME[a]}</span>：{PLANET_ANGLE[p][a]}
								</div>
							))}
						</div>
					))}

					<div style={H()}>本地空间方向</div>
					{Object.keys(LS_DIRECTION).map((p) => (
						<div key={p} style={ROW}><b>{PLANET_CN[p] || p}</b>：{LS_DIRECTION[p]}</div>
					))}

					<div style={H()}>派状 · 人生阶段</div>
					{[['rise', '升起'], ['culminate', '中天'], ['set', '落下'], ['lowerculminate', '下中天']].map(([k, cn]) => (
						PARAN_STAGE[k] ? <div key={k} style={ROW}><b>{cn}</b>：{PARAN_STAGE[k]}</div> : null
					))}

					<div style={H()}>固定星角化</div>
					{Object.keys(STAR_MEANING).map((s) => (
						<div key={s} style={ROW}><b>{s}</b>：{STAR_MEANING[s]}</div>
					))}

					<div style={H()}>附加角</div>
					{Object.keys(ANGLE_EXTRA).map((k) => (
						<div key={k} style={ROW}><b>{EXTRA_CN[k] || k}</b>：{ANGLE_EXTRA[k]}</div>
					))}

					<div style={H()}>落点敏感点</div>
					{Object.keys(SENSITIVE_MEANING).map((k) => (
						<div key={k} style={ROW}><b>{SENS_CN[k] || k}</b>：{SENSITIVE_MEANING[k]}</div>
					))}

					<div style={H()}>Davison · 食点</div>
					{Object.keys(SPECIAL_MEANING).map((k) => (
						<div key={k} style={ROW}><b>{SPECIAL_CN[k] || k}</b>：{SPECIAL_MEANING[k]}</div>
					))}

					<div style={H()}>影响带速查</div>
					{Object.keys(ZONE_MEANING).map((k) => (
						<div key={k} style={ROW}><b>{ZONE_CN[k] || k}</b>：{ZONE_MEANING[k]}</div>
					))}
				</div>
			</XQDrawer>
		);
	}
}

export default AcgReferencePanel;
