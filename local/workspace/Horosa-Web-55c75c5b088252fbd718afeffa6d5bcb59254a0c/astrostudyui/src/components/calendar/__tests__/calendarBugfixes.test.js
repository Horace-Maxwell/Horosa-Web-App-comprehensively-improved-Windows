// 黄历全功能审计 · 根因修复守卫（多 agent 算法审计 → 逐条实证修复的回归锁）。
// 覆盖：H1 值宿吉凶单一真值(lunar) · H2 节气精确时刻 · R1/R2 纳音生克 · R3 三合真值守卫。
import { buildHuangliDay } from '../huangliDay';
import { hehunPair } from '../riziEngine';
import { donggongDay } from '../tongshu/donggong';
import { wujiRel, xuankongDay } from '../tongshu/xuankong';
import { Solar } from 'lunar-javascript';

describe('H1 值宿吉凶单一真值 = lunar getXiuLuck（消卡片/AI/吉日榜三处口径矛盾）', () => {
	test('xiu.jx 恒由 xiu.luck 派生：吉→good / 凶→bad，全年零背离', () => {
		let checked = 0;
		for (let m = 1; m <= 12; m++) {
			for (let d = 1; d <= 28; d++) {
				const day = buildHuangliDay(2026, m, d);
				const luck = day.xiu.luck; const jx = day.xiu.jx;
				if (luck === '吉') { expect(jx).toBe('good'); checked++; }
				else if (luck === '凶') { expect(jx).toBe('bad'); checked++; }
				else { expect(jx).toBe('neutral'); }
			}
		}
		expect(checked).toBeGreaterThan(200);   // 确有吉/凶两态被核到
	});
	test('曾自相矛盾之奎宿(2024-01-25)现单源：luck 与 jx 同调', () => {
		const day = buildHuangliDay(2024, 1, 25);
		expect(day.xiu.name).toBe('奎');
		expect((day.xiu.luck === '吉')).toBe(day.xiu.jx === 'good');
		expect((day.xiu.luck === '凶')).toBe(day.xiu.jx === 'bad');
	});
});

