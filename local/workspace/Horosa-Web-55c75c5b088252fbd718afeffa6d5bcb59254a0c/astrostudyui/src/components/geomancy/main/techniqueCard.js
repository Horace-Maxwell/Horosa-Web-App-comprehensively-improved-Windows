// 地占页 · 右栏技法卡(各传本技法的分项展示)
// 从 GeomancyMain.js 按职责拆出的 GeomancyMain 方法:this 仍是 GeomancyMain 实例,门面里 mixinMethods(GeomancyMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { XQSelect as Select } from '../../xq-ui';
import { TURN_HOUSE_LABELS } from '../geomancyOptions';
import { pressable } from '../../../utils/pressable';
import { PARITY_SCOPE_ZH, COURT_VERDICT_ZH, COURT_JUDGE_SPECIAL_ZH, TONE_CLASS_ZH, SUCCESS_ZH, VALIDITY_RULES_ZH, VALIDITY_LABELS, TENANCY_GRADE_ZH, TENANCY_GRADE_MARK, ELEMENT_ZH_BY_EN, VIA_LINE_ZH, VIA_SIDE_ZH, SUPPLY_ZH, PERF_DIRECTION_ZH, PERF_KNOWLEDGE_ZH, PERF_CONJ_ZH, RECON_PARITY_ZH, ASPECT_TONE_ZH, TRIANGLE_SCHOOLS, TRIANGLE_MEANINGS, SHIELD16_MEANINGS, TIME_FLOW_ZH, GEOMANCY_PAGE_SETTINGS } from './tables';
const { Option } = Select;

