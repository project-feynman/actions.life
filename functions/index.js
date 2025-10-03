const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const functions = require('firebase-functions');
const { checkNotify } = require('./checkNotify');
const { handleTemplate } = require('./handleTemplate');
const { getFirestore, getDocs, collection, where, setDoc, doc } = require('firebase-admin/firestore');
const { onScheduleWithTracking } = require('./errorTracking');

const db = getFirestore('schema-compliant');

exports.notifications = onScheduleWithTracking(
  {
    schedule: '* * * * *', // crontab syntax every min
    region: 'asia-northeast1', // Tokyo region
  },
  async (event) => {
    await checkNotify(db);
  },
  'notifications'
)