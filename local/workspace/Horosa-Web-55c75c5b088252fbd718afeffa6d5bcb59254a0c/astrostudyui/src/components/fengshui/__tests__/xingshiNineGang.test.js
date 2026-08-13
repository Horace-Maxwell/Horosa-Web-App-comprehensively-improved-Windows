// 形势派九纲口径 golden —— 古籍枚举逐条锚 + 三条权重调制 + 🔴 缺省口径零回归。
import { xingshi, XINGSHI_TABLES } from '../xingshi';
import {
	DINGXUE_13, ZHENGXUE_13, SISHA_4, SANSHI_XUE, JIUXING_BIANXUE_8, JIEXUE_5JU, GUAIXUE_8, ZHENXUE_3,
	MINGTANG_JI_9, MINGTANG_XIONG_9, MINGTANG_4YAO, LONGHU_DUAN_15, LONGHU_6JI, SHUIKOU_5SHA,
	SHUI_5JU, SHUICHENG_SUB, SANHE_SANTANG, QIANPANGHOU_HE, YUANCHEN_10ZI, ZIRAN_SHUIFA,
	SHANXUE_4JI, LINTOU_FANGFEN, ZHIJIAO_4GE, KAIZHANG_3, GUOXIA_4, HEXING_41, HUXIA_GUI_12, HUXIA_FU_4,
	JIUXING_BIANTI, XUNXUE_QIAOMEN, SANDA_GANLONG, GUAIXUE_NOTE, JIUXING_BIANXUE_NOTE,
} from '../fengshuiXingshiData';
import { DINGXUE_9, ZHENGXUE_10 } from '../fengshuiData';

describe('形势九纲 · 🔴 缺省口径零回归（不传 scoreMode 时逐字节同旧）', ()=>{
	const cases = [
		{},
		{ longSheng: true, longStar: '贪狼', boHuan: true, guoXiaGood: true },
		{ longSheng: false, longStar: '破军', xueType: '窝穴', dingXue: '太极定穴', zhengXue: ['朝山证', '案山证', '乐山证', '鬼星证'] },
		{ guiSha: ['贵砂'], xiongSha: ['凶砂'], shaYouQing: true, shuiCheng: '金城', laiShuiKai: true, quShuiGuan: true },
		{ xiangChaoJi: true, xiangChongSha: true, shaYouQing: false },
	];
	it('五诀分与总分、grade、note 均与九纲落地前一致', ()=>{
		cases.forEach((sel)=>{
			const r = xingshi(sel);
			const five = r.long.score + r.xue.score + r.sha.score + r.shui.score + r.xiang.score;
			expect(r.total).toBe(five);                       // 旧口径＝五纲线性和
			expect(r.scoreMode).toBeUndefined();              // 旧口径不带 scoreMode
			expect(r.mingtang).toBeUndefined();               // 旧口径不出新四纲
			expect(r.modulation).toBeUndefined();             // 旧口径无调制
			expect(r.note).toContain('龙穴砂水向逐纲打分');
		});
	});
	it('九纲入参在旧口径下一律被忽略（老消费方不受任何影响）', ()=>{
		const plain = xingshi({ longSheng: true });
		const withNineParams = xingshi({ longSheng: true, mingtangJi: '交锁明堂', longhuXing: '龙虎两平正', shuikouSha: '罗星', ruShouGe: true });
		expect(withNineParams.total).toBe(plain.total);
		expect(withNineParams.grade).toEqual(plain.grade);
	});
});

