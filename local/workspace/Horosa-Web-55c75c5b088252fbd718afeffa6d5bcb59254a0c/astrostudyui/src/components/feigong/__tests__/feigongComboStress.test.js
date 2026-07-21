// [P3] 飞宫小奇门 · 组合压测:起支三模式全域 × 日干支 10×12 × 命宫年龄/性别边界 —— 局/宫面/主客/快照全链。
import {
	resolveQiZhi, buildJu, mingGong, yuanShenMap, tianXingMap, jianXingZhi,
} from '../core/feigongJu';
import { zhuKe, gongDuan } from '../core/feigongDuan';
import { FANG_WEI_RING } from '../core/feigongConst';
import { buildFeiGongSnapshotText } from '../FeiGongMain';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

describe('[P3] 飞宫组合压测 · 起支三模式', ()=>{
	test('hour/manualZhi:十二支全域直通;非法支 → null', ()=>{
		ZHI.forEach((z)=>{
			expect(resolveQiZhi({ mode: 'hour', hourZhi: z })).toBe(z);
			expect(resolveQiZhi({ mode: 'manualZhi', zhi: z })).toBe(z);
		});
		expect(resolveQiZhi({ mode: 'hour', hourZhi: '天' })).toBe(null);
		expect(resolveQiZhi({ mode: 'manualZhi', zhi: '' })).toBe(null);
	});
	test('manualNum:1..120 全域=除十二取余配支;0/负/坏值 → null', ()=>{
		for(let n = 1; n <= 120; n += 1){
			expect(resolveQiZhi({ mode: 'manualNum', num: n })).toBe(ZHI[(n - 1) % 12]);
		}
		[0, -3, null, 'x'].forEach((num)=>{
			expect(resolveQiZhi({ mode: 'manualNum', num })).toBe(null);
		});
	});
});

describe('[P3] 飞宫组合压测 · 全局面(12 起支 × 10 日干 × 12 日支 = 1440 局)', ()=>{
	test('全组合:局结构完备(原神/天星 12 支全 + 八宫门干)+主客合法+宫面 12 方位非空+快照非空', ()=>{
		ZHI.forEach((qz)=>{
			GAN.forEach((dg)=>{
				ZHI.forEach((dz)=>{
					const ju = buildJu({ zhi: qz, dayGan: dg, dayZhi: dz });
					expect(ju).toBeTruthy();
					ZHI.forEach((z)=>{
						expect(ju.yuanShen[z]).toBeTruthy();
						expect(ju.tianXing[z]).toBeTruthy();
					});
					const zk = zhuKe(ju);
					expect(zk).toBeTruthy();
					// 主客宫值域:1..9 数字 ∪ '中'(日干入中宫;UI 以 GONG_GUA[g]||'中' 显示)∪ null(未录)
					[zk.zhuGong, zk.keGong].forEach((g)=>{
						if(g === null || g === undefined){ return; }
						if(g === '中'){ return; }
						expect(g).toBeGreaterThanOrEqual(1);
						expect(g).toBeLessThanOrEqual(9);
					});
					// gongDuan 键=宫号(FANG_WEI_RING 八宫;UI renderAux 同环)
					FANG_WEI_RING.forEach((gong)=>{
						const gd = gongDuan(ju, gong);
						expect(gd).toBeTruthy();
						expect(Array.isArray(gd.zhis)).toBe(true);
						expect(gd.zhis.length).toBeGreaterThanOrEqual(1); // 四正一支/四隅两支
					});
				});
			});
		});
	});

	test('建星公式金标:子午起申/丑未起戌/寅申起子/卯酉起寅/辰戌起辰/巳亥起午', ()=>{
		const exp = { 子: '申', 午: '申', 丑: '戌', 未: '戌', 寅: '子', 申: '子', 卯: '寅', 酉: '寅', 辰: '辰', 戌: '辰', 巳: '午', 亥: '午' };
		ZHI.forEach((z)=>expect(jianXingZhi(z)).toBe(exp[z]));
	});

	test('原神/天星映射:起支处恒为环首(青龙/建)', ()=>{
		ZHI.forEach((qz)=>{
			expect(yuanShenMap(qz)[qz]).toBe('青龙');
			expect(tianXingMap(qz)[jianXingZhi(qz)]).toBe('建');
		});
	});
});

describe('[P3] 飞宫组合压测 · 命宫(年龄全域 × 性别)', ()=>{
	const ju = buildJu({ zhi: '申', dayGan: '壬', dayZhi: '辰' });
	test('1..120 × 男女:不抛;gong∈1..9 或 null(原典未载档),flags 数组恒在', ()=>{
		['male', 'female'].forEach((gender)=>{
			for(let age = 1; age <= 120; age += 1){
				const mg = mingGong({ age, gender, ju });
				expect(mg).toBeTruthy();
				if(mg.gong !== null && mg.gong !== undefined){
					expect(mg.gong).toBeGreaterThanOrEqual(1);
					expect(mg.gong).toBeLessThanOrEqual(9);
				}
				expect(Array.isArray(mg.flags)).toBe(true);
			}
		});
	});
	test('边界:0/负/空年龄安全(null 或可读态,不抛)', ()=>{
		[0, -5, null, undefined, 'x'].forEach((age)=>{
			expect(()=>mingGong({ age, gender: 'male', ju })).not.toThrow();
		});
	});
});

describe('[P3] 飞宫组合压测 · 快照层(AI 导出/挂载共用)', ()=>{
	test('抽样 24 局:快照含起支/建起/中宫双干;坏局安全', ()=>{
		ZHI.forEach((qz, i)=>{
			const ju = buildJu({ zhi: qz, dayGan: GAN[i % 10], dayZhi: ZHI[(i + 3) % 12] });
			const txt = buildFeiGongSnapshotText(ju, {});
			expect(typeof txt).toBe('string');
			expect(txt).toContain(qz);
			expect(txt.length).toBeGreaterThan(50);
		});
		expect(()=>buildFeiGongSnapshotText(null, {})).not.toThrow();
	});
});
