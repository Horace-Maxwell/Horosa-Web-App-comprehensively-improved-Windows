// 存储相关的界面文字与入口:
//  ① 批量删除确认框按「回收站上限 + 删除日志剩余容量」如实写:会挤掉删除日志最早的就写「永久删除」;删掉却没留底的条数写进提示
//  ② 删除日志面板能列出本库每一条(不只最近 8 条),可搜
//  ③ 横幅:存储写满时删掉却没留底的记录给「导出这些记录」;坏主存已从空库开始的说明;影子暂停镜像的说明;清空后恢复的说明
//  ④ 独立实例提示写明本窗口不做自动备份与影子副本
//  ⑤ 存储健康页:列出损坏内容留档(导出 / 删除);影子副本里较新的记录在这里也能并回或以本机为准
//  ⑥ 运行体检与自动备份失败说人话(壳层原始报错不直出;没有「文稿」访问权限单独说清)
//  ⑦ 无头:本机存储里的内容留档键也算进「档案为空」时的提示
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { batchRemoveConfirmTitle, batchRemoveUnkeptNote } from '../../components/user/recordListText';
import DeletedLogPanel, { readDeletedLogEntries, filterDeletedLogEntries } from '../../components/user/DeletedLogPanel';
import LocalStoreHealthBanner, { memoryNoticeText, corruptResetNoticeText, unkeptNoticeText, AHEAD_PAUSED_NOTE, CLEARED_SECURITY_NOTE } from '../../components/common/LocalStoreHealthBanner';
import MultiInstanceNotice from '../../components/common/MultiInstanceNotice';
import StorageHealthModal, { corruptArchiveSourceLabel } from '../../components/common/StorageHealthModal';
import { listCorruptArchives, removeCorruptArchive } from '../safeStorage';
import { describeAutoBackupFailure } from '../autoBackup';
import { DELETED_LOG_CAP, countDeletedLogEntries } from '../localRecordStore';

const LOG = 'horosa.deleted.log.v1';
let host;
beforeAll(()=>{
	// antd 的响应式栅格要 matchMedia(jsdom 没有)
	if(!window.matchMedia){
		window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return false; } });
	}
});
beforeEach(()=>{
	window.localStorage.clear();
	host = document.createElement('div');
	document.body.appendChild(host);
});
afterEach(()=>{
	ReactDOM.unmountComponentAtNode(host);
	host.remove();
});

describe('① 批量删除确认框', ()=>{
	it('日志还放得下:写「仍可找回」;会挤掉日志最早的:写出永久删除几条、建议先导出', ()=>{
		expect(batchRemoveConfirmTitle(5, 10, 200, 0, DELETED_LOG_CAP)).toBe('将选中 5 条移入回收站？（可恢复）');
		const ok = batchRemoveConfirmTitle(100, 150, 200, 10, DELETED_LOG_CAP);
		expect(ok).toContain('超出 50 条');
		expect(ok).toContain('仍可从回收站下方的「删除日志」找回');
		const lost = batchRemoveConfirmTitle(800, 0, 200, 0, DELETED_LOG_CAP);
		expect(lost).toContain('会有 100 条最早删的记录被永久删除');
		expect(lost).toContain('建议先「导出选中」再删');
		expect(lost).not.toContain('仍可从');
		// 日志里已有的也算:这次只超出 30 条,但日志已有 490 条
		expect(batchRemoveConfirmTitle(30, 200, 200, 490, DELETED_LOG_CAP)).toContain('会有 20 条最早删的记录被永久删除');
	});
	it('删掉却没留底的条数写进完成提示', ()=>{
		expect(batchRemoveUnkeptNote(0)).toBe('');
		expect(batchRemoveUnkeptNote(3)).toContain('其中 3 条因本地存储空间不足没能留进回收站或删除日志');
	});
	it('删除日志条数(命盘 + 事盘合计)', ()=>{
		window.localStorage.setItem(LOG, JSON.stringify([{ store: 'chart', record: { cid: 'a' } }, { store: 'case', record: { cid: 'b' } }]));
		expect(countDeletedLogEntries()).toBe(2);
	});
});

