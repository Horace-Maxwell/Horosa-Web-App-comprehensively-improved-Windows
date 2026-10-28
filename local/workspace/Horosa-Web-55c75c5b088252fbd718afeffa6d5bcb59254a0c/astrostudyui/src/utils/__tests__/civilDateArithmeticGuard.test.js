// 全仓护栏:民用日期不许交给 JS Date 做日期算术(月长 / 日差 / 加天 / 取此刻 / 墙钟轴)。
//
// 病理:JS Date 恒按外推格里历 + 天文年拆日期,new Date(年, …) / Date.UTC(年, …) 还把 0–99 年当成 1900–1999。
//   · 真太阳时校正按 Date 加减:1500 等世纪年(儒略闰、格里不闰)的 2 月 29 日滚成 3 月 1 日,1582-10-04 深夜往东跨日直接抛错;
//   · 择日逐时辰 / 逐日步进:1500-02-29 一个时辰都扫不到,1582-10-05 … 10-14 十个不存在的日子被当真日期扫;
//   · 太乙积日 Date.UTC:公元 50 年与 1950 年积数相同;奇门「此刻」new Date(50, …) 落到 1950 年,恒取种子里最晚的节气;
//   · 通书 / 八字流日的月长 new Date(y, m, 0):1500-02 只有 28 天,1582-10 多出 10 个不存在的日子。
// 正确做法:utils/civilCalendar(civilJdnOfYmd / civilYmdOfJdn / civilWallMs / civilPartsFromWallMs / civilMonthDays /
//   civilDaysInMonth / civilLastDayOfMonth)与 utils/dateStrSafe(civilJdnOfDateStr / civilDateStrOfJdn / civilWallMsOfStr /
//   civilDayDiffOfStr / civilInstantMsOfStr)。1582-10-15 以后与 Date 逐位相同。
// 判据(AST):① new Date(年, …) 两个以上实参且年不是数字字面量;② Date.UTC(年, …) 年不是数字字面量;
//   ③ .setFullYear / .setUTCFullYear(年, …) 年不是数字字面量;④ civilShiftMs(parseDateTimeMs(…)) 组合
//   (parseDateTimeMs 对非严格 ISO 写法按本地钟面读,再按 UTC 日取标签 → 东经时区少一天;日期算术走 civilWallMsOfStr);
//   ⑤ Solar.fromYmd* / Lunar.fromYmd* 的年取自 JS Date 的 getFullYear / getUTCFullYear(Date 拆回的是外推格里历标签,
//   lunar-javascript 按民用历解释:1582 以前差 10 天;拆回走 civilYmdOfLocalDate / civilPartsFromWallMs);
//   ⑥ 模板串里用 Date 的 getFullYear / getUTCFullYear 拼日期标签,而这个 Date 不是「此刻」(new Date() / new Date(Date.now() …) /
//   名为 now、today):拿毫秒加减后再按外推格里历拆回 = 1582 以前差 10 天、跨夏令时差一小时
//   (日期往后挪走 dateStrSafe.civilShiftDateTimeStr / civilDateStrOfMs;本地那一天的标签走 civilYmdOfLocalDate)。
// 存量:下面登记的是「此刻 / 现代」语义(年取自此刻、或输入来自只能选现代日期的控件),只许减不许增,每条写明理由。
import fs from 'fs';
import path from 'path';
import * as parser from '@babel/parser';
import traverseDefault from '@babel/traverse';

const traverse = traverseDefault.default || traverseDefault;
const SRC_ROOT = path.join(__dirname, '..', '..');
const PARSE_OPTS = {
	sourceType: 'module',
	plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport'],
	errorRecovery: true,
};
// 单源本身(日期 ⇄ 毫秒的唯一实现;dateTimeParse 只做「时间戳 / 本地时刻」口径;dateStrSafe.civilInstantMsOfStr 是登记过的「真实时刻」组合)
const SINGLE_SOURCES = new Set(['utils/civilCalendar.js', 'utils/dateTimeParse.js', 'utils/dateStrSafe.js']);

