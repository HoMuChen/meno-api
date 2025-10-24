/**
 * Tier Configuration Seeder
 * Seeds the database with initial tier configurations
 *
 * Usage: node scripts/seedTiers.js
 */

const mongoose = require('mongoose');
const TierConfig = require('../src/models/tierConfig.model');
require('dotenv').config();

// Tier configurations
const tiers = [
  {
    name: 'free',
    displayName: 'Free',
    limits: {
      monthlyDuration: 3600, // 60 minutes in seconds
      maxFileSize: 26214400  // 25 MB in bytes
    },
    features: ['basic_transcription'],
    price: 0,
    isActive: true
  },
  {
    name: 'plus',
    displayName: 'Plus',
    limits: {
      monthlyDuration: 18000, // 300 minutes (5 hours) in seconds
      maxFileSize: 104857600  // 100 MB in bytes
    },
    features: [
      'basic_transcription',
      'advanced_transcription',
      'export_formats',
      'priority_processing'
    ],
    price: 999, // $9.99 in cents
    isActive: true
  },
  {
    name: 'pro',
    displayName: 'Pro',
    limits: {
      monthlyDuration: -1,    // Unlimited
      maxFileSize: 524288000  // 500 MB in bytes
    },
    features: [
      'basic_transcription',
      'advanced_transcription',
      'export_formats',
      'priority_processing',
      'custom_vocabulary',
      'api_access',
      'team_collaboration'
    ],
    price: 2999, // $29.99 in cents
    isActive: true
  }
];

async function seedTiers() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meno';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if tiers already exist
    const existingCount = await TierConfig.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing tiers. Do you want to:`);
      console.log('   1. Skip seeding (recommended if tiers are already configured)');
      console.log('   2. Update existing tiers with these values');
      console.log('   3. Delete all and recreate');
      console.log('\nℹ️  To proceed, modify this script or manually delete tiers first.');
      console.log('   You can also update tiers via the API endpoints.\n');

      // For safety, we'll just skip
      console.log('Skipping seed - tiers already exist.');
      process.exit(0);
    }

    // Insert tiers
    console.log('\n🌱 Seeding tier configurations...\n');

    for (const tierData of tiers) {
      const tier = new TierConfig(tierData);
      await tier.save();

      console.log(`✅ Created tier: ${tier.displayName}`);
      console.log(`   - Monthly Duration: ${tier.limits.monthlyDuration === -1 ? 'Unlimited' : `${tier.limits.monthlyDuration / 60} minutes`}`);
      console.log(`   - Max File Size: ${tier.limits.maxFileSize / 1024 / 1024} MB`);
      console.log(`   - Price: $${tier.price / 100}`);
      console.log(`   - Features: ${tier.features.length}`);
      console.log('');
    }

    console.log('✨ Tier seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Free: 60 min/month, 25 MB max file`);
    console.log(`   - Plus: 300 min/month, 100 MB max file ($9.99/mo)`);
    console.log(`   - Pro: Unlimited, 500 MB max file ($29.99/mo)`);
    console.log('');

  } catch (error) {
    console.error('❌ Error seeding tiers:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run seeder
seedTiers();
