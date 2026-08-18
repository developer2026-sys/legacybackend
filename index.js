require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());
app.use('/files', express.static('/tmp/public/files'));

const sequelize = require('./db');
const models = require('./models/index');

sequelize.authenticate()
  .then(() => console.log('MySQL connected.'))
  .catch((err) => console.error('Connection failed:', err));


const { initializeDailyReminderJob } = require('./dailyReminderJob');

sequelize.sync({ force: false })
  .then(async () => {
    console.log('Tables synced.');
    initializeDailyReminderJob();
  })
  .catch((err) => console.error('Sync failed:', err));

const authRoutes    = require('./routes/auth');
const requestRoutes = require('./routes/request');
const adminRoutes   = require('./routes/admin');
const billingRoutes = require('./routes/billing');

app.use('/api', authRoutes);
app.use('/api', requestRoutes);
app.use('/api', billingRoutes);
app.use('/api/admin', adminRoutes(models));

// Test route to manually trigger reminder

app.listen(5000, () => console.log('Listening on port 5000'));