export const BASELINE = {
	'utils/aiAgent/tasks/schedule.js': 9,	// 定时任务的下次触发时刻与提示里的日期:年取自此刻(现代机器时刻)
	'utils/aiAgent/tasks/taskKinds.js': 1,	// 「今天 0 点」:年取自此刻
	'utils/autoBackup.js': 3,	// 备份文件名 / 分桶里的时间戳(机器写的现代时刻)
	'utils/aiTools/tools/scheduleTask.js': 1,	// 定时任务下次触发时刻的显示(现代机器时刻)
	'utils/aiExport/output.js': 1,	// 导出时间戳(此刻)
	'components/aianalysis/ScheduledTaskModal.js': 1,	// 定时任务时刻输入框的值(现代机器时刻)
	'components/zeri/zeriTreeOps.js': 1,	// 择日窗口缺省起止(此刻起数天,现代)
	'utils/upcomingReminders.js': 3,	// 今年 / 明年的生日提醒:年取自此刻
};

function walk(dir, acc = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const fp = path.join(dir, e.name);
		if(e.isDirectory()){ if(!/node_modules|\.umi|__tests__/.test(e.name)){ walk(fp, acc); } }
		else if(/\.jsx?$/.test(e.name) && !/\.test\.js$/.test(e.name)){ acc.push(fp); }
	});
	return acc;
}

const NOW_NAME = /^(now|today|nowDate)$/i;
function isNowDateInit(init){
	if(!init || init.type !== 'NewExpression' || init.callee.type !== 'Identifier' || init.callee.name !== 'Date'){ return false; }
	if(init.arguments.length === 0){ return true; }
	const a = init.arguments[0];
	const src = (n)=>n && n.type === 'CallExpression' && isMember(n.callee, 'Date', 'now');
	return init.arguments.length === 1 && (src(a) || (a.type === 'BinaryExpression' && (src(a.left) || src(a.right))));
}
// Date 拆年的接收者是不是「此刻」
function isNowDateExpr(node, scope){
	if(!node){ return false; }
	if(node.type === 'NewExpression'){ return isNowDateInit(node); }
	if(node.type === 'Identifier'){
		if(NOW_NAME.test(node.name)){ return true; }
		const b = scope && scope.getBinding(node.name);
		return !!(b && b.path && b.path.node && b.path.node.type === 'VariableDeclarator' && isNowDateInit(b.path.node.init));
	}
	return false;
}

