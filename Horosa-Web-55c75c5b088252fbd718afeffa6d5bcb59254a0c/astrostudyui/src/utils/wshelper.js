import * as rsahelper from './rsahelper';
import * as Constants from './constants';
import * as forge from 'node-forge';
import {randomStr} from './helper';

const startflag =  "_@@__@@_";
const finflag =  "_@_^^_@_";

export function uploadWSFile(ws, file){
	let reader = new FileReader();
	reader.onload = (e)=>{
		let bytes = e.target.result;
		let raw = forge.util.createBuffer(bytes, "raw").bytes();
		let b64 = forge.util.encode64(raw);
		let data = {
			data: b64,
			id: randomStr(32),
			filename: file.name,
			size: file.size,
		};
		sendData(ws, 0x0103, data);
	};

	let blob = file.slice(file.indexStart, file.indexEnd);

	reader.readAsArrayBuffer(blob);
}

export function sendRaw(ws, cmd, bytes){

}

export function sendRaw64(ws, cmd, bytes){
	let raw = forge.util.createBuffer(bytes, "raw").bytes();
	let b64 = forge.util.encode64(raw);
	return sendData(ws, cmd, b64);
}

export function sendData(ws, cmd, data){
	const usrtoken = localStorage.getItem(Constants.TokenKey);
	let dt = data;
	if(dt === undefined || dt === null){
		dt = {};
	}
	let res = {
		Cmd: cmd,
		Head: {
			Token: usrtoken,
		},
		Body: dt,
	};
	let plain = JSON.stringify(res);
	let coded = startflag + rsahelper.encryptRSA(plain) + finflag;
	ws.send(coded);
	return {
		plain: plain,
		coded: coded,
	};
}

export function recvData(txt){
	let plain = rsahelper.decryptRSA(txt);
	let obj = JSON.parse(plain);
	let res = {
		txt: plain,
		obj: obj,
	}
	return res;
}


