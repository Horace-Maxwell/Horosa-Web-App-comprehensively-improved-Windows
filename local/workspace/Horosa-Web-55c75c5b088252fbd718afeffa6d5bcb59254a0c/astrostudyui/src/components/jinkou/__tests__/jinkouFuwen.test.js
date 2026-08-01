/**
 * 金口诀 Batch 5：经典赋文数据完整性与红线（纯展示数据，锁结构与措辞，不锁字数）。
 */
import { JINKOU_FUWEN, JINKOU_FUWEN_NOTE, getJinKouFuwen } from '../JinKouFuwen';

describe('赋文数据结构', ()=>{
	it('每篇字段齐备：key/title/volume/use/lines 且 lines 非空', ()=>{
		expect(JINKOU_FUWEN.length).toBeGreaterThanOrEqual(16);
		JINKOU_FUWEN.forEach((p)=>{
			expect(typeof p.key).toBe('string');
			expect(p.key.length).toBeGreaterThan(0);
			expect(p.title.length).toBeGreaterThan(0);
			expect(p.volume).toMatch(/^卷之(上|中|下)$/);
			expect(p.use.length).toBeGreaterThan(0);
			expect(Array.isArray(p.lines)).toBe(true);
			expect(p.lines.length).toBeGreaterThan(0);
			p.lines.forEach((ln)=>{
				expect(typeof ln).toBe('string');
				expect(ln.trim()).toBe(ln);
				expect(ln.length).toBeGreaterThan(0);
			});
		});
	});

	it('key 全局唯一（右栏折叠态以 key 为索引，重复即互相顶掉）', ()=>{
		const keys = JINKOU_FUWEN.map((p)=>p.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('title 全局唯一（折叠面板按篇名给用户看，重名无法分辨）', ()=>{
		const titles = JINKOU_FUWEN.map((p)=>p.title);
		expect(new Set(titles).size).toBe(titles.length);
	});

	it('按 key 取篇；未知 key 返回 null 不抛', ()=>{
		expect(getJinKouFuwen('rushi').title).toBe('入式歌解');
		expect(getJinKouFuwen('nope')).toBeNull();
		expect(getJinKouFuwen('')).toBeNull();
		expect(getJinKouFuwen(undefined)).toBeNull();
	});
});

describe('来源措辞红线（公开技法：只说古籍，界面零 §、零私传出处）', ()=>{
	// 原文行是古籍转录，用词由底本决定（如「阴私传送走西东」内含「私传」二字属巧合），
	// 故措辞红线只施于本站自撰文案 = 篇名/功用/转录说明；§ 一项对全文施加（古籍不可能有）。
	const authored = JINKOU_FUWEN.map((p)=>`${p.title}${p.use}`).join('') + JINKOU_FUWEN_NOTE;
	const allText = JINKOU_FUWEN.map((p)=>p.lines.join('')).join('') + authored;

	it('全文无 § 章节号（章节号绝不进显示层）', ()=>{
		expect(allText).not.toMatch(/§/);
	});

	it('自撰文案无「手册」「私传」「秘传」等出处字样', ()=>{
		expect(authored).not.toMatch(/手册/);
		expect(authored).not.toMatch(/私传/);
		expect(authored).not.toMatch(/秘传/);
		expect(authored).not.toMatch(/内部|不外传/);
	});

	it('转录说明明示「古籍原文、未加现代注解、不参与计算」三点', ()=>{
		expect(JINKOU_FUWEN_NOTE).toContain('古籍原文');
		expect(JINKOU_FUWEN_NOTE).toContain('未加现代注解');
		expect(JINKOU_FUWEN_NOTE).toContain('不参与排盘计算');
	});
});

describe('内容锚点（防转录被误改／误删的关键句）', ()=>{
	it('入式歌首句与四位定义在位', ()=>{
		const p = getJinKouFuwen('rushi');
		expect(p.lines[0]).toBe('入式之法妙通玄，月将加时方上传。');
		expect(p.lines.join('')).toContain('凡课有四位：一地分，二月将，三贵神，四人元。');
	});

	it('应期合德五法齐全（其一至其五）', ()=>{
		const p = getJinKouFuwen('yingqi');
		const txt = p.lines.join('');
		['其一', '其二', '其三', '其四', '其五'].forEach((k)=>{ expect(txt).toContain(k); });
		expect(txt).toContain('六合者，子与丑合，寅与亥合，卯与戌合，辰与酉合，巳与申合，午与未合。');
	});

	it('十二将神所主歌覆盖十二将名', ()=>{
		const txt = getJinKouFuwen('jiangshen').lines.join('');
		['功曹', '太冲', '天罡', '太乙', '胜光', '小吉', '传送', '从魁', '河魁', '登明', '神后', '大吉'].forEach((n)=>{
			expect(txt).toContain(n);
		});
	});

	it('十二贵神所主歌两首各覆盖十二天将', ()=>{
		['guishen', 'guishen2'].forEach((k)=>{
			const txt = getJinKouFuwen(k).lines.join('');
			['天乙', '腾蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'].forEach((n)=>{
				expect(txt).toContain(n);
			});
		});
	});

	it('四位杂断歌以四位互克互生逐条立说', ()=>{
		const txt = getJinKouFuwen('siweizaduan').lines.join('');
		expect(txt).toContain('乾克贵人人谋己，贵人克干己谋人。');
		expect(txt).toContain('四位相生百事吉，若逢刑克事还凶。');
	});
});
