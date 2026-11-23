// 全站文件保存单源(下载 / 保存框 / BOM 政策 / base64 互转)。
// 只依赖桌面桥,不带任何文档生成库:命盘名册、档案列表、存储健康横幅这类首屏组件只要「存个文件」,
// 从这里取就不会把 docx / jszip 一起拉进首屏。会话 docx / 工作区备份 zip 仍在 aiAnalysisExport(它原样转出这里的函数,老调用方不用改)。
import { isDesktopBridgeAvailable, saveDesktopFile } from './aiAnalysisDesktop';

// 全站下载单源:桌面壳(Tauri)里 <a download> 被壳取消 / 落默认目录且用户选不了位置,
// 且各处「桌面桥失败(含用户取消)回落浏览器下载 + 报已导出」= 取消也报成功。现统一:
//   桌面壳 → 保存桥(系统保存框选目录);取消 = 不落文件、不回落、不报成功;失败 = 返回 error 由调用方如实提示;
//   浏览器 → 原 <a download>。返回 Promise<{ ok, via, path?, cancelled?, error? }>;不 await 的老调用方仍会触发保存。
function browserAnchorDownload(fileName, blob){
	const url = (window.URL || window.webkitURL).createObjectURL(blob);
	const link = document.createElement('a');
	link.style.display = 'none';
	link.href = url;
	link.setAttribute('download', fileName);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	(window.URL || window.webkitURL).revokeObjectURL(url);
}

export function isDesktopSaveBridge(){
	return isDesktopBridgeAvailable();
}

export function isSaveCancelledError(err){
	const msg = `${(err && err.message) || err || ''}`;
	return /取消|cancel/i.test(msg);
}

export async function saveBlobSmart(fileName, blob){
	const name = `${fileName || 'download.bin'}`;
	if(isDesktopSaveBridge()){
		try{
			const base64Data = await blobToBase64(blob);
			const path = await saveDesktopFile({ defaultFileName: name, base64Data, mimeType: (blob && blob.type) || 'application/octet-stream' });
			return { ok: true, via: 'desktop', path: path || '' };
		}catch(e){
			if(isSaveCancelledError(e)){ return { ok: false, cancelled: true, via: 'desktop' }; }
			return { ok: false, via: 'desktop', error: `${(e && e.message) || e || 'desktop.save.failed'}` };
		}
	}
	try{
		browserAnchorDownload(name, blob);
		return { ok: true, via: 'browser' };
	}catch(e){
		return { ok: false, via: 'browser', error: `${(e && e.message) || e || 'download.failed'}` };
	}
}

// 调用方统一提示文案:ok → okText(桌面附路径);取消 → 「已取消保存」;失败 → 「保存失败:…」。
export function describeSaveResult(r, okText){
	if(!r){ return { type: 'error', text: '保存失败' }; }
	if(r.ok){ return { type: 'success', text: `${okText || '已导出'}${r.path ? `：${r.path}` : ''}` }; }
	if(r.cancelled){ return { type: 'info', text: '已取消保存' }; }
	return { type: 'error', text: `保存失败：${r.error || '未知错误'}` };
}

export function downloadBlob(fileName, blob){
	return saveBlobSmart(fileName, blob);
}

export function base64ToBlob(base64Data, mimeType = 'application/octet-stream'){
	const clean = `${base64Data || ''}`.split(',').pop();
	const binary = window.atob(clean);
	const bytes = new Uint8Array(binary.length);
	for(let i=0; i<binary.length; i++){
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: mimeType });
}

export function blobToBase64(blob){
	return new Promise((resolve, reject)=>{
		const reader = new FileReader();
		reader.onload = ()=>resolve(`${reader.result || ''}`.split(',').pop() || '');
		reader.onerror = ()=>reject(reader.error || new Error('blob.to.base64.failed'));
		reader.readAsDataURL(blob);
	});
}

// 文字类导出 BOM 政策单源:macOS TextEdit / Windows 记事本 / 旧版 Word 对无 BOM 的 UTF-8 文件
// 按本地默认编码(MacRoman/GBK)猜测 → 中文全乱(「技术」E6 8A 80… 被 MacRoman 解码成「ÊäÄ…」);
// BOM(EF BB BF)显式标记 UTF-8,各平台文本编辑器/Word 均正确识别。
// 仅给人读的 txt/Word(.doc html 壳)/markdown 加;JSON/CSV/docx(zip)/html 等机读或自带声明的格式
// 不加(BOM 会破坏 JSON.parse / 首列名)。幂等:已带 BOM 不重复。
export function withUtf8Bom(content, mime){
	if(typeof content === 'string' && /text\/plain|msword|text\/markdown/i.test(`${mime || ''}`) && content.charCodeAt(0) !== 0xFEFF){
		return String.fromCharCode(0xFEFF) + content;
	}
	return content;
}

export function downloadTextFile(fileName, content, type = 'text/plain;charset=utf-8'){
	return downloadBlob(fileName, new Blob([withUtf8Bom(content, type)], { type }));
}

// 名字保留(老调用方),语义已统一为「智能保存」:桌面壳走保存桥,浏览器走 <a download>。
export function saveBlobToBrowser(fileName, blob){
	return downloadBlob(fileName, blob);
}
