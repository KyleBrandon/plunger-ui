import express, { Request, Response } from "express";

var router = express.Router();

router.get("/", async function (req: Request, res: Response) {
  res.render("index.pug", {
    title: "Plunger",
  });
});

export default router;
