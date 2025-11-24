import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { message, save } from "@tauri-apps/plugin-dialog";
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
        await message(String(e), {
          title: "vite-project",
          kind: "error",
        });
      }
      setIsLoading(false);
    }

    initViewer();
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
