// 影子副本「并回 / 以本机为准」与对账的几条安全口径:
//  ① 并回按当前主存 / 回收站 / 删除日志重新比:本次运行里亲手改过的保留本机、删进回收站或彻底删掉的不再补回;被替换的本机那版留历史
//  ② 对账算「影子里较新」时排除本机删除日志里之后彻底删过的(暂停镜像期间彻底删掉的记录不再被列出、一并回就复活)
//  ③ 主存坏了而原串留不成档(空间不足):不拿影子盖它(与回收站同口径),记 corruptUnarchived
//  ④ 「以本机为准」请壳层删掉这把键另存的不一致副本;单纯恢复镜像不删
//  ⑤ 壳层告诉了实例身份就以它为准(首选口被别的程序占着时,唯一的实例落在后继口也照样做影子 / 自动备份)
jest.mock('../aiAnalysisDesktop', ()=>({
	isDesktopBridgeAvailable: jest.fn(()=>true),
	invokeDesktopCommand: jest.fn(()=>Promise.resolve()),
}));
import { invokeDesktopCommand } from '../aiAnalysisDesktop';
import { reconcileShadowOnBoot, mergeShadowAhead, releaseShadowHold, discardShadowAhead, getShadowMirrorStatus, shadowMirrorEligible, __resetShadowMirrorForTests } from '../shadowMirror';
import { listRecordRevisions, __resetRevisionsForTests } from '../recordRevisions';
import { shellInstanceRole, currentWindowIsIndependent } from '../../components/common/MultiInstanceNotice';

const CHARTS = 'horosa.localCharts.v1';
const TRASH = 'horosa.localCharts.trash.v1';
const LOG = 'horosa.deleted.log.v1';
const quotaErr = ()=>{ const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; return e; };

beforeEach(()=>{
	window.localStorage.clear();
	jest.clearAllMocks();
	__resetShadowMirrorForTests();
	__resetRevisionsForTests();
	delete window.__HOROSA_INSTANCE_ROLE__;
});

describe('① 并回用当前数据重新比', ()=>{
	it('亲手改过的保留本机、删进回收站的不补回;被影子替换的本机那版留历史', async ()=>{
		window.localStorage.setItem(CHARTS, JSON.stringify([
			{ cid: 'A', name: 'A-本机旧', updateTime: '2026-10-01 10:00:00' },
			{ cid: 'C', name: 'C-本机旧', updateTime: '2026-10-01 10:00:00' },
		]));
		const shadow = [
			{ cid: 'A', name: 'A-退出前最后一改', updateTime: '2026-10-19 09:00:00' },
			{ cid: 'B', name: 'B-退出前新建', updateTime: '2026-10-19 09:30:00' },
			{ cid: 'C', name: 'C-退出前最后一改', updateTime: '2026-10-19 09:10:00' },
		];
		invokeDesktopCommand.mockResolvedValueOnce({ [CHARTS]: JSON.stringify(shadow) });
		const r = await reconcileShadowOnBoot();
		expect(r.ahead).toEqual({ [CHARTS]: 3 });
		// 本次运行里:A 亲手又改了(更晚);B 没有 —— 用户先把它删进了回收站(模拟:并回前 B 在回收站)
		const now = JSON.parse(window.localStorage.getItem(CHARTS)).map((x)=>(x.cid === 'A' ? { ...x, name: 'A-本次运行亲手改', updateTime: '2026-10-20 10:00:00' } : x));
		window.localStorage.setItem(CHARTS, JSON.stringify(now));
		window.localStorage.setItem(TRASH, JSON.stringify([{ cid: 'B', name: 'B-退出前新建', deletedAt: '2026-10-20 10:05:00' }]));
		expect(mergeShadowAhead(CHARTS)).toBe(1);
		const after = JSON.parse(window.localStorage.getItem(CHARTS));
		expect(after.find((x)=>x.cid === 'A').name).toBe('A-本次运行亲手改');
		expect(after.find((x)=>x.cid === 'C').name).toBe('C-退出前最后一改');
		expect(after.some((x)=>x.cid === 'B')).toBe(false);
		expect((await listRecordRevisions('chart', 'C')).map((x)=>x.record.name)).toEqual(['C-本机旧']);
		expect(getShadowMirrorStatus().held).toEqual([]);
	});
});

describe('② 对账排除之后彻底删过的', ()=>{
	it('影子里有、本机没有,但本机删除日志里在影子那版之后彻底删过 → 不算「较新」', async ()=>{
		window.localStorage.setItem(CHARTS, JSON.stringify([{ cid: 'jia', name: '甲', updateTime: '2026-10-01 10:00:00' }]));
		window.localStorage.setItem(LOG, JSON.stringify([{ store: 'chart', purgedAt: '2026-10-18 12:00:00', record: { cid: 'yi', name: '乙' } }]));
		const shadow = [
			{ cid: 'jia', name: '甲', updateTime: '2026-10-01 10:00:00' },
			{ cid: 'yi', name: '乙', updateTime: '2026-10-10 10:00:00' },
			{ cid: 'new', name: '退出前新建', updateTime: '2026-10-19 10:00:00' },
		];
		invokeDesktopCommand.mockResolvedValueOnce({ [CHARTS]: JSON.stringify(shadow) });
		const r = await reconcileShadowOnBoot();
		expect(r.ahead).toEqual({ [CHARTS]: 1 });
		expect(mergeShadowAhead(CHARTS)).toBe(1);
		expect(JSON.parse(window.localStorage.getItem(CHARTS)).map((x)=>x.cid).sort()).toEqual(['jia', 'new']);
	});

	it('回收站键同口径:影子回收站里有、本机回收站与主库都没有,但已彻底删除 → 不算「较新」', async ()=>{
		window.localStorage.setItem(TRASH, JSON.stringify([{ cid: 't1', deletedAt: '2026-10-01 10:00:00' }]));
		window.localStorage.setItem(LOG, JSON.stringify([{ store: 'chart', purgedAt: '2026-10-18 12:00:00', record: { cid: 't2' } }]));
		invokeDesktopCommand.mockResolvedValueOnce({ [TRASH]: JSON.stringify([{ cid: 't1', deletedAt: '2026-10-01 10:00:00' }, { cid: 't2', deletedAt: '2026-10-05 10:00:00' }]) });
		const r = await reconcileShadowOnBoot();
		expect(r.ahead).toEqual({});
	});
});

