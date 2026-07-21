// 皇极轨策 · 卦画 —— 六爻真象（阳实阴断），动爻标记、体用分半。
//
// 🔴 何以自画而不用卦符字（䷀ 一类）：
//    本技法之卦，动爻是命门（演数、变卦、断法皆由之出），而卦符字画不出「哪一爻动」，
//    更分不出体用两半。邻页用卦符字是因其无此需（其不高亮动爻）。故此处画之。
//    爻画之样式语汇照本仓既有一路（阳=一整条、阴=两段留中；动爻行以强调色衬底描边）。
//
// lines 之序：自下而上（初爻在 [0]），与引擎同 —— 故渲染时须【倒着排】，
// 因卦画自古下起而上，DOM 自上而下。倒错即上下卦颠倒，是此类图最常见之错。
import React from 'react';

/**
 * @param {number[]} lines 六爻（自下而上，1 阳 0 阴）
 * @param {number} dongYao 动爻位（1..6，自下数）；无则不标
 * @param {'up'|'lo'|null} tiHalf 体卦在上三爻还是下三爻；标之则该半描金
 */
function GuiceGuaGlyph({ lines, dongYao, tiHalf, size }) {
	const n = Array.isArray(lines) ? lines.length : 0;
	if (n !== 6 && n !== 3) return null;   // 六爻之卦，或三爻之单卦（互卦只出八卦，不产六十四卦名）
	const rows = [];
	// 自上而下渲染 → 自最上一爻倒数至初爻
	for (let pos = n; pos >= 1; pos -= 1) {
		const yang = lines[pos - 1] === 1;
		const dong = n === 6 && pos === dongYao;
		const isTi = n === 6 && tiHalf && (pos >= 4 ? 'up' : 'lo') === tiHalf;
		rows.push(
			<span
				key={pos}
				className={`horosa-guice-yao${dong ? ' is-dong' : ''}${isTi ? ' is-ti' : ''}`}
				title={`第 ${pos} 爻 · ${yang ? '阳' : '阴'}${dong ? ' · 动' : ''}`}
			>
				<span className={`horosa-guice-bar ${yang ? 'yang' : 'yin'}`}>
					{yang ? null : <><i /><i /></>}
				</span>
			</span>,
		);
	}
	return <span className={`horosa-guice-gua-glyph${size === 'sm' ? ' is-sm' : ''}`}>{rows}</span>;
}

export default GuiceGuaGlyph;
