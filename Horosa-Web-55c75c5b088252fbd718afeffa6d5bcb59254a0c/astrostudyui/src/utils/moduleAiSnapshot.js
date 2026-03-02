const MODULE_SNAPSHOT_PREFIX = 'horosa.ai.snapshot.module.v1.';
const MODULE_SNAPSHOT_MEMORY = {};

function snapshotKey(moduleName){
	return `${MODULE_SNAPSHOT_PREFIX}${moduleName}`;
}

export function saveModuleAISnapshot(moduleName, content, meta){
	try{
		if(!moduleName){
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
		MODULE_SNAPSHOT_MEMORY[moduleName] = payload;
		if(typeof window !== 'undefined' && window.localStorage){
			window.localStorage.setItem(snapshotKey(moduleName), JSON.stringify(payload));
		}
		return payload;
	}catch(e){
		const text = (content || '').trim();
		if(!moduleName || !text){
			return null;
		}
		const payload = {
			module: moduleName,
			version: 1,
			createdAt: new Date().toISOString(),
			meta: meta || {},
			content: text,
		};
		MODULE_SNAPSHOT_MEMORY[moduleName] = payload;
		return payload;
	}
}

export function loadModuleAISnapshot(moduleName){
	try{
		if(!moduleName){
			return null;
		}
		if(typeof window !== 'undefined' && window.localStorage){
			const raw = window.localStorage.getItem(snapshotKey(moduleName));
			if(raw){
				const data = JSON.parse(raw);
				if(data && data.content){
					MODULE_SNAPSHOT_MEMORY[moduleName] = data;
					return data;
				}
			}
		}
		return MODULE_SNAPSHOT_MEMORY[moduleName] || null;
	}catch(e){
		return MODULE_SNAPSHOT_MEMORY[moduleName] || null;
	}
}
