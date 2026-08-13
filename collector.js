const fs = require("fs");

const PLACE_ID = "2753915549";
const INTERVAL = 300000;

async function getServers() {
  const url =
      `https://games.roblox.com/v1/games/${PLACE_ID}/servers/Public` +
          `?sortOrder=Asc&limit=100`;

            const response = await fetch(url);

              if (!response.ok) {
                  throw new Error(`HTTP ${response.status}`);
                    }

                      const data = await response.json();

                        return (data.data || []).map(server => ({
                            id: server.id,
                                playing: server.playing,
                                    maxPlayers: server.maxPlayers,
                                        updatedAt: Date.now()
                                          }));
                                          }

                                          async function collect() {
                                            try {
                                                const servers = await getServers();

                                                    const result = {
                                                          updatedAt: Date.now(),
                                                                count: servers.length,
                                                                      servers
                                                                          };

                                                                              fs.writeFileSync(
                                                                                    "servers.json",
                                                                                          JSON.stringify(result, null, 2)
                                                                                              );

                                                                                                  console.log(
                                                                                                        `[Collector] ${servers.length} servers`
                                                                                                            );
                                                                                                              } catch (error) {
                                                                                                                  console.error(
                                                                                                                        `[Collector] Error: ${error.message}`
                                                                                                                            );
                                                                                                                              }
                                                                                                                              }

                                                                                                                              collect();
                                                                                                                              setInterval(collect, INTERVAL);

    
                

                          
                                
                                    

                                    

            
                                                  
                                                      

                                                          

                                                              
                                                                    
                                                    
                                                                                    
                                                                                            
                                                                                                    
                                                                                                          
                                                                                                              

                                                                                                            
                                                                                                                        
                                                                                                                            

                                                                                                                                
                                                                                                                                  

                                                                                                                                    
                                                                                                                                    

                                                                                                                                    
                                                                                                                                      
                                                                                                                                          

                                                                                                                                              
                                                                                                                                                    
                                                                                                                                                          
                                                                                                                                                                  
                                                                                                                                                                            
                                                                                                                                                                                      
                                                                                                                                                                                                
                                                                                                                                                                                                        
                                                                                                                                                                                                                
                                                                                                                                                                                                                        
                                                                                                                                                                                                                              
                                                                                                                                                

                                                                                                                                                                            
                                                                                                                                                            
                                                                                                                                                                
                                                                                                                                                                                
                                                                                                                                                                                                                                                    
                                                                                                                                                                                                                                                  
                                                                                                                                                                                                                                                        

                                                                                                                                                                                                                                                
                                                                    