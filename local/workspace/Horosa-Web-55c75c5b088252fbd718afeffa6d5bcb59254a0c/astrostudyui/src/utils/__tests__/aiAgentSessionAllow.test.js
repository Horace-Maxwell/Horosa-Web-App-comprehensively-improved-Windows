// [P1·2026-09-08] 会话内放行集:纯内存、零 import;空名拒;列表可读;测试重置。
import { allowToolForSession, isToolSessionAllowed, listSessionAllowed, setSessionAllowScope, __getSessionAllowScopeForTests, __resetSessionAllowForTests } from '../aiAgent/sessionAllow';

beforeEach(()=>__resetSessionAllowForTests());

it('放行/判定/列表/重置;空名与空白拒', ()=>{
	expect(isToolSessionAllowed('create_chart_record')).toBe(false);
	expect(allowToolForSession('create_chart_record')).toBe(true);
	expect(allowToolForSession(' set_settings ')).toBe(true);
	expect(allowToolForSession('')).toBe(false);
	expect(allowToolForSession('   ')).toBe(false);
	expect(allowToolForSession(null)).toBe(false);
	expect(isToolSessionAllowed('create_chart_record')).toBe(true);
	expect(isToolSessionAllowed('set_settings')).toBe(true);
	expect(isToolSessionAllowed('other')).toBe(false);
	expect(listSessionAllowed().sort()).toEqual(['create_chart_record', 'set_settings']);
	__resetSessionAllowForTests();
	expect(listSessionAllowed()).toEqual([]);
});

it('🔴 静态守卫:模块零 import(会话放行集不能反向拖进任何数据层/运行时)', ()=>{
	const fs = require('fs');
	const path = require('path');
	const src = fs.readFileSync(path.resolve(__dirname, '..', 'aiAgent', 'sessionAllow.js'), 'utf8');
	expect(src.split('\n').filter((l)=>/^import /.test(l)).length).toBe(0);
});

it('🔴 [AR-31] 放行集按对话作用域分集合:A 对话放行的工具在 B 对话不免问;切回 A 仍免问;无作用域(空串)自成一集', ()=>{
	setSessionAllowScope('conv-A');
	expect(__getSessionAllowScopeForTests()).toBe('conv-A');
	expect(allowToolForSession('create_chart_record')).toBe(true);
	expect(isToolSessionAllowed('create_chart_record')).toBe(true);
	expect(listSessionAllowed()).toEqual(['create_chart_record']);
	setSessionAllowScope('conv-B');
	expect(isToolSessionAllowed('create_chart_record')).toBe(false);
	expect(listSessionAllowed()).toEqual([]);
	setSessionAllowScope('conv-A');
	expect(isToolSessionAllowed('create_chart_record')).toBe(true);
	setSessionAllowScope('');
	expect(isToolSessionAllowed('create_chart_record')).toBe(false);
	__resetSessionAllowForTests();
	expect(__getSessionAllowScopeForTests()).toBe('');
});
