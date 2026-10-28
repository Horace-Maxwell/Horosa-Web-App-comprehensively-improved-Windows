// 印度择日「本命月宿 / 本命月座」→ 后端请求体的 natal 段。单一出处:择日页与外部调用(search_zeri / explain_zeri)同引。
// 界面与外部参数:月宿 1..27、月座 1..12(0 / 空 = 未设);后端月座按 0..11。两项都没设 → null(请求体不带 natal)。
export function indiaNatalPayload(moonNak, moonSign){
	const nak = Number(moonNak);
	const sign = Number(moonSign);
	const natal = {};
	if(Number.isInteger(nak) && nak >= 1 && nak <= 27){ natal.moonNak = nak; }
	if(Number.isInteger(sign) && sign >= 1 && sign <= 12){ natal.moonSign = sign - 1; }
	return Object.keys(natal).length ? natal : null;
}
