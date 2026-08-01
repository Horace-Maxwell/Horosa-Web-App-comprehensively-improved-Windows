import { buildJinKouData, calcJinKouWangElem, buildJinKouWangShuaiMap, JinKouShenShaOrder, buildJinKouBihe } from './JinKouCalc';
import { JINKOU_SHENSHA_DOC, JINKOU_RELATION_DOC, JINKOU_BIHE_DOC, JINKOU_CATEGORY_RULES, JINKOU_GUISHEN_XIANGYI, JINKOU_YUEJIANG_DOC, JINKOU_BASHE_DOC } from './JinKouDoc';

function mockLiuReng(data){
	return {
		nongli: {
			dayGanZi: '甲辰',
			time: '申时',
			monthGanZi: '丙申',
			...(data && data.nongli ? data.nongli : {}),
		},
		fourColumns: {
			month: { ganzi: '丙申' },
			...(data && data.fourColumns ? data.fourColumns : {}),
		},
		xun: {
			'旬空': '寅卯',
			'旬首': '甲辰',
			...(data && data.xun ? data.xun : {}),
		},
		season: {
			'金': '囚',
			'木': '旺',
			'水': '休',
			'火': '相',
			'土': '死',
			...(data && data.season ? data.season : {}),
		},
		gods: data && data.gods ? data.gods : {},
		godsGan: data && data.godsGan ? data.godsGan : {},
		godsMonth: data && data.godsMonth ? data.godsMonth : {},
		godsZi: data && data.godsZi ? data.godsZi : {},
		godsYear: data && data.godsYear ? data.godsYear : { taisui1: {} },
	};
}

