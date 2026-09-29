// [#81] 九星值日 / 时辰宜忌懒算:开关开关逐字节等价 + 全年扫描不触发两项底层计算(棘轮)+ 读取时值完整。

// lunar-javascript 的方法挂在实例上(原型上 spy 不到):隔离模块实例里包一层,给新建 Lunar 的两个方法计数,其余透传。
function freshModules(lazyOn, counter){
	let mods = null;
	localStorage.setItem('horosa.perf.huangliLazyDetail', lazyOn ? '1' : '0');
	jest.isolateModules(()=>{
		if(counter){
			jest.doMock('lunar-javascript', ()=>{
				const real = jest.requireActual('lunar-javascript');
				const wrapLunar = (l)=>{
					['getDayNineStar', 'getTimes'].forEach((k)=>{
						const orig = l[k];
						l[k] = function(...args){ counter[k] = (counter[k] || 0) + 1; return orig.apply(this, args); };
					});
					return l;
				};
				const wrapSolar = (s)=>{ const g = s.getLunar; s.getLunar = function(){ return wrapLunar(g.apply(this)); }; return s; };
				const Solar = Object.create(real.Solar);
				Solar.fromYmdHms = (...a)=> wrapSolar(real.Solar.fromYmdHms(...a));
				Solar.fromYmd = (...a)=> wrapSolar(real.Solar.fromYmd(...a));
				return { ...real, Solar };
			});
		}
		mods = {
			huangli: require('../huangliDay'),
			year: require('../yearAuspicious'),
		};
	});
	return mods;
}

afterEach(()=>{ localStorage.removeItem('horosa.perf.huangliLazyDetail'); jest.dontMock('lunar-javascript'); });

const SAMPLE = [
	[2024, 1, 1, 12], [2024, 2, 29, 0], [2024, 6, 21, 23], [2025, 12, 31, 12], [1901, 3, 15, 5],
	[1950, 7, 7, 17], [2000, 2, 4, 9], [2031, 10, 10, 21], [2100, 12, 25, 12], [1984, 8, 8, 13],
];

test('开关开关逐字节等价(含读取后两项的值)', ()=>{
	const on = freshModules(true).huangli;
	const off = freshModules(false).huangli;
	SAMPLE.forEach(([y, m, d, h])=>{
		expect(JSON.stringify(on.buildHuangliDay(y, m, d, h))).toBe(JSON.stringify(off.buildHuangliDay(y, m, d, h)));
	});
});

test('全年扫描不触发九星值日与时辰宜忌的底层计算;开关关时照旧计算(判别力)', ()=>{
	const cOn = {};
	freshModules(true, cOn).year.buildYearAuspicious(2037, { events: ['marriage'], topN: 366 });
	expect(cOn.getDayNineStar || 0).toBe(0);
	expect(cOn.getTimes || 0).toBe(0);
	const cOff = {};
	freshModules(false, cOff).year.buildYearAuspicious(2038, { events: ['marriage'], topN: 366 });
	expect(cOff.getDayNineStar).toBeGreaterThan(300);
	expect(cOff.getTimes).toBeGreaterThan(300);
});

test('读取时值完整,且只算一次', ()=>{
	const c = {};
	const { huangli } = freshModules(true, c);
	const day = huangli.buildHuangliDay(2039, 5, 20, 12);
	expect(c.getTimes || 0).toBe(0);
	expect(Array.isArray(day.times) && day.times.length).toBeGreaterThanOrEqual(12);
	expect(day.times[0].ganzhi).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
	expect(day.times).toBe(day.times);
	expect(c.getTimes).toBe(1);
	expect(day.nineStar && day.nineStar.name).toBeTruthy();
	expect(c.getDayNineStar).toBe(1);
	expect(Object.keys(day)).toContain('times');
	expect(Object.keys(day)).toContain('nineStar');
});
