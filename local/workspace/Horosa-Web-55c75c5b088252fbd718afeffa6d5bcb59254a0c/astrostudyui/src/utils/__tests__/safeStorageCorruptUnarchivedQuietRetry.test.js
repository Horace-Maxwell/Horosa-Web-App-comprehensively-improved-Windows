// 坏用户数据 + 本机存储满、留不成档之后:同一份坏原串只尝试留档一次,之后的读 / 写不再重试、不再连带清别的键。
// 此前每读一次、每写一次这把键都重试留档 —— 留档要和原串一样大的空闲,空间没变时必然失败,而每次失败都先清两档
// (含告急档:AI 挂载快照、工具箱表单态),页面正在用的这些状态被一遍遍清掉;账本写循环一次最多清 13 回。
// 现在:没试过的这份内容才试(写不进就把为它腾掉的原样放回);试过的:写之前只直写重试一次(不腾空间),
// 读(频繁)只在「腾出过空间」或隔了一段时间才直写重试;
// 存储健康页可「已导出,放弃本机这份」解除封锁。
// 例子表里两种使用方:「读到当空、写拒绝」(原有合同)与「每次读写的副作用」—— 后者是只测前者时漏掉的那一种。
import {
	safeJsonParseFromStorage, safeLocalStorageSet, safeLocalStorageRemove, listCorruptArchives,
	listCorruptUnarchivedKeys, __resetCorruptUnarchivedForTests, abandonCorruptUnarchived,
	CORRUPT_ARCHIVE_RETRY_MIN_MS,
} from '../safeStorage';

const KEY = 'horosa.lc.lifeEvents.v1';           // 用户数据键
const FILL = 'horosa.localCharts.v1';            // 填满剩余空间用(不在清理面里)
const EMERGENCY = ['horosa.ai.snapshot.ziwei', 'baziInverse', 'commtoolstab'];

function corruptRaw(){
	const body = JSON.stringify({ sig: Array.from({ length: 20000 }, (_, i)=>({ id: `e${i}`, date: '2020-01-01', title: '事件'.repeat(30) })) });
	return body.slice(0, body.length - 3);
}
// 填满,只留一点给小写入
function fillLeaving(spare){
	const filler = 'x'.repeat(10000);
	try{ for(;;){ localStorage.setItem(FILL, (localStorage.getItem(FILL) || '') + filler); } }catch(e){ /* 满了 */ }
	const cur = localStorage.getItem(FILL);
	localStorage.setItem(FILL, cur.slice(0, cur.length - spare));
}
function writeEmergency(tag){
	EMERGENCY.forEach((k)=>expect(safeLocalStorageSet(k, `{"t":"${tag}"}`)).toBe(true));
}
function emergencyAlive(){
	return EMERGENCY.filter((k)=>localStorage.getItem(k) !== null);
}

let nowSpy = null;
let clock = 1700000000000;
beforeEach(()=>{
	localStorage.clear();
	__resetCorruptUnarchivedForTests();
	clock = 1700000000000;
	nowSpy = jest.spyOn(Date, 'now').mockImplementation(()=>clock);
});
afterEach(()=>{ if(nowSpy){ nowSpy.mockRestore(); } });