describe('JinKouCalc', ()=>{
	it('matches textbook sample for 甲日申时 with 地分午', ()=>{
		const data = buildJinKouData(mockLiuReng(), {
			diFen: '午',
			guirengType: 0,
		});
		expect(data.ready).toBe(true);
		expect(data.diFen).toBe('午');
		expect(data.renYuanGan).toBe('庚');
		expect(data.guiName).toBe('青龙');
		expect(data.guiZi).toBe('寅');
		expect(data.jiangZi).toBe('卯');
		expect(data.jiangName).toBe('太冲');
	});

	it('matches textbook table for 甲日申时 with 地分子', ()=>{
		const data = buildJinKouData(mockLiuReng(), {
			diFen: '子',
			guirengType: 0,
		});
		expect(data.renYuanGan).toBe('甲');
		expect(data.guiZi).toBe('亥');
		expect(data.jiangZi).toBe('酉');
	});

	it('matches manual sample for 戊戌日未时午位', ()=>{
		const data = buildJinKouData(mockLiuReng({
			nongli: {
				dayGanZi: '戊戌',
				time: '未时',
				monthGanZi: '丁卯',
			},
			fourColumns: {
				month: { ganzi: '丁卯' },
			},
		}), {
			diFen: '午',
			guirengType: 0,
		});
		expect(data.renYuanGan).toBe('戊');
		expect(data.guiZi).toBe('寅');
		expect(data.jiangZi).toBe('酉');
		expect(data.yongYao.label).toBe('将神');
	});

	it('matches app case for 丙寅日丑时丑位', ()=>{
		const data = buildJinKouData(mockLiuReng({
			nongli: {
				dayGanZi: '丙寅',
				time: '丑时',
				monthGanZi: '庚寅',
			},
			fourColumns: {
				month: { ganzi: '庚寅' },
			},
		}), {
			diFen: '丑',
			guirengType: 0,
		});
		expect(data.renYuanGan).toBe('己');
		expect(data.guiZi).toBe('未');
		expect(data.guiName).toBe('太常');
		expect(data.jiangZi).toBe('亥');
		expect(data.jiangGan).toBe('己');
		expect(data.yongYao.label).toBe('人元');
	});

	it('prefers 节气段月将 over conflicting 六壬月将 fallback', ()=>{
		const data = buildJinKouData(mockLiuReng({
			yue: '戌',
			nongli: {
				dayGanZi: '癸未',
				time: '戌时',
				monthGanZi: '辛卯',
				jieqi: '惊蛰',
			},
			fourColumns: {
				month: { ganzi: '辛卯' },
			},
		}), {
			diFen: '戌',
			guirengType: 0,
		});
		expect(data.yuejiang).toBe('亥');
		expect(data.jiangZi).toBe('亥');
		expect(data.jiangName).toBe('登明');
		expect(data.jiangGan).toBe('癸');
	});

	it('falls back to 节气段月将 when 六壬月将缺失', ()=>{
		const data = buildJinKouData(mockLiuReng({
			nongli: {
				dayGanZi: '癸未',
				time: '戌时',
				monthGanZi: '辛卯',
				jieqi: '惊蛰',
			},
			fourColumns: {
				month: { ganzi: '辛卯' },
			},
		}), {
			diFen: '戌',
			guirengType: 0,
		});
		expect(data.yuejiang).toBe('亥');
		expect(data.jiangZi).toBe('亥');
		expect(data.jiangName).toBe('登明');
		expect(data.jiangGan).toBe('癸');
	});

	it('falls back to jiedelta text when jieqi field is missing', ()=>{
		const data = buildJinKouData(mockLiuReng({
			nongli: {
				dayGanZi: '癸未',
				time: '癸亥',
				monthGanZi: '辛卯',
				jieqi: null,
				jiedelta: '惊蛰后第5天',
			},
			fourColumns: {
				month: { ganzi: '辛卯' },
			},
		}), {
			diFen: '亥',
			guirengType: 0,
		});
		expect(data.yuejiang).toBe('亥');
		expect(data.jiangZi).toBe('亥');
		expect(data.jiangName).toBe('登明');
		expect(data.jiangGan).toBe('癸');
	});

	it('uses explicit diurnal flag to determine day/night branch', ()=>{
		const base = mockLiuReng({
			nongli: {
				dayGanZi: '丙寅',
				time: '丑时',
				monthGanZi: '庚寅',
			},
			fourColumns: {
				month: { ganzi: '庚寅' },
			},
		});
		const dayData = buildJinKouData(base, {
			diFen: '丑',
			guirengType: 0,
			isDiurnal: true,
		});
		const nightData = buildJinKouData(base, {
			diFen: '丑',
			guirengType: 0,
			isDiurnal: false,
		});
		expect(dayData.guiName).toBe('朱雀');
		expect(dayData.guiZi).toBe('午');
		expect(nightData.guiName).toBe('太常');
		expect(nightData.guiZi).toBe('未');
	});

	it('calculates 四大空亡 from 旬首', ()=>{
		const dataZi = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '戌亥',
				'旬首': '甲子',
			},
		}), {
			diFen: '子',
			guirengType: 0,
		});
		expect(dataZi.siDaKong).toBe('水');

		const dataWu = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '辰巳',
				'旬首': '甲午',
			},
		}), {
			diFen: '午',
			guirengType: 0,
		});
		expect(dataWu.siDaKong).toBe('水');

		const dataYin = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '子丑',
				'旬首': '甲寅',
			},
		}), {
			diFen: '寅',
			guirengType: 0,
		});
		expect(dataYin.siDaKong).toBe('金');

		const dataShen = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '午未',
				'旬首': '甲申',
			},
		}), {
			diFen: '申',
			guirengType: 0,
		});
		expect(dataShen.siDaKong).toBe('金');

		const dataOther = buildJinKouData(mockLiuReng({
			xun: {
				'旬空': '寅卯',
				'旬首': '甲辰',
			},
		}), {
			diFen: '辰',
			guirengType: 0,
		});
		expect(dataOther.siDaKong).toBe('');
	});

	it('calculates 旺 element by textbook rules', ()=>{
		expect(calcJinKouWangElem(['金', '木', '水', '火'])).toBe('水');
		expect(calcJinKouWangElem(['木', '火', '水', '土'])).toBe('木');
		expect(calcJinKouWangElem(['金', '木', '火', '土'])).toBe('火');
		expect(calcJinKouWangElem(['木', '木', '火', '火'])).toBe('火');
		expect(calcJinKouWangElem(['木', '木', '土', '土'])).toBe('木');
		expect(calcJinKouWangElem(['水', '水', '金', '金'])).toBe('水');
		expect(calcJinKouWangElem(['金', '金', '木', '水'])).toBe('金');
	});

	it('builds 旺相休囚死 map from 旺 element', ()=>{
		const map = buildJinKouWangShuaiMap('水');
		expect(map['水']).toBe('旺');
		expect(map['木']).toBe('相');
		expect(map['金']).toBe('休');
		expect(map['土']).toBe('囚');
		expect(map['火']).toBe('死');
	});

	it('derives 解读层 fields (relations / 应期 / 太玄数 / 神煞判语)', ()=>{
		const data = buildJinKouData(mockLiuReng(), {
			diFen: '午',
			guirengType: 0,
		});
		expect(Array.isArray(data.taixuan)).toBe(true);
		expect(data.taixuan.length).toBe(4);
		const diTx = data.taixuan.find((t)=>t.label === '地分');
		expect(diTx.num).toBe(9);
		expect(Array.isArray(data.relations)).toBe(true);
		expect(Array.isArray(data.branchRelations)).toBe(true);
		expect(data.yongStrength).toBeTruthy();
		expect(typeof data.yongStrength.text).toBe('string');
		expect(data.yingQi).toBeTruthy();
		expect(typeof data.yingQi.scope).toBe('string');
		expect(data.shenshaDocRows.length).toBe(4);
		expect(Array.isArray(data.relevantShensha)).toBe(true);
		data.relevantShensha.forEach((item)=>{
			expect(['ji', 'xiong', 'zhong']).toContain(item.jx);
		});
		const qc = data.categoryRules.filter((c)=>c.texts && c.texts.length);
		expect(qc.length).toBeGreaterThanOrEqual(1);
		expect(Array.isArray(data.dong.wu)).toBe(true); // 五动三动已填实(P0-2)
		expect(Array.isArray(data.dong.san)).toBe(true);
	});

	it('四位生克补全 §10.3 全例 + 五比同类 §10.4 (P0-3)', ()=>{
		// 16 方向条目 + 5 干元类，全部落 DOC
		const keys = [
			'贵神_被克_人元', '将神_被克_人元', '贵神_被生_人元', '将神_被生_人元',
			'地分_被生_贵神', '地分_被克_贵神', '将神_被生_贵神', '贵神_生_人元',
			'将神_生_人元', '将神_克_人元', '地分_被生_将神', '地分_被克_将神',
			'地分_克_贵神', '地分_克_将神', '地分_生_贵神', '地分_生_将神',
			'神干_合_将干', '神干_生_将干', '神干_被生_将干', '神干_克_将干', '神干_被克_将干',
		];
		keys.forEach((k)=>{
			expect(typeof JINKOU_RELATION_DOC[k]).toBe('string');
			expect(JINKOU_RELATION_DOC[k].length).toBeGreaterThan(4);
		});
		expect(Object.keys(JINKOU_BIHE_DOC)).toEqual(expect.arrayContaining(['正比', '近比', '远比', '次比', '合比']));
		// 五比逻辑：干方同气→正比；神将同气→次比
		const bihe = buildJinKouBihe([
			{ label: '人元', elem: '火' }, { label: '贵神', elem: '金' }, { label: '将神', elem: '金' }, { label: '地分', elem: '火' },
		]);
		expect(bihe.map((b)=>b.name)).toContain('正比'); // 人元火 = 地分火
		expect(bihe.map((b)=>b.name)).toContain('次比'); // 贵神金 = 将神金
		// 四位俱比 → 合比独占
		const allSame = buildJinKouBihe([
			{ label: '人元', elem: '土' }, { label: '贵神', elem: '土' }, { label: '将神', elem: '土' }, { label: '地分', elem: '土' },
		]);
		expect(allSame.map((b)=>b.name)).toEqual(['合比']);
		// buildJinKouData 输出 bihe 数组、relations 结构合法
		const data = buildJinKouData(mockLiuReng(), { diFen: '午', guirengType: 0 });
		expect(Array.isArray(data.bihe)).toBe(true);
		data.bihe.forEach((b)=>{ expect(['正比', '近比', '远比', '次比', '合比']).toContain(b.name); });
		data.relations.forEach((r)=>{ expect(r.from).toBeTruthy(); expect(r.to).toBeTruthy(); expect(r.rel).toBeTruthy(); });
	});

	it('分类用神补全 13 类 (P0-4)', ()=>{
		expect(JINKOU_CATEGORY_RULES.length).toBe(13);
		const keys = JINKOU_CATEGORY_RULES.map((c)=>c.key);
		expect(new Set(keys).size).toBe(13); // key 全唯一
		['qiucai', 'guantu', 'jibing', 'hunyue', 'huaiyun', 'xueye', 'chuxing', 'xunren', 'shiwu', 'laiyi', 'guansi', 'tianqi', 'yangzhai'].forEach((k)=>{
			expect(keys).toContain(k);
		});
		JINKOU_CATEGORY_RULES.forEach((c)=>{
			expect(typeof c.name).toBe('string');
			expect(typeof c.yongHint).toBe('string');
			expect(Array.isArray(c.texts)).toBe(true);
			expect(c.texts.length).toBeGreaterThanOrEqual(2);
			expect(typeof c.src).toBe('string');
		});
	});

	it('神煞起例补全:月德合/桃花/禄倒/马倒 (P0-5)', ()=>{
		['月德合', '桃花', '禄倒', '马倒'].forEach((n)=>{
			expect(JinKouShenShaOrder).toContain(n);
			expect(JINKOU_SHENSHA_DOC[n]).toBeTruthy();
			expect(['ji', 'xiong', 'zhong']).toContain(JINKOU_SHENSHA_DOC[n].jx);
		});
		// 甲辰日(干甲/支辰)、丙申月:禄倒[甲]=卯、桃花[辰]=酉、马倒[辰]=卯、月德(申子辰→壬)合=丁
		// 起例落于含该干支之四位即显;此处验 buildJinKouData 不抛且神煞库可解析这些名
		const data = buildJinKouData(mockLiuReng(), { diFen: '午', guirengType: 0 });
		expect(Array.isArray(data.shenshaDocRows)).toBe(true);
		const allNames = (data.relevantShensha || []).map((it)=>it.name);
		allNames.forEach((n)=>{ expect(typeof n).toBe('string'); });
	});

	it('十二贵神/月将象意补全 (P0-9)', ()=>{
		const guishen = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];
		expect(Object.keys(JINKOU_GUISHEN_XIANGYI).sort()).toEqual(guishen.slice().sort());
		guishen.forEach((g)=>{
			const d = JINKOU_GUISHEN_XIANGYI[g];
			expect(['ji', 'xiong', 'zhong']).toContain(d.jx);
			expect(d.renwu.length).toBeGreaterThan(0);
			expect(d.shiti.length).toBeGreaterThan(0);
			expect(d.desc.length).toBeGreaterThan(4);
		});
		const yuejiang = ['神后', '大吉', '功曹', '太冲', '天罡', '太乙', '胜光', '小吉', '传送', '从魁', '河魁', '登明'];
		expect(Object.keys(JINKOU_YUEJIANG_DOC).sort()).toEqual(yuejiang.slice().sort());
		yuejiang.forEach((y)=>{ expect(JINKOU_YUEJIANG_DOC[y].desc.length).toBeGreaterThan(4); });
		// buildJinKouData 输出 xiangyi（贵神/月将各带 name+desc）
		const data = buildJinKouData(mockLiuReng(), { diFen: '午', guirengType: 0 });
		expect(data.xiangyi).toBeTruthy();
		if(data.xiangyi.guishen){ expect(typeof data.xiangyi.guishen.desc).toBe('string'); }
		if(data.xiangyi.yuejiang){ expect(typeof data.xiangyi.yuejiang.desc).toBe('string'); }
	});

	it('太岁月建 + 忌时 + 八步 (P0-8)', ()=>{
		const data = buildJinKouData(mockLiuReng({ nongli: { yearGanZi: '丙午' } }), { diFen: '午', guirengType: 0 });
		// 太岁月建:各项 name 合法、zhi 为地支、hit 为布尔
		expect(Array.isArray(data.nianYueRi)).toBe(true);
		// 太岁月建九项（真太岁/岁宅/日建为本轮补齐）：真太岁比对整柱干支，故 zhi 列可为两字干支。
		const validNames = ['岁君', '真太岁', '岁破', '岁宅', '月建', '月破', '月厌', '日建', '日冲'];
		data.nianYueRi.forEach((it)=>{
			expect(validNames).toContain(it.name);
			// 支类项 zhi 为单地支；真太岁为整柱干支（干+支两字）。
			const zhiTail = `${it.zhi}`.slice(-1);
			expect('子丑寅卯辰巳午未申酉戌亥'.indexOf(zhiTail) >= 0).toBe(true);
			expect(typeof it.hit).toBe('boolean');
		});
		// 本轮补齐三项须在位（真太岁比整柱、岁宅=岁前五辰、日建=将神与日辰同）
		const nyrNames = data.nianYueRi.map((it)=>it.name);
		expect(nyrNames).toContain('岁宅');
		expect(nyrNames.indexOf('岁宅') > nyrNames.indexOf('岁破')).toBe(true);
		// 忌时:结构含 byYue/byGan/hit
		expect(data.jishi).toBeTruthy();
		expect(typeof data.jishi.hit).toBe('boolean');
		// 八步:8 步,字段完整
		expect(JINKOU_BASHE_DOC.length).toBe(8);
		JINKOU_BASHE_DOC.forEach((s, i)=>{
			expect(s.step).toBe(i + 1);
			expect(s.title.length).toBeGreaterThan(2);
			expect(s.detail.length).toBeGreaterThan(4);
		});
	});

	it('应期合德六法 (P0-7)', ()=>{
		const data = buildJinKouData(mockLiuReng(), { diFen: '午', guirengType: 0 });
		expect(data.yingQi).toBeTruthy();
		expect(Array.isArray(data.yingQi.methods)).toBe(true);
		const valid = ['天地合德', '将干近合', '三奇合', '三合补字', '支六合', '旺相逢冲'];
		data.yingQi.methods.forEach((m)=>{
			expect(valid).toContain(m.fa);
			expect(typeof m.when).toBe('string');
			expect(m.text.length).toBeGreaterThan(0);
		});
		// 用爻地支必有「支六合」与「旺相逢冲」两法（六合/冲表必命中）
		const fas = data.yingQi.methods.map((m)=>m.fa);
		expect(fas).toContain('支六合');
		expect(fas).toContain('旺相逢冲');
	});

	it('covers every 起例 神煞 with a judgment + valid 吉凶色 (guards the 天德合 gap)', ()=>{
		const missing = JinKouShenShaOrder.filter((name)=>!JINKOU_SHENSHA_DOC[name] || !JINKOU_SHENSHA_DOC[name].desc);
		expect(missing).toEqual([]);
		JinKouShenShaOrder.forEach((name)=>{
			expect(['ji', 'xiong', 'zhong']).toContain(JINKOU_SHENSHA_DOC[name].jx);
		});
	});
});

