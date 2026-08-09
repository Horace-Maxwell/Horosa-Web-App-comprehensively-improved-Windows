// v1.21 流式 markdown 容错修正。
//
// 现象：AI 流式输出是逐字 token 流，偶尔在句末之后下一个 token 直接是 `#` 而非 `\n\n#`，
// 形成 `…由自身决策催生的下一波"伏"。。### 事业方向` 这种「标题紧贴上段末尾」的串行。
// marked 严格按 CommonMark 规范（ATX 标题需另起行），紧贴时会把整行渲染成纯文本，子段标题丢失。
//
// 本 helper 在「渲染前 / 导出前」对原文做最小容错修正：
//  1) 句末/收尾符后紧贴的标题、或 3 个及以上 # 的明确子段标题 → 强插空行。
//  2) 异常省略号收缩。
// 关键安全约束：
//  - 只认 `#` 后带空白的真标题；单/双 `#` 仅在句末符之后才补空行 —— 不误伤 `C#`、`F#` 等标识符。
//  - 代码围栏 ``` 内的内容原样保留，绝不改动（避免误伤示例代码里的 `#` 注释、`-` 等）。
//  - 已经另起一行的标题（前面是 `\n`）不重复加空行。

// ── [E11] 行内强调记号修复(共享件:全部 AI 文本消费面同一条渲染与导出链)──────────────
// 背景:LLM 产出的 `**` 记号有一批稳定的畸形形态,四条消费链(marked / 导出 HTML inlineMd /
// docx mdInlineToRuns / 矢量 PDF mdInlineSegments)对它们的表现各不相同,轻则不加粗、
// 重则把字面星号原样渲出。本函数在渲染与导出的共同上游一次性修平,四链同时受益。
//
// 修的五类(全部实测复现过):
//   ① `** 文本 **` / `** 文本**` / `**文本 **`  —— 记号内侧带空格,CommonMark 下不成粗体
//   ② `__文本__` 中文夹用                        —— 下划线不允许词内强调,中文语境必失效
//   ③ `＊＊文本＊＊` 全角星号
//   ④ `**上半\n下半**` 跨行粗体                  —— marked 能渲,导出三链逐行解析必断
//   ⑤ 段内落单的一枚 `**`                        —— 半截记号字面露出
// 铁律:代码围栏由 normalizeMarkdown 切分挡在外面;行内码与 URL 在本函数内占位保护
//      (`__init__`、`a ** b` 这类非排版语义一律不得误伤)。

// 一对 `**` 之内的内容:把内侧空白挪到记号外侧;跨行则逐行各自闭合(渲染结果等价,
// 但导出侧的逐行解析器才认得)。core 为空/纯空白时原样返回,绝不制造 `****`。
function wrapBoldCore(core){
	if(core.indexOf('\n') < 0){
		return `**${core}**`;
	}
	return core.split('\n').map((ln)=>{
		const m = ln.match(/^([ \t]*)([\s\S]*?)([ \t]*)$/);
		return m[2] ? `${m[1]}**${m[2]}**${m[3]}` : ln;
	}).join('\n');
}

// 落单的一枚 `**` + 其后余文:按「像不像开粗记号」分三路处置。
// 绝不把整段闭成粗体(与 REPORT_EMPHASIS_RULE「严禁整段连续加粗」同口径)。
function fixDanglingBold(rest){
	const s = `${rest}`;
	// 后面紧跟空白或星号 = 不是开粗记号(如 `a ** b`、`* * *` 残形):原样留,不动用户文字。
	if(!/^[^\s*]/.test(s)){ return `**${s}`; }
	// ①「引导词：」形态 —— 正是重点标注规范要求的条目形态,闭在冒号之前。
	const lead = s.match(/^([^\s：:*][^：:*\n]{0,23})([：:])/);
	if(lead){ return `**${lead[1]}**${lead[2]}${s.slice(lead[0].length)}`; }
	// ②余下首行很短 —— 视为一个短强调,闭在行尾。
	const firstLine = s.split('\n')[0];
	if(firstLine.trim() && firstLine.length <= 24){
		return `**${firstLine.replace(/[ \t]+$/, '')}**${s.slice(firstLine.length)}`;
	}
	// ③长尾 —— 剥掉记号(宁可不加粗,也不让半截星号露出、更不让整段变粗)。
	return s;
}

