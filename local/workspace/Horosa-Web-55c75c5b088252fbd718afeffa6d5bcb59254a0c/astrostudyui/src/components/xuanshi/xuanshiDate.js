// 玄学史事件 / 天象的日期与文本工具:公历年标签、历法标注、可起盘日期的解析(resolveChartDate)、中文软换行收拢、
// 多值字段拆分与白话≈原文判定。
// 玄学事件多数无精确日期:只认 modern_date / 已抽取的 year,不再从朝代段或文本帝王纪年推断(见 resolveChartDate)。

// 公历年 → 人读标签(公元前 X / 公元 X)
export function gregYearLabel(y) {
	return y < 0 ? `公元前 ${Math.abs(y)}` : `公元 ${y}`;
}

// 公历年 → **短**标(前N / N):卡片、时间轴柱标、悬停这些窄位置用它。
// 此前同一模块里两套写法并存 —— 人物卡片与时间轴柱标原样显示负号(老子「-571—-471」、柱标「-1046–-771」),
// 详情与刻度却写「前571」「前1000」;帮助文也承诺「公元前一律显示为「前XXX」」。统一走这一个函数。
export function gregYearShort(y) {
	if (y == null || y === '') { return ''; }
	const n = Number(y);
	if (!Number.isFinite(n)) { return `${y}`; }
	return n < 0 ? `前${Math.abs(n)}` : `${n}`;
}

// 解析事件/天象可起盘的公历日期(优先级:精确 modern_date → 已抽取 year;两者都没有返 null)。
// 不用 dynasty 兜底:天象 dynasty 是史书朝代(汉书载春秋事会误导);「只有朝代无时间」→ 返 null(不显排盘按钮)。
// 1582-10-15(格里历启用)之前:全仓日期引擎(前端 DateTime.calcJdn / 后端 flatlib)按儒略历解释年月日。
// 库内约定收成一种:**modern_date 就是史料所载的儒略历日期**(1582-10-15 前),直接喂引擎即正确;
// `julian_date` 列已整列置空(此前带该列的 8,349 行,其 julian_date 是「儒略日期再减去儒略−格里差」的错列,起盘早 3~7 天,
// 而 modern_date 按儒略历读的干支日与所载干支 100% 吻合)。下面的 julian_date 分支只为旧载荷兼容保留,库内不再命中。
function beforeGregorianReform(md) {
	const m = /^(-?\d{1,5})-(\d{1,2})-(\d{1,2})/.exec(`${md || ''}`);
	if (!m) { return false; }
	const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
	return y < 1582 || (y === 1582 && (mo < 10 || (mo === 10 && d < 15)));
}
// 显示层按历法如实标注,不一律标「公历」:改历之前的 modern_date 是儒略历日期 → 标「儒略历」;
// 改历之后两历同值,标「公历」。(带 julian_date 的旧载荷仍按「modern_date=公历」标注,库内已无此类行,见上 #73。)
export function celestialCalendarKind(ev) {
	const md = ev && (ev.modern_date || ev.modern_date_disp);
	if (!md) { return ''; }
	if (ev.julian_date) { return 'gregorian'; }
	return beforeGregorianReform(md) ? 'julian' : 'gregorian';
}
export function celestialCalendarLabel(ev) {
	const k = celestialCalendarKind(ev);
	return k === 'julian' ? '儒略历' : (k === 'gregorian' ? '公历' : '');
}
// 「1054-07-04（儒略历）」形式的显示串;无日期返 ''。
export function celestialDateWithCalendar(ev, opts) {
	const disp = ev && (ev.modern_date_disp || ev.modern_date);
	if (!disp) { return ''; }
	const label = celestialCalendarLabel(ev);
	if (!label) { return `${disp}`; }
	return (opts && opts.prefix) ? `${label} ${disp}` : `${disp}（${label}）`;
}

