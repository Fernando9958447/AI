coconst { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- 1. SEGURIDAD ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR FATAL: Falta la variable GEMINI_API_KEY en Railway.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "NO_API_KEY");
// Usamos gemini-2.0-flash para que piense rápido como un rayo
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 2. CEREBRO MAESTRO (Sofía 14.0 - Edición "Líder & Pedagoga") ---
const SOFIA_PROMPT = `
ERES: "Sofía", la Asesora Comercial de "Renova Flux".
ACTITUD: Ganadora, Líder, Energética. Tratas al cliente de "Campeón", "Campeona", "Líder". (PROHIBIDO usar "bebé", "corazón" o "reina").
TU JEFA: Es la dueña y autoridad máxima. Tú eres su mano derecha digital.
TU FINALIDAD: Explicar el producto tan fácil que un niño lo entienda y CERRAR la venta para derivar a La Jefa.

🔥 EL PRODUCTO: "Renöva+" (La Pócima de la Eterna Juventud).
- Fórmula: Colágeno Peptan (Francia) + Resveratrol + Q10 + Magnesio + Zinc.
- Seguridad: 100% Original (Registro DIGESA y Precinto de Seguridad).

🧠 CÓMO EXPLICAR LOS BENEFICIOS (USANDO EJEMPLOS DE PRE-ESCOLAR):
1. PIEL (El ejemplo del Colchón):
   "Imagina que tu piel es un colchón nuevo. Los resortes son el colágeno. Con la edad, esos resortes se rompen y el colchón se hunde (arrugas). Renöva+ pone resortes nuevos y fuertes para que tu piel quede lisita y firme de nuevo".
2. RODILLAS Y HUESOS (El ejemplo de la Bisagra):
   "Tus rodillas son como las bisagras de una puerta. Si no tienen aceite, suenan y duelen 'ñiec ñiec'. El Magnesio y Colágeno de Renöva+ son ese aceitito especial que hace que te muevas suave y sin dolor. ¡Huesos de roble!".
3. ENERGÍA (El ejemplo de la Batería):
   "El Resveratrol y la Coenzima Q10 son como ponerle pilas Duracell nuevas a tu cuerpo. Adiós al cansancio".

💰 PRECIOS Y CIERRE (Reglas de Oro):
1. CONSUMO PERSONAL (La Oferta Irresistible):
   - "Precio normal en farmacia: S/ 170". ❌
   - "Precio Campaña HOY (35% OFF): **S/ 110**". ✅
   - MEJOR OPCIÓN: "Pack Trimestral (3 frascos) por **S/ 300** (Te ahorras S/ 210). Y te regalo el Tomatodo Oficial". 🎁
2. NEGOCIO (Volumen):
   - Pack Emprendedor (7 unidades): S/ 95 c/u.
   - Mayorista (30+ unidades): S/ 85 c/u.

🚨 REGLAS DE "SILENCIO FINAL" (PROTOCOLO DE SALIDA):
Tú solo llegas hasta el momento de la intención de compra.
- SI QUIEREN PAGAR ("Yape", "Cuenta", "Quiero el de 3", "Cómo pago"): Responde SOLO: "[HUMANO_PAGO]".
- SI PIDEN PRUEBAS ("Foto real", "Video", "Desconfío"): Responde SOLO: "[HUMANO_MULTIMEDIA]".
- SI PIDEN HUMANO ("Quiero hablar con alguien", "Asesor"): Responde SOLO: "[HUMANO_SOPORTE]".
- SI RECLAMAN: Responde SOLO: "[HUMANO_SOPORTE]".

LOGÍSTICA:
- Lima: Contraentrega.
- Provincia: Adelanto S/ 30 a la cuenta de La Jefa, saldo en agencia Shalom/Olva.

TONO: Breve, contundente, usa emojis: 🏆, 🚀, 💎, 🍷, 🦴.
`;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu']
    }
});

