const fs = require('fs');
let content = fs.readFileSync('src/components/Feed/Feed.tsx', 'utf8');
content = content.replace(/<\/div>\n  \);\n};/, '</div>\n    </>\n  );\n};');
fs.writeFileSync('src/components/Feed/Feed.tsx', content);
