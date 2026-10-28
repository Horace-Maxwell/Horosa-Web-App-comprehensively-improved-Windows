// 塔罗「锁定复现」:任何种子(数字 / rnd-… / 出生信息串)都能原样锁进手动种子、原样显示、原样复现;
// 手动种子用文本框(此前数字框装不下字符串种子,一碰就改)。
import fs from 'fs';
import path from 'path';
import { resolveSeed } from '../TarotMain';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'TarotMain.js'), 'utf8');

describe('塔罗种子锁定复现', () => {
	test('手动种子原样:字符串种子不被改写(含首尾空格);数字与旧口径同串;空 / 纯空白回落 0', () => {
		expect(resolveSeed('manual', 'rnd-123456')).toBe('rnd-123456');
		expect(resolveSeed('manual', ' rnd-7 ')).toBe(' rnd-7 ');   // 不去首尾空格(锁进来的就是原串)
		expect(resolveSeed('manual', 42)).toBe('42');
		expect(resolveSeed('manual', '42')).toBe('42');
		expect(resolveSeed('manual', null)).toBe('0');
		expect(resolveSeed('manual', '')).toBe('0');
		expect(resolveSeed('manual', '   ')).toBe('0');
	});
	test('锁定复现把上一局种子写进手动种子 → 再抽得到同一种子', () => {
		const TarotMain = require('../TarotMain').default;
		const self = { state: { lastSeed: 'rnd-99887766' }, setState(p){ Object.assign(this.state, p); } };
		TarotMain.prototype.clickReproduce.call(self);
		expect(self.state.seedMode).toBe('manual');
		expect(self.state.manualSeed).toBe('rnd-99887766');
		expect(resolveSeed(self.state.seedMode, self.state.manualSeed)).toBe('rnd-99887766');
	});
	test('出生信息种子里名字以空格开头:锁定后复现出同一种子', () => {
		const fields = { name: { value: ' 张三' }, lat: { value: '31n14' } };
		const birthSeed = resolveSeed('birth', 0, fields);
		expect(birthSeed.charAt(0)).toBe(' ');
		const TarotMain = require('../TarotMain').default;
		const self = { state: { lastSeed: birthSeed }, setState(p){ Object.assign(this.state, p); } };
		TarotMain.prototype.clickReproduce.call(self);
		expect(resolveSeed(self.state.seedMode, self.state.manualSeed, fields)).toBe(birthSeed);
	});
	test('手动种子输入是文本框,不是数字框', () => {
		const at = SRC.indexOf('<label>手动种子</label>');
		expect(at).toBeGreaterThan(0);
		const blk = SRC.slice(at, at + 500);
		expect(blk).toContain('<Input value=');
		expect(blk).not.toContain('<InputNumber');
		expect(SRC).not.toContain('>手动数字<');
	});
});
