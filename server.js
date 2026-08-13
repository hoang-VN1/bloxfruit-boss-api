const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = "hoang_2026gpt";

const DATA_FILE = path.join(__dirname, "servers.json");

// Server không được cập nhật trong 5 phút sẽ bị loại
const SERVER_TTL = 5 * 60 * 1000;

// Kiểm tra dữ liệu cũ mỗi 30 giây
const CLEANUP_INTERVAL = 30 * 1000;

function createEmptyData() {
  return {
    updatedAt: Date.now(),
    count: 0,
    servers: []
  };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const empty = createEmptyData();
      saveData(empty);
      return empty;
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");

    if (!raw.trim()) {
      return createEmptyData();
    }

    const data = JSON.parse(raw);

    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(data.servers)
    ) {
      return createEmptyData();
    }

    return {
      updatedAt: Number(data.updatedAt) || Date.now(),
      count: data.servers.length,
      servers: data.servers
    };
  } catch (error) {
    console.error("Load servers.json error:", error.message);
    return createEmptyData();
  }
}

function saveData(data) {
  try {
    data.count = data.servers.length;
    data.updatedAt = Date.now();

    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );

    return true;
  } catch (error) {
    console.error("Save servers.json error:", error.message);
    return false;
  }
}

function cleanupExpired() {
  const data = loadData();
  const now = Date.now();

  const validServers = data.servers.filter(server => {
    const updatedAt = Number(server.updatedAt || 0);

    return (
      updatedAt > 0 &&
      now - updatedAt <= SERVER_TTL
    );
  });

  if (validServers.length !== data.servers.length) {
    data.servers = validServers;
    saveData(data);
  }

  return data;
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function checkAPIKey(req, url) {
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

  // =========================
  // API STATUS
  // =========================

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

  // =========================
  // GET SERVERS
  // =========================

  if (
    req.method === "GET" &&
    url.pathname === "/api/servers"
  ) {
    const data = cleanupExpired();

    let servers = data.servers;

    const maxPlayers = Number(
      url.searchParams.get("maxPlayers")
    );

    if (
      Number.isFinite(maxPlayers) &&
      maxPlayers > 0
    ) {
      servers = servers.filter(server => {
        return Number(server.maxPlayers || 0) <= maxPlayers;
      });
    }

    return sendJSON(res, 200, {
      updatedAt: data.updatedAt,
      count: servers.length,
      servers
    });
  }

  // =========================
  // POST SERVERS
  // =========================

  if (
    req.method === "POST" &&
    url.pathname === "/api/servers"
  ) {
    if (!checkAPIKey(req, url)) {
      return sendJSON(res, 401, {
        error: "Invalid API key"
      });
    }

    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        const incoming = JSON.parse(body);

        if (!Array.isArray(incoming.servers)) {
          return sendJSON(res, 400, {
            error: "servers must be an array"
          });
        }

        const now = Date.now();

        const servers = incoming.servers
          .filter(server => server && server.id)
          .map(server => {
            return {
              id: String(server.id),
              playing: Number(server.playing || 0),
              maxPlayers: Number(server.maxPlayers || 0),
              updatedAt: Number(server.updatedAt) || now
            };
          });

        const data = {
          updatedAt: now,
          count: servers.length,
          servers
        };

        if (!saveData(data)) {
          return sendJSON(res, 500, {
            error: "Could not save servers.json"
          });
        }

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

  // =========================
  // DELETE SERVER
  // =========================

  if (
    req.method === "DELETE" &&
    url.pathname === "/api/servers"
  ) {
    if (!checkAPIKey(req, url)) {
      return sendJSON(res, 401, {
        error: "Invalid API key"
      });
    }

    const id = url.searchParams.get("id");

    if (!id) {
      return sendJSON(res, 400, {
        error: "id is required"
      });
    }

    const data = cleanupExpired();

    const oldCount = data.servers.length;

    data.servers = data.servers.filter(
      server => String(server.id) !== String(id)
    );

    saveData(data);

    return sendJSON(res, 200, {
      success: true,
      removed: oldCount - data.servers.length,
      count: data.servers.length
    });
  }

  // =========================
  // NOT FOUND
  // =========================

  return sendJSON(res, 404, {
    error: "Not Found"
  });
});

// =========================
// AUTO CLEANUP
// =========================

setInterval(() => {
  try {
    cleanupExpired();
  } catch (error) {
    console.error("Cleanup error:", error.message);
  }
}, CLEANUP_INTERVAL);

// =========================
// START SERVER
// =========================

server.listen(PORT, () => {
  console.log(
    `Boss Server API running on port ${PORT}`
  );
});
