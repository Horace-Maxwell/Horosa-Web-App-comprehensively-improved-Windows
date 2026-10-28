// 在隐藏 iframe 里打印一份完整 HTML 文档(系统打印对话框里可「存储为 PDF」)。
// 为什么不用 window.open('', '_blank') + document.write:桌面 webview 不处理新窗口请求,window.open 返回 null,点了没反应。
// 返回 Promise<boolean>:已发起打印 = true;环境不支持 / 出错 = false(调用方据此提示,不静默)。
export function printHtmlDocument(html, opts){
	const o = opts || {};
	const doc = o.doc || (typeof document !== 'undefined' ? document : null);
	const settleMs = o.settleMs == null ? 150 : o.settleMs;
	const capMs = o.capMs == null ? 1500 : o.capMs;
	const cleanupMs = o.cleanupMs == null ? 60000 : o.cleanupMs;
	if(!doc || !doc.body || typeof doc.createElement !== 'function' || !html){
		return Promise.resolve(false);
	}
	let iframe = null;
	const remove = ()=>{ try{ if(iframe && iframe.parentNode){ iframe.parentNode.removeChild(iframe); } }catch(e){ /* 已移除 */ } };
	try{
		iframe = doc.createElement('iframe');
		iframe.setAttribute('aria-hidden', 'true');
		iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
		doc.body.appendChild(iframe);
		const iwin = iframe.contentWindow;
		const idoc = iwin && iwin.document;
		if(!idoc || typeof iwin.print !== 'function'){ remove(); return Promise.resolve(false); }
		idoc.open();
		idoc.write(`${html}`);
		idoc.close();
		return new Promise((resolve)=>{
			let fired = false;
			const go = ()=>{
				if(fired){ return; }
				fired = true;
				const imgs = Array.from(idoc.images || []);
				Promise.all(imgs.map((im)=>(im.complete ? null : new Promise((r)=>{ im.onload = r; im.onerror = r; setTimeout(r, 2000); })))).then(()=>{
					try{
						try{ iwin.onafterprint = ()=>setTimeout(remove, 300); }catch(e){ /* 只读 */ }
						try{ iwin.focus(); }catch(e){ /* 无焦点 */ }
						iwin.print();
						setTimeout(remove, cleanupMs);   // 有的 webview 不发 afterprint
						resolve(true);
					}catch(e){
						remove();
						resolve(false);
					}
				});
			};
			if(idoc.readyState === 'complete'){ setTimeout(go, settleMs); }
			else{ iframe.onload = ()=>setTimeout(go, settleMs); }
			setTimeout(go, capMs);
		});
	}catch(e){
		remove();
		return Promise.resolve(false);
	}
}
