// [挂载自检 F-11·P0] 主限天球「当前动画所指」盖章只认同一张盘。
// 判别向量:readPdSphereStamp 去掉 sig 比对即第 2/4 例红;buildPrimaryDirectSnapshotText 改回直读旧键即第 4 例红。
jest.mock('../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: {} })) }));
import { writePdSphereStamp, readPdSphereStamp, pdSphereChartSig, PD_SPHERE_STAMP_KEY, PD_SPHERE_STAMP_TTL_MS } from '../pdSphereStamp';
import { buildPrimaryDirectSnapshotText } from '../../components/direction/AstroDirectMain';

const A = { date: '1990/05/18', time: '10:00:00', lon: '118e27', lat: '31n38' };
const B = { date: '1985/01/02', time: '03:04:05', lon: '116e23', lat: '39n54' };

beforeEach(()=>{ window.localStorage.clear(); });

it('签名=date|time|lon|lat(缺席为空串);写后同盘可读、异盘读不到', ()=>{
	expect(pdSphereChartSig(A)).toBe('1990/05/18|10:00:00|118e27|31n38');
	expect(pdSphereChartSig({})).toBe('|||');
	writePdSphereStamp(A, '日→上升 弧 3.2（黄道口径）');
	expect(readPdSphereStamp(A).txt).toBe('日→上升 弧 3.2（黄道口径）');
	expect(readPdSphereStamp(B)).toBeNull();
});

it('🔴 旧格式盖章(无 sig)一律视为无;超 24h 过期', ()=>{
	window.localStorage.setItem(PD_SPHERE_STAMP_KEY, JSON.stringify({ txt: '旧行', ts: Date.now() }));
	expect(readPdSphereStamp(A)).toBeNull();
	const s = writePdSphereStamp(A, '新行');
	expect(readPdSphereStamp(A, s.ts + PD_SPHERE_STAMP_TTL_MS - 1)).toBeTruthy();
	expect(readPdSphereStamp(A, s.ts + PD_SPHERE_STAMP_TTL_MS)).toBeNull();
});

it('空文本不写盖章', ()=>{
	expect(writePdSphereStamp(A, '   ')).toBeNull();
	expect(window.localStorage.getItem(PD_SPHERE_STAMP_KEY)).toBeNull();
});

it('🔴 主限法快照:A 盘盖章只进 A 盘快照,B 盘快照无「主限天球」段', ()=>{
	writePdSphereStamp(A, '土→天顶 弧 12.0（世俗 In Mundo口径）');
	const mk = (p)=>({ params: { ...p, pdMethod: 'core_alchabitius', pdTimeKey: 'Ptolemy' }, predictives: { primaryDirection: [] }, chart: { objects: [] } });
	const ta = `${buildPrimaryDirectSnapshotText(mk(A)) || ''}`;
	const tb = `${buildPrimaryDirectSnapshotText(mk(B)) || ''}`;
	expect(ta).toContain('[主限天球·当前动画所指]');
	expect(ta).toContain('土→天顶 弧 12.0');
	expect(tb).not.toContain('[主限天球·当前动画所指]');
	expect(tb).not.toContain('土→天顶');
});
