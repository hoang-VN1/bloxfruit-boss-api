           const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

const DATA_FILE = path.join(__dirname, "servers.json");
const DATA_TTL = 5 * 60 * 1000;

function loadServers() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }

    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveServers(servers) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(servers, null, 2)
  );
}

function cleanupExpired() {
  const now = Date.now();

  const servers = loadServers();

  const valid = servers.filter(server => {
    return now - Number(server.updatedAt || 0) <= DATA_TTL;
  });

  if (valid.length !== servers.length) {
    saveServers(valid);
  }

  return valid;
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

function checkKey(req, url) {
  const key =
    req.headers["x-api-key"] ||
    url.searchParams.get("api_key");

  return Boolean(API_KEY && key === API_KEY);
}

const server = http.createServer((req, res) => {
  const url = new URL(
    req.url,
    `http://${req.headers.host}`
  );

  if (req.method === "GET" && url.pathname === "/api/status") {
    return sendJSON(res, 200, {
      status: "online",
      service: "Boss Server API",
      time: Date.now()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/boss") {
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

    const servers = cleanupExpired();

    const matches = servers.filter(server => {
      return String(server.boss || "").toLowerCase() ===
        boss.toLowerCase();
    });

    return sendJSON(res, 200, {
      boss,
      count: matches.length,
      updatedAt: Date.now(),
      servers: matches
    });
  }

  if (req.method === "POST" && url.pathname === "/api/servers") {
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
        const data = JSON.parse(body);

        if (!data.jobId) {
          return sendJSON(res, 400, {
            error: "jobId is required"
          });
        }

        const servers = cleanupExpired();

        const entry = {
          jobId: String(data.jobId),
          placeId: data.placeId || null,
          boss: data.boss || null,
          players: Number(data.players || 0),
          maxPlayers: Number(data.maxPlayers || 0),
          updatedAt: Date.now()
        };

        const index = servers.findIndex(
          item => item.jobId === entry.jobId
        );

        if (index >= 0) {
          servers[index] = entry;
        } else {
          servers.push(entry);
        }

        saveServers(servers);

        return sendJSON(res, 200, {
          success: true,
          server: entry
        });
      } catch {
        return sendJSON(res, 400, {
          error: "Invalid JSON"
        });
      }
    });

    return;
  }

  if (req.method === "GET" && url.pathname === "/api/servers") {
    const servers = cleanupExpired();

    const boss = url.searchParams.get("boss");

    const filtered = boss
      ? servers.filter(server =>
          String(server.boss || "").toLowerCase() ===
          boss.toLowerCase()
        )
      : servers;

    return sendJSON(res, 200, {
      count: filtered.length,
      servers: filtered
    });
  }

  return sendJSON(res, 404, {
    error: "Not Found"
  });
});

setInterval(() => {
  cleanupExpired();
}, 30 * 1000);

server.listen(PORT, () => {
  console.log(`Boss Server API running on port ${PORT}`);
});                                                                                                           });
