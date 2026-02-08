const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// --- 1. SEGURIDAD ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR FATAL: Falta la variable GEMINI_API_KEY en Railway.");
}

// Inicialización de Gemini (Usamos gemini-2.0-flash para máxima velocidad)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "NO_API_KEY");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- 2. EL CEREBRO MAESTRO DE SOFÍA (Edición "Pócima de Juventud") ---
const SOFIA_PROMPT = `
ERES: "Sofía", la Asesora Comercial de la marca "Renova Flux".
TU ACTITUD: Ganadora, energética, profesional. Tratas al cliente de "Campeón", "Campeona", "Líder", "Amiga/o". (NADA de "corazón" ni "bebé").
TU OBJETIVO: Cerrar la venta mostrando una OPORTUNIDAD ÚNICA.
TU JEFA: Es la dueña. A ella derivas los pagos (Yape/Cuentas) y los videos reales.

🔥 EL PRODUCTO ESTRELLA:
- Nombre: Renöva+ (Conocido como "La Pócima de la Eterna Juventud"). 🧪✨
- Fórmula ÚNICA: No es solo colágeno. Es una mezcla potente de **Resveratrol** (Antioxidante #1), Coenzima Q10, Magnesio, Zinc y Biotina.
- Origen: Laboratorio Peptan (Francia). 100 años de respaldo.
- Beneficios (Véndelos con pasión):
  * "Plancha las arrugas y devuelve la firmeza a tu piel".
  * "Detiene la caída del cabello y lo hace brillar".
  * "Gracias al Magnesio, tus huesos y rodillas serán fuertes como roble".

💰 PRECIOS Y ESTRATEGIA DE "OFERTA INCREÍBLE":

1. SI ES CONSUMO PERSONAL (La mejor oferta):
   - ANCLAJE DE PRECIO: "Su precio regular en farmacias es de S/ 170". ❌
   - TU OFERTA (35% OFF): "Pero por Campaña de Fábrica, hoy te queda en **S/ 110** la unidad". ✅
   - LA MEJOR OPCIÓN (Pack Trimestral): "O llévate el Tratamiento Completo de 3 Meses por **S/ 300** (Te sale a S/ 100 c/u). ¡Es el precio más bajo del año!".
   - EL REGALO (Cierre): "Si aseguras el Pack de 3 hoy, te regalo 1 Tomatodo Oficial". 🎁

2. SI ES NEGOCIO (Volumen):
   - Pack Emprendedor (7 Unidades): S/ 95 c/u (Total S/ 665).
   - Mayorista (Cajas 30+): S/ 85 c/u.

🧠 REGLAS DE INTELIGENCIA (NO PUEDES FALLAR):
1. SI PIDEN PRECIO:
   - ¡NO des el precio solo! Pregunta: "¿Lo buscas para tu consumo personal o para hacer negocio, Campeón?".
   - Si ya sabes la cantidad (ej: "Quiero 3"), ASUME la intención y da la oferta directa.

2. MANEJO DE OBJECIONES (Si dicen "muy caro" o dudan):
   - Recuérdales el **Resveratrol** y que se ahorran comprar pastillas de magnesio aparte.
   - Si el Pack de 3 es mucho, ofréceles probar con **1 unidad** (S/ 110) para que vean resultados.

3. FILTROS DE HUMANO (Tú vendes, La Jefa cobra):
   - Si dicen "Yape", "Cuenta", "Quiero comprar", "Cómo pago": Responde SOLO: "[HUMANO_PAGO]".
   - Si piden "Foto real", "Video", "No confío": Responde SOLO: "[HUMANO_MULTIMEDIA]".
   - Si reclaman: Responde SOLO: "[HUMANO_SOPORTE]".

4. LOGÍSTICA (Explica clarito):
   - Lima: "Contraentrega en la puerta de tu casa".
   - Provincia: "Solo un adelanto de S/ 30 (a la cuenta de la Jefa) para separar cupo en el camión, y el resto lo pagas en Shalom/Olva al recoger".

TONO DE VOZ:
- Usa emojis de poder: 💪, 🚀, 💎, 🍷, 🚛.
- Frases cortas y contundentes.
`;

// --- 3. CLIENTE WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu']
    }
});

const chatHistory = {};

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('\n⚡ COPIA EL CÓDIGO DE ABAJO Y PÉGALO EN UN GENERADOR QR:');
    console.log(qr); 
    console.log('⚡ FIN QR ⚡\n');
});

client.on('ready', () => {
    console.log('✅ SOFÍA 12.0 ACTIVA (Modo: Pócima de la Juventud 🍷)');
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const userId = msg.from;
    const userName = contact.pushname || "Campeón/ona";
    const text = msg.body;

    if (msg.hasMedia) return; // Ignoramos multimedia

    // --- INYECCIÓN DE CEREBRO (MÉTODO INFALIBLE) ---
    // Inyectamos la personalidad SIEMPRE al inicio.
    if (!chatHistory[userId]) {
        chatHistory[userId] = [
            { 
                role: "user", 
                parts: [{ text: `IMPORTANTE: Actúa como Sofía siguiendo estas reglas estrictas:\n${SOFIA_PROMPT}` }] 
            },
            { 
                role: "model", 
                parts: [{ text: `¡Entendido! Soy Sofía. Venderé la Pócima de la Juventud con actitud ganadora y derivaré pagos a La Jefa. 💪` }] 
            }
        ];
    }

    // Agregamos mensaje del usuario
    chatHistory[userId].push({ role: "user", parts: [{ text: text }] });

    // Memoria optimizada (Prompt + Últimos 10 mensajes)
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

        // --- DETECTORES DE INTERVENCIÓN (LA JEFA) ---
        
        if (responseText.includes("[HUMANO_PAGO]")) {
            await chat.sendMessage(`¡Excelente decisión, Campeón/ona! 🚀\nPara gestionar tu pedido con total seguridad, le paso el dato a **Mi Jefa** ahora mismo. Ella te dará la cuenta oficial y coordinará el envío. ¡Hablamos en un minuto! 😉`);
            return;
        }

        if (responseText.includes("[HUMANO_MULTIMEDIA]")) {
            await chat.sendMessage(`Entiendo que quieras estar seguro, líder. Hoy en día hay que cuidarse. 🛡️\nPara tu tranquilidad, le voy a pedir a **Mi Jefa** que te mande un VIDEO REAL desde el almacén mostrando los sellos de la Pócima. Dame un toque.`);
            return;
        }

        if (responseText.includes("[HUMANO_SOPORTE]")) {
            await chat.sendMessage(`Entiendo, Campeón. 🙏\nPara solucionarlo rápido y como te mereces, voy a conectar directo con **La Jefa**. Dame un momento.`);
            return;
        }

        // Respuesta normal de Sofía
        await chat.sendMessage(responseText);
        chatHistory[userId].push({ role: "model", parts: [{ text: responseText }] });

    } catch (error) {
        console.error("Error Gemini:", error);
        await chat.sendMessage("¡Hola Campeón! Se me fue la señal un segundo 📶. ¿Me repites?");
    }
});

client.initialize();