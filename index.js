require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

const sequelize = require('./db');
const models = require('./models/index');
const fileRoutes = require('./routes/files');
app.use('/files', fileRoutes(models));
const ensureTenancy = require('./migrations/ensureTenancy');
const ensurePricing = require('./migrations/ensurePricing');
const ensureRequestForm = require('./migrations/ensureRequestForm');
const ensurePriceVisibility = require('./migrations/ensurePriceVisibility');
const ensureRequestStatuses = require('./migrations/ensureRequestStatuses');
const ensureRequestStatusHistory = require('./migrations/ensureRequestStatusHistory');
const ensureInvoices = require('./migrations/ensureInvoices');
const ensureAccountsPayableEmail = require('./migrations/ensureAccountsPayableEmail');
const ensureMonumentSettingWorkflow = require('./migrations/ensureMonumentSettingWorkflow');
const ensureCoreDataObjects = require('./migrations/ensureCoreDataObjects');

sequelize.authenticate()
  .then(() => console.log('MySQL connected.'))
  .catch((err) => console.error('Connection failed:', err));


const { initializeDailyReminderJob } = require('./dailyReminderJob');

async function startDatabase() {
  await sequelize.authenticate();
  await ensureTenancy(sequelize, models);
  // await sequelize.sync({ force: false ,alter: true});
  await sequelize.sync({ force: false, logging: false,alter: process.env.DB_SYNC_ALTER === 'true' });
  await ensurePricing(sequelize, models);
  await ensureRequestForm(sequelize);
  await ensurePriceVisibility(sequelize);
  await ensureRequestStatuses(sequelize);
  await ensureRequestStatusHistory(models);
  await ensureAccountsPayableEmail(sequelize);
  await ensureMonumentSettingWorkflow(sequelize, models);
  await ensureCoreDataObjects(sequelize, models);
  await ensureInvoices(models);
  console.log('Tables synced.');
  initializeDailyReminderJob();
  app.listen(5000, () => console.log('Listening on port 5000'));
}

startDatabase()
  .catch((err) => console.error('Sync failed:', err));

const authRoutes    = require('./routes/auth');
const requestRoutes = require('./routes/request');
const adminRoutes   = require('./routes/admin');
const monumentSettingRoutes = require('./routes/monumentSetting');

app.use('/api', monumentSettingRoutes);
app.use('/api', authRoutes);
app.use('/api', requestRoutes);
app.use('/api/admin', adminRoutes(models));
