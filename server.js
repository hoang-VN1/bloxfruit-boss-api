const http = require("http");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");

      if (req.url === "/api/servers") {
          try {
                const data = fs.readFileSync("servers.json", "utf8");

                      res.writeHead(200);
                            res.end(data);
                                } catch (error) {
                                      res.writeHead(500);
                                            res.end(JSON.stringify({
                                                    error: "servers.json chưa có dữ liệu"
                                                          }));
                                                              }

                                                                  return;
                                                                    }

                                                                      if (req.url === "/api/status") {
                                                                          res.writeHead(200);

                                                                              res.end(JSON.stringify({
                                                                                    status: "online",
                                                                                          service: "Blox Fruits Server API",
                                                                                                time: Date.now()
                                                                                                    }));

                                                                                                        return;
                                                                                                          }

                                                                                                            res.writeHead(404);

                                                                                                              res.end(JSON.stringify({
                                                                                                                  error: "Not Found"
                                                                                                                    }));
                                                                                                                    });

                                                                                                                    server.listen(PORT, () => {
                                                                                                                      console.log(`API running on port ${PORT}`);
                                                                                                                      });