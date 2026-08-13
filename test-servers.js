const PLACE_ID = "2753915549";

async function getServers() {
  const url =
      `https://games.roblox.com/v1/games/${PLACE_ID}/servers/Public` +
          `?sortOrder=Asc&limit=100`;

            const response = await fetch(url);

              if (!response.ok) {
                  throw new Error(`HTTP ${response.status}`);
                    }

                      const data = await response.json();

                        console.log("Servers:", data.data.length);

                          for (const server of data.data) {
                              console.log({
                                    id: server.id,
                                          playing: server.playing,
                                                maxPlayers: server.maxPlayers
                                                    });
                                                      }
                                                      }

                                                      getServers().catch(console.error);