describe('② 删除日志面板', ()=>{
	const seed = (n)=>window.localStorage.setItem(LOG, JSON.stringify([
		...Array.from({ length: n }, (_, i)=>({ store: 'chart', purgedAt: `2026-10-${`${(i % 28) + 1}`.padStart(2, '0')} 10:00:00`, record: { cid: `c${i}`, name: `盘${i}`, birth: '1990-01-01 08:00:00' } })),
		{ store: 'case', purgedAt: '2026-10-01 10:00:00', record: { cid: 'k', event: '课' } },
	]));
	const describe0 = (e)=>`${e.record.name || ''} · ${e.record.birth || ''} · 删于 ${e.purgedAt}`;

	it('缺省列最近 8 条;「显示全部」列出本库每一条,可按名字搜;找回回调拿到那一条', ()=>{
		seed(12);
		const onRestore = jest.fn();
		act(()=>{ ReactDOM.render(<DeletedLogPanel store='chart' describe={describe0} onRestore={onRestore} />, host); });
		expect(host.querySelectorAll('[data-deleted-log-row]').length).toBe(8);
		expect(host.textContent).toContain('这里共 12 条');
		act(()=>{ host.querySelector('[data-deleted-log-toggle]').click(); });
		expect(host.querySelectorAll('[data-deleted-log-row]').length).toBe(12);
		const input = host.querySelector('input');
		act(()=>{
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
			setter.call(input, '盘11');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
		const rows = host.querySelectorAll('[data-deleted-log-row]');
		expect(rows.length).toBe(1);
		act(()=>{ rows[0].querySelector('a').click(); });
		expect(onRestore).toHaveBeenCalledTimes(1);
		expect(onRestore.mock.calls[0][0].record.cid).toBe('c11');
	});

	it('只认本库的条目;没有条目时不渲染', ()=>{
		seed(2);
		expect(readDeletedLogEntries('case').map((e)=>e.record.cid)).toEqual(['k']);
		expect(filterDeletedLogEntries(readDeletedLogEntries('chart'), '盘1', describe0).map((e)=>e.record.cid)).toEqual(['c1']);
		window.localStorage.removeItem(LOG);
		act(()=>{ ReactDOM.render(<DeletedLogPanel store='chart' describe={describe0} />, host); });
		expect(host.textContent).toBe('');
	});
});

describe('③ 存储横幅', ()=>{
	it('删掉却没留底的记录:横幅出现「导出这些记录」,条数累计;「知道了」清掉', ()=>{
		act(()=>{ ReactDOM.render(<LocalStoreHealthBanner />, host); });
		expect(host.textContent).toBe('');
		act(()=>{
			window.dispatchEvent(new CustomEvent('horosa:record-store-unkept', { detail: { store: 'chart', records: [{ cid: 'a' }, { cid: 'b' }] } }));
			window.dispatchEvent(new CustomEvent('horosa:record-store-unkept', { detail: { store: 'case', records: [{ cid: 'c' }] } }));
		});
		expect(host.textContent).toContain(unkeptNoticeText(3));
		const btns = Array.from(host.querySelectorAll('button')).map((b)=>b.textContent);
		expect(btns).toContain('导出这些记录');
		act(()=>{ Array.from(host.querySelectorAll('button')).find((b)=>b.textContent === '知道了').click(); });
		expect(host.textContent).toBe('');
	});

	it('影子较新:横幅写明暂停镜像;「以本机为准」连另存的不一致副本一起丢;坏主存已从空库开始的横幅', ()=>{
		// eslint-disable-next-line global-require
		const sm = require('../shadowMirror');
		const K = 'horosa.localCharts.v1';
		const s1 = jest.spyOn(sm, 'getShadowAhead').mockReturnValue({ [K]: [{ cid: 'x', name: '退出前新建' }] });
		const discard = jest.spyOn(sm, 'discardShadowAhead').mockImplementation(()=>{});
		try{
			act(()=>{ ReactDOM.render(<LocalStoreHealthBanner />, host); });
			act(()=>{ window.dispatchEvent(new CustomEvent('horosa.shadowMirror.reconciled', { detail: { checked: true, restored: [], diverged: [K], ahead: { [K]: 1 }, corrupt: [] } })); });
			expect(host.textContent).toContain(AHEAD_PAUSED_NOTE);
			act(()=>{ Array.from(host.querySelectorAll('button')).find((b)=>b.textContent === '以本机为准').click(); });
			expect(discard).toHaveBeenCalledWith(K);
		}finally{ s1.mockRestore(); discard.mockRestore(); }
	});

	it('文字:坏主存三种情形各说各的;影子暂停镜像与清空后恢复都写明', ()=>{
		expect(memoryNoticeText({ corrupt: ['命盘库'] })).toContain('原内容已原样留档');
		expect(memoryNoticeText({ corruptUnarchived: ['命盘库'] })).toContain('原内容没能另存留档');
		expect(memoryNoticeText({ corruptUnarchived: ['命盘库'] })).not.toContain('已原样留档');
		expect(memoryNoticeText({})).toContain('暂存于内存');
		expect(corruptResetNoticeText(['命盘库'])).toContain('已从空库开始');
		expect(AHEAD_PAUSED_NOTE).toContain('暂停写影子副本');
		expect(CLEARED_SECURITY_NOTE).toContain('较严的一档');
	});
});

describe('④ 独立实例提示', ()=>{
	it('写明本窗口不做自动备份、不写影子副本', ()=>{
		act(()=>{ ReactDOM.render(<MultiInstanceNotice port='38993' />, host); });
		expect(host.textContent).toContain('不做自动备份');
		expect(host.textContent).toContain('影子副本');
	});
});

describe('⑤ 存储健康页', ()=>{
	it('损坏内容留档:列出(新的在前,中文来源名),可删除;只认留档前缀', ()=>{
		window.localStorage.setItem('horosa.corrupt.horosa.localCharts.v1.20261001-100000-000', '{bad');
		window.localStorage.setItem('horosa.corrupt.horosa.zeri.schemes.v1.20261005-100000-000', '[');
		const list = listCorruptArchives();
		expect(list.map((a)=>a.sourceKey)).toEqual(['horosa.zeri.schemes.v1', 'horosa.localCharts.v1']);
		expect(list[1]).toMatchObject({ at: '20261001-100000-000', size: 4 });
		expect(corruptArchiveSourceLabel('horosa.localCharts.v1')).toBe('命盘库');
		expect(corruptArchiveSourceLabel('horosa.zeri.schemes.v1')).toBe('西洋择日已存方案');
		expect(removeCorruptArchive('horosa.localCharts.v1')).toBe(false);
		expect(removeCorruptArchive(list[1].key)).toBe(true);
		expect(listCorruptArchives().length).toBe(1);
	});

	it('页面里列出留档并给导出 / 删除', ()=>{
		window.localStorage.setItem('horosa.corrupt.horosa.localCases.v1.20261002-100000-000', '{x');
		act(()=>{ ReactDOM.render(<StorageHealthModal visible onClose={()=>{}} />, host); });
		const row = document.body.querySelector('[data-corrupt-archive="horosa.corrupt.horosa.localCases.v1.20261002-100000-000"]');
		expect(row).toBeTruthy();
		expect(row.textContent).toContain('事盘库');
		expect(row.textContent).toContain('导出为文件');
		expect(row.textContent).toMatch(/删\s?除/);   // antd 两字按钮中间插空格
		expect(row.textContent).toContain('不到 1 KB');
		act(()=>{ ReactDOM.unmountComponentAtNode(host); });
	});
});

describe('⑤ 存储健康页 · 影子副本', ()=>{
	it('影子副本里较新的记录:关掉顶部提示后在存储健康页也能并回或以本机为准,并写明暂停镜像', ()=>{
		// eslint-disable-next-line global-require
		const sm = require('../shadowMirror');
		const K = 'horosa.localCharts.v1';
		const spies = [
			jest.spyOn(sm, 'getShadowMirrorStatus').mockReturnValue({ enabled: true, held: [K], lastReconcile: { diverged: [K] }, lastMirrorError: null }),
			jest.spyOn(sm, 'getShadowAhead').mockReturnValue({ [K]: [{ cid: 'x' }, { cid: 'y' }] }),
		];
		const discard = jest.spyOn(sm, 'discardShadowAhead').mockImplementation(()=>{});
		const merge = jest.spyOn(sm, 'mergeShadowAhead').mockReturnValue(2);
		try{
			act(()=>{ ReactDOM.render(<StorageHealthModal visible onClose={()=>{}} />, host); });
			const box = document.body.querySelector('[data-shadow-held]');
			expect(box).toBeTruthy();
			expect(box.textContent).toContain('命盘库 2 条');
			expect(box.textContent).toContain('暂停写影子副本');
			const btn = (t)=>Array.from(box.querySelectorAll('button')).find((b)=>b.textContent.replace(/\s/g, '') === t);
			act(()=>{ btn('以本机为准').click(); });
			expect(discard).toHaveBeenCalledWith(K);
			act(()=>{ btn('并回这些记录').click(); });
			expect(merge).toHaveBeenCalledWith(K);
			act(()=>{ ReactDOM.unmountComponentAtNode(host); });
		}finally{
			[...spies, discard, merge].forEach((x)=>x.mockRestore());
		}
	});
});

describe('⑥ 失败原因说人话', ()=>{
	it('没有访问权限 / 磁盘满 / 其它', ()=>{
		expect(describeAutoBackupFailure('Operation not permitted (os error 1)')).toContain('系统设置 › 隐私与安全性 › 文件与文件夹');
		expect(describeAutoBackupFailure('No space left on device (os error 28)')).toBe('磁盘空间不足，没写成');
		expect(describeAutoBackupFailure('self-verify-failed:empty')).toContain('自检没通过');
		expect(describeAutoBackupFailure('weird')).not.toContain('weird');
	});

	it('运行体检:镜像失败不直出壳层原文;损坏内容留档单列一行', ()=>{
		// eslint-disable-next-line global-require
		const sm = require('../shadowMirror');
		const spy = jest.spyOn(sm, 'getShadowMirrorStatus').mockReturnValue({ enabled: true, lastMirrorError: 'shadow fsync 失败: No space left on device (os error 28)', lastReconcile: null, held: [] });
		try{
			window.localStorage.setItem('horosa.corrupt.horosa.localCharts.v1.20261001-100000-000', '{bad');
			// eslint-disable-next-line global-require
			const { runArchiveHealthCheck } = require('../archiveHealthCheck');
			const rows = runArchiveHealthCheck();
			const row = rows.find((r)=>r.name === '影子副本');
			expect(row.ok).toBe(false);
			expect(row.detail).toContain('可能是磁盘满或没有写权限');
			expect(row.detail).not.toMatch(/fsync|os error|shadow/);
			expect(rows.find((r)=>r.name === '损坏内容留档')).toMatchObject({ ok: false });
		}finally{ spy.mockRestore(); }
	});
});

describe('⑦ 无头:内容留档键', ()=>{
	it('本机存储里的 horosa.corrupt.* 键列得出(运行时与不起运行时两路)', ()=>{
		// eslint-disable-next-line global-require
		const rt = require('../../../headless/runtime');
		expect(rt.corruptArchiveKeysOf({ 'horosa.corrupt.horosa.localCharts.v1.20261001-100000-000': '{', other: '1' })).toEqual(['horosa.corrupt.horosa.localCharts.v1.20261001-100000-000']);
		const prev = process.env.HOROSA_HOME;
		const home = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-arch-'));
		try{
			process.env.HOROSA_HOME = home;
			fs.mkdirSync(rt.dataDir(), { recursive: true });
			fs.writeFileSync(path.join(rt.dataDir(), 'localStorage.json'), JSON.stringify({ 'horosa.corrupt.horosa.localCases.v1.20261001-100000-000': '[' }));
			expect(rt.listCorruptArchiveKeys()).toEqual(['horosa.corrupt.horosa.localCases.v1.20261001-100000-000']);
		}finally{
			if(prev === undefined){ delete process.env.HOROSA_HOME; }else{ process.env.HOROSA_HOME = prev; }
		}
	});
});
