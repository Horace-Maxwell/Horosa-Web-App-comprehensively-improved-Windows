// 第二批新派：玄空六法（谈养吾）+ 命理派（以命配宅）+ 金锁应期 + 形势定穴九法。
import { xuankongLiufa } from '../xuankongLiufa';
import { mingli } from '../mingli';
import { jinsuo } from '../jinsuo';
import { xingshi } from '../xingshi';
import { SHAN_ORDER, LIUFA_ITEMS, DINGXUE_9, GUA8_WUXING } from '../fengshuiData';

const LIUFA_KEYS = ['lingzheng', 'cixiong', 'jinlong', 'aixing', 'chengmen', 'taisui'];
const JX = ['good', 'bad', 'neutral'];

describe('玄空六法', ()=>{
	it('六法齐出、键与名对齐数据层', ()=>{
		const r = xuankongLiufa({ yun: 9, zuoShan: '子', xiangShan: '午', year: 2026 });
		expect(r.available).toBe(true);
		expect(r.items.map((i)=>i.key)).toEqual(LIUFA_KEYS);
		expect(r.items.map((i)=>i.name)).toEqual(LIUFA_ITEMS.map((i)=>i.name));
		r.items.forEach((i)=>{ expect(i.verdict).toBeTruthy(); expect(JX).toContain(i.jx); });
		expect(JX).toContain(r.summary.jx);
	});

	it('🔴 不排飞星三盘：返回体内不得出现 shanPan/xiangPan/yunPan/palaces', ()=>{
		const r = xuankongLiufa({ yun: 8, zuoShan: '壬', xiangShan: '丙', year: 2026 });
		['shanPan', 'xiangPan', 'yunPan', 'palaces', 'ge'].forEach((k)=>{ expect(r[k]).toBeUndefined(); });
	});

	it('零正：当元正神/零神方与坐向落位一一对应，含零正颠倒分支', ()=>{
		// 9 运正神在离(9)、零神在坎(1)。坐子(坎)向午(离) = 坐落零神、向落正神 → 颠倒。
		const dao = xuankongLiufa({ yun: 9, zuoShan: '子', xiangShan: '午' }).items[0];
		expect(dao.extra.zhengGong).toBe(9);
		expect(dao.extra.lingGong).toBe(1);
		expect(dao.extra.daoZhi).toBe(true);
		expect(dao.jx).toBe('bad');
		// 坐午(离=正神)向子(坎=零神) = 体用俱合。
		const he = xuankongLiufa({ yun: 9, zuoShan: '午', xiangShan: '子' }).items[0];
		expect(he.extra.zuoOnZheng).toBe(true);
		expect(he.extra.xiangOnLing).toBe(true);
		expect(he.jx).toBe('good');
		// 5 运居中无定方，不抛且判为 neutral。
		const wu = xuankongLiufa({ yun: 5, zuoShan: '子', xiangShan: '午' }).items[0];
		expect(wu.extra.zhengGong).toBeNull();
		expect(wu.jx).toBe('neutral');
	});

	it('雌雄按净阴净阳；金龙按三元龙同元与否', ()=>{
		const r = xuankongLiufa({ yun: 9, zuoShan: '子', xiangShan: '午' });
		expect(r.items[1].extra.jing).toBe(true);        // 子午俱净阳
		expect(r.items[2].extra.tongYuan).toBe(true);    // 子午俱天元
		const mix = xuankongLiufa({ yun: 9, zuoShan: '壬', xiangShan: '午' });
		expect(mix.items[2].extra.tongYuan).toBe(false); // 壬地元 / 午天元
	});

	it('挨星：八宫卦气分生旺衰死四档，恰一宫为旺（当元）', ()=>{
		for (let yun = 1; yun <= 9; yun++) {
			if (yun === 5) { continue; }
			const list = xuankongLiufa({ yun, zuoShan: '子', xiangShan: '午' }).items[3].extra.list;
			expect(list.length).toBe(8);
			expect(list.filter((a)=>a.stageKey === 'wang').length).toBe(1);
			expect(list.find((a)=>a.stageKey === 'wang').gong).toBe(yun);
		}
	});

	it('太岁：未给流年 → neutral 且注明；给流年 → 按太岁岁破加临判', ()=>{
		expect(xuankongLiufa({ yun: 9, zuoShan: '子', xiangShan: '午' }).items[5].extra).toBeNull();
		const r = xuankongLiufa({ yun: 9, zuoShan: '子', xiangShan: '午', year: 2026 });
		expect(r.items[5].extra.year).toBe(2026);
		expect(r.items[5].extra.zuoSuipo).toBe(true);   // 丙午年岁破在子
		expect(r.items[5].jx).toBe('bad');
	});

	it('压测：9运 × 24坐山 × 对宫向 × 流年 全不抛', ()=>{
		for (let yun = 1; yun <= 9; yun++) {
			SHAN_ORDER.forEach((s, i)=>{
				const r = xuankongLiufa({ yun, zuoShan: s, xiangShan: SHAN_ORDER[(i + 12) % 24], year: 2026 });
				expect(r.available).toBe(true);
				expect(r.items.length).toBe(6);
			});
		}
		expect(xuankongLiufa({ zuoShan: '不存在的山' }).available).toBe(false);
	});
});

