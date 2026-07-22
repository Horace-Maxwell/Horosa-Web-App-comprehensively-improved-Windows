/**
 * 前缀缓存断点标记 —— 前后端契约守卫。
 *
 * 该标记由前端埋进 system 文本、由后端 AI 代理解析:anthropic 按它切 system 数组块并打
 * cache_control;OpenAI 家族剥标记吃厂商自动前缀缓存;其余 provider 剥净。**两端字面量一旦
 * 漂移,标记就会原样混进 prompt 正文**(用户可见的乱码串),且前缀缓存全盘失效、成本回退。
 * 故此处以源码级断言把两端钉死;任一端改字面量而另一端未同改,本测试即红。
 */
const fs = require('fs');
const path = require('path');

const FE_FILE = path.resolve(__dirname, '../../components/aianalysis/AIAnalysisMain.js');
const BE_FILE = path.resolve(
	__dirname,
	'../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/service/AIAnalysisProxyService.java',
);

// 读源码:AIAnalysisMain 含大量中英混排,一律按 utf8 读全文(勿用会按二进制早退的工具)。
function read(file){
	return fs.readFileSync(file, 'utf8');
}

describe('前缀缓存断点标记 · 前后端契约', ()=>{
	const fe = read(FE_FILE);

	it('前端定义了断点常量', ()=>{
		const m = fe.match(/const\s+PROMPT_CACHE_BP\s*=\s*'([^']+)'/);
		expect(m).toBeTruthy();
		expect(m[1]).toBe('[[__CACHE_BP__]]');
	});

	it('后端同名常量与前端逐字节一致（漂移则标记会混进正文且缓存失效）', ()=>{
		if(!fs.existsSync(BE_FILE)){
			// 仅前端仓的检出场景:跳过跨端断言,前端侧断言仍生效。
			return;
		}
		const be = read(BE_FILE);
		const feM = fe.match(/const\s+PROMPT_CACHE_BP\s*=\s*'([^']+)'/);
		const beM = be.match(/String\s+PROMPT_CACHE_BP\s*=\s*"([^"]+)"/);
		expect(beM).toBeTruthy();
		expect(beM[1]).toBe(feM[1]);
	});

	it('分层:挥发层键固定为检索命中与近期对话，且仅在两层俱全时才插断点', ()=>{
		// 稳定层必须整体在前、挥发层在后,否则前缀跨轮改变=缓存永不命中。
		expect(fe).toMatch(/_volatileKeys\s*=\s*\{\s*'retrieved-context':\s*1,\s*'recent-history':\s*1\s*\}/);
		// 仅 anthropic / openai 家族走分层;两层俱全才插标记(缺一层插了也无意义)。
		expect(fe).toMatch(/_stableL\.length\s*&&\s*_volatileL\.length/);
		expect(fe).toMatch(/join\(`\\n\\n\$\{PROMPT_CACHE_BP\}\\n\\n`\)/);
	});

	it('不走分层时与旧拼法逐字同式（零回归）', ()=>{
		// else 分支必须仍是「全部层按 title\ncontent 拼、\n\n 相连、trim」——与 buildPromptContext 同式。
		expect(fe).toMatch(/_sysJoined\s*=\s*_joinLayers\(clipDetail\.kept\)/);
		expect(fe).toMatch(/_joinLayers\s*=\s*\(arr\)=>arr\.map\(\(item\)=>`\$\{item\.title\}\\n\$\{item\.content\}`\)\.join\('\\n\\n'\)\.trim\(\)/);
	});
});