// [E11-N] 解嵌套加粗。真机 A/B 实测抓到的第一大类「写了加粗却不粗」:
//   `**判断句…（如 **2028(戊申)年**、**2029(己酉)年**）…**`
// 病根是**本仓自己的重点标注规则**——②要求判断句加粗、③要求一切时间窗加粗,判断句里含时间窗时
// 模型两条都照做就嵌套了。CommonMark 无 `**` 嵌套,结果是**时间窗不粗、中间的顿号反而粗**;
// 更坏的是四链在此形状上不一致(marked 认第一个内层、mdInlineSegments 不认)。
// 判据 = **完整的 CommonMark flanking**(含标点子句),必须与 marked 的配对结果一致。
// 🔴 只判「前一字符非空白 ⇒ 可收尾」是不够的:`**综上,**2028年**…**` 里那个 `**` 前面是逗号(标点)、
//    后面是数字,按规范**只能开启不能收尾** —— marked 因此解成嵌套,而简化判据认不出来,
//    结果 marked 全粗、docx/PDF 只粗两头(实测四链分叉)。踩过一次,故此处照抄规范原文。
// 处置 = 摘掉**最外层**那一对(留内层)。依据是规范本身:③「一切时间窗加粗、不得遗漏」是硬要求,
// 而整句连粗恰恰被「严禁整段连续加粗」所禁 —— 保内层同时满足两条,反之两条都破。
const MDP_WS = new RegExp("[ \\t\\n\\v\\f\\r\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]");
// Unicode 标点(刻意不引 `\\p{P}`:仓内零使用,避免 babel/WebView 差异)。ASCII + 通用 + CJK + 全角。
const MDP_PUNCT = new RegExp("[\\u0021-\\u002f\\u003a-\\u0040\\u005b-\\u0060\\u007b-\\u007e"
	+ "\\u2010-\\u2027\\u2030-\\u205e"                                  // ‐–—…‰′″ 等通用标点
	+ "\\u3001-\\u3003\\u3008-\\u3011\\u3014-\\u301f"                // 、。〃〈〉《》「」『』【】〔〕〝〞
	+ "\\uff01-\\uff0f\\uff1a-\\uff20\\uff3b-\\uff40\\uff5b-\\uff65]");  // ！，：；？（）等全角
function unnestBoldLine(line){
	const pos = [];
	for(let i = line.indexOf('**'); i >= 0; i = line.indexOf('**', i + 2)){ pos.push(i); }
	if(pos.length < 4 || pos.length % 2 !== 0){ return line; }   // 奇数枚交给 fixDanglingBold,不在此处理
	const prevOf = (i)=>(i > 0 ? line[i - 1] : '');              // 行首/行尾按空白论(同规范)
	const nextOf = (i)=>(i + 2 < line.length ? line[i + 2] : '');
	const isWs = (c)=>(c === '' || MDP_WS.test(c));
	const isPn = (c)=>(c !== '' && MDP_PUNCT.test(c));
	// left-flanking:后不接空白,且(后不是标点 或 前是空白/标点)
	const canOpen = (i)=>{ const n = nextOf(i), p = prevOf(i);
		return !isWs(n) && (!isPn(n) || isWs(p) || isPn(p)); };
	// right-flanking:前不接空白,且(前不是标点 或 后是空白/标点)
	const canClose = (i)=>{ const p = prevOf(i), n = nextOf(i);
		return !isWs(p) && (!isPn(p) || isWs(n) || isPn(n)); };
	let depth = 0, nested = false;
	for(const i of pos){
		if(depth > 0 && canClose(i)){ depth--; continue; }
		if(canOpen(i)){ depth++; if(depth > 1){ nested = true; } }
	}
	const first = pos[0], last = pos[pos.length - 1];
	if(!nested || !canOpen(first) || !canClose(last)){ return line; }
	return line.slice(0, first) + line.slice(first + 2, last) + line.slice(last + 2);
}

