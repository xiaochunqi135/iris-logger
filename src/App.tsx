import React, { Suspense, useCallback, useEffect, useState } from "react";
import { Link, Route, Switch } from "wouter";
import { useDebouncedCallback } from "use-debounce";
// import reactLogo from "./assets/react.svg";
// import viteLogo from "/vite.svg"; //public文件夹下的
import { message } from "@tauri-apps/plugin-dialog";
import { Store } from "@tauri-apps/plugin-store";
import {
  checkPermissions,
  requestPermissions,
} from "@tauri-apps/plugin-geolocation";
import Database from "@tauri-apps/plugin-sql";
import Weather from "./components/weather";
const Viewer = React.lazy(() => import("./components/viewer"));

function App() {
  const [textInfo, setTextInfo] = useState<string>("");
  const [store, setStore] = useState<Store | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean>(
    false,
  );
  const [db, setDb] = useState<Database | null>(null);

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
      await db.execute(
        "INSERT INTO logins (login_time, login_time_str, login_info) VALUES ($1, $2, $3);",
        [login_time, login_time_str, infoText],
      );
    } catch (e) {
      await message("数据库写入错误", {
        title: "警告",
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
    await insertData(textInfo);

    // clear textInfo
    await updateStore("txt", "");
    setTextInfo("");
  }, [textInfo, insertData, updateStore]);

  const debouncedSubmit = useDebouncedCallback(submitInfo, 2000);

  return (
    <Switch>
      <Route path="/viewer">
        <Suspense
          fallback={
            <div className="w-auto min-w-full max-w-md text-3xl text-center">
              页面加载中...
            </div>
          }
        >
          <Viewer db={db} store={store} />
        </Suspense>
      </Route>
      <Route>
        <div className="w-auto min-w-sm max-w-screen-sm text-2xl text-center p-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="place-content-center text-left">
              <Weather hasLocationPermission={hasLocationPermission} />
            </div>
            <div></div>
            <div>
              <Link to="/viewer">
                <button className="bg-gray-500 hover:bg-gray-700 text-white py-2 px-4 h-8 w-24 text-sm rounded">
                  查看记录
                </button>
              </Link>
            </div>

            <div className="col-span-3"></div>

            <div className="col-span-3">
              <div
                onBlurCapture={handleBlurCapture}
                className="w-full h-60 p-2"
              >
                <textarea
                  id="info"
                  value={textInfo}
                  placeholder="可以写一下此刻的想法..."
                  onChange={(e) => {
                    setTextInfo(e.target.value);
                  }}
                  className="w-full h-full resize-none border border-gray-400"
                />
              </div>
              <div>
                <button
                  onClick={() => debouncedSubmit()}
                  className="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 h-24 w-48 rounded"
                >
                  提交记录
                </button>
              </div>
            </div>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default App;
