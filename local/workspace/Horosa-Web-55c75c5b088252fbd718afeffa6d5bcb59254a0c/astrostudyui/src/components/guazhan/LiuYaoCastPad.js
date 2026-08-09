// 起卦法尾包:手动摇钱逐掷录入(字/背,吃 coinFace 口径)+米卦+掷骰+逐爻四态+测字笔画+方位外应,
// 统一出口 onCast({ lines:[6 个 0/1 初→上], moving:[1-6] })。另附寻物方位小盘(先天八卦双向量)。
import { Component, Fragment } from 'react';
import { Checkbox } from 'antd';
import { XQButton as Button, XQInputNumber as InputNumber, XQSelect as Select, XQSideSection } from '../xq-ui';
import { Gua8 } from '../gua/GuaConst';

const { Option } = Select;
const C = { muted: 'var(--horosa-astro-muted, #928b82)', accent: 'var(--horosa-accent, #e7bd75)', line: 'var(--horosa-astro-line, rgba(215,173,105,0.18))' };

// 单拆重交名相(据一掷结果的少阳/少阴/老阳/老阴,兼容 coinFace 镜像)
function tossName(backs, face){
	const y = coinTossToYao(backs, face);
	if(y.value === 1 && !y.change){ return { rel: '单', yy: '少阳', mark: '丶', dong: false }; }
	if(y.value === 0 && !y.change){ return { rel: '拆', yy: '少阴', mark: '--', dong: false }; }
	if(y.value === 1 && y.change){ return { rel: '重', yy: '老阳', mark: '○', dong: true }; }
	return { rel: '交', yy: '老阴', mark: '×', dong: true };
}

// 三钱一掷:backs=背面数(0-3);face='standard' 背为阳 /'alt' 字为阳
export function coinTossToYao(backs, face){
	const b = face === 'alt' ? 3 - backs : backs; // alt=字为阳:等价镜像
	if(b === 3){ return { value: 1, change: true }; }  // 三背=重=老阳
	if(b === 0){ return { value: 0, change: true } ; } // 三字=交=老阴
	if(b === 1){ return { value: 1, change: false }; } // 一背两字=单=少阳
	return { value: 0, change: false };                // 两背一字=拆=少阴
}
// 米卦/报数通用:上卦数%8(0作8)、下卦数%8、动爻数%6(0作6)
export function numsToGua(nUp, nDown, nMove){
	const g = (n) => ((n - 1) % 8 + 8) % 8; // 1-8 → Gua8 下标(乾1..坤8 即 Gua8 顺序)
	const up = Gua8[g(nUp === 0 ? 8 : nUp)];
	const down = Gua8[g(nDown === 0 ? 8 : nDown)];
	const move = ((nMove - 1) % 6 + 6) % 6 + 1;
	return { lines: [...down.value, ...up.value], moving: [move] };
}
// 先天卦数:乾1兑2离3震4巽5坎6艮7坤8(=Gua8 顺序);方位外应:后天八方→取象成卦
const FANGWEI = [{ k: '北', g: 5 }, { k: '东北', g: 6 }, { k: '东', g: 3 }, { k: '东南', g: 4 }, { k: '南', g: 2 }, { k: '西南', g: 7 }, { k: '西', g: 1 }, { k: '西北', g: 0 }];

