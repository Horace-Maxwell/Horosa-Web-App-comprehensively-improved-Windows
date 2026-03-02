import * as forge from 'node-forge';
import { message } from 'antd';
import { history } from 'umi';
import { Msg } from '../msg/msg';
import * as Constants from '../utils/constants';
import { getErrMsg } from '../msg/errmsg';
import {GPS} from './gps';
import printJS from 'print-js';
import {innerHandleError} from './request';

export function twoTextOneLine(ary, howmanyLines){
	let res = [];
	let txt = '';
	let lines = 2;
	if(howmanyLines){
		lines = howmanyLines;
	}
	if(lines === 1){
		return ary;
	}
	
	for(let i=0; i<ary.length; i++){
		if(i % lines === 0){
			txt = ary[i];
			if(i === ary.length - 1){
				res.push(txt);
			}
		}else{
			if(i % lines === lines - 1){
				txt = txt + '，' + ary[i] + '。';
				res.push(txt);
			}else{
				txt = txt + '，' + ary[i];
			}
		}
	}
	return res;
}

export function toBase64(str){
	let raw = forge.util.createBuffer(str, "utf8").bytes();
	return forge.util.encode64(raw);
}

export function fromBase64(str){
	let txt = forge.util.decode64(str);
	return forge.util.decodeUtf8(txt);
}

export function uuid(len, radix){
	let chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
	let uuid = [], i;
	radix = radix || chars.length;

	if (len) {
		// Compact form
		for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
	} else {
		// rfc4122, version 4 form
		let r;

		// rfc4122 requires these characters
		uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
		uuid[14] = '4';

		// Fill in random data.  At i==19 set the high bits of clock sequence as
		// per rfc4122, sec. 4.1.5
		for (i = 0; i < 36; i++) {
			if (!uuid[i]) {
				r = 0 | Math.random() * 16;
				uuid[i] = chars[(i === 19) ? (r & 0x3) | 0x8 : r];
			}
		}
	}

	return uuid.join('');
}

export function getRegionName(regionMap, code){
	let txt = code;
	if(code === undefined || code === null){
		txt = '';
	}
	if(regionMap === undefined || regionMap === null){
		return txt;
	}
	let name = regionMap.get(code);
	if(name === undefined || name === null || name === ''){
		return txt;
	}
	return name.region;
}

export function getCountryName(countryMap, code){
	if(countryMap === undefined || countryMap === null){
		return code;
	}
	let name = countryMap.get(code);
	if(name === undefined || name === null || name === ''){
		return code;
	}
	return name.countryName;
}

export function fillBreadcrumbs(dispatch, app){
	let breadcrumbs = null;
	if(app.breadCrumbItems && Array.isArray(app.breadCrumbItems)){
		breadcrumbs = app.breadCrumbItems.slice(0);
	}
	if(breadcrumbs){
		let last = breadcrumbs[breadcrumbs.length - 1];
		if(last === undefined || last === null || last.isMenu === undefined || last.isMenu === null){
			return;
		}
		if(last.isMenu === false){
			breadcrumbs = breadcrumbs.slice(0, breadcrumbs.length-1);
			dispatch({
				type: 'app/save',
				payload:{
					breadCrumbItems: breadcrumbs,
				}
			});
		}
	}
}

export function fillEditBreadcrumbs(dispatch, app, currentRecord, nameField, seqField, itemPrefix){
	if(currentRecord === undefined || currentRecord === null){
		return;
	}
	let breadcrumbs = null;
	if(app.breadCrumbItems && Array.isArray(app.breadCrumbItems)){
		breadcrumbs = app.breadCrumbItems.slice(0);
	}
	if(breadcrumbs && currentRecord){
		let last = breadcrumbs[breadcrumbs.length - 1];
		if(last === undefined){
			return;
		}
		let bname = '';
		if(nameField instanceof Array){
			for(let i=0; i<nameField.length; i++){
				let key = nameField[i];
				let tmp = currentRecord[key];
				if(i === 0){
					bname = tmp ? tmp : '';
				}else{
					bname = bname + '（' + tmp + '）';
				}
			}
		}else{
			bname = currentRecord[nameField];
		}

		let bseq = '';
		if(seqField instanceof Array){
			for(let i=0; i<seqField.length; i++){
				let key = seqField[i];
				let tmp = currentRecord[key];
				if(i === 0){
					bseq = tmp;
				}else{
					bseq = bseq + '_' + tmp;
				}
			}
		}else{
			bseq = currentRecord[seqField];
		}

		if(last.isMenu !== undefined && last.isMenu === false){
			if(last.name !== bname){
				breadcrumbs = breadcrumbs.slice(0, breadcrumbs.length-1);
				last = breadcrumbs[breadcrumbs.length - 1];
			}
		}

		if(last.name !== bname){
			breadcrumbs.push({
				name: bname,
				key: bseq + '_' + bname,
				id: itemPrefix + bseq,
				transcode: '',
				isMenu: false,
			});
			dispatch({
				type: 'app/save',
				payload:{
					breadCrumbItems: breadcrumbs,
				}
			});
		}
	}

}

