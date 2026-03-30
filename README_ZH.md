<div align="center">

# 星阙 Horosa for Windows

### 面向普通用户交付的 Windows 桌面安装器仓库

[![Latest Release](https://img.shields.io/github/v/release/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?display_name=tag&sort=semver)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![Primary Download](https://img.shields.io/badge/download-setup%20exe-2ea043)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

[入口页](README.md) | [English](README_EN.md) | [最新 Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

</div>

## 这个仓库是做什么的

这个仓库承接的是 Horosa 的 Windows 桌面交付层。它既服务普通用户下载安装，也服务维护者继续构建、验证和发布 Windows 安装器。

它的重点不是“把源码放到 GitHub 上”，而是“把 Horosa 作为一个可以正常安装和升级的 Windows 成品交付出去”。

## 为什么 Horosa 不只是单一排盘器

Windows 仓库虽然看起来更像交付层，但真正交付出去的并不是一个“只负责安装”的壳，而是一套已经实现了大量术数模块的桌面玄学工作站。普通用户装完以后，看到的是同一套 Horosa 主工作面，而不是一个为了桌面打包临时包起来的网页。

也就是说，这个仓库不应该只写“下载哪个 exe”，还应该把软件本身已经做出来的玄学能力讲清楚。

## 普通用户下载哪个

请直接去 latest release 下载：

- `Horosa-Setup-1.1.2.exe`

这就是当前推荐给普通用户的安装入口。安装器会把运行 Horosa 需要的核心内容一起带上，而不是让用户再自己补一堆环境。

## 安装体验

推荐步骤：

1. 下载 `Horosa-Setup-1.1.2.exe`
2. 双击运行安装器
3. 按向导完成安装
4. 从桌面或开始菜单打开 `星阙`

当前交付特点：

- 目标平台：Windows 10 / 11 x64
- 安装器是公开主入口
- 运行时随安装器一起交付
- 仓库仍保留自检和维护入口，但不要求普通用户使用

## 你会在 Horosa 里实际看到什么

- 星盘、本命盘与三维盘构成日常主工作面，不是只有单一平面盘。
- 推运盘已经包含主/界限法、主限法盘、黄道星释、法达、小限、太阳弧、太阳返照、月亮返照、流年法与十年大运。
- 关系盘已经包含比较盘、组合盘、影响盘、时空中点盘、马克斯盘五路结构。
- 节气盘、星体地图、七政四余、希腊星术、印度律盘、量化盘都已经在产品面里落地。
- 中国传统部分覆盖八字、紫微斗数、八卦类象、十二串宫、八字规则、万年历与风水。
- 易与三式部分已经有宿盘、易卦、六壬、金口诀、遁甲、太乙、统摄法。
- 三式合一不是占位入口，而是已经带概览、太乙、神煞、六壬、大格、小局、参考、八宫的综合工作区。
- 工作流层已经提供星盘配置、相位选择、行星选择、星盘组件、小工具、AI 导出与 AI 导出设置。

## 你会得到什么

- 标准 Windows 安装器体验
- 已打包的运行时，不要求用户自己再装一套开发依赖
- 桌面与开始菜单入口
- 面向维护者的自检、回归和发布文档

## 推荐下载为什么只保留一个入口

Windows 这边的目标和 macOS 一样：减少普通用户的选择成本。  
用户不需要判断哪一个资产更适合自己，只需要下载最新 release 中的安装器即可。

## 视觉预览

<div align="center">
  <p><strong>Main Workspace / 主界面工作区</strong></p>
  <img src="docs/assets/screenshots/main-workspace.png" alt="Horosa Main Workspace" width="1200" />
  <p><em>这是 Horosa 在 Windows 打包正式版中的核心桌面工作区，用来承载主盘面浏览、参数控制与日常使用。</em></p>
</div>

<div align="center">
  <p><strong>Sanshi Workspace / 三式合一工作区</strong></p>
  <img src="docs/assets/screenshots/sanshi-workspace.png" alt="Horosa Sanshi Workspace" width="960" />
  <p><em>这里展示的是更偏高级功能的一面，用于体现三式合一与更深层的工具化分析场景。</em></p>
</div>

## 已实现功能矩阵

### 西方与全球占星

- 星盘、本命盘、三维盘构成主盘面
- 推运盘覆盖主/界限法、主限法盘、黄道星释、法达、小限、太阳弧、太阳返照、月亮返照、流年法、十年大运
- 关系盘覆盖比较盘、组合盘、影响盘、时空中点盘、马克斯盘
- 节气盘、星体地图、七政四余、希腊星术、印度律盘、量化盘已经并入桌面产品

### 中国传统与术数

- 八字、紫微斗数、八卦类象、十二串宫、八字规则都已有独立入口
- 易与三式已经整合宿盘、易卦、六壬、金口诀、遁甲、太乙、统摄法
- 三式合一已经形成完整综合面，包含概览、太乙、神煞、六壬、大格、小局、参考、八宫，以及奇门吉格、凶格、演卦等说明
- 万年历与风水不是附属脚本，而是桌面产品内的正式模块

## 分析与导出工作流

Horosa 的 Windows 版虽然强调 bundled installer，但真正的产品体验不是“安装器很会装”，而是安装完成后能直接进入同一套跨传统分析工作面。用户可以在西方占星、推运、关系盘、中国术数与三式工作区之间连续切换，而不需要换工具。

这套工作流里已经做出来的桌面级控制包括：

- 星盘配置
- 相位选择
- 行星选择
- 星盘组件
- 小工具
- AI 导出
- AI 导出设置

## 最新版本文档

- [v1.1.2 中文版本说明](docs/releases/v1.1.2-zh.md)
- [v1.1.2 English Release Notes](docs/releases/v1.1.2-en.md)

## 常见问题

### 我需要先克隆仓库吗

不需要。普通用户直接下载 `.exe` 安装器。

### 我需要自己装 Python 或 Java 吗

正常安装路径下不需要。这个仓库的公开发布目标就是降低这种门槛。

### 为什么仓库里还有 `START_HERE.bat`

因为仓库同时服务普通用户和维护者。普通用户用 release 安装器，维护者才会继续使用这些脚本。

## 开发者入口

如果你是维护者或开发者，优先看：

- [README.md](README.md)
- [README_EN.md](README_EN.md)
- [docs/releases/v1.1.2-zh.md](docs/releases/v1.1.2-zh.md)
- `START_HERE.bat`
- `SELF_CHECK_HOROSA_WINDOWS.bat`

关键目录：

- `desktop_installer_bundle/`：安装器工程与打包相关资源
- `docs/releases/`：版本化 release 文档
- `local/workspace/.../`：主业务源码副本
