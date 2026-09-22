// AI 分析·流式看门狗缺省(单源,零 import):服务层缺省值与应用内手册文案共用,手册写数字必须从这里插值。
//  · 空闲看门狗:距上个真产出 token(正文 delta / 思维链增量均续命;心跳与 usage 帧不续)超过此值判为卡住并停止等待
//  · 单次硬上限:一次流式生成的总时长上限(#77:300s 硬顶掐健康长流 → 三层语义 180s / 30min + 两键 UI 门)
export const DEFAULT_STREAM_STALL_MS = 180000;
export const DEFAULT_STREAM_MAX_MS = 1800000;
