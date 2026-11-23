// 地占 AI 快照:取盘、快照正文与按字段无头起盘
// 从 GeomancyMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { postKentang } from '../../../services/kentangPost';
import { getKentangSavedCasePayload } from '../../../utils/kentangCaseSave';
import { paramsFromFields } from '../../../utils/divinationTimeDraft';
import { questionTypeText, PARITY_SCOPE_ZH, PERF_DIRECTION_ZH, PERF_CONJ_ZH, PERF_KNOWLEDGE_ZH, TONE_CLASS_ZH, COURT_JUDGE_SPECIAL_ZH, COURT_VERDICT_ZH, TRIANGLE_MEANINGS, VALIDITY_LABELS, VALIDITY_RULES_ZH, ELEMENT_ZH_BY_EN, TENANCY_GRADE_ZH, VIA_LINE_ZH, VIA_SIDE_ZH, ELEMENT_LEVEL_ZH, SUPPLY_ZH, SUCCESS_ZH, RECON_PARITY_ZH, QUADRANT_SYSTEM_ZH, QUESTION_TYPE_HOUSE } from './tables';

export function postGeomancy(path, payload){ return postKentang('geomancy', path, payload); }

function figureLine(fig, role){
	if(!fig){ return ''; }
	const parts = [fig.nameZh || fig.nameEn].filter(Boolean);
	if(fig.planetZh){ parts.push(`行星${fig.planetZh}`); }
	if(fig.elementZh){ parts.push(fig.elementZh); }
	if(fig.keywordsZh){ parts.push(fig.keywordsZh); }
	return `${role}：${parts.join(' · ')}`;
}

