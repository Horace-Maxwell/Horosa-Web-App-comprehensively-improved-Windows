// 择日工作台(*ZeriWorkbench 与天星条件构建框)共用的条件树小工具,原先各抄一份、逐字相同,收成单一来源:
// 方案导出存文件 / 连接门选项 / 树路径取改删 / UI 叶 DFS 收集 / 判读树门名 / 日期串。
import { saveBlobSmart } from '../../utils/aiAnalysisExport';
import { ZERI_GATE_CN } from '../../divination/zeri/zeriExplainText';
import { pad2 } from './zeriHostUtils';

// 存 JSON 文件:桌面壳走保存桥选目录,浏览器走 <a download>;取消 / 失败静默,不报成功。
export function downloadJson(text, filename){
	try{
		return saveBlobSmart(filename, new Blob([text], { type: 'application/json;charset=utf-8' }));
	}catch(e){ return null; /* 受限 webview 环境静默 */ }
}

export const JOINER_OPTIONS = [
	{ value: 'all', label: '且 AND' },
	{ value: 'any', label: '或 OR' },
	{ value: 'xor', label: '异或 XOR' },
];

// ── 树路径纯工具(path=[]=根;[i,j]=children 索引链) ──
export function getAt(tree, path){
	let node = tree;
	for(const i of path){
		if(!node || !node.children){ return null; }
		node = node.children[i];
	}
	return node || null;
}
export function mapAt(tree, path, fn){
	if(!path.length){ return fn(tree); }
	const [head, ...rest] = path;
	return { ...tree, children: tree.children.map((c, i) => (i === head ? mapAt(c, rest, fn) : c)) };
}
export function removeAt(tree, path){
	if(!path.length){ return tree; }
	const parent = path.slice(0, -1);
	const idx = path[path.length - 1];
	return mapAt(tree, parent, (g) => ({ ...g, children: g.children.filter((_, i) => i !== idx) }));
}

export function collectUiLeaves(node, out){
	if(!node){ return out; }
	if(node.kind === 'leaf'){ out.push(node); return out; }
	(node.children || []).forEach((c) => collectUiLeaves(c, out));
	return out;
}

// 判读树门名:与择日快照判读行同一张表。
export const GATE_CN2 = ZERI_GATE_CN;

export { pad2 };
export function dateStrOf(d){ return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
