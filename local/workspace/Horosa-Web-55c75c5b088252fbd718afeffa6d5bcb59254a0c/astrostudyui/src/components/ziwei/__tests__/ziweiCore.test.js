import {
	z, zi, gi, ZHI,
	wuxingJu, palaceGans, mingGong, shenGong,
	ziweiPos, tianfuPos, fourteenStars, changsheng12, daxianRanges, isClockwise, childLimits, zhongxianOf, relabelPalaces,
} from '../ziweiCore';
import { SiHuaTables } from '../../../constants/ZWConst';

// 对齐标准自检锚点（纯算法，与农历解耦）。
describe('ziweiCore · 紫微定位/命身/五行局/十四主星 锚点(对标准锚点)', ()=>{
	test('局数当日紫微必在寅(2)', ()=>{
		[2, 3, 4, 5, 6].forEach((ju)=>{ expect(ziweiPos(ju, ju)).toBe(2); });
	});
	test('初一紫微锚点:水二丑/木三辰/金四亥/土五午/火六酉', ()=>{
		expect(z(ziweiPos(1, 2))).toBe('丑');
		expect(z(ziweiPos(1, 3))).toBe('辰');
		expect(z(ziweiPos(1, 4))).toBe('亥');
		expect(z(ziweiPos(1, 5))).toBe('午');
		expect(z(ziweiPos(1, 6))).toBe('酉');
	});
	test('紫府寅申同宫 + 十四主星齐全', ()=>{
		expect(tianfuPos(2)).toBe(2);
		expect(tianfuPos(8)).toBe(8);
		for(let zw = 0; zw < 12; zw++){
			const st = fourteenStars(zw);
			expect(Object.keys(st).length).toBe(14);
		}
	});
	test('命身宫:正月子时同在寅;子/午时命身同宫', ()=>{
		expect(mingGong(1, 0)).toBe(2);
		expect(shenGong(1, 0)).toBe(2);
		for(let m = 1; m <= 12; m++){
			expect(mingGong(m, 0)).toBe(shenGong(m, 0));   // 子时
			expect(mingGong(m, 6)).toBe(shenGong(m, 6));   // 午时
		}
	});
	test('五行局:甲年命宫在寅→丙寅→炉中火→火六局', ()=>{
		const pg = palaceGans('甲');
		expect(pg[2]).toBe('丙');             // 甲年寅宫=丙(五虎遁)
		expect(pg[0]).toBe(pg[2]);            // 子=寅同干
		expect(pg[1]).toBe(pg[3]);            // 丑=卯同干
		const ju = wuxingJu('丙', 2);
		expect(ju.ju).toBe(6);
		expect(ju.element).toBe('火');
	});
	test('长生:水二局起申、阳男顺行;大限第1限落命宫(虚岁=局数起)', ()=>{
		const cs = changsheng12(2, '甲', true);   // 阳男顺
		expect(cs[zi('申')]).toBe('长生');
		expect(isClockwise('甲', true)).toBe(true);
		const dx = daxianRanges(2, 2, '甲', true, 10);   // 命宫idx=2, 水二局
		expect(dx[2]).toEqual([2, 11]);           // 第1限 命宫 2..11 虚岁
	});
});

describe('ziweiCore · 四化全三版(WP-A:beipai/zhongzhou/quanshu)', ()=>{
	test('十干禄权科忌四星齐全', ()=>{
		['beipai', 'zhongzhou', 'quanshu'].forEach((sch)=>{
			['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].forEach((g)=>{
				expect(SiHuaTables[sch][g].length).toBe(4);
			});
		});
	});
	test('庚干化科分歧:北派太阴 / 中州天府 / 全书天同', ()=>{
		expect(SiHuaTables.beipai['庚'][2]).toBe('太阴');
		expect(SiHuaTables.zhongzhou['庚'][2]).toBe('天府');
		expect(SiHuaTables.quanshu['庚'][2]).toBe('天同');
	});
	test('全书 庚:科天同·忌太阴(与通用对调);壬:天府化科;戊仍右弼化科(同通用)', ()=>{
		expect(SiHuaTables.quanshu['庚']).toEqual(['太阳', '武曲', '天同', '太阴']);
		expect(SiHuaTables.quanshu['壬'][2]).toBe('天府');
		expect(SiHuaTables.quanshu['戊'][2]).toBe('右弼');   // 戊未被全书覆盖→通用右弼科
		// 化禄/权/忌(前两 + 末一)十干各派一致(仅科争议),抽验庚禄=太阳、壬忌=武曲
		expect(SiHuaTables.quanshu['庚'][0]).toBe('太阳');
		expect(SiHuaTables.quanshu['壬'][3]).toBe('武曲');
	});
});

