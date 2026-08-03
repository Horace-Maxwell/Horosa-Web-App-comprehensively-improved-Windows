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
	return t;
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
