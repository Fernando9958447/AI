const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- 1. SEGURIDAD ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR FATAL: Falta la variable GEMINI_API_KEY en Railway.");
}

// Inicialización de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "NO_API_KEY");

// 🔥 CAMBIO CLAVE: Usamos 'gemini-2.0-flash' que es RÁPIDO y tiene LÍMITES ALTOS.
// Si por alguna razón fallara, puedes probar 'gemini-1.5-flash-latest'
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 2. PERSONALIDAD DE SOFÍA (Prompt Maestro) ---
const SOFIA_PROMPT = `
INSTRUCCIONES MAESTRAS PARA SOFÍA (Renova Flux):
Tu objetivo es vender "Renöva+" (Colágeno Premium) con amabilidad y energía.

PRODUCTO:
- Renöva+ (Trilogía de Juventud): Colágeno + Resveratrol + Q10 + Magnesio + Biotina.
- Laboratorio: Peptan (Francia). 100% Original con Reg. DIGESA.
- Beneficios: Piel firme, adiós caída de cabello, regenera rodillas/articulaciones.

PRECIOS Y OFERTAS (Respeta esto estrictamente):
1. CONSUMO PERSONAL:
   - 1 Unidad: S/ 110.
   - Pack x3: S/ 300 (Ahorro total, sale a S/ 100 c/u). *RECOMENDADO*.
   - REGALO: Pack x3 incluye 1 Tomatodo GRATIS.
2. NEGOCIO:
   - Pack Emprendedor (7 Unidades): S/ 95 c/u (Total S/ 665).
   - Mayorista (30+ u): S/ 85 c/u.

REGLAS DE SEGURIDAD (OBLIGATORIAS):
- SI PIDEN PRECIO: Pregunta primero "¿Consumo o Negocio?".
- SI QUIEREN PAGAR ("Yape", "Cuenta", "Quiero"): Responde SOLO: "[HUMANO_PAGO]".
- SI PIDEN FOTO/VIDEO: Responde SOLO: "[HUMANO_MULTIMEDIA]".
- SI HAY QUEJAS: Responde SOLO: "[HUMANO_SOPORTE]".
- ENVÍOS: Lima (Contraentrega). Provincia (Adelanto S/ 30 a Jose Olaya, saldo en agencia).

TONO: Amable, usa emojis (✨, 🚛, 🎁), respuestas cortas y persuasivas.
`;

// --- 3. WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu']
    }
});

const chatHistory = {};

client.on('qr', (qr) => {
    // Genera el texto para copiar si el dibujo falla
    console.log('\n⚡ COPIA EL CÓDIGO DE ABAJO Y PÉGALO EN UN GENERADOR QR:');
    console.log(qr); 
    console.log('⚡ FIN DEL CÓDIGO QR ⚡\n');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 10.0 LISTA (Motor: Gemini 2.0 Flash - Alta Velocidad ⚡)');
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const userId = msg.from;
    const userName = contact.pushname || "Amiga/o";
    const text = msg.body;

    if (msg.hasMedia) return; // Ignoramos fotos/audios para no gastar IA

    // --- INYECCIÓN DE PERSONALIDAD (MÉTODO INFALIBLE) ---
    // Esto funciona en CUALQUIER modelo de Gemini porque va en el historial, no en la config.
    if (!chatHistory[userId]) {
        chatHistory[userId] = [
            { 
                role: "user", 
                parts: [{ text: `Hola, actúa como Sofía siguiendo estas reglas estrictas:\n${SOFIA_PROMPT}` }] 
            },
            { 
                role: "model", 
                parts: [{ text: `¡Entendido! Soy Sofía de Renova Flux. Estoy lista para vender con esas reglas. ✨` }] 
            }
        ];
    }

    // Historial corto (últimos 8 mensajes) para ahorrar tokens y mantener contexto fresco
    chatHistory[userId].push({ role: "user", parts: [{ text: text }] });
    if (chatHistory[userId].length > 10) {
        const prompt = chatHistory[userId].slice(0, 2); // Mantenemos las instrucciones
        const recent = chatHistory[userId].slice(-6);   // Mantenemos lo reciente
        chatHistory[userId] = [...prompt, ...recent];
    }

    try {
        const chatSession = model.startChat({
            history: chatHistory[userId]
        });

        const result = await chatSession.sendMessage(text);
        const responseText = result.response.text();

        // --- FILTROS DE HUMANO ---
        if (responseText.includes("[HUMANO_PAGO]")) {
            await chat.sendMessage(`¡Excelente decisión ${userName}! 🎉\nPara gestionar tu pago y envío seguro, le paso el dato a **Jose Olaya** ahora mismo. Él te dará la cuenta oficial. ¡No te vayas! 😉`);
            return;
        }
        if (responseText.includes("[HUMANO_MULTIMEDIA]")) {
            await chat.sendMessage(`¡Claro! 📸\nDéjame pedirle a **Jose** que te envíe el video real desde almacén para que veas los sellos.`);
            return;
        }
        if (responseText.includes("[HUMANO_SOPORTE]")) {
            await chat.sendMessage(`Entiendo. 🙏\nPara solucionarlo rápido, voy a conectar con un **Supervisor Humano**. Dame un momento.`);
            return;
        }

        await chat.sendMessage(responseText);
        chatHistory[userId].push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
        console.error("Error Gemini:", error);
        // Si falla 2.0, intentamos responder genérico para no dejar en visto
        await chat.sendMessage("¡Hola! Tuve un pequeño parpadeo de señal 📶. ¿Me lo repites?");
    }
});

client.initialize();