// 地占快照文本:问题/类型/上升 + 传本 + 判定(判官/调和者/见证) + 解读技法 + 十二宫图形入宫断语 + 十六图形。
export function buildGeomancySnapshotText(result){
	if(!result){ return '暂无地占数据'; }
	const reading = result.reading || {};
	const lines = [];
	if(result.aiPrompt){
		lines.push(result.aiPrompt.trim());
		lines.push('');
	}else{
		lines.push(`问题：${reading.question || '—'}`);
		lines.push(`问类：${questionTypeText(reading.questionTypeZh, reading.questionType)}`);
		lines.push(`上升图形：${(reading.ascendantFigure || {}).nameZh || ''}（上升星座 ${reading.ascendantSignZh || ''}）`);
		lines.push('');
	}
	// 传本(非默认才注记,供 AI 知本盘传本口径)
	const TRAD = { european_classical: '古典定局派', european_planetary: '行星共鸣派', european_modern: '现代综合派(同古典口径)', arabic_raml: '阿拉伯沙占派', india_ramal: '印度骰占派', sikidy: '异或表盘', hakata: '四片盘', ifa: '西非同族结构对照' };
	const tb = [];
	if(reading.profileId && reading.profileId !== 'european_classical'){ tb.push(`流派=${TRAD[reading.profileId] || reading.profileId}`); }
	if(reading.zodiacSystem === 'planetary'){ tb.push('黄道=行星归属体系'); }
	if(reading.zodiacSystem === 'planetary_alt'){ tb.push('黄道=行星归属·乙(另一传本对应表)'); }
	if(reading.readingScope && reading.readingScope !== 'L3'){ tb.push(`范围=${reading.readingScope}`); }
	// 传本逐项设置:仅注记与主流缺省不同者,免刷屏又不漏口径(AI 据此才知本盘按何法判读)。
	const gs = reading.settings || {};
	const GNAME = {
		house_projection: { sequential: '落星=不落(仅图形入宫)', astro_from_chart: '落星=占星甲(星落所主图之宫)', astro_bytwelves: '落星=占星乙(另起点数定宫)' },
		compound_mode: { reverse: '合成同伴=逆转法' },
		number_system: { planetary: '图数=行星序', abjad: '图数=字母值' },
		reconciler_mode: { judge_querent_significator: '调和者=判官⊕问者指示星' },
		mark_style: { lines: '记号=线形', bindu: '记号=点线', tablets: '记号=开合片' },
		direction: { RTL: '书写=自右向左' },
		// 传本对齐新增:图形入宫三式 / 上升三源 / 起卦诸法
		house_placement: { angular: '入宫=四正入宫(四果宫取合成卦)', golden_dawn: '入宫=近世学派置换' },
		asc_source: { fresh_points: '上升=另起四行点', judge_figure: '上升=取法官之图' },
		cast_method: { numbers: '起卦=报数(十六数奇偶定爻)', dice: '起卦=掷骰子', coins: '起卦=抛硬币',
			sand: '起卦=沙痕点点', tablets: '起卦=掷片' },
	};
	Object.keys(GNAME).forEach((k)=>{ const hit = GNAME[k][gs[k]]; if(hit){ tb.push(hit); } });
	if(gs.wrap_houses === true){ tb.push('宫位成环'); }
	if(gs.reconciler === false){ tb.push('不取调和者'); }
	if(gs.halt_enabled === false){ tb.push('不启用首母中止'); }
	if(gs.planetary_chart === true){ tb.push('另起行星地占盘'); }
	if(tb.length){ lines.push(`传本设置：${tb.join('、')}`); }
	// 结构对照模式:先申明边界,再不出任何地占判读(下游 AI 不得越界解读)。
	if(reading.structuralOnly){
		lines.push('');
		lines.push('[边界声明]');
		lines.push(reading.culturalNotice || '独立圣传体系,仅结构同构对照,不套地占含义、不构成占断。');
		const ifa = reading.ifa || {};
		if(ifa.label){
			lines.push(`结构对照：${ifa.label}${ifa.is_meji ? '(主形)' : ''};右列 ${(ifa.right || {}).odu_name || '—'}→${(ifa.right || {}).figure || '—'}、左列 ${(ifa.left || {}).odu_name || '—'}→${(ifa.left || {}).figure || '—'}(自右向左读)`);
		}
		lines.push('※ 本模式只作形的识别与比特对照,不产出该体系之占断,亦不套用地占含义。');
		return lines.join('\n');
	}
	lines.push('[判定]');
	// 首母中止警示(约 1/8 盘触发,后端早已算出而前端/AI 双盲):传统口径此占应中止另占。
	if(reading.haltedOnFirstMother){ lines.push('⚠ 首母中止：首母落 Rubeus/Cauda 之属,依所选传本传统应中止本占、另择时再占(以下判读仅作参考)。'); }
	// 时间流(传本口径):右证=过去、法官=现在、左证=未来。
	// ⚠️ 此前左证误标「现在」而法官无时间标 —— 与传本相左,已按传本改正。
	const j = figureLine(reading.judge, '判官(现在)');
	if(j){ lines.push(j); }
	const r = figureLine(reading.reconciler, '调和者(宣判/补卦)');
	if(r){ lines.push(r); }
	if(reading.rightWitness){ lines.push(figureLine(reading.rightWitness, '右证(过去/问者/事主)')); }
	if(reading.leftWitness){ lines.push(figureLine(reading.leftWitness, '左证(未来/所问/条件环境)')); }
	if(reading.primaryHouse){ lines.push(`主宫：第 ${reading.primaryHouse} 宫`); }
	// sikidy/hakata 流派中栏特有结论入快照(此前 AI 全盲):三道校验/红 Sikidy/诸侯列;四片开合/断语。
	if(reading.sikidy){
		const sk = reading.sikidy;
		lines.push(`异或表盘：三道校验${sk.valid ? '通过' : '未过'}${sk.red_sikidy ? '；红 Sikidy(大凶)' : ''}${Array.isArray(sk.princes) && sk.princes.length ? `；诸侯列:${sk.princes.join('、')}` : ''}`);
		// 列比对:本体系判事之正法(问者列与某主题列同形即事之所系),此前 AI 全盲。
		if(sk.compare && sk.columns){
			const hits = Object.keys(sk.compare).filter((k)=>sk.compare[k] && sk.compare[k].equal)
				.map((k)=>`第${k}列 ${(sk.columns[k] || {}).name || ''}(${(sk.columns[k] || {}).meaning || ''})`);
			lines.push(`列比对：问者列与${hits.length ? hits.join('、') + ' 同形 —— 事之所系在此' : '各主题列皆不同形,无直指之应'}`);
		}
	}
	if(reading.hakata){
		const hk = reading.hakata;
		const tb = (hk.tablets || []).map((t)=>`${t.name || ''}${t.open ? '开' : '合'}`).join(' ');
		lines.push(`四片盘：${tb || '—'} → ${hk.figure_zh || hk.figure || '—'}${hk.reading ? `；${hk.reading}` : ''}${hk.orientation ? `；${hk.orientation}` : ''}`);
	}
	// 解读技法(可计算)
	const t = reading.technique;
	if(t){
		lines.push('');
		lines.push('[解读技法]');
		const PERF = { occupation: '入主成局', conjunction: '会合成局', mutation: '互变成局', translation: '传递成局', none: '未成局' };
		const ASP = { conjunction: '合', sextile: '六分(吉)', square: '刑(凶)', trine: '拱(吉)', opposition: '冲', none: '无相位' };
		lines.push(`完美：${t.perfection && t.perfection !== 'none' ? PERF[t.perfection] : (t.perfection_by_aspect ? `借相位(${ASP[t.perfection_by_aspect]})成局` : '未成局')}`);
		lines.push(`相位：${ASP[t.aspect] || t.aspect}`);
		if(t.prohibition){ lines.push(`阻碍：第 ${t.prohibition} 宫强凶图阻断`); }
		if(t.points_parity){
			const pp = t.points_parity;
			lines.push(`点数是否：总 ${pp.total} 点·${pp.parity === 'even' ? '偶→是/稳' : '奇→否/动'}（取样 ${PARITY_SCOPE_ZH[pp.scope] || '全盘十六图'}${pp.degenerate ? '，该取样结构恒偶、不具判别力' : ''}）`);
		}
		if(t.timing){ lines.push(`应期：${t.timing.speed === 'fast' ? '速' : '迟'}·以「${t.timing.unit}」计`); }
		if(t.via_puncti){ lines.push(`点之路：${t.via_puncti.through ? '贯通' : '断于' + t.via_puncti.broken_at}`); }
		if(t.natural_cosignificator){ lines.push('自然共主：月亮'); }
		if((t.triplicities || []).length > 1){
			const TRI = { 1: '火', 5: '火', 9: '火', 2: '地', 6: '地', 10: '地',
				3: '风', 7: '风', 11: '风', 4: '水', 8: '水', 12: '水' };
			lines.push(`黄道宫三方：宫 ${t.triplicities.join('/')}（${TRI[t.triplicities[0]] || ''}三方）`);
		}
		// 数量:答「几件/几人/多少」一类问法(总点数三分)。
		if(t.timing && t.timing.quantity){
			const q = t.timing.quantity;
			lines.push(`数量：${q.label}(总 ${q.total} 点·域 ${q.min}–${q.max})`);
		}
		// 精准相位方向细则:联合之前后宫、传递之知晓格局、突变之场所线索
		const pdir = t.perfection_direction;
		if(pdir){
			(pdir.conjunctions_all || []).forEach((c)=>{
				lines.push(`联合方向：${c.mover === 'querent' ? '事主之图' : '对象之图'}现于第 ${c.house} 宫(${PERF_DIRECTION_ZH[c.direction] || ''}) —— ${PERF_CONJ_ZH[c.direction] || ''}`);
			});
			if(pdir.knowledge_code){ lines.push(`传递知晓：${PERF_KNOWLEDGE_ZH[pdir.knowledge_code]}`); }
			if(pdir.hint_code === 'venue_clue'){ lines.push('突变线索：两图所落之宫即完成之法与地之线索(偶然意外促成,非双方所想之完成方式)'); }
		}
	}
	// ── 传本对齐新增六段 ──
	if(t && t.court_verdict){
		const cv = t.court_verdict;
		lines.push('');
		lines.push('[法庭三角]');
		lines.push(`右证(过去/事主)：${cv.right.figure}(${TONE_CLASS_ZH[cv.right.tone_class]})`);
		lines.push(`法官(现在/总方向)：${cv.judge.figure}(${TONE_CLASS_ZH[cv.judge.tone_class]})`);
		lines.push(`左证(未来/条件环境)：${cv.left.figure}(${TONE_CLASS_ZH[cv.left.tone_class]})`);
		if(cv.judge_special){ lines.push(`法官特例：${COURT_JUDGE_SPECIAL_ZH[cv.judge_special]}`); }
		lines.push(`合断：${COURT_VERDICT_ZH[cv.verdict_code] || cv.verdict_code}${cv.listed ? '' : '(传本表未载此组合,当具体分析,不得臆造断语)'}`);
		lines.push('※ 论一段时间之吉凶则三等分:右证第一段、法官第二段、左证第三段。此三角与盾位十六宫含义角度不同,勿合用。');
		if((t.shield_triangles || []).length){
			lines.push('地占三角(四组·底二为补充、顶卦为概括之果):');
			t.shield_triangles.forEach((g)=>{
				lines.push(`  第${g.index}三角 ${g.base.map((b)=>b.figure).join(' ⊕ ')} → ${g.apex.figure}(${TONE_CLASS_ZH[g.apex.tone_class]})`
					+ `：近代传本作「${TRIANGLE_MEANINGS.recent[g.index - 1]}」;弗卢德古本作「${TRIANGLE_MEANINGS.renaissance[g.index - 1]}」`);
			});
		}
	}
	if(t && t.validity){
		lines.push('');
		lines.push('[有效性判断]');
		(t.validity.rules || []).forEach((x)=>{
			lines.push(`${VALIDITY_LABELS[x.id - 1]}：${x.hit ? (VALIDITY_RULES_ZH[x.code] || x.code) : '不成立'}${x.book_note ? `(${x.book_note})` : ''}`);
		});
		if(!t.validity.any_hit){ lines.push('※ 五则皆过,卦盘可判。'); }
	}
	if(t && (t.tenancy || []).length){
		lines.push('');
		lines.push('[盾面得地]');
		lines.push('| 位 | 图形 | 位元素 | 卦元素 | 档位 |');
		lines.push('| --- | --- | --- | --- | --- |');
		t.tenancy.forEach((x)=>{
			lines.push(`| ${x.position} ${x.label} | ${x.figure || '—'} | ${ELEMENT_ZH_BY_EN[x.position_element] || '—'} | ${ELEMENT_ZH_BY_EN[x.figure_element] || '—'} | ${x.grade ? (TENANCY_GRADE_ZH[x.grade] || {}).t : '—'} |`);
		});
		lines.push('※ 全同者最强(能全展此卦之力)、同温者辅助(目标随时而移)、同湿者停滞(有增长潜力须引外力)、全异者无力。');
	}
	if(t && (t.via_elements || t.element_supply)){
		lines.push('');
		lines.push('[元素与寻源]');
		const ve = t.via_elements || {};
		const es = (t.element_supply || {}).elements || {};
		['fire', 'air', 'water', 'earth'].forEach((k)=>{
			const L = VIA_LINE_ZH[k] || {};
			const b = ve[k] || {};
			const e = es[k] || {};
			const src = b.traceable
				? (b.through
					? `贯通至盾位${(b.terminus || {}).position}(${VIA_SIDE_ZH[(b.terminus || {}).side] || ''})`
					: `断于${b.broken_at}`)
				: '法官此行阴爻,不可由此寻源';
			lines.push(`${L.n}(${L.d})：${src}${e.active_count !== undefined ? `;女卦 ${e.figure} 阳爻 ${e.active_count} → ${ELEMENT_LEVEL_ZH[e.level] || ''}` : ''}${e.supply ? `;${SUPPLY_ZH[e.supply]}` : ''}`);
		});
		lines.push('※ 元素之有无、充沛与否皆非吉凶之判,须结合盾图综合考虑。');
	}
	if(t && (t.success || t.greek_points || t.reconciler_parity)){
		lines.push('');
		lines.push('[成败与福灵点]');
		if(t.success){
			const sc = t.success;
			lines.push(`成败：${sc.has_perfection ? '有精准相位 → 事将发生' : '无精准相位 → 事不发生'};事主${TONE_CLASS_ZH[sc.querent_tone]}·对象${TONE_CLASS_ZH[sc.quesited_tone]} → ${SUCCESS_ZH[sc.code] || sc.code}`);
			lines.push(`※ ${sc.caveat}`);
		}
		if(t.greek_points){
			const gp = t.greek_points;
			lines.push(`福点：第 ${gp.fortune_house} 宫(十二卦点数和 ${gp.fortune_total} 除十二取余) —— 好运所在、身体健康、财富、事业成败、心理素质`);
			lines.push(`灵点：第 ${gp.spirit_house} 宫(十二卦阳爻数和 ${gp.spirit_total} 除十二取余) —— 意志、梦想、希望、追求、欲望、幻想`);
		}
		if(t.reconciler_parity){
			const rp = t.reconciler_parity;
			lines.push(`宣判(补卦)：${rp.figure}·${rp.points} 点·${RECON_PARITY_ZH[rp.code] || rp.code}(据传本对应系统之奇偶主客观义推得)`);
		}
	}
	if(reading.planetaryChart){
		const pc = reading.planetaryChart;
		lines.push('');
		lines.push('[行星地占盘]');
		lines.push(`上升：${pc.asc_sign_zh}(首图 ${pc.first_figure} 定上升,顺序排列黄道十二宫;星座表=${pc.zodiac_table === 'planetary_alt' ? '另一传本对应表' : '古典行星地占表'})`);
		lines.push('| 星 | 落宫 | 报数 |');
		lines.push('| --- | --- | --- |');
		[].concat(pc.planets || [],
			pc.nodes ? [pc.nodes.north, pc.nodes.south] : [],
			pc.extras || []).forEach((p)=>{
			lines.push(`| ${p.planet_zh || p.planet} | 第 ${p.house} 宫 | ${p.draws ? `${p.draws.join('+')}=${p.total}` : '取北交对宫'} |`);
		});
		lines.push('※ 此盘与盾面「占星定局落星」正交:本盘自成一盘,宫中并无盾面图形。');
	}
	// 转宫派生:以某宫为新命宫重算(问他人之事/事中之事时,此为正解所依)。
	if(reading.derived){
		const d = reading.derived;
		const PERF2 = { occupation: '入主成局', conjunction: '会合成局', mutation: '互变成局', translation: '传递成局', none: '未成局' };
		lines.push('');
		lines.push('[转宫派生]');
		lines.push(`以第 ${d.turn_to} 宫为新命宫：新命宫 ${d.derived_querent_house} → 所问宫 ${d.derived_quesited_house}`);
		lines.push(`派生完美：${PERF2[d.perfection] || d.perfection}${d.prohibition ? `；派生阻碍在第 ${d.prohibition} 宫` : ''}`);
		if(d.figure){ lines.push(`派生宫图：${d.figure.nameZh || d.figure.nameEn || '—'}`); }
	}
	// 占星定局落星:甲=星落其所主图之宫(可缺可多现,本法固有);乙=另起点数定宫(每星必有且仅一宫)。
	const PZH = { Sun: '日', Moon: '月', Mercury: '水', Venus: '金', Mars: '火', Jupiter: '木', Saturn: '土', NorthNode: '龙头', SouthNode: '龙尾' };
	const ppA = reading.planetPlacement || {};
    const ppAKeys = Object.keys(ppA).filter((k)=>(ppA[k] || []).length);
	if(ppAKeys.length){
		lines.push('');
		lines.push('[定局落星·甲]');
		lines.push(ppAKeys.map((k)=>`${PZH[k] || k}→${(ppA[k] || []).map((h)=>`${h}宫`).join('/')}`).join('；'));
		const absent = Object.keys(ppA).filter((k)=>!(ppA[k] || []).length).map((k)=>PZH[k] || k);
		if(absent.length){ lines.push(`（缺席：${absent.join('、')} —— 星所主之图未入盘,乃本法固有,非算漏）`); }
	}
	if(reading.planetPlacementByTwelves){
		const b = reading.planetPlacementByTwelves;
		lines.push('');
		lines.push('[定局落星·乙]');
		lines.push(Object.keys(b).map((k)=>`${PZH[k] || k}→${b[k]}宫`).join('；'));
	}
	// 丁:真实星历落星 —— 各体按其真实黄经落宫。此段只在用户选了该档且时地俱备时才有,
	// 故未启用者快照逐字不变。⚠️ 必须同时交代此式非传本之法,免得模型把它当传本口径引用。
	if(reading.planetPlacementReal){
		const c = reading.planetPlacementReal;
		const rc = reading.realChart || {};
		const er = reading.astroErection || {};
		lines.push('');
		lines.push('[定局落星·真实星历]');
		lines.push(`按所问之时地起真实星历盘：上升 ${er.sign_zh || '—'}${
			typeof er.asc_deg_in_sign === 'number' ? ` ${er.asc_deg_in_sign.toFixed(2)}°` : ''
		}${typeof rc.mc_lon === 'number' ? `；中天黄经 ${rc.mc_lon.toFixed(2)}°` : ''}${
			rc.quadrant_system ? `；象限分宫用${QUADRANT_SYSTEM_ZH[rc.quadrant_system] || rc.quadrant_system}` : '；整宫制'
		}`);
		lines.push(Object.keys(c).map((k)=>`${PZH[k] || k}→${c[k]}宫`).join('；'));
		lines.push('※ 此式非传本之法：传本盘式之上升取自图形、不起真实星盘,此为本软件另备之可选第四式,'
			+ '引用时须与传本口径分辨清楚。');
	}
	// 用户选了真实星历而时地不全者,如实写明已回落 —— 不写则模型会以为盘真按时地起。
	if((reading.settings || {}).real_chart_requested && (reading.settings || {}).real_chart_available === false){
		lines.push('');
		lines.push('※ 已选「据所选时地起真实上升」或「真实星历落星」,然时地不全(须日期与经纬俱备)或星历不可用,'
			+ '本盘已如实回落图形取法,勿按真实星盘解读。');
	}
	// 图数(非点数体系时注记,供择时/寻隐一类专门占法)
	if(reading.judge && reading.judge.number && reading.judge.number.system !== 'points'){
		const n = reading.judge.number;
		lines.push(`判官之数：${n.value}（${n.basis || n.system}）`);
	}
	// 十二宫:图形入宫 + 192 断语
	const houses = reading.houses || [];
	if(houses.length){
		lines.push('');
		// 印度派多一列宫位之该支名 —— AI 口径已承诺给出,不给就是让模型据不存在的字段臆造。
		const isIndia = reading.profileId === 'india_ramal';
		lines.push('[十二宫·图形入宫]');
		lines.push(isIndia ? '| 宫 | 宫名 | 支名 | 角色 | 图形 | 曜 | 断语 |' : '| 宫 | 宫名 | 角色 | 图形 | 断语 |');
		lines.push(isIndia ? '| --- | --- | --- | --- | --- | --- | --- |' : '| --- | --- | --- | --- | --- |');
		houses.forEach((h)=>{
			const fig = h.figure || {};
			const role = (h.roles || []).indexOf('quesited') >= 0 ? '【所问】' : ((h.roles || []).indexOf('querent') >= 0 ? '【问者】' : '');
			if(isIndia){
				const bh = h.bhava ? `${h.bhava}(${h.bhavaZh || ''})` : '—';
				const gr = ((fig.vedic || {}).graha_zh) || '—';
				lines.push(`| 第${h.house}宫 | ${h.nameZh || '—'} | ${bh} | ${role || '—'} | ${fig.nameZh || fig.nameEn || '—'} | ${gr} | ${h.reading || '—'} |`);
			}else{
				lines.push(`| 第${h.house}宫 | ${h.nameZh || '—'} | ${role || '—'} | ${fig.nameZh || fig.nameEn || '—'} | ${h.reading || '—'} |`);
			}
		});
	}
	const figs = reading.figures16 || [];
	if(figs.length){
		lines.push('');
		lines.push('[十六图形]');
		const slot = ['母一', '母二', '母三', '母四', '女一', '女二', '女三', '女四', '甥一', '甥二', '甥三', '甥四', '右证', '左证', '判官', '调和'];
		lines.push('| 位 | 图形 | 行星 | 元素 |');
		lines.push('| --- | --- | --- | --- |');
		figs.forEach((f, i)=>{
			lines.push(`| ${slot[i] || `图${i + 1}`} | ${f.nameZh || f.nameEn} | ${f.planetZh || '—'} | ${f.elementZh || '—'} |`);
		});
	}
	// [图形释义] doctrine 段(默认关段:builder 恒产,导出层按设置控)：与右栏「十六图形」renderFigureCatalog 同源
	// result.figures(16 图形完整象意库,含逐域断语 meanings);象意原文零改写;无目录数据不产段。
	const catalog = Array.isArray(result.figures) ? result.figures : [];
	if(catalog.length){
		lines.push('');
		lines.push('[图形释义]');
		const TONE_ZH = { good: '吉', bad: '凶', neutral: '中' };
		catalog.forEach((f)=>{
			const tone = TONE_ZH[f.tone] || '';
			const alt = f.displayName || f.nameEn;   // 名表体系选定之名(拉丁档即拉丁名 → 快照默认零变)
			lines.push(`◆ ${f.nameZh || f.latin || f.nameEn}${tone ? `（${tone}）` : ''}${alt ? ` ${alt}` : ''}${f.points ? ` · ${f.points}点` : ''}`);
			const attrLine = [f.planetZh, f.elementZh, f.signZh].filter(Boolean).join(' · ');
			if(attrLine){ lines.push(attrLine); }
			const bodyLine = [f.elementOuterZh ? `外元素${f.elementOuterZh}` : '', f.bodyPart ? `身体${f.bodyPart}` : '', f.color || ''].filter(Boolean).join(' · ');
			if(bodyLine){ lines.push(bodyLine); }
			if(f.keywordsZh){ lines.push(`象意：${f.keywordsZh}`); }
			if(f.meanings){
				const domainText = Object.keys(f.meanings)
					.filter((k)=>k !== 'name_zh' && k !== 'tone')
					.map((k)=>`${k}：${f.meanings[k]}`)
					.join('；');
				if(domainText){ lines.push(domainText); }
			}
			const altLine = [f.nameArabic ? `阿:${f.nameArabic}` : '', f.nameGreek ? `希:${f.nameGreek}` : '', f.nameHebrew ? `伯:${f.nameHebrew}` : ''].filter(Boolean).join('　');
			if(altLine){ lines.push(altLine); }
		});
	}
	return lines.join('\n').trim();
}