export function fillAddBreadcrumbs(dispatch, app, itemName){
	let breadcrumbs = null;
	if(app.breadCrumbItems && Array.isArray(app.breadCrumbItems)){
		breadcrumbs = app.breadCrumbItems.slice(0);
	}
	if(breadcrumbs){
		let last = breadcrumbs[breadcrumbs.length - 1];
		if(last === undefined){
			return;
		}
		if(last.isMenu !== undefined && last.isMenu === false){
			if(last.name !== Msg.newItem){
				breadcrumbs = breadcrumbs.slice(0, breadcrumbs.length-1);
				last = breadcrumbs[breadcrumbs.length - 1];
			}
		}

		if(last.name !== Msg.newItem){
			breadcrumbs.push({
				name: Msg.newItem,
				key: 'new' + itemName,
				id: 'new' + itemName,
				transcode: '',
				isMenu: false,
			});
			dispatch({
				type: 'app/save',
				payload:{
					breadCrumbItems: breadcrumbs,
				}
			});
		}
	}

}

export function cloneMap(map){
	const recs = new Map();
	for(let item of map){
		recs.set(item[0], item[1]);
	}
	return recs;
}

export function preventEnterPress(e){
	if(e.target.tagName === 'TEXTAREA'){
		return;
	}
	if(e.keyCode && e.keyCode === 13){
		e.preventDefault();
	}
	if(e.which && e.which === 13){
		e.preventDefault();
	}
}

export function getUserIP(onNewIP) { //  onNewIp - your listener function for new IPs
	//compatibility for firefox and chrome
	let myPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
	if(myPeerConnection === undefined || myPeerConnection === null){
		onNewIP('127.0.0.1');
		return;
	}
	let pc = new myPeerConnection({
		iceServers: []
	}),
	noop = function () { },
	localIPs = {},
	ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g ;

	function iterateIP(ip) {
		if (!localIPs[ip]) onNewIP(ip);
		localIPs[ip] = true;
	}

	//create a bogus data channel
	pc.createDataChannel("");

	// create offer and set local description
	pc.createOffer().then(function (sdp) {
		sdp.sdp.split('\n').forEach(function (line) {
			if (line.indexOf('candidate') < 0) return;
			line.match(ipRegex).forEach(iterateIP);
		});

		pc.setLocalDescription(sdp, noop, noop);
	}).catch(function (reason) {
		// An error occurred, so handle the failure to connect
	});

	//sten for candidate events
	pc.onicecandidate = function (ice) {
		if (!ice || !ice.candidate || !ice.candidate.candidate || !ice.candidate.candidate.match(ipRegex)) return;
		ice.candidate.candidate.match(ipRegex).forEach(iterateIP);
	};
}

export function handleError(err) {
	innerHandleError(err);
}

export function strCompare(str1, str2){
	if((str1 === undefined || str1 === null)){
		if((str2 === undefined || str2 === null)){
			return 0;
		}
		return -1;
	}
	if((str2 === undefined || str2 === null)){
		return 1;
	}
	if(str1 === str2){
		return 0;
	}

	let ary = [str1, str2].sort();
	if(ary[0] === str1){
		return -1
	}else{
		return 1;
	}
}

export function formatDuration(ms){
	if(ms === undefined || ms === null){
		return '';
	}
	if(ms < 1000){
		return ms + ' 毫秒';
	}
	if(ms >= 1000 && ms < 60000 ){
		return Math.floor(ms / 1000) + ' 秒';
	}
	if(ms >= 60000 && ms < 3600000){
		let min = Math.floor(ms / 60000);
		let s = ms % 60000;
		s = Math.floor(s / 1000);
		return min + '分' + s + '秒';
	}
	const dayms = 3600000*24;
	if(ms >= 3600000 && ms < dayms){
		let hour = Math.floor(ms / 3600000);
		let rest = ms % 3600000;
		let min = Math.floor(rest / 60000);
		let srest = rest % 60000;
		let sec = Math.floor(srest / 1000);
		return hour + '小时' + min + '分' + sec + '秒';
	}
	if(ms >= dayms){
		let day = Math.floor(ms / dayms);
		let dayrest = ms % dayms;
		let hour = Math.floor(dayrest / 3600000);
		let rest = dayrest % 3600000;
		let min = Math.floor(rest / 60000);
		let srest = rest % 60000;
		let sec = Math.floor(srest / 1000);
		return day + '天' + hour + '小时' + min + '分' + sec + '秒';
	}
	return '';
}

