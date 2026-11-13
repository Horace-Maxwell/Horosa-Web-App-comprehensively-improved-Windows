// components/astro/AstroOrbSetting.js
// 容许度自定义：逐星 orb（度）+ 整体缩放倍数。改后重新排盘（orbs/orbScale 随 /chart 下发）。
// 仅下发被改动的逐星值（其余回退「默认×缩放」），缩放与逐星互不干扰。默认不下发 → 后端零回归。
import { Component } from 'react';
import { Slider } from 'antd';
import { astroSymbol } from './AstroExtraCommon';
import { XQButton, XQInputNumber, XQSettingGroup, XQSettingRow } from '../xq-ui';

// 默认容许度（度），与排盘引擎默认表一致。
export const DEFAULT_ORBS = [
	{ id: 'Sun', name: '太阳', orb: 15 },
	{ id: 'Moon', name: '月亮', orb: 12 },
	{ id: 'Mercury', name: '水星', orb: 7 },
	{ id: 'Venus', name: '金星', orb: 8 },
	{ id: 'Mars', name: '火星', orb: 8 },
	{ id: 'Jupiter', name: '木星', orb: 9 },
	{ id: 'Saturn', name: '土星', orb: 9 },
	{ id: 'Uranus', name: '天王星', orb: 5 },
	{ id: 'Neptune', name: '海王星', orb: 5 },
	{ id: 'Pluto', name: '冥王星', orb: 5 },
	{ id: 'North Node', name: '北交点', orb: 12 },
];

// 古典 moiety(半径)容许度表:七政各有本轮光体半径,两星容许度取两者半和。
// 与本软件默认表仅金星一处不同(默认 8 / moiety 7);采用度数相位口径的流派档一键套用。
// 导出供 schoolPresets 复用(单一真值源,勿在别处重写数值)。
export const MOIETY_ORBS = {
	Sun: 15, Moon: 12, Mercury: 7, Venus: 7, Mars: 8, Jupiter: 9, Saturn: 9,
};

// moiety 与默认表的差异项(仅这些需下发;其余同默认 ⇒ 请求体最小化、缓存键最省)
export function moietyOrbOverrides(){
	const out = {};
	DEFAULT_ORBS.forEach((d) => {
		const m = MOIETY_ORBS[d.id];
		if(m !== undefined && Number(m) !== Number(d.orb)){ out[d.id] = m; }
	});
	return out;
}

class AstroOrbSetting extends Component {
	constructor(props){
		super(props);
		const cur = (props.fields && props.fields.orbs && props.fields.orbs.value) ? props.fields.orbs.value : {};
		const rows = DEFAULT_ORBS.map((o) => ({ ...o, orb: (cur[o.id] !== undefined && cur[o.id] !== null) ? cur[o.id] : o.orb }));
		const scale = (props.fields && props.fields.orbScale && props.fields.orbScale.value) ? props.fields.orbScale.value : 1;
		this.state = { rows, scale };
		this.apply = this.apply.bind(this);
		this.reset = this.reset.bind(this);
		this.applyMoiety = this.applyMoiety.bind(this);
	}

	// 一键写入古典 moiety 全表(仅改面板值,仍需按「应用并排盘」下发 ⇒ 可预览、可反悔)
	applyMoiety(){
		const rows = this.state.rows.map((r) => (
			MOIETY_ORBS[r.id] !== undefined ? { ...r, orb: MOIETY_ORBS[r.id] } : { ...r }
		));
		this.setState({ rows });
	}

	setOrb(idx, v){
		const rows = this.state.rows.slice();
		rows[idx] = { ...rows[idx], orb: v };
		this.setState({ rows });
	}

