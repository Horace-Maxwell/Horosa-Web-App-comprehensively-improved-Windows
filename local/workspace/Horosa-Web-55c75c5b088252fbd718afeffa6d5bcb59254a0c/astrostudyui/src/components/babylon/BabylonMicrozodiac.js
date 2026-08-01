// components/babylon/BabylonMicrozodiac.js —— P4 微黄道 / 历表映射(144 微段 ×2;30°)。
// 中栏:12×12 网格(行=宫,列=微段),点选/输入黄经 → ×12(命名微段)/×13(图式月位)/×277(历日)联动高亮。
// 右栏:所选微段全对应(旺星/身体/配料/巫术)+ 算法说明 + 变体差异。
import { Component } from 'react';
import { XQSelect } from '../xq-ui';
import { BABYLON_SIGNS, MICROZODIAC_EXTRA, babylonSign } from '../../divination/data/babylonianData';
import { dodeca12, microSegment, kalendertextD, kalendertextK, lonToSchematicDate, buildMicroGrid } from '../../divination/babylon/microzodiac';
import { lonToSignDeg, signDegToLon, sexFormat } from '../../divination/babylon/units';

const GRID = buildMicroGrid();

class BabylonMicrozodiac extends Component{
	constructor(props){
		super(props);
		// 默认选中盘月位置(若有),否则经典算例摩羯 17°
		const lons = props.lons || {};
		const L0 = lons.moon !== undefined ? lons.moon : signDegToLon(10, 17);
		// 无月时初始即「经典算例」(此前误标 'custom':custom 不在下拉 options 里,Select 显示未列举值)
		this.state = { lon: L0, source: lons.moon !== undefined ? 'moon' : 'classic' };
		this._touched = false;   // 用户是否手动选过来源/点过网格(未动过才允许月亮迟到后自动接管)
	}

	componentDidUpdate(prevProps){
		// 星历/盘位常在本页首屏后才到:跟随月亮(source=moon 随值更新;
		// 初始因无月而落 classic 且用户未动过 → 月亮一到自动升级为本盘月)。
		const m = this.props.lons && this.props.lons.moon;
		const pm = prevProps.lons && prevProps.lons.moon;
		if(m === undefined || m === pm){ return; }
		if(this.state.source === 'moon'){ this.setLon(m, 'moon'); }
		else if(this.state.source === 'classic' && !this._touched){ this.setLon(m, 'moon'); }
	}

	setLon(lon, source){ this.setState({ lon: ((lon % 360) + 360) % 360, source: source || 'custom' }); }

