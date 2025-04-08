const express = require('express');
const app = express();
const userRoutes = require('./userRoutes');
 // ✅ Corrected path

app.use(express.json()); // For parsing JSON bodies

// ✅ Use the routes
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
