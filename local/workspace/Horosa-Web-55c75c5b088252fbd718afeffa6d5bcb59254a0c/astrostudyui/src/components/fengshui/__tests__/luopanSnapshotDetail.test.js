// [Q-456/T-419] 综合罗经派快照:各派采参 / 盘式口径注 / 分金·穿山逐候选行(此前只有结论一行)进【风水·综合罗经】段。
import { luopanReading, buildSnapshot } from '../LiqiWorkspace';

describe('综合罗经 快照 · 采参/口径/逐候选', () => {
	const lp = { deg: 172.5, layers: ['zheng', 'ren', 'feng', 'chuanshan', 'toudi', 'fenjin', 'gua64', 'xiu'], zuoShan: '子', xiangShan: '午', panType: 'zonghe' };
	it('各派采参行 + 分金/穿山逐候选行(✓/✗·干支·度界·缘由·位置性)与 reading 同源;首选行存在', () => {
		const r = luopanReading(lp);
		const t = buildSnapshot('luopan', r);
		expect(t.startsWith('【风水·综合罗经】')).toBe(true);
		expect(t).toMatch(/\n各派采参：.+：.+/);
		const fp = r.fenjinPick; const cp = r.chuanshanPick;   // 择优按游标所在正针山(reading 同源对象)
		const fjLines = t.split('\n').filter((l) => /^　[✓✗] /.test(l));
		expect(fjLines.length).toBe((fp.rows || []).length + (cp.rows || []).length);
		fp.rows.forEach((x) => { expect(t).toContain(`${x.usable ? '✓' : '✗'} ${x.ganzhi}（${x.deg0.toFixed(2)}°–${x.deg1.toFixed(2)}°）：${x.why}；位置性：${x.positional}`); });
		if (fp.best) { expect(t).toContain(`　首选：${fp.best.ganzhi}（中线 ${fp.best.degMid.toFixed(2)}°`); }
		expect(t).toContain(`分金择优（坐${fp.shan}）：${fp.verdict.text}`);
		expect(t).toContain(`穿山择优：${cp.verdict.text}`);
	});
	it('三元盘式:口径注与「本盘式无此层」进快照', () => {
		const r = luopanReading({ ...lp, panType: 'sanyuan' });
		const t = buildSnapshot('luopan', r);
		if (r.panTypeMeta && r.panTypeMeta.note) { expect(t).toContain(`盘式口径：${r.panTypeMeta.note}`); }
		if (r.droppedLayers.length) { expect(t).toContain(`本盘式无此层（已移除）：${r.droppedLayers.join('、')}`); }
	});
});
