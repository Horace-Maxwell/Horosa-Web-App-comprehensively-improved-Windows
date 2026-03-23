# 星阙安装器真机回归记录（2026-03-19）

- 机器：当前开发机 Windows
- 安装器：`C:\Users\maxwe\AppData\Local\Temp\horosa-v1.0.1-download\Horosa-Setup-1.0.1.exe`
- 范围：首装基线、复跑修复、复跑替换、复跑取消

## 结果摘要
- `baseline_install`：maintenance_seen=True app_launch_ok=True install_exists=True user_data_exists=True
- `rerun_repair`：maintenance_seen=True app_launch_ok=True install_exists=True user_data_exists=True
- `rerun_replace`：maintenance_seen=True app_launch_ok=True install_exists=True user_data_exists=True
- `rerun_cancel`：maintenance_seen=True app_launch_ok=True install_exists=True user_data_exists=True

## 证据
- JSON 报告：`C:\Users\maxwe\OneDrive\Desktop\Horosa-Web-App-comprehensively-improved-Windows\desktop_installer_bundle\qa_artifacts\github-download-acceptance-2026-03-19\installer_regression.json`
- 截图目录：`C:\Users\maxwe\OneDrive\Desktop\Horosa-Web-App-comprehensively-improved-Windows\desktop_installer_bundle\qa_artifacts\github-download-acceptance-2026-03-19\screenshots`
- 基线前快照：`未安装`

## 备注
- 本机存在旧启动器痕迹时，首装基线仍可能展示维护页，这是当前机器状态导致的预期现象。