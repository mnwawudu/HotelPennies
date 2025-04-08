const express = require('express');
const app = express();
const userRoutes = require('./routes/userRoutes'); // ✅ This line loads your routes

app.use(express.json()); // For parsing JSON bodies

// ✅ Mount the user routes at /api/users
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
