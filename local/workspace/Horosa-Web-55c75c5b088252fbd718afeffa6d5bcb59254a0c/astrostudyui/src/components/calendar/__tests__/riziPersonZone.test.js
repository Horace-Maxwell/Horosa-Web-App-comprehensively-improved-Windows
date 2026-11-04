// 日子馆当事人八字须随左栏生辰的时区:交节按绝对时刻判,同一钟表时刻在不同时区可落在节气两侧。
// 曾:只传日期与钟表时刻、不传时区 → 一律按东八区算,改时区月柱 / 年柱纹丝不动(死控件且算错)。
// 2024 立春 = 北京时间 02-04 16:27;当地 16:00 在东八区是立春前(癸卯年 · 丑月),在东二区是北京 22:00、立春后(甲辰年 · 寅月)。
jest.mock('../../../utils/moduleAiSnapshot', ()=>({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(), loadModuleAISnapshot: jest.fn(()=>null) }));

const RiziMain = require('../RiziMain').default;
const DateTime = require('../../comp/DateTime').default;

function personAt(zone){
	const date = new DateTime().parse('2024-02-04 16:00:00', 'yyyy-MM-dd HH:mm:ss');
	date.setZone(zone);
	return { id: 'self', role: 'self', name: '', date, gender: 1 };
}

describe('日子馆当事人八字随时区', ()=>{
	test('东八区:立春前 → 癸卯年', ()=>{
		const inst = new RiziMain({});
		const bz = inst.baziOf(personAt('+08:00'));
		expect(bz.yearGZ).toBe('癸卯');
	});
	test('东二区同一钟表时刻:已过立春 → 甲辰年、寅月', ()=>{
		const inst = new RiziMain({});
		const bz = inst.baziOf(personAt('+02:00'));
		expect(bz.yearGZ).toBe('甲辰');
		expect(bz.monthGZ.charAt(1)).toBe('寅');
	});
});
