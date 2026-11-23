// AI 分析页空态(还没有任何消息时)的问候语:随本机钟面的时辰变;纯函数,页面与测试同源。
export function landingGreetingPrefix(hour){
	const n = Number(hour);
	const h = Number.isFinite(n) ? ((Math.floor(n) % 24) + 24) % 24 : 12;
	if(h >= 23 || h < 5){ return '夜深了'; }
	if(h < 9){ return '早上好'; }
	if(h < 12){ return '上午好'; }
	if(h < 14){ return '中午好'; }
	if(h < 18){ return '下午好'; }
	return '晚上好';
}

// 标题:没挂案例问「看哪张盘」,挂了案例问「问些什么」
export function landingTitle(opts){
	const o = opts || {};
	return `${landingGreetingPrefix(o.hour)}，${o.hasSource ? '想问些什么？' : '想看哪张盘？'}`;
}

// 标题下的一行说明:缺模型时先说缺什么;挂了案例就报案例名
export function landingHint(opts){
	const o = opts || {};
	if(!o.hasModel){ return '接好模型、选好案例，就能开始。'; }
	const title = `${o.sourceTitle || ''}`.trim();
	return title ? `已挂上「${title}」，直接问。` : '选好案例，直接问。';
}
