// [门面] 牌阵——re-export 自 engine/spreads + engine/reading。位置序列权威取自公有领域(Waite《Pictorial Key》§7 等)。
// buildReading(spreadType, seed) 二参旧签名 → 回落 rws 牌组(engine buildReading('rws',...));新代码直接用 engine 四参。
import { buildReading as engineBuildReading } from './engine/reading.js';
import { cardKeywords } from './decks/core78.js';
import { seedDisplayText } from '../../utils/trueRandom';

export { SPREADS, SPREAD_KEYS, DEFAULT_SPREAD, getSpread, drawSpread, orientationLabel } from './engine/spreads.js';
import { SPREADS, orientationLabel } from './engine/spreads.js';

// 旧二参签名:buildReading(spreadType, seed) → rws 牌组、默认设置。返回 reading(含 spreadType/seed/draws,兼容旧消费)。
export function buildReading(spreadType, seed){
	return engineBuildReading('rws', spreadType, seed, undefined);
}

// 纯函数:已解析牌阵 reading → AI/导出快照文本(读兼容字段,旧调用零改)。
export function buildReadingText(reading, question){
	if(!reading || !SPREADS[reading.spreadType] || !Array.isArray(reading.draws)){
		return '【塔罗】尚未抽牌,请先在塔罗页抽牌后再导出。';
	}
	const spread = SPREADS[reading.spreadType];
	const lines = [];
	lines.push(`【${spread.label}】(种子:${seedDisplayText(reading.seed)})`);
	if(question){
		lines.push(`所问:${question}`);
	}
	reading.draws.forEach((d) => {
		const card = d.card;
		if(!card){ return; }
		const kw = cardKeywords(card, d.isReversed).slice(0, 4).join('、');
		lines.push(`位置${d.position.i}(${d.position.label})：${card.name_cn}${card.symbol}（${orientationLabel(d.isReversed)}）— ${kw}`);
	});
	if(reading.draws.length === 1){
		lines.push('（单张牌阵:以上即为对所问之事的一句核心指引。）');
	}
	return lines.join('\n');
}

export default SPREADS;
