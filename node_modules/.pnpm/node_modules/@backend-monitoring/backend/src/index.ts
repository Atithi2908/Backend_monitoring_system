import express from "express";
import { collectRouter } from "./routes/collect";

const app = express();

// allows JSON body
app.use(express.json());

// mount collect route
app.use("/collect", collectRouter);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Collector running on port ${PORT}`);
});
