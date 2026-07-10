const https = require('https');
const fs = require('fs');
https.get('https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1NjI2YTBlYzkxNDMwMWE2MzI5NDZkMThmOGYwEgsSBxDMmJ6btQcYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTQ5NDY4MjQ4MTc3ODg2NjQ0Nw&filename=&opi=89354086', r => r.pipe(fs.createWriteStream('triggers_ribbon.html')));
