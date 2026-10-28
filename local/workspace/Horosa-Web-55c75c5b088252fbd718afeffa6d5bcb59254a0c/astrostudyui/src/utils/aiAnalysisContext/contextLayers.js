// AI 分析挂载上下文 · 拼层与裁剪:token 估算、提示哈希、快照与源不符判定、拼上下文层、按预算裁剪、测试用组装。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../dayBoundary';
import { splitContentSections } from '../aiExport';
import { buildRetrievedContextText, wrapUntrustedData, neutralizeLabel } from '../aiAnalysisRag';
import { buildDayBoundaryMeta, DEFAULT_CONTEXT_CHAR_LIMIT, PAIR_SYNASTRY_MAX_CHARS } from './catalog';

// [挂载预算] token 估算分 CJK/其他两桶:中文≈1.6 字/token,ASCII≈4 字/token。
// 旧版一刀切 /4 对中文低估 ~2.5 倍,预算判断全线失真。
export function estimateTextTokens(text){
	const raw = `${text || ''}`.trim();
	if(!raw) return 0;
	let cjk = 0;
	for(let i = 0; i < raw.length; i++){
		const c = raw.charCodeAt(i);
		if((c >= 0x2E80 && c <= 0x9FFF) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFF00 && c <= 0xFFEF) || (c >= 0x3000 && c <= 0x303F)){
			cjk++;
		}
	}
	const other = raw.length - cjk;
	return Math.ceil(cjk / 1.6 + other / 4);
}