describe('形势九纲 · 四新纲计分', ()=>{
	const nine = (sel)=>xingshi({ ...sel, scoreMode: 'nine' });

	it('明堂纲：吉格 +2 / 凶格 −2 / 四要求各 +1（封顶 4）', ()=>{
		expect(nine({ mingtangJi: '交锁明堂' }).mingtang.score).toBe(2);
		expect(nine({ mingtangXiong: '劫杀明堂' }).mingtang.score).toBe(-2);
		expect(nine({ mingtang4: MINGTANG_4YAO.map((y)=>y.name) }).mingtang.score).toBe(4);
		expect(nine({ mingtangJi: '大会明堂', mingtangXiong: '旷野明堂' }).mingtang.score).toBe(0);
	});

	it('龙虎纲：《龙虎断》断语 ±2、六忌每条 −1（封顶3）、缺失补偿 +1', ()=>{
		expect(nine({ longhuXing: '龙虎两平正' }).longhu.score).toBe(2);
		expect(nine({ longhuXing: '龙虎两分飞' }).longhu.score).toBe(-2);
		expect(nine({ longhu6ji: ['昂头妒主', '破碎', '反背', '斜飞'] }).longhu.score).toBe(-3);
		expect(nine({ longhuBuchang: true }).longhu.score).toBe(1);
		const r = nine({ longhuXing: '龙虎两排衙', longhu6ji: ['臃肿'], longhuBuchang: true });
		expect(r.longhu.score).toBe(2 - 1 + 1);
		expect(r.longhu.duan.duan).toBe('富贵达京华');
	});

	it('水口纲：五砂 +2、三关每重 +1、关锁不成 −2', ()=>{
		expect(nine({ shuikouSha: '北辰' }).shuikou.score).toBe(2);
		expect(nine({ shuikouGuan: ['内关', '中关', '外关'] }).shuikou.score).toBe(3);
		expect(nine({ shuikouLock: false }).shuikou.score).toBe(-2);
		expect(nine({ shuikouSha: '捍门', shuikouGuan: ['内关'], shuikouLock: true }).shuikou.score).toBe(2 + 1 + 1);
	});

	it('太极纲：主法 +1／特法 +0.5（封顶5）、定穴+1、局势+1、怪穴+1、否决各 −2', ()=>{
		expect(nine({ zhengXue13: ['chaoshan', 'shuishi', 'mingtang'] }).taiji.score).toBe(3);
		expect(nine({ zhengXue13: ['shuikou', 'guoxia'] }).taiji.score).toBe(1);       // 两条特法 = 0.5×2
		expect(nine({ zhengXue13: ZHENGXUE_13.map((z)=>z.key) }).taiji.score).toBe(5); // 封顶
		expect(nine({ dingXue13: '太极晕定穴' }).taiji.score).toBe(1);
		expect(nine({ jieXueJu: '回龙顾祖' }).taiji.score).toBe(1);
		expect(nine({ guaiXue: GUAIXUE_8[0].name }).taiji.score).toBe(1);
		const veto = nine({ mingtangQingxie: true, fenHe: false, chunZhan: false, dixinQue: true });
		expect(veto.taiji.score).toBe(-8);
		expect(veto.taiji.veto).toHaveLength(4);
	});
});

describe('形势九纲 · 三条古籍权重调制（非线性，不是简单叠加）', ()=>{
	const nine = (sel)=>xingshi({ ...sel, scoreMode: 'nine' });

	it('① 真假龙覆盖：入首数节不合格＝假龙，龙纲被压到 ≤ −2（纵远龙美亦然）', ()=>{
		const mei = nine({ longSheng: true, longStar: '贪狼', boHuan: true, guoXiaGood: true });
		expect(mei.long.score).toBe(6);
		const jia = nine({ longSheng: true, longStar: '贪狼', boHuan: true, guoXiaGood: true, ruShouGe: false });
		expect(jia.long.score).toBe(-2);
		expect(jia.long.capped).toBe(true);
		expect(jia.modulation.some((m)=>m.key === 'jiaLong')).toBe(true);
		expect(jia.total).toBeLessThan(mei.total);
		// 真龙：入首合格 +2
		const zhen = nine({ longSheng: true, ruShouGe: true });
		expect(zhen.long.score).toBe(2 + 2);
	});

	it('② 砂受龙格调制：龙贱则砂吉分反凶；龙贵则砂凶分归零（砂不可独立打分）', ()=>{
		const shaGood = { guiSha: ['贵砂', '贵砂2', '贵砂3'], shaYouQing: true };
		expect(nine(shaGood).sha.score).toBe(4);
		const jianLong = nine({ ...shaGood, longGuiJian: 'jian' });
		expect(jianLong.sha.score).toBe(-4);
		expect(jianLong.modulation.some((m)=>m.key === 'shaByLong')).toBe(true);
		const shaBad = { xiongSha: ['凶砂', '凶砂2'], shaYouQing: false };
		expect(nine(shaBad).sha.score).toBe(-3);
		const guiLong = nine({ ...shaBad, longGuiJian: 'gui' });
		expect(guiLong.sha.score).toBe(0);
	});

	it('③ 朝山权重低于龙穴：无案朝减分，但逆水朝入/堂有聚水则豁免', ()=>{
		const base = nine({ xiangChaoJi: true });
		expect(base.xiang.score).toBe(1);
		const wuAn = nine({ xiangChaoJi: true, wuAnChao: true });
		expect(wuAn.xiang.score).toBe(0);
		expect(wuAn.modulation.some((m)=>m.key === 'wuAnChao')).toBe(true);
		const mianze = nine({ xiangChaoJi: true, wuAnChao: true, niShuiOrJuShui: true });
		expect(mianze.xiang.score).toBe(1);
		expect(mianze.modulation.some((m)=>m.key === 'wuAnMianZe')).toBe(true);
	});

	it('九纲总分＝九纲之和（调制后），grade 走九纲阈值', ()=>{
		const r = nine({ longSheng: true, longStar: '贪狼', xueType: '窝穴', dingXue: '太极定穴',
			shuiCheng: '金城', laiShuiKai: true, mingtangJi: '大会明堂', mingtang4: MINGTANG_4YAO.map((y)=>y.name),
			longhuXing: '龙虎两平正', shuikouSha: '罗星', shuikouGuan: ['内关', '中关'], shuikouLock: true,
			zhengXue13: ['chaoshan', 'shuishi', 'mingtang', 'leshan'], dingXue13: '太极晕定穴', jieXueJu: '回龙顾祖', ruShouGe: true });
		const sum = r.long.score + r.xue.score + r.sha.score + r.shui.score + r.xiang.score
			+ r.mingtang.score + r.longhu.score + r.shuikou.score + r.taiji.score;
		expect(r.total).toBe(sum);
		expect(r.grade.jx).toBe('good');
		expect(r.scoreMode).toBe('nine');
	});
});

