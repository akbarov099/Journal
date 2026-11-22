import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { ExcelConnector, Group, Rec, Session, Teacher } from "./models.js";
import routes from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use("/api", routes);
app.use("/api", (_req, res) => res.status(404).json({ error: "Метод API не найден" }));

// Если клиент собран (npm run build) — отдаём его же с этого сервера
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");
if (fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, _req, res, _next) => {
  if (err.code === 11000) {
    const message = err.keyPattern?.nameKey ? "Группа с таким названием уже существует"
      : err.keyPattern?.phone ? "Этот телефон уже используется"
      : "Такая запись уже существует";
    return res.status(409).json({ error: message });
  }
  if (err.name === "ValidationError") {
    const msg = Object.values(err.errors).map((e) => e.message).join("; ");
    return res.status(400).json({ error: msg || "Некорректные данные" });
  }
  if (err.name === "CastError") return res.status(400).json({ error: "Некорректные данные" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Некорректный JSON" });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Ошибка сервера" });
});

const { MONGODB_URI = "mongodb://127.0.0.1:27017/journal", PORT = 4000 } = process.env;

mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  .then(async () => {
    await Promise.all([ExcelConnector.init(), Group.init(), Rec.init(), Session.init(), Teacher.init()]);
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`API: http://localhost:${PORT}/api`));
  })
  .catch((e) => {
    console.error("MongoDB connection failed:", e.message);
    console.error("Проверьте MONGODB_URI в server/.env (логин, пароль, имя базы) и, для Atlas, Network Access: ваш IP должен быть в списке.");
    process.exit(1);
  });
