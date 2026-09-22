// [挂载自检 六壬/三式 P0] 无头六壬 castOpts 单源:补 solarYear/benmingZhi/xingnianZhi;三式断卦层传 castOpts 形态 + 自家 override。
// 判别向量:helper 去掉 solarYear 兜底/本命行年透传即第 1 例红;三式改回把 override 当 castOpts 传即源码锚红。
import fs from 'fs';
import path from 'path';
import { liurengHeadlessCastOpts } from '../aiAnalysisContext';
import { pickSanshiLiurengCastOpts } from '../../components/sanshi/SanShiUnitedMain';

const UI = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(UI, rel), 'utf8');

it('🔴 castOpts:存档带 solarYear/benmingZhi/xingnianZhi 原样透传;缺 solarYear 按 record.divTime 年份兜底;缺本命/行年不造键', ()=>{
	const full = liurengHeadlessCastOpts({ castMethod: 'benming', yueJiangMethod: 'jieqi', solarYear: 2026, benmingZhi: '午', xingnianZhi: '子' }, { divTime: '2026-05-15 10:12:00' });
	expect(full).toEqual(expect.objectContaining({ castMethod: 'benming', yueJiangMethod: 'jieqi', solarYear: 2026, benmingZhi: '午', xingnianZhi: '子' }));
	const bare = liurengHeadlessCastOpts({ castMethod: 'zheng' }, { divTime: '1999-12-31 23:30:00' });
	expect(bare.solarYear).toBe(1999);
	expect('benmingZhi' in bare).toBe(false);
	expect('xingnianZhi' in bare).toBe(false);
	expect(Object.keys(liurengHeadlessCastOpts({}, null))).toEqual(['castMethod', 'xuanShiZhi', 'yanShuNum', 'yueJiangMethod', 'fenZhouYe', 'seHaiMethod', 'seHaiBoundary', 'shiRuKe', 'yearShenShaSort', 'yinyangSystem', 'tuWangShuai', 'zhanCategory']);
});

it('三式 → 六壬断卦层 castOpts:锁正时正将,携七类流派项与 solarYear', ()=>{
	const o = pickSanshiLiurengCastOpts({ yueJiangMethod: 'richan', fenZhouYe: 'richu', seHaiMethod: 'shejian', shiRuKe: true, yinyangSystem: 'yinyang', yearShenShaSort: 'siji', tuWangShuai: 'yuling', zhanCategory: 'marriage' }, { solarYear: 2026 });
	expect(o).toEqual({ castMethod: 'zheng', yueJiangMethod: 'richan', fenZhouYe: 'richu', seHaiMethod: 'shejian', seHaiBoundary: undefined, shiRuKe: true, yinyangSystem: 'yinyang', yearShenShaSort: 'siji', tuWangShuai: 'yuling', zhanCategory: 'marriage', solarYear: 2026 });
});

it('🔴 接线锚:三式断卦层第 8 参=castOpts+castOverride;六壬 builder 优先用调用方 castOverride;六壬存档带本命/行年/公历年', ()=>{
	const ss = read('components/sanshi/SanShiUnitedMain.js');
	expect(ss).toContain('{ ...(lrCastOpts || {}), castOverride: lrCastOverride || undefined }');
	expect(ss).not.toMatch(/options && options\.sex,\n\s*lrCastOverride \|\| \{\}\n/);
	expect((ss.match(/lrCastOpts: (lrSnapInput|liurengSnapshotInput)\.lrCastOpts,/g) || []).length).toBe(3);
	const lr = read('components/lrzhan/LiuRengMain.js');
	expect(lr).toContain("const castOverride = (_castOpts.castOverride && typeof _castOpts.castOverride === 'object')");
	expect(lr).toContain('...liurengBenmingXingnian(getAppliedBirth(this.state), displayRunYear),');
	expect(lr).toContain('solarYear: getSolarYearFromField(flds && flds.date ? flds.date : null),');
});

it('🔴 [Q-156/T-73] 事盘无头入口白名单:regenerateCaseTechniqueSnapshot 手写 liurengOpts 必透传 solarYear/benmingZhi/xingnianZhi(漏则九~十二客/本命行年加时静默退回正时正将而快照仍标所选)', ()=>{
	const ctx = read('utils/aiAnalysisContext.js');
	const m = ctx.match(/export async function regenerateCaseTechniqueSnapshot[\s\S]*?const liurengOpts = \{([\s\S]*?)\n\t\};/);
	expect(m).toBeTruthy();
	['castMethod: p.castMethod', 'solarYear: p.solarYear', 'benmingZhi: p.benmingZhi', 'xingnianZhi: p.xingnianZhi'].forEach((k)=>{
		expect(m[1]).toContain(k);
	});
	// 白名单 → helper:三键原样进 castOpts(与页面存档形态同构)
	const p = { castMethod: 'bake9', solarYear: 2026, benmingZhi: '寅', xingnianZhi: '申', guireng: 2 };
	const opts = { castMethod: p.castMethod, solarYear: p.solarYear, benmingZhi: p.benmingZhi, xingnianZhi: p.xingnianZhi };
	expect(liurengHeadlessCastOpts(opts, { divTime: '2026-05-15 10:12:00' })).toEqual(expect.objectContaining({ castMethod: 'bake9', solarYear: 2026, benmingZhi: '寅', xingnianZhi: '申' }));
});
