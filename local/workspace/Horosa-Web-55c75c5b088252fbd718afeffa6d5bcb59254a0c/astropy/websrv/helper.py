import hashlib
import json
import os
import threading
import time

import cherrypy

# supprt crossdomain ajax script
def enable_crossdomain():
    if cherrypy.request.method == 'OPTIONS':
        # preflign request
        # see http://www.w3.org/TR/cors/#cross-origin-request-with-preflight-0
        cherrypy.response.headers['Access-Control-Allow-Methods'] = 'GET, POST, HEAD, PUT, DELETE, OPTIONS'
        cherrypy.response.headers['Access-Control-Allow-Headers'] = 'Accept, Accept-Encoding, Accept-Language, Host, Origin, X-Requested-With, Content-Type, User-Agent, Content-Length, Last-Modified, Access-Control-Request-Headers, HTTP_X_REAL_IP, HTTP_X_FORWARDED_FOR, x-forwarded-for, Token, x-remote-IP, x-originating-IP, x-remote-addr, x-remote-ip, x-client-ip, x-client-IP, X-Real-ip, ImgTokenListName, SmsTokenListName, _IMGTOKENLIST, _SMSTOKENLIST, Signature, LocalIp, ClientChannel, ClientApp, ClientVer'
        cherrypy.response.headers['Access-Control-Allow-Origin'] = '*'
        # tell CherryPy no avoid normal handler
        return True
    else:
        cherrypy.response.headers['Access-Control-Allow-Origin'] = '*'


def build_param_error_response(err):
    detail = None
    try:
        detail = f"{type(err).__name__}: {err}"
    except Exception:
        detail = "unknown error"
    # Keep the payload compact to avoid huge toast/messages on UI.
    if detail and len(detail) > 500:
        detail = detail[:500] + "..."
    err_msg = 'param error'
    if detail:
        err_msg = f'param error: {detail}'
    return {
        'err': err_msg,
        'detail': detail
    }


class RequestResultCache:
    def __init__(self, max_entries=64, ttl_sec=900, persist_dir=None):
        self.max_entries = max_entries
        self.ttl_sec = ttl_sec
        self.persist_dir = persist_dir
        self._lock = threading.Lock()
        self._items = {}
        if self.persist_dir:
            os.makedirs(self.persist_dir, exist_ok=True)

    def _make_key(self, scope, payload):
        try:
            txt = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':'), default=str)
        except Exception:
            txt = str(payload)
        return f'{scope}|{txt}'

    def _cache_path(self, key):
        if not self.persist_dir:
            return None
        digest = hashlib.sha256(key.encode('utf-8')).hexdigest()
        return os.path.join(self.persist_dir, f'{digest}.json')

    def _read_persisted(self, key, now):
        cache_path = self._cache_path(key)
        if not cache_path or not os.path.isfile(cache_path):
            return None
        try:
            mtime = os.path.getmtime(cache_path)
            if (now - mtime) > self.ttl_sec:
                return None
            with open(cache_path, 'r', encoding='utf-8') as fh:
                return fh.read()
        except Exception:
            return None

    def _write_persisted(self, key, value):
        cache_path = self._cache_path(key)
        if not cache_path:
            return
        tmp_path = f'{cache_path}.tmp'
        try:
            with open(tmp_path, 'w', encoding='utf-8') as fh:
                fh.write(value)
            os.replace(tmp_path, cache_path)
        except Exception:
            try:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass

    def get_or_compute(self, scope, payload, builder):
        key = self._make_key(scope, payload)
        now = time.time()
        with self._lock:
            hit = self._items.get(key)
            if hit and (now - hit['ts']) <= self.ttl_sec:
                return hit['value']
            expired = [k for k, v in self._items.items() if (now - v['ts']) > self.ttl_sec]
            for old in expired:
                self._items.pop(old, None)

        persisted = self._read_persisted(key, now)
        if persisted is not None:
            with self._lock:
                self._items[key] = {
                    'ts': now,
                    'value': persisted,
                }
            return persisted

        value = builder()

        with self._lock:
            self._items[key] = {
                'ts': now,
                'value': value,
            }
            if len(self._items) > self.max_entries:
                oldest = min(self._items.items(), key=lambda kv: kv[1]['ts'])[0]
                self._items.pop(oldest, None)
        self._write_persisted(key, value)
        return value


def get_request_cache_dir(namespace):
    root = os.environ.get('HOROSA_REQUEST_CACHE_DIR')
    if not root:
        local_app_data = os.environ.get('LOCALAPPDATA')
        if local_app_data:
            root = os.path.join(local_app_data, 'HorosaDesktop', 'request-cache')
        else:
            root = os.path.join(os.path.expanduser('~'), '.horosa-desktop', 'request-cache')
    path = os.path.join(root, namespace)
    os.makedirs(path, exist_ok=True)
    return path