export function randomStr(len){
	const txt = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
		'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 
		'_0', '_1', '_2', '_3', '_4', '_5', '_6', '_7', '_8', '_9', ];
	let length = len ? len : 8;
	const res= [];
	for(let i=0; i<length; i++){
		let idx = Math.floor(Math.random()*1000) % txt.length;
		res.push(txt[idx]);
	}
	return res.join('');
}

export function randomNum(exp){
	let expn = exp > 0 ? exp : 4;
	let p = Math.pow(10, expn);
	let num = Math.floor(Math.random()*p);
	return num;
}

export function gcj02ToGps(lat, lon){ // 高德地图坐标转gps	 
	if(lat === undefined || lon === null){
		return {lat:0, lon:0};
	}
	return GPS.gcj_decrypt_exact(lat, lon);
}

export function gpsToGcj02(wgLat, wgLon){
	if(wgLat === undefined || wgLat === null){
		return {lat:0, lon:0};
	}
	return GPS.gcj_encrypt(wgLat, wgLon);
}


export function detectOS() {
	let sUserAgent = navigator.userAgent;
	 
	let isIPhone = new RegExp('\\biPhone\\b|\\biPod\\b', 'i').test(window.navigator.userAgent);
	let isIPad = new RegExp('\\biPad\\b', 'i').test(window.navigator.userAgent);
	let isWin = (navigator.platform === "Win32") || (navigator.platform === "Win64") || (navigator.platform === "Windows");
	let isMac = (navigator.platform === "Mac68K") || (navigator.platform === "MacPPC") || (navigator.platform === "Macintosh") || (navigator.platform === "MacIntel");
	if (isMac || isIPhone || isIPad) return "Mac";
	let isUnix = (navigator.platform === "X11") && !isWin && !isMac;
	if (isUnix) return "Unix";
	let isLinux = (String(navigator.platform).indexOf("Linux") > -1);
	 
	let isAndroid = new RegExp('\\bAndroid\\b', 'i').test(window.navigator.userAgent);
	let bIsAndroid = isAndroid | sUserAgent.toLowerCase().indexOf('android') > -1;
	if (isLinux) {
		if(bIsAndroid) 
			return "Android";
		else 
			return "Linux";
	}
	if (isWin) {
		return 'Windows'
	}
	return "other";
}

export function detectPlatform() {
	let sUserAgent = navigator.userAgent;
	 
	let isIPhone = new RegExp('\\biPhone\\b|\\biPod\\b', 'i').test(window.navigator.userAgent);
	let isIPad = new RegExp('\\biPad\\b', 'i').test(window.navigator.userAgent);
	let isWin = (navigator.platform === "Win32") || (navigator.platform === "Win64") || (navigator.platform === "Windows");
	let isMac = (navigator.platform === "Mac68K") || (navigator.platform === "MacPPC") || (navigator.platform === "Macintosh") || (navigator.platform === "MacIntel");
	if (isMac) return "Mac";
	if (isIPhone) return "IPhone";
	if (isIPad) return "IPad";
	let isUnix = (navigator.platform === "X11") && !isWin && !isMac;
	if (isUnix) return "Unix";
	let isLinux = (String(navigator.platform).indexOf("Linux") > -1);
	 
	let isAndroid = new RegExp('\\bAndroid\\b', 'i').test(window.navigator.userAgent);
	let bIsAndroid = isAndroid | sUserAgent.toLowerCase().indexOf('android') > -1;
	if (isLinux) {
		if(bIsAndroid) 
			return "Android";
		else 
			return "Linux";
	}
	if (isWin) {
		return 'Windows'
	}
	return "other";
}

export function littleEndian(bits){
	let n = 0;
	for(let i=0; i<bits.length; i++){
		let v = bits[i];
		if(v < 0){
			return -1;
		}

		n = n | (v<<i);
	}

	return n;
}

