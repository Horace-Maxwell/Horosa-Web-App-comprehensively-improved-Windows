import { handleError } from './utils/helper';
import { installWindowSizePersistence } from './utils/windowSizePersistence';
import { installExternalLinkDelegate } from './utils/externalLink';

if (typeof window !== 'undefined' && typeof EventTarget !== 'undefined') {
    const proto = EventTarget.prototype;
    const addEventListener = proto && proto.addEventListener;
    if (addEventListener && !window.__horosaDomNodeInsertedPatched) {
        proto.addEventListener = function(type, listener, options) {
            if (type === 'DOMNodeInserted') {
                return;
            }
            return addEventListener.call(this, type, listener, options);
        };
        window.__horosaDomNodeInsertedPatched = true;
    }
}

installWindowSizePersistence();
// 外链一律交系统浏览器(桌面 webview 吞新窗口请求;不带 target 的外链会把主窗口导航走)
installExternalLinkDelegate();

export const dva = {
    config: {
        onError(err) {
            console.log(err);
            handleError(err);
        },
    },
}
