const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios');
const twilio = require('twilio');
const crypto = require('crypto');
require('dotenv').config();

const { initDB, getClients, updateStatus, addClient } = require('./db-service');
const { generatePersonalizedContent } = require('./ai-service');
const { initializeWhatsApp, getWhatsAppState, sendWhatsApp, sendSMS } = require('./messaging-service');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 4000;

const availableNumbers = (process.env.TWILIO_PHONE_NUMBERS || '').split(',').map(n => n.trim());
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.use(express.json());
app.use(express.static('public'));
const ivrSessions = {};
initDB().catch(e => console.error('DB Hatasi:', e));

app.post('/ivr/start', async (req, res) => {
      const { name, speechText } = req.body;
      const sessionId = crypto.randomUUID();
      ivrSessions[sessionId] = { name, speechText, status: 'Bekliyor' };
      res.json({ sessionId });
});

app.all('/twiml/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      const session = ivrSessions[sessionId];
      if (!session) return res.type('text/xml').send('<Response><Say>Hata.</Say></Response>');
      const host = req.get('host');
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const baseUrl = `${protocol}://${host}`;
      res.type('text/xml').send(`
              <Response>
                          <Gather action="${baseUrl}/webhook/${sessionId}" method="POST" numDigits="1" timeout="10">
                                          <Say language="tr-TR" voice="Polly.Filiz">\${session.speechText}</Say>
                                                      </Gather>
                                                                  <Say language="tr-TR" voice="Polly.Filiz">Herhangi bir tus alinmadi.</Say>
                                                                          </Response>
                                                                              `);
});

app.post('/webhook/:sessionId', async (req, res) => {
      const { sessionId } = req.params;
      const digits = req.body.Digits;
      const session = ivrSessions[sessionId];
      let status = 'Bilinmiyor';
      if (digits === '1') status = 'Evet (Katilacak)';
      else if (digits === '2') status = 'Hayir (Katilmayacak)';
      if (session && session.clientId) {
                await updateStatus(session.clientId, status);
                io.emit('refresh');
      }
      res.type('text/xml').send('<Response><Say language="tr-TR" voice="Polly.Filiz">Bilgileriniz kaydedildi. Tesekkurler.</Say></Response>');
      delete ivrSessions[sessionId];
});

app.get('/api/clients', async (req, res) => {
      const data = await getClients();
      res.json(data);
});
app.get('/api/numbers', (req, res) => res.json(availableNumbers));
app.get('/api/whatsapp-status', (req, res) => res.json(getWhatsAppState()));

app.post('/api/action', async (req, res) => {
      const { id, type, fromNumber } = req.body;
      const data = await getClients();
      const client = data.find(c => c.id === id);
      if (!client) return res.status(404).json({ error: 'Musteri yok' });
      const selectedFrom = fromNumber || availableNumbers[0];
      try {
                const content = await generatePersonalizedContent(client.name, client.event);
                if (type === 'call') {
                              const sessionId = crypto.randomUUID();
                              ivrSessions[sessionId] = { name: client.name, speechText: content.speechText, clientId: client.id };
                              const host = req.get('host');
                              const protocol = req.headers['x-forwarded-proto'] || 'http';
                              const baseUrl = \`\${protocol}://\${host}\`;
                                          await twilioClient.calls.create({
                                                          url: \`\${baseUrl}/twiml/\${sessionId}\`,
                                                                          to: formatPhone(client.phone),
                                                                                          from: selectedFrom
                                                                                                      });
                                                                                                                  await updateStatus(client.id, 'Araniyor...');
                                                                                                                          } else if (type === 'whatsapp') {
                                                                                                                                      await sendWhatsApp(client.phone, content.messageText);
                                                                                                                                                  await updateStatus(client.id, 'WhatsApp Gonderildi');
                                                                                                                                                          } else if (type === 'sms') {
                                                                                                                                                                      await sendSMS(client.phone, content.messageText, selectedFrom);
                                                                                                                                                                                  await updateStatus(client.id, 'SMS Gonderildi');
                                                                                                                                                                                          }
                                                                                                                                                                                                  res.json({ success: true });
                                                                                                                                                                                                          io.emit('refresh');
                                                                                                                                                                                                              } catch (error) {
                                                                                                                                                                                                                      res.status(500).json({ error: error.message });
                                                                                                                                                                                                                          }
                                                                                                                                                                                                                          });
                                                                                                                                                                                                                          
                                                                                                                                                                                                                          app.post('/api/register', async (req, res) => {
                                                                                                                                                                                                                              const { name, phone, event } = req.body;
                                                                                                                                                                                                                                  await addClient(name, phone, event);
                                                                                                                                                                                                                                      io.emit('refresh');
                                                                                                                                                                                                                                          res.json({ success: true });
                                                                                                                                                                                                                                          });
                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                          app.get('/kayit', (req, res) => res.sendFile(path.join(__dirname, 'public', 'kayit.html')));
                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                          function formatPhone(p) {
                                                                                                                                                                                                                                              let raw = p.replace(/\\D/g, '');
                                                                                                                                                                                                                                                  if (raw.startsWith('90')) return '+' + raw;
                                                                                                                                                                                                                                                      if (raw.startsWith('0')) return '+9' + raw;
                                                                                                                                                                                                                                                          return '+90' + raw;
                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                                          io.on('connection', (socket) => {
                                                                                                                                                                                                                                                              const waInterval = setInterval(() => socket.emit('whatsapp-status', getWhatsAppState()), 2000);
                                                                                                                                                                                                                                                                  socket.on('disconnect', () => clearInterval(waInterval));
                                                                                                                                                                                                                                                                  });
                                                                                                                                                                                                                                                                  
                                                                                                                                                                                                                                                                  server.listen(port, () => {
                                                                                                                                                                                                                                                                      console.log(\`NexGen Cloud Running on port \${port}\`);
                                                                                                                                                                                                                                                                          initializeWhatsApp();
                                                                                                                                                                                                                                                                          });