	render(){
		const opts = this.props.opts || {};
		const variant = opts.dodecaVariant === 'A' ? 'A' : 'B';
		const lons = this.props.lons || {};
		const L = this.state.lon;
		const { sign, deg } = lonToSignDeg(L);
		const dd = dodeca12(L, variant);
		const d13 = kalendertextD(L);
		const k277 = kalendertextK(L);
		const dateOf277 = lonToSchematicDate(k277);
		const seg13 = lonToSignDeg(d13);
		const selSign = babylonSign(sign);
		const microSignInfo = babylonSign(dd.microSign);
		const srcOptions = [
			...(lons.moon !== undefined ? [{ value: 'moon', label: '本盘月亮' }] : []),
			...(lons.sun !== undefined ? [{ value: 'sun', label: '本盘太阳' }] : []),
			{ value: 'classic', label: '经典算例(摩羯 17°)' },
			// 点网格单元后来源即为「自选」——必须在 options 里,否则 Select 顶着未列举值显示
			{ value: 'custom', label: '自选微段(点网格)' },
		];
		return (
			<div className="horosa-babylon-body" style={{ height: this.props.height }}>
				<div className="horosa-babylon-stage" style={{ padding: 12 }}>
					<div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, width: '100%', maxWidth: 1180 }}>
						<XQSelect size="small" style={{ minWidth: 150 }} value={this.state.source}
							options={srcOptions}
							onChange={(v) => {
								this._touched = true;
								if(v === 'moon'){ this.setLon(lons.moon, 'moon'); }
								else if(v === 'sun'){ this.setLon(lons.sun, 'sun'); }
								else if(v === 'custom'){ this.setState({ source: 'custom' }); }   // 保持当前经度
								else { this.setLon(signDegToLon(10, 17), 'classic'); }
							}} />
						<span style={{ fontSize: 12.5 }}>
							当前位置:<b>{selSign ? selSign.cn : sign} {sexFormat(deg, { frac: 1 })}°</b>(L={L.toFixed(2)}°)
						</span>
						<span style={{ fontSize: 11, opacity: 0.65 }}>点网格单元可任选微段中点</span>
					</div>
					<div className="horosa-babylon-grid144">
						<div className="cell head">宫\段</div>
						{Array.from({ length: 12 }, (_, k) => (
							<div key={k} className="cell head">{k + 1}</div>
						))}
						{BABYLON_SIGNS.map((s) => (
							[<div key={`h${s.n}`} className="cell head" title={s.cune}>{s.cn}</div>].concat(
								Array.from({ length: 12 }, (_, kk) => {
									const k = kk + 1;
									const ms = microSegment(s.n, k);
									const from = (s.n - 1) * 30 + (k - 1) * 2.5;
									const isSel = sign === s.n && Math.floor(deg / 2.5) === kk;
									const is13 = seg13.sign === s.n && Math.floor(seg13.deg / 2.5) === kk;
									const msInfo = babylonSign(ms);
									return (
										<div key={`${s.n}-${k}`}
											className={`cell${isSel ? ' hl' : ''}${is13 ? ' hl13' : ''}`}
											title={`${s.cn}第 ${k} 段(${from}°–${from + 2.5}°)→ 微宫 ${msInfo ? msInfo.cn : ms}`}
											onClick={() => { this._touched = true; this.setLon(from + 1.25); }}>
											{msInfo ? msInfo.cn : ms}
										</div>
									);
								})
							)
						))}
					</div>
					<div style={{ fontSize: 12, opacity: 0.7, marginTop: 8, width: '100%', maxWidth: 1180 }}>
						红框 = 当前位置所在微段;绿虚框 = ×13 图式月位所落微段。单元字 = 该微段所属「微宫」(自本宫起顺数)。
					</div>
				</div>
				<div className="horosa-babylon-readout">
					{this.props.schemePanel}
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">三算法读出(变体 {variant})</div>
						<div>·「十二分」dodecatemorion:宫内度 {sexFormat(deg, { frac: 1 })}° × 12 → <b>{(() => { const r = lonToSignDeg(dd.lon); const si = babylonSign(r.sign); return `${si ? si.cn : r.sign} ${sexFormat(r.deg, { frac: 1 })}°`; })()}</b></div>
						<div>· 命名微段:{selSign ? selSign.cn : ''}第 {dd.microIndex} 段 → 微宫 <b>{microSignInfo ? microSignInfo.cn : ''}</b></div>
						<div>· ×13(图式月):13×L mod 360 = <b>{d13.toFixed(1)}°</b>({(() => { const si = babylonSign(seg13.sign); return `${si ? si.cn : ''} ${sexFormat(seg13.deg, { frac: 1 })}°`; })()})</div>
						<div>· ×277(历日逆映射):277×L mod 360 = <b>{k277.toFixed(1)}°</b> → 图式 {dateOf277.M} 月 {Math.round(dateOf277.d)} 日</div>
						<div className="horosa-babylon-caveat">
							恒等式 13×277 = 3601 ≡ 1 (mod 360):乘 277 撤销乘 13(楔文 277 写作 4,37)。
							×12=仅距角(2.5°微↔30°实);×13=×12+随日 1°(月全日动);变体 A(加于宫起点)与 B(加于点本身)结果可差约 29°,楔文方案表行如 B。
						</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">所在宫对应({selSign ? selSign.cn : ''})</div>
						<div>身体部位:{selSign ? selSign.body : '—'}({selSign ? selSign.bodyAkk : ''})</div>
						<div>仪式配料:{selSign ? selSign.ingredient : '—'}</div>
						<div>巫术/咒类:{selSign && selSign.magic ? selSign.magic : '(该宫未见楔文记载)'}</div>
						<div>旺星(秘密之屋):{selSign && selSign.exaltOf ? ({ sun: '太阳', moon: '月亮', jupiter: '木星', mercury: '水星', saturn: '土星', mars: '火星', venus: '金星' }[selSign.exaltOf]) : '(无)'}</div>
						<div className="horosa-babylon-caveat">
							配料或为理论性/暗名(「狮血」类代号)。逐宫「石–草–木」与「城市/神庙」两栏:{MICROZODIAC_EXTRA.stones.caveat}
						</div>
					</div>
					<div className="horosa-babylon-card">
						<div className="horosa-babylon-card-title">微段网格结构</div>
						<div>每宫 12 微段 × 2;30° = 144 段;首段=本宫、续段顺黄道:微宫 = ((宫−1+段−1) mod 12)+1。</div>
						<div className="horosa-babylon-caveat">{MICROZODIAC_EXTRA.microzodiac13} 受孕预兆圆图:{MICROZODIAC_EXTRA.conception}</div>
					</div>
				</div>
			</div>
		);
	}
}

export default BabylonMicrozodiac;
