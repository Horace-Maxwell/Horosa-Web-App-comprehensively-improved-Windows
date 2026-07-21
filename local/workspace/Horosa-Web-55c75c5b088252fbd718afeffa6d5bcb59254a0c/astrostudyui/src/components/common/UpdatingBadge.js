// UpdatingBadge —— keep-stale 轻量「更新中…」角标(极速化大修 WP-C,自印占范式抽出)。
//
// 用法:后台重取中且有旧盘可显时,盘容器(须 position:relative/absolute 上下文)角落显示;
// 非阻塞、不盖盘、不挡操作(pointerEvents:none)。替代满屏 Spin 压暗。
// 首次加载(无旧盘)不用它 —— 走各盘自身的占位。
// 样式:CSS 变量双主题自适配,与印占 IndiaChartMain 的角标逐像素同款(单一来源,勿再各抄一份)。
import React from 'react';

export default function UpdatingBadge({ text }){
	return (
		<div style={{
			position: 'absolute', top: 10, right: 14, zIndex: 6,
			fontSize: 11.5, lineHeight: '18px',
			color: 'var(--horosa-text-muted, rgba(180,184,196,0.92))',
			background: 'var(--horosa-panel-soft, rgba(20,22,28,0.72))',
			border: '1px solid var(--horosa-border, rgba(255,255,255,0.12))',
			padding: '2px 10px', borderRadius: 11, pointerEvents: 'none',
			WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)',
		}}>{text || '更新中…'}</div>
	);
}
