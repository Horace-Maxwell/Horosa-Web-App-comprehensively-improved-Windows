// 发送前「需要先挂载案例」拦截的判定单源:行动能力开启时不得拦(AI 自己会用工具找记录)。
import { needsMountBeforeSend, referencesSpecificCase } from '../aiAnalysisStarterPrompts';

describe('needsMountBeforeSend(未挂载 × 具体命主 × 行动能力)', () => {
	const specific = '给这张盘看看今年财运';
	it('指向具体命主 + 没挂载 + 行动能力关 → 拦', () => {
		expect(referencesSpecificCase(specific)).toBe(true);
		expect(needsMountBeforeSend({ text: specific, activeSource: null, extraSystemContext: '', agentEnabled: false })).toBe(true);
	});
	it('行动能力开 → 不拦(模型自己 list_records / cast_technique)', () => {
		expect(needsMountBeforeSend({ text: specific, activeSource: null, extraSystemContext: '', agentEnabled: true })).toBe(false);
	});
	it('已挂载 / 软件类上下文 / 泛问 / 空串 → 不拦', () => {
		expect(needsMountBeforeSend({ text: specific, activeSource: { id: 's1' }, extraSystemContext: '', agentEnabled: false })).toBe(false);
		expect(needsMountBeforeSend({ text: specific, activeSource: null, extraSystemContext: '帮助文档', agentEnabled: false })).toBe(false);
		expect(needsMountBeforeSend({ text: '紫微十二宫分别代表什么', activeSource: null, extraSystemContext: '', agentEnabled: false })).toBe(false);
		expect(needsMountBeforeSend({ text: '   ', activeSource: null, extraSystemContext: '', agentEnabled: false })).toBe(false);
	});
});
