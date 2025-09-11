import express from 'express';
const app = express();
const port = 5000;

app.get('/', (req, res) => {
  res.send('Hello! Server is working!');
});

app.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`);
});