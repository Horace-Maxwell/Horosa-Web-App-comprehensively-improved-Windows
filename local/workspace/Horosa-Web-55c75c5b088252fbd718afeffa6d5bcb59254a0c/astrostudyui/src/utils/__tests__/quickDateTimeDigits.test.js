// 快捷数字时间录入·解析单源真值表(用户定版三例 + 补零/截断/越界/闰年/纪元/时区)
import DateTime from '../../components/comp/DateTime';
import { parseQuickDigitsForFormat, pickerFormatTokens, pickerDigitsLength, normalizeQuickDigits, parseQuickDateTimeDigits, applyQuickDigits, formatQuickDigits, QUICK_DIGITS_LEN } from '../quickDateTimeDigits';

const fmt = (dt)=>dt.format('YYYY-MM-DD HH:mm:ss');
const base = (zone = '+08:00', ad = 1)=>{ const d = new DateTime({ ad, zone, year: 1990, month: 5, date: 18, hour: 10, minute: 0, second: 0 }); d.calcJdn(); return d; };

describe('parseQuickDateTimeDigits / applyQuickDigits', ()=>{
	it('用户三例:满 14 位 / 不足补 0 / 多余丢弃', ()=>{
		expect(fmt(applyQuickDigits(base(), '20061004095801').dt)).toBe('2006-10-04 09:58:01');
		expect(fmt(applyQuickDigits(base(), '200610040958').dt)).toBe('2006-10-04 09:58:00');
		const r = applyQuickDigits(base(), '200610040958010101');
		expect(fmt(r.dt)).toBe('2006-10-04 09:58:01');
		expect(r.truncated).toBe(true);
		expect(QUICK_DIGITS_LEN).toBe(14);
	});
	it('短输入逐级补 0:月日 00 按 01', ()=>{
		expect(fmt(applyQuickDigits(base(), '2006').dt)).toBe('2006-01-01 00:00:00');
		expect(fmt(applyQuickDigits(base(), '200610').dt)).toBe('2006-10-01 00:00:00');
		expect(fmt(applyQuickDigits(base(), '20061004').dt)).toBe('2006-10-04 00:00:00');
		expect(fmt(applyQuickDigits(base(), '2006100409').dt)).toBe('2006-10-04 09:00:00');
	});
	it('粘贴带分隔符 / 全角数字 / 空白都能解析', ()=>{
		expect(fmt(applyQuickDigits(base(), '2006-10-04 09:58:01').dt)).toBe('2006-10-04 09:58:01');
		expect(fmt(applyQuickDigits(base(), '２００６１００４０９５８０１').dt)).toBe('2006-10-04 09:58:01');
		expect(normalizeQuickDigits(' 2006/10/04 ').digits).toBe('20061004');
	});
	it('空/非数字 = empty(静默取消)', ()=>{
		['', null, undefined, 'abc', '   '].forEach((v)=>{
			const r = applyQuickDigits(base(), v);
			expect(r.ok).toBe(false); expect(r.errorCode).toBe('empty'); expect(r.dt).toBe(null);
		});
	});
	it('越界拒绝且错误码/文案分明', ()=>{
		expect(parseQuickDateTimeDigits('00001004095801').errorCode).toBe('year');
		expect(parseQuickDateTimeDigits('20061304').errorCode).toBe('month');
		expect(parseQuickDateTimeDigits('20061304').error).toContain('月份');
		expect(parseQuickDateTimeDigits('20060231').errorCode).toBe('day');
		expect(parseQuickDateTimeDigits('19000229').errorCode).toBe('day');
		expect(parseQuickDateTimeDigits('21000229').errorCode).toBe('day');
		expect(parseQuickDateTimeDigits('20061004245801').errorCode).toBe('hour');
		expect(parseQuickDateTimeDigits('20061004096001').errorCode).toBe('minute');
		expect(parseQuickDateTimeDigits('20061004095860').errorCode).toBe('second');
		const bad = applyQuickDigits(base(), '20061304');
		expect(bad.ok).toBe(false); expect(bad.dt).toBe(null); expect(bad.error.startsWith('快捷时间无效：')).toBe(true);
	});
	it('闰年:格里高利 / 400 年规则 / 1582 前儒略', ()=>{
		expect(parseQuickDateTimeDigits('20040229').ok).toBe(true);
		expect(parseQuickDateTimeDigits('20000229').ok).toBe(true);
		expect(parseQuickDateTimeDigits('15000229').ok).toBe(true);
	});
	it('纪元强制公元;时区沿用基值;jdn 与 parse+setZone 一致', ()=>{
		const r = applyQuickDigits(base('-05:00', -1), '20061004095801');
		expect(r.dt.ad).toBe(1);
		expect(r.dt.zone).toBe('-05:00');
		const ref = new DateTime().parse('2006-10-04 09:58:01', 'YYYY-MM-DD HH:mm:ss'); ref.setZone('-05:00');
		expect(r.dt.jdn).toBeCloseTo(ref.jdn, 9);
		expect(r.dt).not.toBe(r.dt === undefined);
	});
	it('基值为空:用 zone 选项或缺省时区', ()=>{
		expect(applyQuickDigits(null, '20061004095801', { zone: '+09:00' }).dt.zone).toBe('+09:00');
		expect(applyQuickDigits(null, '20061004095801').dt.zone).toBe('+08:00');
		expect(applyQuickDigits(undefined, '20061004095801').dt.year).toBe(2006);
	});
	it('基值不被就地修改(新实例)', ()=>{
		const b = base();
		const before = fmt(b);
		const r = applyQuickDigits(b, '20061004095801');
		expect(r.dt).not.toBe(b);
		expect(fmt(b)).toBe(before);
	});
	it('formatQuickDigits:公元且年 ≤ 9999 回 14 位;公元前/超界回 null', ()=>{
		expect(formatQuickDigits(applyQuickDigits(base(), '20061004095801').dt)).toBe('20061004095801');
		expect(formatQuickDigits(applyQuickDigits(base(), '09990101').dt)).toBe('09990101000000');
		expect(formatQuickDigits(base('+08:00', -1))).toBe(null);
		expect(formatQuickDigits(null)).toBe(null);
	});
	it('模糊:任意 14 位数字串永不抛', ()=>{
		let seed = 20260907;
		const rnd = ()=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed; };
		for(let i = 0; i < 200; i++){
			let s = ''; for(let k = 0; k < 14; k++){ s += `${rnd() % 10}`; }
			expect(()=>applyQuickDigits(base(), s)).not.toThrow();
			const r = applyQuickDigits(base(), s);
			expect(typeof r.ok).toBe('boolean');
			if(r.ok){ expect(r.dt.year).toBeGreaterThanOrEqual(1); }
		}
	});
});

