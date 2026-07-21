// 神数正传 —— 数算子tab。纯前端（零后端 / 零随机）。
// 受控：school 及各流派选项由上层（数算宿主）左栏提供；slot: 'center'(主信息) | 'aux'(辅助信息)。
// 四柱来自 baziLunarLocal（星阙自己的八字，不走后端），与 canping/heluo 同源。
//
// 条文正文库体积大（铁板 465KB / 邵子 437KB），故动态载入独立 chunk：
// 条文号同步即得并先行显示，正文到达后再填 —— 首屏不等条文库。
import React, { Component } from 'react';
import { createSignatureMemo } from '../../utils/memoBySignature';
import { sharedNativeModelEnabled } from '../../utils/perfFlags';
import { Empty, Spin, Tabs } from 'antd';
import { buildLocalBaziResult } from '../../utils/baziLunarLocal';
import { deriveNongliUniversalSync, subscribeRemoteNongli } from '../../utils/divinationTimeDraft';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { calcTieban, loadTiebanVerses } from '../../utils/zhengchuanTiebanLocal';
import { calcShaozi, loadShaoziVerses } from '../../utils/zhengchuanShaoziLocal';
import { dadingDeathYear, dadingDeathMonth } from '../../utils/zhengchuanDadingLocal';
import { calcLiuqin } from '../../utils/zhengchuanLiuqinLocal';
import { calcXinyi, bakeTable, xiangTable, xingqingTable, XINYI_GONG } from '../../utils/zhengchuanXinyiLocal';
import { buildZhengChuanSnapshotText } from '../../utils/zhengchuanSnapshot';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { SCHOOL_LABEL } from './zhengchuanSchools';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';

const { TabPane } = Tabs;

const fieldVal = (f, k, d = '') => (f && f[k] && f[k].value !== undefined && f[k].value !== null ? f[k].value : d);

/**
 * 按所推之【流年】，自八字既有之推运表派生大定所需的四样:虚岁 / 小运 / 岁君 / 大运。
 *
 * 🔴 一律取自 buildLocalBaziResult 已算之表，【绝不另造一份推法】——
 *    另造必与八字盘漂移，同一人两页所见之大运不同，是为大忌。
 *    · smallDirection:逐年一项，{ year, age(虚岁), ganzi(小运), yearGanzi.ganzi(当年太岁) };
 *    · mainDirection :大运表，按 startYear 取所属之运;起运前其 ganzi 为空 ——
 *      此非缺漏,乃古法「未行大运」之实,由调用方自然回落月柱。
 *
 * @param {object} bazi 八字之果(buildLocalBaziResult().bazi)
 * @param {number|string} yearInput 所推之公历年;空/不合法 → 返空对象(调用方回落本命四柱)
 * @returns {{ age?:number, xiaoyun?:string, suijun?:string, dayun?:string, year?:number, beforeQiYun?:boolean }}
 */
export function deriveDadingYearPillars(bazi, yearInput) {
	const Y = parseInt(yearInput, 10);
	// 0 亦须挡:挂载 schema 以 0 为「未择」之默认(其表单只出数,无空可言)。
	// 眼下纵不挡,0 也会因落在推运表之外而返空 —— 然那是【碰巧】对，非设计对:
	// 表一改口径(如补上生年之前诸年)，公元 0 年便会被当真。故显式挡之。
	if (!bazi || !Number.isFinite(Y) || Y <= 0) return {};
	const sd = Array.isArray(bazi.smallDirection) ? bazi.smallDirection : [];
	const md = Array.isArray(bazi.mainDirection) ? bazi.mainDirection : [];
	const s = sd.find((x) => Number(x.year) === Y);
	if (!s) return {};   // 所推之年在表外(如生年之前/百岁之外) → 不臆造
	// 大运:取 startYear 不晚于所推之年者中最后一个
	const d = md.filter((x) => Number.isFinite(Number(x.startYear)) && Number(x.startYear) <= Y).pop();
	const dayun = (d && `${d.ganzi || ''}`.trim()) || '';
	return {
		year: Y,
		age: Number(s.age) || undefined,
		xiaoyun: `${s.ganzi || ''}`.trim() || undefined,
		suijun: `${(s.yearGanzi && s.yearGanzi.ganzi) || ''}`.trim() || undefined,
		dayun: dayun || undefined,
		beforeQiYun: !dayun,   // 未起运 —— 其时只行小运，无大运可言
	};
}


