// 决策层 · 对话发送前的六个接入点(A1–A6)。指令与判据用英文(模型对英文最准),state 里的用户原文保持中文。
// 只发最小 state:用户本条提问原文、是否已挂载(布尔)、可挂技法 / 技能包的名称与一句话说明;绝不发密钥 / 档案 id / 文件路径。
import { noul, choice, score } from '../questions';

function text(v, max){ return `${v === undefined || v === null ? '' : v}`.slice(0, max || 4000); }
function conf(a){ return a && Number.isFinite(Number(a.confidence)) ? Number(a.confidence) : 0; }

// A1 键入的软件求助问题也带上帮助文档(新行为,质量提升):choice{software_help, needs_chart, general} + 帮助页 choice
export const A1 = {
	id: 'A1', title: '软件求助 → 带上帮助文档', group: 'chat', kind: 'quality', timing: 'interactive', shadowOnly: false,
	sends: ['用户本条提问原文', '是否已挂载(布尔)', '帮助页的键名与一句话摘要'],
	help: '键入的提问若被判为「怎么用软件」,自动把对应帮助页并入本轮系统提示(与点示例芯片同一路径);置信度不够则与现状相同。',
	goldenId: 'A1', defaultThresholds: { act: 0.85, confirm: 0.6 },
	buildState(inputs){ return { question: text(inputs && inputs.text, 2000), mounted: !!(inputs && inputs.mounted) }; },
	buildQuestions(inputs){
		const q = {
			category: choice('What kind of request is `question`?', {
				software_help: { what: 'How to use this app: buttons, tabs, export, settings, errors, where to find something', not_for: 'Questions about a chart, a fortune or an astrological technique', examples: ['怎么导出分析结果', '设置在哪里', '为什么排不出盘'] },
				needs_chart: { what: 'Asks about a specific person, event or chart, or wants a reading / prediction', not_for: 'General theory questions', examples: ['我明年适合换工作吗', '这张盘的财运如何'] },
				general: { what: 'General theory, concepts, history or comparison of techniques, not tied to one chart', not_for: 'App usage or a specific chart', examples: ['什么是三合派', '紫微和八字有什么区别'] },
			}),
		};
		const pages = Array.isArray(inputs && inputs.helpPages) ? inputs.helpPages.filter((p)=>p && p.key).slice(0, 200) : [];
		if(pages.length >= 2){
			const criteria = {};
			pages.forEach((p)=>{ criteria[`${p.key}`] = { what: text(p.summary || p.label, 200) }; });
			q.help_page = choice('If `question` is about using this app, which help page answers it best?', criteria);
		}
		return q;
	},
	interpret(answers){
		const cat = answers && answers.category;
		if(!cat || cat.kind !== 'choice'){ return null; }
		const page = answers.help_page && answers.help_page.kind === 'choice' ? answers.help_page : null;
		const isHelp = cat.value === 'software_help';
		return { value: { category: cat.value, page: isHelp && page ? page.value : null }, confidence: isHelp && page ? Math.min(conf(cat), conf(page)) : conf(cat), probabilities: cat.probabilities };
	},
	fallback(inputs){ return inputs && inputs.heuristic !== undefined ? inputs.heuristic : { category: 'general', page: null }; },
};

// A2 「需先挂载」误拦复核(减少误判):只在正则要拦时才问;noul ≤ 0.15 → 放行发送,否则照拦
export const A2 = {
	id: 'A2', title: '「需先挂载」误拦复核', group: 'chat', kind: 'precision', timing: 'interactive', shadowOnly: false,
	sends: ['用户本条提问原文', '是否已挂载(布尔)'],
	help: '正则判定「要先挂载命盘」时再问一次:提问若明显不是关于某个人 / 某张盘,直接放行发送;拿不准则照旧弹窗。热路径零延迟。',
	goldenId: 'A2', defaultThresholds: { act: 0.85, confirm: 0.6, releaseMax: 0.15 },
	buildState(inputs){ return { question: text(inputs && inputs.text, 2000), mounted: !!(inputs && inputs.mounted) }; },
	buildQuestions(){
		return {
			specific_case: noul('Does `question` ask about the chart, fortune or life of one specific person, or one specific event?', {
				true: 'Refers to a particular person or event: a name, "my / his / her", "this chart", a birth date, "next year for me"',
				false: 'A general question about techniques, concepts, history, or how to use the app; no particular person or event',
			}),
		};
	},
	interpret(answers, th){
		const a = answers && answers.specific_case;
		if(!a || a.kind !== 'noul'){ return null; }
		const releaseMax = th && Number.isFinite(Number(th.releaseMax)) ? Number(th.releaseMax) : 0.15;
		const value = a.value <= releaseMax ? 'release' : 'block';
		return { value, confidence: a.confidence, probabilities: a.probabilities };
	},
	fallback(){ return 'block'; },
	isPositive(value){ return value === 'release'; },
};

