const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = "hoang_2026gpt";

const DATA_FILE = path.join(__dirname, "servers.json");
const DATA_TTL = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 30 * 1000;

function loadServers() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }

    const data = fs.readFileSync(DATA_FILE, "utf8");

    if (!data.trim()) {
      return [];
    }

    const servers = JSON.parse(data);

    return Array.isArray(servers) ? servers : [];
  } catch (error) {
    console.error("Load error:", error.message);
    return [];
  }
}

function saveServers(servers) {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(servers, null, 2),
      "utf8"
    );

    return true;
  } catch (error) {
    console.error("Save error:", error.message);
    return false;
  }
}

function cleanupExpired() {
  const now = Date.now();
  const servers = loadServers();

  const validServers = servers.filter(server => {
    const updatedAt = Number(server.updatedAt || 0);

    return (
      updatedAt > 0 &&
      now - updatedAt <= DATA_TTL
    );
  });

  if (validServers.length !== servers.length) {
    saveServers(validServers);
  }

  return validServers;
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function isAuthorized(url, req) {
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

  if (
    req.method === "OPTIONS"
  ) {
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
    url.pathname === "/api/boss"
  ) {
    if (!isAuthorized(url, req)) {
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

    const servers = cleanupExpired();

    const matches = servers.filter(server => {
      return (
        String(server.boss || "").toLowerCase() ===
        boss.toLowerCase()
      );
    });

    return sendJSON(res, 200, {
      success: true,
      boss: boss,
      count: matches.length,
      updatedAt: Date.now(),
      expiresAfter: DATA_TTL,
      servers: matches
    });
  }

  if (
    req.method === "GET" &&
    url.pathname === "/api/servers"
  ) {
    const servers = cleanupExpired();

    const boss = url.searchParams.get("boss");

    let result = servers;

    if (boss) {
      result = servers.filter(server => {
        return (
          String(server.boss || "").toLowerCase() ===
          boss.toLowerCase()
        );
      });
    }

    return sendJSON(res, 200, {
      success: true,
      count: result.length,
      servers: result
    });
  }

  if (
    req.method === "POST" &&
    url.pathname === "/api/servers"
  ) {
    if (!isAuthorized(url, req)) {
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
        const data = JSON.parse(body);

        if (!data.jobId) {
          return sendJSON(res, 400, {
            error: "jobId is required"
          });
        }

        const servers = cleanupExpired();

        const entry = {
          jobId: String(data.jobId),
          placeId: data.placeId
            ? String(data.placeId)
            : null,
          boss: data.boss
            ? String(data.boss)
            : null,
          players: Number(data.players || 0),
          maxPlayers: Number(data.maxPlayers || 0),
          updatedAt: Date.now()
        };

        const existingIndex = servers.findIndex(
          server =>
            server.jobId === entry.jobId
        );

        if (existingIndex !== -1) {
          servers[existingIndex] = entry;
        } else {
          servers.push(entry);
        }

        const saved = saveServers(servers);

        if (!saved) {
          return sendJSON(res, 500, {
            error: "Could not save server data"
          });
        }

        return sendJSON(res, 200, {
          success: true,
          server: entry
        });
      } catch (error) {
        return sendJSON(res, 400, {
          error: "Invalid JSON"
        });
      }
    });

    return;
  }

  if (
    req.method === "DELETE" &&
    url.pathname === "/api/servers"
  ) {
    if (!isAuthorized(url, req)) {
      return sendJSON(res, 401, {
        error: "Invalid API key"
      });
    }

    const jobId = url.searchParams.get("jobId");

    if (!jobId) {
      return sendJSON(res, 400, {
        error: "jobId is required"
      });
    }

    const servers = cleanupExpired();

    const filtered = servers.filter(
      server => server.jobId !== jobId
    );

    saveServers(filtered);

    return sendJSON(res, 200, {
      success: true,
      removed: servers.length - filtered.length
    });
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
