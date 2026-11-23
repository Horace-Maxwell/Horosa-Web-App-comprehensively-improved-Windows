// 金口诀页 · 右栏:课体信息、神煞、象意、应期、动静、格局、关系、类象、专题、阴盘、合占、四象与方位
// 从 JinKouMain.js 按职责拆出的 JinKouMain 方法:this 仍是 JinKouMain 实例,门面里 mixinMethods(JinKouMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import JinKouRelationMini from '../JinKouRelationMini';
import { JINKOU_BASHE_DOC, JINKOU_SIXIANG_SHU_COLS, JINKOU_SIXIANG_SHU_NOTES, JINKOU_SIXIANG_WUXING_COLS, JINKOU_SIXIANG_WUXING_NOTES } from '../JinKouDoc';
import { JINKOU_FUWEN, JINKOU_FUWEN_NOTE } from '../JinKouFuwen';
import { XQTabs as Tabs } from '../../xq-ui';
import XQIcon from '../../xq-icons';
import { deriveBenMingFromRunYear, deriveXuSuiFromRunYear } from './runYear';
import { fmtValue } from './snapshot';
import { FreezeSubTab } from '../../comp/FreezeInactive';
const TabPane = Tabs.TabPane;

export const rightPanelMethods = {
	renderEmpty(text){
		return (
			<div className="horosa-jinkou-empty">
				<XQIcon name="inbox" />
				<span>{text}</span>
			</div>
		);
	},

	jxTone(jx){
		return jx === 'ji' || jx === 'xiong' ? jx : 'muted';
	},

	renderInfoTable(title, rows){
		const list = rows || [];
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">{title}</div>
				{list.length ? list.map((row, idx)=>{
					const tone = row.color === 'var(--horosa-jx-ji, #1f8a4c)' ? 'ji' : (row.color === 'var(--horosa-jx-xiong, #c0392b)' ? 'xiong' : null);
					return (
						<div className="horosa-jinkou-info-row" key={`${title}_${idx}`}>
							<span>{row.key}</span>
							<strong className={tone ? `is-${tone}` : undefined}>{fmtValue(row.value)}</strong>
						</div>
					);
				}) : this.renderEmpty('无')}
			</section>
		);
	},

	renderShenshaGrid(title, rows){
		const list = rows || [];
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">{title}</div>
				{list.length ? (
					<div className="horosa-jinkou-shensha-grid">
						{list.map((row, idx)=>(
							<div className="horosa-jinkou-shensha-cell" key={`${title}_${idx}`}>
								<span className="horosa-jinkou-shensha-cell__name">{row.key}</span>
								<strong className="horosa-jinkou-shensha-cell__val">{fmtValue(row.value)}</strong>
							</div>
						))}
					</div>
				) : this.renderEmpty('无')}
			</section>
		);
	},

	// 课情：合并起课全部信息(原「概览」顶卡与「课情」重复 → 并为一张;四位已在中间盘，不重复)。
	renderStartRows(jinkouData, chartFields, displayRunYear, appliedBirth){
		if(!jinkouData || !jinkouData.ready){
			return this.renderEmpty('暂无起课数据');
		}
		const params = chartFields ? this.genGodsParams(chartFields) : null;
		const backend = jinkouData.backend || {};
		// jinkouError 此前只写不读：后端排盘服务挂了就静默退回本地引擎，用户看不出盘换了源。
		// 这里如实说明——本地引擎算得出四位，但三盘环等后端专有面会缺，不该让人蒙在鼓里。
		const top = jinkouData.topInfo || {};
		// 四柱/月将/占时此前只认后端 pan 的字段；流派偏离默认时走本地引擎、没有 backend，
		// 概览就整排显示「无 无 无 无」。本地路径回落 liureng 四柱与引擎自算的月将/占时（同源自洽）。
		const lrCols = this.state.liureng && this.state.liureng.fourColumns ? this.state.liureng.fourColumns : {};
		const colGz = (c)=>(c && c.ganzi ? c.ganzi : '');
		const ganzhi = (backend.ganzhi && backend.ganzhi.day) ? backend.ganzhi : {
			year: colGz(lrCols.year), month: colGz(lrCols.month), day: colGz(lrCols.day), time: colGz(lrCols.time),
		};
		const gender = appliedBirth && appliedBirth.gender ? appliedBirth.gender.value : -1;
		const rows = [
			['日期', backend.dateStr || (params ? params.date : '')],
			['时间', backend.timeStr || (params ? params.time : '')],
			['真太阳时', backend.realSunTime || (this.state.liureng && this.state.liureng.nongli ? this.state.liureng.nongli.birth : '')],
			['时间基准', this.state.timeBasis === 'trueSolar' ? '真太阳时' : '直接时间'],
			['节气', backend.jiedelta || (this.state.liureng && this.state.liureng.nongli ? this.state.liureng.nongli.jiedelta : '')],
			['四柱', `${fmtValue(ganzhi.year)} ${fmtValue(ganzhi.month)} ${fmtValue(ganzhi.day)} ${fmtValue(ganzhi.time)}`],
			['地分/月将/占时', `${fmtValue(backend.difen || top.diFen)} / ${fmtValue(backend.yuejiang || jinkouData.yuejiang)} / ${fmtValue(backend.zhanshi || jinkouData.timeZi)}`],
			['空亡/四大空亡', `${fmtValue(top.xunKong)} / ${fmtValue(backend.siDaKong || top.siDaKong)}`],
			['用爻', jinkouData.yongYao ? `${jinkouData.yongYao.label || '—'}${jinkouData.yongYao.sign ? `(${jinkouData.yongYao.sign})` : ''}` : '—'],
			// 跨日界两源不齐时明示所取日柱（否则用户看四柱是一天、看断法是另一天，无从察觉）。
			...(jinkouData.daySourceNote ? [['日柱口径', jinkouData.daySourceNote]] : []),
			// 报错原文(可能是英文网络报错)只进控制台,界面只说人话
			...(this.state.jinkouError ? [['排盘来源', '排盘服务暂时不可用，已改用内置算法起课；四位与断法照常，三盘环等内容可能缺失。']] : []),
			// 昼夜是贵神起例的分水岭,而两法(真实地平/时支粗判)在日出日落前后常打架 → 明写所依口径。
			['昼夜', `${jinkouData.isDay ? '昼占' : '夜占'}（${fmtValue(jinkouData.dayBasisText)}）`],
			['十二长生', `${this.state.wuxing}${this.state.wuxing === '土' ? `（${this.state.soilChangSheng === 'yin' ? '火土同宫·寅' : '水土同宫·申'}）` : ''}`],
			// 专题起式所用的属相/虚岁是派生值,写在此处便于核对(错了就是出生档填错)
			['本命属相/虚岁', `${deriveBenMingFromRunYear(this.state.runyear) || '—'} / ${deriveXuSuiFromRunYear(this.state.runyear) === '' ? '—' : `${deriveXuSuiFromRunYear(this.state.runyear)}岁`}`],
			// age 为 0（出生当年起课）是合法值,不能用 || 兜底——否则真 0 岁被显示成「—岁」。
			['行年', displayRunYear
				? `${displayRunYear.year || '—'} / ${Number.isFinite(Number(displayRunYear.age)) ? `${Number(displayRunYear.age)}岁` : '—'}`
				: '—'],
			['性别', `${gender}` === '0' ? '女' : (`${gender}` === '1' ? '男' : '未知')],
		];
		return rows.map(([label, value])=>(
			<div className="horosa-jinkou-info-row" key={`start_${label}`}>
				<span>{label}</span>
				<strong>{fmtValue(value || '—')}</strong>
			</div>
		));
	},

	renderXiangyi(jinkouData){
		const xy = jinkouData && jinkouData.xiangyi ? jinkouData.xiangyi : null;
		const gs = xy && xy.guishen ? xy.guishen : null;
		const yj = xy && xy.yuejiang ? xy.yuejiang : null;
		if(!gs && !yj){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">贵神 · 月将象意</div>
				{gs ? (
					<div className={`horosa-jinkou-note-row is-${this.jxTone(gs.jx)}`}>
						<span className="horosa-jinkou-note-head">
							<strong>贵神 · {gs.name}</strong>
							{gs.shiti ? <em className="horosa-jinkou-note-tag">{gs.shiti}</em> : null}
						</span>
						<span className="horosa-jinkou-note-desc">{gs.renwu ? `人物：${gs.renwu}。` : ''}{gs.desc}</span>
					</div>
				) : null}
				{yj ? (
					<div className="horosa-jinkou-note-row is-muted">
						<span className="horosa-jinkou-note-head"><strong>将神 · {yj.name}</strong></span>
						<span className="horosa-jinkou-note-desc">{yj.desc}</span>
					</div>
				) : null}
			</section>
		);
	},

	// 断课忌时：作「概览」页首独立卡片（不再通栏占位，避免挤压右栏全部页签）。
	renderJishi(jinkouData){
		const js = jinkouData && jinkouData.jishi ? jinkouData.jishi : null;
		if(!js || !js.hit){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card horosa-jinkou-jishi-card">
				<div className="horosa-jinkou-section-card__title">断课忌时</div>
				<div className="horosa-jinkou-warn-banner">
					<strong>忌时</strong>
					<span>{js.text}</span>
				</div>
			</section>
		);
	},

	renderNianYueRi(jinkouData){
		const items = jinkouData && jinkouData.nianYueRi ? jinkouData.nianYueRi : [];
		if(!items.length){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">年月日入课 · 太岁月建</div>
				{items.map((it, idx)=>(
					<div className={`horosa-jinkou-note-row ${it.hit ? 'is-xiong' : 'is-muted'}`} key={`nyr_${idx}`}>
						<span className="horosa-jinkou-note-head">
							<strong>{it.name}</strong>
							<em className="horosa-jinkou-note-tag">{it.zhi}{it.hit ? ' · 入课' : ''}</em>
						</span>
						<span className="horosa-jinkou-note-desc">{it.text}</span>
					</div>
				))}
			</section>
		);
	},

	renderBaShe(){
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">绿色解断 · 标准八步</div>
				{JINKOU_BASHE_DOC.map((s)=>(
					<div className="horosa-jinkou-note-row is-muted" key={`bashe_${s.step}`}>
						<span className="horosa-jinkou-note-head"><strong>{s.step}. {s.title}</strong></span>
						<span className="horosa-jinkou-note-desc">{s.detail}</span>
					</div>
				))}
			</section>
		);
	},

	// 经典赋文：古籍原文转录，长文按篇折叠（默认全收，避免一进「参考」页就是数千字）。
	toggleFuwen(key){
		const open = { ...(this.state.fuwenOpen || {}) };
		open[key] = !open[key];
		this.setState({ fuwenOpen: open });
	},

	renderFuwen(){
		const open = this.state.fuwenOpen || {};
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">经典赋文 · 古籍原文</div>
				<div className="horosa-jinkou-topic-note">{JINKOU_FUWEN_NOTE}</div>
				<div className="horosa-jinkou-fuwen-list">
					{JINKOU_FUWEN.map((p)=>(
						<div className={`horosa-jinkou-fuwen-item${open[p.key] ? ' is-open' : ''}`} key={`fw_${p.key}`}>
							<button type="button" className="horosa-jinkou-fuwen-head" onClick={()=>this.toggleFuwen(p.key)}>
								<span className="horosa-jinkou-fuwen-caret">{open[p.key] ? '▾' : '▸'}</span>
								<strong className="horosa-jinkou-fuwen-title">{p.title}</strong>
								<em className="horosa-jinkou-fuwen-vol">{p.volume}</em>
							</button>
							<div className="horosa-jinkou-fuwen-use">{p.use}</div>
							{open[p.key] ? (
								<div className="horosa-jinkou-fuwen-body">
									{p.lines.map((ln, i)=>(<p key={`fw_${p.key}_${i}`}>{ln}</p>))}
								</div>
							) : null}
						</div>
					))}
				</div>
			</section>
		);
	},

	renderShenshaRows(jinkouData){
		const docRows = jinkouData && jinkouData.shenshaDocRows ? jinkouData.shenshaDocRows : [];
		if(!docRows.length){
			return this.renderEmpty('暂无四位神煞');
		}
		return docRows.map((row)=>(
			<div key={row.label} className="horosa-jinkou-shensha-group">
				<div className="horosa-jinkou-subhead">{row.position}</div>
				{row.items && row.items.length ? row.items.map((it, idx)=>(
					<div className={`horosa-jinkou-note-row is-${this.jxTone(it.jx)}`} key={`${row.label}_${idx}`}>
						<span className="horosa-jinkou-note-head"><strong>{it.name}</strong></span>
						{it.desc ? <span className="horosa-jinkou-note-desc">{it.desc}</span> : null}
					</div>
				)) : <span className="horosa-jinkou-note-desc">无</span>}
			</div>
		));
	},

	renderTextBlock(title, text){
		if(!text){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">{title}</div>
				<p className="horosa-jinkou-prose">{text}</p>
			</section>
		);
	},

	renderAnalysisBasic(jinkouData){
		if(!jinkouData || !jinkouData.ready){
			return this.renderEmpty('暂无分析');
		}
		return (
			<div className="horosa-jinkou-overview-stack">
				{this.renderDong(jinkouData)}
				{this.renderGeju(jinkouData)}
				{this.renderTextBlock('用神强弱', jinkouData.yongStrength ? jinkouData.yongStrength.text : '')}
				{this.renderYingQi(jinkouData)}
			</div>
		);
	},

	renderYingQi(jinkouData){
		const yq = jinkouData && jinkouData.yingQi ? jinkouData.yingQi : null;
		if(!yq || !yq.text){ return null; }
		const methods = yq.methods || [];
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">应期 · 合德六法</div>
				<p className="horosa-jinkou-prose">{yq.text}</p>
				{methods.map((m, idx)=>(
					<div className="horosa-jinkou-note-row is-muted" key={`yq_${idx}`}>
						<span className="horosa-jinkou-note-head">
							<strong>{m.fa}</strong>
							{m.when ? <em className="horosa-jinkou-note-tag">{m.when}</em> : null}
						</span>
						<span className="horosa-jinkou-note-desc">{m.text}</span>
					</div>
				))}
			</section>
		);
	},

	renderDong(jinkouData){
		const dong = jinkouData && jinkouData.dong ? jinkouData.dong : { wu: [], san: [] };
		const all = [].concat(
			(dong.wu || []).map((d)=>({ ...d, group: '五动' })),
			(dong.san || []).map((d)=>({ ...d, group: '三动' }))
		);
		if(!all.length){
			return (
				<section className="horosa-jinkou-info-card horosa-jinkou-section-card horosa-jinkou-dong-card">
					<div className="horosa-jinkou-section-card__title">发用 · 五动三动</div>
					{this.renderEmpty('四位无显著动象（无克无生同气）')}
				</section>
			);
		}
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card horosa-jinkou-dong-card">
				<div className="horosa-jinkou-section-card__title">发用 · 五动三动</div>
				{all.map((d, i)=>(
					<div className={`horosa-jinkou-dong-row ${d.yong ? 'is-yong' : ''}`} key={`dong_${i}`}>
						<div className="horosa-jinkou-dong-head">
							<span className="horosa-jinkou-dong-name">{d.type}动{d.kong ? ' · 逢空' : ''}</span>
							<em className="horosa-jinkou-dong-path">{d.group}　{d.from}→{d.to}</em>
						</div>
						<div className="horosa-jinkou-dong-text">{d.text}{d.kong ? '（逢空则力减、应迟或事不成）' : ''}</div>
					</div>
				))}
			</section>
		);
	},

	renderGeju(jinkouData){
		const geju = jinkouData && jinkouData.geju ? jinkouData.geju : [];
		if(!geju.length){
			return null;
		}
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card horosa-jinkou-dong-card">
				<div className="horosa-jinkou-section-card__title">格局</div>
				{geju.map((g, i)=>(
					<div className={`horosa-jinkou-note-row is-${this.jxTone(g.jx)}`} key={`geju_${i}`}>
						<span className="horosa-jinkou-note-head"><strong>{g.name}</strong></span>
						<span className="horosa-jinkou-note-desc">{g.text}</span>
					</div>
				))}
			</section>
		);
	},

	renderRelations(jinkouData){
		const rels = jinkouData && jinkouData.relations ? jinkouData.relations : [];
		const bihe = jinkouData && jinkouData.bihe ? jinkouData.bihe : [];
		if(!rels.length && !bihe.length){
			return this.renderEmpty('四位无显著生克');
		}
		const relTone = (rel)=>(rel === '生' || rel === '被生' ? 'sheng' : (rel === '克' || rel === '被克' ? 'ke' : (rel === '合' ? 'he' : 'muted')));
		return (
			<div>
				{rels.map((r, idx)=>(
					<div className={`horosa-jinkou-note-row is-${relTone(r.rel)}`} key={`rel_${idx}`}>
						<span className="horosa-jinkou-note-head">
							<em className="horosa-jinkou-note-tag">{r.from}{r.rel}{r.to}</em>
						</span>
						{r.text ? <span className="horosa-jinkou-note-desc">{r.text}</span> : null}
					</div>
				))}
				{bihe.map((b, idx)=>(
					<div className="horosa-jinkou-note-row is-muted" key={`bihe_${idx}`}>
						<span className="horosa-jinkou-note-head"><strong>{b.name}</strong></span>
						<span className="horosa-jinkou-note-desc">{b.text}</span>
					</div>
				))}
			</div>
		);
	},

	renderCategory(jinkouData){
		const cats = jinkouData && jinkouData.categoryRules ? jinkouData.categoryRules : [];
		const ready = cats.filter((c)=>c.texts && c.texts.length);
		if(!ready.length){
			return this.renderEmpty('分类用神细则完善中');
		}
		return (
			<div className="horosa-jinkou-overview-stack">
				{ready.map((c)=>(
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card" key={c.key}>
						<div className="horosa-jinkou-section-card__title">
							{c.name}
							{c.yongHint ? <em className="horosa-jinkou-card-hint">用神：{c.yongHint}</em> : null}
						</div>
						{c.texts.map((t, idx)=>(
							<div className="horosa-jinkou-note-row is-muted" key={`cat_${idx}`}>
								<span className="horosa-jinkou-note-desc">{t}</span>
							</div>
						))}
					</section>
				))}
			</div>
		);
	},

	renderBranchRelation(jinkouData){
		const brs = jinkouData && jinkouData.branchRelations ? jinkouData.branchRelations : [];
		const typeTone = (t)=>(t === '合' || t === '三合' ? 'he' : (t === '冲' ? 'chong' : 'xing'));
		return (
			<div>
				<JinKouRelationMini relations={brs} rows={jinkouData ? jinkouData.rows : []} />
				{brs.length ? (
					<div style={{ marginTop: 8 }}>
						{brs.map((b, idx)=>(
							<div className={`horosa-jinkou-note-row is-${typeTone(b.type)}`} key={`br_${idx}`}>
								<span className="horosa-jinkou-note-head"><strong>{b.aLabel}{b.a} {b.type} {b.bLabel}{b.b}</strong></span>
								{b.desc ? <span className="horosa-jinkou-note-desc">{b.desc}</span> : null}
							</div>
						))}
					</div>
				) : this.renderEmpty('四位与日辰无刑冲合害破')}
			</div>
		);
	},

	renderTaixuan(jinkouData){
		const tx = jinkouData && jinkouData.taixuan ? jinkouData.taixuan : [];
		if(!tx.length){
			return this.renderEmpty('暂无数理');
		}
		const rows = tx.map((t)=>({ key: t.label, value: `${t.tokens || '—'}　太玄数 ${t.num}` }));
		return this.renderInfoTable('数理 · 太玄数', rows);
	},

	renderPlateRows(jinkouData){
		if(!jinkouData || !jinkouData.plates || !jinkouData.plates.length){
			return this.renderEmpty((jinkouData && jinkouData.platesNote) || '暂无三盘数据');
		}
		return jinkouData.plates.map((row)=>(
			<div className="horosa-jinkou-info-row" key={`plate_${row.index || row.di}`}>
					<span>{row.di}</span>
				<strong>{`天${fmtValue(row.tian)} · 将${fmtValue(row.jiang)} · 神${fmtValue(row.shen)} · 贵${fmtValue(row.gui)}`}</strong>
			</div>
		));
	},

	// 左栏「专题起式」段脚注：把自动派生的属相/虚岁写出来，用户一眼能核对派生对不对；
	// 出生档未填时明说「先填出生时间」，而不是让专题页干瞪眼说「需填属相」。
	renderBenMingHint(){
		const benMing = deriveBenMingFromRunYear(this.state.runyear);
		const xuSui = deriveXuSuiFromRunYear(this.state.runyear);
		if(!benMing && xuSui === ''){
			return '本命属相与行年虚岁自「问测人出生时间」自动取；尚未取到生年干支，请先在下方填写出生时间并确认。';
		}
		const gz = this.state.runyear && this.state.runyear.birthGanZi ? this.state.runyear.birthGanZi : '';
		return `本命属相 ${benMing || '—'}${gz ? `（生年 ${gz}）` : ''}、行年虚岁 ${xuSui === '' ? '—' : `${xuSui}`}`;
	},

	// 专题起式页：专题派生课 + 专题断诀 + 测年月日三式 + 二遁人元 + 次客/移星换将 + 行年旬法。
	renderTopicPanel(jinkouData){
		if(!jinkouData){ return this.renderEmpty('暂无课式'); }
		const topic = jinkouData.topic;
		const jue = jinkouData.topicJue;
		const shiJian = jinkouData.shiJian;
		const erDun = jinkouData.erDun;
		const cike = jinkouData.cike || [];
		const yiXing = jinkouData.yiXing;
		const xn = jinkouData.xingNian;
		return (
			<div className="horosa-jinkou-overview-stack">
				{!topic && !shiJian && !xn ? (
					<div className="horosa-jinkou-warn-banner is-hint">
						<strong>未选专题</strong>
						<span>在左栏「专题起式」选定专题、测年月日或填行年虚岁，此处即出派生课与断诀；下方二遁与次客法恒随主课产出。</span>
					</div>
				) : null}
				{topic ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">{`专题起式 · ${topic.title}`}</div>
						<div className="horosa-jinkou-topic-note">{topic.note}</div>
						{topic.ready === false ? (
							<div className="horosa-jinkou-warn-banner"><strong>待补</strong><span>{topic.needText}</span></div>
						) : (
							<div className="horosa-jinkou-topic-result">
								{topic.result ? <p>{topic.result}</p> : null}
								{topic.rows ? (
									<div className="horosa-jinkou-sixiang-table is-cols3">
										<div className="horosa-jinkou-sixiang-row is-head"><span>方位</span><span>将神</span><span>将名</span><span>将干</span></div>
										{topic.rows.map((r)=>(
											<div className="horosa-jinkou-sixiang-row" key={`tp_${r.fang}`}>
												<span className="horosa-jinkou-sixiang-pos">{r.fang}</span>
												<span>{fmtValue(r.jiangZi)}</span>
												<span>{fmtValue(r.jiangName)}</span>
												<span>{fmtValue(r.gan)}</span>
											</div>
										))}
									</div>
								) : null}
							</div>
						)}
					</section>
				) : null}
				{jue && jue.items && jue.items.length ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">{`专题断诀 · ${jue.kind}`}</div>
						{jue.items.map((it, i)=>(
							<div className="horosa-jinkou-info-row" key={`jue_${i}`}>
								<span>{`${it.wei}${it.zhi ? `·${it.zhi}` : ''}`}</span>
								<strong>{fmtValue(it.xiang)}</strong>
							</div>
						))}
						<ul className="horosa-jinkou-sixiang-notes">
							{(jue.notes || []).map((n, i)=>(<li key={`juen_${i}`}>{n}</li>))}
						</ul>
					</section>
				) : null}
				{shiJian ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">{shiJian.title}</div>
						<div className="horosa-jinkou-info-row"><span>月将加于</span><strong>{fmtValue(shiJian.addAt)}</strong></div>
						<div className="horosa-jinkou-info-row"><span>数至（地分）</span><strong>{fmtValue(shiJian.diFen)}</strong></div>
						<div className="horosa-jinkou-info-row"><span>得将神</span><strong>{`${fmtValue(shiJian.jiangZi)}（${fmtValue(shiJian.jiangName)}）`}</strong></div>
						<div className="horosa-jinkou-topic-note">{shiJian.note}</div>
					</section>
				) : null}
				{erDun ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">二遁人元</div>
						<div className="horosa-jinkou-info-row"><span>{`原人元 ${fmtValue(erDun.yuan)}`}</span><strong>{`二遁＝${fmtValue(erDun.gan)}　三遁＝${fmtValue(erDun.thirdGan)}`}</strong></div>
						<div className="horosa-jinkou-info-row"><span>衣物之色</span><strong>{fmtValue(erDun.se)}</strong></div>
						<div className="horosa-jinkou-info-row"><span>住宅物象</span><strong>{fmtValue(erDun.xiang)}</strong></div>
						<div className="horosa-jinkou-topic-note">{erDun.note}</div>
					</section>
				) : null}
				{cike.length ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">次客法 · 参考式</div>
						{cike.map((c, i)=>(
							<div className="horosa-jinkou-note-row is-muted" key={`ck_${i}`}>
								<span className="horosa-jinkou-note-name">{c.method}</span>
								<span className="horosa-jinkou-note-desc">
									{c.note}
									{c.guiName ? `　→ 次课贵神＝${c.guiName}` : ''}
									{c.altTimeZi ? `　→ 代时之支＝${c.altTimeZi.filter(Boolean).join('、')}` : ''}
									{c.altDayGan ? `　→ 换日干＝${c.altDayGan.filter(Boolean).join('、')}` : ''}
									{c.altDiFen ? `　→ 新地分＝${c.altDiFen}` : ''}
									{c.jiangZi ? `　→ 将神＝${c.jiangZi}` : ''}
								</span>
							</div>
						))}
						{yiXing ? (
							<div className="horosa-jinkou-note-row is-muted">
								<span className="horosa-jinkou-note-name">移星换将</span>
								<span className="horosa-jinkou-note-desc">{`${yiXing.note}　→ 前日干 ${yiXing.prevDayGan}、后日干 ${yiXing.nextDayGan}`}</span>
							</div>
						) : null}
					</section>
				) : null}
				{xn ? (
					<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
						<div className="horosa-jinkou-section-card__title">金口诀行年 · 旬法</div>
						<div className="horosa-jinkou-info-row"><span>{`${xn.gender}·${xn.age}岁`}</span><strong>{`行年 ${xn.ganZhi}（${xn.zhi}）`}</strong></div>
						<div className="horosa-jinkou-info-row"><span>{`生年 ${xn.birthGanZi}·${xn.xunHead}旬`}</span><strong>{`一岁起 ${xn.startGanZi}`}</strong></div>
						{xn.ge ? <div className="horosa-jinkou-note-row is-muted"><span className="horosa-jinkou-note-name">灾福歌</span><span className="horosa-jinkou-note-desc">{xn.ge}</span></div> : null}
						<div className="horosa-jinkou-topic-note">{xn.note}</div>
					</section>
				) : null}
			</div>
		);
	},

	// 阴盘（旺衰派）三层：六亲 / 六神 / 旺衰分。仅盘式=阴盘时产出，故此处 null 即整组不渲染。
	renderYinPan(jinkouData){
		const yp = jinkouData && jinkouData.yinPan;
		if(!yp || !yp.wangScore || !yp.wangScore.length){ return null; }
		const qinBy = {};
		(yp.liuqin || []).forEach((it)=>{ qinBy[it.wei] = it; });
		const shenBy = {};
		(yp.liushen || []).forEach((it)=>{ shenBy[it.wei] = it; });
		const maxAbs = Math.max(1, ...yp.wangScore.map((s)=>Math.abs(s.score)));
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">阴盘 · 六亲 / 六神 / 旺衰分</div>
				<div className="horosa-jinkou-yinpan-head">
					<span className="horosa-jinkou-hezhan-tag is-use">{`以日干 ${fmtValue(yp.self)}（${fmtValue(yp.selfElem)}）为我`}</span>
					<span className="horosa-jinkou-hezhan-tag">公共框架 · 自定分值</span>
				</div>
				<div className="horosa-jinkou-yinpan-table">
					<div className="horosa-jinkou-yinpan-row is-head">
						<span>位</span><span>六亲</span><span>六神</span><span>旺衰</span><span>分值</span>
					</div>
					{yp.wangScore.map((s)=>{
						const qin = qinBy[s.wei] || {};
						const shen = shenBy[s.wei] || {};
						const pct = Math.round((Math.abs(s.score) / maxAbs) * 100);
						return (
							<div className="horosa-jinkou-yinpan-row" key={`yp_${s.wei}`} title={s.detail.join('　')}>
								<span className="horosa-jinkou-yinpan-pos">{s.wei}<em>{s.elem}</em></span>
								<span title={qin.zhu || ''}>{qin.qin || '—'}</span>
								<span title={shen.desc || ''}>{shen.name || '—'}</span>
								<span className={`horosa-jinkou-yinpan-level is-${s.score >= 2 ? 'strong' : (s.score <= -2 ? 'weak' : 'mid')}`}>{s.level}</span>
								<span className="horosa-jinkou-yinpan-score">
									<em>{s.score > 0 ? `+${s.score}` : s.score}</em>
									<i className={s.score >= 0 ? 'is-plus' : 'is-minus'} style={{ width: `${pct}%` }} />
								</span>
							</div>
						);
					})}
				</div>
				<div className="horosa-jinkou-yinpan-note">{yp.scoreNote}</div>
			</section>
		);
	},

	// 合占·扣题直断：所问事项 → 取用位 → 时段 → 动象/神煞 → 结论链；末附课分内外小图。
	renderHezhan(jinkouData){
		const hz = jinkouData && jinkouData.hezhan;
		if(!hz || !hz.chain || !hz.chain.length){ return null; }
		const nw = jinkouData.neiwai;
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">合占 · 扣题直断</div>
				<div className="horosa-jinkou-hezhan-head">
					<span className="horosa-jinkou-hezhan-tag">{hz.askLabel ? `所问：${hz.askLabel}` : '所问：未限定'}</span>
					<span className="horosa-jinkou-hezhan-tag is-use">{`取用：${fmtValue(hz.usePosition)}`}</span>
					<span className="horosa-jinkou-hezhan-tag">{`时段：${fmtValue(hz.timeLabel)}`}</span>
				</div>
				<ol className="horosa-jinkou-hezhan-chain">
					{hz.chain.map((line, i)=>(<li key={`hz_${i}`}>{line}</li>))}
				</ol>
				{nw && nw.rows && nw.rows.length ? (
					<div className="horosa-jinkou-neiwai">
						<div className="horosa-jinkou-neiwai-title">课分内外</div>
						<div className="horosa-jinkou-neiwai-cols">
							{nw.rows.map((r)=>(
								<div key={`nw_${r.label}`} className={`horosa-jinkou-neiwai-item is-${r.side === '内' ? 'inner' : 'outer'} ${r.yong ? 'is-yong' : ''}`}>
									<span className="horosa-jinkou-neiwai-side">{r.side}</span>
									<span className="horosa-jinkou-neiwai-label">{r.label}</span>
									<span className="horosa-jinkou-neiwai-val">{fmtValue(r.content)}</span>
								</div>
							))}
						</div>
					</div>
				) : null}
			</section>
		);
	},

	// 四象所属图：四位 × 亲属/君臣主客/天地/官禄财/内外/身体，与当前四位干支并排。
	renderSixiangShu(jinkouData){
		const rows = jinkouData && jinkouData.sixiangShu;
		if(!rows || !rows.length){ return null; }
		const cols = JINKOU_SIXIANG_SHU_COLS;
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">四象所属 · 定位取用</div>
				<div className="horosa-jinkou-sixiang-table">
					<div className="horosa-jinkou-sixiang-row is-head">
						<span>位</span>
						{cols.map((c)=>(<span key={`sxh_${c.key}`}>{c.label}</span>))}
					</div>
					{rows.map((r)=>(
						<div className="horosa-jinkou-sixiang-row" key={`sx_${r.label}`}>
							<span className="horosa-jinkou-sixiang-pos">
								{r.label}
								{r.ganzhi ? <em>{r.ganzhi}</em> : null}
							</span>
							{cols.map((c)=>(<span key={`sx_${r.label}_${c.key}`}>{r[c.key]}</span>))}
						</div>
					))}
				</div>
				<ul className="horosa-jinkou-sixiang-notes">
					{JINKOU_SIXIANG_SHU_NOTES.map((n, i)=>(<li key={`sxn_${i}`}>{n}</li>))}
				</ul>
			</section>
		);
	},

	// 四象五行取象：四位五行各主天时/地理/人事/病源，并标出课中旺之五行为主象。
	renderSixiangWuxing(jinkouData){
		const sw = jinkouData && jinkouData.sixiangWuxing;
		if(!sw || !sw.rows || !sw.rows.length){ return null; }
		const cols = JINKOU_SIXIANG_WUXING_COLS;
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">四象五行 · 取象</div>
				{sw.mainElem ? (
					<div className="horosa-jinkou-wuxiang-main">
						<span className="horosa-jinkou-hezhan-tag is-use">{`主象：${sw.mainElem}`}</span>
						{sw.tianqiText ? <span className="horosa-jinkou-wuxiang-text">{sw.tianqiText}</span> : null}
					</div>
				) : null}
				<div className="horosa-jinkou-sixiang-table is-cols4">
					<div className="horosa-jinkou-sixiang-row is-head">
						<span>位·五行</span>
						{cols.map((c)=>(<span key={`swh_${c.key}`}>{c.label}</span>))}
					</div>
					{sw.rows.map((r)=>(
						<div className={`horosa-jinkou-sixiang-row ${r.elem === sw.mainElem ? 'is-main' : ''}`} key={`sw_${r.label}`}>
							<span className="horosa-jinkou-sixiang-pos">
								{r.label}
								<em>{r.elem || '—'}{r.kong ? '·空' : ''}</em>
							</span>
							{cols.map((c)=>(<span key={`sw_${r.label}_${c.key}`}>{r[c.key]}</span>))}
						</div>
					))}
				</div>
				<ul className="horosa-jinkou-sixiang-notes">
					{JINKOU_SIXIANG_WUXING_NOTES.map((n, i)=>(<li key={`swn_${i}`}>{n}</li>))}
				</ul>
			</section>
		);
	},

	// 方位神煞（飞天五鬼 / 喜神）：按日干取八卦之位，出行趋避用；不入四位行故单列。
	renderFangWei(jinkouData){
		const list = jinkouData && jinkouData.fangWeiShensha;
		if(!list || !list.length){ return null; }
		return (
			<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
				<div className="horosa-jinkou-section-card__title">方位神煞</div>
				{list.map((it)=>(
					<div className={`horosa-jinkou-note-row is-${this.jxTone(it.jx)}`} key={`fw_${it.name}`}>
						<span className="horosa-jinkou-note-name">{`${it.name} · ${it.gua}（${it.fang}）`}</span>
						<span className="horosa-jinkou-note-desc">{it.text}</span>
					</div>
				))}
			</section>
		);
	},

	renderOverviewAll(jinkouData, displayRunYear, appliedBirth, chartFields){
		return (
			<div className="horosa-jinkou-overview-stack">
				{this.renderJishi(jinkouData)}
				{/* 阴盘模式断法重心前移：六亲/六神/旺衰分置于课情之上；阳盘恒不渲染。 */}
				{this.renderYinPan(jinkouData)}
				<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
					<div className="horosa-jinkou-section-card__title">课情</div>
					{this.renderStartRows(jinkouData, chartFields, displayRunYear, appliedBirth)}
				</section>
				<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
					<div className="horosa-jinkou-section-card__title">三盘 · 天将</div>
					{this.renderPlateRows(jinkouData)}
				</section>
				{this.renderXiangyi(jinkouData)}
			</div>
		);
	},

	renderRightPanel(jinkouData, displayRunYear, appliedBirth, chartFields, godsZiRows, godsYearRows, zsRows, roleRefRows){
		const validPanelTabs = ['overview', 'gods', 'analysis', 'aux', 'topic', 'ref'];
		const activeKey = validPanelTabs.indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		return (
			<div className="horosa-jinkou-rightpanel-wrap">
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-jinkou-tabs">
				{/* horosa_freeze_subtabs_v1:右栏 5 面板 keep-alive,原先每次父重渲都把
				    概览/神煞/分析/用神/参考 全跑一遍。函数式:非激活不求值、不 reconcile;
				    切回拿本轮最新 children 立刻渲一帧(不卸载、不重取、不闪烁)。 */}
				<TabPane tab="概览" key="overview">
					<FreezeSubTab active={activeKey === 'overview'}>{()=>(
						this.renderOverviewAll(jinkouData, displayRunYear, appliedBirth, chartFields)
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="神煞" key="gods">
					<FreezeSubTab active={activeKey === 'gods'}>{()=>(
					<div className="horosa-jinkou-overview-stack">
						<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
							<div className="horosa-jinkou-section-card__title">四位神煞</div>
							{this.renderShenshaRows(jinkouData)}
						</section>
						{this.renderShenshaGrid('支煞', godsZiRows)}
						{this.renderShenshaGrid('年煞', godsYearRows)}
						{this.renderFangWei(jinkouData)}
						{this.renderShenshaGrid(`${this.state.wuxing}十二长生`, zsRows)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="分析" key="analysis">
					<FreezeSubTab active={activeKey === 'analysis'}>{()=>(
					<div className="horosa-jinkou-overview-stack">
						<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
							<div className="horosa-jinkou-section-card__title">四位关系图</div>
							{this.renderBranchRelation(jinkouData)}
						</section>
						{this.renderAnalysisBasic(jinkouData)}
						<section className="horosa-jinkou-info-card horosa-jinkou-section-card">
							<div className="horosa-jinkou-section-card__title">四位生克</div>
							{this.renderRelations(jinkouData)}
						</section>
						{this.renderNianYueRi(jinkouData)}
						{this.renderTaixuan(jinkouData)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="用神" key="aux">
					<FreezeSubTab active={activeKey === 'aux'}>{()=>(
					<div className="horosa-jinkou-overview-stack">
						{this.renderHezhan(jinkouData)}
						{this.renderSixiangShu(jinkouData)}
						{this.renderSixiangWuxing(jinkouData)}
						{this.renderInfoTable('四位类象', roleRefRows)}
						{this.renderCategory(jinkouData)}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="专题" key="topic">
					{this.renderTopicPanel(jinkouData)}
				</TabPane>
				<TabPane tab="参考" key="ref">
					<FreezeSubTab active={activeKey === 'ref'}>{()=>(
					<div className="horosa-jinkou-overview-stack">
						{this.renderBaShe()}
						{this.renderFuwen()}
					</div>
					)}</FreezeSubTab>
				</TabPane>
			</Tabs>
			</div>
		);
	},
};
