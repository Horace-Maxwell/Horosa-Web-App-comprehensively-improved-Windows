// AI 对话·系统提示词拼装单源(纯):对话页(AIAnalysisMain.buildResolvedPromptImpl)与无头回合(goalRunner.buildHeadlessSystemPrompt:
// 多技法编排子任务 / 目标任务 / 定时任务 / 本机 MCP 无头分析)共用同一段「裁剪 → 稳定 / 挥发分段 → 缓存断点 → 丢层留痕 → 指纹 → 尾句」。
// 此前两处各写一份:挥发层表各抄一张(无头版少 turn-extra)、断点条件各写一套,改一处忘另一处(双盘挂载就得两边各接一遍)。
// 口径(与两处此前的写法逐字节一致,合同测试锁):
//   缓存家族(anthropic / openai 兼容):稳定层与挥发层都在 → 稳定 + 断点 + 挥发;只有稳定层且 breakpointWhenNoVolatile → 稳定 + 断点
//     (对话页 = window 历史模式;无头 = 恒真,无头从不带挥发层);其余 → 先稳定后挥发、无断点。
//   被整层丢弃的层在断点之后留一句「勿臆补」(被丢集合逐轮会变,放进稳定前缀会打断上游前缀缓存);tailInstruction(JSON 模式)最后追加。
import { clipContextLayersDetailed, VOLATILE_LAYER_KEYS, hashPromptText } from './aiAnalysisContext';
import { getProviderProtocolFamily } from './aiAnalysisProviders';

// 与后端 AI 代理 AIAnalysisProxyService.PROMPT_CACHE_BP 常量逐字节一致
export const PROMPT_CACHE_BREAKPOINT = '[[__CACHE_BP__]]';

const joinLayers = (arr)=>arr.map((item)=>`${item.title}\n${item.content}`).join('\n\n').trim();

// [Windows #80] 整层被丢弃时给模型留痕:此前被丢的层连标题带内容一起消失,模型不知道有这么一份资料,只会按剩下的作答
export function droppedLayersNote(dropped){
	const names = (Array.isArray(dropped) ? dropped : [])
		.map((item)=>`${(item && (item.title || item.key)) || ''}`.replace(/^使用技法：/, ''))
		.filter(Boolean);
	if(!names.length){ return ''; }
	return `[挂载预算不足：以下 ${names.length} 层整层未纳入 —— ${names.join('、')}。未列出的内容不代表不存在，请勿臆补；如需完整资料，请提示用户在「进阶 → 对话上下文策略 → 挂载字数预算」里调大，或减少挂载技法。]`;
}

export function assembleSystemPrompt({ layers, maxChars, providerType, breakpointWhenNoVolatile = false, tailInstruction = '' } = {}){
	const clip = clipContextLayersDetailed(layers || [], { maxChars, fairShare: true });
	const stableL = clip.kept.filter((item)=>!VOLATILE_LAYER_KEYS[item.key]);
	const volatileL = clip.kept.filter((item)=>VOLATILE_LAYER_KEYS[item.key]);
	const fam = getProviderProtocolFamily(providerType);
	const cacheFam = fam === 'anthropic' || fam === 'openai-compatible';
	let joined;
	if(cacheFam && stableL.length && volatileL.length){
		joined = [joinLayers(stableL), joinLayers(volatileL)].filter(Boolean).join(`\n\n${PROMPT_CACHE_BREAKPOINT}\n\n`);
	}else if(cacheFam && stableL.length && breakpointWhenNoVolatile){
		joined = `${joinLayers(stableL)}\n\n${PROMPT_CACHE_BREAKPOINT}`;
	}else{
		joined = joinLayers(stableL.concat(volatileL));
	}
	const note = droppedLayersNote(clip.dropped);
	if(note){ joined = `${joined}\n\n${note}`; }
	if(tailInstruction){ joined = `${joined}\n\n${tailInstruction}`; }
	const stableJoined = joinLayers(stableL);
	const volatileJoined = joinLayers(volatileL);
	return {
		systemPrompt: joined,
		clip,
		meta: {
			stableHash: hashPromptText(stableJoined),
			stableChars: stableJoined.length,
			volatileChars: volatileJoined.length,
			layerKeys: clip.kept.map((item)=>item.key),
			droppedKeys: (clip.dropped || []).map((item)=>item.key),
		},
	};
}
