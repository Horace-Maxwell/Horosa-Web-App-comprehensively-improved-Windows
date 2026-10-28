import {
    atImpl,
    findLastImpl,
    findLastIndexImpl,
    applyHasFallbackNow,
    installPolyfills,
} from '../legacyWebkitCompat';

describe('legacyWebkitCompat(macOS 12.0-12.2 兼容层)', () => {
    test('atImpl 负索引/越界语义与原生 at 一致', () => {
        const arr = ['a', 'b', 'c'];
        expect(atImpl.call(arr, 0)).toBe('a');
        expect(atImpl.call(arr, -1)).toBe('c');
        expect(atImpl.call(arr, 3)).toBeUndefined();
        expect(atImpl.call(arr, -4)).toBeUndefined();
        expect(atImpl.call('星阙', -1)).toBe('阙');
        [-4, -3, -2, -1, 0, 1, 2, 3].forEach((i) => {
            expect(atImpl.call(arr, i)).toBe(arr.at(i));
        });
    });

    test('findLast/findLastIndex 语义', () => {
        const a = [1, 2, 3, 4];
        expect(findLastImpl.call(a, (x) => x % 2 === 1)).toBe(3);
        expect(findLastIndexImpl.call(a, (x) => x % 2 === 1)).toBe(2);
        expect(findLastImpl.call(a, () => false)).toBeUndefined();
        expect(findLastIndexImpl.call(a, () => false)).toBe(-1);
        expect(() => findLastImpl.call(a, null)).toThrow(TypeError);
    });

    test('导入后全部特性在位(原生或填充)', () => {
        expect(typeof Array.prototype.at).toBe('function');
        expect(typeof String.prototype.at).toBe('function');
        expect(typeof Array.prototype.findLast).toBe('function');
        expect(typeof Array.prototype.findLastIndex).toBe('function');
        expect(typeof Object.hasOwn).toBe('function');
        expect(typeof window.requestIdleCallback).toBe('function');
        expect(typeof window.cancelIdleCallback).toBe('function');
        expect(typeof window.structuredClone).toBe('function');
    });

    test('填充路径:删除原生后 installPolyfills 恢复,且不可枚举不污染 for...in', () => {
        /* eslint-disable no-extend-native */
        delete Array.prototype.at;
        expect(Array.prototype.at).toBeUndefined();
        installPolyfills();
        expect(typeof Array.prototype.at).toBe('function');
        expect([9, 8].at(-1)).toBe(8);
        expect(Object.keys(Array.prototype)).not.toContain('at');
        const seen = [];
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const k in [1]) seen.push(k);
        expect(seen).toEqual(['0']);
        /* eslint-enable no-extend-native */
    });

    test('rIC 填充可调度且可取消(jsdom 无原生 rIC,导入即装)', (done) => {
        const id = window.requestIdleCallback((deadline) => {
            expect(typeof deadline.timeRemaining()).toBe('number');
            done();
        });
        expect(typeof id).toBe('number');
        const id2 = window.requestIdleCallback(() => {
            done(new Error('已取消的回调不应执行'));
        });
        window.cancelIdleCallback(id2);
    });

    test(':has 回退:tab 隐藏类的加与撤', () => {
        document.body.innerHTML = `
            <div class="horosa-workspace-shell">
              <div class="mainRootTabs ant-tabs-left">
                <div class="ant-tabs-nav">
                  <div class="ant-tabs-tab" id="t1"><span class="horosa-main-tab-hidden"></span></div>
                  <div class="ant-tabs-tab" id="t2"><span class="horosa-main-tab-label"></span></div>
                </div>
              </div>
            </div>`;
        applyHasFallbackNow();
        expect(document.getElementById('t1').classList.contains('horosa-main-tab-hidden-parent')).toBe(true);
        expect(document.getElementById('t2').classList.contains('horosa-main-tab-hidden-parent')).toBe(false);
        // 标记翻转后,回退类同步撤销
        document.getElementById('t1').innerHTML = '<span class="horosa-main-tab-label"></span>';
        applyHasFallbackNow();
        expect(document.getElementById('t1').classList.contains('horosa-main-tab-hidden-parent')).toBe(false);
    });

    test(':has 回退:底坞所在层的加与撤(只认直接父层、只认 div / section / main)', () => {
        document.body.innerHTML = `
            <div class="horosa-workspace-shell">
              <section id="p1"><div class="horosa-bottom-quick-dock"></div></section>
              <div id="g"><div id="p2"><span class="horosa-bottom-quick-dock"></span></div></div>
              <ul id="p3"><li class="horosa-bottom-quick-dock"></li></ul>
            </div>
            <div id="outside"><div class="horosa-bottom-quick-dock"></div></div>`;
        applyHasFallbackNow();
        const has = (id) => document.getElementById(id).classList.contains('horosa-bottom-quick-dock-parent');
        expect(has('p1')).toBe(true);
        expect(has('p2')).toBe(true);
        expect(has('g')).toBe(false);
        expect(has('p3')).toBe(false);
        expect(has('outside')).toBe(false);
        // 坞挪走后回退类同步撤销
        document.getElementById('p1').innerHTML = '';
        applyHasFallbackNow();
        expect(has('p1')).toBe(false);
        expect(has('p2')).toBe(true);
    });
});
