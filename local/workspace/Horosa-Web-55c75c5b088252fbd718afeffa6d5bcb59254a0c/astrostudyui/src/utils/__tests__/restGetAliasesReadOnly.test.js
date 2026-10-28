// 合同:壳侧本机 REST 的 GET 别名(常用读操作走 GET + 查询串)只能指向只读工具,且不是界面类 ——
// 写入 / 改持久状态的工具只能 POST /tools/{name}(经同一套审批与账本)。级别以页面工具目录为准(壳不按名定级)。
import fs from 'fs';
import path from 'path';
import { registerBuiltinTools } from '../aiTools';
import { listTools, __resetToolsForTests } from '../aiTools/registry';

const REST = path.resolve(__dirname, '../../../../../Horosa_Desktop_Installer/src-tauri/src/rest_api.rs');

test('GET 别名表里的每件工具都是只读级、非界面类', ()=>{
	if(!fs.existsSync(REST)){ return; }   // 检出里没有壳源码(只有前端)不判
	const src = fs.readFileSync(REST, 'utf8');
	const block = src.slice(src.indexOf('pub const GET_ALIASES'), src.indexOf('];', src.indexOf('pub const GET_ALIASES')));
	const names = [];
	const re = /\(\s*"[^"]+"\s*,\s*"([a-z_]+)"\s*\)/g;
	let m;
	while((m = re.exec(block))){ names.push(m[1]); }
	expect(names.length).toBeGreaterThanOrEqual(5);
	__resetToolsForTests();
	registerBuiltinTools();
	const bad = names.filter((n)=>{ const d = listTools().find((x)=>x.name === n); return !d || d.level !== 'read' || d.category === 'ui'; });
	expect(bad).toEqual([]);
});
