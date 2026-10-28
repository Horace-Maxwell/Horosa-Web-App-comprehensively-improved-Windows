import moment from 'moment';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';

class DateTime {
	// 「此刻」:按给定时区取此刻的钟面(此前 new DateTime() 取系统本地钟面却缺省 +08:00 时区 → 非东八区系统错 N 小时);
	// zone 缺省 +08:00 与构造器一致;不合法时区按系统本地偏移。
	static nowInZone(zone){
		// 带秒的时区(地方平时 ±HH:MM:SS,名人库 / 命盘记录同写法):按秒精确换算,时区串原样留着
		const zs = typeof zone === 'string' ? /^([+-])(\d{2}):(\d{2}):(\d{2})$/.exec(zone) : null;
		if(zs){
			const off = (zs[1] === '-' ? -1 : 1) * (Number(zs[2]) * 3600 + Number(zs[3]) * 60 + Number(zs[4]));
			const t = new Date(Date.now() + off * 1000);
			return new DateTime({ ad: 1, zone, year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, date: t.getUTCDate(), hour: t.getUTCHours(), minute: t.getUTCMinutes(), second: t.getUTCSeconds() });
		}
		let z = typeof zone === 'string' && /^[+-]\d{2}:\d{2}$/.test(zone) ? zone : null;
		const m = z ? moment().utcOffset(z) : moment();
		if(!z){
			const off = m.utcOffset();
			const sign = off < 0 ? '-' : '+';
			const a = Math.abs(off);
			z = `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
		}
		return new DateTime({ ad: 1, zone: z, year: m.year(), month: m.month() + 1, date: m.date(), hour: m.hour(), minute: m.minute(), second: m.second() });
	}

	// 「此刻」按这张盘所用的时区(推运 / 返照 / 行运类缺省目标时刻、本命盘页各子页、无头与 AI 挂载同一个入口):
	// 盘的时区写法合法(±HH:MM 或带秒)→ 真实此刻换算到该时区(钟面与时区串配套,发给后端的「时刻 + 盘时区」是同一瞬时);
	// 没有 / 不合法 → 与 new DateTime() 相同(缺省 +08:00)。此前一律 new DateTime()(东八区钟面)再配本命时区下发 →
	// 不在东八区的盘「此刻」错开时差那么多小时。东八区的盘逐位不变
	static nowForChart(zone){
		return typeof zone === 'string' && /^[+-]\d{2}:\d{2}(:\d{2})?$/.test(zone) ? DateTime.nowInZone(zone) : new DateTime();
	}

	// 同上,给按 JS Date 的本地字段取年月日时分的旧代码用(今日 / 今年 / 此刻的钟面):盘时区合法 → 一个本地字段等于该时区钟面的 Date;
	// 没有盘时区 → new Date()(本机钟面,原样)
	static wallClockForChart(zone){
		if(!(typeof zone === 'string' && /^[+-]\d{2}:\d{2}(:\d{2})?$/.test(zone))){ return new Date(); }
		// 按时差平移毫秒(不经「年月日」构造 Date):本地字段 = 盘时区钟面
		const sign = zone[0] === '-' ? -1 : 1;
		const parts = zone.slice(1).split(':').map(Number);
		const zoneSec = sign * (parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0));
		const wallMs = DateTime.zoneWallShiftMs(Date.now(), zoneSec);
		return new Date(wallMs);
	}

	// 平移出一个瞬时(毫秒),它在本机的本地字段 = 盘时区(偏 zoneSec 秒)此刻的钟面。offsetAt(ms) = 本机在该瞬时的
	// getTimezoneOffset(分钟;缺省取本机,测试注入)。平移跨过本机夏令时切换时补一次偏移差;目标钟面恰落在本机拨快
	// 跳过的那一小时(本机不存在这个钟面)时,补了会退到前一小时 —— 零点切换的时区(圣地亚哥 / 哈瓦那 / 贝鲁特)
	// 退成前一天 —— 这时留不补的(日期对、钟点晚一小时)
	static zoneWallShiftMs(nowMs, zoneSec, offsetAt){
		const off = offsetAt || ((ms)=>new Date(ms).getTimezoneOffset());
		const wantMs = nowMs + zoneSec * 1000;   // 它的 UTC 字段 = 盘时区钟面
		const off0 = off(nowMs);
		const d0 = wantMs + off0 * 60000;
		const drift = off(d0) - off0;
		if(!drift){ return d0; }
		const c = d0 + drift * 60000;
		return c - off(c) * 60000 === wantMs ? c : d0;
	}

	constructor(opt){
		this.ad = opt ? opt.ad : 1;
		this.zone = opt && opt.zone ? opt.zone : "+08:00";
		// 缺省钟面 = 真实此刻换算到本对象时区(此前取系统本地钟面却标 +08:00 → 非东八区本机
		//   「此刻」/ 新盘 / 各技法缺省时间错 N 小时;154 处 `new DateTime()` 统一在此单点修)。东八区本机与传入完整 opt 的
		//   调用逐字不变;时区不合法时仍按系统本地钟面(与 nowInZone 同口径)。
		const z0 = typeof this.zone === 'string' && /^[+-]\d{2}:\d{2}$/.test(this.zone) ? this.zone : null;
		let tm = z0 ? moment().utcOffset(z0) : moment();
		this.year = opt ? opt.year : tm.year();
		this.month = opt ? opt.month : tm.month() + 1;
		this.date = opt ? opt.date : tm.date();
		this.hour = opt ? opt.hour : tm.hour();
		this.minute = opt ? opt.minute : tm.minute();
		this.second = opt ? opt.second : tm.second();

		this.jdn = 0;
	}

	getOnlyDateNum(){
		let a = Math.floor((14 - this.month) / 12);
		let y = this.ad * this.year + 4800 - a;
		if(this.ad < 0) {
			y = y + 1;
		}
		let m = this.month + 12*a - 3;
		let isGrego = true;
		if(this.ad * this.year < 1582 || (this.ad * this.year === 1582 && this.month < 10) 
			|| (this.ad * this.year === 1582 && this.month === 10 && this.date < 15)){
			isGrego = false;
		}
		
		if(isGrego) {
			return this.date + Math.floor((153*m + 2)/5) + 365*y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) - 32045;
		}else {
			return this.date + Math.floor((153*m + 2)/5) + 365*y + Math.floor(y/4) - 32083;
		}
	}

	getZoneJdn() {
		// zone 可能为 undefined/非字符串(如上游部分态盘对象 setZone(undefined)),按 0 偏移兜底
		if(typeof this.zone !== 'string' || !this.zone){
			return 0;
		}
		let parts = this.zone.split(':');
		let h = parts[0];
		let sym = 1;
		if(h.indexOf("+") === 0) {
			h = h.substr(1);
		}else if(h.indexOf("-") === 0) {
			h = h.substr(1);
			sym = -1;
		}
		h = parseInt(h, 10);
		let minu = parseInt(parts[1] || '0', 10);
		// 畸形 zone(如 "+8" 无冒号、空串)兜底为 0 偏移,防 NaN 污染 jdn 链。
		if(!Number.isFinite(h)) h = 0;
		if(!Number.isFinite(minu)) minu = 0;
		let res = sym*(h + minu/60.0)/24.0;
		return res;
	}

	getTimeNum(){
		let n = this.hour + this.minute/60.0 + this.second/3600.0;
		return n / 24.0;
	}
	
	calcJdn(){
		let jdn = this.getOnlyDateNum();
		let zonejdn = this.getZoneJdn();
		let tmjdn = this.getTimeNum();
		this.jdn = jdn + tmjdn - zonejdn - 0.5;
		return this.jdn;
	}

	genParams(){
		let params = {
			jdn: this.jdn,
			zone: this.zone || '+08:00',  // /jdn/date(JdnController)必需 zone,缺则 miss.zone 致古代日期转换失败/时间播放卡死
		};
		return params;
	}

	async requestJdnDate(){
		let params = this.genParams();
		const data = await request(`${Constants.ServerRoot}/jdn/date`, {
			body: JSON.stringify(params),
		});
		// 防御:/jdn/date 失败/空(古代日期或服务异常)→ 保留现有 year/month/date,不崩
		if(!data || data[Constants.ResultKey] == null){ return; }
		const result = data[Constants.ResultKey];
		let date = result.date;
		let parts = date.split(' ');
		let dt = parts[0];
		let tm = parts[1];
		let sym = 1;
		if(dt.indexOf('-') === 0){
			sym = -1;
			dt = dt.substr(1);
		}
		this.ad = sym;
		let dtparts = dt.split('-');
		this.year = parseInt(dtparts[0]);
		this.month = parseInt(dtparts[1]);
		this.date = parseInt(dtparts[2]);

		let tmparts = tm.split(':');
		this.hour = parseInt(tmparts[0]);
		this.minute = parseInt(tmparts[1]);
		this.second = parseInt(tmparts[2]);
	}

	// 儒略日(可带小数,可为负)→ [整日, 时, 分, 秒]。先把日内小数四舍五入到整秒、再整数拆分:
	// 满 86400 秒进位到下一日(不出现 HH:mm:60 / 24:00:00);负儒略日按 floor 取整日、小数恒落在 [0, 1)。
	// 与 Python 侧 civil_calendar.split_hms 同算法。
	getTimePartsFromJdnTime(jdn){
		let day = Math.floor(jdn);
		let secs = Math.round((jdn - day) * 86400);
		if(secs >= 86400){
			day += 1;
			secs -= 86400;
		}
		const hour = Math.floor(secs / 3600);
		const minute = Math.floor((secs - hour * 3600) / 60);
		const second = secs - hour * 3600 - minute * 60;
		return [day, hour, minute, second];
	}

	calDateFromJdn(jdn){
		// jdn→历日:1582-10-15(jdn≥2299161)起格里历,之前用儒略历(否则古代日期错算)
		let jd = Math.floor(jdn);
		let a, b, c;
		if(jd >= 2299161){
			a = jd + 32044;
			b = Math.floor((4*a + 3) / 146097);
			c = a - Math.floor(146097*b / 4);
		} else {
			b = 0;
			c = jd + 32082;
		}
		let d = Math.floor((4*c + 3) / 1461);
		let e = Math.floor(c - Math.floor(1461*d / 4));
		let m = Math.floor((5*e + 2) / 153);
	    let day = Math.floor(e + 1 - Math.floor((153*m + 2) / 5));
	    let mon = Math.floor(m + 3 - 12*Math.floor(m/10));
		let y = Math.floor(100*b + d - 4800 + Math.floor(m/10));

		let yy = parseInt(y + '');
		let mm = parseInt(mon + '');
		let dd = parseInt(day + '');
		if(yy <= 0){
			yy = yy - 1;
		}

		return [yy, mm, dd];
	}

	calcDateTime(){
		// 全本地同步计算(calDateFromJdn 已兼容儒略历)→ 古代日期连续播放可逐帧更新,不依赖异步 /jdn/date。
		// 当地民用日 = floor(jdn + 时区 + 0.5);日内时刻由同一个数取整到秒(进位到次日时日期一并进位)。
		const locjdn = this.jdn + this.getZoneJdn() + 0.5;
		const tmparts = this.getTimePartsFromJdnTime(locjdn);
		const dt = this.calDateFromJdn(tmparts[0]);
		this.ad = dt[0] < 0 ? -1 : 1;
		this.year = Math.abs(dt[0]);
		this.month = dt[1];
		this.date = dt[2];
		this.hour = tmparts[1];
		this.minute = tmparts[2];
		this.second = tmparts[3];
		this.calcJdn();
	}

	setYear(y){
		if(y === undefined || y === null){
			return this.year;
		}
		if(y < 0){
			this.ad = -1;
		}else if(y === 0){
			this.ad = -1;
			y = 1;
		}
		let days = this.getMonthDays(y, this.month);
		if(this.date > days){
			this.date = days;
		}
		this.year = Math.abs(y);
		this.calcJdn();
	}

	setMonth(val){
		if(val <= 0 || val >= 13){
			throw 'month cannot <= 0 or >= 13';
		}
		if(val === undefined || val === null){
			return this.month;
		}
		let days = this.getMonthDays(this.year*this.ad, val);
		if(this.date > days){
			this.date = days;
		}
		this.month = val;
		this.calcJdn();
	}

	setDay(val){
		if(val <= 0){
			throw 'date cannot <= 0';
		}
		if(val === undefined || val === null){
			return this.date;
		}
		let days = this.getMonthDays(this.year*this.ad, this.month);
		if(val > days){
			throw 'date cannot >= ' + days;
		}
		this.date = val;
		this.calcJdn();
	}

	setHour(val){
		if(val < 0 || val >= 24){
			throw 'hour cannot < 0 or >=24';
		}
		if(val === undefined || val === null){
			return this.hour;
		}
		this.hour = val;
		this.calcJdn();
	}

	setMinute(val){
		if(val < 0 || val >= 60){
			throw 'minute cannot < 0 or >= 60';
		}
		if(val === undefined || val === null){
			return this.minute;
		}
		this.minute = val;
		this.calcJdn();
	}

	setSecond(val){
		if(val < 0 || val >= 60){
			throw 'second cannot < 0 or >= 60';
		}
		if(val === undefined || val === null){
			return this.second;
		}
		this.second = val;
		this.calcJdn();
	}

	setAd(val){
		if(val <= 0){
			this.ad = -1;
		}else{
			this.ad = 1;
		}
		let days = this.getMonthDays(this.year*this.ad, this.month);
		if(this.date > days){
			this.date = days;
		}
		this.calcJdn();
	}

	setZone(val){
		// zone 语义=改时区;undefined/null/空串一律保持原值(历史上 setZone(undefined) 会把
		// zone 洗成 undefined → 全局 fields 污染 → 请求缺 zone 键(Java miss.zone)。
		if(val === undefined || val === null || val === ''){
			return;
		}
		this.zone = val;
		this.calcJdn();
	}

	format(fmt){
		let m = this.month < 10 ? '0'+this.month : this.month;
		let d = this.date < 10 ? '0'+this.date : this.date;
		let h = this.hour < 10 ? '0'+this.hour : this.hour;
		let min = this.minute < 10 ? '0'+this.minute : this.minute;
		let sec = this.second < 10 ? '0'+this.second : this.second;

		let fmtstr = fmt.toUpperCase();
		if(fmtstr === 'YYYY'){
			return this.ad * this.year + '';
		}
		if(fmtstr === 'YYYY/MM/DD'){
			return this.ad * this.year + '/' + m + '/' + d;
		}

		if(fmtstr === 'YYYY-MM-DD HH:MM'){
			return this.ad * this.year + '-' + m + '-' + d + ' ' + h + ':' + min;			
		}
		if(fmtstr === 'YYYY-MM-DD'){
			return this.ad * this.year + '-' + m + '-' + d;			
		}
		if(fmtstr === 'YYYY-MM'){
			return this.ad * this.year + '-' + m;			
		}

		if(fmtstr.indexOf('YYYY/MM/DD') === 0){
			return this.ad * this.year + '/' + m + '/' + d + ' ' + h + ':' + min + ':' + sec;
		}
		if(fmtstr === 'HH:MM'){
			return h + ':' + min;
		}
		if(fmtstr === 'HH:MM:SS' || fmtstr === 'HH:MM:SS.S'){
			return h + ':' + min + ':' + sec;
		}

		if(fmtstr === 'YYYYMMDDHHMMSS'){
			return this.ad * this.year + '' + m + '' + d + '' + h + '' + min + '' + sec;			
		}
		if(fmtstr === 'YYYYMMDD'){
			return this.ad * this.year + '' + m + '' + d;			
		}
		if(fmtstr === 'HHMMSS'){
			return h + '' + min + '' + sec;			
		}

		return this.ad * this.year + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + sec;
	}

	initFrom(dt){
		this.zone = dt.zone;
		this.ad = dt.ad;
		this.year = dt.year;
		this.month = dt.month;
		this.date = dt.date;
		this.hour = dt.hour;
		this.minute = dt.minute;
		this.second = dt.second;
		this.jdn = dt.jdn;
	}

	parse(dtstr, fmt){
		if(dtstr === undefined || dtstr === null){
			return this;
		}
		if(dtstr instanceof DateTime){
			this.initFrom(dtstr);
			return this;
		}
		let fmtstr = fmt;
		if(fmt === undefined || fmt === null){
			fmtstr = 'YYYY-MM-DD HH:MM:SS';
		}else{
			fmtstr = fmt.toUpperCase();
		}
		let parts = dtstr.split(' ');
		let dstr = parts[0];
		let tmstr = '12:00:00';
		if(parts.length > 1){
			tmstr = parts[1];
		}
		if(dstr.indexOf('-') === 0){
			this.ad = -1;
			dstr = dstr.substr(1);
		}
		let dtparts = dstr.split('/');
		if(dtparts.length === 1){
			dtparts = dstr.split('-');
		}
		if(dtparts.length === 1){
			dtparts.push('01');
			dtparts.push('01');
		}
		let tmparts = tmstr.split(':');
		if(tmparts.length === 2){
			tmparts.push('00');
		}

		if(fmtstr === 'YYYYMMDD'){
			dtparts[0] = dtstr.substr(0, 4);
			dtparts[1] = dtstr.substr(4, 2);
			dtparts[2] = dtstr.substr(6, 2);
		}else if(fmtstr === 'YYYYMMDDHHMMSS'){
			dtparts[0] = dtstr.substr(0, 4);
			dtparts[1] = dtstr.substr(4, 2);
			dtparts[2] = dtstr.substr(6, 2);
			tmparts[0] = dtstr.substr(8, 2);
			tmparts[1] = dtstr.substr(10, 2);
			tmparts[2] = dtstr.substr(12, 2);
		}

		this.year = parseInt(dtparts[0]);
		this.month = parseInt(dtparts[1]);
		this.date = parseInt(dtparts[2]);	
		this.hour = parseInt(tmparts[0]);
		this.minute = parseInt(tmparts[1]);
		this.second = parseInt(tmparts[2]);

		this.calcJdn();
		return this;
	}

	// year 为带符号显示年(公元前为负、无 0 年)。公元前按纯儒略历:|年| % 4 === 1 为闰(公元前 1 / 5 / 9 …年;
	// 天文年 0 / -4 / -8 …),无其他例外。旧写法对负数取 y % 4 === 1 恒不成立(JS 负数取余为负)→ 公元前闰年 2 月 29 日被拒。
	isLeap(year){
		let y  = year;
		if(y < 0){
			return Math.abs(y) % 4 === 1;
		}

		if(y <= 1582){
			if(y % 4 === 0) {
				return true;
			}else {
				return false;
			}
		}else {
			if(y % 4 === 0) {
				if(y % 400 === 0) {
					return true;
				}
				if(y % 100 === 0) {
					return false;
				}
				return true;
			}
			return false;
		}
	}

	getMonthDays(year, month){
		if(this.isLeap(year) && month === 2){
			return 29;
		}
		if(month === 2){
			return 28;
		}
		if(month === 1 || month === 3 || month === 5 || month === 7 || 
			month === 8 || month === 10 || month === 12){
			return 31;
		}
		return 30;
	}

	adaptMonth(num){
		if(num === 0){
			return 0;
		}
		let cnt = 0;
		this.month = this.month + num;
		while(this.month < 1){
			this.month = this.month + 12;
			cnt = cnt - 1;
		}
		while(this.month > 12){
			this.month = this.month - 12;
			cnt = cnt + 1;
		}
		return cnt;
	}

	adaptYear(num){
		if(num === 0){
			let days = this.getMonthDays(this.ad * this.year, this.month);
			if(this.date > days){
				this.month = this.month + 1;
				this.date = 1;
			}
		
			return;
		}
		let y;
		if(this.ad > 0){
			y = this.year + num;
			if(y <= 0){
				y = y - 1;
				this.ad = -1;
				this.year = -y;
			}else{
				this.year = y;
			}	
		}else{
			y = this.year - num;
			if(y <= 0){
				y = y + 1;
				this.ad = 1;
				this.year = Math.abs(y);
			}else{
				this.year = y;
			}
		}

		if(y === 1582 && this.month === 10 && (this.date > 4 && this.date < 15)){
			let delta = this.date - 5;
			this.date = 15 + delta;
			return;
		}

		let days = this.getMonthDays(this.ad * this.year, this.month);
		if(this.date > days){
			this.month = this.month + 1;
			this.date = 1;
		}

	}

	adapt15821004(sym){
		let y = this.year;
		if(y === 1582 && this.month === 10 && (this.date > 4 && this.date < 15)){
			let delta = this.date - 5;
			if(sym > 0){
				this.date = 15 + delta;
			}else{
				this.date = this.date - delta - 1;
			}
			return;
		}
	}

	addSecond(num){
		// 以年月日时分秒为真值重算起点(对象可能经 clone / 直接改字段而 jdn 未同步;缺省构造的 jdn 为 0)。
		this.jdn = this.calcJdn() + num/3600.0/24.0;
		this.calcDateTime();
	}

	// 分 / 时 / 日的加减一律在儒略日轴上做(与 addSecond 同一条路):跨月跨年、1582-10-04 → 10-15、
	// 公元前闰年 2 月、公元前 1 年 → 公元 1 年都由 calDateFromJdn 一处处理(逐字段进位在公元前按无符号年取月长会错)。
	addMinute(num){
		this.addSecond(num * 60);
	}

	addHour(num){
		this.addSecond(num * 3600);
	}

	addDate(num){
		this.addSecond(num * 86400);
	}

	addMonth(num){
		let cnt = this.adaptMonth(num);
		this.adaptYear(cnt);
		let sym = num < 0 ? -1 : 1;
		this.adapt15821004(sym);
		this.calcJdn();
	}

	addYear(num){
		this.adaptYear(num);
		let sym = num < 0 ? -1 : 1;
		this.adapt15821004(sym);
		this.calcJdn();
	}

	add(num, t){
		if(t === 'd'){
			this.addDate(num);
		}else if(t === 'y'){
			this.addYear(num);
		}else if(t === 'm'){
			this.addMonth(num);
		}else if(t === 'h'){
			this.addHour(num);
		}
	}

	setDate(y, m, d){
		this.year = y;
		this.month = m;
		this.date = d;
		this.calcJdn();
	}

	setTime(h, m, s){
		this.hour = h;
		this.minute = m;
		this.second = s;
		this.calcJdn();
	}

	clone(){
		let tm = new DateTime();
		tm.year = this.year;
		tm.month = this.month;
		tm.date = this.date;
		tm.hour = this.hour;
		tm.minute = this.minute;
		tm.second = this.second;
		tm.ad = this.ad;
		tm.zone = this.zone;
		tm.jdn = this.jdn;

		return tm;
	}

	startOf(partstr){
		let part = partstr.toLowerCase();
		let tm = this.clone();
		if(part === 'date'){
			tm.hour = 0;
			tm.minute = 0;
			tm.second = 0;
			tm.calcJdn();
		}else if(part === 'month'){
			tm.date = 1;
			tm.hour = 0;
			tm.minute = 0;
			tm.second = 0;
			tm.calcJdn();
		}else if(part === 'year'){
			tm.month = 1
			tm.date = 1;
			tm.hour = 0;
			tm.minute = 0;
			tm.second = 0;
			tm.calcJdn();
		}
		return tm;
	}

	setDateTime(y, m, d, h, minu, sec){
		this.year = y;
		this.month = m;
		this.date = d;
		this.hour = h;
		this.minute = minu;
		this.second = sec;
		this.calcJdn();
	}

	isSameDate(otherDate){
		return this.ad === otherDate.ad && this.year === otherDate.year
				&& this.month === otherDate.month && this.date === otherDate.date;
	}

	getValue(){
		let m = this.month < 10 ? '0'+this.month : this.month;
		let d = this.date < 10 ? '0'+this.date : this.date;
		let h = this.hour < 10 ? '0'+this.hour : this.hour;
		let min = this.minute < 10 ? '0'+this.minute : this.minute;
		let sec = this.second < 10 ? '0'+this.second : this.second;
		let tm = this.year + '-' + m + '-' + d + ' '
					+ h + ':' + min + ':' + sec;

		return {
			year: this.year,
			month: this.month,
			date: this.date,
			hour: this.hour,
			minute: this.minute,
			second: this.second,
			ad: this.ad,
			jdn: this.jdn,
			tm: tm,
		};
	}


}

export default DateTime;
