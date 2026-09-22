// AI 分析 · 会话分支消息映射(单一真源)。
//
// 两条入口:「分支」(复制到某条消息为止)与「编辑上一条并分支」(前缀 + 改写后的那条)。
// 🔴 铁律:进分支的每一条消息 id 必须置 null,由 replaceConversationMessages 重新发号。
// 消息表 keyPath=id,若沿用原 id,同键覆盖会把原会话里编辑点之前的消息「搬」进分支(原会话只剩后半段,删分支即永久丢失;M-34)。
export function buildForkMessages(list, uptoIndexInclusive, branchConversationId){
	return (list || []).slice(0, uptoIndexInclusive + 1).map((item)=>({
		...item,
		id: null,
		conversationId: branchConversationId,
		branchConversationId,
	}));
}

export function buildEditBranchMessages(list, targetIndex, targetUser, content, branchConversationId){
	const prefix = (list || []).slice(0, targetIndex).map((item)=>({
		...item,
		id: null,
		conversationId: branchConversationId,
		branchConversationId,
	}));
	return prefix.concat({
		...(targetUser || {}),
		id: null,
		content,
		editedFromMessageId: targetUser ? targetUser.id : null,
		conversationId: branchConversationId,
		branchConversationId,
	});
}

// 判别用:某批消息里是否还有沿用原会话主键的行(=会把原会话消息搬走)
export function reusesOriginalIds(messages, originalList){
	const ids = new Set((originalList || []).map((m)=>m && m.id).filter(Boolean));
	return (messages || []).some((m)=>m && m.id && ids.has(m.id));
}
