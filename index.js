const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.static('public'));

// Endpoint per analisi crypto
app.get('/api/analyze', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { symbol = 'SOL-USDT', timeframe = '15min' } = req.query;
    const url = `https://api.kucoin.com/api/v1/market/candles?symbol=${symbol}&type=${timeframe}`;
    
    const response = await fetch(url);
    const json = await response.json();
    
    if (!json.data) {
      return res.status(400).json({ error: 'Invalid symbol or no data' });
    }

    const candles = json.data.slice(0, 50);
    let closes = candles.map(c => parseFloat(c[4]));
    let price = closes[0];

    // RSI (14)
    let gains = 0, losses = 0;
    for (let i = 1; i < Math.min(14, closes.length); i++) {
      const delta = closes[i] - closes[i - 1];
      if (delta > 0) gains += delta;
      else losses -= delta;
    }
    let rs = (losses === 0) ? 100 : gains / losses;
    let rsi = 100 - (100 / (1 + rs));

    // EMA20
    let ema20 = closes[0];
    for (let i = 1; i < Math.min(20, closes.length); i++) {
      ema20 = closes[i] * (2 / 21) + ema20 * (19 / 21);
    }

    // EMA50
    let ema50 = closes[0];
    for (let i = 1; i < Math.min(50, closes.length); i++) {
      ema50 = closes[i] * (2 / 51) + ema50 * (49 / 51);
    }

    // Segnale
    let strength = 0;
    if (rsi < 30) strength += 2;
    if (rsi > 70) strength -= 2;
    if (ema20 > ema50) strength += 1;
    else strength -= 1;

    let signal = 'NEUTRAL';
    if (strength >= 2) signal = 'BUY';
    if (strength <= -2) signal = 'SELL';

    res.json({
      symbol,
      timeframe,
      price: parseFloat(price),
      rsi: parseFloat(rsi.toFixed(2)),
      ema20: parseFloat(ema20.toFixed(2)),
      ema50: parseFloat(ema50.toFixed(2)),
      signal,
      strength,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