describe('③ 坏主存留不成档就不写回', ()=>{
	it('原串另存失败(空间不足):主存不动、记 corruptUnarchived,不算 restored', async ()=>{
		window.localStorage.setItem(CHARTS, '[{"cid":"a"');
		const real = Storage.prototype.setItem;
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(`${k}`.indexOf('horosa.corrupt.') === 0){ throw quotaErr(); }
			return real.call(this, k, v);
		});
		try{
			invokeDesktopCommand.mockResolvedValueOnce({ [CHARTS]: '[{"cid":"a","name":"完好"}]' });
			const r = await reconcileShadowOnBoot();
			expect(r.restored).toEqual([]);
			expect(r.corruptUnarchived).toEqual([CHARTS]);
			expect(window.localStorage.getItem(CHARTS)).toBe('[{"cid":"a"');
		}finally{ spy.mockRestore(); }
	});
});

describe('③ 影子写不回主存', ()=>{
	it('坏主存已留档、影子完好,但写回主存失败(空间不足):记 restoreFailed,不算 restored', async ()=>{
		window.localStorage.setItem(CHARTS, '[{"cid":"a"');
		const real = Storage.prototype.setItem;
		const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v){
			if(k === CHARTS){ throw quotaErr(); }
			return real.call(this, k, v);
		});
		try{
			invokeDesktopCommand.mockResolvedValueOnce({ [CHARTS]: '[{"cid":"a","name":"完好"}]' });
			const r = await reconcileShadowOnBoot();
			expect(r.restored).toEqual([]);
			expect(r.restoreFailed).toEqual([CHARTS]);
		}finally{ spy.mockRestore(); }
	});
});

describe('④ 以本机为准:删掉另存的不一致副本', ()=>{
	it('discardShadowAhead 请壳层删副本;releaseShadowHold 只恢复镜像', async ()=>{
		window.localStorage.setItem(CHARTS, JSON.stringify([{ cid: 'm', name: '本机', updateTime: '2026-10-01 10:00:00' }]));
		invokeDesktopCommand.mockResolvedValueOnce({ [CHARTS]: JSON.stringify([{ cid: 'x', name: '影子多的', updateTime: '2026-10-19 10:00:00' }]) });
		await reconcileShadowOnBoot();
		invokeDesktopCommand.mockClear();
		releaseShadowHold(CHARTS);
		expect(invokeDesktopCommand.mock.calls.map((c)=>c[0])).not.toContain('shadow_store_drop_diverged_command');
		invokeDesktopCommand.mockClear();
		discardShadowAhead(CHARTS);
		expect(invokeDesktopCommand).toHaveBeenCalledWith('shadow_store_drop_diverged_command', { key: CHARTS });
	});

	it('壳层没有这条命令(旧版本):调用失败也不抛', ()=>{
		invokeDesktopCommand.mockImplementationOnce(()=>Promise.reject(new Error('command not found')));
		expect(()=>discardShadowAhead(CHARTS)).not.toThrow();
	});
});

describe('⑤ 实例身份以壳层为准', ()=>{
	it('壳层说是主实例:后继口也做影子;说是独立实例:首选口也不做;没说:按端口推断', ()=>{
		expect(shellInstanceRole()).toBe(null);
		expect(currentWindowIsIndependent(true)).toBe(false);   // jsdom 无端口:按主实例
		expect(currentWindowIsIndependent(true, '38992')).toBe(true);   // 没说身份:后继口按独立实例
		window.__HOROSA_INSTANCE_ROLE__ = 'primary';
		expect(currentWindowIsIndependent(true, '38992')).toBe(false);   // 首选口被别的程序占着、唯一的实例落在后继口
		expect(currentWindowIsIndependent(true, '51234')).toBe(false);
		window.__HOROSA_INSTANCE_ROLE__ = 'independent';
		expect(shellInstanceRole()).toBe('independent');
		expect(currentWindowIsIndependent(true)).toBe(true);
		expect(shadowMirrorEligible()).toBe(false);
		window.__HOROSA_INSTANCE_ROLE__ = 'primary';
		expect(currentWindowIsIndependent(true)).toBe(false);
		expect(shadowMirrorEligible()).toBe(true);
		window.__HOROSA_INSTANCE_ROLE__ = 'something-else';
		expect(shellInstanceRole()).toBe(null);
	});
});