const GUISHEN12 = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];

describe('JinKouCalc 多流派排盘 (P0-1)', ()=>{
	it('A1 月将换将：立春日 中气(子)/交节(亥) 月将不同 → 将神随之变', ()=>{
		const base = { nongli: { jieqi: '立春' } };
		const zq = buildJinKouData(mockLiuReng(base), { schoolYueJiang: 'zhongqi', diFen: '子' });
		const jj = buildJinKouData(mockLiuReng(base), { schoolYueJiang: 'jiaojie', diFen: '子' });
		expect(zq.yuejiang).toBe('子');
		expect(jj.yuejiang).toBe('亥');
		expect(zq.jiangZi).not.toBe(jj.jiangZi);
		expect(zq.schools.yueJiang).toBe('zhongqi');
		expect(jj.schools.yueJiang).toBe('jiaojie');
	});

	it('A2 贵人昼夜表：壬日昼 实务/古法贵神不同；甲丁日两派相同', ()=>{
		// 古法表 = 大六壬昼夜贵人歌，与实务派只在壬癸两干相反（歌诀壬癸昼卯夜巳）。
		const ren = { nongli: { dayGanZi: '壬子', jieqi: '立春' } };
		const sw = buildJinKouData(mockLiuReng(ren), { schoolGuiTable: 'shiwu', zhanShi: '午', diFen: '子' });
		const lr = buildJinKouData(mockLiuReng(ren), { schoolGuiTable: 'liuren', zhanShi: '午', diFen: '子' });
		expect(GUISHEN12).toContain(sw.guiName);
		expect(GUISHEN12).toContain(lr.guiName);
		expect(sw.guiName).not.toBe(lr.guiName); // 壬为两干差异之一
		expect(sw.guiStartZi).toBe('巳'); // 实务壬昼=巳
		expect(lr.guiStartZi).toBe('卯'); // 古法壬昼=卯（兔蛇藏取兔）
		const jia = { nongli: { dayGanZi: '甲子', jieqi: '立春' } };
		const j1 = buildJinKouData(mockLiuReng(jia), { schoolGuiTable: 'shiwu', zhanShi: '午', diFen: '子' });
		const j2 = buildJinKouData(mockLiuReng(jia), { schoolGuiTable: 'liuren', zhanShi: '午', diFen: '子' });
		expect(j1.guiStartZi).toBe('丑'); // 甲戊庚牛羊，昼牛：两派同
		expect(j2.guiStartZi).toBe('丑');
		expect(j1.guiName).toBe(j2.guiName);
		const ding = { nongli: { dayGanZi: '丁卯', jieqi: '立春' } };
		const s2 = buildJinKouData(mockLiuReng(ding), { schoolGuiTable: 'shiwu', zhanShi: '午', diFen: '子' });
		const l2 = buildJinKouData(mockLiuReng(ding), { schoolGuiTable: 'liuren', zhanShi: '午', diFen: '子' });
		expect(s2.guiName).toBe(l2.guiName); // 丁两派相同
	});

	it('A3 起贵神盘：地盘/天盘均产出合法贵神，schools.guiPan 反映选项', ()=>{
		const base = { nongli: { dayGanZi: '甲子', jieqi: '立春' } };
		const di = buildJinKouData(mockLiuReng(base), { schoolGuiPan: 'di', zhanShi: '午', diFen: '子' });
		const tian = buildJinKouData(mockLiuReng(base), { schoolGuiPan: 'tian', zhanShi: '午', diFen: '子' });
		expect(GUISHEN12).toContain(di.guiName);
		expect(GUISHEN12).toContain(tian.guiName);
		expect(di.schools.guiPan).toBe('di');
		expect(tian.schools.guiPan).toBe('tian');
	});

	it('默认组合(中气+实务+地盘+阳盘)零回归：甲辰日申时地分午 课式不变', ()=>{
		const def = buildJinKouData(mockLiuReng(), { diFen: '午', guirengType: 0 });
		expect(def.renYuanGan).toBe('庚'); // 与既有 textbook 例一致
		expect(def.schools.yueJiang).toBe('zhongqi');
		expect(def.schools.guiTable).toBe('shiwu');
		expect(def.schools.guiPan).toBe('di');
		expect(def.schools.panShi).toBe('yang');
	});
});

