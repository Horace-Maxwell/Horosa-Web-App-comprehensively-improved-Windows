// 设置卡「多模型对比」(C5):选 2-4 个候选模型(所有已启用接口配置的聊天模型)或「同一模型多视角」;存 uiPrefs.chatAssist.bestOf(现有键,不新增);缺省空=用 /多模型 时按「当前模型 × 经典/审慎两视角」。
import React from 'react';
import { Select, Radio } from 'antd';
import { loadUiPrefs, saveUiPrefs } from '../../../utils/aiAnalysisStore';
import { buildRouteOptions } from './ChatModelRoutesPanel';
import { ROLE_ANGLES, MAX_CANDIDATES, MIN_CANDIDATES } from '../../../utils/aiBestOfN';
import { AdvCard, AdvStatus, ADV_SECTION_IDS, advStyles as styles } from './AdvCard';

export function readBestOfPrefs(){
	try{ const ui = loadUiPrefs(); const b = ui && ui.chatAssist && ui.chatAssist.bestOf ? ui.chatAssist.bestOf : {}; return { mode: b.mode === 'angles' ? 'angles' : 'models', selections: Array.isArray(b.selections) ? b.selections.slice(0, MAX_CANDIDATES) : [], angles: Array.isArray(b.angles) ? b.angles.slice(0, MAX_CANDIDATES) : [] }; }
	catch(e){ return { mode: 'models', selections: [], angles: [] }; }
}
export function writeBestOfPrefs(patch){
	const ui = loadUiPrefs() || {};
	const cur = readBestOfPrefs();
	const next = { ...cur, ...(patch || {}) };
	saveUiPrefs({ chatAssist: { ...(ui.chatAssist || {}), bestOf: next } });
	return next;
}

export default function BestOfPanel({ providerProfiles }){
	const [prefs, setPrefs] = React.useState(()=>readBestOfPrefs());
	const options = React.useMemo(()=>buildRouteOptions(providerProfiles), [providerProfiles]);
	const ready = prefs.mode === 'angles' ? (prefs.angles.length >= MIN_CANDIDATES || prefs.angles.length === 0) : prefs.selections.length >= MIN_CANDIDATES;
	const touched = prefs.mode !== 'models' || prefs.selections.length > 0 || prefs.angles.length > 0;
	return (
		<AdvCard id={ADV_SECTION_IDS.bestof} icon="composite" title="多模型对比" status={ready ? <AdvStatus on>就绪</AdvStatus> : <AdvStatus>未设置</AdvStatus>}
			desc={`输入框打 /多模型 问题:同一问并排发给 ${MIN_CANDIDATES}-${MAX_CANDIDATES} 个候选,判官打分选优,可采用或合并。对比模式只回答、不执行任何动作。未设置时用「当前模型 × 经典/审慎两视角」。`}
			reset={{ label: '恢复默认', visible: touched, onClick: ()=>setPrefs(writeBestOfPrefs({ mode: 'models', selections: [], angles: [] })) }}
			data-bestof-panel="1">
			<Radio.Group className={styles.segment} size="small" value={prefs.mode} onChange={(e)=>setPrefs(writeBestOfPrefs({ mode: e.target.value }))} data-bestof-mode="1">
				<Radio.Button value="models">不同模型</Radio.Button>
				<Radio.Button value="angles">同一模型多视角</Radio.Button>
			</Radio.Group>
			{prefs.mode === 'models' ? (
				<Select size="small" mode="multiple" placeholder={`选 ${MIN_CANDIDATES}-${MAX_CANDIDATES} 个模型`} value={prefs.selections} options={options} maxTagCount={4} showSearch optionFilterProp="label" data-bestof-models="1"
					onChange={(v)=>setPrefs(writeBestOfPrefs({ selections: (v || []).slice(0, MAX_CANDIDATES) }))} />
			) : (
				<Select size="small" mode="multiple" placeholder="选 2-4 个视角(留空=经典+审慎)" value={prefs.angles} options={ROLE_ANGLES.map((a)=>({ value: a.key, label: a.label }))} data-bestof-angles="1"
					onChange={(v)=>setPrefs(writeBestOfPrefs({ angles: (v || []).slice(0, MAX_CANDIDATES) }))} />
			)}
		</AdvCard>
	);
}
