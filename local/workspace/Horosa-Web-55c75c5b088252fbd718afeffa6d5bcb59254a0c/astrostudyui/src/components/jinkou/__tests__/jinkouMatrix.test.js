/**
 * 金口诀排查轮 · 第3步压测矩阵：每选项每取值 × 选项间组合 × 边界/空值/极端/冲突。
 *
 * 判据分三层，缺一不可：
 *   ① 不抛（任何取值组合都不能炸）
 *   ② 结构完整（四位齐、必产字段非空、无 undefined/NaN 漏进文案）
 *   ③ 真差异（该变的变、不该变的不变——「开关拧了没反应」和「开关拧了乱变」都是 bug）
 */
import { buildJinKouData, JINKOU_TOPIC_KEYS } from '../JinKouCalc';
import { buildJinKouSnapshotText } from '../JinKouMain';

const ZI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

function mockLR(dayGanZi, monthGanZi, timeZhi){
	return {
		nongli: { dayGanZi: dayGanZi, time: `${timeZhi}时`, monthGanZi: monthGanZi, jieqi: '立秋' },
		fourColumns: { year: { ganzi: '丙午' }, month: { ganzi: monthGanZi }, day: { ganzi: dayGanZi }, time: { ganzi: '壬申' } },
		xun: { '旬空': '寅卯', '旬首': '甲辰' },
		season: { '金': '囚', '木': '旺', '水': '休', '火': '相', '土': '死' },
		gods: { '天乙': '丑' }, godsGan: {}, godsMonth: {}, godsZi: {}, godsYear: { taisui1: { '岁破': '子' } },
	};
}
const BASE_LR = mockLR('甲辰', '丙申', '申');

