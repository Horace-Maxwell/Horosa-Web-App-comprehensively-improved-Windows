// 字符串口径的日期 / 时刻字段(择日工作台、病始日期、七政流时、定时任务)走全站时间组件:
//   ① 字符串 ↔ 时间对象往返不丢位;② 源码里不再出现系统原生日期框(只剩纯「时:分」的两处)。
import fs from 'fs';
import path from 'path';
import { isoPartsOf, dateTimeFromIso } from '../IsoDateTimeField';

const SRC = path.resolve(__dirname, '..', '..', '..');

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== '.umi' && e.name !== '.umi-production'){ walk(p, out); } }
		else if(/\.js$/.test(e.name)){ out.push(p); }
	});
	return out;
}

describe('IsoDateTimeField', ()=>{
	test('字符串 → 时间对象 → 字符串 往返一致(补零)', ()=>{
		const dt = dateTimeFromIso('2026-3-7', '9:05');
		expect(isoPartsOf(dt)).toEqual({ date: '2026-03-07', time: '09:05' });
		expect(isoPartsOf(dateTimeFromIso('1999-12-31', '23:59'))).toEqual({ date: '1999-12-31', time: '23:59' });
		expect(isoPartsOf(dateTimeFromIso('-0300-03-10', '12:00'))).toEqual({ date: '-0300-03-10', time: '12:00' });   // 公元前不折叠成公元
	});
	test('只有时刻:日期取今天、时刻照填;都空:不报错', ()=>{
		const p = isoPartsOf(dateTimeFromIso('', '07:30'));
		expect(p.time).toBe('07:30');
		expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(()=>dateTimeFromIso(undefined, undefined)).not.toThrow();
	});
	test('源码里不再有系统原生的日期 / 日期时刻框', ()=>{
		const hits = [];
		walk(path.join(SRC, 'components'), []).concat(walk(path.join(SRC, 'pages'), [])).forEach((f)=>{
			const s = fs.readFileSync(f, 'utf8');
			const re = /type=["'{]+(date|datetime-local|month)["'}]/g;
			let m;
			while((m = re.exec(s))){ hits.push(`${path.relative(SRC, f)}:${m[1]}`); }
		});
		expect(hits).toEqual([]);
	});
});
