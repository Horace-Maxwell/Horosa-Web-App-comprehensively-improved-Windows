// React 默认导出必须显式引入:本文件 JSX 在 classic runtime(jest/umi-test)下编译为
// React.createElement,缺省会 ReferenceError(app 的 automatic runtime 侥幸不炸=配置漂移地雷)。
import React, { Component } from 'react';
import { isQuotaError, clearRecoverableCaches } from '../../utils/safeStorage';
import { idbClearByPrefix } from '../../utils/idbCacheStore';

/**
 * 技法面板级 React Error Boundary。
 * 用途:包住单个技法/子页内容,使其内部任何 render 期异常被局部捕获、显示友好回退卡片,
 * 而非冒泡到根导致【整页空白/黑屏】(本仓此前仅 common/ChartCaptureMount 有局部边界,
 * 技法面板无兜底 → 八卦类象等一处 render 抛错即整页空白,且 Mac/JSC 调度更易触发)。
 *
 * - getDerivedStateFromError:进入回退态。
 * - componentDidCatch:console.warn 记录(绝不静默吞),便于定位。
 * - 回退卡片走 var(--horosa-*) 令牌,明暗双主题自适配;「重试」重置边界 + 自增 resetKey 强制子树重挂。
 */
export default class TechniqueErrorBoundary extends Component {
	constructor(props){
		super(props);
		this.state = { hasError: false, err: null, info: null, resetKey: 0 };
		this.handleRetry = this.handleRetry.bind(this);
		this.handleClearCacheRetry = this.handleClearCacheRetry.bind(this);
	}

	static getDerivedStateFromError(err){
		return { hasError: true, err };
	}

	componentDidCatch(err, info){
		// 绝不静默吞:留日志便于定位是哪个技法面板、哪段 render 抛错。
		try{ console.warn('[TechniqueErrorBoundary] caught render error', this.props.label || '', err, info); }catch(e){ /* noop */ }
		// 保存 componentStack 以便回退卡片在「技术详情」中直接展示(打包 app devtools 关闭,
		//   此为唯一可见错误来源:用户截图即可精确定位 app-only/JSC 崩溃)。
		this.setState({ info });
	}

	handleRetry(){
		this.setState({ hasError: false, err: null, info: null });
	}

	// 配额自愈:清全部可再生缓存(localStorage 前缀键+IndexedDB 缓存层)后重挂子树。
	// 缓存是纯派生数据,清了只是重算;用户命盘/设置一律不动。
	handleClearCacheRetry(){
		try{ clearRecoverableCaches(); }catch(e){ /* 尽力而为 */ }
		const done = ()=>this.setState({ hasError: false, err: null, info: null });
		try{
			idbClearByPrefix('horosa.localcalc.').then(done, done);
		}catch(e){
			done();
		}
	}

	// 汇总可读错误文本(消息 + JS 栈 + 组件栈),供「技术详情」展示与「复制」。
	errorDetailText(){
		const err = this.state.err;
		const lines = [];
		try{
			lines.push('面板: ' + (this.props.label || '(未命名)'));
			if(err){
				lines.push('错误: ' + (err.name ? err.name + ': ' : '') + (err.message || String(err)));
				if(err.stack){ lines.push('JS 栈:\n' + String(err.stack)); }
			}else{
				lines.push('错误: (无错误对象)');
			}
			const info = this.state.info;
			if(info && info.componentStack){ lines.push('组件栈:' + String(info.componentStack)); }
		}catch(e){ /* noop */ }
		return lines.join('\n');
	}

	render(){
		if(this.state.hasError){
			const label = this.props.label ? `「${this.props.label}」` : '';
			const quota = isQuotaError(this.state.err);
			return (
				<div
					style={{
						margin: 16,
						padding: '20px 22px',
						borderRadius: 10,
						border: '1px solid var(--horosa-border, rgba(255,255,255,0.12))',
						background: 'var(--horosa-surface-raised, rgba(255,255,255,0.04))',
						color: 'var(--horosa-text, #d0d3da)',
						maxWidth: 520,
					}}
				>
					<div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
						该面板{label}加载出错
					</div>
					<div style={{ fontSize: 13, color: 'var(--horosa-text-soft, #8a8f99)', marginBottom: 12, lineHeight: 1.6 }}>
						{quota
							? '本地缓存空间已满(浏览器存储配额用尽)。点击下方「一键清理缓存并恢复」即可释放空间并自动恢复——只清理可重新计算的缓存,您储存的命盘与设置不受影响。'
							: '页面其它部分不受影响。可点「重试」重新加载本面板;若反复出现请重选参数或重新起盘。'}
					</div>
					{this.state.err ? (
						<div style={{ marginBottom: 12 }}>
							<div style={{ fontSize: 12.5, color: 'var(--horosa-danger, #e36868)', wordBreak: 'break-word', userSelect: 'text', lineHeight: 1.55, marginBottom: 8 }}>
								{(this.state.err.name ? this.state.err.name + ': ' : '') + (this.state.err.message || String(this.state.err))}
							</div>
							<details style={{ fontSize: 11.5, color: 'var(--horosa-text-soft, #8a8f99)' }}>
								<summary style={{ cursor: 'pointer', outline: 'none' }}>技术详情(反复出错时请截此图发开发者)</summary>
								<pre style={{
									whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text',
									maxHeight: 220, overflow: 'auto', marginTop: 8, padding: '8px 10px',
									borderRadius: 6, fontSize: 11, lineHeight: 1.5,
									background: 'var(--horosa-bg-soft, rgba(0,0,0,0.18))',
									border: '1px solid var(--horosa-border, rgba(255,255,255,0.1))',
								}}>{this.errorDetailText()}</pre>
							</details>
						</div>
					) : null}
					<button
						type="button"
						onClick={quota ? this.handleClearCacheRetry : this.handleRetry}
						style={{
							cursor: 'pointer',
							padding: '5px 16px',
							borderRadius: 6,
							border: '1px solid var(--horosa-accent, #5b8def)',
							background: 'transparent',
							color: 'var(--horosa-accent, #5b8def)',
							fontSize: 13,
						}}
					>
						{quota ? '一键清理缓存并恢复' : '重试'}
					</button>
				</div>
			);
		}
		// 回退→children 本身即一次全新挂载(上一帧渲染的是回退卡片而非 children),无需 wrapper div,避免影响布局。
		return this.props.children;
	}
}
