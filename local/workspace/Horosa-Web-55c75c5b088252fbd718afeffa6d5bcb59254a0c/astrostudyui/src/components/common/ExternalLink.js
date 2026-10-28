import React from 'react';
import { openExternalUrl } from '../../utils/aiAnalysisDesktop';
import { isExternalHttpUrl, resolveHttpUrl } from '../../utils/externalLink';

// 外链统一出口。桌面 webview 不处理新窗口请求:<a target="_blank"> 与 window.open 都被吞,点了没反应;
// 一律交桌面壳在系统浏览器打开(壳只放行 http(s)),网页版由 openExternalUrl 回落 window.open(新标签页,noopener)。
// 只认 http(s) 链接:别的(空 / 相对路径 / javascript: 等)只显示文字、不渲染成可点的链接 —— 点了会把应用页面本身导航走。
// 组件目录里不许再写裸的 target="_blank" 链接(静态守卫 externalLinkGuard.test.js);渲染出来的 HTML 里的外链由 utils/externalLink 的文档级兜底接住。
export { isExternalHttpUrl };

export default function ExternalLink(props){
	const { href, children, onClick, target, rel, ...rest } = props || {};
	const abs = resolveHttpUrl(href);
	if(!abs){
		return <span {...rest}>{children}</span>;
	}
	const handleClick = (evt)=>{
		if(evt && typeof evt.preventDefault === 'function'){ evt.preventDefault(); }
		if(typeof onClick === 'function'){ onClick(evt); }
		openExternalUrl(abs);
	};
	return <a {...rest} href={abs} rel="noopener noreferrer" onClick={handleClick}>{children}</a>;
}
