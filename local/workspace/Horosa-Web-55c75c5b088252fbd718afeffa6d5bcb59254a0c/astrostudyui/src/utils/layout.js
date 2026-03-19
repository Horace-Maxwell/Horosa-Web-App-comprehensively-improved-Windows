export const TAB_BOTTOM_SAFE_GAP = 16;
export const MIN_MODULE_HEIGHT = 320;

function toNumber(val){
	if(typeof val === 'number' && Number.isFinite(val)){
		return val;
	}
	if(typeof val === 'string'){
		const txt = val.trim();
		if(/^[-+]?\d+(\.\d+)?(px)?$/i.test(txt)){
			const parsed = parseFloat(txt);
			return Number.isFinite(parsed) ? parsed : null;
		}
	}
	return null;
}

export function getContentHostHeight(fallback = 760){
	if(typeof document === 'undefined'){
		return fallback;
	}
	const ids = ['workspaceContentHost', 'mainContentInner', 'mainContent', 'root'];
	for(let i=0; i<ids.length; i++){
		const node = document.getElementById(ids[i]);
		if(node && Number.isFinite(node.clientHeight) && node.clientHeight > 0){
			return node.clientHeight;
		}
	}
	const doc = document.documentElement;
	if(doc && Number.isFinite(doc.clientHeight) && doc.clientHeight > 0){
		return doc.clientHeight;
	}
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return window.innerHeight;
	}
	return fallback;
}

export function normalizeContentHeight(rawHeight, options = {}){
	const fallback = options.fallback !== undefined ? options.fallback : 760;
	const minHeight = options.minHeight !== undefined ? options.minHeight : MIN_MODULE_HEIGHT;
	const subtract = options.subtract !== undefined ? options.subtract : 0;
	let baseHeight = toNumber(rawHeight);
	if(baseHeight === null){
		baseHeight = getContentHostHeight(fallback);
	}
	const normalizedBase = Math.max(minHeight, Math.floor(baseHeight));
	return Math.max(minHeight, normalizedBase - subtract);
}

export function getRectBottomLimit(containerNode, subjectNode, fallbackHeight = 760, gap = TAB_BOTTOM_SAFE_GAP){
	const fallbackBottom = getContentHostHeight(fallbackHeight);
	const containerRect = containerNode && typeof containerNode.getBoundingClientRect === 'function'
		? containerNode.getBoundingClientRect()
		: null;
	const subjectRect = subjectNode && typeof subjectNode.getBoundingClientRect === 'function'
		? subjectNode.getBoundingClientRect()
		: null;
	const containerBottom = containerRect && Number.isFinite(containerRect.bottom) ? containerRect.bottom : fallbackBottom;
	const subjectTop = subjectRect && Number.isFinite(subjectRect.top) ? subjectRect.top : 0;
	const limit = Math.max(0, containerBottom - subjectTop - gap);
	return {
		containerBottom,
		subjectTop,
		limit,
	};
}
