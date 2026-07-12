import React from 'react';
import FreezeInactive from '../FreezeInactive';
import TechniqueErrorBoundary from '../../common/TechniqueErrorBoundary';

// 防白屏接线守卫(类实例测法):
// 背景:lazyPreloadable 只给「懒加载」技法包了 TechniqueErrorBoundary(pages/index.js LazyBoundary),
// 直接 import 的高频技法(八字/紫微/占星/七政…)此前无边界 → 单组件 render 崩=整页白屏(生产实告)。
// 修复:FreezeInactive(31 个技法 TabPane 的统一包装点)render 里包既有 TechniqueErrorBoundary。
// 本测试锁死这条接线 + 边界自身的关键行为,防未来重构静默退化回「白屏时代」。

describe('FreezeInactive × TechniqueErrorBoundary 防白屏接线', ()=>{
	it('FreezeInactive.render 必须包 TechniqueErrorBoundary(31 技法页全覆盖锚)', ()=>{
		const child = React.createElement('span', null, 'pane');
		const inst = new FreezeInactive({ active: true, children: child, boundaryName: '八字' });
		const tree = inst.render();
		expect(tree.type).toBe(TechniqueErrorBoundary);
		expect(tree.props.children).toBe(child);
		expect(tree.props.label).toBe('八字');
	});

	it('sCU 冻结语义不受边界包装影响(保持隐藏面板跳渲)', ()=>{
		const inst = new FreezeInactive({ active: false, children: null });
		expect(inst.shouldComponentUpdate({ active: false })).toBe(false);  // 冻结
		expect(inst.shouldComponentUpdate({ active: true })).toBe(true);    // 即将激活
	});

	it('TechniqueErrorBoundary:getDerivedStateFromError 进回退态;handleRetry 复位', ()=>{
		const err = new Error('boom');
		expect(TechniqueErrorBoundary.getDerivedStateFromError(err)).toEqual({ hasError: true, err });
		const inst = new TechniqueErrorBoundary({ children: null, label: '紫微' });
		let st = { hasError: true, err, info: null, resetKey: 0 };
		inst.state = st;
		inst.setState = (next)=>{ st = { ...st, ...next }; inst.state = st; };
		inst.handleRetry();
		expect(inst.state.hasError).toBe(false);
		expect(inst.state.err).toBeNull();
	});

	it('TechniqueErrorBoundary:无错误时透明返回 children;有错误时渲染回退卡绝不返回空', ()=>{
		const child = React.createElement('span', null, 'ok');
		const ok = new TechniqueErrorBoundary({ children: child });
		ok.state = { hasError: false, err: null, info: null, resetKey: 0 };
		expect(ok.render()).toBe(child);

		const bad = new TechniqueErrorBoundary({ children: child, label: '八字' });
		bad.state = { hasError: true, err: new Error('undefined 解引用'), info: null, resetKey: 0 };
		const tree = bad.render();
		expect(tree).toBeTruthy();
		expect(tree).not.toBe(child);   // 渲染的是回退卡,不是崩溃子树
	});
});
