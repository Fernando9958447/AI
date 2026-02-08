const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- 1. SEGURIDAD Y CONFIGURACIÓN ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR FATAL: Falta la variable GEMINI_API_KEY en Railway.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Usamos gemini-2.0-flash para velocidad y capacidad de razonamiento
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 2. CEREBRO MAESTRO (PERSONALIDAD EXTREMA) ---
const SOFIA_PROMPT = `
ERES: "Sofía", la Asesora Comercial Estrella de "Renova Flux".
ACTITUD: Ganadora, Líder, Energética pero muy humana.
TRATO: Usas "Campeón", "Campeona", "Líder". (JAMÁS uses "bebé", "corazón" o "reina").
TU JEFA: Es la dueña y máxima autoridad. Tú eres su asistente digital.
MISIÓN: Explicar el producto con analogías simples (para niños), cerrar la venta y DERIVAR A LA JEFA.

🔥 EL PRODUCTO: "Renöva+" (La Pócima de la Eterna Juventud).
- Fórmula: Colágeno Peptan (Francia) + Resveratrol + Q10 + Magnesio + Zinc.
- Seguridad: 100% Original (Registro DIGESA y Precinto Plateado).

🧠 EXPLICACIÓN DE BENEFICIOS (Nivel Pre-escolar):
1. PIEL (El Colchón): "Tu piel es como un colchón. El colágeno son los resortes. Con la edad se rompen y el colchón se hunde (arrugas). Renöva+ pone resortes nuevos para que quede firme y lisito".
2. RODILLAS (La Bisagra): "Tus rodillas son bisagras. Sin aceite, suenan y duelen. Renöva+ es el aceite premium que las deja suaves y sin dolor. ¡Huesos de roble!".
3. ENERGÍA (La Batería): "El Resveratrol es como ponerle pilas nuevas a tu cuerpo. Adiós cansancio".

💰 LISTA DE PRECIOS Y OFERTAS (Inquebrantables):
1. CONSUMO PERSONAL (Estrategia de Anclaje):
   - "Precio regular en farmacias: S/ 170". ❌
   - "Precio Campaña HOY (35% OFF): **S/ 110** la unidad". ✅
   - *LA JOYA DE la CORONA*: "Pack Trimestral (3 frascos) por **S/ 300**. (Ahorras S/ 210). + REGALO: 1 Tomatodo Oficial". 🎁
2. NEGOCIO (Volumen):
   - Pack Emprendedor (7 unidades): S/ 95 c/u.
   - Mayorista (30+ unidades): S/ 85 c/u.

🚨 PROTOCOLO DE SILENCIO (INTERVENCIÓN HUMANA):
Tú llevas al cliente hasta la puerta, pero LA JEFA cobra.
- SI QUIEREN PAGAR ("Yape", "Cuenta", "Quiero el de 3", "Cómo pago"): Responde SOLO: "[HUMANO_PAGO]".
- SI PIDEN PRUEBAS ("Foto real", "Video", "Desconfío"): Responde SOLO: "[HUMANO_MULTIMEDIA]".
- SI PIDEN HUMANO ("Quiero hablar con alguien", "Asesor"): Responde SOLO: "[HUMANO_SOPORTE]".
- SI RECLAMAN: Responde SOLO: "[HUMANO_SOPORTE]".

LOGÍSTICA:
- Lima: Contraentrega en casa.
- Provincia: Adelanto S/ 30 a la cuenta de La Jefa, saldo en agencia Shalom/Olva.

TONO: Contundente, usa emojis: 🏆, 🚀, 💎, 🍷, 🦴. Despídete siempre deseando un "Gran día".
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
const humanModeUsers = new Set(); // Lista negra de usuarios que ya pasaron a humano
const activeTimers = {}; // Para el modo sentimental (seguimiento)

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('\n⚡ COPIA EL CÓDIGO DE ABAJO SI EL DIBUJO NO FUNCIONA:');
    console.log(qr);
    console.log('⚡ FIN QR ⚡\n');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 15.0 ACTIVA (Modo: Perfección + Sentimental)');
});

client.on('message', async msg => {
    // Evitar procesar mensajes propios o multimedia
    if (msg.fromMe) return;
    if (msg.hasMedia) return;

    const chat = await msg.getChat();
    const userId = msg.from;
    const text = msg.body;

    // 1. FILTRO DE SILENCIO: Si ya está con La Jefa, Sofía no molesta MÁS.
    if (humanModeUsers.has(userId)) {
        return;
    }

    // 2. REINICIO DE TEMPORIZADOR SENTIMENTAL
    // Si el cliente escribe, borramos el temporizador anterior
    if (activeTimers[userId]) clearTimeout(activeTimers[userId]);

    // Programamos uno nuevo: Si en 2 HORAS no responde, le escribimos.
    activeTimers[userId] = setTimeout(async () => {
        // Verificamos de nuevo que no esté en modo humano
        if (humanModeUsers.has(userId)) return;

        // Mensaje sentimental para recuperar la venta
        await chat.sendMessage(`Hola Campeón/ona... 🥺 Me quedé pendiente de ti.\n\nNo quiero que pierdas la campaña del 35% de descuento de hoy. ¿Te separo el pedido o tienes alguna duda que pueda resolverte? 🚀`);
    }, 2 * 60 * 60 * 1000); // 2 Horas en milisegundos

    // 3. INYECCIÓN DE CEREBRO
    if (!chatHistory[userId]) {
        chatHistory[userId] = [
            { 
                role: "user", 
                parts: [{ text: `ACTÚA ESTRICTAMENTE ASÍ:\n${SOFIA_PROMPT}` }] 
            },
            { 
                role: "model", 
                parts: [{ text: `Entendido. Soy Sofía. Explicaré como a niños, venderé como líder y pasaré a La Jefa para cobrar. 🏆` }] 
            }
        ];
    }

    chatHistory[userId].push({ role: "user", parts: [{ text: text }] });

    // Mantener memoria limpia (Prompt + Últimos 10)
    if (chatHistory[userId].length > 14) {
        const prompt = chatHistory[userId].slice(0, 2);
        const recent = chatHistory[userId].slice(-10);
        chatHistory[userId] = [...prompt, ...recent];
    }

    try {
        const chatSession = model.startChat({
            history: chatHistory[userId]
        });

        const result = await chatSession.sendMessage(text);
        const responseText = result.response.text();

        // --- SISTEMA DE DERIVACIÓN (CIERRE DE VENTA) ---

        if (responseText.includes("[HUMANO_PAGO]")) {
            await chat.sendMessage(`¡Trato hecho, Campeón/ona! 🤝\nPara cerrar tu pedido con seguridad 🔐, te paso con **Mi Jefa** ahora mismo. Ella te dará la cuenta oficial BCP/Yape y coordinará el envío.\n\n*Que tengas un GRAN día. Sofía fuera.* 🚀`);
            humanModeUsers.add(userId); // Apagamos el bot para este usuario
            if (activeTimers[userId]) clearTimeout(activeTimers[userId]); // Cancelamos el sentimental
            return;
        }

        if (responseText.includes("[HUMANO_MULTIMEDIA]")) {
            await chat.sendMessage(`Entiendo, Líder. La confianza se gana con hechos. 🛡️\nLe pido a **Mi Jefa** que te envíe un VIDEO REAL desde el almacén ahora mismo para que veas los sellos de calidad.\n\n*Te dejo con ella. ¡Un abrazo!*`);
            humanModeUsers.add(userId);
            if (activeTimers[userId]) clearTimeout(activeTimers[userId]);
            return;
        }

        if (responseText.includes("[HUMANO_SOPORTE]")) {
            await chat.sendMessage(`¡Entendido! 🫡\nPara darte la atención personalizada que mereces, te conecto directamente con **La Jefa**. Ella te responderá en breve.\n\n*Que tengas un excelente día.* ✨`);
            humanModeUsers.add(userId);
            if (activeTimers[userId]) clearTimeout(activeTimers[userId]);
            return;
        }

        // Si no hay etiquetas, Sofía responde y sigue vendiendo
        await chat.sendMessage(responseText);
        chatHistory[userId].push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
        console.error("Error Gemini:", error);
    }
});

client.initialize();