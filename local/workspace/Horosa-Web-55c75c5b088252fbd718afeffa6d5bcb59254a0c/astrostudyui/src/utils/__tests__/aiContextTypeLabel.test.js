// AI 分析挂载预览「类型」标签显示中文(命盘 / 事盘 / 技法 / 资料 / 模版 / 系统 / 合盘),不露内部值 technique / system / text / json / note。
import fs from 'fs';
import path from 'path';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读

const SRC = readSource(path.join(__dirname, '../../components/aianalysis/AIAnalysisMain.js'));

function loadLabelFn(){
	const at = SRC.indexOf('function getContextTypeLabel(item){');
	expect(at).toBeGreaterThan(0);
	const end = SRC.indexOf('\n}\n', at);
	// eslint-disable-next-line no-new-func
	return new Function(`${SRC.slice(at, end + 2)}; return getContextTypeLabel;`)();
}

describe('挂载预览类型标签', ()=>{
	test('各类挂载层 → 中文类型', ()=>{
		const label = loadLabelFn();
		expect(label({ key: 'system:prompt', type: 'system' })).toBe('系统');
		expect(label({ key: 'technique:bazi', type: 'technique' })).toBe('技法');
		expect(label({ key: 'technique:bazi:partner', type: 'technique' })).toBe('技法');
		expect(label({ key: 'material:m1', type: 'note' })).toBe('资料');
		expect(label({ key: 'material:m2', type: 'pdf' })).toBe('资料');
		expect(label({ key: 'template:t1', type: 'json' })).toBe('模版');
		expect(label({ key: 'template:t2', type: 'text' })).toBe('模版');
		expect(label({ key: 'source', type: '命盘' })).toBe('命盘');
		expect(label({ key: 'source', type: '事盘' })).toBe('事盘');
		expect(label({ key: 'pair:ziwei', type: '合盘' })).toBe('合盘');
	});
	test('标签取显示名,不再直出 item.type;「重算失败」状态在位', ()=>{
		expect(SRC).toContain('<Tag>{getContextTypeLabel(item)}</Tag>');
		expect(SRC).not.toContain('<Tag>{item.type}</Tag>');
		expect(SRC).toContain("error: { text: '重算失败', color: 'volcano' }");
	});
});
