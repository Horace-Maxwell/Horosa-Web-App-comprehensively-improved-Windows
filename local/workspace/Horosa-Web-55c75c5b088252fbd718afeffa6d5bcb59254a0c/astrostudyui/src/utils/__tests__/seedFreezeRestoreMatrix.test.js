// 全量恢复 × 「旧记录缺键取值」冻结值:包的口径推不出(包里没有这一键 / 整值不可用 / 设置面没读全)一律写定本机原来的取值。
// 矩阵:本机冻结值 × 设置面完整标记 × 包里并入标志 × 包里冻结值形态 × 包里旧版镜像键 —— 本机缺键旧盘的取值恢复前后一致(翻转格 = 0);
// 「先预览再恢复」与「直接恢复」结果逐字节相同(预览不先冻出值)。
jest.mock('../ziweiCustomTablesPersist', ()=>({
	mirrorZiweiCustomTable: jest.fn(()=>Promise.resolve(null)),
	restoreZiweiCustomTablesOnce: jest.fn(()=>Promise.resolve([])),
}));
import { restoreUnifiedBackup, previewUnifiedRestore, UNIFIED_BACKUP_FORMAT } from '../unifiedBackup';
import * as seeds from '../newChartSeeds';
import { upsertLocalChart, getLocalChart } from '../localcharts';

const FROZEN = seeds.NEW_CHART_SEEDS_RECORD_MISSING_KEY;
const FLAG = seeds.NEW_CHART_SEEDS_LEGACY_FLAG;
const LOCAL = [null, 1];
const COMPLETE = [true, false, undefined];
const PKG_FLAG = [true, false];
const PKG_FROZEN = ['absent', JSON.stringify({ houseStartMode: 0 }), JSON.stringify({ houseStartMode: 1 }), 'null', '{bad', '[]', '{}'];
const MIRROR = ['absent', '0', '1'];

function setupLocal(localFrozen){
	window.localStorage.clear();
	seeds.__resetNewChartSeedsForTest();
	if(localFrozen !== null){
		window.localStorage.setItem(FROZEN, JSON.stringify({ houseStartMode: localFrozen }));
		window.localStorage.setItem(FLAG, '1');
	}
	upsertLocalChart({ cid: 'local-old', name: '本机旧盘', birth: '1990-01-01 10:00:00', zone: '+08:00' });
	return seeds.newChartSeedRecordMissingValue('houseStartMode');
}
function pkgOf(complete, pkgFlag, pkgFrozen, mirror){
	const raw = {};
	if(pkgFlag){ raw[FLAG] = '1'; }
	if(pkgFrozen !== 'absent'){ raw[FROZEN] = pkgFrozen; }
	if(mirror !== 'absent'){ raw.suzhanHouseStartMode = mirror; }
	raw.ziweiHuoling = 'sanhe';   // 至少一把别的设置,包不为空
	const m = { format: UNIFIED_BACKUP_FORMAT, version: 2, raw };
	if(complete !== undefined){ m.settingsComplete = complete; }
	return m;
}
function oldChartValue(){
	const c = getLocalChart('local-old');
	if(c && c.houseStartMode !== undefined && c.houseStartMode !== null){ return c.houseStartMode; }
	return seeds.newChartSeedRecordMissingValue('houseStartMode');
}
// 恢复写完会刷新页面:模块内存态复位、首次读种子(一次性并入照常跑),再比存储
function afterReload(){
	seeds.__resetNewChartSeedsForTest();
	seeds.newChartSeedValue('houseStartMode');
	return snapshot();
}
function snapshot(){
	const out = {};
	for(let i = 0; i < window.localStorage.length; i += 1){
		const k = window.localStorage.key(i);
		if(/^horosa\.(backup|boot|restore)\./.test(k)){ continue; }
		out[k] = window.localStorage.getItem(k);
	}
	return JSON.stringify(Object.keys(out).sort().map((k)=>[k, k === 'horosa.localCharts.v1' ? JSON.parse(out[k]).map((r)=>({ ...r, updateTime: undefined })) : out[k]]));
}

test('🔴 本机缺键旧盘恢复前后取值一致(翻转格 = 0);先预览再恢复 ≡ 直接恢复', async ()=>{
	const flips = [];
	const diverge = [];
	let cells = 0;
	for(const localFrozen of LOCAL){
		for(const complete of COMPLETE){
			for(const pkgFlag of PKG_FLAG){
				for(const pkgFrozen of PKG_FROZEN){
					for(const mirror of MIRROR){
						cells += 1;
						const tag = JSON.stringify({ localFrozen, complete, pkgFlag, pkgFrozen, mirror });
						const before = setupLocal(localFrozen);
						// eslint-disable-next-line no-await-in-loop
						await restoreUnifiedBackup(pkgOf(complete, pkgFlag, pkgFrozen, mirror));
						const after = oldChartValue();
						if(after !== before){ flips.push(`${tag} ${before}→${after}`); }
						const direct = afterReload();
						setupLocal(localFrozen);
						previewUnifiedRestore(pkgOf(complete, pkgFlag, pkgFrozen, mirror));
						// eslint-disable-next-line no-await-in-loop
						await restoreUnifiedBackup(pkgOf(complete, pkgFlag, pkgFrozen, mirror));
						if(afterReload() !== direct){ diverge.push(tag); }
					}
				}
			}
		}
	}
	expect(cells).toBe(2 * 3 * 2 * 7 * 3);
	expect(flips).toEqual([]);
	expect(diverge).toEqual([]);
});

test('计划本身不写存储(预览不先冻出值)', ()=>{
	window.localStorage.clear();
	seeds.__resetNewChartSeedsForTest();
	seeds.newChartSeedValue('houseStartMode');   // 启动时首次读种子(一次性并入照常跑)
	window.localStorage.removeItem(FROZEN);      // 本机此刻没有冻结值(如刚被复位)
	seeds.planNewChartSeedsRestore({ [FLAG]: '1', ziweiHuoling: 'x' }, { settingsComplete: true });
	expect(window.localStorage.getItem(FROZEN)).toBe(null);
});