const isNumLit = (n)=>!!n && (n.type === 'NumericLiteral' || (n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'NumericLiteral'));
const isMember = (n, obj, prop)=>!!n && (n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression') && !n.computed
	&& n.object.type === 'Identifier' && n.object.name === obj && n.property.name === prop;

export function civilDateArithmeticSites(code){
	let ast;
	try{ ast = parser.parse(code, PARSE_OPTS); }
	catch(e){ return []; }
	const out = [];
	const hit = (node, kind)=>out.push({ line: node.loc.start.line, kind, text: code.slice(node.start, node.end).slice(0, 100) });
	traverse(ast, {
		TemplateLiteral(p){
			const bad = p.node.expressions.some((e)=>{
				let found = false;
				const visit = (n)=>{
					if(!n || found || typeof n.type !== 'string'){ return; }
					if(n.type === 'CallExpression' && (n.callee.type === 'MemberExpression' || n.callee.type === 'OptionalMemberExpression') && !n.callee.computed
						&& /^get(UTC)?FullYear$/.test(n.callee.property.name || '') && n.arguments.length === 0 && !isNowDateExpr(n.callee.object, p.scope)){ found = true; return; }
					Object.keys(n).forEach((k)=>{
						if(k === 'loc' || k === 'start' || k === 'end' || /Comments$/.test(k)){ return; }
						const v = n[k];
						if(Array.isArray(v)){ v.forEach(visit); }else if(v && typeof v.type === 'string'){ visit(v); }
					});
				};
				visit(e);
				return found;
			});
			if(bad && p.node.quasis.some((q)=>/^-|-$/.test(q.value.cooked || ''))){ hit(p.node, '`${d.getFullYear()}-…` 拆 Date 拼日期标签'); }
		},
		NewExpression(p){
			const n = p.node;
			if(n.callee.type === 'Identifier' && n.callee.name === 'Date' && n.arguments.length >= 2 && !isNumLit(n.arguments[0])){ hit(n, 'new Date(年, …)'); }
		},
		CallExpression(p){
			const n = p.node;
			const c = n.callee;
			if(isMember(c, 'Date', 'UTC') && n.arguments.length && !isNumLit(n.arguments[0])){ hit(n, 'Date.UTC(年, …)'); return; }
			if((c.type === 'MemberExpression' || c.type === 'OptionalMemberExpression') && !c.computed && c.property
				&& (c.property.name === 'setFullYear' || c.property.name === 'setUTCFullYear') && n.arguments.length && !isNumLit(n.arguments[0])){
				hit(n, `.${c.property.name}(年, …)`);
				return;
			}
			if((c.type === 'MemberExpression' || c.type === 'OptionalMemberExpression') && !c.computed && c.object.type === 'Identifier'
				&& (c.object.name === 'Solar' || c.object.name === 'Lunar') && /^fromYmd/.test(c.property.name || '') && n.arguments[0]
				&& n.arguments[0].type === 'CallExpression' && n.arguments[0].callee.type === 'MemberExpression'
				&& /^get(UTC)?FullYear$/.test(n.arguments[0].callee.property.name || '')){
				hit(n, `${c.object.name}.${c.property.name}(Date 拆回的年, …)`);
				return;
			}
			if(c.type === 'Identifier' && c.name === 'civilShiftMs' && n.arguments[0] && n.arguments[0].type === 'CallExpression'
				&& n.arguments[0].callee.type === 'Identifier' && n.arguments[0].callee.name === 'parseDateTimeMs'){
				hit(n, 'civilShiftMs(parseDateTimeMs(…))');
			}
		},
	});
	return out;
}

describe('民用日期不许交给 JS Date 做日期算术', ()=>{
	const files = walk(SRC_ROOT);

	it('扫描面可信', ()=>{
		expect(files.length).toBeGreaterThan(500);
	});

	it('判据自检:病灶写法必中、正确写法不中', ()=>{
		const n = (code)=>civilDateArithmeticSites(code).length;
		// 旧写法(太乙积日 / 奇门此刻 / 通书月长 / 真太阳时 / 择日墙钟)
		expect(n('const a = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0);')).toBe(1);
		expect(n('const now = new Date(dateParts.year, m - 1, d, h, mi).getTime();')).toBe(1);
		expect(n('const days = new Date(y, m, 0).getDate();')).toBe(1);
		expect(n('const w = new Date(0); w.setUTCFullYear(parts.year, parts.month - 1, parts.day);')).toBe(1);
		expect(n('d.setFullYear(year, month, 0);')).toBe(1);
		expect(n('const ms = civilShiftMs(parseDateTimeMs(s), s);')).toBe(1);
		expect(n('const solar = Solar.fromYmd(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()); Solar.fromYmdHms(a.getUTCFullYear(), 1, 1, 0, 0, 0);')).toBe(2);
		expect(n('const d = new Date(ms + 5); const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; const f = (t)=>{ const x = new Date(t); return `${x.getUTCFullYear()}-${x.getUTCMonth()}`; };')).toBe(2);
		expect(n('const now = new Date(); const a = `${now.getFullYear()}-${now.getMonth()}`; const d = new Date(); const b = `${d.getFullYear()}-1`; const t = new Date(Date.now() + 864e5); const c = `${t.getFullYear()}-2`; const y = `${dt.getFullYear()} 年`;')).toBe(0);
		// 放行
		expect(n('const d = new Date(); const e = new Date(ms); const f = new Date(2026, 0, 1); const u = Date.UTC(1970, 0, 1);')).toBe(0);
		expect(n('const t = civilWallMs(y, m, d, 0, 0, 0); const j = civilJdnOfYmd(y, m, d); Solar.fromYmd(p.year, p.month, p.day);')).toBe(0);
	});

	it('全仓无新增(存量只许减不许增)', ()=>{
		const over = [];
		const seen = {};
		files.forEach((fp)=>{
			const rel = path.relative(SRC_ROOT, fp).split(path.sep).join('/');
			if(SINGLE_SOURCES.has(rel)){ return; }
			const text = fs.readFileSync(fp, 'utf8');
			if(text.indexOf('Date') < 0 && text.indexOf('FullYear') < 0 && text.indexOf('civilShiftMs') < 0){ return; }
			const hits = civilDateArithmeticSites(text);
			if(hits.length){ seen[rel] = hits.length; }
			const allow = BASELINE[rel] || 0;
			if(hits.length > allow){ over.push(`${rel}(允许 ${allow},实有 ${hits.length}):` + hits.map((h)=>`${h.line} ${h.kind} ${h.text}`).join(' | ')); }
		});
		expect(over).toEqual([]);
		// 登记表不留空位:登记的文件若已修干净,从表里删掉(防止日后在同一文件里静默长回来)
		const stale = Object.keys(BASELINE).filter((rel)=>fs.existsSync(path.join(SRC_ROOT, rel)) && (seen[rel] || 0) < BASELINE[rel]);
		expect(stale).toEqual([]);
	});
});
