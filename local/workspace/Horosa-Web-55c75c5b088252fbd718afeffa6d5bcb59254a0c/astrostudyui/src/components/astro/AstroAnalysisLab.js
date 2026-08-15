import { Component } from 'react';
import { Spin } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, astroSymbolList, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, gridStyle, SmallTable } from './AstroExtraCommon';
import { buildPatternOverview } from '../../utils/astroPatternOverview';
import { classicalGlobalValue } from '../../utils/classicalChartGlobals';   // [审计修] 恒星轨随全局仓,与导出/挂载三方同口径
import { SIGNS } from '../../divination/data/signs';

// 阿拉伯点中文名(中性词;英文名同列小字便于对照)。
const LOT_CN = {
	'Pars Fortuna': '福点', 'Pars Spirit': '精神点', 'Pars Faith': '信仰点', 'Pars Substance': '资财点',
	'Pars Wedding [Male]': '婚姻点(男)', 'Pars Wedding [Female]': '婚姻点(女)', 'Pars Sons': '子女点',
	'Pars Father': '父亲点', 'Pars Mother': '母亲点', 'Pars Brothers': '兄弟点', 'Pars Diseases': '疾厄点',
	'Pars Death': '死亡点', 'Pars Travel': '旅行点', 'Pars Friends': '朋友点', 'Pars Enemies': '仇敌点',
	'Pars Saturn': '土星点', 'Pars Jupiter': '木星点', 'Pars Mars': '火星点', 'Pars Venus': '金星点',
	'Pars Mercury': '水星点', 'Pars Horsemanship': '骑术点', 'Pars Life': '生命点', 'Pars Radix': '本源点',
	// 希腊化补全六点(「根基点」专指 Basis,与择日点引擎/词汇表/显赫指标同名)
	'Pars Basis': '根基点', 'Pars Exaltation': '擢升点', 'Pars Sons Valens': '儿子点',
	'Pars Daughters': '女儿点', 'Pars Praxis': '事业点', 'Pars Wedding Dorothean': '婚姻点(通式)',
	'Pars Eros': '爱欲点', 'Pars Necessity': '必然点', 'Pars Courage': '勇气点', 'Pars Victory': '胜利点',
	'Pars Nemesis': '报应点',
};

class AstroAnalysisLab extends Component{
	constructor(props){
		super(props);
		this.state = {
			loading: false,
			result: null,
			requestKey: '',
			failedKey: '',
			failedMsg: '',
		};
		this.load = this.load.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
	}

	componentWillUnmount(){
		this._mounted = false;
	}

	buildRequestKey(){
		// requestKey 含 voidClassical(星盘设置开关,经 props 传入):切换古典义要重新请求(否则被相等去重挡住),componentDidUpdate 据此自动重算。
		return chartRequestKey(this.props.value, `analysis|vc:${this.props.voidClassical ? 1 : 0}`);
	}

	componentDidUpdate(prevProps){
		const key = this.buildRequestKey();
		if(key && key !== this.state.requestKey && key !== this.state.failedKey && !this.state.loading){
			this.load();
		}
	}

	// 显式重试:清掉失败标记后重新请求(参数未变也能重来)。
	retry = ()=>{
		this.setState({ failedKey: '', failedMsg: '' }, this.load);
	};

	ensureLoaded(){
		const key = this.buildRequestKey();
		if(key && key !== this.state.requestKey && key !== this.state.failedKey && !this.state.loading){
			setTimeout(this.load, 0);
		}
	}

