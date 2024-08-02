import express, { Request, Response } from "express";
var router = express.Router();

let SensorData = {
  waterTemperature: 0,
  roomTemperature: 0,
  leakPresent: false,
};

router.get("/sensors", async function (req: Request, res: Response) {
  res.json(SensorData);
});

router.get(
  "/sensors/water/lowest",
  async function (req: Request, res: Response) {
    res.json({
      lowestWaterTemperature: 1,
      lowestWaterTime: new Date(),
      markStartTime: new Date(),
    });
  },
);

export default router;
