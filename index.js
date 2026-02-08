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

// --- 2. CEREBRO MAESTRO (Sofía 19.0 - Vendedora Inteligente) ---
const SOFIA_PROMPT = `
ERES: "Sofía", Asesora de Ventas de "Renova Flux".
PERSONALIDAD: Profesional, Persuasiva, Concisa. NO eres un robot repetitivo.
OBJETIVO: Vender "Renöva+" usando psicología y luegar pasar la venta a La Jefa.

🔥 EL PRODUCTO: "Renöva+" (La Pócima de la Eterna Juventud).
- Ingredientes: Colágeno Peptan (Francia), Resveratrol (Rejuvenece), Q10, Magnesio.
- Seguridad: 100% Original con Registro DIGESA.

🧠 CÓMO EXPLICAR (SOLO SI PIDEN INFO):
¡NO REPITAS EL SALUDO NI TE PRESENTES OTRA VEZ SI YA LO HICISTE!
Usa estas analogías para que entiendan RÁPIDO:
1. PIEL: "Tu piel es como un colchón. El colágeno son los resortes. Renöva+ pone resortes nuevos para que no se hunda (arrugas)".
2. RODILLAS: "Es como ponerle aceite premium a una bisagra que suena. Adiós al 'ñiec ñiec' y al dolor".
3. ENERGÍA: "El Resveratrol es como ponerle pilas nuevas a tu cuerpo".

💰 ESTRATEGIA DE PRECIOS (SI PIDEN PRECIO):
Muestra la oportunidad única:
1. CONSUMO PERSONAL:
   - "Precio Farmacia: S/ 170" ❌ (Tachado).
   - "Precio Campaña HOY (35% OFF): **S/ 110**". ✅
   - MEJOR OFERTA: "Pack Trimestral (3 frascos) por **S/ 300** + Regalo Tomatodo". 🎁
2. NEGOCIO:
   - Pack Emprendedor (7 u): S/ 95 c/u.
   - Mayorista (30+ u): S/ 85 c/u.

🛑 PROTOCOLO DE SILENCIO (CUÁNDO APAGARTE):
Si detectas intención de cierre, despídete y usa la etiqueta.
- SI QUIEREN PAGAR ("Yape", "Cuenta", "Quiero el pack"): Responde SOLO: "[HUMANO_PAGO]".
- SI PIDEN PRUEBAS ("Foto real", "Video", "Desconfío"): Responde SOLO: "[HUMANO_MULTIMEDIA]".
- SI PIDEN HUMANO O INSULTAN: Responde SOLO: "[HUMANO_SOPORTE]".
- SI YA DISTE LA INFO Y NO RESPONDEN: No digas nada. [SILENCIO].

TONO: Breve. Emojis: ✨, 🚀, 💎, 🍷.
`;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu']
    }
});

// --- GESTIÓN DE MEMORIA Y ESTADO ---
const chatHistory = {};
const humanModeUsers = new Set(); // Lista negra de usuarios (Apagado)
const processedMessages = new Set(); // Filtro anti-spam

// --- QR EN TEXTO (PARA RAILWAY) ---
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('\n⚡ SI EL DIBUJO FALLA, COPIA ESTO Y ÚSALO EN UN GENERADOR QR:');
    console.log(qr); 
    console.log('⚡ FIN QR ⚡\n');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 19.0 LISTA (Detector de Humano Activo)');
});

// --- 🔥 DETECTOR DE "JEFA" (MAGIA NEGRA) ---
// Escuchamos TODOS los mensajes creados (incluidos los que TÚ envías desde tu cel)
client.on('message_create', async (msg) => {
    // Si el mensaje lo enviaste TÚ (fromMe) y NO empieza con el prefijo de bot (para evitar que se bloquee sola)
    // Asumiremos que si hay actividad manual tuya en el chat, el bot debe callarse.
    if (msg.fromMe) {
        const chat = await msg.getChat();
        // Si tú escribes, agregamos ese chat a la lista negra
        // (A menos que sea el mismo bot respondiendo, lo cual es difícil de filtrar perfecto, 
        // pero la lógica de abajo en 'message' ya filtra lo que manda el bot).
        
        // TRUCO: Si tú escribes "!off" en el chat, apagas al bot seguro.
        if (msg.body.includes('!off') || msg.body.length > 1) {
            // Nota: Esto es una medida de seguridad. Si tú intervienes, Sofía asume que tomaste el mando.
            // Para evitar que Sofía se bloquee a sí misma, confiamos en los tags [HUMANO].
            // PERO, si quieres forzar el silencio, escribe "!off" desde tu celular en el chat del cliente.
            if (msg.body === '!off') {
                humanModeUsers.add(chat.id._serialized);
                console.log(`🚫 Bot apagado manualmente para ${chat.id._serialized}`);
            }
        }
    }
});

client.on('message', async msg => {
    // 1. FILTROS TÉCNICOS
    if (msg.fromMe) return;
    if (processedMessages.has(msg.id.id)) return; 
    processedMessages.add(msg.id.id);
    // Limpieza de memoria
    if (processedMessages.size > 1000) processedMessages.clear();

    const chat = await msg.getChat();
    const userId = msg.from;
    const text = msg.body;

    // 2. FILTRO DE SILENCIO (SI YA PASÓ A HUMANO)
    if (humanModeUsers.has(userId)) {
        console.log(`🔇 Ignorando a ${userId} (Ya está con humano).`);
        return;
    }

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
                parts: [{ text: `Entendido. Soy Sofía. Venderé con analogías y me apagaré si detecto cierre. 🚀` }] 
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

        // --- SISTEMA DE DERIVACIÓN Y SILENCIO ---

        // CASO 0: SILENCIO INTELIGENTE (Si el bot no tiene nada que decir)
        if (responseText.includes("[SILENCIO]")) return;

        // CASO 1: PAGO (EL CIERRE)
        if (responseText.includes("[HUMANO_PAGO]")) {
            await chat.sendMessage(`¡Excelente decisión! 🎉\nPara cerrar tu pedido con seguridad, te paso con **Mi Jefa** ahora mismo. Ella te dará la cuenta oficial BCP/Yape y coordinará el envío.\n\n*Gracias por confiar en Renova. ¡Gran día!* ✨`);
            humanModeUsers.add(userId); // <--- SE APAGA PARA SIEMPRE
            return;
        }

        // CASO 2: MULTIMEDIA / DESCONFIANZA
        if (responseText.includes("[HUMANO_MULTIMEDIA]")) {
            await chat.sendMessage(`Entiendo perfectamente. 🛡️\nLe pido a **Mi Jefa** que te envíe un VIDEO REAL desde el almacén ahora mismo para que veas los sellos de calidad.`);
            humanModeUsers.add(userId); // <--- SE APAGA
            return;
        }

        // CASO 3: SOPORTE / QUEJAS
        if (responseText.includes("[HUMANO_SOPORTE]")) {
            await chat.sendMessage(`Comprendido. 🫡\nPara darte la atención que necesitas, te conecto directamente con **La Jefa**. Ella te responderá en breve.`);
            humanModeUsers.add(userId); // <--- SE APAGA
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