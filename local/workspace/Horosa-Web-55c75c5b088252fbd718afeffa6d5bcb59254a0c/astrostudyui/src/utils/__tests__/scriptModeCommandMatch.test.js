// 界面简繁 · 斜杠命令 / @引用:界面繁体时照屏幕输入繁体也认得出(真转换器 + 真归一键)。
import * as hantConv from '../scriptConvert/hantConverter';
import { applyScriptMode, SCRIPT_HANT, __resetScriptModeForTest, __setConverterForTest } from '../scriptMode';
import { BUILTIN_COMMANDS, findCommand, listCommandItems, resolveZeriSubTab, listCommandArgItems } from '../aiChat/commands';
import { filterMentionCandidatesDetailed } from '../aiChat/mentions';

beforeEach(async () => {
	__resetScriptModeForTest();
	__setConverterForTest(hantConv.toHant, hantConv.toMatchKey, hantConv);
	document.body.innerHTML = '';
});
afterAll(() => { __resetScriptModeForTest(); });
const { toHant } = hantConv;

describe('斜杠命令', () => {
	it('简体模式:繁体写法认不出(与原先一致,比对逐字节等价)', () => {
		expect(findCommand('擇日')).toBeNull();
		expect(findCommand('择日').name).toBe('择日');
	});

	it('繁体模式:每个命令名 / 别名的繁体写法都认得出,简体照旧', async () => {
		await applyScriptMode(SCRIPT_HANT);
		const bad = [];
		BUILTIN_COMMANDS.forEach((cmd)=>{
			[cmd.name].concat(cmd.aliases || []).forEach((n)=>{
				const f1 = findCommand(toHant(n));
				const f2 = findCommand(n);
				if(!f1 || f1.name !== cmd.name || !f2 || f2.name !== cmd.name){ bad.push(n); }
			});
		});
		expect(bad).toEqual([]);
		expect(listCommandItems({ prefix: '編' }).map((it)=>it.name)).toContain('编排');
		expect(resolveZeriSubTab('奇門')).toBe('qimenzeri');
		const zeri = BUILTIN_COMMANDS.find((c)=>c.name === '择日');
		expect(listCommandArgItems({ cmd: zeri, argsText: '紫微斗數' }).items.map((it)=>it.value)).toContain('紫微');
	});
});

describe('@引用候选', () => {
	const items = [
		{ kind: 'source', type: 'chart', name: '张三', label: '张三', group: '命盘' },
		{ kind: 'technique', type: 'technique', name: '奇门遁甲', label: '奇门遁甲', key: 'qimen', group: '技法' },
	];
	it('繁体模式:照屏幕输入繁体能命中', async () => {
		await applyScriptMode(SCRIPT_HANT);
		const got = filterMentionCandidatesDetailed(items, '奇門');
		const list = Array.isArray(got) ? got : (got.items || got.list || []);
		expect(list.map((it)=>it.name)).toContain('奇门遁甲');
		const got2 = filterMentionCandidatesDetailed(items, '張');
		const list2 = Array.isArray(got2) ? got2 : (got2.items || got2.list || []);
		expect(list2.map((it)=>it.name)).toContain('张三');
	});
});
