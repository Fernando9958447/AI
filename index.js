const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- 1. SEGURIDAD ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR FATAL: Falta la variable GEMINI_API_KEY en Railway.");
    // No matamos el proceso, solo avisamos.
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "NO_KEY");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 2. CEREBRO MAESTRO (Sofía 22.0 - La Vendedora Perfecta) ---
const SOFIA_PROMPT = `
ERES: "Sofía", la Asesora Comercial de Élite de "Renova Flux".
ACTITUD: Profesional, Empática, Persuasiva y con Autoridad.
OBJETIVO: Educar al cliente (que no sabe nada) y llevarlo al CIERRE usando psicología.

🔥 EL PRODUCTO: "Renöva+" (La Pócima de la Eterna Juventud).
- **Fórmula Superior:** 11.4g de proteína pura por toma (La competencia como Herbalife o Teoma tienen solo 4g o 6g). ¡Somos el doble de potentes!
- **Ingredientes:** Colágeno Peptan (Francia) 🇫🇷 + Resveratrol (Antioxidante #1) + Coenzima Q10 + Magnesio (600mg) + Zinc + Biotina.
- **Beneficios Reales:** 1. Adiós Dolor Articular (Artrosis/Osteoporosis).
  2. Piel Firme y sin Celulitis.
  3. Cabello Radiante (Biotina).
  4. Energía Total (Vitaminas).
- **Presentación:** Pote de 315g, Sabor Berries 🍇, Libre de Gluten y Azúcar.

🧠 PSICOLOGÍA DE VENTAS (TÉCNICA "VENTAS ETERNAS"):
No vendas el frasco, vende la TRANSFORMACIÓN. Usa estas analogías SEGÚN EL DOLOR del cliente:

👉 **SI VIENEN POR DOLOR / RODILLAS / ARTROSIS:**
- *Analogía:* "Tus rodillas son como **bisagras**: si les falta aceite, suenan y duelen ('ñiec ñiec'). Renöva+ es el aceite premium (Magnesio + Peptan) que las lubrica y regenera. ¡Vuelve a subir escaleras sin miedo!"

👉 **SI VIENEN POR BELLEZA / PIEL / ARRUGAS:**
- *Analogía:* "Tu piel es como un **colchón**: los resortes son el colágeno. Con la edad se rompen y el colchón se hunde (arrugas/celulitis). Renöva+ te pone resortes nuevos y fuertes desde adentro. ¡Efecto lifting!"

👉 **SI VIENEN POR ENERGÍA / CANSANCIO:**
- *Analogía:* "Tu cuerpo está en 'Modo Ahorro de Energía'. 🔋 Renöva+ son tus pilas nuevas. Una sola toma te da la potencia para todo el día gracias al Zinc y Q10."

💰 ESTRATEGIA DE PRECIOS (ANCLAJE):
Siempre muestra el ahorro para activar el sesgo de oportunidad:
1. **CONSUMO PERSONAL:**
   - "Precio Regular en Farmacia: S/ 170" ❌.
   - "Precio Campaña HOY (35% OFF): **S/ 110** la unidad" ✅.
   - **LA JOYA (Upsell):** "Pack Trimestral (3 Frascos) por **S/ 300** + Regalo Tomatodo Oficial 🎁. (Te ahorras S/ 210)".
2. **NEGOCIO:**
   - "Pack Emprendedor (7 unidades): **S/ 95 c/u**".

🚨 REGLAS DE INTERACCIÓN:
1. **EL NOMBRE:** Si no lo sabes, pregúntalo al inicio ("¿Con quién tengo el gusto?"). Si ya lo sabes, úsalo.
2. **RESPUESTAS VISUALES:** Usa **negritas**, emojis (✨, 🚀, 💎) y listas. No mandes textos planos y aburridos.
3. **ANTI-TROLL:** Si dicen "Xd", "Mrd", "Ala" o insultan -> Responde: [SILENCIO].
4. **CIERRE:** Una vez que el cliente quiera comprar, pásalo a La Jefa con la etiqueta [HUMANO_PAGO].

🛑 ETIQUETAS DE APAGADO (PROTOCOLO FINAL):
- Si dicen "Yape", "Cuenta", "Quiero el de 3": **[HUMANO_PAGO]**
- Si dicen "No confío", "Pruebas", "Video": **[HUMANO_MULTIMEDIA]**
- Si piden hablar contigo ("Asesor", "Jefa"): **[HUMANO_SOPORTE]**
`;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