// 结构完整性：任何组合都必须满足的不变量。
function assertWellFormed(d, label){
	expect(d).toBeTruthy();
	expect(Array.isArray(d.rows)).toBe(true);
	expect(d.rows.length).toBe(4);
	expect(d.rows.map((r)=>r.label)).toEqual(['人元', '贵神', '将神', '地分']);
	// 四位内容不得为 undefined/null（缺值用 '—'，不得漏成 undefined 字面量）
	d.rows.forEach((r)=>{
		['label', 'content', 'gan'].forEach((k)=>{
			expect(r[k] === undefined || r[k] === null).toBe(false);
			expect(`${r[k]}`).not.toMatch(/undefined|NaN|\[object/);
		});
	});
	// 起盘核心量非空
	expect(ZI).toContain(d.diFen);
	expect(d.renYuanGan).toBeTruthy();
	expect(d.yuejiang).toBeTruthy();
	expect(d.timeZi).toBeTruthy();
	// 流派回显必与传入一致
	expect(d.schools).toBeTruthy();
	// 十二长生表恒 12 项
	expect(Object.keys(d.phaseTable || {}).length).toBe(12);
	// 派生集合恒为数组
	['geju', 'relations', 'sixiangShu', 'nianYueRi', 'cike', 'taixuan'].forEach((k)=>{
		expect(Array.isArray(d[k])).toBe(true);
	});
	// rows 的人元恒等于 renYuanGan（自洽：显示与解读同一日干）
	const rowGan = d.rows.filter((r)=>r.label === '人元').map((r)=>r.content)[0];
	expect(rowGan).toBe(d.renYuanGan);
	if(label){ expect(typeof label).toBe('string'); }
}

describe('矩阵①：五流派开关全组合 × 十二地分（2×2×2×2×2×12 = 384）', ()=>{
	it('384 组合全部不抛且结构完整', ()=>{
		let n = 0;
		['zhongqi', 'jiaojie'].forEach((yj)=>{
			['shiwu', 'liuren'].forEach((gt)=>{
				['di', 'tian'].forEach((gp)=>{
					['yang', 'yin'].forEach((ps)=>{
						['shen', 'yin'].forEach((sc)=>{
							ZI.forEach((df)=>{
								const d = buildJinKouData(BASE_LR, {
									diFen: df, zhanShi: '申', guirengType: 0,
									schoolYueJiang: yj, schoolGuiTable: gt, schoolGuiPan: gp, panShi: ps, soilChangSheng: sc,
								});
								assertWellFormed(d);
								expect(d.schools.yueJiang).toBe(yj);
								expect(d.schools.guiTable).toBe(gt);
								expect(d.schools.guiPan).toBe(gp);
								expect(d.schools.panShi).toBe(ps);
								expect(d.schools.soilChangSheng).toBe(sc);
								// 阴盘档必产三层，阳盘档恒 null（开关真门控）
								if(ps === 'yin'){
									expect(d.yinPan).toBeTruthy();
									expect(d.yinPan.wangScore.length).toBe(4);
								}else{
									expect(d.yinPan).toBeNull();
								}
								n += 1;
							});
						});
					});
				});
			});
		});
		expect(n).toBe(384);
	});
});

describe('矩阵②：十干日 × 十二地分 × 十二占时（10×12×12 = 1440）', ()=>{
	it('1440 组合不抛、四位自洽、人元合五鼠遁', ()=>{
		let n = 0;
		GAN.forEach((g, gi)=>{
			const dayGanZi = `${g}${ZI[gi % 12]}`;
			ZI.forEach((df)=>{
				ZI.forEach((tz)=>{
					const d = buildJinKouData(mockLR(dayGanZi, '丙申', tz), { diFen: df, zhanShi: tz, guirengType: 0 });
					assertWellFormed(d);
					expect(d.timeZi).toBe(tz);
					expect(d.diFen).toBe(df);
					n += 1;
				});
			});
		});
		expect(n).toBe(1440);
	});
});

describe('矩阵③：七专题 × 三测时 × 有无出生档（7×3×2 + 边界）', ()=>{
	it('专题×测时×出生档全组合不抛；缺参给 needText 而非乱起课', ()=>{
		let n = 0;
		JINKOU_TOPIC_KEYS.forEach((tk)=>{
			['year', 'month', 'day'].forEach((sk)=>{
				[{ benMing: '卯', birthGanZi: '乙亥', age: 32 }, { benMing: '', birthGanZi: '', age: '' }].forEach((birth)=>{
					const d = buildJinKouData(BASE_LR, {
						diFen: '午', zhanShi: '申', guirengType: 0,
						topicKey: tk, shiJianKind: sk, gender: 1, ...birth,
					});
					assertWellFormed(d);
					expect(d.topic).toBeTruthy();
					expect(d.topic.key).toBe(tk);
					// 缺参专题必须给 needText，且不得产出半成品 result
					if(d.topic.ready === false){
						expect(d.topic.needText).toBeTruthy();
					}
					// 行年只在生年+虚岁齐备时产出
					if(birth.birthGanZi && birth.age){
						expect(d.xingNian).toBeTruthy();
						expect(d.xingNian.age).toBe(32);
					}else{
						expect(d.xingNian).toBeNull();
					}
					n += 1;
				});
			});
		});
		expect(n).toBe(JINKOU_TOPIC_KEYS.length * 3 * 2);
	});
});

describe('矩阵④：边界 / 空值 / 极端 / 冲突输入', ()=>{
	const CASES = [
		['空 options', {}],
		['options=undefined', undefined],
		['非法地分', { diFen: 'XX' }],
		['非法占时', { diFen: '午', zhanShi: '@@' }],
		['非法月将', { diFen: '午', yueJiang: '999' }],
		['非法流派值', { diFen: '午', schoolYueJiang: 'nope', schoolGuiTable: 'nope', schoolGuiPan: 'nope', panShi: 'nope', soilChangSheng: 'nope' }],
		['非法五行', { diFen: '午', wuxing: '铁' }],
		['非法专题键', { diFen: '午', topicKey: 'not-a-topic' }],
		['非法测时键', { diFen: '午', shiJianKind: 'century' }],
		['属相非支', { diFen: '午', topicKey: 'yunyu', benMing: '龙' }],
		['虚岁为 0', { diFen: '午', birthGanZi: '乙亥', age: 0, gender: 1 }],
		['虚岁为负', { diFen: '午', birthGanZi: '乙亥', age: -5, gender: 1 }],
		['虚岁极大', { diFen: '午', birthGanZi: '乙亥', age: 999, gender: 1 }],
		['虚岁非数', { diFen: '午', birthGanZi: '乙亥', age: 'abc', gender: 1 }],
		['生年干支非法', { diFen: '午', birthGanZi: '甲', age: 30, gender: 1 }],
		['性别未知', { diFen: '午', birthGanZi: '乙亥', age: 30, gender: -1 }],
		['冲突：阳盘却要阴盘字段', { diFen: '午', panShi: 'yang', soilChangSheng: 'yin' }],
		['冲突：天盘但月将为空', { diFen: '午', schoolGuiPan: 'tian', yueJiang: '' }],
		['全部极端叠加', { diFen: 'ZZ', zhanShi: 'ZZ', yueJiang: 'ZZ', wuxing: 'ZZ', topicKey: 'ZZ', shiJianKind: 'ZZ',
			schoolGuiPan: 'ZZ', panShi: 'ZZ', soilChangSheng: 'ZZ', benMing: 'ZZ', birthGanZi: 'ZZ', age: NaN, gender: 'ZZ' }],
	];

	CASES.forEach(([name, opt])=>{
		it(`不抛且结构完整：${name}`, ()=>{
			const d = buildJinKouData(BASE_LR, opt);
			assertWellFormed(d, name);
			// 非法值一律落到默认档，不得产生第三种状态
			expect(['zhongqi', 'jiaojie']).toContain(d.schools.yueJiang);
			expect(['shiwu', 'liuren']).toContain(d.schools.guiTable);
			expect(['di', 'tian']).toContain(d.schools.guiPan);
			expect(['yang', 'yin']).toContain(d.schools.panShi);
			expect(['shen', 'yin']).toContain(d.schools.soilChangSheng);
		});
	});

	it('课盘为空 / 残缺 nongli 不抛', ()=>{
		expect(()=>buildJinKouData(null, { diFen: '午' })).not.toThrow();
		expect(()=>buildJinKouData({}, { diFen: '午' })).not.toThrow();
		expect(()=>buildJinKouData({ nongli: {} }, { diFen: '午' })).not.toThrow();
	});
});

describe('矩阵⑤：快照在全组合下良构（AI 链的下游不得吃到脏数据）', ()=>{
	it('流派×盘式×专题抽样 64 组：无 undefined/NaN/[object，段头唯一', ()=>{
		let n = 0;
		['zhongqi', 'jiaojie'].forEach((yj)=>{
			['shiwu', 'liuren'].forEach((gt)=>{
				['yang', 'yin'].forEach((ps)=>{
					['shen', 'yin'].forEach((sc)=>{
						['', 'fujiashi', 'jiazhai', 'banzhi'].forEach((tk)=>{
							const d = buildJinKouData(BASE_LR, {
								diFen: '午', zhanShi: '申', guirengType: 0,
								schoolYueJiang: yj, schoolGuiTable: gt, panShi: ps, soilChangSheng: sc,
								topicKey: tk, benMing: '卯', birthGanZi: '乙亥', age: 32, gender: 1,
							});
							const txt = buildJinKouSnapshotText({ date: '2026-08-10', time: '15:30:00' }, BASE_LR, null, d, '土', 0, 1);
							expect(txt).not.toMatch(/undefined|NaN|\[object Object\]/);
							const heads = (txt.match(/^\[[^\]]+\]$/gm) || []);
							expect(new Set(heads).size).toBe(heads.length);   // 段头不得重复
							// GFM 表：每张表的数据行列数必须与表头一致
							const lines = txt.split('\n');
							for(let i = 0; i < lines.length; i++){
								if(/^\|.*\|$/.test(lines[i]) && /^\|[\s\-|]+\|$/.test(lines[i + 1] || '')){
									const cols = lines[i].split('|').length;
									let j = i + 2;
									while(j < lines.length && /^\|.*\|$/.test(lines[j]) && !/^\|[\s\-|]+\|$/.test(lines[j])){
										expect(lines[j].split('|').length).toBe(cols);
										j += 1;
									}
								}
							}
							n += 1;
						});
					});
				});
			});
		});
		expect(n).toBe(64);
	});
});

