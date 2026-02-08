const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- 1. CONFIGURACIÓN Y SEGURIDAD ---
// Verificamos que la llave exista antes de empezar para evitar crashes feos.
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR FATAL: No has puesto la variable GEMINI_API_KEY en Railway.");
    console.error("⚠️ El bot arrancará pero no podrá responder inteligentemente.");
}

// Inicialización de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "NO_API_KEY");

// --- 2. LA PERSONALIDAD DE SOFÍA (SYSTEM PROMPT) ---
// Aquí definimos las reglas de oro. La IA nunca pedirá dinero directamente.
const SYSTEM_INSTRUCTION = `
Eres "Sofía", la Asesora de Ventas Estrella de "Renova Flux".
Tu misión: Atender con amabilidad, resolver dudas, ofrecer promociones y CALMAR al cliente si está molesto.
Tu límite: NO cobras ni das números de cuenta. Cuando el cliente diga "Quiero comprar", "Yape", "Cuenta" o "Pago", tú pasas la posta al humano.

TONO DE VOZ:
- Amable, empático, energético. Usas emojis (✨, 🚛, 🎁, 💎).
- Tratas al cliente de "mi estimada/o", "campeona/on", "amiga/o".

INFORMACIÓN DEL PRODUCTO (Renöva+):
- Trilogía de Juventud: Colágeno + Resveratrol + Q10 + Magnesio.
- Origen: Laboratorio Peptan (Francia). 100% Original con Registro DIGESA.
- Beneficios: Piel firme, cabello fuerte, regenera cartílagos (dolor rodilla).

PRECIOS Y OFERTAS (Solo informa, no cobra):
- Consumo Personal:
    * 1 Unidad: S/ 110 (Antes S/ 170).
    * Pack x3: S/ 300 (Sale a S/ 100 c/u) -> *Recomendado*.
    * REGALO: Pack x3 incluye 1 Tomatodo GRATIS.
- Negocio/Mayorista:
    * Pack Emprendedor (7 Unidades): S/ 95 c/u.
    * Precio S/ 85: Solo para cajas de 30 a 50 unidades.

REGLAS DE COMPORTAMIENTO (STRICT MODE):
1. SI PREGUNTAN PRECIO: No des el número solo. Pregunta: "¿Es para consumo personal o negocio?".
2. SI PREGUNTAN ORIGINALIDAD: Explica los sellos (Plateado, Digesa) con seguridad.
3. SI EL CLIENTE QUIERE PAGAR ("Quiero el de 300", "Pásame el Yape", "Cómo pago"):
   - NO des el número de Yape.
   - RESPONDE EXACTAMENTE: "[HUMANO_PAGO]"
4. SI EL CLIENTE PIDE FOTO/VIDEO REAL O ENVÍA COMPROBANTE:
   - RESPONDE EXACTAMENTE: "[HUMANO_MULTIMEDIA]"
5. SI EL CLIENTE SE QUEJA O ES UN TEMA DIFÍCIL (Reclamo, Envío demorado):
   - Justifica suavemente ("Entiendo tu molestia, a veces la ruta se complica...") y luego...
   - RESPONDE EXACTAMENTE: "[HUMANO_SOPORTE]"

Tus respuestas deben ser cortas (máx 3 párrafos) y siempre terminar invitando a seguir hablando.
`;

// Configuración del modelo con la instrucción de sistema
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION
});

// --- 3. CLIENTE DE WHATSAPP ---
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

// Historial de conversación (Memoria a corto plazo)
const chatHistory = {};

client.on('qr', (qr) => {
    // Opción A: Dibujo (a veces falla en Railway)
    qrcode.generate(qr, { small: true });
    
    // Opción B: Texto para copiar (Infalible)
    console.log('\n⚡ SI EL DIBUJO NO FUNCIONA, COPIA EL TEXTO DE ABAJO Y ÚSALO EN UN GENERADOR QR:');
    console.log(qr); 
    console.log('⚡ FIN DEL CÓDIGO ⚡\n');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 10.0 ESTÁ LISTA. (Modo: Asistente - No Pagos)');
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const userId = msg.from;
    const userName = contact.pushname || "Amiga/o";
    const text = msg.body;

    // --- FILTRO DE MEDIOS ---
    // Si envían fotos/audios, la IA no los procesa, llama al humano.
    if (msg.hasMedia) {
        await chat.sendMessage(`✅ Recibido. Voy a avisarle a **Jose Olaya** para que revise tu archivo personalmente. Dame unos minutos. 👨‍💻`);
        return;
    }

    // Inicializar historial si es nuevo usuario
    if (!chatHistory[userId]) {
        chatHistory[userId] = [
            { role: "user", parts: [{ text: "Hola" }] },
            { role: "model", parts: [{ text: `Hola ${userName}, soy Sofía de Renova Flux. ¿Buscas el colágeno para consumo personal o negocio?` }] }
        ];
    }

    // Añadir mensaje actual al historial
    chatHistory[userId].push({ role: "user", parts: [{ text: text }] });

    // Limitar memoria (últimos 10 mensajes)
    if (chatHistory[userId].length > 20) chatHistory[userId] = chatHistory[userId].slice(-10);

    try {
        // --- CEREBRO GEMINI ---
        const chatSession = model.startChat({
            history: chatHistory[userId]
        });

        const result = await chatSession.sendMessage(text);
        const responseText = result.response.text();

        // --- DETECTORES DE INTERVENCIÓN HUMANA ---
        
        if (responseText.includes("[HUMANO_PAGO]")) {
            await chat.sendMessage(`¡Excelente decisión ${userName}! 🎉
Para gestionar tu pago y envío con total seguridad, le paso el dato a **Jose Olaya** ahora mismo.
Él te dará la cuenta oficial y tomará tus datos de envío. ¡No te vayas! 😉`);
            return;
        }

        if (responseText.includes("[HUMANO_MULTIMEDIA]")) {
            await chat.sendMessage(`¡Claro que sí! 📸
Déjame pedirle a **Jose** que te envíe el video/foto real desde almacén ahora mismo para que lo veas en vivo.`);
            return;
        }

        if (responseText.includes("[HUMANO_SOPORTE]")) {
            await chat.sendMessage(`Entiendo perfectamente. 🙏
Para resolver esto rápido y darte una solución concreta, voy a conectar con un **Supervisor Humano**. Dame un momento por favor.`);
            return;
        }

        // Si no hay intervención, enviamos la respuesta de Sofía
        await chat.sendMessage(responseText);

        // Guardamos la respuesta en memoria
        chatHistory[userId].push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
        console.error("Error con Gemini:", error);
        // Fallback silencioso: Si la IA falla, no decimos nada raro, solo pedimos repetir.
        // Opcional: Podrías poner un mensaje de "Espera un momento".
    }
});

client.initialize();