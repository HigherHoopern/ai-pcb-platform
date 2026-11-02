// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;

/// 将云端生成的最新工程 ZIP 包同步下载到客户本机 `~/Xter-AI-PCB-Projects/<projectName>`，
/// 并自动唤起客户电脑上安装的桌面端 KiCad 10、VS Code 或系统文件管理器 (Finder / Explorer)。
/// 注意：本客户端不包含任何后端 Python 核心源码或 324 页蒸馏知识库。
#[tauri::command]
fn sync_and_open_local_tool(
    action: String,
    download_url: String,
    license_key: String,
    project_name: String,
) -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "无法获取当前系统用户主目录".to_string())?;
    let base_workspace = home_dir.join("Xter-AI-PCB-Projects");
    fs::create_dir_all(&base_workspace).map_err(|e| format!("创建本地同步目录失败: {}", e))?;

    let clean_stem = project_name
        .trim_end_matches(".zip")
        .trim_end_matches("_Full_Release_Bundle")
        .to_string();
    let local_proj_dir = base_workspace.join(&clean_stem);
    fs::create_dir_all(&local_proj_dir).map_err(|e| format!("创建工程文件夹失败: {}", e))?;

    // 1. 从云端 API 下载最新工程包 (携带 License Key)
    if !download_url.is_empty() && (download_url.starts_with("http://") || download_url.starts_with("https://")) {
        let client = reqwest::blocking::Client::new();
        let mut req = client.get(&download_url).header("X-Cloud-Mode", "1");
        if !license_key.is_empty() {
            req = req
                .header("Authorization", format!("Bearer {}", license_key))
                .header("X-License-Key", &license_key);
        }
        let resp = req.send().map_err(|e| format!("下载云端工程包失败: {}", e))?;
        let bytes = resp.bytes().map_err(|e| format!("读取工程包字节流失败: {}", e))?;

        let zip_path = local_proj_dir.join("cloud_sync_bundle.zip");
        let mut file = File::create(&zip_path).map_err(|e| format!("写入本地临时 ZIP 失败: {}", e))?;
        file.write_all(&bytes).map_err(|e| format!("保存 ZIP 失败: {}", e))?;

        // 解压 ZIP 到客户本机工程目录
        if let Ok(zf_file) = File::open(&zip_path) {
            if let Ok(mut archive) = zip::ZipArchive::new(zf_file) {
                for i in 0..archive.len() {
                    if let Ok(mut entry) = archive.by_index(i) {
                        let outpath: PathBuf = local_proj_dir.join(entry.mangled_name());
                        if entry.name().ends_with('/') {
                            let _ = fs::create_dir_all(&outpath);
                        } else {
                            if let Some(p) = outpath.parent() {
                                let _ = fs::create_dir_all(p);
                            }
                            if let Ok(mut outfile) = File::create(&outpath) {
                                let _ = std::io::copy(&mut entry, &mut outfile);
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. 根据 action 唤起客户本机的 KiCad 10 / VS Code / Finder / Explorer
    let act = action.to_lowercase();
    #[cfg(target_os = "macos")]
    {
        if act == "kicad" {
            let _ = Command::new("open")
                .args(["-a", "/Applications/KiCad/KiCad.app", local_proj_dir.to_str().unwrap_or(".")])
                .spawn();
        } else if act == "vscode" {
            let _ = Command::new("open")
                .args(["-a", "Visual Studio Code", local_proj_dir.to_str().unwrap_or(".")])
                .spawn();
        } else {
            let _ = Command::new("open")
                .arg(local_proj_dir.to_str().unwrap_or("."))
                .spawn();
        }
    }

    #[cfg(target_os = "windows")]
    {
        if act == "vscode" {
            let _ = Command::new("cmd")
                .args(["/C", "code", local_proj_dir.to_str().unwrap_or(".")])
                .spawn();
        } else {
            let _ = Command::new("explorer")
                .arg(local_proj_dir.to_str().unwrap_or("."))
                .spawn();
        }
    }

    Ok(format!(
        "✅ 已将云端工程同步至本机目录: {}，并已启动本机 {} 工具！",
        local_proj_dir.display(),
        act.to_uppercase()
    ))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sync_and_open_local_tool])
        .run(tauri::generate_context!())
        .expect("error while running Xter AI-PCB Studio desktop application");
}