export default class LiuYaoCastPad extends Component{
	constructor(props){
		super(props);
		// [G4] 手动录入默认爻态:少阳(默认=现状)/少阴 —— 逐掷录入(背面数 1↔2)与逐爻四态(7↔8)同步按档。
		const yin = props.defaultYaoState === 'shaoyin';
		this.state = {
			tosses: yin ? [2, 2, 2, 2, 2, 2] : [1, 1, 1, 1, 1, 1], // 每爻背面数(0-3),初→上
			mi1: 8, mi2: 8, mi3: 6,
			dice1: 1, dice2: 1, dice3: 6,
			fourState: yin ? [8, 8, 8, 8, 8, 8] : [7, 7, 7, 7, 7, 7], // 逐爻四态:6老阴7少阳8少阴9老阳
			zi1: '', zi2: '',
			fangwei: 0, hourNum: 1,
			sound1: 1, sound2: 1, // 声音起卦:闻声数(上卦/下卦)
		};
	}
	emit(lines, moving){
		if(this.props.onCast){ this.props.onCast({ lines, moving }); }
	}
	castCoins = () => {
		const face = this.props.coinFace || 'standard';
		const lines = [], moving = [];
		this.state.tosses.forEach((b, i) => {
			const y = coinTossToYao(b, face);
			lines.push(y.value);
			if(y.change){ moving.push(i + 1); }
		});
		this.emit(lines, moving);
	};
	castMi = () => { const r = numsToGua(this.state.mi1, this.state.mi2, this.state.mi3); this.emit(r.lines, r.moving); };
	castDice = () => { const r = numsToGua(this.state.dice1, this.state.dice2, this.state.dice1 + this.state.dice2 + this.state.dice3); this.emit(r.lines, r.moving); };
	castFour = () => {
		const lines = [], moving = [];
		this.state.fourState.forEach((v, i) => {
			lines.push(v === 7 || v === 9 ? 1 : 0);
			if(v === 6 || v === 9){ moving.push(i + 1); }
		});
		this.emit(lines, moving);
	};
	castZi = () => {
		const n1 = Number(this.state.zi1) || 1, n2 = Number(this.state.zi2) || 1;
		const r = numsToGua(n1, n2, n1 + n2);
		this.emit(r.lines, r.moving);
	};
	castFang = () => {
		const g = FANGWEI[this.state.fangwei] ? FANGWEI[this.state.fangwei].g : 0;
		const up = Gua8[g], down = Gua8[(g + this.state.hourNum) % 8];
		const move = ((g + 1 + this.state.hourNum - 1) % 6) + 1;
		this.emit([...down.value, ...up.value], [move]);
	};
	castSound = () => {
		const n1 = Number(this.state.sound1) || 1, n2 = Number(this.state.sound2) || 1;
		const r = numsToGua(n1, n2, n1 + n2);
		this.emit(r.lines, r.moving);
	};
	render(){
		const face = this.props.coinFace || 'standard';
		return (
			<XQSideSection iconName="liuyao" title="摇卦录入与更多起卦" storageKey="guazhan.castpad" className="horosa-guazhan-input-section">
				{this.props.numGuaSlot ? (
					<div className="horosa-castpad-method">
						<div className="horosa-guazhan-set-subhead">数字起卦</div>
						{this.props.numGuaSlot}
					</div>
				) : null}
				<div className="horosa-castpad-method">
					<div className="horosa-guazhan-set-subhead">逐掷录入 · 手动摇钱</div>
					<div className="horosa-castpad-hint">选每爻「背」面数;当前口径 {face === 'alt' ? '字为阳' : '背为阳'},三背=老阳 / 三字=老阴</div>
					{this.state.tosses.map((b, i) => (
						<div key={i} className="horosa-castpad-toss-row">
							<span className="horosa-castpad-toss-yao">{['初', '二', '三', '四', '五', '上'][i]}爻</span>
							<div className="horosa-castpad-toss-btns">
								{[0, 1, 2, 3].map((n) => (
									<button key={n} type="button" className={`horosa-castpad-toss-btn${b === n ? ' is-active' : ''}`}
										onClick={() => { const t = this.state.tosses.slice(); t[i] = n; this.setState({ tosses: t }); }}>{n}背</button>
								))}
							</div>
							{/* [C3] 单拆重交名相:据当前口径的一掷结果 */}
							{(() => { const nm = tossName(b, face); return <span className="horosa-castpad-toss-name" style={{ marginLeft: 8, fontSize: 11.5, color: nm.dong ? C.accent : C.muted, whiteSpace: 'nowrap' }}>{nm.rel}·{nm.yy}·{nm.mark}{nm.dong ? '(动)' : ''}</span>; })()}
						</div>
					))}
					<Button className="horosa-castpad-cast" onClick={this.castCoins}>按录入成卦</Button>
				</div>
				<div className="horosa-castpad-method">
					<div className="horosa-guazhan-set-subhead">米卦 · 三撮粒数</div>
					<div className="horosa-castpad-row">
						<InputNumber min={1} value={this.state.mi1} onChange={(v) => this.setState({ mi1: v || 1 })} />
						<InputNumber min={1} value={this.state.mi2} onChange={(v) => this.setState({ mi2: v || 1 })} />
						<InputNumber min={1} value={this.state.mi3} onChange={(v) => this.setState({ mi3: v || 1 })} />
						<Button onClick={this.castMi}>成卦</Button>
					</div>
				</div>
				<div className="horosa-castpad-method">
					<div className="horosa-guazhan-set-subhead">掷骰 · 上／下／和定动</div>
					<div className="horosa-castpad-row">
						<InputNumber min={1} max={8} value={this.state.dice1} onChange={(v) => this.setState({ dice1: v || 1 })} />
						<InputNumber min={1} max={8} value={this.state.dice2} onChange={(v) => this.setState({ dice2: v || 1 })} />
						<InputNumber min={1} max={6} value={this.state.dice3} onChange={(v) => this.setState({ dice3: v || 1 })} />
						<Button onClick={this.castDice}>成卦</Button>
					</div>
				</div>
				<div className="horosa-castpad-method">
					<div className="horosa-guazhan-set-subhead">逐爻四态 · 牙牌／灵棋／抽签</div>
					<div className="horosa-castpad-four">
						{this.state.fourState.map((v, i) => (
							<Select key={i} size="small" dropdownMatchSelectWidth={false} value={v}
								onChange={(nv) => { const t = this.state.fourState.slice(); t[i] = nv; this.setState({ fourState: t }); }}>
								<Option value={7}>{['初', '二', '三', '四', '五', '上'][i]}·少阳</Option>
								<Option value={8}>少阴</Option>
								<Option value={9}>老阳○</Option>
								<Option value={6}>老阴✕</Option>
							</Select>
						))}
					</div>
					<Button className="horosa-castpad-cast" onClick={this.castFour}>成卦</Button>
				</div>
				<div className="horosa-castpad-method">
					<div className="horosa-guazhan-set-subhead">测字 · 前字画上卦／后字画下卦</div>
					<div className="horosa-castpad-row">
						<InputNumber min={1} placeholder="前字笔画" value={this.state.zi1 || undefined} onChange={(v) => this.setState({ zi1: v })} />
						<InputNumber min={1} placeholder="后字笔画" value={this.state.zi2 || undefined} onChange={(v) => this.setState({ zi2: v })} />
						<Button onClick={this.castZi}>成卦</Button>
					</div>
				</div>
				<div className="horosa-castpad-method">
					<div className="horosa-guazhan-set-subhead">声音外应 · 闻声成卦</div>
					<div className="horosa-castpad-hint">闻声之数定上卦、再闻(或何方之声)定下卦,两数之和定动爻</div>
					<div className="horosa-castpad-row">
						<InputNumber min={1} placeholder="上卦声数" value={this.state.sound1} onChange={(v) => this.setState({ sound1: v || 1 })} />
						<InputNumber min={1} placeholder="下卦声数" value={this.state.sound2} onChange={(v) => this.setState({ sound2: v || 1 })} />
						<Button onClick={this.castSound}>成卦</Button>
					</div>
				</div>
				<div className="horosa-castpad-method">
					<div className="horosa-guazhan-set-subhead">方位外应</div>
					<div className="horosa-castpad-row">
						<Select dropdownMatchSelectWidth={false} value={this.state.fangwei} onChange={(v) => this.setState({ fangwei: v })}>
							{FANGWEI.map((f, i) => <Option key={f.k} value={i}>{f.k}</Option>)}
						</Select>
						<InputNumber min={1} max={12} placeholder="时辰数" value={this.state.hourNum} onChange={(v) => this.setState({ hourNum: v || 1 })} />
						<Button onClick={this.castFang}>成卦</Button>
					</div>
				</div>
			</XQSideSection>
		);
	}
}

