import { loadModuleAISnapshot, saveModuleAISnapshot } from '../moduleAiSnapshot';

describe('moduleAiSnapshot', ()=>{
	beforeEach(()=>{
		window.localStorage.clear();
		jest.restoreAllMocks();
	});

	test('save/load roundtrip trims content and keeps meta', ()=>{
		const saved = saveModuleAISnapshot('liureng_roundtrip', '  [起盘信息]\n测试内容  ', { source: 'test' });
		expect(saved).not.toBeNull();
		expect(saved.content).toBe('[起盘信息]\n测试内容');
		expect(saved.meta).toEqual({ source: 'test' });

		const loaded = loadModuleAISnapshot('liureng_roundtrip');
		expect(loaded).not.toBeNull();
		expect(loaded.content).toBe('[起盘信息]\n测试内容');
		expect(loaded.meta).toEqual({ source: 'test' });
	});

	test('returns null for empty module or empty content', ()=>{
		expect(saveModuleAISnapshot('', 'text', {})).toBeNull();
		expect(saveModuleAISnapshot('liureng_empty', '   ', {})).toBeNull();
		expect(loadModuleAISnapshot('')).toBeNull();
	});

	test('falls back to in-memory snapshot when localStorage read/write throws', ()=>{
		const storageProto = Object.getPrototypeOf(window.localStorage);
		const setSpy = jest.spyOn(storageProto, 'setItem').mockImplementation(()=>{
			throw new Error('quota exceeded');
		});

		const saved = saveModuleAISnapshot('liureng_memory_fallback', '内容A', { mode: 'memory' });
		expect(saved).not.toBeNull();
		expect(saved.content).toBe('内容A');
		setSpy.mockRestore();

		const getSpy = jest.spyOn(storageProto, 'getItem').mockImplementation(()=>{
			throw new Error('storage blocked');
		});
		const loaded = loadModuleAISnapshot('liureng_memory_fallback');
		expect(loaded).not.toBeNull();
		expect(loaded.content).toBe('内容A');
		expect(loaded.meta).toEqual({ mode: 'memory' });
		getSpy.mockRestore();
	});
});
