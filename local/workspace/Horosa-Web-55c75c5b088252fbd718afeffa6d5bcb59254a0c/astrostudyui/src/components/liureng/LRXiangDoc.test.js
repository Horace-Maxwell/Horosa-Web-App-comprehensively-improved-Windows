import { buildXiangContext, WUXING_XIANG } from './LRXiangDoc';

describe('LRXiangDoc · buildXiangContext 取象聚合', ()=>{
	it('子 + 日干甲 + 五行土：神名/类象/五行/六亲/方位/驿马/刑冲合害正确', ()=>{
		const ctx = buildXiangContext('子', '甲', '土');
		expect(ctx).toBeTruthy();
		expect(ctx.branch).toBe('子');
		expect(ctx.shenName).toBe('神后');
		expect(ctx.wuxing).toBe('水');
		expect(ctx.liuqin).toBe('父母');           // 子(水) 生 甲(木) → 生我者为父母
		expect(ctx.direction).toBe('正北');
		expect(ctx.yima).toBe('寅');
		expect(ctx.symbol).toContain('盗贼');
		expect(ctx.wuxingXiang).toBe(WUXING_XIANG['水']);
		const rels = ctx.relations.join(' ');
		expect(rels).toContain('刑：卯');
		expect(rels).toContain('冲：午');
		expect(rels).toContain('六合：丑');
		expect(rels).toContain('害：未');
		expect(rels).toContain('破：酉');
		expect(rels).toContain('三合：申、辰');
		expect(typeof ctx.zhangsheng).toBe('string');
	});

	it('六亲随日干变化：申 + 日干甲 = 官鬼（申金克甲木）', ()=>{
		const ctx = buildXiangContext('申', '甲', '土');
		expect(ctx.wuxing).toBe('金');
		expect(ctx.liuqin).toBe('官鬼');
	});

	it('缺日干时六亲为空、其余仍在', ()=>{
		const ctx = buildXiangContext('午', '', '火');
		expect(ctx).toBeTruthy();
		expect(ctx.liuqin).toBe('');
		expect(ctx.wuxing).toBe('火');
		expect(ctx.direction).toBe('正南');
	});

	it('WP-D2 刑冲破害合断语 relationNotes(§22.2)+蜜中砒霜特例', ()=>{
		const cx = buildXiangContext('子', '甲', '土');
		const types = (cx.relationNotes || []).map((r)=>r.type);
		expect(types).toEqual(expect.arrayContaining(['刑', '冲', '六合', '害', '破', '三合']));
		// [Issue#75 同批] 旧锚把恒真产物锁成金标(「子:六合丑+刑卯」两者本非同一支,不构成
		// 蜜中砒霜)。正解:子不命中;命中面另用巳(六合申,而巳申相刑)验。
		expect(types).not.toContain('蜜中砒霜');
		const si = buildXiangContext('巳', '甲', '土');
		const miz = (si.relationNotes || []).find((r)=>r.type === '蜜中砒霜');
		expect(miz).toBeTruthy();
		expect(miz.note).toMatch(/外合内离|合中带刑害/);
		// 每条断语非空
		cx.relationNotes.forEach((r)=>expect(typeof r.note === 'string' && r.note.length > 0).toBe(true));
	});

	it('无效地支返回 null', ()=>{
		expect(buildXiangContext('X', '甲', '土')).toBeNull();
		expect(buildXiangContext('', '甲', '土')).toBeNull();
		expect(buildXiangContext(null, '甲', '土')).toBeNull();
	});
});

describe('[Issue#75 同批] 蜜中砒霜判据不再恒真', ()=>{
	// 旧判据「表里有值」在三张 12 键全映射表上恒真 → 十二支全标蜜中砒霜(10 例假阳)。
	// 正解=本支六合之支恰与本支相刑/相害;全域仅 巳/申 命中(巳申六合且在寅巳申三刑内)。
	const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	it('十二支中恰 巳/申 两支命中', ()=>{
		const hit = ZHI.filter((z)=>{
			const info = buildXiangContext(z, '甲', '土');
			return (info.relationNotes || []).some((n)=>n.type === '蜜中砒霜');
		});
		expect(hit).toEqual(['巳', '申']);
	});
});
