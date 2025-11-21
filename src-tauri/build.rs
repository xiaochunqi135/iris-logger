use std::fs;

fn main() {
    // 安全读取.env文件
    let env_content = match fs::read_to_string(".env") {
        Ok(content) => content,
        Err(_) => {
            // 如果.env文件不存在，继续构建过程
            println!(
                "cargo:warning=.env file not found, continuing build without environment variables"
            );
            println!("cargo:rerun-if-changed=.env");
            return tauri_build::build();
        }
    };

    // 解析环境变量
    for line in env_content.lines() {
        let line = line.trim();

        // 跳过空行和注释行
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // 使用splitn限制分割次数，支持值中包含等号的情况
        let parts: Vec<&str> = line.splitn(2, '=').collect();
        if parts.len() == 2 {
            let key = parts[0].trim();
            let value = parts[1].trim();

            // 跳过空键名
            if !key.is_empty() {
                println!("cargo:rustc-env={}={}", key, value);
            }
        }
    }

    println!("cargo:rerun-if-changed=.env");
    tauri_build::build()
}
