const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
async function generatePersonalizedContent(name, eventDetails) {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "buraya_yapistirin") {
                return {
                              speechText: `Merhaba Sayin ${name}. ${eventDetails} hakkinda ariyoruz. Katilacaksaniz 1, katilmayacaksaniz 2 tuslayin.`,
                              messageText: `Merhaba ${name}, ${eventDetails} hakkinda sizi aradik. Katiliminizi bekliyoruz.`
                };
      }
      try {
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `Sen profesyonel bir asistansin. Musteri: ${name}, Konu: ${eventDetails}. Konusma metni (sonu 1 veya 2 tuslayin olmali) ve mesaj metni uret. Yanit: {"speechText": "...", "messageText": "..."}`;
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                const jsonMatch = text.match(/\{.*\}/s);
                return jsonMatch ? JSON.parse(jsonMatch[0]) : { speechText: "Hata", messageText: "Hata" };
      } catch (e) {
                return { speechText: "Merhaba", messageText: "Merhaba" };
      }
}
module.exports = { generatePersonalizedContent };
