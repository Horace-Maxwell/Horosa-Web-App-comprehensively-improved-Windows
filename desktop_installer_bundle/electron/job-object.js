// v2.5.4 启动稳健化 ② — Windows Job Object (KILL_ON_JOB_CLOSE)
//
// 镜像清单 docs/windows-启动稳健化-镜像清单.md ②:
// Electron 崩溃 / 被强杀 → 子进程(python.exe + java.exe + appcds jcmd) 会变成孤儿、持续占口占内存。
// 日积月累后用户报告「端口被占用 / 后端起不来」。
//
// 用 Windows Job Object 把当前 Electron 进程关联到一个设了 JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE 的 job —
// 之后 spawn 出的子进程会自动继承该 job 关系，于是 Electron 一旦退出(含崩溃 / OOM / 外部 taskkill)，
// OS 会自动连带终止 job 内所有进程(含我们的 python.exe / java.exe / jcmd)。
//
// 必须在任何 child_process.spawn 之前调用 attachJobObject(logger)。
//
// **铁律 — 增量 + 回退**：Job Object 创建 / 关联失败时 try/catch 吞掉、不抛错、不阻断启动。
// 现有的 taskkill /T /F (计划内退出) + findPort (绕占用) + crash-handler 仍作为双保险。
//
// 对应 macOS：main.rs 用 setpgid + killpg，同义、API 不同。

'use strict';

const KOFFI_NS_NAME = 'horosa-job-object';

// Window Job Object 常量
const JobObjectExtendedLimitInformation = 9;
const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
// JOB_OBJECT_LIMIT_BREAKAWAY_OK = 0x800: 子进程被允许在创建时显式 CREATE_BREAKAWAY_FROM_JOB
// 跳出本 job。我们不开 — 期望全部子进程随 Electron 死。
// JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK = 0x1000: 同上，但不需显式标志。也不开。
// JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION = 0x400: 不开 — 不希望 Java 一个未处理异常拖垮全部。

let attached = null; // null = 未尝试; { ok: true | false, reason?: string }
let jobHandle = null; // 保留 GC 防回收(KILL_ON_JOB_CLOSE 在 handle close 时触发，需保持开)

function isWindows() {
  return process.platform === 'win32';
}

// 安全 require koffi —— 没装 / 加载失败 → 静默回退(不抛)。
function tryRequireKoffi() {
  try {
    return require('koffi');
  } catch (e) {
    return null;
  }
}

