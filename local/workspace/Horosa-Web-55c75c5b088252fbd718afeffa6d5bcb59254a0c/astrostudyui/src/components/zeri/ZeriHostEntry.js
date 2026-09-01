// [择日宿主] 左栏入口板块(七宿主共用;照天星「征象搜索」板块同形制)。
// 🔴 左栏铁律(用户明令):永不放长段文字——只留入口按钮;说明在帮助分册,
// 当前起盘时刻由各技法盘面自显,本命/参数状态在工作台内看。
import { XQButton, XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons';

export default function ZeriHostEntry({ label, onOpen }){
	return (
		<XQSideSection iconName={sideSectionIcon('search')} title={label} collapsible={false}>
			<div style={{ padding: '4px 0' }}>
				<XQButton type="primary" style={{ width: '100%' }} onClick={onOpen}>
					{label}…
				</XQButton>
			</div>
		</XQSideSection>
	);
}
