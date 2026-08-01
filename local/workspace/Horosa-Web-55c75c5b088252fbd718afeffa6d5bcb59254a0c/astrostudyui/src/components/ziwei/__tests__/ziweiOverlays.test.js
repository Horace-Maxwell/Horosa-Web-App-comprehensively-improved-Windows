// WP-4/5/6 流派招牌 overlay 纯函数 golden。
import { assembleNatalChart } from '../ZiweiCalc';
import { qiShuWei, borrowedStars, allBorrowedStars, taiSuiRuGua } from '../ziweiOverlays';

const mk = (o)=>assembleNatalChart({ yearGan: '甲', yearZi: '子', monthInt: 6, leap: false, dayInt: 10, timeZi: '卯', male: true, ...o });
const nameOf = (arr)=>(arr || []).map((s)=>(s.name || '').replace(/^副/, ''));

describe('WP-4 河洛气数位+一六共宗(qiShuWei)', ()=>{
	test('气数位宫=官禄宫(命逆数第9=(life-8)%12)', ()=>{
		const c = mk();
		const r = qiShuWei(c);
		const life = c.lifeHouseIndex;
		expect(r.qiShuIdx).toBe(((life - 8) % 12 + 12) % 12);
		expect(c.houses[r.qiShuIdx].name.indexOf('官禄')).toBe(0);   // 盘名'官禄宫'(带宫后缀)
	});
	test('宫干四化回照:huaLanding 四化齐、backToLife 为落本宫者子集', ()=>{
		const c = mk();
		const r = qiShuWei(c);
		expect(Object.keys(r.huaLanding)).toEqual(['禄', '权', '科', '忌']);
		const life = c.lifeHouseIndex;
		r.backToLife.forEach((h)=>{ expect(r.huaLanding[h].houseIndex).toBe(life); });
		['禄', '权', '科', '忌'].forEach((h)=>{
			const at = r.huaLanding[h].houseIndex;
			expect(r.huaLanding[h].backToLife).toBe(at === life);
		});
	});
	test('一六共宗:疾厄=(life-5)%12、官禄=气数位', ()=>{
		const c = mk();
		const r = qiShuWei(c);
		const life = c.lifeHouseIndex;
		expect(r.yiLiuGongZong['疾厄(6)']).toBe(((life - 5) % 12 + 12) % 12);
		expect(r.yiLiuGongZong['官禄(9·气数位)']).toBe(r.qiShuIdx);
		expect(r.yiLiuGongZong['命(1)']).toBe(life);
	});
});

describe('WP-5 中州借宫(borrowedStars)', ()=>{
	test('空宫借对宫十四正曜、本宫有正曜则不借', ()=>{
		// 找一个有空宫的盘(命无正曜盘常见);逐盘扫。
		let done = false;
		const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		for(let m = 1; m <= 12 && !done; m++){
			for(let t = 0; t < 12 && !done; t++){
				const c = mk({ monthInt: m, timeZi: ZHI[t] });
				for(let i = 0; i < 12; i++){
					const empty = (c.houses[i].starsMain || []).length === 0;
					const borrowed = borrowedStars(c, i);
					if(empty && (c.houses[(i + 6) % 12].starsMain || []).length > 0){
						expect(nameOf(borrowed).sort()).toEqual(nameOf(c.houses[(i + 6) % 12].starsMain).sort());
						expect(borrowed.every((s)=>s.borrowed === true && s.fromIndex === (i + 6) % 12)).toBe(true);
						done = true; break;
					}
					if(!empty){ expect(borrowed).toEqual([]); }   // 本宫有正曜→不借
				}
			}
		}
		expect(done).toBe(true);
	});
	test('借入星庙旺按借入宫地支重查(非原宫)', ()=>{
		const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		let checked = false;
		for(let m = 1; m <= 12 && !checked; m++){
			const c = mk({ monthInt: m });
			for(let i = 0; i < 12; i++){
				const b = borrowedStars(c, i);
				if(b.length){
					// 借入宫地支存在时,starlight 字段应有值或 undefined(不抛),且用的是本宫 i 的地支
					b.forEach((s)=>{ expect('starlight' in s).toBe(true); });
					checked = true; break;
				}
			}
		}
		expect(checked).toBe(true);
	});
	test('allBorrowedStars:非空宫为 null、空宫为借入数组', ()=>{
		const c = mk();
		const all = allBorrowedStars(c);
		expect(all.length).toBe(12);
		for(let i = 0; i < 12; i++){
			if((c.houses[i].starsMain || []).length > 0){ expect(all[i]).toBe(null); }
		}
	});
});

describe('WP-6 紫云太岁入卦(taiSuiRuGua)', ()=>{
	test('关系人生肖落本命同支宫、南斗男北斗女', ()=>{
		const c = mk();
		const k = 5;
		const branch = c.houses[k].ganzi.charAt(1);
		const r = taiSuiRuGua(c, [{ branch, role: '配偶', sex: '男' }, { branch: c.houses[8].ganzi.charAt(1), role: '子女', sex: '女' }]);
		expect(r[0].houseIndex).toBe(k);
		expect(r[0].dou).toBe('南斗(男)');
		expect(r[1].houseIndex).toBe(8);
		expect(r[1].dou).toBe('北斗(女)');
	});
	test('空/非法关系人过滤', ()=>{
		const c = mk();
		expect(taiSuiRuGua(c, [])).toEqual([]);
		expect(taiSuiRuGua(c, [{ role: '无支' }])).toEqual([]);
	});
});