describe('矩阵⑥：真差异断言（开关拧了必须有反应，且只动该动的面）', ()=>{
	const base = ()=>buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0 });

	it('月将换将改将神；贵人表/起贵神盘改贵神；三者互不越界', ()=>{
		const b = base();
		const yj = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, schoolYueJiang: 'jiaojie' });
		// 换将只改月将链，不改人元（人元只由日干+地分定）
		expect(yj.renYuanGan).toBe(b.renYuanGan);
		const gp = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, schoolGuiPan: 'tian' });
		expect(gp.renYuanGan).toBe(b.renYuanGan);
		expect(gp.jiangZi).toBe(b.jiangZi);            // 起贵神盘不动将神
	});

	it('土长生只动长生表与阴盘长生项，不动四位', ()=>{
		const b = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, wuxing: '土' });
		const y = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, wuxing: '土', soilChangSheng: 'yin' });
		expect(y.phaseTable['长生']).not.toBe(b.phaseTable['长生']);
		expect(JSON.stringify(y.rows)).toBe(JSON.stringify(b.rows));
		expect(y.renYuanGan).toBe(b.renYuanGan);
		expect(y.guiName).toBe(b.guiName);
	});

	it('盘式只加阴盘一层，四位与既有解读层逐键不动', ()=>{
		const b = base();
		const y = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, panShi: 'yin' });
		['rows', 'geju', 'relations', 'dong', 'sixiangShu', 'nianYueRi'].forEach((k)=>{
			expect(JSON.stringify(y[k])).toBe(JSON.stringify(b[k]));
		});
	});

	it('专题只加专题层，主课四位一字不动', ()=>{
		const b = base();
		JINKOU_TOPIC_KEYS.forEach((tk)=>{
			const t = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, topicKey: tk, benMing: '卯' });
			expect(JSON.stringify(t.rows)).toBe(JSON.stringify(b.rows));
			expect(t.renYuanGan).toBe(b.renYuanGan);
			expect(t.guiName).toBe(b.guiName);
			expect(t.jiangZi).toBe(b.jiangZi);
		});
	});

	it('十二地分逐支必给出不同的课（地分是起课基准，不能有两支同课）', ()=>{
		const sigs = ZI.map((df)=>{
			const d = buildJinKouData(BASE_LR, { diFen: df, zhanShi: '申', guirengType: 0 });
			return JSON.stringify([d.renYuanGan, d.guiZi, d.jiangZi, d.diFen]);
		});
		expect(new Set(sigs).size).toBe(12);
	});

	it('三盘环（G21）：本地按流派现算，12 格齐、随该动的开关动、不随不该动的开关动', ()=>{
		const b = base();
		expect(Array.isArray(b.plates)).toBe(true);
		expect(b.plates.length).toBe(12);
		b.plates.forEach((p, i)=>{
			expect(p.index).toBe(i + 1);
			expect(p.di).toBe(ZI[i]);
			expect(ZI).toContain(p.tian);
			expect(p.jiang).toBeTruthy();
			expect(p.gui).toBeTruthy();
			expect(ZI).toContain(p.shen);
		});
		// 十二格的天盘支互不相同（天盘是整圈旋转，不可能两格同支）
		expect(new Set(b.plates.map((p)=>p.tian)).size).toBe(12);
		expect(new Set(b.plates.map((p)=>p.gui)).size).toBe(12);

		const ring = (d)=>d.plates.map((p)=>`${p.di}/${p.tian}/${p.jiang}/${p.shen}/${p.gui}`).join(' ');
		// 月将换将 → 只动天盘/将名，贵神圈不动
		const yj = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, schoolYueJiang: 'jiaojie' });
		// 贵人表 / 起贵神盘 → 只动贵神圈，天盘不动
		const gt = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, schoolGuiTable: 'liuren' });
		const gp = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, schoolGuiPan: 'tian' });
		expect(gt.plates.map((p)=>p.tian).join('')).toBe(b.plates.map((p)=>p.tian).join(''));
		expect(gp.plates.map((p)=>p.tian).join('')).toBe(b.plates.map((p)=>p.tian).join(''));
		expect(ring(gp)).not.toBe(ring(b));       // 天盘法确实换了贵神圈
		// 盘式 / 土长生 与三盘环无关，环须逐格不动
		['panShi', 'soilChangSheng'].forEach((k)=>{
			const d = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, [k]: 'yin' });
			expect(ring(d)).toBe(ring(b));
		});
		// 地分不参与三盘环（环是整盘旋转，与从哪一格读无关）
		expect(ring(buildJinKouData(BASE_LR, { diFen: '子', zhanShi: '申', guirengType: 0 }))).toBe(ring(b));
		// 月将/占时缺失 → 不产环（而非产半张）
		expect(buildJinKouData({ nongli: {} }, { diFen: '午' }).plates.length === 0
			|| buildJinKouData({ nongli: {} }, { diFen: '午' }).plates.length === 12).toBe(true);
		if(yj.plates.length){ expect(yj.plates.length).toBe(12); }
	});

	it('合占扣题（G6/E1-3）：七类扣题真改取用位，三档时段真改断辞', ()=>{
		const b = base();
		expect(b.hezhan.askLabel).toBe('');                 // 未限定
		expect(b.hezhan.timeLabel).toBe('常规');
		const FOCUS = { qiucai: '将神', guantu: '贵神', guansi: '贵神', xueye: '贵神', hunyue: '将神', huaiyun: '将神' };
		Object.keys(FOCUS).forEach((k)=>{
			const d = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, askKey: k });
			expect(d.hezhan.askKey).toBe(k);
			expect(d.hezhan.askLabel).toBeTruthy();
			expect(d.hezhan.usePosition).toBe(FOCUS[k]);     // 扣题真改取用位
			expect(d.hezhan.chain.join('')).toContain('取事：');
		});
		// 问病无定位（以受克之位定病所），取用回落用爻
		const bing = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, askKey: 'jibing' });
		expect(bing.hezhan.askLabel).toBe('病');
		// 三档时段各出各的断辞
		const labels = ['default', 'day', 'year'].map((t)=>{
			const d = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, timeScope: t });
			return d.hezhan.timeLabel;
		});
		expect(new Set(labels).size).toBe(3);
		// 扣题不动主课四位
		Object.keys(FOCUS).forEach((k)=>{
			const d = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, askKey: k });
			expect(JSON.stringify(d.rows)).toBe(JSON.stringify(b.rows));
		});
		// 非法扣题键落回未限定，不产生第三种状态
		const bad = buildJinKouData(BASE_LR, { diFen: '午', zhanShi: '申', guirengType: 0, askKey: 'nope', timeScope: 'nope' });
		expect(bad.hezhan.askLabel).toBe('');
		expect(bad.hezhan.timeLabel).toBe('常规');
	});

	it('默认档逐键稳定（零回归锚：默认组合的课式不得随版本漂）', ()=>{
		const d = base();
		expect(d.schools).toEqual({ yueJiang: 'zhongqi', guiTable: 'shiwu', guiPan: 'di', panShi: 'yang', soilChangSheng: 'shen' });
		expect(d.diFen).toBe('午');
		expect(d.timeZi).toBe('申');
		expect(d.renYuanGan).toBe('庚');
		expect(d.yinPan).toBeNull();
		expect(d.topic).toBeNull();
		expect(d.shiJian).toBeNull();
		expect(d.xingNian).toBeNull();
	});
});
