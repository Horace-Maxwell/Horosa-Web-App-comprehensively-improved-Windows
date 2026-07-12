// [印占 v2 表化 · 证明基线] buildJyotishSnapshotLines 的「改前」版本(git show HEAD:src/components/astro/IndiaChart.js)。
// 逐字提取自表化改动前的实现,仅:(1) 去纯注释行,(2) 函数名加 Baseline 后缀避免与现行同名。
// 用途:astroIndiaV2FactEquivalence.test.js 以此为「值零丢失」基准,与现行表化输出做 fact 等价比对。切勿手改。
export function buildJyotishSnapshotLinesBaseline(chartObj){
	const j = chartObj && chartObj.jyotish;
	if(!j){ return {}; }
	const fx = (x, d)=>(typeof x === 'number' && Number.isFinite(x)) ? x.toFixed(d) : (x !== undefined && x !== null ? `${x}` : '—');
	const lordOf = (l)=>(l && (l.label || l.key)) || '—';
	const out = {};

	const p = j.panchanga;
	if(p){
		const pl = [];
		if(p.vara){ pl.push(`星期(Vara)：${p.vara.label || p.vara.name || '—'}（主 ${lordOf(p.vara.lord)}）`); }
		if(p.tithi){ pl.push(`月相(Tithi)：${`${p.tithi.paksha || ''} ${p.tithi.name || ''}`.trim() || '—'}（第 ${p.tithi.index} 日）`); }
		if(p.nakshatra){
			pl.push(`月宿(Nakshatra)：${p.nakshatra.label || p.nakshatra.name || p.nakshatra.key || '—'}`);
			const nd = p.nakshatra.detail;
			if(nd){
				const bits = [];
				if(nd.deity){ bits.push(`司神 ${nd.deity}`); }
				if(nd.symbol){ bits.push(`象征 ${nd.symbol}`); }
				if(nd.gana){ bits.push(`族类 ${nd.gana}`); }
				if(nd.yoniAnimal){ bits.push(`瑜尼 ${nd.yoniAnimal}`); }
				if(nd.gunas){ bits.push(`三德 ${nd.gunas}`); }
				if(nd.purushartha){ bits.push(`人生目标 ${nd.purushartha}`); }
				if(bits.length){ pl.push(`　月宿详情：${bits.join('·')}`); }
			}
		}
		if(p.yoga){ pl.push(`瑜伽(Yoga)：${p.yoga.name || '—'}`); }
		if(p.karana){ pl.push(`半日(Karana)：${(p.karana.name || p.karana.label) || '—'}`); }
		if(pl.length){ out['Panchanga 五要素'] = pl; }
	}

	const ck = j.jaimini && j.jaimini.charaKarakas;
	if(Array.isArray(ck) && ck.length){
		out['卡拉卡（8 Chara Karakas）'] = ck.map((k)=>(
			`${k.karakaLabel || ''} ${k.karaka || ''}：${k.label || k.planet}（${k.signLabel || k.sign} ${fx(k.signlon, 2)}°，用度 ${fx(k.karakaDegree, 2)}°）`
		));
	}

	const nd = j.nodeRasiDrishti;
	if(Array.isArray(nd) && nd.length){
		out['节点主照（Rasi Drishti）'] = nd.map((d)=>`${d.giverLabel || d.giver} → ${d.targetSignLabel || d.targetSign}`);
	}

	const ps = j.strengths && j.strengths.planetaryStates;
	if(Array.isArray(ps) && ps.length){
		out['星曜状态'] = ps.map((s)=>{
			const flags = [];
			if(s.vargottama){ flags.push('Vargottama'); }
			if(s.retrograde){ flags.push('逆行'); }
			if(s.combust){ flags.push('燃烧'); }
			const baladi = s.baladi ? `·${s.baladi.label}` : '';
			const nak = s.nakshatra ? `·${s.nakshatra.name}P${s.nakshatra.pada}` : '';
			const lajj = Array.isArray(s.lajjitadi) && s.lajjitadi.length ? `·态[${s.lajjitadi.map((la)=>la.label).join('')}]` : '';
			return `${s.label}：${s.signLabel || s.sign} ${fx(s.signlon, 1)}°·宫${s.house || '—'}·${s.dignity}${baladi}${lajj}${nak}${flags.length ? '·' + flags.join('/') : ''}`;
		});
	}

	const vd = j.strengths && j.strengths.vargaDignity;
	if(Array.isArray(vd) && vd.length){
		out['分盘吉位 Vimśopaka'] = vd.map((row)=>{
			const a = row.amsa || {};
			const parts = [];
			const grp = (label, g)=>{ const x = a[g]; if(x && x.count){ parts.push(`${label}${x.count}${x.amsa ? '·' + x.amsa : ''}`); } };
			grp('六', 'shadvarga'); grp('七', 'saptavarga'); grp('十', 'dasavarga'); grp('十六', 'shodasavarga');
			return `${row.label}（本盘${row.d1}）：${parts.length ? parts.join(' ') : '无连座吉位'}`;
		});
	}

	const av = j.ashtakavarga;
	if(av && av.available && Array.isArray(av.sarvaBySign)){
		const total = av.sarvaBySign.reduce((s, x)=>s + (x.bindu || 0), 0);
		out['八分点 SAV'] = [
			`总点数 ${total}（标准 337）`,
			'| 星座 | 分值 |',
			'| --- | --- |',
			...av.sarvaBySign.map((x)=>`| ${x.label} | ${x.bindu} |`),
		];
	}

	if(av && av.sodhyaPinda){
		const PCN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土' };
		const spLines = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']
			.filter((p)=>av.sodhyaPinda[p])
			.map((p)=>`${PCN[p]}：${av.sodhyaPinda[p].total}（座${av.sodhyaPinda[p].rasiPinda}+曜${av.sodhyaPinda[p].grahaPinda}）`);
		if(spLines.length){ out['Sodhya Pinda 凝量'] = spLines; }
	}

	const sb = j.shadbala && j.shadbala.planets;
	if(Array.isArray(sb) && sb.length){
		out['Shadbala 六力'] = [
			'| 星曜 | 总力 |',
			'| --- | --- |',
			...sb.map((x)=>`| ${x.label} | ${fx(x.totalRupa, 2)} Rupa |`),
		];
		const ik = sb.filter((x)=>x.ishta !== undefined && x.ishta !== null);
		if(ik.length){
			out['Ishta/Kashta 吉凶果'] = ik.map((x)=>`${x.label}：吉果 ${fx(x.ishta, 1)} / 凶果 ${fx(x.kashta, 1)}（出曜力 ${fx(x.uchchaBala, 1)}）`);
		}
	}

	const bphsAll = j.shadbalaBphs;
	if(bphsAll){
		const PCN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土' };
		const vpLines = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']
			.filter((p)=>bphsAll[p] && bphsAll[p].vimsopaka)
			.map((p)=>{ const v = bphsAll[p].vimsopaka; return `${PCN[p]}：六${v.shadvarga.total}/七${v.saptavarga.total}/十${v.dasavarga.total}/十六${v.shodasavarga.total}`; });
		if(vpLines.length){ out['Vimśopaka 分盘 20 分力'] = vpLines; }
	}

	const mu = j.muhurta;
	if(mu && mu.horaTable && Array.isArray(mu.horaTable.rows) && mu.horaTable.rows.length){
		const fmt = (s)=>{ const m = String(s || '').match(/(\d{1,2}:\d{2})/); return m ? m[1] : (s || '—'); };
		out['Hora 行星时'] = mu.horaTable.rows.map((r)=>`${r.index}.${r.lordCN || r.lord} ${fmt(r.start)}`);
	}

	if(mu && mu.choghadia && Array.isArray(mu.choghadia.rows) && mu.choghadia.rows.length){
		const fmt = (s)=>{ const m = String(s || '').match(/(\d{1,2}:\d{2})/); return m ? m[1] : (s || '—'); };
		const NAT = { good: '吉', bad: '凶' };
		out['Choghadia 民用择时'] = mu.choghadia.rows.map((r)=>`${r.period === 'day' ? '昼' : '夜'}${r.index}.${r.cn}(${NAT[r.nature] || ''}) ${fmt(r.start)}`);
	}

	if(mu && (mu.panchaka || mu.abhijit)){
		const lines = [];
		if(mu.panchaka){ lines.push(`Panchaka：${mu.panchaka.typeLabel}（余${mu.panchaka.remainder}，${mu.panchaka.isPanchaka ? '忌' : '吉'}）`); }
		if(mu.abhijit){ lines.push(`Abhijit：第 8 昼须臾${mu.abhijit.auspicious ? '·大吉' : '·周三不取'}`); }
		out['择时 Panchaka/Abhijit'] = lines;
	}

	const mula = j.dasha && j.dasha.mula;
	if(mula && mula.available && Array.isArray(mula.mahadashas) && mula.mahadashas.length){
		out['Mūla 大运'] = mula.mahadashas.filter((m)=>m.round === 1)
			.map((m)=>`${m.planetCN}（宫${m.house}）${m.years}年`);
	}

	const sudc = j.dasha && j.dasha.sudarshanaChakra;
	if(sudc && sudc.available && Array.isArray(sudc.rows)){
		const cur = sudc.rows.find((r)=>r.current);
		const lines = sudc.rows.map((r)=>`年${r.year}${r.current ? '◀' : ''}：日${r.slLabel}/月${r.clLabel}/升${r.jlLabel}`);
		if(cur){ lines.unshift(`当前年${cur.year}：日轮${cur.slLabel}·月轮${cur.clLabel}·升轮${cur.jlLabel}（三处并读,全合最强）`); }
		out['Sudarśana Chakra 大运'] = lines;
	}

	const naisargika = j.dasha && j.dasha.naisargika;
	if(naisargika && naisargika.available && Array.isArray(naisargika.periods) && naisargika.periods.length){
		out['Naisargika 自然大运'] = naisargika.periods.map((p)=>`${p.planetCN} ${p.years}年（${p.startAge}–${p.endAge}岁）${p.start || ''}→${p.end || ''}`);
	}

	const supL = j.supplementaryLagnas;
	if(supL && supL.available){
		const items = [supL.chandraLagna, supL.paakaLagna, supL.karakamsa, supL.swamsa, supL.induLagna, supL.varnadaLagna].filter((x)=>x && x.sign);
		if(items.length){
			out['补充上升（Supplementary Lagnas）'] = items.map((it)=>`${it.label}：${it.signLabel || it.sign}${it.key === 'induLagna' && it.sumKala ? `（Kala和 ${it.sumKala}·第${it.stepS}座）` : (it.key === 'varnadaLagna' && it.step ? `（A${it.countLagna}/B${it.countHora}·N${it.step}）` : '')}`);
		}
	}

	const nadi = j.nadi;
	if(nadi && nadi.available && nadi.bhriguBindu){
		const bb = nadi.bhriguBindu;
		const nk = bb.nakshatra || {};
		out['Nāḍī · Bhrigu Bindu 福点'] = [`${bb.signLabel || bb.sign}${nk.name ? '·' + nk.name + (nk.pada ? 'P' + nk.pada : '') : ''}（黄经 ${(+bb.lon).toFixed(2)}°）`];
	}
	if(nadi && nadi.available && nadi.d150 && nadi.d150.length){
		const PCN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土', Rahu: '罗', Ketu: '计', 'North Node': '罗', 'South Node': '计' };
		out['Nāḍī · D150 纳地盘'] = nadi.d150.map((x)=>`${PCN[x.planet] || x.planet}：第${x.nadiamsa}/150·${x.signLabel || x.sign}`);
	}

	const ayu = j.ayurdaya;
	if(ayu && ayu.available && ayu.pindayu){
		const lines = [`基础 Piṇḍāyu：${ayu.pindayu.baseYears} 年（未施 haraṇa 减）`];
		(ayu.pindayu.contributions || []).forEach((c)=>{ lines.push(`${c.planetCN}：满${c.fullYears} → ${c.years} 年`); });
		if(ayu.nisargayu){ lines.push(`Nisargāyu 自然寿表 120 年（${(ayu.nisargayu.naturalYears || []).map((n)=>n.planetCN + n.years).join(' ')}）`); }
		if(ayu.amsayu){ lines.push(`Aṁśāyu（÷200·Bharaṇa）基础 ${ayu.amsayu.baseYears} 年（${(ayu.amsayu.contributions || []).map((c)=>c.planetCN + c.years + (c.multiplier > 1 ? '×' + c.multiplier : '')).join(' ')}）`); }
		if(ayu.harana && ayu.harana.available && Array.isArray(ayu.harana.profiles)){
			ayu.harana.profiles.forEach((p)=>{ lines.push(`haraṇa·${p.label}：${p.solarYears} 太阳年`); });
			if(ayu.haranaNisarga && Array.isArray(ayu.haranaNisarga.profiles)){
				ayu.haranaNisarga.profiles.forEach((p)=>{ lines.push(`Nisargāyu haraṇa·${p.label}：${p.solarYears} 太阳年`); });
			}
			if(ayu.amsayu && Array.isArray(ayu.amsayu.bharanaVariants)){
				lines.push('Aṁśāyu Bharaṇa 流派：' + ayu.amsayu.bharanaVariants.map((v)=>`${v.label.replace(/（[^）]*）/, '')}${v.baseYears}`).join(' · '));
			}
			const kr = ayu.harana.krurodaya;
			if(kr && kr.applies){ lines.push(`Krurodaya ${kr.planetCN} 升 Lagna${kr.mitigated ? '（吉星望减半）' : ''}：式A −${kr.formulaA}`); }
		}
		out['Āyurdāya 寿命基础'] = lines;
	}

	const upagrahaObj = j.upagraha;
	const splag = upagrahaObj && upagrahaObj.specialLagnas;
	if(splag){
		const SPLSIGN = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];
		const flag = (l)=>{ const v = (((l % 360) + 360) % 360); return `${SPLSIGN[Math.floor(v / 30)]} ${(v % 30).toFixed(1)}°`; };
		const splLines = [];
		['bhavaLagna','horaLagna','ghatikaLagna','sreeLagna'].forEach((k)=>{ if(splag[k]){ splLines.push(`${splag[k].label}：${flag(splag[k].lon)}`); } });
		if(splag.pranapada){
			splLines.push(`Praṇapada·日出太阳(BPHS)：${flag(splag.pranapada.variantSunrise)}`);
			if(splag.pranapada.variantBirth !== undefined){ splLines.push(`Praṇapada·出生太阳(PyJHora)：${flag(splag.pranapada.variantBirth)}`); }
		}
		if(splLines.length){ out['特殊上升 Special Lagnas'] = splLines; }
	}

	const shashti = j.shashtiamsa;
	if(shashti && shashti.available && shashti.planets && shashti.planets.length){
		const SPCN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土', Rahu: '罗', Ketu: '计', 'North Node': '罗', 'South Node': '计' };
		out['D60 六十分盘吉凶'] = shashti.planets.map((x)=>`${SPCN[x.planet] || x.planet}：第${x.segment}/60·${x.signLabel || x.sign}·${x.nature === 'malefic' ? '凶' : '吉'}`)
			.concat([`合计 吉${shashti.beneficCount}·凶${shashti.maleficCount}`]);
	}

	const vargaVar = j.vargaVariants;
	if(vargaVar && vargaVar.available && Array.isArray(vargaVar.charts)){
		const VPCN = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土', Rahu: '罗', Ketu: '计', 'North Node': '罗', 'South Node': '计' };
		const lines = [];
		vargaVar.charts.forEach((ch)=>{
			const diff = (ch.planets || []).filter((r)=>r.differs);
			if(!diff.length){ return; }
			lines.push(`${ch.label}（${ch.variants.map((v)=>v.label).join('/')}）：${diff.map((r)=>`${VPCN[r.planet] || r.planet}${r.cells.map((c)=>c.signLabel).join('→')}`).join('，')}`);
		});
		if(lines.length){ out['分盘变体对照'] = lines; }
	}

	const fn = j.functionalNature && j.functionalNature.grahas;
	if(Array.isArray(fn) && fn.length){
		const FN_CN = { benefic: '功能吉', malefic: '功能凶', neutral: '功能中', yogakaraka: '瑜伽点', maraka: '马拉卡' };
		out['功能吉凶（Functional Nature）'] = fn.map((g)=>{
			const tags = [];
			if(g.isYogakaraka){ tags.push('Yogakaraka'); }
			if(g.isMaraka){ tags.push('Maraka'); }
			if(g.isBadhaka){ tags.push('Badhaka'); }
			const ruled = Array.isArray(g.housesRuled) && g.housesRuled.length ? `主${g.housesRuled.join('/')}宫` : '';
			return `${g.planetLabel || g.planet}：${FN_CN[g.functionalNature] || g.functionalNature}${ruled ? '·' + ruled : ''}${tags.length ? '·' + tags.join('/') : ''}`;
		});
	}

	const bb = j.bhavaBala;
	if(bb && bb.available && Array.isArray(bb.houses) && bb.houses.length){
		const bl = [
			'| 宫位 | 力量 | 名次 |',
			'| --- | --- | --- |',
			...bb.houses.map((h)=>`| 第${h.house}宫 | ${fx(h.rupas, 2)} Rupa | ${h.rank} |`),
		];
		if(bb.strongest){ bl.push(`最强宫：第 ${bb.strongest} 宫`); }
		if(bb.weakest){ bl.push(`最弱宫：第 ${bb.weakest} 宫`); }
		out['宫位力（Bhava Bala）'] = bl;
	}

	const gy = j.grahaYuddha;
	if(gy && gy.available && Array.isArray(gy.pairs) && gy.pairs.length){
		out['星曜战（Graha Yuddha）'] = gy.pairs.map((pr)=>(
			`${(pr.winnerLabel || pr.winner)} 胜 ${(pr.loserLabel || pr.loser)}（相距 ${fx(pr.sepDeg, 2)}°）`
		));
	}

	const ed = j.extendedDashas;
	if(ed){
		const el = [];
		const cond = ed.conditional || {};
		Object.keys(cond).forEach((key)=>{
			const c = cond[key];
			if(!c){ return; }
			const fl = c.firstLord ? (c.firstLord.label || c.firstLord.key) : '—';
			el.push(`${c.label || key}（${c.totalYears || '?'} 年）：${c.available ? '条件满足·启用' : '条件未满足·仅备览'}，首主星 ${fl}`);
		});
		if(ed.chara && Array.isArray(ed.chara.mahadashas) && ed.chara.mahadashas.length){
			const first = ed.chara.mahadashas[0];
			el.push(`Chara（耆那 ${ed.chara.seedLabel || ed.chara.seed} 起·${ed.chara.direction === 'reverse' ? '逆' : '顺'}行）：首运 ${first.rasiLabel || first.rasi}（${first.years} 年）`);
		}
		if(el.length){ out['扩展大运（Conditional / Chara）'] = el; }
	}

	const kt = j.kartari;
	if(kt && kt.available && Array.isArray(kt.yogas) && kt.yogas.length){
		out['Kartari 夹击格局'] = kt.yogas.map((y)=>`${y.targetLabel}：${y.typeLabel}（${(y.prevLabels || []).join('')} 夹 ${(y.nextLabels || []).join('')}）`);
	}
	const sdc = j.sudarshana;
	if(sdc && sdc.available && Array.isArray(sdc.rows) && sdc.rows.length){
		out['Sudarshana 三盘（命/日/月起）'] = sdc.rows.map((r)=>`${r.planetLabel}：命第${r.houseFromLagna}宫 · 日第${r.houseFromSun}宫 · 月第${r.houseFromMoon}宫`);
	}

	const kp = j.kp;
	if(kp){
		const kl = [];
		const rp = kp.rulingPlanets;
		if(rp && Array.isArray(rp.set) && rp.set.length){ kl.push(`当令星 Ruling Planets：${rp.set.join('、')}`); }
		const lv = kp.kpLevels;
		if(lv && typeof lv === 'object'){
			Object.keys(lv).forEach((pk)=>{
				const x = lv[pk];
				if(x){ kl.push(`${pk}：${x.Nak} ⊃ ${x.Sub} ⊃ ${x.Prati} ⊃ ${x.Sook} ⊃ ${x.Praana} ⊃ ${x.Deha}`); }
			});
		}
		const csl = kp.cuspalSubLords;
		if(Array.isArray(csl) && csl.length){
			out['KP 宫头次主星 CSL'] = [
				'| 宫位 | 星主 | 子主 |',
				'| --- | --- | --- |',
				...csl.map((c)=>`| 第${c.house}宫 | ${c.starLord} | ${c.subLord} |`),
			];
		}
		const sig = kp.significators;
		if(sig && typeof sig === 'object'){
			const sl = Object.keys(sig).map((pk)=>`${pk}：司宫 ${(sig[pk].ranked || []).join('·')}`);
			if(sl.length){ out['KP 意义者 Significators'] = sl; }
		}
		if(kl.length){ out['KP 六级细分 / 当令星'] = kl; }
	}

	const gm = j.grahaMaitri;
	if(gm && gm.available && Array.isArray(gm.matrix) && gm.matrix.length){
		const gmLabels = Array.isArray(gm.planetLabels) && gm.planetLabels.length
			? gm.planetLabels
			: ((gm.matrix[0] && gm.matrix[0].cells) || []).map((c)=>c.planetLabel);
		const gmAligned = gmLabels.length > 0 && gm.matrix.every((row)=>Array.isArray(row.cells) && row.cells.length === gmLabels.length);
		if(gmAligned){
			out['敌友（复合五分）'] = [
				`| 本星＼对方 | ${gmLabels.join(' | ')} |`,
				`| --- | ${gmLabels.map(()=>'---').join(' | ')} |`,
				...gm.matrix.map((row)=>`| ${row.planetLabel} | ${row.cells.map((c)=>(c.self ? '—' : (c.compoundCn || '—'))).join(' | ')} |`),
			];
		}else{
			out['敌友（复合五分）'] = gm.matrix.map((row)=>{
				const rel = (row.cells || []).filter((c)=>!c.self && c.compoundCn).map((c)=>`${c.planetLabel} ${c.compoundCn}`).join('、');
				return `${row.planetLabel} 看：${rel}`;
			});
		}
	}

	const goc = j.gochara;
	if(goc && goc.available && Array.isArray(goc.fromMoon) && goc.fromMoon.length){
		const sa = goc.saturnAfflictions || {};
		const ss = sa.sadeSati || {};
		const gl = goc.fromMoon.map((it)=>{
			const av = it.av && it.av.savBindu !== undefined ? ` SAV${it.av.savBindu}/BAV${it.av.bavBindu}` : '';
			return `${it.planetLabel || it.planet}：${it.signLabel || ''} 从月第${it.house}宫·${(it.good || it.auspicious) ? '吉' : '凶'}${it.effective === false ? '(Vedha遮)' : ''}${av}`;
		});
		if(ss.active){ gl.unshift(`Sade Sati 进行中（${ss.phaseLabel || ss.phase || ''}）`); }
		out['行运 Gochara（从月·八分点）'] = gl;
	}

	const rem = j.remedies;
	if(rem && Array.isArray(rem.table) && rem.table.length){
		out['化解（信息·非处方）'] = rem.table.map((g)=>`${g.planetCn || g.planet}：${g.gem}/${g.metal || ''}${g.mantraCount ? '·诵' + g.mantraCount : ''}${Array.isArray(g.deity) && g.deity.length ? '·守护' + g.deity.join('/') : ''}`);
	}

	const SIGN_CN_S = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
	const scS = (s)=>SIGN_CN_S[s] || s || '—';
	const arg = j.arudha && j.arudha.argala;
	if(arg && typeof arg === 'object'){
		const argLines = Object.keys(arg).sort((a, b)=>(Number(a) - Number(b))).map((h)=>{
			const g = arg[h] || {};
			const net = g.netStronger === 'argala' ? '干涉占优' : (g.netStronger === 'virodha' ? '反制占优' : '势均');
			return `第${h}宫：${net}（干涉${g.argalaCount || 0}/反制${g.virodhaCount || 0}）`;
		});
		if(argLines.length){ out['Jaimini Argala 干涉'] = argLines; }
	}
	const rdj = j.rasiDasha;
	if(rdj){
		[['narayana', 'Narayana'], ['lagnaKendradi', 'Lagna-Kendradi'], ['sudasa', 'Sudasa'], ['drigdasa', 'Drig'], ['shoola', 'Shoola'], ['niryanaShoola', 'Niryana-Shoola'], ['kalachakra', 'Kalachakra'], ['taraLagna', 'Tara-Lagna'], ['sthira', 'Sthira-固定'], ['yogardha', 'Yogardha-平均'], ['manduka', 'Manduka-蛙跳']].forEach((pair)=>{
			const d = rdj[pair[0]];
			if(d && d.available !== false && Array.isArray(d.mahadashas) && d.mahadashas.length){
				out[`座运·${pair[1]}`] = d.mahadashas.slice(0, 12).map((m)=>`${scS(m.rasi)}：${fx(m.years, 1)}年${m.deity ? '·' + m.deity : ''}`);
			}
		});
	}
	const tjj = j.tajaka;
	if(tjj){
		if(tjj.harshaBala){ out['Tajika Harsha Bala'] = Object.keys(tjj.harshaBala).map((pk)=>`${pk}：${fx(tjj.harshaBala[pk].total, 1)}`); }
		if(tjj.panchaVargeeyaBala){ out['Tajika Pancha-Vargeeya'] = Object.keys(tjj.panchaVargeeyaBala).map((pk)=>`${pk}：${fx((tjj.panchaVargeeyaBala[pk] || {}).total, 2)}`); }
		if(tjj.dasas && tjj.dasas.mudda && tjj.dasas.mudda.available && Array.isArray(tjj.dasas.mudda.sequence)){
			out['Tajika Mudda 年运'] = tjj.dasas.mudda.sequence.map((m)=>`${m.key}：${fx(m.days, 1)}天`);
		}
	}
	const gocL = j.gochara && j.gochara.fromLagna;
	if(Array.isArray(gocL) && gocL.length){
		out['行运 Gochara（从命）'] = gocL.map((it)=>`${it.planetLabel || it.label || it.planet}：从命第${it.house}宫${(it.good || it.auspicious) ? '·吉位' : '·凶位'}`);
	}

	const yg = j.yogas;
	if(yg && yg.available !== false && Array.isArray(yg.items) && yg.items.length){
		const YOGA_CAT_CN = {
			'Pancha Mahapurusha': '五大人瑜伽', Lunar: '月亮瑜伽', Solar: '太阳瑜伽', Raja: '王瑜伽',
			Dhana: '财富瑜伽', Viparita: '逆转王瑜伽', Parivartana: '交换瑜伽', Nabhasa: '形态瑜伽',
			Challenge: '挑战/煞', Support: '保护瑜伽', Association: '星体关联', Spiritual: '出离/灵性',
		};
		const sum = yg.summary || {};
		const ygLines = [`命中 ${sum.total || yg.items.length} 个（强${sum.strong || 0}/中${sum.medium || 0}/弱${sum.weak || 0}）`];
		yg.items.forEach((it)=>{
			const disp = it.zhName && it.zhName !== it.name ? `${it.zhName}（${it.name}）` : (it.name || it.zhName || '—');
			const planets = Array.isArray(it.planetLabels) && it.planetLabels.length ? it.planetLabels.join('、') : '';
			ygLines.push(`${disp}：${YOGA_CAT_CN[it.category] || it.category || '—'}·${it.levelLabel || it.level || '—'}·${it.score || 0}分${planets ? `·涉及 ${planets}` : ''}`);
		});
		out['瑜伽格局 Yogas'] = ygLines;
	}

	const upg = j.upagraha;
	if(upg && upg.available){
		const UPG_SIGN = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
		const upgLon = (l)=>{ const v = (((l || 0) % 360) + 360) % 360; return `${UPG_SIGN[Math.floor(v / 30)]} ${(v % 30).toFixed(1)}°`; };
		const upLines = [];
		if(Array.isArray(upg.timeBased) && upg.timeBased.length){
			upLines.push('◆ 时基副星（Gulika/Maandi 等）');
			upg.timeBased.forEach((it)=>{ upLines.push(`${it.key}：${upgLon(it.lon)}${it.note ? `（${it.note}）` : ''}`); });
		}
		if(Array.isArray(upg.sunBased) && upg.sunBased.length){
			upLines.push('◆ 日基副星');
			upg.sunBased.forEach((it)=>{ upLines.push(`${it.key}：${upgLon(it.lon)}${it.note ? `（${it.note}）` : ''}`); });
		}
		const outerObj = j.outerPlanets;
		const outer = outerObj && outerObj.available && Array.isArray(outerObj.planets) ? outerObj.planets : [];
		if(outer.length){
			upLines.push('◆ 外行星 Ur/Ne/Pl（虚星·信息性，不入九曜强弱）');
			outer.forEach((o)=>{ upLines.push(`${o.label}：${o.signLabel || o.sign || '—'} ${fx(o.signlon, 1)}°${o.retrograde ? ' R' : ''}·宫${o.house || '—'}${o.nakshatra ? `·${o.nakshatra}P${o.pada}` : ''}`); });
		}
		if(upLines.length){ out['副星 Upagraha'] = upLines; }
	}

	return out;
}
