import { createAstroSnapshotSignature } from '../astroAiSnapshot';

// 自检：恒星黄道 ayanāṃśa 必须进入 AI 快照签名末位，否则换 ayanāṃśa 后
// hasMatchingSavedAstroSnapshot 会误判旧快照可复用（Lahiri 盘的快照套到 Raman 盘）。
// 见 astroAiSnapshot.js createAstroSnapshotSignature + aiAnalysisContext.js 匹配守卫。
describe('createAstroSnapshotSignature 恒星黄道 ayanāṃśa 入签名', ()=>{
	const baseParams = {
		birth: '1991-03-12 10:30:00', zone: '+08:00', lon: '121e28', lat: '31n14',
	};
	const mk = (ayan)=>({
		chart: { zodiacal: '恒星黄道', hsys: 'Placidus', isDiurnal: true },
		params: { ...baseParams, siderealAyanamsa: ayan },
	});

	// [V6-W1] 签名升版:尾部追加宫制/黄道数字位(parts[10]/[11]) —— ayanāṃśa 固定在 parts[9]。
	// [0e] 再升版:parts[14]=古典口径 overrides JSON 段(默认态恒 '{}')。
	it('ayanāṃśa 位于 parts[9]（宫制/黄道数字位追加于其后）', ()=>{
		const sig = createAstroSnapshotSignature(mk('raman'), {});
		const parts = sig.split('|');
		expect(parts[9]).toBe('raman');
		expect(parts.length).toBe(15);   // 10 位旧格式 + hsysNum + zodiacalNum + traditionNum + termsVariantNum + classicalOv
		expect(parts[14]).toBe('{}');    // 默认态口径段恒 '{}'
	});

	it('[0e] 古典口径入 parts[14]:仅改燃烧上界 → 签名不同(口径级精确失效)', ()=>{
		const base = createAstroSnapshotSignature(mk('raman'), {});
		const hot = createAstroSnapshotSignature(mk('raman'), { combustOrb: { value: 8 } });
		expect(hot.split('|')[14]).toBe('{"combustOrb":8}');
		expect(base).not.toBe(hot);
		// 除口径段外其余段全等(改口径不动身份段)。
		const bp = base.split('|');
		const hp = hot.split('|');
		bp.forEach((seg, i)=>{ if(i !== 14){ expect(seg).toBe(hp[i]); } });
	});

	it('[0e] 三流派开关(lotsDocReverse 等)与恒星轨映射名(starOrb)入段', ()=>{
		const sig = createAstroSnapshotSignature(mk('raman'), {
			lotsDocReverse: { value: 1 }, fixedStarOrb: { value: 2 },
		});
		// 键序=spec 表序(WP-1 spec 驱动后恒定;签名产出与比对端同函数同序,自洽)。
		expect(sig.split('|')[14]).toBe('{"lotsDocReverse":1,"starOrb":2}');
	});

	it('[V6-W1] 宫制/黄道数字位:fields 实值入 parts[10]/[11];仅宫制不同 → 签名不同', ()=>{
		const a = createAstroSnapshotSignature(
			{ chart: { zodiacal: '回归黄道', hsys: 'Alcabitius' }, params: { ...baseParams } },
			{ hsys: { value: 1 }, zodiacal: { value: 0 } },
		);
		const b = createAstroSnapshotSignature(
			{ chart: { zodiacal: '回归黄道', hsys: 'WholeSign' }, params: { ...baseParams } },
			{ hsys: { value: 0 }, zodiacal: { value: 0 } },
		);
		expect(a.split('|')[10]).toBe('1');
		expect(b.split('|')[10]).toBe('0');
		expect(a.split('|')[11]).toBe('0');
		expect(a).not.toBe(b);
	});

	it('仅 ayanāṃśa 不同 → 签名不同（核心：避免旧快照误复用）', ()=>{
		const lahiri = createAstroSnapshotSignature(mk('lahiri'), {});
		const raman = createAstroSnapshotSignature(mk('raman'), {});
		const fagan = createAstroSnapshotSignature(mk('fagan_bradley'), {});
		expect(lahiri).not.toBe(raman);
		expect(lahiri).not.toBe(fagan);
		expect(raman).not.toBe(fagan);
		// 其余身份段一致：仅 parts[9] ayanāṃśa 段不同。
		const lp = lahiri.split('|');
		const rp = raman.split('|');
		lp.forEach((seg, i)=>{ if(i !== 9){ expect(seg).toBe(rp[i]); } });
	});

	it('回归盘/未设 ayanāṃśa → 末位为空（向后兼容：旧签名无此段）', ()=>{
		const sig = createAstroSnapshotSignature({
			chart: { zodiacal: '回归黄道', hsys: 'Placidus' },
			params: { ...baseParams },
		}, {});
		expect(sig.split('|')[9]).toBe('');
	});

	it('fields 兜底：params 无 ayanāṃśa 时读 fields.siderealAyanamsa', ()=>{
		const sig = createAstroSnapshotSignature(
			{ chart: { zodiacal: '恒星黄道', hsys: 'Placidus' }, params: { ...baseParams } },
			{ siderealAyanamsa: { value: 'kp_senthil' } },
		);
		expect(sig.split('|')[9]).toBe('kp_senthil');
	});
});
