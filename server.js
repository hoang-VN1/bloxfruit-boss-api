const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = "hoang_2026gpt";

const DATA_FILE = path.join(__dirname, "servers.json");

const SERVER_TTL = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 30 * 1000;

function emptyData() {
  return {
    updatedAt: Date.now(),
    count: 0,
    servers: []
  };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return emptyData();
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");

    if (!raw.trim()) {
      return emptyData();
    }

    const data = JSON.parse(raw);

    if (!Array.isArray(data.servers)) {
      return emptyData();
    }

    return {
      updatedAt: Number(data.updatedAt) || Date.now(),
      count: data.servers.length,
      servers: data.servers
    };
  } catch (error) {
    console.error("Load error:", error.message);
    return emptyData();
  }
}

function saveData(data) {
  data.count = data.servers.length;
  data.updatedAt = Date.now();

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function cleanupExpired() {
  const data = loadData();
  const now = Date.now();

  data.servers = data.servers.filter(server => {
    const updatedAt = Number(server.updatedAt || 0);

    return (
      updatedAt > 0 &&
      now - updatedAt <= SERVER_TTL
    );
  });

  data.count = data.servers.length;

  saveData(data);

  return data;
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function checkKey(req, url) {
  const queryKey = url.searchParams.get("api_key");
  const headerKey = req.headers["x-api-key"];

  return (
    queryKey === API_KEY ||
    headerKey === API_KEY
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key"
    });

    return res.end();
  }

  if (
    req.method === "GET" &&
    url.pathname === "/api/status"
  ) {
    return sendJSON(res, 200, {
      status: "online",
      service: "Boss Server API",
      time: Date.now()
    });
  }

  if (
    req.method === "GET" &&
    url.pathname === "/api/servers"
  ) {
    const data = cleanupExpired();

    const boss = url.searchParams.get("boss");

    let servers = data.servers;

    if (boss) {
      servers = servers.filter(server =>
        String(server.boss || "").toLowerCase() ===
        boss.toLowerCase()
      );
    }

    return sendJSON(res, 200, {
      updatedAt: data.updatedAt,
      count: servers.length,
      servers
    });
  }

  if (
    req.method === "GET" &&
    url.pathname === "/api/boss"
  ) {
    if (!checkKey(req, url)) {
      return sendJSON(res, 401, {
        error: "Invalid API key"
      });
    }

    const boss = url.searchParams.get("boss");

    if (!boss) {
      return sendJSON(res, 400, {
        error: "boss is required"
      });
    }

    const data = cleanupExpired();

    const servers = data.servers.filter(server =>
      String(server.boss || "").toLowerCase() ===
      boss.toLowerCase()
    );

    return sendJSON(res, 200, {
      boss,
      count: servers.length,
      updatedAt: Date.now(),
      servers
    });
  }

  if (
    req.method === "POST" &&
    url.pathname === "/api/servers"
  ) {
    if (!checkKey(req, url)) {
      return sendJSON(res, 401, {
        error: "Invalid API key"
      });
    }

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const input = JSON.parse(body);

        if (!Array.isArray(input.servers)) {
          return sendJSON(res, 400, {
            error: "servers must be an array"
          });
        }

        const now = Date.now();

        const servers = input.servers
          .filter(server => server && server.id)
          .map(server => ({
            id: String(server.id),
            playing: Number(server.playing || 0),
            maxPlayers: Number(server.maxPlayers || 0),
            boss: server.boss
              ? String(server.boss)
              : null,
            bossFound: Boolean(server.bossFound),
            updatedAt: now
          }));

        const data = {
          updatedAt: now,
          count: servers.length,
          servers
        };

        saveData(data);

        return sendJSON(res, 200, {
          success: true,
          updatedAt: data.updatedAt,
          count: data.count
        });
      } catch (error) {
        return sendJSON(res, 400, {
          error: "Invalid JSON"
        });
      }
    });

    return;
  }

  return sendJSON(res, 404, {
    error: "Not Found"
  });
});

setInterval(() => {
  cleanupExpired();
}, CLEANUP_INTERVAL);

server.listen(PORT, () => {
  console.log(
    `Boss Server API running on port ${PORT}`
  );
});
