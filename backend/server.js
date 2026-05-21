require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/habits', require('./routes/habits'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/todos', require('./routes/todos'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/ideas', require('./routes/ideas'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = 3001;
app.listen(PORT, '127.0.0.1', () => console.log(`Backend running on http://localhost:${PORT}`));