// ── 寻物方位小盘(现代法):三硬币和值奇阳偶阴×6 → 上卦=个人向量(面北框)/下卦=地理向量 → 合成方位 ──
const XIANTIAN_FANG = { 乾: '南', 兑: '东南', 离: '东', 震: '东北', 巽: '西南', 坎: '西', 艮: '西北', 坤: '北' };
const FANG_VEC = { 北: [0, 1], 东北: [1, 1], 东: [1, 0], 东南: [1, -1], 南: [0, -1], 西南: [-1, -1], 西: [-1, 0], 西北: [-1, 1] };
const PERSON_FRAME = { 南: '后', 北: '前', 东: '右', 西: '左', 东南: '右后', 东北: '右前', 西南: '左后', 西北: '左前' }; // 面朝正北
export function xunWuCompute(lines){
	if(!lines || lines.length !== 6){ return null; }
	const tri = (bits) => ({ '111': '乾', '110': '兑', '101': '离', '100': '震', '011': '巽', '010': '坎', '001': '艮', '000': '坤' })[bits.join('')];
	const down = tri(lines.slice(0, 3)), up = tri(lines.slice(3, 6));
	const upFang = XIANTIAN_FANG[up], downFang = XIANTIAN_FANG[down];
	const v1 = FANG_VEC[upFang], v2 = FANG_VEC[downFang];
	const sum = [v1[0] + v2[0], v1[1] + v2[1]];
	const norm = (n) => (n === 0 ? 0 : n > 0 ? 1 : -1);
	const key = Object.keys(FANG_VEC).find((k) => FANG_VEC[k][0] === norm(sum[0]) && FANG_VEC[k][1] === norm(sum[1])) || (sum[0] === 0 && sum[1] === 0 ? '原地(两向相抵)' : '');
	return { up, down, upFang, downFang, personHint: PERSON_FRAME[upFang], combined: key };
}
export function LiuYaoXunWu({ lines }){
	const r = xunWuCompute(lines);
	if(!r){ return <div style={{ color: C.muted, fontSize: 12 }}>起卦后显示寻物方位。</div>; }
	return (
		<div style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', fontSize: 13 }}>
			<div>上卦 <b style={{ color: C.accent }}>{r.up}</b>(先天{r.upFang}→身位「{r.personHint}」) + 下卦 <b style={{ color: C.accent }}>{r.down}</b>(地理{r.downFang})</div>
			<div style={{ marginTop: 4 }}>合成方位:<b style={{ color: C.accent }}>{r.combined || '—'}</b>　<span style={{ color: C.muted, fontSize: 12 }}>(今法:双向量合成,占遗失作方位参考)</span></div>
		</div>
	);
}
