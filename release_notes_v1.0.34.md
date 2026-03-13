## 下载说明

- 普通网络环境用户：下载 `XingqueSetup.exe`
- 中国大陆或弱网环境用户：下载 `XingqueSetupFull.exe`
- 普通用户不要手动下载 `HorosaPortableWindows-*.zip`、`HorosaRuntimeWindows-*.zip`、`.manifest.json`

## 本次修复

- 修复安装完成自动启动时的空参数异常，不会再因为自动点击“完成”弹出 `PerformClick` 相关错误
- 重新回归安装中文显示，确保从下载、安装到使用流程不出现中文乱码
- 重新验证 setup 的三个分支：
  - 修复当前安装
  - 用当前安装包替换现有版本
  - 取消安装
