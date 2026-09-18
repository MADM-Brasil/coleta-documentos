import express from "express";
import http from "node:http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middlewares/error";

import webhookRoutes, { shortLinkRouter } from "./modules/webhook/webhook.routes";
import collectionsPublicRoutes from "./modules/collections/collections.public.routes";
import collectionsWatchRoutes from "./modules/collections/collections.watch.routes";

const app = express();

// crossOriginResourcePolicy "cross-origin": o front (outro domínio) precisa poder
// embutir imagens/PDFs servidos por /webhook/media direto em <img>/<a> — o padrão
// do helmet ("same-origin") bloqueia isso silenciosamente no navegador.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());

app.use(rateLimit({ windowMs: 60_000, limit: 300 }));

app.use("/webhook", webhookRoutes);
app.use(shortLinkRouter);
app.use("/public/collections", collectionsPublicRoutes);
app.use("/public/watch", collectionsWatchRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);

httpServer.listen(env.port, () => {
  console.log(`API rodando em http://localhost:${env.port}`);
});