const chatHistory = {};
const humanModeUsers = new Set();
const processedMessages = new Set();

// --- QR EN TEXTO ---
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('\n⚡ QR EN TEXTO (COPIA ESTO SI EL DIBUJO FALLA):');
    console.log(qr);
    console.log('⚡ FIN QR ⚡\n');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 22.0 ACTIVA (La Versión Definitiva)');
});

// --- 🔥 DETECTOR DE "JEFA" (Comando !off y Anti-Crash) ---
client.on('message_create', async (msg) => {
    try {
        // BLINDAJE: Ignorar Estados y Canales
        if (msg.isStatus || msg.id.remote.includes('status') || msg.id.remote.includes('newsletter')) return;

        if (msg.fromMe) {
            let chat;
            try { chat = await msg.getChat(); } catch (e) { return; }
            
            // Si TÚ escribes "!off", apagamos el bot manualmente.
            if (msg.body.trim().toLowerCase() === '!off') {
                humanModeUsers.add(chat.id._serialized);
                console.log(`🚫 Bot APAGADO MANUALMENTE para ${chat.id._serialized}`);
                await chat.sendMessage("*[Sistema: Sofía desactivada.]*");
            }
        }
    } catch (error) {
        // Silencio en errores de sistema
    }
});

client.on('message', async msg => {
    try {
        // --- 1. FILTROS DE SEGURIDAD (BLINDAJE TOTAL) ---
        if (msg.fromMe) return;
        
        // Ignorar Estados y Canales (Anti-Crash)
        if (msg.isStatus || msg.id.remote === 'status@broadcast' || msg.id.remote.includes('newsletter') || msg.type === 'e2e_notification') return;

        // Anti-Repetición (Deduplicación)
        if (processedMessages.has(msg.id.id)) return;
        processedMessages.add(msg.id.id);
        if (processedMessages.size > 1000) processedMessages.clear();

        let chat;
        try { chat = await msg.getChat(); } catch (e) { return; }

        const userId = msg.from;
        const text = msg.body;

        // 2. FILTRO DE SILENCIO (Modo Humano)
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
                    parts: [{ text: `Entendido. Soy Sofía. Experta en Renöva+. Vendo transformación, no productos. 🚀` }]
                }
            ];
        }

        chatHistory[userId].push({ role: "user", parts: [{ text: text }] });

        // Memoria Optimizada (Prompt + Últimos 10 mensajes)
        if (chatHistory[userId].length > 14) {
            const prompt = chatHistory[userId].slice(0, 2);
            const recent = chatHistory[userId].slice(-10);
            chatHistory[userId] = [...prompt, ...recent];
        }

        // GENERACIÓN DE RESPUESTA
        const chatSession = model.startChat({
            history: chatHistory[userId]
        });

        const result = await chatSession.sendMessage(text);
        const responseText = result.response.text();

        // --- SISTEMA DE CIERRE (ETIQUETAS) ---

        if (responseText.includes("[SILENCIO]")) return;

        if (responseText.includes("[HUMANO_PAGO]")) {
            await chat.sendMessage(`¡Excelente decisión! 🎉\nPara cerrar tu pedido con seguridad 🔐, te paso con **Mi Jefa** ahora mismo. Ella te dará la cuenta oficial y coordinará el envío.\n\n*Gracias por confiar en Renova Flux.* ✨`);
            humanModeUsers.add(userId);
            return;
        }

        if (responseText.includes("[HUMANO_MULTIMEDIA]")) {
            await chat.sendMessage(`Entiendo tu precaución. 🛡️\nLe pido a **Mi Jefa** que te envíe un VIDEO REAL desde el almacén ahora mismo para que veas los sellos de calidad.\n\n*Te dejo con ella.*`);
            humanModeUsers.add(userId);
            return;
        }

        if (responseText.includes("[HUMANO_SOPORTE]")) {
            await chat.sendMessage(`Comprendido. 🫡\nPara atención personalizada, te conecto con **La Jefa**. Ella te responderá en breve.`);
            humanModeUsers.add(userId);
            return;
        }

        // Respuesta Normal
        await chat.sendMessage(responseText);
        chatHistory[userId].push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
        console.error("⚠️ Error recuperado en mensaje:", error.message);
    }
});

client.initialize();