describe('🔴 留不成档之后:读写不再清告急档', ()=>{
	test('连读 20 次、写 20 次:告急档的键都还在,坏原串原样', ()=>{
		const raw = corruptRaw();
		localStorage.setItem(KEY, raw);
		fillLeaving(20000);
		expect(safeJsonParseFromStorage(KEY)).toBe(null);
		expect(listCorruptUnarchivedKeys().map((x)=>x.key)).toEqual([KEY]);
		writeEmergency('after-first-read');          // 页面照常写回挂载快照 / 表单态
		for(let i = 0; i < 20; i++){ expect(safeJsonParseFromStorage(KEY)).toBe(null); }
		for(let i = 0; i < 20; i++){ expect(safeLocalStorageSet(KEY, '{}')).toBe(false); }
		expect(emergencyAlive()).toEqual(EMERGENCY);
		expect(localStorage.getItem(KEY)).toBe(raw);
	});
	test('第一次尝试留档写不进:为它腾掉的两档原样放回(留档失败不连带清别的键)', ()=>{
		const raw = corruptRaw();
		localStorage.setItem(KEY, raw);
		fillLeaving(20000);
		writeEmergency('before');
		expect(safeJsonParseFromStorage(KEY)).toBe(null);
		expect(emergencyAlive()).toEqual(EMERGENCY);
		expect(localStorage.getItem(EMERGENCY[0])).toBe('{"t":"before"}');
	});
	test('删掉别的一把大键(腾出空间,不论经不经本层)→ 下一次写先留档成功、再照常写,封锁解除', ()=>{
		const raw = corruptRaw();
		localStorage.setItem(KEY, raw);
		fillLeaving(20000);
		safeJsonParseFromStorage(KEY);
		localStorage.removeItem(FILL);
		expect(safeLocalStorageSet(KEY, '{"sig":[]}')).toBe(true);
		const arch = listCorruptArchives();
		expect(arch.length).toBe(1);
		expect(localStorage.getItem(arch[0].key)).toBe(raw);
		expect(listCorruptUnarchivedKeys()).toEqual([]);
	});
	test('读:空间是别处腾出的(没经本层删键)→ 隔一段时间后的读才再直写重试;经本层删键则下一次读就试', ()=>{
		const raw = corruptRaw();
		localStorage.setItem(KEY, raw);
		fillLeaving(20000);
		safeJsonParseFromStorage(KEY);
		localStorage.removeItem(FILL);               // 绕过本层(别的窗口 / 记录库内核)腾出的空间
		expect(safeJsonParseFromStorage(KEY)).toBe(null);
		expect(listCorruptArchives().length).toBe(0);   // 时间没到:不试
		clock += CORRUPT_ARCHIVE_RETRY_MIN_MS;
		expect(safeJsonParseFromStorage(KEY)).toBe(null);
		expect(listCorruptArchives().length).toBe(1);   // 留档成功,原串清掉
		expect(localStorage.getItem(KEY)).toBe(null);
		expect(listCorruptUnarchivedKeys()).toEqual([]);
		// 经本层删键:代次变了,不必等
		localStorage.clear();
		__resetCorruptUnarchivedForTests();
		localStorage.setItem(KEY, raw);
		fillLeaving(20000);
		safeJsonParseFromStorage(KEY);
		safeLocalStorageRemove(FILL);
		safeJsonParseFromStorage(KEY);
		expect(listCorruptArchives().length).toBe(1);
	});
	test('坏原串换了一份(内容指纹变了)→ 当新的一份重试留档', ()=>{
		const raw = corruptRaw();
		localStorage.setItem(KEY, raw);
		fillLeaving(20000);
		safeJsonParseFromStorage(KEY);
		localStorage.removeItem(FILL);
		localStorage.setItem(KEY, '{"sig":[1,');      // 别处写进一份不同的坏串
		expect(safeJsonParseFromStorage(KEY)).toBe(null);
		expect(listCorruptArchives().map((a)=>localStorage.getItem(a.key))).toEqual(['{"sig":[1,']);
	});
	test('存储健康页「已导出,放弃本机这份」:删原串、解除封锁、之后照常写', ()=>{
		const raw = corruptRaw();
		localStorage.setItem(KEY, raw);
		fillLeaving(20000);
		safeJsonParseFromStorage(KEY);
		expect(safeLocalStorageSet(KEY, '{}')).toBe(false);
		expect(abandonCorruptUnarchived('horosa.not.listed')).toBe(false);   // 只认清单里的键
		expect(abandonCorruptUnarchived(KEY)).toBe(true);
		expect(localStorage.getItem(KEY)).toBe(null);
		expect(listCorruptUnarchivedKeys()).toEqual([]);
		expect(safeLocalStorageSet(KEY, '{}')).toBe(true);
	});
});