describe('parseQuickDigitsForFormat(选择框按 format 切)', ()=>{
	it('记号识别与总位数', ()=>{
		expect(pickerFormatTokens('YYYY-MM-DD HH:mm')).toEqual(['YYYY', 'MM', 'DD', 'HH', 'mm']);
		expect(pickerDigitsLength('YYYY-MM-DD')).toBe(8);
		expect(pickerDigitsLength('HH:mm:ss')).toBe(6);
		expect(pickerDigitsLength(['YYYY/MM/DD', 'YYYY-MM-DD'])).toBe(8);
		expect(pickerDigitsLength('wo')).toBe(0);
		expect(parseQuickDigitsForFormat('2006', 'wo').errorCode).toBe('format');
	});
	it('日期型:补位/丢弃/月日 00→01', ()=>{
		const r = parseQuickDigitsForFormat('20061004', 'YYYY-MM-DD');
		expect(r.ok).toBe(true); expect(r.parts).toEqual({ year: 2006, month: 10, day: 4, hour: 0, minute: 0, second: 0 });
		expect(parseQuickDigitsForFormat('2006', 'YYYY-MM-DD').parts).toMatchObject({ year: 2006, month: 1, day: 1 });
		expect(parseQuickDigitsForFormat('200600', 'YYYY-MM-DD').parts).toMatchObject({ year: 2006, month: 1, day: 1 });
		const t = parseQuickDigitsForFormat('2006100409580199', 'YYYY-MM-DD HH:mm');
		expect(t.ok).toBe(true); expect(t.truncated).toBe(true); expect(t.parts).toMatchObject({ hour: 9, minute: 58, second: 0 });
		expect(parseQuickDigitsForFormat('２００６-10-04', 'YYYY-MM-DD').parts).toMatchObject({ year: 2006, month: 10, day: 4 });
	});
	it('时间型:无日期记号只切时分秒;年月型', ()=>{
		expect(parseQuickDigitsForFormat('0958', 'HH:mm:ss').parts).toEqual({ year: null, month: null, day: null, hour: 9, minute: 58, second: 0 });
		expect(parseQuickDigitsForFormat('2460', 'HH:mm').errorCode).toBe('hour');
		expect(parseQuickDigitsForFormat('200613', 'YYYY-MM').errorCode).toBe('month');
		expect(parseQuickDigitsForFormat('200612', 'YYYY-MM').parts).toMatchObject({ year: 2006, month: 12, day: 1 });
	});
	it('格里高利闰规则(选择框值是 moment):1900-02-29 拒、2000-02-29 收、1500-02-29 拒(与 DateTime 儒略切换无关)', ()=>{
		expect(parseQuickDigitsForFormat('19000229', 'YYYY-MM-DD').errorCode).toBe('day');
		expect(parseQuickDigitsForFormat('20000229', 'YYYY-MM-DD').ok).toBe(true);
		expect(parseQuickDigitsForFormat('15000229', 'YYYY-MM-DD').errorCode).toBe('day');
		expect(parseQuickDigitsForFormat('00000101', 'YYYY-MM-DD').errorCode).toBe('year');
		expect(parseQuickDigitsForFormat('', 'YYYY-MM-DD').errorCode).toBe('empty');
	});
});
