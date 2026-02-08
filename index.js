const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- 1. SEGURIDAD ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR FATAL: Falta la variable GEMINI_API_KEY en Railway.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 2. CEREBRO MAESTRO (Sofía 17.0 - La Versión Completa) ---
const SOFIA_PROMPT = `
ERES: "Sofía", Asesora Comercial de "Renova Flux".
PERSONALIDAD: Profesional, Amable, Persuasiva, pero CONCISA.
OBJETIVO: Obtener el nombre del cliente, explicar "La Pócima" simple y cerrar venta.

🚨 REGLA DE ORO (EL NOMBRE):
- En tu PRIMER mensaje, saluda y PREGUNTA SU NOMBRE amablemente.
- NO uses "Campeón", "Líder" o "Amiga" en cada frase. Es molesto. Usa su nombre si lo tienes. Si no, sé neutral y respetuosa.

🔥 EL PRODUCTO: "Renöva+" (La Pócima de la Eterna Juventud).
- Fórmula: Colágeno Peptan (Francia) + Resveratrol + Q10 + Magnesio + Zinc.
- Seguridad: 100% Original (Digesa).

🧠 CÓMO EXPLICAR (SOLO SI PIDEN "INFO" O "BENEFICIOS"):
No sueltes todo el texto de golpe. Usa estas analogías:
1. PIEL: "Es como cambiar los resortes viejos de un colchón (arrugas) por nuevos (piel firme)".
2. RODILLAS: "Es como ponerle aceite a una bisagra que suena. Adiós dolor".
3. ENERGÍA: "Como ponerle pilas nuevas a tu cuerpo gracias al Resveratrol".

💰 PRECIOS (SOLO SI PIDEN "PRECIO" O "COSTO"):
1. CONSUMO PERSONAL:
   - "Precio Regular: S/ 170" ❌.
   - "Precio Campaña HOY (35% OFF): **S/ 110**". ✅
   - MEJOR OPCIÓN: "Pack Trimestral (3 frascos) por **S/ 300** (Ahorras S/ 210) + Regalo Tomatodo". 🎁
2. NEGOCIO (7+ Unidades):
   - Pack Emprendedor (7 u): S/ 95 c/u.
   - Mayorista (30+ u): S/ 85 c/u.

🛑 PROTOCOLO DE SILENCIO (INTERVENCIÓN HUMANA):
- SI QUIEREN PAGAR ("Yape", "Cuenta", "Quiero el de 3"): Responde SOLO: "[HUMANO_PAGO]".
- SI PIDEN PRUEBAS ("Foto real", "Video", "No confío"): Responde SOLO: "[HUMANO_MULTIMEDIA]".
- SI PIDEN HUMANO ("Asesor", "Persona"): Responde SOLO: "[HUMANO_SOPORTE]".
- SI RECLAMAN: Responde SOLO: "[HUMANO_SOPORTE]".

LOGÍSTICA:
- Lima: Contraentrega.
- Provincia: Adelanto S/ 30 a La Jefa, saldo en agencia.

TONO: Breve. Usa emojis: ✨, 🚀, 💎, 🍷. Despídete siempre deseando un "Gran día".
`;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu']
    }
});

// --- GESTIÓN DE MEMORIA ---
const chatHistory = {};
const humanModeUsers = new Set();
const processedMessages = new Set(); // Filtro anti-spam

// --- AQUI ESTA LO QUE PEDISTE: EL TEXTO DEL QR ---
client.on('qr', (qr) => {
    // 1. Dibuja el QR (a veces falla en Railway)
    qrcode.generate(qr, { small: true });
    
    // 2. IMPRIME EL TEXTO (Esto es lo que necesitas copiar)
    console.log('\n⚡ SI EL DIBUJO FALLA, COPIA TODO EL TEXTO DE ABAJO Y PÉGALO EN UN GENERADOR QR:');
    console.log(qr); 
    console.log('⚡ FIN DEL CÓDIGO QR ⚡\n');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 17.0 LISTA (QR Texto + Sin Repeticiones + Modo Silencio)');
});

client.on('message', async msg => {
    // 1. FILTRO TÉCNICO: Evitar mensajes propios y DUPLICADOS
    if (msg.fromMe) return;
    if (processedMessages.has(msg.id.id)) return; // Si ya procesé este ID, ignoro.
    processedMessages.add(msg.id.id);

    // Limpieza de memoria del filtro
    if (processedMessages.size > 1000) processedMessages.clear();

    const chat = await msg.getChat();
    const userId = msg.from;
    const text = msg.body;

    // 2. FILTRO DE SILENCIO (HUMANO)
    // Si ya te pasé con La Jefa, no vuelvo a hablar.
    if (humanModeUsers.has(userId)) return;

    // 3. FILTRO MULTIMEDIA
    if (msg.hasMedia) return;

    // 4. INYECCIÓN DE CEREBRO
    if (!chatHistory[userId]) {
        chatHistory[userId] = [
            { 
                role: "user", 
                parts: [{ text: `ACTÚA ESTRICTAMENTE ASÍ:\n${SOFIA_PROMPT}` }] 
            },
            { 
                role: "model", 
                parts: [{ text: `Entendido. Soy Sofía. Preguntaré el nombre, usaré analogías y me apagaré al vender. 🚀` }] 
            }
        ];
    }

    chatHistory[userId].push({ role: "user", parts: [{ text: text }] });

    // Memoria corta (Prompt + Últimos 6 mensajes)
    if (chatHistory[userId].length > 10) {
        const prompt = chatHistory[userId].slice(0, 2);
        const recent = chatHistory[userId].slice(-6);
        chatHistory[userId] = [...prompt, ...recent];
    }

    try {
        const chatSession = model.startChat({
            history: chatHistory[userId]
        });

        const result = await chatSession.sendMessage(text);
        const responseText = result.response.text();

        // --- SISTEMA DE DERIVACIÓN (CIERRE) ---

        if (responseText.includes("[HUMANO_PAGO]")) {
            await chat.sendMessage(`¡Excelente decisión! 🎉\nPara cerrar tu pedido con seguridad, te paso con **Mi Jefa** ahora mismo. Ella te dará la cuenta oficial y coordinará el envío.\n\n*Muchas gracias por confiar en Renova Flux. ¡Que tengas un gran día!* ✨`);
            humanModeUsers.add(userId);
            return;
        }

        if (responseText.includes("[HUMANO_MULTIMEDIA]")) {
            await chat.sendMessage(`Entiendo, la confianza es clave. 🛡️\nLe pido a **Mi Jefa** que te envíe un VIDEO REAL desde el almacén ahora mismo para que veas los sellos de calidad.`);
            humanModeUsers.add(userId);
            return;
        }

        if (responseText.includes("[HUMANO_SOPORTE]")) {
            await chat.sendMessage(`Comprendido. 🫡\nPara darte la atención personalizada que necesitas, te conecto directamente con **La Jefa**. Ella te responderá en breve.`);
            humanModeUsers.add(userId);
            return;
        }

        // Respuesta normal
        await chat.sendMessage(responseText);
        chatHistory[userId].push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
        console.error("Error Gemini:", error);
    }
});

client.initialize();