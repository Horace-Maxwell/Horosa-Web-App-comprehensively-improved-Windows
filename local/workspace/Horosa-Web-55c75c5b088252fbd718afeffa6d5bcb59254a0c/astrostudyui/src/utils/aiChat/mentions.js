// AI 助手·@引用(A4;借鉴 Codex /mention、Cursor @):输入框打 @ 弹补全(命盘/事盘/资料/组合/模板/技法/技法段),选中插入 @[类型:名字] 标记,
// 发送时解析标记 → 挂载动作(切命盘/追加参考/改技法/技法段过滤),标记在正文里换回名字。纯函数零副作用零 import。
// 规则:@ 必须在行首或跟在空白/标点之后(邮箱 a@b 与全角 ＠ 都不是);同名歧义用 #尾号(cid 后四位)区分;第二个 @命盘 不挂载,提示改用 /合盘。
// [2026-09-11 补完] 技法候选=全技法并集(命盘类 ∪ 事盘类),不在当前案例可挂集的标 available:false + why(灰显,发送时提示未挂载而非「没找到」);
// 此前全局截 12 条:命盘/资料排前,技法只剩 ≈9 个坑位 → 用户以为「技法缺了非常多」;技法英文键子串命中 + 可选拼音文本命中。
// [2026-09-12] 技法**一条不截**:空关键字时全部技法按术数域分组列出(与「选择技法」下拉同一分组),灰项就地灰显;只有命盘/资料等
// 「可能几百条」的组才按配额取头几条,脚注写明「输入名字筛选」。技法段:已勾选技法的段 + 正在键入的技法(`@八字/`)的段都列。
// [2026-09-12 复查] `@紫微/` `@zw/` `@ziwei/`:段候选按「技法头 / 段尾」拆开匹配(头对标签前缀 / 键前缀 / 拼音,尾对段名子串),此前只认完整标签;
// 段标记解析按「标签 + /」最长前缀切分(「十三分盘 / 占星地图/起盘信息」不再切成「十三分盘」);段候选继承技法的灰显;
// 带关键字时 bestIndex 指向最佳命中(组序供 ↑↓ 用,Enter 默认落在最佳命中而不是第一组的包含命中)。
export const MENTION_KINDS = ['source', 'material', 'bundle', 'template', 'technique', 'section'];
// 空关键字时每组最多显示条数;不在此表的组(技法 · 各术数域 / 技法段)不设上限。有关键字时统一上限 MENTION_QUERY_LIMIT。
export const MENTION_GROUP_QUOTA = { 命盘: 6, 事盘: 6, 资料: 4, 组合: 3, 模板: 3 };
export const MENTION_QUERY_LIMIT = 200;
export const MENTION_TECHNIQUE_GROUP_PREFIX = '技法 · ';
export const MENTION_TYPE_LABELS = { chart: '命盘', case: '事盘', material: '资料', bundle: '组合', template: '模板', technique: '技法', section: '技法段' };
// [Q-326] 标记体三处修:
//  ① 名字里的 `]` `#` `\` 在插入时转义(escapeMentionName),解析时还原 —— 此前含 `]` 的名字把标记提前截断、
//     名字自带 `#尾号`(如「案例#2024」)被当成同名消歧尾号切掉;
//  ② 长度上限 80 → 200:超限时整条标记匹配不上,原样当正文发给模型(用户看到的是「@引用没生效」);
//  ③ 体内允许 `\x` 转义序列。旧的未转义标记(历史草稿)按老语义照样解析,零回归。
export const MENTION_NAME_MAX = 200;
export const MENTION_TOKEN_RE = /@\[(命盘|事盘|资料|组合|模板|技法|技法段):((?:\\[\s\S]|[^\]\n\\]){1,200})\]/g;
// 插入标记时转义名字(只转 3 个字符,其余原样 —— 中文/空格/斜杠都不动,肉眼仍可读)
export function escapeMentionName(name){
	return `${name == null ? '' : name}`.replace(/[\\\]#]/g, '\\$&');
}
export function unescapeMentionName(body){
	return `${body == null ? '' : body}`.replace(/\\([\s\S])/g, '$1');
}
// 体 → {name, suffix}:只认「末尾的、未被转义的 # + 2..8 位尾号」;名字里转义过的 \# 不参与切分
export function splitMentionBody(body){
	const m = /^((?:\\[\s\S]|[^\\#])*)#([A-Za-z0-9_-]{2,8})$/.exec(`${body == null ? '' : body}`);
	if(m){ return { name: unescapeMentionName(m[1]).trim(), suffix: m[2] }; }
	return { name: unescapeMentionName(body).trim(), suffix: '' };
}
export const MENTION_QUERY_MAX = 40;

function isWordChar(ch){ return /[A-Za-z0-9._%+-]/.test(ch || ''); }

// 光标处正在输入的 @查询:{ start(@ 的下标), query } | null。@ 前必须是行首/空白/标点(非邮箱字符);query 到光标为止且不含空白/]
export function findMentionQuery(text, caret){
	const s = `${text == null ? '' : text}`;
	const c = Math.max(0, Math.min(Number.isFinite(caret) ? caret : s.length, s.length));
	for(let i = c - 1; i >= 0; i--){
		const ch = s[i];
		if(ch === '@'){
			if(i > 0 && isWordChar(s[i - 1])){ return null; }
			const query = s.slice(i + 1, c);
			if(query.length > MENTION_QUERY_MAX || /[\s\]\[]/.test(query)){ return null; }
			return { start: i, query };
		}
		if(/[\s\]\[\n]/.test(ch)){ return null; }
		if(c - i > MENTION_QUERY_MAX){ return null; }
	}
	return null;
}

function suffixOf(id){ const t = `${id || ''}`; return t.slice(-4); }

// 技法「头」匹配(`@八字/`、`@bz/`、`@ziwei/` 的 `/` 前那截):0 = 标签/键全等 · 1 = 标签/键/拼音词前缀 · 2 = 标签/键子串 · -1 = 不中;空头 = 全中(0)
export function techniqueHeadMatch(head, { label, key, extra } = {}){
	const h = `${head == null ? '' : head}`.trim().toLowerCase();
	if(!h){ return 0; }
	const l = `${label || ''}`.toLowerCase(); const k = `${key || ''}`.toLowerCase();
	if(l === h || k === h){ return 0; }
	if((l && l.indexOf(h) === 0) || (k && k.indexOf(h) === 0)){ return 1; }
	const ex = `${extra || ''}`.toLowerCase();
	if(ex && ex.split(/\s+/).some((w)=>w && w.indexOf(h) === 0)){ return 1; }
	if((l && l.indexOf(h) >= 0) || (k && k.indexOf(h) >= 0)){ return 2; }
	return -1;
}

export function candidateToken(item){
	const label = MENTION_TYPE_LABELS[item.type] || item.type;
	// [Q-326] 名字先转义再拼:含 `]` 的名字此前把标记截断、名字自带 `#xxxx` 被误当消歧尾号
	return `@[${label}:${escapeMentionName(item.name)}${item.suffix ? `#${item.suffix}` : ''}]`;
}

// 候选池:命盘/事盘(同名标尾号)· 资料 · 组合 · 模板 · 技法(全技法;techniqueAvailable(key) 判是否可挂当前案例,缺席=全可用;
// techniqueGroupOf(key) 给术数域标题 → 组名「技法 · 西方占星」等,缺席=单组「技法」)· 技法段(已选技法 + sectionTechniqueKeys 点名技法 的有效段)
export function buildMentionCandidates({ sources, materials, bundles, templates, techniqueOptions, sectionsForTechnique, selectedTechniqueKeys, sectionTechniqueKeys, techniqueAvailable, techniqueGroupOf } = {}){
	const out = [];
	const titleCount = {};
	const titleOrder = {};
	(sources || []).forEach((s)=>{ if(s && s.title){ titleCount[s.title] = (titleCount[s.title] || 0) + 1; } });
	(sources || []).forEach((s)=>{
		if(!s || !s.id || !s.title){ return; }
		const type = s.sourceType === 'case' ? 'case' : 'chart';
		const dup = titleCount[s.title] > 1;
		out.push({ kind: 'source', type, id: s.id, name: `${s.title}`, suffix: dup ? suffixOf(s.id) : '', label: `${s.title}${dup ? ` #${suffixOf(s.id)}` : ''}`, group: MENTION_TYPE_LABELS[type], groupRank: type === 'case' ? 1 : 0 });
	});
	(materials || []).forEach((m)=>{ if(m && m.id){ const name = `${m.name || m.fileName || ''}`.trim(); if(name){ out.push({ kind: 'material', type: 'material', id: m.id, name, suffix: '', label: name, group: '资料', groupRank: 2 }); } } });
	(bundles || []).forEach((b)=>{ if(b && b.id && b.name){ out.push({ kind: 'bundle', type: 'bundle', id: b.id, name: `${b.name}`, suffix: '', label: `${b.name}${b.skill ? '(技能)' : ''}`, group: '组合', groupRank: 3 }); } });
	(templates || []).forEach((t)=>{ if(t && t.id && t.name){ out.push({ kind: 'template', type: 'template', id: t.id, name: `${t.name}`, suffix: '', label: `${t.name}`, group: '模板', groupRank: 4 }); } });
	(techniqueOptions || []).forEach((o)=>{
		if(!o || !o.value){ return; }
		const av = typeof techniqueAvailable === 'function' ? techniqueAvailable(o.value) : true;
		const why = av === true ? '' : (typeof av === 'string' ? av : '当前案例不适用');
		// techniqueGroupOf 可返回标题字符串或 { title, order }(order=术数域顺序,菜单按它排组;纯字符串按首次出现顺序编号,不然各组同 rank 会按可用性交错)
		let group = '技法'; let groupRank = 10;
		if(typeof techniqueGroupOf === 'function'){
			const t = techniqueGroupOf(o.value);
			const title = t && typeof t === 'object' ? t.title : t;
			if(title){
				let order = t && typeof t === 'object' && Number.isFinite(t.order) ? t.order : null;
				if(order === null){ if(!(title in titleOrder)){ titleOrder[title] = Object.keys(titleOrder).length; } order = titleOrder[title]; }
				group = `${MENTION_TECHNIQUE_GROUP_PREFIX}${title}`; groupRank = 10 + order;
			}
		}
		out.push({ kind: 'technique', type: 'technique', id: o.value, name: `${o.label || o.value}`, key: o.value, suffix: '', label: `${o.label || o.value}`, group, groupRank, available: av === true, why });
	});
	const keys = [];
	(Array.isArray(selectedTechniqueKeys) ? selectedTechniqueKeys : []).concat(Array.isArray(sectionTechniqueKeys) ? sectionTechniqueKeys : []).forEach((k)=>{ if(k && keys.indexOf(k) < 0){ keys.push(k); } });
	if(typeof sectionsForTechnique === 'function'){
		keys.forEach((k)=>{
			const opt = (techniqueOptions || []).find((o)=>o && o.value === k);
			const tl = opt ? `${opt.label || k}` : `${k}`;
			// 段继承技法的可用性:命盘案例下 `@六爻/` 的段与 `@六爻` 一样灰(此前段全白,发送后才提示不适用)
			const av = typeof techniqueAvailable === 'function' ? techniqueAvailable(k) : true;
			const why = av === true ? '' : (typeof av === 'string' ? av : '当前案例不适用');
			(sectionsForTechnique(k) || []).forEach((sec)=>{ out.push({ kind: 'section', type: 'section', id: `${k}/${sec}`, key: k, techniqueLabel: tl, section: `${sec}`, name: `${tl}/${sec}`, suffix: '', label: `${tl} / ${sec}`, group: '技法段', groupRank: 90, available: av === true, why }); });
		});
	}
	return out;
}

// 过滤 + 配额(带明细):limits 传数字=旧语义(全局上限);传对象 { quota, limit, extraText } =
//   空关键字 → 每组最多 quota[group] 条(缺省 MENTION_GROUP_QUOTA),有关键字 → 全局 limit(缺省 MENTION_QUERY_LIMIT);
//   extraText(item) 可返回额外匹配文本(如拼音全拼/首字母,由调用方惰性提供)。
// 命中:名字/标签子串 · 技法英文键子串(@qimen / @liureng)· extraText 子串;排序:名字前缀 0 < 键前缀/拼音首字母前缀 1 < 其余包含 2,同分保持池内顺序。
export function filterMentionCandidatesDetailed(items, query, limits){
	const q = `${query || ''}`.trim().toLowerCase();
	const opt = (limits && typeof limits === 'object') ? limits : {};
	const legacyCap = Number.isFinite(limits) && limits > 0 ? limits : null;
	const extra = typeof opt.extraText === 'function' ? opt.extraText : null;
	const textOf = (it)=>{ try{ const t = extra ? extra(it) : ''; return `${t || ''}`.toLowerCase(); }catch(e){ return ''; } };
	// 段候选专用:关键字含 `/` 时拆「技法头 / 段尾」——头对技法标签 / 键 / 拼音(techniqueHeadMatch),尾对段名子串;返回 null = 不适用(走通用命中)
	const slashAt = q.indexOf('/');
	const qHead = slashAt >= 0 ? q.slice(0, slashAt).trim() : null;
	const qTail = slashAt >= 0 ? q.slice(slashAt + 1).trim() : '';
	const sectionHead = (it)=>{
		if(qHead === null || it.kind !== 'section'){ return null; }
		const tl = it.techniqueLabel != null ? `${it.techniqueLabel}` : `${it.name}`.slice(0, Math.max(0, `${it.name}`.length - `${it.section || ''}`.length - 1));
		const h = techniqueHeadMatch(qHead, { label: tl, key: it.key, extra: textOf(it) });
		if(h < 0){ return -1; }
		return (!qTail || `${it.section || ''}`.toLowerCase().indexOf(qTail) >= 0) ? h : -1;
	};
	const hit = (it)=>{
		if(!q){ return true; }
		const sh = sectionHead(it);
		if(sh !== null){ return sh >= 0; }
		if(`${it.name}`.toLowerCase().indexOf(q) >= 0 || `${it.label}`.toLowerCase().indexOf(q) >= 0){ return true; }
		if(it.key && `${it.key}`.toLowerCase().indexOf(q) >= 0){ return true; }
		const ex = textOf(it);
		return !!(ex && ex.split(/\s+/).some((w)=>w && w.indexOf(q) >= 0));
	};
	const score = (it)=>{
		if(!q){ return 0; }
		const sh = sectionHead(it);
		if(sh !== null){ return sh < 0 ? 2 : Math.min(2, sh); }
		if(`${it.name}`.toLowerCase().indexOf(q) === 0){ return 0; }
		if(it.key && `${it.key}`.toLowerCase().indexOf(q) === 0){ return 1; }
		const ex = textOf(it);
		if(ex && ex.split(/\s+/).some((w)=>w && w.indexOf(q) === 0)){ return 1; }
		return 2;
	};
	const all = (items || []).filter(hit);
	// 排序 = 视觉顺序(菜单按组渲染,键盘 ↑↓ 走的是这条扁平序,二者必须一致):
	//   ① groupRank(命盘 0 / 事盘 1 / 资料 2 / 组合 3 / 模板 4 / 技法·各术数域 10+ / 技法段 90)
	//   ② 组内可用项永远排在不可用(灰显)项之前:事盘案例下不至于先看到十几条灰掉的命盘技法
	//   ③ 前缀命中 < 键/拼音前缀 < 包含;④ 池内登记序
	const rank = (it)=>score(it) + (it.available === false ? 3 : 0);
	const grp = (it)=>(Number.isFinite(it.groupRank) ? it.groupRank : 50);
	const sorted = all.map((it, i)=>({ it, i })).sort((a, b)=>(grp(a.it) - grp(b.it)) || (rank(a.it) - rank(b.it)) || (a.i - b.i)).map((x)=>x.it);
	let shown;
	if(legacyCap !== null){ shown = sorted.slice(0, legacyCap); }
	else if(q){ shown = sorted.slice(0, Number.isFinite(opt.limit) && opt.limit > 0 ? opt.limit : MENTION_QUERY_LIMIT); }
	else{
		const quota = { ...MENTION_GROUP_QUOTA, ...(opt.quota || {}) };
		const used = {};
		// 不在配额表里的组(技法 · 各术数域 / 技法段)一条不截
		shown = sorted.filter((it)=>{ const g = it.group || '其他'; if(!Number.isFinite(quota[g])){ return true; } used[g] = (used[g] || 0) + 1; return used[g] <= quota[g]; });
	}
	// 带关键字时的默认高亮 = 最佳命中(rank 最小者,同分取先):有命盘「李八字」时 `@八字` 回车仍插入技法「八字」而不是排在前面的「李八字」
	let bestIndex = 0;
	if(q){ let best = Infinity; shown.forEach((it, i)=>{ const r = rank(it); if(r < best){ best = r; bestIndex = i; } }); }
	return { items: shown, hiddenCount: Math.max(0, sorted.length - shown.length), total: sorted.length, bestIndex };
}

// 光标插入:把 [start, caret) 的 "@query" 换成标记 + 空格;返回新文本与新光标
export function insertMentionAtCaret(text, start, caret, token){
	const s = `${text == null ? '' : text}`;
	const a = Math.max(0, Math.min(start, s.length));
	const b = Math.max(a, Math.min(caret, s.length));
	const ins = `${token} `;
	return { text: `${s.slice(0, a)}${ins}${s.slice(b)}`, caret: a + ins.length };
}

// 解析正文里的标记 → mentions;正文里标记换回名字(保留自然语句)
export function parseMentions(text){
	const s = `${text == null ? '' : text}`;
	const mentions = [];
	const cleaned = s.replace(MENTION_TOKEN_RE, (raw, typeLabel, body)=>{
		const { name, suffix } = splitMentionBody(body);   // [Q-326] 转义感知的切分 + 还原
		const type = Object.keys(MENTION_TYPE_LABELS).find((k)=>MENTION_TYPE_LABELS[k] === typeLabel) || 'chart';
		mentions.push({ type, name, suffix, raw });
		return name;
	}).replace(/[ \t]{2,}/g, ' ').trim();
	return { mentions, text: cleaned };
}

function newest(list){
	return list.slice().sort((a, b)=>{
		const ta = Date.parse((a.record && (a.record.updatedAt || a.record.createdAt)) || 0) || 0;
		const tb = Date.parse((b.record && (b.record.updatedAt || b.record.createdAt)) || 0) || 0;
		return tb - ta;
	})[0];
}

function pickByName(list, name, suffix, nameOf, idOf){
	const exact = list.filter((x)=>nameOf(x) === name);
	const pool = exact.length ? exact : list.filter((x)=>nameOf(x).indexOf(name) >= 0);
	if(!pool.length){ return { hit: null, ambiguous: false }; }
	if(suffix){ const bySuffix = pool.filter((x)=>`${idOf(x)}`.endsWith(suffix)); if(bySuffix.length === 1){ return { hit: bySuffix[0], ambiguous: false }; } }
	if(pool.length === 1){ return { hit: pool[0], ambiguous: false }; }
	return { hit: newest(pool), ambiguous: true };
}

// 解析 → 挂载计划(纯):selectSource(第一个命盘/事盘)· hints(第二张命盘请用 /合盘;歧义取最近;技法不适用当前案例)· referenceIds(资料/组合)· techniqueKeys · sectionFilter{key:[段]} · unresolved
// pools.techniqueOptions=可被 @ 到的全技法;pools.allowedTechniqueKeys(可选)=当前案例可挂集:技法在全集但不在可挂集 → 进 hints 不进 techniqueKeys(此前会被页面静默剔除)
export function resolveMentions(mentions, pools){
	const p = pools || {};
	const plan = { selectSource: null, referenceIds: [], techniqueKeys: [], sectionFilter: {}, unresolved: [], hints: [] };
	const allowed = Array.isArray(p.allowedTechniqueKeys) ? new Set(p.allowedTechniqueKeys) : null;
	const techOk = (key, label)=>{
		if(!allowed || allowed.has(key)){ return true; }
		plan.hints.push(`技法「${label}」不适用于当前案例(${p.activeSourceType === 'case' ? '当前是事盘' : (p.activeSourceType === 'timepoint' ? '当前是起课时间' : (p.activeSourceType ? '当前是命盘' : '尚未挂载案例'))}),未挂载`);
		return false;
	};
	let charts = 0;
	(mentions || []).forEach((m)=>{
		if(m.type === 'chart' || m.type === 'case'){
			const list = (p.sources || []).filter((s)=>s && (m.type === 'case' ? s.sourceType === 'case' : s.sourceType !== 'case'));
			const r = pickByName(list, m.name, m.suffix, (s)=>`${s.title || ''}`, (s)=>s.id);
			if(!r.hit){ plan.unresolved.push(m.raw); return; }
			charts += 1;
			if(charts === 1){ plan.selectSource = r.hit; if(r.ambiguous){ plan.hints.push(`有多张「${m.name}」,已取最近保存的一张(可用 #尾号 指定)`); } }
			else{ plan.hints.push(`第二张命盘「${m.name}」未挂载:两盘合看请用 /合盘 ${m.name}`); }
			return;
		}
		// [Q-326] 资料 / 组合 / 模板同名多条时也给歧义提示:此前只有命盘/事盘提示,这三类静默取「最近保存」的一条,
		// 用户看到挂的不是自己想的那份却无从察觉
		if(m.type === 'material'){
			const r = pickByName(p.materials || [], m.name, m.suffix, (x)=>`${x.name || x.fileName || ''}`, (x)=>x.id);
			if(!r.hit){ plan.unresolved.push(m.raw); return; }
			if(r.ambiguous){ plan.hints.push(`有多份「${m.name}」资料,已取最近保存的一份(可用 #尾号 指定)`); }
			plan.referenceIds.push(`material:${r.hit.id}`); return;
		}
		if(m.type === 'bundle'){
			const r = pickByName(p.bundles || [], m.name, m.suffix, (x)=>`${x.name || ''}`, (x)=>x.id);
			if(!r.hit){ plan.unresolved.push(m.raw); return; }
			if(r.ambiguous){ plan.hints.push(`有多个「${m.name}」组合,已取最近保存的一个(可用 #尾号 指定)`); }
			plan.referenceIds.push(`bundle:${r.hit.id}`); return;
		}
		if(m.type === 'template'){
			const r = pickByName(p.templates || [], m.name, m.suffix, (x)=>`${x.name || ''}`, (x)=>x.id);
			if(!r.hit){ plan.unresolved.push(m.raw); return; }
			if(r.ambiguous){ plan.hints.push(`有多个「${m.name}」模板,已取最近保存的一个(可用 #尾号 指定)`); }
			plan.referenceIds.push(`template:${r.hit.id}`); return;
		}
		if(m.type === 'technique'){
			const opt = (p.techniqueOptions || []).find((o)=>o && (`${o.label || ''}` === m.name || `${o.value}` === m.name));
			if(!opt){ plan.unresolved.push(m.raw); return; }
			if(!techOk(opt.value, opt.label || opt.value)){ return; }
			if(plan.techniqueKeys.indexOf(opt.value) < 0){ plan.techniqueKeys.push(opt.value); } return;
		}
		if(m.type === 'section'){
			// 「标签 + /」或「键 + /」最长前缀切分:标签本身含 `/`(十三分盘 / 占星地图)与段名含 `/`(Ishta/Kashta 吉凶果)都不会切错
			let best = null;
			(p.techniqueOptions || []).forEach((o)=>{
				if(!o){ return; }
				[`${o.label || ''}`, `${o.value || ''}`].forEach((pre)=>{
					if(pre && m.name.indexOf(`${pre}/`) === 0 && (!best || pre.length > best.pre.length)){ best = { opt: o, pre }; }
				});
			});
			if(!best){ plan.unresolved.push(m.raw); return; }
			const opt = best.opt; const sec = m.name.slice(best.pre.length + 1).trim();
			if(!sec){ plan.unresolved.push(m.raw); return; }
			if(!techOk(opt.value, opt.label || opt.value)){ return; }
			if(plan.techniqueKeys.indexOf(opt.value) < 0){ plan.techniqueKeys.push(opt.value); }
			plan.sectionFilter[opt.value] = (plan.sectionFilter[opt.value] || []).concat(sec);
			return;
		}
		plan.unresolved.push(m.raw);
	});
	return plan;
}
