// [奇门择日 T5] DunJiaMain scope 化源码契约锁(fs+regex,照 helpDocsGuard 范式)。
// keep-alive(FreezeInactive)下独立奇门页与择日页两实例并存,竞写面(live 态单例/AI 快照槽/
// window 全局兜底/案例链/导出刷新事件)必须全部走 this.scope —— 谁回潮硬编码 'qimen' 谁红。
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.resolve(__dirname, '../DunJiaMain.js'), 'utf8');

describe('DunJiaMain scope 化契约', ()=>{
	test('techniqueScope 默认值在位(默认行为=独立奇门页,字节等价)', ()=>{
		expect(src).toContain(`this.scope = props.techniqueScope || 'qimen';`);
	});
	test('AI 快照槽零硬编码:save/loadModuleAISnapshot 一律走 this.scope', ()=>{
		expect((src.match(/saveModuleAISnapshot\('qimen'/g) || []).length).toBe(0);
		expect((src.match(/loadModuleAISnapshot\('qimen'\)/g) || []).length).toBe(0);
		expect((src.match(/saveModuleAISnapshot\(this\.scope/g) || []).length).toBeGreaterThanOrEqual(5);
		expect(src).toContain('loadModuleAISnapshot(this.scope)');
	});
	test('window 全局快照/相关人员兜底槽只属 scope=qimen(择日实例不竞写)', ()=>{
		expect(src).toContain(`(scope === undefined || scope === 'qimen')`);
		expect(src).toContain(`this.scope === 'qimen'`);
	});
	test('live 态按 scope 键控 map,单例变量已废;remember/getRestorable 全带 scope', ()=>{
		expect(src).toContain('dunJiaLiveStateByScope');
		expect((src.match(/lastDunJiaLiveState/g) || []).length).toBe(0);
		expect((src.match(/rememberDunJiaLiveState\(this\.scope, \{/g) || []).length).toBe(2);
		expect(src).toContain('getRestorableDunJiaLiveState(this.scope, props.fields)');
	});
	test('快照产出单入口 this.saveLiveSnapshot(类内禁裸调模块函数)', ()=>{
		expect((src.match(/this\.saveLiveSnapshot\(/g) || []).length).toBeGreaterThanOrEqual(5);
		// 模块函数仅在单入口方法体内被引用一次
		expect((src.match(/saveQimenLiveSnapshot\(pan, this\.scope, this\.props\.composeAiSnapshot\)/g) || []).length).toBe(1);
		expect((src.match(/saveQimenLiveSnapshot\(pan\)/g) || []).length).toBe(0);
		expect((src.match(/saveQimenLiveSnapshot\(this\.state\.pan\)/g) || []).length).toBe(0);
	});
	test('案例链按 scope:caseType/sourceModule/module/事件前缀/还原过滤/附加负载', ()=>{
		expect(src).toContain('caseType: this.scope');
		expect(src).toContain('sourceModule: this.scope');
		expect(src).toContain('module: this.scope');
		expect(src).toContain(`this.props.caseEventPrefix || '奇门占断'`);
		expect(src).toContain('sourceModule !== this.scope && caseType !== this.scope');
		expect(src).toContain('this.props.casePayloadExtra');
	});
	test('导出刷新事件按 scope 应答', ()=>{
		expect(src).toContain('moduleName !== this.scope');
	});
	test('renderQuickDock 早退与左栏插槽在位', ()=>{
		expect(src).toContain('this.props.showQuickDock === false');
		expect(src).toContain('this.props.renderLeftExtra');
	});
	test('外挂 API 与参数镜像在位:getScanContext/applyExternalPlot/onOptionsChange×3', ()=>{
		expect(src).toContain('getScanContext()');
		expect(src).toContain('applyExternalPlot(patch)');
		expect((src.match(/this\.props\.onOptionsChange/g) || []).length).toBeGreaterThanOrEqual(3);
	});
	test('注错自证:契约对硬编码敏感(往样本里注一处 saveModuleAISnapshot(qimen) 即超零计数)', ()=>{
		const poisoned = `${src}\nsaveModuleAISnapshot('qimen', 'x');`;
		expect((poisoned.match(/saveModuleAISnapshot\('qimen'/g) || []).length).toBeGreaterThan(0);
	});
});