describe('ziweiCore · 压力测试 笛卡尔(全 干支×日×局×月×时×性别 不崩+合法)', ()=>{
	const inRange = (i)=>Number.isInteger(i) && i >= 0 && i < 12;
	test('紫微定位:全 30日×5局 落 0-11', ()=>{
		const fail = [];
		for(let d = 1; d <= 30; d++){
			[2, 3, 4, 5, 6].forEach((ju)=>{ if(!inRange(ziweiPos(d, ju))) fail.push(`日${d}局${ju}=${ziweiPos(d, ju)}`); });
		}
		expect(fail).toEqual([]);
	});
	test('十四主星:全 12 紫微位 各落 0-11 且恰 14 颗', ()=>{
		const fail = [];
		for(let zw = 0; zw < 12; zw++){
			const st = fourteenStars(zw);
			if(Object.keys(st).length !== 14) fail.push(`紫微${zw} 非14`);
			Object.keys(st).forEach((s)=>{ if(!inRange(st[s])) fail.push(`紫微${zw} ${s}=${st[s]}`); });
		}
		expect(fail).toEqual([]);
	});
	test('命身宫:全 12月×12时 落 0-11', ()=>{
		const fail = [];
		for(let m = 1; m <= 12; m++){
			for(let h = 0; h < 12; h++){ if(!inRange(mingGong(m, h)) || !inRange(shenGong(m, h))) fail.push(`月${m}时${h}`); }
		}
		expect(fail).toEqual([]);
	});
	test('五行局:全 60 甲子合法命宫干支 → 局∈{2..6};宫干 10 干各 12 宫齐', ()=>{
		const fail = [];
		GAN_LIST.forEach((g)=>{
			const pg = palaceGans(g);
			if(Object.keys(pg).length !== 12) fail.push(`${g}宫干非12`);
			for(let i = 0; i < 12; i++){
				// 阳干配阳支、阴干配阴支才是合法干支(60甲子);仅验合法组合的局
				const ny = wuxingJu(pg[i], i);
				if(ny && !(ny.ju >= 2 && ny.ju <= 6)) fail.push(`${g} 宫${i} 局=${ny.ju}`);
			}
		});
		expect(fail).toEqual([]);
	});
	test('长生+大限:全 5局×10干×2性别 → 12 神/12 限齐全合法', ()=>{
		const fail = [];
		[2, 3, 4, 5, 6].forEach((ju)=>{
			GAN_LIST.forEach((g)=>{
				[true, false].forEach((male)=>{
					const cs = changsheng12(ju, g, male);
					if(Object.keys(cs).length !== 12) fail.push(`cs ${ju}${g}${male}`);
					const dx = daxianRanges(2, ju, g, male, 10);
					if(Object.keys(dx).length !== 12) fail.push(`dx ${ju}${g}${male}`);
				});
			});
		});
		expect(fail).toEqual([]);
	});
});

const GAN_LIST = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

describe('WP-1 童限(childLimits)', ()=>{
	test('童限岁数=局数-1;水二局仅1岁、火六局至5岁', ()=>{
		expect(childLimits(2, 0).map((x)=>x.age)).toEqual([1]);
		expect(childLimits(3, 0).map((x)=>x.age)).toEqual([1, 2]);
		expect(childLimits(6, 0).map((x)=>x.age)).toEqual([1, 2, 3, 4, 5]);
	});
	test('宫序 命财疾妻福官(口诀一命二财三疾厄四妻五福六官禄)', ()=>{
		expect(childLimits(6, 0).map((x)=>x.houseName)).toEqual(['命宫', '财帛', '疾厄', '夫妻', '福德']);
	});
	test('houseIndex=自命宫逆数对应宫序(命宫在寅=2)', ()=>{
		// 命0→2 / 财4→10 / 疾5→9 / 夫2→0 / 福10→4
		expect(childLimits(6, 2).map((x)=>x.houseIndex)).toEqual([2, 10, 9, 0, 4]);
	});
	test('非法输入返回空数组', ()=>{
		expect(childLimits(0, 5)).toEqual([]);
		expect(childLimits(4, -1)).toEqual([]);
		expect(childLimits(4, null)).toEqual([]);
	});
});

describe('WP-2 沈氏三限(zhongxianOf)', ()=>{
	test('大限4分各2.5年;火六局大限6-15→6/8.5/11/13.5', ()=>{
		const z = zhongxianOf(6, 3);
		expect(z.map((x)=>x.startAge)).toEqual([6, 8.5, 11, 13.5]);
		expect(z.map((x)=>x.endAge)).toEqual([8.5, 11, 13.5, 16]);
	});
	test('宫位一律沿大限宫(文档未给递进,不臆造)', ()=>{
		expect(zhongxianOf(26, 7).every((x)=>x.houseIndex === 7)).toBe(true);
	});
	test('非法输入返回空', ()=>{ expect(zhongxianOf(null, 3)).toEqual([]); });
});

describe('WP-3 活盘·太极点重排(relabelPalaces)', ()=>{
	test('taijiIdx=null → 全 null(本命)', ()=>{
		expect(relabelPalaces(null)).toEqual(new Array(12).fill(null));
	});
	test('以某宫为太极点→该宫 k=0(命宫),逆布人事宫序', ()=>{
		const kByIndex = relabelPalaces(5);   // 以 index5 为新命宫
		expect(kByIndex[5]).toBe(0);    // 命宫
		expect(kByIndex[4]).toBe(1);    // 兄弟(逆数第1)
		expect(kByIndex[6]).toBe(11);   // 父母=(5-6+12)%12=11
		expect(kByIndex[11]).toBe(6);   // 迁移=(5-11+12)%12=6
	});
	test('12 人事宫序恰好各一次、无重复无遗漏', ()=>{
		const kByIndex = relabelPalaces(3);
		expect(new Set(kByIndex).size).toBe(12);
		for(let k = 0; k < 12; k++){ expect(kByIndex.indexOf(k) >= 0).toBe(true); }
	});
});

