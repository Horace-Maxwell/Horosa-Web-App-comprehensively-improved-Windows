import moment from 'moment';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';

class DateTime {
	constructor(opt){
		let tm = moment();

		this.ad = opt ? opt.ad : 1;
		this.zone = opt && opt.zone ? opt.zone : "+08:00";
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
		let parts = this.zone.split(':');
		let h = parts[0];
		let sym = 1;
		if(h.indexOf("+") === 0) {
			h = h.substr(1);
		}else if(h.indexOf("-") === 0) {
			h = h.substr(1);
			sym = -1;
		}
		h = parseInt(h);
		let minu = parseInt(parts[1]);
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
		};
		return params;
	}

	async requestJdnDate(){
		let params = this.genParams();
		const data = await request(`${Constants.ServerRoot}/jdn/date`, {
			body: JSON.stringify(params),
		});
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

	getTimePartsFromJdnTime(jdn){
		let day = Math.floor(Math.abs(jdn));
		let sym = 1;
		if(jdn < 0){
			sym = -1;
		}

		let jdntm = Math.abs(jdn) - day;
		let n = jdntm * 24;
		let h = Math.floor(n);
		n = n - h;
		
		n = n * 60;
		let m = Math.floor(n);
		n = n - m;
		
		n = n * 60;
		let s = Math.floor(n);
		n = n - s;
		if(n >= 0.5) {
			s +=1;
		}

		let hour = parseInt(h + '');
		let minute = parseInt(m + '');
		let second = parseInt(s + '');

		return [day*sym, hour, minute, second];
	}

	calDateFromJdn(jdn){
		let a = Math.floor(jdn + 32044);
		let b = Math.floor((4*a + 3) / 146097);
		let c = Math.floor(a - Math.floor(146097*b / 4));
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
		if(this.jdn < 2299160.1666666665){
			this.requestJdnDate();
			return;
		}

		let jdn = this.jd;
		let zonejdn = this.getZoneJdn();
		let locjdn = this.jdn + zonejdn + 0.5;
		let tm = Math.abs(locjdn) - Math.floor(Math.abs(locjdn));
		
		let dt = this.calDateFromJdn(locjdn);
		let tmparts = this.getTimePartsFromJdnTime(tm);
					    
		let dtm = new DateTime({
			ad: dt[0] < 0 ? -1 : 1,
			year: Math.abs(dt[0]),
			month: dt[1],
			date: dt[2],
			hour: tmparts[1],
			minute: tmparts[2],
			second: tmparts[3],
			zone: this.zone,
		});
		let n = dtm.calcJdn();
		let delta = jdn - n;
		
		if(Math.abs(delta) > 0.00000001) {
			let newjd = locjdn + delta;
			dt = this.calDateFromJdn(newjd);
		}
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

	isLeap(year){
		let y  = year;
		if(y < 0){
			if(y > 172800 && y % 172800 === 0) {
				return true;
			}
			if(y > 3200 && y % 3200 === 1) {
				return false;
			}
			if(y % 4 === 1) {
				return true;
			}
			return false;
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

	adaptMinute(num){
		if(num === 0){
			return 0;
		}
		let cnt = 0;
		this.minute = this.minute + num;
		while(this.minute < 0){
			this.minute = this.minute + 60;
			cnt = cnt - 1;
		}
		while(this.minute >= 60){
			this.minute = this.minute - 60;
			cnt = cnt + 1;
		}
		return cnt;
	}

	adaptHour(num){
		if(num === 0){
			return 0;
		}
		let cnt = 0;
		this.hour = this.hour + num;
		while(this.hour < 0){
			this.hour = this.hour + 24;
			cnt = cnt - 1;
		}
		while(this.hour >= 24){
			this.hour = this.hour - 24;
			cnt = cnt + 1;
		}
		return cnt;
	}

	adaptDate(num){
		if(num === 0){
			return 0;
		}
		let cnt = 0;
		let y = this.year;
		let m = this.month;
		let days = this.getMonthDays(y, m);
		this.date = this.date + num;
		while(this.date > days){
			this.date = this.date - days;
			cnt = cnt + 1;
			m = m + 1;
			if(m > 12){
				m = 1;
				y = y + 1;
				if(y === 0){
					y = 1;
				}
			}
			days = this.getMonthDays(y, m);
		}
		while(this.date < 1){
			m = m -1;
			if(m === 0){
				m = 12;
				y = y - 1;
				if(y === 0){
					y = -1;
				}
			}
			days = this.getMonthDays(y, m);
			this.date = this.date + days;
			cnt = cnt - 1;
		}
		return cnt;
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
			let days = this.getMonthDays(this.year, this.month);
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

		let days = this.getMonthDays(y, this.month);
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
		this.jdn = this.jdn + num/3600.0/24.0;
		this.calcDateTime();
	}

	addMinute(num){
		let cnt = this.adaptMinute(num);
		cnt = this.adaptHour(cnt);
		cnt = this.adaptDate(cnt);
		cnt = this.adaptMonth(cnt);
		this.adaptYear(cnt);
		let sym = num < 0 ? -1 : 1;
		this.adapt15821004(sym);
		this.calcJdn();
	}

	addHour(num){
		let cnt = this.adaptHour(num);
		cnt = this.adaptDate(cnt);
		cnt = this.adaptMonth(cnt);
		this.adaptYear(cnt);
		let sym = num < 0 ? -1 : 1;
		this.adapt15821004(sym);
		this.calcJdn();
	}

	addDate(num){
		let cnt = this.adaptDate(num);
		cnt = this.adaptMonth(cnt);
		this.adaptYear(cnt);
		let sym = num < 0 ? -1 : 1;
		this.adapt15821004(sym);
		this.calcJdn();
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
