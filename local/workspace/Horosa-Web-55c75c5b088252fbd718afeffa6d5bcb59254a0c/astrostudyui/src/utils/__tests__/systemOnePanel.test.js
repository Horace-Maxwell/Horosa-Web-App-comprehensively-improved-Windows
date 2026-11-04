// 决策层卡片合同:挂载零写入(关 / 开两态)· 关着连 IndexedDB 都不读 · 首开知情弹窗且只问一次 · 档案保存(密钥不回显、留空不改)/ 测试连接 / 删除 ·
// 每个登记的锚都在(与登记表 instances 恰等)· 分开关 / 阈值 落键并即时反映状态列 · 影子点没有「用」档 · 校准按钮无档案禁用 · 清零 / 清日志。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import SystemOnePanel, { pointStateText, effectiveThresholds } from '../../components/aianalysis/chat/SystemOnePanel';
import { listAdvancedControls } from '../../components/aianalysis/chat/advancedControls';
import { setSystemOneEnabled, isSystemOneEnabled, getPointMode, readThresholds, isDisclosureAcknowledged, acknowledgeDisclosure, setPointMode, setSystemOneProfilePresent, __resetSystemOnePrefsForTest, SYSTEMONE_ENABLED_KEY, SYSTEMONE_POINTS_KEY, SYSTEMONE_THRESHOLDS_KEY, SYSTEMONE_STATS_KEY } from '../systemOne/prefs';
import { __setCalibrationForTest, __resetCalibrationStoreForTest, clearCalibration } from '../systemOne/calibrationStore';
import { recordDecision, __resetSystemOneLogForTest, addUsage, readStats, listDecisions } from '../systemOne/log';
import { __resetSystemOneClientForTest } from '../systemOne/client';
import { listPoints, getPoint } from '../systemOne/registry';
import * as integ from '../../integrations/systemOne';
import * as client from '../systemOne/client';

jest.mock('../../integrations/systemOne', ()=>({
	...jest.requireActual('../../integrations/systemOne'),
	getSystemOneProfile: jest.fn(async ()=>null),
	saveSystemOneProfile: jest.fn(async (p)=>({ ok: true, profile: p })),
	removeSystemOneProfile: jest.fn(async ()=>1),
}));
jest.mock('../systemOne/client', ()=>({ ...jest.requireActual('../systemOne/client'), smokeTestSystemOne: jest.fn(async ()=>({ ok: true, model: 'jev-2026', latencyMs: 12, usage: { inputTokens: 3, outputTokens: 1 } })) }));

if(!window.matchMedia){
	window.matchMedia = (q)=>({ matches: false, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{}, dispatchEvent: ()=>false });
}
const PROFILE = { id: 'systemone-default', kind: 'systemone', name: 'TypeSafe', apiKey: 'ts-SECRET-key', baseUrl: '', model: 'jev-latest', enabled: true };
const flush = async ()=>{ await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); await act(async ()=>{ await new Promise((r)=>setTimeout(r, 0)); }); };
const click = async (el)=>{ await act(async ()=>{ el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await flush(); };
const inputOf = (el)=>(el && el.tagName === 'INPUT' ? el : (el ? el.querySelector('input') : null));
const typeInto = async (el, text)=>{ const input = inputOf(el); await act(async ()=>{ const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); }); await flush(); };
const norm = (t)=>`${t || ''}`.replace(/\s+/g, '');

let host;
async function mount(){ await act(async ()=>{ ReactDOM.render(<SystemOnePanel />, host); }); await flush(); }
beforeEach(()=>{
	window.localStorage.clear(); document.body.innerHTML = '';
	__resetSystemOnePrefsForTest(); __resetCalibrationStoreForTest(); __resetSystemOneLogForTest(); __resetSystemOneClientForTest();
	integ.getSystemOneProfile.mockReset(); integ.getSystemOneProfile.mockImplementation(async ()=>{ setSystemOneProfilePresent(false); return null; });
	integ.saveSystemOneProfile.mockClear(); integ.removeSystemOneProfile.mockClear(); client.smokeTestSystemOne.mockClear();
	host = document.createElement('div'); document.body.appendChild(host);
});
afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });

