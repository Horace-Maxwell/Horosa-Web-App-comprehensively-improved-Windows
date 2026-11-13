import React from 'react';
import { XQStageEmpty } from '../xq-ui';

// 合盘各盘面子页「还没排盘」时的中栏空态:一句话落在盘位正中(亮暗同款,纯文字无图标)。
// 外框给定高 + flex,XQStageEmpty 靠自身 margin:auto 上下左右居中,不依赖页签面板的对齐方式。
export default function RelativeStageEmpty({ height, children }){
	return (
		<div className="horosa-relative-stage-empty" style={{ height: height, minHeight: 160, display: 'flex' }}>
			<XQStageEmpty>{children}</XQStageEmpty>
		</div>
	);
}
