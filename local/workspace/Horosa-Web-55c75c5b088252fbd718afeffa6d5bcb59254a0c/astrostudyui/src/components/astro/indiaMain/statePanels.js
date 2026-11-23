// 印占页 · 五支历(Panchanga)、行星状态、八分力(Ashtakavarga)与瑜伽面板
// 从 IndiaChartMain.js 按职责拆出的 IndiaChartMain 方法:this 仍是 IndiaChartMain 实例,门面里 mixinMethods(IndiaChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import IndiaYogaRuleTable from './IndiaYogaRuleTable';
import { YOGA_CATEGORY_LABELS, YOGA_CATEGORY_ORDER, formatDuration } from './dasha';
import { getJyotish, dispHouseByNum, formatDegree, getJyotishPlanetStates, getJyotishDasha, resolveJyotishChartObj, indiaDignityLabel } from './jyotishData';

export const statePanelMethods = {
	renderPanchangaPanel(fields){
		const chartObj = resolveJyotishChartObj(this.state, fields);
		const jyotish = getJyotish(chartObj);
		const panchanga = jyotish ? jyotish.panchanga : null;
		const dasha = getJyotishDasha(chartObj);
		const bhavaHousesRaw = jyotish && jyotish.bhavaBala && Array.isArray(jyotish.bhavaBala.houses) ? jyotish.bhavaBala.houses : [];
		// WP-B 第1宫参照:宫子表也按参照重数宫号 + 重排(默认上升 → 原序原号,零回归)。cusp 仍按原宫(座位置固定)。
		const dispHouse = this.makeIndiaDispHouse(chartObj);
		const bhavaHouses = bhavaHousesRaw.slice().sort((a, b)=>dispHouse(a.sign, a.house) - dispHouse(b.sign, b.house));
		const SIGN_K = { Aries:'白羊', Taurus:'金牛', Gemini:'双子', Cancer:'巨蟹', Leo:'狮子', Virgo:'处女', Libra:'天秤', Scorpio:'天蝎', Sagittarius:'射手', Capricorn:'摩羯', Aquarius:'水瓶', Pisces:'双鱼' };
		const P_K = { Sun:'日', Moon:'月', Mars:'火', Mercury:'水', Jupiter:'木', Venus:'金', Saturn:'土', Rahu:'罗', Ketu:'计', 'North Node':'罗', 'South Node':'计' };
		const HOUSE_KARAKA = { 1:'日', 2:'木', 3:'火', 4:'月', 5:'木', 6:'火土', 7:'金', 8:'土', 9:'木日', 10:'水木日土', 11:'木', 12:'土' };
		const houseClass = (h)=>[[1,4,7,10].includes(h)?'角':'', [1,5,9].includes(h)?'三方':'', [6,8,12].includes(h)?'凶':'', [3,6,10,11].includes(h)?'增益':'', [2,7].includes(h)?'杀':''].filter(Boolean).join('·');
		// WP-L 不等宫盘(§12.2):宫 cusp 始点经度(整宫=30°整界;选 Śrīpati/Placidus 即不等 cusp,居星按 cusp 重归宫)。
		const chartHouses = chartObj && chartObj.chart && Array.isArray(chartObj.chart.houses) ? chartObj.chart.houses : [];
		const cuspOf = (houseNum)=>{ const h = chartHouses.find((x)=>x.id === `House${houseNum}`); return h && h.lon !== undefined && h.lon !== null ? Number(h.lon) : null; };
		const fmtCusp = (lon)=>{ if(lon === null){ return '—'; } const norm = ((lon % 360) + 360) % 360; const d = Math.floor(norm % 30); const m = Math.round(((norm % 30) - d) * 60); return `${d}°${`${m}`.padStart(2, '0')}′`; };
		const cuspMode = jyotish && jyotish.bhavaBala && jyotish.bhavaBala.cuspMode ? jyotish.bhavaBala.cuspMode : null;
		// cuspMode 含 'whole'(wholeSign / wholeSignMid)即整宫;Śrīpati/Placidus 等才是真不等宫。
		const cuspModeLabel = cuspMode ? (/whole/i.test(cuspMode) ? '整宫 Whole-Sign' : `不等宫 ${cuspMode}`) : '整宫 Whole-Sign';
		const SIGN_ATTR = [['白羊','火','阳','动','火'],['金牛','金','阴','固','土'],['双子','水','阳','变','风'],['巨蟹','月','阴','动','水'],['狮子','日','阳','固','火'],['处女','水','阴','变','土'],['天秤','金','阳','动','风'],['天蝎','火','阴','固','水'],['射手','木','阳','变','火'],['摩羯','土','阴','动','土'],['水瓶','土','阳','固','风'],['双鱼','木','阴','变','水']];
		return (
			<div className="horosa-india-summary horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">基本参数</div>
					<div className="horosa-info-row"><span>时间</span><strong>{fields.date.value.format('YYYY-MM-DD')} {fields.time.value.format('HH:mm:ss')}</strong></div>
					<div className="horosa-info-row"><span>地点</span><strong>{fields.lon.value} {fields.lat.value}</strong></div>
					<div className="horosa-info-row"><span>时区</span><strong>{fields.zone.value}</strong></div>
					<div className="horosa-info-row"><span>星历</span><strong>{jyotish && jyotish.engine ? 'Swiss / flatlib' : '—'}</strong></div>
					<div className="horosa-info-row"><span>黄道</span><strong>Sidereal 恒星黄道</strong></div>
					<div className="horosa-info-row"><span>岁差</span><strong>{(chartObj && chartObj.params && chartObj.params.ayanamsaLabel) || 'Lahiri / Chitrapaksha'}</strong></div>
				</div>
				{bhavaHouses.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">宫子表（星座/cusp/宫主/居星/Karaka/分类 · {cuspModeLabel}）</div>
						<div className="horosa-india-maitri-wrap">
							<table className="horosa-india-maitri-table horosa-india-shad-table">
								<thead><tr><th>宫</th><th>星座</th><th>Cusp</th><th>宫主</th><th>居星</th><th>Karaka</th><th>分类</th></tr></thead>
								<tbody>
									{bhavaHouses.map((h)=>{ const dh = dispHouse(h.sign, h.house); return (<tr key={h.house}><th>{dh}</th><td>{SIGN_K[h.sign] || h.sign}</td><td>{fmtCusp(cuspOf(h.house))}</td><td>{P_K[h.lord] || h.lord || "—"}</td><td>{(h.occupants || []).map((o)=>P_K[o] || o).join("") || "—"}</td><td>{HOUSE_KARAKA[dh] || ""}</td><td>{houseClass(dh)}</td></tr>); })}
								</tbody>
							</table>
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">星座属性参考（主星/阴阳/三元/元素）</div>
					<div className="horosa-india-maitri-wrap">
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>座</th><th>主</th><th>阴阳</th><th>三元</th><th>元素</th></tr></thead>
							<tbody>{SIGN_ATTR.map((r)=>(<tr key={r[0]}><th>{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td></tr>))}</tbody>
						</table>
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Panchanga 五支</div>
					{panchanga ? (
						<>
							<div className="horosa-info-row"><span>Vara</span><strong>{panchanga.vara.label} · {panchanga.vara.name}{panchanga.vara.lord ? ` · 主${panchanga.vara.lord.label || panchanga.vara.lord.key}` : ''}{panchanga.vara.civilIndex !== undefined && panchanga.vara.civilIndex !== panchanga.vara.index ? `（日界=日出;民用日为${panchanga.vara.civilLabel}）` : ''}</strong></div>
							<div className="horosa-info-row"><span>Tithi</span><strong>{panchanga.tithi.index}. {panchanga.tithi.name} · {panchanga.tithi.paksha}</strong></div>
							<div className="horosa-info-row"><span>Nakshatra</span><strong>{panchanga.nakshatra.index}. {panchanga.nakshatra.name} P{panchanga.nakshatra.pada} · 主{panchanga.nakshatra.lord}{panchanga.nakshatra.isAbhijit ? <span className="horosa-india-abhijit-badge">牛宿 Abhijit</span> : null}</strong></div>
							<div className="horosa-info-row"><span>Yoga</span><strong>{panchanga.yoga.index}. {panchanga.yoga.name}</strong></div>
							<div className="horosa-info-row"><span>Karana</span><strong>{panchanga.karana.name}</strong></div>
							<div className="horosa-info-row"><span>日出</span><strong>{panchanga.sunrise || '—'}</strong></div>
						</>
					) : (
						<div className="horosa-india-dasha-empty">暂无五支数据</div>
					)}
				</div>
				{panchanga && panchanga.nakshatra && panchanga.nakshatra.detail ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">月宿详情 · {panchanga.nakshatra.name} {panchanga.nakshatra.detail.labelCn}</div>
						<div className="horosa-info-row"><span>主星 · 主神</span><strong>{panchanga.nakshatra.detail.lord} · {panchanga.nakshatra.detail.deity}</strong></div>
						{this.state.indiaNakshatraCount === 28 ? (
							<div className="horosa-info-row"><span>28 宿口径</span><strong>
								{panchanga.nakshatra.isAbhijit
									? `牛宿 Abhijit · 第22宿 · 主星 Vega(织女)`
									: `第 ${panchanga.nakshatra.number28 || panchanga.nakshatra.index} 宿`}
							</strong></div>
						) : null}
						<div className="horosa-info-row"><span>象征</span><strong>{panchanga.nakshatra.detail.symbol}</strong></div>
						<div className="horosa-info-row"><span>活动 · 种姓</span><strong>{panchanga.nakshatra.detail.activity} · {panchanga.nakshatra.detail.varna}</strong></div>
						<div className="horosa-info-row"><span>三性 · 动机</span><strong>{panchanga.nakshatra.detail.gunas} · {panchanga.nakshatra.detail.purushartha}</strong></div>
						<div className="horosa-info-row"><span>五行 · 阴阳</span><strong>{panchanga.nakshatra.detail.element} · {panchanga.nakshatra.detail.gender}</strong></div>
						<div className="horosa-info-row"><span>神人鬼 Gaṇa</span><strong>{panchanga.nakshatra.detail.gana}</strong></div>
						<div className="horosa-info-row"><span>方向 · 风向</span><strong>{panchanga.nakshatra.detail.facing} · {panchanga.nakshatra.detail.windDir}</strong></div>
						<div className="horosa-info-row"><span>身体 · yoni</span><strong>{panchanga.nakshatra.detail.bodyPart} · {panchanga.nakshatra.detail.yoniAnimal}</strong></div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Dasha 摘要</div>
					{dasha && dasha.available ? (
						<>
							<div className="horosa-info-row"><span>月宿</span><strong>{dasha.moonNakshatra.index}. {dasha.moonNakshatra.name}</strong></div>
							<div className="horosa-info-row"><span>起运</span><strong>{dasha.firstLord.label} · {dasha.firstLord.key}</strong></div>
							<div className="horosa-info-row"><span>出生余额</span><strong>{formatDuration(dasha.firstBalanceYears)}</strong></div>
							<div className="horosa-info-row"><span>当前大运</span><strong>{dasha.current ? `${dasha.current.lord.label} · ${dasha.current.lord.key}` : '—'}</strong></div>
						</>
					) : (
						<div className="horosa-india-dasha-empty">暂无大运摘要</div>
					)}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">相位系统四范式对照</div>
					<div className="horosa-india-data-list">
						<div className="horosa-india-data-row"><strong>Parashara</strong><span>行星→宫,全相 7 + 火 4/8、木 5/9、土 3/10(整宫、单向)</span></div>
						<div className="horosa-india-data-row"><strong>Jaimini</strong><span>星座→星座,动看固、固看动、双看双(各除紧邻),每座看 3 座</span></div>
						<div className="horosa-india-data-row"><strong>Tajika</strong><span>行星→行星,按角距 + deeptamsha 容许度,分 Ithasala/Ishrafa 等 16 态</span></div>
						<div className="horosa-india-data-row"><strong>KP</strong><span>不谈「相位」而谈「链接」——行星通过其 star lord / sub lord 与某宫的 significator 网络相连</span></div>
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Dasha 系统三范式对照</div>
					<div className="horosa-india-data-list">
						<div className="horosa-india-data-row"><strong>行星-宿型</strong><span>Vimshottari / Ashtottari / Yogini(按月宿起,行星当运);KP 沿用 Vimshottari</span></div>
						<div className="horosa-india-data-row"><strong>星座型</strong><span>Jaimini Chara / Sthira / Shoola(星座当运,方向+年数)</span></div>
						<div className="horosa-india-data-row"><strong>年压缩型</strong><span>Tajika Mudda / Patyayini(把全年压成 360 天)</span></div>
					</div>
				</div>
			</div>
		);
	},

	renderPlanetStatePanel(fields){
		const chartObjForRef = resolveJyotishChartObj(this.state, fields);
		const jyotish = getJyotish(chartObjForRef);
		// WP-B 第1宫参照:非默认时把所有「宫位」按参照星座重数(与中间盘一致);默认上升=后端房号(零回归)。
		const dispHouse = this.makeIndiaDispHouse(chartObjForRef);
		const states = getJyotishPlanetStates(jyotish);
		// 六力:唯一来源 = 六源式 shadbalaBphs(与「八分」分量表 / AI 快照同值)。
		const shadbalaSrc = jyotish && jyotish.shadbalaBphs ? jyotish.shadbalaBphs : null;
		const SB_ORDER = [['Sun', '太阳'], ['Moon', '月亮'], ['Mars', '火星'], ['Mercury', '水星'], ['Jupiter', '木星'], ['Venus', '金星'], ['Saturn', '土星']];
		const shadbala = shadbalaSrc ? SB_ORDER.filter(([k])=>shadbalaSrc[k] && typeof shadbalaSrc[k].rupas === 'number').map(([k, cn])=>({ id: k, label: cn, ...shadbalaSrc[k] })) : [];
		const sbFix = (v, d)=>(typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—');
		const karakas = jyotish && jyotish.jaimini ? jyotish.jaimini.charaKarakas || [] : [];
		const drishti = jyotish && Array.isArray(jyotish.grahaDrishti) ? jyotish.grahaDrishti : [];
		const nodeDrishti = jyotish && Array.isArray(jyotish.nodeRasiDrishti) ? jyotish.nodeRasiDrishti : [];
		const strengths = jyotish && jyotish.strengths ? jyotish.strengths : {};
		const sthiraKaraka = Array.isArray(strengths.sthiraKaraka) ? strengths.sthiraKaraka : [];
		// WP-E1 Vimśopaka(§5.7):各 varga 组里居自/友/旺的分盘数 → 吉位名(Daśavarga 例 2Pārijāta…10Śrīdhāma),越多越吉。
		const vargaDignity = Array.isArray(strengths.vargaDignity) ? strengths.vargaDignity : [];
		const PLANET_CN_SHORT = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土', Rahu: '罗', Ketu: '计' };
		const planetCN = (p)=>PLANET_CN_SHORT[p] || p;
		const fnGrahas = jyotish && jyotish.functionalNature && Array.isArray(jyotish.functionalNature.grahas) ? jyotish.functionalNature.grahas : [];
		const fnMap = {};
		fnGrahas.forEach((g)=>{ fnMap[g.planet] = g; });
		const FN_LABEL = { yogakaraka: 'Yogakaraka', benefic: '功能吉', malefic: '功能凶', neutral: '功能中', maraka: 'Maraka' };
		const FN_CLASS = { yogakaraka: 'is-good', benefic: 'is-good', malefic: 'is-warn', neutral: '', maraka: 'is-warn' };
		const bhavaBala = jyotish && jyotish.bhavaBala ? jyotish.bhavaBala : null;
		const grahaYuddha = jyotish && jyotish.grahaYuddha ? jyotish.grahaYuddha : null;
		return (
			<div className="horosa-india-jyotish-panel">
				{states.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">行星表（经度/顺逆/宫/宿·pada/Karaka）</div>
						<div className="horosa-india-maitri-wrap">
							<table className="horosa-india-maitri-table horosa-india-shad-table">
								<thead><tr><th>曜</th><th>星座·度</th><th>R</th><th>宫</th><th>宿·pada</th><th>Karaka{(jyotish && jyotish.jaimini && String(jyotish.jaimini.karakaScheme) === '7') ? '·7K 古典' : ''}</th></tr></thead>
								<tbody>
									{states.map((st)=>{ const kk = karakas.find((k)=>k.planet === st.id); return (
										<tr key={`pt${st.id}`}><th>{st.label}</th>
											<td>{st.signLabel} {formatDegree(st.signlon)}</td><td>{st.retrograde ? 'R' : ''}</td><td>{dispHouse(st.sign, st.house) || '—'}</td><td>{st.nakshatra ? `${st.nakshatra.name}·${st.nakshatra.pada}` : '—'}</td><td>{kk ? (kk.karakaLabel || kk.karaka || '') : ''}</td></tr>
									); })}
								</tbody>
							</table>
						</div>
					</div>
				) : null}
				{vargaDignity.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">分盘吉位 Vaiśeṣikāṁśa（居本三角 / 自宫 / 旺宫的分盘数 → 吉位名,越多越吉;20 分力见六力行）</div>
						<div className="horosa-india-data-list">
							{vargaDignity.map((row)=>{
								const a = row.amsa || {};
								const tag = (label, g)=>{ const x = a[g]; if(!x || !x.count){ return null; } return <span className="horosa-india-flag-badge" key={g}>{label} {x.count}{x.amsa ? `·${x.amsa}` : ''}</span>; };
								const none = !['shadvarga','saptavarga','dasavarga','shodasavarga'].some((g)=>a[g] && a[g].count);
								return (
									<div className="horosa-india-data-row" key={`vd${row.id}`}>
										<strong>{row.label}</strong>
										<span>{indiaDignityLabel(row.d1)}</span>
										<em>
											{tag('六', 'shadvarga')}
											{tag('七', 'saptavarga')}
											{tag('十', 'dasavarga')}
											{tag('十六', 'shodasavarga')}
											{none ? <span className="horosa-india-vimsopaka-none">无连座吉位</span> : null}
										</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
				{(()=>{
					// P0-8 真 Vimśopaka 20 分力(四组分盘按尊位加权,满分 20)。读 shadbalaBphs[planet].vimsopaka。
					const bphsAll = jyotish && jyotish.shadbalaBphs ? jyotish.shadbalaBphs : null;
					if(!bphsAll){ return null; }
					const order = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
					const vpRows = order.filter((p)=>bphsAll[p] && bphsAll[p].vimsopaka);
					if(!vpRows.length){ return null; }
					const GROUPS = [['shadvarga','六盘'],['saptavarga','七盘'],['dasavarga','十盘'],['shodasavarga','十六盘']];
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Vimśopaka 20 分力（四组分盘加权,满分 20,越高分盘越强）</div>
							<div className="horosa-india-maitri-wrap">
								<table className="horosa-india-maitri-table horosa-india-shad-table">
									<thead><tr><th>曜</th>{GROUPS.map((g)=>(<th key={g[0]}>{g[1]}</th>))}</tr></thead>
									<tbody>
										{vpRows.map((p)=>{ const vp = bphsAll[p].vimsopaka; return (
											<tr key={`vp${p}`}><th>{planetCN(p)}</th>
												{GROUPS.map((g)=>{ const d = vp[g[0]]; const v = d ? Number(d.total) : 0; return (<td key={g[0]} className={v >= 15 ? 'is-good' : (v < 7 ? 'is-warn' : '')}>{d ? d.total : '—'}</td>); })}
											</tr>
										); })}
									</tbody>
								</table>
							</div>
						</div>
					);
				})()}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Graha 状态</div>
					<div className="horosa-india-data-list">
						{states.map((item)=>(
							<div className="horosa-india-data-row" key={item.id}>
								<strong>{item.label}</strong>
								<span>{item.signLabel} {formatDegree(item.signlon)} · 宫{dispHouse(item.sign, item.house) || '—'}</span>
								<em>
									{indiaDignityLabel(item.dignity)}
									{item.vargottama ? <span className="horosa-india-flag-badge is-good">Vargottama</span> : null}
									{item.retrograde ? <span className="horosa-india-flag-badge">逆 R</span> : null}
									{item.combust ? <span className="horosa-india-flag-badge is-warn">燃 Asta</span> : null}
									{fnMap[item.id] ? <span className={`horosa-india-flag-badge ${FN_CLASS[fnMap[item.id].functionalNature] || ''}`}>{FN_LABEL[fnMap[item.id].functionalNature] || fnMap[item.id].functionalNature}</span> : null}
									{fnMap[item.id] && fnMap[item.id].isMaraka && fnMap[item.id].functionalNature !== 'maraka' ? <span className="horosa-india-flag-badge is-warn">Maraka</span> : null}
									{fnMap[item.id] && fnMap[item.id].isBadhaka ? <span className="horosa-india-flag-badge">Badhaka</span> : null}
									{item.baladi ? ` · ${item.baladi.label}` : ''}
									{item.jagradadi ? ` · 觉${item.jagradadi.label}` : ''}
									{item.deeptadi ? `/情${item.deeptadi.label}` : ''}
									{item.sayanadi ? ` · 态${item.sayanadi.stateLabel}` : ''}
									{Array.isArray(item.lajjitadi) ? item.lajjitadi.map((la)=>(
										<span className={`horosa-india-flag-badge ${la.nature === 'good' ? 'is-good' : 'is-warn'}`} key={`laj${item.id}${la.key}`}>{la.label} {la.en}</span>
									)) : null}
									{' · '}{item.nakshatra ? `${item.nakshatra.name} P${item.nakshatra.pada}` : '—'}
									{item.nakshatra && item.nakshatra.isAbhijit ? <span className="horosa-india-abhijit-badge">牛宿 Abhijit</span> : null}
								</em>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Shadbala 六力（六源合计 · 分量明细见「八分」）</div>
					<div className="horosa-india-data-list">
						{shadbala.map((item)=>(
							<div className="horosa-india-data-row" key={item.id}>
								<strong>{item.label}</strong>
								<span>{sbFix(item.rupas, 2)} Rupa · 需 {sbFix(item.requiredRupas, 1)} · {item.sufficient ? '力足' : '力弱'}</span>
								<em>
									Sthana {sbFix(item.sthana && item.sthana.virupa, 1)} · Dig {sbFix(item.dig, 1)} · Kala {sbFix(item.kala && item.kala.virupa, 1)} · Cheshta {sbFix(item.cheshta && item.cheshta.virupa, 1)}
									{item.ishta !== undefined && item.ishta !== null ? <span className="horosa-india-flag-badge is-good">吉果 {Math.round(item.ishta)}</span> : null}
									{item.kashta !== undefined && item.kashta !== null ? <span className="horosa-india-flag-badge is-warn">凶果 {Math.round(item.kashta)}</span> : null}
								</em>
							</div>
						))}
					</div>
				</div>
				{bhavaBala && bhavaBala.available && Array.isArray(bhavaBala.houses) && bhavaBala.houses.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">宫位力 Bhava Bala（最强 第{dispHouseByNum(bhavaBala.houses, bhavaBala.strongest, dispHouse)}宫 · 最弱 第{dispHouseByNum(bhavaBala.houses, bhavaBala.weakest, dispHouse)}宫）</div>
						<div className="horosa-india-data-list">
							{bhavaBala.houses.slice().sort((a, b)=>dispHouse(a.sign, a.house) - dispHouse(b.sign, b.house)).map((h)=>(
								<div className="horosa-india-data-row" key={h.house}>
									<strong>第{dispHouse(h.sign, h.house)}宫</strong>
									<span>{typeof h.rupas === 'number' ? h.rupas.toFixed(2) : h.rupas} Rupa · 名次 {h.rank}</span>
									<em>主{planetCN(h.lord)}{Array.isArray(h.occupants) && h.occupants.length ? ` · 居 ${h.occupants.map(planetCN).join('')}` : ''}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{grahaYuddha && grahaYuddha.available && Array.isArray(grahaYuddha.pairs) && grahaYuddha.pairs.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">星曜战 Graha Yuddha（行星近战 &lt;1° · 判据:{grahaYuddha.criterion === 'longitude' ? '黄经较小者胜' : '纬度更北者胜'}）</div>
						<div className="horosa-india-data-list">
							{grahaYuddha.pairs.map((pr, i)=>(
								<div className="horosa-india-data-row" key={i}>
									<strong>{pr.winnerLabel} 胜</strong>
									<span>负 {pr.loserLabel}</span>
									<em>相距 {pr.sepDeg}°</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Jaimini Chara Karaka</div>
					<div className="horosa-india-data-list">
						{karakas.map((item)=>(
							<div className="horosa-india-data-row" key={item.karaka}>
								<strong>{item.karaka}</strong>
								<span>{item.label}</span>
								<em>{item.signLabel} {formatDegree(item.signlon)}</em>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sthira 固定卡拉卡（双候选取强）</div>
					<div className="horosa-india-data-list">
						{sthiraKaraka.map((item)=>(
							<div className="horosa-india-data-row" key={item.key}>
								<strong>{item.label}</strong>
								<span>{item.planet ? planetCN(item.planet) : (item.candidates || []).map(planetCN).join(' / ')}</span>
								<em>{item.planet ? '定' : '双候选'}</em>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Graha Drishti</div>
					<div className="horosa-india-data-list">
						{drishti.slice(0, 14).map((item, idx)=>(
							<div className="horosa-india-data-row" key={`${item.giver}_${item.aspectHouse}_${idx}`}>
								<strong>{item.giverLabel}</strong>
								<span>{item.aspectHouse}视 · {item.targetSignLabel}</span>
								<em>{item.receives && item.receives.length ? item.receives.join('、') : '无星体承接'}</em>
							</div>
						))}
					</div>
				</div>
				{nodeDrishti.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">节点主照 Rasi Drishti</div>
						<div className="horosa-india-data-list">
							{nodeDrishti.map((item, idx)=>(
								<div className="horosa-india-data-row" key={`${item.giver}_${item.targetSign}_${idx}`}>
									<strong>{item.giverLabel}</strong>
									<span>主照 · {item.targetSignLabel}</span>
									<em>{item.receives && item.receives.length ? item.receives.join('、') : '无星体承接'}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		);
	},

	renderAshtakavargaPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const ashtakavarga = jyotish ? jyotish.ashtakavarga : null;
		if(!ashtakavarga || !ashtakavarga.available){
			return <div className="horosa-india-dasha-empty">暂无 Ashtakavarga 数据</div>;
		}
		const rows = ashtakavarga.sarvaBySign || [];
		const SIGN_ORDER = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
		const SIGN_SHORT = ['白', '金', '双', '巨', '狮', '处', '秤', '蝎', '射', '摩', '瓶', '鱼'];
		const BAV_PLANET_SHORT = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土' };
		const bhinnaKeys = Object.keys(ashtakavarga.bhinna || {});
		const sarva = ashtakavarga.sarva || {};
		const sodhana = ashtakavarga.sodhana || null;
		const kakshya = ashtakavarga.kakshya || null;                 // P0-6 分区 prastara{planet:[12×8]}
		const kakshyaLords = ashtakavarga.kakshyaLords || [];          // 8 段主管次序
		const sodhyaPinda = ashtakavarga.sodhyaPinda || null;          // P0-6 削减后凝量
		const KAK_LORD_SHORT = { Saturn: '土', Jupiter: '木', Mars: '火', Sun: '日', Venus: '金', Mercury: '水', Moon: '月', Lagna: '命' };
		const bphs = jyotish ? jyotish.shadbalaBphs : null;
		const BPHS_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
		// 行=曜/列=分量:分量名作列头(英文换行+居中),曜标签1字 → 不横滑全显示。
		const STHANA_PARTS = [{k:'uchcha',l:'旺 Uccha'},{k:'saptavargaja',l:'七盘 Sapta'},{k:'ojayugma',l:'奇偶 Oja'},{k:'kendradi',l:'角宫 Kend'},{k:'drekkana',l:'旬 Drek'},{k:'virupa',l:'小计',bold:true}];
		const KALA_PARTS = [{k:'nathonnatha',l:'昼夜 Nat'},{k:'paksha',l:'月相 Pak'},{k:'tribhaga',l:'三分 Tri'},{k:'vmdh',l:'VMDH'},{k:'ayana',l:'至点 Aya'},{k:'yuddha',l:'战 Yud'},{k:'virupa',l:'小计',bold:true}];
		const num = (v)=>Number(v || 0);
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sarvashtakavarga（SAV 和=337）</div>
					<div className="horosa-india-av-grid">
						{rows.map((item)=>(
							<div className="horosa-india-av-cell" key={item.sign}>
								<span>{item.label}</span>
								<strong>{item.bindu}</strong>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Bhinna Ashtakavarga（12宫×7曜全展示）</div>
					<div className="horosa-india-bav-matrix">
						<div className="horosa-india-bav-row horosa-india-bav-head">
							<span className="horosa-india-bav-rowlabel" />
							{SIGN_SHORT.map((s, i)=>(<span className="horosa-india-bav-cell is-head" key={`h${i}`}>{s}</span>))}
						</div>
						{bhinnaKeys.map((planet)=>{
							const row = ashtakavarga.bhinna[planet] || {};
							return (
								<div className="horosa-india-bav-row" key={planet}>
									<span className="horosa-india-bav-rowlabel">{BAV_PLANET_SHORT[planet] || planet}</span>
									{SIGN_ORDER.map((sign, i)=>{
										const v = row[sign] || 0;
										return <span className="horosa-india-bav-cell" style={{ '--bav': v / 8 }} key={`${planet}${i}`}>{v}</span>;
									})}
								</div>
							);
						})}
						<div className="horosa-india-bav-row horosa-india-bav-sav">
							<span className="horosa-india-bav-rowlabel">和</span>
							{SIGN_ORDER.map((sign, i)=>(<span className="horosa-india-bav-cell is-sav" key={`s${i}`}>{sarva[sign] || 0}</span>))}
						</div>
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sodhana 缩减 BAV（Trikona + Ekadhipatya）</div>
					{sodhana ? (
						<div className="horosa-india-bav-matrix">
							<div className="horosa-india-bav-row horosa-india-bav-head">
								<span className="horosa-india-bav-rowlabel" />
								{SIGN_SHORT.map((s, i)=>(<span className="horosa-india-bav-cell is-head" key={`soh${i}`}>{s}</span>))}
							</div>
							{Object.keys(sodhana).map((planet)=>(
								<div className="horosa-india-bav-row" key={`so${planet}`}>
									<span className="horosa-india-bav-rowlabel">{BAV_PLANET_SHORT[planet] || planet}</span>
									{(sodhana[planet] || []).map((v, i)=>(<span className="horosa-india-bav-cell" style={{ '--bav': num(v) / 8 }} key={`so${planet}${i}`}>{v}</span>))}
								</div>
							))}
						</div>
					) : <div className="horosa-india-dasha-empty">无 Sodhana 数据</div>}
				</div>
				{sodhyaPinda ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Sodhya Pinda 凝量（削减后 BAV × 座/曜乘数 · 定时/寿命用）</div>
						<div className="horosa-india-maitri-wrap">
							<table className="horosa-india-maitri-table horosa-india-shad-table">
								<thead><tr><th>曜</th><th>Rasi Pinda</th><th>Graha Pinda</th><th>Sodhya 合</th></tr></thead>
								<tbody>
									{BPHS_PLANETS.filter((p)=>sodhyaPinda[p]).map((p)=>{ const d = sodhyaPinda[p]; return (
										<tr key={`sp${p}`}><th>{BAV_PLANET_SHORT[p] || p}</th><td>{d.rasiPinda}</td><td>{d.grahaPinda}</td><td><strong>{d.total}</strong></td></tr>
									); })}
								</tbody>
							</table>
						</div>
					</div>
				) : null}
				{kakshya && kakshyaLords.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Kakshya 分区 prastara（每座 8 段主管是否贡献 bindu · 过运落段命中=吉）</div>
						<div className="horosa-india-card-note">段序主管:{kakshyaLords.map((l, i)=>`${i + 1}${KAK_LORD_SHORT[l] || l}`).join(' · ')}</div>
						{BPHS_PLANETS.filter((p)=>Array.isArray(kakshya[p])).map((p)=>(
							<div className="horosa-india-bav-matrix" key={`kak${p}`}>
								<div className="horosa-india-bav-row horosa-india-bav-head">
									<span className="horosa-india-bav-rowlabel">{BAV_PLANET_SHORT[p] || p}</span>
									{SIGN_SHORT.map((s, i)=>(<span className="horosa-india-bav-cell is-head" key={`kh${p}${i}`}>{s}</span>))}
								</div>
								{kakshyaLords.map((lord, li)=>(
									<div className="horosa-india-bav-row" key={`kak${p}${lord}`}>
										<span className="horosa-india-bav-rowlabel">{KAK_LORD_SHORT[lord] || lord}</span>
										{(kakshya[p] || []).map((cells, si)=>{ const on = cells && cells[li]; return (<span className={`horosa-india-bav-cell${on ? ' is-on' : ''}`} style={{ '--bav': on ? 1 : 0 }} key={`kc${p}${si}`}>{on ? '●' : '·'}</span>); })}
									</div>
								))}
							</div>
						))}
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">六源六力 Shadbala{bphs && bphs.anyPending ? <span className="horosa-india-source-tag">部分子项待权威数表</span> : null}</div>
					{bphs ? (
						<div className="horosa-india-data-list">
							{BPHS_PLANETS.map((p)=>{
								const b = bphs[p];
								if(!b){ return null; }
								return (
									<div className="horosa-india-data-row" key={`bphs${p}`}>
										<strong>{BAV_PLANET_SHORT[p] || p}</strong>
										<span>{num(b.totalVirupa).toFixed(0)} Virupa · {num(b.rupas).toFixed(2)} Rupa</span>
										<em>位{num(b.sthana && b.sthana.virupa).toFixed(0)}·向{num(b.dig).toFixed(0)}·时{num(b.kala && b.kala.virupa).toFixed(0)}·自{num(b.naisargika).toFixed(0)}{b.sufficient === false ? ' · 力弱' : ''}</em>
									</div>
								);
							})}
						</div>
					) : <div className="horosa-india-dasha-empty">无 BPHS 六力数据</div>}
					{bphs && Array.isArray(bphs.approximations) && bphs.approximations.length ? (
						<div className="horosa-india-data-list">
							{bphs.approximations.map((t, i)=>(
								<div className="horosa-india-data-row" key={`sbapx${i}`}><em>近似口径 · {t}</em></div>
							))}
						</div>
					) : null}
				</div>
				{bphs ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Sthāna 位置力分量（Virupa · 行=曜/列=分量）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table horosa-india-shad-table-wrap">
							<thead><tr><th>曜</th>{STHANA_PARTS.map((c)=>(<th key={c.k} className={c.bold ? 'is-sum' : ''}>{c.l}</th>))}</tr></thead>
							<tbody>
								{BPHS_PLANETS.map((p)=>(
									<tr key={p}><th>{BAV_PLANET_SHORT[p] || p}</th>{STHANA_PARTS.map((c)=>{ const st = (bphs[p] || {}).sthana || {}; const v = num(st[c.k]).toFixed(1); return <td key={c.k}>{c.bold ? <strong>{v}</strong> : v}</td>; })}</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}
				{bphs ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Kāla 时间力分量（行=曜/列=分量 · VMDH=年月+日+时）</div>
						<table className="horosa-india-maitri-table horosa-india-shad-table horosa-india-shad-table-wrap">
							<thead><tr><th>曜</th>{KALA_PARTS.map((c)=>(<th key={c.k} className={c.bold ? 'is-sum' : ''}>{c.l}</th>))}</tr></thead>
							<tbody>
								{BPHS_PLANETS.map((p)=>(
									<tr key={p}><th>{BAV_PLANET_SHORT[p] || p}</th>{KALA_PARTS.map((c)=>{ const ka = (bphs[p] || {}).kala || {}; const v = (c.k === 'vmdh' ? (num(ka.abdaMasa) + num(ka.vara) + num(ka.hora)) : num(ka[c.k])).toFixed(1); return <td key={c.k}>{c.bold ? <strong>{v}</strong> : v}</td>; })}</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}
			</div>
		);
	},

	renderYogaPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const yogas = jyotish ? jyotish.yogas : null;
		if(!yogas){
			return <div className="horosa-india-dasha-empty">Yoga 计算中...</div>;
		}
		if(yogas.available === false){
			return <div className="horosa-india-dasha-empty">Yoga 暂不可用：{yogas.error || yogas.reason || '后端未返回数据'}</div>;
		}
		const items = Array.isArray(yogas.items) ? yogas.items : [];
		const summary = yogas.summary || {};
		const grouped = items.reduce((map, item)=>{
			const category = item.category || 'Other';
			if(!map[category]){
				map[category] = [];
			}
			map[category].push(item);
			return map;
		}, {});
		const categories = Object.keys(grouped).sort((a, b)=>{
			const ai = YOGA_CATEGORY_ORDER.indexOf(a);
			const bi = YOGA_CATEGORY_ORDER.indexOf(b);
			const av = ai >= 0 ? ai : 99;
			const bv = bi >= 0 ? bi : 99;
			if(av !== bv){
				return av - bv;
			}
			return a.localeCompare(b);
		});
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Yoga 命盘组合</div>
					<div className="horosa-info-row"><span>规则目录</span><strong>{yogas.engine && yogas.engine.catalogVersion ? yogas.engine.catalogVersion : 'core_yoga_catalog'}</strong></div>
					<div className="horosa-info-row"><span>命中总数</span><strong>{summary.total || items.length}</strong></div>
					<div className="horosa-info-row"><span>强/中/弱</span><strong>{summary.strong || 0} / {summary.medium || 0} / {summary.weak || 0}</strong></div>
					<div className="horosa-info-row"><span>口径</span><strong>D1 Rashi 盘为主，按星座/宫位/照射/交换判定</strong></div>
				</div>
				{categories.length ? categories.map((category)=>(
					<div className="horosa-info-card" key={category}>
						<div className="horosa-info-card-title">{YOGA_CATEGORY_LABELS[category] || category}</div>
						<div className="horosa-india-data-list">
							{grouped[category].map((item)=>(
								<div className="horosa-india-data-row" key={item.id}>
									<strong>{item.zhName || item.name}</strong>
									<span>{item.name} · {item.levelLabel || item.level || '—'} · {item.score || 0}</span>
									<em>{Array.isArray(item.evidence) && item.evidence.length ? item.evidence.slice(0, 2).join('；') : item.result || '—'}</em>
								</div>
							))}
						</div>
					</div>
				)) : (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">命中 Yoga</div>
						<div className="horosa-india-dasha-empty">当前规则目录未命中可显示的 Yoga</div>
					</div>
				)}
				<IndiaYogaRuleTable data={jyotish.yogaTable} variant={this.state.yogaTableVariant} scope={this.state.yogaTableScope} onChange={(patch)=>this.setState(patch)} />
				{jyotish.kartari && jyotish.kartari.available && Array.isArray(jyotish.kartari.yogas) && jyotish.kartari.yogas.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Kartari 夹击格局</div>
						<div className="horosa-india-data-list">
							{jyotish.kartari.yogas.map((y, i)=>(
								<div className="horosa-india-data-row" key={`kt${i}`}>
									<strong>{y.targetLabel}</strong>
									<span><span className={y.type === 'shubha' ? 'horosa-india-flag-badge is-good' : 'horosa-india-flag-badge is-warn'}>{y.typeLabel}</span></span>
									<em>{(y.prevLabels || []).join('')} 夹 {(y.nextLabels || []).join('')}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{jyotish.sudarshana && jyotish.sudarshana.available && Array.isArray(jyotish.sudarshana.rows) && jyotish.sudarshana.rows.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Sudarshana 三盘合参（命 {jyotish.sudarshana.lagnaSign} · 日 {jyotish.sudarshana.sunSign} · 月 {jyotish.sudarshana.moonSign}）</div>
						<div className="horosa-india-data-list">
							<div className="horosa-india-data-row is-head"><strong>星曜</strong><span>命宫起 / 太阳起</span><em>月亮起</em></div>
							{jyotish.sudarshana.rows.map((r)=>(
								<div className="horosa-india-data-row" key={r.planet}>
									<strong>{r.planetLabel}</strong>
									<span>第{r.houseFromLagna}宫 / 第{r.houseFromSun}宫</span>
									<em>第{r.houseFromMoon}宫</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">规则说明</div>
					<div className="horosa-india-data-list">
						{(yogas.notes || []).map((note, idx)=>(
							<div className="horosa-india-data-row" key={`note_${idx}`}>
								<strong>说明{idx + 1}</strong>
								<span>{note}</span>
								<em>{idx === 0 ? '命盘 Yoga 与 Panchanga Yoga 已分开' : '可继续扩展规则目录'}</em>
							</div>
						))}
					</div>
				</div>
				{this.renderJudgmentNotes('7')}
			</div>
		);
	},
};