	async load(){
		if(!this.props.value){
			return;
		}
		const key = this.buildRequestKey();
		this.setState({loading: true});
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/analysis`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					// [审计修] 曾硬编 1°:用户改恒星轨后右栏格局 tab 与导出/挂载(皆读全局仓)命中集分叉。
					fixedStarOrb: classicalGlobalValue('fixedStarOrb'),
					voidClassical: !!this.props.voidClassical,
				}),
				silent: true,
				timeoutMs: 30000,
			});
			if(!this._mounted) return;
			this.setState({result: unwrapResult(data) || {}, loading: false, requestKey: key, failedKey: '', failedMsg: ''});
		}catch(e){
			if(!this._mounted) return;
			this.setState({loading: false, failedKey: key, failedMsg: (e && e.message) ? `${e.message}` : ''});
		}
	}

	renderPatterns(patterns){
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">相位格局</div>
				{patterns && patterns.length ? (
					<div style={gridStyle}>
						{patterns.map((item, idx)=>(
							<div key={`${item.type}-${idx}`} style={{padding: 8, border: '1px solid rgba(148,163,184,.22)', borderRadius: 6}}>
								<strong>{item.label}</strong>
								<div>{astroSymbolList(item.points)}</div>
								{item.apex ? <div>顶点：{astroSymbol(item.apex)}</div> : null}
								{item.sign ? <div>星座：{astroSymbol(item.sign)}</div> : null}
								{item.span !== undefined ? <div>跨度：{fmtNum(item.span)}°</div> : null}
							</div>
						))}
					</div>
				) : <div>未检出主要格局。</div>}
			</div>
		);
	}

	renderDistribution(dist){
		if(!dist){
			return null;
		}
		const rows = [];
		Object.keys(dist.elements || {}).forEach((key)=>rows.push({group: '元素', key, value: dist.elements[key]}));
		Object.keys(dist.modes || {}).forEach((key)=>rows.push({group: '模式', key, value: dist.modes[key]}));
		Object.keys(dist.hemispheres || {}).forEach((key)=>rows.push({group: '半球', key, value: dist.hemispheres[key]}));
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">分布权重</div>
				<SmallTable
					rows={rows}
					columns={[
						{key: 'group', title: '分类'},
						{key: 'key', title: '项目'},
						{key: 'value', title: '数量'},
					]}
				/>
			</div>
		);
	}

	renderAlmutem(almutem){
		if(!almutem){
			return null;
		}
		const totals = Object.keys(almutem.totals || {}).map((key)=>({
			planet: key,
			score: almutem.totals[key],
		})).sort((a, b)=>b.score - a.score);
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">Almuten 与古典得分</div>
				<div style={{marginBottom: 8}}>总主：{astroSymbol(almutem.winner)}</div>
				<SmallTable
					rows={totals}
					columns={[
						{key: 'planet', title: '星体', render: (val)=>astroSymbol(val)},
						{key: 'score', title: '分数'},
					]}
				/>
			</div>
		);
	}

	renderTemperament(temp){
		if(!temp){
			return null;
		}
		const rows = [];
		Object.keys(temp.temperaments || {}).forEach((key)=>rows.push({group: '气质', key, value: temp.temperaments[key]}));
		Object.keys(temp.qualities || {}).forEach((key)=>rows.push({group: '性质', key, value: temp.qualities[key]}));
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">气质评估</div>
				<SmallTable
					rows={rows}
					columns={[
						{key: 'group', title: '分类'},
						{key: 'key', title: '项目'},
						{key: 'value', title: '分数'},
					]}
				/>
			</div>
		);
	}

	renderLots(lots){
		const list = lots || [];
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">阿拉伯点 Arabic Lots（{list.length}）</div>
				<SmallTable
					rows={list.slice(0, 120)}
					columns={[
						{key: 'label', title: '点', render: (v)=> (
							<span>{LOT_CN[v] || v}<span style={{opacity: 0.55, fontSize: 11, marginLeft: 6}}>{`${v}`.replace('Pars ', '')}</span></span>
						)},
						{key: 'category', title: '题', render: (v)=> v || '其它'},
						{key: 'sign', title: '位置', render: (_v, row)=>fmtDegree(row)},
					]}
				/>
			</div>
		);
	}

	// WI-22 恒星触发:中文名 + 王者/比尼属性(性质=托勒密行星标)。要星(王者→比尼)置顶。
	renderFixedStars(hits){
		const list = hits || [];
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">恒星触发</div>
				<SmallTable
					rows={list.slice(0, 80)}
					columns={[
						{key: 'star', title: '恒星', render: (v, row)=> (
							<span>{row.cn || v}<span style={{opacity: 0.5, fontSize: 11, marginLeft: 6}}>{v}</span></span>
						)},
						{key: 'attr', title: '属性', render: (_v, row)=>{
							if(row.royal) return <span style={{color: 'var(--horosa-gold, #b8860b)'}}>{`王·${row.royal} ${row.nature}`}</span>;
							if(row.behenian) return <span style={{color: 'var(--horosa-jade, #3a9a6a)'}}>{`比尼 ${row.nature}`}</span>;
							return '—';
						}},
						{key: 'point', title: '触发点', render: (val)=>astroSymbol(val)},
						{key: 'sign', title: '位置', render: (_v, row)=>fmtDegree(row)},
						{key: 'orb', title: '容许度', render: (val)=>`${fmtNum(val)}°`},
					]}
				/>
			</div>
		);
	}

	// WI-08 古典格局:护卫 / 优势相位(右旋三分四分六分) / 度数围攻。
	renderClassicalPatterns(cp){
		const c = cp || {};
		const dory = c.doryphory || [];
		const over = c.overcoming || [];
		const bes = c.besieging || [];
		const OVR_LABEL = { trine: '三分压制', square: '四分压制', sextile: '六分压制' };
		const has = dory.length || over.length || bes.length;
		// 字形定宽盒:占星字体里各字形进距不一(狮子等很窄),统一居中定宽,避免相互挤压/括号被吞。
		const g = (id) => <span style={{display: 'inline-block', minWidth: '1.3em', textAlign: 'center'}}>{astroSymbol(id)}</span>;
		const sgn = (s) => (s ? <span style={{opacity: 0.7}}>（{g(s)}）</span> : null);
		const word = (txt) => <span style={{margin: '0 4px'}}>{txt}</span>;
		const muted = (txt) => <span style={{opacity: 0.7, marginLeft: 4}}>{txt}</span>;
		const sub = (title, items, fn) => (items.length ? (
			<div style={{marginBottom: 6}}>
				<strong>{title}</strong>
				{items.map((d, i)=> <div key={`${title}-${i}`} style={{lineHeight: 1.9}}>{fn(d)}</div>)}
			</div>
		) : null);
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">古典格局</div>
				{!has ? <div>未检出古典格局。</div> : (
					<div>
						{sub('护卫', dory, (d)=> <span>{g(d.planet)}{word('护卫')}{g(d.light)}{muted(`光前 ${Math.abs(d.elong)}°`)}</span>)}
						{sub('优势相位', over, (d)=> <span>{g(d.over)}{sgn(d.overSign)}{word('凌驾')}{g(d.under)}{sgn(d.underSign)}{muted(OVR_LABEL[d.aspect] || d.aspect)}</span>)}
						{sub('度数围攻', bes, (d)=> <span>{g(d.planet)}{word('被')}{g(d.left)}{g(d.right)}{word('度数围攻')}{muted(`±${Math.max(d.leftOrb, d.rightOrb)}°`)}</span>)}
					</div>
				)}
			</div>
		);
	}

	// WI-16 偶然尊贵评分:每星加权得分 + 因子明细,与必然尊贵并列。
	renderAccidentalDignity(rows){
		const list = rows || [];
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">偶然尊贵 Accidental Dignity</div>
				{list.length ? (
					<SmallTable columns={[
						{ key: 'planet', title: '星体', render: (v)=>astroSymbol(v) },
						{ key: 'score', title: '得分', render: (v)=> (v > 0 ? '+' : '') + v },
						{ key: 'factors', title: '因子', render: (v)=> (v || []).join('  ') },
					]} rows={list} rowKey={(r)=>r.planet} />
				) : <div>暂无</div>}
			</div>
		);
	}

	// WI-12 吉化/凶化:每关键星被吉/凶星会合·凌驾处置。
	renderBonification(rows){
		const list = rows || [];
		const seg = (items, cls)=> items.map((d, i)=> <span key={i} style={{marginRight: 8}}>{astroSymbol(d.by)}<span style={{opacity: 0.7, fontSize: 11}}>{d.rel}</span></span>);
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">吉化 / 凶化 Bonification / Maltreatment</div>
				{list.length ? list.map((r, i)=> (
					<div key={i} style={{marginBottom: 4}}>
						{astroSymbol(r.planet)}&emsp;
						{r.bonified.length ? <span style={{color: 'var(--horosa-jade, #3a9a6a)'}}>吉化 {seg(r.bonified)}</span> : null}
						{r.maltreated.length ? <span style={{color: 'var(--horosa-danger, #cf1322)', marginLeft: 8}}>凶化 {seg(r.maltreated)}</span> : null}
					</div>
				)) : <div>未检出明显吉化/凶化。</div>}
			</div>
		);
	}

	// WI-10/11 相位动态 + G10 连接学说后四式:入相/出相 · 左右旋 · 传光 · 聚光 · 不合意 · 交点弯曲
	// · 空亡 · 阻止 · 挫败 · 收回。入相/出相明细已在「相位」tab 完整呈现,此处只保留派生格局,避免重复。
	renderAspectDynamics(ad){
		const a = ad || {};
		const translation = a.translation || [];
		const collection = a.collection || [];
		const aversion = a.aversion || [];
		const bending = a.bending || [];
		const voidList = a.void || [];
		const prohibition = a.prohibition || [];
		const frustration = a.frustration || [];
		const refranation = a.refranation || [];
		const has = translation.length || collection.length || aversion.length || bending.length
			|| voidList.length || prohibition.length || frustration.length || refranation.length;
		const sub = (title, items, fn) => (items.length ? (
			<div style={{marginBottom: 6}}>
				<strong>{title}</strong>
				{items.map((d, i)=> <div key={`${title}-${i}`}>{fn(d)}</div>)}
			</div>
		) : null);
		const muted = (txt) => (txt ? <span style={{opacity: 0.65, fontSize: 11, marginLeft: 4}}>{txt}</span> : null);
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">相位动态 Aspect Dynamics</div>
				{/* 空亡古典义(30°内)开关已移至星盘设置(显示与样式 → 经典尊贵区);此处读 props.voidClassical 自动重算。 */}
				{!has ? <div>未检出传光/聚光/不合意/弯曲/空亡/阻止/挫败/收回。</div> : (
					<div>
						{sub('传光 Translation', translation, (d)=> <span>{astroSymbol(d.mover)} 自 {astroSymbol(d.from)} 传光予 {astroSymbol(d.to)}</span>)}
						{sub('聚光 Collection', collection, (d)=> <span>{astroSymbol(d.collector)} 聚 {astroSymbol(d.p1)} {astroSymbol(d.p2)} 之光</span>)}
						{sub('空亡 Void', voidList, (d)=> <span>{astroSymbol(d.planet)} 离座前不再成精确相位{muted(`${d.mode === 'classical' ? '古典义' : '本座义'}·窗口 ${fmtNum(d.window, 1)}°`)}</span>)}
						{sub('阻止 Prohibition', prohibition, (d)=> <span>{astroSymbol(d.blocker)} 抢先入相 {astroSymbol(d.to)}，截断 {astroSymbol(d.between)}{muted(`剩 ${fmtNum(d.rBlocker, 1)}° < ${fmtNum(d.rOriginal, 1)}°`)}</span>)}
						{sub('挫败 Frustration', frustration, (d)=> <span>{astroSymbol(d.frustrated)} 入相 {astroSymbol(d.via)}，然 {astroSymbol(d.via)} 先成 {astroSymbol(d.to)} 而移情{muted(`剩 ${fmtNum(d.rDefect, 1)}° < ${fmtNum(d.rOriginal, 1)}°`)}</span>)}
						{sub('收回 Refranation', refranation, (d)=> <span>{astroSymbol(d.planet)} 入相 {astroSymbol(d.to)} 中途留停而撤离{muted(`剩 ${fmtNum(d.r, 1)}°`)}</span>)}
						{sub('不合意 Aversion', aversion, (d)=> <span>{astroSymbol(d.a)} 与 {astroSymbol(d.b)} 不合意（无相）</span>)}
						{sub('交点弯曲 Bending', bending, (d)=> <span>{astroSymbol(d.planet)} 落{d.at}</span>)}
					</div>
				)}
			</div>
		);
	}

	// WI-13 逐题主星:每题取相关宫起始星座的必然尊贵胜出星 + 自然象征星。
	renderTopicAlmuten(rows){
		const list = rows || [];
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">逐题主星 Topical Almuten</div>
				{list.length ? (
					<SmallTable columns={[
						{ key: 'topic', title: '题' },
						{ key: 'house', title: '宫', render: (v)=>`${v}宫` },
						{ key: 'significator', title: '自然象征', render: (v)=>astroSymbol(v) },
						{ key: 'almuten', title: '主星', render: (v)=> v ? astroSymbol(v) : '—' },
					]} rows={list} rowKey={(r)=>r.topic} />
				) : <div>暂无</div>}
			</div>
		);
	}

	// WI-18 行星时:昼弧/夜弧各12不等时,值日星起迦勒底轮替,高亮出生所在时段。
	renderPlanetaryHours(ph){
		if(!ph || !ph.hours || !ph.hours.length){
			return (
				<div style={cardStyle}>
					<div className="horosa-info-card-title">行星时 Planetary Hours</div>
					<div>该地无升降(极区)或星历不可用。</div>
				</div>
			);
		}
		const rows = ph.hours;
		const col = (arc, title)=> (
			<div>
				<div style={{fontSize: 11, opacity: 0.6, marginBottom: 3}}>{title}</div>
				{arc.map((h)=> (
					<div key={h.index} style={{
						display: 'flex', justifyContent: 'space-between', alignItems: 'center',
						padding: '1px 6px', borderRadius: 4,
						background: h.current ? 'rgba(184,134,11,.16)' : 'transparent',
						fontWeight: h.current ? 600 : 400,
					}}>
						<span><span style={{opacity: 0.5, fontSize: 11, marginRight: 4}}>{h.diurnal ? h.index : h.index - 12}</span>{astroSymbol(h.ruler)}</span>
						<span style={{opacity: 0.7, fontSize: 11}}>{`${h.start.slice(0, 5)}`}</span>
					</div>
				))}
			</div>
		);
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">行星时 Planetary Hours</div>
				<div style={{marginBottom: 6, opacity: 0.85, fontSize: 12}}>
					值日星 {astroSymbol(ph.dayRuler)}　日出 {ph.sunrise && ph.sunrise.slice(0, 5)}　日落 {ph.sunset && ph.sunset.slice(0, 5)}
				</div>
				<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px'}}>
					{col(rows.slice(0, 12), '昼时')}
					{col(rows.slice(12, 24), '夜时')}
				</div>
			</div>
		);
	}

	// WI-27 参照星定位(巴比伦式):每七政最近亮参照星 + 黄经距;<1°标合。
	renderBabylonian(rows){
		const list = rows || [];
		if(!list.length){ return null; }
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">参照星定位 Reference Stars</div>
				<SmallTable rows={list} rowKey={(r)=>r.planet} columns={[
					{ key: 'planet', title: '行星', render: (v)=>astroSymbol(v) },
					{ key: 'cn', title: '参照星', render: (v, row)=> <span>{v || row.star}<span style={{opacity: 0.5, fontSize: 11, marginLeft: 4}}>{row.star}</span></span> },
					{ key: 'dist', title: '黄经距', render: (v, row)=> <span>{fmtNum(v)}°{row.conj ? <span style={{color: 'var(--horosa-gold, #b8860b)', marginLeft: 4}}>合</span> : null}</span> },
					// 楔文读法(定名距星表升级新增;老数据无此键时列空,零回归)
					{ key: 'cubits', title: '楔文读法', render: (v, row)=> (row.latDir === undefined ? null
						: <span style={{fontSize: 11.5}}>{row.latDir}{row.lonDir} {v} 肘 {row.fingers} 指</span>) },
				]} />
			</div>
		);
	}

	// WI-28 埃及历法:天狼偕日升(岁首 wepet-renpet 标志) + 上升十分宫(36 旬·夜时主十分宫)。
	renderEgyptian(eg){
		const e = eg || {};
		if(!e.siriusRising && !e.decanIndex){ return null; }
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">埃及历法 Egyptian Calendar</div>
				<div style={{lineHeight: 1.95}}>
					<div>天狼偕日升 <span style={{opacity: 0.6, fontSize: 11}}>埃及岁首</span>：{e.siriusRising || '—'}{e.siriusYear ? <span style={{opacity: 0.6, fontSize: 11, marginLeft: 4}}>（{e.siriusYear}）</span> : null}</div>
					{e.decanIndex ? <div>上升十分宫：第 {e.decanIndex} 旬 · {astroSymbol(e.decanSign)} · 主 {astroSymbol(e.decanRuler)}<span style={{opacity: 0.6, fontSize: 11, marginLeft: 6}}>夜时主十分宫</span></div> : null}
				</div>
			</div>
		);
	}

	// 格局补全卡片(本盘派生,非 /astroextra):大势格局·龙脉(龙截龙拥+孤月独明) / 皇室伴寝·东升西没 / 吉凶格局 / 心性智识·月水。
	// 完整呈现(非速览):复用 buildPatternOverview 单一真值。主宰循环/接纳互容/三围已在古典 tab,此处不重复。
	renderPatternOverview(){
		const chartObj = this.props.value;
		if(!chartObj || !chartObj.chart){ return null; }
		// 「仅按本垣擢升计算互容接纳」与信息 tab 同步:先验权力等取自联结,口径须一致。
		let onlyRulExalt = false;
		try{ const s = JSON.parse((typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem(Constants.GlobalSetupKey)) || '{}'); onlyRulExalt = !!(s && (s.showOnlyRulExaltReception === 1 || s.showOnlyRulExaltReception === true)); }catch(e){ onlyRulExalt = false; }
		let data;
		try{ data = buildPatternOverview(chartObj.chart, chartObj, { onlyRulExalt }); }catch(e){ return null; }
		if(!data || data.empty){ return null; }
		const g = (id) => <span style={{display: 'inline-block', minWidth: '1.3em', textAlign: 'center'}}>{astroSymbol(id)}</span>;
		const muted = (txt) => (txt ? <span style={{opacity: 0.7, marginLeft: 4}}>{txt}</span> : null);
		const sc = (s) => { const k = s ? String(s).toLowerCase() : null; return (SIGNS[k] && SIGNS[k].cn) || s || '?'; };
		const glyphCn = (id) => ({ Sun: '日', Moon: '月', Mercury: '水', Venus: '金', Mars: '火', Jupiter: '木', Saturn: '土' }[id] || id);
		const title = (t) => <div className="horosa-info-card-title">{t}</div>;
		const body = { fontSize: 12.5, lineHeight: 2 };
		const cards = [];

		// 1) 大势格局 · 龙脉(龙截龙拥 + 孤月独明 + 先验权力)
		const d = data.dragon; const lm = data.loneMoon; const ap = data.apriori || {};
		cards.push(
			<div style={cardStyle} key="pat-dashi">
				{title('大势格局 · 龙脉')}
				<div style={body}>
					<div>龙脉：{d && d.has ? (
						d.kind === '龙拥' ? <span>龙拥{muted(d.note || '七星聚一侧')}</span>
						: d.pair ? <span>龙截 {d.pair.map((x, i)=> <span key={i}>{g(x)}</span>)}{muted('两星联结')}</span>
						: <span>龙截 {g(d.lone)}{muted(`${sc(d.loneSign)}${d.loneHouse ? `·${d.loneHouse}宫` : ''}${(d.loneRules && d.loneRules.length) ? `·主${d.loneRules.join('/')}宫` : ''}`)}</span>
					) : <span style={{opacity: 0.6}}>无龙截/龙拥{d && d.reason ? muted(d.reason) : null}</span>}</div>
					<div>孤月独明：{lm && lm.has ? <span>{g('Moon')}{muted('夜生·唯月在地平上')}</span> : <span style={{opacity: 0.6}}>否{lm && lm.reason ? muted(lm.reason) : (lm ? muted(`地平上${lm.aboveCount}星`) : null)}</span>}</div>
					<div>先验权力：{ap.has ? <span>{ap.links.map((lk, i)=> <span key={i} style={{marginRight: 10}}>{g(lk.a)}<span style={{opacity: 0.7, margin: '0 2px'}}>{lk.kind}</span>{g(lk.b)}{muted(`${lk.which}联结`)}</span>)}{ap.eightKill ? <span style={{color: 'var(--horosa-gold, #b8860b)'}}>夜生·八杀朝天大贵</span> : muted('昼生·非八杀朝天')}</span> : <span style={{opacity: 0.6}}>无{muted('8·12 或 8·1 之联结')}</span>}</div>
				</div>
			</div>
		);

		// 2) 皇室伴寝 · 东升西没(日月各列全部东升/西没,首西没标注)
		const v = data.vocation || {};
		const compLine = (label, comp) => comp ? (
			<div>
				<span style={{opacity: 0.8}}>{label}</span>
				<span style={{marginLeft: 6}}>东升 {comp.oriental.length ? comp.oriental.map((x, i)=> <span key={i}>{g(x)}</span>) : <span style={{opacity: 0.6}}>无</span>}</span>
				<span style={{marginLeft: 10}}>西没 {comp.occidental.length ? comp.occidental.map((x, i)=> <span key={i} style={{fontWeight: x === comp.firstOccidental ? 700 : 400}}>{g(x)}</span>) : <span style={{opacity: 0.6}}>无</span>}</span>
			</div>
		) : null;
		cards.push(
			<div style={cardStyle} key="pat-banqin">
				{title('皇室伴寝 · 东升西没')}
				<div style={body}>
					{compLine('月(后)', v.moon)}
					{compLine('日(皇)', v.sun)}
					{v.career ? <div>职业(月第一西没)：{g(v.career.id)}{muted(`${sc(v.career.sign)}${v.career.house ? `·${v.career.house}宫` : ''}${v.career.flags && v.career.flags.length ? `·${v.career.flags.join('')}` : ''}`)}</div> : null}
					{v.style ? <div>行事(日第一西没)：{g(v.style.id)}{muted(`${sc(v.style.sign)}${v.style.house ? `·${v.style.house}宫` : ''}`)}</div> : null}
				</div>
			</div>
		);

		// 3) 吉凶格局(强吉木·照耀 + 后天凶星 + 先验吉凶)
		const j = data.jupiter; const af = data.afflictedRulers || [];
		cards.push(
			<div style={cardStyle} key="pat-jixiong">
				{title('吉凶格局')}
				<div style={body}>
					{j && j.present ? <div>强吉木星：{g('Jupiter')}{muted(`${j.strong ? '强吉' : '非强吉'}·${sc(j.sign)}${j.dign ? `·${j.dign}` : ''}${(j.ruleHouses && j.ruleHouses.length) ? `·主${j.ruleHouses.join('/')}宫` : ''}`)} 照耀{j.litCount}星 {j.lit.map((x, i)=> <span key={i}>{g(x)}</span>)}</div> : null}
					<div>后天凶星：{af.length ? af.map((x, i)=> <span key={i}>{g(x)}</span>) : <span style={{opacity: 0.6}}>无</span>}{muted('主6/8/12宫者')}</div>
					<div style={{opacity: 0.7}}>先验：凶 {g('Mars')}{g('Saturn')}　吉 {g('Venus')}{g('Jupiter')}</div>
				</div>
			</div>
		);

		// 4) 心性智识 · 月水(文档573:座·模式·主宰星·资质·受损)
		const mm = data.moonMercury || {};
		const mmLine = (label, o) => o ? (
			<div><span style={{opacity: 0.8}}>{label}</span> {g(o.id)}{muted(`${sc(o.sign)}${o.modality ? `·${o.modality}` : ''}${o.ruler ? `·主${glyphCn(o.ruler)}${o.rulerDign || ''}` : ''}${o.flags && o.flags.length ? `·${o.flags.join('')}` : ''}`)}</div>
		) : null;
		cards.push(
			<div style={cardStyle} key="pat-xinzhi">
				{title('心性智识 · 月水')}
				<div style={body}>
					{mmLine('生性(月)', mm.moon)}
					{mmLine('智识(水)', mm.mercury)}
				</div>
			</div>
		);

		return cards;
	}

	render(){
		this.ensureLoaded();
		const result = this.state.result || {};
		return (
			<Spin spinning={this.state.loading}>
				<div style={{height: this.props.height || 560, overflow: 'auto', paddingRight: 8, paddingBottom: 28}}>
					{this.state.failedKey && this.state.failedKey === this.buildRequestKey() ? (
						<div style={cardStyle}>
							<div className="horosa-info-card-title">格局分析未取到</div>
							<div style={{fontSize: 12, opacity: 0.75, marginBottom: 8}}>
								{this.state.failedMsg ? '本地计算服务未响应,请稍候重试。' : '本次请求未返回结果。'}
							</div>
							<a onClick={this.retry}>重新计算</a>
						</div>
					) : null}
					{this.renderPatterns(result.patterns)}
					{this.renderClassicalPatterns(result.classicalPatterns)}
					{this.renderPatternOverview()}
					{this.renderAspectDynamics(result.aspectDynamics)}
					{this.renderAccidentalDignity(result.accidentalDignity)}
					{/* 吉化/凶化 Bonification 暂去除(鸡肋);renderBonification 方法保留以便日后恢复。 */}
					{this.renderDistribution(result.distribution)}
					{this.renderAlmutem(result.almutem)}
					{this.renderTopicAlmuten(result.topicAlmuten)}
					{this.renderPlanetaryHours(result.planetaryHours)}
					{this.renderEgyptian(result.egyptianCalendar)}
					{this.renderTemperament(result.temperament)}
					{this.renderLots(result.extraLots)}
					{this.renderFixedStars(result.fixedStarHits)}
					{this.renderBabylonian(result.babylonianStars)}
				</div>
			</Spin>
		);
	}
}

export default AstroAnalysisLab;
