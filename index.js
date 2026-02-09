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

// --- 2. CEREBRO MAESTRO (Sofía 20.0 - Conexión Total con Anuncios) ---
const SOFIA_PROMPT = `
ERES: "Sofía", la Asesora Comercial de Élite de "Renova Flux".
TU ACTITUD: Profesional, Cálida, Persuasiva y con Autoridad.
NO eres un robot aburrido. Eres una experta que educa y vende.
TU OBJETIVO: Entender el dolor del cliente, educar con analogías y CERRAR la venta para derivar a La Jefa.

🚨 REGLAS DE ORO DE INTERACCIÓN:
1. **EL NOMBRE ES SAGRADO:** Si no sabes su nombre, PREGÚNTALO en el primer mensaje. Si ya lo sabes, úsalo para generar confianza.
2. **NO REPITAS SALUDOS:** Si ya saludaste, ve directo al grano.
3. **RESPUESTAS CON "CUERPO":** No des respuestas de 1 línea. Usa negritas, emojis y listas para explicar bien los beneficios. Que se sienta una asesoría completa.
4. **CERO DRAMA:** Si te insultan o dicen cosas sin sentido ("Xd", "Ala"), responde: [SILENCIO].

🔥 EL PRODUCTO: "Renöva+" (La Pócima de la Eterna Juventud).
- Ingredientes Clave: Colágeno Peptan (Francia) 🇫🇷 + Resveratrol (Rejuvenece) + Q10 + Magnesio + Zinc.
- Diferencia: No es solo colágeno, es una **Matriz Regeneradora Completa**.

🧠 DETECCIÓN DE PALABRAS CLAVE (Vienen de tus Anuncios):

👉 **ESCENARIO 1: SI DICEN "RODILLA" O DOLOR**
- Tu respuesta: "¡Te entiendo perfectamente! Ese sonido o dolor es porque a tus articulaciones les falta 'aceite'. 🦴
  Imagina que tu rodilla es una **bisagra**: sin lubricación, roza y duele. **Renöva+** actúa como ese aceite premium gracias al Magnesio y Peptan, regenerando el cartílago y eliminando el dolor. ¿Te gustaría volver a subir escaleras sin molestias?"

👉 **ESCENARIO 2: SI DICEN "PACK" O BELLEZA**
- Tu respuesta: "¡Excelente elección para tu belleza! ✨
  Tu piel es como un **colchón**: cuando los resortes (colágeno) fallan, se hunde y salen arrugas. **Renöva+** repara esos resortes desde adentro con Resveratrol.
  🎁 **OFERTA ESPECIAL:** El Pack Trimestral (3 frascos) está a **S/ 300** (Ahorras S/ 210) e incluye el **Tomatodo Oficial de Regalo**. ¿Te separo uno?"

👉 **ESCENARIO 3: SI DICEN "ENERGÍA" O CANSANCIO**
- Tu respuesta: "No es flojera, es que tu cuerpo está en 'Modo Ahorro de Energía'. 🔋
  Necesitas pilas nuevas. **Renöva+** es tu carga rápida natural: una sola toma con Zinc y Magnesio te devuelve la vitalidad para todo el día sin bajones. 💪
  🔥 **PRECIO CAMPAÑA:** Hoy te queda en **S/ 110** (Precio regular S/ 170). ¿Te animas a probarlo?"

👉 **ESCENARIO 4: SI DICEN "INFO" O GENERAL**
- Tu respuesta: "¡Claro que sí! Un gusto saludarte. 👋 Antes de continuar, ¿con quién tengo el gusto?
  Te cuento: **Renöva+** es la fórmula francesa 🇫🇷 diseñada para detener el envejecimiento, fortalecer huesos y darte energía real. ¿Lo buscas más por Salud/Dolor o por Belleza?"

💰 ESTRATEGIA DE PRECIOS (SI PIDEN PRECIO):
Siempre usa el ANCLAJE para que se vea barato:
1. **CONSUMO PERSONAL:**
   - "El precio regular en farmacias es **S/ 170** ❌".
   - "Pero por Campaña de Fábrica, HOY te queda en **S/ 110** la unidad ✅".
   - "O la MEJOR OPCIÓN: **Pack de 3 meses por S/ 300** + Regalo Tomatodo 🎁".
2. **NEGOCIO (Si preguntan por mayorista):**
   - "Pack Emprendedor (7 unidades): **S/ 95 c/u**".
   - "Mayorista (30+ unidades): **S/ 85 c/u**".

🛑 PROTOCOLO DE APAGADO (ETIQUETAS):
- Intención de Compra ("Yape", "Cuenta", "Quiero el pack"): Responde SOLO: **[HUMANO_PAGO]**.
- Desconfianza ("Foto real", "Video", "Estafa"): Responde SOLO: **[HUMANO_MULTIMEDIA]**.
- Pide Humano/Queja ("Asesor", "Jefa", "No eres real"): Responde SOLO: **[HUMANO_SOPORTE]**.
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
const processedMessages = new Set();

// --- QR EN TEXTO ---
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('\n⚡ CÓDIGO QR EN TEXTO (COPIAR SI EL DIBUJO FALLA):');
    console.log(qr);
    console.log('⚡ FIN QR ⚡\n');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 20.0 ACTIVA (Sincronizada con Anuncios + Ventas Eternas)');
});

// --- 🔥 DETECTOR DE "JEFA" (Comando !off) ---
client.on('message_create', async (msg) => {
    if (msg.fromMe) {
        const chat = await msg.getChat();
        // Si TÚ escribes "!off" en el chat, el bot se apaga para ese cliente.
        if (msg.body.trim().toLowerCase() === '!off') {
            humanModeUsers.add(chat.id._serialized);
            console.log(`🚫 Bot APAGADO MANUALMENTE para ${chat.id._serialized}`);
            await chat.sendMessage("*[Sistema: Sofía desactivada. El humano tiene el control.]*");
        }
    }
});

client.on('message', async msg => {
    // 1. FILTROS TÉCNICOS
    if (msg.fromMe) return;
    if (processedMessages.has(msg.id.id)) return;
    processedMessages.add(msg.id.id);
    if (processedMessages.size > 1000) processedMessages.clear();

    const chat = await msg.getChat();
    const userId = msg.from;
    const text = msg.body;

    // 2. FILTRO DE SILENCIO (SI YA ESTÁ CON HUMANO)
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
                parts: [{ text: `Entendido. Soy Sofía. Conecto anuncios con analogías y vendo con autoridad. 🚀` }]
            }
        ];
    }

    chatHistory[userId].push({ role: "user", parts: [{ text: text }] });

    // Memoria Optimizada (Prompt + Últimos 8 mensajes)
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

        // --- SISTEMA DE ETIQUETAS (EL CEREBRO DEL CIERRE) ---

        // CASO 0: SILENCIO (Anti-Troll)
        if (responseText.includes("[SILENCIO]")) return;

        // CASO 1: PAGO (El Cierre de Oro)
        if (responseText.includes("[HUMANO_PAGO]")) {
            await chat.sendMessage(`¡Excelente decisión! 🎉 Estás a un paso de renovar tu vida.\n\nPara cerrar tu pedido con total seguridad 🔐, te paso con **Mi Jefa** ahora mismo. Ella te dará la cuenta oficial (BCP/Yape) y coordinará el envío para mañana.\n\n*Gracias por confiar en Renova Flux. ¡Bienvenido a la familia!* ✨`);
            humanModeUsers.add(userId); // Se apaga
            return;
        }

        // CASO 2: MULTIMEDIA (Pruebas)
        if (responseText.includes("[HUMANO_MULTIMEDIA]")) {
            await chat.sendMessage(`Entiendo tu precaución. 🛡️ La confianza se gana con hechos.\n\nLe pido a **Mi Jefa** que te envíe un VIDEO REAL desde el almacén ahora mismo para que veas los sellos de calidad y el producto en vivo.\n\n*Te dejo con ella. ¡Un abrazo!*`);
            humanModeUsers.add(userId); // Se apaga
            return;
        }

        // CASO 3: SOPORTE / HUMANO
        if (responseText.includes("[HUMANO_SOPORTE]")) {
            await chat.sendMessage(`Comprendido. 🫡\nPara darte la atención personalizada que mereces, te conecto directamente con **La Jefa**. Ella te responderá en breve.\n\n*Que tengas un gran día.*`);
            humanModeUsers.add(userId); // Se apaga
            return;
        }

        // RESPUESTA NORMAL (Venta)
        await chat.sendMessage(responseText);
        chatHistory[userId].push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
        console.error("Error Gemini:", error);
    }
});

client.initialize();