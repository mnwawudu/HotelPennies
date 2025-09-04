// scripts/migrate-indexes.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI missing in .env');
    process.exit(1);
  }

  const client = new MongoClient(uri, { ignoreUndefined: true });

  try {
    await client.connect();

    // Derive DB name from your connection string
    const dbNameFromUri = (() => {
      try {
        const u = new URL(uri);
        return (u.pathname || '').replace(/^\//, '') || undefined;
      } catch {
        return undefined;
      }
    })();

    const db = client.db(dbNameFromUri);
    console.log('🔎 Current DB:', db.databaseName);

    const ensurePartialUnique = async (collectionName, field, indexName) => {
      const coll = db.collection(collectionName);
      const existing = await coll.indexes();
      if (existing.some(ix => ix.name === indexName)) {
        console.log(`ℹ️  Index ${collectionName}.${indexName} already exists (skip).`);
        return;
      }

      console.log(`🔧 Creating unique index ${collectionName}.${indexName}...`);
      try {
        // IMPORTANT: Avoid $not. Use { $exists: true, $gt: "" } to exclude empty strings.
        await coll.createIndex(
          { [field]: 1 },
          {
            name: indexName,
            unique: true,
            partialFilterExpression: {
              [field]: { $exists: true, $gt: '' }, // no $not, no complex expressions
            },
          }
        );
        console.log(`✅ Created ${collectionName}.${indexName}`);
      } catch (e) {
        console.error(`❌ Could not create ${collectionName}.${indexName}: ${e.message}`);

        // If index creation fails, help by showing duplicates for non-empty strings
        try {
          const dups = await coll
            .aggregate([
              { $match: { [field]: { $exists: true, $type: 'string', $gt: '' } } },
              { $group: { _id: `$${field}`, count: { $sum: 1 }, ids: { $push: '$_id' } } },
              { $match: { count: { $gt: 1 } } },
              { $limit: 50 },
            ])
            .toArray();

          if (dups.length) {
            console.log(`🚨 Duplicate ${collectionName}.${field} values (showing up to 50):`);
            dups.forEach(d =>
              console.log(` - ${d._id} ×${d.count} => ${d.ids.map(String).join(', ')}`)
            );
          } else {
            console.log('ℹ️ No obvious duplicates found for non-empty strings.');
          }
        } catch (subErr) {
          console.warn('⚠️  Could not run duplicate check:', subErr.message);
        }

        throw e;
      }
    };

    // Your previous affiliateCode checks can stay if you need them; here we just do email:
    await ensurePartialUnique('users', 'email', 'email_unique_nonempty');
    await ensurePartialUnique('vendors', 'email', 'email_unique_nonempty');

    console.log('✅ Migration finished.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
