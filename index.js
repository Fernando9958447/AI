const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- CONFIGURACIÓN ---
// En Railway usaremos variables de entorno. Si pruebas local, asegura tu API KEY.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

// --- LA PERSONALIDAD DE SOFÍA (PROMPT MAESTRO) ---
const SYSTEM_PROMPT = `
Eres "Sofía", la Asesora de Ventas Estrella de la marca "Renova Flux". Tu objetivo es cerrar ventas de colágeno premium.
Tu tono es: Amable, energético, empático, usas emojis (✨, 🚛, 🎁, 💎) y tratas al cliente de "mi estimada/o", "campeona/on", "amiga/o".

INFORMACIÓN OBLIGATORIA DEL PRODUCTO (NO INVENTES):
1. Producto: Renöva+ (Trilogía de Juventud: Colágeno + Resveratrol + Q10 + Magnesio + Biotina + Zinc). Laboratorio Peptan (Francia).
2. Beneficios: Piel firme, detiene caída de cabello, regenera cartílagos (dolor rodilla), energía.
3. Precios CONSUMO PERSONAL:
   - Precio Regular: S/ 170.
   - OFERTA 1 UNIDAD: S/ 110 (Tratamiento mensual).
   - OFERTA PACK x3: S/ 300 (Sale a S/ 100 c/u) -> *Opción recomendada*.
   - REGALO: Si compran Pack x3 = 1 Tomatodo GRATIS. (Si compran 6 = 2 Tomatodos).
4. Precios NEGOCIO/MAYORISTA:
   - Precio S/ 85: SOLO para volumen (Cajas de 30 a 50 unidades).
   - Pack Emprendedor (7 Unidades): S/ 95 c/u (Total S/ 665). *Recomendar esto si piden descuento pero no compran 30*.
5. Logística:
   - Lima: Pago Contraentrega.
   - Provincia: Envío por Shalom/Olva. Requiere ADELANTO DE S/ 30 por Yape (Titular: Jose Olaya). El saldo se paga en agencia.
6. Originalidad: Cuenta con Registro Sanitario DIGESA, Precinto de Seguridad Plateado, Lote Impreso.

REGLAS DE COMPORTAMIENTO:
- Si preguntan "Precio", NO des el número solo. Pregunta primero: "¿Es para tu consumo personal o para negocio?".
- Si preguntan "¿Es original?", explica los sellos de seguridad y DIGESA.
- Si el cliente dice "Quiero comprar", "Yape", o confirma el pedido -> Pide foto del pago y DNI.
- Si piden "Video real", "Foto real", o envían un comprobante de pago -> RESPONDE EXACTAMENTE: "[HUMANO]" (así sabré que debo intervenir).
- Respuestas CORTAS y al grano (máximo 3 párrafos). Siempre termina con una PREGUNTA para seguir la venta.
`;

// Historial de conversación simple (para que recuerde qué le dijeron antes)
const chatHistory = {};

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('⚡ ESCANEA EL QR AHORA ⚡');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 10.0 ESTÁ LISTA Y PENSANDO.');
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const userId = msg.from;
    const userName = contact.pushname || "Amiga/o";
    const text = msg.body;

    // --- REGLAS DE SEGURIDAD ---
    // Si envían audios o fotos, pasamos a humano
    if (msg.hasMedia) {
        await chat.sendMessage(`✅ Recibido. Permíteme derivar este archivo con **Mi jefa** para que lo revise personalmente. 👨‍💻`);
        return;
    }

    // Inicializar historial si es nuevo
    if (!chatHistory[userId]) {
        chatHistory[userId] = [
            { role: "user", parts: [{ text: "Hola" }] },
            { role: "model", parts: [{ text: `Hola ${userName}, soy Sofía de Renova Flux. ¿Buscas el colágeno para consumo personal o negocio?` }] }
        ];
    }

    // Añadir mensaje del usuario al historial
    chatHistory[userId].push({ role: "user", parts: [{ text: text }] });

    // Mantener historial corto (últimos 10 mensajes) para ahorrar memoria
    if (chatHistory[userId].length > 20) chatHistory[userId] = chatHistory[userId].slice(-10);

    try {
        // --- CEREBRO GEMINI ---
        const chatSession = model.startChat({
            history: chatHistory[userId],
            systemInstruction: SYSTEM_PROMPT, // Aquí inyectamos la personalidad
        });

        const result = await chatSession.sendMessage(text);
        const responseText = result.response.text();

        // --- DETECTOR DE "HUMANO" ---
        // Si Gemini decide que necesita un humano, enviamos el aviso
        if (responseText.includes("[HUMANO]")) {
            await chat.sendMessage(`Entendido ${userName}. 🙋‍♂️ Voy a llamar a **Jose Olaya** (Asesor Humano) para que te envíe el video/foto o valide tu pago ahora mismo. Dame unos minutos.`);
            return;
        }

        // Enviar respuesta de la IA
        await chat.sendMessage(responseText);

        // Guardar respuesta en historial
        chatHistory[userId].push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
        console.error("Error con Gemini:", error);
        // Respuesta de emergencia si falla la IA
        await chat.sendMessage("¡Hola! Disculpa, tuve un pequeño parpadeo. 😅 ¿Me decías?");
    }
});

client.initialize();