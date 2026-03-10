const fs = require('fs');
let content = fs.readFileSync('src/components/Feed/Feed.tsx', 'utf8');
content = content.replace(
  /const { isScreenFlashActive, triggerFlash } = useFlashLight\(stream, flashOnMovement, flashDurationMs\);\n\s*const { checkFrame: checkDarkMotion } = useDarkMotionDetector\(triggerFlash, isScreenFlashActive\);/,
  'const { isScreenFlashActive, isFlashActive, triggerFlash } = useFlashLight(stream, flashOnMovement, flashDurationMs);\n  const { checkFrame: checkDarkMotion } = useDarkMotionDetector(triggerFlash, isFlashActive);'
);
fs.writeFileSync('src/components/Feed/Feed.tsx', content);
