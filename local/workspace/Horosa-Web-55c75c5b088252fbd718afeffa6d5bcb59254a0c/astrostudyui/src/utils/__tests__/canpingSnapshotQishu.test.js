// [Q-438/T-401] 邵子参评数快照:右栏「四柱」「起数」卡(四柱 / 顺数·逆数·子上轮)进 [起盘]/[本命] 段。
import { calculate, buildSnapshotText } from '../canpingLocal';

const BASE = { yearGz: '庚午', monthBranch: '卯', dayBranch: '卯', hourBranch: '午', gender: '男', method: 'ming', qiyunAge: 1, lunarMonth: 2, lunarDay: 19 };

describe('参评数快照 · 四柱与起数三值', () => {
	it('[起盘] 含四柱行,[本命] 首行含顺数/逆数/子上轮,值与 result 同源', () => {
		const r = calculate(BASE);
		const t = buildSnapshotText(r);
		expect(t).toContain(`四柱：年柱${r.fourPillars.yearGz}　月支${r.fourPillars.monthBranch}　日支${r.fourPillars.dayBranch}　时支${r.fourPillars.hourBranch}`);
		expect(t).toContain(`起数：顺数 ${r.benming.shun}　逆数 ${r.benming.ni}　子上轮 ${r.benming.ziRound}`);
		const benming = t.slice(t.indexOf('[本命]'), t.indexOf('[大运·歲運]'));
		expect(benming.split('\n')[1]).toMatch(/^起数：/);
		expect(benming).toContain(`顺 ${r.benming.verses.numShun}：`);
	});
	it('取法 gu/ming 起数三值可不同 → 快照行随之(取法齿轮对正文生效)', () => {
		const a = buildSnapshotText(calculate({ ...BASE, method: 'gu' }));
		const b = buildSnapshotText(calculate({ ...BASE, method: 'ming' }));
		expect(a).not.toBe(b);
		expect(a).toMatch(/起数：顺数 \d+　逆数 \d+　子上轮 \d+/);
	});
});
