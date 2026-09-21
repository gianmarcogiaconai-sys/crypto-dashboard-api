module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { symbol = 'SOL-USDT', timeframe = '15min' } = req.query;

    // Fetch from Kucoin
    const url = `https://api.kucoin.com/api/v1/market/candles?symbol=${symbol}&type=${timeframe}`;
    const response = await fetch(url);
    const json = await response.json();

    if (!json.data || json.data.length === 0) {
      return res.status(400).json({ error: 'No data from Kucoin for ' + symbol });
    }

    const candles = json.data.map(c => ({
      open: parseFloat(c[1]),
      close: parseFloat(c[2]),
      high: parseFloat(c[3]),
      low: parseFloat(c[4])
    }));

    const closes = candles.map(c => c.close);
    const currentPrice = closes[closes.length - 1];

    // RSI calculation
    const period = 14;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // EMA calculation
    const calcEMA = (data, period) => {
      const k = 2 / (period + 1);
      let ema = data.slice(0, period).reduce((a, b) => a + b) / period;
      for (let i = period; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
      }
      return ema;
    };

    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);

    // Signal
    let signal = 'NEUTRAL';
    let strength = 0;

    if (rsi < 30) strength += 2;
    if (rsi > 70) strength -= 2;
    if (ema20 > ema50) strength += 1;

    if (strength >= 2) signal = 'BUY';
    else if (strength <= -2) signal = 'SELL';

    res.status(200).json({
      symbol,
      timeframe,
      price: Math.round(currentPrice * 10000) / 10000,
      rsi: Math.round(rsi * 100) / 100,
      ema20: Math.round(ema20 * 10000) / 10000,
      ema50: Math.round(ema50 * 10000) / 10000,
      signal,
      strength,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
