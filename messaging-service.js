const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const twilio = require('twilio');
require('dotenv').config();
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;
const whatsappClient = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'], executablePath: process.env.CHROME_PATH || undefined }
});
let whatsappStatus = 'DISCONNECTED';
let qrCodeData = null;
whatsappClient.on('qr', (qr) => { whatsappStatus = 'QR_READY'; qrCodeData = qr; });
whatsappClient.on('ready', () => { whatsappStatus = 'READY'; qrCodeData = null; });
async function sendWhatsApp(phone, message) {
      let formatted = phone.replace(/\D/g, '');
      if (formatted.startsWith('0')) formatted = '9' + formatted;
      else if (!formatted.startsWith('90')) formatted = '90' + formatted;
      await whatsappClient.sendMessage(formatted + "@c.us", message);
}
async function sendSMS(phone, message, fromNumber) {
      if (!twilioClient) return;
      let formatted = phone.replace(/\D/g, '');
      if (formatted.startsWith('0')) formatted = '+9' + formatted;
      else if (formatted.startsWith('90')) formatted = '+' + formatted;
      else formatted = '+90' + formatted;
      await twilioClient.messages.create({ body: message, to: formatted, from: fromNumber || process.env.TWILIO_PHONE_NUMBERS.split(',')[0] });
}
function initializeWhatsApp() { whatsappClient.initialize(); }
function getWhatsAppState() { return { status: whatsappStatus, qr: qrCodeData }; }
module.exports = { initializeWhatsApp, getWhatsAppState, sendWhatsApp, sendSMS };
