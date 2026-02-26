import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || "3001";
const BASE_URL = `http://localhost:${PORT}`;

// Traffic patterns
const endpoints = [
  { path: "/ping", weight: 50 }, // 50% of traffic
  { path: "/slow", weight: 30 }, // 30% of traffic
  { path: "/error", weight: 20 }, // 20% of traffic
];

async function makeRequest(path: string) {
  try {
    const start = Date.now();
    const response = await fetch(`${BASE_URL}${path}`);
    const duration = Date.now() - start;
    
    console.log(
      `[${new Date().toISOString()}] ${path} → ${response.status} (${duration}ms)`
    );
  } catch (error) {
    console.error(`Error calling ${path}:`, error);
  }
}

function getRandomEndpoint(): string {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  for (const endpoint of endpoints) {
    cumulative += endpoint.weight;
    if (random <= cumulative) {
      return endpoint.path;
    }
  }
  
  return endpoints[0].path;
}

async function generateTraffic() {
  const endpoint = getRandomEndpoint();
  await makeRequest(endpoint);
}

function startTrafficGenerator(intervalMs: number = 2000) {
  console.log(`🚦 Traffic generator started`);
  console.log(`📊 Generating requests every ${intervalMs}ms`);
  console.log(`🎯 Target: ${BASE_URL}`);
  console.log(`📈 Endpoints: ${endpoints.map(e => `${e.path} (${e.weight}%)`).join(", ")}`);
  console.log("---");

  // Generate traffic at specified interval
  setInterval(() => {
    generateTraffic();
  }, intervalMs);

  // Also generate initial request immediately
  generateTraffic();
}

// Start with 2-second intervals (30 requests per minute)
startTrafficGenerator(2000);