// 段内按 `**` 出现次序两两配对:奇数索引段=一对之内,偶数索引段=一对之外;
// 次数为奇数时最后一枚落单,交 fixDanglingBold。(嵌套已由 unnestBoldLine 在上游解掉。)
function repairBoldPairs(block){
	const parts = block.split('**');
	const n = parts.length - 1;
	if(n < 1){ return block; }
	const paired = n - (n % 2);
	let out = parts[0];
	for(let i = 1; i <= paired; i++){
		const seg = parts[i];
		if(i % 2 === 0){ out += seg; continue; }        // 一对之外:原样
		const m = seg.match(/^([ \t]*)([\s\S]*?)([ \t]*)$/);
		if(!m[2]){ out += `**${seg}**`; continue; }      // 空内容:原样,不造 ****
		// 内侧空白是记号残渣,一律丢弃;仅当丢弃会让两侧词粘连时才在记号外补一个半角空格
		// (**绝不**把空白挪到行首——那会改掉列表续行的缩进语义)。
		const after = `${parts[i + 1] == null ? '' : parts[i + 1]}`;
		const leadOut = (m[1] && out && !/[\s]$/.test(out)) ? ' ' : '';
		const tailOut = (m[3] && after && !/^[\s]/.test(after)) ? ' ' : '';
		out += `${leadOut}${wrapBoldCore(m[2])}${tailOut}`;
	}
	if(n % 2 === 1){ out += fixDanglingBold(parts.slice(paired + 1).join('**')); }
	return out;
}

