import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { Queue } from "bullmq";
import type { Express, Request, Response, NextFunction } from "express";
import { CONSTANTS } from "@reachinbox/shared";
import { getRedisClient } from "./redis";

export function setupBullBoard(app: Express): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  const emailQueue = new Queue(CONSTANTS.BULLMQ_QUEUE_NAME, {
    connection: getRedisClient(),
  });

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  // Basic-auth protection
  app.use(
    "/admin/queues",
    (req: Request, res: Response, next: NextFunction) => {
      const b64 = (req.headers.authorization || "").split(" ")[1] || "";
      const [login, password] = Buffer.from(b64, "base64")
        .toString()
        .split(":");
      const expectedUser = process.env.BULL_BOARD_USERNAME || "admin";
      const expectedPass = process.env.BULL_BOARD_PASSWORD || "changeme";
      if (login === expectedUser && password === expectedPass) return next();
      res.set("WWW-Authenticate", 'Basic realm="BullMQ Board"');
      res.status(401).send("Authentication required.");
    },
    serverAdapter.getRouter()
  );
}
