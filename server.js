const express = require('express');
const app = express();
const userRoutes = require('./routes/userRoutes'); // ✅ Load userRoutes from the 'routes' folder

app.use(express.json()); // Enable JSON body parsing

app.use('/api/users', userRoutes); // ✅ Mount the user routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
