use serde::Serialize;
use serde_json::json;
use std::{env, time};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_http::reqwest;
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_store::StoreExt;

const API_KEY: &str = env!("API_KEY");

#[derive(Serialize)]
struct Weather {
    weather: String,
}

fn calculate_hypotenuse(a: f64, b: f64) -> f64 {
    // 根据勾股定理 c^2 = a^2 + b^2
    let c_squared = a.powi(2) + b.powi(2); // 使用 powi(2) 进行平方运算

    // 计算 c 的值（即平方根）
    let c = c_squared.sqrt(); // 使用 .sqrt() 方法计算平方根

    c
}

#[tauri::command(rename_all = "snake_case")]
async fn update_weather(app: AppHandle, gps_location: &str) -> Result<Weather, ()> {
    let gps: serde_json::Value = serde_json::from_str(&gps_location).unwrap();
    let latitude = gps["latitude"].as_f64().unwrap();
    let longitude = gps["longitude"].as_f64().unwrap();

    // 验证缓存没有过期直接使用缓存
    let store = app.store("store.json").unwrap();
    let weather = store.get("weather");
    // 可能没有weather
    if weather.is_some() {
        let weather_raw = weather.unwrap();
        let weather_value = weather_raw["value"].as_str().unwrap();
        let weather_timestamp = weather_raw["timestamp"].as_u64().unwrap();
        let weather_latitude = weather_raw["latitude"].as_f64().unwrap();
        let weather_longitude = weather_raw["longitude"].as_f64().unwrap();

        let now = time::SystemTime::now()
            .duration_since(time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // 如果缓存的经纬度和当前经纬度差别不大，则使用缓存
        if calculate_hypotenuse(
            (latitude - weather_latitude).abs(),
            (longitude - weather_longitude).abs(),
        ) < 0.45
        {
            if now - weather_timestamp < 60000 {
                return Ok(Weather {
                    weather: weather_value.to_string(),
                });
            }
        }
    }

    // gps_location: {"latitude":27.682981,"longitude":102.2003087,"accuracy":100,"altitudeAccuracy":100,"altitude":1445.4000244140625,"speed":0,"heading":0}
    // curl --location --request GET 'https://restapi.amap.com/v3/assistant/coordinate/convert?locations=102.2003087,27.682981&coordsys=gps&output=json&key='
    // output: {"status":"1","info":"ok","infocode":"10000","locations":"102.20187608507,27.679636773004"}
    let url = format!("https://restapi.amap.com/v3/assistant/coordinate/convert?locations={},{}&coordsys=gps&output=json&key={}", longitude, latitude, API_KEY);
    let response = reqwest::get(&url).await;

    // 处理错误
    if let Err(e) = response {
        app.dialog()
            .message(e.to_string())
            .kind(MessageDialogKind::Info)
            .title("Error")
            .blocking_show();
        return Err(());
    }
    let body = response.unwrap().text().await.unwrap();
    let json: serde_json::Value = serde_json::from_str(&body).unwrap();
    let locations = json["locations"].as_str();

    // 可能没有locations
    if locations.is_none() {
        return Ok(Weather {
            weather: "".to_string(),
        });
    }

    // println!("Converted locations: {}", locations);
    // curl --location --request GET 'https://restapi.amap.com/v3/geocode/regeo?location=102.20187608507,27.679636773004&extensions=base&output=JSON&key='
    let regeo_url = format!(
        "https://restapi.amap.com/v3/geocode/regeo?location={}&extensions=base&output=JSON&key={}",
        locations.unwrap(),
        API_KEY
    );
    let regeo_response = reqwest::get(&regeo_url).await;

    if let Err(e) = regeo_response {
        app.dialog()
            .message(e.to_string())
            .kind(MessageDialogKind::Info)
            .title("Error")
            .blocking_show();
        return Err(());
    }

    let regeo_body = regeo_response.unwrap().text().await.unwrap();
    // println!("Regeo response: {}", regeo_body);
    let regeo_json: serde_json::Value = serde_json::from_str(&regeo_body).unwrap();
    let adcode = regeo_json["regeocode"]["addressComponent"]["adcode"].as_str();

    // 可能没有adcode
    if adcode.is_none() {
        return Ok(Weather {
            weather: "".to_string(),
        });
    }

    // curl --location --request GET 'https://restapi.amap.com/v3/weather/weatherInfo?city=110101&extensions=base'
    let weather_url = format!("https://restapi.amap.com/v3/weather/weatherInfo?city={}&extensions=base&output=JSON&key={}", adcode.unwrap(), API_KEY);
    let weather_response = reqwest::get(&weather_url).await;

    if let Err(e) = weather_response {
        app.dialog()
            .message(e.to_string())
            .kind(MessageDialogKind::Info)
            .title("Error")
            .blocking_show();
        return Err(());
    }
    let weather_body = weather_response.unwrap().text().await.unwrap();
    let weather_json: serde_json::Value = serde_json::from_str(&weather_body).unwrap();
    let weather_str = weather_json["lives"][0]["weather"].as_str();

    if weather_str.is_none() {
        return Ok(Weather {
            weather: "".to_string(),
        });
    }

    // 将结果缓存起来
    store.set("weather", json!({ "value": weather_str.unwrap(), "timestamp": time::SystemTime::now().duration_since(time::UNIX_EPOCH).unwrap().as_secs(), "latitude": latitude, "longitude": longitude }));

    // Ok(format!("{{\"weather\":\"{}\"}}", weather_str.unwrap()))
    Ok(Weather {
        weather: weather_str.unwrap().to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![ Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "CREATE TABLE IF NOT EXISTS logins (login_id INTEGER PRIMARY KEY AUTOINCREMENT, login_time INTEGER, login_time_str TEXT, login_info TEXT);",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:data.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![update_weather])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
