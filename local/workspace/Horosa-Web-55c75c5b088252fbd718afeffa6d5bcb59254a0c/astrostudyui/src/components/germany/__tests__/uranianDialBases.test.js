// 90°中点盘「盘基」档位:每档 = 360 / H(H 为整数谐波号),降序排列;标签的谐波号与盘基一致;存储往返不丢档。
import { URANIAN_DIAL_BASES, DIAL_BASE_HARMONIC, dialBaseLabel, getStoredUranianDisplay, saveUranianDisplay } from '../UranianDialStyle';

describe('盘基档位', ()=>{
	it('每档都是 360 的整数分之一,且降序', ()=>{
		URANIAN_DIAL_BASES.forEach((b, i)=>{
			const h = 360 / b;
			expect(Math.abs(h - Math.round(h))).toBeLessThan(1e-9);
			if(i){ expect(b).toBeLessThan(URANIAN_DIAL_BASES[i - 1]); }
		});
	});

	it('含谐波占星常用的 H5 / H7 / H9 / H10 与 H32', ()=>{
		[72, 360 / 7, 40, 36, 11.25].forEach((b)=>expect(URANIAN_DIAL_BASES).toContain(b));
	});

	it('标签的谐波号 = 360 / 盘基', ()=>{
		URANIAN_DIAL_BASES.forEach((b)=>{
			expect(DIAL_BASE_HARMONIC[b]).toBe(`H${Math.round(360 / b)}`);
			expect(dialBaseLabel(b).startsWith(`H${Math.round(360 / b)} `)).toBe(true);
		});
		expect(dialBaseLabel(360 / 7)).toBe('H7 51°25′43″');
		expect(dialBaseLabel(11.25)).toBe('H32 11°15′');
	});

	it('存储往返:每档存进去读出来不变(非法值回落 90°)', ()=>{
		URANIAN_DIAL_BASES.forEach((b)=>{
			saveUranianDisplay({ ...getStoredUranianDisplay(), dialBase: b });
			expect(getStoredUranianDisplay().dialBase).toBe(b);
		});
		saveUranianDisplay({ ...getStoredUranianDisplay(), dialBase: 50 });
		expect(getStoredUranianDisplay().dialBase).toBe(90);
	});
});

describe('盘基度数文案', ()=>{
	const { dialBaseDegText } = require('../UranianDialStyle');
	it('有限小数逐字同旧,H7 写度分秒', ()=>{
		expect(dialBaseDegText(90)).toBe('90°');
		expect(dialBaseDegText(22.5)).toBe('22.5°');
		expect(dialBaseDegText(0.703125)).toBe('0.703125°');
		expect(dialBaseDegText(360 / 7)).toBe('51°25′43″');
	});
});
