const fs = require('fs');
const https = require('https');

const url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1NjI2OWE1YWJlOGYwMmQzYzIxZTI0MWQ4ZWNmEgsSBxDMmJ6btQcYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTQ5NDY4MjQ4MTc3ODg2NjQ0Nw&filename=&opi=89354086";

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('new_stitch.html', data);
    console.log('Downloaded');
  });
}).on('error', err => {
  console.error(err);
});