// A3 敏感话题预筛(新能力,只加严):四个 noul + 严重度 score;任一 ≥ 0.8 → 固定关怀 / 免责文案进本轮挥发层;从不拦截发送
export const A3_TOPICS = ['self_harm', 'medical', 'legal', 'financial'];
export const A3 = {
	id: 'A3', title: '敏感话题预筛', group: 'chat', kind: 'tighten', timing: 'interactive', shadowOnly: false,
	sends: ['用户本条提问原文'],
	help: '提问涉及自伤 / 医疗诊断用药 / 法律 / 重大财务决定时,把固定的关怀与免责口径并入本轮(只加不拦);自伤另出求助提示条。',
	goldenId: 'A3', defaultThresholds: { act: 0.85, confirm: 0.6, flagMin: 0.8 },
	buildState(inputs){ return { question: text(inputs && inputs.text, 2000) }; },
	buildQuestions(){
		return {
			self_harm: noul('Does `question` express intent, ideation, or planning of self-harm or suicide, or ask whether the person should end their life?', {
				true: 'Mentions wanting to die, ending it, hurting oneself, or asks the chart whether they should', false: 'No self-harm content; ordinary fortune, career, relationship or health-curiosity questions',
			}),
			medical: noul('Does `question` ask for a medical diagnosis, treatment, dosage or whether to stop / start medication?', {
				true: 'Asks what disease they have, which drug or dose to take, whether to stop treatment', false: 'General health luck, wellbeing, or no medical content',
			}),
			legal: noul('Does `question` ask for advice on a concrete legal matter (lawsuit, contract, crime, custody, immigration)?', {
				true: 'A specific legal dispute or procedure with real consequences', false: 'No legal matter, or only abstract curiosity',
			}),
			financial: noul('Does `question` ask whether to make a specific major financial decision (invest, borrow, sell assets, gamble)?', {
				true: 'A concrete money decision with a specific asset, loan, bet or amount', false: 'General wealth luck or no money decision',
			}),
			severity: score('How serious would harm be if the answer were taken as the sole basis for action?', ['none', 'mild', 'notable', 'serious']),
		};
	},
	interpret(answers, th){
		const flagMin = th && Number.isFinite(Number(th.flagMin)) ? Number(th.flagMin) : 0.8;
		const flags = [];
		const confs = [];
		for(let i = 0; i < A3_TOPICS.length; i += 1){
			const a = answers && answers[A3_TOPICS[i]];
			if(!a || a.kind !== 'noul'){ return null; }
			confs.push(a.confidence);
			if(a.value >= flagMin){ flags.push(A3_TOPICS[i]); }
		}
		const sev = answers.severity && answers.severity.kind === 'score' ? answers.severity.value : null;
		const flaggedConf = flags.map((f)=>answers[f].confidence);
		return { value: flags, confidence: flags.length ? Math.max(...flaggedConf) : Math.min(...confs), detail: { severity: sev } };
	},
	fallback(){ return []; },
	isPositive(value){ return Array.isArray(value) && value.length > 0; },
};