describe('H2 节气精确时刻（老黄历卡纯前端此前缺）', () => {
	test('夏至/小暑 等节气日带 jieqiTime(时分秒)', () => {
		const xiazhi = buildHuangliDay(2024, 6, 21);
		expect(xiazhi.lunar.jieqi).toBe('夏至');
		expect(xiazhi.lunar.jieqiTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
		const xiaoshu = buildHuangliDay(2026, 7, 7);
		expect(xiaoshu.lunar.jieqi).toBe('小暑');
		expect(xiaoshu.lunar.jieqiTime).toMatch(/ \d{2}:\d{2}:\d{2}$/);
	});
	test('非节气日 jieqi 与 jieqiTime 皆空（不误显）', () => {
		const plain = buildHuangliDay(2026, 7, 13);   // 廿九·非节气
		expect(plain.lunar.jieqi).toBe('');
		expect(plain.lunar.jieqiTime).toBe('');
	});
});

describe('R1/R2/R3 纳音年命生克（旧把「同五行」误标「相生」+ 不识真相生/相克 + 三合缺守卫）', () => {
	// 辰辰：不冲不合不刑 → 纯看纳音，隔离生克判定。
	const mk = (wx)=> ({ yearZhi: '辰', yearGZ: '甲辰', nayinYear: '纳' + wx, nayinYearWx: wx });
	test('金+水 = 纳音相生（金生水）→ good', () => {
		const r = hehunPair(mk('金'), mk('水'));
		expect(r.verdict).toBe('纳音相生'); expect(r.jx).toBe('good'); expect(r.nayinSheng).toBe(true);
	});
	test('水+水 = 纳音比和（同五行，非相生）→ good 且措辞正确', () => {
		const r = hehunPair(mk('水'), mk('水'));
		expect(r.verdict).toBe('纳音比和（同五行）'); expect(r.jx).toBe('good');
		expect(r.nayinHe).toBe(true); expect(r.nayinSheng).toBe(false);
	});
	test('金+木 = 纳音相克（金克木）→ bad（旧代码此格落「平」neutral）', () => {
		const r = hehunPair(mk('金'), mk('木'));
		expect(r.verdict).toBe('纳音相克'); expect(r.jx).toBe('bad'); expect(r.nayinKe).toBe(true);
	});
	test('R3 三合真值守卫：非地支串不误报三合', () => {
		const bad = { yearZhi: 'XX', yearGZ: '甲XX', nayinYear: '', nayinYearWx: '' };
		const r = hehunPair(bad, { yearZhi: 'YY', yearGZ: '乙YY', nayinYear: '', nayinYearWx: '' });
		expect(r.sanhe).toBe(false);   // undefined===undefined 曾误判 true
	});
	test('生克判定对称（a,b 与 b,a 同 jx）', () => {
		['金', '木', '水', '火', '土'].forEach((wa)=> ['金', '木', '水', '火', '土'].forEach((wb)=>{
			expect(hehunPair(mk(wa), mk(wb)).jx).toBe(hehunPair(mk(wb), mk(wa)).jx);
		}));
	});
});

describe('B1 董公四月「成(丑)」「收(寅)」断语同文 = 古本原貌（多源核验·如实保留不误删）', () => {
	// 审计曾疑「相邻格同文 = 生成复制瑕疵」并一度存疑化收日；经多方公开传本逐字核验——四月成/收
	// 本就共断(皆「天喜、天成…丁丑、癸丑煞入宫」)，系古本原貌非 bug。「不臆造」双向:既不编造替代文，
	// 也不以内部一致性启发式误删真古本。此测锁「如实保留」防再被判死。
	function scanDonggong(year) {
		let shou = null; let cheng = null;
		let cur = Solar.fromYmd(year, 1, 1);
		while (cur.getYear() === year) {
			const r = donggongDay({ y: cur.getYear(), m: cur.getMonth(), d: cur.getDay() });
			if (r.monthName === '四月' && r.jianchu === '收' && !shou) { shou = r; }
			if (r.monthName === '四月' && r.jianchu === '成' && !cheng) { cheng = r; }
			cur = cur.next(1);
		}
		return { shou, cheng };
	}
	test('四月成(丑)与收(寅)断语同为古本原文（丁丑癸丑告诫完好，绝不被误删/存疑化）', () => {
		const { shou, cheng } = scanDonggong(2026);
		expect(shou).toBeTruthy(); expect(cheng).toBeTruthy();
		expect(shou.zhi).toBe('寅'); expect(cheng.zhi).toBe('丑');
		expect(shou.text).toContain('天喜');         // 收日保留古本原文
		expect(shou.text).toContain('丁丑、癸丑');     // 该组专属告诫完好（非误删）
		expect(cheng.text).toContain('丁丑、癸丑');     // 成日同文完好
		expect(shou.text).not.toContain('存疑');       // 绝不以「相邻同文」为由把真古本存疑化
	});
	test('收日综断/建除/金神/三煞照常计算', () => {
		const { shou } = scanDonggong(2026);
		expect(shou.jianchu).toBe('收');
		expect(shou.verdict).toBeTruthy();
		expect(shou.sansha).toBeTruthy();
	});
});

describe('X1 玄空大卦五机·退神标凶（旧只标吉档，生出/克出被吞为「平」→择时无区分度）', () => {
	test('wujiRel 五机方向：进神(生入/克入/同旺/生成/合十)吉，退神(生出/克出)凶', () => {
		// 河图数：1/6水 2/7火 3/8木 4/9金。日(self)=1水。
		expect(wujiRel(1, 1).jx).toBe('good');        // 同旺
		expect(wujiRel(1, 6).type).toBe('生成');       // 1、6 同为水（河图同组）→生成（吉）
		expect(wujiRel(1, 9).type).toBe('合十');       // 1+9=10 合十（吉）
		expect(wujiRel(3, 1).type).toBe('生入');       // 日3木，1水生木→生入（吉）
		expect(wujiRel(3, 1).jx).toBe('good');
		expect(wujiRel(1, 3).type).toBe('生出');       // 日1水 生 3木→退神（凶）
		expect(wujiRel(1, 3).jx).toBe('bad');
		expect(wujiRel(9, 3).type).toBe('克出');       // 日9金 克 3木→退神（凶）
		expect(wujiRel(9, 3).jx).toBe('bad');
		expect(wujiRel(3, 9).type).toBe('克入');       // 日3木 被 9金克→进神（吉）
		expect(wujiRel(3, 9).jx).toBe('good');
	});
	test('日课全年确有「凶」时辰出现（此前恒无·今有区分度）', () => {
		let xiongSeen = 0; let jiSeen = 0;
		for (let m = 1; m <= 12; m += 2) {
			for (let d = 1; d <= 28; d += 5) {
				const D = xuankongDay({ y: 2026, m, d });
				D.rows.forEach((r)=>{ if (r.level.jx === 'bad') { xiongSeen++; } if (r.level.jx === 'good') { jiSeen++; } });
			}
		}
		expect(xiongSeen).toBeGreaterThan(0);   // 关键：凶档真的会出现
		expect(jiSeen).toBeGreaterThan(0);      // 吉档仍在（未把一切标凶）
	});
	test('bestHours 只收上吉/上上吉，绝不含凶时', () => {
		const D = xuankongDay({ y: 2026, m: 7, d: 13 });
		D.bestHours.forEach((h)=>{ expect(h).toMatch(/上吉|上上吉/); expect(h).not.toMatch(/凶/); });
	});
});
