// 星盘右栏「还没有盘」时的空态节点(单源):宿主在 value 为空时用它代替盘面类页签内容,
// 各页签组件自身也在入口对空值兜底(两层都做,前者给提示,后者保证不崩)。
import React from 'react';

export const INSPECTOR_EMPTY_DEFAULT = '尚无星盘:排盘后这里显示';
export const INSPECTOR_EMPTY_RELATIVE = '先在上方选择星盘 A 与星盘 B,再点「排盘」';

export function inspectorEmptyNode(text){
	return (
		<div className="horosa-empty-line horosa-inspector-empty" role="note">
			{text || INSPECTOR_EMPTY_DEFAULT}
		</div>
	);
}
