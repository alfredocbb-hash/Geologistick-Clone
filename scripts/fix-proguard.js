const fs = require('fs');
const path = require('path');

function fixProguardFiles(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      fixProguardFiles(fullPath);
    } else if (file.name === 'build.gradle' || file.name === 'build.gradle.kts') {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('proguard-android.txt')) {
        content = content.replace(/proguard-android\.txt/g, 'proguard-android-optimize.txt');
        fs.writeFileSync(fullPath, content);
        console.log(`✅ Fixed: ${fullPath}`);
      }
    }
  }
}

const androidDir = path.join(__dirname, '..', 'android');
if (fs.existsSync(androidDir)) {
  console.log('🔧 Fixing ProGuard configuration...');
  fixProguardFiles(androidDir);
  console.log('✅ ProGuard fix complete!');
} else {
  console.log('⚠️ Android directory not found, skipping ProGuard fix');
}
