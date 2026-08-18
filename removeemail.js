'use strict';
const { Admin } = require('./models');
const TARGET_EMAIL = 'Jay@AndersonMemorrialPark.com';
(async () => {
  try {
    const admins = await Admin.findAll();
    const admin = admins.find(
      (a) => a.email.toLowerCase() === TARGET_EMAIL.toLowerCase()
    );
    if (!admin) {
      console.error(`No admin found with email: ${TARGET_EMAIL}`);
      process.exit(1);
    }
    await admin.update({ emailRemindersEnabled: false });
    console.log(`✓ Disabled email reminders for admin #${admin.id} (${admin.email})`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to update admin:', err);
    process.exit(1);
  }
})();