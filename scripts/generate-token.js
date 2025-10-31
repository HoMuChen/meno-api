#!/usr/bin/env node
/**
 * Generate JWT Token for User
 * Generates a JWT authentication token for a specified user ID
 *
 * Usage: npm run generate:token <userId>
 * Example: npm run generate:token 507f1f77bcf86cd799439011
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/user.model');

// Validate command-line arguments
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Error: User ID is required');
  console.log('\nUsage: npm run generate:token <userId>');
  console.log('Example: npm run generate:token 507f1f77bcf86cd799439011');
  process.exit(1);
}

// Validate JWT_SECRET is configured
if (!process.env.JWT_SECRET) {
  console.error('❌ Error: JWT_SECRET not found in environment variables');
  console.error('Please ensure .env file exists with JWT_SECRET configured');
  process.exit(1);
}

// Validate MONGODB_URI is configured
if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  console.error('Please ensure .env file exists with MONGODB_URI configured');
  process.exit(1);
}

async function generateToken() {
  try {
    console.log('🔄 Connecting to database...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID format');
    }

    // Find user
    console.log(`🔍 Looking up user: ${userId}`);
    const user = await User.findById(userId);

    if (!user) {
      throw new Error(`User not found with ID: ${userId}`);
    }

    console.log(`✅ User found: ${user.name} (${user.email})\n`);

    // Check user status
    if (user.status !== 'active') {
      console.warn(`⚠️  Warning: User status is '${user.status}' (not active)`);
    }

    // Generate token
    console.log('🔐 Generating JWT token...');
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRY || '7d'
      }
    );

    console.log('✅ Token generated successfully!\n');

    // Display token information
    console.log('━'.repeat(80));
    console.log('📋 TOKEN DETAILS');
    console.log('━'.repeat(80));
    console.log(`User ID:    ${user._id}`);
    console.log(`Email:      ${user.email}`);
    console.log(`Name:       ${user.name}`);
    console.log(`Provider:   ${user.provider}`);
    console.log(`Status:     ${user.status}`);
    console.log(`Expires In: ${process.env.JWT_EXPIRY || '7d'}`);
    console.log('━'.repeat(80));
    console.log('🔑 JWT TOKEN');
    console.log('━'.repeat(80));
    console.log(token);
    console.log('━'.repeat(80));
    console.log('\n💡 Usage: Add this token to Authorization header as "Bearer <token>"\n');

    // Close database connection
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error generating token:', error.message);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

generateToken();