describe('命理派', ()=>{
	it('命卦 → 五行/方位/色/喜忌 齐全，喜忌不留空占位', ()=>{
		const r = mingli({ mingYear: 1990, isMale: true, zhaiZuoGua: '坎' });
		expect(r.available).toBe(true);
		expect(GUA8_WUXING[r.ming.gua]).toBe(r.ming.wuxing);
		expect(r.ming.yiJu).toContain('宜居');
		expect(r.ming.xiYong).toMatch(/^喜.+（生我）与.+（比和）；忌.+（克我）、.+（泄气）$/);
	});

	it('🔴 不另起方位盘：只出八方吉凶（大游年），不含飞星/九宫盘', ()=>{
		const r = mingli({ mingYear: 1990, isMale: true, zhaiZuoGua: '坎' });
		expect(r.fangwei.length).toBe(8);
		expect(r.jiFang.length + r.xiongFang.length).toBe(8);
		expect(r.jiFang.length).toBe(4);
		expect(r.xiongFang.length).toBe(4);
		['palaces', 'shanPan', 'xiangPan', 'yunPan'].forEach((k)=>{ expect(r[k]).toBeUndefined(); });
	});

	it('人—宅三项合参：同组/大游年星/五行生克 → 综断', ()=>{
		const same = mingli({ mingYear: 1990, isMale: true, zhaiZuoGua: '坎' });   // 坎命居坎宅
		expect(same.match.sameGroup).toBe(true);
		expect(same.match.star.name).toBe('伏位');
		expect(same.match.wuxing.label).toBe('比和');
		expect(same.match.verdict.jx).toBe('good');
		const cross = mingli({ mingYear: 1990, isMale: true, zhaiZuoGua: '坤' });
		expect(cross.match.sameGroup).toBe(false);
	});

	it('压测：男女 × 8 宅卦 × 多命年 全不抛；非法入参走 available:false', ()=>{
		['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'].forEach((g)=>{
			[true, false].forEach((m)=>{
				for (let y = 1930; y <= 2020; y += 13) {
					const r = mingli({ mingYear: y, isMale: m, zhaiZuoGua: g });
					expect(r.available).toBe(true);
					expect(r.match.okN).toBeGreaterThanOrEqual(0);
					expect(r.match.okN).toBeLessThanOrEqual(3);
				}
			});
		});
		expect(mingli({ mingYear: 'abc' }).available).toBe(false);
		expect(mingli({ mingYear: '' }).available).toBe(false);
		expect(mingli({ mingYear: null }).available).toBe(false);
		expect(mingli({ mingYear: 0 }).available).toBe(false);
		expect(mingli({ mingYear: 1990, zhaiZuoGua: '中' }).available).toBe(false);
	});
});