export const techniqueCardMethods = {
	// 技法卡。读 reading.technique(引擎可计算解读)。
	// 🔴 **两组分列**:多项「技法」实为**问者宫↔所问宫之纯函数**,与本卦无关 ——
	//    实测 300 盘固定问类下:相位恒 opposition、黄道宫三方恒 [3,7,11]、
	//    位置之宫性恒「吉宫/平宫」、应期之宫角恒 fast。算法合基准,但与随卦而变者并列陈列、
	//    不加半句注记,会让人误以为这些是本卦算得的。故分「随卦而变 / 随问类而定」两组,后者显式加注。
	renderTechniqueCard(r){
		const t = r && r.technique;
		if(!t){ return null; }
		const PERF = { occupation: '入主(同居一宫)', conjunction: '会合(邻宫)', mutation: '互变(他处相邻)', translation: '传递(第三图转介)', none: '未成局' };
		const ASP = { conjunction: '合', sextile: '六分(吉)', square: '刑(凶)', trine: '拱(吉)', opposition: '冲', none: '无相位' };
		const COMP = { simple: '全同', demi_simple: '半同(同行星)', compound: '互反', capitular: '同首(火行)', none: '—' };
		const TONE_ZH = { good: '吉', bad: '凶', neutral: '中性' };
		const TRI_EL = { 1: '火', 5: '火', 9: '火', 2: '地', 6: '地', 10: '地',
			3: '风', 7: '风', 11: '风', 4: '水', 8: '水', 12: '水' };
		const NM = this.figNameMap(r);
		const fn = (x)=>((x && NM[x]) ? NM[x] : x);          // 拉丁标识 → 所选名表之名
		const perfHit = t.perfection && t.perfection !== 'none';
		// group: 'chart' 随卦而变 | 'topic' 随问类而定(同一问类下恒同)
		// 🔴 **全项常驻**:此前未命中即整行消失 —— 实测 200 盘渲染率 阻碍 54.5%、中介 30%、
		//    自然共主 24%,同一卡显 11~13 行不等,用户**无从分辨「查过但未成立」与「根本没实现」**。
		//    今每项恒在其位,未命中显「无/不适用/未成立」并弱化配色;每行附一句释义。
		const rows = [];
		const push = (label, value, hint, group, miss)=>rows.push({
			label, value, hint, group: group || 'chart', miss: !!miss });

		// ── 传本解卦之首二步:先验卦盘是否有效,再看法庭三角总断 ──
		{
			const va = t.validity;
			const hits = ((va && va.rules) || []).filter((x)=>x.hit);
			push('有效性', va
				? (hits.length
					? hits.map((x)=>`${VALIDITY_LABELS[x.id - 1]}:${VALIDITY_RULES_ZH[x.code] || x.code}${x.book_note ? `(${x.book_note})` : ''}`).join('；')
					: '五则皆过,卦盘可判')
				: '—',
				'传本五则:首图龙尾/红色/失去/群众各有所警,另一则看一宫群众并十一宫红色', 'chart', !va || !hits.length);
		}
		{
			const cv = t.court_verdict;
			let v = '—';
			if(cv){
				const three = `左证${fn(cv.left.figure)}(${TONE_CLASS_ZH[cv.left.tone_class]})·`
					+ `法官${fn(cv.judge.figure)}(${TONE_CLASS_ZH[cv.judge.tone_class]})·`
					+ `右证${fn(cv.right.figure)}(${TONE_CLASS_ZH[cv.right.tone_class]})`;
				v = `${three} → ${COURT_VERDICT_ZH[cv.verdict_code] || cv.verdict_code}`;
				if(cv.judge_special){ v = `${COURT_JUDGE_SPECIAL_ZH[cv.judge_special]};${v}`; }
			}
			push('法庭三角', v,
				'法官定总方向、右证为事主、左证为条件环境;三图吉凶合断成否(传本表未载之组合如实标出)',
				'chart', !cv);
		}
		push('完美', perfHit ? PERF[t.perfection] : (t.perfection_by_aspect ? `借相位(${ASP[t.perfection_by_aspect]})成局` : PERF.none),
			'两指示星能否接上:同宫/邻宫/互变/借第三图转介,四者有其一即成局',
			'chart', !perfHit && !t.perfection_by_aspect);
		push('阻碍', t.prohibition ? `第 ${t.prohibition} 宫强凶图阻断` : '无阻碍',
			'成局之路上若横亘强凶之图,则事将成而中折', 'chart', !t.prohibition);
		{
			const pp = t.points_parity;
			push('点数是否', pp
				? `总 ${pp.total} 点·${pp.parity === 'even' ? '偶→是/稳' : '奇→否/动'}(取样:${PARITY_SCOPE_ZH[pp.scope] || '全盘十六图'})`
					+ (pp.degenerate ? ' ⚠ 该取样结构恒偶,不具判别力' : '')
				: '—',
				'总点数奇偶断是非成否:偶主是/稳成,奇主否/变动', 'chart', !pp);
		}
		push('应期', t.timing
			? `${t.timing.speed === 'fast' ? '速' : '迟'}·以「${t.timing.unit}」计`
				+ `·${{ fast: '角宫快', mid: '续宫中', slow: '果宫慢' }[t.timing.angularity] || ''}(宫角由所问宫定)`
			: '—',
			'快慢由图之动静定、单位由图之元素定,再以所问宫之角/续/果加权', 'chart', !t.timing);
		{
			const q = t.timing && t.timing.quantity;
			push('数量', q ? `${q.label}(总 ${q.total} 点·域 ${q.min}–${q.max})` : '—',
				'答「几件/几人/多少」一类问法:总点数于其域中三分为多/中/少', 'chart', !q);
		}
		push('点之路', t.via_puncti
			? (t.via_puncti.through ? `贯通(${(t.via_puncti.path || []).map(fn).join('→')})` : `断于${t.via_puncti.broken_at}`)
			: '—',
			'自判官循单点上溯至母图:贯通则事有来路,断则中途失据', 'chart', !t.via_puncti);
		push('自然共主', t.natural_cosignificator ? '月亮(判官属月亮系)' : '不涉',
			'判官若属月亮所主之图,则月亮为本占之自然共主', 'chart', !t.natural_cosignificator);
		{
			// 位置:**图之吉凶须与所落之宫吉凶并看** —— 图吉而落凶宫,其吉减半。
			// 宫性(吉/平/凶宫)由宫号定、同问类恒同;图则随卦而变,故两者都要显出来。
			const lq = t.locus_quesited;
			const lqq = t.locus_querent || {};
			const one = (x)=>(x && x.figure)
				? `${fn(x.figure)}(${TONE_ZH[x.figure_tone] || '—'})落第 ${x.house} 宫·${x.label}`
				: '—';
			push('位置', lq ? `所问 ${one(lq)}；问者 ${one(lqq)}` : '—',
				'图之吉凶须与所落之宫吉凶并看:图吉而落凶宫,其吉减半(宫性同问类恒同,图随卦而变)',
				'chart', !lq);
		}
		{
			const rec = (t.motus && t.motus.recurring) || [];
			push('移动', rec.length
				? rec.slice(0, 3).map((x)=>`${fn(x.figure)}现于${x.houses.join('/')}宫(${x.count}次)`).join('；')
				: '无重现',
				'同一图重现愈多,其象愈贯穿全局', 'chart', !rec.length);
		}
		{
			const d0 = t.perfection_detail || {};
			let v = '不适用';
			if(d0.via_figure){
				const vf = Array.isArray(d0.via_figure) ? d0.via_figure.map(fn).join('、') : fn(d0.via_figure);
				const vh = Array.isArray(d0.via_house) ? d0.via_house.join('/') : d0.via_house;
				v = `${vf}(第 ${vh} 宫)${d0.mover ? `；${d0.mover === 'querent' ? '问者' : '所问'}移就` : ''}`;
			}else if(d0.mover){
				v = `${d0.mover === 'querent' ? '问者' : '所问'}移就`;
			}
			push('中介', v, '传递成局时,居中之图所落之宫即揭示促成者身份(如落七宫则配偶或合伙之人)',
				'chart', v === '不适用');
		}
		{
			const comp = (t.company || []).filter((c)=>c.type && c.type !== 'none')
				.map((c)=>`宫${c.pair[0]}/${c.pair[1]}:${COMP[c.type]}`);
			push('同伴', comp.length ? comp.join('；') : '无同伴',
				'成对之宫所盛二图若同/半同/互反/同首,则二事同气相连', 'chart', !comp.length);
		}
		// ── 传本补齐:成败 / 得地 / 寻源四线 / 元素法 / 希腊点 / 宣判奇偶 ──
		{
			const sc = t.success;
			push('成败判定', sc
				? `${sc.has_perfection ? '有精准相位' : '无精准相位'}·事主${TONE_CLASS_ZH[sc.querent_tone]}`
					+ `·对象${TONE_CLASS_ZH[sc.quesited_tone]} → ${SUCCESS_ZH[sc.code] || sc.code}`
				: '—',
				'有精准相位则事发生、无则不发生;再以两指示图吉凶分四格。只判成否,不判好坏顺逆,须与法官合参,勿滥用',
				'chart', !sc);
		}
		{
			const tn = t.tenancy || [];
			const key = { 13: '右证', 14: '左证', 15: '判官', 16: '宣判' };
			const brief = tn.filter((x)=>x.position >= 13 && x.figure)
				.map((x)=>`${key[x.position]}${fn(x.figure)}入${ELEMENT_ZH_BY_EN[x.position_element]}位·${(TENANCY_GRADE_ZH[x.grade] || {}).t || '—'}`);
			push('得地', brief.length ? brief.join('；') : '—',
				'盾十六位以火风水土按序分配;卦元素与位元素全同者最强、同温者辅助、同湿者停滞、全异者无力(盘面已标角标)',
				'chart', !brief.length);
		}
		{
			const ve = t.via_elements || {};
			const parts = ['fire', 'air', 'water', 'earth'].map((k)=>{
				const b = ve[k] || {};
				const nm = (VIA_LINE_ZH[k] || {}).n || k;
				if(!b.traceable){ return `${nm}:法官此行阴爻,不可由此寻`; }
				if(!b.through){ return `${nm}:断于${b.broken_at}`; }
				const tm = b.terminus || {};
				return `${nm}:至盾位${tm.position}(${VIA_SIDE_ZH[tm.side] || ''})`;
			});
			push('寻源四线', parts.join('；'),
				'由法官之阳爻上溯以探事之根源:火主目的意志、风主思想交流、水主感情灵性、土主结果物质;'
				+ '终于盾位一至四多关事主自身之行,终于五至八多关他人环境',
				'chart', !t.via_elements);
		}
		{
			const es = (t.element_supply || {}).elements || {};
			const parts = ['fire', 'air', 'water', 'earth'].map((k)=>{
				const b = es[k] || {};
				const nm = (VIA_LINE_ZH[k] || {}).n || k;
				return `${nm}${b.active_count}爻·${b.level === 'abundant' ? '充沛' : '匮乏'}`
					+ (b.supply ? `·${SUPPLY_ZH[b.supply]}` : '');
			});
			push('元素法', Object.keys(es).length ? parts.join('；') : '—',
				'四女各由四母同爻位构成,数其阳爻:三以上为相对充沛、二以下为匮乏。'
				+ '法官有此元素者以寻源法追之,得于我方为自给、于对方为借贷。⚠️元素有无与充沛与否皆非吉凶之判',
				'chart', !Object.keys(es).length);
		}
		{
			const gp = t.greek_points;
			push('福点灵点', gp
				? `福点第 ${gp.fortune_house} 宫(总 ${gp.fortune_total} 点)；灵点第 ${gp.spirit_house} 宫(阳爻 ${gp.spirit_total})`
				: '—',
				'福点取十二卦点数之和、灵点取十二卦阳爻数之和,各除十二取余入盘:福点主好运所在与身体财业,灵点主意志梦想欲求',
				'chart', !gp);
		}
		{
			const rp = t.reconciler_parity;
			push('宣判', rp
				? `补卦 ${fn(rp.figure)}(${rp.points} 点)·${RECON_PARITY_ZH[rp.code] || rp.code}`
				: '不取调和者',
				'第十六卦=一卦与法官相加,示所问之事最终如何影响当事人;并参其奇偶以断事之真假虚实',
				'chart', !rp);
		}
		// ── 随问类而定:只依赖问者宫↔所问宫,与本卦无关(实测固定问类下 300 盘取值种数恒为 1)──
		push('相位', `${ASP[t.aspect] || t.aspect || '无相位'}${ASPECT_TONE_ZH[t.aspect] && t.aspect !== 'none' ? `(${ASPECT_TONE_ZH[t.aspect]}相位)` : ''}`,
			'由问者宫与所问宫之宫距定:合/六分/刑/拱/冲。传本以六合、拱为吉相位,刑、冲为凶相位 —— 所描述者是过程之顺逆,非成败',
			'topic');
		{
			const tri = t.triplicities || [];
			const el = tri.length > 1 ? (TRI_EL[tri[0]] || '') : '';
			push('黄道宫三方', tri.length > 1 ? `宫 ${tri.join('/')}${el ? `(${el}三方)` : ''}` : '—',
				'所问宫与同三方之二宫同气相求,断事时并看。与「亲缘三元」非同一概念 —— 后者是盾牌生成之父·父→子',
				'topic', tri.length <= 1);
		}
		// [转宫] 以所选之宫为新命宫,按转宫式重算指示与完美 —— 问「他人之事」「事中之事」时用。
		const d = r.derived;
		const HOUSE_LABEL = TURN_HOUSE_LABELS;
		return (
			<div className="horosa-geomancy-card">
				<div className="horosa-geomancy-card-title">解读技法</div>
				{/* 退化:问者宫与所问宫重合时,hc[q]==hc[t] 恒真 → 完美恒「入主」;宫距 0 → 相位恒「合」。
				    这是数学必然、不是本卦算得,不说清用户只会看到「怎么起盘都一样」而以为算坏了。
				    问自身(自订/生命与命运,主宫皆一)时此重合本属正当,故不是错,只是不具判别力。 */}
				{((r.settings || {}).indicators_coincide) ? (
					<div className="horosa-geomancy-coincide-note">
						问者宫与所问宫同为第 {(r.settings || {}).quesited_house || 1} 宫:二指示星取自同一图,
						完美恒「入主」、相位恒「合」,<strong>此二项此时不具判别力</strong>(问自身时本属正当)。
						欲断他事,请在左栏「所问宫」另选与所问主题相应之宫。
					</div>
				) : null}
				<div className="horosa-geomancy-summary horosa-geomancy-tech-list">
					{rows.filter((x)=>x.group === 'chart').map((x, i)=>(
						<div className={`horosa-geomancy-summary-row horosa-geomancy-tech-row${x.miss ? ' is-miss' : ''}`} key={`c${i}`}>
							<span>{x.label}</span>
							<strong>{x.value}{x.hint ? <em className="horosa-geomancy-tech-hint">{x.hint}</em> : null}</strong>
						</div>
					))}
				</div>
				{rows.some((x)=>x.group === 'topic') ? (
					<div className="horosa-geomancy-topic-group">
						<div className="horosa-geomancy-topic-title">
							随问类而定
							<em>只由问者宫↔所问宫之宫距/宫性决定,与本卦无关 —— 同一问类下恒同</em>
						</div>
						<div className="horosa-geomancy-summary horosa-geomancy-tech-list">
							{rows.filter((x)=>x.group === 'topic').map((x, i)=>(
								<div className={`horosa-geomancy-summary-row horosa-geomancy-tech-row${x.miss ? ' is-miss' : ''}`} key={`t${i}`}>
									<span>{x.label}</span>
									<strong>{x.value}{x.hint ? <em className="horosa-geomancy-tech-hint">{x.hint}</em> : null}</strong>
								</div>
							))}
						</div>
					</div>
				) : null}
				{/* [传本] 法庭三角详卡:三图带时间流(右证过去·法官现在·左证未来),论一段时间之吉凶则三等分 */}
				{t.court_verdict && t.time_flow ? (
					<div className="horosa-geomancy-court">
						<div className="horosa-geomancy-triads-title">法庭三角 · 时间流</div>
						<div className="horosa-geomancy-court-row">
							{[['past', 'right_witness', t.court_verdict.right],
								['present', 'judge', t.court_verdict.judge],
								['future', 'left_witness', t.court_verdict.left]].map(([slot, role, blk])=>(
								<div className={`horosa-geomancy-court-cell is-tone-${blk.tone_class}`} key={slot}>
									<div className="horosa-geomancy-court-when">{TIME_FLOW_ZH[role]}</div>
									<div className="horosa-geomancy-court-role">
										{role === 'judge' ? '法官' : (role === 'right_witness' ? '右证·事主' : '左证·条件环境')}
									</div>
									<div className="horosa-geomancy-court-fig">{fn(blk.figure)}<em>{TONE_CLASS_ZH[blk.tone_class]}</em></div>
								</div>
							))}
						</div>
						<div className="horosa-geomancy-court-verdict">
							{t.court_verdict.judge_special
								? <div><strong>{COURT_JUDGE_SPECIAL_ZH[t.court_verdict.judge_special]}</strong></div> : null}
							<div>{COURT_VERDICT_ZH[t.court_verdict.verdict_code] || t.court_verdict.verdict_code}</div>
						</div>
						<div className="horosa-geomancy-note-hint">
							论一段时间之状况吉凶,则将该时间三等分:右证第一段、法官第二段、左证第三段。
							此三角与盾位十六宫含义角度不同,勿合用。
						</div>
					</div>
				) : null}
				{/* [传本] 地占三角四组:底二卦为补充、顶卦为概括之果;含义两派并列由用户择取 */}
				{(t.shield_triangles || []).length ? (
					<div className="horosa-geomancy-triangles">
						<div className="horosa-geomancy-triads-title">
							地占三角(四组)
							<span className="horosa-geomancy-tri-school">
								{TRIANGLE_SCHOOLS.map((s)=>(
									<button
										type="button"
										key={s.key}
										className={this.state.triangleSchool === s.key ? 'is-active' : ''}
										onClick={()=>{ GEOMANCY_PAGE_SETTINGS.save({ triangleSchool: s.key }); this.setState({ triangleSchool: s.key }); }}
									>{s.label}</button>
								))}
							</span>
						</div>
						{t.shield_triangles.map((g)=>(
							<div className="horosa-geomancy-triangle-row" key={g.index}>
								<span className="horosa-geomancy-triad-label">{`第${g.index}三角`}</span>
								<span className="horosa-geomancy-triad-expr">
									{g.base.map((b)=>(
										<em className={`is-tone-${b.tone_class}`} key={b.position}>{fn(b.figure)}</em>
									))}
									→ <strong className={`is-tone-${g.apex.tone_class}`}>{fn(g.apex.figure)}</strong>
								</span>
								<span className="horosa-geomancy-triangle-mean">
									{(TRIANGLE_MEANINGS[this.state.triangleSchool] || [])[g.index - 1]}
								</span>
							</div>
						))}
						<div className="horosa-geomancy-note-hint">
							静态以顶卦(甥)概括其果、底二卦为补充;动态则按时间流看过去现在未来。
						</div>
					</div>
				) : null}
				{/* [传本] 盾位十六宫含义:另一套判读角度,书明言不与法庭三角、地占三角合用 */}
				{(t.tenancy || []).length ? (
					<details className="horosa-geomancy-shield16">
						<summary>盾位十六宫 · 占断含义与得地</summary>
						<div className="horosa-geomancy-odu-notice">
							此为另一套判读角度 —— <strong>不要与法庭三角、地占三角合用,角度不同</strong>。
							十三宫加强一宫、十四宫加强十宫、十五宫加强七宫、十六宫加强四宫。
						</div>
						{t.tenancy.map((x)=>(
							<div className="horosa-geomancy-shield16-row" key={x.position}>
								<span className="horosa-geomancy-shield16-num">{`${x.position} ${x.label}`}</span>
								<span className="horosa-geomancy-shield16-fig">
									{x.figure ? fn(x.figure) : '—'}
									{x.grade ? (
										<em title={(TENANCY_GRADE_ZH[x.grade] || {}).d}>
											{`${TENANCY_GRADE_MARK[x.grade]} ${ELEMENT_ZH_BY_EN[x.figure_element]}入${ELEMENT_ZH_BY_EN[x.position_element]}·${(TENANCY_GRADE_ZH[x.grade] || {}).t}`}
										</em>
									) : null}
								</span>
								<span className="horosa-geomancy-shield16-mean">{SHIELD16_MEANINGS[x.position - 1]}</span>
							</div>
						))}
					</details>
				) : null}
				{/* [传本] 精准相位方向细则:联合之前后宫、传递之知晓格局、突变之场所线索 */}
				{t.perfection_direction && (t.perfection_direction.conjunctions_all || []).length
					+ (t.perfection_direction.knowledge_code ? 1 : 0)
					+ (t.perfection_direction.hint_code ? 1 : 0) > 0 ? (
						<div className="horosa-geomancy-perfdir">
							<div className="horosa-geomancy-triads-title">精准相位 · 方向细则</div>
							{(t.perfection_direction.conjunctions_all || []).map((c, i)=>(
								<div className="horosa-geomancy-summary-row" key={`cj${i}`}>
									<span>{c.mover === 'querent' ? '事主→对象' : '对象→事主'}</span>
									<strong>
										{`${fn(c.figure)}现于第 ${c.house} 宫(${PERF_DIRECTION_ZH[c.direction] || ''})`}
										<em className="horosa-geomancy-note-hint">{PERF_CONJ_ZH[c.direction]}</em>
									</strong>
								</div>
							))}
							{t.perfection_direction.knowledge_code ? (
								<div className="horosa-geomancy-summary-row">
									<span>传递知晓</span>
									<strong>{PERF_KNOWLEDGE_ZH[t.perfection_direction.knowledge_code]}</strong>
								</div>
							) : null}
							{t.perfection_direction.hint_code === 'venue_clue' ? (
								<div className="horosa-geomancy-summary-row">
									<span>突变线索</span>
									<strong>
										两图所落之宫即完成之法与地之线索
										<em className="horosa-geomancy-note-hint">偶然之意外事件使双方解决此事,非双方想象之完成方式</em>
									</strong>
								</div>
							) : null}
							{(t.perfection_direction.conjunctions_all || []).length > 1 ? (
								<div className="horosa-geomancy-note-hint">
									双方皆有联合:可由联合之多寡与卦形吉凶判何方付出多、起促进抑或反作用。
								</div>
							) : null}
						</div>
					) : null}
				{/* [传本] 行星地占盘落宫表(左栏开启该盘时出) */}
				{r.planetaryChart ? (
					<div className="horosa-geomancy-pchart-table">
						<div className="horosa-geomancy-triads-title">
							{`行星地占盘 · 上升 ${r.planetaryChart.asc_sign_zh}(首图 ${fn(r.planetaryChart.first_figure)})`}
						</div>
						{[].concat(r.planetaryChart.planets || [],
							r.planetaryChart.nodes ? [r.planetaryChart.nodes.north, r.planetaryChart.nodes.south] : [],
							r.planetaryChart.extras || []).map((p, i)=>(
							<div className="horosa-geomancy-summary-row" key={`pc${i}`}>
								<span>{p.planet_zh || p.planet}</span>
								<strong>
									{`第 ${p.house} 宫`}
									{p.draws ? <em className="horosa-geomancy-note-hint">{`报数 ${p.draws.join('+')} = ${p.total}`}</em> : null}
									{p.derived_from === 'north_opposite' ? <em className="horosa-geomancy-note-hint">取北交对宫</em> : null}
								</strong>
							</div>
						))}
					</div>
				) : null}
				{/* 亲缘三元:盘之生成即七组「父·父→子」,追某结论之来源即循此逐层上溯。
				    与黄道宫三方(火 1/5/9 等)是两回事,勿混。点某组即跳金字塔盘并高亮该组三节点与连线。 */}
				{(t.shield_triads || []).length ? (
					<div className="horosa-geomancy-triads">
						<div className="horosa-geomancy-triads-title">亲缘三元(父·父→子 · 七组)</div>
						{t.shield_triads.map((g, i)=>(
							<div className="horosa-geomancy-triad-row" key={i}
								{...pressable(()=>{ this.setCenterView('pyramid'); this.setState({ pyrSel: ['n0', 'n1', 'n2', 'n3', 'rw', 'lw', 'jd'][i] }); })}>
								<span className="horosa-geomancy-triad-label">{g.label}</span>
								<span className="horosa-geomancy-triad-expr">{(g.parents || []).map(fn).join(' ⊕ ')} = <strong>{fn(g.child)}</strong></span>
							</div>
						))}
					</div>
				) : null}
				<div className="horosa-geomancy-turn">
					<label className="horosa-geomancy-turn-field">
						<span>转宫(以某宫为新命宫)</span>
						<Select
							value={Number.isFinite(Number(this.state.turnTo)) ? Number(this.state.turnTo) : '__none__'}
							onChange={(v)=>this.setState({ turnTo: v === '__none__' ? null : Number(v) },
								()=>this.recastPinned())}
							dropdownMatchSelectWidth={false}
						>
							<Option value="__none__" key="__none__">不转(本命起)</Option>
							{HOUSE_LABEL.map((lb, i)=>(<Option value={i + 1} key={i + 1}>{`第 ${i + 1} 宫 · ${lb}`}</Option>))}
						</Select>
					</label>
					{d ? (
						<div className="horosa-geomancy-summary">
							<div className="horosa-geomancy-summary-row"><span>派生指示</span><strong>{`新命宫 ${d.derived_querent_house} → 所问宫 ${d.derived_quesited_house}`}</strong></div>
							<div className="horosa-geomancy-summary-row"><span>派生完美</span><strong>{PERF[d.perfection] || d.perfection}{d.perfection === 'none' && d.perfection_by_aspect ? `(借${ASP[d.perfection_by_aspect]}成局)` : ''}</strong></div>
							<div className="horosa-geomancy-summary-row"><span>派生相位</span><strong>{ASP[d.aspect] || d.aspect}</strong></div>
							{d.prohibition ? <div className="horosa-geomancy-summary-row"><span>派生阻碍</span><strong>{`第 ${d.prohibition} 宫`}</strong></div> : null}
							{d.figure ? <div className="horosa-geomancy-summary-row"><span>派生宫图</span><strong>{d.figure.nameZh || d.figure.nameEn}</strong></div> : null}
						</div>
					) : null}
				</div>
			</div>
		);
	},
};
