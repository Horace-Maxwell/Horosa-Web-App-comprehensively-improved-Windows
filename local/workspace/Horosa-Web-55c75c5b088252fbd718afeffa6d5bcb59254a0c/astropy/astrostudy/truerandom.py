# -*- coding: utf-8 -*-
"""真随机起卦:系统随机源与「真随机记录」。

随机起卦(地占 / 五兆 / 荆诀 / 太玄的随机起法)的每一个随机决定,都直接取自操作系统的随机源
(os.urandom,即内核熵池;macOS 上由芯片的硬件随机数发生器持续注入),不再经过按公式推数的伪随机数发生器。

为了让存下来的卦例能原样重开,一次随机起卦取到的那段系统随机字节以「真随机记录」的形式随卦例保存
(写法:``tr1-`` 加十六进制;与前端 utils/trueRandom.js、utils/entropyTape.js 同一约定)。
引擎用 TapeRandom 按顺序直接读这段字节来定每一个随机决定 —— 重开卦例是回放记录,不是重新算一串数。

读法(固定下来就不能再改,改了旧卦例重开就不是原来那一卦):
  * 位序:逐字节、每个字节从最高位到最低位;getrandbits(k) 连读 k 位;
  * [0, n) 内取整数:读 ⌈log2 n⌉ 位,读到的数不小于 n 就丢掉重读(拒绝采样,区间内严格等概率;n = 1 不读)——
    与前端 entropyReader.int 同一读法,一枚钱正好读 1 位;
  * 记录读完了:正常起的卦取的字节数留足了余量,读不完。只有手改过记录、或起卦后换了更费随机位的设置才会读到头,
    这时用「记录全文 + 序号」的 SHA-256 接着往下读 —— 仍然只由这条记录决定,同样可以原样重开。

手动种子、时间起卦本来就是「同样的输入必出同样的结果」的确定性起法,仍走原来的种子路径,旧卦例逐字节照旧。
"""
import contextlib
import hashlib
import random
import re
import secrets
import threading

ENTROPY_SEED_PREFIX = "tr1-"
DEFAULT_ENTROPY_BYTES = 32
_ENTROPY_SEED_RE = re.compile(r"^tr1-(?:[0-9a-fA-F]{2})+$")


def new_entropy_seed(nbytes=DEFAULT_ENTROPY_BYTES):
    """取 nbytes 个系统随机字节,写成真随机记录。"""
    return ENTROPY_SEED_PREFIX + secrets.token_hex(int(nbytes))


def is_entropy_seed(seed):
    return isinstance(seed, str) and bool(_ENTROPY_SEED_RE.match(seed))


def entropy_seed_bytes(seed):
    """记录里的原始字节;不是真随机记录 → None。"""
    if not is_entropy_seed(seed):
        return None
    return bytes.fromhex(seed[len(ENTROPY_SEED_PREFIX):])


def request_entropy_seed(value):
    """请求里的种子若是真随机记录则返回它(去首尾空白),否则 None。"""
    text = value.strip() if isinstance(value, str) else None
    return text if is_entropy_seed(text) else None


def seed_display_text(seed):
    """写给人看的种子:真随机记录很长,只写开头 8 位作短指纹;其它种子原样。与前端 seedDisplayText 同一写法。"""
    if seed is None:
        return ""
    if not is_entropy_seed(seed):
        return str(seed)
    digits = seed[len(ENTROPY_SEED_PREFIX):].lower()
    if len(digits) <= 16:
        return "真随机 " + digits
    return "真随机 %s…" % digits[:8]


