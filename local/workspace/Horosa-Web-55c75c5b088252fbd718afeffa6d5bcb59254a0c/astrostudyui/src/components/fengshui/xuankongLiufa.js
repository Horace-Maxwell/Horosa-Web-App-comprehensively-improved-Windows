// 玄空六法（8.6 · 谈养吾一路）：玄空(零正)/雌雄/金龙/挨星/城门/太岁 逐条产出。
// 🔴 此派明言「不取沈氏飞星挨星」——本模块绝不排三盘九宫、不套飞星星表；
//    「挨星」一条以卦气对当元之生旺衰死分档呈现（可推不臆造）。
import { SHAN_24, GONG_NAME, GONG_GUA, OPP_GONG, ZIBAI_STAR, YUN_YEARS, FANGWEI_RING, LIUFA_ITEMS, LIUFA_NOTE, GUAQI_STAGES } from './fengshuiData';
import { najiaYinYang } from './liqiCore';
import { yearGods } from './zeri';

const stageOf = (key)=>GUAQI_STAGES.find((s)=>s.key === key) || GUAQI_STAGES[3];
// 卦气对当元：宫之洛书数 == 元运 → 旺；下一运 → 生；上一运 → 衰；余 → 死。
function guaQiStage(gong, yun) {
	const next = (yun % 9) + 1;
	const prev = ((yun + 7) % 9) + 1;
	if (gong === yun) { return stageOf('wang'); }
	if (gong === next) { return stageOf('sheng'); }
	if (gong === prev) { return stageOf('shuai'); }
	return stageOf('si');
}
const gongOf = (shan)=>(SHAN_24[shan] ? SHAN_24[shan][0] : null);
const yuanLongOf = (shan)=>(SHAN_24[shan] ? SHAN_24[shan][1] : null);
const yinYangOf = (shan)=>(SHAN_24[shan] ? SHAN_24[shan][2] : null);
const dirOf = (g)=>(g ? GONG_NAME[g] : '—');

