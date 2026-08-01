// 主限法表格列宽护栏:穷举「列」的全部勾选组合,锁两件事 ——
//   ① 每一列都必须给 width。antd 在 table-layout:fixed 下按 width 比例分配剩余空间;
//      漏给一列,那一列就独吞全部剩余(实测迫星曾吃到 985px,同屏其它列被压)。
//   ② 每列的 width 必须 ≥ 该列内容的实测需求。否则在列多到需要横滚时(此时 width 就是
//      最终像素宽,不再被拉伸)该列会折行 —— 「日期」当初 104px 装不下
//      「2026-08-08 21:27:27」(实测 146px)就是这么折成两行的;而「影响期」150px 装不下
//      表头「影响期(±3月)」,把整行撑到 61px 高。
//
// 实测需求值取自真机(dev server 上用 canvas/span 量当前字体下的文本宽),见下表注释。
// 新增列或改文案后若需求变大,这里要跟着改 —— 红了就是"某列在横滚态会折行"的预警。
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'AstroPrimaryDirection.js'), 'utf8');

// 列 → 该列内容/表头的实测最小需求(px)。含单元格左右内边距 16 与表头筛选图标约 22。
const NEED = {
	'顺/逆': 42 + 16,          // 内容「顺 D」28;表头 3 字 42 更宽
	Arc: 69 + 16,              // 「-11度49分」69
	年龄: 42 + 16,             // 内容「10.6」30;表头 2 字 28 → 取表头族 42
	迫星: 219 + 16 + 22,       // 「D(9th; 5R10R) 的 □90 度右相位处」219 + 筛选漏斗
	应星: 28 + 16 + 22,        // 多数行 1 个 glyph;下限由表头「应星」+ 漏斗定
	日期: 146 + 16 + 22,       // 「2026-08-14 14:01:34」146 + 筛选图标
	影响期: 133 + 16,          // 「2026-05 ~ 2026-11」133;表头「影响期(±3月)」更长
	极点: 42 + 16,             // 「-17.76°」52 与表头 2 字,取较宽者族
};

/** 从源码里抠出各列声明的 width(px 数字)。 */
function declaredWidths(){
	const out = {};
	// 固定四列:title 与 width 在相邻几行内
	[['迫星', 'Promittor'], ['应星', 'Significator'], ['日期', 'Date']].forEach(([label, dataIndex])=>{
		const seg = SRC.split(`dataIndex: '${dataIndex}'`)[1] || '';
		const m = seg.slice(0, 900).match(/width:\s*(\d+)/);
		out[label] = m ? Number(m[1]) : null;
	});
	const arc = SRC.match(/dataIndex: 'Degree',[\s\S]{0,200}?width:\s*(\d+)/);
	out.Arc = arc ? Number(arc[1]) : null;
	// 可配置列:title 与 width 同一行
	[['顺/逆', 'PdDC'], ['年龄', 'PdAge'], ['极点', 'PdPole']].forEach(([label, key])=>{
		const re = new RegExp(`key: '${key}', width:\\s*(\\d+)`);
		const m = SRC.match(re);
		out[label] = m ? Number(m[1]) : null;
	});
	// 影响期的 title 是模板串,单独取
	const orb = SRC.match(/key: 'PdOrb', width:\s*(\d+)/);
	out.影响期 = orb ? Number(orb[1]) : null;
	return out;
}

const WIDTHS = declaredWidths();
const OPTIONAL = ['顺/逆', '年龄', '影响期', '极点'];	// 「列」下拉的四个勾选
const ALWAYS = ['Arc', '迫星', '应星', '日期'];

describe('主限法表格列宽护栏', ()=>{
	it('🔴 每一列都声明了 width(漏一列 → 那列独吞剩余空间)', ()=>{
		const missing = Object.keys(NEED).filter((c)=>!Number.isFinite(WIDTHS[c]));
		expect(missing).toEqual([]);
	});

	it('🔴 每列 width ≥ 内容实测需求(横滚态不折行)', ()=>{
		const tooNarrow = Object.keys(NEED)
			.filter((c)=>Number.isFinite(WIDTHS[c]) && WIDTHS[c] < NEED[c])
			.map((c)=>`${c}: 声明 ${WIDTHS[c]} < 需求 ${NEED[c]}`);
		expect(tooNarrow).toEqual([]);
	});

	it('全部 16 种「列」勾选组合:各列占比都不畸形(无单列独吞)', ()=>{
		const bad = [];
		for(let mask = 0; mask < 16; mask++){
			const cols = [...ALWAYS];
			OPTIONAL.forEach((c, i)=>{ if(mask & (1 << i)){ cols.push(c); } });
			const total = cols.reduce((s, c)=>s + WIDTHS[c], 0);
			cols.forEach((c)=>{
				const share = WIDTHS[c] / total;
				// 任一列占比超过 55% 即视为独吞(等比拉伸下它会在真机上明显压过其它列)
				if(share > 0.55){ bad.push(`mask=${mask} ${c} 占比 ${(share * 100).toFixed(0)}%`); }
			});
			// 同一组合内,最宽列与最窄列的「余量比」不应差出一个数量级
			const slack = cols.map((c)=>WIDTHS[c] / NEED[c]);
			const ratio = Math.max(...slack) / Math.min(...slack);
			if(ratio > 2.2){ bad.push(`mask=${mask} 余量比 ${ratio.toFixed(2)} 过悬殊`); }
		}
		expect(bad).toEqual([]);
	});

	it('日期列渲染带 nowrap(宽度够也再兜一层,防未来字体/文案变动)', ()=>{
		const seg = SRC.split("dataIndex: 'Date'")[1] || '';
		expect(seg.slice(0, 900)).toContain("whiteSpace: 'nowrap'");
	});
});