describe('金锁玉关 应期', ()=>{
	const S = { 坎: 'sand', 坤: 'sand', 震: 'sand', 巽: 'sand', 乾: 'water', 兑: 'water', 艮: 'water', 离: 'water' };

	it('🔴 缺省零回归：不给 yun/year → 无 yingqi 字段、yingqiList 空', ()=>{
		const r = jinsuo({ sectors: S });
		expect(r.palaces.every((p)=>p.yingqi === undefined)).toBe(true);
		expect(r.yingqiList).toEqual([]);
		expect(r.deCount).toBe(8);
		// 与旧签名（只传 sectors）逐字节同
		expect(JSON.stringify(jinsuo({ sectors: S }))).toBe(JSON.stringify(jinsuo({ sectors: S, yun: undefined, year: '' })));
	});

	it('得位逢当运 → 吉应；失位逢凶星 → 灾应', ()=>{
		const r = jinsuo({ sectors: S, yun: 9, year: 2026 });
		const li = r.palaces.find((p)=>p.gua === '离');
		expect(li.deWei).toBe(true);
		expect(li.yingqi.yunHit).toBe(true);      // 9 运离宫当运
		expect(li.yingqi.jx).toBe('good');
		expect(li.yingqi.nextYears.length).toBeGreaterThan(0);
		// 本卦星回宫周期为 9 年
		expect(li.yingqi.nextYears[1] - li.yingqi.nextYears[0]).toBe(9);
		// 失位方逢凶星
		const bad = jinsuo({ sectors: { ...S, 离: 'sand' }, yun: 9, year: 2026 });
		const li2 = bad.palaces.find((p)=>p.gua === '离');
		expect(li2.deWei).toBe(false);
		expect(['bad', 'neutral']).toContain(li2.yingqi.jx);
	});

	it('吉应句里不掺凶星读数（两者分述）', ()=>{
		const r = jinsuo({ sectors: S, yun: 9, year: 2026 });
		r.palaces.forEach((p)=>{
			if (p.yingqi.jx === 'good') { expect(p.yingqi.text.indexOf('吉应显')).toBeGreaterThanOrEqual(0); }
			if (p.yingqi.jx === 'bad') { expect(p.yingqi.text).toContain('灾应'); }
		});
	});

	it('压测：9 运 × 多流年 × 256 种八方砂水 抽样不抛', ()=>{
		const G = ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离'];
		for (let mask = 0; mask < 256; mask += 17) {
			const sectors = {};
			G.forEach((g, i)=>{ sectors[g] = (mask >> i) & 1 ? 'sand' : 'water'; });
			for (let yun = 1; yun <= 9; yun += 4) {
				const r = jinsuo({ sectors, yun, year: 2026 });
				expect(r.palaces.length).toBe(8);
				expect(r.palaces.every((p)=>p.yingqi && JX.indexOf(p.yingqi.jx) >= 0)).toBe(true);
			}
		}
	});
});

describe('形势 定穴九法', ()=>{
	it('定穴与穴形同权各 +1，未选则 0 分（旧默认零回归）', ()=>{
		expect(xingshi({}).xue.score).toBe(0);
		expect(xingshi({ xueType: '窝穴' }).xue.score).toBe(1);
		expect(xingshi({ dingXue: '太极定穴' }).xue.score).toBe(1);
		expect(xingshi({ xueType: '窝穴', dingXue: '太极定穴' }).xue.score).toBe(2);
	});
	it('九法逐个可选并回显', ()=>{
		expect(DINGXUE_9.length).toBe(9);
		DINGXUE_9.forEach((d)=>{
			const r = xingshi({ dingXue: d });
			expect(r.xue.dingXue).toBe(d);
			expect(r.xue.score).toBe(1);
		});
	});
	it('🔴 左栏显式初值等价于旧的 undefined 起步（尤其 shaYouQing 必须是 null 不能是 false）', ()=>{
		const oldDefault = xingshi({ longSheng: true, longStar: '', shuiCheng: '' });
		const newDefault = xingshi({
			longSheng: true, longStar: '', boHuan: false, guoXiaGood: false,
			xueType: '', dingXue: '', zhengXue: [], daoZhang: '',
			shaYouQing: null, guiSha: [], xiongSha: [],
			shuiCheng: '', laiShuiKai: false, quShuiGuan: false, xiangChaoJi: false, xiangChongSha: false,
		});
		expect(newDefault.total).toBe(oldDefault.total);
		expect(newDefault.sha.score).toBe(oldDefault.sha.score);
		// 反证：写成 false 会掉 1 分（故初值不可用 false）
		expect(xingshi({ longSheng: true, shaYouQing: false }).sha.score).toBe(-1);
	});
});
