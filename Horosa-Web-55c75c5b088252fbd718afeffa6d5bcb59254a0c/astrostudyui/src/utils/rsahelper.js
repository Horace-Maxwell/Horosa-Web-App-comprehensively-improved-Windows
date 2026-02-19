import RSA from 'js-rsa';
import * as forge from 'node-forge';

let modulus="902563E4F9348E8366C0939BAB48D4403AA7CCD933EECF899265228512C4B72F2E30084B7CADF97132D0882A51FB814E5ADD82D676CFCFBC22ECDDCFACE8D4444BC60B5B30A53EB933321BA2FB9AA69727C03A5E6A90BDAB5895A8E179FF24CF9B0F66A4061E028EAB86FCE733254B5ED2D0CE47AF7A4CD1BB987702237F2A89FE8D86938ACD9D125CC6A1094AA291418D088D355A139E00C406045D38BD215F23F3D222352FD74AC914798FE3160B10A93C7F15319D5B44840850DF6A504E0299CD994F0A3133C7D58054AB19C43B6FEAA71AC0F61904665F345C2D99A25BD56D1CBFFFD08BE699D6FA53E1AD2ED812B8710DBA86D4CC43FF6389DEDD2888B9";
let publicexp='10001';

const keypair = new RSA.RSAKeyPair(publicexp, publicexp, modulus, 2048);


function randomKeyStr(len){
	const txt = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
		'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 
		'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_'];
	let length = len ? len : 8;
	const res= [];
	for(let i=0; i<length; i++){
		let idx = Math.floor(Math.random()*1000) % txt.length;
		res.push(txt[idx]);
	}
	return res.join('');
}

function hex2Bytes(str){
    var pos = 0;
    var len = str.length;
    if(len %2 != 0){
       return null; 
    }

    len /= 2;
    var hexA = new Array();
    for(var i=0; i<len; i++){
       var s = str.substr(pos, 2);
       var v = parseInt(s, 16);
       hexA.push(v);
       pos += 2;
    }

    return hexA;
}

const KeyLen = 16;

export function encryptRSA(txt, tm){
	let txtkey = randomKeyStr(KeyLen);
	let cipher = forge.cipher.createCipher("AES-ECB", txtkey);
	cipher.start();
	cipher.update(forge.util.createBuffer(txt, "utf8"));
	cipher.finish();
	let bytes = cipher.output.bytes();
	let encoded = forge.util.encode64(bytes);

	let rsakeyraw = RSA.encryptedString(keypair, txtkey, RSA.RSAAPP.PKCS1Padding, RSA.RSAAPP.RawEncoding);	
	let rsakey = forge.util.encode64(rsakeyraw);

	let res = encoded + ',' + rsakey;
	
	if(tm){
		let tmcipher = forge.cipher.createCipher("AES-ECB", txtkey);
		tmcipher.start();
		tmcipher.update(forge.util.createBuffer(tm+'', "utf8"));
		tmcipher.finish();
		let tmbytes = tmcipher.output.bytes();
		let tmencoded = forge.util.encode64(tmbytes);
		res = `${res},${tmencoded}`
	}

	return res;
}

export function decryptRSA(txt){
	let parts = txt.split(',');
	let keyWordAry = forge.util.decode64(parts[1]);
	let keycoded = forge.util.createBuffer(keyWordAry).toHex();
	let txtkeyStr = RSA.decryptedString(keypair, keycoded);
	let txtkey = extractKey(txtkeyStr);

	let coded = forge.util.decode64(parts[0])
	let decipher = forge.cipher.createDecipher("AES-ECB", txtkey);
	decipher.start();
	decipher.update(forge.util.createBuffer(coded));
	decipher.finish();
	let plainraw = decipher.output.bytes();
	let plain = forge.util.decodeUtf8(plainraw);
	return plain;
}

function extractKey(data){
	let key = '';
	for(let i=KeyLen - 1; i>=0; i--){
		key += data[i];
	}
	return key;
}