// AI 挂载:地占为 case 型(无生时),按已保存 case 的问题/种子复算,得不到则空。
export async function buildGeomancySnapshotForFields(fields, opts){
	try{
		const o = opts || {};
		let question = o.question;
		let questionType = o.questionType;
		let quesitedHouse = o.quesitedHouse;
		let seedMode = o.seedMode;
		let seed = o.seed;
		let tradition = o.tradition;
		let readingScope = o.readingScope;
		let zodiacSystem = o.zodiacSystem;
		let granular = o.granular;
		let turnTo = o.turnTo;
		// 传本对齐:图形入宫(齿轮可选)/报数所报之数/行星地占盘四键亦须随档复算,否则 AI 复算出的盘与界面两样
		let housePlacement = o.housePlacement;
		let castNumbers = o.castNumbers;
		let planetaryChart = o.planetaryChart;
		let planetaryChartZodiac = o.planetaryChartZodiac;
		let planetaryChartNodes = o.planetaryChartNodes;
		let planetaryChartExtras = o.planetaryChartExtras;
		// 无头挂载(noPageFallback)只认被挂载记录自身的问占参数;缺问句=该档不可复算 → ''(missing),
		// 绝不回落「页面当前载入的地占事盘」(与塔罗 T-1 同病同修:否则挂 A 记录读到 B 的盘=张冠李戴)。页面自身导出路径仍可兜底。
		if((question === undefined || question === null) && !o.noPageFallback){
			const saved = getKentangSavedCasePayload('geomancy');
			const so = saved && saved.payload && saved.payload.options ? saved.payload.options : null;
			if(so){
				question = so.question; questionType = so.questionType;
				seedMode = so.seedMode; seed = so.seed;
				tradition = so.tradition; readingScope = so.readingScope; zodiacSystem = so.zodiacSystem;
				granular = so.granular; turnTo = so.turnTo;
				if(quesitedHouse === undefined || quesitedHouse === null){ quesitedHouse = so.quesitedHouse; }
				if(housePlacement === undefined){ housePlacement = so.housePlacement; }
				castNumbers = so.castNumbers;
				if(planetaryChart === undefined){ planetaryChart = so.planetaryChart; }
				if(planetaryChartZodiac === undefined){ planetaryChartZodiac = so.planetaryChartZodiac; }
				if(planetaryChartNodes === undefined){ planetaryChartNodes = so.planetaryChartNodes; }
				if(planetaryChartExtras === undefined){ planetaryChartExtras = so.planetaryChartExtras; }
			}
		}
		if(question === undefined || question === null){ return ''; }
		const payload = {
			question: question || '',
			questionType: questionType || 'custom',
			// 四本账:所问宫是判读主宫,不随存随取则 AI 复算出的是问类预设宫,与用户所见两样
			quesitedHouse: Number(quesitedHouse) || QUESTION_TYPE_HOUSE[questionType || 'custom'] || 1,
			seedMode: (seedMode === 'manual' && (seed || seed === 0)) ? 'manual' : (seedMode || 'random'),
			tradition: tradition || 'european_classical',
			readingScope: readingScope || 'L3',
			zodiacSystem: zodiacSystem || 'classical',
		};
		// 🔴 时地必须与主起盘路径同发:上升取法「据所选时地起真实上升」或落星法「真实星历」之下,
		//    盘由时地定 —— 复算侧不发时地,则内核以为无时地而如实回落图形取法,
		//    于是 AI 读到的定局与用户界面所见**两样**(界面按真实时地起,AI 却是一宫之图)。
		//    fields 来自存档记录(aiAnalysisContext 以 buildFieldObject(record) 造),故复算得的是存盘那一刻之时地。
		const gp = paramsFromFields(fields);
		if(gp){
			payload.date = gp.date; payload.time = gp.time; payload.zone = gp.zone;
			payload.lon = gp.lon; payload.lat = gp.lat;
			// ad 只在纪元前(-1)才发:如此则公元后之请求体与本次改动前逐字节相同
			if(Number(gp.ad) === -1){ payload.ad = -1; }
		}
		// 🔴 四本账:传本逐项改写与转宫也须随存随取,否则复算出来的是流派默认盘,
		//    与用户存盘时所见不符(AI 挂载据此复算,不带则 AI 看到的与界面两样)。
		Object.keys(granular || {}).forEach((k)=>{
			const v = granular[k];
			if(v !== null && v !== undefined){ payload[k] = v; }
		});
		if(Number.isFinite(Number(turnTo))){ payload.turnTo = Number(turnTo); }
		// 传本对齐:入宫式(齿轮档优先于 granular)/报数/行星地占盘四键
		if(housePlacement){ payload.housePlacement = housePlacement; }
		if(Array.isArray(castNumbers) && castNumbers.length === 16){
			payload.castMethod = 'numbers';
			payload.castNumbers = castNumbers;
			payload.seedMode = 'manual';
		}
		if(planetaryChart){
			payload.planetaryChart = true;
			payload.planetaryChartZodiac = planetaryChartZodiac || 'classical';
			if(planetaryChartNodes){ payload.planetaryChartNodes = true; }
			if(planetaryChartExtras){ payload.planetaryChartExtras = true; }
		}
		if(payload.seedMode === 'manual'){ payload.seed = seed || 0; }
		const result = await postGeomancy('reading', payload);
		return buildGeomancySnapshotText(result);
	}catch(e){ return ''; }
}
