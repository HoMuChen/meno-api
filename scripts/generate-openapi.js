#!/usr/bin/env node
/**
 * Generate OpenAPI YAML Specification
 * Loads the OpenAPI spec from the config and converts it to YAML
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'openapi.yaml');

console.log('🔄 Generating OpenAPI specification...');

try {
  // Load the swagger spec from the config
  const swaggerSpec = require('../src/components/config/swagger');

  // Convert to YAML
  const yamlSpec = yaml.dump(swaggerSpec, {
    indent: 2,
    lineWidth: 120,
    noRefs: true
  });

  // Ensure docs directory exists
  const docsDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Write YAML file
  fs.writeFileSync(OUTPUT_PATH, yamlSpec, 'utf8');

  console.log('✅ OpenAPI specification generated successfully!');
  console.log(`📄 File: ${OUTPUT_PATH}`);
  console.log(`📊 Endpoints documented: ${Object.keys(swaggerSpec.paths || {}).length}`);
  console.log(`🏷️  Tags: ${(swaggerSpec.tags || []).map(t => t.name).join(', ')}`);
} catch (error) {
  console.error('❌ Error generating OpenAPI spec:', error.message);
  console.error(error.stack);
  process.exit(1);
}