// MEMORIA DE CHAT
const chatHistory = {};

// 🛑 LISTA NEGRA TEMPORAL (Usuarios que ya pasaron a humano)
// Si un usuario entra aquí, el bot lo ignora para siempre (hasta reinicio)
const humanModeUsers = new Set();

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('\n⚡ QR LISTO ⚡\n');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 14.0 ACTIVA (Modo: Perfección + Silencio Post-Venta)');
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const userId = msg.from;
    const text = msg.body;

    // --- 1. FILTRO DE SILENCIO ABSOLUTO ---
    // Si este usuario ya fue derivado al humano, LA IA NO HACE NADA.
    if (humanModeUsers.has(userId)) {
        console.log(`🔇 Ignorando mensaje de ${userId} (Ya está con humano).`);
        return;
    }

    if (msg.fromMe) return; 
    if (msg.hasMedia) return; 

    // --- 2. INYECCIÓN DE PERSONALIDAD ---
    if (!chatHistory[userId]) {
        chatHistory[userId] = [
            { 
                role: "user", 
                parts: [{ text: `ACTÚA ESTRICTAMENTE ASÍ:\n${SOFIA_PROMPT}` }] 
            },
            { 
                role: "model", 
                parts: [{ text: `Entendido. Soy Sofía. Explicaré con ejemplos fáciles y me apagaré cuando toque el humano. 🏆` }] 
            }
        ];
    }

    chatHistory[userId].push({ role: "user", parts: [{ text: text }] });

    // Memoria corta (Prompt + Últimos 8 mensajes)
    if (chatHistory[userId].length > 12) {
        const prompt = chatHistory[userId].slice(0, 2); 
        const recent = chatHistory[userId].slice(-8);   
        chatHistory[userId] = [...prompt, ...recent];
    }

    try {
        const chatSession = model.startChat({
            history: chatHistory[userId]
        });

        const result = await chatSession.sendMessage(text);
        const responseText = result.response.text();

        // --- 3. SISTEMA DE DERIVACIÓN Y APAGADO ---

        // CASO A: PAGO
        if (responseText.includes("[HUMANO_PAGO]")) {
            await chat.sendMessage(`¡Trato hecho, Campeón/ona! 🤝\nPara cerrar el pedido con seguridad, le paso el dato a **Mi Jefa** ahora mismo. Ella te dará la cuenta oficial y coordinará el envío.\n\n*Sofía se desconecta para que hables con La Jefa. ¡Bienvenido a la familia Renova!* 🚀`);
            humanModeUsers.add(userId); // <--- AQUÍ SE APAGA EL BOT PARA ESTE USUARIO
            return;
        }

        // CASO B: MULTIMEDIA / DESCONFIANZA
        if (responseText.includes("[HUMANO_MULTIMEDIA]")) {
            await chat.sendMessage(`Entiendo, Líder. La confianza es lo primero. 🛡️\nLe voy a pedir a **Mi Jefa** que te envíe un VIDEO REAL desde almacén ahora mismo para que veas los sellos de calidad.\n\n*Sofía te deja con La Jefa para que veas las pruebas. 👀*`);
            humanModeUsers.add(userId); // <--- AQUÍ SE APAGA EL BOT
            return;
        }

        // CASO C: SOPORTE / HUMANO
        if (responseText.includes("[HUMANO_SOPORTE]")) {
            await chat.sendMessage(`¡Entendido, Líder! 🫡\nPara darte la atención que mereces, te conecto directamente con **La Jefa**. Ella te responderá en breve.\n\n*Sofía fuera. Cambio y fuera.* 🔇`);
            humanModeUsers.add(userId); // <--- AQUÍ SE APAGA EL BOT
            return;
        }

        // Si no hay etiquetas, responde normalmente
        await chat.sendMessage(responseText);
        chatHistory[userId].push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
        console.error("Error Gemini:", error);
    }
});

client.initialize();

client.initialize();