// [前缀缓存排障] 稳定层指纹:FNV-1a 32 位 → 8 位 hex;纯函数(同串同值,按 UTF-16 码元逐位混入),
// 供跨轮核对「稳定前缀是否逐字节不变」(变了=上游前缀缓存必失效,气泡 usage.prompt.stableHash 可直接对照)。
export function hashPromptText(text){
	const s = `${text == null ? '' : text}`;
	let h = 0x811c9dc5;
	for(let i = 0; i < s.length; i++){
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return `00000000${h.toString(16)}`.slice(-8);
}

// [挂载健康] 快照↔当前案例底盘核对:比对快照 meta(各技法存快照时带的起盘时空)与案例
// record 的出生/起课字段。返回 'match' | 'mismatch' | 'unknown'。纪律「宁漏勿误伤」:
// 任一侧信息不足即 unknown(绝不报警);时间裁到分钟、坐标/时区圆到 1 位小数再比,
// 消格式噪声。事盘快照 meta 通常无出生位 → 天然 unknown,恒不按时间妄断。
export function snapshotSourceMismatch(meta, record){
	if(!meta || typeof meta !== 'object' || !record || typeof record !== 'object'){
		return 'unknown';
	}
	const normNum = (v)=>{
		const n = Number(v);
		return Number.isFinite(n) ? n.toFixed(1) : null;
	};
	// 起盘签名的日期是「1990/05/18」、案例记录是「1990-05-18」:分隔符 / 补零 / 公元前年份先归一再比,
	// 否则同一张盘也报「非本盘」。一边只有日期时只比日期(宁漏勿误伤)。
	const normWhen = (v)=>{
		const s = `${v || ''}`.trim().replace('T', ' ').replace(/\//g, '-').replace(/\s+/g, ' ');
		const m = s.match(/^(-?)(\d+)-(\d{1,2})-(\d{1,2})(?: (\d{1,2}):(\d{1,2}))?/);
		if(!m){
			return { day: s.slice(0, 16), minute: '' };
		}
		const pad = (x)=>`${x}`.padStart(2, '0');
		const day = `${m[1]}${m[2].padStart(4, '0')}-${pad(m[3])}-${pad(m[4])}`;
		return { day, minute: m[5] !== undefined ? `${pad(m[5])}:${pad(m[6])}` : '' };
	};
	const cmp = [];
	const metaWhen = normWhen(meta.birth || meta.divTime || [meta.date, meta.time].filter(Boolean).join(' '));
	const recWhen = normWhen(record.birth || record.divTime || '');
	if(metaWhen.day && recWhen.day){
		cmp.push([metaWhen.day, recWhen.day]);
		if(metaWhen.minute && recWhen.minute){
			cmp.push([metaWhen.minute, recWhen.minute]);
		}
	}
	const pairs = [['zone', 'zone'], ['lon', 'lon'], ['lat', 'lat']];
	pairs.forEach(([mk, rk])=>{
		const a = normNum(meta[mk]);
		const b = normNum(record[rk]);
		if(a != null && b != null){
			cmp.push([a, b]);
		}
	});
	if(!cmp.length){
		return 'unknown';
	}
	return cmp.every(([a, b])=>a === b) ? 'match' : 'mismatch';
}

// [双盘挂载] 合盘时层标题里的人名:取案例名去空白;没有名字回落「本人 / 对方」。
export function pairDisplayName(title, fallback){
	const t = `${title || ''}`.replace(/\s+/g, ' ').trim();
	return t || fallback;
}

export function buildContextLayers({
	sourceContext,
	techniqueContexts,
	materials,
	bundles,
	templates,
	retrievedChunks,
	conversationMessages,
	systemPrompt,
	extraLayers,
	turnExtraContext,
	partner,
}) {
	const layers = [];
	// [双盘挂载] 合盘对方:{ title, sourceContext, techniqueContexts }。给了且有内容才进双盘模式;
	//   缺省 / 空 = 单盘,各层键、标题、优先级与此前逐字节相同。
	const pair = partner && typeof partner === 'object'
		&& ((partner.sourceContext && partner.sourceContext.content) || (partner.techniqueContexts || []).some((item)=>item && item.content))
		? partner : null;
	const selfName = pair ? pairDisplayName(sourceContext && sourceContext.title, '本人') : '';
	const otherName = pair ? pairDisplayName(pair.title || (pair.sourceContext && pair.sourceContext.title), '对方') : '';
	// [双盘挂载] 两人之间的西洋合盘数据(比较盘 / 组合盘 / 影响盘 / 契合度):调用方按「这一对」算好放进 partner.synastry;
	//   进会话层(稳定、追问时仍在、吃前缀缓存)。此前由 /合盘 塞进只活一轮的附加层,第二句追问就没了。
	const pairChinese = pair && pair.chinese && typeof pair.chinese === 'object' ? pair.chinese : {};
	const pairBaziHehun = pair ? `${pairChinese.bazi || ''}`.trim() : '';
	const pairZiweiPair = pair ? `${pairChinese.ziwei || ''}`.trim() : '';
	const pairSynastry = pair && `${pair.synastry || ''}`.trim()
		? (`${pair.synastry}`.trim().length > PAIR_SYNASTRY_MAX_CHARS ? clipContentToBudget(`${pair.synastry}`.trim(), PAIR_SYNASTRY_MAX_CHARS).text : `${pair.synastry}`.trim())
		: '';
	// 本轮附加上下文(技能口径 / 合盘数据 / 软件帮助 / 已批准计划)只属这一轮:此前并进系统层
	//   (优先级 100,排在案例前提之前)→ 稳定前缀在该轮与下一轮各重写一次(Anthropic 各写一次整份快照缓存);合盘数据还按字符
	//   切断并挤掉源层/技法层。现独立成挥发层(缓存断点之后),经裁剪引擎按层公平分摊。
	if(turnExtraContext && `${turnExtraContext}`.trim()){
		layers.push({ key: 'turn-extra', title: '本轮附加上下文', priority: 85, content: `${turnExtraContext}`.trim() });
	}
	// 对话交互增强的附加稳定层(压缩摘要 88 / 个人口径 102 / 记忆 101):调用方显式给才进,缺省 undefined=零变化;
	//   只收形状合法项({key,title,content,priority}),内容为空的不进。
	(Array.isArray(extraLayers) ? extraLayers : []).forEach((l)=>{
		if(l && typeof l === 'object' && l.key && `${l.content || ''}`.trim() && Number.isFinite(l.priority)){
			layers.push({ key: `${l.key}`, title: `${l.title || l.key}`, content: `${l.content}`, priority: l.priority });
		}
	});
	layers.push({
		key: 'system',
		title: '系统提示',
		priority: 100,
		content: systemPrompt || '你是星阙的 AI 分析助手。请严格依据当前案例上下文、参考资料与回复模版作答。',
	});
	if(pair){
		layers.push({
			key: 'pair-rule',
			title: '双盘挂载（合盘）',
			priority: 96,
			content: `本轮同时挂载两张命盘:本人「${selfName}」与对方「${otherName}」。下列案例前提与各技法层的标题都注明了归属(本人 / 对方);对照分析时逐项对应,两人的数据不要混用,也不要把一方的盘面当成另一方的。${(pairSynastry || pairBaziHehun || pairZiweiPair) ? `另附两人之间的${[pairSynastry ? '西洋合盘数据(比较盘 / 组合盘 / 影响盘 / 契合度)' : '', pairBaziHehun ? '八字合婚对照' : '', pairZiweiPair ? '紫微合盘对照' : ''].filter(Boolean).join('、')}:那是两人之间的关系数据,不属于任何一方的单盘。` : ''}`,
		});
	}
	if(sourceContext && sourceContext.content){
		layers.push({
			key: 'source',
			title: pair ? `案例前提（本人）：${sourceContext.title || ''}` : `案例前提：${sourceContext.title || ''}`,
			priority: 95,
			content: sourceContext.content,
		});
	}
	if(pair && pair.sourceContext && pair.sourceContext.content){
		layers.push({
			key: 'partner-source',
			title: `案例前提（对方）：${pair.sourceContext.title || otherName}`,
			priority: 94.5,
			content: pair.sourceContext.content,
		});
	}
	if(pairSynastry){
		// 键以 pair: 开头 = 两人之间的数据层:有技法层时与技法层一起按水位裁;没挂技法时与两份整份快照一起分摊(见 clipContextLayersDetailed)
		layers.push({
			key: 'pair:synastry',
			title: `合盘数据（西洋比较盘 / 组合盘 / 影响盘）：${selfName} × ${otherName}`,
			priority: 93.5,
			content: pairSynastry,
		});
	}
	// 中式合盘对照:两人都挂八字 / 紫微时由调用方算好放进 partner.chinese(只有对照事实,不含评分)
	if(pairBaziHehun){
		layers.push({ key: 'pair:bazi-hehun', title: `八字合婚对照：${selfName} × ${otherName}`, priority: 93.45, content: pairBaziHehun });
	}
	if(pairZiweiPair){
		layers.push({ key: 'pair:ziwei', title: `紫微合盘对照：${selfName} × ${otherName}`, priority: 93.4, content: pairZiweiPair });
	}
	// v2.2.1:把「日界点·晚子时」排盘规则作为 first-class 上下文稳定挂载,
	// 让 AI 知道四柱按哪种换日/起时干规则计算,不会误读 23:00–23:59 的日柱/时柱。
	// 优先用案例自带的开关值(命盘 fields / 事盘 payload),否则回退全局设置。
	{
		const a23 = sourceContext && sourceContext.after23NewDay !== undefined
			? sourceContext.after23NewDay : defaultAfter23NewDay();
		const lzh = sourceContext && sourceContext.lateZiHourUseNextDay !== undefined
			? sourceContext.lateZiHourUseNextDay : defaultLateZiHourUseNextDay();
		const meta = buildDayBoundaryMeta(a23, lzh);
		let note = meta.note;
		// [双盘挂载] 对方盘的日界 / 晚子时口径与本人不同(随盘存档的口径)时补一行,口径相同不加字
		if(pair && pair.sourceContext){
			const pa23 = pair.sourceContext.after23NewDay !== undefined ? pair.sourceContext.after23NewDay : defaultAfter23NewDay();
			const plzh = pair.sourceContext.lateZiHourUseNextDay !== undefined ? pair.sourceContext.lateZiHourUseNextDay : defaultLateZiHourUseNextDay();
			const pmeta = buildDayBoundaryMeta(pa23, plzh);
			if(pmeta.after23NewDay !== meta.after23NewDay || pmeta.lateZiHourUseNextDay !== meta.lateZiHourUseNextDay){
				note = `${note}\n对方「${otherName}」的盘按另一套口径:日柱开关【${pmeta.dayBoundaryLabel}】+ 时柱开关【${pmeta.lateZiHourLabel}】。`;
			}
		}
		layers.push({
			key: 'dayBoundaryRule',
			title: '排盘规则（日界点·晚子时）',
			priority: 94,
			content: note,
		});
	}
	(techniqueContexts || []).forEach((item, idx)=>{
		if(!item || !item.content){
			return;
		}
		if(sourceContext && sourceContext.content && item.content === sourceContext.content){
			return;
		}
		layers.push({
			key: `technique:${item.key || idx}`,
			title: pair
				? `使用技法：${item.title || item.key || `技法 ${idx + 1}`}（本人·${selfName}）`
				: `使用技法：${item.title || item.key || `技法 ${idx + 1}`}`,
			priority: 93 - idx,
			content: item.content,
		});
	});
	// [双盘挂载] 对方各技法紧跟本人同一技法之后(优先级 −0.5):键仍以 technique: 开头,裁剪引擎按技法层公平分摊
	if(pair){
		(pair.techniqueContexts || []).forEach((item, idx)=>{
			if(!item || !item.content){
				return;
			}
			if(pair.sourceContext && pair.sourceContext.content && item.content === pair.sourceContext.content){
				return;
			}
			layers.push({
				key: `technique:${item.key || idx}@partner`,
				title: `使用技法：${item.title || item.key || `技法 ${idx + 1}`}（对方·${otherName}）`,
				priority: 93 - idx - 0.5,
				content: item.content,
			});
		});
	}
	// 与「系统提示」层去重:「一键应用组合」会把 defaultSystemPrompt 原样写进会话规则,
	// 那份已经在 system 层里了 —— 同一段话再出一层就是重复注入。逐字节包含即跳过。
	const _sysText = `${systemPrompt || ''}`;
	(bundles || []).forEach((bundle)=>{
		const bp = `${bundle.defaultSystemPrompt || ''}`;
		if(bp && (!_sysText || _sysText.indexOf(bp) < 0)){
			layers.push({
				key: `bundle-system:${bundle.id}`,
				title: `组合系统提示：${bundle.name || ''}`,
				priority: 92,
				content: bundle.defaultSystemPrompt,
			});
		}
	});
	(templates || []).forEach((template)=>{
		const text = template && template.format === 'json'
			? [template.instructionText, template.jsonSchema && `JSON Schema：\n${template.jsonSchema}`].filter(Boolean).join('\n\n')
			: (template && (template.instructionText || template.content));
		if(text){
			layers.push({
				key: `template:${template.id}`,
				title: `模版约束：${template.name || ''}`,
				priority: 90,
				content: text,
			});
		}
	});
	const directMaterials = (materials || []).filter((item)=>!item.retrievedOnly);
	directMaterials.forEach((item, idx)=>{
		if(item.extractedText){
			layers.push({
				key: `material:${item.id}`,
				title: `参考资料 ${idx + 1}：${neutralizeLabel(item.name) || '未命名资料'}`,   // 层标题在围栏之外:资料名过中和
				priority: 70,
				content: wrapUntrustedData(item.extractedText, item.name || '未命名资料'),   // 数据围栏
			});
		}
	});
	if(Array.isArray(retrievedChunks) && retrievedChunks.length){
		const retrievedText = buildRetrievedContextText(retrievedChunks);
		if(retrievedText){
			layers.push({
				key: 'retrieved-context',
				title: '检索资料片段',
				priority: 80,
				content: retrievedText,
			});
		}
	}
	// [挂载预算] 近期对话从「硬拿末 10 条」改为 token 预算滚动裁剪:由新往旧收,超预算即止;
	// 保底 4 条(最近两轮问答再长也带上),上限 40 条防级联。短消息会话可带更多轮,
	// 长消息会话不再被 10 条巨文吃穿预算。
	const allVisible = (conversationMessages || []).filter((item)=>item && item.role !== 'system_hidden');
	const HISTORY_TOKEN_BUDGET = 4000;
	const HISTORY_MIN_KEEP = 4;
	const HISTORY_MAX_KEEP = 40;
	const pickedHistory = [];
	let histTokens = 0;
	for(let i = allVisible.length - 1; i >= 0 && pickedHistory.length < HISTORY_MAX_KEEP; i--){
		const m = allVisible[i];
		const t = estimateTextTokens(`${m.content || ''}`);
		if(pickedHistory.length >= HISTORY_MIN_KEEP && histTokens + t > HISTORY_TOKEN_BUDGET){
			break;
		}
		pickedHistory.push(m);
		histTokens += t;
	}
	const visibleHistory = pickedHistory.reverse();
	if(visibleHistory.length){
		layers.push({
			key: 'recent-history',
			title: '最近对话',
			priority: 60,
			content: visibleHistory.map((item)=>`[${item.role}] ${item.content || ''}`).join('\n\n'),
		});
	}
	return layers.map((item)=>({
		...item,
		tokenEstimate: estimateTextTokens(item.content),
	}));
}

// [挂载预算] 旧版部分裁剪 marker（legacy 分支 / 无段结构回退共用，字面与历史输出逐字节一致）。
const LEGACY_CLIP_MARKER = '\n...[已裁剪]';
// fairShare 下每个技法层的保底字数：低于它宁可整层记入 dropped（绝不静默丢）。
const MIN_TECH_KEEP = 600;
// 挥发层键(每轮随问题变化,缓存断点之后;AIAnalysisMain 稳定层指纹同用):不进尾仓、不回压稳定层。
export const VOLATILE_LAYER_KEYS = { 'turn-extra': 1, 'retrieved-context': 1, 'recent-history': 1 };   // turn-extra 随轮变,列挥发
// fairShare 下给非技法的 rest 层（模版/资料/检索/历史）预留的尾仓比例。
const RESERVE_TAIL_RATIO = 0.15;

// [挂载预算] 段对齐裁剪：按 [段] 边界整段收纳（尾注计入预算，产出总长 ≤ budget）；
// 无 [段] 结构时回退字符 slice + 旧 marker（slice 点为 budget 减 marker 长，同样不超预算）。
// 段对齐截断(导出给 cast_technique 复用):有段结构就整段整段地裁,并回报被略去的段名——
// 模型据此可以用 sections 参数只取需要的段,不必让整份快照被拦腰砍在半张表中间。
export function clipContentToBudget(content, budget){
	const sections = splitContentSections(content);
	const hasSectionStructure = sections.some((sec)=>sec.title);
	if(hasSectionStructure){
		const parts = sections.map((sec)=>sec.lines.join('\n'));
		let cut = 0;
		let used = 0;
		for(let i = 0; i < parts.length; i++){
			const add = parts[i].length + (cut > 0 ? 1 : 0);
			if(used + add > budget){
				break;
			}
			used += add;
			cut = i + 1;
		}
		const buildNote = (cutIdx)=>{
			const omitted = sections.slice(cutIdx);
			const names = omitted.slice(0, 3).map((sec)=>sec.title || '前言');
			const extra = omitted.length > 3 ? '等' : '';
			return `\n...[已裁剪:预算不足,略去${omitted.length}段(${names.join('、')}${extra})]`;
		};
		let note = buildNote(cut);
		while(cut > 0 && parts.slice(0, cut).join('\n').length + note.length > budget){
			cut -= 1;
			note = buildNote(cut);
		}
		if(cut > 0){
			return { text: `${parts.slice(0, cut).join('\n')}${note}`, sectionAligned: true, omittedTitles: sections.slice(cut).map((sec)=>sec.title || '前言') };
		}
		// 一段都放不下 → 落到无段结构的字符 slice 保底。
	}
	return {
		text: `${content.slice(0, Math.max(0, budget - LEGACY_CLIP_MARKER.length))}${LEGACY_CLIP_MARKER}`,
		sectionAligned: false,
		omittedTitles: [],
	};
}

// [挂载预算] 裁剪主引擎：返回 { kept, dropped, stats }，kept 即旧 clipContextLayers 的输出位。
// - 快路径（总量 ≤ maxChars，含等号）：全保留，与旧算法逐字节等价。
// - 触界且未开 fairShare：旧贪心逻辑原样（输出逐字节等价），仅把被丢层记进 dropped。
// - 触界且 fairShare===true：mandatory 全额优先 → rest 预留尾仓 → 技法层 max-min 水位公平分摊，
//   被裁技法层段对齐裁剪；预算连保底都不够时整层移入 dropped（有账可查，绝不静默）。
export function clipContextLayersDetailed(layers, options = {}){
	const maxChars = options.maxChars || DEFAULT_CONTEXT_CHAR_LIMIT;
	const sorted = (layers || []).slice(0).sort((a, b)=>b.priority - a.priority);
	// 与旧算法同口径：trim 后计长；空层直接忽略（不入 kept 也不入 dropped）。
	const nonEmpty = [];
	sorted.forEach((item)=>{
		const content = `${item.content || ''}`.trim();
		if(content){
			nonEmpty.push({ ...item, content });
		}
	});
	const totalRaw = nonEmpty.reduce((sum, item)=>sum + item.content.length, 0);
	const finalize = (kept, dropped)=>{
		const byKey = {};
		nonEmpty.forEach((item)=>{
			byKey[item.key] = {
				title: item.title,
				raw: item.content.length,
				kept: 0,
				clipped: false,
				dropped: false,
			};
		});
		kept.forEach((item)=>{
			if(byKey[item.key]){
				byKey[item.key].kept = item.content.length;
				byKey[item.key].clipped = !!item.clipped;
			}
		});
		dropped.forEach((item)=>{
			if(byKey[item.key]){
				byKey[item.key].dropped = true;
			}
		});
		return {
			kept,
			dropped,
			stats: {
				maxChars,
				totalRaw,
				totalKept: kept.reduce((sum, item)=>sum + item.content.length, 0),
				keptCount: kept.length,
				clippedCount: kept.filter((item)=>item.clipped).length,
				droppedCount: dropped.length,
				fairShare: options.fairShare === true,
				byKey,
			},
		};
	};
	// 快路径：总量未触界（含等号，与旧 nextChars <= maxChars 语义一致）→ 全保留。
	if(totalRaw <= maxChars){
		return finalize(nonEmpty.map((item)=>({ ...item, clipped: false })), []);
	}
	if(options.fairShare !== true){
		// legacy 分支：旧贪心实现体原样（kept 输出逐字节等价），只额外把被丢层记账。
		const kept = [];
		const dropped = [];
		let totalChars = 0;
		sorted.forEach((item)=>{
			const content = `${item.content || ''}`.trim();
			if(!content){
				return;
			}
			const nextChars = totalChars + content.length;
			if(nextChars <= maxChars){
				kept.push({
					...item,
					content,
					clipped: false,
				});
				totalChars = nextChars;
				return;
			}
			if(kept.length === 0 || item.priority >= 90){
				const remain = Math.max(0, maxChars - totalChars);
				if(remain > 120){
					kept.push({
						...item,
						content: `${content.slice(0, remain)}${LEGACY_CLIP_MARKER}`,
						clipped: true,
					});
					totalChars = maxChars;
					return;
				}
			}
			dropped.push(item);
		});
		return finalize(kept, dropped);
	}
	// fairShare 分支。
	const isTechnique = (item)=>typeof item.key === 'string' && item.key.indexOf('technique:') === 0;
	// [双盘挂载] pair: 开头 = 两人之间的数据层(西洋合盘数据):有技法层时算技法层(一起按水位裁);没挂技法时与两份整份快照
	//   一起分摊(否则两份快照先把余量吃光、合盘数据整层丢)。单盘没有 pair: 层,以下分组与此前逐字节相同。
	const isPairData = (item)=>typeof item.key === 'string' && item.key.indexOf('pair:') === 0;
	const hasTechnique = nonEmpty.some(isTechnique);
	const pairDataInSourceSplit = !hasTechnique && nonEmpty.some((item)=>item.key === 'partner-source');
	const mandatory = nonEmpty.filter((item)=>!isTechnique(item) && !isPairData(item) && item.priority >= 94);
	const techLayers = nonEmpty.filter((item)=>isTechnique(item) || (isPairData(item) && !pairDataInSourceSplit));
	const restLayers = nonEmpty.filter((item)=>!isTechnique(item) && !isPairData(item) && item.priority < 94);
	const pairDataLayers = pairDataInSourceSplit ? nonEmpty.filter(isPairData) : [];
	const kept = [];
	const dropped = [];
	let used = 0;
	// 1) mandatory（系统提示/案例前提/排盘规则）逐层收纳；超限沿用旧部分裁剪语义。
	// [双盘挂载] 两张盘的案例前提(未挂技法时 = 各自整份快照)按水位公平分摊余量,不让本人那份先吃光、对方整层丢;
	//   没有对方层时这一步不存在,mandatory 照旧逐层收纳(逐字节不变)。
	const PAIR_SOURCE_KEYS = { source: 1, 'partner-source': 1 };
	const pairSources = mandatory.some((item)=>item.key === 'partner-source')
		? mandatory.filter((item)=>PAIR_SOURCE_KEYS[item.key]).concat(pairDataLayers) : [];
	(pairSources.length ? mandatory.filter((item)=>!PAIR_SOURCE_KEYS[item.key]) : mandatory).forEach((item)=>{
		if(used + item.content.length <= maxChars){
			kept.push({ ...item, clipped: false });
			used += item.content.length;
			return;
		}
		const remain = Math.max(0, maxChars - used);
		if(remain > 120){
			// 案例前提层(key 'source';未挂技法时=整份星盘快照)超预算改按段对齐裁剪并列出略去段名
			// (与技法层同 clipContentToBudget);此前字符 slice 在表格中间截断且不告诉模型略去了什么。其余 mandatory 层沿旧语义。
			if(item.key === 'source'){
				const cut = clipContentToBudget(item.content, remain);
				kept.push({ ...item, content: cut.text, clipped: true });
				used += cut.text.length;
				return;
			}
			kept.push({ ...item, content: `${item.content.slice(0, remain)}${LEGACY_CLIP_MARKER}`, clipped: true });
			used = maxChars;
			return;
		}
		dropped.push(item);
	});
	if(pairSources.length){
		let left = Math.max(0, maxChars - used);
		let n = pairSources.length;
		pairSources.slice(0).sort((a, b)=>a.content.length - b.content.length).forEach((item)=>{
			const share = n > 0 ? Math.floor(left / n) : 0;
			n -= 1;
			if(item.content.length <= share){
				kept.push({ ...item, clipped: false });
				left -= item.content.length;
				return;
			}
			if(share > 120){
				const cut = clipContentToBudget(item.content, share);
				kept.push({ ...item, content: cut.text, clipped: true });
				left -= cut.text.length;
				return;
			}
			dropped.push(item);
		});
		used = maxChars - left;
	}
	// 2) rest 层尾仓预留：技法层不许吃光全部余量。
	// 尾仓只按**稳定** rest 层计;检索片段/最近对话两个挥发层不进尾仓也不回压技法层——
	// 此前尾仓含挥发层总长,检索片段每轮随问题长短变化 → 技法层水位跨段边界、资料层被挤掉 → 稳定前缀漂移、前缀缓存失效。
	const stableRest = restLayers.filter((item)=>!VOLATILE_LAYER_KEYS[item.key]);
	const volatileRest = restLayers.filter((item)=>!!VOLATILE_LAYER_KEYS[item.key]);
	const restTotal = stableRest.reduce((sum, item)=>sum + item.content.length, 0);
	const reserveTail = Math.min(restTotal, Math.floor(maxChars * RESERVE_TAIL_RATIO));
	const techBudget = Math.max(0, maxChars - used - reserveTail);
	// 3) 技法层：预算连每层保底 min(len, MIN_TECH_KEEP) 都给不起时，从 idx 最大者
	//    （priority 最低=挂载顺序最后）整层移入 dropped，直到保底可满足。
	const minNeedOf = (arr)=>arr.reduce((sum, item)=>sum + Math.min(item.content.length, MIN_TECH_KEEP), 0);
	let activeTech = techLayers.slice(0);
	while(activeTech.length && minNeedOf(activeTech) > techBudget){
		let worst = activeTech[0];
		activeTech.forEach((item)=>{
			if(item.priority < worst.priority){
				worst = item;
			}
		});
		activeTech = activeTech.filter((item)=>item !== worst);
		dropped.push(worst);
	}
	// max-min 水位公平分摊：按 content.length 升序，短层全保，长层按水位（不低于保底）截。
	const techAsc = activeTech.slice(0).sort((a, b)=>a.content.length - b.content.length);
	let budgetLeft = techBudget;
	let layersLeft = techAsc.length;
	techAsc.forEach((item)=>{
		const share = layersLeft > 0 ? Math.floor(budgetLeft / layersLeft) : 0;
		const take = Math.min(item.content.length, Math.max(share, MIN_TECH_KEEP));
		const alloc = Math.min(take, budgetLeft);
		if(alloc >= item.content.length){
			kept.push({ ...item, clipped: false });
			budgetLeft -= item.content.length;
		}else{
			const cut = clipContentToBudget(item.content, alloc);
			kept.push({ ...item, content: cut.text, clipped: true });
			budgetLeft -= cut.text.length;
		}
		layersLeft -= 1;
	});
	used += techBudget - budgetLeft;
	// 4) rest 层用余量（尾仓+技法层没花完的水位）按旧贪心顺序（priority 降序）收纳，
	//    装不下按旧语义部分裁剪或记入 dropped。稳定 rest 层先收纳(不受挥发层体积影响),挥发层最后用剩余额度、超额只裁自身。
	stableRest.forEach((item)=>{
		if(used + item.content.length <= maxChars){
			kept.push({ ...item, clipped: false });
			used += item.content.length;
			return;
		}
		if(kept.length === 0 || item.priority >= 90){
			const remain = Math.max(0, maxChars - used);
			if(remain > 120){
				kept.push({ ...item, content: `${item.content.slice(0, remain)}${LEGACY_CLIP_MARKER}`, clipped: true });
				used = maxChars;
				return;
			}
		}
		dropped.push(item);
	});
	volatileRest.forEach((item)=>{
		if(used + item.content.length <= maxChars){
			kept.push({ ...item, clipped: false });
			used += item.content.length;
			return;
		}
		const remain = Math.max(0, maxChars - used);
		if(remain > 120){
			// 含裁剪标记不越界(挥发层是最后一道,总量硬约束由它兜底)
			kept.push({ ...item, content: `${item.content.slice(0, Math.max(0, remain - LEGACY_CLIP_MARKER.length))}${LEGACY_CLIP_MARKER}`, clipped: true });
			used = maxChars;
			return;
		}
		dropped.push(item);
	});
	// 5) 输出顺序 = 原 priority 降序（稳定排序：同 priority 保持 技法层在 rest 层前，与旧序一致）。
	kept.sort((a, b)=>b.priority - a.priority);
	return finalize(kept, dropped);
}

export function clipContextLayers(layers, options = {}){
	return clipContextLayersDetailed(layers, options).kept;
}

// 测试预言机(主页组件各算一遍 join,本函数只锁 prompt 结构;零生产消费方)
export function buildPromptContextForTests({
	sourceContext,
	techniqueContexts,
	materials,
	bundles,
	templates,
	retrievedChunks,
	conversationMessages,
	systemPrompt,
	maxChars,
	fairShare,
}) {
	const layers = buildContextLayers({
		sourceContext,
		techniqueContexts,
		materials,
		bundles,
		templates,
		retrievedChunks,
		conversationMessages,
		systemPrompt,
	});
	const clippedLayers = clipContextLayers(layers, { maxChars, fairShare });
	return clippedLayers.map((item)=>`${item.title}\n${item.content}`).join('\n\n').trim();
}
