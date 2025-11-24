import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ask, message, save } from "@tauri-apps/plugin-dialog";
import type { Store } from "@tauri-apps/plugin-store";
import type Database from "@tauri-apps/plugin-sql";
import { exportSheet, ExportTypes } from "@jsr/psych__sheet";
import { open } from "@tauri-apps/plugin-fs";

type Logins = {
  login_id: number;
  login_time: number;
  login_time_str: string;
  login_info: string;
};

function Viewer({ db, store }: { db: Database | null; store: Store | null }) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [logins, setLogins] = useState<Logins[]>([]);

  useEffect(() => {
    async function initViewer() {
      if (!db) return;
      try {
        const result = await db.select(
          "SELECT * FROM (SELECT * FROM logins ORDER BY login_id DESC LIMIT 10) AS l ORDER BY l.login_id ASC;",
        ) as Logins[];

        setLogins(result);
      } catch (e) {
        await message("数据库查询失败", {
          title: "警告",
          kind: "error",
        });
      }
      setIsLoading(false);
    }

    initViewer();
  }, [db]);

  const resetDB = useCallback(async () => {
    const continue_reset = await ask("确定要重置数据库和缓存吗？", {
      title: "注意",
      kind: "warning",
    });
    if (!continue_reset) return;

    if (!db) return;
    if (!store) return;
    try {
      await db.execute(
        "DROP TABLE IF EXISTS logins; DROP TABLE IF EXISTS _sqlx_migrations;",
      );
    } catch (e) {
      await message("数据库删除失败", {
        title: "警告",
        kind: "error",
      });
    }
    try {
      await store.clear();
    } catch (e) {
      await message("缓存清空失败", {
        title: "警告",
        kind: "error",
      });
    }

    await message(
      "【重置成功】请立即完全退出APP，再打开使用。不重启使用会出错。",
      {
        title: "注意",
        kind: "warning",
      },
    );
  }, [db, store]);

  const saveExcel = useCallback(async () => {
    await message("请选择表格存在哪，并且给表格取名，例如“abc.xlsx”。", {
      title: "注意",
      kind: "info",
    });

    if (!db) return;
    try {
      const result = await db.select("SELECT * FROM logins;") as Logins[];
      const excel_raw = exportSheet(result, ExportTypes.XLSX);

      const documentDir = await save({
        filters: [
          {
            name: "Excel",
            extensions: ["xlsx"],
          },
        ],
      });

      if (documentDir) {
        const file = await open(documentDir, {
          read: true,
          write: true,
          create: true,
        });
        await file.write(excel_raw);
        await file.close();
      }
    } catch (e) {
      await message("文件写入失败", {
        title: "警告",
        kind: "error",
      });
    }
  }, [db]);

  return (
    <div>
      <p>
        <Link to="/">返回</Link>
      </p>

      <div>
        {isLoading ? "Loading..." : (
          <table>
            <tr>
              <th>序号</th>
              <th>时间</th>
              <th>信息</th>
            </tr>

            {logins.map((login, index) => (
              <tr key={login.login_id}>
                <td>{index + 1}</td>
                <td>{login.login_time_str}</td>
                <td>{login.login_info}</td>
              </tr>
            ))}
          </table>
        )}
      </div>

      <p>
        <div>
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
      </p>
    </div>
  );
}

export default Viewer;
