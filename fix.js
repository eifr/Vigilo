const fs = require('fs');
let content = fs.readFileSync('src/components/Feed/Feed.tsx', 'utf8');
content = content.replace(/(<>\n\s*{isScreenFlashActive && \(\n\s*<div className="fixed inset-0 z-\[9999\] bg-white w-screen h-screen pointer-events-none" \/>\n\s*\)}\n\s*)+/g, '<>\n      {isScreenFlashActive && (\n        <div className="fixed inset-0 z-[9999] bg-white w-screen h-screen pointer-events-none" />\n      )}\n    ');
fs.writeFileSync('src/components/Feed/Feed.tsx', content);
