import { safeStorageSetOn } from './safeStorage';
const WindowSizeKey = 'horosa.window.size.v1';
const WindowSizeVersion = 1;
const MinWidth = 640;
const MinHeight = 480;
const ResizeTolerance = 24;

function getStorage(win){
	try{
		return win && win.localStorage ? win.localStorage : null;
	}catch(e){
		return null;
	}
}

function isFiniteNumber(value){
	return typeof value === 'number' && Number.isFinite(value);
}

function optionalNumber(value){
	if(value === undefined || value === null || value === ''){
		return null;
	}
	const num = Number(value);
	return isFiniteNumber(num) ? num : null;
}

function normalizeWindowSizePayload(payload){
	if(!payload || typeof payload !== 'object'){
		return null;
	}
	const width = Number(payload.width || payload.outerWidth || payload.innerWidth || 0);
	const height = Number(payload.height || payload.outerHeight || payload.innerHeight || 0);
	if(!Number.isFinite(width) || !Number.isFinite(height) || width < MinWidth || height < MinHeight){
		return null;
	}
	return {
		version: Number(payload.version || WindowSizeVersion),
		width,
		height,
		x: optionalNumber(payload.x),
		y: optionalNumber(payload.y),
		updatedAt: payload.updatedAt || null,
	};
}

function parseJson(text){
	if(!text){
		return null;
	}
	try{
		return JSON.parse(text);
	}catch(e){
		return null;
	}
}

export function readSavedWindowSize(win = typeof window !== 'undefined' ? window : null){
	const storage = getStorage(win);
	if(!storage){
		return null;
	}
	return normalizeWindowSizePayload(parseJson(storage.getItem(WindowSizeKey)));
}

export function captureWindowSize(win = typeof window !== 'undefined' ? window : null){
	if(!win){
		return null;
	}
	const width = Number(win.outerWidth || win.innerWidth || 0);
	const height = Number(win.outerHeight || win.innerHeight || 0);
	return normalizeWindowSizePayload({
		version: WindowSizeVersion,
		width,
		height,
		x: isFiniteNumber(Number(win.screenX)) ? Number(win.screenX) : null,
		y: isFiniteNumber(Number(win.screenY)) ? Number(win.screenY) : null,
		updatedAt: new Date().toISOString(),
	});
}

export function saveWindowSize(win = typeof window !== 'undefined' ? window : null){
	const storage = getStorage(win);
	const payload = captureWindowSize(win);
	if(!storage || !payload){
		return false;
	}
	try{
		return safeStorageSetOn(storage, WindowSizeKey, JSON.stringify(payload));
	}catch(e){
		return false;
	}
}

function isTauriWindow(win){
	return Boolean(win && (win.__TAURI__ || win.__TAURI_INTERNALS__));
}

// Windows-ahead fix: the Electron desktop shell self-manages window bounds, so doing
// web-layer window-size persistence on top of it caused startup resize jitter. The
// Electron preload exposes `window.horosaDesktop` (desktop_installer_bundle/electron/preload.js),
// which is the reliable in-renderer signal that we are inside the desktop shell. This is
// the Electron counterpart of isTauriWindow above. Guarded by release_selfcheck.py.
function isDesktopShellWindow(win){
	return Boolean(win && win.horosaDesktop);
}

export function restoreWindowSize(win = typeof window !== 'undefined' ? window : null){
	if(!win || isTauriWindow(win) || isDesktopShellWindow(win)){
		return false;
	}
	const saved = readSavedWindowSize(win);
	if(!saved || typeof win.resizeTo !== 'function'){
		return false;
	}
	const currentWidth = Number(win.outerWidth || win.innerWidth || 0);
	const currentHeight = Number(win.outerHeight || win.innerHeight || 0);
	const needsResize = Math.abs(currentWidth - saved.width) > ResizeTolerance
		|| Math.abs(currentHeight - saved.height) > ResizeTolerance;
	try{
		if(saved.x !== null && saved.y !== null && typeof win.moveTo === 'function'){
			win.moveTo(saved.x, saved.y);
		}
		if(needsResize){
			win.resizeTo(saved.width, saved.height);
		}
		return needsResize;
	}catch(e){
		return false;
	}
}

export function installWindowSizePersistence(win = typeof window !== 'undefined' ? window : null){
	// In the Electron desktop shell, do NOT install web-layer persistence at all — the
	// shell owns the window bounds; installing it caused startup resize jitter.
	if(!win || win.__horosaWindowSizePersistenceInstalled || isDesktopShellWindow(win)){
		return false;
	}
	win.__horosaWindowSizePersistenceInstalled = true;
	restoreWindowSize(win);
	let resizeTimer = null;
	const flush = ()=>{
		if(resizeTimer){
			clearTimeout(resizeTimer);
			resizeTimer = null;
		}
		saveWindowSize(win);
	};
	const scheduleSave = ()=>{
		if(resizeTimer){
			clearTimeout(resizeTimer);
		}
		resizeTimer = setTimeout(flush, 250);
	};
	if(typeof win.addEventListener === 'function'){
		win.addEventListener('resize', scheduleSave);
		win.addEventListener('beforeunload', flush);
		win.addEventListener('pagehide', flush);
		if(win.document && typeof win.document.addEventListener === 'function'){
			win.document.addEventListener('visibilitychange', ()=>{
				if(win.document.visibilityState === 'hidden'){
					flush();
				}
			});
		}
	}
	return true;
}
