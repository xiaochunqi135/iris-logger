import React, { useCallback, useEffect, useState } from "react";
// import reactLogo from "./assets/react.svg";
// import viteLogo from "/vite.svg"; //public文件夹下的
import "./App.css";
import { message, save } from "@tauri-apps/plugin-dialog";
import { Store } from "@tauri-apps/plugin-store";
import {
  checkPermissions,
  type Coordinates,
  getCurrentPosition,
  requestPermissions,
} from "@tauri-apps/plugin-geolocation";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { exportSheet, ExportTypes } from "@jsr/psych__sheet";
import { open } from "@tauri-apps/plugin-fs";

function App() {
  const [textInfo, setTextInfo] = useState<string>("");
  const [store, setStore] = useState<Store | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean>(
    false,
  );
  const [db, setDb] = useState<Database | null>(null);

  // define logins data structure
  type Logins = {
    login_id: string;
    login_time: number;
    login_time_str: string;
    login_info: string;
  };

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // 初始化数据库
        const sqldb = await Database.load("sqlite:data.db");
        if (!mounted) return;
        setDb(sqldb);

        // 初始化store.json
        const s = await Store.load("store.json");
        if (!mounted) return;
        setStore(s);

        // 获得定位权限
        let geol_permissions = await checkPermissions();
        if (
          geol_permissions.location === "prompt" ||
          geol_permissions.location === "prompt-with-rationale"
        ) {
          geol_permissions = await requestPermissions(["location"]);
        }
        setHasLocationPermission(geol_permissions.location === "granted");

        // 从store.json（临时变量s）中恢复 textInfo
        const raw = await s.get("txt");
        if (raw && Object.prototype.hasOwnProperty.call(raw, "value")) {
          const t = (raw as { "value": string }).value;
          setTextInfo(t);
        }
      } catch (e) {
        console.error("Initialization failed", e);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  const insertData = useCallback(async (infoText: string) => {
    if (!db) return;
    // get login_time as unix timestamp
    const login_now = new Date();
    const login_time = login_now.getTime();
    const login_time_str = login_now.toLocaleString("zh-CN");

    try {
      const result = await db.execute(
        "INSERT INTO logins (login_time, login_time_str, login_info) VALUES ($1, $2, $3);",
        [login_time, login_time_str, infoText],
      );
      await message(JSON.stringify(result), {
        title: "vite-project",
        kind: "info",
      });
    } catch (e) {
      await message(String(e), {
        title: "vite-project",
        kind: "error",
      });
    }
  }, [db]);

  const updateStore = useCallback(
    async (key: string, value: any) => {
      if (!store) return;
      try {
        await store.set(key, { value });
        await store.save();
      } catch (e) {
        console.error("Failed to update store", e);
      }
    },
    [store],
  );

  function handleBlurCapture(event: React.FocusEvent<HTMLDivElement>) {
    updateStore("txt", event.target.textContent);
  }

  // 提交记录
  const submitInfo = useCallback(async () => {
    if (!textInfo) {
      await message("请输入记录内容", {
        title: "vite-project",
        kind: "warning",
      });
      return;
    }
    await insertData(textInfo);

    // clear textInfo
    await updateStore("txt", "");
    setTextInfo("");
  }, [textInfo]);

  const showStoreValue = useCallback(
    async (key: string) => {
      if (!store) {
        await message("Store not initialized", {
          title: "vite-project",
          kind: "warning",
        });
        return;
      }
      try {
        const val = await store.get(key);
        if (val) {
          const v = JSON.stringify(val);
          await message(`${key} in store.json is ${v}`, {
            title: "vite-project",
            kind: "info",
          });
        } else {
          await message(`${key} not found in store`, {
            title: "vite-project",
            kind: "warning",
          });
        }
      } catch (e) {
        console.error("Failed to read store", e);
      }
    },
    [store],
  );

  const alertGeolocation = useCallback(async () => {
    let pos = {
      "latitude": 27.682981,
      "longitude": 102.2003087,
      "accuracy": 100,
      "altitudeAccuracy": 100,
      "altitude": 1445.4000244140625,
      "speed": 0,
      "heading": 0,
    } as Coordinates;

    try {
      if (hasLocationPermission) {
        const position = await getCurrentPosition();
        pos = position.coords;
      } else {
        await message("获取手机定位失败，将使用默认位置", {
          title: "vite-project",
          kind: "warning",
        });
      }
    } catch (e) {
      console.error("Geolocation flow failed", e);
      await message("无法获取坐标: " + String(e), {
        title: "vite-project",
        kind: "error",
      });
    }

    const result = await invoke("update_weather", {
      gps_location: JSON.stringify(pos),
    });
    if (result) {
      await message(`Your position is ${result}`, {
        title: "vite-project",
        kind: "info",
      });
    } else {
      await message("Your position is unknown, please check your network.", {
        title: "vite-project",
        kind: "error",
      });
    }
  }, [hasLocationPermission]);

  const showData = useCallback(async () => {
    if (!db) return;
    try {
      const result = await db.select("SELECT * FROM logins;");
      await message(JSON.stringify(result), {
        title: "vite-project",
        kind: "info",
      });
    } catch (e) {
      await message(String(e), {
        title: "vite-project",
        kind: "error",
      });
    }
  }, [db]);

  const resetDB = useCallback(async () => {
    if (!db) return;
    if (!store) return;
    try {
      const result = await db.execute(
        "DROP TABLE IF EXISTS logins; DROP TABLE IF EXISTS _sqlx_migrations;",
      );
      await message(JSON.stringify(result), {
        title: "vite-project",
        kind: "info",
      });
    } catch (e) {
      await message(String(e), {
        title: "vite-project",
        kind: "error",
      });
    }
    try {
      await store.clear();
    } catch (e) {
      await message(String(e), {
        title: "vite-project",
        kind: "error",
      });
    }
  }, [db, store]);

  const saveExcel = useCallback(async () => {
    if (!db) return;
    try {
      const result = await db.select("SELECT * FROM logins;") as Logins[];
      const excel_raw = exportSheet(result, ExportTypes.XLSX);

      // const file_name = `logs-${new Date().getTime()}.xlsx`;

      const documentDir = await save({
        filters: [
          {
            name: "Excel",
            extensions: ["xlsx"],
          },
        ],
      });

      if (documentDir) {
        await message(JSON.stringify(documentDir), {
          title: "vite-project",
          kind: "info",
        });
        const file = await open(documentDir, {
          read: true,
          write: true,
          create: true,
        });
        await file.write(excel_raw);
        await file.close();
      }
    } catch (e) {
      await message(String(e), {
        title: "vite-project",
        kind: "error",
      });
    }
  }, [db]);

  return (
    <div>
      <p>
        <div>
          <span>天气</span>
          <span>数据</span>
        </div>
      </p>

      <p>
        <div>
          <div onBlurCapture={handleBlurCapture}>
            <textarea
              id="info"
              value={textInfo}
              placeholder="可以写一下此刻的想法..."
              onChange={(e) => {
                setTextInfo(e.target.value);
              }}
            />
          </div>
          <button
            onClick={() => submitInfo()}
          >
            submit info
          </button>
        </div>
      </p>

      <div>
        <button
          onClick={() => showStoreValue("txt")}
        >
          check info in store
        </button>

        <button
          onClick={() => alertGeolocation()}
        >
          check geolocation
        </button>

        <button
          onClick={() => showData()}
        >
          显示数据
        </button>

        <button
          onClick={() => saveExcel()}
        >
          导出全部数据
        </button>

        <button
          onClick={() => resetDB()}
        >
          完全初始化数据库（需要立即重启）
        </button>
      </div>
    </div>
  );
}

export default App;