class TapeRandom(random.Random):
    """按顺序直接读「真随机记录」里的随机位。

    只重写取随机位的底层方法;randint / choice / sample / shuffle 等都由标准库在其上推出。
    """

    def __init__(self, tape):
        self._tape = bytes(tape)
        if not self._tape:
            raise ValueError("TapeRandom: 记录不能为空")
        self._chunk = self._tape
        self._pos = 0
        self._acc = 0
        self._nbits = 0
        self._extended = 0
        self._used = 0
        super().__init__()

    @classmethod
    def from_seed(cls, seed):
        data = entropy_seed_bytes(seed)
        if data is None:
            raise ValueError("TapeRandom.from_seed: 不是真随机记录")
        return cls(data)

    # Random.__init__ 会调 seed();这里没有可播的种,只把高斯缓存清掉(与基类 seed 的收尾一致)。
    def seed(self, *args, **kwds):
        self.gauss_next = None

    def _next_byte(self):
        if self._pos >= len(self._chunk):
            self._chunk = hashlib.sha256(self._tape + self._extended.to_bytes(4, "big")).digest()
            self._extended += 1
            self._pos = 0
        value = self._chunk[self._pos]
        self._pos += 1
        return value

    def getrandbits(self, k):
        if k < 0:
            raise ValueError("number of bits must be non-negative")
        if k == 0:
            return 0
        while self._nbits < k:
            self._acc = (self._acc << 8) | self._next_byte()
            self._nbits += 8
        rest = self._nbits - k
        value = self._acc >> rest
        self._acc &= (1 << rest) - 1
        self._nbits = rest
        self._used += k
        return value

    def random(self):
        return self.getrandbits(53) * (1.0 / (1 << 53))

    # 标准库取 [0, n) 整数的内部钩子(randrange / randint / choice / shuffle / sample 都经它)。
    # 标准库自己的写法每次读 n.bit_length() 位,n 是 2 的幂时白丢一半;这里按上面约定的读法读 (n-1).bit_length() 位。
    def _randbelow(self, n):
        if n <= 1:
            return 0
        k = (n - 1).bit_length()
        value = self.getrandbits(k)
        while value >= n:
            value = self.getrandbits(k)
        return value

    def fork(self, nbytes=16):
        """切出固定长度的一段作子记录(子过程用多用少都不挪动后面的读取位置)。"""
        return TapeRandom(self.getrandbits(8 * int(nbytes)).to_bytes(int(nbytes), "big"))

    @property
    def bits_used(self):
        return self._used

    @property
    def extended(self):
        """续接过几块(0 = 全部读自记录原文)。"""
        return self._extended

    def getstate(self):
        raise NotImplementedError("TapeRandom 没有可导出的内部状态")

    def setstate(self, state):
        raise NotImplementedError("TapeRandom 没有可导入的内部状态")


def system_random():
    """当场取数用(不需要重开的场合):每次都直接向系统随机源要。"""
    return random.SystemRandom()


# 标准库 random 的模块级函数都是同一个隐藏实例的绑定方法;内置的第三方引擎直接调 random.sample / random.randint,
# 临时把这些名字换到指定的随机源上,引擎源码一行不动。
_GLOBAL_INSTANCE = getattr(random, "_inst", None)
_PATCHABLE = tuple(
    name for name in getattr(random, "__all__", ())
    if _GLOBAL_INSTANCE is not None and getattr(getattr(random, name, None), "__self__", None) is _GLOBAL_INSTANCE
)
_GLOBAL_LOCK = threading.RLock()


@contextlib.contextmanager
def global_random_from(rng):
    """块内把标准库的模块级随机函数换成 rng 的同名方法,出块还原(整段持锁,带种子的起卦逐个进行)。"""
    with _GLOBAL_LOCK:
        saved = {name: getattr(random, name) for name in _PATCHABLE}
        try:
            for name in _PATCHABLE:
                method = getattr(rng, name, None)
                if method is not None:
                    setattr(random, name, method)
            yield rng
        finally:
            for name, func in saved.items():
                setattr(random, name, func)


def run_seeded(seed, func):
    """按种子跑 func:真随机记录 → 回放记录;其它(整数 / 旧种子)→ 标准库按种子播种,结束后还原全局状态。"""
    with _GLOBAL_LOCK:
        if is_entropy_seed(seed):
            with global_random_from(TapeRandom.from_seed(seed)):
                return func()
        state = random.getstate()
        try:
            random.seed(seed)
            return func()
        finally:
            random.setstate(state)
