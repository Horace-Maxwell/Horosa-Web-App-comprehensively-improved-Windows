// [择日宿主] 左栏入口板块(七宿主共用;照天星「征象搜索」板块同形制)。
// 🔴 左栏铁律(用户明令):永不放长段文字——只留入口按钮;说明在帮助分册,
// 当前起盘时刻由各技法盘面自显,本命/参数状态在工作台内看。
import { XQButton, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';

// [挂载自检 F-36] onSave 有值才渲染「存为事盘」(黄历/八字/紫微/七政/印度五宿主此前无存档钮 → 择日事盘类型恒无实例)。
export default function ZeriHostEntry({ label, onOpen, onSave, saveLabel }){
	return (
		<XQSideSection iconName={sideSectionIcon('search')} title={label} collapsible={false}>
			<div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
				<XQButton type="primary" style={{ width: '100%' }} onClick={onOpen}>
					{label}…
				</XQButton>
				{typeof onSave === 'function' ? (
					<XQButton style={{ width: '100%' }} onClick={onSave} data-zeri-save="1">
						{saveLabel || '存为事盘'}
					</XQButton>
				) : null}
			</div>
		</XQSideSection>
	);
}
