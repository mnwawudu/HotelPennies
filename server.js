const express = require('express');
const app = express();const userRoutes = require('./userRoutes');
const userRoutes = require('./userRoutes');
 // ✅ Correct path

app.use(express.json());

app.use('/api/users', userRoutes); // All routes under /api/users

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