export function formatDate(dt){
	let str = dt.getFullYear() + '-';
	let m = dt.getMonth() + 1;
	m = m < 10 ? '0' + m : m + '';
	let d = dt.getDate();
	d = d < 10 ? '0' + d : d + '';
	let h = dt.getHours();
	let min = dt.getMinutes();
	let sec = dt.getSeconds();
	h = h < 10 ? '0' + h : h + '';
	min = min < 10 ? '0' + min : min + '';
	sec = sec < 10 ? '0' + sec : sec + '';
	str = str + m + '-' + d + ' ' + h + ':' + min + ':' + sec;
	return str;
}

export function isNumber(c){
	let num = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-', '+', '~'];
	return num.indexOf(c) >= 0;
}

export function launchFullScreen(divElem){
	let rfs = divElem.requestFullScreen || divElem.webkitRequestFullScreen || divElem.mozRequestFullScreen || divElem.msRequestFullScreen;
	
	if(rfs !== undefined && rfs) {
		rfs.call(divElem);
		return;
	}	
}

export function exitFullScreen() {
	let el= document;
	let cfs = el.cancelFullScreen || el.webkitCancelFullScreen || el.mozCancelFullScreen || el.exitFullScreen
	
	if (cfs !== undefined && cfs) {
		cfs.call(el);
		return;
	}	
}

export function checkFullScreen(){
	var isFull = document.fullscreenEnabled || window.fullScreen || document.webkitIsFullScreen || document.msFullscreenEnabled;
	//to fix : false || undefined == undefined
	if (isFull === undefined) {isFull = false;}
	return isFull;
}

export function getAzimuthStr(deg){
	let pos = Math.floor(deg / 45);
	let val = Math.round((deg % 45) * 1000) / 1000;
	let restval = Math.round((45 - val) * 1000) / 1000;
	let str = Math.round(deg * 1000) / 1000 + 'º，';
	if(pos === 0){
		str = str + '南偏西' + val + 'º';
	}else if(pos === 1){
		str = str + '西偏南' + restval + 'º';		
	}else if(pos === 2){
		str = str + '西偏北' + val + 'º';		
	}else if(pos === 3){
		str = str + '北偏西' + restval + 'º';				
	}else if(pos === 4){
		str = str + '北偏东' + val + 'º';						
	}else if(pos === 5){
		str = str + '东偏北' + restval + 'º';								
	}else if(pos === 6){
		str = str + '东偏南' + val + 'º';										
	}else if(pos === 7){
		str = str + '南偏东' + restval + 'º';												
	}

	return str;
}

export function distanceInCircleAbs(ang1, ang2){
	if(ang1 > 270 && ang2 >=0 && ang2 <= 90){
		return 360 - ang1 + ang2;
	}else if(ang2 > 270 && ang1 >=0 && ang1 <= 90){
		return 360 - ang2 + ang1;
	}

	let delta = Math.abs(ang2 - ang1);
	if(delta > 180){
		delta = 360 - 180;
	}
	return delta;
}

export function convertToArray(obj){
	let res = [];
	for(let key in obj){
		if(Object.prototype.toString.call(obj[key]) === '[object Object]'){
			if(obj[key].name === undefined || obj[key].name === null){
				obj[key].name = key;
			}
			if(obj[key].value === undefined){
				obj[key].value = null;
			}

			res.push(obj[key]);
		}
	}
	return res;
}

export function isObject(obj){
	if(Object.prototype.toString.call(obj) === '[object Object]'){
		return true;
	}
	return false;
}

export function selectText(elemId) {
	var text = document.getElementById(elemId);
	if (document.body.createTextRange) {
		var range = document.body.createTextRange();
		range.moveToElementText(text);
		range.select();
	} else if (window.getSelection) {
		var selection = window.getSelection();
		var range = document.createRange();
		range.selectNodeContents(text);
		selection.removeAllRanges();
		selection.addRange(range);
		/*if(selection.setBaseAndExtent){
			selection.setBaseAndExtent(text, 0, text, 1);
		}*/
	}
}

export function startWith(str, prefix){
	if(str && prefix){
		return str.slice(0, prefix.length) === prefix;
	}
	return false;
}

export function endWith(str, suffix){
	if(str && suffix){
		return str.indexOf(suffix, str.length-suffix.length) !== -1;
	}
	return false;
}

export function buildScriptTag(src) {
	let script = document.createElement('script');
	script.type = 'text/javascript';
	script.async = true;
	script.defer = true;
	script.src = src;
	return script;
}

export function getScriptPromise(url) {
	let script = buildScriptTag(url);
	var p = new Promise(function (resolve) {
		script.onload = function () {
			resolve();
		};
	});
	document.body.appendChild(script);
	return p;
}