// 玄空六法排盘。{ yun, zuoShan, xiangShan, year, shuiKou? }
export function xuankongLiufa({ yun = 9, zuoShan = '子', xiangShan = '午', year, shuiKou } = {}) {
	const y = Math.trunc(Number(yun)) || 9;
	const gZuo = gongOf(zuoShan); const gXiang = gongOf(xiangShan);
	if (!gZuo || !gXiang) { return { available: false }; }
	const items = [];

	// ① 玄空（零正）：当元正神宜山宜实、合十零神宜水宜虚。
	const zhengGong = (y === 5) ? null : y;
	const lingGong = zhengGong ? OPP_GONG[zhengGong] : null;
	const zuoOnZheng = !!zhengGong && gZuo === zhengGong;
	const xiangOnLing = !!lingGong && gXiang === lingGong;
	const zuoOnLing = !!lingGong && gZuo === lingGong;         // 坐落零神＝坐虚
	const xiangOnZheng = !!zhengGong && gXiang === zhengGong;  // 向落正神＝向实
	const daoZhi = zuoOnLing && xiangOnZheng;                  // 零正颠倒
	let lzVerdict; let lzJx;
	if (!zhengGong) { lzVerdict = '五运居中无定方，须按所宗分运法（下卦运／两元八运）另断'; lzJx = 'neutral'; }
	else if (zuoOnZheng && xiangOnLing) { lzVerdict = '正神正位装·拨水入零堂（体用俱合）'; lzJx = 'good'; }
	else if (daoZhi) { lzVerdict = '零正颠倒（坐落零神·向落正神）·宜山者水、宜水者山'; lzJx = 'bad'; }
	else if (zuoOnZheng) { lzVerdict = '坐得正神（收山合）·向未落零神'; lzJx = 'neutral'; }
	else if (xiangOnLing) { lzVerdict = '向得零神（拨水合）·坐未落正神'; lzJx = 'neutral'; }
	else if (zuoOnLing) { lzVerdict = '坐落零神（宜水而坐实）·须以水化'; lzJx = 'bad'; }
	else if (xiangOnZheng) { lzVerdict = '向落正神（宜山而向之）·须以砂案实之'; lzJx = 'bad'; }
	else { lzVerdict = '坐向俱不落零正·体用未合'; lzJx = 'neutral'; }
	items.push({
		key: 'lingzheng', name: LIUFA_ITEMS[0].name, verdict: lzVerdict, jx: lzJx,
		detail: zhengGong
			? `${y}运正神在${dirOf(zhengGong)}（宜山宜实宜高），零神在${dirOf(lingGong)}（宜水宜虚宜低）；本盘坐${zuoShan}居${dirOf(gZuo)}、向${xiangShan}居${dirOf(gXiang)}。`
			: `${y}运五黄居中，零正无定方位。`,
		extra: { zhengGong, lingGong, zuoOnZheng, xiangOnLing, zuoOnLing, xiangOnZheng, daoZhi },
	});

	// ② 雌雄：龙(坐)、向、水 净阴净阳须一致，杂则驳。
	const yyZuo = najiaYinYang(zuoShan); const yyXiang = najiaYinYang(xiangShan);
	const yyShui = shuiKou ? najiaYinYang(shuiKou) : null;
	const trio = [yyZuo, yyXiang, yyShui].filter(Boolean);
	const jing = trio.length >= 2 && trio.every((v)=>v === trio[0]);
	items.push({
		key: 'cixiong', name: LIUFA_ITEMS[1].name,
		verdict: trio.length < 2 ? '资料不足（坐向未能定净阴净阳）' : (jing ? '净·雌雄交媾（阴阳相配）' : '驳·阴阳混杂（雌雄不交）'),
		jx: trio.length < 2 ? 'neutral' : (jing ? 'good' : 'bad'),
		detail: `龙(坐${zuoShan})＝${yyZuo || '—'}、向(${xiangShan})＝${yyXiang || '—'}`
			+ (shuiKou ? `、水口(${shuiKou})＝${yyShui || '—'}` : '')
			+ '；三者同为净阳或同为净阴谓之净，混杂谓之驳。',
		extra: { yyZuo, yyXiang, yyShui, jing },
	});

	// ③ 金龙：一经一纬、动而不动——以坐向三元龙阴阳判动静，同元为清纯。
	const ylZuo = yuanLongOf(zuoShan); const ylXiang = yuanLongOf(xiangShan);
	const dongZuo = yinYangOf(zuoShan) > 0; const dongXiang = yinYangOf(xiangShan) > 0;
	const tongYuan = ylZuo === ylXiang;
	items.push({
		key: 'jinlong', name: LIUFA_ITEMS[2].name,
		verdict: tongYuan ? `${ylZuo}元一气·金龙不杂` : `坐${ylZuo}元、向${ylXiang}元·出卦驳杂`,
		jx: tongYuan ? 'good' : 'bad',
		detail: `坐${zuoShan}＝${ylZuo}元${dongZuo ? '阳（动）' : '阴（静）'}、向${xiangShan}＝${ylXiang}元${dongXiang ? '阳（动）' : '阴（静）'}；`
			+ '金龙一经一纬，动静之机在此，动处挨排、静处不动。',
		extra: { ylZuo, ylXiang, dongZuo, dongXiang, tongYuan },
	});

	// ④ 挨星（卦气生旺衰死；非飞星）。
	const aixing = FANGWEI_RING.map((g)=>{
		const st = guaQiStage(g, y);
		return { gong: g, dir: GONG_NAME[g], gua: GONG_GUA[g], star: ZIBAI_STAR[g], stage: st.name, stageKey: st.key, jx: st.jx, desc: st.desc };
	});
	const zuoStage = guaQiStage(gZuo, y); const xiangStage = guaQiStage(gXiang, y);
	items.push({
		key: 'aixing', name: LIUFA_ITEMS[3].name,
		verdict: `坐${dirOf(gZuo)}＝${zuoStage.name}气、向${dirOf(gXiang)}＝${xiangStage.name}气`,
		jx: (zuoStage.jx === 'good' || xiangStage.jx === 'good') ? 'good' : (xiangStage.jx === 'bad' ? 'bad' : 'neutral'),
		detail: `${y}运卦气：${aixing.map((a)=>`${a.dir}${a.stage}`).join('、')}。此派以卦气挨排、论生旺衰死，不排飞星三盘。`,
		extra: { list: aixing, zuoStage: zuoStage.key, xiangStage: xiangStage.key },
	});

	// ⑤ 城门：向首两旁通气之宫，取卦气生旺者放水。
	const i = FANGWEI_RING.indexOf(gXiang);
	const sideOf = (g)=>{ const st = guaQiStage(g, y); return { gong: g, dir: GONG_NAME[g], gua: GONG_GUA[g], stage: st.name, jx: st.jx, ok: st.key === 'wang' || st.key === 'sheng' }; };
	const L = i >= 0 ? sideOf(FANGWEI_RING[(i - 1 + 8) % 8]) : null;
	const R = i >= 0 ? sideOf(FANGWEI_RING[(i + 1) % 8]) : null;
	const gates = [L, R].filter((c)=>c && c.ok);
	items.push({
		key: 'chengmen', name: LIUFA_ITEMS[4].name,
		verdict: gates.length ? `城门可用：${gates.map((c)=>c.dir).join('、')}` : '向首两旁俱非生旺·无城门可收',
		jx: gates.length ? 'good' : 'neutral',
		detail: L && R ? `向首${dirOf(gXiang)}两旁：${L.dir}（${L.stage}气）、${R.dir}（${R.stage}气）；收城门一卦之旺气，宜此放水通气。` : '',
		extra: { left: L, right: R, gates },
	});

	// ⑥ 太岁：当年太岁加临，与坐向比对。
	let taisuiItem = { key: 'taisui', name: LIUFA_ITEMS[5].name, verdict: '未指定流年', jx: 'neutral', detail: '填入流年即按太岁加临断应期。', extra: null };
	if (year != null && year !== '' && !Number.isNaN(Number(year))) {
		const yr = Math.trunc(Number(year));
		const yg = yearGods(yr);
		const zuoTaisui = yg.taisui.gong === gZuo;
		const zuoSuipo = yg.suipo.gong === gZuo;
		const xiangTaisui = yg.taisui.gong === gXiang;
		const bad = zuoTaisui || zuoSuipo;
		taisuiItem = {
			key: 'taisui', name: LIUFA_ITEMS[5].name,
			verdict: zuoSuipo ? '坐犯岁破·大凶忌修造' : (zuoTaisui ? '坐犯太岁·忌妄动' : (xiangTaisui ? '向太岁（可向不可坐）' : '坐向不犯太岁岁破')),
			jx: bad ? 'bad' : (xiangTaisui ? 'neutral' : 'good'),
			detail: `${yr} 年${yg.yearGanZhi}：太岁在${yg.taisui.dir}、岁破在${yg.suipo.dir}、三煞${yg.sansha.ju}在${(yg.sansha.list || []).map((s)=>GONG_NAME[s.gong]).join('/')}；`
				+ `本盘坐${dirOf(gZuo)}、向${dirOf(gXiang)}。`,
			extra: { year: yr, taisuiGong: yg.taisui.gong, suipoGong: yg.suipo.gong, zuoTaisui, zuoSuipo, xiangTaisui },
		};
	}
	items.push(taisuiItem);

	const goodN = items.filter((it)=>it.jx === 'good').length;
	const badN = items.filter((it)=>it.jx === 'bad').length;
	const summary = badN === 0 && goodN >= 4 ? { text: '六法多合·体用相得', jx: 'good' }
		: (badN >= 3 ? { text: '六法多违·体用未合', jx: 'bad' } : { text: '六法互见·须权衡取舍', jx: 'neutral' });

	return {
		available: true, yun: y, yunRange: YUN_YEARS[y] || null, zuoShan, xiangShan, gZuo, gXiang,
		items, goodN, badN, summary, note: LIUFA_NOTE,
	};
}

export default xuankongLiufa;
