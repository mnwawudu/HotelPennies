const express = require('express');
const app = express();
const userRoutes = require('./routes/userRoutes'); // ✅ This path assumes the file is in the routes folder

app.use(express.json());

app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
