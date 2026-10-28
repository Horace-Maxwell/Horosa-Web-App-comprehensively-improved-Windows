// 命主实况·挂载预览:当前挂载的命盘有没有命主实况、发不发,以及「本轮挂载上下文」里那张卡。
// 发送层(promptLayerExtras)每次发送现读现拼,不依赖这里;这里只管界面显示(切源 / 开关 / 问卷保存 / 档案变化 / 打开挂载抽屉时重读)。
import React from 'react';
import { Button } from 'antd';
import { subjectFactsPreview, subscribeSubjectFacts, setSubjectFactsEnabled, SUBJECT_FACTS_LAYER_KEY, SUBJECT_FACTS_TITLE } from '../../../utils/subjectFacts';

export const SUBJECT_FACTS_OFF_KEY = `${SUBJECT_FACTS_LAYER_KEY}:off`;

// 预览 → 挂载预览卡(纯函数):开着且有内容 = 照常显示发了什么(键与发送层一致,裁剪标记按它对齐);
// 关着但有内容 = 灰卡「此盘有命主实况 N 项,未发送」;没有内容 = 不出卡
export function subjectFactsContextItem(preview, title){
	const p = preview || {};
	const facts = p.facts || {};
	if(!p.cid || !facts.count){ return null; }
	const name = `${title || ''}`.replace(/\s+/g, ' ').trim();
	if(p.enabled){
		return {
			key: SUBJECT_FACTS_LAYER_KEY,
			title: name ? `${SUBJECT_FACTS_TITLE} · ${name}` : SUBJECT_FACTS_TITLE,
			type: '实况',
			content: facts.text || '',
			status: 'ready',
			subjectFacts: { cid: p.cid, enabled: true, count: facts.count },
		};
	}
	return {
		key: SUBJECT_FACTS_OFF_KEY,
		title: `此盘有${SUBJECT_FACTS_TITLE} ${facts.count} 项,未发送`,
		type: '实况',
		content: '',
		status: 'off',
		muted: true,
		emptyHint: '默认不发给 AI。点右侧「发送」后,这张命盘之后的每次对话都带上;随时可以再点「不发送」。',
		subjectFacts: { cid: p.cid, enabled: false, count: facts.count },
	};
}

// refreshKey:变了就重读(页面传「挂载抽屉开没开」,打开抽屉即按本机最新数据重算)
export function useSubjectFacts(source, refreshKey){
	const [tick, setTick] = React.useState(0);
	React.useEffect(()=>subscribeSubjectFacts(()=>setTick((n)=>n + 1)), []);
	const sourceRef = React.useRef(source);
	sourceRef.current = source;
	const id = source ? `${source.id || ''}` : '';
	const updatedAt = source ? `${source.updatedAt || ''}` : '';
	return React.useMemo(()=>{
		const src = sourceRef.current;
		const preview = subjectFactsPreview(src);
		return { ...preview, card: subjectFactsContextItem(preview, src ? src.title : '') };
	}, [id, updatedAt, tick, refreshKey]);   // eslint-disable-line react-hooks/exhaustive-deps
}

// 卡片右侧的「发送 / 不发送」(只改这张命盘的开关;下一次发送起生效)
export function SubjectFactsCardExtra({ item }){
	const sf = item && item.subjectFacts;
	if(!sf || !sf.cid){ return null; }
	return (
		<Button
			size="small"
			type={sf.enabled ? 'text' : 'link'}
			data-subject-facts-toggle={sf.enabled ? 'on' : 'off'}
			onClick={(e)=>{ if(e && e.stopPropagation){ e.stopPropagation(); } setSubjectFactsEnabled(sf.cid, !sf.enabled); }}
		>
			{sf.enabled ? '不发送' : '发送'}
		</Button>
	);
}
