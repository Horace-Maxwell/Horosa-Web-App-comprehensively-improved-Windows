import DateTimeSelector from '../DateTimeSelector';

// 🔴 输入不被截半金标:年份是半受控草稿(yearDraft,仅失焦/回车 flush)。用户输入年份后未失焦
// 直接点「确定」时,旧 clickOk 直接读 this.datetime(旧年)→ 年份截半退回旧年(如输 16798/12026
// 变 6798/2026,真机极端年输入失败)。修:clickOk 先把 yearDraft 同步落到 this.datetime 再提交。
function makeInst(datetimeYear, yearDraft) {
	let received = null;
	const inst = new DateTimeSelector({ onChange: (res) => { received = res; } });
	inst.setState = (patch) => { inst.state = { ...inst.state, ...patch }; };
	inst.state = { ...inst.state, yearDraft };
	inst.datetime.setYear(datetimeYear);
	return { inst, get: () => received };
}

describe('DateTimeSelector.clickOk · 输入不截半(先 flush yearDraft)', () => {
	test('🔴 有待提交年份草稿(5 位年)未失焦点确定 → 落全年 16798(非截半 6798/旧年)', () => {
		const { inst, get } = makeInst(2026, 16798);
		inst.clickOk();
		const res = get();
		expect(res).toBeTruthy();
		expect(res.value.year).toBe(16798); // 草稿被 flush,非旧 datetime 的 2026
		expect(inst.state.yearDraft).toBe(null); // 草稿已清
	});

	test('🔴 极端 BC 年草稿(12026)未失焦点确定 → 落 12026', () => {
		const { inst, get } = makeInst(2026, 12026);
		inst.clickOk();
		expect(get().value.year).toBe(12026);
	});

	test('无草稿(yearDraft=null):clickOk 用当前 datetime,零回归', () => {
		const { inst, get } = makeInst(2026, null);
		inst.clickOk();
		expect(get().value.year).toBe(2026);
	});

	test('草稿=当前年(无变化):不误动、正常提交', () => {
		const { inst, get } = makeInst(2026, 2026);
		inst.clickOk();
		expect(get().value.year).toBe(2026);
	});

	test('非法草稿(空/0/负/非数):忽略草稿、用当前 datetime,绝不抛', () => {
		['', 0, -5, 'abc'].forEach((bad) => {
			const { inst, get } = makeInst(2026, bad);
			expect(() => inst.clickOk()).not.toThrow();
			expect(get().value.year).toBe(2026);
		});
	});
});