export function resolveChartDate(ev) {
	if (!ev) { return null; }
	if (ev.modern_date && /^-?\d{1,4}-\d{1,2}-\d{1,2}/.test(ev.modern_date)) {
		const disp = ev.modern_date_disp || ev.modern_date;
		// 库内 modern_date 一律是完整 YYYY-MM-DD 串,但 modern_precision 标明它有多精确:
		// month 2,585 / year 228 / interval 74 条只是「合成到某一天」的近似值。此前只要串形完整就判 exact,
		// 提示行写「公历 -0014-01-30」无「约」,并按那个合成日正午起盘 —— 与帮助承诺(年级按该年 1 月 1 日、标「约」)相反。
		const prec = `${ev.modern_precision || ''}`.toLowerCase();
		if (prec === 'year' || prec === 'interval') {
			const ym = /^(-?\d{1,4})-/.exec(ev.modern_date);
			const y = ym ? parseInt(ym[1], 10) : null;
			if (y != null && Number.isFinite(y)) {
				return { md: `${y}-01-01`, disp: `约 ${gregYearLabel(y)}`, exact: false, precision: prec, note: prec === 'interval' ? '史料只给年段,按起始年 1 月 1 日正午起盘' : '史料只到年,按该年 1 月 1 日正午起盘' };
			}
		}
		// 旧载荷兼容:带 julian_date 者 md 取儒略日、disp 仍是公历换算日(库内已无此类行,见文件头 #73)
		const legacyJulian = !!(ev.julian_date && /^-?\d{1,5}-\d{1,2}-\d{1,2}/.test(`${ev.julian_date}`) && beforeGregorianReform(ev.modern_date));
		const md = legacyJulian ? `${ev.julian_date}` : ev.modern_date;
		// 单一约定:改历前的 modern_date 就是儒略历日期,起盘与显示同一个日子,一律标「儒略历」
		const calendar = (legacyJulian || beforeGregorianReform(md)) ? 'julian' : 'gregorian';
		const dispCalendar = legacyJulian ? 'gregorian' : calendar;
		if (prec === 'month') {
			const mm = /^(-?\d{1,4}-\d{1,2})/.exec(`${disp}`);
			return { md, disp: `约 ${mm ? mm[1] : disp}`, exact: false, precision: 'month', calendar, dispCalendar, note: '史料只到月,按库内合成日正午起盘' };
		}
		return { md, disp, exact: true, calendar, dispCalendar };
	}
	let y = null;
	if (ev.year != null && ev.year !== '' && Number.isFinite(Number(ev.year))) { y = Number(ev.year); }
	// 不再从文本帝王纪年/朝代段推断(防止搞错):无 year/modern_date 即不显排盘按钮
	if (y == null) { return null; }
	return { md: `${y}-01-01`, disp: `约 ${gregYearLabel(y)}`, exact: false };
}

// 「排此日」提示行的日期段(两页共用):精确日按历法如实标注 —— 改历前「儒略历 767年8月14日 起盘」、改历后「公历 1604年10月9日」;
// 旧载荷(disp=公历换算日、md=儒略日)保留「公历 X(儒略历 Y 起盘)」形。近似日(年/月级)由各页自拼(带「约」与说明)。
export function chartDateExactLabel(rd) {
	if (!rd || !rd.exact) { return ''; }
	if (rd.calendar === 'julian' && rd.dispCalendar === 'gregorian') { return `公历 ${rd.disp}（儒略历 ${rd.md} 起盘）`; }
	return rd.calendar === 'julian' ? `儒略历 ${rd.disp} 起盘` : `公历 ${rd.disp}`;
}

// marked breaks 关闭后段内单软换行会渲成空格;中文之间不应有空格 → CJK(及中文标点)间的单换行直接相接。
// 保留 \n\n 段落、列表(- * +)、标题(#)、引用(>)等行首块级标记;do-while 处理连续软换行。
export function collapseSoftBreaks(s) {
	if (!s) { return String(s); }
	// ① 段内单软换行(\n)在 CJK 间相接(保留 \n\n、列表/标题/引用行)
	const reN = /([㐀-鿿，。、；：！？「」『』（）【】《》·…—])\n(?!\n|\s*[-*+>#]|\s*\d+[.、)])([㐀-鿿「『（【《])/g;
	// ② CJK 之间夹带的字面空格/制表(中文不该有;另一侧为 latin/符号则不在此类,空格保留)→ 去掉
	const reSp = /([㐀-鿿，。、；：！？「」『』（）【】《》·…—])[ \t]+([㐀-鿿「『（【《])/g;
	// 先清行尾/行首多余空格(源里常有「后 \n做」行尾空格,使 reN 漏判 → breaks 后残留空格)
	let out = String(s).replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
	let prev;
	do { prev = out; out = out.replace(reN, '$1$2').replace(reSp, '$1$2'); } while (out !== prev);
	return out;
}

// 多值字段(术数 / 人物等,以 ; , 、 ，分隔)拆成数组;空值返回 []。
export function splitList(s) {
	if (!s) { return []; }
	return `${s}`.split(/[;,、，]\s*/).map((x) => x.trim()).filter(Boolean);
}

// 白话与原文字符集重合度 >0.85 视为近乎相同(源库少数硬古文白话≈原文)→ 调用方据此隐藏白话免冗余。
export function nearSame(a, b) { if (!a || !b) { return false; } const sa = new Set(a), sb = new Set(b); let inter = 0; sa.forEach((c) => { if (sb.has(c)) { inter++; } }); return inter / Math.max(sa.size, sb.size, 1) > 0.85; }
