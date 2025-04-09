const express = require('express');
const app = express();
const userRoutes = require('./userRoutes'); // ✅ Correct path to userRoutes.js

app.use(express.json()); // Middleware to parse JSON requests

app.use('/api/users', userRoutes); // Mount user routes under /api/users

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
