// 差分证据强度判别器的判别向量:只有设置回显行变 = label-only(弱);算法结果行变 = 强。
import { classifyContentDelta, echoTokensOf, evidenceIsStrong } from './fixtures/diffEvidence';

const L = (txt)=>txt.split('\n').map((l)=>l.trim()).filter(Boolean);

describe('差分证据强度 · label-only 判别', ()=>{
	it('① 开关回显「月交点逆行：否→是」,其余逐行相同 → label-only', ()=>{
		const field = { name: 'nodeRetrograde', type: 'switch', default: 0 };
		const base = L('[设置]\n月交点逆行：否\n太阳 12°白羊');
		const ov = L('[设置]\n月交点逆行：是\n太阳 12°白羊');
		expect(classifyContentDelta({ ovLines: ov, baseLines: base, field, cand: 1, base: 0 }).labelOnly).toBe(true);
	});
	it('② 下拉回显「推运方法：Alcabitius→Placidus」,宫头不变 → label-only', ()=>{
		const field = { name: 'pdMethod', type: 'select', options: [{ value: 'alcabitius', label: 'Alcabitius' }, { value: 'placidus', label: 'Placidus' }] };
		const base = L('推运方法：Alcabitius\n一宫 7.871');
		const ov = L('推运方法：Placidus\n一宫 7.871');
		expect(classifyContentDelta({ ovLines: ov, baseLines: base, field, cand: 'placidus', base: 'alcabitius' }).labelOnly).toBe(true);
	});
	it('③ 回显行变 + 宫头也变 → 强证据', ()=>{
		const field = { name: 'pdMethod', type: 'select', options: [{ value: 'alcabitius', label: 'Alcabitius' }, { value: 'placidus', label: 'Placidus' }] };
		const base = L('推运方法：Alcabitius\n一宫 7.871');
		const ov = L('推运方法：Placidus\n一宫 3.308');
		expect(classifyContentDelta({ ovLines: ov, baseLines: base, field, cand: 'placidus', base: 'alcabitius' }).labelOnly).toBe(false);
	});
	it('④ 数值整词替换不误吞相邻数字:「容许度：1→3」且「相位数 11→33」(裸子串替换两个方向都会把它当回显)→ 强证据', ()=>{
		const field = { name: 'asporb', type: 'number' };
		const base = L('容许度：1\n相位数 11');
		const ov = L('容许度：3\n相位数 33');
		expect(classifyContentDelta({ ovLines: ov, baseLines: base, field, cand: 3, base: 1 }).labelOnly).toBe(false);
	});
	it('⑤ 数值只改回显 → label-only;括号注释标签也能匹配', ()=>{
		const field = { name: 'span', type: 'select', options: [{ value: 9, label: '九年起（默认）' }, { value: 10, label: '十年起' }] };
		const base = L('定童限：九年起\n第1限 1-9');
		const ov = L('定童限：十年起\n第1限 1-9');
		expect(classifyContentDelta({ ovLines: ov, baseLines: base, field, cand: 10, base: 9 }).labelOnly).toBe(true);
	});
	it('⑥ 噪声行不计入差异;无差异时不判 label-only', ()=>{
		const field = { name: 'x', type: 'switch' };
		const base = L('导出时刻：10:00\nA');
		const ov = L('导出时刻：10:01\nA');
		const r = classifyContentDelta({ ovLines: ov, baseLines: base, noise: new Set(['导出时刻：10:00', '导出时刻：10:01']), field, cand: 1, base: 0 });
		expect(r.deltaN).toBe(0);
		expect(r.labelOnly).toBe(false);
	});
	it('⑦ 取值字样:长词先于短词(「开启」先于「开」),数组取值不产字样', ()=>{
		const field = { type: 'select', options: [{ value: 'a', label: '开启全部' }] };
		expect(echoTokensOf(field, 'a')[0]).toBe('开启全部');
		expect(echoTokensOf(field, ['a'])).toEqual([]);
	});
	it('⑧ 标签全角括号带「默认」注记,快照回显半角括号无注记 → 归一后仍判 label-only', ()=>{
		const field = { name: 'trueSolarTime', type: 'select', options: [{ value: 'true', label: '真太阳时（经度+均时差，默认）' }, { value: 'mean', label: '平太阳时（仅经度）' }] };
		const base = L('报时星太阳时：真太阳时(经度+均时差)\n木 3˚奎');
		const ov = L('报时星太阳时：平太阳时(仅经度)\n木 3˚奎');
		expect(classifyContentDelta({ ovLines: ov, baseLines: base, field, cand: 'mean', base: 'true' }).labelOnly).toBe(true);
	});
	it('⑨ 基线取值「随全局」回显的是另一个选项的标签(宫主)→ label-only;若同时多出说明行 → 强证据', ()=>{
		const field = { name: 'guolaoLifeMasterMode', type: 'select', options: [{ value: '', label: '随全局（默认）' }, { value: 'gong', label: '宫主' }, { value: 'du', label: '度主' }] };
		const base = L('命主取法：宫主；行运法：古度限度法\n命主 土');
		const ov = L('命主取法：度主；行运法：古度限度法\n命主 土');
		expect(classifyContentDelta({ ovLines: ov, baseLines: base, field, cand: 'du', base: '' }).labelOnly).toBe(true);
		const ov2 = L('命主取法：度主；行运法：古度限度法\n命主 土\n度主：按命度所在宿主星');
		expect(classifyContentDelta({ ovLines: ov2, baseLines: base, field, cand: 'du', base: '' }).labelOnly).toBe(false);
	});
});

describe('差分证据强度 · 入参面只在正文不可观测时算强', ()=>{
	it('⑴ 引擎入参变 + 正文可观测却逐字不变 → 弱(算了但没进快照,须继续找正文差分)', ()=>{
		expect(evidenceIsStrong({ argsDiff: true, contentObservable: true, contentDiff: false, labelOnly: false, orderDiff: false })).toBe(false);
	});
	it('⑵ 引擎入参变 + 正文不可观测(无快照正文)→ 强', ()=>{
		expect(evidenceIsStrong({ argsDiff: true, contentObservable: false, contentDiff: false, labelOnly: false, orderDiff: false })).toBe(true);
	});
	it('⑶ 正文算法行变 → 强;只有回显行变 → 弱;只换行序 → 强', ()=>{
		expect(evidenceIsStrong({ contentDiff: true, labelOnly: false, contentObservable: true })).toBe(true);
		expect(evidenceIsStrong({ contentDiff: true, labelOnly: true, contentObservable: true })).toBe(false);
		expect(evidenceIsStrong({ orderDiff: true, contentObservable: true })).toBe(true);
	});
	it('⑷ 什么都没变 → 弱', ()=>{
		expect(evidenceIsStrong({})).toBe(false);
		expect(evidenceIsStrong(null)).toBe(false);
	});
});