	apply(){
		const { dispatch, fields, onClose } = this.props;
		if(!dispatch || !fields){ return; }
		const orbs = {};
		this.state.rows.forEach((r, i) => {
			if(Number(r.orb) !== Number(DEFAULT_ORBS[i].orb)){ orbs[r.id] = Number(r.orb); }
		});
		const hasOrbs = Object.keys(orbs).length > 0;
		const scale = Number(this.state.scale);
		const nextFields = {
			...fields,
			orbs: { ...(fields.orbs || { name: ['orbs'] }), value: hasOrbs ? orbs : undefined },
			orbScale: { ...(fields.orbScale || { name: ['orbScale'] }), value: (scale && scale !== 1) ? scale : undefined },
		};
		dispatch({ type: 'astro/fetchByFields', payload: nextFields });
		if(onClose){ onClose(); }
	}

	reset(){
		const { dispatch, fields, onClose } = this.props;
		this.setState({ rows: DEFAULT_ORBS.map((o) => ({ ...o })), scale: 1 });
		if(dispatch && fields){
			const nextFields = {
				...fields,
				orbs: { ...(fields.orbs || { name: ['orbs'] }), value: undefined },
				orbScale: { ...(fields.orbScale || { name: ['orbScale'] }), value: undefined },
			};
			dispatch({ type: 'astro/fetchByFields', payload: nextFields });
		}
		if(onClose){ onClose(); }
	}

	render(){
		const { rows, scale } = this.state;
		const changed = rows.filter((r, i) => Number(r.orb) !== Number(DEFAULT_ORBS[i].orb)).length;
		const scaled = Number(scale) !== 1;
		return (
			<div className="horosa-selector-drawer horosa-pick-panel horosa-orb-panel">
				<div className="horosa-setting-body">
					<div className="horosa-setting-scope">
						调整相位容许度。整体缩放按比例放大 / 缩小全部默认值；逐星输入可单独覆盖某一颗。改动在按「应用并排盘」后生效。
					</div>

					<XQSettingGroup title="整体缩放" hint={scaled ? `当前 ${scale}×` : '默认 1×'}>
						<div className="horosa-orb-scale">
							<Slider
								className="horosa-orb-scale-slider"
								min={0.5} max={2.5} step={0.1}
								value={scale}
								onChange={(v) => this.setState({ scale: v })}
								tooltip={{ formatter: (v) => `${v}×` }}
							/>
							<XQInputNumber
								size="small" min={0.5} max={2.5} step={0.1} className="horosa-orb-input"
								value={scale}
								onChange={(v) => this.setState({ scale: v === null ? 1 : v })}
							/>
						</div>
					</XQSettingGroup>

					<XQSettingGroup
						title="逐星容许度"
						hint={changed ? `单位：度 · 已改 ${changed} 项` : '单位：度'}
						extra={<button type="button" className="xq-setting-group-action" onClick={this.applyMoiety}>套用古典半径表</button>}
					>
						{rows.map((r, i) => {
							const def = DEFAULT_ORBS[i].orb;
							const diff = Number(r.orb) !== Number(def);
							return (
								<XQSettingRow
									key={r.id}
									className="xq-pick-row"
									label={<span className="xq-pick-item"><span className="xq-pick-glyph" style={{ fontFamily: 'AstroFont' }}>{astroSymbol(r.id)}</span><span className="xq-pick-name">{r.name}</span></span>}
									badge={diff ? `默认 ${def}°` : null}
									control={(
										<XQInputNumber
											size="small" min={0} max={30} step={0.5} className="horosa-orb-input"
											value={r.orb}
											onChange={(v) => this.setOrb(i, v === null ? 0 : v)}
										/>
									)}
								/>
							);
						})}
						<div className="xq-setting-note">
							古典「半径」表：金星 8° → 7°，其余同默认；采用度数相位的流派档一并套用。成相判据仍按「容许度判据体系」（现行＝两星任一容许度覆盖，不取半和）。
						</div>
					</XQSettingGroup>
				</div>

				<div className="horosa-setting-actions">
					<XQButton type="primary" onClick={this.apply}>应用并排盘</XQButton>
					<XQButton onClick={this.reset}>恢复默认</XQButton>
				</div>
			</div>
		);
	}
}

export default AstroOrbSetting;
