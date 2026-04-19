const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const sessions = {};

app.post('/sessions', (req, res) => {
    const { name, speechText } = req.body;
    if (!speechText) return res.status(400).json({ error: 'speechText gerekli.' });
    const sessionId = crypto.randomUUID();
    sessions[sessionId] = { name: name || 'Bilinmiyor', speechText: speechText, status: 'Bekliyor', createdAt: new Date() };
    console.log('[Yeni Oturum] ID: ' + sessionId + ', Kisi: ' + name);
    res.json({ sessionId });
});

app.all('/twiml/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (!session) { res.type('text/xml'); return res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sistem hatasi. Kayit bulunamadi.</Say></Response>'); }
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const baseUrl = protocol + '://' + host;
    const escapedText = session.speechText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Gather action="' + baseUrl + '/webhook/' + sessionId + '" method="POST" numDigits="1" timeout="10"><Say language="tr-TR" voice="Polly.Filiz">' + escapedText + '</Say></Gather><Say language="tr-TR" voice="Polly.Filiz">Herhangi bir tus algilanmadi. Iyi gunler dileriz.</Say></Response>');
});

app.post('/webhook/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const digits = req.body.Digits;
    const session = sessions[sessionId];
    if (session) { if (digits === '1') session.status = 'Evet (Katilacak)'; else if (digits === '2') session.status = 'Hayir (Katilmayacak)'; else session.status = 'Gecersiz (' + digits + ')'; }
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say language="tr-TR" voice="Polly.Filiz">Bilgileriniz kaydedildi. Tesekkur eder, iyi gunler dileriz.</Say></Response>');
});

app.get('/results', (req, res) => {
    const completed = {};
    for (const id in sessions) { if (sessions[id].status !== 'Bekliyor') { completed[id] = sessions[id]; } }
    res.json(completed);
});

app.post('/results/clear', (req, res) => {
    const { ids } = req.body;
    if (Array.isArray(ids)) { ids.forEach(id => delete sessions[id]); }
    res.json({ success: true });
});

app.get('/', (req, res) => res.send('Twilio Webhook Sunucusu Calisiyor'));

app.listen(port, () => { console.log('Sunucu calisiyor: ' + port); });
