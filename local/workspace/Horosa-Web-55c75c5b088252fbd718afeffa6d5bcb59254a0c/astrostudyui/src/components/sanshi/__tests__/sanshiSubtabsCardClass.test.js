// 三式右栏:卡身直接装内层页签(.horosa-sanshi-liureng-tabs)的卡片必须打 .horosa-sanshi-subtabs-card ——
// 样式靠这个类让卡身不滚、内层内容区自己滚(导航宽度不再随内容高变);不用 :has(旧 WebView 不认)。
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'SanShiUnitedMain.js'), 'utf8');
const LESS = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'layouts', 'app', '22-tail-fixes.less'), 'utf8');

test('卡身直接装内层页签的卡片都带 horosa-sanshi-subtabs-card;没直接装的不带', ()=>{
	const lines = SRC.split('\n');
	const direct = [];
	const tagged = [];
	lines.forEach((l, i)=>{
		if(/<Card\b/.test(l)){
			// 卡片开标签后的第一个非空行是 <Tabs,且这组 Tabs 打了内层页签类 = 卡身直接装内层页签
			let j = i + 1;
			while(j < lines.length && !lines[j].trim()){ j += 1; }
			if(/^\s*<Tabs\b/.test(lines[j] || '')){
				let k = j;
				while(k < lines.length && !/>\s*$/.test(lines[k])){ k += 1; }
				if(lines.slice(j, k + 1).join('\n').indexOf('className="horosa-sanshi-liureng-tabs"') >= 0){ direct.push(i + 1); }
			}
			if(l.indexOf('horosa-sanshi-subtabs-card') >= 0){ tagged.push(i + 1); }
		}
	});
	expect(direct.length).toBeGreaterThanOrEqual(2);
	expect(tagged).toEqual(direct);
});

test('样式按类命中,不用 :has', ()=>{
	expect(LESS).toContain('.ant-card.horosa-sanshi-subtabs-card > .ant-card-body {');
	expect(LESS).not.toMatch(/:has\(> \.horosa-sanshi-liureng-tabs\)/);
});