describe('形势九纲 · 古籍枚举完整性（并存两套，不合并）', ()=>{
	it('🔴 定穴：既有九法与古籍十三法并存，且名目确实不同（不可合表）', ()=>{
		expect(DINGXUE_9).toHaveLength(9);
		expect(DINGXUE_13).toHaveLength(13);
		const names13 = DINGXUE_13.map((x)=>x.name);
		expect(names13).toContain('张山食水定穴');
		expect(names13).toContain('流星定穴');
		expect(DINGXUE_9).toContain('八卦定穴');            // 十三法里没有
		expect(names13.some((n)=>n.indexOf('八卦') >= 0)).toBe(false);
	});
	it('🔴 证穴：既有十证与古籍十三法并存（十主三特）', ()=>{
		expect(ZHENGXUE_10).toHaveLength(10);
		expect(ZHENGXUE_13).toHaveLength(13);
		expect(ZHENGXUE_13.filter((z)=>z.main)).toHaveLength(10);
		expect(ZHENGXUE_13.filter((z)=>!z.main).map((z)=>z.name)).toEqual(['水口证穴', '过峡审穴', '官曜上判定']);
		expect(ZHENGXUE_13.map((z)=>z.name)).toContain('土色证穴');   // 既有十证无此条
		expect(ZHENGXUE_10).toContain('案山证');                       // 十三法无此条
	});
	it('九星变穴八法齐备，且明载与窝钳乳突不可混', ()=>{
		expect(JIUXING_BIANXUE_8).toHaveLength(8);
		expect(JIUXING_BIANXUE_8.find((x)=>x.star === '贪狼').xue).toBe('乳头');
		expect(JIUXING_BIANXUE_8.find((x)=>x.star === '巨门').xue).toBe('窝');
		expect(JIUXING_BIANXUE_8.find((x)=>x.star === '武曲').xue).toBe('钗钳');
		expect(JIUXING_BIANXUE_NOTE).toMatch(/不可混用/);
	});
	it('明堂吉九凶九、龙虎断十五、五局、水城子格、三堂、前旁后合 计数齐备', ()=>{
		expect(MINGTANG_JI_9).toHaveLength(9);
		expect(MINGTANG_XIONG_9).toHaveLength(9);
		expect(MINGTANG_4YAO).toHaveLength(4);
		expect(LONGHU_DUAN_15).toHaveLength(15);
		expect(LONGHU_6JI).toHaveLength(6);
		expect(SHUI_5JU).toHaveLength(5);
		expect(SHUICHENG_SUB).toHaveLength(5);
		expect(SHUICHENG_SUB.reduce((a, x)=>a + x.subs.length, 0)).toBe(13);   // 子格合计
		expect(SANHE_SANTANG).toHaveLength(3);
		expect(SANHE_SANTANG[0].use).toMatch(/地之有无以此定/);
		expect(QIANPANGHOU_HE.map((x)=>x.rank)).toEqual([1, 2, 3]);            // 前<旁<后
		expect(YUANCHEN_10ZI).toHaveLength(10);
	});
	it('喝形取象四类 41 项、护峡贵12富4、枝脚四格、过峡四类、山穴四忌、淋头三条', ()=>{
		const total = Object.values(HEXING_41).reduce((a, arr)=>a + arr.length, 0);
		expect(total).toBe(41);
		expect(HEXING_41.人体之形).toHaveLength(8);
		expect(HEXING_41.动物之形).toHaveLength(11);
		expect(HEXING_41.植物之形).toHaveLength(7);
		expect(HEXING_41.器皿之形).toHaveLength(15);
		expect(HUXIA_GUI_12).toHaveLength(12);
		expect(HUXIA_FU_4).toHaveLength(4);
		expect(ZHIJIAO_4GE).toHaveLength(4);
		expect(ZHIJIAO_4GE.find((x)=>x.name === '杨柳枝格').jx).toBe('bad');
		expect(GUOXIA_4).toHaveLength(4);
		expect(KAIZHANG_3).toHaveLength(3);
		expect(SHANXUE_4JI).toHaveLength(4);
		expect(LINTOU_FANGFEN.map((x)=>x.fang)).toEqual(['长房', '三房', '房房']);
	});
	it('自然水法断语含房份映射三条（左长右三中二）', ()=>{
		const zuo = ZIRAN_SHUIFA.find((x)=>x.xing === '左射');
		const you = ZIRAN_SHUIFA.find((x)=>x.xing === '右射');
		const zhong = ZIRAN_SHUIFA.find((x)=>x.xing === '水从中心射');
		expect(zuo.fang).toBe('长房'); expect(you.fang).toBe('三房'); expect(zhong.fang).toBe('二房');
	});
	it('怪穴八种各带扦法；真穴三法；四杀四法；三势天人地穴', ()=>{
		expect(GUAIXUE_8).toHaveLength(8);
		GUAIXUE_8.forEach((g)=>{ expect(g.how).toBeTruthy(); expect(g.like).toBeTruthy(); });
		expect(GUAIXUE_NOTE).toMatch(/未可轻试|补乳头八种/);
		expect(ZHENXUE_3).toHaveLength(3);
		expect(SISHA_4.map((x)=>x.name)).toEqual(['藏煞法', '压煞法', '闪法', '脱煞法']);
		expect(SANSHI_XUE.find((x)=>x.name === '天穴').zhu).toBe('主贵');
		expect(SANSHI_XUE.find((x)=>x.name === '地穴').zhu).toBe('主富');
	});
	it('九星变体细目、寻穴诀窍（含经四位45°）、三大干龙', ()=>{
		expect(Object.keys(JIUXING_BIANTI)).toHaveLength(8);
		expect(JIUXING_BIANTI.右弼.find((x)=>x.name === '入草蛇').mai).toBe('阳脉');
		expect(XUNXUE_QIAOMEN.find((x)=>x.key === 'jingsiwei').deg).toBe(45);
		expect(SANDA_GANLONG).toHaveLength(3);
		expect(SANDA_GANLONG[0].name).toBe('北干龙');
	});
	it('参考表挂载：新增枚举都能从 XINGSHI_TABLES 取到（左栏渲染同源）', ()=>{
		['dingXue13', 'zhengXue13', 'bianXue8', 'mingtangJi', 'mingtangXiong', 'longhuDuan',
			'shuikou5', 'shui5ju', 'shuichengSub', 'guaiXue8', 'ziranShuifa', 'hexing'].forEach((k)=>{
			expect(XINGSHI_TABLES[k]).toBeTruthy();
		});
		// 旧键不得被顶掉（零回归）
		['nineStar', 'dingXue', 'zhengXue', 'daoZhang', 'sha', 'shuiCheng', 'shui'].forEach((k)=>{
			expect(XINGSHI_TABLES[k]).toBeTruthy();
		});
	});
});