describe('JinKouCalc 格局判定 (P0-6)', ()=>{
	it('geju 为数组，命中项结构完整(name/kind/text/jx)', ()=>{
		const data = buildJinKouData(mockLiuReng(), { diFen: '午', guirengType: 0 });
		expect(Array.isArray(data.geju)).toBe(true);
		data.geju.forEach((g)=>{
			expect(g.name).toBeTruthy();
			expect(g.text).toBeTruthy();
			expect(['ji', 'xiong', 'zhong']).toContain(g.jx);
		});
	});
});

describe('JinKouCalc 五动三动 (P0-2)', ()=>{
	it('默认盘(人元庚金、地分午火) → 火克金 = 鬼动(方克干)，带断辞', ()=>{
		const data = buildJinKouData(mockLiuReng(), { diFen: '午', guirengType: 0 });
		expect(Array.isArray(data.dong.wu)).toBe(true);
		expect(Array.isArray(data.dong.san)).toBe(true);
		const gui = data.dong.wu.find((d)=>d.type === '鬼');
		expect(gui).toBeTruthy();
		expect(gui.from).toBe('地分');
		expect(gui.to).toBe('人元');
		expect(gui.text).toContain('鬼动');
		expect(typeof gui.kong).toBe('boolean');
		// 五动类型合法、三动类型合法
		data.dong.wu.forEach((d)=>expect(['妻', '官', '贼', '财', '鬼']).toContain(d.type));
		data.dong.san.forEach((d)=>expect(['父母', '子孙', '兄弟']).toContain(d.type));
	});
});