// WP-F 极速化:模块级共享模型 memo —— 宿主把本组件渲染【两次】(center 与 aux 两实例),
// 各自的实例 memo 互不相通 → 同一次时间变更本地引擎白算两遍。此层跨实例共享:
// center 先算、aux 同签名直接命中(4 槽足够:两实例只差 slot,签名同源)。
// 共享引用只读契约:各消费方 render 不就地改写 model(dev 下深冻结保险丝);关开关=各算各的旧行为。
const sharedModelMemo = createSignatureMemo(4);
const devFreeze = (v) => {
	if(process.env.NODE_ENV !== 'production' && v && typeof v === 'object'){
		try{ deepFreeze(v); }catch(e){ /* 冻结失败不碍事 */ }
	}
	return v;
};
function deepFreeze(o){
	Object.freeze(o);
	Object.keys(o).forEach((k) => {
		const c = o[k];
		if(c && typeof c === 'object' && !Object.isFrozen(c)){ deepFreeze(c); }
	});
}

class ZhengChuanMain extends Component {
	constructor(props) {
		super(props);
		this.state = { verses: null, auxTab: '' };   // auxTab: 右栏所在之目（空 = 取首目）
		this.lastSnapKey = '';
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	// 中栏是整张盘 + 右栏动辄百余条条文卡(流年 108 年全列),且宿主渲染两遍(center/aux)。
	// 此前零 sCU:宿主左栏任一控件(含与本技法无关的铁板/南极/蠢子诸项)一动就整套重造。
	// props/state 任一变即照常重渲(零陈旧);opts 引用由宿主 memoOpts 稳定,值变即换新引用。
	// ⚠️ opts 引用变时本 sCU 返 true → componentDidUpdate 照跑 → loadVerses 条文库按需载入不受影响。
	// horosa_shusuan_native_scu_v1:复用 wrapperPropsEqual(全 props 机械浅比 + 同一 kill-switch)。
	shouldComponentUpdate(nextProps, nextState) {
		if (nextState !== this.state) { return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount() {
		this.loadVerses();
		this.saveSnap();
		if (typeof window !== 'undefined') {
			this._dayBoundaryListener = () => { if (!this._unmounted) this.forceUpdate(); };
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._dayBoundaryListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		// 全年份域:域外远程农历回包后清 memo 重渲(域内桥不触发,零影响)
		this._unsubRemoteNongli = subscribeRemoteNongli(() => {
			if (this._unmounted) return;
			this._modelKey = null; delete this._modelCache; this.forceUpdate();
		});
	}

	componentDidUpdate(prev) {
		if (prev.opts !== this.props.opts) this.loadVerses();
		this.saveSnap();
	}

	componentWillUnmount() {
		this._unmounted = true;
		if (this._unsubRemoteNongli) { try { this._unsubRemoteNongli(); } catch (e) { /* noop */ } }
		if (typeof window !== 'undefined') {
			window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			window.removeEventListener('horosa:late-zi-hour-mode-changed', this._dayBoundaryListener);
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	/** 条文正文库按需载入（独立 chunk）；条文号已同步显示，正文到达后 setState 填入。 */
	loadVerses() {
		const s = this.school();
		const loader = s === 'tieban' ? loadTiebanVerses : (s === 'shaozi' ? loadShaoziVerses : null);
		if (!loader) { if (this.state.verses) this.setState({ verses: null }); return; }
		if (this._versesFor === s) return;
		this._versesFor = s;
		loader().then((v) => { if (!this._unmounted) this.setState({ verses: v }); }).catch(() => {});
	}

	// AI 导出/挂载实时取数：导出侧派发 refresh 事件，这里用当前显示的盘即时构建快照并回填，
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化。
	handleSnapshotRefreshRequest(evt) {
		if (!evt || !evt.detail || evt.detail.module !== 'zhengchuan') return;
		if (this.props.slot === 'aux') return;      // 双盘对比时只 center 回填，避免 aux 覆盖
		let text = '';
		try {
			const m = this.getModel();
			if (m) text = `${buildZhengChuanSnapshotText(m, this.state.verses || {}) || ''}`.trim();
		} catch (e) { text = ''; }
		if (text) {
			saveModuleAISnapshot('zhengchuan', text, { source: 'react', savedAt: Date.now() });
			evt.detail.snapshotText = text;
		}
	}

	school() { return (this.props.opts && this.props.opts.school) || 'tieban'; }

	/** 实例 memo：输入签名不变即返缓存，避免 render/didUpdate/快照 handler 多处反复全量重算。 */
	getModel() {
		const f = this.props.fields || {};
		const opts = this.props.opts || {};
		// 心易为查询层（古籍未出起数入口）→ 不依赖生辰，须先于下方「无生辰即空」之闸
		if (this.school() === 'xinyi') {
			const qsig = JSON.stringify({ ...opts, g: fieldVal(f, 'gender', 1) });
			if (this._modelKey === qsig && Object.prototype.hasOwnProperty.call(this, '_modelCache')) return this._modelCache;
			this._modelKey = qsig;
			this._modelCache = calcXinyi({ ...opts, gender: fieldVal(f, 'gender', 1) });
			return this._modelCache;
		}
		const dm = f.date && f.date.value ? f.date.value : null;
		const tm = f.time && f.time.value ? f.time.value : null;
		if (!dm || !tm) return null;
		const params = {
			date: dm.format('YYYY-MM-DD'), time: tm.format('HH:mm:ss'),
			lon: fieldVal(f, 'lon', ''), gender: fieldVal(f, 'gender', 1), timeAlg: fieldVal(f, 'timeAlg', 1),
			after23NewDay: defaultAfter23NewDay(), lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		};
		const sig = JSON.stringify({ ...params, ...opts });
		if (this._modelKey === sig && Object.prototype.hasOwnProperty.call(this, '_modelCache')) return this._modelCache;
		// WP-F:实例 memo miss → 先查模块级共享(另一实例可能已算过同签名)
		if (sharedNativeModelEnabled()) {
			const sharedHit = sharedModelMemo.get(sig);
			if (sharedHit !== undefined) {
				this._modelKey = sig; this._modelCache = sharedHit;
				return sharedHit;
			}
		}
		// 🔴 诸引擎【不回传】四柱与性别(实测 m.pillars / m.gender 皆 undefined) —— 其只出算得之数。
		//    而盘面要显四柱,故于此补挂 _pillars/_gender 专供显示,不动引擎之契约(免其金标受累)。
		const cache = (v) => {
			this._modelKey = sig;
			this._modelCache = v && typeof v === 'object' ? { ...v, _pillars: pillars, _gender: gender } : v;
			// WP-F:共享层存【挂好 _pillars/_gender 的成品】——两实例同 fields,挂的值必相同,共享安全;
			// dev 深冻结当只读保险丝。
			if (sharedNativeModelEnabled()) { sharedModelMemo.set(sig, devFreeze(this._modelCache)); }
			return this._modelCache;
		};

		let bazi;
		try { bazi = buildLocalBaziResult(params).bazi; } catch (e) { bazi = null; }
		if (!bazi) {
			// 全年份域:lunar-js 域(AD1~9999)外走远程农历桥(与八字/主链同源;远程回包经
			// subscribeRemoteNongli 触发重渲后补全)。在途返 null 不缓存(否则空态永久)。
			const _nlr = deriveNongliUniversalSync(this.props.fields);
			if (_nlr) { bazi = { nongli: _nlr, fourColumns: _nlr.bazi, gender: fieldVal(f, 'gender', 1) }; }
			else { return null; }
		}
		const fc = (bazi && bazi.fourColumns) || {};
		const gz = (p) => (p && (p.ganzi || p.ganZhi)) || '';
		const pillars = [gz(fc.year), gz(fc.month), gz(fc.day), gz(fc.time)];
		if (pillars.some((x) => x.length < 2)) return cache(null);
		const gender = bazi.gender === 'Female' ? '女' : '男';
		const nl = bazi.lunar || bazi.nongli || {};
		const lunarMonth = Number(nl.monthNum || nl.month) || 1;
		const lunarDay = Number(nl.dayNum || nl.day) || 1;
		const isLeapMonth = !!(nl.isLeap || nl.leap);

		try {
			const s = this.school();
			if (s === 'tieban') {
				return cache(calcTieban({
					yearGz: pillars[0], monthGz: pillars[1], dayGz: pillars[2], hourGz: pillars[3],
					gender, lunarMonth, lunarDay, isLeapMonth,
					askGz: opts.askGz || pillars[3],
				}));
			}
			if (s === 'shaozi') {
				return cache(calcShaozi({
					pillars, gender, lunarMonth, lunarDay, isLeapMonth,
					fatherAge: Number(opts.fatherAge) || 27, motherAge: Number(opts.motherAge) || 26,
					yuan: opts.yuan || 'zhong',
				}));
			}
			if (s === 'liuqin') {
				return cache(calcLiuqin({
					pillars, gender: bazi.gender === 'Female' ? 0 : 1, lunarMonth, lunarDay, isLeapMonth,
					yearZhi: pillars[0][1], hourZhi: pillars[3][1], yangYear: '甲丙戊庚壬'.indexOf(pillars[0][0]) >= 0,
					askHourZhi: opts.askHourZhi || pillars[3][1], env: opts.env || (
						// 演算时辰在卯–申走天四象(晴阴雨雪)、酉–寅走地四象(明晦雨雪)；默认取各自首项
						'卯辰巳午未申'.indexOf(opts.askHourZhi || pillars[3][1]) >= 0 ? '晴' : '明'),
				}));
			}
			if (s === 'dading') {
				// 🔴 七位之中，四柱由生辰定，而【虚岁·大运·小运·岁君】四者由所推之【流年】定 ——
				//    此四者本可自生辰与流年推得，从前却要用户逐个手填干支(且得自己算虚岁)，实为苦役。
				//    今取所推之年一项，余者尽自八字既有之推运表派生:
				//      · 虚岁/小运/岁君 —— smallDirection 一表俱全(其 yearGanzi 即当年太岁);
				//      · 大运 —— mainDirection 按年区间取;起运前其干支为空,恰合古法「未行大运」,
				//        此时自然回落月柱(即下方 || pillars[1] 那一路)。
				//    绝不另造一份推法:与八字盘同出一源，则同一人于八字页与本页所见之大运必同。
				const derived = deriveDadingYearPillars(bazi, opts.dadingYear);
				const input = {
					pillars,
					// 手填者优先(留作古法特例之用)，无则用所推之年派生者，再无则回落本命四柱
					dayun: opts.dayun || derived.dayun || pillars[1],
					xiaoyun: opts.xiaoyun || derived.xiaoyun || pillars[3],
					suijun: opts.suijun || derived.suijun || pillars[0],
					age: Number(opts.age) || derived.age || 40,
				};
				const year = dadingDeathYear(input);
				const month = year ? dadingDeathMonth(pillars[1], pillars[0][0]) : null;
				return cache(year ? { school: 'dading', input, year, month, derived } : null);
			}
		} catch (e) { return cache(null); }
		return cache(null);
	}

	saveSnap() {
		if (this.props.slot === 'aux') return;
		const m = this.getModel();
		if (!m) return;
		const key = `${m.school}|${this._modelKey}|${this.state.verses ? 'v' : '-'}`;
		if (key === this.lastSnapKey) return;
		this.lastSnapKey = key;
		const text = buildZhengChuanSnapshotText(m, this.state.verses || {});
		if (text) saveModuleAISnapshot('zhengchuan', text, { source: 'react', savedAt: Date.now() });
	}

	card(title, rows) {
		return (
			<div className="horosa-huangji-info-card" key={title}>
				<div className="horosa-huangji-info-heading">{title}</div>
				<div className="horosa-huangji-info-body">
					{rows.map((r, i) => (
						<div className="horosa-huangji-info-row" key={i}>
							<span className="horosa-huangji-info-label">{r[0]}</span>
							<span className="horosa-huangji-info-value">{r[1]}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	/** 推算流程卡：每步「输入 → 查哪张表 → 输出」，古籍算法逐步可见。 */
	stepsCard(title, steps) {
		return (
			<div className="horosa-huangji-info-card" key={title}>
				<div className="horosa-huangji-info-heading">{title}</div>
				<div className="horosa-zhengchuan-steps">
					{steps.map((s, i) => (
						<div className="horosa-zhengchuan-step" key={i}>
							<span className="horosa-zhengchuan-step-no">{i + 1}</span>
							<span className="horosa-zhengchuan-step-label">{s.label}</span>
							<span className="horosa-zhengchuan-step-in">{s.input !== undefined ? s.input : s.detail}</span>
							<span className="horosa-zhengchuan-step-tbl">{s.table || ''}</span>
							<span className="horosa-zhengchuan-step-out">{s.output !== undefined ? s.output : s.value}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	verse(n) {
		if (n === null || n === undefined) return '';
		const v = this.state.verses;
		if (!v) return '…';                       // 条文库载入中：条文号已出，正文稍候
		return v[String(n)] || '';
	}

	/**
	 * 右栏子tab —— 样式照本页诸兄弟（horosa-huangji-tabs）。
	 * 🔴 此前右栏是一长列卡直吐：条文动辄上百条(流年 108 年)，全平铺则要滚很久才见底，
	 *    且各流派的目也无从分。分目后每目自成一屏。
	 * items 里可含 null（某流派无此目）→ 就地滤掉，不出空页签。
	 *
	 * 🔴 forceRender：antd Tabs 默认【只渲染当前那一页】，而本技法的左栏选项各自只影响
	 *    某一目（如心易之「声」只动「某项」那目）—— 若只渲染当前目，用户改了选项而眼前
	 *    这一目不属其管辖，右栏便【纹丝不动】＝ 又一个「勾了没反应」。
	 *    (此非臆测：加 tab 后「改 sound/xqZhi/xqYushu → 右栏必变」三例当场转红。)
	 *    故诸目一概 forceRender —— 内容皆是已算好的纯文本卡，全渲染无虞。
	 */
	auxTabs(items) {
		const list = (items || []).filter((x) => x && x.node);
		if (!list.length) return null;
		if (list.length === 1) return list[0].node;   // 只一目则不必出页签(徒增一层)
		const active = list.some((x) => x.key === this.state.auxTab) ? this.state.auxTab : list[0].key;
		return (
			<Tabs
				activeKey={active}
				onChange={(k) => this.setState({ auxTab: k })}
				size="small"
				className="horosa-huangji-tabs horosa-zhengchuan-tabs"
			>
				{/* horosa_freeze_subtabs_v1:诸目【首渲照旧全渲】(eager —— forceRender 那条契约
			    逐字保留:选项只影响某一目时,那一目首次也必已渲过),此后【非激活的目不再
			    跟着父重渲】。冻结≠卸载:DOM/滚动位置/展开态全留,切回去拿本轮最新 children
			    立刻渲一帧,不重挂载、不闪烁、零陈旧。 */}
			{list.map((x) => (
				<TabPane tab={x.label} key={x.key} forceRender>
					<FreezeSubTab active={active === x.key} eager>{x.node}</FreezeSubTab>
				</TabPane>
			))}
			</Tabs>
		);
	}

	renderTieban(m, aux) {
		const b = m.benming;
		if (aux) {
			const rows = [];
			Object.keys(b.items || {}).forEach((k) => {
				const it = b.items[k];
				if (it.skipped) rows.push([k, it.reason]);
				else (it.nums || []).forEach((n) => rows.push([`${k} ${n}`, this.verse(n)]));
			});
			// 🔴 流年【列全】——此前只出前 24 岁(slice(0,24))，而本支覆盖 108 年，
			//    中栏又明写「覆盖 108 年」，两处自相矛盾：说了有 108 年却只给 24 年。
			const ln = m.liunian;
			return this.auxTabs([
				{ key: 'benming', label: '本命', node: this.card('本命条文', rows.length ? rows : [['—', '暂无']]) },
				ln ? {
					key: 'liunian',
					label: `流年 ${ln.rows.length}`,
					node: (
						<>
							{this.card('流年总纲', [
								['天四声（12 年一循环）', ln.seq.join(' ')],
								['后天命数', ln.houTian],
								['覆盖', `${ln.rows.length} 年（1~${ln.rows.length}）`],
							])}
							{this.card(`流年条文（${ln.rows.length} 年全）`, ln.rows.map((x) => [
								`${x.age}岁 ${x.gz}`, x.missing ? '古籍原缺此格' : `${x.num} ${this.verse(x.num)}`,
							]))}
						</>
					),
				} : null,
				b.notes.length ? { key: 'notes', label: '说明', node: this.card('说明', b.notes.map((n) => ['·', n])) } : null,
			]);
		}
		return (
			<>
				{this.stepsCard('本命推算流程', b.steps)}
				{this.card('本命结论', [
					['考刻', b.ke], ['本命数', b.benMingShu], ['十二辟卦', b.biGua || '—'],
					['辟卦基数＋序数', b.base != null ? `${b.base} ＋ ${b.xuShu}` : '—'],
				])}
				{m.liunian && this.card('流年', [
					['天四声（12 年一循环）', m.liunian.seq.join(' ')],
					['后天命数', m.liunian.houTian],
					['覆盖', `${m.liunian.rows.length} 年（1~${m.liunian.rows.length}）`],
				])}
			</>
		);
	}

	renderShaozi(m, aux) {
		if (aux) {
			const rows = [];
			['性情', '祖业', '财运', '职业'].forEach((k) => {
				const v = m.benming && m.benming[k];
				if (!v) return;
				rows.push([`${k} ${v.num || '—'}`, v.num ? this.verse(v.num) : '（不可得）']);
			});
			return this.auxTabs([
				{ key: 'benming', label: '断本命', node: this.card('断本命', rows.length ? rows : [['—', '暂无']]) },
				m.dress ? { key: 'dress', label: '装卦', node: this.card('装卦', m.dress.yaos.slice().reverse().map((y) => [
					`${y.pos}爻 ${y.gz}`, `${y.wuxing} ${y.liuqin}${y.shiYing ? ` ${y.shiYing}` : ''}`,
				])) } : null,
				m.notes.length ? { key: 'notes', label: '说明', node: this.card('说明', m.notes.map((n) => ['·', n])) } : null,
			]);
		}
		const xt = m.xianTian;
		return (
			<>
				{this.card('先天命卦', [
					['天数（奇数和）', `${xt.tian} → 余 ${xt.tianRem} → ${xt.tianGua}`],
					['地数（偶数和）', `${xt.di} → 余 ${xt.diRem} → ${xt.diGua}`],
					['配法', xt.groupA ? '阳男阴女：天上地下' : '阴男阳女：天下地上'],
					['先天命卦', (xt.gua && xt.gua.name) || '—'],
				])}
				{this.card('三命数', [
					['天命数', `${m.tianMing.num}${m.tianMing.special ? '（整除特例）' : ''}`],
					['地命数', `${m.diMing.num}${m.diMing.special ? '（整除特例）' : ''}`],
					['人命数', m.renMing.num != null ? `${m.renMing.gua}${m.renMing.guaNum} ＋ ${m.renMing.sound}${m.renMing.qiNum} ＝ ${m.renMing.num}` : '—'],
				])}
				{m.houTian && this.card('后天命卦', [
					['上卦', `${m.houTian.diCalc.sum}÷9 余${m.houTian.diCalc.rem} → ${m.houTian.up}`],
					['下卦', `${m.houTian.tianCalc.sum}÷9 余${m.houTian.tianCalc.rem} → ${m.houTian.lo}`],
					['后天命卦', (m.houTian.gua && m.houTian.gua.name) || '—'],
					['动爻', `人命数四位和 ${m.houTian.dongCalc.digits}÷6 余${m.houTian.dongCalc.rem} → ${m.houTian.dongYao}爻动`],
					['变卦', (m.houTian.bianGua && m.houTian.bianGua.name) || '—'],
				])}
			</>
		);
	}

	renderDading(m, aux) {
		if (aux) {
			return this.auxTabs([
				{ key: 'ce', label: '七位策数', node: this.card('七位策数', m.year.items.map((x) => [
					`${x.gz}（${x.nayin}）`, `太玄 ${x.gan}＋${x.zhi} ＋ 本数 ${x.ben} ＝ ${x.ce}`,
				])) },
				m.month && m.month.hit ? { key: 'siyue', label: '死月扫描', node: this.card('死月扫描', m.month.scan.map((x) => [
					`${x.monthNo}月 ${x.gz}`, `${x.sum}×${x.mul}=${x.prod} → 余${x.r45} → 三因${x.tripled} → ${x.r12}${x.exhausted ? '（尽）' : ''}`,
				])) } : null,
			]);
		}
		// 七位之后三位(大运/小运/岁君)自何而来 —— 须摊在明处,不作黑盒:
		// 用户既未手填,便当让他看见「这三个是自哪一年推出来的」。
		const d = m.derived || {};
		const used = m.input || {};
		const src = (auto, manual) => (manual ? `${manual}（手订）` : (auto || '—'));
		return (
			<>
				{d.year ? this.card(`所推之年 · ${d.year}`, [
					['虚岁', src(d.age, this.props.opts && this.props.opts.age)],
					['大运', d.beforeQiYun ? `${used.dayun}（其时未行大运，取月柱）` : src(d.dayun, this.props.opts && this.props.opts.dayun)],
					['小运', src(d.xiaoyun, this.props.opts && this.props.opts.xiaoyun)],
					['岁君', `${src(d.suijun, this.props.opts && this.props.opts.suijun)}${d.suijun && !(this.props.opts && this.props.opts.suijun) ? '　当年太岁' : ''}`],
				]) : this.card('所推之年', [
					['未择', '左栏择一年，则虚岁·大运·小运·岁君自出；今且取本命四柱代之'],
				])}
				{this.stepsCard('起推人生死数', m.year.steps)}
				{this.card('结论', [
					['七位策积', m.year.sum],
					['45 除取余', `${m.year.r45}${m.year.exhausted ? '（整除＝尽期）' : '（不满45，三因）'}`],
					['12 除取余（见绝期）', m.year.r12],
					['死月', m.month && m.month.hit ? `${m.month.hit.monthNo}月 ${m.month.hit.gz}` : '（未至尽数）'],
				])}
			</>
		);
	}

	renderLiuqin(m, aux) {
		const sx = m.shengxiao;
		const xs = m.xingshi;
		const xj = m.xuanji;
		if (aux) {
			const rows = [];
			if (sx) ['spouse', 'parent'].forEach((k) => {
				const it = sx.items[k];
				const d = it && it.dun;
				rows.push([k === 'spouse' ? '夫妻' : '父母', d ? `${it.gong} 宫 ${it.gz} → 遁得 ${d.hitGz} → 属 ${d.shengxiao}` : '（不可得）']);
			});
			return this.auxTabs([
				{ key: 'shengxiao', label: '六亲属相', node: this.card('六亲属相', rows.length ? rows : [['—', '暂无']]) },
				xs ? { key: 'xingshi', label: '妻室姓氏', node: this.card('妻室姓氏', xs.missing ? [['本格不推', xs.missing]] : [
					['先天／后天五行', `${xs.xianTianWuxing || '—'}／${xs.houTianWuxing || '—'}`],
					['入谱', `第 ${xs.tableNo} 表 ${xs.ganRow} 行`],
					['合者', (xs.candidates || []).length ? xs.candidates.map((c) => `${c.name}（${c.zhi} 栏）`).join('、') : '此格无合者'],
					['条文号', xs.chengShuNote],
				]) } : null,
				xj ? { key: 'xuanji', label: '玄机卦', node: this.card('玄机卦动爻', [
					['宫位', xj.gong], ['四象', xj.sixiang || '—'],
					['动爻', xj.dongYao ? `${xj.dongYao} 爻动` : '—'],
				]) } : null,
				{ key: 'gaps', label: '所缺', node: this.card('本支所缺（古籍未载，不臆补）', (m.meta.gaps || []).map((g) => [g.item, g.reason])) },
			]);
		}
		return (
			<>
				{sx && this.stepsCard('十二宫与六亲宫', sx.steps)}
				{sx && this.card('旬遁断属相', ['spouse', 'parent'].map((k) => {
					const it = sx.items[k]; const d = it && it.dun;
					return [k === 'spouse' ? '夫妻宫' : '父母宫',
						d ? `${it.gz} → ${d.ganUsed} 居 ${d.p0Gua}${d.p0} → 起 ${d.xunShou} 顺数 ${d.k} 位落 ${d.pGua}${d.p} → ${d.dunGan} → ${d.hitGz} → 属 ${d.shengxiao}` : '（不可得）'];
				}))}
				{xs && this.stepsCard('秘音断妻姓氏', xs.steps)}
				{xj && this.stepsCard('玄机卦动爻', xj.steps)}
			</>
		);
	}

	renderXinyi(m, aux) {
		const q = m.input || {};
		const sel = (on, label) => `${on ? '▸ ' : ''}${label}`;   // 所选项标 ▸，令每个选项在两栏皆可见
		// lookupXiang 归一后 all 全是 {num,mark} 对象且 mark 常为 null → 须判 mark 有无，否则打出字面「null」
		const cell = (x) => (typeof x === 'number' ? `${x}` : `${x.mark ? `${x.mark} ` : ''}${x.num}`);
		if (aux) {
			// 右栏＝查询所得。中右栏须各自完整响应全部选项（否则改某项只动一栏＝「勾了没反应」）。
			return this.auxTabs([
				m.bake ? { key: 'bake', label: '八刻分命', node: this.card('八刻分命 · 所得', [
					['刻数 × 宫', `${m.bake.ke} × ${m.bake.gong}`], ['本命卦', m.bake.gua || '—'],
				]) } : null,
				m.xiang ? { key: 'xiang', label: `${m.xiang.item}项`, node: this.card(`${m.xiang.item}项 · ${m.xiang.sound}声 · 所得`, [
					['条文号', m.xiang.picked.map((x) => x.num).join('、')],
					...(m.xiang.pickNote ? [['取值之别', m.xiang.pickNote]] : []),
					['本格全数', m.xiang.all.map(cell).join('、')],
					['括号之注', m.xiang.bracketNote || '—'],
				]) } : null,
				m.xingqing ? { key: 'xingqing', label: '性情项', node: this.card(`性情项 · ${m.xingqing.zhi} 支 · 余 ${m.xingqing.yushu} · 所得`, [
					['条文号', m.xingqing.nums.join('、')],
					...(m.xingqing.ambiguous ? [['存疑', m.xingqing.ambiguous]] : []),
				]) } : null,
				{ key: 'gaps', label: '所缺', node: this.card('本支所缺（古籍未载，不臆补）', (m.meta.gaps || []).map((g) => [g.item, g.reason])) },
			]);
		}
		// 中栏＝所据之表（所选之格标 ▸）
		const t = q.item ? xiangTable(q.item) : null;
		const xqRow = q.xqZhi ? xingqingTable().find((r) => r.zhi === q.xqZhi) : null;
		return (
			<>
				{this.card('本支体例', [
					['性质', '查询层 —— 古籍只出部分口诀与部分图表，未出起数入口'],
					['何以不推', '由生辰求各项之「声音」「卦气」「余数」之法古籍全未载，其命例亦只列结果而不示推导'],
					['条文正文', '本支条文库古籍未载，仅存秘数表 → 只出条文号'],
				])}
				{this.card('八刻分命表（刻数 × 八宫 → 本命卦）', bakeTable().map((r) => [
					sel(r.ke === q.ke, r.ke),
					r.guas.map((g, i) => (r.ke === q.ke && XINYI_GONG[i] === q.gong ? `【${g}】` : g)).join(' '),
				]))}
				{t && this.card(`${t.item}项条文秘数表`, [...t.rowsA, ...t.rowsB].map((r) => [
					sel(r.sound === q.sound, r.sound), r.cell.map(cell).join('、'),
				]))}
				{xqRow && this.card(`性情项条文秘数表 · ${xqRow.zhi} 支`, xqRow.cells.map((c, i) => [
					sel(`${i + 1}` === `${q.xqYushu}`, `余 ${i + 1}`), c.join('、'),
				]))}
			</>
		);
	}

	/** 栏位卡网格 —— 与本页诸兄弟同一副面孔（标签在上、值作大字） */
	metaGrid(items) {
		const list = items.filter((x) => x && x.value !== undefined && x.value !== null && x.value !== '');
		if (!list.length) return null;
		return (
			<div className="horosa-huangji-meta-grid horosa-kinastro-meta-grid">
				{list.map((x) => (
					<div key={x.label}>
						<span>{x.label}</span>
						<strong>{x.value}</strong>
					</div>
				))}
			</div>
		);
	}

	/** 四柱卡 —— 数算诸盘皆以此起手，此前本支独缺 */
	pillarGrid(pillars) {
		if (!Array.isArray(pillars) || pillars.length !== 4) return null;
		const LABELS = ['年柱', '月柱', '日柱', '时柱'];
		return (
			<div className="horosa-kinastro-pillar-grid">
				{pillars.map((gz, i) => (
					<div className="horosa-shenyishu-pillar-card" key={LABELS[i]}>
						<span>{LABELS[i]}</span>
						<strong>{gz || '—'}</strong>
					</div>
				))}
			</div>
		);
	}

	render() {
		const aux = this.props.slot === 'aux';
		const m = this.getModel();
		if (!m) {
			return <div className="horosa-huangji-empty"><Empty description="请先填写生辰" image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>;
		}
		const RENDER = {
			tieban: this.renderTieban, shaozi: this.renderShaozi, dading: this.renderDading,
			liuqin: this.renderLiuqin, xinyi: this.renderXinyi,
		};
		const body = (RENDER[m.school] || this.renderTieban).call(this, m, aux);
		const loading = (m.school === 'tieban' || m.school === 'shaozi') && !this.state.verses;
		// 右栏只出内容，不套盘（盘是中栏之事）
		if (aux) {
			return (
				<div className="horosa-zhengchuan-page">
					{loading ? <div className="horosa-zhengchuan-loading"><Spin size="small" /> 条文库载入中（条文号已出，正文稍候）</div> : null}
					{body}
				</div>
			);
		}
		// 🔴 中栏须是【一张盘】—— 骨架照数算诸兄弟(board + 页眉 + 栏位卡 + 四柱)，
		//    此前本支直接吐内容卡、无盘无题无四柱，与同页兄弟全然两副面孔。
		// 🔴 中栏不再多套一层 .horosa-zhengchuan-page —— board-host 是 clamp(640px,82%,1080px)，
		//    中间夹一层会断掉宽度传导：实测 board 撑到 1040px 而其 stage 仅 873px，
		//    盘遂溢出(标题被裁、年柱出界、底部现横向滚动条)。board 直接作 host 之子即好。
		return (
			<>
				<div className="horosa-taixuan-board horosa-kinastro-board horosa-zhengchuan-board">
					<div className="horosa-huangji-board-header">
						<div><h2 className="horosa-taixuan-title">{SCHOOL_LABEL[m.school] || '神数正传'}</h2></div>
						<div className="horosa-huangji-board-time">{m._gender === '女' ? '坤造' : '乾造'}</div>
					</div>
					{this.pillarGrid(m._pillars)}
					{loading ? <div className="horosa-zhengchuan-loading"><Spin size="small" /> 条文库载入中（条文号已出，正文稍候）</div> : null}
					{body}
				</div>
			</>
		);
	}
}

export default ZhengChuanMain;
