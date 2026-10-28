// 开机副作用:装表格内观察器延帧垫片(见 deferredResizeObserver.installTableResizeObserverDefer)。由 global.js 第一批 import 引入。
import { installTableResizeObserverDefer } from './deferredResizeObserver';

try{ installTableResizeObserverDefer(); }catch(e){ /* 非浏览器环境零影响 */ }
