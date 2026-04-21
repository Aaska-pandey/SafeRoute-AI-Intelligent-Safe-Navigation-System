const fs = require('fs');

let content = fs.readFileSync('backend/server.js', 'utf8');

content = content.replace(/const PORT = process\.env\.PORT \|\| \d+;/, 'const PORT = process.env.PORT || 0;');

const targetAppListen = /app\.listen\(PORT, \(\) => {[\s\S]*?}\);/;
const replacementAppListen = 'const server = app.listen(PORT, () => {\\n' +
'    const port = server.address().port;\\n' +
'    console.log("\\x1b[32m=============================================\\x1b[0m");\\n' +
'    console.log("\\x1b[32m✅ SafeRoute Backend Successfully Started!\\x1b[0m");\\n' +
'    console.log("\\x1b[36m👉 Open your browser at: http://localhost:" + port + "\\x1b[0m");\\n' +
'    console.log("\\x1b[32m=============================================\\x1b[0m");\\n' +
'});';

content = content.replace(targetAppListen, replacementAppListen);

fs.writeFileSync('backend/server.js', content, 'utf8');
console.log("Updated server.js");
