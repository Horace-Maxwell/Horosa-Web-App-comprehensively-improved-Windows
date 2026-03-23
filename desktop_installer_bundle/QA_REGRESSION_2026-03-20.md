# 星阙安装器真机回归记录（2026-03-20）

- 机器：当前开发机 Windows
- 安装器：`C:\Users\maxwe\OneDrive\Desktop\Horosa-Web-App-comprehensively-improved-Windows\desktop_installer_bundle\release\Horosa-Setup-1.0.4.exe`
- 范围：首装基线、复跑修复、复跑替换、复跑取消

## 结果摘要
- `baseline_install`：maintenance_seen=True app_launch_ok=True desktop_shortcut_launch_ok=False start_menu_shortcut_launch_ok=False desktop_shortcuts_valid=0/1 start_menu_shortcuts_valid=0/1 install_exists=True user_data_exists=True
- `rerun_repair`：maintenance_seen=False app_launch_ok=True desktop_shortcut_launch_ok=False start_menu_shortcut_launch_ok=False desktop_shortcuts_valid=0/1 start_menu_shortcuts_valid=0/1 install_exists=True user_data_exists=True
- `rerun_replace`：maintenance_seen=True app_launch_ok=True desktop_shortcut_launch_ok=False start_menu_shortcut_launch_ok=False desktop_shortcuts_valid=0/1 start_menu_shortcuts_valid=0/1 install_exists=True user_data_exists=True
- `rerun_cancel`：maintenance_seen=True app_launch_ok=True desktop_shortcut_launch_ok=False start_menu_shortcut_launch_ok=False desktop_shortcuts_valid=0/1 start_menu_shortcuts_valid=0/1 install_exists=True user_data_exists=True

## 证据
- JSON 报告：`C:\Users\maxwe\OneDrive\Desktop\Horosa-Web-App-comprehensively-improved-Windows\desktop_installer_bundle\qa_artifacts\2026-03-20\installer_regression.json`
- 截图目录：`C:\Users\maxwe\OneDrive\Desktop\Horosa-Web-App-comprehensively-improved-Windows\desktop_installer_bundle\qa_artifacts\2026-03-20\screenshots`
- 基线前快照：`未安装`

## 备注
- 本机存在旧启动器痕迹时，首装基线仍可能展示维护页，这是当前机器状态导致的预期现象。