describe('形势九纲 · 健壮性', ()=>{
	it('脏入参不抛、不 NaN', ()=>{
		[undefined, null, {}, { scoreMode: 'nine' }, { scoreMode: 'nine', zhengXue13: 'X', mingtang4: 3, longhu6ji: null,
			shuikouGuan: {}, dingXue13: 999, guaiXue: [], ruShouGe: 'yes', longGuiJian: 'X' }].forEach((sel)=>{
			const r = xingshi(sel);
			expect(r.available).toBe(true);
			expect(Number.isFinite(r.total)).toBe(true);
			expect(r.grade.text).toBeTruthy();
		});
	});
	it('九纲穷举：每个新纲的每个取值都真影响总分（无死开关）', ()=>{
		const b = xingshi({ scoreMode: 'nine' }).total;
		expect(xingshi({ scoreMode: 'nine', mingtangJi: MINGTANG_JI_9[0].name }).total).not.toBe(b);
		expect(xingshi({ scoreMode: 'nine', mingtangXiong: MINGTANG_XIONG_9[0].name }).total).not.toBe(b);
		expect(xingshi({ scoreMode: 'nine', longhuXing: LONGHU_DUAN_15[0].xing }).total).not.toBe(b);
		expect(xingshi({ scoreMode: 'nine', shuikouSha: SHUIKOU_5SHA[0].name }).total).not.toBe(b);
		expect(xingshi({ scoreMode: 'nine', zhengXue13: ['chaoshan'] }).total).not.toBe(b);
		expect(xingshi({ scoreMode: 'nine', dingXue13: DINGXUE_13[0].name }).total).not.toBe(b);
		expect(xingshi({ scoreMode: 'nine', jieXueJu: JIEXUE_5JU[0] }).total).not.toBe(b);
		expect(xingshi({ scoreMode: 'nine', shuikouLock: false }).total).not.toBe(b);
	});
});
