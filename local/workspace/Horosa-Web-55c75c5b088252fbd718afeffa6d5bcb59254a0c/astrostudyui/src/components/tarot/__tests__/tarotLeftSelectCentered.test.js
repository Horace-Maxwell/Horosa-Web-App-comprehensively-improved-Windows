// 塔罗左栏下拉框:已选文字 / 占位符 / 搜索输入在箭头左侧的可用宽度里居中;不补左内衬(窄框补了会截字)
const path = require('path');
const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');

const css = readSource(path.resolve(__dirname, '../../../layouts/app.less'));

describe('塔罗左栏下拉框文字居中', () => {
	it('已选文字与占位符居中,且不占用可用宽度', () => {
		const m = css.match(/\.horosa-workspace-shell \.horosa-tarot-col-left \.ant-select-single \.ant-select-selection-item,\s*\.horosa-workspace-shell \.horosa-tarot-col-left \.ant-select-single \.ant-select-selection-placeholder \{([^}]*)\}/);
		expect(m).not.toBeNull();
		expect(m[1]).toMatch(/text-align:\s*center/);
		expect(m[1]).not.toMatch(/padding/);
	});
	it('搜索输入也居中(打字时不跳到左边)', () => {
		expect(css).toMatch(/\.horosa-tarot-col-left \.ant-select-single \.ant-select-selection-search-input \{\s*text-align:\s*center;/);
	});
});
