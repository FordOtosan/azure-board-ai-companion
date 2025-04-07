const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('glob');

// Path configurations
const extensionRoot = path.resolve(__dirname, '..');
const extensionManifestPath = path.join(extensionRoot, 'vss-extension.json');

// Function to increment minor version
const incrementMinorVersion = () => {
  // Read the manifest file
  const manifestContent = fs.readFileSync(extensionManifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);
  
  // Extract current version
  const currentVersion = manifest.version;
  console.log(`Current version: ${currentVersion}`);
  
  // Increment minor version
  const versionParts = currentVersion.split('.');
  versionParts[1] = parseInt(versionParts[1]) + 1;
  versionParts[2] = 0; // Reset patch version
  
  const newVersion = versionParts.join('.');
  console.log(`New version: ${newVersion}`);
  
  // Update manifest with new version
  manifest.version = newVersion;
  
  // Write updated manifest back to the file
  fs.writeFileSync(extensionManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  
  return newVersion;
};

// Function to clean up existing VSIX files
const cleanupExistingPackages = () => {
  const vsixFiles = glob.sync('*.vsix', { cwd: extensionRoot });
  
  if (vsixFiles.length > 0) {
    console.log('Removing existing VSIX packages:');
    vsixFiles.forEach(file => {
      const filePath = path.join(extensionRoot, file);
      console.log(`  - ${file}`);
      fs.removeSync(filePath);
    });
  } else {
    console.log('No existing VSIX packages found.');
  }
};

// Function to package the extension
const packageExtension = () => {
  console.log('Building extension...');
  execSync('npm run build', { stdio: 'inherit', cwd: extensionRoot });
  
  console.log('Packaging extension...');
  execSync('npx tfx extension create --manifest-globs vss-extension.json', 
    { stdio: 'inherit', cwd: extensionRoot });
};

// Main execution
try {
  console.log('Starting packaging process...');
  
  // Step 1: Clean up existing packages
  cleanupExistingPackages();
  
  // Step 2: Increment version
  const newVersion = incrementMinorVersion();
  
  // Step 3: Build and package
  packageExtension();
  
  console.log(`Successfully packaged extension version ${newVersion}`);
} catch (error) {
  console.error('Error during packaging:', error);
  process.exit(1);
}