describe('挂载零写入 / 关路径零 IO', ()=>{
	it('🔴 关着挂载:不写任何登记键、不读 IndexedDB;卡体收起;胶囊状态「关」', async ()=>{
		const before = Object.keys(window.localStorage).sort();
		await mount();
		expect(Object.keys(window.localStorage).sort()).toEqual(before);
		expect(integ.getSystemOneProfile).not.toHaveBeenCalled();
		expect(host.querySelector('[data-systemone-panel="1"]')).toBeTruthy();
		expect(host.querySelector('[data-systemone-model="1"]')).toBe(null);
		expect(norm(host.querySelector('[data-systemone-panel="1"]').textContent)).toContain('关');
	});
	it('🔴 开着 + 有档案 + 有校准 + 有日志 挂载:仍零写入;每个登记的锚恰等 instances', async ()=>{
		setSystemOneEnabled(true); acknowledgeDisclosure();
		integ.getSystemOneProfile.mockImplementation(async ()=>{ setSystemOneProfilePresent(true); return PROFILE; });
		__setCalibrationForTest('jev-2026', ['A2']);
		recordDecision({ pointId: 'A2', source: 'systemone', value: 'release', heuristic: 'block', confidence: 0.95, agree: false, latencyMs: 40, model: 'jev-2026' });
		addUsage({ items: 1, inputTokens: 10, model: 'jev-2026' });
		const before = Object.keys(window.localStorage).sort();
		await mount();
		expect(Object.keys(window.localStorage).sort()).toEqual(before);
		const reg = listAdvancedControls().controls.filter((c)=>c.file === 'chat/SystemOnePanel.js');
		expect(reg.length).toBeGreaterThanOrEqual(16);
		// 阈值三控件要先选点;删除钮要有档案(已有);其余直接可见
		const sel = host.querySelector('[data-systemone-threshold-point="1"]');
		await act(async ()=>{ (sel.querySelector('.ant-select-selector') || sel).dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); await flush();
		const opt = Array.from(document.querySelectorAll('.ant-select-item-option')).find((o)=>norm(o.textContent).indexOf('A2') === 0);
		await click(opt);
		reg.forEach((c)=>{ expect({ id: c.id, found: document.querySelectorAll(`[${c.anchor}]`).length }).toEqual({ id: c.id, found: c.instances }); });
		expect(document.querySelectorAll('[data-systemone-point]').length).toBe(listPoints().length);
		expect(norm(host.querySelector('[data-systemone-log="1"]').textContent)).toContain('A2systemone');
		expect(host.querySelector('[data-systemone-panel="1"]').textContent).not.toContain('ts-SECRET-key');
	});
});

describe('总开关与知情', ()=>{
	it('首开弹知情确认;确认后键 "1" + 知情键;关 → "0";再开不弹', async ()=>{
		await mount();
		await click(host.querySelector('[data-systemone-switch="1"]'));
		const modal = document.querySelector('.ant-modal-confirm');
		expect(modal).toBeTruthy();
		expect(isSystemOneEnabled()).toBe(false);
		const ok = Array.from(document.querySelectorAll('.ant-modal-confirm .ant-btn')).find((b)=>norm(b.textContent) === '我知道了,打开');
		await click(ok);
		expect(isSystemOneEnabled()).toBe(true);
		expect(isDisclosureAcknowledged()).toBe(true);
		expect(host.querySelector('[data-systemone-model="1"]')).toBeTruthy();
		await click(host.querySelector('[data-systemone-switch="1"]'));
		expect(window.localStorage.getItem(SYSTEMONE_ENABLED_KEY)).toBe('0');
		expect(host.querySelector('[data-systemone-model="1"]')).toBe(null);
		document.body.querySelectorAll('.ant-modal-root').forEach((n)=>n.remove());
		await click(host.querySelector('[data-systemone-switch="1"]'));
		expect(document.querySelector('.ant-modal-confirm')).toBe(null);
		expect(isSystemOneEnabled()).toBe(true);
	});
	it('取消知情 → 不开', async ()=>{
		await mount();
		await click(host.querySelector('[data-systemone-switch="1"]'));
		const cancel = Array.from(document.querySelectorAll('.ant-modal-confirm .ant-btn')).find((b)=>norm(b.textContent) === '取消');
		await click(cancel);
		expect(isSystemOneEnabled()).toBe(false);
		expect(isDisclosureAcknowledged()).toBe(false);
	});
});

describe('档案', ()=>{
	beforeEach(()=>{ setSystemOneEnabled(true); acknowledgeDisclosure(); });
	it('未配置:测试钮禁用、校准钮禁用、无删除钮;填密钥保存 → 走 saveSystemOneProfile,密钥框清空,不回显', async ()=>{
		await mount();
		expect(host.querySelector('[data-systemone-status="none"]')).toBeTruthy();
		expect(host.querySelector('[data-systemone-test="1"]').disabled).toBe(true);
		expect(host.querySelector('[data-systemone-calibrate="1"]').disabled).toBe(true);
		expect(host.querySelector('[data-systemone-delete="1"]')).toBe(null);
		await typeInto(host.querySelector('[data-systemone-baseurl="1"]'), 'http://127.0.0.1:18081/');
		await typeInto(host.querySelector('[data-systemone-apikey="1"]'), 'ts-NEW-key');
		integ.getSystemOneProfile.mockImplementation(async ()=>{ setSystemOneProfilePresent(true); return { ...PROFILE, apiKey: 'ts-NEW-key', baseUrl: 'http://127.0.0.1:18081' }; });
		await click(host.querySelector('[data-systemone-save="1"]'));
		expect(integ.saveSystemOneProfile).toHaveBeenCalledWith({ apiKey: 'ts-NEW-key', baseUrl: 'http://127.0.0.1:18081/', model: 'jev-latest' });
		expect(host.querySelector('[data-systemone-status="configured"]')).toBeTruthy();
		expect(inputOf(host.querySelector('[data-systemone-apikey="1"]')).value).toBe('');
		expect(host.textContent).not.toContain('ts-NEW-key');
		expect(host.querySelector('[data-systemone-test="1"]').disabled).toBe(false);
		expect(host.querySelector('[data-systemone-calibrate="1"]').disabled).toBe(false);
	});
	it('已配置:表单脏 → 测试禁用并提示;测试连接走 smokeTest 且探针显示模型号;删除 → 未配置', async ()=>{
		integ.getSystemOneProfile.mockImplementation(async ()=>{ setSystemOneProfilePresent(true); return PROFILE; });
		await mount();
		expect(host.querySelector('[data-systemone-status="configured"]')).toBeTruthy();
		await click(host.querySelector('[data-systemone-test="1"]'));
		expect(client.smokeTestSystemOne).toHaveBeenCalledTimes(1);
		expect(host.querySelector('[data-systemone-probe="ok"]').textContent).toContain('jev-2026');
		await typeInto(host.querySelector('[data-systemone-apikey="1"]'), 'x');
		expect(host.querySelector('[data-systemone-test="1"]').disabled).toBe(true);
		expect(host.querySelector('[data-systemone-dirty="1"]')).toBeTruthy();
		await click(host.querySelector('[data-systemone-delete="1"]'));
		expect(integ.removeSystemOneProfile).toHaveBeenCalledTimes(1);
		expect(host.querySelector('[data-systemone-status="none"]')).toBeTruthy();
	});
});

describe('接入点分开关 / 阈值 / 用量', ()=>{
	beforeEach(()=>{ setSystemOneEnabled(true); acknowledgeDisclosure(); });
	it('影子点只有 关 / 影子;拨「用」落键并把状态列写「缺档案」;有档案未校准 → 「待校准」;校准过 → 「生效」', async ()=>{
		await mount();
		const b1 = host.querySelector('[data-systemone-point-mode="B1"]');
		expect(Array.from(b1.querySelectorAll('input[type="radio"]')).map((i)=>i.value)).toEqual(['off', 'shadow']);
		const a2 = host.querySelector('[data-systemone-point-mode="A2"]');
		expect(Array.from(a2.querySelectorAll('input[type="radio"]')).map((i)=>i.value)).toEqual(['off', 'on', 'shadow']);
		await click(a2.querySelector('input[value="on"]'));
		expect(getPointMode('A2')).toBe('on');
		expect(JSON.parse(window.localStorage.getItem(SYSTEMONE_POINTS_KEY))).toEqual({ A2: 'on' });
		const row = ()=>host.querySelector('[data-systemone-point="A2"]');
		expect(norm(row().textContent)).toContain('缺档案');
		expect(row().getAttribute('data-systemone-point-state')).toBe('idle');
		expect(pointStateText(getPoint('A2'), { enabled: true, profile: true, calibration: null })).toBe('待校准');
		expect(pointStateText(getPoint('A2'), { enabled: true, profile: true, calibration: { drift: 'jev-9', points: {} } })).toBe('模型号漂移,需重校准');
		expect(pointStateText(getPoint('A2'), { enabled: true, profile: true, calibration: { drift: '', points: { A2: { passed: true } } } })).toBe('生效');
		expect(pointStateText(getPoint('A2'), { enabled: true, profile: true, calibration: { drift: '', points: { A2: { passed: false, reason: '样本不足' } } } })).toBe('校准未过:样本不足');
		expect(pointStateText(getPoint('B1'), { enabled: false, profile: true, calibration: null })).toBe('关');
		await click(a2.querySelector('input[value="off"]'));
		expect(window.localStorage.getItem(SYSTEMONE_POINTS_KEY)).toBe(null);   // 表空 = 删键
	});
	it('阈值:选点后显示缺省(A2 act 0.85);改值落键;恢复默认删键;效果函数与点缺省合并', async ()=>{
		await mount();
		const sel = host.querySelector('[data-systemone-threshold-point="1"]');
		await act(async ()=>{ (sel.querySelector('.ant-select-selector') || sel).dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); await flush();
		await click(Array.from(document.querySelectorAll('.ant-select-item-option')).find((o)=>norm(o.textContent).indexOf('A2') === 0));
		expect(inputOf(host.querySelector('[data-systemone-threshold-act="1"]')).value).toBe('0.85');
		expect(host.querySelector('[data-systemone-threshold-reset="1"]').disabled).toBe(true);
		await typeInto(host.querySelector('[data-systemone-threshold-act="1"]'), '0.95');
		expect(readThresholds('A2')).toEqual({ act: 0.95 });
		await typeInto(host.querySelector('[data-systemone-threshold-confirm="1"]'), '0.7');
		expect(readThresholds('A2')).toEqual({ act: 0.95, confirm: 0.7 });
		expect(effectiveThresholds(getPoint('A2'))).toEqual({ act: 0.95, confirm: 0.7, releaseMax: 0.15 });
		expect(host.querySelector('[data-systemone-threshold-reset="1"]').disabled).toBe(false);
		await click(host.querySelector('[data-systemone-threshold-reset="1"]'));
		expect(window.localStorage.getItem(SYSTEMONE_THRESHOLDS_KEY)).toBe(null);   // 表空 = 删键
	});
	it('用量清零删键;清日志清内存环;校准记录清除', async ()=>{
		addUsage({ items: 2, inputTokens: 100 });
		recordDecision({ pointId: 'A2', source: 'fallback', value: 'block', heuristic: 'block', reason: 'timeout' });
		__setCalibrationForTest('jev-2026', ['A2']);
		integ.getSystemOneProfile.mockImplementation(async ()=>{ setSystemOneProfilePresent(true); return PROFILE; });
		await mount();
		expect(readStats().calls).toBe(1);
		await click(host.querySelector('[data-systemone-stats-reset="1"]'));
		expect(window.localStorage.getItem(SYSTEMONE_STATS_KEY)).toBe(null);
		expect(listDecisions().length).toBe(1);
		await click(host.querySelector('[data-systemone-log-clear="1"]'));
		expect(listDecisions().length).toBe(0);
		expect(host.querySelector('[data-systemone-calibration="ok"]')).toBeTruthy();
		await click(host.querySelector('[data-systemone-calibration-clear="1"]'));
		expect(host.querySelector('[data-systemone-calibration]')).toBe(null);
		clearCalibration();
	});
});