function escapeTipHtml(str){
	return `${str === undefined || str === null ? '' : str}`
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function inlineMarkdown(text){
	let out = escapeTipHtml(text);
	out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	return out;
}

function normalizeTipTitle(rawTitle){
	const lines = `${normalizeTipValue(rawTitle)}`.replace(/\r\n/g, '\n').split('\n');
	let first = '';
	for(let i=0; i<lines.length; i++){
		const txt = `${lines[i] || ''}`.trim();
		if(txt){
			first = txt;
			break;
		}
	}
	if(!first){
		return '';
	}
	const h = first.match(/^#{1,6}\s*(.+)$/);
	const title = h ? h[1] : first;
	return inlineMarkdown(title);
}

function normalizeTipValue(val){
	if(val === undefined || val === null){
		return '';
	}
	if(typeof val === 'string'){
		return val;
	}
	if(typeof val === 'number' || typeof val === 'boolean'){
		return `${val}`;
	}
	if(val && typeof val === 'object'){
		if(val.title || val.tips){
			return `${val.title || ''}`;
		}
		try{
			return JSON.stringify(val);
		}catch(e){
			return '';
		}
	}
	return '';
}

function renderTipLine(line){
	const raw = normalizeTipValue(line).trim();
	if(!raw){
		return '';
	}
	if(raw === '=='){
		return '<hr style="margin: 8px 0;" />';
	}
	let level = 0;
	let text = raw;
	const h = raw.match(/^(#{1,6})\s*(.+)$/);
	if(h){
		level = h[1].length;
		text = h[2];
	}
	const content = inlineMarkdown(text);
	if(level > 0){
		const fs = level <= 2 ? 14 : 13;
		return `<div style="margin: 6px 0 2px 0; font-size:${fs}px; font-weight:700;">${content}</div>`;
	}
	return `<div style="margin: 3px 0; line-height: 1.45;">${content}</div>`;
}

function renderTipLines(source){
	const raw = normalizeTipValue(source);
	if(!raw){
		return [];
	}
	const lines = `${raw}`.replace(/\r\n/g, '\n').split('\n');
	const out = [];
	for(let i=0; i<lines.length; i++){
		const rendered = renderTipLine(lines[i]);
		if(rendered){
			out.push(rendered);
		}
	}
	return out;
}

export function genHtml(tipobj, needpadding){
	if(tipobj === undefined || tipobj === null
		|| tipobj.tips === undefined || tipobj.tips === null){
		return '';
	}
	const title = normalizeTipTitle(tipobj.title || '');
	const tips = tipobj.tips;
	const bodyPad = needpadding ? '6px 8px 8px 6px' : '4px 8px 6px 2px';
	let parts = [`<h4 style='margin: 8px 4px 6px 2px;'>${title}</h4><hr style="margin: 0 0 6px 0;" />`];
	parts.push(`<div style="margin-right: 10px; padding: ${bodyPad}; overflow-x:hidden; overflow-y:auto; max-height: 420px;">`);
	if(tips instanceof Array){
		for(let i=0; i<tips.length; i++){
			const item = tips[i];
			if(item instanceof Array){
				for(let j=0; j<item.length; j++){
					parts.push(...renderTipLines(item[j]));
				}
				continue;
			}
			parts.push(...renderTipLines(item));
		}
	}else{
		parts.push(...renderTipLines(tips));
	}
	parts.push('</div>');
	return parts.join('');
}

export function creatTooltip(divTooltip, titleSvg, tipobj, onTipClick, needpadding){
	if(divTooltip === undefined || divTooltip === null){
		return;
	}

	titleSvg.on('mouseover', (evt)=>{
		let str = genHtml(tipobj, needpadding) ;
		divTooltip.transition()		
			.duration(200)		
			.style("opacity", .9);
		divTooltip.html(str)
			.style("left", (evt.pageX) + "px")
			.style("top", (evt.pageY - 28) + "px");
	}).on('mouseout', (evt)=>{
		divTooltip.transition()		
			.duration(500)		
			.style("opacity", 0);
	}).on('click', (evt)=>{
		if(onTipClick){
			onTipClick(tipobj);
		}
	});
}

export function printArea(id){
	if(id === undefined || id === null){
		return;
	}
	let cssurl = `${Constants.Chart3DServer}/static/umi.ff10973d.css`;
	printJS({
		printable: id,
		type: 'html',
		style: `@import url(${cssurl})`,
		maxWidth: 3000,
	});	
}