// QA 压测:穷举左栏所有流派/盘法/课式选项的笛卡尔组合,断言不抛 + 全字段结构合法。
describe('JinKouCalc 全选项笛卡尔压测 (QA)', ()=>{
	const ZI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const SCHOOLS = {
		schoolYueJiang: ['zhongqi', 'jiaojie'],
		schoolGuiTable: ['shiwu', 'liuren'],
		schoolGuiPan: ['di', 'tian'],
		panShi: ['yang', 'yin'],
	};
	const DATES = [
		{ label: '普通日', nongli: { dayGanZi: '甲辰', monthGanZi: '丙申', yearGanZi: '丙午' } },
		{ label: '另一日', nongli: { dayGanZi: '戊寅', monthGanZi: '庚子', yearGanZi: '壬寅' } },
	];
	const ZHANSHI = ['auto', '子', '午', '酉'];

	function assertValidData(data, ctx){
		expect(data).toBeTruthy();
		expect(data.ready).toBe(true);
		// 四位齐全
		expect(Array.isArray(data.rows)).toBe(true);
		expect(data.rows.length).toBe(4);
		const labels = data.rows.map((r)=>r.label);
		expect(labels).toEqual(['人元', '贵神', '将神', '地分']);
		data.rows.forEach((r)=>{
			expect(typeof r.content).toBe('string');
			expect(r.content.length).toBeGreaterThan(0);
			expect(['+', '-', '']).toContain(r.sign);
		});
		// 解读层全字段结构合法
		expect(Array.isArray(data.relations)).toBe(true);
		expect(Array.isArray(data.bihe)).toBe(true);
		expect(Array.isArray(data.branchRelations)).toBe(true);
		expect(Array.isArray(data.taixuan)).toBe(true);
		expect(data.taixuan.length).toBe(4);
		expect(Array.isArray(data.dong.wu)).toBe(true);
		expect(Array.isArray(data.dong.san)).toBe(true);
		expect(Array.isArray(data.geju)).toBe(true);
		expect(data.yingQi).toBeTruthy();
		expect(Array.isArray(data.yingQi.methods)).toBe(true);
		expect(Array.isArray(data.nianYueRi)).toBe(true);
		expect(data.jishi).toBeTruthy();
		expect(typeof data.jishi.hit).toBe('boolean');
		expect(data.xiangyi).toBeTruthy();
		expect(data.shenshaDocRows.length).toBe(4);
		// schools 选项回写
		expect(['zhongqi', 'jiaojie']).toContain(data.schools.yueJiang);
		expect(['shiwu', 'liuren']).toContain(data.schools.guiTable);
		expect(['di', 'tian']).toContain(data.schools.guiPan);
	}

	it('穷举 流派×盘式×地分×占时×日期 全组合不抛且结构合法', ()=>{
		let count = 0;
		DATES.forEach((d)=>{
			SCHOOLS.schoolYueJiang.forEach((yj)=>{
				SCHOOLS.schoolGuiTable.forEach((gt)=>{
					SCHOOLS.schoolGuiPan.forEach((gp)=>{
						SCHOOLS.panShi.forEach((ps)=>{
							ZI.forEach((di)=>{
								ZHANSHI.forEach((zs)=>{
									const opt = { diFen: di, zhanShi: zs, guirengType: 0, schoolYueJiang: yj, schoolGuiTable: gt, schoolGuiPan: gp, panShi: ps };
									let data;
									expect(()=>{ data = buildJinKouData(mockLiuReng({ nongli: d.nongli }), opt); }).not.toThrow();
									assertValidData(data, { date: d.label, opt: opt });
									count++;
								});
							});
						});
					});
				});
			});
		});
		// 2 日 × 2 × 2 × 2 × 2 流派 × 12 地分 × 4 占时 = 1536 组合
		expect(count).toBe(2 * 2 * 2 * 2 * 2 * 12 * 4);
	});

	it('边界:空 options / 缺 nongli / 非法地分 不抛', ()=>{
		expect(()=>buildJinKouData(mockLiuReng(), {})).not.toThrow();
		expect(()=>buildJinKouData(mockLiuReng(), { diFen: '不存在', zhanShi: 'xyz', guirengType: 0 })).not.toThrow();
		expect(()=>buildJinKouData(mockLiuReng({ nongli: {} }), { diFen: '子', guirengType: 0 })).not.toThrow();
	});

	it('零回归:默认组合(中气/实务/地盘/阳盘)逐键稳定', ()=>{
		const base = buildJinKouData(mockLiuReng(), { diFen: '午', guirengType: 0 });
		const again = buildJinKouData(mockLiuReng(), { diFen: '午', guirengType: 0, schoolYueJiang: 'zhongqi', schoolGuiTable: 'shiwu', schoolGuiPan: 'di', panShi: 'yang' });
		expect(again.rows.map((r)=>r.content)).toEqual(base.rows.map((r)=>r.content));
		expect(again.rows.map((r)=>r.shenjiang)).toEqual(base.rows.map((r)=>r.shenjiang));
	});
});
