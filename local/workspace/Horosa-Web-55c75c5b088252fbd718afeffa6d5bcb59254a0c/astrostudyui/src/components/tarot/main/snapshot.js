// 塔罗页 · AI 快照正文(按存档的牌组 / 牌阵 / 种子重算牌局)
// 从 TarotMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { getKentangSavedCasePayload } from '../../../utils/kentangCaseSave';
import { SPREADS, DEFAULT_SPREAD } from '../engine/spreads';
import { buildReading } from '../engine/reading';
import { DEFAULT_DECK } from '../engine/deckRegistry';
import { buildReadingText } from '../engine/reportText';

// AI 快照(snapshotRef:'case'):优先 opts,其次已存案例 payload.options,重算 reading → 富文本。
export async function buildTarotSnapshotForFields(fields, opts){
	try{
		const o = opts || {};
		let { deckId, spreadType, seed, question, settings } = o;
		// 页面当前事盘兜底只服务技法页自身导出(snapshotRef:'case');AI 挂载无头路径传 noPageFallback,
		// 旧档无 seed 时返回 ''(missing)而不是读「页面当前载入的另一个事盘」= 张冠李戴。
		if((seed === undefined || seed === null) && !o.noPageFallback){
			const saved = getKentangSavedCasePayload('tarot');
			const so = saved && saved.payload && saved.payload.options ? saved.payload.options : null;
			if(so){ deckId = so.deckId; spreadType = so.spreadType; seed = so.seed; question = so.question; settings = so.settings; }
		}
		if(seed === undefined || seed === null || seed === ''){ return ''; }
		const type = SPREADS[spreadType] ? spreadType : DEFAULT_SPREAD;
		const reading = buildReading(deckId || DEFAULT_DECK, type, `${seed}`, { ...(settings || {}), question });
		return buildReadingText(reading, question);
	}catch(e){ return ''; }
}