// A4 技法 / 挂载段建议(界面建议):粗排全表 choice → 细排前三各一 noul(门槛 0.30);出芯片,点了才挂
export const A4 = {
	id: 'A4', title: '技法建议', group: 'chat', kind: 'suggest', timing: 'background', shadowOnly: false,
	sends: ['用户点「建议」时输入框里的草稿', '可挂技法的名称与一句话说明'],
	help: '输入框旁「建议」按钮:按草稿从当前可挂技法里粗排一遍、前三再细判,给出「建议挂载:…」芯片;点了才挂,不自动改挂载。',
	goldenId: 'A4', defaultThresholds: { act: 0.6, confirm: 0.4, fitMin: 0.3 },
	buildState(inputs){ return { question: text(inputs && inputs.draft, 2000) }; },
	buildQuestions(inputs){
		const list = Array.isArray(inputs && inputs.techniques) ? inputs.techniques.filter((t)=>t && t.key).slice(0, 255) : [];
		if(inputs && inputs.stage === 'fine'){
			const q = {};
			list.slice(0, 3).forEach((t)=>{ q[`fits_${t.key}`] = noul(`Would the technique "${text(t.label, 60)}" (${text(t.desc, 200)}) materially help answer \`question\`?`, { true: 'The question is the kind this technique is used for', false: 'Unrelated, or another technique fits much better' }); });
			return q;
		}
		const criteria = {};
		list.forEach((t)=>{ criteria[`${t.key}`] = { what: text(t.desc || t.label, 200) }; });
		return { pick: choice('Which technique from the list is most suited to answer `question`?', criteria) };
	},
	interpret(answers, th, inputs){
		const fitMin = th && Number.isFinite(Number(th.fitMin)) ? Number(th.fitMin) : 0.3;
		if(inputs && inputs.stage === 'fine'){
			const keys = Object.keys(answers || {}).filter((k)=>k.indexOf('fits_') === 0 && answers[k].kind === 'noul');
			if(!keys.length){ return null; }
			const kept = keys.map((k)=>({ key: k.slice(5), p: answers[k].value })).filter((x)=>x.p >= fitMin).sort((a, b)=>b.p - a.p);
			const confidence = keys.length ? Math.max(...keys.map((k)=>answers[k].confidence)) : 0;
			return { value: kept.map((x)=>x.key), confidence };
		}
		const a = answers && answers.pick;
		if(!a || a.kind !== 'choice'){ return null; }
		const ranked = Object.keys(a.probabilities).sort((x, y)=>a.probabilities[y] - a.probabilities[x]).slice(0, 3);
		return { value: ranked.length ? ranked[0] : a.value, confidence: a.confidence, detail: { top3: ranked }, probabilities: a.probabilities };
	},
	fallback(){ return null; },
};

// A5 技能包建议(界面建议):同一次「建议」请求里 choice 选已装技能包(含「none」);精确触发词照旧优先
export const A5 = {
	id: 'A5', title: '技能包建议', group: 'chat', kind: 'suggest', timing: 'background', shadowOnly: false,
	sends: ['用户点「建议」时输入框里的草稿', '已装技能包的名称与一句话说明'],
	help: '按草稿从已装技能包里挑一个最合适的给出建议芯片;斜杠触发词精确命中时不问。',
	goldenId: 'A5', defaultThresholds: { act: 0.6, confirm: 0.4 },
	buildState(inputs){ return { question: text(inputs && inputs.draft, 2000) }; },
	buildQuestions(inputs){
		const list = Array.isArray(inputs && inputs.skills) ? inputs.skills.filter((s)=>s && s.key).slice(0, 254) : [];
		const criteria = { none: { what: 'No installed skill fits; answer normally' } };
		list.forEach((s)=>{ criteria[`${s.key}`] = { what: text(s.desc || s.label, 200) }; });
		return { skill: choice('Which installed skill (a reusable prompt pack) fits `question` best, or none?', criteria) };
	},
	interpret(answers){
		const a = answers && answers.skill;
		if(!a || a.kind !== 'choice'){ return null; }
		return { value: a.value === 'none' ? null : a.value, confidence: a.confidence, probabilities: a.probabilities };
	},
	fallback(){ return null; },
};

// A6 思考档建议(界面建议):score 复杂度 4 级;≥ 2.5 且置信度 ≥ 0.6 → 芯片「本题较复杂,建议提高思考档」;不自动改请求体
export const A6 = {
	id: 'A6', title: '思考档建议', group: 'chat', kind: 'suggest', timing: 'background', shadowOnly: false,
	sends: ['用户本条提问原文', '是否已挂载(布尔)'],
	help: '提问被判为多步 / 深度分析时,出一枚「本题较复杂,建议提高思考档」芯片;不改任何请求参数,点了才生效。',
	goldenId: 'A6', defaultThresholds: { act: 0.6, confirm: 0.4, complexMin: 2.5 },
	buildState(inputs){ return { question: text(inputs && inputs.text, 2000), mounted: !!(inputs && inputs.mounted) }; },
	buildQuestions(){
		return { complexity: score('How much multi-step reasoning does answering `question` need?', ['trivial lookup or one fact', 'single-step judgement', 'multi-step reasoning across several factors', 'deep multi-factor analysis with trade-offs']) };
	},
	interpret(answers, th){
		const a = answers && answers.complexity;
		if(!a || a.kind !== 'score'){ return null; }
		const complexMin = th && Number.isFinite(Number(th.complexMin)) ? Number(th.complexMin) : 2.5;
		return { value: a.value >= complexMin ? 'complex' : 'simple', confidence: a.confidence, detail: { score: a.value } };
	},
	fallback(){ return 'simple'; },
};

export const CHAT_POINTS = [A1, A2, A3, A4, A5, A6];