export function repairInlineEmphasis(text){
	if(!text && text !== 0){ return ''; }
	let t = `${text}`;
	if(t.indexOf('*') < 0 && t.indexOf('_') < 0 && t.indexOf('＊') < 0){ return t; }   // 快路径
	// 行内码与 URL 内的记号不是排版记号,占位保护(与 fixSegment 的 ~ 步同款手法)。
	const keep = [];
	t = t.replace(/(`[^`\n]*`)|(\bhttps?:\/\/[^\s)]+)/g, (m0)=>{ keep.push(m0); return `\u0000M${keep.length - 1}\u0000`; });
	// ③全角星号成对 → 半角(单枚全角星号是装饰符,不动)
	t = t.replace(/＊＊([^＊\n]+?)＊＊/g, '**$1**');
	// ②`__中文__` → `**中文**`:仅在内容含汉字时转,`__init__` 这类标识符不误伤
	t = t.replace(/__([^_\n]*[\u3400-\u9FFF\uF900-\uFAFF][^_\n]*)__/g, '**$1**');
	// [E11-N] 解嵌套必须在配对修复**之前**:repairBoldPairs 是「顺序配对」模型,先跑它会把
	// `**判断句…**时间窗**…**` 整成「散文粗、时间窗不粗」—— 正好与规范要求相反(实测如此)。
	t = t.split('\n').map(unnestBoldLine).join('\n');
	// ①④⑤按段(空行分隔)配对修复 —— 跨行粗体要在同段内才配得上对
	t = t.split(/(\n[ \t]*\n)/).map((blk, i)=> (i % 2 === 1 ? blk : repairBoldPairs(blk))).join('');
	return t.replace(/\u0000M(\d+)\u0000/g, (_, i)=>keep[Number(i)]);
}

function fixSegment(s){
	let t = `${s}`;
	// 1a. 标题紧贴在句末 / 引号 / 括号等收尾符之后（流式粘连，如 `。。### 事业方向`）→ 插空行。
	//     收尾符集合：中英文句末标点 + 右引号/右括号/右书名号。
	t = t.replace(/([。！？!?.”’"』」）)\]】])(#{1,6}[ \t])/g, '$1\n\n$2');
	// 1b. 3~6 个 # 的子段标题紧贴非换行字符 → 插空行。
	//     **前导字符必须排除 `#`**：否则 #### / ##### 这类 4+ 级标题会被「首个 # + 余下 ###」
	//     误拆成「单独一行 # + ### 标题」(v1.21 真实事故)。C#/F# 只有 1 个 # 也不会命中；
	//     已另起行的标题前面是 \n，[^\n#] 不匹配，不会重复加。
	t = t.replace(/([^\n#])(#{3,6}[ \t])/g, '$1\n\n$2');
	// 1c. 清掉只有 # 没有标题文字的孤立整行(AI 噪声 / 历史误拆残留),防被渲染成字面 "#"。
	t = t.replace(/(^|\n)[ \t]*#{1,6}[ \t]*(?=\n|$)/g, '$1');
	// 2. 异常省略号收缩：句末符流式重复 / 半截省略号。
	t = t.replace(/。{3,}/g, '。。');
	t = t.replace(/\.{4,}/g, '...');
	// 3. ~ / ～ → 短横线 -：Markdown(GFM) 下成对 ~ 触发删除线(strikethrough),报告里年龄/年份范围
	//    (如 25~34岁)被整段划掉。报告正文无删除线语义,统一替换为短横线。
	//    (代码围栏 ``` 段已被 normalizeMarkdown 整体跳过、不进本函数,代码里的 ~ 不受影响。)
	//    [E5] 行内代码 `…` 与 URL 内的 ~ 语义有效(路径/近似号),占位保护后再替换、末了回填。
	const keep = [];
	t = t.replace(/(`[^`\n]*`)|(\bhttps?:\/\/[^\s)]+)/g, (m0)=>{ keep.push(m0); return `\u0000K${keep.length - 1}\u0000`; });
	t = t.replace(/[~～]/g, '-');
	t = t.replace(/\u0000K(\d+)\u0000/g, (_, i)=>keep[Number(i)]);
	// 4. [E11] 行内强调记号修复放最后:上面 1a/1b 已把粘连标题拆成独立行,此时的段落边界才是真的。
	return repairInlineEmphasis(t);
}

// 修正流式 markdown 中「标题紧贴上段末尾」等串行问题，返回可被 marked 正确解析的文本。
// 代码围栏 ``` 内不处理。空输入返回空串。
export function normalizeMarkdown(text){
	if(!text && text !== 0){
		return '';
	}
	const src = `${text}`;
	if(src.indexOf('```') < 0){
		// 无代码围栏：整段处理，省去切分。
		return fixSegment(src);
	}
	// 有围栏：按 ``` 切分，奇数段（围栏内 = 代码）原样保留，偶数段（正文）才修正。
	const parts = src.split(/(```)/);
	let inFence = false;
	let out = '';
	for(let i = 0; i < parts.length; i++){
		const seg = parts[i];
		if(seg === '```'){
			inFence = !inFence;
			out += seg;
			continue;
		}
		out += inFence ? seg : fixSegment(seg);
	}
	return out;
}

// [E5] 流式软闭合(仅渲染路径调用;导出路径不走——原文单一真值不动):
// AI 流式输出中未闭合的 ```围栏 / 行内 `码` / **粗** 在末尾补齐闭合记号,防 marked 把半截记号
// 字面渲出、闭合 token 到达瞬间整段闪烁。settle 后调用方改传原文重渲染,自愈零残留。
// 计数策略:围栏未闭只补闭栏(围栏内是代码不做行内补齐);行内计数先剔除成对围栏,** 计数再剔除
// 行内代码(代码里的 ** 不算记号)。落单奇数枚 = 有未闭合 → 末尾补一枚。
export function closeStreamingInlineMd(text){
	if(!text && text !== 0){ return ''; }
	let out = `${text}`;
	if(((out.match(/```/g) || []).length) % 2 === 1){ return `${out}\n\`\`\``; }
	const noFence = out.replace(/```[\s\S]*?```/g, '');
	if(((noFence.match(/`/g) || []).length) % 2 === 1){ out += '`'; }
	const noInline = noFence.replace(/`[^`\n]*`/g, '');
	if(((noInline.match(/\*\*/g) || []).length) % 2 === 1){ out += '**'; }
	return out;
}

export default normalizeMarkdown;
