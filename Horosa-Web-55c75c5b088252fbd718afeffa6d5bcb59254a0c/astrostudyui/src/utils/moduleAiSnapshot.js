const MODULE_SNAPSHOT_PREFIX = 'horosa.ai.snapshot.module.v1.';

function snapshotKey(moduleName){
	return `${MODULE_SNAPSHOT_PREFIX}${moduleName}`;
}

export function saveModuleAISnapshot(moduleName, content, meta){
	try{
		if(typeof window === 'undefined' || !window.localStorage || !moduleName){
			return null;
		}
		const text = (content || '').trim();
		if(!text){
			return null;
		}
		const payload = {
			module: moduleName,
			version: 1,
			createdAt: new Date().toISOString(),
			meta: meta || {},
			content: text,
		};
		window.localStorage.setItem(snapshotKey(moduleName), JSON.stringify(payload));
		return payload;
	}catch(e){
		return null;
	}
}

export function loadModuleAISnapshot(moduleName){
	try{
		if(typeof window === 'undefined' || !window.localStorage || !moduleName){
			return null;
		}
		const raw = window.localStorage.getItem(snapshotKey(moduleName));
		if(!raw){
			return null;
		}
		const data = JSON.parse(raw);
		if(!data || !data.content){
			return null;
		}
		return data;
	}catch(e){
		return null;
	}
}