// 一次性把当前进程绑入 Job Object；幂等（重复调用直接返回上次结果）。
function attachJobObject(logger) {
  if (attached) return attached;

  const log = (logger && typeof logger.info === 'function') ? logger : { info: () => {}, warn: () => {}, error: () => {} };

  if (!isWindows()) {
    attached = { ok: false, reason: 'not-windows' };
    return attached;
  }

  const koffi = tryRequireKoffi();
  if (!koffi) {
    log.warn('[job-object] koffi unavailable, falling back to taskkill/findPort cleanup (no OS-level guarantee on Electron crash).');
    attached = { ok: false, reason: 'koffi-not-loaded' };
    return attached;
  }

  try {
    const kernel32 = koffi.load('kernel32.dll');

    // struct JOBOBJECT_BASIC_LIMIT_INFORMATION { LARGE_INTEGER PerProcessUserTimeLimit; LARGE_INTEGER PerJobUserTimeLimit;
    //   DWORD LimitFlags; SIZE_T MinimumWorkingSetSize; SIZE_T MaximumWorkingSetSize; DWORD ActiveProcessLimit;
    //   ULONG_PTR Affinity; DWORD PriorityClass; DWORD SchedulingClass; }
    const BasicLimit = koffi.struct(`${KOFFI_NS_NAME}_basic`, {
      PerProcessUserTimeLimit: 'int64',
      PerJobUserTimeLimit: 'int64',
      LimitFlags: 'uint32',
      MinimumWorkingSetSize: 'size_t',
      MaximumWorkingSetSize: 'size_t',
      ActiveProcessLimit: 'uint32',
      Affinity: 'size_t',
      PriorityClass: 'uint32',
      SchedulingClass: 'uint32',
    });
    const IoCounters = koffi.struct(`${KOFFI_NS_NAME}_io`, {
      ReadOperationCount: 'uint64',
      WriteOperationCount: 'uint64',
      OtherOperationCount: 'uint64',
      ReadTransferCount: 'uint64',
      WriteTransferCount: 'uint64',
      OtherTransferCount: 'uint64',
    });
    const ExtLimit = koffi.struct(`${KOFFI_NS_NAME}_ext`, {
      BasicLimitInformation: BasicLimit,
      IoInfo: IoCounters,
      ProcessMemoryLimit: 'size_t',
      JobMemoryLimit: 'size_t',
      PeakProcessMemoryUsed: 'size_t',
      PeakJobMemoryUsed: 'size_t',
    });

    // 函数签名（__stdcall on x64 = ms_abi；koffi 自动处理）。
    const CreateJobObjectW = kernel32.func('void* __stdcall CreateJobObjectW(void*, const char16_t*)');
    const SetInformationJobObject = kernel32.func('bool __stdcall SetInformationJobObject(void*, int, void*, uint32)');
    const AssignProcessToJobObject = kernel32.func('bool __stdcall AssignProcessToJobObject(void*, void*)');
    const GetCurrentProcess = kernel32.func('void* __stdcall GetCurrentProcess()');
    const GetLastError = kernel32.func('uint32 __stdcall GetLastError()');

    const job = CreateJobObjectW(null, null);
    if (!job) {
      attached = { ok: false, reason: `CreateJobObjectW null (GetLastError=${GetLastError()})` };
      log.warn(`[job-object] ${attached.reason}`);
      return attached;
    }

    const info = {
      BasicLimitInformation: {
        PerProcessUserTimeLimit: 0n,
        PerJobUserTimeLimit: 0n,
        LimitFlags: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        MinimumWorkingSetSize: 0,
        MaximumWorkingSetSize: 0,
        ActiveProcessLimit: 0,
        Affinity: 0,
        PriorityClass: 0,
        SchedulingClass: 0,
      },
      IoInfo: {
        ReadOperationCount: 0n,
        WriteOperationCount: 0n,
        OtherOperationCount: 0n,
        ReadTransferCount: 0n,
        WriteTransferCount: 0n,
        OtherTransferCount: 0n,
      },
      ProcessMemoryLimit: 0,
      JobMemoryLimit: 0,
      PeakProcessMemoryUsed: 0,
      PeakJobMemoryUsed: 0,
    };
    const size = koffi.sizeof(ExtLimit);

    if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, info, size)) {
      attached = { ok: false, reason: `SetInformationJobObject failed (GetLastError=${GetLastError()})` };
      log.warn(`[job-object] ${attached.reason}`);
      return attached;
    }

    if (!AssignProcessToJobObject(job, GetCurrentProcess())) {
      // Win 8+ supports nested jobs；老系统 / 沙箱占用时会拒绝。回退到现状(taskkill/findPort)。
      attached = { ok: false, reason: `AssignProcessToJobObject failed (GetLastError=${GetLastError()})` };
      log.warn(`[job-object] ${attached.reason} — falling back to taskkill/findPort.`);
      return attached;
    }

    // 保留 handle 防 GC（KILL_ON_JOB_CLOSE 在 handle 被关闭时立即触发，提前关闭等于自杀）。
    jobHandle = job;
    attached = { ok: true };
    log.info('[job-object] Attached Electron process to Job Object with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE — children will die with parent.');
    return attached;
  } catch (e) {
    attached = { ok: false, reason: `unexpected: ${e && e.message ? e.message : String(e)}` };
    log.warn(`[job-object] ${attached.reason} — falling back.`);
    return attached;
  }
}

module.exports = { attachJobObject };
